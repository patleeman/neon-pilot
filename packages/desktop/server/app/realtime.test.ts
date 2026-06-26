import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeAppEventsMock = vi.fn();
const subscribeDesktopLocalApiStreamByUrlMock = vi.fn();
const conversationAggregateMock = vi.hoisted(() => ({
  readConversationAggregateState: vi.fn(),
  subscribeConversationAggregate: vi.fn(),
}));
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

vi.mock('../conversations/conversationAggregate.js', () => conversationAggregateMock);

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
    conversationAggregateMock.readConversationAggregateState.mockResolvedValue({
      conversationId: 'conv-1',
      revision: 0,
      updatedAt: '2026-06-23T00:00:00.000Z',
      conversation: { conversationId: 'conv-1', sessionDetail: null, liveSession: { live: false }, stream: {} },
      activity: { conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] },
    });
    conversationAggregateMock.subscribeConversationAggregate.mockReturnValue(vi.fn());
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

  it('rejects realtime WebSocket upgrades from untrusted browser origins', async () => {
    const fakeSocket = { destroy: vi.fn(), write: vi.fn() };
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade');

    handler(
      {
        url: '/api/realtime',
        headers: { host: '127.0.0.1:4123', origin: 'https://evil.example' },
        socket: {},
      } as never,
      fakeSocket as never,
      Buffer.alloc(0),
    );

    expect(handleUpgrade).not.toHaveBeenCalled();
    expect(fakeSocket.write).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    expect(fakeSocket.destroy).toHaveBeenCalledTimes(1);
    handleUpgrade.mockRestore();
  });

  it('accepts realtime WebSocket upgrades from same-origin browsers, desktop app renderers, and missing-origin clients', async () => {
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(new FakeWebSocket() as never);
    });

    handler(
      {
        url: '/api/realtime',
        headers: { host: '127.0.0.1:4123', origin: 'http://127.0.0.1:4123' },
        socket: {},
      } as never,
      { destroy: vi.fn() } as never,
      Buffer.alloc(0),
    );
    handler(
      {
        url: '/api/realtime',
        headers: { host: '127.0.0.1:4123', origin: 'neon-pilot://app' },
        socket: {},
      } as never,
      { destroy: vi.fn() } as never,
      Buffer.alloc(0),
    );
    handler(
      { url: '/api/realtime', headers: { host: '127.0.0.1:4123' }, socket: {} } as never,
      { destroy: vi.fn() } as never,
      Buffer.alloc(0),
    );

    expect(handleUpgrade).toHaveBeenCalledTimes(3);
    handleUpgrade.mockRestore();
  });

  it('ignores late app events after realtime cleanup', async () => {
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
    fakeSocket.emit('error', new Error('socket failed'));
    listener?.({ type: 'invalidate', topics: ['sessions'] });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry))).toEqual([{ type: 'connected' }]);
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
    fakeSocket.receive({ type: 'subscribe', id: 'req-1', path: '/api/runs/run-1/events' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeDesktopLocalApiStreamByUrlMock.mock.calls[0]?.[0]?.pathname).toBe('/api/runs/run-1/events');
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

  it('can route realtime local API streams through a host-provided stream resolver', async () => {
    const streamUnsubscribe = vi.fn();
    const subscribeLocalApiStreamByUrl = vi.fn(
      async (_url: URL, onEvent: (event: { type: 'open' } | { type: 'message'; data: string }) => void) => {
        onEvent({ type: 'open' });
        onEvent({ type: 'message', data: '{"type":"tasks_snapshot","tasks":[]}' });
        return streamUnsubscribe;
      },
    );

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler({ subscribeLocalApiStreamByUrl });
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));
    fakeSocket.receive({ type: 'subscribe', id: 'req-1', path: '/api/app-events/events?initialSnapshotTopics=tasks' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeLocalApiStreamByUrl).toHaveBeenCalledOnce();
    expect(subscribeLocalApiStreamByUrl.mock.calls[0]?.[0].pathname).toBe('/api/app-events/events');
    expect(subscribeLocalApiStreamByUrl.mock.calls[0]?.[0].search).toBe('?initialSnapshotTopics=tasks');
    expect(subscribeDesktopLocalApiStreamByUrlMock).not.toHaveBeenCalled();

    const streamMessages = fakeSocket.sent.map((entry) => JSON.parse(entry)).filter((entry) => entry.type === 'stream');
    expect(streamMessages).toEqual([
      expect.objectContaining({ event: { type: 'open' } }),
      expect.objectContaining({ event: { type: 'message', data: '{"type":"tasks_snapshot","tasks":[]}' } }),
    ]);

    handleUpgrade.mockRestore();
  });

  it('subscribes conversation aggregates over the WebSocket protocol', async () => {
    const unsubscribe = vi.fn();
    let emitDelta: ((delta: { type: 'activity'; conversationId: string; revision: number; activity: unknown }) => void) | undefined;
    conversationAggregateMock.subscribeConversationAggregate.mockImplementation((input) => {
      emitDelta = input.onDelta;
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
    fakeSocket.receive({
      type: 'conversation_subscribe',
      id: 'conv-req-1',
      conversationId: 'conv-1',
      profile: 'shared',
      tailBlocks: 40,
      surfaceId: 'surface-1',
      surfaceType: 'desktop_web',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(conversationAggregateMock.readConversationAggregateState).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      profile: 'shared',
      tailBlocks: 40,
    });
    expect(conversationAggregateMock.subscribeConversationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        profile: 'shared',
        tailBlocks: 40,
        surface: { surfaceId: 'surface-1', surfaceType: 'desktop_web' },
      }),
    );
    const snapshot = fakeSocket.sent.map((entry) => JSON.parse(entry)).find((entry) => entry.type === 'conversation_snapshot');
    expect(snapshot).toMatchObject({ type: 'conversation_snapshot', id: 'conv-req-1', state: { conversationId: 'conv-1' } });

    emitDelta?.({
      type: 'activity',
      conversationId: 'conv-1',
      revision: 1,
      activity: { conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] },
    });
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).at(-1)).toMatchObject({
      type: 'conversation_delta',
      subscriptionId: snapshot.subscriptionId,
      delta: { type: 'activity', conversationId: 'conv-1', revision: 1 },
    });

    fakeSocket.receive({ type: 'unsubscribe', subscriptionId: snapshot.subscriptionId });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    handleUpgrade.mockRestore();
  });

  it('buffers conversation deltas emitted while the initial aggregate snapshot is loading', async () => {
    let resolveState: ((state: unknown) => void) | undefined;
    conversationAggregateMock.readConversationAggregateState.mockReturnValue(
      new Promise((resolve) => {
        resolveState = resolve;
      }),
    );
    conversationAggregateMock.subscribeConversationAggregate.mockImplementation((input) => {
      input.onDelta({
        type: 'activity',
        conversationId: 'conv-1',
        revision: 1,
        activity: { conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] },
      });
      return vi.fn();
    });

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler({ getRuntimeScope: () => 'profile-a' });
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));
    fakeSocket.receive({ type: 'conversation_subscribe', id: 'conv-req-1', conversationId: 'conv-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(conversationAggregateMock.subscribeConversationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', profile: 'profile-a' }),
    );
    expect(fakeSocket.sent.map((entry) => JSON.parse(entry)).find((entry) => entry.type === 'conversation_delta')).toBeUndefined();

    resolveState?.({
      conversationId: 'conv-1',
      revision: 0,
      updatedAt: '2026-06-23T00:00:00.000Z',
      conversation: { conversationId: 'conv-1', sessionDetail: null, liveSession: { live: false }, stream: {} },
      activity: { conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const messages = fakeSocket.sent.map((entry) => JSON.parse(entry));
    const snapshotIndex = messages.findIndex((entry) => entry.type === 'conversation_snapshot');
    const deltaIndex = messages.findIndex((entry) => entry.type === 'conversation_delta');
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(deltaIndex).toBeGreaterThan(snapshotIndex);
    expect(messages[deltaIndex]).toMatchObject({ delta: { type: 'activity', revision: 1 } });
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
    fakeSocket.receive({ type: 'subscribe', id: 'req-late', path: '/api/runs/run-1/events' });
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
