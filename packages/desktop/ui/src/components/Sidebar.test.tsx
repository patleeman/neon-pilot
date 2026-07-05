import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext, LiveTitlesContext, SseConnectionContext } from '../app/contexts.js';
import {
  ARCHIVED_SESSION_IDS_STORAGE_KEY,
  buildSidebarNavSectionStorageKey,
  OPEN_SESSION_IDS_STORAGE_KEY,
  PINNED_SESSION_IDS_STORAGE_KEY,
  SAVED_WORKSPACE_PATHS_STORAGE_KEY,
} from '../local/localSettings.js';
import { applyRemoteConversationLayout, resetRemoteConversationLayoutCache } from '../session/sessionTabs.js';
import type { DurableRunListResult, ExecutionListResult, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import {
  conversationActivityStatusStore,
  conversationRuntimeStore,
  executionStore,
  runStore,
  sessionStore,
  taskStore,
  titleStore,
} from '../store';
import { buildGatewayConversationAttachRoute, Sidebar } from './Sidebar.js';

const apiMocks = vi.hoisted(() => ({
  sidebarConversations: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

const extensionRegistryMock = vi.hoisted(() => ({
  state: {
    extensions: [],
    routes: [],
    surfaces: [],
    topBarElements: [],
    messageActions: [],
    composerShelves: [],
    newConversationPanels: [],
    settingsComponent: null,
    settingsComponents: [],
    composerControls: [],
    composerInputTools: [],
    toolbarActions: [],
    contextMenus: [],
    selectionActions: [],
    threadHeaderActions: [],
    statusBarItems: [],
    conversationHeaderElements: [],
    conversationDecorators: [],
    activityTreeItemElements: [],
    activityTreeItemStyles: [],
    conversationLifecycle: [],
    composerAttachmentProviders: [],
    composerAttachmentRenderers: [],
    composerAttachmentResolvers: [],
    activityTreeItemActions: [],
    loading: false,
    error: null,
  },
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => extensionRegistryMock.state,
}));

vi.mock('../extensions/NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({
    surface,
    instanceId,
    pathname,
    search,
    hash,
  }: {
    surface: { id: string; title?: string };
    instanceId?: string;
    pathname?: string;
    search?: string;
    hash?: string;
  }) => (
    <div
      data-testid="mock-sidebar-extension-surface"
      data-surface-id={surface.id}
      data-instance-id={instanceId}
      data-pathname={pathname}
      data-search={search}
      data-hash={hash}
    >
      {surface.title ?? surface.id}
    </div>
  ),
}));

const OPEN_NOTE_IDS_STORAGE_KEY = 'pa:open-note-ids';
const OPEN_SKILL_IDS_STORAGE_KEY = 'pa:open-skill-ids';
const PINNED_NOTE_IDS_STORAGE_KEY = 'pa:pinned-note-ids';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

class MemoryStorage {
  private readonly store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

function createSession(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: 'conv-123',
    file: '/tmp/conv-123.jsonl',
    timestamp: '2026-03-16T09:30:00.000Z',
    cwd: '/home/user/project',
    cwdSlug: 'neon-pilot',
    model: 'openai/gpt-5.4',
    title: 'Clarify background run link',
    messageCount: 4,
    isRunning: false,
    ...overrides,
  };
}

describe('Sidebar', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalConsoleError = console.error;
  const storage = new MemoryStorage();

  it('builds gateway attach routes for the selected conversation', () => {
    expect(buildGatewayConversationAttachRoute('conv 1/slash')).toBe('/gateways?conversationId=conv%201%2Fslash');
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:02.000Z'));
    storage.clear();
    resetRemoteConversationLayoutCache();
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123']));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    extensionRegistryMock.state.extensions = [];
    extensionRegistryMock.state.surfaces = [];
    extensionRegistryMock.state.threadHeaderActions = [];
    extensionRegistryMock.state.contextMenus = [];
    extensionRegistryMock.state.activityTreeItemActions = [];
    extensionRegistryMock.state.activityTreeItemStyles = [];
    sessionStore.reset?.();
    taskStore.reset?.();
    runStore.reset?.();
    executionStore.reset?.();
    conversationActivityStatusStore.reset();
    titleStore.reset();
    apiMocks.sidebarConversations.mockReset();
    apiMocks.sidebarConversations.mockImplementation(async () => ({
      sessionIds: JSON.parse(storage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      pinnedSessionIds: JSON.parse(storage.getItem(PINNED_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      archivedSessionIds: JSON.parse(storage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      workspacePaths: JSON.parse(storage.getItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY) ?? '[]') as string[],
      sessions: sessionStore.getAll(),
    }));
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('useLayoutEffect does nothing on the server')) {
        return;
      }

      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  function renderSidebar(
    pathname = '/conversations/new',
    options?: {
      sessions?: SessionMeta[];
      tasks?: ScheduledTaskSummary[];
      liveTitles?: Map<string, string>;
      runs?: DurableRunListResult;
      executions?: ExecutionListResult;
    },
  ) {
    // Seed the reactive entity store so the Sidebar reads the same data
    // that the test passes through AppDataContext.
    const testSessions = options?.sessions ?? [createSession()];
    if (testSessions.length > 0) {
      sessionStore.replaceAll(testSessions);
      sessionStore.markReady?.();
    }
    applyRemoteConversationLayout({
      sessionIds: JSON.parse(storage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      pinnedSessionIds: JSON.parse(storage.getItem(PINNED_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      archivedSessionIds: JSON.parse(storage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY) ?? '[]') as string[],
      workspacePaths: JSON.parse(storage.getItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY) ?? '[]') as string[],
    });
    if (options?.tasks) taskStore.replaceAll(options.tasks);
    if (options?.runs?.runs) runStore.replaceAll(options.runs.runs);
    if (options?.executions?.executions) executionStore.replaceAll(options.executions.executions);

    return renderToString(
      <MemoryRouter initialEntries={[pathname]}>
        <SseConnectionContext.Provider value={{ status: 'offline' }}>
          <AppDataContext.Provider
            value={{
              projects: [
                {
                  id: 'active-project',
                  title: 'Active project',
                  summary: 'In progress.',
                  description: 'Still being worked on.',
                  createdAt: '2026-03-16T10:00:00.000Z',
                  updatedAt: '2026-03-16T12:00:00.000Z',
                  requirements: { goal: 'Ship the work.', acceptanceCriteria: [] },
                  status: 'in_progress',
                  blockers: [],
                  recentProgress: [],
                  plan: { milestones: [], tasks: [] },
                  profile: 'assistant',
                },
              ],
              sessions: options?.sessions ?? [createSession()],
              tasks: options?.tasks ?? null,
              runs: options?.runs ?? null,
              executions: options?.executions ?? null,
              setProjects: () => {},
              setSessions: () => {},
              setTasks: () => {},
              setRuns: () => {},
              setExecutions: () => {},
            }}
          >
            <LiveTitlesContext.Provider value={{ titles: options?.liveTitles ?? new Map(), setTitle: () => {} }}>
              <Sidebar />
            </LiveTitlesContext.Provider>
          </AppDataContext.Provider>
        </SseConnectionContext.Provider>
      </MemoryRouter>,
    );
  }

  it('renders a fresh timestamp for active conversations that are not in the session list yet', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    const html = renderSidebar('/conversations/brand-new', { sessions: [], liveTitles: new Map([['brand-new', '(image attachment)']]) });

    expect(html).toContain('(image attachment)');
    expect(html).toContain('now');
    expect(html).not.toContain('Dec 31');
  });

  it('renders a flat primary nav for core workspaces', () => {
    const html = renderSidebar('/conversations/new');

    expect(html.indexOf('Chat')).toBeLessThan(html.indexOf('Threads'));
    expect(html).not.toContain('Open Conversations');
    expect(html).not.toContain('Pinned Conversations');
    expect(html).not.toContain('Alerts');
    expect(html).not.toContain('Notifications');
    expect(html).not.toContain('Runs');
    expect(html).toContain('Threads');
    expect(html).toContain('aria-label="Organize and sort threads"');
    expect(html).toContain('aria-label="Find threads and archived conversations"');
    expect(html).toContain('aria-label="Add workspace"');
    expect(html).not.toContain('Conversations');
    expect(html).not.toContain('Docs');
    expect(html).not.toContain('Capabilities');
    expect(html).not.toContain('Needs review');
    expect(html).not.toContain('Archived');
  });

  it('can hide Knowledge from the left nav for workbench layouts', () => {
    const html = renderSidebar('/conversations/new', { hideKnowledgeNav: true });

    expect(html).toContain('Chat');
    expect(html).not.toContain('data-route="/knowledge"');
  });

  it('keeps pinned conversations in the main conversation list with a subtle pin indicator', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123']));
    storage.setItem(PINNED_NOTE_IDS_STORAGE_KEY, JSON.stringify(['note-index']));

    const html = renderSidebar('/conversations/new');

    expect(html).not.toContain('Pinned Conversations');
    expect(html).toContain('Clarify background run link');
    expect(html).toContain('aria-label="Pinned chat"');
    expect(html).not.toContain('aria-label="Pin"');
  });

  it('renders compact left-edge indicators for running and review states', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-running', 'conv-review']));

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({ id: 'conv-running', title: 'Active conversation', isRunning: true }),
        createSession({ id: 'conv-review', title: 'Unread follow-up', file: '/tmp/conv-review.jsonl', needsAttention: true }),
      ],
    });

    expect(html).toContain('aria-label="Running conversation"');
    expect(html).toContain('aria-label="Conversation needs review"');
    expect(html).toContain('ui-spinner');
    expect(html).not.toContain('>running<');
    expect(html).not.toContain('>needs review<');
  });

  it('keeps live title overrides scoped to the matching conversation id', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123', 'conv-456']));
    titleStore.set('conv-123', 'Fresh live title A');
    titleStore.set('conv-456', 'Fresh live title B');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({ id: 'conv-123', title: 'First conversation' }),
        createSession({ id: 'conv-456', title: 'Second conversation' }),
      ],
    });

    expect(html).toContain('Fresh live title A');
    expect(html).toContain('Fresh live title B');
    expect(html).not.toContain('First conversation');
    expect(html).not.toContain('Second conversation');
    expect((html.match(/Fresh live title A/g) ?? []).length).toBe(1);
    expect((html.match(/Fresh live title B/g) ?? []).length).toBe(1);
  });

  it('renders an open conversation only once when the hydrated session data catches up', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-dup-guard']));

    const html = renderSidebar('/conversations/conv-dup-guard', {
      sessions: [createSession({ id: 'conv-dup-guard', title: 'Sidebar duplicate guard validation' })],
    });

    expect((html.match(/data-sidebar-session-id="conv-dup-guard"/g) ?? []).length).toBe(1);
    expect((html.match(/Sidebar duplicate guard validation/g) ?? []).length).toBe(1);
  });

  it('renders the conversation timestamp in the trailing inline slot by default', () => {
    const html = renderSidebar('/conversations/new', {
      sessions: [createSession({ title: 'Single-line timestamp row' })],
    });

    expect(html).toContain('Single-line timestamp row');
    expect(html).toContain('ui-sidebar-session-time');
    expect(html).toContain('30m');
    expect(html).toContain('shrink-0 whitespace-nowrap');
  });

  it('filters automation-owned threads without labeling idle rows as active automation', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-auto', 'conv-human']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-filter'), 'automation');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({ id: 'conv-auto', title: 'Daily release brief' }),
        createSession({ id: 'conv-human', title: 'Human thread' }),
      ],
      tasks: [
        {
          id: 'daily-release-brief',
          title: 'Daily release brief',
          scheduleType: 'cron',
          running: false,
          enabled: true,
          prompt: 'Summarize releases.',
          threadConversationId: 'conv-auto',
        },
      ],
    });

    expect(html).toContain('Daily release brief');
    expect(html).not.toContain('>auto<');
    expect(html).not.toContain('Human thread');
    expect(html).not.toContain('No automation threads yet.');
  });

  it('shows an automation-specific empty state when the automation filter has no matches', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-human']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-filter'), 'automation');

    const html = renderSidebar('/conversations/new', {
      sessions: [createSession({ id: 'conv-human', title: 'Human thread' })],
      tasks: [],
    });

    expect(html).toContain('No automation threads yet.');
    expect(html).not.toContain('Human thread');
  });

  it('renders only one empty thread message when there are no conversations', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    sessionStore.markReady?.();

    const html = renderSidebar('/conversations/new', { sessions: [] });

    expect(html).toContain('No conversations yet.');
    expect(html).not.toContain('No open conversations yet.');
    expect((html.match(/No conversations yet\./g) ?? []).length).toBe(1);
  });

  it('renders automation-owned threads as background work when the conversation is not a live local session', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-auto']));

    const html = renderSidebar('/conversations/new', {
      sessions: [createSession({ id: 'conv-auto', title: 'Morning briefing thread', isRunning: false })],
      tasks: [
        {
          id: 'morning-briefing',
          title: 'Morning briefing',
          scheduleType: 'cron',
          running: true,
          enabled: true,
          prompt: 'Assemble the morning briefing.',
          threadConversationId: 'conv-auto',
        },
      ],
    });

    expect(html).toContain('aria-label="Background work running"');
    expect(html).not.toContain('aria-label="Running conversation"');
    expect(html).not.toContain('ui-spinner');
    expect(html).toContain('Morning briefing thread');
  });

  it('does not keep a stale scheduled-run hourglass after the owning automation is idle', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-auto']));

    const html = renderSidebar('/conversations/new', {
      sessions: [createSession({ id: 'conv-auto', title: 'Morning briefing thread', isRunning: false })],
      tasks: [
        {
          id: 'morning-briefing',
          title: 'Morning briefing',
          scheduleType: 'cron',
          running: false,
          enabled: true,
          prompt: 'Assemble the morning briefing.',
          threadConversationId: 'conv-auto',
        },
      ],
      executions: {
        executions: [
          {
            id: 'run-1',
            kind: 'scheduled-task',
            visibility: 'system',
            conversationId: 'conv-auto',
            title: 'Morning briefing',
            status: 'running',
            taskId: 'morning-briefing',
            capabilities: { canCancel: false, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
          },
        ],
      },
    });

    expect(html).toContain('Morning briefing thread');
    expect(html).not.toContain('aria-label="Background work running"');
  });

  it('uses a subagent glyph for subagent-only background work', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-agent']));

    const html = renderSidebar('/conversations/new', {
      sessions: [createSession({ id: 'conv-agent', title: 'Review thread', isRunning: false })],
      executions: {
        executions: [
          {
            id: 'run-agent-1',
            kind: 'subagent',
            visibility: 'primary',
            conversationId: 'conv-agent',
            title: 'code-review',
            status: 'running',
            capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
          },
        ],
      },
    });

    expect(html).toContain('aria-label="Background work running"');
    expect(html).toContain('✦');
    expect(html).not.toContain('›_');
  });

  it('groups open conversations by working directory with collapsible headers and quick-start actions', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-a1', 'conv-b1', 'conv-a2']));

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({ id: 'conv-a1', title: 'First alpha conversation', cwd: '/tmp/alpha-worktree', cwdSlug: 'alpha-worktree' }),
        createSession({
          id: 'conv-b1',
          title: 'Only beta conversation',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          file: '/tmp/conv-b1.jsonl',
        }),
        createSession({
          id: 'conv-a2',
          title: 'Second alpha conversation',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          file: '/tmp/conv-a2.jsonl',
        }),
      ],
    });

    expect((html.match(/alpha-worktree/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/beta-worktree/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('data-sidebar-group-key="/tmp/alpha-worktree"');
    expect(html).toContain('title="Workspace actions for alpha-worktree"');
    expect(html).toContain('title="New conversation in alpha-worktree"');
    expect(html).not.toContain('title="Workspace actions for /tmp/alpha-worktree"');
    expect(html).not.toContain('title="New conversation in /tmp/alpha-worktree"');
    expect(html).toContain('aria-label="Collapse alpha-worktree"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('>2</span>');
    expect(html.indexOf('alpha-worktree')).toBeLessThan(html.indexOf('First alpha conversation'));
    expect(html.indexOf('First alpha conversation')).toBeLessThan(html.indexOf('Second alpha conversation'));
    expect(html.indexOf('Second alpha conversation')).toBeLessThan(html.indexOf('beta-worktree'));
  });

  it('groups legacy neutral chat cwd sessions under Chats instead of the backing workspace path', () => {
    const neutralPath = '/tmp/neon-pilot-runtime/chat-workspaces/shared';
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-chat']));

    const html = renderSidebar('/conversations/conv-chat', {
      sessions: [
        createSession({
          id: 'conv-chat',
          title: 'Plain chat',
          cwd: neutralPath,
          cwdSlug: 'shared',
        }),
      ],
    });

    expect(html).toContain('data-sidebar-group-key="__no-cwd__"');
    expect(html).toContain('aria-label="Collapse Chats"');
    expect(html).toContain('Plain chat');
    expect(html).not.toContain('chat-workspaces/shared');
    expect(html).not.toContain('neon-pilot-runtime');
  });

  it('keeps neutral workspaceCwd sessions under Chats', () => {
    const neutralPath = '/tmp/neon-pilot-runtime/chat-workspaces/shared';
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-chat']));

    const html = renderSidebar('/conversations/conv-chat', {
      sessions: [
        createSession({
          id: 'conv-chat',
          title: 'Plain chat',
          cwd: neutralPath,
          cwdSlug: 'shared',
          workspaceCwd: neutralPath,
        }),
      ],
    });

    expect(html).toContain('data-sidebar-group-key="__no-cwd__"');
    expect(html).toContain('aria-label="Collapse Chats"');
    expect(html).not.toContain('chat-workspaces/shared');
  });

  it('hides conversation rows for collapsed cwd groups', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-collapsed-cwd-groups'), JSON.stringify(['/home/user/project']));

    const html = renderSidebar('/conversations/new');

    expect(html).toContain('aria-label="Expand project"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Clarify background run link');
  });

  it('shows saved workspaces even when they have no threads yet', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/alpha-worktree']));

    const html = renderSidebar('/conversations/new', { sessions: [] });

    expect(html).toContain('alpha-worktree');
    expect(html).toContain('title="New conversation in alpha-worktree"');
    expect(html).toContain('aria-label="Workspace actions for alpha-worktree"');
    expect(html).not.toContain('title="New conversation in /tmp/alpha-worktree"');
    expect(html).not.toContain('aria-label="Workspace actions for /tmp/alpha-worktree"');
    expect(html).toContain('data-sidebar-group-key="/tmp/alpha-worktree"');
    expect(html).not.toContain('No open conversations yet.');
  });

  it('disambiguates saved workspaces that share the same basename', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    storage.setItem(
      SAVED_WORKSPACE_PATHS_STORAGE_KEY,
      JSON.stringify(['/home/user/personal/neon-pilot', '/home/user/documents/neon-pilot']),
    );

    const html = renderSidebar('/conversations/new', { sessions: [] });

    expect(html).toContain('personal/neon-pilot');
    expect(html).toContain('documents/neon-pilot');
    expect(html).not.toContain('aria-label="Collapse neon-pilot"');
  });

  it('coalesces saved workspaces and threads that only differ by trailing slashes', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-alpha']));
    storage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/alpha-worktree/']));

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-alpha',
          title: 'Alpha thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
        }),
      ],
    });

    expect(html.match(/aria-label="Collapse alpha-worktree"/g) ?? []).toHaveLength(1);
  });

  it('renders saved custom cwd group labels when present', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123']));
    storage.setItem(
      buildSidebarNavSectionStorageKey('threads-cwd-group-label-overrides'),
      JSON.stringify({ '/home/user/project': 'Desktop' }),
    );

    const html = renderSidebar('/conversations/new');

    expect(html).toContain('Desktop');
    expect(html).not.toContain('aria-label="Collapse neon-pilot"');
    expect(html).toContain('aria-label="Collapse Desktop"');
  });

  it('keeps workspace groups in the saved workspace order even when thread activity changes', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-alpha', 'conv-beta']));
    storage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/beta-worktree', '/tmp/alpha-worktree']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'updated');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-alpha',
          title: 'Alpha thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
        createSession({
          id: 'conv-beta',
          title: 'Beta thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:35:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('beta-worktree')).toBeLessThan(html.indexOf('alpha-worktree'));
    expect(html.indexOf('beta-worktree')).toBeLessThan(html.indexOf('Beta thread'));
    expect(html.indexOf('alpha-worktree')).toBeLessThan(html.indexOf('Alpha thread'));
  });

  it('brings pinned conversations and their workspace to the top of the project list', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-beta']));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-alpha']));
    storage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/beta-worktree', '/tmp/alpha-worktree']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'updated');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-alpha',
          title: 'Pinned alpha thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:05:00.000Z',
        }),
        createSession({
          id: 'conv-beta',
          title: 'Beta thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('alpha-worktree')).toBeLessThan(html.indexOf('beta-worktree'));
    expect(html.indexOf('Pinned alpha thread')).toBeLessThan(html.indexOf('beta-worktree'));
    expect(html.indexOf('Pinned alpha thread')).toBeLessThan(html.indexOf('Beta thread'));
  });

  it('can render a flat chronological thread list sorted by the saved sort mode', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-older', 'conv-newer']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'chronological');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'updated');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-older',
          title: 'Older thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:35:00.000Z',
        }),
        createSession({
          id: 'conv-newer',
          title: 'Newer thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
      ],
    });

    expect(html).not.toContain('aria-label="Collapse alpha-worktree"');
    expect(html).not.toContain('aria-label="Collapse beta-worktree"');
    expect(html.indexOf('Newer thread')).toBeLessThan(html.indexOf('Older thread'));
  });

  it('sorts malformed thread activity timestamps after valid chronological items', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-valid', 'conv-malformed']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'chronological');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'updated');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-malformed',
          title: 'Malformed activity thread',
          lastActivityAt: '9999',
        }),
        createSession({
          id: 'conv-valid',
          title: 'Valid activity thread',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('Valid activity thread')).toBeLessThan(html.indexOf('Malformed activity thread'));
  });

  it('defaults to sorting threads by created time when no sort preference is saved', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-earlier', 'conv-later']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'chronological');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-earlier',
          title: 'Earlier created thread',
          timestamp: '2026-03-16T09:05:00.000Z',
          lastActivityAt: '2026-03-16T09:59:00.000Z',
        }),
        createSession({
          id: 'conv-later',
          title: 'Later created thread',
          timestamp: '2026-03-16T09:45:00.000Z',
          lastActivityAt: '2026-03-16T09:10:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('Later created thread')).toBeLessThan(html.indexOf('Earlier created thread'));
  });

  it('can sort threads by created time when that preference is saved', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-earlier', 'conv-later']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'chronological');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'created');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-earlier',
          title: 'Earlier created thread',
          timestamp: '2026-03-16T09:05:00.000Z',
          lastActivityAt: '2026-03-16T09:59:00.000Z',
        }),
        createSession({
          id: 'conv-later',
          title: 'Later created thread',
          timestamp: '2026-03-16T09:45:00.000Z',
          lastActivityAt: '2026-03-16T09:10:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('Later created thread')).toBeLessThan(html.indexOf('Earlier created thread'));
  });

  it('can render a flat thread list in explicit pinned and open order when manual order is selected', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-second', 'conv-third']));
    storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-first']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'chronological');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'manual');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-first',
          title: 'Pinned first thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:05:00.000Z',
        }),
        createSession({
          id: 'conv-second',
          title: 'Second thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
        createSession({
          id: 'conv-third',
          title: 'Third thread',
          cwd: '/tmp/gamma-worktree',
          cwdSlug: 'gamma-worktree',
          lastActivityAt: '2026-03-16T09:15:00.000Z',
        }),
      ],
    });

    expect(html).not.toContain('aria-label="Collapse alpha-worktree"');
    expect(html.indexOf('Pinned first thread')).toBeLessThan(html.indexOf('Second thread'));
    expect(html.indexOf('Second thread')).toBeLessThan(html.indexOf('Third thread'));
  });

  it('can keep project groups while honoring manual thread order within each project', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-alpha-2', 'conv-beta-1', 'conv-alpha-1']));
    storage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/alpha-worktree', '/tmp/beta-worktree']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'project');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'manual');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-alpha-1',
          title: 'Alpha first thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:05:00.000Z',
        }),
        createSession({
          id: 'conv-beta-1',
          title: 'Beta thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
        createSession({
          id: 'conv-alpha-2',
          title: 'Alpha second thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:15:00.000Z',
        }),
      ],
    });

    expect(html.indexOf('alpha-worktree')).toBeLessThan(html.indexOf('beta-worktree'));
    expect(html.indexOf('Alpha second thread')).toBeLessThan(html.indexOf('Alpha first thread'));
    expect(html.indexOf('Alpha first thread')).toBeLessThan(html.indexOf('Beta thread'));
  });

  it('maps the legacy manual organize preference to chronological manual order', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-legacy-1', 'conv-legacy-2']));
    storage.setItem(buildSidebarNavSectionStorageKey('threads-organize'), 'manual');
    storage.setItem(buildSidebarNavSectionStorageKey('threads-sort-by'), 'updated');

    const html = renderSidebar('/conversations/new', {
      sessions: [
        createSession({
          id: 'conv-legacy-1',
          title: 'Legacy first thread',
          cwd: '/tmp/alpha-worktree',
          cwdSlug: 'alpha-worktree',
          lastActivityAt: '2026-03-16T09:05:00.000Z',
        }),
        createSession({
          id: 'conv-legacy-2',
          title: 'Legacy second thread',
          cwd: '/tmp/beta-worktree',
          cwdSlug: 'beta-worktree',
          lastActivityAt: '2026-03-16T09:55:00.000Z',
        }),
      ],
    });

    expect(html).not.toContain('aria-label="Collapse alpha-worktree"');
    expect(html.indexOf('Legacy first thread')).toBeLessThan(html.indexOf('Legacy second thread'));
  });

  it('keeps open conversation rows draggable so sidebar reordering still works', () => {
    const html = renderSidebar('/conversations/new');

    expect(html).toContain('draggable="true"');
    expect(html).toContain('Drag to reorder conversations');
    expect(html).not.toContain('move between pinned and open conversations');
  });

  it('renders active child conversations as flat draggable rows', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['child-1', 'conv-123']));

    const html = renderSidebar('/conversations/child-1', {
      sessions: [
        createSession({ id: 'conv-123', title: 'Parent conversation' }),
        createSession({
          id: 'child-1',
          file: '/tmp/child-1.jsonl',
          title: 'Child subagent conversation',
          parentSessionId: 'conv-123',
        }),
      ],
    });

    expect(html).toContain('Parent conversation');
    expect(html).toContain('Child subagent conversation');
    expect(html).not.toContain('aria-label="Collapse Parent conversation"');
    expect(html).not.toContain('style="padding-left:1rem"');
  });

  it('hides archived child conversations even when their parent remains visible', () => {
    storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-123']));
    storage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['child-1']));

    const html = renderSidebar('/conversations/conv-123', {
      sessions: [
        createSession({ id: 'conv-123', title: 'Parent conversation' }),
        createSession({
          id: 'child-1',
          file: '/tmp/child-1.jsonl',
          title: 'Closed subagent conversation',
          parentSessionId: 'conv-123',
          offshootKind: 'subagent',
        }),
      ],
    });

    expect(html).toContain('Parent conversation');
    expect(html).not.toContain('Closed subagent conversation');
  });

  it('keeps the sidebar focused on chat and system surfaces', () => {
    storage.setItem(OPEN_NOTE_IDS_STORAGE_KEY, JSON.stringify(['note-index']));
    storage.setItem(OPEN_SKILL_IDS_STORAGE_KEY, JSON.stringify(['agent-browser']));

    const html = renderSidebar('/conversations/new');

    expect(html).not.toContain('Open Docs');
    expect(html).not.toContain('Draft doc');
    expect(html).not.toContain('Open Workspaces');
  });

  it('highlights Chat on the new conversation route', () => {
    const html = renderSidebar('/conversations/new');

    expect(html).toContain('Chat');
    expect(html).toContain('ui-sidebar-nav-item-active');
    expect(html).toContain('<div class="relative"><button');
    expect(html).not.toContain('<div class="relative px-1"><button');
    expect(html).toContain('ui-sidebar-nav-item ui-sidebar-nav-item-active w-[calc(100%_-_0.5rem)] min-w-0 pr-10');
    expect(html).not.toContain('ui-sidebar-nav-item ui-sidebar-nav-item-active w-full');
    expect(html).toContain('ui-icon-button ui-icon-button-compact');
    expect(html).toContain('absolute right-1 top-0 z-10');
    expect(html).not.toContain('ui-sidebar-session-row-active');
  });

  it('keeps knowledge files out of the core sidebar', () => {
    const html = renderSidebar('/knowledge?file=AGENTS.md');

    expect(html).not.toContain('Open Files');
    expect(html).not.toContain('aria-label="Open file AGENTS.md"');
    expect(html).not.toContain('Threads');
    expect(html).toContain('aria-label="No contextual sidebar"');
  });

  it('replaces the thread list with an active extension sidebar surface', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'hermes-remote-agent',
        enabled: true,
        packageType: 'user',
        contributes: {
          nav: [
            {
              id: 'nav',
              label: 'Hermes',
              route: '/ext/hermes',
              icon: 'sparkle',
              sidebarView: 'sessions-sidebar',
            },
          ],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'hermes-remote-agent',
        id: 'sessions-sidebar',
        title: 'Hermes Sessions',
        location: 'sidebar',
        component: 'HermesSessionsSidebar',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    const html = renderSidebar('/ext/hermes?session=abc#events');

    expect(html).toContain('Hermes');
    expect(html).toContain('data-testid="mock-sidebar-extension-surface"');
    expect(html).toContain('data-surface-id="sessions-sidebar"');
    expect(html).toContain('data-instance-id="left-sidebar"');
    expect(html).toContain('data-pathname="/ext/hermes"');
    expect(html).toContain('data-search="?session=abc"');
    expect(html).toContain('data-hash="#events"');
    expect(html).toContain('Hermes Sessions');
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('relative z-20 shrink-0 space-y-px bg-panel pb-1 pt-3');
    expect(html).toContain('relative z-0 isolate flex-1 min-h-0 overflow-hidden');
    expect(html).toContain('style="contain:layout paint"');
    expect(html).not.toContain('ui-section-label flex-1">Threads');
    expect(html).not.toContain('aria-label="Find threads and archived conversations"');
  });

  it('leaves the contextual sidebar blank when a declared extension sidebar surface is missing', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'hermes-remote-agent',
        enabled: true,
        packageType: 'user',
        contributes: {
          nav: [
            {
              id: 'nav',
              label: 'Hermes',
              route: '/ext/hermes',
              icon: 'sparkle',
              sidebarView: 'missing-sidebar',
            },
          ],
        },
      },
    ];
    extensionRegistryMock.state.routes = [{ route: '/ext/hermes' }];
    extensionRegistryMock.state.surfaces = [];

    const html = renderSidebar('/ext/hermes');

    expect(html).toContain('Hermes');
    expect(html).toContain('aria-label="No contextual sidebar"');
    expect(html).not.toContain('data-testid="mock-sidebar-extension-surface"');
    expect(html).not.toContain('ui-section-label flex-1">Threads');
  });

  it('ignores contextual sidebar declarations from disabled extensions', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'hermes-remote-agent',
        enabled: false,
        packageType: 'user',
        contributes: {
          nav: [
            {
              id: 'nav',
              label: 'Hermes',
              route: '/ext/hermes',
              icon: 'sparkle',
              sidebarView: 'sessions-sidebar',
            },
          ],
        },
      },
    ];
    extensionRegistryMock.state.routes = [{ route: '/ext/hermes' }];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'hermes-remote-agent',
        id: 'sessions-sidebar',
        title: 'Hermes Sessions',
        location: 'sidebar',
        component: 'HermesSessionsSidebar',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    const html = renderSidebar('/ext/hermes');

    expect(html).not.toContain('Hermes');
    expect(html).toContain('aria-label="No contextual sidebar"');
    expect(html).not.toContain('data-testid="mock-sidebar-extension-surface"');
    expect(html).not.toContain('ui-section-label flex-1">Threads');
  });

  it('restores native thread controls after leaving an extension sidebar surface', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'hermes-remote-agent',
        enabled: true,
        packageType: 'user',
        contributes: {
          nav: [
            {
              id: 'nav',
              label: 'Hermes',
              route: '/ext/hermes',
              icon: 'sparkle',
              sidebarView: 'sessions-sidebar',
            },
          ],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'hermes-remote-agent',
        id: 'sessions-sidebar',
        title: 'Hermes Sessions',
        location: 'sidebar',
        component: 'HermesSessionsSidebar',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    const extensionHtml = renderSidebar('/ext/hermes');
    expect(extensionHtml).toContain('data-testid="mock-sidebar-extension-surface"');
    expect(extensionHtml).not.toContain('aria-label="Find threads and archived conversations"');

    const chatHtml = renderSidebar('/conversations/conv-123');
    expect(chatHtml).not.toContain('data-testid="mock-sidebar-extension-surface"');
    expect(chatHtml).toContain('aria-label="Find threads and archived conversations"');
    expect(chatHtml).toContain('Clarify background run link');
    expect(chatHtml).toContain('ui-sidebar-session-row-active');
  });

  it('hides enabled extension nav entries that do not have a registered route or sidebar surface', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'hermes-remote-agent',
        enabled: true,
        packageType: 'user',
        contributes: {
          nav: [
            {
              id: 'nav',
              label: 'Hermes',
              route: '/hermes',
              icon: 'sparkle',
            },
          ],
        },
      },
    ];
    extensionRegistryMock.state.routes = [];
    extensionRegistryMock.state.surfaces = [];

    const html = renderSidebar('/conversations/new');

    expect(html).not.toContain('Hermes');
    expect(html).not.toContain('data-route="/hermes"');
  });

  it('keeps Chat neutral on conversation routes while the selected thread owns the active chrome', () => {
    const html = renderSidebar('/conversations/conv-123');

    expect(html).toContain('Chat');
    expect(html).not.toContain('ui-sidebar-nav-item-active');
    expect(html).toContain('ui-sidebar-session-row-active');
    expect(html).toContain('ui-sidebar-session-time');
    expect(html).toContain('30m');
    expect(html).not.toContain('aria-label="Conversation actions: Clarify background run link"');
    expect(html).not.toContain('aria-label="Pin"');
    expect(html).not.toContain('>Conversations<');
  });

  it('renders the settings nav section at the bottom with extension-contributed items', () => {
    const html = renderSidebar('/settings');
    expect(html).not.toContain('Threads');
    expect(html).toContain('aria-label="No contextual sidebar"');
    expect(html).toContain('<div class="border-t border-border-subtle px-0 py-2 space-y-0.5">');
  });

  it('orders bottom utility nav as Skills, App Manager, then Settings', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'system-settings',
        name: 'Settings',
        enabled: true,
        contributes: {
          nav: [{ id: 'settings-nav', label: 'Settings', route: '/settings', icon: 'gear', section: 'settings' }],
        },
      },
      {
        id: 'system-extension-manager',
        name: 'App Manager',
        enabled: true,
        contributes: {
          nav: [{ id: 'extensions-nav', label: 'App Manager', route: '/apps', icon: 'sparkle', section: 'settings' }],
        },
      },
      {
        id: 'system-skills',
        name: 'Skills',
        enabled: true,
        contributes: {
          nav: [{ id: 'skills-nav', label: 'Skills', route: '/skills', icon: 'sparkle', section: 'settings' }],
        },
      },
    ];
    extensionRegistryMock.state.routes = [{ route: '/settings' }, { route: '/apps' }, { route: '/skills' }];

    const html = renderSidebar('/settings');

    expect(html.indexOf('data-route="/skills"')).toBeLessThan(html.indexOf('data-route="/apps"'));
    expect(html.indexOf('data-route="/apps"')).toBeLessThan(html.indexOf('data-route="/settings"'));
  });

  describe('visual state indicators', () => {
    it('renders no status indicator for an idle conversation', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-idle']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-idle', title: 'Idle conversation', isRunning: false })],
      });

      expect(html).toContain('Idle conversation');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('aria-label="Background work running"');
      expect(html).not.toContain('aria-label="Conversation needs review"');
      expect(html).not.toContain('ui-spinner');
    });

    it('shows a spinning indicator for a running live conversation', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-running']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-running', title: 'Active task', isRunning: true })],
      });

      expect(html).toContain('aria-label="Running conversation"');
      expect(html).toContain('ui-spinner');
      expect(html).toContain('title="Agent is still running"');
      expect(html).not.toContain('aria-label="Background work running"');
      expect(html).not.toContain('aria-label="Conversation needs review"');
    });

    it('shows backend runtime state for the active conversation even when it is not in the saved workspace', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
      conversationRuntimeStore.apply({
        id: 'conv-active-runtime',
        running: true,
        revision: 1,
        updatedAt: '2026-03-16T10:00:00.000Z',
      });

      const html = renderSidebar('/conversations/conv-active-runtime', {
        sessions: [createSession({ id: 'conv-active-runtime', title: 'Runtime active task', isRunning: false })],
      });

      expect(html).toContain('Runtime active task');
      expect(html).toContain('aria-label="Running conversation"');
      expect(html).toContain('ui-spinner');
      expect(html).not.toContain('aria-label="Background work running"');
    });

    it('lets backend runtime state clear stale running session snapshots', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-stale-running']));
      conversationRuntimeStore.apply({
        id: 'conv-stale-running',
        running: false,
        revision: 1,
        updatedAt: '2026-03-16T10:00:00.000Z',
      });

      const html = renderSidebar('/conversations/conv-stale-running', {
        sessions: [createSession({ id: 'conv-stale-running', title: 'Actually idle task', isRunning: true })],
      });

      expect(html).toContain('Actually idle task');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('ui-spinner');
      expect(html).toContain('ui-sidebar-session-time');
    });

    it('shows a subagent glyph for subagent background work when the session is not running', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-subagent']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-subagent', title: 'Review thread', isRunning: false })],
        executions: {
          executions: [
            {
              id: 'run-sub-1',
              kind: 'subagent',
              visibility: 'primary',
              conversationId: 'conv-subagent',
              title: 'code-review',
              status: 'running',
              capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
            },
          ],
        },
      });

      expect(html).toContain('aria-label="Background work running"');
      expect(html).toContain('✦');
      expect(html).toContain('title="Background work is running"');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('ui-spinner');
      expect(html).not.toContain('aria-label="Conversation needs review"');
    });

    it('shows a command glyph for command background work when the session is not running', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-cmd']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-cmd', title: 'Bash script', isRunning: false })],
        executions: {
          executions: [
            {
              id: 'run-cmd-1',
              kind: 'background-command',
              visibility: 'primary',
              conversationId: 'conv-cmd',
              title: 'npm run build',
              status: 'running',
              capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
            },
          ],
        },
      });

      expect(html).toContain('aria-label="Background work running"');
      expect(html).toContain('›_');
      expect(html).toContain('title="Background work is running"');
      expect(html).not.toContain('✦');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('ui-spinner');
    });

    it('shows a needs-review dot when the conversation needs attention with no pending work', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-needs-attention']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-needs-attention', title: 'Unread reply', isRunning: false, needsAttention: true })],
      });

      expect(html).toContain('aria-label="Conversation needs review"');
      expect(html).toContain('title="Stopped with new output or linked updates you have not viewed yet"');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('aria-label="Background work running"');
      expect(html).not.toContain('ui-spinner');
    });

    it('prefers the running indicator over needs-review when both are true', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-both']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-both', title: 'Busy thread', isRunning: true, needsAttention: true })],
      });

      // Running takes priority — the needs-review indicator should not render.
      expect(html).toContain('aria-label="Running conversation"');
      expect(html).toContain('ui-spinner');
      expect(html).not.toContain('aria-label="Conversation needs review"');
      expect(html).not.toContain('bg-warning');
    });

    it('shows the pinned icon for pinned conversations alongside the running indicator', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
      storage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-pinned-running']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-pinned-running', title: 'Pinned active task', isRunning: true })],
      });

      expect(html).toContain('aria-label="Pinned chat"');
      expect(html).toContain('aria-label="Running conversation"');
      expect(html).toContain('ui-spinner');
      expect(html).toContain('Pinned active task');
    });

    it('applies the active row class to the currently selected conversation', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-active']));

      const html = renderSidebar('/conversations/conv-active', {
        sessions: [createSession({ id: 'conv-active', title: 'Selected conversation' })],
      });

      expect(html).toContain('ui-sidebar-session-row-active');
      expect(html).toContain('Selected conversation');
    });

    it('does not apply the active row class to unselected conversations', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-a', 'conv-b']));

      const html = renderSidebar('/conversations/conv-a', {
        sessions: [createSession({ id: 'conv-a', title: 'Selected' }), createSession({ id: 'conv-b', title: 'Not selected' })],
      });

      const activeIndex = html.indexOf('ui-sidebar-session-row-active');
      expect(activeIndex).toBeGreaterThanOrEqual(0);
      // The non-selected conversation row comes after the selected one.
      const notSelectedIndex = html.indexOf('Not selected');
      expect(notSelectedIndex).toBeGreaterThan(activeIndex);
      expect(html.match(/ui-sidebar-session-row-active/g)).toHaveLength(1);
    });

    it('shows automation-owned threads as background work without forcing conversation running', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-auto-force']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-auto-force', title: 'Automation thread', isRunning: false })],
        tasks: [
          {
            id: 'auto-task',
            title: 'Auto task',
            scheduleType: 'cron',
            running: true,
            enabled: true,
            prompt: 'Do the thing.',
            threadConversationId: 'conv-auto-force',
          },
        ],
      });

      expect(html).toContain('aria-label="Background work running"');
      expect(html).not.toContain('aria-label="Running conversation"');
      expect(html).not.toContain('ui-spinner');
      expect(html).toContain('Automation thread');
    });

    it('only renders one status indicator even when both running and pending runs are true', () => {
      storage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-busy']));

      const html = renderSidebar('/conversations/new', {
        sessions: [createSession({ id: 'conv-busy', title: 'Busy thread', isRunning: true })],
        executions: {
          executions: [
            {
              id: 'run-busy-1',
              kind: 'background-command',
              visibility: 'primary',
              conversationId: 'conv-busy',
              title: 'npm test',
              status: 'running',
              capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
            },
          ],
        },
      });

      // Running takes priority over pending runs — only one spinner.
      const runningLabels = (html.match(/aria-label="Running conversation"/g) ?? []).length;
      const backgroundLabels = (html.match(/aria-label="Background work running"/g) ?? []).length;
      expect(runningLabels).toBe(1);
      expect(backgroundLabels).toBe(0);
    });
  });
});
