import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionsCapability = vi.hoisted(() => ({ readConversationSessionsCapability: vi.fn() }));
const broadcasts = vi.hoisted(() => ({ broadcastTitle: vi.fn() }));
const reservation = vi.hoisted(() => ({ reserveConversationSession: vi.fn() }));
const liveSessionCapability = vi.hoisted(() => ({
  manageLiveSessionParallelJobCapability: vi.fn(),
  submitLiveSessionParallelPromptCapability: vi.fn(),
  submitLiveSessionPromptCapability: vi.fn(),
}));
const conversationService = vi.hoisted(() => ({
  appendStoredVisibleCustomMessage: vi.fn(),
  publishConversationSessionMetaChanged: vi.fn(),
  renameStoredConversation: vi.fn(),
  resolveConversationSessionFile: vi.fn(),
  updateStoredVisibleCustomMessage: vi.fn(),
}));
const live = vi.hoisted(() => ({
  registry: new Map<string, unknown>(),
  abortSession: vi.fn(),
  appendVisibleCustomMessage: vi.fn(),
  createSession: vi.fn(),
  createSessionFromExisting: vi.fn(),
  destroySession: vi.fn((conversationId: string) => {
    live.registry.delete(conversationId);
  }),
  forkSession: vi.fn(),
  requestConversationWorkingDirectoryChange: vi.fn(),
  resumeSession: vi.fn(),
  subscribe: vi.fn(),
  updateVisibleCustomMessage: vi.fn(),
}));
const extensionRegistry = vi.hoisted(() => ({
  findExtensionEntry: vi.fn(() => ({
    manifest: {
      permissions: ['conversations:readwrite'],
      contributes: { transcriptBlocks: [{ id: 'welcome', component: 'WelcomeBlock' }] },
    },
  })),
}));
const sessions = vi.hoisted(() => ({
  deleteSessions: vi.fn(),
  pruneSessionsByRetention: vi.fn(),
  readSessionMeta: vi.fn(),
}));
const conversationRunCleanup = vi.hoisted(() => ({
  cleanupDeletedConversationRuntime: vi.fn(),
}));
const titles = vi.hoisted(() => ({
  resolveStableSessionTitle: vi.fn((session: { name?: string }) => session.name ?? 'Stable Title'),
}));
const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn(), publishAppEvent: vi.fn() }));
const metadata = vi.hoisted(() => ({
  queryConversationMetadata: vi.fn(),
  readConversationMetadata: vi.fn(),
  writeConversationMetadata: vi.fn(),
}));
const subscriptions = vi.hoisted(() => ({ publishExtensionHostEvent: vi.fn() }));
const runtimeHooks = vi.hoisted(() => ({
  buildLiveSessionExtensionFactoriesForRuntime: vi.fn(() => ['factory']),
  buildLiveSessionResourceOptionsForRuntime: vi.fn(() => ({ resources: true })),
}));
const uiPreferences = vi.hoisted(() => ({
  saved: {
    openConversationIds: ['existing-open'],
    pinnedConversationIds: ['existing-pinned'],
    archivedConversationIds: ['existing-archived'],
    activeConversationId: 'existing-open',
    workspacePaths: [],
    remoteControlledConversationIds: [],
  },
  readSavedUiPreferences: vi.fn(() => uiPreferences.saved),
  writeSavedUiPreferences: vi.fn((patch: Record<string, unknown>) => {
    uiPreferences.saved = { ...uiPreferences.saved, ...patch } as typeof uiPreferences.saved;
    return uiPreferences.saved;
  }),
}));
const settingsPersistence = vi.hoisted(() => ({
  persistSettingsWrite: vi.fn((writer: (settingsFile: string) => unknown) => writer('/settings.json')),
}));

vi.mock('../conversations/conversationSessionCapability.js', () => sessionsCapability);
vi.mock('../conversations/liveSessionBroadcasts.js', () => broadcasts);
vi.mock('../conversations/conversationReservation.js', () => reservation);
vi.mock('../conversations/liveSessionCapability.js', () => liveSessionCapability);
vi.mock('../conversations/conversationService.js', () => conversationService);
vi.mock('../conversations/conversationRunCleanup.js', () => conversationRunCleanup);
vi.mock('../conversations/liveSessions.js', () => live);
vi.mock('../conversations/sessions.js', () => sessions);
vi.mock('./extensionRegistry.js', () => extensionRegistry);
vi.mock('../conversations/liveSessionTitle.js', () => titles);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('./extensionConversationMetadata.js', () => metadata);
vi.mock('./extensionSubscriptions.js', () => subscriptions);
vi.mock('./runtimeAgentHooks.js', () => runtimeHooks);
vi.mock('../ui/uiPreferences.js', () => uiPreferences);
vi.mock('../ui/settingsPersistence.js', () => settingsPersistence);

import { createExtensionConversationsCapability } from './extensionConversations.js';

function liveEntry(overrides: Record<string, unknown> = {}) {
  const session = {
    name: 'Conversation One',
    isStreaming: false,
    model: { id: 'model-1', provider: 'provider-1' },
    getSessionStats: vi.fn(() => ({ turns: 2 })),
    getActiveToolNames: vi.fn(() => ['bash']),
    prompt: vi.fn(),
    followUp: vi.fn(),
    steer: vi.fn(),
    setSessionName: vi.fn(),
    compact: vi.fn(),
    sessionManager: {
      getSessionFile: vi.fn(() => '/session.json'),
      getLeafId: vi.fn(() => 'leaf'),
      getBranch: vi.fn(() => [
        { id: 'root', type: 'message', parentId: null, message: { role: 'system' } },
        { id: 'user-1', type: 'message', parentId: 'root', message: { role: 'user' } },
        { id: 'assistant-1', type: 'message', parentId: 'user-1', message: { role: 'assistant' } },
      ]),
      branch: vi.fn(),
    },
  };
  return { cwd: '/repo', title: 'Conversation One', session, ...overrides };
}

describe('extensionConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    live.registry.clear();
    live.destroySession.mockImplementation((conversationId: string) => {
      live.registry.delete(conversationId);
    });
    sessions.deleteSessions.mockReturnValue({ deleted: [], missing: [] });
    sessions.readSessionMeta.mockReturnValue(null);
    sessions.pruneSessionsByRetention.mockReturnValue({
      ok: true,
      dryRun: true,
      cutoff: '2026-06-01T00:00:00.000Z',
      candidates: [],
      deleted: [],
      skipped: 0,
    });
    conversationRunCleanup.cleanupDeletedConversationRuntime.mockResolvedValue({
      deletedRunIds: [],
      cancelledRunIds: [],
      removedAttentionEventIds: [],
      failedCancellationRunIds: [],
    });
    liveSessionCapability.submitLiveSessionPromptCapability.mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });
    liveSessionCapability.submitLiveSessionParallelPromptCapability.mockResolvedValue({
      ok: true,
      accepted: true,
      jobId: 'job-1',
      childConversationId: 'child-1',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });
    liveSessionCapability.manageLiveSessionParallelJobCapability.mockResolvedValue({ ok: true, status: 'skipped' });
    live.forkSession.mockResolvedValue({ newSessionId: 'forked-from-entry', sessionFile: '/sessions/forked-from-entry.jsonl' });
    reservation.reserveConversationSession.mockReturnValue({ id: 'reserved-1', sessionFile: '/sessions/reserved-1.jsonl', cwd: '/repo' });
    conversationService.resolveConversationSessionFile.mockReturnValue('/sessions/persisted.jsonl');
    conversationService.appendStoredVisibleCustomMessage.mockReturnValue('block-1');
    conversationService.updateStoredVisibleCustomMessage.mockReturnValue(true);
    conversationService.renameStoredConversation.mockReturnValue({ id: 'stored-1', title: 'Stored Title' });
    extensionRegistry.findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['conversations:readwrite'],
        contributes: { transcriptBlocks: [{ id: 'welcome', component: 'WelcomeBlock' }] },
      },
    });
    uiPreferences.saved = {
      openConversationIds: ['existing-open'],
      pinnedConversationIds: ['existing-pinned'],
      archivedConversationIds: ['existing-archived'],
      lockedConversationIds: [],
      activeConversationId: 'existing-open',
      workspacePaths: [],
      remoteControlledConversationIds: [],
    };
  });

  it('lists conversations and returns live conversation details', async () => {
    sessionsCapability.readConversationSessionsCapability.mockReturnValue([{ id: 'conv-1' }]);
    live.registry.set('conv-1', liveEntry());
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.list()).resolves.toEqual([{ id: 'conv-1' }]);
    await expect(capability.get('conv-1')).resolves.toEqual({
      id: 'conv-1',
      title: 'Conversation One',
      cwd: '/repo',
      running: false,
      currentModel: 'model-1',
      currentProvider: 'provider-1',
      stats: { turns: 2 },
      toolNames: ['bash'],
    });
  });

  it('creates a conversation, applies title and initial prompt, invalidates, and emits host event', async () => {
    live.createSession.mockResolvedValue({ id: 'conv-1' });
    const entry = liveEntry();
    live.registry.set('conv-1', entry);

    const result = await createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }).create({
      cwd: '/repo',
      title: 'Created Title',
      prompt: 'Start here',
      model: 'model-2',
      allowedToolNames: ['bash'],
    });

    expect(live.createSession).toHaveBeenCalledWith('/repo', { initialModel: 'model-2', allowedToolNames: ['bash'] });
    expect(entry.session.setSessionName).toHaveBeenCalledWith('Created Title');
    expect(entry.session.prompt).toHaveBeenCalledWith('Start here');
    expect(entry.session.followUp).not.toHaveBeenCalled();
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({ type: 'open_session', sessionId: 'conv-1' });
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.created',
      conversationId: 'conv-1',
      cwd: '/repo',
    });
    expect(result).toEqual({ id: 'conv-1', conversationId: 'conv-1' });
  });

  it('adds conversations created through extensions to the persisted workspace so sidebars refresh', async () => {
    live.createSession.mockResolvedValue({ id: 'conv-created' });
    live.registry.set('conv-created', liveEntry());

    await expect(
      createExtensionConversationsCapability({ getRuntimeScope: () => 'shared', getSettingsFile: () => '/settings.json' }).create({
        cwd: '/repo',
      }),
    ).resolves.toEqual({ id: 'conv-created', conversationId: 'conv-created' });

    expect(uiPreferences.writeSavedUiPreferences).toHaveBeenCalledWith(
      { openConversationIds: ['existing-open', 'conv-created'] },
      '/settings.json',
    );
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.workspace.updated',
      openConversationIds: ['existing-open', 'conv-created'],
      pinnedConversationIds: ['existing-pinned'],
      archivedConversationIds: ['existing-archived'],
      activeConversationId: 'existing-open',
    });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({ type: 'open_session', sessionId: 'conv-created' });
  });

  it('does not reopen created conversations that are already archived in the workspace', async () => {
    live.createSession.mockResolvedValue({ id: 'existing-archived' });
    live.registry.set('existing-archived', liveEntry());

    await createExtensionConversationsCapability({ getRuntimeScope: () => 'shared', getSettingsFile: () => '/settings.json' }).create({
      cwd: '/repo',
    });

    expect(uiPreferences.writeSavedUiPreferences).not.toHaveBeenCalled();
  });

  it('destroys live conversations before deleting session files and removes workspace references', async () => {
    uiPreferences.saved = {
      openConversationIds: ['live-delete', 'keep-open'],
      pinnedConversationIds: ['live-delete', 'keep-pinned'],
      archivedConversationIds: ['live-delete', 'keep-archived'],
      lockedConversationIds: ['live-delete', 'keep-locked'],
      activeConversationId: 'live-delete',
      workspacePaths: ['/repo'],
      remoteControlledConversationIds: ['live-delete', 'keep-remote'],
    };
    live.registry.set('live-delete', liveEntry());
    sessions.readSessionMeta.mockReturnValue({ id: 'live-delete', file: '/sessions/live-delete.jsonl' });
    sessions.deleteSessions.mockReturnValue({
      deleted: [{ id: 'live-delete', file: '/sessions/live-delete.jsonl' }],
      missing: [],
    });

    await expect(
      createExtensionConversationsCapability({ getRuntimeScope: () => 'shared', getSettingsFile: () => '/settings.json' }).delete({
        conversationIds: ['live-delete'],
      }),
    ).resolves.toEqual({
      ok: true,
      deleted: [{ id: 'live-delete', file: '/sessions/live-delete.jsonl' }],
      missing: [],
    });

    expect(live.destroySession).toHaveBeenCalledWith('live-delete');
    expect(live.destroySession.mock.invocationCallOrder[0]).toBeLessThan(sessions.deleteSessions.mock.invocationCallOrder[0] ?? 0);
    expect(conversationRunCleanup.cleanupDeletedConversationRuntime).toHaveBeenCalledWith([
      { id: 'live-delete', sessionFile: '/sessions/live-delete.jsonl' },
    ]);
    expect(conversationRunCleanup.cleanupDeletedConversationRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      sessions.deleteSessions.mock.invocationCallOrder[0] ?? 0,
    );
    expect(uiPreferences.writeSavedUiPreferences).toHaveBeenCalledWith(
      {
        openConversationIds: ['keep-open'],
        pinnedConversationIds: ['keep-pinned'],
        archivedConversationIds: ['keep-archived'],
        lockedConversationIds: ['keep-locked'],
        activeConversationId: null,
        remoteControlledConversationIds: ['keep-remote'],
      },
      '/settings.json',
    );
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'conversation_workspace_changed',
        sessionIds: ['keep-open'],
        pinnedSessionIds: ['keep-pinned'],
        archivedSessionIds: ['keep-archived'],
        activeConversationId: null,
      }),
    );
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.deleted',
      conversationIds: ['live-delete'],
    });
  });

  it('destroys live prune candidates before deleting them', async () => {
    uiPreferences.saved = {
      openConversationIds: [],
      pinnedConversationIds: [],
      archivedConversationIds: ['live-old', 'keep-archived'],
      lockedConversationIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
    };
    live.registry.set('live-old', liveEntry());
    sessions.pruneSessionsByRetention.mockReturnValue({
      ok: true,
      dryRun: true,
      cutoff: '2026-06-01T00:00:00.000Z',
      candidates: [{ id: 'live-old', file: '/sessions/live-old.jsonl', timestamp: '2026-05-01T00:00:00.000Z' }],
      deleted: [],
      skipped: 1,
    });
    sessions.deleteSessions.mockReturnValue({
      deleted: [{ id: 'live-old', file: '/sessions/live-old.jsonl' }],
      missing: [],
    });

    await expect(
      createExtensionConversationsCapability({ getRuntimeScope: () => 'shared', getSettingsFile: () => '/settings.json' }).prune({
        olderThanMs: 30 * 24 * 60 * 60 * 1000,
        archivedOnly: true,
        dryRun: false,
      }),
    ).resolves.toEqual({
      ok: true,
      dryRun: false,
      cutoff: '2026-06-01T00:00:00.000Z',
      candidates: [{ id: 'live-old', file: '/sessions/live-old.jsonl', timestamp: '2026-05-01T00:00:00.000Z' }],
      deleted: [{ id: 'live-old', file: '/sessions/live-old.jsonl' }],
      skipped: 1,
    });

    expect(sessions.pruneSessionsByRetention).toHaveBeenCalledWith({
      olderThanMs: 30 * 24 * 60 * 60 * 1000,
      archivedOnly: true,
      dryRun: true,
      archivedConversationIds: ['live-old', 'keep-archived'],
    });
    expect(live.destroySession).toHaveBeenCalledWith('live-old');
    expect(live.destroySession.mock.invocationCallOrder[0]).toBeLessThan(sessions.deleteSessions.mock.invocationCallOrder[0] ?? 0);
    expect(conversationRunCleanup.cleanupDeletedConversationRuntime).toHaveBeenCalledWith([
      { id: 'live-old', sessionFile: '/sessions/live-old.jsonl' },
    ]);
    expect(conversationRunCleanup.cleanupDeletedConversationRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      sessions.deleteSessions.mock.invocationCallOrder[0] ?? 0,
    );
    expect(uiPreferences.writeSavedUiPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedConversationIds: ['keep-archived'],
      }),
      '/settings.json',
    );
  });

  it('creates non-live conversations without starting an agent session and can append persisted transcript blocks', async () => {
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.create({ cwd: '/repo', title: 'Welcome', live: false })).resolves.toEqual({
      id: 'reserved-1',
      conversationId: 'reserved-1',
    });
    conversationService.resolveConversationSessionFile.mockReturnValue(undefined);
    await expect(
      capability.appendTranscriptBlock({
        conversationId: 'reserved-1',
        blockType: 'welcome',
        title: 'Hello',
        data: { ok: true },
      }),
    ).resolves.toEqual({ blockId: 'block-1' });

    expect(live.createSession).not.toHaveBeenCalled();
    expect(reservation.reserveConversationSession).toHaveBeenCalledWith({ cwd: '/repo', profile: 'shared' });
    expect(conversationService.renameStoredConversation).toHaveBeenCalledWith('reserved-1', 'Welcome');
    expect(conversationService.appendStoredVisibleCustomMessage).toHaveBeenCalledWith({
      sessionFile: '/sessions/reserved-1.jsonl',
      customType: 'welcome',
      content: 'Hello',
      details: { ok: true, ownerExtensionId: 'extension' },
      blockId: undefined,
      display: true,
    });
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.created',
      conversationId: 'reserved-1',
      cwd: '/repo',
    });
  });

  it('updates persisted transcript blocks and stamps the owning extension', async () => {
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }, 'arena-ext', {
      enforceManifestPermissions: true,
    });

    await expect(
      capability.updateTranscriptBlock({
        conversationId: 'stored-1',
        blockType: 'welcome',
        title: 'Updated',
        blockId: 'block-1',
        data: { ok: true },
      }),
    ).resolves.toEqual({ blockId: 'block-1' });

    expect(conversationService.updateStoredVisibleCustomMessage).toHaveBeenCalledWith({
      sessionFile: '/sessions/persisted.jsonl',
      customType: 'welcome',
      content: 'Updated',
      details: { ok: true, ownerExtensionId: 'arena-ext' },
      blockId: 'block-1',
    });
  });

  it('rejects transcript blocks the extension does not contribute', async () => {
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }, 'arena-ext', {
      enforceManifestPermissions: true,
    });

    await expect(
      capability.appendTranscriptBlock({
        conversationId: 'stored-1',
        blockType: 'model_arena_duel',
        data: {},
      }),
    ).rejects.toThrow('requires arena-ext to contribute transcript block "model_arena_duel"');
  });

  it('passes the extension owner through parallel job management', async () => {
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }, 'arena-ext');

    await expect(capability.manageParallelJob({ conversationId: 'conv-1', jobId: 'job-1', action: 'skip' })).resolves.toEqual({
      ok: true,
      status: 'skipped',
    });

    expect(liveSessionCapability.manageLiveSessionParallelJobCapability).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      jobId: 'job-1',
      action: 'skip',
      callerExtensionId: 'arena-ext',
    });
  });

  it('sends prompts through the shared live session prompt capability', async () => {
    const entry = liveEntry();
    live.registry.set('conv-1', entry);
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.sendMessage('conv-1', 'hello')).resolves.toEqual({ accepted: true, delivery: 'started' });
    expect(liveSessionCapability.submitLiveSessionPromptCapability).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        text: 'hello',
        behavior: undefined,
        injectedTurn: expect.objectContaining({ source: { type: 'extension', id: 'extension' } }),
      }),
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(entry.session.prompt).not.toHaveBeenCalled();

    liveSessionCapability.submitLiveSessionPromptCapability.mockResolvedValueOnce({
      ok: true,
      accepted: true,
      delivery: 'queued',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });
    await expect(capability.sendMessage('conv-1', 'now', { steer: true })).resolves.toEqual({ accepted: true, delivery: 'queued' });
    expect(liveSessionCapability.submitLiveSessionPromptCapability).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        text: 'now',
        behavior: 'steer',
        injectedTurn: expect.objectContaining({ source: { type: 'extension', id: 'extension' } }),
      }),
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(entry.session.steer).not.toHaveBeenCalled();
  });

  it('forwards multimodal and context fields through the parallel prompt capability', async () => {
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }, 'arena-ext');

    await expect(
      capability.startParallelPrompt('conv-1', {
        text: 'Compare this screenshot',
        images: [{ data: 'png-bytes', mimeType: 'image/png', name: 'shot.png' }],
        videos: [{ path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 123 }],
        attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
        contextMessages: [{ customType: 'note', content: 'extra context' }],
        relatedConversationIds: ['related-1'],
        surfaceId: 'chat',
        model: 'provider/model',
        thinkingLevel: 'high',
        serviceTier: 'priority',
        purpose: 'model_arena_duel',
        metadata: { duelId: 'duel-1' },
        autoImport: true,
      }),
    ).resolves.toEqual({ ok: true, accepted: true, jobId: 'job-1', childConversationId: 'child-1' });

    expect(liveSessionCapability.submitLiveSessionParallelPromptCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        text: 'Compare this screenshot',
        images: [{ data: 'png-bytes', mimeType: 'image/png', name: 'shot.png' }],
        videos: [{ path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 123 }],
        attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
        contextMessages: [{ customType: 'note', content: 'extra context' }],
        relatedConversationIds: ['related-1'],
        surfaceId: 'chat',
        model: 'provider/model',
        thinkingLevel: 'high',
        serviceTier: 'priority',
        ownerExtensionId: 'arena-ext',
        purpose: 'model_arena_duel',
        metadata: { duelId: 'duel-1' },
        autoImport: true,
      }),
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
  });

  it('forks from a specific source block with model overrides', async () => {
    live.registry.set('conv-1', liveEntry());
    const forkedEntry = liveEntry();
    live.registry.set('forked-from-entry', forkedEntry);
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(
      capability.fork({
        conversationId: 'conv-1',
        atBlockId: 'user-1-x0',
        beforeEntry: true,
        title: 'Arena challenger',
        model: 'anthropic/claude-sonnet',
      }),
    ).resolves.toEqual({ id: 'forked-from-entry', conversationId: 'forked-from-entry' });

    expect(live.forkSession).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
      expect.objectContaining({
        preserveSource: true,
        beforeEntry: true,
        branchKind: 'fork',
        initialModel: 'anthropic/claude-sonnet',
      }),
    );
    expect(live.createSessionFromExisting).not.toHaveBeenCalled();
    expect(forkedEntry.session.setSessionName).toHaveBeenCalledWith('Arena challenger');
  });

  it('queues working directory changes through the host live session registry', async () => {
    live.requestConversationWorkingDirectoryChange.mockResolvedValueOnce({
      conversationId: 'conv-1',
      cwd: '/next',
      queued: true,
    });
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.requestWorkingDirectoryChange('conv-1', '/next', { continuePrompt: 'Continue there.' })).resolves.toEqual({
      conversationId: 'conv-1',
      cwd: '/next',
      queued: true,
    });

    expect(live.requestConversationWorkingDirectoryChange).toHaveBeenCalledWith(
      { conversationId: 'conv-1', cwd: '/next', continuePrompt: 'Continue there.' },
      { resources: true, extensionFactories: ['factory'] },
    );
  });

  it('waits for agent_end instead of resolving on the first turn_end', async () => {
    let liveHandler: ((event: unknown) => void) | null = null;
    live.subscribe.mockImplementationOnce((_conversationId: string, handler: (event: unknown) => void) => {
      liveHandler = handler;
      return vi.fn();
    });
    live.registry.set('conv-1', liveEntry());
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    let resolved = false;
    const result = capability.runTurn('conv-1', 'use a tool').then((value) => {
      resolved = true;
      return value;
    });

    await Promise.resolve();
    expect(liveHandler).toBeTruthy();
    liveHandler?.({ type: 'turn_end' });
    await Promise.resolve();
    expect(resolved).toBe(false);

    liveHandler?.({ type: 'agent_end' });
    await expect(result).resolves.toEqual({ accepted: true });
    expect(resolved).toBe(true);
  });

  it('sets titles through the session and broadcasts title changes', async () => {
    const entry = liveEntry();
    live.registry.set('conv-1', entry);

    await expect(
      createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }).setTitle('conv-1', 'Renamed'),
    ).resolves.toEqual({
      ok: true,
    });

    expect(entry.session.setSessionName).toHaveBeenCalledWith('Renamed');
    expect(broadcasts.broadcastTitle).toHaveBeenCalledWith(entry, expect.objectContaining({ resolveEntryTitle: expect.any(Function) }));
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.renamed',
      conversationId: 'conv-1',
      title: 'Renamed',
    });
  });

  it('sets stored conversation titles through persisted metadata and publishes updates', async () => {
    conversationService.renameStoredConversation.mockReturnValueOnce({ id: 'stored-1', title: 'Stored Renamed' });

    await expect(
      createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }).setTitle('stored-1', '  Stored Renamed  '),
    ).resolves.toEqual({
      ok: true,
    });

    expect(conversationService.renameStoredConversation).toHaveBeenCalledWith('stored-1', '  Stored Renamed  ');
    expect(conversationService.publishConversationSessionMetaChanged).toHaveBeenCalledWith('stored-1');
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.renamed',
      conversationId: 'stored-1',
      title: 'Stored Renamed',
    });
  });

  it('updates live active tools and appends hidden custom entries', async () => {
    const appendCustomEntry = vi.fn();
    const setActiveTools = vi.fn();
    const entry = liveEntry({
      session: {
        ...liveEntry().session,
        getActiveToolNames: vi.fn(() => ['exec_code']),
        setActiveTools,
        sessionManager: {
          ...liveEntry().session.sessionManager,
          appendCustomEntry,
        },
      },
    });
    live.registry.set('conv-1', entry);
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.setActiveTools('conv-1', ['exec_code', 'exec_code', ' '])).resolves.toEqual({
      conversationId: 'conv-1',
      toolNames: ['exec_code'],
    });
    await expect(capability.appendCustomEntry('conv-1', 'code-mode-state', { enabled: true })).resolves.toEqual({ ok: true });

    expect(setActiveTools).toHaveBeenCalledWith(['exec_code']);
    expect(appendCustomEntry).toHaveBeenCalledWith('code-mode-state', { enabled: true });
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.tools.updated',
      conversationId: 'conv-1',
      toolNames: ['exec_code'],
    });
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.customEntry.appended',
      conversationId: 'conv-1',
      customType: 'code-mode-state',
    });
  });

  it('rolls back to the parent of the selected user turn', async () => {
    const entry = liveEntry();
    live.registry.set('conv-1', entry);

    await expect(createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' }).rollback('conv-1', 1)).resolves.toEqual({
      rolledBackTo: 'root',
    });
    expect(entry.session.sessionManager.branch).toHaveBeenCalledWith('root');
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
  });
});
