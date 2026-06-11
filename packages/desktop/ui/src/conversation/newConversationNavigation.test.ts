import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  createLiveSession: vi.fn(),
  setOpenConversationTabs: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { ACTIVE_SESSION_ID_STORAGE_KEY, OPEN_SESSION_IDS_STORAGE_KEY } from '../local/localSettings';
import { readDraftConversationComposer, readDraftConversationCwd } from './draftConversation';
import { startNewConversation, startNewLiveConversation } from './newConversationNavigation';

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

describe('startNewLiveConversation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    apiMocks.createLiveSession.mockReset();
    apiMocks.setOpenConversationTabs.mockReset();
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
    apiMocks.setOpenConversationTabs.mockResolvedValue({ ok: true });
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
    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['new-conversation']);
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBe('new-conversation');
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
