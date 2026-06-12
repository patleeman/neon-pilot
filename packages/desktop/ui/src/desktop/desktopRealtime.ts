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

function shouldUseDesktopEventStream(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'neon-pilot:';
}

export function subscribeDesktopRealtimeAppEvents(listener: DesktopRealtimeListener): () => void {
  if (shouldUseDesktopEventStream()) {
    const source = createDesktopAwareEventSource('/api/app-events/events?initialSnapshotTopics=sessions,tasks,runs,daemon');
    let closed = false;
    source.onopen = () => {
      if (closed) return;
      listener.onopen?.();
    };
    source.onmessage = (event) => {
      if (closed) return;
      try {
        listener.onevent?.(JSON.parse(event.data) as DesktopAppEvent);
      } catch {
        listener.onerror?.();
      }
    };
    source.onerror = () => {
      if (closed) return;
      listener.onerror?.();
    };
    return () => {
      if (closed) return;
      closed = true;
      source.close();
    };
  }

  const socket = new WebSocket(buildDesktopWebSocketUrl('/api/realtime'));
  let closed = false;

  socket.addEventListener('open', () => {
    if (closed) return;
    listener.onopen?.();
  });
  socket.addEventListener('message', (event) => {
    if (closed) return;
    try {
      const message = JSON.parse(String(event.data)) as DesktopRealtimeMessage;
      if (message.type === 'app_event') listener.onevent?.(message.event);
      if (message.type === 'error') listener.onerror?.();
    } catch {
      listener.onerror?.();
    }
  });
  socket.addEventListener('error', () => {
    if (closed) return;
    listener.onerror?.();
  });
  socket.addEventListener('close', () => {
    if (closed) return;
    closed = true;
    listener.onclose?.();
  });

  return () => {
    if (closed) return;
    closed = true;
    socket.close();
  };
}
