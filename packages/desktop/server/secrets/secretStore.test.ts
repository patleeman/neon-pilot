import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));

vi.mock('../extensions/extensionRegistry.js', () => ({
  listExtensionSecretRegistrations: () => [
    {
      extensionId: 'system-exa-search',
      packageType: 'system',
      id: 'exaApiKey',
      key: 'system-exa-search.exaApiKey',
      label: 'Exa API key',
      env: 'EXA_API_KEY',
      order: 0,
    },
  ],
}));

const {
  deleteProviderApiKeySecret,
  deleteSecret,
  listSecretStatuses,
  readSecretBackendId,
  resolveIndexedProviderApiKey,
  resolveProviderApiKey,
  resolveSecret,
  resolveSecretsFileFromLayout,
  resolveSecretsIndexFromLayout,
  secretsRootFromLayout,
  setProviderApiKeySecret,
  setSecret,
} = await import('./secretStore.js');

function createTempStateRoot(): string {
  return join(tmpdir(), `pa-secrets-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe('secretStore', () => {
  afterEach(() => {
    delete process.env.EXA_API_KEY;
    execFileSyncMock.mockReset();
  });

  it('defaults to a platform-appropriate backend', () => {
    const stateRoot = createTempStateRoot();
    expect(readSecretBackendId(stateRoot)).toBe(process.platform === 'darwin' ? 'keychain' : 'file');
  });

  it('reads configured backend from nested settings', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'env-only' } }));

    expect(readSecretBackendId(stateRoot)).toBe('env-only');
  });

  it('stores extension secrets in the file backend outside settings.json', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    setSecret('system-exa-search', 'exaApiKey', 'exa-secret', stateRoot);

    expect(resolveSecret('system-exa-search', 'exaApiKey', stateRoot)).toBe('exa-secret');
    expect(JSON.parse(readFileSync(join(stateRoot, 'settings.json'), 'utf-8'))).toEqual({ secrets: { provider: 'file' } });
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.json'), 'utf-8'))).toEqual({
      'extension:system-exa-search:exaApiKey': 'exa-secret',
    });
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.index.json'), 'utf-8'))).toEqual(['extension:system-exa-search:exaApiKey']);
    expect(statSync(join(stateRoot, 'secrets.json')).mode & 0o777).toBe(0o600);
    expect(statSync(join(stateRoot, 'secrets.index.json')).mode & 0o777).toBe(0o600);
    expect(readdirSync(stateRoot).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });

  it('tracks provider API keys in the secret index for backend migration', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    setProviderApiKeySecret('openrouter', 'provider-secret', stateRoot);

    expect(resolveProviderApiKey('openrouter', stateRoot)).toBe('provider-secret');
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.index.json'), 'utf-8'))).toEqual(['provider:openrouter:apiKey']);
  });

  it('does not probe keychain provider keys that are absent from the secret index', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'keychain' } }));

    expect(resolveIndexedProviderApiKey('openrouter', stateRoot)).toBeUndefined();
  });

  it.runIf(process.platform === 'darwin')('writes Keychain secrets through stdin instead of process arguments', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'keychain' } }));

    setProviderApiKeySecret('openrouter', 'provider-secret', stateRoot);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'security',
      ['add-generic-password', '-U', '-s', 'neon-pilot', '-a', 'provider:openrouter:apiKey', '-w'],
      {
        input: 'provider-secret\nprovider-secret\n',
        stdio: ['pipe', 'ignore', 'pipe'],
      },
    );
    expect(execFileSyncMock.mock.calls.flatMap(([, args]) => args as string[])).not.toContain('provider-secret');
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.index.json'), 'utf-8'))).toEqual(['provider:openrouter:apiKey']);
  });

  it('prefers stored secrets over environment variables', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));
    setSecret('system-exa-search', 'exaApiKey', 'stored-secret', stateRoot);

    process.env.EXA_API_KEY = 'env-secret';

    expect(resolveSecret('system-exa-search', 'exaApiKey', stateRoot)).toBe('stored-secret');
    expect(listSecretStatuses(stateRoot)[0]).toMatchObject({ configured: true, source: 'file', writable: true });
  });

  it('uses environment variables when no stored secret exists', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    process.env.EXA_API_KEY = 'env-secret';

    expect(resolveSecret('system-exa-search', 'exaApiKey', stateRoot)).toBe('env-secret');
    expect(listSecretStatuses(stateRoot)[0]).toMatchObject({ configured: true, source: 'env', writable: true });
  });

  it('deletes stored secrets', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));
    setSecret('system-exa-search', 'exaApiKey', 'stored-secret', stateRoot);

    deleteSecret('system-exa-search', 'exaApiKey', stateRoot);

    expect(resolveSecret('system-exa-search', 'exaApiKey', stateRoot)).toBeUndefined();
    expect(listSecretStatuses(stateRoot)[0]).toMatchObject({ configured: false, source: null });
    expect(existsSync(join(stateRoot, 'secrets.json'))).toBe(false);
    expect(existsSync(join(stateRoot, 'secrets.index.json'))).toBe(false);
  });

  it('keeps file secret payload and index consistent when deleting one key', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));
    setSecret('system-exa-search', 'exaApiKey', 'stored-secret', stateRoot);
    setProviderApiKeySecret('openrouter', 'provider-secret', stateRoot);

    deleteSecret('system-exa-search', 'exaApiKey', stateRoot);

    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.json'), 'utf-8'))).toEqual({
      'provider:openrouter:apiKey': 'provider-secret',
    });
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.index.json'), 'utf-8'))).toEqual(['provider:openrouter:apiKey']);
    expect(readdirSync(stateRoot).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects writes for env-only backend', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'env-only' } }));

    expect(() => setSecret('system-exa-search', 'exaApiKey', 'secret', stateRoot)).toThrow('env-only');
  });

  it('rejects writes for undeclared extension secrets', () => {
    const stateRoot = createTempStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    expect(() => setSecret('unknown-extension', 'apiKey', 'secret', stateRoot)).toThrow('not registered');
    expect(() => deleteSecret('unknown-extension', 'apiKey', stateRoot)).toThrow('not registered');
  });

  it('resolveSecretsFileFromLayout returns a path under layout.systemSecrets', () => {
    const layout = resolveDesktopRootLayout({ root: '/test/layout-root' });
    expect(resolveSecretsFileFromLayout(layout)).toBe('/test/layout-root/system/secrets/secrets.json');
  });

  it('resolveSecretsIndexFromLayout returns a path under layout.systemSecrets', () => {
    const layout = resolveDesktopRootLayout({ root: '/test/layout-root' });
    expect(resolveSecretsIndexFromLayout(layout)).toBe('/test/layout-root/system/secrets/secrets.index.json');
  });

  it('secretsRootFromLayout returns systemSecrets path', () => {
    const layout = resolveDesktopRootLayout({ root: '/test/layout-root' });
    expect(secretsRootFromLayout(layout)).toBe('/test/layout-root/system/secrets');
  });

  it('writes file backend secrets under layout.systemSecrets instead of legacy stateRoot', () => {
    const tmpRoot = createTempStateRoot();
    const layout = resolveDesktopRootLayout({ root: tmpRoot });
    mkdirSync(layout.systemSecrets, { recursive: true });
    writeFileSync(join(layout.systemSecrets, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    setSecret('system-exa-search', 'exaApiKey', 'layout-secret', layout);

    expect(JSON.parse(readFileSync(resolveSecretsFileFromLayout(layout), 'utf-8'))).toEqual({
      'extension:system-exa-search:exaApiKey': 'layout-secret',
    });
    expect(JSON.parse(readFileSync(resolveSecretsIndexFromLayout(layout), 'utf-8'))).toEqual(['extension:system-exa-search:exaApiKey']);
    expect(statSync(resolveSecretsFileFromLayout(layout)).mode & 0o777).toBe(0o600);
    expect(statSync(resolveSecretsIndexFromLayout(layout)).mode & 0o777).toBe(0o600);

    expect(existsSync(join(tmpRoot, 'secrets.json'))).toBe(false);
    expect(existsSync(join(tmpRoot, 'secrets.index.json'))).toBe(false);

    expect(resolveSecret('system-exa-search', 'exaApiKey', layout)).toBe('layout-secret');
    expect(resolveSecret('system-exa-search', 'exaApiKey', tmpRoot)).toBeUndefined();
    expect(readdirSync(layout.systemSecrets).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });

  it('reads backend provider from settings.json under systemSecrets when using layout', () => {
    const tmpRoot = createTempStateRoot();
    const layout = resolveDesktopRootLayout({ root: tmpRoot });
    mkdirSync(layout.systemSecrets, { recursive: true });
    writeFileSync(join(layout.systemSecrets, 'settings.json'), JSON.stringify({ secrets: { provider: 'env-only' } }));

    expect(readSecretBackendId(layout)).toBe('env-only');
  });

  it('manages provider API keys under layout.systemSecrets', () => {
    const tmpRoot = createTempStateRoot();
    const layout = resolveDesktopRootLayout({ root: tmpRoot });
    mkdirSync(layout.systemSecrets, { recursive: true });
    writeFileSync(join(layout.systemSecrets, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    setProviderApiKeySecret('test-provider', 'test-key', layout);

    expect(resolveProviderApiKey('test-provider', layout)).toBe('test-key');
    expect(resolveIndexedProviderApiKey('test-provider', layout)).toBe('test-key');
    expect(JSON.parse(readFileSync(resolveSecretsFileFromLayout(layout), 'utf-8'))).toEqual({
      'provider:test-provider:apiKey': 'test-key',
    });

    deleteProviderApiKeySecret('test-provider', layout);
    expect(resolveProviderApiKey('test-provider', layout)).toBeUndefined();
    expect(existsSync(resolveSecretsFileFromLayout(layout))).toBe(false);
    expect(existsSync(resolveSecretsIndexFromLayout(layout))).toBe(false);
  });
});
