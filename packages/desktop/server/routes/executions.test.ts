import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cancelExecutionMock,
  followUpExecutionMock,
  getExecutionLogMock,
  getExecutionMock,
  isExecutionActiveMock,
  invalidateAppTopicsMock,
  listConversationExecutionsMock,
  listExecutionsMock,
  logErrorMock,
  rerunExecutionMock,
  writeExecutionActivityEntryMock,
} = vi.hoisted(() => ({
  cancelExecutionMock: vi.fn(),
  followUpExecutionMock: vi.fn(),
  getExecutionLogMock: vi.fn(),
  getExecutionMock: vi.fn(),
  isExecutionActiveMock: vi.fn(
    (execution: { status?: string }) =>
      execution.status === 'queued' ||
      execution.status === 'waiting' ||
      execution.status === 'running' ||
      execution.status === 'recovering',
  ),
  invalidateAppTopicsMock: vi.fn(),
  listConversationExecutionsMock: vi.fn(),
  listExecutionsMock: vi.fn(),
  logErrorMock: vi.fn(),
  rerunExecutionMock: vi.fn(),
  writeExecutionActivityEntryMock: vi.fn(),
}));

const { getDocumentsStoreMock } = vi.hoisted(() => ({
  getDocumentsStoreMock: vi.fn(),
}));

vi.mock('../executions/executionService.js', () => ({
  cancelExecution: cancelExecutionMock,
  followUpExecution: followUpExecutionMock,
  getExecution: getExecutionMock,
  getExecutionLog: getExecutionLogMock,
  listConversationExecutions: listConversationExecutionsMock,
  listExecutions: listExecutionsMock,
  isExecutionActive: isExecutionActiveMock,
  rerunExecution: rerunExecutionMock,
  writeExecutionActivityEntry: writeExecutionActivityEntryMock,
}));

vi.mock('../documents/store.js', () => ({
  getDocumentsStore: getDocumentsStoreMock,
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
}));

import { registerExecutionRoutes } from './executions.js';

describe('registerExecutionRoutes', () => {
  beforeEach(() => {
    cancelExecutionMock.mockReset();
    followUpExecutionMock.mockReset();
    getExecutionLogMock.mockReset();
    getExecutionMock.mockReset();
    isExecutionActiveMock.mockClear();
    invalidateAppTopicsMock.mockReset();
    listConversationExecutionsMock.mockReset();
    listExecutionsMock.mockReset();
    logErrorMock.mockReset();
    rerunExecutionMock.mockReset();
    writeExecutionActivityEntryMock.mockReset();
    getDocumentsStoreMock.mockReset();
  });

  function createHarness(context?: unknown) {
    const handlers: Record<string, (req: unknown, res: unknown) => Promise<void> | void> = {};
    const router = {
      get: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`GET ${path}`] = next;
      }),
      post: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`POST ${path}`] = next;
      }),
    };

    registerExecutionRoutes(router as never, context as never);

    return {
      listHandler: handlers['GET /api/executions']!,
      conversationHandler: handlers['GET /api/conversations/:id/executions']!,
      detailHandler: handlers['GET /api/executions/:id']!,
      logHandler: handlers['GET /api/executions/:id/log']!,
      cancelHandler: handlers['POST /api/executions/:id/cancel']!,
      followUpHandler: handlers['POST /api/executions/:id/follow-up']!,
      rerunHandler: handlers['POST /api/executions/:id/rerun']!,
    };
  }

  function createJsonResponse() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  }

  it('lists all executions and conversation-scoped executions', async () => {
    const { listHandler, conversationHandler } = createHarness();
    const all = { executions: [{ id: 'run-1', kind: 'background-command' }] };
    const scoped = { conversationId: 'conv-1', primary: [{ id: 'run-1' }], system: [], hidden: [], executions: [{ id: 'run-1' }] };
    listExecutionsMock.mockResolvedValue(all);
    listConversationExecutionsMock.mockResolvedValue(scoped);

    const listRes = createJsonResponse();
    await listHandler({}, listRes);
    expect(listRes.json).toHaveBeenCalledWith(all);

    const scopedRes = createJsonResponse();
    await conversationHandler({ params: { id: 'conv-1' }, query: { active: 'true', visibility: 'primary' } }, scopedRes);
    expect(listConversationExecutionsMock).toHaveBeenCalledWith('conv-1', { active: true, visibility: 'primary' });
    expect(scopedRes.json).toHaveBeenCalledWith(scoped);
  });

  it('ignores malformed conversation execution query filters', async () => {
    const { conversationHandler } = createHarness();
    const scoped = { conversationId: 'conv-1', primary: [], system: [], hidden: [], executions: [] };
    listConversationExecutionsMock.mockResolvedValue(scoped);

    const res = createJsonResponse();
    await conversationHandler({ params: { id: 'conv-1' }, query: { active: 'wat', visibility: 'everything' } }, res);

    expect(listConversationExecutionsMock).toHaveBeenCalledWith('conv-1', { active: undefined, visibility: undefined });
    expect(res.json).toHaveBeenCalledWith(scoped);
  });

  it('returns details, logs, and 404s missing executions', async () => {
    const { detailHandler, logHandler } = createHarness();
    getExecutionMock.mockResolvedValue({ execution: { id: 'run-1' } });
    getExecutionLogMock.mockResolvedValue({ path: '/runs/run-1/output.log', log: 'ok' });

    const detailRes = createJsonResponse();
    await detailHandler({ params: { id: 'run-1' } }, detailRes);
    expect(detailRes.json).toHaveBeenCalledWith({ execution: { id: 'run-1' } });

    const logRes = createJsonResponse();
    await logHandler({ params: { id: 'run-1' }, query: { tail: '20' } }, logRes);
    expect(getExecutionLogMock).toHaveBeenCalledWith('run-1', 20);
    expect(logRes.json).toHaveBeenCalledWith({ path: '/runs/run-1/output.log', log: 'ok' });

    getExecutionMock.mockResolvedValue(undefined);
    const missingRes = createJsonResponse();
    await detailHandler({ params: { id: 'missing' } }, missingRes);
    expect(missingRes.status).toHaveBeenCalledWith(404);
    expect(missingRes.json).toHaveBeenCalledWith({ error: 'Execution not found' });
  });

  it('cancels, reruns, and follows up executions through the execution surface', async () => {
    const { cancelHandler, followUpHandler, rerunHandler } = createHarness();
    cancelExecutionMock.mockResolvedValue({ cancelled: true, runId: 'run-1' });
    rerunExecutionMock.mockResolvedValue({ accepted: true, runId: 'run-rerun', sourceRunId: 'run-1' });
    followUpExecutionMock.mockResolvedValue({ accepted: true, runId: 'run-follow-up', sourceRunId: 'run-1' });

    const cancelRes = createJsonResponse();
    await cancelHandler({ params: { id: 'run-1' } }, cancelRes);
    expect(cancelRes.json).toHaveBeenCalledWith({ cancelled: true, runId: 'run-1' });

    const rerunRes = createJsonResponse();
    await rerunHandler({ params: { id: 'run-1' } }, rerunRes);
    expect(rerunExecutionMock).toHaveBeenCalledWith('run-1');
    expect(rerunRes.json).toHaveBeenCalledWith({ accepted: true, runId: 'run-rerun', sourceRunId: 'run-1' });

    const followUpRes = createJsonResponse();
    await followUpHandler({ params: { id: 'run-1' }, body: { prompt: 'Continue' } }, followUpRes);
    expect(followUpExecutionMock).toHaveBeenCalledWith('run-1', 'Continue');
    expect(followUpRes.json).toHaveBeenCalledWith({ accepted: true, runId: 'run-follow-up', sourceRunId: 'run-1' });

    expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(3);
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('executions', 'runs');
  });

  it('writes an activity entry when cancelling with route context', async () => {
    const store = { kind: 'documents-store' };
    getDocumentsStoreMock.mockReturnValue(store);
    const { cancelHandler } = createHarness({
      getStateRoot: () => '/state-root',
      getDesktopRootLayout: () => ({ root: '/desktop-root' }),
    });
    cancelExecutionMock.mockResolvedValue({ cancelled: true, runId: 'run-1' });
    getExecutionMock.mockResolvedValue({ execution: { id: 'run-1', title: 'Long task', status: 'cancelled' } });

    const cancelRes = createJsonResponse();
    await cancelHandler({ params: { id: 'run-1' } }, cancelRes);

    expect(getDocumentsStoreMock).toHaveBeenCalledWith('/state-root', { root: '/desktop-root' });
    expect(writeExecutionActivityEntryMock).toHaveBeenCalledWith(store, 'run-1', 'Long task', 'cancelled', 'error', {
      runId: 'run-1',
    });
    expect(cancelRes.json).toHaveBeenCalledWith({ cancelled: true, runId: 'run-1' });
  });

  it('writes activity entries when rerunning and following up with route context', async () => {
    const store = { kind: 'documents-store' };
    getDocumentsStoreMock.mockReturnValue(store);
    const { followUpHandler, rerunHandler } = createHarness({
      getStateRoot: () => '/state-root',
      getDesktopRootLayout: () => ({ root: '/desktop-root' }),
    });
    rerunExecutionMock.mockResolvedValue({ accepted: true, runId: 'run-rerun', sourceRunId: 'run-1' });
    followUpExecutionMock.mockResolvedValue({ accepted: true, runId: 'run-follow-up', sourceRunId: 'run-1' });
    getExecutionMock
      .mockResolvedValueOnce({ execution: { id: 'run-rerun', title: 'Rerun task', status: 'queued' } })
      .mockResolvedValueOnce({ execution: { id: 'run-follow-up', title: 'Follow-up task', status: 'queued' } });

    const rerunRes = createJsonResponse();
    await rerunHandler({ params: { id: 'run-1' } }, rerunRes);

    expect(writeExecutionActivityEntryMock).toHaveBeenCalledWith(store, 'run-rerun', 'Rerun task', 'started', 'activity', {
      sourceRunId: 'run-1',
      rerun: true,
    });
    expect(rerunRes.json).toHaveBeenCalledWith({ accepted: true, runId: 'run-rerun', sourceRunId: 'run-1' });

    const followUpRes = createJsonResponse();
    await followUpHandler({ params: { id: 'run-1' }, body: { prompt: 'Continue' } }, followUpRes);

    expect(writeExecutionActivityEntryMock).toHaveBeenCalledWith(store, 'run-follow-up', 'Follow-up task', 'started', 'activity', {
      sourceRunId: 'run-1',
      followUp: true,
    });
    expect(followUpRes.json).toHaveBeenCalledWith({ accepted: true, runId: 'run-follow-up', sourceRunId: 'run-1' });
  });

  it('returns recoverable rerun and follow-up rejections as conflict responses', async () => {
    const { followUpHandler, rerunHandler } = createHarness();
    rerunExecutionMock.mockRejectedValue(new Error('Run run-1 is still active.'));
    followUpExecutionMock.mockRejectedValue(new Error('Run run-2 does not support follow-up prompts.'));

    const rerunRes = createJsonResponse();
    await rerunHandler({ params: { id: 'run-1' } }, rerunRes);
    expect(rerunRes.status).toHaveBeenCalledWith(409);
    expect(rerunRes.json).toHaveBeenCalledWith({ error: 'This execution is still running.' });

    const followUpRes = createJsonResponse();
    await followUpHandler({ params: { id: 'run-2' }, body: { prompt: 'Continue' } }, followUpRes);
    expect(followUpRes.status).toHaveBeenCalledWith(409);
    expect(followUpRes.json).toHaveBeenCalledWith({ error: 'This execution does not support follow-up prompts.' });
    expect(logErrorMock).not.toHaveBeenCalled();
    expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
  });
});
