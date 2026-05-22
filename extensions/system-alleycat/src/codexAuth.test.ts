import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCodexAuth } from './codexAuth.js';

function ctx(runtimeDir: string, storedToken: string | null = null) {
  return {
    runtimeDir,
    storage: {
      get: vi.fn().mockResolvedValue(storedToken),
      put: vi.fn().mockResolvedValue(undefined),
    },
    log: { info: vi.fn() },
  } as never;
}

describe('codexAuth', () => {
  const runtimeDir = join(tmpdir(), `codex-auth-${process.pid}`);

  beforeEach(() => {
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('generates, persists, validates, and returns a pairing token', async () => {
    const context = ctx(runtimeDir);
    const auth = createCodexAuth(context);

    expect(auth.getToken()).toBeNull();
    expect(auth.validate('bad')).toBe(false);

    const token = await auth.ensurePairing();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(auth.getToken()).toBe(token);
    expect(auth.validate(token)).toBe(true);
    expect(auth.validate(`${token}x`)).toBe(false);
    expect((context as { storage: { put: ReturnType<typeof vi.fn> } }).storage.put).toHaveBeenCalledWith('codex-token', token);
    expect((context as { log: { info: ReturnType<typeof vi.fn> } }).log.info).toHaveBeenCalledWith('codex protocol auth token generated');

    const stablePath = join(runtimeDir, 'kitty-litter-alleycat', 'auth.json');
    expect(existsSync(stablePath)).toBe(true);
    expect(JSON.parse(readFileSync(stablePath, 'utf8'))).toEqual({ token });
  });

  it('loads an existing stable token without consulting extension-scoped storage further', async () => {
    const first = createCodexAuth(ctx(runtimeDir));
    const token = await first.ensurePairing();
    const context = ctx(runtimeDir, 'old-token');

    const second = createCodexAuth(context);
    await expect(second.ensurePairing()).resolves.toBe(token);
    expect(second.validate(token)).toBe(true);
    expect((context as { storage: { put: ReturnType<typeof vi.fn> } }).storage.put).not.toHaveBeenCalled();
  });

  it('migrates a legacy stored token to stable runtime storage', async () => {
    const context = ctx(runtimeDir, 'legacy-token');
    const auth = createCodexAuth(context);

    await expect(auth.ensurePairing()).resolves.toBe('legacy-token');
    expect(auth.validate('legacy-token')).toBe(true);
    expect(JSON.parse(readFileSync(join(runtimeDir, 'kitty-litter-alleycat', 'auth.json'), 'utf8'))).toEqual({ token: 'legacy-token' });
  });

  it('rotates tokens and persists the replacement', async () => {
    const context = ctx(runtimeDir);
    const auth = createCodexAuth(context);
    const oldToken = await auth.ensurePairing();

    const nextToken = auth.rotateToken();
    expect(nextToken).not.toBe(oldToken);
    expect(auth.validate(oldToken)).toBe(false);
    expect(auth.validate(nextToken)).toBe(true);
    expect(JSON.parse(readFileSync(join(runtimeDir, 'kitty-litter-alleycat', 'auth.json'), 'utf8'))).toEqual({ token: nextToken });
    expect((context as { storage: { put: ReturnType<typeof vi.fn> } }).storage.put).toHaveBeenLastCalledWith('codex-token', nextToken);
  });
});
