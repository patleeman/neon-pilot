import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  constructor(readonly url: string) {
    super();
  }
  send(payload: string): void {
    this.sent.push(payload);
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }
  receive(payload: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

describe('createDesktopAwareEventSource', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('subscribes to stream paths over the realtime WebSocket', async () => {
    const sockets: FakeWebSocket[] = [];
    vi.stubGlobal(
      'WebSocket',
      class extends FakeWebSocket {
        constructor(url: string) {
          super(url);
          sockets.push(this);
        }
      },
    );
    vi.stubGlobal('window', { location: { protocol: 'http:', host: '127.0.0.1:3000' } });

    const { createDesktopAwareEventSource } = await import('./desktopEventSource');
    const source = createDesktopAwareEventSource('/api/live-sessions/live-1/events');
    const onopen = vi.fn();
    const onmessage = vi.fn();
    source.onopen = onopen;
    source.onmessage = onmessage;

    const socket = sockets[0];
    expect(socket?.url).toBe('ws://127.0.0.1:3000/api/realtime');
    socket?.open();
    expect(JSON.parse(socket?.sent[0] ?? '{}')).toMatchObject({ type: 'subscribe', path: '/api/live-sessions/live-1/events' });

    socket?.receive({ type: 'stream', subscriptionId: 'sub-1', event: { type: 'open' } });
    socket?.receive({
      type: 'stream',
      subscriptionId: 'sub-1',
      event: { type: 'message', data: JSON.stringify({ type: 'snapshot', ok: true }) },
    });

    expect(onopen).toHaveBeenCalledTimes(1);
    expect(onmessage).toHaveBeenCalledTimes(1);
    expect(onmessage.mock.calls[0]?.[0]?.data).toBe(JSON.stringify({ type: 'snapshot', ok: true }));

    source.close();
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toMatchObject({ type: 'unsubscribe', subscriptionId: 'sub-1' });
  });
});
