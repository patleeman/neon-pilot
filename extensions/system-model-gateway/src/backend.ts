import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';

import {
  createModelGatewayResponse,
  DEFAULT_MODEL_GATEWAY_PORT,
  FAKE_MODEL_GATEWAY_MODEL_ID,
  listModelGatewayModels,
  modelGatewaySettingsFrom,
  type ModelGatewaySettings,
  type ModelGatewayStatus,
  type ResponsesRequest,
  streamModelGatewayResponseEvents,
} from '@neon-pilot/extensions/backend/modelGateway';

let server: Server | null = null;
let serverSettings: ModelGatewaySettings | null = null;
let lastError: string | undefined;

async function readSettings(ctx: ExtensionBackendContext): Promise<ModelGatewaySettings> {
  return modelGatewaySettingsFrom(await ctx.storage.get('settings'));
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

async function statusFor(ctx: ExtensionBackendContext, settings: ModelGatewaySettings): Promise<ModelGatewayStatus> {
  const models = (await listModelGatewayModels(ctx)).length;
  return {
    running: Boolean(server?.listening),
    host: settings.host,
    port: settings.port,
    baseUrl: `http://${settings.host}:${settings.port}/v1`,
    models,
    defaultModel: settings.defaultModel,
    ...(lastError ? { lastError } : {}),
  };
}

export async function status(_input: unknown, ctx: ExtensionBackendContext): Promise<ModelGatewayStatus> {
  return statusFor(ctx, await readSettings(ctx));
}

export async function start(input: unknown, ctx: ExtensionBackendContext): Promise<ModelGatewayStatus> {
  const requested = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const current = await readSettings(ctx);
  const next = await modelGatewaySettingsFrom({ ...current, ...requested });
  await writeSettings(ctx, next);
  await startLoopbackServer(ctx, next);
  return statusFor(ctx, next);
}

export async function stop(_input: unknown, ctx: ExtensionBackendContext): Promise<ModelGatewayStatus> {
  await stopLoopbackServer();
  return statusFor(ctx, await readSettings(ctx));
}

export async function smoke(_input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: boolean; response: unknown; status: ModelGatewayStatus }> {
  const settings = await readSettings(ctx);
  const response = await createModelGatewayResponse(ctx, { model: FAKE_MODEL_GATEWAY_MODEL_ID, input: 'smoke' }, settings);
  return { ok: response.status === 'completed', response, status: await statusFor(ctx, settings) };
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
  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, ...(await statusFor(ctx, settings)) });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/models') {
      sendJson(response, 200, { object: 'list', data: await listModelGatewayModels(ctx) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/responses') {
      const body = (await readBody(request)) as ResponsesRequest;
      if (body.stream === true) {
        sendSse(response);
        for await (const event of await streamModelGatewayResponseEvents(ctx, body, settings)) {
          response.write(`data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`);
        }
        response.end();
        return;
      }
      sendJson(response, 200, await createModelGatewayResponse(ctx, body, settings));
      return;
    }
    sendJson(response, 404, { error: { message: 'Route not found.' } });
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: { message: lastError } });
    } else {
      response.write(`data: ${JSON.stringify({ type: 'response.failed', response: { status: 'failed', error: { message: lastError } } })}\n\n`);
      response.write('data: [DONE]\n\n');
      response.end();
    }
  }
}
