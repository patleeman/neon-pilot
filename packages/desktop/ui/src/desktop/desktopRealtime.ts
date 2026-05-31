import { buildDesktopWebSocketUrl } from '../client/endpoints';
import type { DesktopAppEvent } from '../shared/types';
import { createDesktopAwareEventSource } from './desktopEventSource';

interface DesktopRealtimeListener {
  onopen?: () => void;
  onevent?: (event: DesktopAppEvent) => void;
  onerror?: () => void;
  onclose?: () => void;
}

type DesktopRealtimeMessage = { type: 'connected' } | { type: 'app_event'; event: DesktopAppEvent } | { type: 'error'; message: string };

function getTauriInvoke(): (<T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>) | null {
  if (typeof window === 'undefined') return null;
  return window.__TAURI_INTERNALS__?.invoke ?? null;
}

function shouldUseDesktopEventStream(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'neon-pilot:';
}

async function ensureTauriSidecarStarted(): Promise<void> {
  await getTauriInvoke()?.('start_js_sidecar').catch(() => undefined);
}

export function subscribeDesktopRealtimeAppEvents(listener: DesktopRealtimeListener): () => void {
  if (shouldUseDesktopEventStream()) {
    const source = createDesktopAwareEventSource('/api/app-events/events?initialSnapshotTopics=sessions,tasks,runs,daemon');
    source.onopen = () => listener.onopen?.();
    source.onmessage = (event) => {
      try {
        listener.onevent?.(JSON.parse(event.data) as DesktopAppEvent);
      } catch {
        listener.onerror?.();
      }
    };
    source.onerror = () => listener.onerror?.();
    return () => source.close();
  }

  let closed = false;
  let socket: WebSocket | null = null;

  const openSocket = () => {
    if (closed) return;
    socket = new WebSocket(buildDesktopWebSocketUrl('/api/realtime'));

    socket.addEventListener('open', () => listener.onopen?.());
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as DesktopRealtimeMessage;
        if (message.type === 'app_event') listener.onevent?.(message.event);
        if (message.type === 'error') listener.onerror?.();
      } catch {
        listener.onerror?.();
      }
    });
    socket.addEventListener('error', () => listener.onerror?.());
    socket.addEventListener('close', () => {
      if (closed) return;
      closed = true;
      listener.onclose?.();
    });
  };

  if (getTauriInvoke()) {
    void ensureTauriSidecarStarted().then(openSocket);
  } else {
    openSocket();
  }

  return () => {
    if (closed) return;
    closed = true;
    socket?.close();
  };
}
