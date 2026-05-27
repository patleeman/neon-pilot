import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  createLiveSession: vi.fn(),
  setOpenConversationTabs: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { ACTIVE_SESSION_ID_STORAGE_KEY, OPEN_SESSION_IDS_STORAGE_KEY } from '../local/localSettings';
import { readDraftConversationCwd } from './draftConversation';
import { startDraftConversation, startNewLiveConversation } from './newConversationNavigation';

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

describe('startDraftConversation', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the draft route immediately without creating a live session', () => {
    const navigate = vi.fn();

    startDraftConversation({ navigate, focusComposer: true });

    expect(apiMocks.createLiveSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/conversations/new', {
      replace: undefined,
      state: {
        focusComposer: true,
      },
    });
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'neon-pilot:composer-focus' }));
  });

  it('keeps an explicit draft cwd for workspace chat buttons', () => {
    const navigate = vi.fn();

    startDraftConversation({ navigate, cwd: '/repo' });

    expect(readDraftConversationCwd()).toBe('/repo');
  });

  it('does not churn empty draft state when already on the draft route', () => {
    const navigate = vi.fn();
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      sessionStorage,
      location: { pathname: '/conversations/new' },
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });

    startDraftConversation({ navigate, focusComposer: true });

    expect(navigate).not.toHaveBeenCalled();
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'neon-pilot:composer-focus' }));
  });
});
