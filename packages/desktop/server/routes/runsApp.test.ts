import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cancelDurableRunMock,
  getDurableRunLogCursorMock,
  getDurableRunLogMock,
  getDurableRunMock,
  invalidateAppTopicsMock,
  listDurableRunsMock,
  logErrorMock,
  readDurableRunLogDeltaMock,
} = vi.hoisted(() => ({
  cancelDurableRunMock: vi.fn(),
  getDurableRunLogCursorMock: vi.fn(),
  getDurableRunLogMock: vi.fn(),
  getDurableRunMock: vi.fn(),
  invalidateAppTopicsMock: vi.fn(),
  listDurableRunsMock: vi.fn(),
  logErrorMock: vi.fn(),
  readDurableRunLogDeltaMock: vi.fn(),
}));

vi.mock('../automation/durableRuns.js', () => ({
  cancelDurableRun: cancelDurableRunMock,
  getDurableRun: getDurableRunMock,
  getDurableRunLog: getDurableRunLogMock,
  getDurableRunLogCursor: getDurableRunLogCursorMock,
  listDurableRuns: listDurableRunsMock,
  readDurableRunLogDelta: readDurableRunLogDeltaMock,
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
}));

import { registerRunAppRoutes } from './runsApp.js';

describe('registerRunAppRoutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    cancelDurableRunMock.mockReset();
    getDurableRunLogCursorMock.mockReset();
    getDurableRunLogCursorMock.mockReturnValue(0);
    getDurableRunLogMock.mockReset();
    getDurableRunMock.mockReset();
    invalidateAppTopicsMock.mockReset();
    listDurableRunsMock.mockReset();
    logErrorMock.mockReset();
    readDurableRunLogDeltaMock.mockReset();
    readDurableRunLogDeltaMock.mockReturnValue(undefined);
  });

  function createHarness(options?: { getDurableRunSnapshot?: (runId: string, tail: number) => Promise<unknown | null> }) {
    const handlers: Record<string, (req: unknown, res: unknown) => Promise<void> | void> = {};
    const router = {
      get: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`GET ${path}`] = next;
      }),
      post: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`POST ${path}`] = next;
      }),
      patch: vi.fn(),
    };

    registerRunAppRoutes(router as never, {
      getDurableRunSnapshot: options?.getDurableRunSnapshot ?? (async () => null),
    });

    return {
      eventsHandler: handlers['GET /api/runs/:id/events']!,
      paComponentsHandler: handlers['GET /api/pa/components.css']!,
    };
  }

  function createAssetResponse() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
  }

  function createStreamResponse() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
  }

  it('serves PA component CSS for extension frames', () => {
    const { paComponentsHandler } = createHarness();
    const res = createAssetResponse();

    paComponentsHandler({}, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('--color-base'));
  });

  it('streams run snapshots, log deltas, heartbeats, and stops after close', async () => {
    vi.useFakeTimers();
    readDurableRunLogDeltaMock.mockReturnValueOnce({
      path: '/tmp/run.log',
      delta: '\nstream chunk',
      nextCursor: 12,
      reset: false,
    });
    const getDurableRunSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        detail: { run: { runId: 'run-1', status: 'running' } },
        log: { path: '/tmp/run.log', log: 'initial' },
      })
      .mockResolvedValue({
        detail: { run: { runId: 'run-1', status: 'running' } },
        log: { path: '/tmp/run.log', log: 'next' },
      });
    const { eventsHandler } = createHarness({ getDurableRunSnapshot });
    const req = Object.assign(new EventEmitter(), {
      params: { id: 'run-1' },
      query: { tail: '5000' },
    });
    const res = createStreamResponse();

    await eventsHandler(req, res);

    expect(getDurableRunSnapshot).toHaveBeenCalledWith('run-1', 1000);
    expect(getDurableRunLogCursorMock).toHaveBeenCalledWith('/tmp/run.log');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.flushHeaders).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'snapshot',
        detail: { run: { runId: 'run-1', status: 'running' } },
        log: { path: '/tmp/run.log', log: 'initial' },
      })}\n\n`,
    );

    await vi.advanceTimersByTimeAsync(250);
    expect(readDurableRunLogDeltaMock).toHaveBeenCalledWith('/tmp/run.log', 0);
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'log_delta',
        path: '/tmp/run.log',
        delta: '\nstream chunk',
      })}\n\n`,
    );

    await vi.advanceTimersByTimeAsync(750);
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'detail',
        detail: { run: { runId: 'run-1', status: 'running' } },
      })}\n\n`,
    );

    await vi.advanceTimersByTimeAsync(14_000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');

    const writesBeforeClose = res.write.mock.calls.length;
    req.emit('close');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(res.write.mock.calls).toHaveLength(writesBeforeClose);
  });

  it('stops run detail and log polling after a terminal snapshot grace period', async () => {
    vi.useFakeTimers();
    readDurableRunLogDeltaMock.mockReturnValue(undefined);
    const getDurableRunSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        detail: { run: { runId: 'run-1', status: 'running' } },
        log: { path: '/tmp/run.log', log: 'initial' },
      })
      .mockResolvedValue({
        detail: { run: { runId: 'run-1', status: 'cancelled' } },
        log: { path: '/tmp/run.log', log: 'cancelled' },
      });
    const { eventsHandler } = createHarness({ getDurableRunSnapshot });
    const req = Object.assign(new EventEmitter(), {
      params: { id: 'run-1' },
      query: {},
    });
    const res = createStreamResponse();

    await eventsHandler(req, res);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: 'detail',
        detail: { run: { runId: 'run-1', status: 'cancelled' } },
      })}\n\n`,
    );
    expect(getDurableRunSnapshot).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(getDurableRunSnapshot).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(getDurableRunSnapshot).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalled();

    req.emit('close');
  });

  it('returns 404 when the run snapshot is missing and logs snapshot startup failures', async () => {
    const missingSnapshot = vi.fn().mockResolvedValue(null);
    const { eventsHandler } = createHarness({ getDurableRunSnapshot: missingSnapshot });
    const missingRes = createStreamResponse();

    await eventsHandler({ params: { id: 'missing' }, query: { tail: '12' }, on: vi.fn() }, missingRes);

    expect(missingSnapshot).toHaveBeenCalledWith('missing', 12);
    expect(missingRes.status).toHaveBeenCalledWith(404);
    expect(missingRes.json).toHaveBeenCalledWith({ error: 'Run not found' });

    const failingSnapshot = vi.fn().mockRejectedValue(new Error('snapshot failed'));
    const failing = createHarness({ getDurableRunSnapshot: failingSnapshot });
    const failingRes = createStreamResponse();

    await failing.eventsHandler({ params: { id: 'run-1' }, query: {}, on: vi.fn() }, failingRes);

    expect(logErrorMock).toHaveBeenCalledWith(
      'request handler error',
      expect.objectContaining({
        message: 'snapshot failed',
      }),
    );
    expect(failingRes.status).toHaveBeenCalledWith(500);
    expect(failingRes.json).toHaveBeenCalledWith({ error: 'Error: snapshot failed' });
  });

  it('emits deleted events when a streamed run disappears during polling', async () => {
    vi.useFakeTimers();
    const getDurableRunSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        detail: { run: { runId: 'run-1', status: 'running' } },
        log: { path: '/tmp/run.log', log: 'initial' },
      })
      .mockResolvedValueOnce(null);
    const { eventsHandler } = createHarness({ getDurableRunSnapshot });
    const req = Object.assign(new EventEmitter(), {
      params: { id: 'run-1' },
      query: {},
    });
    const res = createStreamResponse();

    await eventsHandler(req, res);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(getDurableRunSnapshot).toHaveBeenLastCalledWith('run-1', 120);
    expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'deleted', runId: 'run-1' })}\n\n`);
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
