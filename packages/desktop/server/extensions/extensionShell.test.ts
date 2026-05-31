import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileProcess = vi.fn();
const spawnProcess = vi.fn();
const terminateProcessGroup = vi.fn();

vi.mock('../shared/processLauncher.js', () => ({ execFileProcess, spawnProcess, terminateProcessGroup }));

// Factory for a mock PTY that looks like node-pty's IPty
function createMockPty(
  overrides: Partial<{
    pid: number;
    onData: (cb: (chunk: string) => void) => void;
    onExit: (cb: (event: { exitCode: number; signal?: number }) => void) => void;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
  }> = {},
) {
  const callbacks: { data?: (chunk: string) => void; exit?: (event: { exitCode: number; signal?: number }) => void } = {};
  return {
    pid: overrides.pid ?? 456,
    onData: vi.fn((cb: (chunk: string) => void) => {
      callbacks.data = cb;
    }),
    onExit: vi.fn((cb: (event: { exitCode: number; signal?: number }) => void) => {
      callbacks.exit = cb;
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    _callbacks: callbacks,
    ...overrides,
  };
}

const createPtyProcess = vi.fn();
vi.mock('../shared/ptyLauncher.js', () => ({ createPtyProcess }));

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
    createPtyProcess.mockReset();
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

  it('spawns with PTY: delegates to node-pty and wires callbacks', async () => {
    const mockPty = createMockPty({ pid: 456 });
    createPtyProcess.mockReturnValue({ pty: mockPty, launch: { wrappers: [{ id: 'wrap-pty' }] } });

    const onStdout = vi.fn();
    const onExit = vi.fn();

    const handle = await createExtensionShellCapability().spawn({
      command: '/bin/bash',
      pty: { cols: 120, rows: 30 },
      cwd: '/workspace',
      onStdout,
      onExit,
    });

    // Should delegate to createPtyProcess with correct options
    expect(createPtyProcess).toHaveBeenCalledWith({
      command: '/bin/bash',
      args: [],
      cwd: '/workspace',
      env: expect.any(Object),
      cols: 120,
      rows: 30,
    });

    // Should wire pty.onData → onStdout
    mockPty._callbacks.data?.('terminal output\r\n');
    expect(onStdout).toHaveBeenCalledWith('terminal output\r\n');

    // Should wire pty.onExit → onExit
    mockPty._callbacks.exit?.({ exitCode: 0 });
    expect(onExit).toHaveBeenCalledWith({ code: 0, signal: null });

    // Returned handle should have write/resize that delegate to the pty
    handle.write('echo hi\n');
    expect(mockPty.write).toHaveBeenCalledWith('echo hi\n');

    handle.resize(100, 40);
    expect(mockPty.resize).toHaveBeenCalledWith(100, 40);

    // kill should delegate
    handle.kill();
    expect(mockPty.kill).toHaveBeenCalled();

    expect(handle).toMatchObject({ pid: 456, usingPty: true, executionWrappers: [{ id: 'wrap-pty' }] });
  });

  it('spawns with pty:true uses default 80x24 dimensions', async () => {
    const mockPty = createMockPty({ pid: 789 });
    createPtyProcess.mockReturnValue({ pty: mockPty, launch: { wrappers: [] } });

    await createExtensionShellCapability().spawn({
      command: 'zsh',
      pty: true,
    });

    expect(createPtyProcess).toHaveBeenCalledWith(expect.objectContaining({ cols: 80, rows: 24 }));
  });

  it('falls back to a pipe-backed process when PTY spawn fails', async () => {
    const child = createChild();
    Object.assign(child, { stdin: { writable: true, write: vi.fn() } });
    createPtyProcess.mockImplementation(() => {
      throw new Error('posix_spawnp failed.');
    });
    spawnProcess.mockReturnValue({ child, launch: { wrappers: [{ id: 'pipe-fallback' }] } });

    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const onExit = vi.fn();

    const handle = await createExtensionShellCapability().spawn({
      command: '/bin/zsh',
      pty: { cols: 120, rows: 30 },
      cwd: '/workspace',
      onStdout,
      onStderr,
      onExit,
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: '/bin/zsh',
        cwd: '/workspace',
        options: { detached: true, stdio: ['pipe', 'pipe', 'pipe'] },
      }),
    );

    child.stdout?.emit('data', Buffer.from('pipe stdout'));
    child.stderr?.emit('data', Buffer.from('pipe stderr'));
    child.emit('exit', 0, null);
    handle.write('echo fallback\n');
    handle.resize(100, 40);
    handle.kill();

    expect(handle).toMatchObject({ pid: 123, usingPty: false, executionWrappers: [{ id: 'pipe-fallback' }] });
    expect(onStdout).toHaveBeenCalledWith('pipe stdout');
    expect(onStderr).toHaveBeenCalledWith('pipe stderr');
    expect(onExit).toHaveBeenCalledWith({ code: 0, signal: null });
    expect(child.stdin.write).toHaveBeenCalledWith('echo fallback\n');
    expect(terminateProcessGroup).toHaveBeenCalledWith(child);
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
