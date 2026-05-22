import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayState = vi.hoisted(() => ({
  attachGatewayConversation: vi.fn(),
  detachGatewayConversation: vi.fn(),
  ensureGatewayConnection: vi.fn(),
  readGatewayState: vi.fn(() => ({ connections: [] })),
  updateGatewayConnectionStatus: vi.fn(() => ({ connections: [{ provider: 'telegram' }] })),
  upsertGatewayChatTarget: vi.fn(),
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
    deliverAssistantReply: ReturnType<typeof vi.fn>;
  }>,
  TelegramGatewayRuntime: vi.fn(function MockTelegramGatewayRuntime(this: unknown) {
    const instance = { start: vi.fn(), stop: vi.fn(), deliverAssistantReply: vi.fn(async () => true) };
    runtime.instances.push(instance);
    return instance;
  }),
}));
const lifecycle = vi.hoisted(() => ({ registerLiveSessionLifecycleHandler: vi.fn() }));
const liveSessions = vi.hoisted(() => ({
  getAvailableModelObjects: vi.fn(async () => []),
  renameSession: vi.fn(),
  updateLiveSessionModelPreferences: vi.fn(),
}));
const capability = vi.hoisted(() => ({
  compactLiveSessionCapability: vi.fn(),
  createLiveSessionCapability: vi.fn(async () => ({ id: 'conv-new' })),
  submitLiveSessionPromptCapability: vi.fn(),
}));

vi.mock('../gateways/gatewayState.js', () => gatewayState);
vi.mock('../gateways/telegramAuth.js', () => telegramAuth);
vi.mock('../gateways/telegramGateway.js', () => ({ TelegramGatewayRuntime: runtime.TelegramGatewayRuntime }));
vi.mock('../conversations/liveSessionLifecycle.js', () => lifecycle);
vi.mock('../conversations/liveSessions.js', () => liveSessions);
vi.mock('../conversations/liveSessionCapability.js', () => capability);
vi.mock('../conversations/sessions.js', () => ({
  readSessionBlocks: vi.fn(() => ({ blocks: [{ type: 'text', text: ' latest reply ' }] })),
}));
vi.mock('../middleware/index.js', () => ({ logError: vi.fn() }));
vi.mock('../shared/appEvents.js', () => ({ invalidateAppTopics: vi.fn(), publishAppEvent: vi.fn() }));

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
  });

  function context() {
    return {
      getRuntimeScope: () => 'shared',
      getStateRoot: () => '/state',
      getAuthFile: () => '/auth.json',
      getRepoRoot: () => '/repo',
      getDefaultWebCwd: () => '/repo',
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
    handler({ params: { provider: 'telegram' }, body: { status: 'active', enabled: true } }, active);
    expect(latestRuntime().start).toHaveBeenCalledOnce();
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
    expect(ok.json).toHaveBeenCalledWith({ configured: true, state: { connections: [{ provider: 'telegram' }] } });

    const removed = response();
    deleteToken({}, removed);
    expect(telegramAuth.removeTelegramBotToken).toHaveBeenCalledWith('/auth.json', '/state');
    expect(latestRuntime().stop).toHaveBeenCalled();
    expect(removed.json).toHaveBeenCalledWith({ configured: false, state: { connections: [{ provider: 'telegram' }] } });
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
    )({ params: { conversationId: 'conv' }, query: { provider: 'slack_mcp' } }, response());
    expect(gatewayState.detachGatewayConversation).toHaveBeenCalledWith({
      stateRoot: '/state',
      profile: 'shared',
      provider: 'slack_mcp',
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
  });
});
