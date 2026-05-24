import { buildDesktopWebSocketUrl } from '../client/endpoints';
import type { DesktopAppEvent } from '../shared/types';

interface DesktopRealtimeListener {
  onopen?: () => void;
  onevent?: (event: DesktopAppEvent) => void;
  onerror?: () => void;
  onclose?: () => void;
}

type DesktopRealtimeMessage = { type: 'connected' } | { type: 'app_event'; event: DesktopAppEvent } | { type: 'error'; message: string };

export function subscribeDesktopRealtimeAppEvents(listener: DesktopRealtimeListener): () => void {
  const socket = new WebSocket(buildDesktopWebSocketUrl('/api/realtime'));
  let closed = false;

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

  return () => {
    if (closed) return;
    closed = true;
    socket.close();
  };
}
