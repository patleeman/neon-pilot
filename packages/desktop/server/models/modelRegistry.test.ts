import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authStorageCreateMock, getPiAgentRuntimeDirMock, modelRegistryCreateMock, resolveProviderApiKeyMock } = vi.hoisted(() => ({
  authStorageCreateMock: vi.fn(),
  getPiAgentRuntimeDirMock: vi.fn(),
  modelRegistryCreateMock: vi.fn(),
  resolveProviderApiKeyMock: vi.fn(),
}));

vi.mock('@neon-pilot/core', () => ({
  getPiAgentRuntimeDir: getPiAgentRuntimeDirMock,
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  AuthStorage: {
    create: authStorageCreateMock,
  },
  ModelRegistry: {
    create: modelRegistryCreateMock,
  },
}));

vi.mock('../secrets/secretStore.js', () => ({
  resolveProviderApiKey: resolveProviderApiKeyMock,
}));

import { createModelRegistryForAuthFile, createRuntimeModelRegistry } from './modelRegistry.js';

describe('model registry helpers', () => {
  beforeEach(() => {
    authStorageCreateMock.mockReset();
    getPiAgentRuntimeDirMock.mockReset();
    modelRegistryCreateMock.mockReset();
    resolveProviderApiKeyMock.mockReset();
  });

  it('creates the runtime model registry inside the pi-agent runtime directory', () => {
    const authStorage = { kind: 'auth-storage' };
    const registry = {
      getAll: vi.fn(() => []),
      getAvailable: vi.fn(() => []),
      find: vi.fn(),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
    };
    getPiAgentRuntimeDirMock.mockReturnValue('/runtime/neon-pilot-runtime');
    modelRegistryCreateMock.mockReturnValue(registry);

    expect(createRuntimeModelRegistry(authStorage as never)).toBe(registry);
    expect(modelRegistryCreateMock).toHaveBeenCalledWith(authStorage, '/runtime/neon-pilot-runtime/models.json');
  });

  it('registers provider secret lookup as an auth fallback for runtime registries', () => {
    const authStorage = { kind: 'auth-storage', setFallbackResolver: vi.fn() };
    const registry = {
      getAll: vi.fn(() => []),
      getAvailable: vi.fn(() => []),
      find: vi.fn(),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
    };
    getPiAgentRuntimeDirMock.mockReturnValue('/runtime/neon-pilot-runtime');
    resolveProviderApiKeyMock.mockReturnValue('secure-key');
    modelRegistryCreateMock.mockReturnValue(registry);

    const created = createRuntimeModelRegistry(authStorage as never);

    expect(authStorage.setFallbackResolver).toHaveBeenCalledTimes(1);
    expect(created).toBe(registry);

    const resolver = authStorage.setFallbackResolver.mock.calls[0]?.[0] as (provider: string) => string | undefined;
    expect(resolver('opencode-go')).toBe('secure-key');
  });

  it('creates a registry beside the provided auth file', () => {
    const authFile = '/tmp/profile/auth.json';
    const authStorage = { kind: 'auth-storage' };
    const registry = {
      getAll: vi.fn(() => []),
      getAvailable: vi.fn(() => []),
      find: vi.fn(),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
    };
    authStorageCreateMock.mockReturnValue(authStorage);
    modelRegistryCreateMock.mockReturnValue(registry);

    expect(createModelRegistryForAuthFile(authFile)).toBe(registry);
    expect(authStorageCreateMock).toHaveBeenCalledWith(authFile);
    expect(modelRegistryCreateMock).toHaveBeenCalledWith(authStorage, join('/tmp/profile', 'models.json'));
  });

  it('normalizes GPT-5.5 context metadata returned by runtime registries', () => {
    const authStorage = { kind: 'auth-storage' };
    const registry = {
      getAll: vi.fn(() => [{ id: 'gpt-5.5', provider: 'openai-codex', contextWindow: 272_000 }]),
      getAvailable: vi.fn(() => [
        { id: 'gpt-5.5', provider: 'openai-codex', contextWindow: 272_000 },
        { id: 'gpt-5.4', provider: 'openai-codex', contextWindow: 272_000 },
      ]),
      find: vi.fn(() => ({ id: 'gpt-5.5', provider: 'openai-codex', contextWindow: 272_000 })),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
    };
    getPiAgentRuntimeDirMock.mockReturnValue('/runtime/neon-pilot-runtime');
    modelRegistryCreateMock.mockReturnValue(registry);

    const created = createRuntimeModelRegistry(authStorage as never);

    expect(created.getAvailable()).toEqual([
      { id: 'gpt-5.5', provider: 'openai-codex', contextWindow: 400_000 },
      { id: 'gpt-5.4', provider: 'openai-codex', contextWindow: 272_000 },
    ]);
    expect(created.getAll()).toEqual([{ id: 'gpt-5.5', provider: 'openai-codex', contextWindow: 400_000 }]);
    expect(created.find('openai-codex', 'gpt-5.5')).toEqual({
      id: 'gpt-5.5',
      provider: 'openai-codex',
      contextWindow: 400_000,
    });
  });

  it('rejects unsafe context metadata returned by runtime registries', () => {
    const authStorage = { kind: 'auth-storage' };
    const registry = {
      getAll: vi.fn(() => [{ id: 'gpt-5.4', provider: 'openai-codex', contextWindow: Number.MAX_SAFE_INTEGER + 1 }]),
      getAvailable: vi.fn(() => [{ id: 'gpt-5.4', provider: 'openai-codex', contextWindow: Number.MAX_SAFE_INTEGER + 1 }]),
      find: vi.fn(() => ({ id: 'gpt-5.4', provider: 'openai-codex', contextWindow: Number.MAX_SAFE_INTEGER + 1 })),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true })),
    };
    getPiAgentRuntimeDirMock.mockReturnValue('/runtime/neon-pilot-runtime');
    modelRegistryCreateMock.mockReturnValue(registry);

    const created = createRuntimeModelRegistry(authStorage as never);

    expect(created.getAvailable()).toEqual([{ id: 'gpt-5.4', provider: 'openai-codex', contextWindow: 128_000 }]);
    expect(created.getAll()).toEqual([{ id: 'gpt-5.4', provider: 'openai-codex', contextWindow: 128_000 }]);
    expect(created.find('openai-codex', 'gpt-5.4')).toEqual({
      id: 'gpt-5.4',
      provider: 'openai-codex',
      contextWindow: 128_000,
    });
  });

  it('prefers secure provider secrets when resolving model auth', async () => {
    const authStorage = { kind: 'auth-storage' };
    const registry = {
      getAll: vi.fn(() => []),
      getAvailable: vi.fn(() => []),
      find: vi.fn(),
      getApiKeyAndHeaders: vi.fn(async () => ({ ok: true, apiKey: 'legacy-key', headers: { 'x-test': 'yes' } })),
    };
    getPiAgentRuntimeDirMock.mockReturnValue('/runtime/neon-pilot-runtime');
    resolveProviderApiKeyMock.mockReturnValue('secure-key');
    modelRegistryCreateMock.mockReturnValue(registry);

    const created = createRuntimeModelRegistry(authStorage as never);

    await expect(created.getApiKeyAndHeaders({ provider: 'openrouter' } as never)).resolves.toEqual({
      ok: true,
      apiKey: 'secure-key',
      headers: { 'x-test': 'yes' },
    });
  });
});
