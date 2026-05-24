import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import { type WebSocket, WebSocketServer } from 'ws';

import { type AppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import { type DesktopLocalApiStreamEvent, subscribeDesktopLocalApiStreamByUrl } from './localApiStreams.js';

export const DESKTOP_REALTIME_PATH = '/api/realtime';
export const DESKTOP_REALTIME_MAX_EVENT_BYTES = 256 * 1024;

type RealtimeServerMessage =
  | { type: 'connected' }
  | { type: 'app_event'; event: AppEvent }
  | { type: 'subscribed'; id?: string; subscriptionId: string }
  | { type: 'unsubscribed'; id?: string; subscriptionId: string }
  | { type: 'stream'; subscriptionId: string; event: DesktopLocalApiStreamEvent }
  | { type: 'error'; id?: string; message: string };

type RealtimeClientMessage = { type?: string; id?: string; path?: string; subscriptionId?: string };

function writeRealtimeMessage(socket: WebSocket, message: RealtimeServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  const payload = JSON.stringify(message);
  if (Buffer.byteLength(payload, 'utf8') > DESKTOP_REALTIME_MAX_EVENT_BYTES) {
    socket.send(JSON.stringify({ type: 'error', message: 'Realtime event exceeded payload limit.' } satisfies RealtimeServerMessage));
    return;
  }
  socket.send(payload);
}

export function createDesktopRealtimeUpgradeHandler(): (request: IncomingMessage, socket: Socket, head: Buffer) => void {
  const server = new WebSocketServer({ noServer: true, maxPayload: DESKTOP_REALTIME_MAX_EVENT_BYTES });

  server.on('connection', (websocket) => {
    const streamSubscriptions = new Map<string, () => void>();
    const cleanup = () => {
      appUnsubscribe();
      for (const unsubscribe of streamSubscriptions.values()) unsubscribe();
      streamSubscriptions.clear();
    };
    const appUnsubscribe = subscribeAppEvents((event) => writeRealtimeMessage(websocket, { type: 'app_event', event }));

    writeRealtimeMessage(websocket, { type: 'connected' });

    websocket.on('message', (raw) => {
      void (async () => {
        let message: RealtimeClientMessage;
        try {
          message = JSON.parse(String(raw)) as RealtimeClientMessage;
        } catch {
          writeRealtimeMessage(websocket, { type: 'error', message: 'Invalid realtime message JSON.' });
          return;
        }

        if (message.type === 'unsubscribe') {
          const subscriptionId = typeof message.subscriptionId === 'string' ? message.subscriptionId : '';
          streamSubscriptions.get(subscriptionId)?.();
          streamSubscriptions.delete(subscriptionId);
          writeRealtimeMessage(websocket, { type: 'unsubscribed', id: message.id, subscriptionId });
          return;
        }

        if (message.type !== 'subscribe') {
          writeRealtimeMessage(websocket, { type: 'error', id: message.id, message: 'Unsupported realtime message type.' });
          return;
        }

        const path = typeof message.path === 'string' ? message.path : '';
        if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) {
          writeRealtimeMessage(websocket, {
            type: 'error',
            id: message.id,
            message: 'Realtime subscription path must be an absolute API path.',
          });
          return;
        }

        const subscriptionId = `rt:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
        try {
          const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(new URL(path, 'http://desktop.local'), (event) => {
            writeRealtimeMessage(websocket, { type: 'stream', subscriptionId, event });
          });
          streamSubscriptions.set(subscriptionId, unsubscribe);
          writeRealtimeMessage(websocket, { type: 'subscribed', id: message.id, subscriptionId });
        } catch (error) {
          writeRealtimeMessage(websocket, {
            type: 'error',
            id: message.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    });
    websocket.on('close', cleanup);
    websocket.on('error', cleanup);
  });

  return (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://desktop.local');
    if (url.pathname !== DESKTOP_REALTIME_PATH) {
      socket.destroy();
      return;
    }

    server.handleUpgrade(request, socket, head, (websocket) => {
      server.emit('connection', websocket, request);
    });
  };
}
