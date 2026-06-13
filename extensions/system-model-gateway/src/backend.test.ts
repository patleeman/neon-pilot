import { createServer } from 'node:net';
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
    writeModelGatewayCatalog() {
      return '/tmp/model-gateway/codex-model-catalog.json';
    },
    readModelGatewayCodexConfigStatus() {
      return {
        configPath: '/tmp/.codex/config.toml',
        installed: false,
        managed: false,
        hasNeonPilotProvider: false,
        catalogPath: '/tmp/model-gateway/codex-model-catalog.json',
      };
    },
    installModelGatewayCodexConfig() {
      return {
        status: {
          configPath: '/tmp/.codex/config.toml',
          installed: true,
          managed: true,
          hasNeonPilotProvider: true,
          activeProvider: 'neon-pilot',
          activeModel: 'auto',
          activeCatalogPath: '/tmp/model-gateway/codex-model-catalog.json',
          catalogPath: '/tmp/model-gateway/codex-model-catalog.json',
        },
      };
    },
    removeModelGatewayCodexConfig() {
      return {
        status: {
          configPath: '/tmp/.codex/config.toml',
          installed: false,
          managed: false,
          hasNeonPilotProvider: false,
          catalogPath: '/tmp/model-gateway/codex-model-catalog.json',
        },
      };
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

import {
  clearLogs,
  gatewayServiceHealth,
  healthRoute,
  installCodexConfig,
  modelsRoute,
  removeCodexConfig,
  responsesRoute,
  startGatewayService,
  status,
  stopGatewayService,
  updateSettings,
} from './backend';

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('Failed to allocate a loopback port'));
      });
    });
  });
}

function ctx(overrides?: Partial<Record<string, unknown>>, initialStorage?: Record<string, unknown>) {
  const storage = new Map<string, unknown>(Object.entries(initialStorage ?? {}));
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
    const port = await getFreePort();
    const nextPort = await getFreePort();
    const context = ctx(undefined, { settings: { port } });
    await expect(startGatewayService({}, context)).resolves.toMatchObject({
      running: true,
      port,
      baseUrl: `http://127.0.0.1:${port}/v1`,
    });
    await expect(updateSettings({ port: nextPort }, context)).resolves.toMatchObject({
      running: true,
      port: nextPort,
      baseUrl: `http://127.0.0.1:${nextPort}/v1`,
    });
  });

  it('keeps the extension healthy when the configured port is unavailable', async () => {
    const port = await getFreePort();
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(port, '127.0.0.1', () => resolve());
    });
    try {
      const context = ctx(undefined, { settings: { port } });
      await expect(startGatewayService({}, context)).resolves.toMatchObject({
        running: false,
        port,
        lastError: expect.stringContaining('EADDRINUSE'),
      });
      await expect(gatewayServiceHealth({}, context)).resolves.toMatchObject({
        ok: true,
        listenerRunning: false,
        lastError: expect.stringContaining('EADDRINUSE'),
      });
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('clears stale listener errors after a later successful loopback request', async () => {
    const port = await getFreePort();
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(port, '127.0.0.1', () => resolve());
    });

    try {
      const unavailableContext = ctx(undefined, { settings: { port } });
      await expect(startGatewayService({}, unavailableContext)).resolves.toMatchObject({
        running: false,
        lastError: expect.stringContaining('EADDRINUSE'),
      });
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }

    const context = ctx(undefined, { settings: { port } });
    await expect(startGatewayService({}, context)).resolves.toMatchObject({ running: true, port });

    const invalidResponse = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(invalidResponse.status).toBe(500);
    await expect(status({}, context)).resolves.toMatchObject({
      lastError: expect.stringContaining('Expected property name'),
    });

    const validResponse = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'neon-pilot-fake', input: 'hello' }),
    });
    expect(validResponse.status).toBe(200);
    const gatewayStatus = await status({}, context);
    expect(gatewayStatus.lastError).toBeUndefined();
  });

  it('clears recent activity logs', async () => {
    await expect(clearLogs({}, ctx())).resolves.toMatchObject({ logs: [] });
  });

  it('installs and removes the managed Codex config through backend actions', async () => {
    const context = ctx();
    await expect(installCodexConfig({}, context)).resolves.toMatchObject({
      codexConfig: { installed: false, configPath: '/tmp/.codex/config.toml' },
    });
    await expect(removeCodexConfig({}, context)).resolves.toMatchObject({
      codexConfig: { installed: false, configPath: '/tmp/.codex/config.toml' },
    });
  });
});
