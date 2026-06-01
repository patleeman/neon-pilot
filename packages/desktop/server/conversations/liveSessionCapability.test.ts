import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isLocalLiveMock, liveRegistry, queuePromptContextMock, submitLocalPromptSessionMock, syncWebLiveConversationRunMock } = vi.hoisted(
  () => ({
    isLocalLiveMock: vi.fn(),
    liveRegistry: new Map<string, unknown>(),
    queuePromptContextMock: vi.fn(),
    submitLocalPromptSessionMock: vi.fn(),
    syncWebLiveConversationRunMock: vi.fn(),
  }),
);

vi.mock('@neon-pilot/daemon', () => ({
  listPendingBackgroundRunResults: vi.fn(() => []),
  loadDaemonConfig: vi.fn(() => ({ ipc: { socketPath: '/tmp/daemon.sock' } })),
  markBackgroundRunResultsDelivered: vi.fn(() => []),
  resolveDaemonPaths: vi.fn(() => ({ root: '/tmp/daemon' })),
  resolveDurableRunsRoot: vi.fn(() => '/tmp/daemon/runs'),
}));

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neon-pilot/core')>();
  return {
    ...actual,
    resolveConversationAttachmentPromptFiles: vi.fn(() => []),
  };
});

vi.mock('../extensions/extensionRegistry.js', () => ({
  withExtensionRegistryReadCache: (callback: () => unknown) => callback(),
}));

const extensionHostClient = vi.hoisted(() => ({
  resolvePromptReferences: vi.fn(async () => ({ contextBlocks: [], references: [] })),
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));

vi.mock('../knowledge/promptReferences.js', () => ({
  buildReferencedMemoryDocsContext: vi.fn(() => ''),
  buildReferencedTasksContext: vi.fn(() => ''),
  expandPromptReferencesWithNodeGraph: vi.fn((_taskIds, memoryDocIds) => ({ memoryDocIds })),
  extractMentionIds: vi.fn(() => ({ taskIds: [], memoryDocIds: [] })),
  pickPromptReferencesInOrder: vi.fn(() => []),
  resolvePromptReferences: vi.fn(() => ({ taskIds: [], memoryDocIds: [] })),
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../prompt-assembly/promptContextInventory.js', () => ({
  buildPromptContextPlan: vi.fn(async () => ({ contextMessages: [], diagnostics: [] })),
}));

vi.mock('../routes/context.js', () => ({
  LIVE_SESSION_RESOURCE_OPTIONS_PERF: Symbol('LIVE_SESSION_RESOURCE_OPTIONS_PERF'),
}));

vi.mock('../traces/appTelemetry.js', () => ({
  persistAppTelemetryEvent: vi.fn(),
}));

vi.mock('./conversationContextDocs.js', () => ({
  buildAttachedConversationContextDocsContext: vi.fn(() => ''),
  readConversationContextDocs: vi.fn(() => []),
}));

vi.mock('./conversationCwd.js', () => ({
  resolveConversationCwd: vi.fn(() => '/repo'),
  resolveNeutralChatCwd: vi.fn(() => '/repo'),
}));

vi.mock('./conversationRuns.js', () => ({
  syncWebLiveConversationRun: syncWebLiveConversationRunMock,
}));

vi.mock('./conversationService.js', () => ({
  appendConversationWorkspaceMetadata: vi.fn(),
  readConversationSessionMeta: vi.fn(() => null),
  resolveConversationSessionFile: vi.fn(() => undefined),
}));

vi.mock('./conversationSummaries.js', () => ({
  queueConversationSummaryRefresh: vi.fn(),
}));

vi.mock('./liveSessions.js', () => ({
  abortSession: vi.fn(),
  branchSession: vi.fn(),
  clearQueuedPrompts: vi.fn(),
  compactSession: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn(),
  forkSession: vi.fn(),
  isLive: isLocalLiveMock,
  manageParallelPromptJob: vi.fn(),
  prewarmLiveSessionLoader: vi.fn(),
  queuePromptContext: queuePromptContextMock,
  registry: liveRegistry,
  reloadSessionResources: vi.fn(),
  restoreQueuedMessage: vi.fn(),
  resumeSession: vi.fn(),
  startParallelPromptSession: vi.fn(),
  submitPromptSession: submitLocalPromptSessionMock,
  takeOverSessionControl: vi.fn(),
  updateLiveSessionModelPreferences: vi.fn(),
}));

import { appendConversationWorkspaceMetadata } from './conversationService.js';
import {
  createLiveSessionCapability,
  restoreQueuedLiveSessionMessageCapability,
  submitLiveSessionPromptCapability,
} from './liveSessionCapability.js';
import { createSession, resumeSession } from './liveSessions.js';

function createContext() {
  return {
    getRuntimeScope: () => 'assistant',
    getRepoRoot: () => '/repo',
    getDefaultWebCwd: () => '/repo',
    buildLiveSessionResourceOptions: () => ({}),
    buildLiveSessionExtensionFactories: () => [],
    flushLiveDeferredResumes: vi.fn(async () => undefined),
    listTasksForRuntimeScope: () => [],
    listMemoryDocs: () => [],
  };
}

beforeEach(() => {
  vi.useRealTimers();
  liveRegistry.clear();
  isLocalLiveMock.mockReset();
  queuePromptContextMock.mockReset();
  submitLocalPromptSessionMock.mockReset();
  syncWebLiveConversationRunMock.mockReset();
  extensionHostClient.resolvePromptReferences.mockReset();
  extensionHostClient.resolvePromptReferences.mockResolvedValue({ contextBlocks: [], references: [] });
  syncWebLiveConversationRunMock.mockResolvedValue({ runId: 'run-1' });
  submitLocalPromptSessionMock.mockResolvedValue({ acceptedAs: 'started', completion: Promise.resolve() });
});

afterEach(() => {
  vi.useRealTimers();
  liveRegistry.clear();
});

describe('createLiveSessionCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSession).mockResolvedValue({
      id: 'test-session',
      sessionFile: '/sessions/test-session.jsonl',
      perf: {},
    });
    vi.mocked(resumeSession).mockResolvedValue({
      id: 'test-session',
      perf: {},
    });
    liveRegistry.set('test-session', {
      sessionId: 'test-session',
      cwd: '/repo',
      title: '',
      session: { isStreaming: false },
      listeners: new Set(),
      lastContextUsage: undefined,
      lastContextUsageJson: null,
      lastContextUsageMessageCount: undefined,
      lastQueueState: undefined,
      lastQueueStateJson: null,
      lastParallelState: undefined,
      lastParallelStateJson: null,
      currentTurnError: null,
      tracePersistedTokens: undefined,
      queuedStaleTurnCustomTypes: [],
      activeStaleTurnCustomType: null,
      pendingAutoCompactionReason: null,
      lastCompactionSummaryTitle: null,
      isCompacting: false,
      running: false,
      parallelJobs: [],
      importingParallelJobs: false,
      lifecycleHandlers: [],
      presence: {},
    } as never);
  });

  it('appends workspace metadata with explicit cwd when creating from a workspace', async () => {
    const result = await createLiveSessionCapability({ cwd: '/my-workspace' }, createContext());

    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledTimes(1);
    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        workspaceCwd: '/repo',
      }),
    );
    expect(result.id).toBe('test-session');
    expect(result.sessionFile).toBe('/sessions/test-session.jsonl');
    expect(result.bootstrap).toBeDefined();
  });

  it('appends workspace metadata with null when no explicit cwd (neutral chat)', async () => {
    await createLiveSessionCapability({}, createContext());

    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledTimes(1);
    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceCwd: null,
      }),
    );
  });

  it('passes through explicit workspaceCwd when provided', async () => {
    await createLiveSessionCapability({ cwd: '/my-workspace', workspaceCwd: '/other-workspace' }, createContext());

    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        workspaceCwd: '/other-workspace',
      }),
    );
  });

  it('includes workspaceCwd in the bootstrap sessionDetail.meta', async () => {
    const result = await createLiveSessionCapability({ cwd: '/my-workspace' }, createContext());

    expect(result.bootstrap).toBeDefined();
    expect(result.bootstrap?.sessionDetail?.meta).toBeDefined();
    expect(result.bootstrap?.sessionDetail?.meta?.workspaceCwd).toBe('/repo');
  });

  it('includes workspaceCwd as null in the bootstrap for neutral chat', async () => {
    const result = await createLiveSessionCapability({}, createContext());

    expect(result.bootstrap?.sessionDetail?.meta?.workspaceCwd).toBeNull();
  });

  it('calls appendConversationWorkspaceMetadata in the reserved flow', async () => {
    await createLiveSessionCapability({ cwd: '/my-workspace', reservedSessionFile: '/sessions/reserved.jsonl' }, createContext());

    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledTimes(1);
    expect(appendConversationWorkspaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionFile: '/sessions/reserved.jsonl',
        cwd: '/repo',
        workspaceCwd: '/repo',
      }),
    );
  });
});

describe('liveSessionCapability input validation', () => {
  it('rejects unsafe queued restore indexes before reading session state', async () => {
    await expect(
      restoreQueuedLiveSessionMessageCapability({
        conversationId: 'session-1',
        behavior: 'steer',
        index: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow('index must be a non-negative integer');
  });

  it('cancels delayed prompt running-state sync after a fast prompt completes', async () => {
    vi.useFakeTimers();
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-1', {
      cwd: '/repo',
      title: 'Session 1',
      session: {
        isStreaming: true,
        sessionFile: '/sessions/session-1.jsonl',
      },
    });

    await submitLiveSessionPromptCapability({ conversationId: 'session-1', text: 'hello' }, createContext());
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(syncWebLiveConversationRunMock).not.toHaveBeenCalled();
  });

  it('keeps delayed prompt running-state sync for prompts that are still streaming', async () => {
    vi.useFakeTimers();
    isLocalLiveMock.mockReturnValue(true);
    submitLocalPromptSessionMock.mockResolvedValueOnce({ acceptedAs: 'started', completion: new Promise(() => undefined) });
    liveRegistry.set('session-1', {
      cwd: '/repo',
      title: 'Session 1',
      session: {
        isStreaming: true,
        sessionFile: '/sessions/session-1.jsonl',
      },
    });

    await submitLiveSessionPromptCapability({ conversationId: 'session-1', text: 'hello' }, createContext());
    await vi.advanceTimersByTimeAsync(5_000);

    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'session-1',
        state: 'running',
        pendingOperation: expect.objectContaining({ type: 'prompt', text: 'hello' }),
      }),
    );
  });
});
