import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/terminal', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('routes terminal operations through terminal sessions when no worker bridge is available', async () => {
    const terminal = await import('./terminal.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await terminal.createTerminalSession({ cwd: '/repo' });
    await terminal.writeTerminalSession({ id: 'term-1', data: 'pwd\n' });
    await terminal.drainTerminalSession({ id: 'term-1' });
    await terminal.resizeTerminalSession({ id: 'term-1', cols: 100, rows: 30 });
    await terminal.closeTerminalSession({ id: 'term-1' });
    await terminal.streamTerminalSession({ query: { id: 'term-1' } });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../terminalSessions.js', 'createTerminalSession', {
      cwd: '/repo',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../terminalSessions.js', 'writeTerminalSession', {
      id: 'term-1',
      data: 'pwd\n',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../terminalSessions.js', 'drainTerminalSession', {
      id: 'term-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '../terminalSessions.js', 'resizeTerminalSession', {
      id: 'term-1',
      cols: 100,
      rows: 30,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(5, '../terminalSessions.js', 'closeTerminalSession', {
      id: 'term-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(6, '../terminalSessions.js', 'streamTerminalSession', {
      query: { id: 'term-1' },
    });
  });

  it('routes terminal operations through the worker capability bridge when available', async () => {
    const bridge = vi.fn(async (_capability: string, operation: string, input?: unknown) => ({ operation, input }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const terminal = await import('./terminal.js');

    await expect(terminal.createTerminalSession({ cwd: '/repo' })).resolves.toEqual({ operation: 'create', input: { cwd: '/repo' } });
    await expect(terminal.writeTerminalSession({ id: 'term-1', data: 'pwd\n' })).resolves.toEqual({
      operation: 'write',
      input: { id: 'term-1', data: 'pwd\n' },
    });
    await expect(terminal.drainTerminalSession({ id: 'term-1' })).resolves.toEqual({ operation: 'drain', input: { id: 'term-1' } });
    await expect(terminal.resizeTerminalSession({ id: 'term-1', cols: 100 })).resolves.toEqual({
      operation: 'resize',
      input: { id: 'term-1', cols: 100 },
    });
    await expect(terminal.closeTerminalSession({ id: 'term-1' })).resolves.toEqual({ operation: 'close', input: { id: 'term-1' } });

    expect(bridge).toHaveBeenNthCalledWith(1, 'terminal', 'create', { cwd: '/repo' });
    expect(bridge).toHaveBeenNthCalledWith(2, 'terminal', 'write', { id: 'term-1', data: 'pwd\n' });
    expect(bridge).toHaveBeenNthCalledWith(3, 'terminal', 'drain', { id: 'term-1' });
    expect(bridge).toHaveBeenNthCalledWith(4, 'terminal', 'resize', { id: 'term-1', cols: 100 });
    expect(bridge).toHaveBeenNthCalledWith(5, 'terminal', 'close', { id: 'term-1' });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('handles worker terminal stream route edge cases', async () => {
    const sseResponse = { stream: 'sse' as const, events: async function* () {} };
    const bridge = vi
      .fn()
      .mockResolvedValueOnce(sseResponse)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, output: 'hello\n', exited: false })
      .mockResolvedValueOnce({ ok: true, output: '', exited: true });
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const terminal = await import('./terminal.js');

    await expect(terminal.streamTerminalSession({ query: {} })).resolves.toEqual({
      status: 404,
      body: { error: 'Terminal not found or already closed.' },
    });
    await expect(terminal.streamTerminalSession({ query: { id: ['term-sse'] } })).resolves.toBe(sseResponse);

    const fallback = await terminal.streamTerminalSession({ query: { id: 'term-loop' } });
    expect(fallback).toMatchObject({ stream: 'sse' });
    const events: unknown[] = [];
    for await (const event of (fallback as { events: AsyncIterable<unknown> }).events) {
      events.push(event);
      if (events.length === 1) break;
    }

    expect(events).toEqual([{ data: { type: 'output', data: 'hello\n' } }]);
    expect(bridge).toHaveBeenNthCalledWith(1, 'terminal', 'stream', { id: 'term-sse' });
    expect(bridge).toHaveBeenNthCalledWith(2, 'terminal', 'stream', { id: 'term-loop' });
    expect(bridge).toHaveBeenNthCalledWith(3, 'terminal', 'drain', { id: 'term-loop' });
  });
});
