import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn() }));
const sessionManager = vi.hoisted(() => ({ open: vi.fn() }));
const autoMode = vi.hoisted(() => ({ readConversationAutoModeStateFromSessionManager: vi.fn(), writeConversationAutoModeState: vi.fn() }));
const recovery = vi.hoisted(() => ({ recoverConversationCapability: vi.fn() }));
const service = vi.hoisted(() => ({
  appendConversationOffshootMetadata: vi.fn(),
  publishConversationSessionMetaChanged: vi.fn(),
  readConversationSessionMeta: vi.fn(),
  resolveConversationSessionFile: vi.fn(),
}));
const live = vi.hoisted(() => ({
  createSessionFromExisting: vi.fn(),
  isLive: vi.fn(),
  readLiveSessionAutoModeState: vi.fn(),
  registry: new Map<string, unknown>(),
  setLiveSessionAutoModeState: vi.fn(),
}));
const middleware = vi.hoisted(() => ({ logError: vi.fn() }));
const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));
const liveRoutes = vi.hoisted(() => ({ ensureRequestControlsLocalLiveConversation: vi.fn() }));

vi.mock('node:fs', () => fs);
vi.mock('@earendil-works/pi-coding-agent', () => ({ SessionManager: sessionManager }));
vi.mock('../conversations/conversationAutoMode.js', () => autoMode);
vi.mock('../conversations/conversationRecovery.js', () => recovery);
vi.mock('../conversations/conversationService.js', () => service);
vi.mock('../conversations/liveSessions.js', () => live);
vi.mock('../middleware/index.js', () => middleware);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('./liveSessions.js', () => liveRoutes);

import { registerConversationStateRoutes } from './conversationState.js';

type Handler = (req: { params: Record<string, string>; body?: unknown }, res: ResponseStub) => Promise<void>;

type ResponseStub = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };

function setupRouter() {
  const routes = new Map<string, Handler>();
  const router = {
    get: vi.fn((path: string, handler: Handler) => routes.set(`GET ${path}`, handler)),
    post: vi.fn((path: string, handler: Handler) => routes.set(`POST ${path}`, handler)),
    patch: vi.fn((path: string, handler: Handler) => routes.set(`PATCH ${path}`, handler)),
  };
  const context = {
    getRuntimeScope: vi.fn(() => 'shared'),
    buildLiveSessionResourceOptions: vi.fn(() => ({ resources: true })),
    buildLiveSessionResourceOptionsAsync: vi.fn(async () => ({ resources: 'async' })),
    buildLiveSessionExtensionFactories: vi.fn(() => ['factory']),
    flushLiveDeferredResumes: vi.fn(),
  };
  registerConversationStateRoutes(router, context as never);
  return { routes, context };
}

function res(): ResponseStub {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('conversationState routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    live.registry.clear();
    fs.existsSync.mockReturnValue(true);
    service.resolveConversationSessionFile.mockReturnValue('/session.json');
    service.readConversationSessionMeta.mockReturnValue({ cwd: '/repo', file: '/session.json' });
    sessionManager.open.mockReturnValue({ id: 'manager' });
  });

  it('reads auto-mode from live sessions or persisted session files', async () => {
    const { routes } = setupRouter();
    const handler = routes.get('GET /api/conversations/:id/auto-mode')!;
    live.isLive.mockReturnValueOnce(true);
    live.readLiveSessionAutoModeState.mockReturnValue({ mode: 'mission' });
    const liveRes = res();
    await handler({ params: { id: 'conv-1' } }, liveRes);
    expect(liveRes.json).toHaveBeenCalledWith({ mode: 'mission' });

    live.isLive.mockReturnValueOnce(false);
    autoMode.readConversationAutoModeStateFromSessionManager.mockReturnValue({ mode: 'off' });
    const persistedRes = res();
    await handler({ params: { id: 'conv-1' } }, persistedRes);
    expect(sessionManager.open).toHaveBeenCalledWith('/session.json');
    expect(persistedRes.json).toHaveBeenCalledWith({ mode: 'off' });
  });

  it('patches live auto-mode and rejects invalid patch bodies', async () => {
    const { routes } = setupRouter();
    const handler = routes.get('PATCH /api/conversations/:id/auto-mode')!;
    const badRes = res();
    await handler({ params: { id: 'conv-1' }, body: {} }, badRes);
    expect(badRes.status).toHaveBeenCalledWith(400);

    live.isLive.mockReturnValue(true);
    live.setLiveSessionAutoModeState.mockResolvedValue({ mode: 'nudge' });
    const okRes = res();
    await handler({ params: { id: 'conv-1' }, body: { mode: 'nudge', surfaceId: 'surface' } }, okRes);
    expect(liveRoutes.ensureRequestControlsLocalLiveConversation).toHaveBeenCalledWith('conv-1', {
      enabled: undefined,
      surfaceId: 'surface',
    });
    expect(live.setLiveSessionAutoModeState).toHaveBeenCalledWith('conv-1', { mode: 'nudge' });
    expect(okRes.json).toHaveBeenCalledWith({ mode: 'nudge' });
  });

  it('recovers non-live conversations before enabling auto-mode or writes persisted auto-mode state otherwise', async () => {
    const { routes, context } = setupRouter();
    const handler = routes.get('PATCH /api/conversations/:id/auto-mode')!;
    live.isLive.mockReturnValue(false);
    recovery.recoverConversationCapability.mockResolvedValueOnce({ live: true });
    live.setLiveSessionAutoModeState.mockResolvedValue({ mode: 'mission' });
    const recoveredRes = res();
    await handler({ params: { id: 'conv-1' }, body: { enabled: true } }, recoveredRes);
    expect(recovery.recoverConversationCapability).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ getRuntimeScope: context.getRuntimeScope }),
    );
    expect(recoveredRes.json).toHaveBeenCalledWith({ mode: 'mission' });

    recovery.recoverConversationCapability.mockResolvedValueOnce({ live: false });
    autoMode.writeConversationAutoModeState.mockReturnValue({ enabled: false });
    const persistedRes = res();
    await handler({ params: { id: 'conv-1' }, body: { enabled: false } }, persistedRes);
    expect(autoMode.writeConversationAutoModeState).toHaveBeenCalledWith({ id: 'manager' }, { enabled: false });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({ type: 'session_file_changed', sessionId: 'conv-1' });
  });

  it('duplicates live or persisted conversations and records offshoot metadata', async () => {
    const { routes, context } = setupRouter();
    const handler = routes.get('POST /api/conversations/:id/duplicate')!;
    service.readConversationSessionMeta.mockReturnValue({ cwd: '/repo', file: '/session.json' });
    live.createSessionFromExisting.mockResolvedValue({ id: 'copy-1', sessionFile: '/copy.json' });
    const response = res();

    await handler({ params: { id: 'conv-1' } }, response);

    expect(live.createSessionFromExisting).toHaveBeenCalledWith('/session.json', '/repo', {
      resources: true,
      extensionFactories: ['factory'],
    });
    expect(context.buildLiveSessionResourceOptions).toHaveBeenCalled();
    expect(service.appendConversationOffshootMetadata).toHaveBeenCalledWith({
      sessionFile: '/copy.json',
      kind: 'duplicate',
      parentSessionFile: '/session.json',
      parentSessionId: 'conv-1',
    });
    expect(service.publishConversationSessionMetaChanged).toHaveBeenCalledWith('conv-1', 'copy-1');
    expect(response.json).toHaveBeenCalledWith({ newSessionId: 'copy-1', sessionFile: '/copy.json' });
  });

  it('returns 404 for missing conversations', async () => {
    const { routes } = setupRouter();
    service.resolveConversationSessionFile.mockReturnValue(null);
    service.readConversationSessionMeta.mockReturnValue(null);
    const autoRes = res();
    await routes.get('GET /api/conversations/:id/auto-mode')!({ params: { id: 'missing' } }, autoRes);
    expect(autoRes.status).toHaveBeenCalledWith(404);

    const duplicateRes = res();
    await routes.get('POST /api/conversations/:id/duplicate')!({ params: { id: 'missing' } }, duplicateRes);
    expect(duplicateRes.status).toHaveBeenCalledWith(404);
  });
});
