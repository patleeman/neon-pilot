import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { dirname, join } from 'node:path';
import type { Duplex } from 'node:stream';

import { getStateRoot } from '@neon-pilot/core';
import { bindInProcessDaemonClient, NeonPilotDaemon } from '@neon-pilot/daemon';

import { loadRawLocalApiModule, type LocalApiModule } from '../local-api-module.js';
import { isDesktopAppEventBridgeMessage } from './local-backend-app-events.js';
import { proxyDesktopLocalApiStream } from './local-backend-stream-proxy.js';

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

interface NativeWorkbenchBrowserRequest {
  type: 'native-workbench-browser-request';
  id: string;
  method: 'isActive' | 'listTabs' | 'snapshot' | 'screenshot' | 'cdp';
  args: unknown[];
}

interface NativeWorkbenchBrowserResponse {
  type: 'native-workbench-browser-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface LocalApiRpcRequest {
  type: 'local-api-rpc-request';
  id: string;
  method: string;
  args?: unknown[];
}

interface LocalApiRpcResponse {
  type: 'local-api-rpc-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

let daemon: NeonPilotDaemon | undefined;
let clearDaemonBinding: (() => void) | undefined;
let daemonLogStream: WriteStream | undefined;
let localhostWebappProxy: Awaited<ReturnType<LocalApiModule['startDesktopLocalhostWebappProxy']>> | undefined;
let shuttingDown = false;
const nativeWorkbenchBrowserResponses = new Map<string, (message: NativeWorkbenchBrowserResponse) => void>();
const SHARED_CHILD_RUNTIME_SCOPE = 'shared';

function sendParentMessage(message: BackendReadyMessage | LocalApiRpcResponse | { type: 'fatal'; error: string }): void {
  if (typeof process.send === 'function') {
    process.send(message);
    return;
  }

  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendNativeWorkbenchBrowserRequest(method: NativeWorkbenchBrowserRequest['method'], args: unknown[]): Promise<unknown> {
  if (typeof process.send !== 'function') {
    return Promise.reject(new Error('Workbench Browser native bridge is unavailable.'));
  }

  const id = randomUUID();
  const message = {
    type: 'native-workbench-browser-request',
    id,
    method,
    args,
  } satisfies NativeWorkbenchBrowserRequest;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      nativeWorkbenchBrowserResponses.delete(id);
      reject(new Error(`Workbench Browser native bridge timed out for ${method}.`));
    }, 30_000);
    timeout.unref?.();

    nativeWorkbenchBrowserResponses.set(id, (response) => {
      clearTimeout(timeout);
      if (response.ok) {
        resolve(response.result);
      } else {
        reject(new Error(response.error || `Workbench Browser native bridge failed for ${method}.`));
      }
    });

    process.send?.(message);
  });
}

function installNativeWorkbenchBrowserBridge(localApi: LocalApiModule): void {
  localApi.setDesktopWorkbenchBrowserToolHost?.({
    isActive: async (conversationId) => Boolean(await sendNativeWorkbenchBrowserRequest('isActive', [conversationId])),
    listTabs: async () =>
      (await sendNativeWorkbenchBrowserRequest('listTabs', [])) as Array<{ sessionKey: string; url: string; title: string }>,
    snapshot: async (conversationId, tabId) => sendNativeWorkbenchBrowserRequest('snapshot', [conversationId, tabId]),
    screenshot: async (conversationId, tabId) => sendNativeWorkbenchBrowserRequest('screenshot', [conversationId, tabId]),
    cdp: async (input) => sendNativeWorkbenchBrowserRequest('cdp', [input]),
  });
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
  if (response.headersSent) {
    if (!response.writableEnded) response.end();
    return;
  }
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function writeLocalApiDispatchResponse(
  response: ServerResponse,
  result: Awaited<ReturnType<LocalApiModule['dispatchDesktopLocalApiRequest']>>,
): void {
  if (response.headersSent) {
    if (!response.writableEnded) response.end();
    return;
  }
  response.writeHead(result.statusCode, result.headers);
  response.end(Buffer.from(result.body));
}

function assertAuthorized(request: IncomingMessage, token: string): void {
  const auth = request.headers.authorization ?? '';
  if (auth !== `Bearer ${token}`) {
    throw new Error('Unauthorized');
  }
}

function isAuthorizedRealtimeUpgrade(request: IncomingMessage, token: string): boolean {
  const auth = request.headers.authorization ?? '';
  if (auth === `Bearer ${token}`) {
    return true;
  }

  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    return url.searchParams.get('realtimeToken') === token;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
  socket.write(`HTTP/1.1 ${String(statusCode)} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function isLocalApiRpcRequest(value: unknown): value is LocalApiRpcRequest {
  return (
    Boolean(value && typeof value === 'object') &&
    (value as { type?: unknown }).type === 'local-api-rpc-request' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

async function handleLocalApiRpcRequest(localApi: LocalApiModule, request: LocalApiRpcRequest): Promise<void> {
  try {
    const method = (localApi as unknown as Record<string, unknown>)[request.method];
    if (typeof method !== 'function') {
      throw new Error(`Unknown local API method: ${request.method}`);
    }
    const result = await method.apply(localApi, Array.isArray(request.args) ? request.args : []);
    sendParentMessage({ type: 'local-api-rpc-response', id: request.id, ok: true, result });
  } catch (error) {
    sendParentMessage({
      type: 'local-api-rpc-response',
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function startDaemon(): Promise<void> {
  const logPath = process.env.NEON_PILOT_DESKTOP_DAEMON_LOG_FILE?.trim() || join(getStateRoot(), 'desktop', 'logs', 'daemon.log');
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
  const closeStalledConnections = setTimeout(() => {
    server.closeAllConnections?.();
  }, 500);
  closeStalledConnections.unref?.();
  await new Promise<void>((resolve) =>
    server.close(() => {
      clearTimeout(closeStalledConnections);
      resolve();
    }),
  );
  await localhostWebappProxy?.close().catch(() => undefined);
  localhostWebappProxy = undefined;
  try {
    const { closeTraceWorker } = await import('../../server/traces/traceWorkerClient.js');
    closeTraceWorker();
  } catch {
    // Trace worker import is best-effort during shutdown.
  }
  await stopDaemon();
  process.exit(0);
}

async function main(): Promise<void> {
  const token = process.env.NEON_PILOT_BACKEND_TOKEN?.trim() || randomUUID();
  const extensionHostBaseUrl = process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL?.trim();
  const extensionHostToken = process.env.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim();
  await startDaemon();

  // ── Load the API module ────────────────────────────────────────────
  // loadRawLocalApiModule() imports localApi.js, the full local API handler
  // module. Keep this readiness signal scoped to the backend process; the
  // desktop shell warms the backend in the background and does not block its
  // first paint on this import.
  let localApiReady = false;
  let localApi: LocalApiModule | null = null;
  try {
    localApi = await loadRawLocalApiModule();
    localApi.configureDesktopExtensionHostClient({ baseUrl: extensionHostBaseUrl, token: extensionHostToken });
    await localApi.warmDesktopLocalApiRuntime();
    installNativeWorkbenchBrowserBridge(localApi);
    localApiReady = true;
    localhostWebappProxy = await localApi.startDesktopLocalhostWebappProxy({
      stateRoot: getStateRoot(),
      logger: {
        info: (message, fields) => process.stderr.write(`[desktop-backend] ${message} ${JSON.stringify(fields ?? {})}\n`),
        warn: (message, fields) => process.stderr.write(`[desktop-backend] ${message} ${JSON.stringify(fields ?? {})}\n`),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[desktop-backend] failed to load local API module: ${message}\n`);
    await stopDaemon();
    sendParentMessage({ type: 'fatal', error: `Failed to load local API module: ${message}` });
    process.exit(1);
  }

  const server = createServer((request, response) => {
    void (async () => {
      try {
        assertAuthorized(request, token);
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');

        if (request.method === 'GET' && url.pathname === '/health') {
          writeJson(response, 200, { ok: true, daemonHealthy: daemon?.isRunning() === true, apiReady: localApiReady });
          return;
        }

        if (!localApiReady) {
          writeJson(response, 503, { error: 'Backend initializing', retryAfter: 1 });
          return;
        }

        const api = localApi!;

        if (request.method === 'POST' && url.pathname === '/dispatch') {
          const abort = new AbortController();
          request.on('aborted', () => abort.abort());
          response.on('close', () => abort.abort());
          const body = await readRequestBody(request);
          if (!body.request) {
            throw new Error('Missing dispatch request.');
          }
          const result = await api.dispatchDesktopLocalApiRequest({ ...body.request, signal: abort.signal });
          writeLocalApiDispatchResponse(response, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/rpc') {
          const body = await readRequestBody(request);
          const methodName = String(body.method ?? '');
          const method = (api as unknown as Record<string, unknown>)[methodName];
          if (typeof method !== 'function') {
            throw new Error(`Unknown local API method: ${methodName}`);
          }
          const result = await (method as (...args: unknown[]) => unknown).apply(api, body.args ?? []);
          writeJson(response, 200, { ok: true, result });
          return;
        }

        if (request.method === 'GET' && url.pathname === '/stream') {
          const path = url.searchParams.get('path') ?? '';
          await proxyDesktopLocalApiStream(request, response, path, api.subscribeDesktopLocalApiStream.bind(api));
          return;
        }

        writeJson(response, 404, { error: 'Not found' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeJson(response, message === 'Unauthorized' ? 401 : 500, { error: message });
      }
    })();
  });
  const handleRealtimeUpgrade = localApi?.createDesktopLocalRealtimeUpgradeHandler({
    getRuntimeScope: () => SHARED_CHILD_RUNTIME_SCOPE,
    subscribeLocalApiStreamByUrl: async (url, onEvent) => {
      if (!localApi) {
        throw new Error('Local API is unavailable.');
      }
      return localApi.subscribeDesktopLocalApiStream(`${url.pathname}${url.search}`, (event) => {
        if (event.type === 'message') {
          onEvent({ type: 'message', data: event.data ?? '' });
        } else if (event.type === 'error') {
          onEvent({ type: 'error', message: event.message ?? 'Stream failed.' });
        } else if (event.type === 'open') {
          onEvent({ type: 'open' });
        } else if (event.type === 'close') {
          onEvent({ type: 'close' });
        }
      });
    },
  });
  server.on('upgrade', (request, socket, head) => {
    if (!isAuthorizedRealtimeUpgrade(request, token)) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }
    if (!localApiReady) {
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }
    handleRealtimeUpgrade?.(request, socket as Socket, head);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Backend child did not bind a TCP port.');
  }

  localApi?.setDesktopLocalBackendBaseUrl(`http://127.0.0.1:${String(address.port)}`);
  sendParentMessage({ type: 'ready', port: address.port, token });

  process.on('message', (message) => {
    if (message && typeof message === 'object' && (message as { type?: unknown }).type === 'native-workbench-browser-response') {
      const response = message as NativeWorkbenchBrowserResponse;
      nativeWorkbenchBrowserResponses.get(response.id)?.(response);
      nativeWorkbenchBrowserResponses.delete(response.id);
      return;
    }

    if (isLocalApiRpcRequest(message)) {
      if (localApi) void handleLocalApiRpcRequest(localApi, message);
      return;
    }

    if (isDesktopAppEventBridgeMessage(message)) {
      void localApi?.publishDesktopAppEventFromExtensionHost(message.event).catch((error) => {
        process.stderr.write(
          `[desktop-backend] failed to publish extension-host app event: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      });
      return;
    }

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
