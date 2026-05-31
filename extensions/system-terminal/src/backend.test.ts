import type { ExtensionBackendContext, ExtensionRouteRequest } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal mock for ExtensionBackendContext
const shellSpawn = vi.fn();
const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createBackendContext(overrides?: Partial<ExtensionBackendContext>): ExtensionBackendContext {
  return { shell: { spawn: shellSpawn }, log: logMock, ...overrides } as unknown as ExtensionBackendContext;
}

function createMockSpawnHandle(overrides?: {
  pid?: number | null;
  write?: (data: string) => void;
  resize?: (cols: number, rows: number) => void;
  kill?: () => void;
}) {
  return {
    pid: overrides?.pid ?? 555,
    executionWrappers: [] as Array<{ id: string }>,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    ...overrides,
  };
}

// Fake EventSource-target route request
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

const BACKEND_PATH = './backend.js';

describe('terminal backend', () => {
  let mod: typeof import('./backend.js');

  beforeEach(async () => {
    shellSpawn.mockReset();
    shellSpawn.mockResolvedValue(createMockSpawnHandle());
    logMock.info.mockReset();

    mod = await import(BACKEND_PATH);
    // Clear any terminal sessions left over from previous tests
    mod._clearSessions?.();
  });

  describe('createTerminal', () => {
    it('creates an interactive shell process', async () => {
      const handlePty = createMockSpawnHandle({ pid: 777 });
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();

      const result = await mod.createTerminal({ cwd: '/workspace' }, ctx);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.pid).toBe(777);
      expect(result.usingPty).toBe(false);
      expect(shellSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/bin/sh',
          args: [],
          cwd: '/workspace',
        }),
      );
      expect(shellSpawn.mock.calls[0][0]).not.toHaveProperty('pty');
    });

    it('uses a predictable pipe-backed shell', async () => {
      const originalShell = process.env.SHELL;
      delete process.env.SHELL;
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);

      await mod.createTerminal({}, createBackendContext());

      const callArgs = shellSpawn.mock.calls[0][0];
      expect(callArgs.command).toBe('/bin/sh');
      expect(callArgs.args).toEqual([]);

      process.env.SHELL = originalShell;
    });

    it('ignores SHELL env so degraded mode stays non-TTY safe', async () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/definitely/not/a/shell';
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);

      await mod.createTerminal({}, createBackendContext());

      const callArgs = shellSpawn.mock.calls[0][0];
      expect(callArgs.command).toBe('/bin/sh');

      process.env.SHELL = originalShell;
    });

    it('reports failure when shell spawn throws', async () => {
      shellSpawn.mockRejectedValue(new Error('spawn failed'));
      const ctx = createBackendContext();

      await expect(mod.createTerminal({}, ctx)).rejects.toThrow('spawn failed');
    });
  });

  describe('writeTerminal', () => {
    it('writes data to an existing terminal', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      const writeResult = await mod.writeTerminal({ id, data: 'echo hello\n' }, ctx);
      expect(writeResult).toEqual({ ok: true });
      expect(handlePty.write).toHaveBeenCalledWith('echo hello\n');
    });

    it('returns { ok: false } for unknown terminal id', async () => {
      const result = await mod.writeTerminal({ id: 'nonexistent', data: 'x' }, createBackendContext());
      expect(result).toEqual({ ok: false });
    });
  });

  describe('drainTerminal', () => {
    it('returns buffered terminal output once', async () => {
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);
      const onStdout = shellSpawn.mock.calls[0][0].onStdout;

      onStdout('one');
      onStdout('two');

      await expect(mod.drainTerminal({ id }, ctx)).resolves.toEqual({ ok: true, output: 'onetwo' });
      await expect(mod.drainTerminal({ id }, ctx)).resolves.toEqual({ ok: true, output: '' });
    });
  });

  describe('resizeTerminal', () => {
    it('resizes an existing terminal', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      const result = await mod.resizeTerminal({ id, cols: 120, rows: 40 }, ctx);
      expect(result).toEqual({ ok: true });
      expect(handlePty.resize).toHaveBeenCalledWith(120, 40);
    });

    it('returns { ok: false } for unknown terminal id', async () => {
      const result = await mod.resizeTerminal({ id: 'nonexistent', cols: 80, rows: 24 }, createBackendContext());
      expect(result).toEqual({ ok: false });
    });
  });

  describe('closeTerminal', () => {
    it('kills the process and removes the session', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      const result = await mod.closeTerminal({ id }, ctx);
      expect(result).toEqual({ ok: true });
      expect(handlePty.kill).toHaveBeenCalled();

      // Subsequent writes should fail
      const writeResult = await mod.writeTerminal({ id, data: 'x' }, ctx);
      expect(writeResult).toEqual({ ok: false });
    });

    it('returns { ok: true } even for unknown id (idempotent)', async () => {
      const result = await mod.closeTerminal({ id: 'nonexistent' }, createBackendContext());
      expect(result).toEqual({ ok: true });
    });
  });

  describe('streamTerminal (SSE route)', () => {
    it('returns 404 for unknown terminal', async () => {
      const result = await mod.streamTerminal(routeRequest('nonexistent'), createBackendContext());
      expect(result).toMatchObject({ status: 404 });
    });

    it('returns SSE stream for an active terminal', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      const result = await mod.streamTerminal(routeRequest(id), ctx);
      expect(result).toMatchObject({ stream: 'sse' });
      expect(result.events).toBeDefined();
    });

    it('SSE stream yields output events from the terminal', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      const { events } = await mod.streamTerminal(routeRequest(id), ctx);
      const iter = (events as AsyncIterable<unknown>)[Symbol.asyncIterator]();

      // The spawn was called with onStdout — simulate output arriving
      const onStdout = shellSpawn.mock.calls[0][0].onStdout;
      const nextPromise = iter.next();
      onStdout('some terminal output\n');

      const event = await nextPromise;
      expect(event.value).toEqual({ event: 'output', data: 'some terminal output\n' });
      expect(event.done).toBe(false);

      // close the terminal → stream should get exit event
      const onExit = shellSpawn.mock.calls[0][0].onExit;
      const exitPromise = iter.next();
      onExit({ code: 0, signal: null });

      const exitEvent = await exitPromise;
      expect(exitEvent.value).toEqual({ event: 'exit', data: { code: 0 } });
    });
  });

  describe('session lifecycle', () => {
    it('broadcasts exit to all SSE listeners when process exits', async () => {
      const handlePty = createMockSpawnHandle();
      shellSpawn.mockResolvedValue(handlePty);
      const ctx = createBackendContext();
      const { id } = await mod.createTerminal({}, ctx);

      // Connect two SSE streams
      const r1 = await mod.streamTerminal(routeRequest(id), ctx);
      const r2 = await mod.streamTerminal(routeRequest(id), ctx);

      const iter1 = (r1.events as AsyncIterable<unknown>)[Symbol.asyncIterator]();
      const iter2 = (r2.events as AsyncIterable<unknown>)[Symbol.asyncIterator]();

      const p1 = iter1.next();
      const p2 = iter2.next();

      // Simulate process exit
      const onExit = shellSpawn.mock.calls[0][0].onExit;
      onExit({ code: 1, signal: null });

      const e1 = await p1;
      const e2 = await p2;
      expect(e1.value).toEqual({ event: 'exit', data: { code: 1 } });
      expect(e2.value).toEqual({ event: 'exit', data: { code: 1 } });
    });
  });
});
