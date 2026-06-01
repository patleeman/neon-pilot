import { createConnection } from 'node:net';

import type { ExtensionHostClient, ExtensionHostInvokeActionInput, ExtensionHostInvokeRouteInput } from './extensionHostClient.js';
import type {
  ExtensionHostActionInvokeResult,
  ExtensionHostInvokeProtocolEntrypointRequest,
  ExtensionHostRequest,
  ExtensionHostResponse,
  ExtensionHostRouteResponse,
  ExtensionHostRouteSseEvent,
} from './extensionHostProtocol.js';
import { decodeExtensionHostProtocolFrame, encodeExtensionHostProtocolFrame } from './extensionHostProtocolFrames.js';

export interface ExtensionHostRpcClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export function hasFunction(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasFunction(item, seen));
  return Object.values(value as Record<string, unknown>).some((item) => hasFunction(item, seen));
}

export function isWireableExtensionHostInvokeActionInput(input: ExtensionHostInvokeActionInput): boolean {
  const withoutSignal = { ...input };
  delete withoutSignal.signal;
  return (
    !hasFunction(withoutSignal.serverContext) &&
    !hasFunction(withoutSignal.serverContextSnapshot) &&
    !hasFunction(withoutSignal.toolContext) &&
    !hasFunction(withoutSignal.toolContextSnapshot) &&
    !hasFunction(withoutSignal.agentToolContext)
  );
}

function hasOnlyToolUpdateCallback(input: ExtensionHostInvokeActionInput): boolean {
  const toolContext = input.toolContext;
  if (!toolContext || typeof toolContext !== 'object') return false;
  const entries = Object.entries(toolContext);
  return entries.length === 1 && entries[0]?.[0] === 'onUpdate' && typeof entries[0]?.[1] === 'function';
}

function isWireableExtensionHostStreamingActionInput(input: ExtensionHostInvokeActionInput): boolean {
  if (!hasOnlyToolUpdateCallback(input)) return false;
  return (
    !hasFunction(input.serverContext) &&
    !hasFunction(input.serverContextSnapshot) &&
    !hasFunction(input.toolContextSnapshot) &&
    !hasFunction(input.agentToolContext)
  );
}

function isWireableExtensionHostInvokeRouteInput(input: Parameters<ExtensionHostClient['invokeRoute']>[0]): boolean {
  return !hasFunction(input.serverContext) && !hasFunction(input.serverContextSnapshot) && !hasFunction(stripRouteSignal(input).request);
}

function isWireableExtensionHostStartStartupActionsInput(input: Parameters<ExtensionHostClient['startStartupActions']>[0]): boolean {
  if (!input) return true;
  return !hasFunction(input.serverContext) && !hasFunction(input.serverContextSnapshot);
}

function assertWireableInvokeActionInput(input: ExtensionHostInvokeActionInput): void {
  if (!isWireableExtensionHostInvokeActionInput(input)) {
    throw new Error('Extension host RPC cannot carry function-bearing contexts; use capability channels before enabling this call path.');
  }
}

function assertWireableStartupActionsInput(input: Parameters<ExtensionHostClient['startStartupActions']>[0]): void {
  if (!isWireableExtensionHostStartStartupActionsInput(input)) {
    throw new Error('Extension host RPC cannot carry function-bearing startup contexts; pass a server context snapshot.');
  }
}

function assertWireableRouteInput(input: Parameters<ExtensionHostClient['invokeRoute']>[0]): void {
  if (!isWireableExtensionHostInvokeRouteInput(input)) {
    throw new Error('Extension host RPC cannot carry function-bearing route contexts; pass serializable route data.');
  }
}

function stripRouteSignal(input: ExtensionHostInvokeRouteInput): ExtensionHostInvokeRouteInput {
  const request = { ...input.request };
  delete request.signal;
  return { ...input, request };
}

function stripActionUpdateCallback(input: ExtensionHostInvokeActionInput): ExtensionHostInvokeActionInput {
  const request = { ...input };
  delete request.toolContext;
  delete request.signal;
  return request;
}

function decodeRouteResponse(route: ExtensionHostRouteResponse): ExtensionHostRouteResponse {
  const body = route.body;
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    (body as { __neonPilotEncoding?: unknown }).__neonPilotEncoding === 'base64' &&
    typeof (body as { data?: unknown }).data === 'string'
  ) {
    return { ...route, body: Uint8Array.from(Buffer.from((body as { data: string }).data, 'base64')) };
  }
  return route;
}

async function* parseSseEvents(response: Response): AsyncIterable<ExtensionHostRouteSseEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event: ExtensionHostRouteSseEvent = {};
  const flush = function* (): Iterable<ExtensionHostRouteSseEvent> {
    if ('data' in event || event.event || event.id || typeof event.retry === 'number') {
      yield event;
      event = {};
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (!line) {
          yield* flush();
          continue;
        }
        if (line.startsWith(':')) continue;
        const separator = line.indexOf(':');
        const field = separator >= 0 ? line.slice(0, separator) : line;
        const rawValue = separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : '';
        if (field === 'event') event.event = rawValue;
        else if (field === 'id') event.id = rawValue;
        else if (field === 'retry') {
          const retry = Number(rawValue);
          if (Number.isFinite(retry)) event.retry = retry;
        } else if (field === 'data') {
          event.data = typeof event.data === 'string' ? `${event.data}\n${rawValue}` : rawValue;
        }
      }
      if (done) break;
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}

export function createExtensionHostRpcClient(options: ExtensionHostRpcClientOptions): ExtensionHostClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const base = new URL(baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function send(request: ExtensionHostRequest, signal?: AbortSignal): Promise<ExtensionHostResponse> {
    const response = await fetchImpl(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
      signal,
    });
    const body = (await response.json()) as ExtensionHostResponse;
    if (!response.ok) {
      return { ok: false, error: !body.ok ? body.error : `Extension host RPC failed: ${String(response.status)}` };
    }
    return body;
  }

  async function sendRoute(input: ExtensionHostInvokeRouteInput): Promise<ExtensionHostRouteResponse> {
    const response = await fetchImpl(`${baseUrl}/route`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request: stripRouteSignal(input) }),
      signal: input.request.signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        stream: 'sse',
        events: parseSseEvents(response),
      };
    }
    const body = (await response.json()) as ExtensionHostResponse;
    if (!response.ok) {
      throw new Error(!body.ok ? body.error : `Extension host route failed: ${String(response.status)}`);
    }
    if (!body.ok) throw new Error(body.error);
    if (!('route' in body)) throw new Error('Extension host returned an invalid route response.');
    return decodeRouteResponse(body.route);
  }

  async function sendStreamingAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionHostActionInvokeResult> {
    const response = await fetchImpl(`${baseUrl}/action`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request: stripActionUpdateCallback(input) }),
      signal: input.signal,
    });
    if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
      const body = (await response.json()) as ExtensionHostResponse;
      return { ok: false, error: !body.ok ? body.error : `Extension host action failed: ${String(response.status)}` };
    }
    let finalResult: ExtensionHostActionInvokeResult | undefined;
    for await (const event of parseSseEvents(response)) {
      if (event.event === 'update') {
        input.toolContext?.onUpdate?.(
          (typeof event.data === 'string' ? JSON.parse(event.data) : event.data) as Parameters<NonNullable<typeof input.toolContext.onUpdate>>[0],
        );
      } else if (event.event === 'result') {
        finalResult = typeof event.data === 'string' ? (JSON.parse(event.data) as ExtensionHostActionInvokeResult) : (event.data as ExtensionHostActionInvokeResult);
      } else if (event.event === 'error') {
        const message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        finalResult = { ok: false, error: message };
      }
    }
    return finalResult ?? { ok: false, error: 'Extension host action stream ended without a result.' };
  }

  async function sendProtocolEntrypoint(input: Omit<ExtensionHostInvokeProtocolEntrypointRequest, 'type'>): Promise<void> {
    const { signal, stdio, ...request } = input;
    const response = await fetchImpl(`${baseUrl}/protocol/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
      signal,
    });
    const body = (await response.json()) as { ok?: boolean; channel?: { port?: unknown; token?: unknown }; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? `Extension host protocol start failed: ${String(response.status)}`);
    const port = body.channel?.port;
    const token = body.channel?.token;
    if (typeof port !== 'number' || typeof token !== 'string') throw new Error('Extension host returned an invalid protocol channel.');

    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: base.hostname, port });
      let settled = false;
      let buffer = '';
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        stdio.stdin.off('data', onStdinData);
        stdio.stdin.off('end', onStdinEnd);
        signal.removeEventListener('abort', onAbort);
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };
      const sendFrame = (frame: Parameters<typeof encodeExtensionHostProtocolFrame>[0]) => {
        if (!socket.destroyed) socket.write(encodeExtensionHostProtocolFrame(frame));
      };
      const onStdinData = (chunk: Buffer | string) => {
        sendFrame({ type: 'stdin', data: Buffer.from(chunk).toString('base64') });
      };
      const onStdinEnd = () => sendFrame({ type: 'stdinEnd' });
      const onAbort = () => {
        sendFrame({ type: 'abort' });
        finish(new Error('Extension protocol entrypoint aborted.'));
      };

      socket.setEncoding('utf8');
      socket.on('connect', () => {
        sendFrame({ type: 'stdin', data: Buffer.from(token).toString('base64') });
        stdio.stdin.on('data', onStdinData);
        stdio.stdin.once('end', onStdinEnd);
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      });
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
            if (frame.type === 'stdout') stdio.stdout.write(Buffer.from(frame.data, 'base64'));
            else if (frame.type === 'stderr') stdio.stderr.write(Buffer.from(frame.data, 'base64'));
            else if (frame.type === 'result') finish();
            else if (frame.type === 'error') finish(new Error(frame.error));
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
      socket.on('error', (error) => finish(error));
      socket.on('close', () => finish(new Error('Extension host protocol channel closed before completion.')));
    });
  }

  return {
    async health() {
      const response = await send({ type: 'health' });
      if (!response.ok) throw new Error(response.error);
      if (!('status' in response)) throw new Error('Extension host returned an invalid health response.');
      return { status: response.status };
    },
    async checkBackendHealth() {
      const response = await send({ type: 'checkBackendHealth' });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid backend health response.');
      return response.results;
    },
    async invokeAction(input) {
      if (isWireableExtensionHostStreamingActionInput(input)) {
        return sendStreamingAction(input);
      }
      assertWireableInvokeActionInput(input);
      const request = { ...input };
      delete request.signal;
      const response = await send({ type: 'invokeAction', ...request }, input.signal);
      if (!response.ok) return { ok: false, error: response.error };
      if (!('result' in response)) return { ok: false, error: 'Extension host returned an invalid action response.' };
      return response.result;
    },
    async installSubscriptions(input) {
      assertWireableStartupActionsInput(input);
      const response = await send({ type: 'installSubscriptions', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async uninstallSubscriptions(extensionId) {
      const response = await send({ type: 'uninstallSubscriptions', extensionId });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async invokeProtocolEntrypoint(input) {
      return sendProtocolEntrypoint(input);
    },
    async invokeRoute(input) {
      assertWireableRouteInput(input);
      return sendRoute(input);
    },
    async listActionTelemetry(extensionId) {
      const response = await send({ type: 'listActionTelemetry', ...(extensionId ? { extensionId } : {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('telemetry' in response)) throw new Error('Extension host returned an invalid telemetry response.');
      return response.telemetry;
    },
    async reloadBackend(input) {
      const response = await send({ type: 'reloadBackend', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('reload' in response)) throw new Error('Extension host returned an invalid reload response.');
      return response.reload;
    },
    async runSelfTest(input) {
      const response = await send({ type: 'runSelfTest', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('selfTest' in response)) throw new Error('Extension host returned an invalid self-test response.');
      return response.selfTest;
    },
    async startStartupActions(input) {
      assertWireableStartupActionsInput(input);
      const response = await send({ type: 'startStartupActions', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid startup actions response.');
      return response.results;
    },
    async publishEvent(source, payload) {
      const response = await send({ type: 'publishEvent', source, payload });
      if (!response.ok) throw new Error(response.error);
      if (!('published' in response)) throw new Error('Extension host returned an invalid publish response.');
    },
  };
}
