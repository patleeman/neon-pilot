import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readProviderAuthState, removeProviderCredential, setProviderApiKey } from './providerAuth.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-web-provider-auth-'));
  tempDirs.push(dir);
  return dir;
}

describe('readProviderAuthState', () => {
  it('returns built-in Pi API-key providers for a missing auth file', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    const state = await readProviderAuthState(authFile);

    expect(state.authFile).toBe(authFile);
    expect(Array.isArray(state.providers)).toBe(true);

    const openai = state.providers.find((entry) => entry.id === 'openai');
    expect(openai).toMatchObject({
      id: 'openai',
      authType: 'none',
      hasStoredCredential: false,
      apiKeySupported: true,
    });

    expect(state.providers.some((entry) => entry.id === 'anthropic')).toBe(true);
    expect(state.providers.some((entry) => entry.id === 'openrouter')).toBe(true);
    expect(state.providers.some((entry) => entry.id === 'exa')).toBe(true);
    expect(state.providers.some((entry) => entry.id === 'telegram')).toBe(false);

    const exa = state.providers.find((entry) => entry.id === 'exa');
    expect(exa).toMatchObject({
      id: 'exa',
      authType: 'none',
      hasStoredCredential: false,
      apiKeySupported: true,
    });
  });
});

describe('setProviderApiKey', () => {
  it('writes API keys to auth.json and marks provider as api_key', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    const state = await setProviderApiKey(authFile, 'custom-test-provider', 'test-secret');

    const parsed = JSON.parse(readFileSync(authFile, 'utf-8')) as Record<string, unknown>;
    expect(parsed['custom-test-provider']).toEqual({
      type: 'api_key',
      key: 'test-secret',
    });

    const provider = state.providers.find((entry) => entry.id === 'custom-test-provider');
    expect(provider).toMatchObject({
      id: 'custom-test-provider',
      authType: 'api_key',
      hasStoredCredential: true,
      apiKeySupported: false,
      modelCount: 0,
    });
  });

  it('hides legacy Telegram credentials because the gateway token is managed as an extension secret', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    await setProviderApiKey(authFile, 'telegram', 'legacy-token');

    const state = await readProviderAuthState(authFile);

    expect(state.providers.some((entry) => entry.id === 'telegram')).toBe(false);
  });

  it('ignores stale empty stored credential buckets', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    writeFileSync(authFile, JSON.stringify({ legacy: {} }));

    const state = await readProviderAuthState(authFile);

    expect(state.providers.some((entry) => entry.id === 'legacy')).toBe(false);
  });

  it('preserves existing provider credentials when adding another key', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    await setProviderApiKey(authFile, 'provider-one', 'key-one');
    await setProviderApiKey(authFile, 'provider-two', 'key-two');

    const parsed = JSON.parse(readFileSync(authFile, 'utf-8')) as Record<string, unknown>;
    expect(parsed['provider-one']).toEqual({ type: 'api_key', key: 'key-one' });
    expect(parsed['provider-two']).toEqual({ type: 'api_key', key: 'key-two' });
  });

  it('stores provider API keys in the secret backend when a state root is provided', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');
    const stateRoot = join(dir, 'state');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    const state = await setProviderApiKey(authFile, 'openrouter', 'test-secret', stateRoot);

    expect(existsSync(authFile)).toBe(true);
    expect(JSON.parse(readFileSync(authFile, 'utf-8'))).toEqual({});
    expect(JSON.parse(readFileSync(join(stateRoot, 'secrets.json'), 'utf-8'))).toEqual({
      'provider:openrouter:apiKey': 'test-secret',
    });

    const provider = state.providers.find((entry) => entry.id === 'openrouter');
    expect(provider).toMatchObject({
      id: 'openrouter',
      authType: 'api_key',
      hasStoredCredential: true,
    });
  });

  it('rejects empty provider ids and API keys', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    await expect(setProviderApiKey(authFile, '', 'abc')).rejects.toThrow('provider is required');
    await expect(setProviderApiKey(authFile, 'provider', '')).rejects.toThrow('apiKey is required');
  });
});

describe('removeProviderCredential', () => {
  it('removes stored credentials for a provider', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    await setProviderApiKey(authFile, 'custom-test-provider', 'test-secret');
    const state = await removeProviderCredential(authFile, 'custom-test-provider');

    const parsed = JSON.parse(readFileSync(authFile, 'utf-8')) as Record<string, unknown>;
    expect(parsed['custom-test-provider']).toBeUndefined();

    const provider = state.providers.find((entry) => entry.id === 'custom-test-provider');
    expect(provider).toBeUndefined();
  });

  it('removes provider API keys from the secret backend and legacy auth file', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');
    const stateRoot = join(dir, 'state');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));

    await setProviderApiKey(authFile, 'custom-test-provider', 'test-secret', stateRoot);
    const state = await removeProviderCredential(authFile, 'custom-test-provider', stateRoot);

    expect(JSON.parse(readFileSync(authFile, 'utf-8'))).toEqual({});
    expect(existsSync(join(stateRoot, 'secrets.json'))).toBe(false);
    expect(state.providers.find((entry) => entry.id === 'custom-test-provider')).toBeUndefined();
  });

  it('rejects empty provider ids', async () => {
    const dir = createTempDir();
    const authFile = join(dir, 'auth.json');

    await expect(removeProviderCredential(authFile, '   ')).rejects.toThrow('provider is required');
  });
});
