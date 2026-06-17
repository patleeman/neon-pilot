import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';

import {
  createModelGatewayResponse,
  installModelGatewayCodexConfig,
  listModelGatewayModels,
  modelGatewaySettingsFrom,
  readModelGatewayCodexConfigStatus,
  removeModelGatewayCodexConfig,
  type ModelGatewaySettings,
  type ModelGatewayStatus,
  type ResponsesRequest,
  streamModelGatewayResponseEvents,
  writeModelGatewayCatalog,
} from '@neon-pilot/extensions/backend/modelGateway';

let server: Server | null = null;
let serverSettings: ModelGatewaySettings | null = null;
let lastError: string | undefined;

interface GatewayLogEntry {
  id: string;
  at: string;
  method: string;
  path: string;
  status: number;
  model?: string;
  durationMs: number;
  error?: string;
}

interface GatewayState extends ModelGatewayStatus {
  logs: GatewayLogEntry[];
}

const logs: GatewayLogEntry[] = [];
const MAX_LOGS = 80;

async function readSettings(ctx: ExtensionBackendContext): Promise<ModelGatewaySettings> {
  const settings = await modelGatewaySettingsFrom(await ctx.storage.get('settings'));
  if (settings.authToken) return settings;
  const next = { ...settings, authToken: randomBytes(32).toString('base64url') };
  await writeSettings(ctx, next);
  return next;
}

async function writeSettings(ctx: ExtensionBackendContext, settings: ModelGatewaySettings): Promise<void> {
  await ctx.storage.put('settings', settings);
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): ExtensionRouteResponse {
  return {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
    body,
  };
}

function errorResponse(error: unknown, status = 500): ExtensionRouteResponse {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse(status, { error: { message } });
}

function sseEvent(data: unknown) {
  return { data };
}

function appendLog(entry: Omit<GatewayLogEntry, 'id' | 'at'>): void {
  logs.unshift({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  });
  logs.splice(MAX_LOGS);
}

async function statusFor(ctx: ExtensionBackendContext, settings: ModelGatewaySettings, input?: unknown): Promise<GatewayState> {
  const models = (await listModelGatewayModels(ctx)).length;
  const catalogPath = await writeModelGatewayCatalog(ctx);
  const codexConfig = await readModelGatewayCodexConfigStatus(ctx, input);
  return {
    running: Boolean(server?.listening),
    host: settings.host,
    port: settings.port,
    baseUrl: `http://${settings.host}:${settings.port}/v1`,
    authToken: settings.authToken,
    models,
    defaultModel: settings.defaultModel,
    catalogPath,
    codexConfig,
    logs: [...logs],
    ...(lastError ? { lastError } : {}),
  };
}

async function loopbackHealthFor(ctx: ExtensionBackendContext, settings: ModelGatewaySettings): Promise<Omit<GatewayState, 'authToken'>> {
  const { authToken: _authToken, ...state } = await statusFor(ctx, settings);
  return state;
}

async function ensureLoopbackServer(ctx: ExtensionBackendContext): Promise<GatewayState> {
  const settings = await readSettings(ctx);
  try {
    await startLoopbackServer(ctx, settings);
  } catch {
    // Keep the extension manageable from Settings when the desired port is already in use.
  }
  return statusFor(ctx, settings);
}

export async function status(_input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  return statusFor(ctx, await readSettings(ctx), _input);
}

export async function updateSettings(input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  const requested = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const current = await readSettings(ctx);
  const next = await modelGatewaySettingsFrom({ ...current, ...requested });
  await writeSettings(ctx, next);
  await startLoopbackServer(ctx, next);
  return statusFor(ctx, next);
}

export async function clearLogs(_input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  logs.splice(0);
  return statusFor(ctx, await readSettings(ctx));
}

export async function installCodexConfig(input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  await installModelGatewayCodexConfig(ctx, await readSettings(ctx), input);
  return statusFor(ctx, await readSettings(ctx), input);
}

export async function removeCodexConfig(input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  await removeModelGatewayCodexConfig(ctx, input);
  return statusFor(ctx, await readSettings(ctx), input);
}

export async function startGatewayService(_input: unknown, ctx: ExtensionBackendContext): Promise<GatewayState> {
  return ensureLoopbackServer(ctx);
}

export async function gatewayServiceHealth(_input: unknown, ctx: ExtensionBackendContext): Promise<Record<string, unknown>> {
  const state = await statusFor(ctx, await readSettings(ctx));
  return {
    ok: true,
    listenerRunning: state.running,
    ...(state.lastError ? { lastError: state.lastError } : {}),
  };
}

export async function stopGatewayService(_input: unknown, _ctx: ExtensionBackendContext): Promise<{ running: false }> {
  await stopLoopbackServer();
  return { running: false };
}

export async function healthRoute(_request: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  return jsonResponse(200, { ok: true, ...(await statusFor(ctx, await readSettings(ctx))) });
}

export async function modelsRoute(_request: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  return jsonResponse(200, { object: 'list', data: await listModelGatewayModels(ctx) });
}

export async function responsesRoute(request: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  try {
    const settings = await readSettings(ctx);
    const body = (request.body ?? {}) as ResponsesRequest;
    if (body.stream === true) {
      return {
        status: 200,
        stream: 'sse',
        events: routeSseEvents(ctx, body, settings),
      };
    }
    return jsonResponse(200, await createModelGatewayResponse(ctx, body, settings));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function responsesStreamRoute(request: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  const settings = await readSettings(ctx);
  const body = (request.body ?? {}) as ResponsesRequest;
  return {
    status: 200,
    stream: 'sse',
    events: routeSseEvents(ctx, { ...body, stream: true }, settings),
  };
}

async function* routeSseEvents(ctx: ExtensionBackendContext, body: ResponsesRequest, settings: ModelGatewaySettings) {
  try {
    for await (const event of await streamModelGatewayResponseEvents(ctx, body, settings)) {
      yield sseEvent(event);
    }
  } catch (error) {
    yield sseEvent({
      type: 'response.failed',
      response: {
        object: 'response',
        status: 'failed',
        error: { message: error instanceof Error ? error.message : String(error) },
      },
    });
    yield sseEvent('[DONE]');
  }
}

async function startLoopbackServer(ctx: ExtensionBackendContext, settings: ModelGatewaySettings): Promise<void> {
  if (server?.listening && serverSettings?.host === settings.host && serverSettings.port === settings.port) {
    return;
  }
  await stopLoopbackServer();
  lastError = undefined;
  serverSettings = settings;
  server = createServer((request, response) => {
    void handleHttpRequest(request, response, ctx, settings);
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      lastError = error.message;
      reject(error);
    };
    server?.once('error', onError);
    server?.listen(settings.port, settings.host, () => {
      server?.off('error', onError);
      resolve();
    });
  });
}

async function stopLoopbackServer(): Promise<void> {
  const active = server;
  server = null;
  serverSettings = null;
  if (!active?.listening) return;
  await new Promise<void>((resolve, reject) => {
    active.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendUnauthorized(response: ServerResponse): void {
  response.writeHead(401, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'WWW-Authenticate': 'Bearer',
  });
  response.end(JSON.stringify({ error: { message: 'Missing or invalid bearer token.' } }));
}

function bearerTokenFrom(request: IncomingMessage): string | null {
  const value = request.headers.authorization;
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}

function hasValidBearerToken(request: IncomingMessage, settings: ModelGatewaySettings): boolean {
  const received = bearerTokenFrom(request);
  if (!received || !settings.authToken) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(settings.authToken);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function sendSse(response: ServerResponse): void {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  ctx: ExtensionBackendContext,
  settings: ModelGatewaySettings,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${settings.host}:${settings.port}`);
  const started = Date.now();
  let statusCode = 404;
  let requestModel: string | undefined;
  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      statusCode = 200;
      lastError = undefined;
      sendJson(response, 200, { ok: true, ...(await loopbackHealthFor(ctx, settings)) });
      return;
    }
    if (url.pathname.startsWith('/v1/') && !hasValidBearerToken(request, settings)) {
      statusCode = 401;
      sendUnauthorized(response);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/models') {
      statusCode = 200;
      lastError = undefined;
      sendJson(response, 200, { object: 'list', data: await listModelGatewayModels(ctx) });
      return;
    }
    if (request.method === 'POST' && (url.pathname === '/v1/responses' || url.pathname === '/v1/responses/stream')) {
      const body = (await readBody(request)) as ResponsesRequest;
      requestModel = typeof body.model === 'string' ? body.model : undefined;
      if (body.stream === true || url.pathname === '/v1/responses/stream') {
        statusCode = 200;
        lastError = undefined;
        sendSse(response);
        for await (const event of await streamModelGatewayResponseEvents(ctx, { ...body, stream: true }, settings)) {
          response.write(`data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`);
        }
        response.end();
        return;
      }
      statusCode = 200;
      lastError = undefined;
      sendJson(response, 200, await createModelGatewayResponse(ctx, body, settings));
      return;
    }
    statusCode = 404;
    sendJson(response, 404, { error: { message: 'Route not found.' } });
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    statusCode = 500;
    if (!response.headersSent) {
      sendJson(response, 500, { error: { message: lastError } });
    } else {
      response.write(`data: ${JSON.stringify({ type: 'response.failed', response: { status: 'failed', error: { message: lastError } } })}\n\n`);
      response.write('data: [DONE]\n\n');
      response.end();
    }
  } finally {
    appendLog({
      method: request.method ?? 'GET',
      path: url.pathname,
      status: statusCode,
      ...(requestModel ? { model: requestModel } : {}),
      durationMs: Date.now() - started,
      ...(statusCode >= 500 && lastError ? { error: lastError } : {}),
    });
  }
}
