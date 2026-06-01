import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadBackend(home: string) {
  vi.resetModules();
  vi.stubEnv('HOME', home);
  return import('./backend.js');
}

describe('system-video-probe settings backend', () => {
  const home = join(tmpdir(), `video-probe-test-${process.pid}`);
  const ctx = {
    runtimeDir: join(home, 'runtime'),
    storage: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) },
    secrets: { get: vi.fn() },
    shell: { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) },
  } as never;

  beforeEach(() => {
    rmSync(home, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('reads default settings when no settings file exists', async () => {
    const backend = await loadBackend(home);

    await expect(backend.readSettings({}, ctx)).resolves.toEqual({
      ok: true,
      settings: {
        backend: 'openrouter',
        cloudModel: 'google/gemini-2.5-flash',
        localModel: 'mlx-community/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-nvfp4',
        hfToken: '',
      },
    });
  });

  it('writes sanitized settings and keeps current values for invalid fields', async () => {
    const backend = await loadBackend(home);

    await expect(
      backend.writeSettings({ backend: 'local', cloudModel: ' openrouter/model ', localModel: ' local/model ', hfToken: 'token' }, ctx),
    ).resolves.toMatchObject({
      ok: true,
      settings: { backend: 'local', cloudModel: 'openrouter/model', localModel: 'local/model', hfToken: '' },
    });

    await expect(backend.writeSettings({ backend: 'bad', cloudModel: ' ', localModel: '', hfToken: 1 }, ctx)).resolves.toMatchObject({
      settings: { backend: 'local', cloudModel: 'openrouter/model', localModel: 'local/model', hfToken: '' },
    });

    const settingsFile = join(home, '.cache', 'neon-pilot', 'video-probe', 'settings.json');
    expect(existsSync(settingsFile)).toBe(true);
    expect(JSON.parse(readFileSync(settingsFile, 'utf-8'))).toMatchObject({ backend: 'local', cloudModel: 'openrouter/model' });
    expect(JSON.parse(readFileSync(settingsFile, 'utf-8'))).not.toHaveProperty('hfToken');
  });

  it('reports Hugging Face token presence from extension secrets without exposing the value', async () => {
    const backend = await loadBackend(home);
    vi.mocked(ctx.secrets.get).mockReturnValue('hf-secret');

    await expect(backend.readSettings({}, ctx)).resolves.toMatchObject({ settings: { hfToken: 'configured' } });
  });

  it('accepts Hugging Face tokens resolved through an async worker bridge', async () => {
    const backend = await loadBackend(home);
    vi.mocked(ctx.secrets.get).mockResolvedValue('hf-worker-secret');

    await expect(backend.readSettings({}, ctx)).resolves.toMatchObject({ settings: { hfToken: 'configured' } });
  });

  it('falls back to defaults when settings JSON is corrupt', async () => {
    const settingsFile = join(home, '.cache', 'neon-pilot', 'video-probe', 'settings.json');
    rmSync(join(home, '.cache'), { recursive: true, force: true });
    mkdirSync(join(home, '.cache', 'neon-pilot', 'video-probe'), { recursive: true });
    writeFileSync(settingsFile, '{bad', 'utf-8');
    const backend = await loadBackend(home);

    await expect(backend.readSettings({}, ctx)).resolves.toMatchObject({ settings: { backend: 'openrouter' } });
  });

  it('reports OpenRouter auth source from environment or stored runtime credentials', async () => {
    const backend = await loadBackend(home);
    vi.stubEnv('OPENROUTER_API_KEY', 'env-key');
    await expect(backend.status({}, ctx)).resolves.toMatchObject({ openrouterAuth: { configured: true, source: 'environment' } });

    vi.stubEnv('OPENROUTER_API_KEY', '');
    rmSync(ctx.runtimeDir, { recursive: true, force: true });
    mkdirSync(ctx.runtimeDir, { recursive: true });
    writeFileSync(join(ctx.runtimeDir, 'auth.json'), JSON.stringify({ openrouter: { type: 'oauth', accessToken: 'stored' } }));
    await expect(backend.status({}, ctx)).resolves.toMatchObject({ openrouterAuth: { configured: true, source: 'stored' } });
  });
});
