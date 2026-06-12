/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts';
import { api } from '../client/api';
import type { ConversationActivityResult } from '../shared/types';
import { useConversationActivity } from './useConversationActivity';

vi.mock('../client/api', () => ({
  api: {
    conversationActivity: vi.fn(),
  },
}));

function activity(ids: string[]): ConversationActivityResult {
  return {
    conversationId: 'conv-1',
    items: ids.map((id) => ({
      id,
      kind: 'execution' as const,
      title: 'Background work',
      status: 'running' as const,
      active: true,
      visibility: 'primary' as const,
      conversationId: 'conv-1',
      source: { type: 'execution' as const, id: id.replace(/^execution:/, '') },
      actions: [],
    })),
    primary: [],
    system: [],
    hidden: [],
  };
}

function activityForConversation(conversationId: string, ids: string[]): ConversationActivityResult {
  return {
    conversationId,
    items: ids.map((id) => ({
      id,
      kind: 'execution' as const,
      title: 'Background work',
      status: 'running' as const,
      active: true,
      visibility: 'primary' as const,
      conversationId,
      source: { type: 'execution' as const, id: id.replace(/^execution:/, '') },
      actions: [],
    })),
    primary: [],
    system: [],
    hidden: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createWrapper(overrides: { versions?: Partial<typeof INITIAL_APP_EVENT_VERSIONS> } = {}) {
  const value = {
    versions: {
      ...INITIAL_APP_EVENT_VERSIONS,
      ...overrides.versions,
    },
    conversationVersions: {},
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return <AppEventsContext.Provider value={value}>{children}</AppEventsContext.Provider>;
  };
}

function setDocumentVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useConversationActivity', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(api.conversationActivity).mockReset();
  });

  afterEach(() => {
    setDocumentVisibility('visible');
    vi.useRealTimers();
  });

  it('loads conversation activity from backend truth', async () => {
    vi.mocked(api.conversationActivity).mockResolvedValue(activity(['execution:run-1']));

    const { result } = renderHook(() => useConversationActivity('conv-1'), { wrapper: createWrapper() });
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-1']));
    expect(api.conversationActivity).toHaveBeenCalledWith('conv-1');
  });

  it('refreshes when app versions change', async () => {
    vi.mocked(api.conversationActivity)
      .mockResolvedValueOnce(activity(['execution:run-1']))
      .mockResolvedValueOnce(activity(['execution:run-2']));

    let executionsVersion = 0;
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AppEventsContext.Provider
          value={{ versions: { ...INITIAL_APP_EVENT_VERSIONS, executions: executionsVersion }, conversationVersions: {} }}
        >
          {children}
        </AppEventsContext.Provider>
      );
    }

    const { result, rerender } = renderHook(() => useConversationActivity('conv-1'), { wrapper: Wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-1']));

    executionsVersion = 1;
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-2']));
  });

  it('polls while active activity exists', async () => {
    vi.useFakeTimers();
    vi.mocked(api.conversationActivity)
      .mockResolvedValueOnce(activity(['execution:run-1']))
      .mockResolvedValueOnce({ conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] });

    const { result } = renderHook(() => useConversationActivity('conv-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-1']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.activity.items).toEqual([]);
  });

  it('does not refresh while the document is hidden', async () => {
    setDocumentVisibility('hidden');
    vi.mocked(api.conversationActivity).mockResolvedValue(activity(['execution:run-1']));

    const { result } = renderHook(() => useConversationActivity('conv-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activity.items).toEqual([]);
    expect(api.conversationActivity).not.toHaveBeenCalled();
  });

  it('ignores stale manual refresh results after the conversation changes', async () => {
    const staleRefresh = deferred<ConversationActivityResult>();
    vi.mocked(api.conversationActivity)
      .mockResolvedValueOnce(activityForConversation('conv-1', ['execution:run-1']))
      .mockReturnValueOnce(staleRefresh.promise)
      .mockResolvedValueOnce(activityForConversation('conv-2', ['execution:run-2']));

    const { result, rerender } = renderHook(({ conversationId }) => useConversationActivity(conversationId), {
      initialProps: { conversationId: 'conv-1' },
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-1']));

    const refreshPromise = result.current.refresh();

    await act(async () => {
      rerender({ conversationId: 'conv-2' });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-2']));

    await act(async () => {
      staleRefresh.resolve(activityForConversation('conv-1', ['execution:stale']));
      await refreshPromise;
    });

    expect(result.current.activity.conversationId).toBe('conv-2');
    expect(result.current.activity.items.map((item) => item.id)).toEqual(['execution:run-2']);
  });
});
