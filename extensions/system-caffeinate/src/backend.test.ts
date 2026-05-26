import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/extensions/backend/settings', () => ({
  readExtensionSettings: vi.fn(),
}));

import { readExtensionSettings } from '@neon-pilot/extensions/backend/settings';

import { start, startup, status, stop, toggle } from './backend.js';

const mockedReadExtensionSettings = vi.mocked(readExtensionSettings);

function createCtx() {
  const ctx = {
    shell: { spawn: vi.fn() },
    log: { info: vi.fn(), warn: vi.fn() },
  };
  return ctx;
}

describe('system-caffeinate backend', () => {
  beforeEach(async () => {
    mockedReadExtensionSettings.mockReset();
    mockedReadExtensionSettings.mockResolvedValue({});
    await stop({}, createCtx() as never);
  });

  it('reports stopped status before a process is started', async () => {
    await expect(status()).resolves.toEqual({ running: false, pid: null });
  });

  it('starts caffeinate once and returns the running pid', async () => {
    const child = { pid: 1234, kill: vi.fn() };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);

    await expect(start({}, ctx as never)).resolves.toEqual({ running: true, pid: 1234 });
    await expect(start({}, ctx as never)).resolves.toEqual({ running: true, pid: 1234 });

    expect(ctx.shell.spawn).toHaveBeenCalledTimes(1);
    expect(ctx.shell.spawn).toHaveBeenCalledWith({ command: 'caffeinate', args: ['-dimsu'], onExit: expect.any(Function) });
  });

  it('kills and rejects when the spawned process has no pid', async () => {
    const child = { pid: null, kill: vi.fn() };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);

    await expect(start({}, ctx as never)).rejects.toThrow('missing child pid');
    expect(child.kill).toHaveBeenCalledOnce();
    await expect(status()).resolves.toEqual({ running: false, pid: null });
  });

  it('clears state when the active child exits', async () => {
    const child = { pid: 77, kill: vi.fn() };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);

    await start({}, ctx as never);
    const onExit = ctx.shell.spawn.mock.calls[0][0].onExit;
    onExit({ code: 0, signal: null });

    expect(ctx.log.info).toHaveBeenCalledWith('caffeinate exited', { code: 0, signal: null });
    await expect(status()).resolves.toEqual({ running: false, pid: null });
  });

  it('stops the active process and swallows kill errors with a warning', async () => {
    const child = {
      pid: 88,
      kill: vi.fn(() => {
        throw new Error('nope');
      }),
    };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);

    await start({}, ctx as never);
    await expect(stop({}, ctx as never)).resolves.toEqual({ running: false, pid: null });

    expect(child.kill).toHaveBeenCalledOnce();
    expect(ctx.log.warn).toHaveBeenCalledWith('failed to stop caffeinate', { pid: 88, error: 'nope' });
  });

  it('toggles between start and stop', async () => {
    const child = { pid: 99, kill: vi.fn() };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);

    await expect(toggle({}, ctx as never)).resolves.toEqual({ running: true, pid: 99 });
    await expect(toggle({}, ctx as never)).resolves.toEqual({ running: false, pid: null });
  });

  it('starts on startup when the auto-start setting is enabled', async () => {
    const child = { pid: 4321, kill: vi.fn() };
    const ctx = createCtx();
    ctx.shell.spawn.mockResolvedValue(child);
    mockedReadExtensionSettings.mockResolvedValue({ 'caffeinate.autoStart': true });

    await expect(startup({}, ctx as never)).resolves.toEqual({ running: true, pid: 4321 });
    expect(ctx.shell.spawn).toHaveBeenCalledWith({ command: 'caffeinate', args: ['-dimsu'], onExit: expect.any(Function) });
  });

  it('does not start on startup when the auto-start setting is disabled', async () => {
    const ctx = createCtx();
    mockedReadExtensionSettings.mockResolvedValue({ 'caffeinate.autoStart': false });

    await expect(startup({}, ctx as never)).resolves.toEqual({ running: false, pid: null });
    expect(ctx.shell.spawn).not.toHaveBeenCalled();
  });
});
