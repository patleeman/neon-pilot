/**
 * Tests for trace persistence hooks in liveSessionEventHandling.ts
 *
 * Verifies that persistTraceToolCall and persistTraceCompaction
 * are called with correct arguments when SSE events fire.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the persist functions before importing the handler
const { persistTraceToolCallMock, persistTraceCompactionMock, persistAppTelemetryEventMock } = vi.hoisted(() => ({
  persistTraceToolCallMock: vi.fn(),
  persistTraceCompactionMock: vi.fn(),
  persistAppTelemetryEventMock: vi.fn(),
}));

vi.mock('../traces/appTelemetry.js', () => ({
  persistAppTelemetryEvent: persistAppTelemetryEventMock,
}));

vi.mock('../traces/tracePersistence.js', () => ({
  persistTraceToolCall: persistTraceToolCallMock,
  persistTraceCompaction: persistTraceCompactionMock,
}));

import { handleLiveSessionEvent } from './liveSessionEventHandling.js';

// ── Streaming lifecycle callbacks ────────────────────────────────────────────

describe('streaming lifecycle callbacks', () => {
  function makeEntry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 'sess-1',
      session: {} as unknown,
      title: 'Test',
      ...overrides,
    } as unknown;
  }

  function makeCallbacks() {
    return {
      requestConversationAutoModeContinuationTurn: vi.fn().mockResolvedValue(false),
      requestConversationAutoModeTurn: vi.fn().mockResolvedValue(false),
      syncDurableConversationRun: vi.fn().mockResolvedValue(undefined),
      notifyLifecycleHandlers: vi.fn(),
      applyPendingConversationWorkingDirectoryChange: vi.fn().mockResolvedValue(undefined),
      scheduleContextUsage: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
      broadcastQueueState: vi.fn(),
      broadcastTitle: vi.fn(),
      broadcastStats: vi.fn(),
      clearContextUsageTimer: vi.fn(),
      broadcastContextUsage: vi.fn(),
      broadcastSnapshot: vi.fn(),
      broadcast: vi.fn(),
      tryImportReadyParallelJobs: vi.fn().mockResolvedValue(undefined),
      syncRunningState: vi.fn(),
    };
  }

  it('agent_start marks durable run as running and syncs running state', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();
    handleLiveSessionEvent(entry, { type: 'agent_start' } as unknown, cbs);
    expect(cbs.syncDurableConversationRun).toHaveBeenCalledWith(entry, 'running');
    expect(cbs.syncRunningState).toHaveBeenCalledWith('sess-1');
  });

  it('agent_end marks durable run as waiting', () => {
    const entry = makeEntry({
      traceRunStartedAtMs: Date.now(),
      traceRunTurnCount: 1,
      traceRunStepCount: 0,
    });
    const cbs = makeCallbacks();
    handleLiveSessionEvent(entry, { type: 'agent_end', messages: [] } as unknown, cbs);
    expect(cbs.syncDurableConversationRun).toHaveBeenCalledWith(entry, 'waiting');
    expect(cbs.clearContextUsageTimer).toHaveBeenCalled();
    expect(cbs.broadcastContextUsage).toHaveBeenCalled();
  });

  it('agent_end derives trace stats from assistant usage when live stats are empty', () => {
    const entry = makeEntry({
      session: {
        getSessionStats: () => ({
          tokens: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
          cost: 0,
        }),
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          {
            role: 'assistant',
            usage: {
              input: 12,
              output: 3,
              cacheRead: 4,
              cacheWrite: 5,
              totalTokens: 24,
              cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 },
            },
            content: [{ type: 'text', text: 'ok' }],
          },
        ],
      },
      traceRunId: 'run-usage',
      traceRunStartedAtMs: Date.now(),
      traceRunTurnCount: 1,
      traceRunStepCount: 2,
    });
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'agent_end', messages: [] } as unknown, cbs);

    expect(cbs.broadcastStats).toHaveBeenCalledWith(
      entry,
      { input: 12, output: 3, cacheRead: 4, cacheWrite: 5, total: 24 },
      0.03,
      expect.objectContaining({ runId: 'run-usage', turnCount: 1, stepCount: 2 }),
    );
  });

  it('agent_end derives trace stats from persisted transcript usage when runtime stats are empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-session-usage-'));
    const sessionFile = join(dir, 'session.jsonl');
    writeFileSync(
      sessionFile,
      `${JSON.stringify({ type: 'session', id: 's1' })}\n${JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          usage: {
            input: 20,
            output: 4,
            cacheRead: 2,
            cacheWrite: 1,
            cost: { total: 0.05 },
          },
        },
      })}\n`,
    );
    const entry = makeEntry({
      session: {
        sessionFile,
        getSessionStats: () => ({
          tokens: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
          cost: 0,
        }),
      },
      traceRunId: 'run-file-usage',
      traceRunStartedAtMs: Date.now(),
    });
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'agent_end', messages: [] } as unknown, cbs);

    expect(cbs.broadcastStats).toHaveBeenCalledWith(
      entry,
      { input: 20, output: 4, cacheRead: 2, cacheWrite: 1, total: 27 },
      0.05,
      expect.objectContaining({ runId: 'run-file-usage' }),
    );
  });

  it('message_end broadcasts assistant usage stats before agent_end cleanup', () => {
    const entry = makeEntry({
      session: {
        getSessionStats: () => ({
          tokens: { input: 9, output: 2, total: 11, cacheRead: 0, cacheWrite: 0 },
          cost: 0.02,
        }),
      },
      traceRunId: 'run-message-usage',
      traceRunStartedAtMs: Date.now(),
      traceRunTurnCount: 1,
      traceRunStepCount: 0,
    });
    const cbs = makeCallbacks();

    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          usage: {
            input: 9,
            output: 2,
            cacheRead: 0,
            cacheWrite: 0,
            cost: { total: 0.02 },
          },
          content: [{ type: 'text', text: 'ok' }],
        },
      } as unknown,
      cbs,
    );
    handleLiveSessionEvent(entry, { type: 'agent_end', messages: [] } as unknown, cbs);

    expect(cbs.broadcastStats).toHaveBeenCalledTimes(1);
    expect(cbs.broadcastStats).toHaveBeenCalledWith(
      entry,
      { input: 9, output: 2, cacheRead: 0, cacheWrite: 0, total: 11 },
      0.02,
      expect.objectContaining({ runId: 'run-message-usage' }),
    );
  });

  it('turn_end keeps the durable run active and notifies lifecycle handlers', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();
    handleLiveSessionEvent(entry, { type: 'turn_end', message: {}, toolResults: [] } as unknown, cbs);
    expect(cbs.syncDurableConversationRun).not.toHaveBeenCalledWith(entry, 'waiting');
    expect(cbs.notifyLifecycleHandlers).toHaveBeenCalledWith(entry, 'turn_end');
    expect(cbs.syncRunningState).toHaveBeenCalledWith('sess-1');
    expect(cbs.clearContextUsageTimer).toHaveBeenCalled();
  });

  it('broadcasts session info title changes', () => {
    const entry = makeEntry({ title: 'Old title' });
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'session_info_changed', name: 'New title' } as unknown, cbs);

    expect(entry.title).toBe('New title');
    expect(cbs.broadcastTitle).toHaveBeenCalledWith(entry);
  });

  it('calls syncRunningState on every event, not just agent_start/turn_end', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();
    const events = [
      { type: 'tool_execution_start', toolCallId: 'tc-1', toolName: 'bash', args: {} },
      { type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta: 'hi' } },
      { type: 'tool_execution_end', toolCallId: 'tc-1', toolName: 'bash', result: { exitCode: 0 }, isError: false },
    ] as unknown;
    for (const event of events) handleLiveSessionEvent(entry, event, cbs);
    expect(cbs.syncRunningState).toHaveBeenCalledTimes(events.length);
    expect(cbs.syncRunningState).toHaveBeenCalledWith('sess-1');
  });

  it('agent_start then agent_end broadcasts to subscribers via broadcast', () => {
    const entry = makeEntry({ traceRunStartedAtMs: Date.now(), traceRunTurnCount: 0, traceRunStepCount: 0 });
    const cbs = makeCallbacks();
    handleLiveSessionEvent(entry, { type: 'agent_start' } as unknown, cbs);
    handleLiveSessionEvent(entry, { type: 'agent_end', messages: [] } as unknown, cbs);
    const broadcastedTypes = cbs.broadcast.mock.calls.map((c: unknown[]) => c[1]?.type);
    expect(broadcastedTypes).toContain('agent_start');
    expect(broadcastedTypes).toContain('agent_end');
  });

  it('records current turn error from assistant message_end with error stop reason', () => {
    const entry = makeEntry({ currentTurnError: null });
    const cbs = makeCallbacks();
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          stopReason: 'error',
          errorMessage: 'server overloaded',
          content: [],
        },
      } as unknown,
      cbs,
    );
    expect(entry.currentTurnError).toBe('server overloaded');
  });

  it('does not set currentTurnError for non-error assistant messages', () => {
    const entry = makeEntry({ currentTurnError: null });
    const cbs = makeCallbacks();
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          stopReason: 'stop',
          content: [{ type: 'text', text: 'Done.' }],
        },
      } as unknown,
      cbs,
    );
    expect(entry.currentTurnError).toBeNull();
  });

  it('broadcasts final assistant text from message_end when no deltas were emitted', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'message_start', message: { role: 'assistant', content: [] } } as unknown, cbs);
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Tools work.' }] },
      } as unknown,
      cbs,
    );

    expect(cbs.broadcast).toHaveBeenCalledWith(entry, { type: 'text_delta', delta: 'Tools work.' });
  });

  it('does not duplicate assistant message_end text when deltas already streamed', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'message_start', message: { role: 'assistant', content: [] } } as unknown, cbs);
    handleLiveSessionEvent(
      entry,
      { type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta: 'Tools ' } } as unknown,
      cbs,
    );
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Tools work.' }] },
      } as unknown,
      cbs,
    );

    const textDeltas = cbs.broadcast.mock.calls.map((call: unknown[]) => call[1]).filter((event) => event?.type === 'text_delta');
    expect(textDeltas).toEqual([{ type: 'text_delta', delta: 'Tools ' }]);
  });

  it('broadcasts final assistant text after only empty deltas streamed', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'message_start', message: { role: 'assistant', content: [] } } as unknown, cbs);
    handleLiveSessionEvent(
      entry,
      { type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta: '' } } as unknown,
      cbs,
    );
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Final answer.' }] },
      } as unknown,
      cbs,
    );

    const textDeltas = cbs.broadcast.mock.calls.map((call: unknown[]) => call[1]).filter((event) => event?.type === 'text_delta');
    expect(textDeltas).toEqual([{ type: 'text_delta', delta: 'Final answer.' }]);
  });

  it('recovers final assistant text on agent_end when the provider skips live deltas and message_end content', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'message_start', message: { role: 'assistant', content: [] } } as unknown, cbs);
    handleLiveSessionEvent(
      entry,
      {
        type: 'agent_end',
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'private thought' },
              { type: 'text', text: 'Recovered final answer.' },
            ],
          },
        ],
      } as unknown,
      cbs,
    );

    const textDeltas = cbs.broadcast.mock.calls.map((call: unknown[]) => call[1]).filter((event) => event?.type === 'text_delta');
    const broadcastedTypes = cbs.broadcast.mock.calls.map((call: unknown[]) => call[1]?.type);
    expect(textDeltas).toEqual([{ type: 'text_delta', delta: 'Recovered final answer.' }]);
    expect(broadcastedTypes.indexOf('text_delta')).toBeLessThan(broadcastedTypes.indexOf('agent_end'));
  });

  it('does not duplicate agent_end recovered text after message_end already emitted the fallback', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();

    handleLiveSessionEvent(entry, { type: 'message_start', message: { role: 'assistant', content: [] } } as unknown, cbs);
    handleLiveSessionEvent(
      entry,
      {
        type: 'message_end',
        message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Final once.' }] },
      } as unknown,
      cbs,
    );
    handleLiveSessionEvent(
      entry,
      {
        type: 'agent_end',
        messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Final once.' }] }],
      } as unknown,
      cbs,
    );

    const textDeltas = cbs.broadcast.mock.calls.map((call: unknown[]) => call[1]).filter((event) => event?.type === 'text_delta');
    expect(textDeltas).toEqual([{ type: 'text_delta', delta: 'Final once.' }]);
  });

  it('schedules context usage update on agent_start, message_update, and tool events', () => {
    const entry = makeEntry();
    const cbs = makeCallbacks();
    const events: unknown[] = [
      { type: 'agent_start' },
      { type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta: 'hi' } },
      { type: 'tool_execution_start', toolCallId: 'tc-1', toolName: 'bash', args: {} },
    ];
    for (const event of events) handleLiveSessionEvent(entry, event, cbs);
    expect(cbs.scheduleContextUsage).toHaveBeenCalledTimes(events.length);
  });
});

describe('trace persistence hooks', () => {
  const mockSession = {
    sessionId: 'test-session',
    title: 'Test conversation',
  } as unknown;

  const mockCallbacks = {
    maybeAutoTitleConversation: vi.fn(),
    requestConversationAutoModeContinuationTurn: vi.fn(),
    requestConversationAutoModeTurn: vi.fn(),
    syncDurableConversationRun: vi.fn(),
    notifyLifecycleHandlers: vi.fn(),
    applyPendingConversationWorkingDirectoryChange: vi.fn(),
    scheduleContextUsage: vi.fn(),
    publishSessionMetaChanged: vi.fn(),
    syncRunningState: vi.fn(),
    broadcastQueueState: vi.fn(),
    broadcastTitle: vi.fn(),
    broadcastStats: vi.fn(),
    clearContextUsageTimer: vi.fn(),
    broadcastContextUsage: vi.fn(),
    broadcastSnapshot: vi.fn(),
    broadcast: vi.fn(),
    tryImportReadyParallelJobs: vi.fn(),
    appendCompactionSummary: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists tool call on tool_execution_end (success)', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test conversation',
      traceRunId: 'run-1',
    } as unknown;

    // First fire tool_execution_start to set up the timer
    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-1',
        toolName: 'bash',
        args: { command: 'git status --short' },
      } as unknown,
      mockCallbacks,
    );

    // Then fire tool_execution_end
    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_end',
        toolCallId: 'tc-1',
        toolName: 'bash',
        result: { exitCode: 0 },
        isError: false,
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceToolCallMock).toHaveBeenCalledTimes(1);
    const call = persistTraceToolCallMock.mock.calls[0][0];
    expect(call.sessionId).toBe('test-session');
    expect(call.runId).toBe('run-1');
    expect(call.toolName).toBe('bash');
    expect(call.toolInput).toEqual({ command: 'git status --short' });
    expect(call.status).toBe('ok');
    expect(call.durationMs).toBeGreaterThanOrEqual(0);
    expect(call.conversationTitle).toBe('Test conversation');
  });

  it('persists tool call with error status on failed execution', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test conversation',
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-2',
        toolName: 'read',
        args: { path: '/nonexistent' },
      } as unknown,
      mockCallbacks,
    );

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_end',
        toolCallId: 'tc-2',
        toolName: 'read',
        result: 'File not found',
        isError: true,
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceToolCallMock).toHaveBeenCalledTimes(1);
    const call = persistTraceToolCallMock.mock.calls[0][0];
    expect(call.toolName).toBe('read');
    expect(call.status).toBe('error');
    expect(call.errorMessage).toBe('File not found');
  });

  it('persists object-shaped tool errors as readable JSON instead of object Object', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test conversation',
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-json-error',
        toolName: 'bash',
        args: { command: 'npm test' },
      } as unknown,
      mockCallbacks,
    );

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_end',
        toolCallId: 'tc-json-error',
        toolName: 'bash',
        result: { exitCode: 1, stderr: 'failed' },
        isError: true,
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceToolCallMock).toHaveBeenCalledTimes(1);
    expect(persistTraceToolCallMock.mock.calls[0][0].errorMessage).toBe('{"exitCode":1,"stderr":"failed"}');
  });

  it('persists compaction on compaction_end', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test conversation',
      isCompacting: true,
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'compaction_end',
        reason: 'overflow',
        aborted: false,
        willRetry: false,
        result: { tokensBefore: 120000, summary: 'test' },
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceCompactionMock).toHaveBeenCalledTimes(1);
    const call = persistTraceCompactionMock.mock.calls[0][0];
    expect(call.sessionId).toBe('test-session');
    expect(call.reason).toBe('overflow');
    expect(call.tokensBefore).toBe(120000);
  });

  it('writes overflow compaction summary with callback details', () => {
    const entry = {
      sessionId: 'test-session',
      session: {
        ...mockSession,
        state: { messages: [] },
      },
      title: 'Test conversation',
      isCompacting: true,
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'compaction_end',
        reason: 'overflow',
        aborted: false,
        willRetry: false,
        result: {
          tokensBefore: 120000,
          firstKeptEntryId: 'entry-1',
          summary: 'overflow summary',
          details: { nativeCompaction: true },
        },
      } as unknown,
      mockCallbacks,
    );

    expect(mockCallbacks.appendCompactionSummary).toHaveBeenCalledTimes(1);
    expect(mockCallbacks.appendCompactionSummary).toHaveBeenCalledWith({
      entry,
      summary: 'overflow summary',
      tokensBefore: 120000,
      firstKeptEntryId: 'entry-1',
      details: { nativeCompaction: true },
    });
  });

  it('does not write a duplicate overflow compaction summary when one already exists in state', () => {
    const entry = {
      sessionId: 'test-session',
      session: {
        ...mockSession,
        state: {
          messages: [{ role: 'compactionSummary', summary: 'existing summary' }],
        },
      },
      title: 'Test conversation',
      isCompacting: true,
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'compaction_end',
        reason: 'overflow',
        aborted: false,
        willRetry: false,
        result: {
          tokensBefore: 120000,
          firstKeptEntryId: 'entry-1',
          summary: 'existing summary',
        },
      } as unknown,
      mockCallbacks,
    );

    expect(mockCallbacks.appendCompactionSummary).not.toHaveBeenCalled();
  });

  it('does not persist aborted compactions', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test',
      isCompacting: true,
    } as unknown;

    handleLiveSessionEvent(
      entry,
      {
        type: 'compaction_end',
        reason: 'overflow',
        aborted: true,
        willRetry: false,
        result: undefined,
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceCompactionMock).not.toHaveBeenCalled();
  });

  it('tracks multiple concurrent tool executions independently', () => {
    const entry = {
      sessionId: 'test-session',
      session: mockSession,
      title: 'Test',
    } as unknown;

    // Start two tools
    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-a',
        toolName: 'bash',
        args: {},
      } as unknown,
      mockCallbacks,
    );

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-b',
        toolName: 'edit',
        args: {},
      } as unknown,
      mockCallbacks,
    );

    // End in reverse order
    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_end',
        toolCallId: 'tc-b',
        toolName: 'edit',
        result: {},
        isError: false,
      } as unknown,
      mockCallbacks,
    );

    handleLiveSessionEvent(
      entry,
      {
        type: 'tool_execution_end',
        toolCallId: 'tc-a',
        toolName: 'bash',
        result: {},
        isError: false,
      } as unknown,
      mockCallbacks,
    );

    expect(persistTraceToolCallMock).toHaveBeenCalledTimes(2);
    expect(persistTraceToolCallMock.mock.calls[0][0].toolName).toBe('edit');
    expect(persistTraceToolCallMock.mock.calls[1][0].toolName).toBe('bash');
  });
});

describe('legacy auto mode continuation quarantine', () => {
  const REVIEW_TYPE = 'conversation_automation_post_turn_review';

  function makeEntry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 'sess-auto',
      session: {} as unknown,
      title: 'Auto mode',
      pendingAutoModeContinuation: false,
      queuedStaleTurnCustomTypes: [] as string[],
      activeStaleTurnCustomType: null,
      ...overrides,
    } as unknown;
  }

  function makeCallbacks() {
    return {
      requestConversationAutoModeContinuationTurn: vi.fn().mockResolvedValue(true),
      requestConversationAutoModeTurn: vi.fn().mockResolvedValue(true),
      syncDurableConversationRun: vi.fn(),
      notifyLifecycleHandlers: vi.fn(),
      applyPendingConversationWorkingDirectoryChange: vi.fn(),
      scheduleContextUsage: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
      syncRunningState: vi.fn(),
      broadcastQueueState: vi.fn(),
      broadcastTitle: vi.fn(),
      broadcastStats: vi.fn(),
      clearContextUsageTimer: vi.fn(),
      broadcastContextUsage: vi.fn(),
      broadcastSnapshot: vi.fn(),
      broadcast: vi.fn(),
      tryImportReadyParallelJobs: vi.fn(),
    };
  }

  describe('nudge mode review turn', () => {
    it('clears legacy continuation intent without scheduling another stale turn', async () => {
      const entry = makeEntry({
        pendingAutoModeContinuation: true,
        activeStaleTurnCustomType: REVIEW_TYPE,
      });
      const cbs = makeCallbacks();

      handleLiveSessionEvent(entry, { type: 'turn_end' } as unknown, cbs);

      // The handler uses queueMicrotask; flush microtasks
      await new Promise((resolve) => queueMicrotask(resolve));

      expect(cbs.requestConversationAutoModeContinuationTurn).not.toHaveBeenCalled();
      expect(cbs.requestConversationAutoModeTurn).not.toHaveBeenCalled();
    });

    it('clears pendingAutoModeContinuation flag after consuming it', () => {
      const entry = makeEntry({
        pendingAutoModeContinuation: true,
        activeStaleTurnCustomType: REVIEW_TYPE,
      });
      const cbs = makeCallbacks();

      handleLiveSessionEvent(entry, { type: 'turn_end' } as unknown, cbs);

      // Flag is cleared synchronously, not in microtask
      expect(entry.pendingAutoModeContinuation).toBe(false);
    });
  });

  describe('custom message display flags', () => {
    it('allows pi custom message display flags required by the session API', () => {
      const entry = makeEntry({ activeStaleTurnCustomType: null });
      const cbs = makeCallbacks();

      expect(() =>
        handleLiveSessionEvent(
          entry,
          {
            type: 'message_start',
            message: { role: 'custom', customType: 'goal-continuation', display: false, content: 'Goal continuation.' },
          } as unknown,
          cbs,
        ),
      ).not.toThrow();

      expect(entry.activeStaleTurnCustomType).toBeNull();
    });
  });

  describe('stale auto mode continuation cleanup', () => {
    it('clears stale continuation state without scheduling implicit follow-up work', async () => {
      const entry = makeEntry({
        pendingAutoModeContinuation: true,
        activeStaleTurnCustomType: null,
      });
      const cbs = makeCallbacks();

      handleLiveSessionEvent(entry, { type: 'turn_end' } as unknown, cbs);

      await new Promise((resolve) => queueMicrotask(resolve));

      expect(entry.pendingAutoModeContinuation).toBe(false);
      expect(cbs.requestConversationAutoModeContinuationTurn).not.toHaveBeenCalled();
    });
  });
});
