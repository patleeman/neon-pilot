import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  '@neon-pilot/extensions/backend/modelGateway',
  () => ({
    DEFAULT_MODEL_GATEWAY_PORT: 8766,
    FAKE_MODEL_GATEWAY_MODEL_ID: 'neon-pilot-fake',
    modelGatewaySettingsFrom(value: unknown) {
      const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const port = typeof record.port === 'number' ? record.port : 8766;
      const host = typeof record.host === 'string' ? record.host : '127.0.0.1';
      const defaultModel = typeof record.defaultModel === 'string' ? record.defaultModel : 'auto';
      return { port, host, defaultModel };
    },
    listModelGatewayModels() {
      return [{ id: 'neon-pilot-fake', object: 'model', created: 0, owned_by: 'neon-pilot' }];
    },
    async createModelGatewayResponse(_ctx: unknown, body: { model?: unknown; input?: unknown }) {
      return {
        id: 'resp_test',
        object: 'response',
        created_at: 0,
        status: 'completed',
        model: typeof body.model === 'string' ? body.model : 'neon-pilot-fake',
        output: [{ id: 'msg_0', type: 'message', status: 'completed', role: 'assistant', content: [] }],
      };
    },
    async *streamModelGatewayResponseEvents() {
      yield { type: 'response.created', response: { id: 'resp_test', status: 'in_progress' } };
      yield { type: 'response.completed', response: { id: 'resp_test', status: 'completed' } };
      yield '[DONE]';
    },
  }),
  { virtual: true },
);

import { clearLogs, healthRoute, modelsRoute, responsesRoute, startGatewayService, status, stopGatewayService, updateSettings } from './backend';

function ctx(overrides?: Partial<Record<string, unknown>>) {
  const storage = new Map<string, unknown>();
  return {
    extensionId: 'system-model-gateway',
    runtimeDir: '/tmp/missing-runtime',
    storage: {
      get: vi.fn(async (key: string) => storage.get(key) ?? null),
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
        return { ok: true };
      }),
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as never;
}

describe('system-model-gateway backend', () => {
  afterEach(async () => {
    await stopGatewayService({}, ctx());
  });

  it('serves health with the default loopback target', async () => {
    await expect(healthRoute({ method: 'GET', path: '/health', query: {}, params: {} }, ctx())).resolves.toMatchObject({
      status: 200,
      body: {
        ok: true,
        running: false,
        port: 8766,
        baseUrl: 'http://127.0.0.1:8766/v1',
      },
    });
  });

  it('always exposes the deterministic fake model for contract smoke tests', async () => {
    await expect(modelsRoute({ method: 'GET', path: '/v1/models', query: {}, params: {} }, ctx())).resolves.toMatchObject({
      status: 200,
      body: { object: 'list', data: expect.arrayContaining([expect.objectContaining({ id: 'neon-pilot-fake' })]) },
    });
  });

  it('creates a non-streaming fake Responses payload', async () => {
    const context = ctx();
    await expect(
      responsesRoute(
        { method: 'POST', path: '/v1/responses', query: {}, params: {}, body: { model: 'neon-pilot-fake', input: 'hello' } },
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        object: 'response',
        status: 'completed',
        model: 'neon-pilot-fake',
        output: [expect.objectContaining({ type: 'message' })],
      },
    });
    await expect(status({}, context)).resolves.toMatchObject({ logs: expect.any(Array) });
  });

  it('starts as a service and updates the persisted port', async () => {
    const context = ctx();
    await expect(startGatewayService({}, context)).resolves.toMatchObject({
      running: true,
      port: 8766,
      baseUrl: 'http://127.0.0.1:8766/v1',
    });
    await expect(updateSettings({ port: 8767 }, context)).resolves.toMatchObject({
      running: true,
      port: 8767,
      baseUrl: 'http://127.0.0.1:8767/v1',
    });
  });

  it('clears recent activity logs', async () => {
    await expect(clearLogs({}, ctx())).resolves.toMatchObject({ logs: [] });
  });
});
