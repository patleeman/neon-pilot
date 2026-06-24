// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext } from '../app/contexts';
import { DRAWING_PICKER_OPEN_COMMAND_EVENT } from '../components/conversation/drawingPickerCommands';
import { SAVED_WORKSPACE_PATHS_STORAGE_KEY } from '../local/localSettings';
import { sessionStore } from '../store';
import { ConversationPage } from './ConversationPage';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const apiMock = vi.hoisted(() => ({
  extensionSlashCommands: vi.fn(),
  extensionMentions: vi.fn(),
  memory: vi.fn(),
  modelPreferences: vi.fn(),
  models: vi.fn(),
  runs: vi.fn(),
  settings: vi.fn(),
  sessionDetail: vi.fn(),
  liveSession: vi.fn(),
  liveSessionContext: vi.fn(),
  conversationAttachments: vi.fn(),
  conversationModelPreferences: vi.fn(),
  savedWorkspacePaths: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  pickFolder: vi.fn(),
  changeConversationCwd: vi.fn(),
  createLiveSession: vi.fn(),
  reserveConversation: vi.fn(),
  destroySession: vi.fn(),
  workspaceUncommittedDiff: vi.fn(),
}));

const sessionTabsMock = vi.hoisted(() => ({
  closeConversationTab: vi.fn(),
  ensureConversationTabOpen: vi.fn(),
  fetchRemoteConversationLayout: vi.fn(),
  isWithinLocalWriteGrace: vi.fn(),
  setActiveConversationTab: vi.fn(),
}));

const emptyExtensionRegistry = {
  extensions: [],
  routes: [],
  surfaces: [],
  topBarElements: [],
  messageActions: [],
  composerShelves: [],
  draftConversationCreate: [],
  newConversationPanels: [],
  settingsComponent: null,
  settingsComponents: [],
  composerControls: [],
  composerInputTools: [],
  toolbarActions: [],
  contextMenus: [],
  selectionActions: [],
  threadHeaderActions: [],
  statusBarItems: [] as Array<{
    extensionId: string;
    id: string;
    label: string;
    component: string;
    alignment: 'left' | 'right';
    priority?: number;
    frontendEntry?: string | null;
  }>,
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
};

const desktopConversationState = {
  mode: 'disabled',
  active: false,
  loading: false,
  error: null,
  surfaceId: '',
  reconnect: vi.fn(),
  send: vi.fn(),
  abort: vi.fn(),
  takeover: vi.fn(),
  state: null,
};

const regressionBootstrapData = {
  conversationId: 'conv-regression',
  liveSession: {
    live: false,
    id: 'conv-regression',
    cwd: '/tmp/project',
    sessionFile: '/tmp/conv-regression.jsonl',
    title: 'Regression conversation',
    isStreaming: false,
    hasStaleTurnState: false,
  },
  sessionDetail: {
    meta: {
      id: 'conv-regression',
      file: '/tmp/conv-regression.jsonl',
      timestamp: '2026-05-27T12:00:00.000Z',
      cwd: '/tmp/project',
      cwdSlug: 'project',
      model: 'openai/gpt-5.4',
      title: 'Regression conversation',
      messageCount: 2,
      isLive: false,
    },
    blocks: [
      {
        type: 'user',
        id: 'user-1',
        ts: '2026-05-27T12:00:00.000Z',
        text: 'hello',
      },
      {
        type: 'text',
        id: 'assistant-1',
        ts: '2026-05-27T12:00:01.000Z',
        text: 'hi',
      },
    ],
    blockOffset: 0,
    totalBlocks: 2,
    contextUsage: null,
  },
};

function createDesktopStateFromRegressionBootstrap() {
  return {
    conversationId: regressionBootstrapData.conversationId,
    sessionDetail: regressionBootstrapData.sessionDetail,
    liveSession: regressionBootstrapData.liveSession,
    stream: {
      blocks: regressionBootstrapData.sessionDetail.blocks,
      blockOffset: regressionBootstrapData.sessionDetail.blockOffset,
      totalBlocks: regressionBootstrapData.sessionDetail.totalBlocks,
      hasSnapshot: true,
      isStreaming: regressionBootstrapData.liveSession.live === true && regressionBootstrapData.liveSession.isStreaming === true,
      isCompacting: false,
      error: null,
      title: regressionBootstrapData.liveSession.title,
      tokens: null,
      cost: null,
      contextUsage: null,
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [],
      presence: { surfaces: [] },
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      cwdChange: null,
    },
  };
}

function setDesktopConversationFixture(data = regressionBootstrapData) {
  desktopConversationState.mode = 'local';
  desktopConversationState.active = true;
  desktopConversationState.surfaceId = 'surface-test';
  desktopConversationState.loading = false;
  desktopConversationState.error = null;
  desktopConversationState.state = {
    conversationId: data.conversationId,
    sessionDetail: data.sessionDetail,
    liveSession: data.liveSession,
    stream: {
      blocks: data.sessionDetail.blocks,
      blockOffset: data.sessionDetail.blockOffset,
      totalBlocks: data.sessionDetail.totalBlocks,
      hasSnapshot: true,
      isStreaming: data.liveSession.live === true && data.liveSession.isStreaming === true,
      isCompacting: false,
      error: null,
      title: data.liveSession.title,
      tokens: null,
      cost: null,
      contextUsage: null,
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [],
      presence: { surfaces: [] },
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      cwdChange: null,
    },
  };
}

function createRegressionBootstrapData(conversationId: string, cwd = `/tmp/${conversationId}`) {
  return {
    conversationId,
    liveSession: {
      live: false,
      id: conversationId,
      cwd,
      sessionFile: `${cwd}/${conversationId}.jsonl`,
      title: `Regression ${conversationId}`,
      isStreaming: false,
      hasStaleTurnState: false,
    },
    sessionDetail: {
      meta: {
        id: conversationId,
        file: `${cwd}/${conversationId}.jsonl`,
        timestamp: '2026-05-27T12:00:00.000Z',
        cwd,
        cwdSlug: conversationId,
        model: 'openai/gpt-5.4',
        title: `Regression ${conversationId}`,
        messageCount: 2,
        isLive: false,
      },
      blocks: [
        {
          type: 'user',
          id: `${conversationId}-user-1`,
          ts: '2026-05-27T12:00:00.000Z',
          text: 'hello',
        },
        {
          type: 'text',
          id: `${conversationId}-assistant-1`,
          ts: '2026-05-27T12:00:01.000Z',
          text: 'hi',
        },
      ],
      blockOffset: 0,
      totalBlocks: 2,
      contextUsage: null,
    },
  };
}

vi.mock('../client/api', () => ({
  api: apiMock,
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => emptyExtensionRegistry,
}));

vi.mock('../extensions/StatusBarItemHost', () => ({
  StatusBarItemHost: ({
    statusBarContext,
  }: {
    statusBarContext: {
      branchLabel?: string | null;
      gitSummary?: { kind: 'none' } | { kind: 'summary'; text: string } | { kind: 'diff'; added: string; deleted: string };
    };
  }) => {
    const branchLabel = statusBarContext.branchLabel?.trim() || null;
    const gitSummary = statusBarContext.gitSummary;
    if (!branchLabel && (!gitSummary || gitSummary.kind === 'none')) {
      return null;
    }
    return (
      <div aria-label="Git status">
        {branchLabel}
        {gitSummary?.kind === 'summary' ? gitSummary.text : null}
        {gitSummary?.kind === 'diff' ? `${gitSummary.added}/${gitSummary.deleted}` : null}
      </div>
    );
  },
}));

vi.mock('../components/chat/ChatView', () => ({
  ChatView: ({ messages }: { messages?: Array<{ text?: string }> }) => (
    <div data-testid="chat-view">{messages?.map((message) => message.text).join('\n')}</div>
  ),
}));

vi.mock('../components/ConversationDrawingsPickerModal', () => ({
  ConversationDrawingsPickerModal: ({ attachments }: { attachments: Array<{ id: string }> }) => (
    <div data-testid="drawings-picker-modal">attachments:{attachments.map((attachment) => attachment.id).join(',')}</div>
  ),
}));

vi.mock('../hooks/useDesktopConversationState', () => ({
  primeReservedDesktopConversationStateCache: vi.fn(),
  useDesktopConversationState: () => desktopConversationState,
}));

vi.mock('../session/sessionTabs', () => ({
  closeConversationTab: sessionTabsMock.closeConversationTab,
  ensureConversationTabOpen: sessionTabsMock.ensureConversationTabOpen,
  fetchRemoteConversationLayout: sessionTabsMock.fetchRemoteConversationLayout,
  isWithinLocalWriteGrace: sessionTabsMock.isWithinLocalWriteGrace,
  setActiveConversationTab: sessionTabsMock.setActiveConversationTab,
}));

function renderConversationPage() {
  // Seed the store so ConversationPage hooks find the session data
  sessionStore.replaceAll([
    {
      id: 'conv-regression',
      file: '/tmp/conv-regression.jsonl',
      timestamp: '2026-05-27T12:00:00.000Z',
      cwd: '/tmp/project',
      cwdSlug: 'project',
      model: 'openai/gpt-5.4',
      title: 'Regression conversation',
      messageCount: 2,
      isLive: false,
    },
  ]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [
          {
            id: 'conv-regression',
            file: '/tmp/conv-regression.jsonl',
            timestamp: '2026-05-27T12:00:00.000Z',
            cwd: '/tmp/project',
            cwdSlug: 'project',
            model: 'openai/gpt-5.4',
            title: 'Regression conversation',
            messageCount: 2,
            isLive: false,
          },
        ],
        tasks: [],
        runs: null,
        executions: null,
        setProjects: vi.fn(),
        setSessions: vi.fn(),
        setTasks: vi.fn(),
        setRuns: vi.fn(),
        setExecutions: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/conversations/conv-regression']}>
        <Routes>
          <Route path="/conversations/:id" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

function renderDraftConversationPage() {
  sessionStore.replaceAll([]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [],
        tasks: [],
        runs: null,
        executions: null,
        setProjects: vi.fn(),
        setSessions: vi.fn(),
        setTasks: vi.fn(),
        setRuns: vi.fn(),
        setExecutions: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/conversations/new']}>
        <ConversationPage draft />
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

function renderMissingConversationPage() {
  sessionStore.replaceAll([]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [],
        tasks: [],
        runs: null,
        executions: null,
        setProjects: vi.fn(),
        setSessions: vi.fn(),
        setTasks: vi.fn(),
        setRuns: vi.fn(),
        setExecutions: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/conversations/missing-conv']}>
        <Routes>
          <Route path="/conversations/:id" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

function DraftConversationRouteHarness() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/conversations/new" element={<ConversationPage draft />} />
        <Route path="/conversations/:id" element={<div>Reserved conversation route</div>} />
      </Routes>
    </>
  );
}

function renderRoutedDraftConversationPage() {
  sessionStore.replaceAll([]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [],
        tasks: [],
        runs: null,
        executions: null,
        setProjects: vi.fn(),
        setSessions: vi.fn(),
        setTasks: vi.fn(),
        setRuns: vi.fn(),
        setExecutions: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/conversations/new']}>
        <DraftConversationRouteHarness />
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

function ConversationPageNavigationHarness() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/conversations/conv-next')}>
        Go next
      </button>
      <Routes>
        <Route path="/conversations/:id" element={<ConversationPage />} />
      </Routes>
    </>
  );
}

function renderSwitchableConversationPage() {
  sessionStore.replaceAll([
    {
      id: 'conv-regression',
      file: '/tmp/conv-regression.jsonl',
      timestamp: '2026-05-27T12:00:00.000Z',
      cwd: '/tmp/project',
      cwdSlug: 'project',
      model: 'openai/gpt-5.4',
      title: 'Regression conversation',
      messageCount: 2,
      isLive: false,
    },
    {
      id: 'conv-next',
      file: '/tmp/conv-next.jsonl',
      timestamp: '2026-05-27T12:05:00.000Z',
      cwd: '/tmp/next-project',
      cwdSlug: 'next-project',
      model: 'openai/gpt-5.4',
      title: 'Next regression conversation',
      messageCount: 2,
      isLive: false,
    },
  ]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [
          {
            id: 'conv-regression',
            file: '/tmp/conv-regression.jsonl',
            timestamp: '2026-05-27T12:00:00.000Z',
            cwd: '/tmp/project',
            cwdSlug: 'project',
            model: 'openai/gpt-5.4',
            title: 'Regression conversation',
            messageCount: 2,
            isLive: false,
          },
          {
            id: 'conv-next',
            file: '/tmp/conv-next.jsonl',
            timestamp: '2026-05-27T12:05:00.000Z',
            cwd: '/tmp/next-project',
            cwdSlug: 'next-project',
            model: 'openai/gpt-5.4',
            title: 'Next regression conversation',
            messageCount: 2,
            isLive: false,
          },
        ],
        tasks: [],
        runs: null,
        executions: null,
        setProjects: vi.fn(),
        setSessions: vi.fn(),
        setTasks: vi.fn(),
        setRuns: vi.fn(),
        setExecutions: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/conversations/conv-regression']}>
        <ConversationPageNavigationHarness />
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  emptyExtensionRegistry.statusBarItems.length = 0;
  desktopConversationState.mode = 'disabled';
  desktopConversationState.active = false;
  desktopConversationState.loading = false;
  desktopConversationState.error = null;
  desktopConversationState.surfaceId = '';
  desktopConversationState.reconnect.mockReset();
  desktopConversationState.send.mockReset();
  desktopConversationState.abort.mockReset();
  desktopConversationState.takeover.mockReset();
  desktopConversationState.state = null;
  apiMock.extensionSlashCommands.mockResolvedValue([
    {
      extensionId: 'test-extension',
      surfaceId: 'test',
      name: 'ext',
      description: 'Extension command',
      action: 'run',
    },
  ]);
  apiMock.extensionMentions.mockResolvedValue([
    {
      extensionId: 'test-extension',
      trigger: '@ext',
      action: 'list',
    },
  ]);
  apiMock.models.mockResolvedValue({
    models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }],
    currentModel: 'openai/gpt-5.4',
    currentVisionModel: '',
    currentThinkingLevel: 'medium',
    currentServiceTier: '',
  });
  apiMock.modelPreferences.mockResolvedValue({
    currentModel: 'openai/gpt-5.4',
    currentVisionModel: '',
    currentThinkingLevel: 'medium',
    currentServiceTier: '',
  });
  apiMock.conversationModelPreferences.mockResolvedValue({
    currentModel: 'openai/gpt-5.4',
    currentThinkingLevel: 'medium',
    currentServiceTier: '',
    hasExplicitServiceTier: false,
  });
  apiMock.memory.mockResolvedValue({ memoryDocs: [], skills: [] });
  apiMock.runs.mockResolvedValue({ runs: [] });
  apiMock.settings.mockResolvedValue({});
  apiMock.sessionDetail.mockRejectedValue(new Error('Conversation not found'));
  apiMock.liveSession.mockResolvedValue({ live: false, hasStaleTurnState: false });
  apiMock.liveSessionContext.mockResolvedValue({
    cwd: '/tmp/project',
    branch: 'main',
    git: {
      changeCount: 0,
      linesAdded: 0,
      linesDeleted: 0,
    },
  });
  apiMock.conversationAttachments.mockResolvedValue({ conversationId: 'conv-regression', attachments: [] });
  apiMock.savedWorkspacePaths.mockResolvedValue([]);
  apiMock.setSavedWorkspacePaths.mockImplementation(async (workspacePaths: string[]) => workspacePaths);
  apiMock.pickFolder.mockResolvedValue({ cancelled: true, path: null });
  apiMock.changeConversationCwd.mockResolvedValue({
    id: 'conv-regression',
    cwd: '/tmp/project',
    changed: false,
  });
  apiMock.reserveConversation.mockResolvedValue({
    id: 'reserved-conv',
    sessionFile: '/tmp/reserved-conv.jsonl',
    cwd: '',
    perf: {},
  });
  apiMock.createLiveSession.mockResolvedValue({
    id: 'reserved-conv',
    sessionFile: '/tmp/reserved-conv.jsonl',
    bootstrap: undefined,
  });
  apiMock.destroySession.mockResolvedValue({ ok: true });
  apiMock.workspaceUncommittedDiff.mockResolvedValue({
    branch: 'main',
    changeCount: 0,
    linesAdded: 0,
    linesDeleted: 0,
    files: [],
  });
  sessionTabsMock.fetchRemoteConversationLayout.mockResolvedValue({
    localConversationIds: [],
    remoteControlledConversationIds: [],
  });
  sessionTabsMock.isWithinLocalWriteGrace.mockReturnValue(true);
  sessionTabsMock.closeConversationTab.mockReset();
  sessionTabsMock.ensureConversationTabOpen.mockReset();
  sessionTabsMock.setActiveConversationTab.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ConversationPage lazy composer metadata', () => {
  it('removes a missing conversation route from the workspace tabs without opening a placeholder row', async () => {
    vi.useRealTimers();
    renderMissingConversationPage();

    await waitFor(() => {
      expect(screen.getAllByText('Conversation not found').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(sessionTabsMock.closeConversationTab).toHaveBeenCalledWith('missing-conv');
    });
    expect(sessionTabsMock.ensureConversationTabOpen).not.toHaveBeenCalledWith('missing-conv');
    expect(sessionTabsMock.setActiveConversationTab).not.toHaveBeenCalledWith('missing-conv');
  });

  it('keeps extension slash and mention registrations off the route hot path until their composer triggers appear', async () => {
    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(apiMock.extensionSlashCommands).not.toHaveBeenCalled();
    expect(apiMock.extensionMentions).not.toHaveBeenCalled();

    const textarea = screen.getByPlaceholderText(/Message Neon Pilot/i);
    fireEvent.change(textarea, { target: { value: '/' } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.extensionSlashCommands).toHaveBeenCalledTimes(1);
    expect(apiMock.extensionMentions).toHaveBeenCalledTimes(1);

    fireEvent.change(textarea, { target: { value: '@' } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.extensionMentions).toHaveBeenCalledTimes(2);
  });

  it('does not write local stream running state into the global session store', async () => {
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = {
      conversationId: 'conv-regression',
      sessionDetail: regressionBootstrapData.sessionDetail,
      liveSession: {
        live: true,
        id: 'conv-regression',
        cwd: '/tmp/project',
        sessionFile: '/tmp/conv-regression.jsonl',
        title: 'Regression conversation',
        isStreaming: true,
        hasStaleTurnState: false,
      },
      stream: {
        blocks: regressionBootstrapData.sessionDetail.blocks,
        blockOffset: 0,
        totalBlocks: 2,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        title: 'Regression conversation',
        tokens: null,
        cost: null,
        contextUsage: null,
        pendingQueue: { steering: [], followUp: [] },
        parallelJobs: [],
        presence: {
          surfaces: [],
          controllerSurfaceId: null,
          controllerSurfaceType: null,
          controllerAcquiredAt: null,
        },
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        cwdChange: null,
      },
    };
    const patchSpy = vi.spyOn(sessionStore, 'patch');

    renderConversationPage();
    await act(async () => {
      await Promise.resolve();
    });

    expect(patchSpy).not.toHaveBeenCalledWith('conv-regression', expect.objectContaining({ isRunning: true }));
    expect(patchSpy).not.toHaveBeenCalledWith('conv-regression', expect.objectContaining({ title: 'Regression conversation' }));
  });

  it('loads saved-conversation model catalog during initial route settle', async () => {
    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(apiMock.models).toHaveBeenCalledTimes(1);
  });

  it('loads saved-conversation git metadata from the visible workspace cwd', async () => {
    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(apiMock.workspaceUncommittedDiff).toHaveBeenCalledWith('/tmp/project');
  });

  it('defers remote conversation layout reads until composer metadata is non-critical', async () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    try {
      renderConversationPage();

      expect(sessionTabsMock.fetchRemoteConversationLayout).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(499);
      });

      expect(sessionTabsMock.fetchRemoteConversationLayout).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      expect(sessionTabsMock.fetchRemoteConversationLayout).toHaveBeenCalledWith({
        refresh: false,
        reason: 'ConversationPage.remoteControlledIds',
      });
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('ignores a second submit while the first composer submit is still in flight', async () => {
    let resolveSend: () => void = () => {};
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = {
      conversationId: 'conv-regression',
      sessionDetail: regressionBootstrapData.sessionDetail,
      liveSession: {
        live: true,
        id: 'conv-regression',
        cwd: '/tmp/project',
        sessionFile: '/tmp/conv-regression.jsonl',
        isStreaming: false,
        hasStaleTurnState: false,
      },
      stream: {
        blocks: regressionBootstrapData.sessionDetail.blocks,
        blockOffset: 0,
        totalBlocks: 2,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        title: null,
        tokens: null,
        cost: null,
        contextUsage: null,
        pendingQueue: { steering: [], followUp: [] },
        presence: {
          surfaces: [],
          controllerSurfaceId: null,
          controllerSurfaceType: null,
          controllerAcquiredAt: null,
        },
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        cwdChange: null,
      },
    };
    desktopConversationState.send.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = () =>
          resolve({
            ok: true,
            accepted: true,
            delivery: 'started',
            referencedTaskIds: [],
            referencedMemoryDocIds: [],
            referencedKnowledgeFileIds: [],
            referencedAttachmentIds: [],
          });
      }),
    );

    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    const textarea = screen.getByPlaceholderText(/Message Neon Pilot/i);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Run the checks' } });
      await Promise.resolve();
    });
    const sendButton = screen.getByRole('button', { name: 'Send' });

    await act(async () => {
      fireEvent.click(sendButton);
      fireEvent.click(sendButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(desktopConversationState.send).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend();
      await Promise.resolve();
    });
  });

  it('keeps a locally picked draft workspace after the initial saved-workspace refresh resolves late', async () => {
    let resolveSavedWorkspacePaths: (workspacePaths: string[]) => void = () => {};
    apiMock.savedWorkspacePaths.mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveSavedWorkspacePaths = resolve;
      }),
    );
    apiMock.pickFolder.mockResolvedValue({ cancelled: false, path: '/tmp/late-picked-workspace' });

    renderDraftConversationPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiMock.savedWorkspacePaths).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose workspace folder' }));
      await Promise.resolve();
    });

    expect(apiMock.setSavedWorkspacePaths).toHaveBeenCalledWith(['/tmp/late-picked-workspace']);

    await act(async () => {
      resolveSavedWorkspacePaths(['/tmp/stale-workspace']);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Saved workspace' }));
    });

    let listbox = screen.getByRole('listbox', { name: 'Saved workspaces' });
    expect(within(listbox).getByText('late-picked-workspace')).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(listbox).getByText('Chat — no workspace'));
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Saved workspace' }));
    });

    listbox = screen.getByRole('listbox', { name: 'Saved workspaces' });
    expect(within(listbox).getByText('late-picked-workspace')).toBeTruthy();
  });

  it('hides stale draft git status when the selected workspace is not a git repo', async () => {
    vi.useRealTimers();
    emptyExtensionRegistry.statusBarItems.push({
      extensionId: 'system-git-status',
      id: 'git-status',
      label: 'Git status',
      component: 'GitStatusIndicator',
      alignment: 'right',
      priority: 100,
      frontendEntry: null,
    });
    apiMock.savedWorkspacePaths.mockResolvedValue(['/tmp/project', '/tmp/non-git-workspace']);
    apiMock.workspaceUncommittedDiff.mockImplementation(async (cwd: string) => {
      if (cwd === '/tmp/non-git-workspace') {
        return { branch: null, changeCount: 0, linesAdded: 0, linesDeleted: 0, files: [], isGitRepo: false };
      }

      return { branch: 'main', changeCount: 0, linesAdded: 0, linesDeleted: 0, files: [], isGitRepo: true };
    });

    renderDraftConversationPage();

    await waitFor(() => {
      expect(apiMock.savedWorkspacePaths).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Saved workspace' }));

    const listbox = await screen.findByRole('listbox', { name: 'Saved workspaces' });
    fireEvent.click(within(listbox).getByText('project'));

    await waitFor(() => {
      expect(screen.getByLabelText('Git status').textContent).toBe('mainclean');
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Workspace folder' }), {
      target: { value: '/tmp/non-git-workspace' },
    });

    await waitFor(() => {
      expect(apiMock.workspaceUncommittedDiff).toHaveBeenCalledWith('/tmp/non-git-workspace');
      expect(screen.queryByLabelText('Git status')).toBeNull();
    });
  });

  it('routes a submitted draft prompt to the reserved conversation before live-session creation settles', async () => {
    vi.useRealTimers();
    let resolveCreateLiveSession: (value: { id: string; sessionFile: string; bootstrap: undefined }) => void = () => {};
    apiMock.createLiveSession.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateLiveSession = resolve;
      }),
    );

    renderRoutedDraftConversationPage();

    const textarea = screen.getByPlaceholderText(/Message Neon Pilot/i);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Persist this thread in the sidebar' } });
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/conversations/reserved-conv');
    });
    expect(apiMock.reserveConversation).toHaveBeenCalledWith(undefined);
    expect(apiMock.createLiveSession).toHaveBeenCalledWith(
      undefined,
      'Persist this thread in the sidebar',
      expect.objectContaining({ reservedSessionFile: '/tmp/reserved-conv.jsonl' }),
    );

    await waitFor(
      () => {
        expect(sessionTabsMock.ensureConversationTabOpen).toHaveBeenCalledWith('reserved-conv');
      },
      { timeout: 2_500 },
    );

    await act(async () => {
      resolveCreateLiveSession({ id: 'reserved-conv', sessionFile: '/tmp/reserved-conv.jsonl', bootstrap: undefined });
      await Promise.resolve();
    });
  });

  it('ignores an older live session context refresh after a same-thread workspace dropdown switch triggers a newer one', async () => {
    regressionBootstrapData.liveSession = {
      live: true,
      id: 'conv-regression',
      cwd: '/tmp/project',
      sessionFile: '/tmp/conv-regression.jsonl',
      title: 'Regression conversation',
      isStreaming: false,
      hasStaleTurnState: false,
    };
    regressionBootstrapData.sessionDetail = {
      ...regressionBootstrapData.sessionDetail,
      meta: {
        ...regressionBootstrapData.sessionDetail.meta,
        cwd: '/tmp/project',
        cwdSlug: 'project',
        isLive: true,
      },
    };
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = createDesktopStateFromRegressionBootstrap();

    const liveSessionContextResolvers: Array<
      (value: { cwd: string; branch: string | null; git: { changeCount: number; linesAdded: number; linesDeleted: number } | null }) => void
    > = [];
    apiMock.liveSessionContext.mockImplementation(
      () =>
        new Promise((resolve) => {
          liveSessionContextResolvers.push(resolve);
        }),
    );
    apiMock.changeConversationCwd.mockResolvedValue({
      id: 'conv-regression',
      cwd: '/tmp/next-project',
      changed: false,
    });
    window.localStorage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/project', '/tmp/next-project']));

    renderSwitchableConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(apiMock.liveSessionContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '/tmp/project' }));
      await Promise.resolve();
    });

    expect(
      Array.from((screen.getByRole('combobox', { name: 'Conversation working directory' }) as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(['/tmp/project', '/tmp/next-project']);

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Conversation working directory' }), {
        target: { value: '/tmp/next-project' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMock.changeConversationCwd).toHaveBeenCalledWith('conv-regression', '/tmp/next-project', 'surface-test');
    expect(apiMock.liveSessionContext).toHaveBeenCalledTimes(2);

    await act(async () => {
      liveSessionContextResolvers[1]?.({
        cwd: '/tmp/next-project',
        branch: 'main',
        git: {
          changeCount: 0,
          linesAdded: 0,
          linesDeleted: 0,
        },
      });
      await Promise.resolve();
    });

    const workspaceButton = screen.getByRole('button', { name: '/tmp/next-project' });
    expect(workspaceButton.getAttribute('title')).toBe('Working directory: /tmp/next-project');

    await act(async () => {
      liveSessionContextResolvers[0]?.({
        cwd: '/tmp/project',
        branch: 'main',
        git: {
          changeCount: 0,
          linesAdded: 0,
          linesDeleted: 0,
        },
      });
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: '/tmp/next-project' }).getAttribute('title')).toBe('Working directory: /tmp/next-project');
  });

  it('shows clean validation copy when a saved conversation working directory is unavailable', async () => {
    regressionBootstrapData.liveSession = {
      live: true,
      id: 'conv-regression',
      cwd: '/tmp/project',
      sessionFile: '/tmp/conv-regression.jsonl',
      title: 'Regression conversation',
      isStreaming: false,
      hasStaleTurnState: false,
    };
    regressionBootstrapData.sessionDetail = {
      ...regressionBootstrapData.sessionDetail,
      meta: {
        ...regressionBootstrapData.sessionDetail.meta,
        cwd: '/tmp/project',
        cwdSlug: 'project',
        isLive: true,
      },
    };
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = createDesktopStateFromRegressionBootstrap();
    apiMock.changeConversationCwd.mockRejectedValue(
      new Error(
        '400 Bad Request from /api/conversations/conv-regression/cwd: Choose an existing folder. /tmp/missing-project could not be found.',
      ),
    );
    window.localStorage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/project', '/tmp/missing-project']));

    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '/tmp/project' }));
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Conversation working directory' }), {
        target: { value: '/tmp/missing-project' },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Choose an existing folder. /tmp/missing-project could not be found.')).toBeTruthy();
    expect(screen.queryByText(/Bad Request from \/api/)).toBeNull();
    expect(screen.queryByText(/Internal Server Error/)).toBeNull();
  });

  it.each([
    ['Directory does not exist: /tmp/missing-project'],
    ['500 Internal Server Error from /api/conversations/conv-regression/cwd: Directory does not exist: /tmp/missing-project'],
  ])('shows clean validation copy for legacy working directory resolver errors: %s', async (errorMessage) => {
    regressionBootstrapData.liveSession = {
      live: true,
      id: 'conv-regression',
      cwd: '/tmp/project',
      sessionFile: '/tmp/conv-regression.jsonl',
      title: 'Regression conversation',
      isStreaming: false,
      hasStaleTurnState: false,
    };
    regressionBootstrapData.sessionDetail = {
      ...regressionBootstrapData.sessionDetail,
      meta: {
        ...regressionBootstrapData.sessionDetail.meta,
        cwd: '/tmp/project',
        cwdSlug: 'project',
        isLive: true,
      },
    };
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = createDesktopStateFromRegressionBootstrap();
    apiMock.changeConversationCwd.mockRejectedValue(new Error(errorMessage));
    window.localStorage.setItem(SAVED_WORKSPACE_PATHS_STORAGE_KEY, JSON.stringify(['/tmp/project', '/tmp/missing-project']));

    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '/tmp/project' }));
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Conversation working directory' }), {
        target: { value: '/tmp/missing-project' },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Choose an existing folder. /tmp/missing-project could not be found.')).toBeTruthy();
    expect(screen.queryByText(/Directory does not exist/)).toBeNull();
  });

  it('switches the saved conversation working directory after choosing a folder', async () => {
    regressionBootstrapData.liveSession = {
      live: true,
      id: 'conv-regression',
      cwd: '/tmp/project',
      sessionFile: '/tmp/conv-regression.jsonl',
      title: 'Regression conversation',
      isStreaming: false,
      hasStaleTurnState: false,
    };
    regressionBootstrapData.sessionDetail = {
      ...regressionBootstrapData.sessionDetail,
      meta: {
        ...regressionBootstrapData.sessionDetail.meta,
        cwd: '/tmp/project',
        cwdSlug: 'project',
        isLive: true,
      },
    };
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.surfaceId = 'surface-test';
    desktopConversationState.state = createDesktopStateFromRegressionBootstrap();
    apiMock.pickFolder.mockResolvedValue({ cancelled: false, path: '/tmp/picked-workspace' });
    apiMock.changeConversationCwd.mockResolvedValue({
      id: 'conv-regression',
      cwd: '/tmp/picked-workspace',
      changed: false,
    });

    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '/tmp/project' }));
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMock.pickFolder).toHaveBeenCalledWith({ cwd: '/tmp/project', prompt: 'Choose a working directory' });
    expect(apiMock.setSavedWorkspacePaths).toHaveBeenCalledWith(['/tmp/picked-workspace']);
    expect(apiMock.changeConversationCwd).toHaveBeenCalledWith('conv-regression', '/tmp/picked-workspace', 'surface-test');
  });

  it('opens the saved drawing picker from its conversation command path', async () => {
    vi.useRealTimers();
    apiMock.conversationAttachments.mockResolvedValue({
      conversationId: 'conv-regression',
      attachments: [
        {
          id: 'drawing-1',
          title: 'Architecture sketch',
          kind: 'drawing',
          currentRevision: 3,
          updatedAt: '2026-05-27T12:00:00.000Z',
        },
      ],
    });

    renderConversationPage();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.conversationAttachments).toHaveBeenCalledWith('conv-regression');
    });
    expect((await screen.findByTestId('drawings-picker-modal')).textContent).toContain('drawing-1');
  });

  it('ignores stale attachment refreshes after switching saved conversations', async () => {
    vi.useRealTimers();

    let resolveRegressionAttachments: ((value: { conversationId: string; attachments: Array<Record<string, unknown>> }) => void) | null =
      null;
    let resolveNextAttachments: ((value: { conversationId: string; attachments: Array<Record<string, unknown>> }) => void) | null = null;

    apiMock.conversationAttachments.mockImplementation((conversationId: string) => {
      if (conversationId === 'conv-regression') {
        return new Promise((resolve) => {
          resolveRegressionAttachments = resolve;
        });
      }

      if (conversationId === 'conv-next') {
        return new Promise((resolve) => {
          resolveNextAttachments = resolve;
        });
      }

      throw new Error(`unexpected conversation ${conversationId}`);
    });

    setDesktopConversationFixture(createRegressionBootstrapData('conv-regression', '/tmp/project'));
    renderSwitchableConversationPage();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.conversationAttachments).toHaveBeenCalledWith('conv-regression');
    });

    setDesktopConversationFixture(createRegressionBootstrapData('conv-next', '/tmp/next-project'));
    fireEvent.click(screen.getByRole('button', { name: 'Go next' }));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.conversationAttachments).toHaveBeenCalledWith('conv-next');
    });

    resolveRegressionAttachments?.({
      conversationId: 'conv-regression',
      attachments: [
        {
          id: 'drawing-regression',
          title: 'Regression drawing',
          kind: 'drawing',
          currentRevision: 1,
          updatedAt: '2026-05-27T12:00:00.000Z',
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect((await screen.findByTestId('drawings-picker-modal')).textContent).not.toContain('drawing-regression');

    resolveNextAttachments?.({
      conversationId: 'conv-next',
      attachments: [
        {
          id: 'drawing-next',
          title: 'Next drawing',
          kind: 'drawing',
          currentRevision: 2,
          updatedAt: '2026-05-27T12:05:00.000Z',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('drawings-picker-modal').textContent).toContain('drawing-next');
    });
  });

  it('ignores stale attachment refresh failures after switching saved conversations', async () => {
    vi.useRealTimers();

    let rejectRegressionAttachments: ((reason?: unknown) => void) | null = null;
    let resolveNextAttachments: ((value: { conversationId: string; attachments: Array<Record<string, unknown>> }) => void) | null = null;

    apiMock.conversationAttachments.mockImplementation((conversationId: string) => {
      if (conversationId === 'conv-regression') {
        return new Promise((_, reject) => {
          rejectRegressionAttachments = reject;
        });
      }

      if (conversationId === 'conv-next') {
        return new Promise((resolve) => {
          resolveNextAttachments = resolve;
        });
      }

      throw new Error(`unexpected conversation ${conversationId}`);
    });

    setDesktopConversationFixture(createRegressionBootstrapData('conv-regression', '/tmp/project'));
    renderSwitchableConversationPage();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.conversationAttachments).toHaveBeenCalledWith('conv-regression');
    });

    setDesktopConversationFixture(createRegressionBootstrapData('conv-next', '/tmp/next-project'));
    fireEvent.click(screen.getByRole('button', { name: 'Go next' }));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DRAWING_PICKER_OPEN_COMMAND_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMock.conversationAttachments).toHaveBeenCalledWith('conv-next');
    });

    rejectRegressionAttachments?.(new Error('stale regression failure'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('stale regression failure')).toBeNull();

    resolveNextAttachments?.({
      conversationId: 'conv-next',
      attachments: [
        {
          id: 'drawing-next',
          title: 'Next drawing',
          kind: 'drawing',
          currentRevision: 2,
          updatedAt: '2026-05-27T12:05:00.000Z',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('drawings-picker-modal').textContent).toContain('drawing-next');
    });
    expect(screen.queryByText('stale regression failure')).toBeNull();
  });
});
