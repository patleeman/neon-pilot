import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  LiveSessionControlErrorClass,
  SessionManagerOpenMock,
  applyConversationModelPreferencesToSessionManagerMock,
  buildAppendOnlySessionDetailResponseMock,
  buildContentDispositionHeaderMock,
  cancelDeferredResumeForSessionFileMock,
  fireDeferredResumeNowForSessionFileMock,
  getAvailableModelObjectsMock,
  getConversationArtifactMock,
  getConversationAttachmentMock,
  invalidateAppTopicsMock,
  isLocalLiveMock,
  listConversationArtifactsMock,
  listConversationAttachmentsMock,
  listConversationSessionsSnapshotMock,
  listDeferredResumesForSessionFileMock,
  logErrorMock,
  logInfoMock,
  logSlowConversationPerfMock,
  logWarnMock,
  parseTailBlocksQueryMock,
  publishConversationSessionMetaChangedMock,
  startConversationReadModelBackfillMock,
  readConversationAttachmentDownloadMock,
  readConversationModelPreferenceStateByIdMock,
  readConversationSessionMetaMock,
  readConversationSessionSignatureMock,
  readSavedModelPreferencesMock,
  readSessionBlockMock,
  readSessionDetailForRouteMock,
  readSessionImageAssetMock,
  readSessionSearchTextForMetaMock,
  readSessionSearchTextMock,
  searchConversationInspectSessionsMock,
  searchIndexedConversationContentMock,
  resolveConversationSessionFileMock,
  saveConversationAttachmentMock,
  addConversationCommitCheckpointCommentMock,
  scheduleDeferredResumeForSessionFileMock,
  startConversationCatalogBackfillFromSourceMock,
  setConversationServiceContextMock,
  setServerTimingHeadersMock,
  toggleConversationAttentionMock,
  updateLiveSessionModelPreferencesMock,
  ensureRequestControlsLocalLiveConversationMock,
} = vi.hoisted(() => ({
  LiveSessionControlErrorClass: class LiveSessionControlError extends Error {},
  SessionManagerOpenMock: vi.fn(),
  applyConversationModelPreferencesToSessionManagerMock: vi.fn(),
  buildAppendOnlySessionDetailResponseMock: vi.fn(),
  buildContentDispositionHeaderMock: vi.fn(),
  cancelDeferredResumeForSessionFileMock: vi.fn(),
  fireDeferredResumeNowForSessionFileMock: vi.fn(),
  getAvailableModelObjectsMock: vi.fn(),
  getConversationArtifactMock: vi.fn(),
  getConversationAttachmentMock: vi.fn(),
  invalidateAppTopicsMock: vi.fn(),
  isLocalLiveMock: vi.fn(),
  listConversationArtifactsMock: vi.fn(),
  listConversationAttachmentsMock: vi.fn(),
  listConversationSessionsSnapshotMock: vi.fn(),
  listDeferredResumesForSessionFileMock: vi.fn(),
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logSlowConversationPerfMock: vi.fn(),
  logWarnMock: vi.fn(),
  parseTailBlocksQueryMock: vi.fn(),
  publishConversationSessionMetaChangedMock: vi.fn(),
  startConversationReadModelBackfillMock: vi.fn(),
  readConversationAttachmentDownloadMock: vi.fn(),
  readConversationModelPreferenceStateByIdMock: vi.fn(),
  readConversationSessionMetaMock: vi.fn(),
  readConversationSessionSignatureMock: vi.fn(),
  readSavedModelPreferencesMock: vi.fn(),
  readSessionBlockMock: vi.fn(),
  readSessionDetailForRouteMock: vi.fn(),
  readSessionImageAssetMock: vi.fn(),
  readSessionSearchTextForMetaMock: vi.fn(),
  readSessionSearchTextMock: vi.fn(),
  searchConversationInspectSessionsMock: vi.fn(),
  searchIndexedConversationContentMock: vi.fn(),
  resolveConversationSessionFileMock: vi.fn(),
  saveConversationAttachmentMock: vi.fn(),
  addConversationCommitCheckpointCommentMock: vi.fn(),
  scheduleDeferredResumeForSessionFileMock: vi.fn(),
  startConversationCatalogBackfillFromSourceMock: vi.fn(),
  setConversationServiceContextMock: vi.fn(),
  setServerTimingHeadersMock: vi.fn(),
  toggleConversationAttentionMock: vi.fn(),
  updateLiveSessionModelPreferencesMock: vi.fn(),
  ensureRequestControlsLocalLiveConversationMock: vi.fn(),
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  SessionManager: {
    open: SessionManagerOpenMock,
  },
}));

vi.mock('@neon-pilot/core', () => ({
  getConversationArtifact: getConversationArtifactMock,
  getConversationAttachment: getConversationAttachmentMock,
  listConversationArtifacts: listConversationArtifactsMock,
  listConversationAttachments: listConversationAttachmentsMock,
  readConversationAttachmentDownload: readConversationAttachmentDownloadMock,
  saveConversationAttachment: saveConversationAttachmentMock,
  addConversationCommitCheckpointComment: addConversationCommitCheckpointCommentMock,
}));

vi.mock('../automation/deferredResumes.js', () => ({
  cancelDeferredResumeForSessionFile: cancelDeferredResumeForSessionFileMock,
  fireDeferredResumeNowForSessionFile: fireDeferredResumeNowForSessionFileMock,
  listDeferredResumesForSessionFile: listDeferredResumesForSessionFileMock,
  scheduleDeferredResumeForSessionFile: scheduleDeferredResumeForSessionFileMock,
}));

vi.mock('../conversations/liveSessions.js', () => ({
  LiveSessionControlError: LiveSessionControlErrorClass,
  getAvailableModelObjects: getAvailableModelObjectsMock,
  isLive: isLocalLiveMock,
  updateLiveSessionModelPreferences: updateLiveSessionModelPreferencesMock,
}));

vi.mock('./liveSessions.js', () => ({
  ensureRequestControlsLocalLiveConversation: ensureRequestControlsLocalLiveConversationMock,
}));

vi.mock('../ui/settingsPersistence.js', () => ({
  DEFAULT_RUNTIME_SETTINGS_FILE: '/runtime/settings.json',
}));

vi.mock('../conversations/conversationModelPreferences.js', () => ({
  applyConversationModelPreferencesToSessionManager: applyConversationModelPreferencesToSessionManagerMock,
}));

vi.mock('../models/modelPreferences.js', () => ({
  readSavedModelPreferences: readSavedModelPreferencesMock,
}));

vi.mock('../conversations/sessions.js', () => ({
  buildAppendOnlySessionDetailResponse: buildAppendOnlySessionDetailResponseMock,
  readSessionBlock: readSessionBlockMock,
  readSessionImageAsset: readSessionImageAssetMock,
  readSessionSearchTextForMeta: readSessionSearchTextForMetaMock,
  readSessionSearchText: readSessionSearchTextMock,
}));

vi.mock('../conversations/conversationSessionCapability.js', () => ({
  readConversationSessionsCapability: listConversationSessionsSnapshotMock,
}));

vi.mock('../conversations/conversationSearchIndex.js', () => ({
  searchIndexedConversationContent: searchIndexedConversationContentMock,
}));

vi.mock('../shared/httpHeaders.js', () => ({
  buildContentDispositionHeader: buildContentDispositionHeaderMock,
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
  logInfo: logInfoMock,
  logSlowConversationPerf: logSlowConversationPerfMock,
  logWarn: logWarnMock,
  setServerTimingHeaders: setServerTimingHeadersMock,
}));

vi.mock('../shared/appEvents.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
}));

vi.mock('../conversations/conversationService.js', () => ({
  listConversationSessionsSnapshot: listConversationSessionsSnapshotMock,
  parseTailBlocksQuery: parseTailBlocksQueryMock,
  publishConversationSessionMetaChanged: publishConversationSessionMetaChangedMock,
  startConversationCatalogBackfillFromSource: startConversationCatalogBackfillFromSourceMock,
  startConversationReadModelBackfill: startConversationReadModelBackfillMock,
  readConversationModelPreferenceStateById: readConversationModelPreferenceStateByIdMock,
  readConversationSessionImageAsset: readSessionImageAssetMock,
  readConversationSessionMeta: readConversationSessionMetaMock,
  readConversationSessionSignature: readConversationSessionSignatureMock,
  readSessionDetailForRoute: readSessionDetailForRouteMock,
  resolveConversationSessionFile: resolveConversationSessionFileMock,
  setConversationServiceContext: setConversationServiceContextMock,
  toggleConversationAttention: toggleConversationAttentionMock,
}));

vi.mock('../conversations/conversationInspectCapability.js', () => ({
  ConversationInspectCapabilityInputError: class ConversationInspectCapabilityInputError extends Error {},
  searchConversationInspectSessions: searchConversationInspectSessionsMock,
}));

import { registerConversationRoutes } from './conversations.js';

type Handler = (
  req: { body?: unknown; params?: Record<string, string>; query?: Record<string, unknown> },
  res: ReturnType<typeof createResponse>,
) => Promise<void> | void;

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

function createResponse() {
  const response = {
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    statusCode: 200,
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
    send: vi.fn(),
    sendFile: vi.fn(),
    setHeader: vi.fn((name: string, value: unknown) => {
      response.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    type: vi.fn((mimeType: string) => {
      response.headers['content-type'] = mimeType;
      return response;
    }),
  };

  return response;
}

function createDesktopHarness(options?: { flushLiveDeferredResumes?: () => Promise<void> }) {
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

  registerConversationRoutes(router as never, {
    flushLiveDeferredResumes: options?.flushLiveDeferredResumes ?? (async () => {}),
    getRuntimeScope: () => 'assistant',
    getRepoRoot: () => '/repo',
    getSavedUiPreferences: () => ({ compactConversations: false }),
  });

  return {
    deleteHandler: (path: string) => deleteHandlers.get(path)!,
    getHandler: (path: string) => getHandlers.get(path)!,
    patchHandler: (path: string) => patchHandlers.get(path)!,
    postHandler: (path: string) => postHandlers.get(path)!,
  };
}

describe('conversation routes', () => {
  beforeEach(() => {
    SessionManagerOpenMock.mockReset();
    applyConversationModelPreferencesToSessionManagerMock.mockReset();
    buildAppendOnlySessionDetailResponseMock.mockReset();
    buildContentDispositionHeaderMock.mockReset();
    cancelDeferredResumeForSessionFileMock.mockReset();
    fireDeferredResumeNowForSessionFileMock.mockReset();
    getAvailableModelObjectsMock.mockReset();
    getConversationArtifactMock.mockReset();
    getConversationAttachmentMock.mockReset();
    invalidateAppTopicsMock.mockReset();
    isLocalLiveMock.mockReset();
    listConversationArtifactsMock.mockReset();
    listConversationAttachmentsMock.mockReset();
    listConversationSessionsSnapshotMock.mockReset();
    listDeferredResumesForSessionFileMock.mockReset();
    logErrorMock.mockReset();
    logInfoMock.mockReset();
    logSlowConversationPerfMock.mockReset();
    logWarnMock.mockReset();
    parseTailBlocksQueryMock.mockReset();
    publishConversationSessionMetaChangedMock.mockReset();
    readConversationAttachmentDownloadMock.mockReset();
    readConversationModelPreferenceStateByIdMock.mockReset();
    readConversationSessionMetaMock.mockReset();
    readConversationSessionSignatureMock.mockReset();
    readSavedModelPreferencesMock.mockReset();
    readSessionBlockMock.mockReset();
    readSessionDetailForRouteMock.mockReset();
    readSessionImageAssetMock.mockReset();
    readSessionSearchTextForMetaMock.mockReset();
    readSessionSearchTextMock.mockReset();
    searchConversationInspectSessionsMock.mockReset();
    resolveConversationSessionFileMock.mockReset();
    saveConversationAttachmentMock.mockReset();
    addConversationCommitCheckpointCommentMock.mockReset();
    scheduleDeferredResumeForSessionFileMock.mockReset();
    setConversationServiceContextMock.mockReset();
    setServerTimingHeadersMock.mockReset();
    toggleConversationAttentionMock.mockReset();
    updateLiveSessionModelPreferencesMock.mockReset();
    ensureRequestControlsLocalLiveConversationMock.mockReset();

    SessionManagerOpenMock.mockReturnValue({ sessionFile: '/sessions/session-1.jsonl' });
    applyConversationModelPreferencesToSessionManagerMock.mockReturnValue({ model: 'gpt-4o', thinkingLevel: 'high' });
    buildAppendOnlySessionDetailResponseMock.mockReturnValue({ appended: true, sessionId: 'session-1' });
    buildContentDispositionHeaderMock.mockReturnValue('inline; filename="image.png"');
    fireDeferredResumeNowForSessionFileMock.mockResolvedValue({ id: 'resume-1', fired: true });
    getAvailableModelObjectsMock.mockReturnValue([{ id: 'gpt-4o' }]);
    getConversationArtifactMock.mockReturnValue({ id: 'artifact-1', title: 'Artifact 1' });
    getConversationAttachmentMock.mockReturnValue({ id: 'attachment-1', kind: 'excalidraw' });
    isLocalLiveMock.mockReturnValue(false);
    listConversationArtifactsMock.mockReturnValue([{ id: 'artifact-1', title: 'Artifact 1' }]);
    listConversationAttachmentsMock.mockReturnValue([{ id: 'attachment-1', kind: 'excalidraw' }]);
    listConversationSessionsSnapshotMock.mockReturnValue([
      {
        id: 'session-1',
        title: 'Session 1',
        cwd: '/repo',
        cwdSlug: 'repo',
        file: '/sessions/session-1.jsonl',
        timestamp: '2026-05-22T00:00:00.000Z',
        lastActivityAt: '2026-05-22T00:00:00.000Z',
        model: 'gpt-4o',
        messageCount: 2,
      },
    ]);
    listDeferredResumesForSessionFileMock.mockReturnValue([{ id: 'resume-1' }]);
    parseTailBlocksQueryMock.mockReturnValue(25);
    readConversationAttachmentDownloadMock.mockReturnValue({
      fileName: 'preview.png',
      filePath: '/tmp/preview.png',
      mimeType: 'image/png',
    });
    readConversationModelPreferenceStateByIdMock.mockResolvedValue({ model: 'gpt-4o', thinkingLevel: 'high' });
    readConversationSessionMetaMock.mockReturnValue({ id: 'session-1', title: 'Session 1' });
    readConversationSessionSignatureMock.mockReturnValue('sig-current');
    readSavedModelPreferencesMock.mockReturnValue({ currentModel: 'gpt-4o', currentThinkingLevel: 'high' });
    readSessionBlockMock.mockReturnValue({ id: 'block-1', text: 'Block text' });
    readSessionDetailForRouteMock.mockResolvedValue({
      remoteMirror: { durationMs: 0, status: 'skipped' },
      sessionRead: {
        detail: { id: 'session-1', signature: 'sig-next' },
        telemetry: { cache: 'miss', durationMs: 12, loader: 'local' },
      },
    });
    readSessionImageAssetMock.mockReturnValue({
      data: Buffer.from('image-data'),
      fileName: 'image.png',
      mimeType: 'image/png',
    });
    readSessionSearchTextForMetaMock.mockReturnValue('needle found');
    readSessionSearchTextMock.mockReturnValue('search text');
    searchConversationInspectSessionsMock.mockReturnValue({
      query: 'needle',
      mode: 'allTerms',
      scope: 'all',
      totalMatching: 1,
      returnedCount: 1,
      matches: [{ conversationId: 'session-1', title: 'Session 1', snippet: 'needle found' }],
    });
    resolveConversationSessionFileMock.mockReturnValue('/sessions/session-1.jsonl');
    saveConversationAttachmentMock.mockReturnValue({ id: 'attachment-1', kind: 'excalidraw' });
    addConversationCommitCheckpointCommentMock.mockReturnValue({
      id: 'checkpoint-1',
      commentCount: 1,
      comments: [{ id: 'comment-1', body: 'Ship it' }],
    });
    scheduleDeferredResumeForSessionFileMock.mockResolvedValue({ id: 'resume-2', delay: '5m' });
    toggleConversationAttentionMock.mockReturnValue({ read: true });
    updateLiveSessionModelPreferencesMock.mockResolvedValue({ model: 'gpt-4o', thinkingLevel: 'high' });
  });

  it('serves session image assets and content search routes', async () => {
    const { getHandler, postHandler } = createDesktopHarness();

    expect(setConversationServiceContextMock).toHaveBeenCalledWith({
      getRuntimeScope: expect.any(Function),
      getRepoRoot: expect.any(Function),
      getSavedUiPreferences: expect.any(Function),
    });

    readSessionImageAssetMock.mockReturnValueOnce(null);
    const missingImageRes = createResponse();
    getHandler('/api/sessions/:id/blocks/:blockId/image')(
      createRequest({ params: { id: 'session-1', blockId: 'block-1' } }),
      missingImageRes,
    );
    expect(missingImageRes.status).toHaveBeenCalledWith(404);
    expect(missingImageRes.json).toHaveBeenCalledWith({ error: 'Session image not found' });

    const imageRes = createResponse();
    getHandler('/api/sessions/:id/blocks/:blockId/image')(createRequest({ params: { id: 'session-1', blockId: 'block-1' } }), imageRes);
    expect(imageRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="image.png"');
    expect(imageRes.type).toHaveBeenCalledWith('image/png');
    expect(imageRes.send).toHaveBeenCalledWith(Buffer.from('image-data'));

    const indexedImageRes = createResponse();
    getHandler('/api/sessions/:id/blocks/:blockId/images/:imageIndex')(
      createRequest({
        params: { id: 'session-1', blockId: 'block-1', imageIndex: '2' },
      }),
      indexedImageRes,
    );
    expect(readSessionImageAssetMock).toHaveBeenLastCalledWith('session-1', 'block-1', 2);
    expect(indexedImageRes.send).toHaveBeenCalledWith(Buffer.from('image-data'));

    const malformedIndexedImageRes = createResponse();
    getHandler('/api/sessions/:id/blocks/:blockId/images/:imageIndex')(
      createRequest({
        params: { id: 'session-1', blockId: 'block-1', imageIndex: '2abc' },
      }),
      malformedIndexedImageRes,
    );
    expect(malformedIndexedImageRes.status).toHaveBeenCalledWith(400);
    expect(malformedIndexedImageRes.json).toHaveBeenCalledWith({ error: 'imageIndex must be a non-negative integer' });

    const unsafeIndexedImageRes = createResponse();
    getHandler('/api/sessions/:id/blocks/:blockId/images/:imageIndex')(
      createRequest({
        params: { id: 'session-1', blockId: 'block-1', imageIndex: '9007199254740993' },
      }),
      unsafeIndexedImageRes,
    );
    expect(unsafeIndexedImageRes.status).toHaveBeenCalledWith(400);
    expect(unsafeIndexedImageRes.json).toHaveBeenCalledWith({ error: 'imageIndex must be a non-negative integer' });

    searchIndexedConversationContentMock.mockReturnValueOnce([
      {
        conversationId: 'session-1',
        title: 'Session 1',
        cwd: '/repo',
        lastActivityAt: '2026-05-22T00:00:00.000Z',
        isLive: false,
        isRunning: false,
        blockId: 'search-index',
        blockType: 'text',
        blockIndex: 0,
        snippet: 'needle found',
      },
    ]);
    const contentSearchRes = createResponse();
    postHandler('/api/sessions/search')(createRequest({ body: { query: 'needle', limit: 25 } }), contentSearchRes);
    expect(readSessionSearchTextForMetaMock).not.toHaveBeenCalled();
    expect(searchIndexedConversationContentMock).toHaveBeenCalledWith({ terms: ['needle'], limit: 25 });
    expect(contentSearchRes.json).toHaveBeenCalledWith({
      query: 'needle',
      mode: 'allTerms',
      scope: 'all',
      totalMatching: 1,
      returnedCount: 1,
      matches: [
        {
          conversationId: 'session-1',
          title: 'Session 1',
          cwd: '/repo',
          lastActivityAt: '2026-05-22T00:00:00.000Z',
          isLive: false,
          isRunning: false,
          blockId: 'search-index',
          blockType: 'text',
          blockIndex: 0,
          snippet: 'needle found',
        },
      ],
    });
  });

  it('handles checkpoint comment routes', async () => {
    const { postHandler } = createDesktopHarness();

    const createCheckpointCommentRes = createResponse();
    postHandler('/api/conversations/:id/checkpoints/:checkpointId/comments')(
      createRequest({
        params: { id: 'session-1', checkpointId: 'checkpoint-1' },
        body: { body: 'Ship it' },
      }),
      createCheckpointCommentRes,
    );
    expect(addConversationCommitCheckpointCommentMock).toHaveBeenCalledWith({
      profile: 'assistant',
      conversationId: 'session-1',
      checkpointId: 'checkpoint-1',
      body: 'Ship it',
      authorName: 'You',
      authorProfile: 'assistant',
    });
    expect(createCheckpointCommentRes.json).toHaveBeenCalledWith({
      conversationId: 'session-1',
      checkpoint: { id: 'checkpoint-1', commentCount: 1, comments: [{ id: 'comment-1', body: 'Ship it' }] },
    });
  });
});
