import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeEventSource extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = FakeEventSource.CONNECTING;
  closed = false;
  constructor(readonly url: string) {
    super();
  }
  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
}

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

  it('uses native EventSource for the custom desktop app protocol', async () => {
    const sources: FakeEventSource[] = [];
    vi.stubGlobal(
      'EventSource',
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          sources.push(this);
        }
      },
    );
    vi.stubGlobal('window', { location: { protocol: 'neon-pilot:', host: 'app' } });

    const { createDesktopAwareEventSource } = await import('./desktopEventSource');
    const source = createDesktopAwareEventSource('/api/live-sessions/live-1/events');

    expect(sources[0]?.url).toBe('/api/live-sessions/live-1/events');
    source.close();
    expect(sources[0]?.closed).toBe(true);
  });

  it('closes custom-protocol EventSource streams after an error to stop native retry churn', async () => {
    const sources: FakeEventSource[] = [];
    vi.stubGlobal(
      'EventSource',
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          sources.push(this);
        }
      },
    );
    vi.stubGlobal('window', { location: { protocol: 'neon-pilot:', host: 'app' } });

    const { createDesktopAwareEventSource } = await import('./desktopEventSource');
    const source = createDesktopAwareEventSource('/api/app-events/events');
    const onerror = vi.fn();
    source.onerror = onerror;

    sources[0]?.onerror?.(new Event('error'));

    expect(onerror).toHaveBeenCalledTimes(1);
    expect(sources[0]?.closed).toBe(true);
    expect(source.readyState).toBe(FakeEventSource.CLOSED);
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

  it('dispatches named SSE events and preserves id and retry metadata over realtime streams', async () => {
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
    const source = createDesktopAwareEventSource('/api/extensions/system-terminal/routes/stream');
    const onupdate = vi.fn();
    source.addEventListener('update', onupdate);

    const socket = sockets[0];
    socket?.open();
    socket?.receive({
      type: 'stream',
      subscriptionId: 'sub-2',
      event: { type: 'open' },
    });
    socket?.receive({
      type: 'stream',
      subscriptionId: 'sub-2',
      event: { type: 'sse', event: 'update', id: 'evt-1', retry: 1200, data: 'ready' },
    });

    expect(onupdate).toHaveBeenCalledTimes(1);
    const event = onupdate.mock.calls[0]?.[0] as MessageEvent<string> & { retry?: number };
    expect(event.type).toBe('update');
    expect(event.data).toBe('ready');
    expect(event.lastEventId).toBe('evt-1');
    expect(event.retry).toBe(1200);
  });
});
