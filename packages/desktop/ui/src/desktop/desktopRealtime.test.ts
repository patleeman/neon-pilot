import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;

  constructor(readonly url: string) {
    super();
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
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
    vi.unstubAllGlobals();
  });

  it('connects Tauri dev renderers to the JS sidecar realtime socket', async () => {
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
    const invoke = vi.fn().mockResolvedValue({ running: true, ready: { port: 48123, token: 'token' } });
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost:5173' },
      __TAURI_INTERNALS__: { invoke },
    });

    const { subscribeDesktopRealtimeAppEvents } = await import('./desktopRealtime');
    const onopen = vi.fn();
    const onevent = vi.fn();
    const unsubscribe = subscribeDesktopRealtimeAppEvents({ onopen, onevent });

    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    expect(invoke).toHaveBeenCalledWith('start_js_sidecar');
    expect(sockets[0]?.url).toBe('ws://127.0.0.1:48123/api/realtime');

    sockets[0]?.open();
    sockets[0]?.receive({ type: 'app_event', event: { type: 'sessions_changed' } });

    expect(onopen).toHaveBeenCalledTimes(1);
    expect(onevent).toHaveBeenCalledWith({ type: 'sessions_changed' });

    unsubscribe();
    expect(sockets[0]?.readyState).toBe(FakeWebSocket.CLOSED);
  });
});
