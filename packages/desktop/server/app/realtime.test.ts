import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeAppEventsMock = vi.fn();
const subscribeDesktopLocalApiStreamByUrlMock = vi.fn();
const terminalSessionsMock = vi.hoisted(() => ({
  closeTerminalSession: vi.fn(),
  resizeTerminalSession: vi.fn(),
  subscribeTerminalSession: vi.fn(),
  writeTerminalSession: vi.fn(),
}));

vi.mock('../shared/appEvents.js', () => ({
  subscribeAppEvents: subscribeAppEventsMock,
}));

vi.mock('./localApiStreams.js', () => ({
  subscribeDesktopLocalApiStreamByUrl: subscribeDesktopLocalApiStreamByUrlMock,
}));

vi.mock('../extensions/terminalSessions.js', () => terminalSessionsMock);

class FakeWebSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(payload: string): void {
    this.sent.push(payload);
  }
  receive(payload: unknown): void {
    this.emit('message', JSON.stringify(payload));
  }
}

describe('createDesktopRealtimeUpgradeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeAppEventsMock.mockReturnValue(vi.fn());
    terminalSessionsMock.subscribeTerminalSession.mockReturnValue({ ok: false });
    terminalSessionsMock.writeTerminalSession.mockReturnValue({ ok: true });
    terminalSessionsMock.resizeTerminalSession.mockReturnValue({ ok: true });
    terminalSessionsMock.closeTerminalSession.mockReturnValue({ ok: true });
  });

  it('bridges app events over WebSocket and unsubscribes on close', async () => {
    const unsubscribe = vi.fn();
    let listener: ((event: { type: 'invalidate'; topics: string[] }) => void) | undefined;
    subscribeAppEventsMock.mockImplementation((nextListener) => {
      listener = nextListener;
      return unsubscribe;
    });

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fakeSocket.sent[0] ?? '{}')).toEqual({ type: 'connected' });
    listener?.({ type: 'invalidate', topics: ['sessions'] });
    expect(JSON.parse(fakeSocket.sent[1] ?? '{}')).toEqual({ type: 'app_event', event: { type: 'invalidate', topics: ['sessions'] } });

    fakeSocket.emit('close');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    handleUpgrade.mockRestore();
  });

  it('subscribes local API streams through the WebSocket protocol', async () => {
    const streamUnsubscribe = vi.fn();
    let emitStream: ((event: { type: 'open' } | { type: 'message'; data: string }) => void) | undefined;
    subscribeDesktopLocalApiStreamByUrlMock.mockImplementation(async (_url, onEvent) => {
      emitStream = onEvent;
      onEvent({ type: 'open' });
      return streamUnsubscribe;
    });

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));
    fakeSocket.receive({ type: 'subscribe', id: 'req-1', path: '/api/live-sessions/live-1/events' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeDesktopLocalApiStreamByUrlMock.mock.calls[0]?.[0]?.pathname).toBe('/api/live-sessions/live-1/events');
    const openMessage = fakeSocket.sent.map((entry) => JSON.parse(entry)).find((entry) => entry.type === 'stream');
    expect(openMessage.event).toEqual({ type: 'open' });
    const subscribed = fakeSocket.sent.map((entry) => JSON.parse(entry)).find((entry) => entry.type === 'subscribed');
    expect(subscribed).toMatchObject({ type: 'subscribed', id: 'req-1' });

    emitStream?.({ type: 'message', data: '{"ok":true}' });
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).at(-1)).toMatchObject({
      type: 'stream',
      subscriptionId: subscribed.subscriptionId,
      event: { type: 'message', data: '{"ok":true}' },
    });

    fakeSocket.receive({ type: 'unsubscribe', id: 'req-2', subscriptionId: subscribed.subscriptionId });
    expect(streamUnsubscribe).toHaveBeenCalledTimes(1);
    handleUpgrade.mockRestore();
  });

  it('tears down late local API stream subscriptions when the socket closes before subscribe resolves', async () => {
    const streamUnsubscribe = vi.fn();
    let resolveSubscribe: ((unsubscribe: () => void) => void) | null = null;
    subscribeDesktopLocalApiStreamByUrlMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubscribe = resolve;
        }),
    );

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));
    fakeSocket.receive({ type: 'subscribe', id: 'req-late', path: '/api/live-sessions/live-1/events' });
    fakeSocket.emit('close');

    resolveSubscribe?.(streamUnsubscribe);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(streamUnsubscribe).toHaveBeenCalledTimes(1);
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).find((entry) => entry.type === 'subscribed')).toBeUndefined();
    handleUpgrade.mockRestore();
  });

  it('attaches terminal sessions and routes input, resize, output, and close over WebSocket', async () => {
    const terminalUnsubscribe = vi.fn();
    let emitTerminal: ((event: { type: 'output'; data: string } | { type: 'exit'; code: number | null }) => void) | undefined;
    terminalSessionsMock.subscribeTerminalSession.mockImplementation((_input, listener) => {
      emitTerminal = listener;
      return { ok: true, unsubscribe: terminalUnsubscribe, replay: 'prompt> ', exited: false, exitCode: null };
    });

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));
    fakeSocket.receive({ type: 'terminal_attach', id: 'attach-1', terminalId: 'term-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(terminalSessionsMock.subscribeTerminalSession).toHaveBeenCalledWith({ id: 'term-1' }, expect.any(Function));
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).at(-1)).toEqual({
      type: 'terminal_attached',
      id: 'attach-1',
      terminalId: 'term-1',
      replay: 'prompt> ',
      exited: false,
      exitCode: null,
    });

    emitTerminal?.({ type: 'output', data: 'hello' });
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).at(-1)).toEqual({
      type: 'terminal',
      terminalId: 'term-1',
      event: { type: 'output', data: 'hello' },
    });

    fakeSocket.receive({ type: 'terminal_input', terminalId: 'term-1', data: 'ls\n' });
    expect(terminalSessionsMock.writeTerminalSession).toHaveBeenCalledWith({ id: 'term-1', data: 'ls\n' });

    fakeSocket.receive({ type: 'terminal_resize', terminalId: 'term-1', cols: 120, rows: 32 });
    expect(terminalSessionsMock.resizeTerminalSession).toHaveBeenCalledWith({ id: 'term-1', cols: 120, rows: 32 });

    fakeSocket.receive({ type: 'terminal_close', terminalId: 'term-1' });
    expect(terminalUnsubscribe).toHaveBeenCalledTimes(1);
    expect(terminalSessionsMock.closeTerminalSession).toHaveBeenCalledWith({ id: 'term-1' });
    handleUpgrade.mockRestore();
  });
});
