// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchRemoteConversationLayoutMock = vi.hoisted(() => vi.fn());

vi.mock('../session/sessionTabs', () => ({
  fetchRemoteConversationLayout: fetchRemoteConversationLayoutMock,
}));

vi.mock('../client/api', () => ({
  api: {
    setSavedWorkspacePaths: vi.fn(),
  },
}));

import { useSavedWorkspacePaths } from './useSavedWorkspacePaths';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
}

function Harness({ workspacePickerOpen = false }: { workspacePickerOpen?: boolean }) {
  useSavedWorkspacePaths({
    draftCwd: '',
    openConversationCount: 0,
    openWorkspacePaths: [],
    pinnedConversationCount: 0,
    sessionsReady: true,
    workspacePickerOpen,
  });
  return null;
}

function renderHarness(props: { workspacePickerOpen?: boolean } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness {...props} />);
  });
  roots.push(root);
  return { root };
}

describe('useSavedWorkspacePaths', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', createStorage());
    fetchRemoteConversationLayoutMock.mockReset();
    fetchRemoteConversationLayoutMock.mockResolvedValue({
      sessionIds: [],
      pinnedSessionIds: [],
      workspacePaths: ['/repo'],
    });
  });

  afterEach(() => {
    while (roots.length > 0) {
      act(() => roots.pop()?.unmount());
    }
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('delays initial remote workspace hydration out of the first-send window', async () => {
    renderHarness();

    expect(fetchRemoteConversationLayoutMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5_999);
      await Promise.resolve();
    });
    expect(fetchRemoteConversationLayoutMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(fetchRemoteConversationLayoutMock).toHaveBeenCalledTimes(1);
  });

  it('still refreshes immediately when the workspace picker opens', async () => {
    renderHarness({ workspacePickerOpen: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchRemoteConversationLayoutMock).toHaveBeenCalledTimes(1);
  });
});
