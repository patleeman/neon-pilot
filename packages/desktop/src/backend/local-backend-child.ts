import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';
import { bindInProcessDaemonClient, NeonPilotDaemon } from '@neon-pilot/daemon';

import { loadRawLocalApiModule, type LocalApiModule } from '../local-api-module.js';

interface BackendReadyMessage {
  type: 'ready';
  port: number;
  token: string;
}

interface BackendRequestBody {
  method?: string;
  args?: unknown[];
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  };
}

let daemon: NeonPilotDaemon | undefined;
let clearDaemonBinding: (() => void) | undefined;
let daemonLogStream: WriteStream | undefined;
let shuttingDown = false;

function sendParentMessage(message: BackendReadyMessage | { type: 'fatal'; error: string }): void {
  if (typeof process.send === 'function') {
    process.send(message);
    return;
  }

  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function readRequestBody(request: IncomingMessage): Promise<BackendRequestBody> {
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
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as BackendRequestBody);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function writeLocalApiDispatchResponse(
  response: ServerResponse,
  result: Awaited<ReturnType<LocalApiModule['dispatchDesktopLocalApiRequest']>>,
): void {
  response.writeHead(result.statusCode, result.headers);
  response.end(Buffer.from(result.body));
}

function assertAuthorized(request: IncomingMessage, token: string): void {
  const auth = request.headers.authorization ?? '';
  if (auth !== `Bearer ${token}`) {
    throw new Error('Unauthorized');
  }
}

async function startDaemon(): Promise<void> {
  const logPath = join(getStateRoot(), 'desktop', 'logs', 'daemon.log');
  mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
  const logStream = createWriteStream(logPath, { flags: 'a', encoding: 'utf-8' });
  logStream.on('error', () => undefined);

  const nextDaemon = new NeonPilotDaemon({
    stopRequestBehavior: 'reject',
    logSink: (line) => {
      logStream.write(`${line}\n`);
    },
  });

  try {
    await nextDaemon.start();
  } catch (error) {
    await nextDaemon.stop().catch(() => undefined);
    await new Promise<void>((resolve) => logStream.end(resolve));
    throw error;
  }

  clearDaemonBinding = bindInProcessDaemonClient(nextDaemon);
  daemonLogStream = logStream;
  daemon = nextDaemon;
}

async function stopDaemon(): Promise<void> {
  clearDaemonBinding?.();
  clearDaemonBinding = undefined;
  if (daemon) {
    await daemon.stop().catch(() => undefined);
    daemon = undefined;
  }
  if (daemonLogStream) {
    const stream = daemonLogStream;
    daemonLogStream = undefined;
    await new Promise<void>((resolve) => stream.end(resolve));
  }
}

async function shutdown(server: ReturnType<typeof createServer>): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopDaemon();
  process.exit(0);
}

async function main(): Promise<void> {
  const token = process.env.NEON_PILOT_BACKEND_TOKEN?.trim() || randomUUID();
  await startDaemon();
  const localApi = await loadRawLocalApiModule();

  const server = createServer((request, response) => {
    void (async () => {
      try {
        assertAuthorized(request, token);
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');

        if (request.method === 'GET' && url.pathname === '/health') {
          writeJson(response, 200, { ok: true, daemonHealthy: daemon?.isRunning() === true });
          return;
        }

        if (request.method === 'POST' && url.pathname === '/dispatch') {
          const body = await readRequestBody(request);
          if (!body.request) {
            throw new Error('Missing dispatch request.');
          }
          const result = await localApi.dispatchDesktopLocalApiRequest(body.request);
          writeLocalApiDispatchResponse(response, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/rpc') {
          const body = await readRequestBody(request);
          const methodName = String(body.method ?? '');
          const method = (localApi as unknown as Record<string, unknown>)[methodName];
          if (typeof method !== 'function') {
            throw new Error(`Unknown local API method: ${methodName}`);
          }
          const result = await (method as (...args: unknown[]) => unknown).apply(localApi, body.args ?? []);
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (request.method === 'GET' && url.pathname === '/stream') {
          const path = url.searchParams.get('path') ?? '';
          response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          const unsubscribe = await localApi.subscribeDesktopLocalApiStream(path, (event) => {
            response.write(`event: ${event.type}\n`);
            if ('data' in event && typeof event.data === 'string') {
              response.write(`data: ${event.data}\n`);
            } else if ('message' in event && typeof event.message === 'string') {
              response.write(`data: ${JSON.stringify({ message: event.message })}\n`);
            }
            response.write('\n');
          });
          request.on('close', () => unsubscribe());
          return;
        }

        writeJson(response, 404, { error: 'Not found' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeJson(response, message === 'Unauthorized' ? 401 : 500, { error: message });
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Backend child did not bind a TCP port.');
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
