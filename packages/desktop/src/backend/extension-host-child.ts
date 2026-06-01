import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleInProcessExtensionHostRequest } from '../../server/extensions/extensionHostClient.js';
import type {
  ExtensionHostInvokeActionRequest,
  ExtensionHostInvokeRouteRequest,
  ExtensionHostRequest,
  ExtensionHostRouteResponse,
} from '../../server/extensions/extensionHostProtocol.js';

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

async function shutdown(server: ReturnType<typeof createServer>): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  process.exit(0);
}

async function main(): Promise<void> {
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
          request.on('close', () => abort.abort());
          response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });
          const agentToolContext =
            body.request.agentToolContext && typeof body.request.agentToolContext === 'object' && !Array.isArray(body.request.agentToolContext)
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
          writeSseEvent(response, result.ok && 'result' in result ? { event: 'result', data: result.result } : { event: 'error', data: result });
          response.end();
          return;
        }

        writeJson(response, 404, { ok: false, error: 'Not found' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeJson(response, message === 'Unauthorized' ? 401 : 500, { ok: false, error: message });
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Extension host child did not bind a TCP port.');
  }

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
