import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayState = vi.hoisted(() => ({
  attachGatewayConversation: vi.fn(),
  defaultGatewayProviders: vi.fn(() => [{ id: 'telegram', label: 'Telegram', implemented: true, configurationLocation: 'gateways' }]),
  detachGatewayConversation: vi.fn(),
  ensureGatewayConnection: vi.fn(),
  normalizeGatewayProviderId: vi.fn((value: unknown) =>
    typeof value === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(value.trim()) ? value.trim() : null,
  ),
  readGatewayState: vi.fn(() => ({ connections: [] })),
  recordGatewayEvent: vi.fn(() => ({ connections: [] })),
  updateGatewayConnectionStatus: vi.fn(() => ({ connections: [{ provider: 'telegram' }] })),
  upsertGatewayChatTarget: vi.fn(),
}));
const extensionRegistry = vi.hoisted(() => ({
  listExtensionGatewayProviderRegistrations: vi.fn(() => [
    {
      extensionId: 'discord-gateway',
      packageType: 'user',
      id: 'discord',
      label: 'Discord',
      implemented: true,
      configurationLocation: 'extension',
    },
  ]),
}));
const telegramAccess = vi.hoisted(() => ({
  readTelegramAccessPolicy: vi.fn(() => ({ approvedUserIds: ['111'], approvedChatIds: ['222'] })),
  writeTelegramAccessPolicy: vi.fn((_stateRoot: string, _profile: string, policy: unknown) => policy),
}));
const telegramAuth = vi.hoisted(() => ({
  readTelegramBotToken: vi.fn(() => null as string | null),
  removeTelegramBotToken: vi.fn(),
  writeTelegramBotToken: vi.fn(),
}));
const runtime = vi.hoisted(() => ({
  instances: [] as Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    isRunning: ReturnType<typeof vi.fn>;
    hasRecentlyDeliveredAssistantReply: ReturnType<typeof vi.fn>;
    deliverAssistantReply: ReturnType<typeof vi.fn>;
    dependencies: Record<string, unknown>;
  }>,
  TelegramGatewayRuntime: vi.fn(function MockTelegramGatewayRuntime(this: unknown, dependencies: Record<string, unknown>) {
    const instance = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn(() => true),
      hasRecentlyDeliveredAssistantReply: vi.fn(() => false),
      deliverAssistantReply: vi.fn(async () => true),
      dependencies,
    };
    runtime.instances.push(instance);
    return instance;
  }),
}));
const lifecycle = vi.hoisted(() => ({ registerLiveSessionLifecycleHandler: vi.fn() }));
const liveSessions = vi.hoisted(() => ({
  getAvailableModelObjects: vi.fn(async () => []),
  renameSession: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  updateLiveSessionModelPreferences: vi.fn(),
}));
const conversationService = vi.hoisted(() => ({
  listConversationSessionsSnapshot: vi.fn(() => [
    {
      id: 'conv-1',
      title: 'Open one',
      timestamp: '2026-06-28T12:00:00.000Z',
      lastActivityAt: '2026-06-28T12:00:00.000Z',
      isRunning: false,
    },
    {
      id: 'archived-1',
      title: 'Archived one',
      timestamp: '2026-06-27T12:00:00.000Z',
      lastActivityAt: '2026-06-27T12:00:00.000Z',
      isRunning: false,
    },
  ]),
  readSessionDetailForRoute: vi.fn(async () => ({ sessionRead: { detail: { blocks: [{ type: 'text', text: ' latest reply ' }] } } })),
}));
const capability = vi.hoisted(() => ({
  compactLiveSessionCapability: vi.fn(),
  createLiveSessionCapability: vi.fn(async () => ({ id: 'conv-new' })),
  submitLiveSessionPromptCapability: vi.fn(),
}));
const appEvents = vi.hoisted(() => ({
  invalidateAppTopics: vi.fn(),
  publishAppEvent: vi.fn(),
}));

vi.mock('../gateways/gatewayState.js', () => gatewayState);
vi.mock('../extensions/extensionRegistry.js', () => extensionRegistry);
vi.mock('../gateways/telegramAccess.js', () => telegramAccess);
vi.mock('../gateways/telegramAuth.js', () => telegramAuth);
vi.mock('../gateways/telegramGateway.js', () => ({ TelegramGatewayRuntime: runtime.TelegramGatewayRuntime }));
vi.mock('../conversations/liveSessionLifecycle.js', () => lifecycle);
vi.mock('../conversations/liveSessions.js', () => liveSessions);
vi.mock('../conversations/liveSessionCapability.js', () => capability);
vi.mock('../conversations/conversationService.js', () => conversationService);
vi.mock('../middleware/index.js', () => ({ logError: vi.fn() }));
vi.mock('../shared/appEvents.js', () => appEvents);

import { TELEGRAM_GATEWAY_HOST_API_GLOBAL } from '../extensions/backendApi/gateways.js';
import {
  ensureTelegramRuntime,
  registerGatewayRoutes,
  registerTelegramGatewayLifecycleDelivery,
  startTelegramGatewayRuntime,
  stopTelegramGatewayRuntime,
} from './gateways.js';

describe('gateway routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    conversationService.readSessionDetailForRoute.mockResolvedValue({
      sessionRead: { detail: { blocks: [{ type: 'text', text: ' latest reply ' }] } },
    });
  });

  function context() {
    return {
      getRuntimeScope: () => 'shared',
      getStateRoot: () => '/state',
      getAuthFile: () => '/auth.json',
      getRepoRoot: () => '/repo',
      getDefaultWebCwd: () => '/repo',
      getSavedUiPreferences: () => ({
        openConversationIds: ['conv-1'],
        pinnedConversationIds: [],
        archivedConversationIds: ['archived-1'],
        lockedConversationIds: [],
        activeConversationId: 'conv-1',
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 1,
        conversationWorkspaceUpdatedAt: null,
        conversationWorkspaceMigratedAt: null,
        nodeBrowserViews: [],
      }),
      buildLiveSessionResourceOptions: () => ({}),
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: vi.fn(),
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
    };
  }

  function register() {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
    registerGatewayRoutes(router as never, context() as never);
    return router;
  }

  function response() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }

  it('passes live session events into the Telegram runtime', () => {
    register();
    const instance = ensureTelegramRuntime();
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    liveSessions.subscribe.mockReturnValueOnce(unsubscribe);

    const result = (
      instance as unknown as { dependencies: { subscribeConversationEvents?: typeof liveSessions.subscribe } }
    ).dependencies.subscribeConversationEvents?.('conv-1', listener);

    expect(result).toBe(unsubscribe);
    expect(liveSessions.subscribe).toHaveBeenCalledWith('conv-1', listener, { tailBlocks: 0 });
  });

  it('passes active and archived sidebar-scoped conversation lists into the Telegram runtime', () => {
    register();
    const instance = ensureTelegramRuntime();
    const listConversations = (instance as unknown as { dependencies: { listConversations: (input?: unknown) => unknown } }).dependencies
      .listConversations;

    expect(listConversations({ scope: 'active' })).toEqual([
      expect.objectContaining({ id: 'conv-1', title: 'Open one', placement: 'active' }),
    ]);
    expect(listConversations({ scope: 'archived', query: 'archived' })).toEqual([
      expect.objectContaining({ id: 'archived-1', title: 'Archived one', placement: 'archived' }),
    ]);
  });

  it('passes real transcript tail reads into the Telegram runtime', async () => {
    conversationService.readSessionDetailForRoute.mockResolvedValueOnce({
      sessionRead: {
        detail: {
          blocks: [
            { type: 'user', text: 'hello', ts: '2026-06-28T12:00:00.000Z' },
            { type: 'text', text: 'hi there', ts: '2026-06-28T12:00:01.000Z' },
            { type: 'tool_use', tool: 'bash', status: 'error', output: 'failed', ts: '2026-06-28T12:00:02.000Z' },
          ],
        },
      },
    });
    register();
    const instance = ensureTelegramRuntime();
    const readConversationTail = (
      instance as unknown as { dependencies: { readConversationTail: (conversationId: string, count: number) => Promise<unknown> } }
    ).dependencies.readConversationTail;

    await expect(readConversationTail('conv-1', 3)).resolves.toEqual([
      { role: 'user', text: 'hello', timestamp: '2026-06-28T12:00:00.000Z' },
      { role: 'assistant', text: 'hi there', timestamp: '2026-06-28T12:00:01.000Z' },
      { role: 'tool', text: 'bash failed: failed', timestamp: '2026-06-28T12:00:02.000Z' },
    ]);
    expect(conversationService.readSessionDetailForRoute).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      profile: 'shared',
      tailBlocks: 20,
    });
  });

  function latestRuntime() {
    return runtime.instances[runtime.instances.length - 1];
  }

  function route(router: Record<string, ReturnType<typeof vi.fn>>, method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return router[method].mock.calls.find(([registeredPath]) => registeredPath === path)?.[1];
  }

  it('publishes the telegram host api and starts runtime only when enabled and token is configured', () => {
    gatewayState.readGatewayState.mockReturnValueOnce({ connections: [{ provider: 'telegram', enabled: true }] });
    telegramAuth.readTelegramBotToken.mockReturnValueOnce('token');
    register();

    expect((globalThis as Record<string, unknown>)[TELEGRAM_GATEWAY_HOST_API_GLOBAL]).toMatchObject({
      startTelegramGatewayRuntime: expect.any(Function),
      stopTelegramGatewayRuntime: expect.any(Function),
    });
    expect(latestRuntime().start).toHaveBeenCalledOnce();
    expect(startTelegramGatewayRuntime()).toEqual({ running: false });
    latestRuntime().isRunning.mockReturnValueOnce(false);
    expect(
      (globalThis as Record<string, { readTelegramGatewayRuntimeStatus: () => unknown }>)[
        TELEGRAM_GATEWAY_HOST_API_GLOBAL
      ].readTelegramGatewayRuntimeStatus(),
    ).toEqual({
      running: false,
    });
    expect(stopTelegramGatewayRuntime()).toEqual({ running: false });
    expect(latestRuntime().stop).toHaveBeenCalledOnce();
  });

  it('validates and creates gateway connections', () => {
    const router = register();
    const handler = route(router, 'post', '/api/gateways/connections');
    const bad = response();
    handler({ body: { provider: 'bad' } }, bad);
    expect(bad.status).toHaveBeenCalledWith(400);

    const ok = response();
    handler({ body: { provider: 'telegram' } }, ok);
    expect(gatewayState.ensureGatewayConnection).toHaveBeenCalledWith({ stateRoot: '/state', profile: 'shared', provider: 'telegram' });
    expect(ok.json).toHaveBeenCalledWith({ connections: [] });

    const contributed = response();
    handler({ body: { provider: 'discord' } }, contributed);
    expect(gatewayState.ensureGatewayConnection).toHaveBeenCalledWith({ stateRoot: '/state', profile: 'shared', provider: 'discord' });
  });

  it('invalidates sessions when extension gateway providers mutate through the host api', () => {
    register();
    const api = (globalThis as Record<string, unknown>)[TELEGRAM_GATEWAY_HOST_API_GLOBAL] as {
      attachGatewayConversation(input: {
        provider: string;
        conversationId: string;
        conversationTitle?: string;
        externalChatId?: string;
        externalChatLabel?: string;
      }): unknown;
      updateGatewayConnectionStatus(input: { provider: string; status: string; enabled?: boolean; statusMessage?: string }): unknown;
    };

    api.attachGatewayConversation({
      provider: 'discord',
      conversationId: 'conv-1',
      conversationTitle: 'One',
      externalChatId: 'channel-1',
    });
    api.updateGatewayConnectionStatus({ provider: 'discord', status: 'active', enabled: true });

    expect(gatewayState.attachGatewayConversation).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv-1',
      conversationTitle: 'One',
      externalChatId: 'channel-1',
      externalChatLabel: undefined,
    });
    expect(gatewayState.updateGatewayConnectionStatus).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'discord',
      status: 'active',
      enabled: true,
      statusMessage: undefined,
    });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledTimes(2);
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('gateways', 'sessions');
  });

  it('updates connection status and starts or stops telegram runtime', () => {
    const router = register();
    const handler = route(router, 'patch', '/api/gateways/connections/:provider');

    const pause = response();
    handler({ params: { provider: 'telegram' }, body: { status: 'paused', enabled: false, statusMessage: ' pause ' } }, pause);
    expect(gatewayState.updateGatewayConnectionStatus).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'telegram',
      status: 'paused',
      enabled: false,
      statusMessage: 'pause',
    });
    expect(latestRuntime().stop).toHaveBeenCalledOnce();

    const active = response();
    telegramAuth.readTelegramBotToken.mockReturnValueOnce('token');
    handler({ params: { provider: 'telegram' }, body: { status: 'active', enabled: true } }, active);
    expect(latestRuntime().start).toHaveBeenCalledOnce();

    const missingToken = response();
    handler({ params: { provider: 'telegram' }, body: { status: 'active', enabled: true } }, missingToken);
    expect(missingToken.status).toHaveBeenCalledWith(400);
    expect(missingToken.json).toHaveBeenCalledWith({ error: 'Save a Telegram bot token before enabling the gateway.' });
  });

  it('tests the configured Telegram bot token without exposing it', async () => {
    const router = register();
    const testToken = route(router, 'post', '/api/gateways/telegram/test');

    const missing = response();
    await testToken({}, missing);
    expect(missing.status).toHaveBeenCalledWith(400);

    telegramAuth.readTelegramBotToken.mockReturnValueOnce('secret-token');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, result: { id: 123, username: 'neon_bot' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const ok = response();
    await testToken({}, ok);

    expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/botsecret-token/getMe', { method: 'POST' });
    expect(ok.json).toHaveBeenCalledWith({ ok: true, bot: { id: 123, username: 'neon_bot' } });

    telegramAuth.readTelegramBotToken.mockReturnValueOnce('bad-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ ok: false, description: 'Unauthorized' }),
      })),
    );
    const invalid = response();
    await testToken({}, invalid);
    expect(invalid.status).toHaveBeenCalledWith(502);
    expect(invalid.json).toHaveBeenCalledWith({ ok: false, error: 'Unauthorized' });
  });

  it('reads and writes Telegram access policy', () => {
    const router = register();
    const getAccess = route(router, 'get', '/api/gateways/telegram/access');
    const patchAccess = route(router, 'patch', '/api/gateways/telegram/access');

    const read = response();
    getAccess({}, read);
    expect(telegramAccess.readTelegramAccessPolicy).toHaveBeenCalledWith('/state', 'shared');
    expect(read.json).toHaveBeenCalledWith({ approvedUserIds: ['111'], approvedChatIds: ['222'] });

    const written = response();
    patchAccess({ body: { approvedUserIds: ['333'], approvedChatIds: ['444'], ignored: true } }, written);
    expect(telegramAccess.writeTelegramAccessPolicy).toHaveBeenCalledWith('/state', 'shared', {
      approvedUserIds: ['333'],
      approvedChatIds: ['444'],
    });
    expect(written.json).toHaveBeenCalledWith({ approvedUserIds: ['333'], approvedChatIds: ['444'] });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('gateways', 'sessions');

    const invalid = response();
    patchAccess({ body: { approvedUserIds: ['@alice'], approvedChatIds: ['-100'] } }, invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(invalid.json).toHaveBeenCalledWith({ error: 'Telegram access IDs must be numeric. Chat IDs may start with -.' });
  });

  it('writes and removes telegram tokens while updating gateway state', () => {
    const router = register();
    const putToken = route(router, 'post', '/api/gateways/telegram/token');
    const deleteToken = route(router, 'delete', '/api/gateways/telegram/token');

    const bad = response();
    putToken({ body: { token: '' } }, bad);
    expect(bad.status).toHaveBeenCalledWith(400);

    const ok = response();
    putToken({ body: { token: ' token ' } }, ok);
    expect(telegramAuth.writeTelegramBotToken).toHaveBeenCalledWith('/auth.json', '/state', 'token');
    expect(latestRuntime().start).toHaveBeenCalled();
    expect(ok.json).toHaveBeenCalledWith({ configured: true, state: { connections: [] } });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('gateways', 'sessions');

    const removed = response();
    deleteToken({}, removed);
    expect(telegramAuth.removeTelegramBotToken).toHaveBeenCalledWith('/auth.json', '/state');
    expect(latestRuntime().stop).toHaveBeenCalled();
    expect(removed.json).toHaveBeenCalledWith({ configured: false, state: { connections: [] } });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('gateways', 'sessions');
  });

  it('binds and detaches gateway conversations with trimmed optional fields', () => {
    const router = register();
    route(
      router,
      'post',
      '/api/gateways/bindings',
    )(
      {
        body: {
          provider: 'telegram',
          conversationId: ' conv ',
          conversationTitle: ' Title ',
          externalChatId: ' chat ',
          externalChatLabel: ' Chat ',
        },
      },
      response(),
    );
    expect(gatewayState.attachGatewayConversation).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'telegram',
      conversationId: 'conv',
      conversationTitle: 'Title',
      externalChatId: 'chat',
      externalChatLabel: 'Chat',
    });

    route(
      router,
      'delete',
      '/api/gateways/bindings/:conversationId',
    )({ params: { conversationId: 'conv' }, query: { provider: 'discord' } }, response());
    expect(gatewayState.detachGatewayConversation).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv',
    });
  });

  it('delivers only new assistant replies through the lifecycle hook', async () => {
    register();
    registerTelegramGatewayLifecycleDelivery();
    registerTelegramGatewayLifecycleDelivery();
    expect(lifecycle.registerLiveSessionLifecycleHandler).toHaveBeenCalledTimes(1);
    const handler = lifecycle.registerLiveSessionLifecycleHandler.mock.calls[0][0];

    await handler({ trigger: 'turn_start', conversationId: 'conv-1' });
    await handler({ trigger: 'turn_end', conversationId: 'conv-1' });
    await handler({ trigger: 'turn_end', conversationId: 'conv-1' });

    expect(ensureTelegramRuntime().deliverAssistantReply).toHaveBeenCalledTimes(1);
    expect(ensureTelegramRuntime().deliverAssistantReply).toHaveBeenCalledWith({ conversationId: 'conv-1', text: 'latest reply' });

    ensureTelegramRuntime().deliverAssistantReply.mockClear();
    conversationService.readSessionDetailForRoute
      .mockResolvedValueOnce({ sessionRead: { detail: { blocks: [{ id: 'block-1', type: 'text', text: 'OK' }] } } })
      .mockResolvedValueOnce({ sessionRead: { detail: { blocks: [{ id: 'block-2', type: 'text', text: 'OK' }] } } });

    await handler({ trigger: 'turn_end', conversationId: 'conv-1' });
    await handler({ trigger: 'turn_end', conversationId: 'conv-1' });

    expect(ensureTelegramRuntime().deliverAssistantReply).toHaveBeenCalledTimes(2);
    expect(ensureTelegramRuntime().deliverAssistantReply).toHaveBeenNthCalledWith(1, { conversationId: 'conv-1', text: 'OK' });
    expect(ensureTelegramRuntime().deliverAssistantReply).toHaveBeenNthCalledWith(2, { conversationId: 'conv-1', text: 'OK' });
  });

  it('does not deliver lifecycle replies already delivered through the Telegram stream', async () => {
    register();
    registerTelegramGatewayLifecycleDelivery();
    const handler = lifecycle.registerLiveSessionLifecycleHandler.mock.calls[0][0];
    latestRuntime().hasRecentlyDeliveredAssistantReply.mockReturnValueOnce(true);
    conversationService.readSessionDetailForRoute.mockResolvedValueOnce({
      sessionRead: { detail: { blocks: [{ id: 'block-1', type: 'text', text: 'streamed reply' }] } },
    });

    await handler({ trigger: 'turn_end', conversationId: 'conv-1' });

    expect(latestRuntime().deliverAssistantReply).not.toHaveBeenCalled();
    expect(latestRuntime().hasRecentlyDeliveredAssistantReply).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      text: 'streamed reply',
    });
  });
});
