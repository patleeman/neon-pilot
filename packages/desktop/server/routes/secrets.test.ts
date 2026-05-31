import { beforeEach, describe, expect, it, vi } from 'vitest';

const middleware = vi.hoisted(() => ({ logError: vi.fn() }));
const store = vi.hoisted(() => ({
  deleteSecretAsync: vi.fn(),
  listSecretStatusesAsync: vi.fn(),
  readSecretBackendId: vi.fn(),
  setSecretAsync: vi.fn(),
}));

vi.mock('../middleware/index.js', () => middleware);
vi.mock('../secrets/secretStore.js', () => store);

import { registerSecretRoutes } from './secrets.js';

type Handler = (req: { params?: Record<string, unknown>; body?: Record<string, unknown> }, res: ReturnType<typeof res>) => void | Promise<void>;

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
    store.listSecretStatusesAsync.mockResolvedValue([{ extensionId: 'ext', secretId: 'secret', configured: true }]);
    store.setSecretAsync.mockResolvedValue([{ extensionId: 'ext', secretId: 'secret', configured: true }]);
    store.deleteSecretAsync.mockResolvedValue([{ extensionId: 'ext', secretId: 'secret', configured: false }]);
  });

  it('lists secret statuses with backend id', async () => {
    const { routes } = setup();
    const response = res();

    await routes.get('GET /api/secrets')!({}, response);

    expect(store.readSecretBackendId).toHaveBeenCalledWith('/state');
    expect(store.listSecretStatusesAsync).toHaveBeenCalledWith('/state');
    expect(response.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: true }],
    });
  });

  it('sets and deletes secrets with trimmed route params and body values', async () => {
    const { routes } = setup();
    const putRes = res();
    await routes.get('PUT /api/secrets/:extensionId/:secretId')!(
      { params: { extensionId: ' ext ', secretId: ' token ' }, body: { value: ' secret ' } },
      putRes,
    );
    expect(store.setSecretAsync).toHaveBeenCalledWith('ext', 'token', 'secret', '/state');
    expect(putRes.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: true }],
    });

    const deleteRes = res();
    await routes.get('DELETE /api/secrets/:extensionId/:secretId')!({ params: { extensionId: ' ext ', secretId: ' token ' } }, deleteRes);
    expect(store.deleteSecretAsync).toHaveBeenCalledWith('ext', 'token', '/state');
    expect(deleteRes.json).toHaveBeenCalledWith({
      backend: 'keychain',
      secrets: [{ extensionId: 'ext', secretId: 'secret', configured: false }],
    });
  });

  it('returns 500 and logs for validation or store errors', async () => {
    const { routes } = setup();
    const putRes = res();
    await routes.get('PUT /api/secrets/:extensionId/:secretId')!(
      { params: { extensionId: 'ext', secretId: 'token' }, body: { value: ' ' } },
      putRes,
    );
    expect(putRes.status).toHaveBeenCalledWith(500);
    expect(putRes.json).toHaveBeenCalledWith({ error: 'value is required' });
    expect(middleware.logError).toHaveBeenCalledWith('secret write error', { message: 'value is required' });

    store.listSecretStatusesAsync.mockRejectedValueOnce(new Error('store failed'));
    const getRes = res();
    await routes.get('GET /api/secrets')!({}, getRes);
    expect(getRes.status).toHaveBeenCalledWith(500);
    expect(getRes.json).toHaveBeenCalledWith({ error: 'Error: store failed' });
    expect(middleware.logError).toHaveBeenCalledWith('secrets read error', { message: 'store failed' });
  });
});
