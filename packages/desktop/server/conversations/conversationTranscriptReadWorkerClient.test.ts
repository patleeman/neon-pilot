import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
}));

const workerThreads = vi.hoisted(() => ({
  instances: [] as Array<{
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    handlers: Record<string, (arg: unknown) => void>;
  }>,
  Worker: vi.fn(function MockWorker(this: unknown) {
    const instance = {
      postMessage: vi.fn(),
      terminate: vi.fn(async () => 1),
      handlers: {} as Record<string, (arg: unknown) => void>,
    };
    workerThreads.instances.push(instance);
    return {
      postMessage: instance.postMessage,
      terminate: instance.terminate,
      on: vi.fn((event: string, handler: (arg: unknown) => void) => {
        instance.handlers[event] = handler;
      }),
      off: vi.fn((event: string) => {
        delete instance.handlers[event];
      }),
    };
  }),
}));

vi.mock('node:fs', () => ({ existsSync: fs.existsSync }));
vi.mock('node:worker_threads', () => ({ Worker: workerThreads.Worker }));

async function loadClient() {
  vi.resetModules();
  return import('./conversationTranscriptReadWorkerClient.js');
}

describe('conversationTranscriptReadWorkerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    workerThreads.instances.length = 0;
  });

  it('limits transcript reads to one active worker request', async () => {
    const client = await loadClient();
    const first = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-1', tailBlocks: 40 });
    const second = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-2', tailBlocks: 40 });

    expect(workerThreads.instances[0]?.postMessage).toHaveBeenCalledTimes(1);
    expect(workerThreads.instances[0]?.postMessage).toHaveBeenCalledWith({ id: 1, conversationId: 'conv-1', tailBlocks: 40 });

    const firstDetail = { detail: { meta: { id: 'conv-1' }, blocks: [], blockOffset: 0, totalBlocks: 0 }, telemetry: null };
    workerThreads.instances[0]?.handlers.message?.({ id: 1, ok: true, result: firstDetail });
    await expect(first).resolves.toBe(firstDetail);

    expect(workerThreads.instances[0]?.postMessage).toHaveBeenCalledTimes(2);
    expect(workerThreads.instances[0]?.postMessage).toHaveBeenLastCalledWith({ id: 2, conversationId: 'conv-2', tailBlocks: 40 });

    const secondDetail = { detail: { meta: { id: 'conv-2' }, blocks: [], blockOffset: 0, totalBlocks: 0 }, telemetry: null };
    workerThreads.instances[0]?.handlers.message?.({ id: 2, ok: true, result: secondDetail });
    await expect(second).resolves.toBe(secondDetail);
  });

  it('coalesces identical inflight transcript reads', async () => {
    const client = await loadClient();
    const first = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-1', tailBlocks: 40 });
    const second = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-1', tailBlocks: 40 });

    expect(workerThreads.instances[0]?.postMessage).toHaveBeenCalledTimes(1);

    const detail = { detail: { meta: { id: 'conv-1' }, blocks: [], blockOffset: 0, totalBlocks: 0 }, telemetry: null };
    workerThreads.instances[0]?.handlers.message?.({ id: 1, ok: true, result: detail });

    await expect(Promise.all([first, second])).resolves.toEqual([detail, detail]);
  });

  it('terminates an active transcript worker when its request is aborted and starts the next queued read', async () => {
    const client = await loadClient();
    const controller = new AbortController();
    const first = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-1', tailBlocks: 40, signal: controller.signal });
    const second = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-2', tailBlocks: 40 });

    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(workerThreads.instances[0]?.terminate).toHaveBeenCalledTimes(1));

    expect(workerThreads.instances[1]?.postMessage).toHaveBeenCalledWith({ id: 2, conversationId: 'conv-2', tailBlocks: 40 });
    const secondDetail = { detail: { meta: { id: 'conv-2' }, blocks: [], blockOffset: 0, totalBlocks: 0 }, telemetry: null };
    workerThreads.instances[1]?.handlers.message?.({ id: 2, ok: true, result: secondDetail });
    await expect(second).resolves.toBe(secondDetail);
  });

  it('drops queued stale transcript reads before they start', async () => {
    const client = await loadClient();
    const queuedController = new AbortController();
    const first = client.readConversationTranscriptDetailInWorker({ conversationId: 'conv-1', tailBlocks: 40 });
    const queued = client.readConversationTranscriptDetailInWorker({
      conversationId: 'conv-2',
      tailBlocks: 40,
      signal: queuedController.signal,
    });

    queuedController.abort();
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });

    const firstDetail = { detail: { meta: { id: 'conv-1' }, blocks: [], blockOffset: 0, totalBlocks: 0 }, telemetry: null };
    workerThreads.instances[0]?.handlers.message?.({ id: 1, ok: true, result: firstDetail });
    await expect(first).resolves.toBe(firstDetail);
    expect(workerThreads.instances[0]?.postMessage).toHaveBeenCalledTimes(1);
  });
});
