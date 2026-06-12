import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDesktopAwareEventSourceMock = vi.fn();

vi.mock('./desktopEventSource', () => ({
  createDesktopAwareEventSource: createDesktopAwareEventSourceMock,
}));

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

describe('subscribeDesktopRealtimeAppEvents', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('ignores late EventSource callbacks after unsubscribe on the desktop protocol path', async () => {
    vi.stubGlobal('window', { location: { protocol: 'neon-pilot:' } });
    const close = vi.fn();
    const source: {
      onopen: (() => void) | null;
      onmessage: ((event: MessageEvent<string>) => void) | null;
      onerror: (() => void) | null;
      close: () => void;
    } = {
      onopen: null,
      onmessage: null,
      onerror: null,
      close,
    };
    createDesktopAwareEventSourceMock.mockReturnValue(source);

    const { subscribeDesktopRealtimeAppEvents } = await import('./desktopRealtime');
    const listener = {
      onopen: vi.fn(),
      onevent: vi.fn(),
      onerror: vi.fn(),
    };

    const unsubscribe = subscribeDesktopRealtimeAppEvents(listener);
    unsubscribe();

    source.onopen?.();
    source.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'invalidate', topics: ['tasks'] }) }));
    source.onerror?.();

    expect(close).toHaveBeenCalledTimes(1);
    expect(listener.onopen).not.toHaveBeenCalled();
    expect(listener.onevent).not.toHaveBeenCalled();
    expect(listener.onerror).not.toHaveBeenCalled();
  });

  it('ignores late WebSocket callbacks after unsubscribe on the browser path', async () => {
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

    const { subscribeDesktopRealtimeAppEvents } = await import('./desktopRealtime');
    const listener = {
      onopen: vi.fn(),
      onevent: vi.fn(),
      onerror: vi.fn(),
      onclose: vi.fn(),
    };

    const unsubscribe = subscribeDesktopRealtimeAppEvents(listener);
    const socket = sockets[0];
    unsubscribe();

    socket?.open();
    socket?.receive({ type: 'app_event', event: { type: 'invalidate', topics: ['tasks'] } });
    socket?.dispatchEvent(new Event('error'));
    socket?.dispatchEvent(new Event('close'));

    expect(listener.onopen).not.toHaveBeenCalled();
    expect(listener.onevent).not.toHaveBeenCalled();
    expect(listener.onerror).not.toHaveBeenCalled();
    expect(listener.onclose).not.toHaveBeenCalled();
  });
});
