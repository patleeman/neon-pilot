import type { DesktopAppEvent } from '../shared/types';
import { openDesktopRealtimeSocket } from './desktopRealtimeConnection';

interface DesktopRealtimeListener {
  onopen?: () => void;
  onevent?: (event: DesktopAppEvent) => void;
  onerror?: () => void;
  onclose?: () => void;
}

type DesktopRealtimeMessage = { type: 'connected' } | { type: 'app_event'; event: DesktopAppEvent } | { type: 'error'; message: string };

export function subscribeDesktopRealtimeAppEvents(listener: DesktopRealtimeListener): () => void {
  let closed = false;
  let socket: WebSocket | null = null;

  void openDesktopRealtimeSocket()
    .then((nextSocket) => {
      if (closed) {
        nextSocket.close();
        return;
      }
      socket = nextSocket;
      let openNotified = false;
      const notifyOpen = () => {
        if (closed) return;
        if (openNotified) return;
        openNotified = true;
        listener.onopen?.();
      };
      nextSocket.addEventListener('open', notifyOpen);
      nextSocket.addEventListener('message', (event) => {
        if (closed) return;
        try {
          const message = JSON.parse(String(event.data)) as DesktopRealtimeMessage;
          if (message.type === 'app_event') listener.onevent?.(message.event);
          if (message.type === 'error') listener.onerror?.();
        } catch {
          listener.onerror?.();
        }
      });
      nextSocket.addEventListener('error', () => {
        if (closed) return;
        listener.onerror?.();
      });
      nextSocket.addEventListener('close', () => {
        if (closed) return;
        closed = true;
        listener.onclose?.();
      });
      if (nextSocket.readyState === WebSocket.OPEN) {
        notifyOpen();
      }
    })
    .catch(() => {
      if (closed) return;
      listener.onerror?.();
    });

  return () => {
    if (closed) return;
    closed = true;
    socket?.close();
  };
}
