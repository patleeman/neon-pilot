import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import { type WebSocket, WebSocketServer } from 'ws';

import { type AppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import {
  closeTerminalSession,
  resizeTerminalSession,
  subscribeTerminalSession,
  writeTerminalSession,
  type TerminalSessionEvent,
} from '../extensions/terminalSessions.js';
import { type DesktopLocalApiStreamEvent, subscribeDesktopLocalApiStreamByUrl } from './localApiStreams.js';

export const DESKTOP_REALTIME_PATH = '/api/realtime';
export const DESKTOP_REALTIME_MAX_EVENT_BYTES = 256 * 1024;

type RealtimeServerMessage =
  | { type: 'connected' }
  | { type: 'app_event'; event: AppEvent }
  | { type: 'subscribed'; id?: string; subscriptionId: string }
  | { type: 'unsubscribed'; id?: string; subscriptionId: string }
  | { type: 'stream'; subscriptionId: string; event: DesktopLocalApiStreamEvent }
  | { type: 'terminal_attached'; id?: string; terminalId: string; pid?: number | null; replay: string; exited: boolean; exitCode: number | null }
  | { type: 'terminal'; terminalId: string; event: TerminalSessionEvent }
  | { type: 'error'; id?: string; message: string };

type RealtimeClientMessage = {
  type?: string;
  id?: string;
  path?: string;
  subscriptionId?: string;
  terminalId?: string;
  data?: string;
  cols?: number;
  rows?: number;
};

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
    const terminalSubscriptions = new Map<string, () => void>();
    const cleanup = () => {
      appUnsubscribe();
      for (const unsubscribe of streamSubscriptions.values()) unsubscribe();
      streamSubscriptions.clear();
      for (const unsubscribe of terminalSubscriptions.values()) unsubscribe();
      terminalSubscriptions.clear();
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

        if (message.type === 'terminal_attach') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          if (!terminalId) {
            writeRealtimeMessage(websocket, { type: 'error', id: message.id, message: 'Terminal id is required.' });
            return;
          }
          terminalSubscriptions.get(terminalId)?.();
          const attached = subscribeTerminalSession({ id: terminalId }, (event) => {
            writeRealtimeMessage(websocket, { type: 'terminal', terminalId, event });
          });
          if (!attached.ok) {
            writeRealtimeMessage(websocket, { type: 'error', id: message.id, message: 'Terminal not found or already closed.' });
            return;
          }
          terminalSubscriptions.set(terminalId, attached.unsubscribe);
          writeRealtimeMessage(websocket, {
            type: 'terminal_attached',
            id: message.id,
            terminalId,
            replay: attached.replay,
            exited: attached.exited,
            exitCode: attached.exitCode,
          });
          return;
        }

        if (message.type === 'terminal_input') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          const data = typeof message.data === 'string' ? message.data : '';
          if (!terminalId || !writeTerminalSession({ id: terminalId, data }).ok) {
            writeRealtimeMessage(websocket, { type: 'error', id: message.id, message: 'Terminal input failed.' });
          }
          return;
        }

        if (message.type === 'terminal_resize') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          const cols = typeof message.cols === 'number' ? message.cols : NaN;
          const rows = typeof message.rows === 'number' ? message.rows : NaN;
          if (!terminalId || !Number.isFinite(cols) || !Number.isFinite(rows) || !resizeTerminalSession({ id: terminalId, cols, rows }).ok) {
            writeRealtimeMessage(websocket, { type: 'error', id: message.id, message: 'Terminal resize failed.' });
          }
          return;
        }

        if (message.type === 'terminal_close') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          terminalSubscriptions.get(terminalId)?.();
          terminalSubscriptions.delete(terminalId);
          if (terminalId) closeTerminalSession({ id: terminalId });
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
