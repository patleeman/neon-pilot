import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileProcess = vi.fn();
const spawnProcess = vi.fn();
const terminateProcessGroup = vi.fn();

vi.mock('../shared/processLauncher.js', () => ({ execFileProcess, spawnProcess, terminateProcessGroup }));

const { createExtensionGitCapability, createExtensionShellCapability } = await import('./extensionShell.js');

function createChild() {
  const child = new EventEmitter() as EventEmitter & {
    pid?: number;
    stdout?: EventEmitter;
    stderr?: EventEmitter;
  };
  child.pid = 123;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('extensionShell', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    execFileProcess.mockReset().mockResolvedValue({ stdout: 'out', stderr: 'err', launch: { wrappers: [{ id: 'sandbox' }] } });
    spawnProcess.mockReset();
    terminateProcessGroup.mockReset();
  });

  it('executes commands through the process launcher with defaults and merged env', async () => {
    const signal = new AbortController().signal;
    await expect(
      createExtensionShellCapability().exec({ command: 'node', args: ['--version'], cwd: '/repo', env: { EXTRA: '1' }, signal }),
    ).resolves.toEqual({
      command: 'node',
      args: ['--version'],
      cwd: '/repo',
      stdout: 'out',
      stderr: 'err',
      executionWrappers: [{ id: 'sandbox' }],
    });
    expect(execFileProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'node',
        args: ['--version'],
        cwd: '/repo',
        timeoutMs: 30_000,
        maxBuffer: 1024 * 1024,
        env: expect.objectContaining({ EXTRA: '1' }),
        signal,
      }),
    );
  });

  it('routes exec through the Tauri host-core RPC when available', async () => {
    vi.stubEnv('NEON_PILOT_TAURI_HOST_CORE_PORT', '4567');
    vi.stubEnv('NEON_PILOT_TAURI_HOST_CORE_TOKEN', 'host-token');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          command: 'node',
          args: ['--version'],
          stdout: 'rust-out',
          stderr: '',
          exitCode: 0,
          success: true,
          executionWrappers: [{ id: 'tauri-host-core' }],
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createExtensionShellCapability().exec({ command: 'node', args: ['--version'], cwd: '/repo' })).resolves.toEqual({
      command: 'node',
      args: ['--version'],
      cwd: '/repo',
      stdout: 'rust-out',
      stderr: '',
      executionWrappers: [{ id: 'tauri-host-core' }],
    });

    expect(execFileProcess).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4567/process/exec',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer host-token' }),
      }),
    );
  });

  it('spawns processes, wires output callbacks, exit callbacks, and kill', async () => {
    const child = createChild();
    spawnProcess.mockReturnValue({ child, launch: { wrappers: [{ id: 'wrap' }] } });
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const onExit = vi.fn();

    const handle = await createExtensionShellCapability().spawn({
      command: 'long',
      args: ['run'],
      cwd: '/repo',
      onStdout,
      onStderr,
      onExit,
    });
    child.stdout?.emit('data', Buffer.from('hello'));
    child.stderr?.emit('data', Buffer.from('oops'));
    child.emit('exit', 0, null);
    handle.kill();

    expect(spawnProcess).toHaveBeenCalledWith(expect.objectContaining({ options: { detached: true, stdio: ['pipe', 'pipe', 'pipe'] } }));
    expect(handle).toMatchObject({ pid: 123, usingPty: false, executionWrappers: [{ id: 'wrap' }] });
    expect(typeof handle.write).toBe('function');
    expect(typeof handle.resize).toBe('function');
    expect(onStdout).toHaveBeenCalledWith('hello');
    expect(onStderr).toHaveBeenCalledWith('oops');
    expect(onExit).toHaveBeenCalledWith({ code: 0, signal: null });
    expect(terminateProcessGroup).toHaveBeenCalledWith(child);

    // write() should write to child.stdin
    Object.assign(child, { stdin: { writable: true, write: vi.fn() } });
    handle.write('test input');
    expect(child.stdin.write).toHaveBeenCalledWith('test input');
  });

  it('routes PTY spawn, write, resize, and kill through the Tauri Rust host-core RPC', async () => {
    vi.stubEnv('NEON_PILOT_TAURI_HOST_CORE_PORT', '4567');
    vi.stubEnv('NEON_PILOT_TAURI_HOST_CORE_TOKEN', 'host-token');
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/process/spawn')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ id: 'proc-1', pid: 789, usingPty: true, executionWrappers: [{ id: 'tauri-host-core' }] }),
        };
      }
      return { ok: true, text: async () => JSON.stringify({ id: 'proc-1', stdout: '', stderr: '', exit: null }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const handle = await createExtensionShellCapability().spawn({
      command: '/bin/bash',
      pty: { cols: 120, rows: 30 },
      cwd: '/workspace',
    });
    handle.write('echo hi\n');
    handle.resize(100, 40);
    handle.kill();

    expect(handle).toMatchObject({ pid: 789, usingPty: true, executionWrappers: [{ id: 'tauri-host-core' }] });
    const spawnCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/process/spawn'));
    expect(JSON.parse(String((spawnCall?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      command: '/bin/bash',
      cwd: '/workspace',
      pty: { cols: 120, rows: 30 },
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4567/process/write', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4567/process/resize', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4567/process/kill', expect.any(Object));
  });

  it('rejects PTY shell sessions when the Rust host kernel is unavailable', async () => {
    await expect(createExtensionShellCapability().spawn({ command: 'zsh', pty: true })).rejects.toThrow('Rust host kernel');
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('implements git helpers with focused git commands', async () => {
    const git = createExtensionGitCapability();

    await expect(git.status({ cwd: '/repo' })).resolves.toEqual({ porcelain: 'out' });
    expect(execFileProcess).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: 'git', args: ['status', '--porcelain=v1', '--branch'] }),
    );

    await expect(git.diff({ cwd: '/repo', path: 'src/a.ts', staged: true })).resolves.toEqual({ diff: 'out' });
    expect(execFileProcess).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: 'git', args: ['diff', '--staged', '--', 'src/a.ts'], maxBuffer: 8 * 1024 * 1024 }),
    );

    await expect(git.log({ cwd: '/repo', maxCount: 5 })).resolves.toEqual({ log: 'out' });
    expect(execFileProcess).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: 'git', args: ['log', '--max-count=5', '--oneline', '--decorate'] }),
    );
  });
});
