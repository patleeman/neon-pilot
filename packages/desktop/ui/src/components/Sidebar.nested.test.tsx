// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext, LiveTitlesContext, SseConnectionContext } from '../app/contexts.js';
import { ARCHIVED_SESSION_IDS_STORAGE_KEY, OPEN_SESSION_IDS_STORAGE_KEY, PINNED_SESSION_IDS_STORAGE_KEY } from '../local/localSettings.js';
import type { SessionMeta } from '../shared/types.js';
import { Sidebar } from './Sidebar.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  setOpenConversationTabs: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  gateways: vi.fn(),
}));

vi.mock('../client/api', () => ({ api: apiMocks }));

const roots: Root[] = [];

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

function renderSidebar(pathname: string, sessions: SessionMeta[]) {
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

function readJsonList(key: string): string[] {
  return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
}

describe('Sidebar branch conversation interactions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    apiMocks.openConversationTabs.mockReset();
    apiMocks.setOpenConversationTabs.mockReset();
    apiMocks.setSavedWorkspacePaths.mockReset();
    apiMocks.gateways.mockReset();
    apiMocks.openConversationTabs.mockResolvedValue({ sessionIds: [], pinnedSessionIds: [], archivedSessionIds: [], workspacePaths: [] });
    apiMocks.setOpenConversationTabs.mockResolvedValue({ ok: true });
    apiMocks.setSavedWorkspacePaths.mockResolvedValue([]);
    apiMocks.gateways.mockResolvedValue({ providers: [], connections: [], bindings: [], events: [], chatTargets: [] });
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    Object.defineProperty(window, 'neonPilotDesktop', { value: {}, configurable: true });
  });

  afterEach(() => {
    while (roots.length > 0) act(() => roots.pop()?.unmount());
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('archiving a parent removes only that row while open child branches stay flat and closable', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['parent', 'child']));
    const container = renderSidebar('/conversations/child', [
      session({ id: 'parent', title: 'Parent thread' }),
      session({ id: 'child', title: 'Child branch', parentSessionId: 'parent', offshootKind: 'fork' }),
    ]);
    await flush();

    clickArchive(container, 'parent');
    await flush();

    expect(readJsonList(OPEN_SESSION_IDS_STORAGE_KEY)).toEqual(['child']);
    expect(readJsonList(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toEqual(['parent']);
    expect(() => row(container, 'parent')).toThrow();
    expect(row(container, 'child').textContent).toContain('fork: Child branch');
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
    expect(row(container, 'parent').textContent).toContain('fork: Parent branch');
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
    expect(row(container, 'subagent-child').textContent).toContain('subagent: Smoke test subagent');
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
});
