import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationBootstrapState } from '../shared/types';

function createBootstrapState(overrides?: Partial<ConversationBootstrapState>): ConversationBootstrapState {
  return {
    conversationId: 'conversation-1',
    sessionDetail: null,
    liveSession: { live: false },
    ...overrides,
  };
}

function createJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('api desktop transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('window', {
      location: { pathname: '/' },
    });
  });

  it('falls back to app-protocol API routes when the local desktop bridge omits memory and tools readers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 'knowledge',
            name: 'Knowledge',
            enabled: true,
            manifest: {
              schemaVersion: 2,
              id: 'knowledge',
              name: 'Knowledge',
              backend: { entry: 'src/backend.ts', actions: [{ id: 'readMemory', handler: 'readMemory' }] },
              contributes: {
                views: [
                  { id: 'knowledge', title: 'Knowledge', location: 'main', component: 'Knowledge', routeCapabilities: ['knowledgeFiles'] },
                ],
              },
            },
            surfaces: [],
            backendActions: [{ id: 'readMemory', handler: 'readMemory' }],
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          result: {
            agentsMd: [],
            skills: [
              {
                source: 'global',
                name: 'checkpoint',
                description: "Commit and push the agent's current work.",
                path: '/knowledge/skills/checkpoint/SKILL.md',
              },
            ],
            memoryDocs: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          cwd: '/repo',
          activeTools: [],
          tools: [],
          newSessionSystemPrompt: '',
          newSessionInjectedMessages: [],
          newSessionToolDefinitions: [],
          dependentCliTools: [],
          packageInstall: { available: false, managers: [] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const getEnvironment = vi.fn().mockResolvedValue({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local backend is healthy.',
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment,
      },
    });

    const { api } = await import('./api');
    const memory = await api.memory();
    const tools = await api.tools();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/extensions/installed');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/extensions/knowledge/actions/readMemory');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/tools');
    expect(memory.skills[0]?.name).toBe('checkpoint');
    expect(tools.cwd).toBe('/repo');
  });

  it('routes extension APIs through HTTP instead of the desktop local API bridge', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true, result: 'pong' }));
    vi.stubGlobal('fetch', fetchMock);
    const getEnvironment = vi.fn().mockResolvedValue({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local backend is healthy.',
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment,
      },
    });

    const { api } = await import('./api');
    const result = await api.invokeExtensionAction('agent-board', 'ping', { hello: true });

    expect(result).toEqual({ ok: true, result: 'pong' });
    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/agent-board/actions/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: true }),
    });
  });

  it('restores queued messages through HTTP product routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true, text: 'queued hello', images: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api');
    const restored = await api.restoreQueuedMessage('live-1', { behavior: 'followUp', index: 0, previewId: 'queue-1' }, 'surface-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/live-1/restore-queued-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behavior: 'followUp', index: 0, previewId: 'queue-1' }),
    });
    expect(restored).toEqual({ ok: true, text: 'queued hello', images: [] });
  });

  it('clears queued messages through HTTP product routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createJsonResponse({ ok: true, items: [{ behavior: 'followUp', text: 'Goal continuation.', images: [], author: 'agent' }] }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api');
    const cleared = await api.clearQueuedMessages('live-1', 'surface-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/live-1/clear-queued-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    });
    expect(cleared).toEqual({
      ok: true,
      items: [{ behavior: 'followUp', text: 'Goal continuation.', images: [], author: 'agent' }],
    });
  });

  it('executes live-session bash through HTTP product routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true, result: { exitCode: 0, output: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api');
    const result = await api.executeLiveSessionBash('live-1', 'git status', { excludeFromContext: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/live-1/execute-bash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'git status', excludeFromContext: true }),
    });
    expect(result).toEqual({ ok: true, result: { exitCode: 0, output: 'ok' } });
  });

  it('uses HTTP for queued message restore on non-local desktop hosts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true, text: 'queued hello', images: [] }));
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'remote',
          activeHostLabel: 'Remote',
          activeHostKind: 'ssh',
          activeHostSummary: 'Remote backend is healthy.',
        }),
      },
    });

    const { api } = await import('./api');
    await expect(api.restoreQueuedMessage('live-1', { behavior: 'steer', index: 2, previewId: 'queue-2' }, 'surface-1')).resolves.toEqual({
      ok: true,
      text: 'queued hello',
      images: [],
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses dedicated desktop capability bridges on the local Electron host', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(createJsonResponse({})));
    vi.stubGlobal('fetch', fetchMock);
    const readAppStatus = vi.fn().mockResolvedValue({
      repoRoot: '/repo',
      appRevision: 'rev-1',
    });
    const readDaemonState = vi.fn().mockResolvedValue({
      warnings: [],
      service: { platform: 'desktop', identifier: 'daemon', manifestPath: '/tmp/daemon.plist', installed: true, running: true },
      runtime: { running: true, socketPath: '/tmp/daemon.sock', moduleCount: 3 },
      log: { lines: [] },
    });
    const readSessions = vi.fn().mockResolvedValue([{ id: 'conversation-1', title: 'Conversation 1' }]);
    const readSessionMeta = vi.fn().mockResolvedValue({ id: 'conversation-1', title: 'Conversation 1' });
    const readSessionSearchIndex = vi.fn().mockResolvedValue({ index: { 'conversation-1': 'hello world' } });
    const readModels = vi.fn().mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
      models: [{ id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 272_000 }],
    });
    const readModelPreferences = vi.fn().mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentVisionModel: '',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
    });
    const updateModelPreferences = vi.fn().mockResolvedValue({ ok: true });
    const readModelProviders = vi.fn().mockResolvedValue({ providers: [{ id: 'openrouter', models: [] }] });
    const saveModelProvider = vi.fn().mockResolvedValue({ providers: [{ id: 'openrouter', models: [] }] });
    const deleteModelProvider = vi.fn().mockResolvedValue({ providers: [] });
    const saveModelProviderModel = vi.fn().mockResolvedValue({ providers: [{ id: 'openrouter', models: [{ id: 'model-a' }] }] });
    const deleteModelProviderModel = vi.fn().mockResolvedValue({ providers: [{ id: 'openrouter', models: [] }] });
    const readProviderAuth = vi.fn().mockResolvedValue({ providers: [{ id: 'openai', authType: 'api_key' }] });
    const setProviderApiKey = vi.fn().mockResolvedValue({ providers: [{ id: 'openai', authType: 'api_key' }] });
    const removeProviderCredential = vi.fn().mockResolvedValue({ providers: [] });
    const startProviderOAuthLogin = vi.fn().mockResolvedValue({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'running',
    });
    const readProviderOAuthLogin = vi.fn().mockResolvedValue({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'running',
    });
    const submitProviderOAuthLoginInput = vi.fn().mockResolvedValue({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'running',
    });
    const cancelProviderOAuthLogin = vi.fn().mockResolvedValue({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'cancelled',
    });
    const markConversationAttention = vi.fn().mockResolvedValue({ ok: true });
    const readScheduledTasks = vi.fn().mockResolvedValue([
      {
        id: 'task-1',
        scheduleType: 'cron',
        running: false,
        enabled: true,
        prompt: 'Prompt',
        title: 'Task 1',
      },
    ]);
    const readScheduledTaskDetail = vi.fn().mockResolvedValue({
      id: 'task-1',
      scheduleType: 'cron',
      running: false,
      enabled: true,
      prompt: 'Prompt body',
      threadMode: 'dedicated',
    });
    const readScheduledTaskLog = vi.fn().mockResolvedValue({ path: '/tasks/task-1.log', log: 'task tail' });
    const createScheduledTask = vi.fn().mockResolvedValue({
      ok: true,
      task: { id: 'task-2', scheduleType: 'cron', running: false, enabled: true, prompt: 'Created task body', threadMode: 'dedicated' },
    });
    const updateScheduledTask = vi.fn().mockResolvedValue({
      ok: true,
      task: { id: 'task-1', scheduleType: 'cron', running: false, enabled: false, prompt: 'Updated task body', threadMode: 'dedicated' },
    });
    const runScheduledTask = vi.fn().mockResolvedValue({ ok: true, accepted: true, runId: 'run-from-task' });
    const readDurableRuns = vi.fn().mockResolvedValue({
      scannedAt: '2026-04-10T11:00:00.000Z',
      runsRoot: '/runs',
      summary: { total: 0, recoveryActions: {}, statuses: {} },
      runs: [],
    });
    const readDurableRun = vi.fn().mockResolvedValue({
      scannedAt: '2026-04-10T11:00:00.000Z',
      runsRoot: '/runs',
      run: { runId: 'run-1' },
    });
    const readDurableRunLog = vi.fn().mockResolvedValue({ path: '/runs/run-1.log', log: 'tail' });
    const cancelDurableRun = vi.fn().mockResolvedValue({ cancelled: true, runId: 'run-1' });
    const markDurableRunAttention = vi.fn().mockResolvedValue({ ok: true });
    const readConversationBootstrap = vi.fn().mockResolvedValue(createBootstrapState());
    const renameConversation = vi.fn().mockResolvedValue({ ok: true, title: 'Renamed conversation' });
    const changeConversationCwd = vi.fn().mockResolvedValue({
      id: 'live-1',
      sessionFile: '/tmp/live-1.jsonl',
      cwd: '/next-repo',
      changed: true,
    });
    const resumeConversation = vi.fn().mockResolvedValue({
      conversationId: 'live-1',
      live: true,
      recovered: true,
      replayedPendingOperation: false,
      usedFallbackPrompt: true,
    });
    const readLiveSessionForkEntries = vi.fn().mockResolvedValue([{ entryId: 'entry-1', text: 'fork from here' }]);
    const readConversationModelPreferences = vi.fn().mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
      hasExplicitServiceTier: false,
    });
    const updateConversationModelPreferences = vi.fn().mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'medium',
      currentServiceTier: 'priority',
      hasExplicitServiceTier: true,
    });
    const readLiveSession = vi.fn().mockResolvedValue({ live: true, id: 'live-1' });
    const readLiveSessionContext = vi.fn().mockResolvedValue({ cwd: '/repo', branch: 'main', git: null });
    const readSessionDetail = vi.fn().mockResolvedValue({
      meta: { id: 'live-1' },
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      contextUsage: null,
    });
    const readSessionBlock = vi.fn().mockResolvedValue({ id: 'block-1', type: 'text', text: 'hello' });
    const createLiveSession = vi.fn().mockResolvedValue({
      id: 'live-1',
      sessionFile: '/tmp/live-1.jsonl',
      bootstrap: createBootstrapState({
        conversationId: 'live-1',
        sessionDetail: {
          meta: {
            id: 'live-1',
            file: '/tmp/live-1.jsonl',
            timestamp: '2026-04-11T00:00:00.000Z',
            cwd: '/repo',
            cwdSlug: '-repo',
            model: 'gpt-5.4',
            title: 'New Conversation',
            messageCount: 0,
          },
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          contextUsage: null,
        },
        liveSession: {
          live: true,
          id: 'live-1',
          cwd: '/repo',
          sessionFile: '/tmp/live-1.jsonl',
          title: 'New Conversation',
          isStreaming: false,
        },
      }),
    });
    const resumeLiveSession = vi.fn().mockResolvedValue({ id: 'live-1' });
    const takeOverLiveSession = vi.fn().mockResolvedValue({
      surfaces: [],
      controllerSurfaceId: 'surface-1',
      controllerSurfaceType: 'desktop_web',
      controllerAcquiredAt: '2026-04-04T00:00:00.000Z',
    });
    const submitLiveSessionPrompt = vi.fn().mockResolvedValue({ ok: true, accepted: true, delivery: 'started' });
    const restoreQueuedLiveSessionMessage = vi.fn().mockResolvedValue({ ok: true, text: 'queued hello', images: [] });
    const compactLiveSession = vi.fn().mockResolvedValue({ ok: true, result: { compacted: true } });
    const exportLiveSession = vi.fn().mockResolvedValue({ ok: true, path: '/tmp/live-1.html' });
    const reloadLiveSession = vi.fn().mockResolvedValue({ ok: true });
    const branchLiveSession = vi
      .fn()
      .mockResolvedValue({ newSessionId: 'branch-1', sessionFile: '/tmp/branch-1.jsonl', bootstrap: createBootstrapState() });
    const forkLiveSession = vi.fn().mockResolvedValue({ newSessionId: 'fork-1', sessionFile: '/tmp/fork-1.jsonl' });
    const abortLiveSession = vi.fn().mockResolvedValue({ ok: true });
    const destroyLiveSession = vi.fn().mockResolvedValue({ ok: true });
    const getEnvironment = vi.fn().mockResolvedValue({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local backend is healthy.',
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment,
        readAppStatus,
        readDaemonState,
        readSessions,
        readSessionMeta,
        readSessionSearchIndex,
        readModels,
        readModelPreferences,
        updateModelPreferences,
        readModelProviders,
        saveModelProvider,
        deleteModelProvider,
        saveModelProviderModel,
        deleteModelProviderModel,
        readProviderAuth,
        setProviderApiKey,
        removeProviderCredential,
        startProviderOAuthLogin,
        readProviderOAuthLogin,
        submitProviderOAuthLoginInput,
        cancelProviderOAuthLogin,
        markConversationAttention,
        readScheduledTasks,
        readScheduledTaskDetail,
        readScheduledTaskLog,
        createScheduledTask,
        updateScheduledTask,
        runScheduledTask,
        readDurableRuns,
        readDurableRun,
        readDurableRunLog,
        cancelDurableRun,
        markDurableRunAttention,
        readConversationBootstrap,
        renameConversation,
        changeConversationCwd,
        resumeConversation,
        readConversationModelPreferences,
        updateConversationModelPreferences,
        readLiveSession,
        readLiveSessionForkEntries,
        readLiveSessionContext,
        readSessionDetail,
        readSessionBlock,
        createLiveSession,
        resumeLiveSession,
        takeOverLiveSession,
        submitLiveSessionPrompt,
        restoreQueuedLiveSessionMessage,
        compactLiveSession,
        exportLiveSession,
        reloadLiveSession,
        branchLiveSession,
        forkLiveSession,
        abortLiveSession,
        destroyLiveSession,
      },
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/status') return createJsonResponse(await readAppStatus());
      if (path === '/api/daemon') return createJsonResponse(await readDaemonState());
      if (path === '/api/sessions') return createJsonResponse(await readSessions());
      if (path === '/api/sessions?limit=100') return createJsonResponse([{ id: 'limited' }]);
      if (path === '/api/sessions/conversation-1/meta') return createJsonResponse(await readSessionMeta('conversation-1'));
      if (path === '/api/sessions/search-index')
        return createJsonResponse(await readSessionSearchIndex(JSON.parse(String(init?.body)).sessionIds));
      if (path === '/api/related-conversations/results')
        return createJsonResponse({
          searchResults: [{ sessionId: 'conversation-1', title: 'Related', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
          recentResults: [],
          visibleResults: [{ sessionId: 'conversation-1', title: 'Related', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
        });
      if (path === '/api/models') return createJsonResponse(await readModels());
      if (path === '/api/model-preferences' && init?.method === 'PATCH')
        return createJsonResponse(await updateModelPreferences(JSON.parse(String(init?.body))));
      if (path === '/api/model-preferences') return createJsonResponse(await readModelPreferences());
      if (path === '/api/model-providers') return createJsonResponse(await readModelProviders());
      if (path === '/api/model-providers/openrouter' && init?.method === 'PATCH')
        return createJsonResponse(await saveModelProvider({ provider: 'openrouter', ...JSON.parse(String(init.body)) }));
      if (path === '/api/model-providers/openrouter' && init?.method === 'DELETE')
        return createJsonResponse(await deleteModelProvider('openrouter'));
      if (path === '/api/model-providers/openrouter/models/model-a' && init?.method === 'PATCH')
        return createJsonResponse(await saveModelProviderModel({ provider: 'openrouter', ...JSON.parse(String(init.body)) }));
      if (path === '/api/model-providers/openrouter/models/model-a' && init?.method === 'DELETE')
        return createJsonResponse(await deleteModelProviderModel({ provider: 'openrouter', modelId: 'model-a' }));
      if (path === '/api/default-cwd' && init?.method === 'PATCH')
        return createJsonResponse(await updateDefaultCwd(JSON.parse(String(init.body)).cwd));
      if (path === '/api/provider-auth') return createJsonResponse(await readProviderAuth());
      if (path === '/api/provider-auth/openai/api-key')
        return createJsonResponse(await setProviderApiKey({ provider: 'openai', apiKey: JSON.parse(String(init?.body)).apiKey }));
      if (path === '/api/provider-auth/openai') return createJsonResponse(await removeProviderCredential('openai'));
      if (path === '/api/provider-auth/openrouter/oauth') return createJsonResponse(await startProviderOAuthLogin('openrouter'));
      if (path === '/api/provider-auth/oauth/login-1/input')
        return createJsonResponse(await submitProviderOAuthLoginInput({ loginId: 'login-1', value: JSON.parse(String(init?.body)).value }));
      if (path === '/api/provider-auth/oauth/login-1/cancel') return createJsonResponse(await cancelProviderOAuthLogin('login-1'));
      if (path === '/api/provider-auth/oauth/login-1') return createJsonResponse(await readProviderOAuthLogin('login-1'));
      if (path === '/api/tasks') {
        if (init?.method === 'POST') return createJsonResponse(await createScheduledTask(JSON.parse(String(init.body))));
        return createJsonResponse(await readScheduledTasks());
      }
      if (path === '/api/tasks/task-1') {
        if (init?.method === 'PATCH')
          return createJsonResponse(await updateScheduledTask({ taskId: 'task-1', ...JSON.parse(String(init.body)) }));
        return createJsonResponse(await readScheduledTaskDetail('task-1'));
      }
      if (path === '/api/tasks/task-1/log') return createJsonResponse(await readScheduledTaskLog('task-1'));
      if (path === '/api/tasks/task-1/run') return createJsonResponse(await runScheduledTask('task-1'));
      if (path === '/api/runs') return createJsonResponse(await readDurableRuns());
      if (path === '/api/runs/run-1') return createJsonResponse(await readDurableRun('run-1'));
      if (path === '/api/runs/run-1/log?tail=25') return createJsonResponse(await readDurableRunLog({ runId: 'run-1', tail: 25 }));
      if (path === '/api/runs/run-1/attention')
        return createJsonResponse(await markDurableRunAttention({ runId: 'run-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/runs/run-1/cancel') return createJsonResponse(await cancelDurableRun('run-1'));
      if (path === '/api/conversations/conversation-1/attention')
        return createJsonResponse(await markConversationAttention({ conversationId: 'conversation-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/conversations/conversation-1/bootstrap?tailBlocks=12&knownSessionSignature=sig-1')
        return createJsonResponse(
          await readConversationBootstrap({ conversationId: 'conversation-1', tailBlocks: 12, knownSessionSignature: 'sig-1' }),
        );
      if (path === '/api/conversations/conversation-1/title')
        return createJsonResponse(await renameConversation({ conversationId: 'conversation-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/conversations/live-1/cwd')
        return createJsonResponse(await changeConversationCwd({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/conversations/conversation-1/resume') return createJsonResponse(await resumeConversation('conversation-1'));
      if (path === '/api/conversations/live-1/model-preferences') {
        if (init?.method === 'PATCH')
          return createJsonResponse(
            await updateConversationModelPreferences({ conversationId: 'live-1', ...JSON.parse(String(init.body)) }),
          );
        return createJsonResponse(await readConversationModelPreferences({ conversationId: 'live-1' }));
      }
      if (path === '/api/live-sessions' && init?.method === 'POST')
        return createJsonResponse(await createLiveSession(JSON.parse(String(init.body))));
      if (path === '/api/live-sessions/resume' && init?.method === 'POST')
        return createJsonResponse(await resumeLiveSession(JSON.parse(String(init.body))));
      if (path === '/api/live-sessions/live-1/take-over')
        return createJsonResponse(await takeOverLiveSession({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/prompt')
        return createJsonResponse(await submitLiveSessionPrompt({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/restore-queued-message')
        return createJsonResponse(await restoreQueuedLiveSessionMessage({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/compact')
        return createJsonResponse(await compactLiveSession({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/export')
        return createJsonResponse(await exportLiveSession({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/reload') return createJsonResponse(await reloadLiveSession('live-1'));
      if (path === '/api/live-sessions/live-1/branch')
        return createJsonResponse(await branchLiveSession({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/fork')
        return createJsonResponse(await forkLiveSession({ conversationId: 'live-1', ...JSON.parse(String(init?.body)) }));
      if (path === '/api/live-sessions/live-1/abort') return createJsonResponse(await abortLiveSession('live-1'));
      if (path === '/api/live-sessions/conversation-1/destroy') return createJsonResponse(await destroyLiveSession('conversation-1'));
      if (path === '/api/live-sessions/live-1') return createJsonResponse(await readLiveSession('live-1'));
      if (path === '/api/live-sessions/live-1/context') return createJsonResponse(await readLiveSessionContext('live-1'));
      if (path === '/api/live-sessions/live-1/fork-entries') return createJsonResponse(await readLiveSessionForkEntries('live-1'));
      if (path.startsWith('/api/sessions/live-1?'))
        return createJsonResponse(await readSessionDetail({ sessionId: 'live-1', tailBlocks: 24 }));
      if (path === '/api/sessions/live-1/blocks/block-1')
        return createJsonResponse(await readSessionBlock({ sessionId: 'live-1', blockId: 'block-1' }));
      return createJsonResponse({});
    });

    const { api } = await import('./api');
    const status = await api.status();
    const daemon = await api.daemon();
    const sessions = await api.sessions();
    const limitedSessions = await api.sessions({ limit: 100 });
    const sessionMeta = await api.sessionMeta('conversation-1');
    const sessionSearchIndex = await api.sessionSearchIndex(['conversation-1']);
    const relatedConversationResults = await api.relatedConversationResults({
      sessions: [],
      searchIndex: {},
      summaries: {},
      query: 'related',
      workspaceCwd: '/repo',
      selectedRelatedThreadIds: ['conversation-1'],
      limit: 5,
    });
    const models = await api.models();
    const globalModelPreferences = await api.modelPreferences();
    const modelPreferenceUpdate = await api.updateModelPreferences({ thinkingLevel: 'medium' });
    const modelProviders = await api.modelProviders();
    const savedModelProvider = await api.saveModelProvider('openrouter', { baseUrl: 'https://openrouter.ai/api' });
    const removedModelProvider = await api.deleteModelProvider('openrouter');
    const savedModelProviderModel = await api.saveModelProviderModel('openrouter', { modelId: 'model-a' });
    const removedModelProviderModel = await api.deleteModelProviderModel('openrouter', 'model-a');
    const providerAuth = await api.providerAuth();
    const providerApiKey = await api.setProviderApiKey('openai', 'sk-test');
    const removedProviderCredential = await api.removeProviderCredential('openai');
    const startedProviderOAuthLogin = await api.startProviderOAuthLogin('openrouter');
    const providerOAuthLogin = await api.providerOAuthLogin('login-1');
    const submittedProviderOAuthLoginInput = await api.submitProviderOAuthLoginInput('login-1', '123456');
    const cancelledProviderOAuthLogin = await api.cancelProviderOAuthLogin('login-1');
    const attentionMarked = await api.markConversationAttentionRead('conversation-1', true);
    const tasks = await api.tasks();
    const taskDetail = await api.taskDetail('task-1');
    const taskLog = await api.taskLog('task-1');
    const createdTask = await api.createTask({ title: 'Created task', prompt: 'Prompt body' });
    const toggledTask = await api.setTaskEnabled('task-1', false);
    const savedTask = await api.saveTask('task-1', { prompt: 'Updated task body' });
    const taskRun = await api.runTaskNow('task-1');
    const runs = await api.runs();
    const durableRun = await api.durableRun('run-1');
    const durableRunLog = await api.durableRunLog('run-1', 25);
    const durableRunAttention = await api.markDurableRunAttentionRead('run-1', false);
    const cancelledRun = await api.cancelDurableRun('run-1');
    const bootstrap = await api.conversationBootstrap('conversation-1', {
      knownSessionSignature: 'sig-1',
      tailBlocks: 12,
    });
    const renamed = await api.renameConversation('conversation-1', 'Renamed conversation', 'surface-1');
    const changedCwd = await api.changeConversationCwd('live-1', '/next-repo', 'surface-1');
    const resumeResult = await api.resumeConversation('conversation-1');
    const modelPreferences = await api.conversationModelPreferences('live-1');
    const updatedModelPreferences = await api.updateConversationModelPreferences('live-1', { thinkingLevel: 'medium' }, 'surface-1');
    const live = await api.liveSession('live-1');
    const forkEntries = await api.forkEntries('live-1');
    const liveContext = await api.liveSessionContext('live-1');
    const sessionDetail = await api.sessionDetail('live-1', { tailBlocks: 24 });
    const sessionBlock = await api.sessionBlock('live-1', 'block-1');
    const created = await api.createLiveSession('/repo', undefined, { model: 'gpt-5.4' });
    const resumed = await api.resumeSession('/tmp/live-1.jsonl', '/repo');
    const takeover = await api.takeoverLiveSession('live-1', 'surface-1');
    const prompted = await api.promptSession('live-1', 'hello', 'followUp', [], [], 'surface-1');
    const restored = await api.restoreQueuedMessage('live-1', { behavior: 'followUp', index: 0, previewId: 'queue-1' }, 'surface-1');
    const compacted = await api.compactSession('live-1', 'be shorter', 'surface-1');
    const exported = await api.exportSession('live-1', '/tmp/live-1.html');
    const reloaded = await api.reloadSession('live-1', 'surface-1');
    const branched = await api.branchSession('live-1', 'entry-1', 'surface-1');
    const forked = await api.forkSession('live-1', 'entry-1', { preserveSource: true, beforeEntry: true }, 'surface-1');
    const aborted = await api.abortSession('live-1', 'surface-1');
    const destroyed = await api.destroySession('conversation-1', 'surface-1');

    expect(getEnvironment).not.toHaveBeenCalled();
    expect(readAppStatus).toHaveBeenCalledTimes(1);
    expect(readDaemonState).toHaveBeenCalledTimes(1);
    expect(readSessions).toHaveBeenCalledTimes(1);
    expect(limitedSessions).toEqual([{ id: 'limited' }]);
    expect(readSessionMeta).toHaveBeenCalledWith('conversation-1');
    expect(readSessionSearchIndex).toHaveBeenCalledWith(['conversation-1']);
    expect(readModels).toHaveBeenCalledTimes(1);
    expect(globalModelPreferences).toEqual({
      currentModel: 'gpt-5.4',
      currentVisionModel: '',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
    });
    expect(readModelPreferences).toHaveBeenCalledTimes(1);
    expect(updateModelPreferences).toHaveBeenCalledWith({ thinkingLevel: 'medium' });
    expect(readModelProviders).toHaveBeenCalledTimes(1);
    expect(saveModelProvider).toHaveBeenCalledWith({ provider: 'openrouter', baseUrl: 'https://openrouter.ai/api' });
    expect(deleteModelProvider).toHaveBeenCalledWith('openrouter');
    expect(saveModelProviderModel).toHaveBeenCalledWith({ provider: 'openrouter', modelId: 'model-a' });
    expect(deleteModelProviderModel).toHaveBeenCalledWith({ provider: 'openrouter', modelId: 'model-a' });
    expect(readProviderAuth).toHaveBeenCalledTimes(1);
    expect(setProviderApiKey).toHaveBeenCalledWith({ provider: 'openai', apiKey: 'sk-test' });
    expect(removeProviderCredential).toHaveBeenCalledWith('openai');
    expect(startProviderOAuthLogin).toHaveBeenCalledWith('openrouter');
    expect(readProviderOAuthLogin).toHaveBeenCalledWith('login-1');
    expect(submitProviderOAuthLoginInput).toHaveBeenCalledWith({ loginId: 'login-1', value: '123456' });
    expect(cancelProviderOAuthLogin).toHaveBeenCalledWith('login-1');
    expect(markConversationAttention).toHaveBeenCalledWith({ conversationId: 'conversation-1', read: true });
    expect(readScheduledTasks).toHaveBeenCalledTimes(1);
    expect(readScheduledTaskDetail).toHaveBeenCalledWith('task-1');
    expect(readScheduledTaskLog).toHaveBeenCalledWith('task-1');
    expect(createScheduledTask).toHaveBeenCalledWith({ title: 'Created task', prompt: 'Prompt body' });
    expect(updateScheduledTask).toHaveBeenCalledWith({ taskId: 'task-1', enabled: false });
    expect(updateScheduledTask).toHaveBeenCalledWith({ taskId: 'task-1', prompt: 'Updated task body' });
    expect(runScheduledTask).toHaveBeenCalledWith('task-1');
    expect(readDurableRuns).toHaveBeenCalledTimes(1);
    expect(readDurableRun).toHaveBeenCalledWith('run-1');
    expect(readDurableRunLog).toHaveBeenCalledWith({ runId: 'run-1', tail: 25 });
    expect(markDurableRunAttention).toHaveBeenCalledWith({ runId: 'run-1', read: false });
    expect(cancelDurableRun).toHaveBeenCalledWith('run-1');
    expect(readConversationBootstrap).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      tailBlocks: 12,
      knownSessionSignature: 'sig-1',
    });
    expect(renameConversation).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      name: 'Renamed conversation',
      surfaceId: 'surface-1',
    });
    expect(changeConversationCwd).toHaveBeenCalledWith({
      conversationId: 'live-1',
      cwd: '/next-repo',
      surfaceId: 'surface-1',
    });
    expect(resumeConversation).toHaveBeenCalledWith('conversation-1');
    expect(readConversationModelPreferences).toHaveBeenCalledWith({ conversationId: 'live-1' });
    expect(updateConversationModelPreferences).toHaveBeenCalledWith({
      conversationId: 'live-1',
      thinkingLevel: 'medium',
      surfaceId: 'surface-1',
    });
    expect(readLiveSession).toHaveBeenCalledWith('live-1');
    expect(readLiveSessionForkEntries).toHaveBeenCalledWith('live-1');
    expect(readLiveSessionContext).toHaveBeenCalledWith('live-1');
    expect(readSessionDetail).toHaveBeenCalledWith({ sessionId: 'live-1', tailBlocks: 24 });
    expect(readSessionBlock).toHaveBeenCalledWith({ sessionId: 'live-1', blockId: 'block-1' });
    expect(createLiveSession).toHaveBeenCalledWith({ cwd: '/repo', model: 'gpt-5.4' });
    expect(resumeLiveSession).toHaveBeenCalledWith({ sessionFile: '/tmp/live-1.jsonl', cwd: '/repo' });
    expect(takeOverLiveSession).toHaveBeenCalledWith({ conversationId: 'live-1', surfaceId: 'surface-1' });
    expect(submitLiveSessionPrompt).toHaveBeenCalledWith({
      conversationId: 'live-1',
      text: 'hello',
      behavior: 'followUp',
      surfaceId: 'surface-1',
      images: [],
      attachmentRefs: [],
    });
    expect(restoreQueuedLiveSessionMessage).toHaveBeenCalledWith({
      conversationId: 'live-1',
      behavior: 'followUp',
      index: 0,
      previewId: 'queue-1',
    });
    expect(compactLiveSession).toHaveBeenCalledWith({ conversationId: 'live-1', customInstructions: 'be shorter' });
    expect(exportLiveSession).toHaveBeenCalledWith({ conversationId: 'live-1', outputPath: '/tmp/live-1.html' });
    expect(reloadLiveSession).toHaveBeenCalledWith('live-1');
    expect(branchLiveSession).toHaveBeenCalledWith({ conversationId: 'live-1', entryId: 'entry-1', surfaceId: 'surface-1' });
    expect(forkLiveSession).toHaveBeenCalledWith({
      conversationId: 'live-1',
      entryId: 'entry-1',
      preserveSource: true,
      beforeEntry: true,
      surfaceId: 'surface-1',
    });
    expect(abortLiveSession).toHaveBeenCalledWith('live-1');
    expect(destroyLiveSession).toHaveBeenCalledWith('conversation-1');
    expect(status).toEqual({
      repoRoot: '/repo',
      appRevision: 'rev-1',
    });
    expect(daemon).toEqual({
      warnings: [],
      service: { platform: 'desktop', identifier: 'daemon', manifestPath: '/tmp/daemon.plist', installed: true, running: true },
      runtime: { running: true, socketPath: '/tmp/daemon.sock', moduleCount: 3 },
      log: { lines: [] },
    });
    expect(sessions).toEqual([{ id: 'conversation-1', title: 'Conversation 1' }]);
    expect(sessionMeta).toEqual({ id: 'conversation-1', title: 'Conversation 1' });
    expect(sessionSearchIndex).toEqual({ index: { 'conversation-1': 'hello world' } });
    expect(relatedConversationResults.visibleResults.map((result) => result.sessionId)).toEqual(['conversation-1']);
    expect(models).toEqual({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
      models: [{ id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 272_000 }],
    });
    expect(modelPreferenceUpdate).toEqual({ ok: true });
    expect(modelProviders).toEqual({ providers: [{ id: 'openrouter', models: [] }] });
    expect(savedModelProvider).toEqual({ providers: [{ id: 'openrouter', models: [] }] });
    expect(removedModelProvider).toEqual({ providers: [] });
    expect(savedModelProviderModel).toEqual({ providers: [{ id: 'openrouter', models: [{ id: 'model-a' }] }] });
    expect(removedModelProviderModel).toEqual({ providers: [{ id: 'openrouter', models: [] }] });
    expect(providerAuth).toEqual({ providers: [{ id: 'openai', authType: 'api_key' }] });
    expect(providerApiKey).toEqual({ providers: [{ id: 'openai', authType: 'api_key' }] });
    expect(removedProviderCredential).toEqual({ providers: [] });
    expect(startedProviderOAuthLogin).toEqual({ id: 'login-1', provider: 'openrouter', providerName: 'OpenRouter', status: 'running' });
    expect(providerOAuthLogin).toEqual({ id: 'login-1', provider: 'openrouter', providerName: 'OpenRouter', status: 'running' });
    expect(submittedProviderOAuthLoginInput).toEqual({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'running',
    });
    expect(cancelledProviderOAuthLogin).toEqual({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'cancelled',
    });
    expect(attentionMarked).toEqual({ ok: true });
    expect(tasks).toEqual([{ id: 'task-1', scheduleType: 'cron', running: false, enabled: true, prompt: 'Prompt', title: 'Task 1' }]);
    expect(taskDetail).toEqual({
      id: 'task-1',
      scheduleType: 'cron',
      running: false,
      enabled: true,
      prompt: 'Prompt body',
      threadMode: 'dedicated',
    });
    expect(taskLog).toEqual({ path: '/tasks/task-1.log', log: 'task tail' });
    expect(createdTask).toEqual({
      ok: true,
      task: { id: 'task-2', scheduleType: 'cron', running: false, enabled: true, prompt: 'Created task body', threadMode: 'dedicated' },
    });
    expect(toggledTask).toEqual({
      ok: true,
      task: { id: 'task-1', scheduleType: 'cron', running: false, enabled: false, prompt: 'Updated task body', threadMode: 'dedicated' },
    });
    expect(savedTask).toEqual({
      ok: true,
      task: { id: 'task-1', scheduleType: 'cron', running: false, enabled: false, prompt: 'Updated task body', threadMode: 'dedicated' },
    });
    expect(taskRun).toEqual({ ok: true, accepted: true, runId: 'run-from-task' });
    expect(runs).toMatchObject({ runsRoot: '/runs' });
    expect(durableRun).toMatchObject({ runsRoot: '/runs' });
    expect(durableRunLog).toEqual({ path: '/runs/run-1.log', log: 'tail' });
    expect(durableRunAttention).toEqual({ ok: true });
    expect(cancelledRun).toEqual({ cancelled: true, runId: 'run-1' });
    expect(bootstrap).toEqual(createBootstrapState());
    expect(renamed).toEqual({ ok: true, title: 'Renamed conversation' });
    expect(changedCwd).toEqual({ id: 'live-1', sessionFile: '/tmp/live-1.jsonl', cwd: '/next-repo', changed: true });
    expect(resumeResult).toEqual({
      conversationId: 'live-1',
      live: true,
      resumed: true,
      replayedPendingOperation: false,
      usedFallbackPrompt: true,
    });
    expect(modelPreferences).toEqual({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
      hasExplicitServiceTier: false,
    });
    expect(updatedModelPreferences).toEqual({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'medium',
      currentServiceTier: 'priority',
      hasExplicitServiceTier: true,
    });
    expect(live).toEqual({ live: true, id: 'live-1' });
    expect(forkEntries).toEqual([{ entryId: 'entry-1', text: 'fork from here' }]);
    expect(liveContext).toEqual({ cwd: '/repo', branch: 'main', git: null });
    expect(sessionDetail).toEqual({ meta: { id: 'live-1' }, blocks: [], blockOffset: 0, totalBlocks: 0, contextUsage: null });
    expect(sessionBlock).toEqual({ id: 'block-1', type: 'text', text: 'hello' });
    expect(created).toEqual({
      id: 'live-1',
      sessionFile: '/tmp/live-1.jsonl',
      bootstrap: createBootstrapState({
        conversationId: 'live-1',
        sessionDetail: {
          meta: {
            id: 'live-1',
            file: '/tmp/live-1.jsonl',
            timestamp: '2026-04-11T00:00:00.000Z',
            cwd: '/repo',
            cwdSlug: '-repo',
            model: 'gpt-5.4',
            title: 'New Conversation',
            messageCount: 0,
          },
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          contextUsage: null,
        },
        liveSession: {
          live: true,
          id: 'live-1',
          cwd: '/repo',
          sessionFile: '/tmp/live-1.jsonl',
          title: 'New Conversation',
          isStreaming: false,
        },
      }),
    });
    expect(resumed).toEqual({ id: 'live-1' });
    expect(takeover).toMatchObject({ controllerSurfaceId: 'surface-1' });
    expect(prompted).toEqual({ ok: true, accepted: true, delivery: 'started' });
    expect(restored).toEqual({ ok: true, text: 'queued hello', images: [] });
    expect(compacted).toEqual({ ok: true, result: { compacted: true } });
    expect(exported).toEqual({ ok: true, path: '/tmp/live-1.html' });
    expect(reloaded).toEqual({ ok: true });
    expect(branched).toEqual({ newSessionId: 'branch-1', sessionFile: '/tmp/branch-1.jsonl', bootstrap: createBootstrapState() });
    expect(forked).toEqual({ newSessionId: 'fork-1', sessionFile: '/tmp/fork-1.jsonl' });
    expect(aborted).toEqual({ ok: true });
    expect(destroyed).toEqual({ ok: true });
  });

  it('uses HTTP for conversation artifacts and attachments on the local Electron host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const readConversationArtifacts = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      artifacts: [{ id: 'artifact-1', title: 'Artifact 1', kind: 'html' }],
    });
    const readConversationArtifact = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      artifact: { id: 'artifact-1', title: 'Artifact 1', kind: 'html', content: '<p>Artifact</p>' },
    });
    const readConversationAttachments = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      attachments: [{ id: 'attachment-1', kind: 'excalidraw' }],
    });
    const readConversationAttachment = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 1, latestRevision: { revision: 1 } },
    });
    const createConversationAttachment = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 1, latestRevision: { revision: 1 } },
    });
    const updateConversationAttachment = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 2, latestRevision: { revision: 2 } },
    });
    const readConversationAttachmentAsset = vi.fn().mockResolvedValue({
      dataUrl: 'data:image/png;base64,cHJldmlldw==',
      mimeType: 'image/png',
      fileName: 'preview.png',
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/conversations/conversation-1/artifacts') return createJsonResponse(await readConversationArtifacts());
      if (path === '/api/conversations/conversation-1/artifacts/artifact-1')
        return createJsonResponse(await readConversationArtifact({ conversationId: 'conversation-1', artifactId: 'artifact-1' }));
      if (path === '/api/conversations/conversation-1/attachments' && init?.method === 'POST')
        return createJsonResponse(
          await createConversationAttachment({ conversationId: 'conversation-1', ...JSON.parse(String(init.body)) }),
        );
      if (path === '/api/conversations/conversation-1/attachments') return createJsonResponse(await readConversationAttachments());
      if (path === '/api/conversations/conversation-1/attachments/attachment-1' && init?.method === 'PATCH')
        return createJsonResponse(
          await updateConversationAttachment({
            conversationId: 'conversation-1',
            attachmentId: 'attachment-1',
            ...JSON.parse(String(init.body)),
          }),
        );
      if (path === '/api/conversations/conversation-1/attachments/attachment-1')
        return createJsonResponse(await readConversationAttachment({ conversationId: 'conversation-1', attachmentId: 'attachment-1' }));
      if (path === '/api/conversations/conversation-1/attachments/attachment-1/asset?asset=preview&revision=2')
        return createJsonResponse(
          await readConversationAttachmentAsset({
            conversationId: 'conversation-1',
            attachmentId: 'attachment-1',
            asset: 'preview',
            revision: 2,
          }),
        );
      return createJsonResponse({});
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        readConversationArtifacts,
        readConversationArtifact,
        readConversationAttachments,
        readConversationAttachment,
        createConversationAttachment,
        updateConversationAttachment,
        readConversationAttachmentAsset,
      },
    });

    const { api } = await import('./api');
    const artifacts = await api.conversationArtifacts('conversation-1');
    const artifact = await api.conversationArtifact('conversation-1', 'artifact-1');
    const attachments = await api.conversationAttachments('conversation-1');
    const attachment = await api.conversationAttachment('conversation-1', 'attachment-1');
    const createdAttachment = await api.createConversationAttachment('conversation-1', { sourceData: 'source', previewData: 'preview' });
    const updatedAttachment = await api.updateConversationAttachment('conversation-1', 'attachment-1', {
      sourceData: 'source',
      previewData: 'preview',
    });
    const attachmentAsset = await api.conversationAttachmentAsset('conversation-1', 'attachment-1', 'preview', 2);

    expect(readConversationArtifacts).toHaveBeenCalledTimes(1);
    expect(readConversationArtifact).toHaveBeenCalledWith({ conversationId: 'conversation-1', artifactId: 'artifact-1' });
    expect(readConversationAttachments).toHaveBeenCalledTimes(1);
    expect(readConversationAttachment).toHaveBeenCalledWith({ conversationId: 'conversation-1', attachmentId: 'attachment-1' });
    expect(createConversationAttachment).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      sourceData: 'source',
      previewData: 'preview',
    });
    expect(updateConversationAttachment).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      attachmentId: 'attachment-1',
      sourceData: 'source',
      previewData: 'preview',
    });
    expect(readConversationAttachmentAsset).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      attachmentId: 'attachment-1',
      asset: 'preview',
      revision: 2,
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(artifacts).toEqual({
      conversationId: 'conversation-1',
      artifacts: [{ id: 'artifact-1', title: 'Artifact 1', kind: 'html' }],
    });
    expect(artifact).toEqual({
      conversationId: 'conversation-1',
      artifact: { id: 'artifact-1', title: 'Artifact 1', kind: 'html', content: '<p>Artifact</p>' },
    });
    expect(attachments).toEqual({ conversationId: 'conversation-1', attachments: [{ id: 'attachment-1', kind: 'excalidraw' }] });
    expect(attachment).toEqual({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 1, latestRevision: { revision: 1 } },
    });
    expect(createdAttachment).toEqual({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 1, latestRevision: { revision: 1 } },
    });
    expect(updatedAttachment).toEqual({
      conversationId: 'conversation-1',
      attachment: { id: 'attachment-1', kind: 'excalidraw', currentRevision: 2, latestRevision: { revision: 2 } },
    });
    expect(attachmentAsset).toEqual({
      dataUrl: 'data:image/png;base64,cHJldmlldw==',
      mimeType: 'image/png',
      fileName: 'preview.png',
    });
  });

  it('uses HTTP for conversation deferred-resume state on the local Electron host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const readConversationDeferredResumes = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      resumes: [{ id: 'resume-1', dueAt: '2026-04-24T10:05:00.000Z' }],
    });
    const scheduleConversationDeferredResume = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      resume: { id: 'resume-2', dueAt: '2026-04-24T10:10:00.000Z', behavior: 'followUp' },
      resumes: [{ id: 'resume-2', dueAt: '2026-04-24T10:10:00.000Z', behavior: 'followUp' }],
    });
    const fireConversationDeferredResume = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      resume: { id: 'resume-1', dueAt: '2026-04-24T10:05:00.000Z', prompt: 'Resume now.' },
      resumes: [],
    });
    const cancelConversationDeferredResume = vi.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      cancelledId: 'resume-2',
      resumes: [],
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/conversations/conversation-1/deferred-resumes' && init?.method === 'POST')
        return createJsonResponse(
          await scheduleConversationDeferredResume({ conversationId: 'conversation-1', ...JSON.parse(String(init.body)) }),
        );
      if (path === '/api/conversations/conversation-1/deferred-resumes') return createJsonResponse(await readConversationDeferredResumes());
      if (path === '/api/conversations/conversation-1/deferred-resumes/resume-1/fire')
        return createJsonResponse(await fireConversationDeferredResume({ conversationId: 'conversation-1', resumeId: 'resume-1' }));
      if (path === '/api/conversations/conversation-1/deferred-resumes/resume-2')
        return createJsonResponse(await cancelConversationDeferredResume({ conversationId: 'conversation-1', resumeId: 'resume-2' }));
      return createJsonResponse({});
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        readConversationDeferredResumes,
        scheduleConversationDeferredResume,
        fireConversationDeferredResume,
        cancelConversationDeferredResume,
      },
    });

    const { api } = await import('./api');
    const resumes = await api.deferredResumes('conversation-1');
    const scheduled = await api.scheduleDeferredResume('conversation-1', { delay: '10m', prompt: 'Resume later.', behavior: 'followUp' });
    const fired = await api.fireDeferredResumeNow('conversation-1', 'resume-1');
    const cancelled = await api.cancelDeferredResume('conversation-1', 'resume-2');

    expect(readConversationDeferredResumes).toHaveBeenCalledTimes(1);
    expect(scheduleConversationDeferredResume).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      delay: '10m',
      prompt: 'Resume later.',
      behavior: 'followUp',
    });
    expect(fireConversationDeferredResume).toHaveBeenCalledWith({ conversationId: 'conversation-1', resumeId: 'resume-1' });
    expect(cancelConversationDeferredResume).toHaveBeenCalledWith({ conversationId: 'conversation-1', resumeId: 'resume-2' });
    expect(fetchMock).toHaveBeenCalled();
    expect(resumes).toEqual({
      conversationId: 'conversation-1',
      resumes: [{ id: 'resume-1', dueAt: '2026-04-24T10:05:00.000Z' }],
    });
    expect(scheduled).toEqual({
      conversationId: 'conversation-1',
      resume: { id: 'resume-2', dueAt: '2026-04-24T10:10:00.000Z', behavior: 'followUp' },
      resumes: [{ id: 'resume-2', dueAt: '2026-04-24T10:10:00.000Z', behavior: 'followUp' }],
    });
    expect(fired).toEqual({
      conversationId: 'conversation-1',
      resume: { id: 'resume-1', dueAt: '2026-04-24T10:05:00.000Z', prompt: 'Resume now.' },
      resumes: [],
    });
    expect(cancelled).toEqual({
      conversationId: 'conversation-1',
      cancelledId: 'resume-2',
      resumes: [],
    });
  });

  it('uses HTTP for product operator settings and IPC for native folder picking', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/default-cwd' && init?.method === 'PATCH')
        return createJsonResponse({ currentCwd: './repo', effectiveCwd: '/repo' });
      if (path === '/api/default-cwd') return createJsonResponse({ currentCwd: '', effectiveCwd: '/repo' });
      return createJsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const readDefaultCwd = vi.fn().mockResolvedValue({ currentCwd: '', effectiveCwd: '/repo' });
    const updateDefaultCwd = vi.fn().mockResolvedValue({ currentCwd: './repo', effectiveCwd: '/repo' });
    const pickFolder = vi.fn().mockResolvedValue({ path: '/picked/repo', cancelled: false });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        readDefaultCwd,
        updateDefaultCwd,
        pickFolder,
      },
    });

    const { api } = await import('./api');
    const defaultCwd = await api.defaultCwd();
    const savedDefaultCwd = await api.updateDefaultCwd('./repo');

    expect(readDefaultCwd).not.toHaveBeenCalled();
    expect(updateDefaultCwd).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/default-cwd', { method: 'GET', cache: 'no-store' });
    expect(defaultCwd).toEqual({ currentCwd: '', effectiveCwd: '/repo' });
    expect(savedDefaultCwd).toEqual({ currentCwd: './repo', effectiveCwd: '/repo' });
  });

  it('passes custom folder picker prompts through the local desktop bridge', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const pickFolder = vi.fn().mockResolvedValue({ path: '/picked/knowledge', cancelled: false });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        pickFolder,
      },
    });

    const { api } = await import('./api');
    const pickedFolder = await api.pickFolder({ cwd: '/repo', prompt: 'Choose folder' });

    expect(pickFolder).toHaveBeenCalledWith({ cwd: '/repo', prompt: 'Choose folder' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pickedFolder).toEqual({ path: '/picked/knowledge', cancelled: false });
  });

  it('uses HTTP for automation workspace product state on the local Electron host', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      createJsonResponse({
        defaultEnabled: true,
        presetLibrary: {
          presets: [{ id: 'preset-1', name: 'Preset 1', updatedAt: '2026-04-14T12:00:00.000Z', items: [] }],
          defaultPresetIds: ['preset-1'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const readConversationPlansWorkspace = vi.fn().mockResolvedValue({
      defaultEnabled: true,
      presetLibrary: {
        presets: [{ id: 'preset-1', name: 'Preset 1', updatedAt: '2026-04-14T12:00:00.000Z', items: [] }],
        defaultPresetIds: ['preset-1'],
      },
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        readConversationPlansWorkspace,
      },
    });

    const { api } = await import('./api');
    const workspace = await api.conversationPlansWorkspace();

    expect(readConversationPlansWorkspace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/conversation-plans/workspace', { method: 'GET', cache: 'no-store' });
    expect(workspace).toEqual({
      defaultEnabled: true,
      presetLibrary: {
        presets: [{ id: 'preset-1', name: 'Preset 1', updatedAt: '2026-04-14T12:00:00.000Z', items: [] }],
        defaultPresetIds: ['preset-1'],
      },
    });
  });

  it('uses HTTP for open-conversation layout product state', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/ui/open-conversations' && init?.method === 'PATCH') {
        return createJsonResponse({
          ok: true,
          sessionIds: ['conversation-4'],
          pinnedSessionIds: ['conversation-5'],
          archivedSessionIds: ['conversation-6'],
          workspacePaths: ['/tmp/beta'],
        });
      }
      if (path === '/api/ui/open-conversations/operation' && init?.method === 'POST') {
        return createJsonResponse({
          ok: true,
          sessionIds: ['conversation-7'],
          pinnedSessionIds: ['conversation-5'],
          archivedSessionIds: [],
          workspacePaths: ['/tmp/beta'],
        });
      }
      if (path === '/api/ui/open-conversations') {
        return createJsonResponse({
          sessionIds: ['conversation-1'],
          pinnedSessionIds: ['conversation-2'],
          archivedSessionIds: ['conversation-3'],
          workspacePaths: ['/tmp/alpha'],
        });
      }
      return createJsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const readOpenConversationTabs = vi.fn().mockResolvedValue({
      sessionIds: ['conversation-1'],
      pinnedSessionIds: ['conversation-2'],
      archivedSessionIds: ['conversation-3'],
      workspacePaths: ['/tmp/alpha'],
    });
    const updateOpenConversationTabs = vi.fn().mockResolvedValue({
      ok: true,
      sessionIds: ['conversation-4'],
      pinnedSessionIds: ['conversation-5'],
      archivedSessionIds: ['conversation-6'],
      workspacePaths: ['/tmp/beta'],
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local backend is healthy.',
        }),
        readOpenConversationTabs,
        updateOpenConversationTabs,
      },
    });

    const { api } = await import('./api');
    const layout = await api.openConversationTabs();
    const savedLayout = await api.saveConversationWorkspaceLayout(['conversation-4'], ['conversation-5'], ['conversation-6']);
    const operationLayout = await api.updateConversationWorkspace({ operation: 'pin', sessionId: 'conversation-7' });

    expect(readOpenConversationTabs).not.toHaveBeenCalled();
    expect(updateOpenConversationTabs).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/ui/open-conversations', { method: 'GET', cache: 'no-store' });
    expect(layout).toEqual({
      sessionIds: ['conversation-1'],
      pinnedSessionIds: ['conversation-2'],
      archivedSessionIds: ['conversation-3'],
      workspacePaths: ['/tmp/alpha'],
    });
    expect(savedLayout).toEqual({
      ok: true,
      sessionIds: ['conversation-4'],
      pinnedSessionIds: ['conversation-5'],
      archivedSessionIds: ['conversation-6'],
      workspacePaths: ['/tmp/beta'],
    });
    expect(operationLayout).toEqual({
      ok: true,
      sessionIds: ['conversation-7'],
      pinnedSessionIds: ['conversation-5'],
      archivedSessionIds: [],
      workspacePaths: ['/tmp/beta'],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/ui/open-conversations/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'pin', sessionId: 'conversation-7' }),
    });
  });
});
