import { buildDesktopWebSocketUrl } from '../client/endpoints';

function shouldUseNativeEventSource(): boolean {
  if (typeof window === 'undefined') return false;
  // Chromium cannot establish a WebSocket to the app host when the renderer is
  // served through Electron's custom neon-pilot://app protocol: ws://app is not
  // a resolvable network endpoint. The desktop protocol handler already adapts
  // text/event-stream requests to the same local API stream subscriptions, so
  // use native EventSource in that shell and keep WebSocket for HTTP origins.
  return window.location.protocol === 'neon-pilot:';
}

export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  readonly readyState: number;
  close(): void;
}

type RealtimeStreamEvent = { type: 'open' } | { type: 'message'; data?: string } | { type: 'error'; message?: string } | { type: 'close' };

type RealtimeMessage =
  | { type: 'connected' }
  | { type: 'subscribed'; id?: string; subscriptionId: string }
  | { type: 'unsubscribed'; id?: string; subscriptionId: string }
  | { type: 'stream'; subscriptionId: string; event: RealtimeStreamEvent }
  | { type: 'error'; id?: string; message: string };

class DesktopRealtimeEventSource implements EventSourceLike {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = DesktopRealtimeEventSource.CONNECTING;

  private readonly socket = new WebSocket(buildDesktopWebSocketUrl('/api/realtime'));
  private readonly requestId = `stream:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
  private subscriptionId: string | null = null;
  private closed = false;

  constructor(private readonly path: string) {
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ type: 'subscribe', id: this.requestId, path: this.path }));
    });
    this.socket.addEventListener('message', (event) => this.handleMessage(event));
    this.socket.addEventListener('error', () => {
      if (this.closed) return;
      this.readyState = DesktopRealtimeEventSource.CONNECTING;
      this.onerror?.(new Event('error'));
    });
    this.socket.addEventListener('close', () => {
      if (this.closed) return;
      this.readyState = DesktopRealtimeEventSource.CLOSED;
      this.onerror?.(new Event('error'));
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readyState = DesktopRealtimeEventSource.CLOSED;
    if (this.subscriptionId && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'unsubscribe', subscriptionId: this.subscriptionId }));
    }
    this.socket.close();
  }

  private handleMessage(event: MessageEvent): void {
    if (this.closed) return;

    let message: RealtimeMessage;
    try {
      message = JSON.parse(String(event.data)) as RealtimeMessage;
    } catch {
      this.onerror?.(new Event('error'));
      return;
    }

    if (message.type === 'subscribed' && message.id === this.requestId) {
      this.subscriptionId = message.subscriptionId;
      return;
    }

    if (message.type === 'error' && (!message.id || message.id === this.requestId)) {
      this.readyState = DesktopRealtimeEventSource.CONNECTING;
      this.onerror?.(new Event('error'));
      return;
    }

    if (message.type !== 'stream') return;
    if (!this.subscriptionId) this.subscriptionId = message.subscriptionId;
    if (message.subscriptionId !== this.subscriptionId) return;

    switch (message.event.type) {
      case 'open':
        this.readyState = DesktopRealtimeEventSource.OPEN;
        this.onopen?.(new Event('open'));
        return;
      case 'message':
        this.onmessage?.(new MessageEvent('message', { data: message.event.data ?? '' }));
        return;
      case 'error':
        this.readyState = DesktopRealtimeEventSource.CONNECTING;
        this.onerror?.(new Event('error'));
        return;
      case 'close':
        this.readyState = DesktopRealtimeEventSource.CLOSED;
        this.close();
        return;
    }
  }
}

class ClosingNativeEventSource implements EventSourceLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private readonly source: EventSource;
  private closed = false;

  constructor(path: string) {
    this.source = new EventSource(path);
    this.source.onopen = (event) => {
      if (!this.closed) this.onopen?.(event);
    };
    this.source.onmessage = (event) => {
      if (!this.closed) this.onmessage?.(event);
    };
    this.source.onerror = (event) => {
      if (this.closed) return;
      this.onerror?.(event);
      this.close();
    };
  }

  get readyState(): number {
    return this.closed ? EventSource.CLOSED : this.source.readyState;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.source.close();
  }
}

export function createDesktopAwareEventSource(path: string): EventSourceLike {
  if (shouldUseNativeEventSource()) {
    return new ClosingNativeEventSource(path);
  }
  return new DesktopRealtimeEventSource(path);
}
