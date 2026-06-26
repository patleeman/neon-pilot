import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  LiveSessionControlErrorClass,
  abortLocalSessionMock,
  branchSessionMock,
  compactSessionMock,
  createLocalSessionMock,
  prewarmLiveSessionLoaderMock,
  destroySessionMock,
  existsSyncMock,
  exportSessionHtmlMock,
  forkSessionMock,
  getLiveSessionForkEntriesMock,
  getLiveSessionsMock,
  invalidateAppTopicsMock,
  isLiveMock,
  listPendingBackgroundRunResultsMock,
  liveRegistry,
  loadDaemonConfigMock,
  logErrorMock,
  logSlowConversationPerfMock,
  logWarnMock,
  markBackgroundRunResultsDeliveredMock,
  parseTailBlocksQueryMock,
  extractMentionIdsMock,
  pickPromptReferencesInOrderMock,
  queuePromptContextMock,
  readGitStatusSummaryWithTelemetryMock,
  readSessionBlocksMock,
  readSessionMetaMock,
  reloadSessionResourcesMock,
  resolveConversationAttachmentPromptFilesMock,
  resolveConversationCwdMock,
  resolveDaemonPathsMock,
  resolveDurableRunsRootMock,
  resolveConversationSessionFileMock,
  resolveExtensionPromptReferencesMock,
  resolvePromptReferencesMock,
  restoreQueuedMessageMock,
  resumeLocalSessionMock,
  setServerTimingHeadersMock,
  submitLocalPromptSessionMock,
  subscribeLocalMock,
  syncWebLiveConversationRunMock,
  takeOverSessionControlMock,
  buildReferencedMemoryDocsContextMock,
  buildReferencedTasksContextMock,
  expandPromptReferencesWithNodeGraphMock,
  publishAppEventMock,
  createSessionListenerUnsubscribeMock,
  writeAppTelemetryEventMock,
} = vi.hoisted(() => ({
  LiveSessionControlErrorClass: class LiveSessionControlError extends Error {},
  abortLocalSessionMock: vi.fn(),
  branchSessionMock: vi.fn(),
  compactSessionMock: vi.fn(),
  createLocalSessionMock: vi.fn(),
  prewarmLiveSessionLoaderMock: vi.fn(),
  createSessionListenerUnsubscribeMock: vi.fn(),
  destroySessionMock: vi.fn(),
  existsSyncMock: vi.fn(),
  exportSessionHtmlMock: vi.fn(),
  forkSessionMock: vi.fn(),
  getLiveSessionForkEntriesMock: vi.fn(),
  getLiveSessionsMock: vi.fn(),
  invalidateAppTopicsMock: vi.fn(),
  isLiveMock: vi.fn(),
  listPendingBackgroundRunResultsMock: vi.fn(),
  liveRegistry: new Map<string, unknown>(),
  loadDaemonConfigMock: vi.fn(),
  logErrorMock: vi.fn(),
  logSlowConversationPerfMock: vi.fn(),
  logWarnMock: vi.fn(),
  markBackgroundRunResultsDeliveredMock: vi.fn(),
  parseTailBlocksQueryMock: vi.fn(),
  extractMentionIdsMock: vi.fn(),
  pickPromptReferencesInOrderMock: vi.fn(),
  queuePromptContextMock: vi.fn(),
  readGitStatusSummaryWithTelemetryMock: vi.fn(),
  readSessionBlocksMock: vi.fn(),
  readSessionMetaMock: vi.fn(),
  reloadSessionResourcesMock: vi.fn(),
  resolveConversationAttachmentPromptFilesMock: vi.fn(),
  resolveConversationCwdMock: vi.fn(),
  resolveDaemonPathsMock: vi.fn(),
  resolveDurableRunsRootMock: vi.fn(),
  resolveConversationSessionFileMock: vi.fn((id: string) => `/sessions/${id}.jsonl`),
  resolveExtensionPromptReferencesMock: vi.fn(),
  resolvePromptReferencesMock: vi.fn(),
  restoreQueuedMessageMock: vi.fn(),
  resumeLocalSessionMock: vi.fn(),
  setServerTimingHeadersMock: vi.fn(),
  submitLocalPromptSessionMock: vi.fn(),
  subscribeLocalMock: vi.fn(),
  syncWebLiveConversationRunMock: vi.fn(),
  takeOverSessionControlMock: vi.fn(),
  buildReferencedMemoryDocsContextMock: vi.fn(),
  buildReferencedTasksContextMock: vi.fn(),
  expandPromptReferencesWithNodeGraphMock: vi.fn(),
  publishAppEventMock: vi.fn(),
  writeAppTelemetryEventMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('@neon-pilot/core', () => ({
  getStateRoot: vi.fn(() => '/tmp/neon-pilot-state'),
  resolveConversationAttachmentPromptFiles: resolveConversationAttachmentPromptFilesMock,
  writeAppTelemetryEvent: writeAppTelemetryEventMock,
}));

vi.mock('@neon-pilot/daemon', () => ({
  listPendingBackgroundRunResults: listPendingBackgroundRunResultsMock,
  loadDaemonConfig: loadDaemonConfigMock,
  markBackgroundRunResultsDelivered: markBackgroundRunResultsDeliveredMock,
  resolveDaemonPaths: resolveDaemonPathsMock,
  resolveDurableRunsRoot: resolveDurableRunsRootMock,
}));

vi.mock('../conversations/liveSessions.js', () => ({
  LiveSessionControlError: LiveSessionControlErrorClass,
  abortSession: abortLocalSessionMock,
  branchSession: branchSessionMock,
  compactSession: compactSessionMock,
  createSession: createLocalSessionMock,
  prewarmLiveSessionLoader: prewarmLiveSessionLoaderMock,
  destroySession: destroySessionMock,
  exportSessionHtml: exportSessionHtmlMock,
  forkSession: forkSessionMock,
  getLiveSessionForkEntries: getLiveSessionForkEntriesMock,
  getLiveSessions: getLiveSessionsMock,
  isLive: isLiveMock,
  queuePromptContext: queuePromptContextMock,
  registry: liveRegistry,
  reloadSessionResources: reloadSessionResourcesMock,
  renameSession: vi.fn(),
  restoreQueuedMessage: restoreQueuedMessageMock,
  resumeSession: resumeLocalSessionMock,
  submitPromptSession: submitLocalPromptSessionMock,
  subscribe: subscribeLocalMock,
  takeOverSessionControl: takeOverSessionControlMock,
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
  logSlowConversationPerf: logSlowConversationPerfMock,
  logWarn: logWarnMock,
  setServerTimingHeaders: setServerTimingHeadersMock,
}));

vi.mock('../conversations/conversationService.js', () => ({
  parseTailBlocksQuery: parseTailBlocksQueryMock,
  resolveConversationSessionFile: resolveConversationSessionFileMock,
}));

vi.mock('../conversations/sessions.js', () => ({
  appendConversationWorkspaceMetadata: vi.fn(),
  readSessionBlocks: readSessionBlocksMock,
  readSessionMeta: readSessionMetaMock,
}));

vi.mock('../extensions/extensionBackend.js', () => ({
  invokeExtensionAction: vi.fn(),
}));

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionPromptContextProviderRegistrations: vi.fn(() => []),
  withExtensionRegistryReadCache: vi.fn(async (callback: () => unknown) => callback()),
}));

vi.mock('../conversations/conversationCwd.js', () => ({
  resolveConversationCwd: resolveConversationCwdMock,
}));

vi.mock('../knowledge/promptReferences.js', () => ({
  buildReferencedMemoryDocsContext: buildReferencedMemoryDocsContextMock,
  buildReferencedTasksContext: buildReferencedTasksContextMock,
  expandPromptReferencesWithNodeGraph: expandPromptReferencesWithNodeGraphMock,
  extractMentionIds: extractMentionIdsMock,
  pickPromptReferencesInOrder: pickPromptReferencesInOrderMock,
  resolvePromptReferences: resolvePromptReferencesMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    invokeAction: vi.fn(),
    listPromptAssemblyContributions: vi.fn(async () => ({ contextProviders: [], assemblyProviders: [], hooks: [] })),
    resolvePromptReferences: resolveExtensionPromptReferencesMock,
  }),
}));

vi.mock('../conversations/conversationRuns.js', () => ({
  syncWebLiveConversationRun: syncWebLiveConversationRunMock,
}));

vi.mock('../shared/appEvents.js', () => ({
  publishAppEvent: publishAppEventMock,
}));

vi.mock('../workspace/gitStatus.js', () => ({
  readGitStatusSummaryWithTelemetry: readGitStatusSummaryWithTelemetryMock,
}));

import { handleLiveSessionPrompt, registerLiveSessionRoutes, writeLiveConversationControlError } from './liveSessions.js';

type Handler = (req: unknown, res: unknown) => Promise<void> | void;

function createRequest(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Array<() => void>>();
  const req = {
    body: {},
    headers: {},
    on: vi.fn((event: string, listener: () => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    }),
    originalUrl: undefined as string | undefined,
    params: {},
    query: {},
    url: '',
    emit(event: string) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
    ...overrides,
  };

  return req;
}

function createResponse() {
  const response = {
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    statusCode: 200,
    end: vi.fn(),
    flushHeaders: vi.fn(),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
    setHeader: vi.fn((name: string, value: unknown) => {
      response.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    write: vi.fn(),
  };

  return response;
}

function createDesktopHarness(options?: {
  flushLiveDeferredResumes?: () => Promise<void>;
  listMemoryDocs?: () => Array<Record<string, unknown>>;
  listTasksForRuntimeScope?: () => Array<Record<string, unknown>>;
}) {
  const deleteHandlers = new Map<string, Handler>();
  const getHandlers = new Map<string, Handler>();
  const patchHandlers = new Map<string, Handler>();
  const postHandlers = new Map<string, Handler>();
  const router = {
    delete: vi.fn((path: string, handler: Handler) => {
      deleteHandlers.set(path, handler);
    }),
    get: vi.fn((path: string, handler: Handler) => {
      getHandlers.set(path, handler);
    }),
    patch: vi.fn((path: string, handler: Handler) => {
      patchHandlers.set(path, handler);
    }),
    post: vi.fn((path: string, handler: Handler) => {
      postHandlers.set(path, handler);
    }),
  };

  registerLiveSessionRoutes(router as never, {
    buildLiveSessionExtensionFactories: () => ['factory'],
    buildLiveSessionResourceOptions: () => ({ additionalExtensionPaths: ['extensions'] }),
    flushLiveDeferredResumes: options?.flushLiveDeferredResumes ?? (async () => {}),
    getRuntimeScope: () => 'assistant',
    getDefaultWebCwd: () => '/default-cwd',
    getRepoRoot: () => '/repo',
    listMemoryDocs: options?.listMemoryDocs ?? (() => []),
    listTasksForRuntimeScope: options?.listTasksForRuntimeScope ?? (() => []),
  });

  return {
    deleteHandler: (path: string) => deleteHandlers.get(path)!,
    getHandler: (path: string) => getHandlers.get(path)!,
    patchHandler: (path: string) => patchHandlers.get(path)!,
    postHandler: (path: string) => postHandlers.get(path)!,
  };
}

describe('live session routes', () => {
  beforeEach(() => {
    abortLocalSessionMock.mockReset();
    branchSessionMock.mockReset();
    compactSessionMock.mockReset();
    createLocalSessionMock.mockReset();
    prewarmLiveSessionLoaderMock.mockReset();
    createSessionListenerUnsubscribeMock.mockReset();
    destroySessionMock.mockReset();
    existsSyncMock.mockReset();
    exportSessionHtmlMock.mockReset();
    forkSessionMock.mockReset();
    getLiveSessionForkEntriesMock.mockReset();
    getLiveSessionsMock.mockReset();
    invalidateAppTopicsMock.mockReset();
    isLiveMock.mockReset();
    listPendingBackgroundRunResultsMock.mockReset();
    loadDaemonConfigMock.mockReset();
    logErrorMock.mockReset();
    logSlowConversationPerfMock.mockReset();
    logWarnMock.mockReset();
    markBackgroundRunResultsDeliveredMock.mockReset();
    parseTailBlocksQueryMock.mockReset();
    extractMentionIdsMock.mockReset();
    pickPromptReferencesInOrderMock.mockReset();
    queuePromptContextMock.mockReset();
    readGitStatusSummaryWithTelemetryMock.mockReset();
    readSessionBlocksMock.mockReset();
    readSessionMetaMock.mockReset();
    reloadSessionResourcesMock.mockReset();
    resolveConversationAttachmentPromptFilesMock.mockReset();
    resolveConversationCwdMock.mockReset();
    resolveDaemonPathsMock.mockReset();
    resolveDurableRunsRootMock.mockReset();
    resolveExtensionPromptReferencesMock.mockReset();
    resolvePromptReferencesMock.mockReset();
    restoreQueuedMessageMock.mockReset();
    resumeLocalSessionMock.mockReset();
    setServerTimingHeadersMock.mockReset();
    submitLocalPromptSessionMock.mockReset();
    subscribeLocalMock.mockReset();
    syncWebLiveConversationRunMock.mockReset();
    takeOverSessionControlMock.mockReset();
    buildReferencedMemoryDocsContextMock.mockReset();
    buildReferencedTasksContextMock.mockReset();
    expandPromptReferencesWithNodeGraphMock.mockReset();
    liveRegistry.clear();
    vi.useRealTimers();

    abortLocalSessionMock.mockResolvedValue(undefined);
    branchSessionMock.mockResolvedValue({ id: 'branch-1' });
    compactSessionMock.mockResolvedValue('compacted');
    createLocalSessionMock.mockResolvedValue({ id: 'live-new', sessionFile: '/sessions/live-new.jsonl' });
    prewarmLiveSessionLoaderMock.mockResolvedValue(undefined);
    existsSyncMock.mockReturnValue(true);
    exportSessionHtmlMock.mockResolvedValue('/tmp/export.html');
    forkSessionMock.mockResolvedValue({ id: 'fork-1' });
    getLiveSessionForkEntriesMock.mockReturnValue([{ id: 'fork-entry-1' }]);
    getLiveSessionsMock.mockReturnValue([{ id: 'live-1', cwd: '/repo/worktree', title: 'Live 1' }]);
    isLiveMock.mockReturnValue(false);
    listPendingBackgroundRunResultsMock.mockReturnValue([]);
    loadDaemonConfigMock.mockReturnValue({ ipc: { socketPath: '/tmp/daemon.sock' } });
    markBackgroundRunResultsDeliveredMock.mockReturnValue([]);
    parseTailBlocksQueryMock.mockReturnValue(undefined);
    extractMentionIdsMock.mockReturnValue([]);
    pickPromptReferencesInOrderMock.mockImplementation((ids: string[], entries: Array<{ id?: string }>) =>
      entries.filter((entry) => entry.id && ids.includes(entry.id)),
    );
    readGitStatusSummaryWithTelemetryMock.mockReturnValue({
      summary: {
        branch: 'main',
        changeCount: 1,
        changes: [{ relativePath: 'src/index.ts', change: 'M' }],
        linesAdded: 5,
        linesDeleted: 2,
      },
      telemetry: {
        cache: 'hit',
        degraded: false,
        durationMs: 12,
      },
    });
    readSessionBlocksMock.mockReturnValue(null);
    readSessionMetaMock.mockReturnValue(null);
    resolveConversationAttachmentPromptFilesMock.mockReturnValue([]);
    resolveConversationCwdMock.mockReturnValue('/repo/worktree');
    resolveDaemonPathsMock.mockReturnValue({ root: '/daemon' });
    resolveDurableRunsRootMock.mockReturnValue('/daemon/runs');
    resolveExtensionPromptReferencesMock.mockResolvedValue({ contextBlocks: [], references: [] });
    resolvePromptReferencesMock.mockReturnValue({ projectIds: [], taskIds: [], memoryDocIds: [], skillNames: [] });
    restoreQueuedMessageMock.mockResolvedValue({ restoredIndex: 0 });
    resumeLocalSessionMock.mockResolvedValue({ id: 'live-resumed' });
    submitLocalPromptSessionMock.mockResolvedValue({ acceptedAs: 'started', completion: Promise.resolve() });
    subscribeLocalMock.mockImplementation(() => createSessionListenerUnsubscribeMock);
    syncWebLiveConversationRunMock.mockResolvedValue(undefined);
    takeOverSessionControlMock.mockReturnValue({ ok: true, surfaceId: 'surface-1' });
    buildReferencedMemoryDocsContextMock.mockReturnValue('Memory docs context');
    buildReferencedTasksContextMock.mockReturnValue('Task context');
    expandPromptReferencesWithNodeGraphMock.mockReturnValue({ projectIds: [], memoryDocIds: [], skillNames: [] });
  });

  it('skips reference catalog lookups for plain prompts without mentions', async () => {
    const listMemoryDocs = vi.fn(() => [{ id: 'note-1', title: 'Memory', path: '/notes/memory.md', summary: 'Summary' }]);
    const listTasksForRuntimeScope = vi.fn(() => [{ id: 'task-1', prompt: 'Run the tests', enabled: true, running: false }]);
    createDesktopHarness({ listMemoryDocs, listTasksForRuntimeScope });

    isLiveMock.mockReturnValue(true);
    submitLocalPromptSessionMock.mockResolvedValue({ acceptedAs: 'started', completion: Promise.resolve() });

    const promptRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-plain' },
        body: { text: 'Please continue.' },
      }),
      promptRes,
    );
    await Promise.resolve();

    expect(listTasksForRuntimeScope).not.toHaveBeenCalled();
    expect(listMemoryDocs).not.toHaveBeenCalled();
    expect(resolvePromptReferencesMock).not.toHaveBeenCalled();
    expect(expandPromptReferencesWithNodeGraphMock).not.toHaveBeenCalled();
    expect(queuePromptContextMock).not.toHaveBeenCalled();
    expect(promptRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted: true,
        delivery: 'started',
        ok: true,
        referencedAttachmentIds: [],
        referencedMemoryDocIds: [],
        referencedTaskIds: [],
        referencedKnowledgeFileIds: [],
        perf: expect.any(Object),
      }),
    );
  });

  it('passes relatedConversationIds through to submit (context injection delegated to extension)', async () => {
    createDesktopHarness();
    isLiveMock.mockReturnValue(true);
    readSessionBlocksMock.mockReturnValue(null);
    liveRegistry.set('live-empty', {
      cwd: '/repo/worktree',
      session: {
        getSteeringMessages: () => [],
        getFollowUpMessages: () => [],
        isStreaming: false,
        state: { messages: [] },
      },
    });

    const promptRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-empty' },
        body: {
          relatedConversationIds: ['related-1'],
          text: 'Start from this context.',
        },
      }),
      promptRes,
    );

    // Extension prompt context providers handle pointer injection in the
    // extension's backend. No provider is registered in test config, so
    // no pointer context messages are queued by core.
    expect(promptRes.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('handles prompt validation, internal context injection, resumed sessions, and control conflicts', async () => {
    const flushLiveDeferredResumes = vi.fn(async () => {});
    createDesktopHarness({
      flushLiveDeferredResumes,
      listMemoryDocs: () => [{ id: 'note-1', title: 'Memory', path: '/notes/memory.md', summary: 'Summary' }],
      listTasksForRuntimeScope: () => [{ id: 'task-1', prompt: 'Run the tests', enabled: true, running: false }],
    });

    const emptyRes = createResponse();
    await handleLiveSessionPrompt(createRequest({ params: { id: 'live-1' }, body: {} }), emptyRes);
    expect(emptyRes.status).toHaveBeenCalledWith(400);
    expect(emptyRes.json).toHaveBeenCalledWith({ error: 'text, images, videos, or attachmentRefs required' });

    const blankTextRes = createResponse();
    await handleLiveSessionPrompt(createRequest({ params: { id: 'live-1' }, body: { text: '   ' } }), blankTextRes);
    expect(blankTextRes.status).toHaveBeenCalledWith(400);
    expect(blankTextRes.json).toHaveBeenCalledWith({ error: 'text, images, videos, or attachmentRefs required' });

    const invalidImageRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-1' },
        body: {
          images: [
            null,
            { mimeType: '', data: '' },
            { mimeType: 'image/png', data: '   ' },
            {
              mimeType: 'image/png',
              data: 'not-valid-base64!',
            },
            { mimeType: 'text/plain', data: 'aGVsbG8=' },
          ],
        },
      }),
      invalidImageRes,
    );
    expect(invalidImageRes.status).toHaveBeenCalledWith(400);
    expect(invalidImageRes.json).toHaveBeenCalledWith({ error: 'text, images, videos, or attachmentRefs required' });

    const unsafeAttachmentRefRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-1' },
        body: { attachmentRefs: [{ attachmentId: 'att-1', revision: Number.MAX_SAFE_INTEGER + 1 }] },
      }),
      unsafeAttachmentRefRes,
    );
    expect(unsafeAttachmentRefRes.status).toHaveBeenCalledWith(400);
    expect(unsafeAttachmentRefRes.json).toHaveBeenCalledWith({ error: 'text, images, videos, or attachmentRefs required' });

    const absurdAttachmentRefRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-1' },
        body: { attachmentRefs: [{ attachmentId: 'att-1', revision: Number.MAX_SAFE_INTEGER }] },
      }),
      absurdAttachmentRefRes,
    );
    expect(absurdAttachmentRefRes.status).toHaveBeenCalledWith(400);
    expect(absurdAttachmentRefRes.json).toHaveBeenCalledWith({ error: 'text, images, videos, or attachmentRefs required' });

    isLiveMock.mockReturnValueOnce(true);
    const invalidBehaviorRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-1' },
        body: { text: 'hello', behavior: 'bogus' },
      }),
      invalidBehaviorRes,
    );
    expect(invalidBehaviorRes.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(submitLocalPromptSessionMock).toHaveBeenCalledWith('live-1', 'hello', undefined, undefined, undefined);
    submitLocalPromptSessionMock.mockClear();

    resolveConversationAttachmentPromptFilesMock.mockImplementationOnce(() => {
      throw new Error('Attachment not found');
    });

    const badAttachmentRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'live-1' },
        body: { text: 'hello', attachmentRefs: [{ attachmentId: 'att-1' }] },
      }),
      badAttachmentRes,
    );
    expect(badAttachmentRes.status).toHaveBeenCalledWith(400);
    expect(badAttachmentRes.json).toHaveBeenCalledWith({ error: 'Attachment not found' });

    extractMentionIdsMock.mockReturnValue(['task-1', 'note-1', 'knowledge-1']);
    resolvePromptReferencesMock.mockReturnValue({ projectIds: [], taskIds: ['task-1'], memoryDocIds: ['note-1'], skillNames: [] });
    expandPromptReferencesWithNodeGraphMock.mockReturnValue({ projectIds: [], memoryDocIds: ['note-1'], skillNames: [] });
    resolveExtensionPromptReferencesMock.mockResolvedValue({
      contextBlocks: ['Knowledge files context'],
      references: [{ kind: 'knowledgeFile', id: 'knowledge-1', path: '/knowledge/knowledge-1.md' }],
    });
    resolveConversationAttachmentPromptFilesMock.mockReturnValue([
      {
        attachmentId: 'att-1',
        kind: 'excalidraw',
        previewMimeType: 'image/png',
        previewPath: '/tmp/preview.png',
        revision: 2,
        sourceMimeType: 'application/json',
        sourcePath: '/tmp/source.excalidraw',
        title: 'Diagram',
      },
    ]);
    listPendingBackgroundRunResultsMock.mockReturnValue([{ id: 'result-1', prompt: 'Background result.' }]);
    markBackgroundRunResultsDeliveredMock.mockReturnValue(['result-1']);
    readSessionBlocksMock.mockReturnValue({ meta: { file: '/sessions/stored.jsonl' }, totalBlocks: 5 });
    liveRegistry.set('stored-session', {
      session: { sessionFile: '/sessions/stored.jsonl' },
    });
    resumeLocalSessionMock.mockImplementation(async () => {
      liveRegistry.set('live-resumed', {
        cwd: '/repo/resumed',
        session: { sessionFile: '/sessions/stored.jsonl' },
        title: 'Resumed conversation',
      });
      return { id: 'live-resumed' };
    });

    const promptRes = createResponse();
    await handleLiveSessionPrompt(
      createRequest({
        params: { id: 'stored-session' },
        body: {
          attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
          behavior: 'followUp',
          contextMessages: [
            {
              customType: 'related_threads_context',
              content: 'Summaries from selected threads.',
            },
          ],
          surfaceId: 'surface-1',
          text: 'Please continue.',
        },
      }),
      promptRes,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(queuePromptContextMock).not.toHaveBeenCalledWith('live-resumed', 'related_threads_context', 'Summaries from selected threads.');
    expect(promptRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted: true,
        delivery: 'started',
        ok: true,
        referencedAttachmentIds: ['att-1'],
        referencedMemoryDocIds: ['note-1'],
        referencedTaskIds: ['task-1'],
        referencedKnowledgeFileIds: ['knowledge-1'],
        perf: expect.any(Object),
      }),
    );

    isLiveMock.mockReturnValue(true);
    submitLocalPromptSessionMock.mockImplementationOnce(async () => {
      throw new LiveSessionControlErrorClass('Session busy');
    });
    const conflictRes = createResponse();
    await handleLiveSessionPrompt(createRequest({ params: { id: 'live-1' }, body: { text: 'Retry' } }), conflictRes);
    expect(conflictRes.status).toHaveBeenCalledWith(409);
    expect(conflictRes.json).toHaveBeenCalledWith({ error: 'Session busy' });
  });

  it('maps live-session control errors through the exported helper', () => {
    const errorRes = createResponse();
    expect(writeLiveConversationControlError(errorRes as never, new LiveSessionControlErrorClass('Busy'))).toBe(true);
    expect(errorRes.status).toHaveBeenCalledWith(409);
    expect(errorRes.json).toHaveBeenCalledWith({ error: 'Busy' });
  });
});
