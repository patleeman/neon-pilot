import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionsCapability = vi.hoisted(() => ({ readConversationSessionsCapability: vi.fn() }));
const broadcasts = vi.hoisted(() => ({ broadcastTitle: vi.fn() }));
const reservation = vi.hoisted(() => ({ reserveConversationSession: vi.fn() }));
const liveSessionCapability = vi.hoisted(() => ({
  submitLiveSessionPromptCapability: vi.fn(),
}));
const conversationService = vi.hoisted(() => ({
  appendStoredVisibleCustomMessage: vi.fn(),
  renameStoredConversation: vi.fn(),
  resolveConversationSessionFile: vi.fn(),
}));
const live = vi.hoisted(() => ({
  registry: new Map<string, unknown>(),
  abortSession: vi.fn(),
  appendVisibleCustomMessage: vi.fn(),
  createSession: vi.fn(),
  createSessionFromExisting: vi.fn(),
  resumeSession: vi.fn(),
  subscribe: vi.fn(),
  updateVisibleCustomMessage: vi.fn(),
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
vi.mock('../conversations/liveSessions.js', () => live);
vi.mock('../conversations/liveSessionTitle.js', () => titles);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('./extensionConversationMetadata.js', () => metadata);
vi.mock('./extensionSubscriptions.js', () => subscriptions);
vi.mock('../ui/uiPreferences.js', () => uiPreferences);
vi.mock('../ui/settingsPersistence.js', () => settingsPersistence);

import { createExtensionConversationsCapability } from './extensionConversations.js';

function liveEntry(overrides: Record<string, unknown> = {}) {
  const session = {
    name: 'Conversation One',
    isStreaming: false,
    model: { id: 'model-1' },
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
    liveSessionCapability.submitLiveSessionPromptCapability.mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });
    reservation.reserveConversationSession.mockReturnValue({ id: 'reserved-1', sessionFile: '/sessions/reserved-1.jsonl', cwd: '/repo' });
    conversationService.resolveConversationSessionFile.mockReturnValue('/sessions/persisted.jsonl');
    conversationService.appendStoredVisibleCustomMessage.mockReturnValue('block-1');
    uiPreferences.saved = {
      openConversationIds: ['existing-open'],
      pinnedConversationIds: ['existing-pinned'],
      archivedConversationIds: ['existing-archived'],
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
      details: { ok: true },
      blockId: undefined,
    });
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.created',
      conversationId: 'reserved-1',
      cwd: '/repo',
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
