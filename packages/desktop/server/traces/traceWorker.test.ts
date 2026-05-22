import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreads = vi.hoisted(() => ({
  messageHandler: undefined as undefined | ((msg: unknown) => void),
  parentPort: {
    on: vi.fn((event: string, handler: (msg: unknown) => void) => {
      if (event === 'message') workerThreads.messageHandler = handler;
    }),
  },
}));
const core = vi.hoisted(() => ({
  writeTraceAutoMode: vi.fn(),
  writeTraceCompaction: vi.fn(),
  writeTraceContext: vi.fn(),
  writeTraceContextPointerInspect: vi.fn(),
  writeTraceStats: vi.fn(),
  writeTraceSuggestedContext: vi.fn(),
  writeTraceToolCall: vi.fn(),
}));

vi.mock('node:worker_threads', () => ({ parentPort: workerThreads.parentPort }));
vi.mock('@neon-pilot/core', () => core);

async function loadWorker() {
  vi.resetModules();
  workerThreads.messageHandler = undefined;
  await import('./traceWorker.js');
}

describe('traceWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a parentPort message handler and routes every trace message type', async () => {
    await loadWorker();
    expect(workerThreads.parentPort.on).toHaveBeenCalledWith('message', expect.any(Function));

    workerThreads.messageHandler?.({ type: 'stats', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'tool_call', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'context', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'compaction', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'auto_mode', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'suggested_context', sessionId: 's1' });
    workerThreads.messageHandler?.({ type: 'context_pointer_inspect', sessionId: 's1' });

    expect(core.writeTraceStats).toHaveBeenCalledWith({ type: 'stats', sessionId: 's1' });
    expect(core.writeTraceToolCall).toHaveBeenCalledWith({ type: 'tool_call', sessionId: 's1' });
    expect(core.writeTraceContext).toHaveBeenCalledWith({ type: 'context', sessionId: 's1' });
    expect(core.writeTraceCompaction).toHaveBeenCalledWith({ type: 'compaction', sessionId: 's1' });
    expect(core.writeTraceAutoMode).toHaveBeenCalledWith({ type: 'auto_mode', sessionId: 's1' });
    expect(core.writeTraceSuggestedContext).toHaveBeenCalledWith({ type: 'suggested_context', sessionId: 's1' });
    expect(core.writeTraceContextPointerInspect).toHaveBeenCalledWith({ type: 'context_pointer_inspect', sessionId: 's1' });
  });

  it('swallows trace write failures because worker messages are fire-and-forget', async () => {
    await loadWorker();
    core.writeTraceStats.mockImplementationOnce(() => {
      throw new Error('write failed');
    });

    expect(() => workerThreads.messageHandler?.({ type: 'stats', sessionId: 's1' })).not.toThrow();
  });
});
