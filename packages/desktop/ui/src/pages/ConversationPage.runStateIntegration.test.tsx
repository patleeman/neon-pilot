// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext, LiveTitlesContext } from '../app/contexts';
import type { MessageBlock, SessionDetail, SessionMeta } from '../shared/types';
import { conversationRuntimeStore, sessionStore } from '../store';
import { ConversationPage } from './ConversationPage';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const apiMock = vi.hoisted(() => ({
  extensionSlashCommands: vi.fn(),
  extensionMentions: vi.fn(),
  memory: vi.fn(),
  modelPreferences: vi.fn(),
  models: vi.fn(),
  runs: vi.fn(),
  settings: vi.fn(),
  sessionDetail: vi.fn(),
  tasks: vi.fn(),
  liveSession: vi.fn(),
  liveSessionContext: vi.fn(),
  conversationAttachments: vi.fn(),
  conversationModelPreferences: vi.fn(),
  updateConversationModelPreferences: vi.fn(),
  updateConversationWorkspace: vi.fn(),
  savedWorkspacePaths: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  pickFolder: vi.fn(),
  changeConversationCwd: vi.fn(),
  createLiveSession: vi.fn(),
  reserveConversation: vi.fn(),
  destroySession: vi.fn(),
  executeLiveSessionBash: vi.fn(),
  clearQueuedMessages: vi.fn(),
  workspaceUncommittedDiff: vi.fn(),
  renameConversation: vi.fn(),
  deferredResumes: vi.fn(),
}));

const desktopConversationState = {
  mode: 'local',
  active: true,
  loading: false,
  error: null,
  surfaceId: 'surface-run-state',
  reconnect: vi.fn(),
  refresh: vi.fn(),
  send: vi.fn(),
  abort: vi.fn(),
  takeover: vi.fn(),
  state: null as ReturnType<typeof createStaleStreamingDesktopState> | null,
};

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
};

vi.mock('../client/api', () => ({
  api: apiMock,
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => emptyExtensionRegistry,
}));

vi.mock('../extensions/StatusBarItemHost', () => ({
  StatusBarItemHost: () => null,
}));

vi.mock('../hooks/useDesktopConversationState', () => ({
  notifyDesktopConversationStateRefresh: vi.fn(),
  primeReservedDesktopConversationStateCache: vi.fn(),
  useDesktopConversationState: () => desktopConversationState,
}));

const conversationId = 'conv-run-state-e2e';
const sessionMeta: SessionMeta = {
  id: conversationId,
  file: '/tmp/conv-run-state-e2e.jsonl',
  timestamp: '2026-06-27T12:00:00.000Z',
  cwd: '/tmp/project',
  cwdSlug: 'project',
  model: 'openai/gpt-5.4',
  title: 'Run state integration',
  messageCount: 1,
  isLive: true,
  isRunning: false,
};

const userBlock: Extract<MessageBlock, { type: 'user' }> = {
  type: 'user',
  id: 'user-run-state-1',
  ts: '2026-06-27T12:00:00.000Z',
  text: 'End-to-end run state prompt',
};

function createSessionDetail(): SessionDetail {
  return {
    meta: sessionMeta,
    blocks: [userBlock],
    blockOffset: 0,
    totalBlocks: 1,
    contextUsage: null,
  };
}

function createStaleStreamingDesktopState() {
  const detail = createSessionDetail();

  return {
    conversationId,
    sessionDetail: detail,
    liveSession: {
      live: true,
      id: conversationId,
      cwd: '/tmp/project',
      sessionFile: sessionMeta.file,
      title: sessionMeta.title,
      isStreaming: true,
      hasStaleTurnState: true,
    },
    stream: {
      blocks: detail.blocks,
      blockOffset: detail.blockOffset,
      totalBlocks: detail.totalBlocks,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      title: sessionMeta.title,
      tokens: null,
      cost: null,
      contextUsage: null,
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [],
      presence: {
        surfaces: [
          {
            surfaceId: desktopConversationState.surfaceId,
            surfaceType: 'desktop_web' as const,
            connectedAt: '2026-06-27T12:00:00.000Z',
          },
        ],
        controllerSurfaceId: desktopConversationState.surfaceId,
        controllerSurfaceType: 'desktop_web' as const,
        controllerAcquiredAt: '2026-06-27T12:00:00.000Z',
      },
      autoModeState: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      cwdChange: null,
    },
  };
}

function renderConversationPage() {
  sessionStore.replaceAll([sessionMeta]);
  sessionStore.markReady?.();

  return render(
    <AppDataContext.Provider
      value={{
        projects: null,
        sessions: [sessionMeta],
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
      <MemoryRouter initialEntries={[`/conversations/${conversationId}`]}>
        <Routes>
          <Route
            path="/conversations/:id"
            element={
              <LiveTitlesContext.Provider value={{ titles: new Map(), setTitle: vi.fn() }}>
                <ConversationPage />
              </LiveTitlesContext.Provider>
            }
          />
        </Routes>
      </MemoryRouter>
    </AppDataContext.Provider>,
  );
}

describe('ConversationPage run-state integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStore.reset?.();
    conversationRuntimeStore.reset();
    desktopConversationState.mode = 'local';
    desktopConversationState.active = true;
    desktopConversationState.loading = false;
    desktopConversationState.error = null;
    desktopConversationState.surfaceId = 'surface-run-state';
    desktopConversationState.state = createStaleStreamingDesktopState();
    desktopConversationState.refresh.mockResolvedValue(desktopConversationState.state);
    apiMock.extensionSlashCommands.mockResolvedValue({ commands: [] });
    apiMock.extensionMentions.mockResolvedValue({ mentions: [] });
    apiMock.memory.mockResolvedValue({ items: [] });
    apiMock.modelPreferences.mockResolvedValue({
      currentModel: 'openai/gpt-5.4',
      currentVisionModel: null,
      currentThinkingLevel: 'high',
      currentServiceTier: null,
    });
    apiMock.models.mockResolvedValue({
      models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }],
      currentModel: 'openai/gpt-5.4',
      currentVisionModel: null,
      currentThinkingLevel: 'high',
      currentServiceTier: null,
    });
    apiMock.runs.mockResolvedValue({ runs: [], summary: { total: 0, statuses: {}, recoveryActions: {} } });
    apiMock.settings.mockResolvedValue({});
    apiMock.sessionDetail.mockResolvedValue(createSessionDetail());
    apiMock.tasks.mockResolvedValue([]);
    apiMock.liveSession.mockResolvedValue({ live: true, running: true, isStreaming: true, hasStaleTurnState: true });
    apiMock.liveSessionContext.mockResolvedValue({ cwd: '/tmp/project', branch: null, git: null });
    apiMock.conversationAttachments.mockResolvedValue({ attachments: [] });
    apiMock.conversationModelPreferences.mockResolvedValue({
      model: null,
      visionModel: null,
      thinkingLevel: null,
      serviceTier: null,
    });
    apiMock.updateConversationWorkspace.mockResolvedValue({
      placements: {},
      entries: {},
      activeConversationId: conversationId,
    });
    apiMock.savedWorkspacePaths.mockResolvedValue([]);
    apiMock.workspaceUncommittedDiff.mockResolvedValue({ isGitRepo: false, files: [] });
    apiMock.deferredResumes.mockResolvedValue({ resumes: [] });
  });

  afterEach(() => {
    sessionStore.reset?.();
    conversationRuntimeStore.reset();
    document.body.innerHTML = '';
  });

  it('clears transcript and composer running indicators when canonical runtime goes idle even if desktop stream data is stale', async () => {
    conversationRuntimeStore.apply({
      id: conversationId,
      running: true,
      revision: 1,
      updatedAt: '2026-06-27T12:00:00.000Z',
    });

    renderConversationPage();

    expect(await screen.findByText('End-to-end run state prompt')).toBeTruthy();
    expect(await screen.findByText('Working…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(document.querySelector('.ui-composer-state-streaming')).toBeTruthy();

    await act(async () => {
      conversationRuntimeStore.apply({
        id: conversationId,
        running: false,
        revision: 2,
        updatedAt: '2026-06-27T12:00:01.000Z',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText('Working…')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
      expect(document.querySelector('.ui-composer-state-streaming')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });
});
