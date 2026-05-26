import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createRuntimeDir(): string {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'speechmike-test-'));
  writeFileSync(join(runtimeDir, 'speechmike-helper'), '');
  return runtimeDir;
}

function createContext(runtimeDir: string, psOutput: string) {
  const exec = vi.fn(async (input: { command: string; args?: string[] }) => {
    if (input.command === '/bin/ps') {
      return { stdout: psOutput, stderr: '', exitCode: 0, command: input.command, args: input.args ?? [], executionWrappers: [] };
    }
    return { stdout: '', stderr: '', exitCode: 0, command: input.command, args: input.args ?? [], executionWrappers: [] };
  });
  const spawn = vi.fn(async () => ({ pid: 333, executionWrappers: [], kill: vi.fn() }));
  const ctx = {
    runtimeDir,
    shell: { exec, spawn },
    storage: { get: vi.fn(), put: vi.fn() },
    commands: { execute: vi.fn(), list: vi.fn() },
    log: { warn: vi.fn() },
  } as unknown as ExtensionBackendContext;
  return { ctx, exec, spawn };
}

describe('SpeechMike backend', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('terminates stale helpers from the same runtime before starting a new monitor', async () => {
    const runtimeDir = createRuntimeDir();
    const helperPath = join(runtimeDir, 'speechmike-helper');
    const { ctx, exec, spawn } = createContext(
      runtimeDir,
      [
        `111 ${helperPath}`,
        `222 ${helperPath} --unexpected-arg`,
        '333 /other/runtime/speechmike-helper',
        '444 /bin/zsh -c speechmike-helper',
      ].join('\n'),
    );
    const backend = await import('./backend.js');

    await backend.start(undefined, ctx);

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith(expect.objectContaining({ command: '/bin/ps' }));
    expect(exec).toHaveBeenCalledWith(expect.objectContaining({ command: '/bin/kill', args: ['-TERM', '111', '222'] }));
  });

  it('does not kill a running monitor when stop scans for leftover helpers', async () => {
    const runtimeDir = createRuntimeDir();
    const helperPath = join(runtimeDir, 'speechmike-helper');
    const { ctx, exec } = createContext(runtimeDir, [`111 ${helperPath}`, `333 ${helperPath}`].join('\n'));
    const backend = await import('./backend.js');

    await backend.stop(undefined, ctx);

    expect(exec).toHaveBeenCalledWith(expect.objectContaining({ command: '/bin/kill', args: ['-TERM', '111', '333'] }));
  });
});
