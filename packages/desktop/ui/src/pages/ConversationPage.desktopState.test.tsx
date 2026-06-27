import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext } from '../app/contexts';
import { INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS } from '../conversation/conversationTranscriptPaging';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;
const originalConsoleError = console.error;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
    if (typeof message === 'string' && message.includes('useLayoutEffect does nothing on the server')) {
      return;
    }

    originalConsoleError(message, ...args);
  });
});

afterEach(async () => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
  const { conversationRuntimeStore, sessionStore } = await import('../store');
  conversationRuntimeStore.reset();
  sessionStore.reset?.();
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock('../hooks/useDesktopConversationState');
  vi.doUnmock('../hooks/useDesktopConversationState.js');
  vi.unmock('../hooks/useDesktopConversationState');
  vi.unmock('../hooks/useDesktopConversationState.js');
});

describe('ConversationPage desktop local state', () => {
  it('does not bootstrap a reserved conversation route that carries an initial pending prompt', async () => {
    const useDesktopConversationState = vi.fn(() => ({
      mode: 'local',
      active: true,
      loading: true,
      error: null,
      surfaceId: 'surface-local',
      reconnect: vi.fn(),
      send: vi.fn(),
      abort: vi.fn(),
      takeover: vi.fn(),
      state: null,
    }));
    vi.doMock('../hooks/useDesktopConversationState', () => ({
      useDesktopConversationState,
    }));

    const { ConversationPage } = await import('./ConversationPage.js');
    renderToString(
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions: [],
          tasks: null,
          runs: null,
          executions: null,
          setProjects: vi.fn(),
          setSessions: vi.fn(),
          setTasks: vi.fn(),
          setRuns: vi.fn(),
          setExecutions: vi.fn(),
        }}
      >
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/conversations/reserved-conv',
              state: {
                initialPendingPromptState: {
                  conversationId: 'reserved-conv',
                  prompt: {
                    text: 'hello',
                    behavior: 'followUp',
                    images: [],
                    attachmentRefs: [],
                    contextMessages: [],
                  },
                },
              },
            },
          ]}
        >
          <Routes>
            <Route path="/conversations/:id" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </AppDataContext.Provider>,
    );

    expect(useDesktopConversationState).toHaveBeenCalledWith('reserved-conv', expect.objectContaining({ enabled: true }));
  }, 15000);

  it('renders the active conversation from the dedicated desktop state subscription', async () => {
    const desktopConversationState = vi.fn(() => ({
      mode: 'local',
      active: true,
      loading: false,
      error: null,
      surfaceId: 'surface-local',
      reconnect: vi.fn(),
      send: vi.fn(),
      abort: vi.fn(),
      takeover: vi.fn(),
      state: {
        conversationId: 'local-conv',
        sessionDetail: {
          meta: {
            id: 'local-conv',
            file: '/tmp/local-conv.jsonl',
            timestamp: '2026-04-11T12:00:00.000Z',
            cwd: '/tmp/project',
            cwdSlug: 'project',
            model: 'openai/gpt-5.4',
            title: 'Local desktop state',
            messageCount: 2,
            isLive: true,
          },
          blocks: [],
          blockOffset: 0,
          totalBlocks: 2,
          contextUsage: { tokens: 12 },
        },
        liveSession: {
          live: true,
          id: 'local-conv',
          cwd: '/tmp/project',
          sessionFile: '/tmp/local-conv.jsonl',
          title: 'Local desktop state',
          isStreaming: false,
          hasStaleTurnState: false,
        },
        stream: {
          blocks: [
            {
              type: 'user',
              id: 'user-1',
              ts: '2026-04-11T12:00:00.000Z',
              text: 'hello from desktop state',
            },
            {
              type: 'text',
              id: 'assistant-1',
              ts: '2026-04-11T12:00:01.000Z',
              text: 'desktop state reply',
            },
          ],
          blockOffset: 0,
          totalBlocks: 2,
          hasSnapshot: true,
          isStreaming: false,
          isCompacting: false,
          error: null,
          title: 'Local desktop state',
          tokens: null,
          cost: null,
          contextUsage: { tokens: 12 },
          pendingQueue: { steering: [], followUp: [] },
          parallelJobs: [],
          presence: {
            surfaces: [],
            controllerSurfaceId: null,
            controllerSurfaceType: null,
            controllerAcquiredAt: null,
          },
          autoModeState: null,
          systemPrompt: 'You are a local desktop agent.',
          cwdChange: null,
        },
      },
    }));
    vi.doMock('../hooks/useDesktopConversationState', () => ({
      useDesktopConversationState: desktopConversationState,
    }));

    const { ConversationPage } = await import('./ConversationPage.js');
    const html = renderToString(
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions: [
            {
              id: 'local-conv',
              file: '/tmp/local-conv.jsonl',
              timestamp: '2026-04-11T12:00:00.000Z',
              cwd: '/tmp/project',
              cwdSlug: 'project',
              model: 'openai/gpt-5.4',
              title: 'Local desktop state',
              messageCount: 2,
              isLive: true,
            },
          ],
          tasks: null,
          runs: null,
          executions: null,
          setProjects: vi.fn(),
          setSessions: vi.fn(),
          setTasks: vi.fn(),
          setRuns: vi.fn(),
          setExecutions: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/conversations/local-conv']}>
          <Routes>
            <Route path="/conversations/:id" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </AppDataContext.Provider>,
    );

    expect(desktopConversationState).toHaveBeenCalledWith(
      'local-conv',
      expect.objectContaining({ tailBlocks: INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS, includeToolBlocks: false }),
    );
    expect(html).toContain('Loading messages…');
  }, 15000);

  it('shows active feedback for a running desktop conversation before messages hydrate', async () => {
    const runningSession = {
      id: 'running-empty-conv',
      file: '/tmp/running-empty-conv.jsonl',
      timestamp: '2026-04-11T12:00:00.000Z',
      cwd: '/tmp/project',
      cwdSlug: 'project',
      model: 'openai/gpt-5.4',
      title: 'Running empty state',
      messageCount: 0,
      isLive: false,
      isRunning: false,
    };
    const { conversationRuntimeStore, sessionStore } = await import('../store');
    sessionStore.replaceAll([runningSession]);
    sessionStore.markReady?.();
    conversationRuntimeStore.apply({
      id: 'running-empty-conv',
      running: true,
      revision: 1,
      updatedAt: '2026-04-11T12:00:00.000Z',
    });

    const desktopConversationState = vi.fn(() => ({
      mode: 'local',
      active: true,
      loading: false,
      error: null,
      surfaceId: 'surface-local',
      reconnect: vi.fn(),
      send: vi.fn(),
      abort: vi.fn(),
      takeover: vi.fn(),
      state: {
        conversationId: 'running-empty-conv',
        sessionDetail: {
          meta: runningSession,
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          contextUsage: null,
        },
        liveSession: {
          live: false,
          id: 'running-empty-conv',
          cwd: '/tmp/project',
          sessionFile: '/tmp/running-empty-conv.jsonl',
          title: 'Running empty state',
          isStreaming: false,
          hasStaleTurnState: false,
        },
        stream: {
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          hasSnapshot: true,
          isStreaming: false,
          isCompacting: false,
          error: null,
          title: 'Running empty state',
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
          autoModeState: null,
          systemPrompt: null,
          cwdChange: null,
        },
      },
    }));
    vi.doMock('../hooks/useDesktopConversationState', () => ({
      useDesktopConversationState: desktopConversationState,
    }));

    const { ConversationPage } = await import('./ConversationPage.js');
    const html = renderToString(
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions: [runningSession],
          tasks: null,
          runs: null,
          executions: null,
          setProjects: vi.fn(),
          setSessions: vi.fn(),
          setTasks: vi.fn(),
          setRuns: vi.fn(),
          setExecutions: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/conversations/running-empty-conv']}>
          <Routes>
            <Route path="/conversations/:id" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </AppDataContext.Provider>,
    );

    expect(html).toContain('Working…');
    expect(html).not.toContain('This conversation is empty');
  }, 15000);
});
