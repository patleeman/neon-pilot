import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionsCapability = vi.hoisted(() => ({ readConversationSessionsCapability: vi.fn() }));
const broadcasts = vi.hoisted(() => ({ broadcastTitle: vi.fn() }));
const reservation = vi.hoisted(() => ({ reserveConversationSession: vi.fn() }));
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
const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn() }));
const metadata = vi.hoisted(() => ({
  queryConversationMetadata: vi.fn(),
  readConversationMetadata: vi.fn(),
  writeConversationMetadata: vi.fn(),
}));
const subscriptions = vi.hoisted(() => ({ publishExtensionHostEvent: vi.fn() }));

vi.mock('../conversations/conversationSessionCapability.js', () => sessionsCapability);
vi.mock('../conversations/liveSessionBroadcasts.js', () => broadcasts);
vi.mock('../conversations/conversationReservation.js', () => reservation);
vi.mock('../conversations/conversationService.js', () => conversationService);
vi.mock('../conversations/liveSessions.js', () => live);
vi.mock('../conversations/liveSessionTitle.js', () => titles);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('./extensionConversationMetadata.js', () => metadata);
vi.mock('./extensionSubscriptions.js', () => subscriptions);

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
    reservation.reserveConversationSession.mockReturnValue({ id: 'reserved-1', sessionFile: '/sessions/reserved-1.jsonl', cwd: '/repo' });
    conversationService.resolveConversationSessionFile.mockReturnValue('/sessions/persisted.jsonl');
    conversationService.appendStoredVisibleCustomMessage.mockReturnValue('block-1');
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
    expect(entry.session.followUp).toHaveBeenCalledWith('Start here');
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
    expect(subscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.created',
      conversationId: 'conv-1',
      cwd: '/repo',
    });
    expect(result).toEqual({ id: 'conv-1', conversationId: 'conv-1' });
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

  it('sends prompts, follow-ups, and steering messages based on live streaming state', async () => {
    const entry = liveEntry();
    live.registry.set('conv-1', entry);
    const capability = createExtensionConversationsCapability({ getRuntimeScope: () => 'shared' });

    await expect(capability.sendMessage('conv-1', 'hello')).resolves.toEqual({ accepted: true });
    expect(entry.session.prompt).toHaveBeenCalledWith('hello');

    entry.session.isStreaming = true;
    await expect(capability.sendMessage('conv-1', 'later')).resolves.toEqual({ accepted: true });
    expect(entry.session.followUp).toHaveBeenCalledWith('later');

    await expect(capability.sendMessage('conv-1', 'now', { steer: true })).resolves.toEqual({ accepted: true });
    expect(entry.session.steer).toHaveBeenCalledWith('now');
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
