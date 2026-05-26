import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  createLiveSession: vi.fn(),
  setOpenConversationTabs: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { ACTIVE_SESSION_ID_STORAGE_KEY, OPEN_SESSION_IDS_STORAGE_KEY } from '../local/localSettings';
import { startNewLiveConversation } from './newConversationNavigation';

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
