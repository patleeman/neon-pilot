import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import { type WebSocket, WebSocketServer } from 'ws';

import { type AppEvent, subscribeAppEvents } from '../shared/appEvents.js';

export const DESKTOP_REALTIME_PATH = '/api/realtime';
export const DESKTOP_REALTIME_MAX_EVENT_BYTES = 256 * 1024;

type RealtimeServerMessage = { type: 'connected' } | { type: 'app_event'; event: AppEvent } | { type: 'error'; message: string };

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
    writeRealtimeMessage(websocket, { type: 'connected' });
    const unsubscribe = subscribeAppEvents((event) => writeRealtimeMessage(websocket, { type: 'app_event', event }));
    websocket.on('close', unsubscribe);
    websocket.on('error', unsubscribe);
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
