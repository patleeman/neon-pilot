import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  isLocalLiveMock,
  liveRegistry,
  queuePromptContextMock,
  startParallelPromptSessionMock,
  submitLocalPromptSessionMock,
  syncWebLiveConversationRunMock,
} = vi.hoisted(() => ({
  isLocalLiveMock: vi.fn(),
  liveRegistry: new Map<string, unknown>(),
  queuePromptContextMock: vi.fn(),
  startParallelPromptSessionMock: vi.fn(),
  submitLocalPromptSessionMock: vi.fn(),
  syncWebLiveConversationRunMock: vi.fn(),
}));

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

const extensionHostClient = vi.hoisted(() => ({
  publishEvent: vi.fn(async () => undefined),
  resolvePromptReferences: vi.fn(async () => ({ contextBlocks: [], references: [] })),
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));

const buildUnreadInboxContextMock = vi.hoisted(() => vi.fn());

vi.mock('./inboxContext.js', () => ({
  buildUnreadInboxContext: buildUnreadInboxContextMock,
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
  startParallelPromptSession: startParallelPromptSessionMock,
  submitPromptSession: submitLocalPromptSessionMock,
  takeOverSessionControl: vi.fn(),
  updateLiveSessionModelPreferences: vi.fn(),
}));

import { logError } from '../middleware/index.js';
import { buildPromptContextPlan } from '../prompt-assembly/promptContextInventory.js';
import { buildAttachedConversationContextDocsContext, readConversationContextDocs } from './conversationContextDocs.js';
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
    getStateRoot: () => '/state',
    getDefaultWebCwd: () => '/repo',
    getDesktopRootLayout: () => resolveDesktopRootLayout({ root: '/desktop-root' }),
    buildLiveSessionResourceOptions: () => ({}),
    buildLiveSessionExtensionFactories: () => [],
    flushLiveDeferredResumes: vi.fn(async () => undefined),
    listTasksForRuntimeScope: () => [],
    listMemoryDocs: () => [],
  };
}

const tempDirs: string[] = [];

function createPersonaMemoryRoot(files: Record<string, string>): ReturnType<typeof resolveDesktopRootLayout> {
  const root = mkdtempSync(join(tmpdir(), 'persona-memory-context-'));
  tempDirs.push(root);
  const layout = resolveDesktopRootLayout({ root });
  mkdirSync(layout.agents, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(layout.agents, name), content, 'utf-8');
  }
  return layout;
}

beforeEach(() => {
  vi.useRealTimers();
  liveRegistry.clear();
  isLocalLiveMock.mockReset();
  queuePromptContextMock.mockReset();
  startParallelPromptSessionMock.mockReset();
  submitLocalPromptSessionMock.mockReset();
  syncWebLiveConversationRunMock.mockReset();
  extensionHostClient.publishEvent.mockReset();
  extensionHostClient.publishEvent.mockResolvedValue(undefined);
  extensionHostClient.resolvePromptReferences.mockReset();
  extensionHostClient.resolvePromptReferences.mockResolvedValue({ contextBlocks: [], references: [] });
  syncWebLiveConversationRunMock.mockResolvedValue({ runId: 'run-1' });
  vi.mocked(buildPromptContextPlan).mockReset();
  vi.mocked(buildPromptContextPlan).mockResolvedValue({ contextMessages: [], diagnostics: [] });
  vi.mocked(buildAttachedConversationContextDocsContext).mockReset();
  vi.mocked(buildAttachedConversationContextDocsContext).mockReturnValue('');
  vi.mocked(readConversationContextDocs).mockReset();
  vi.mocked(readConversationContextDocs).mockReturnValue([]);
  submitLocalPromptSessionMock.mockResolvedValue({ acceptedAs: 'started', completion: Promise.resolve() });
  startParallelPromptSessionMock.mockResolvedValue({ jobId: 'job-1', childConversationId: 'child-1' });
  buildUnreadInboxContextMock.mockReset();
  buildUnreadInboxContextMock.mockReturnValue('');
});

afterEach(async () => {
  vi.useRealTimers();
  liveRegistry.clear();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
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
      session: { isStreaming: false, sessionFile: '/sessions/test-session.jsonl' },
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

  it('uses canonical running state for created-session bootstrap streaming flags', async () => {
    liveRegistry.set('test-session', {
      sessionId: 'test-session',
      cwd: '/repo',
      title: 'Finished session',
      session: { isStreaming: true, sessionFile: '/sessions/test-session.jsonl' },
      queuedStaleTurnCustomTypes: [],
      activeStaleTurnCustomType: null,
      lastDurableRunState: 'waiting',
      isCompacting: false,
    } as never);

    const result = await createLiveSessionCapability({}, createContext());

    expect(result.bootstrap?.sessionDetail.meta.isRunning).toBe(false);
    expect(result.bootstrap?.liveSession.isStreaming).toBe(false);
  });

  it('submits the initial prompt when creating a live session with prompt text', async () => {
    isLocalLiveMock.mockReturnValue(true);

    await createLiveSessionCapability({ prompt: 'Help me create an automation.' }, createContext());

    expect(submitLocalPromptSessionMock).toHaveBeenCalledTimes(1);
    expect(submitLocalPromptSessionMock).toHaveBeenCalledWith(
      'test-session',
      'Help me create an automation.',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('submits an initial prompt when creating a live session with only audio and document attachments', async () => {
    isLocalLiveMock.mockReturnValue(true);

    await createLiveSessionCapability(
      {
        audios: [{ path: '/tmp/tone.wav', mimeType: 'audio/wav', name: 'tone.wav', sizeBytes: 456 }],
        documents: [{ path: '/tmp/brief.pdf', mimeType: 'application/pdf', name: 'brief.pdf', sizeBytes: 789 }],
      },
      createContext(),
    );

    expect(submitLocalPromptSessionMock).toHaveBeenCalledWith(
      'test-session',
      '',
      undefined,
      undefined,
      undefined,
      [{ type: 'audio', path: '/tmp/tone.wav', mimeType: 'audio/wav', name: 'tone.wav', sizeBytes: 456 }],
      [{ type: 'document', path: '/tmp/brief.pdf', mimeType: 'application/pdf', name: 'brief.pdf', sizeBytes: 789 }],
      undefined,
    );
  });

  it('preserves the surface id when submitting an initial prompt', async () => {
    isLocalLiveMock.mockReturnValue(true);

    await createLiveSessionCapability({ prompt: 'Hello from workbench.', surfaceId: 'surface-1' }, createContext());

    expect(submitLocalPromptSessionMock).toHaveBeenCalledWith(
      'test-session',
      'Hello from workbench.',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'surface-1',
    );
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

  it('queues attached conversation context docs as referenced context when submitting a prompt', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-context-docs', {
      cwd: '/repo',
      title: 'Session with context docs',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-context-docs.jsonl',
      },
    });
    vi.mocked(readConversationContextDocs).mockReturnValueOnce([
      {
        path: 'README.md',
        title: 'README.md',
        kind: 'file',
        mentionId: '@README.md',
        summary: 'README.md',
      },
    ]);
    vi.mocked(buildAttachedConversationContextDocsContext).mockReturnValueOnce('Attached conversation context docs:\n- README.md');
    vi.mocked(buildPromptContextPlan).mockImplementationOnce(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));

    await submitLiveSessionPromptCapability({ conversationId: 'session-context-docs', text: 'Use the attached context.' }, createContext());

    expect(readConversationContextDocs).toHaveBeenCalledWith('session-context-docs');
    expect(buildAttachedConversationContextDocsContext).toHaveBeenCalledWith([
      {
        path: 'README.md',
        title: 'README.md',
        kind: 'file',
        mentionId: '@README.md',
        summary: 'README.md',
      },
    ]);
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'session-context-docs',
      'referenced_context',
      'Attached conversation context docs:\n- README.md',
    );
  });

  it('queues persona memory context only when explicitly opted in', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-persona-memory', {
      cwd: '/repo',
      title: 'Session with persona memory',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-persona-memory.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    const layout = createPersonaMemoryRoot({
      'preferences.md': '# Preferences\n\nLikes concise implementation notes.',
      'AGENTS.md': '# Soul\n\nShared instructions are loaded elsewhere.',
    });

    await submitLiveSessionPromptCapability(
      { conversationId: 'session-persona-memory', text: 'hello', includePersonaMemory: true },
      { ...createContext(), getDesktopRootLayout: () => layout },
    );

    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'session-persona-memory',
      'referenced_context',
      expect.stringContaining('Persona memory:'),
    );
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'session-persona-memory',
      'referenced_context',
      expect.stringContaining('Likes concise implementation notes.'),
    );
    expect(queuePromptContextMock).not.toHaveBeenCalledWith(
      'session-persona-memory',
      'referenced_context',
      expect.stringContaining('Shared instructions are loaded elsewhere.'),
    );
  });

  it('does not read persona memory for default capability callers', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-worker-default', {
      cwd: '/repo',
      title: 'Worker session',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-worker-default.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    const layout = createPersonaMemoryRoot({
      'preferences.md': '# Preferences\n\nThis should not be loaded.',
    });

    await submitLiveSessionPromptCapability(
      { conversationId: 'session-worker-default', text: 'hello' },
      { ...createContext(), getDesktopRootLayout: () => layout },
    );

    expect(queuePromptContextMock).not.toHaveBeenCalled();
  });

  it('queues unread inbox context only when explicitly opted in', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-inbox-optin', {
      cwd: '/repo',
      title: 'Session with inbox context',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-inbox-optin.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    buildUnreadInboxContextMock.mockReturnValue('Mocked unread inbox context:\n- Subject: Build complete');

    await submitLiveSessionPromptCapability(
      { conversationId: 'session-inbox-optin', text: 'hello', includeUnreadInbox: true },
      createContext(),
    );

    expect(buildUnreadInboxContextMock).toHaveBeenCalledTimes(1);
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'session-inbox-optin',
      'referenced_context',
      expect.stringContaining('Mocked unread inbox context'),
    );
  });

  it('does not queue unread inbox context for default capability callers', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-inbox-default', {
      cwd: '/repo',
      title: 'Session without inbox context',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-inbox-default.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    buildUnreadInboxContextMock.mockReturnValue('Should not appear');

    await submitLiveSessionPromptCapability({ conversationId: 'session-inbox-default', text: 'hello' }, createContext());

    expect(buildUnreadInboxContextMock).not.toHaveBeenCalled();
  });

  it('does not honor smuggled unread inbox flags on parallel prompts', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-inbox-parallel', {
      cwd: '/repo',
      title: 'Parallel worker session',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-inbox-parallel.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    buildUnreadInboxContextMock.mockReturnValue('Should not reach worker');
    const { submitLiveSessionParallelPromptCapability } = await import('./liveSessionCapability.js');

    await submitLiveSessionParallelPromptCapability(
      { conversationId: 'session-inbox-parallel', text: 'run a parallel attempt', includeUnreadInbox: true } as never,
      createContext(),
    );

    expect(buildUnreadInboxContextMock).not.toHaveBeenCalled();
  });

  it('does not honor smuggled persona memory flags on parallel prompts', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-parallel-worker', {
      cwd: '/repo',
      title: 'Parallel worker session',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-parallel-worker.jsonl',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementation(async (input) => ({
      contextMessages: input.contextMessages,
      diagnostics: [],
    }));
    const layout = createPersonaMemoryRoot({
      'preferences.md': '# Preferences\n\nThis should not reach worker context.',
    });
    const { submitLiveSessionParallelPromptCapability } = await import('./liveSessionCapability.js');

    await submitLiveSessionParallelPromptCapability(
      { conversationId: 'session-parallel-worker', text: 'run a parallel attempt', includePersonaMemory: true } as never,
      { ...createContext(), getDesktopRootLayout: () => layout },
    );

    expect(queuePromptContextMock).not.toHaveBeenCalled();
  });

  it('publishes replayable media and context with prompt-submitted events', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-replay', {
      cwd: '/repo',
      title: 'Session with media',
      session: {
        isStreaming: false,
        sessionFile: '/sessions/session-replay.jsonl',
        model: { id: 'gpt-5', provider: 'openai' },
        thinkingLevel: 'high',
        serviceTier: 'priority',
      },
    });
    vi.mocked(buildPromptContextPlan).mockImplementationOnce(async (input) => ({
      contextMessages: [...input.contextMessages, { customType: 'related_context', content: 'Related thread summary' }],
      diagnostics: [],
    }));

    await submitLiveSessionPromptCapability(
      {
        conversationId: 'session-replay',
        text: 'Describe this screenshot and video',
        images: [{ data: 'aW1n', mimeType: 'image/png', name: 'shot.png' }],
        videos: [{ path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 42 }],
        audios: [{ path: '/tmp/tone.wav', mimeType: 'audio/wav', name: 'tone.wav', sizeBytes: 456 }],
        documents: [{ path: '/tmp/brief.pdf', mimeType: 'application/pdf', name: 'brief.pdf', sizeBytes: 789 }],
        attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
        contextMessages: [{ customType: 'manual_context', content: 'Pinned context' }],
        relatedConversationIds: ['related-1'],
        surfaceId: 'chat',
      },
      createContext(),
    );

    expect(extensionHostClient.publishEvent).toHaveBeenCalledWith(
      'conversationPrompt',
      expect.objectContaining({
        type: 'submitted',
        conversationId: 'session-replay',
        prompt: 'Describe this screenshot and video',
        delivery: 'started',
        imageCount: 1,
        videoCount: 1,
        audioCount: 1,
        documentCount: 1,
        images: [{ type: 'image', data: 'aW1n', mimeType: 'image/png', name: 'shot.png' }],
        videos: [{ type: 'video', path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 42 }],
        audios: [{ type: 'audio', path: '/tmp/tone.wav', mimeType: 'audio/wav', name: 'tone.wav', sizeBytes: 456 }],
        documents: [{ type: 'document', path: '/tmp/brief.pdf', mimeType: 'application/pdf', name: 'brief.pdf', sizeBytes: 789 }],
        attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
        contextMessageCount: 2,
        contextMessages: [
          { customType: 'manual_context', content: 'Pinned context' },
          { customType: 'related_context', content: 'Related thread summary' },
        ],
        relatedConversationCount: 1,
        currentModel: 'gpt-5',
        currentProvider: 'openai',
        thinkingLevel: 'high',
      }),
    );
  });

  it('logs live prompt failures without stack traces or local provider doc paths', async () => {
    isLocalLiveMock.mockReturnValue(true);
    liveRegistry.set('session-no-key', {
      cwd: '/repo',
      title: 'Session without key',
      session: {
        isStreaming: true,
        sessionFile: '/sessions/session-no-key.jsonl',
      },
    });
    submitLocalPromptSessionMock.mockResolvedValueOnce({
      acceptedAs: 'started',
      completion: Promise.reject(
        new Error(
          [
            'No API key found for the selected model.',
            '',
            'Use /login to log into a provider via OAuth or API key. See:',
            '  /Users/patrick/workingdir/neon-pilot/node_modules/provider/docs/providers.md',
          ].join('\n'),
        ),
      ),
    });

    await submitLiveSessionPromptCapability({ conversationId: 'session-no-key', text: 'hello' }, createContext());
    await new Promise((resolve) => setImmediate(resolve));

    expect(logError).toHaveBeenCalledWith('live prompt error', {
      sessionId: 'session-no-key',
      message: 'No API key found for the selected model. Configure a provider in Neon Pilot, then try again.',
    });
  });
});
