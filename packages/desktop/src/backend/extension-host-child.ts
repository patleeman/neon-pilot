import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createNetServer, type Socket } from 'node:net';
import { PassThrough, Writable } from 'node:stream';

import { setLocalBackendBaseUrl } from '../../server/app/localBackendBaseUrl.js';
import { createDesktopRealtimeUpgradeHandler } from '../../server/app/realtime.js';
import { setDefaultExtensionBackendWorkerUrl } from '../../server/extensions/extensionBackendWorkerClient.js';
import {
  createInProcessExtensionHostClient,
  handleInProcessExtensionHostRequest,
  setExtensionHostClient,
} from '../../server/extensions/extensionHostClient.js';
import type {
  ExtensionHostInvokeActionRequest,
  ExtensionHostInvokeProtocolEntrypointRequest,
  ExtensionHostInvokeRouteRequest,
  ExtensionHostRequest,
  ExtensionHostRouteResponse,
} from '../../server/extensions/extensionHostProtocol.js';
import { decodeExtensionHostProtocolFrame, encodeExtensionHostProtocolFrame } from '../../server/extensions/extensionHostProtocolFrames.js';

interface ExtensionHostReadyMessage {
  type: 'ready';
  port: number;
  token: string;
}

interface ExtensionHostRequestBody {
  request?: ExtensionHostRequest;
}

interface ExtensionHostRouteRequestBody {
  request?: Omit<ExtensionHostInvokeRouteRequest, 'type'>;
}

interface ExtensionHostActionRequestBody {
  request?: Omit<ExtensionHostInvokeActionRequest, 'type'>;
}

interface ExtensionHostProtocolRequestBody {
  request?: Omit<ExtensionHostInvokeProtocolEntrypointRequest, 'type' | 'stdio' | 'signal'>;
}

let shuttingDown = false;

function sendParentMessage(message: ExtensionHostReadyMessage | { type: 'fatal'; error: string }): void {
  if (typeof process.send === 'function') {
    process.send(message);
    return;
  }
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function assertAuthorized(request: IncomingMessage, token: string): void {
  const auth = request.headers.authorization ?? '';
  if (auth !== `Bearer ${token}`) {
    throw new Error('Unauthorized');
  }
}

function readRequestBody(request: IncomingMessage): Promise<ExtensionHostRequestBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as ExtensionHostRequestBody);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (response.headersSent) {
    if (!response.writableEnded) response.end();
    return;
  }
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function encodeRouteResponse(route: ExtensionHostRouteResponse): ExtensionHostRouteResponse {
  const body =
    route.body instanceof Uint8Array
      ? {
          __neonPilotEncoding: 'base64',
          data: Buffer.from(route.body).toString('base64'),
        }
      : route.body;
  return { ...route, ...(body === undefined ? {} : { body }) };
}

async function writeSseRouteResponse(response: ServerResponse, route: ExtensionHostRouteResponse): Promise<void> {
  response.writeHead(route.status ?? 200, {
    ...route.headers,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  try {
    for await (const event of route.events ?? []) {
      writeSseEvent(response, event);
    }
  } finally {
    response.end();
  }
}

function writeSseEvent(response: ServerResponse, event: { event?: string; data?: unknown; id?: string; retry?: number }): void {
  if (event.id) response.write(`id: ${event.id}\n`);
  if (event.event) response.write(`event: ${event.event}\n`);
  if (typeof event.retry === 'number') response.write(`retry: ${event.retry}\n`);
  const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data ?? null);
  for (const line of data.split(/\r?\n/)) response.write(`data: ${line}\n`);
  response.write('\n');
}

function writeProtocolFrame(socket: Socket, frame: Parameters<typeof encodeExtensionHostProtocolFrame>[0]): void {
  socket.write(encodeExtensionHostProtocolFrame(frame));
}

async function createProtocolChannel(request: ExtensionHostProtocolRequestBody['request']): Promise<{ port: number; token: string }> {
  if (!request) throw new Error('Missing extension host protocol request.');
  const token = randomUUID();
  const channelServer = createNetServer((socket) => {
    clearTimeout(connectionTimeout);
    const abort = new AbortController();
    const stdin = new PassThrough();
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        writeProtocolFrame(socket, { type: 'stdout', data: Buffer.from(chunk as Buffer).toString('base64') });
        callback();
      },
    });
    const stderr = new Writable({
      write(chunk, _encoding, callback) {
        writeProtocolFrame(socket, { type: 'stderr', data: Buffer.from(chunk as Buffer).toString('base64') });
        callback();
      },
    });
    let authenticated = false;
    let buffer = '';

    const closeChannel = () => {
      abort.abort();
      stdin.destroy();
      channelServer.close();
    };

    socket.setEncoding('utf8');
    socket.on('close', closeChannel);
    socket.on('error', closeChannel);
    socket.on('data', (chunk) => {
      try {
        buffer += chunk;
        for (;;) {
          const newline = buffer.indexOf('\n');
          if (newline < 0) break;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          const frame = decodeExtensionHostProtocolFrame(line);
          if (!authenticated) {
            if (frame.type !== 'stdin' || Buffer.from(frame.data, 'base64').toString('utf8') !== token) {
              socket.destroy(new Error('Unauthorized protocol channel.'));
              return;
            }
            authenticated = true;
            void handleInProcessExtensionHostRequest({
              type: 'invokeProtocolEntrypoint',
              ...request,
              stdio: { stdin, stdout, stderr },
              signal: abort.signal,
            }).then((result) => {
              if (result.ok) writeProtocolFrame(socket, { type: 'result' });
              else writeProtocolFrame(socket, { type: 'error', error: result.error });
              socket.end();
            });
            continue;
          }
          if (frame.type === 'stdin') stdin.write(Buffer.from(frame.data, 'base64'));
          else if (frame.type === 'stdinEnd') stdin.end();
          else if (frame.type === 'abort') abort.abort();
        }
      } catch (error) {
        socket.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
  const connectionTimeout = setTimeout(() => channelServer.close(), 30_000);
  connectionTimeout.unref?.();
  channelServer.maxConnections = 1;
  await new Promise<void>((resolve) => channelServer.listen(0, '127.0.0.1', () => resolve()));
  const address = channelServer.address();
  if (!address || typeof address === 'string') throw new Error('Extension host protocol channel did not bind a TCP port.');
  return { port: address.port, token };
}

async function shutdown(server: ReturnType<typeof createServer>): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  process.exit(0);
}

async function main(): Promise<void> {
  setDefaultExtensionBackendWorkerUrl(new URL('../../server/dist/extensions/extensionBackendWorker.js', import.meta.url));
  setExtensionHostClient(createInProcessExtensionHostClient());

  const token = process.env.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim() || randomUUID();
  const server = createServer((request, response) => {
    void (async () => {
      try {
        assertAuthorized(request, token);
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');

        if (request.method === 'GET' && url.pathname === '/health') {
          const result = await handleInProcessExtensionHostRequest({ type: 'health' });
          writeJson(response, result.ok ? 200 : 500, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/rpc') {
          const body = await readRequestBody(request);
          if (!body.request) {
            throw new Error('Missing extension host request.');
          }
          const result = await handleInProcessExtensionHostRequest(body.request);
          writeJson(response, result.ok ? 200 : 500, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/route') {
          const body = (await readRequestBody(request)) as ExtensionHostRouteRequestBody;
          if (!body.request) {
            throw new Error('Missing extension host route request.');
          }
          const abort = new AbortController();
          request.on('aborted', () => abort.abort());
          response.on('close', () => abort.abort());
          const result = await handleInProcessExtensionHostRequest({
            type: 'invokeRoute',
            ...body.request,
            request: {
              ...body.request.request,
              signal: abort.signal,
            },
          });
          if (!result.ok) {
            writeJson(response, 500, result);
            return;
          }
          if (!('route' in result)) {
            throw new Error('Extension host returned an invalid route response.');
          }
          if (result.route.stream === 'sse' && result.route.events) {
            await writeSseRouteResponse(response, result.route);
            return;
          }
          writeJson(response, result.route.status ?? 200, { ok: true, route: encodeRouteResponse(result.route) });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/action') {
          const body = (await readRequestBody(request)) as ExtensionHostActionRequestBody;
          if (!body.request) {
            throw new Error('Missing extension host action request.');
          }
          const abort = new AbortController();
          request.on('aborted', () => abort.abort());
          response.on('close', () => abort.abort());
          response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });
          const agentToolContext =
            body.request.agentToolContext &&
            typeof body.request.agentToolContext === 'object' &&
            !Array.isArray(body.request.agentToolContext)
              ? { ...(body.request.agentToolContext as Record<string, unknown>), signal: abort.signal }
              : { signal: abort.signal };
          const result = await handleInProcessExtensionHostRequest({
            type: 'invokeAction',
            ...body.request,
            agentToolContext,
            toolContext: {
              onUpdate: (update) => writeSseEvent(response, { event: 'update', data: update }),
            },
          });
          writeSseEvent(
            response,
            result.ok && 'result' in result ? { event: 'result', data: result.result } : { event: 'error', data: result },
          );
          response.end();
          return;
        }

        if (request.method === 'POST' && url.pathname === '/protocol/start') {
          const body = (await readRequestBody(request)) as ExtensionHostProtocolRequestBody;
          writeJson(response, 200, { ok: true, channel: await createProtocolChannel(body.request) });
          return;
        }

        writeJson(response, 404, { ok: false, error: 'Not found' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeJson(response, message === 'Unauthorized' ? 401 : 500, { ok: false, error: message });
      }
    })();
  });
  server.on('upgrade', createDesktopRealtimeUpgradeHandler());

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Extension host child did not bind a TCP port.');
  }

  const baseUrl = `http://127.0.0.1:${String(address.port)}`;
  setLocalBackendBaseUrl(baseUrl);
  process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL = baseUrl;
  process.env.NEON_PILOT_EXTENSION_HOST_TOKEN = token;
  sendParentMessage({ type: 'ready', port: address.port, token });

  process.on('message', (message) => {
    if (message && typeof message === 'object' && (message as { type?: unknown }).type === 'shutdown') {
      void shutdown(server);
    }
  });
  process.on('disconnect', () => {
    void shutdown(server);
  });
  process.on('SIGTERM', () => {
    void shutdown(server);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  sendParentMessage({ type: 'fatal', error: message });
  process.exit(1);
});
