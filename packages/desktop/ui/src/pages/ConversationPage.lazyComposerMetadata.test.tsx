// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext } from '../app/contexts';
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
  liveSession: vi.fn(),
  conversationAttachments: vi.fn(),
  conversationModelPreferences: vi.fn(),
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
  composerButtons: [],
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

vi.mock('../client/api', () => ({
  api: apiMock,
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => emptyExtensionRegistry,
}));

vi.mock('../components/chat/ChatView', () => ({
  ChatView: ({ messages }: { messages?: Array<{ text?: string }> }) => (
    <div data-testid="chat-view">{messages?.map((message) => message.text).join('\n')}</div>
  ),
}));

vi.mock('../hooks/useDesktopConversationState', () => ({
  useDesktopConversationState: () => desktopConversationState,
}));

const regressionBootstrap = {
  loading: false,
  error: null,
  data: regressionBootstrapData,
};

vi.mock('../hooks/useConversationBootstrap', () => ({
  useConversationBootstrap: () => regressionBootstrap,
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

beforeEach(() => {
  vi.useFakeTimers();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
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
  apiMock.liveSession.mockResolvedValue({ live: false, hasStaleTurnState: false });
  apiMock.conversationAttachments.mockResolvedValue({ conversationId: 'conv-regression', attachments: [] });
  sessionTabsMock.fetchRemoteConversationLayout.mockResolvedValue({
    localConversationIds: [],
    remoteControlledConversationIds: [],
  });
  sessionTabsMock.isWithinLocalWriteGrace.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ConversationPage lazy composer metadata', () => {
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

  it('defers saved-conversation model catalog loading past initial route settle', async () => {
    renderConversationPage();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(apiMock.models).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_200);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.models).toHaveBeenCalledTimes(1);
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
});
