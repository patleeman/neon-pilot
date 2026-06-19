// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext, LiveTitlesContext, SseConnectionContext } from '../app/contexts.js';
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  ARCHIVED_SESSION_IDS_STORAGE_KEY,
  buildSidebarNavSectionStorageKey,
  OPEN_SESSION_IDS_STORAGE_KEY,
  PINNED_SESSION_IDS_STORAGE_KEY,
  SAVED_WORKSPACE_PATHS_STORAGE_KEY,
} from '../local/localSettings.js';
import { readConversationLayout, resetLocalWriteGrace, resetRemoteConversationLayoutCache } from '../session/sessionTabs.js';
import type { SessionMeta } from '../shared/types.js';
import { sessionStore } from '../store';
import { Sidebar } from './Sidebar.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  setOpenConversationTabs: vi.fn(),
  updateConversationWorkspace: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  gateways: vi.fn(),
}));

vi.mock('../client/api', () => ({ api: apiMocks }));

const roots: Root[] = [];
const LOCKED_CONVERSATION_IDS_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-locked-conversations');

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
}

function session(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id' | 'title'>): SessionMeta {
  return {
    file: `/tmp/${overrides.id}.jsonl`,
    timestamp: '2026-03-16T09:30:00.000Z',
    cwd: '/repo',
    cwdSlug: 'repo',
    model: 'openai/gpt-5.4',
    messageCount: 1,
    isRunning: false,
    ...overrides,
  };
}

function readStoredIds(key: string): string[] {
  return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
}

type RemoteSidebarLayout = {
  sessionIds: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
};

function renderSidebar(pathname: string, sessions: SessionMeta[], remoteLayout?: RemoteSidebarLayout) {
  // Seed the store so useConversations finds the sessions it needs
  sessionStore.replaceAll(sessions);
  sessionStore.markReady?.();
  apiMocks.openConversationTabs.mockResolvedValue(
    remoteLayout ?? {
      sessionIds: readStoredIds(OPEN_SESSION_IDS_STORAGE_KEY),
      pinnedSessionIds: readStoredIds(PINNED_SESSION_IDS_STORAGE_KEY),
      archivedSessionIds: readStoredIds(ARCHIVED_SESSION_IDS_STORAGE_KEY),
      activeConversationId: pathname.startsWith('/conversations/') ? pathname.slice('/conversations/'.length) : undefined,
      workspacePaths: [],
    },
  );

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[pathname]}>
        <SseConnectionContext.Provider value={{ status: 'offline' }}>
          <AppDataContext.Provider
            value={{
              projects: [],
              sessions,
              tasks: null,
              runs: null,
              setProjects: () => {},
              setSessions: () => {},
              setTasks: () => {},
              setRuns: () => {},
            }}
          >
            <LiveTitlesContext.Provider value={{ titles: new Map(), setTitle: () => {} }}>
              <Sidebar />
            </LiveTitlesContext.Provider>
          </AppDataContext.Provider>
        </SseConnectionContext.Provider>
      </MemoryRouter>,
    );
  });
  roots.push(root);
  return container;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function row(container: HTMLElement, id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-sidebar-session-id="${id}"]`);
  if (!element) throw new Error(`Missing row ${id}`);
  return element;
}

function clickArchive(container: HTMLElement, id: string) {
  const button = row(container, id).querySelector<HTMLElement>('[aria-label="Archive thread"]');
  if (!button) throw new Error(`Missing archive action for ${id}`);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
}

function dispatchDesktopShortcutCommand(command: string): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command } }));
  });
}

function readJsonList(key: string): string[] {
  const layout = readConversationLayout();
  if (key === OPEN_SESSION_IDS_STORAGE_KEY) return layout.sessionIds;
  if (key === PINNED_SESSION_IDS_STORAGE_KEY) return layout.pinnedSessionIds;
  if (key === ARCHIVED_SESSION_IDS_STORAGE_KEY) return layout.archivedSessionIds;
  return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
}

describe('Sidebar branch conversation interactions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    apiMocks.openConversationTabs.mockReset();
    apiMocks.setOpenConversationTabs.mockReset();
    apiMocks.updateConversationWorkspace.mockReset();
    apiMocks.setSavedWorkspacePaths.mockReset();
    apiMocks.gateways.mockReset();
    apiMocks.openConversationTabs.mockResolvedValue({ sessionIds: [], pinnedSessionIds: [], archivedSessionIds: [], workspacePaths: [] });
    apiMocks.setOpenConversationTabs.mockResolvedValue({ ok: true });
    apiMocks.updateConversationWorkspace.mockResolvedValue({ ok: true });
    apiMocks.setSavedWorkspacePaths.mockResolvedValue([]);
    apiMocks.gateways.mockResolvedValue({ providers: [], connections: [], bindings: [], events: [], chatTargets: [] });
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    resetLocalWriteGrace();
    resetRemoteConversationLayoutCache();
    Object.defineProperty(window, 'neonPilotDesktop', { value: {}, configurable: true });
  });

  afterEach(() => {
    while (roots.length > 0) act(() => roots.pop()?.unmount());
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('archiving a parent removes only that row while open child branches stay flat and closable', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['parent', 'child', 'side-child']));
    const container = renderSidebar('/conversations/child', [
      session({ id: 'parent', title: 'Parent thread' }),
      session({ id: 'child', title: 'Child branch', parentSessionId: 'parent', offshootKind: 'fork' }),
      session({ id: 'side-child', title: 'Side branch', parentSessionId: 'parent', offshootKind: 'side' }),
    ]);
    await flush();

    clickArchive(container, 'parent');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['child', 'side-child']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);
    expect(() => row(container, 'parent')).toThrow();
    expect(row(container, 'child').textContent).toContain('Child branch');
    expect(row(container, 'child').textContent).not.toContain('fork:');
    expect(row(container, 'side-child').textContent).toContain('Side branch');
    expect(row(container, 'side-child').textContent).not.toContain('side:');
    expect(row(container, 'child').querySelector('[aria-label="Archive thread"]')).not.toBeNull();
  });

  it('shows open child conversations as flat rows without pulling in subagent descendants', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['grandparent', 'parent', 'grandchild']));
    const container = renderSidebar('/conversations/parent', [
      session({ id: 'grandparent', title: 'Grandparent thread' }),
      session({ id: 'parent', title: 'Parent branch', parentSessionId: 'grandparent', offshootKind: 'fork' }),
      session({ id: 'grandchild', title: 'Running grandchild', parentSessionId: 'parent', sourceRunId: 'run-grandchild', isRunning: true }),
    ]);
    await flush();

    expect(row(container, 'grandparent').textContent).toContain('Grandparent thread');
    expect(row(container, 'parent').textContent).toContain('Parent branch');
    expect(row(container, 'parent').textContent).not.toContain('fork:');
    expect(() => row(container, 'grandchild')).toThrow();
  });

  it('shows the active subagent thread as a flat sidebar row when opened from View', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['parent']));
    const container = renderSidebar('/conversations/subagent-child', [
      session({ id: 'parent', title: 'Parent thread' }),
      session({
        id: 'subagent-child',
        title: 'Smoke test subagent',
        parentSessionId: 'parent',
        sourceRunId: 'run-subagent-child',
        offshootKind: 'subagent',
      }),
    ]);
    await flush();

    expect(row(container, 'parent').textContent).toContain('Parent thread');
    expect(row(container, 'subagent-child').textContent).toContain('Smoke test subagent');
    expect(row(container, 'subagent-child').textContent).not.toContain('subagent: Smoke test subagent');
  });

  it('closes an active parent that is only visible as lineage while a running child stays open', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['child']));
    renderSidebar('/conversations/parent', [
      session({ id: 'parent', title: 'Parent thread' }),
      session({ id: 'child', title: 'Running child', parentSessionId: 'parent', sourceRunId: 'run-child', isRunning: true }),
    ]);
    await flush();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'close-conversation' } }));
    });
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['child']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);
  });

  it('accepts command-only desktop shortcut events for shared conversation close', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['child']));
    renderSidebar('/conversations/parent', [
      session({ id: 'parent', title: 'Parent thread' }),
      session({ id: 'child', title: 'Running child', parentSessionId: 'parent', sourceRunId: 'run-child', isRunning: true }),
    ]);
    await flush();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'conversation.close' } }));
    });
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['child']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);
  });

  it('accepts command-only desktop shortcut events for conversation pin and archive toggles', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['parent']));
    renderSidebar('/conversations/parent', [session({ id: 'parent', title: 'Parent thread' })]);
    await flush();

    dispatchDesktopShortcutCommand('conversation.togglePinned');
    await flush();

    expect(readJsonList(PINNED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);

    dispatchDesktopShortcutCommand('conversation.toggleArchived');
    await flush();

    expect(readJsonList(PINNED_SESSION_IDS_STORAGE_KEY)).toEqual([]);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);
  });

  it('reopens the most recently archived conversation through the desktop shortcut workflow', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['first', 'second']));
    renderSidebar('/conversations/second', [session({ id: 'first', title: 'First thread' }), session({ id: 'second', title: 'Second thread' })]);
    await flush();

    dispatchDesktopShortcutCommand('conversation.toggleArchived');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['first']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['second']);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'reopen-closed-conversation' } }));
    });
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['first', 'second']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual([]);
  });

  it('hydrates an existing active conversation from the remote layout after reload', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    const container = renderSidebar(
      '/conversations/existing',
      [session({ id: 'existing', title: 'Persisted thread' })],
      {
        sessionIds: ['existing'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: 'existing',
        workspacePaths: [],
      },
    );
    await flush();

    const existingRow = row(container, 'existing');
    expect(existingRow.textContent).toContain('Persisted thread');
    expect(existingRow.className).toContain('ui-sidebar-session-row-active');
    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['existing']);
    expect(readConversationLayout().activeSessionId).toBe('existing');
  });

  it('keeps a workspace group saved after closing its last open conversation', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['solo']));
    renderSidebar('/conversations/solo', [session({ id: 'solo', title: 'Solo thread', cwd: '/repo/solo', cwdSlug: 'solo' })]);
    await flush();

    dispatchDesktopShortcutCommand('conversation.close');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual([]);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['solo']);
    expect(readJsonList(SAVED_WORKSPACE_PATHS_STORAGE_KEY)).toEqual(['/repo/solo']);
    expect(apiMocks.setSavedWorkspacePaths).toHaveBeenCalledWith(['/repo/solo']);
  });

  it('blocks closing and archiving a locked conversation until it is unlocked', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['locked']));
    renderSidebar('/conversations/locked', [session({ id: 'locked', title: 'Important thread' })]);
    await flush();

    dispatchDesktopShortcutCommand('conversation.toggleLocked');
    await flush();

    expect(readJsonList(LOCKED_CONVERSATION_IDS_STORAGE_KEY)).toEqual(['locked']);

    dispatchDesktopShortcutCommand('conversation.close');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['locked']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual([]);

    dispatchDesktopShortcutCommand('conversation.toggleArchived');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['locked']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual([]);

    dispatchDesktopShortcutCommand('conversation.toggleLocked');
    await flush();
    dispatchDesktopShortcutCommand('conversation.close');
    await flush();

    expect(readJsonList(LOCKED_CONVERSATION_IDS_STORAGE_KEY)).toEqual([]);
    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual([]);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['locked']);
  });
});
