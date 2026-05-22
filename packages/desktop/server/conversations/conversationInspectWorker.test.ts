import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreads = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: unknown) => void),
  parentPort: {
    on: vi.fn((event: string, handler: (request: unknown) => void) => {
      if (event === 'message') workerThreads.handler = handler;
    }),
    postMessage: vi.fn(),
  },
}));
const capability = vi.hoisted(() => ({
  diffConversationInspectBlocks: vi.fn(() => ({ diff: true })),
  formatConversationInspectDiffResult: vi.fn(() => 'diff text'),
  formatConversationInspectOutlineResult: vi.fn(() => 'outline text'),
  formatConversationInspectQueryResult: vi.fn(() => 'query text'),
  formatConversationInspectSearchResult: vi.fn(() => 'search text'),
  formatConversationInspectSessionList: vi.fn(() => 'list text'),
  listConversationInspectSessions: vi.fn(() => ({ sessions: [] })),
  outlineConversationInspectSession: vi.fn(() => ({ outline: [] })),
  queryConversationInspectBlocks: vi.fn(() => ({ blocks: [] })),
  readWindowConversationInspectBlocks: vi.fn(() => ({ window: [] })),
  searchConversationInspectSessions: vi.fn(() => ({ matches: [] })),
}));
const service = vi.hoisted(() => ({ setConversationServiceContext: vi.fn() }));

vi.mock('node:worker_threads', () => ({ parentPort: workerThreads.parentPort }));
vi.mock('./conversationInspectCapability.js', () => capability);
vi.mock('./conversationService.js', () => service);

async function loadWorker() {
  vi.resetModules();
  workerThreads.handler = undefined;
  await import('./conversationInspectWorker.js');
}

describe('conversationInspectWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes shared conversation service context and registers a message handler', async () => {
    await loadWorker();

    expect(service.setConversationServiceContext).toHaveBeenCalledWith({
      getRuntimeScope: expect.any(Function),
      getRepoRoot: expect.any(Function),
      getSavedUiPreferences: expect.any(Function),
    });
    const context = service.setConversationServiceContext.mock.calls[0][0];
    expect(context.getRuntimeScope()).toBe('shared');
    expect(context.getSavedUiPreferences()).toMatchObject({ openConversationIds: [], activeConversationId: null });
    expect(workerThreads.parentPort.on).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it.each([
    ['list', 'listConversationInspectSessions', 'formatConversationInspectSessionList', { sessions: [] }, 'list text'],
    ['search', 'searchConversationInspectSessions', 'formatConversationInspectSearchResult', { matches: [] }, 'search text'],
    ['query', 'queryConversationInspectBlocks', 'formatConversationInspectQueryResult', { blocks: [] }, 'query text'],
    ['outline', 'outlineConversationInspectSession', 'formatConversationInspectOutlineResult', { outline: [] }, 'outline text'],
    ['read_window', 'readWindowConversationInspectBlocks', 'formatConversationInspectQueryResult', { window: [] }, 'query text'],
    ['diff', 'diffConversationInspectBlocks', 'formatConversationInspectDiffResult', { diff: true }, 'diff text'],
  ])('handles %s requests', async (action, capabilityName, formatterName, result, text) => {
    await loadWorker();
    const params = { conversationId: 'conv-1' };

    workerThreads.handler?.({ id: 1, action, params });

    expect(capability[capabilityName as keyof typeof capability]).toHaveBeenCalledWith(params);
    expect(capability[formatterName as keyof typeof capability]).toHaveBeenCalledWith(result);
    expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith({ id: 1, ok: true, action, result, text });
  });

  it('posts structured errors for unsupported actions and thrown capability errors', async () => {
    await loadWorker();
    workerThreads.handler?.({ id: 2, action: 'bad', params: {} });
    expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith({
      id: 2,
      ok: false,
      error: 'Unsupported conversation_inspect action "bad". Valid values: list, search, query, outline, read_window, diff.',
    });

    capability.queryConversationInspectBlocks.mockImplementationOnce(() => {
      throw new Error('query failed');
    });
    workerThreads.handler?.({ id: 3, action: 'query', params: {} });
    expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith({ id: 3, ok: false, error: 'query failed' });
  });
});
