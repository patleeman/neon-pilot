import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  existingPaths: new Set<string>(),
  existsSync: vi.fn((path: string) => fs.existingPaths.has(path)),
}));
const workerThreads = vi.hoisted(() => ({
  instances: [] as Array<{
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    handlers: Record<string, (arg: unknown) => void>;
  }>,
  Worker: vi.fn(function MockWorker(this: unknown) {
    const instance = { postMessage: vi.fn(), terminate: vi.fn(), handlers: {} as Record<string, (arg: unknown) => void> };
    workerThreads.instances.push(instance);
    return {
      postMessage: instance.postMessage,
      terminate: instance.terminate,
      on: vi.fn((event: string, handler: (arg: unknown) => void) => {
        instance.handlers[event] = handler;
      }),
    };
  }),
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

vi.mock('node:fs', () => ({ existsSync: fs.existsSync }));
vi.mock('node:worker_threads', () => ({ Worker: workerThreads.Worker }));
vi.mock('@neon-pilot/core', () => core);

async function loadClient() {
  vi.resetModules();
  return import('./traceWorkerClient.js');
}

describe('traceWorkerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.existingPaths.clear();
    fs.existsSync.mockImplementation((path: string) => fs.existingPaths.has(path));
    workerThreads.instances.length = 0;
  });

  it('creates a singleton worker and posts trace messages without blocking', async () => {
    const client = await loadClient();

    client.traceWorkerStats({ sessionId: 's1' } as never);
    client.traceWorkerToolCall({ sessionId: 's1', toolName: 'bash' } as never);

    expect(workerThreads.Worker).toHaveBeenCalledTimes(1);
    expect(workerThreads.Worker.mock.calls[0][0]).toBeInstanceOf(URL);
    expect(workerThreads.Worker.mock.calls[0][1]).toMatchObject({ execArgv: expect.any(Array) });
    expect(workerThreads.instances[0].postMessage).toHaveBeenNthCalledWith(1, { type: 'stats', sessionId: 's1' });
    expect(workerThreads.instances[0].postMessage).toHaveBeenNthCalledWith(2, { type: 'tool_call', sessionId: 's1', toolName: 'bash' });
  });

  it('forwards layout through the worker message', async () => {
    const client = await loadClient();
    const layout = { root: '/test', logsTelemetry: '/test/logs/telemetry', systemObservability: '/test/system/observability' } as never;

    client.traceWorkerStats({ sessionId: 's1', layout } as never);

    expect(workerThreads.instances[0].postMessage).toHaveBeenCalledWith({ type: 'stats', sessionId: 's1', layout });
  });

  it('uses the bundled backend worker path when the sibling worker is absent', async () => {
    fs.existsSync.mockImplementation((path: string) => path.endsWith('/server/traces/traceWorker.js'));
    const client = await loadClient();

    client.traceWorkerStats({ sessionId: 's1' } as never);

    expect(String(workerThreads.Worker.mock.calls[0][0])).toMatch(/\/server\/traces\/traceWorker\.js$/);
  });

  it('terminates and recreates the worker on close', async () => {
    const client = await loadClient();
    client.traceWorkerContext({ sessionId: 's1' } as never);
    client.closeTraceWorker();
    client.traceWorkerCompaction({ sessionId: 's1' } as never);

    expect(workerThreads.instances[0].terminate).toHaveBeenCalledOnce();
    expect(workerThreads.Worker).toHaveBeenCalledTimes(2);
    expect(workerThreads.instances[1].postMessage).toHaveBeenCalledWith({ type: 'compaction', sessionId: 's1' });
  });

  it('falls back to direct writes after worker errors', async () => {
    vi.useFakeTimers();
    const client = await loadClient();
    client.traceWorkerStats({ sessionId: 's1' } as never);

    workerThreads.instances[0].handlers.error?.(new Error('worker failed'));
    client.traceWorkerAutoMode({ sessionId: 's2', enabled: true } as never);
    client.traceWorkerSuggestedContext({ sessionId: 's3', pointerIds: [] } as never);
    await vi.runAllTimersAsync();

    expect(core.writeTraceAutoMode).toHaveBeenCalledWith(expect.objectContaining({ type: 'auto_mode', sessionId: 's2', enabled: true }));
    expect(core.writeTraceSuggestedContext).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'suggested_context', sessionId: 's3', pointerIds: [] }),
    );
    vi.useRealTimers();
  });

  it('forwards layout through direct fallback writes', async () => {
    vi.useFakeTimers();
    const client = await loadClient();
    const layout = { root: '/test', logsTelemetry: '/test/logs/telemetry', systemObservability: '/test/system/observability' } as never;

    // Force worker fallback by making constructor throw
    workerThreads.Worker.mockImplementationOnce(() => {
      throw new Error('constructor failed');
    });

    client.traceWorkerStats({ sessionId: 's1', layout } as never);
    await vi.runAllTimersAsync();

    expect(core.writeTraceStats).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1', layout }));
    vi.useRealTimers();
  });

  it('falls back to direct writes when postMessage throws and catches direct write failures', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = await loadClient();
    workerThreads.Worker.mockImplementationOnce(() => {
      throw new Error('constructor failed');
    });
    core.writeTraceContextPointerInspect.mockImplementationOnce(() => {
      throw new Error('write failed');
    });

    client.traceWorkerContextPointerInspect({ sessionId: 's1' } as never);
    await vi.runAllTimersAsync();

    expect(core.writeTraceContextPointerInspect).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }));
    expect(errorSpy).toHaveBeenCalledWith('[telemetry] direct trace write failed', expect.any(Error));
    vi.useRealTimers();
  });
});
