import type { ExtensionRouteRequest } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const shellSpawn = vi.hoisted(() => vi.fn());
const localBackendBaseUrl = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('./extensionShell.js', () => ({
  createExtensionShellCapability: () => ({ spawn: shellSpawn }),
}));

vi.mock('../app/localBackendBaseUrl.js', () => ({
  getLocalBackendBaseUrl: () => localBackendBaseUrl.value,
}));

function createMockSpawnHandle(overrides?: {
  pid?: number | null;
  usingPty?: boolean;
  write?: (data: string) => void;
  resize?: (cols: number, rows: number) => void;
  kill?: () => void;
}) {
  return {
    pid: overrides?.pid ?? 555,
    usingPty: overrides?.usingPty ?? true,
    executionWrappers: [] as Array<{ id: string }>,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    ...overrides,
  };
}

function routeRequest(id: string): ExtensionRouteRequest {
  return {
    method: 'GET',
    path: '/stream',
    query: { id },
    params: {},
    body: null,
    signal: new AbortController().signal,
  };
}

describe('terminal sessions', () => {
  let mod: typeof import('./terminalSessions.js');

  beforeEach(async () => {
    vi.resetModules();
    localBackendBaseUrl.value = undefined;
    shellSpawn.mockReset();
    shellSpawn.mockResolvedValue(createMockSpawnHandle());
    mod = await import('./terminalSessions.js');
    mod.clearTerminalSessionsForTests();
  });

  it('creates an interactive shell process', async () => {
    const handlePty = createMockSpawnHandle({ pid: 777 });
    shellSpawn.mockResolvedValue(handlePty);

    const result = await mod.createTerminalSession({ cwd: '/workspace' });

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.pid).toBe(777);
    expect(result.usingPty).toBe(true);
    expect(shellSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.any(String),
        pty: { cols: 80, rows: 24 },
        cwd: '/workspace',
      }),
    );
  });

  it('includes the realtime WebSocket URL when the local backend base URL is known', async () => {
    localBackendBaseUrl.value = 'http://127.0.0.1:4321';

    const result = await mod.createTerminalSession({});

    expect(result.realtimeUrl).toBe('ws://127.0.0.1:4321/api/realtime');
  });

  it('writes, resizes, drains, and closes an existing terminal', async () => {
    const handlePty = createMockSpawnHandle();
    shellSpawn.mockResolvedValue(handlePty);
    const { id } = await mod.createTerminalSession({});
    const onStdout = shellSpawn.mock.calls[0][0].onStdout;

    onStdout('one');
    onStdout('two');

    expect(mod.writeTerminalSession({ id, data: 'echo hello\n' })).toEqual({ ok: true });
    expect(handlePty.write).toHaveBeenCalledWith('echo hello\n');
    expect(mod.resizeTerminalSession({ id, cols: 120, rows: 40 })).toEqual({ ok: true });
    expect(handlePty.resize).toHaveBeenCalledWith(120, 40);
    expect(mod.drainTerminalSession({ id })).toEqual({ ok: true, output: 'onetwo', exited: false, exitCode: null });
    expect(mod.drainTerminalSession({ id })).toEqual({ ok: true, output: '', exited: false, exitCode: null });
    expect(mod.closeTerminalSession({ id })).toEqual({ ok: true });
    expect(handlePty.kill).toHaveBeenCalled();
    expect(mod.writeTerminalSession({ id, data: 'x' })).toEqual({ ok: false });
  });

  it('tracks exit state before close removes a session', async () => {
    const { id } = await mod.createTerminalSession({});
    const onExit = shellSpawn.mock.calls[0][0].onExit;

    onExit({ code: 0, signal: null });

    expect(mod.drainTerminalSession({ id })).toEqual({ ok: true, output: '', exited: true, exitCode: 0 });
    expect(mod.writeTerminalSession({ id, data: 'x' })).toEqual({ ok: false });
  });

  it('preserves the recorded exit code when closing an already exited session', async () => {
    const { id } = await mod.createTerminalSession({});
    const onExit = shellSpawn.mock.calls[0][0].onExit;
    const listener = vi.fn();

    onExit({ code: 9, signal: null });

    const subscription = mod.subscribeTerminalSession({ id }, listener);
    expect(subscription.ok).toBe(true);
    expect(subscription.exitCode).toBe(9);

    expect(mod.closeTerminalSession({ id })).toEqual({ ok: true });
    expect(listener).not.toHaveBeenCalledWith({ type: 'exit', code: null });

    const afterClose = mod.subscribeTerminalSession({ id }, vi.fn());
    expect(afterClose).toEqual({ ok: false });
  });

  it('streams replayed output and live exit events over SSE', async () => {
    const { id } = await mod.createTerminalSession({});
    const onStdout = shellSpawn.mock.calls[0][0].onStdout;
    const onExit = shellSpawn.mock.calls[0][0].onExit;
    onStdout('prompt-before-stream');

    const { events } = await mod.streamTerminalSession(routeRequest(id));
    const iter = (events as AsyncIterable<unknown>)[Symbol.asyncIterator]();

    await expect(iter.next()).resolves.toMatchObject({
      value: { data: { type: 'output', data: 'prompt-before-stream' } },
      done: false,
    });
    const exitPromise = iter.next();
    onExit({ code: 0, signal: null });
    await expect(exitPromise).resolves.toMatchObject({ value: { data: { type: 'exit', code: 0 } } });
  });

  it('replays the exit event when the terminal exits before the SSE consumer attaches', async () => {
    const { id } = await mod.createTerminalSession({});
    const onStdout = shellSpawn.mock.calls[0][0].onStdout;
    const onExit = shellSpawn.mock.calls[0][0].onExit;

    onStdout('last-output');
    onExit({ code: 7, signal: null });

    const { events } = await mod.streamTerminalSession(routeRequest(id));
    const iter = (events as AsyncIterable<unknown>)[Symbol.asyncIterator]();

    await expect(iter.next()).resolves.toMatchObject({
      value: { data: { type: 'output', data: 'last-output' } },
      done: false,
    });
    await expect(iter.next()).resolves.toMatchObject({
      value: { data: { type: 'exit', code: 7 } },
      done: false,
    });
  });

  it('keeps startup output available for the first stream attach', async () => {
    shellSpawn.mockImplementation(async (input) => {
      input.onStdout('startup-prompt');
      return createMockSpawnHandle();
    });

    const result = await mod.createTerminalSession({});
    expect(result.initialOutput).toBe('startup-prompt');

    const { events } = await mod.streamTerminalSession(routeRequest(result.id));
    const iter = (events as AsyncIterable<unknown>)[Symbol.asyncIterator]();

    await expect(iter.next()).resolves.toMatchObject({
      value: { data: { type: 'output', data: 'startup-prompt' } },
      done: false,
    });
  });

  it('returns 404 for unknown terminal streams and false for unknown control actions', async () => {
    await expect(mod.streamTerminalSession(routeRequest('missing'))).resolves.toMatchObject({ status: 404 });
    expect(mod.writeTerminalSession({ id: 'missing', data: 'x' })).toEqual({ ok: false });
    expect(mod.resizeTerminalSession({ id: 'missing', cols: 80, rows: 24 })).toEqual({ ok: false });
    expect(mod.closeTerminalSession({ id: 'missing' })).toEqual({ ok: true });
  });
});
