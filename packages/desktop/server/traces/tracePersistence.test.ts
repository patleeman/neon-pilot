import { beforeEach, describe, expect, it, vi } from 'vitest';

const traceWorkerClient = vi.hoisted(() => ({
  traceWorkerAutoMode: vi.fn(),
  traceWorkerCompaction: vi.fn(),
  traceWorkerContext: vi.fn(),
  traceWorkerContextPointerInspect: vi.fn(),
  traceWorkerStats: vi.fn(),
  traceWorkerSuggestedContext: vi.fn(),
  traceWorkerToolCall: vi.fn(),
}));

vi.mock('./traceWorkerClient.js', () => traceWorkerClient);

import {
  persistTraceAutoMode,
  persistTraceCompaction,
  persistTraceContext,
  persistTraceContextPointerInspect,
  persistTraceStats,
  persistTraceSuggestedContext,
  persistTraceToolCall,
} from './tracePersistence.js';

describe('trace persistence hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards stats, context, tool, auto-mode, suggestions, and pointer inspect traces to the worker', () => {
    persistTraceStats({ sessionId: 's1', tokensInput: 1, tokensOutput: 2, cost: 0.1 });
    persistTraceContext({ sessionId: 's1', totalTokens: 10, contextWindow: 100, pct: 10, systemPromptTokens: 3 });
    persistTraceToolCall({ sessionId: 's1', toolName: 'bash', status: 'error', errorMessage: 'boom' });
    persistTraceAutoMode({ sessionId: 's1', enabled: false, stopReason: 'done' });
    persistTraceSuggestedContext({ sessionId: 's1', pointerIds: ['p1', 'p2'] });
    persistTraceContextPointerInspect({ sessionId: 's1', inspectedConversationId: 's2', wasSuggested: true });

    expect(traceWorkerClient.traceWorkerStats).toHaveBeenCalledWith({ sessionId: 's1', tokensInput: 1, tokensOutput: 2, cost: 0.1 });
    expect(traceWorkerClient.traceWorkerContext).toHaveBeenCalledWith({
      sessionId: 's1',
      totalTokens: 10,
      contextWindow: 100,
      pct: 10,
      systemPromptTokens: 3,
    });
    expect(traceWorkerClient.traceWorkerToolCall).toHaveBeenCalledWith({
      sessionId: 's1',
      toolName: 'bash',
      status: 'error',
      errorMessage: 'boom',
    });
    expect(traceWorkerClient.traceWorkerAutoMode).toHaveBeenCalledWith({ sessionId: 's1', enabled: false, stopReason: 'done' });
    expect(traceWorkerClient.traceWorkerSuggestedContext).toHaveBeenCalledWith({ sessionId: 's1', pointerIds: ['p1', 'p2'] });
    expect(traceWorkerClient.traceWorkerContextPointerInspect).toHaveBeenCalledWith({
      sessionId: 's1',
      inspectedConversationId: 's2',
      wasSuggested: true,
    });
  });

  it('normalizes missing compaction token counts to zero before sending to the worker', () => {
    persistTraceCompaction({ sessionId: 's1', reason: 'manual' });
    expect(traceWorkerClient.traceWorkerCompaction).toHaveBeenCalledWith({
      sessionId: 's1',
      reason: 'manual',
      tokensBefore: 0,
      tokensAfter: 0,
      tokensSaved: 0,
    });

    persistTraceCompaction({ sessionId: 's2', reason: 'threshold', tokensBefore: 100, tokensAfter: 40, tokensSaved: 60 });
    expect(traceWorkerClient.traceWorkerCompaction).toHaveBeenLastCalledWith({
      sessionId: 's2',
      reason: 'threshold',
      tokensBefore: 100,
      tokensAfter: 40,
      tokensSaved: 60,
    });
  });
});
