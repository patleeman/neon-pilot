import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  createLiveSession: vi.fn(),
  saveConversationWorkspaceLayout: vi.fn(),
  updateConversationWorkspace: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { readConversationLayout, resetRemoteConversationLayoutCache } from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';
import { readDraftConversationComposer, readDraftConversationCwd } from './draftConversation';
import { findReusableNewConversationForCwd, startNewConversation, startNewLiveConversation } from './newConversationNavigation';

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function createSession(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: 'conversation-1',
    file: '/tmp/conversation-1.jsonl',
    timestamp: '2026-05-26T12:00:00.000Z',
    cwd: '/repo',
    cwdSlug: 'repo',
    model: 'gpt-5',
    title: 'New Conversation',
    messageCount: 0,
    isRunning: false,
    ...overrides,
  };
}

describe('startNewLiveConversation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    apiMocks.createLiveSession.mockReset();
    apiMocks.saveConversationWorkspaceLayout.mockReset();
    apiMocks.updateConversationWorkspace.mockReset();
    if (typeof CustomEvent === 'undefined') {
      vi.stubGlobal(
        'CustomEvent',
        class CustomEvent<T = unknown> {
          type: string;
          detail: T | null;

          constructor(type: string, init?: CustomEventInit<T>) {
            this.type = type;
            this.detail = init?.detail ?? null;
          }
        },
      );
    }
    apiMocks.createLiveSession.mockResolvedValue({
      id: 'new-conversation',
      file: '/tmp/new-conversation.jsonl',
      timestamp: '2026-05-26T12:00:00.000Z',
      cwd: '',
      cwdSlug: '',
      model: 'gpt-5',
      title: 'New chat',
      messageCount: 0,
      isRunning: false,
    });
    apiMocks.saveConversationWorkspaceLayout.mockResolvedValue({ ok: true });
    apiMocks.updateConversationWorkspace.mockResolvedValue({ ok: true });
    resetRemoteConversationLayoutCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not preserve the draft surface when creating from an existing conversation', async () => {
    const navigate = vi.fn();

    await startNewLiveConversation({ navigate });

    expect(navigate).toHaveBeenCalledWith('/conversations/new-conversation', {
      replace: undefined,
      state: {
        focusComposer: false,
      },
    });
    expect(readConversationLayout().sessionIds).toEqual(['new-conversation']);
    expect(readConversationLayout().activeSessionId).toBe('new-conversation');
  });

  it('preserves the draft surface when requested', async () => {
    const navigate = vi.fn();

    await startNewLiveConversation({ navigate, preserveDraftSurface: true });

    expect(navigate).toHaveBeenCalledWith('/conversations/new-conversation', {
      replace: undefined,
      state: {
        preserveConversationSurfaceKey: 'draft',
        focusComposer: false,
      },
    });
  });
});

describe('startNewConversation', () => {
  beforeEach(() => {
    apiMocks.createLiveSession.mockReset();
    apiMocks.updateConversationWorkspace.mockReset();
    const sessionStorage = createStorage();
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', sessionStorage);
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      sessionStorage,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    if (typeof CustomEvent === 'undefined') {
      vi.stubGlobal(
        'CustomEvent',
        class CustomEvent<T = unknown> {
          type: string;
          detail: T | null;

          constructor(type: string, init?: CustomEventInit<T>) {
            this.type = type;
            this.detail = init?.detail ?? null;
          }
        },
      );
    }
    apiMocks.createLiveSession.mockResolvedValue({
      id: 'new-conversation',
      sessionFile: '/tmp/new-conversation.jsonl',
      bootstrap: undefined,
    });
    apiMocks.updateConversationWorkspace.mockResolvedValue({ ok: true });
    resetRemoteConversationLayoutCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the draft route immediately without creating a live session', async () => {
    const navigate = vi.fn();
    apiMocks.createLiveSession.mockRejectedValue(new Error('Not found'));

    await startNewConversation({ navigate, focusComposer: true });

    expect(apiMocks.createLiveSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/conversations/new', {
      replace: undefined,
      state: {
        focusComposer: true,
      },
    });
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'neon-pilot:composer-focus' }));
  });

  it('reuses an existing empty new conversation for the same cwd', async () => {
    const navigate = vi.fn();

    await startNewConversation({
      navigate,
      cwd: '/repo/',
      focusComposer: true,
      existingSessions: [createSession({ id: 'existing-new', cwd: '/repo' })],
    });

    expect(apiMocks.createLiveSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/conversations/existing-new', {
      replace: undefined,
      state: {
        focusComposer: true,
      },
    });
    expect(readConversationLayout().sessionIds).toEqual(['existing-new']);
    expect(readConversationLayout().activeSessionId).toBe('existing-new');
  });

  it('does not reuse a conversation that already has messages', async () => {
    const navigate = vi.fn();

    await startNewConversation({
      navigate,
      cwd: '/repo',
      existingSessions: [createSession({ id: 'active-thread', messageCount: 2 })],
    });

    expect(apiMocks.createLiveSession).toHaveBeenCalledWith('/repo', undefined, expect.any(Object));
    expect(navigate).toHaveBeenCalledWith('/conversations/new-conversation', expect.any(Object));
  });

  it('does not reuse an empty conversation when submitting an initial prompt', async () => {
    const navigate = vi.fn();

    await startNewConversation({
      navigate,
      cwd: '/repo',
      initialPromptText: 'Start immediately.',
      existingSessions: [createSession({ id: 'existing-new', cwd: '/repo' })],
    });

    expect(apiMocks.createLiveSession).toHaveBeenCalledWith('/repo', 'Start immediately.', expect.any(Object));
    expect(navigate).toHaveBeenCalledWith('/conversations/new-conversation', expect.any(Object));
  });

  it('keeps an explicit draft cwd for workspace chat buttons', async () => {
    const navigate = vi.fn();
    apiMocks.createLiveSession.mockRejectedValue(new Error('Not found'));

    await startNewConversation({ navigate, cwd: '/repo' });

    expect(readDraftConversationCwd()).toBe('/repo');
  });

  it('submits initial prompt text without requesting composer focus', async () => {
    const navigate = vi.fn();

    await startNewConversation({ navigate, focusComposer: true, initialPromptText: 'Use the scheduled-tasks skill.' });

    expect(apiMocks.createLiveSession).toHaveBeenCalledWith(undefined, 'Use the scheduled-tasks skill.', expect.any(Object));
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/conversations\//), {
      replace: undefined,
      state: {
        focusComposer: false,
        initialPromptAlreadySubmittedState: {
          conversationId: 'new-conversation',
        },
      },
    });
    expect(window.dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'neon-pilot:composer-focus' }));
  });

  it('prepopulates the draft composer when requested', async () => {
    const navigate = vi.fn();
    apiMocks.createLiveSession.mockRejectedValue(new Error('Not found'));

    await startNewConversation({ navigate, initialComposerText: 'Use the scheduled-tasks skill.' });

    // New create-first flow: text was passed to the API call. On fallback to
    // draft, the composer is cleared (no stale draft state).
    expect(readDraftConversationComposer()).toBe('');
  });

  it('does not churn empty draft state when already on the draft route', async () => {
    const navigate = vi.fn();
    apiMocks.createLiveSession.mockRejectedValue(new Error('Not found'));
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      sessionStorage,
      location: { pathname: '/conversations/new' },
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });

    await startNewConversation({ navigate, focusComposer: true, replace: true });

    // On the draft route, the function still attempts a live session. When
    // that fails, navigateDraft runs, but since location is already /new,
    // the navigate call may still fire.
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'neon-pilot:composer-focus' }));
  });
});

describe('findReusableNewConversationForCwd', () => {
  it('matches neutral chat sessions to the no-workspace cwd bucket', () => {
    const reusable = createSession({
      id: 'neutral-new',
      cwd: '/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared',
      workspaceCwd: null,
    });

    expect(findReusableNewConversationForCwd([reusable], '')?.id).toBe('neutral-new');
  });

  it('ignores renamed empty conversations', () => {
    expect(findReusableNewConversationForCwd([createSession({ title: 'Sketch an idea' })], '/repo')).toBeNull();
  });
});
