import type { ExtensionBackendContext, ExtensionRouteRequest } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const terminalApi = vi.hoisted(() => ({
  closeTerminalSession: vi.fn(),
  createTerminalSession: vi.fn(),
  drainTerminalSession: vi.fn(),
  resizeTerminalSession: vi.fn(),
  streamTerminalSession: vi.fn(),
  writeTerminalSession: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/terminal', () => terminalApi);

function createBackendContext(): ExtensionBackendContext {
  return { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as ExtensionBackendContext;
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

describe('terminal extension backend', () => {
  let mod: typeof import('./backend.js');

  beforeEach(async () => {
    vi.resetModules();
    for (const mock of Object.values(terminalApi)) mock.mockReset();
    mod = await import('./backend.js');
  });

  it('creates terminals through the host-owned terminal API', async () => {
    terminalApi.createTerminalSession.mockResolvedValue({
      id: 'terminal-1',
      pid: 123,
      usingPty: true,
      initialOutput: '$ ',
      realtimeUrl: 'ws://127.0.0.1:4321/api/realtime',
    });
    const ctx = createBackendContext();

    await expect(mod.createTerminal({ cwd: '/workspace' }, ctx)).resolves.toEqual({
      id: 'terminal-1',
      pid: 123,
      usingPty: true,
      initialOutput: '$ ',
      realtimeUrl: 'ws://127.0.0.1:4321/api/realtime',
    });
    expect(terminalApi.createTerminalSession).toHaveBeenCalledWith({ cwd: '/workspace' });
    expect(ctx.log.info).toHaveBeenCalledWith('Terminal created', { id: 'terminal-1', pid: 123, cwd: '/workspace' });
  });

  it('delegates terminal control actions to the host-owned terminal API', async () => {
    terminalApi.writeTerminalSession.mockResolvedValue({ ok: true });
    terminalApi.drainTerminalSession.mockResolvedValue({ ok: true, output: 'out', exited: false, exitCode: null });
    terminalApi.resizeTerminalSession.mockResolvedValue({ ok: true });
    terminalApi.closeTerminalSession.mockResolvedValue({ ok: true });

    await expect(mod.writeTerminal({ id: 't', data: 'echo hi\n' })).resolves.toEqual({ ok: true });
    await expect(mod.drainTerminal({ id: 't' })).resolves.toEqual({ ok: true, output: 'out', exited: false, exitCode: null });
    await expect(mod.resizeTerminal({ id: 't', cols: 120, rows: 40 })).resolves.toEqual({ ok: true });
    await expect(mod.closeTerminal({ id: 't' })).resolves.toEqual({ ok: true });

    expect(terminalApi.writeTerminalSession).toHaveBeenCalledWith({ id: 't', data: 'echo hi\n' });
    expect(terminalApi.drainTerminalSession).toHaveBeenCalledWith({ id: 't' });
    expect(terminalApi.resizeTerminalSession).toHaveBeenCalledWith({ id: 't', cols: 120, rows: 40 });
    expect(terminalApi.closeTerminalSession).toHaveBeenCalledWith({ id: 't' });
  });

  it('delegates the SSE stream route to the same terminal API', async () => {
    const response = { stream: 'sse' as const, events: (async function* () {})() };
    terminalApi.streamTerminalSession.mockResolvedValue(response);
    const request = routeRequest('terminal-1');

    await expect(mod.streamTerminal(request)).resolves.toBe(response);
    expect(terminalApi.streamTerminalSession).toHaveBeenCalledWith(request);
  });
});
