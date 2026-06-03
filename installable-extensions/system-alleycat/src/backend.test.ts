import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  authInstance: { ensurePairing: vi.fn(), rotateToken: vi.fn(), validate: vi.fn(), getToken: vi.fn() },
  createCodexAuth: vi.fn(),
}));

vi.mock('./codexAuth.js', () => auth);

describe('system-alleycat backend', () => {
  const runtimeDir = join(tmpdir(), `alleycat-backend-${process.pid}`);

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    rmSync(runtimeDir, { recursive: true, force: true });
    mkdirSync(runtimeDir, { recursive: true });
    auth.authInstance.ensurePairing.mockResolvedValue('token');
    auth.authInstance.rotateToken.mockReturnValue('next-token');
    auth.createCodexAuth.mockReturnValue(auth.authInstance);
    const backend = await import('./backend.js');
    await backend.stop(undefined, ctx()).catch(() => null);
  });

  afterEach(async () => {
    const backend = await import('./backend.js');
    await backend.stop(undefined, ctx()).catch(() => null);
    rmSync(runtimeDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function ctx(overrides: Record<string, unknown> = {}) {
    return {
      runtimeDir,
      storage: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) },
      shell: {
        exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
        spawn: vi.fn(),
      },
      log: { info: vi.fn(), warn: vi.fn() },
      ...overrides,
    } as never;
  }

  it('reports compatibility-only status and lazily builds a pairing payload when no sidecar is running', async () => {
    const { status } = await import('./backend.js');
    const context = ctx();

    await expect(status(undefined, context)).resolves.toMatchObject({
      running: false,
      port: null,
      pairPayload: null,
      implementation: 'codex-jsonrpc-compat',
      sidecarRunning: false,
      agents: [expect.objectContaining({ name: 'neon-pilot', available: false })],
    });
    expect(auth.createCodexAuth).toHaveBeenCalledWith(context);
    expect(auth.authInstance.ensurePairing).toHaveBeenCalled();
  });

  it('records degraded start logs when the sidecar cannot start', async () => {
    const { startService, status } = await import('./backend.js');
    const context = ctx({
      shell: {
        exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
        spawn: vi.fn().mockRejectedValue(new Error('no sidecar')),
      },
    });

    // startService degrades instead of throwing and initializes the log path.
    await expect(startService(undefined, context)).resolves.toMatchObject({ running: false, sidecarRunning: false });
    await expect(status(undefined, context)).resolves.toMatchObject({
      pairPayload: null,
      logs: expect.arrayContaining([expect.stringMatching(/Alleycat service start degraded|sidecar binary missing/)]),
    });
  });

  it('returns a serializable status object from the worker service handler', async () => {
    vi.stubEnv('NEON_PILOT_ALLEYCAT_SIDECAR', '/missing/alleycat-sidecar');
    const { startService } = await import('./backend.js');

    const result = await startService(undefined, ctx());

    expect(typeof result).toBe('object');
    expect(typeof result).not.toBe('function');
    expect(result).toMatchObject({ running: false, implementation: 'codex-jsonrpc-compat' });
  });

  it('rotates the auth token and stops sidecar state', async () => {
    const { rotateToken } = await import('./backend.js');
    const context = ctx();

    await rotateToken(undefined, context);

    expect(auth.authInstance.rotateToken).toHaveBeenCalledOnce();
    expect(auth.authInstance.ensurePairing).toHaveBeenCalled();
  });

  it('stop is idempotent and kills stale sidecar processes when context is available', async () => {
    const exec = vi.fn().mockResolvedValueOnce({ stdout: '123 456', stderr: '' }).mockResolvedValue({ stdout: '', stderr: '' });
    const { stop } = await import('./backend.js');

    await expect(stop(undefined, ctx({ shell: { exec, spawn: vi.fn() } }))).resolves.toEqual({ ok: true });
    expect(exec).toHaveBeenCalledWith({ command: 'sh', args: ['-lc', expect.stringContaining('pgrep -f')], timeoutMs: 5_000 });
    expect(exec).toHaveBeenCalledWith({ command: 'sh', args: ['-lc', 'kill 123 456 >/dev/null 2>&1 || true'], timeoutMs: 5_000 });
  });
});
