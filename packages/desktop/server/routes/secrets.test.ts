import { beforeEach, describe, expect, it, vi } from 'vitest';

const middleware = vi.hoisted(() => ({ logError: vi.fn() }));
const store = vi.hoisted(() => ({ deleteSecret: vi.fn(), listSecretStatuses: vi.fn(), readSecretBackendId: vi.fn(), setSecret: vi.fn() }));

vi.mock('../middleware/index.js', () => middleware);
vi.mock('../secrets/secretStore.js', () => store);

import { registerSecretRoutes } from './secrets.js';

type Handler = (req: { params?: Record<string, unknown>; body?: Record<string, unknown> }, res: ReturnType<typeof res>) => void;

function setup() {
  const routes = new Map<string, Handler>();
  const router = {
    get: vi.fn((path: string, handler: Handler) => routes.set(`GET ${path}`, handler)),
    put: vi.fn((path: string, handler: Handler) => routes.set(`PUT ${path}`, handler)),
    delete: vi.fn((path: string, handler: Handler) => routes.set(`DELETE ${path}`, handler)),
  };
  const context = { getStateRoot: vi.fn(() => '/state') };
  registerSecretRoutes(router, context);
  return { routes, context };
}

function res() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('secret routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.readSecretBackendId.mockReturnValue('keychain');
    store.listSecretStatuses.mockReturnValue([{ extensionId: 'ext', secretId: 'secret', configured: true }]);
    store.setSecret.mockReturnValue([{ extensionId: 'ext', secretId: 'secret', configured: true }]);
    store.deleteSecret.mockReturnValue([{ extensionId: 'ext', secretId: 'secret', configured: false }]);
  });

  it('lists secret statuses with backend id', () => {
    const { routes } = setup();
    const response = res();

    routes.get('GET /api/secrets')!({}, response);

    expect(store.readSecretBackendId).toHaveBeenCalledWith('/state');
    expect(store.listSecretStatuses).toHaveBeenCalledWith('/state');
    expect(response.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: true }],
    });
  });

  it('sets and deletes secrets with trimmed route params and body values', () => {
    const { routes } = setup();
    const putRes = res();
    routes.get('PUT /api/secrets/:extensionId/:secretId')!(
      { params: { extensionId: ' ext ', secretId: ' token ' }, body: { value: ' secret ' } },
      putRes,
    );
    expect(store.setSecret).toHaveBeenCalledWith('ext', 'token', 'secret', '/state');
    expect(putRes.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: true }],
    });

    const deleteRes = res();
    routes.get('DELETE /api/secrets/:extensionId/:secretId')!({ params: { extensionId: ' ext ', secretId: ' token ' } }, deleteRes);
    expect(store.deleteSecret).toHaveBeenCalledWith('ext', 'token', '/state');
    expect(deleteRes.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: false }],
    });
  });

  it('returns 500 and logs for validation or store errors', () => {
    const { routes } = setup();
    const putRes = res();
    routes.get('PUT /api/secrets/:extensionId/:secretId')!(
      { params: { extensionId: 'ext', secretId: 'token' }, body: { value: ' ' } },
      putRes,
    );
    expect(putRes.status).toHaveBeenCalledWith(500);
    expect(putRes.json).toHaveBeenCalledWith({ error: 'value is required' });
    expect(middleware.logError).toHaveBeenCalledWith('secret write error', { message: 'value is required' });

    store.listSecretStatuses.mockImplementationOnce(() => {
      throw new Error('store failed');
    });
    const getRes = res();
    routes.get('GET /api/secrets')!({}, getRes);
    expect(getRes.status).toHaveBeenCalledWith(500);
    expect(getRes.json).toHaveBeenCalledWith({ error: 'Error: store failed' });
    expect(middleware.logError).toHaveBeenCalledWith('secrets read error', { message: 'store failed' });
  });
});
