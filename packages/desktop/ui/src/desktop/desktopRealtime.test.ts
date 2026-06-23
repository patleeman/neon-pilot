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

describe('subscribeDesktopRealtimeAppEvents', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the desktop environment realtime URL for custom protocol renderers', async () => {
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
    vi.stubGlobal('window', {
      location: { protocol: 'neon-pilot:', host: 'app' },
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({ realtimeUrl: 'ws://127.0.0.1:4123/api/realtime' }),
      },
    });

    const { subscribeDesktopRealtimeAppEvents } = await import('./desktopRealtime');
    const listener = {
      onopen: vi.fn(),
      onevent: vi.fn(),
      onerror: vi.fn(),
    };

    const unsubscribe = subscribeDesktopRealtimeAppEvents(listener);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const socket = sockets[0];
    expect(socket?.url).toBe('ws://127.0.0.1:4123/api/realtime');

    socket?.open();
    socket?.receive({ type: 'app_event', event: { type: 'invalidate', topics: ['tasks'] } });

    expect(listener.onopen).toHaveBeenCalledTimes(1);
    expect(listener.onevent).toHaveBeenCalledWith({ type: 'invalidate', topics: ['tasks'] });
    expect(listener.onerror).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies open once when the realtime socket is already open before listeners attach', async () => {
    const sockets: FakeWebSocket[] = [];
    vi.stubGlobal(
      'WebSocket',
      class extends FakeWebSocket {
        constructor(url: string) {
          super(url);
          this.readyState = FakeWebSocket.OPEN;
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
    };

    const unsubscribe = subscribeDesktopRealtimeAppEvents(listener);
    await new Promise((resolve) => setTimeout(resolve, 0));
    sockets[0]?.open();

    expect(listener.onopen).toHaveBeenCalledTimes(1);
    unsubscribe();
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
