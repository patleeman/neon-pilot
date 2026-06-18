import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import { type WebSocket, WebSocketServer } from 'ws';

import { type AppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import { isTrustedOrigin, resolveRequestOrigin } from '../shared/webSecurity.js';
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

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTrustedRealtimeUpgrade(request: IncomingMessage): boolean {
  const headers = request.headers ?? {};
  const origin = readHeaderValue(headers.origin);
  if (typeof origin !== 'string' || origin.trim().length === 0) {
    return true;
  }

  const host = readHeaderValue(headers.host);
  const forwardedHost = readHeaderValue(headers['x-forwarded-host']);
  const forwardedProto = readHeaderValue(headers['x-forwarded-proto']);
  const protocol = (request.socket as Socket & { encrypted?: boolean }).encrypted ? 'https' : 'http';
  return isTrustedOrigin(
    origin,
    resolveRequestOrigin({
      host,
      forwardedHost,
      protocol,
      forwardedProto,
    }),
  );
}

export function createDesktopRealtimeUpgradeHandler(): (request: IncomingMessage, socket: Socket, head: Buffer) => void {
  const server = new WebSocketServer({ noServer: true, maxPayload: DESKTOP_REALTIME_MAX_EVENT_BYTES });

  server.on('connection', (websocket) => {
    const streamSubscriptions = new Map<string, () => void>();
    const terminalSubscriptions = new Map<string, () => void>();
    let cleanedUp = false;
    const sendRealtimeMessage = (message: RealtimeServerMessage) => {
      if (cleanedUp) {
        return;
      }

      writeRealtimeMessage(websocket, message);
    };
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      appUnsubscribe();
      for (const unsubscribe of streamSubscriptions.values()) unsubscribe();
      streamSubscriptions.clear();
      for (const unsubscribe of terminalSubscriptions.values()) unsubscribe();
      terminalSubscriptions.clear();
    };
    const appUnsubscribe = subscribeAppEvents((event) => sendRealtimeMessage({ type: 'app_event', event }));

    sendRealtimeMessage({ type: 'connected' });

    websocket.on('message', (raw) => {
      void (async () => {
        let message: RealtimeClientMessage;
        try {
          message = JSON.parse(String(raw)) as RealtimeClientMessage;
        } catch {
          sendRealtimeMessage({ type: 'error', message: 'Invalid realtime message JSON.' });
          return;
        }

        if (message.type === 'unsubscribe') {
          const subscriptionId = typeof message.subscriptionId === 'string' ? message.subscriptionId : '';
          streamSubscriptions.get(subscriptionId)?.();
          streamSubscriptions.delete(subscriptionId);
          sendRealtimeMessage({ type: 'unsubscribed', id: message.id, subscriptionId });
          return;
        }

        if (message.type === 'terminal_attach') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          if (!terminalId) {
            sendRealtimeMessage({ type: 'error', id: message.id, message: 'Terminal id is required.' });
            return;
          }
          terminalSubscriptions.get(terminalId)?.();
          const attached = subscribeTerminalSession({ id: terminalId }, (event) => {
            sendRealtimeMessage({ type: 'terminal', terminalId, event });
          });
          if (!attached.ok) {
            sendRealtimeMessage({ type: 'error', id: message.id, message: 'Terminal not found or already closed.' });
            return;
          }
          terminalSubscriptions.set(terminalId, attached.unsubscribe);
          sendRealtimeMessage({
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
            sendRealtimeMessage({ type: 'error', id: message.id, message: 'Terminal input failed.' });
          }
          return;
        }

        if (message.type === 'terminal_resize') {
          const terminalId = typeof message.terminalId === 'string' ? message.terminalId : '';
          const cols = typeof message.cols === 'number' ? message.cols : NaN;
          const rows = typeof message.rows === 'number' ? message.rows : NaN;
          if (!terminalId || !Number.isFinite(cols) || !Number.isFinite(rows) || !resizeTerminalSession({ id: terminalId, cols, rows }).ok) {
            sendRealtimeMessage({ type: 'error', id: message.id, message: 'Terminal resize failed.' });
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
          sendRealtimeMessage({ type: 'error', id: message.id, message: 'Unsupported realtime message type.' });
          return;
        }

        const path = typeof message.path === 'string' ? message.path : '';
        if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) {
          sendRealtimeMessage({
            type: 'error',
            id: message.id,
            message: 'Realtime subscription path must be an absolute API path.',
          });
          return;
        }

        const subscriptionId = `rt:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
        try {
          const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(new URL(path, 'http://desktop.local'), (event) => {
            sendRealtimeMessage({ type: 'stream', subscriptionId, event });
          });
          if (cleanedUp || websocket.readyState !== websocket.OPEN) {
            unsubscribe();
            return;
          }
          streamSubscriptions.set(subscriptionId, unsubscribe);
          sendRealtimeMessage({ type: 'subscribed', id: message.id, subscriptionId });
        } catch (error) {
          if (cleanedUp) return;
          sendRealtimeMessage({
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
    if (!isTrustedRealtimeUpgrade(request)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    server.handleUpgrade(request, socket, head, (websocket) => {
      server.emit('connection', websocket, request);
    });
  };
}
