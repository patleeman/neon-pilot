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

    expect(handle).toMatchObject({ pid: 123, executionWrappers: [{ id: 'wrap' }] });
    expect(onStdout).toHaveBeenCalledWith('hello');
    expect(onStderr).toHaveBeenCalledWith('oops');
    expect(onExit).toHaveBeenCalledWith({ code: 0, signal: null });
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
