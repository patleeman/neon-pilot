import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type JsonRecord = Record<string, unknown>;

type HermesConfig = {
  baseUrl: string;
  apiKey?: string;
  sessionKey?: string;
};

type PublicHermesConfig = Omit<HermesConfig, 'apiKey'> & {
  hasApiKey: boolean;
};

const CONFIG_KEY = 'connection';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8642';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function readLooseString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function compactString(value: unknown, maxLength = 20_000): string | undefined {
  const text = readLooseString(value);
  if (text === undefined) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n\n[truncated]` : text;
}

function normalizeBaseUrl(value: unknown): string {
  const baseUrl = readString(value) ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, '');
}

function normalizeConfig(value: unknown): HermesConfig {
  const record = isRecord(value) ? value : {};
  return {
    baseUrl: normalizeBaseUrl(record.baseUrl),
    apiKey: readString(record.apiKey),
    sessionKey: readString(record.sessionKey),
  };
}

function publicConfig(config: HermesConfig): PublicHermesConfig {
  return {
    baseUrl: config.baseUrl,
    sessionKey: config.sessionKey,
    hasApiKey: Boolean(config.apiKey),
  };
}

async function loadConfig(ctx: ExtensionBackendContext): Promise<HermesConfig> {
  return normalizeConfig(await ctx.storage.get(CONFIG_KEY).catch(() => null));
}

function timeoutSignal(ms = 20_000): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

function buildHeaders(config: HermesConfig, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`);
  if (config.sessionKey) headers.set('X-Hermes-Session-Key', config.sessionKey);
  return headers;
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    const error = body.error;
    if (isRecord(error)) return readString(error.message) ?? fallback;
    return readString(body.message) ?? fallback;
  }
  return fallback;
}

async function hermesFetch<T>(ctx: ExtensionBackendContext, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const config = await loadConfig(ctx);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: buildHeaders(config, init.headers),
    signal: init.signal ?? timeoutSignal(init.timeoutMs),
  });

  const text = await response.text();
  const body = text ? tryParseJson(text) : {};
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, `Hermes request failed with HTTP ${response.status}.`));
  }
  return body as T;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function requiredString(value: unknown, label: string): string {
  const text = readString(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function encodedId(value: unknown, label = 'sessionId'): string {
  return encodeURIComponent(requiredString(value, label));
}

function compactMessage(value: unknown): JsonRecord | null {
  if (!isRecord(value)) return null;
  const content = compactString(value.content ?? value.text ?? value.output ?? value.response);
  const message: JsonRecord = {};
  for (const key of ['id', 'role', 'name', 'tool_name', 'timestamp', 'created_at']) {
    const text = compactString(value[key], 1000);
    if (text !== undefined) message[key] = text;
  }
  if (content !== undefined) message.content = content;
  const reasoning = compactString(value.reasoning ?? value.reasoning_content);
  if (reasoning !== undefined) message.reasoning = reasoning;
  if (!message.role) message.role = 'assistant';
  return Object.keys(message).length > 0 ? message : null;
}

function compactMessages(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(compactMessage).filter((message): message is JsonRecord => message !== null);
}

function compactChatResponse(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  const result: JsonRecord = {};
  for (const key of ['id', 'session_id', 'sessionId', 'object', 'status']) {
    const text = compactString(value[key], 1000);
    if (text !== undefined) result[key] = text;
  }

  const directMessage = compactMessage(value.message);
  const dataMessage = isRecord(value.data) ? compactMessage(value.data.message ?? value.data) : null;
  const textMessage = compactMessage({
    role: 'assistant',
    content: value.text ?? value.output ?? value.response,
    timestamp: value.timestamp ?? value.created_at,
  });

  const messages =
    compactMessages(value.messages).length > 0
      ? compactMessages(value.messages)
      : Array.isArray(value.data)
        ? compactMessages(value.data)
        : [];

  if (messages.length > 0) result.messages = messages;
  const message = directMessage ?? dataMessage ?? (messages.length === 0 ? textMessage : null);
  if (message) result.message = message;
  return result;
}

function compactRunResponse(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  const result: JsonRecord = {};
  for (const key of ['id', 'run_id', 'session_id', 'sessionId', 'object', 'status', 'model']) {
    const text = compactString(value[key], 1000);
    if (text !== undefined) result[key] = text;
  }
  const output = compactString(value.output ?? value.text ?? value.response);
  if (output !== undefined) {
    result.output = output;
    result.message = { role: 'assistant', content: output };
  }
  if (isRecord(value.error)) {
    result.error = {
      message: compactString(value.error.message ?? value.error, 2000) ?? 'Hermes run failed.',
    };
  } else {
    const error = compactString(value.error, 2000);
    if (error !== undefined) result.error = { message: error };
  }
  return result;
}

export async function readConfig(_input: unknown, ctx: ExtensionBackendContext) {
  return { config: publicConfig(await loadConfig(ctx)) };
}

export async function updateConfig(input: unknown, ctx: ExtensionBackendContext) {
  const current = await loadConfig(ctx);
  const patch = isRecord(input) ? input : {};
  const next: HermesConfig = {
    baseUrl: patch.baseUrl === undefined ? current.baseUrl : normalizeBaseUrl(patch.baseUrl),
    apiKey: patch.apiKey === undefined ? current.apiKey : readString(patch.apiKey),
    sessionKey: patch.sessionKey === undefined ? current.sessionKey : readString(patch.sessionKey),
  };
  await ctx.storage.put(CONFIG_KEY, next);
  ctx.ui.invalidate(['extensions:system-hermes-agent']);
  return { config: publicConfig(next) };
}

export async function health(_input: unknown, ctx: ExtensionBackendContext) {
  const config = await loadConfig(ctx);
  const [basic, detailed] = await Promise.allSettled([
    hermesFetch<JsonRecord>(ctx, '/health', { method: 'GET', timeoutMs: 4000 }),
    hermesFetch<JsonRecord>(ctx, '/health/detailed', { method: 'GET', timeoutMs: 5000 }),
  ]);
  return {
    config: publicConfig(config),
    ok: basic.status === 'fulfilled',
    basic: basic.status === 'fulfilled' ? basic.value : null,
    detailed: detailed.status === 'fulfilled' ? detailed.value : null,
    error: basic.status === 'rejected' ? (basic.reason instanceof Error ? basic.reason.message : String(basic.reason)) : null,
  };
}

export async function capabilities(_input: unknown, ctx: ExtensionBackendContext) {
  return hermesFetch<JsonRecord>(ctx, '/v1/capabilities', { method: 'GET', timeoutMs: 8000 });
}

export async function listSessions(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const limit = typeof record.limit === 'number' ? Math.max(1, Math.min(200, Math.floor(record.limit))) : 100;
  const offset = typeof record.offset === 'number' ? Math.max(0, Math.floor(record.offset)) : 0;
  const source = readString(record.source);
  return hermesFetch<JsonRecord>(
    ctx,
    `/api/sessions${query({ limit, offset, source, include_children: record.includeChildren === true })}`,
    { method: 'GET', timeoutMs: 10_000 },
  );
}

export async function createSession(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const body: JsonRecord = {};
  const title = readString(record.title);
  if (title) body.title = title;
  const id = readString(record.id) ?? readString(record.sessionId);
  if (id) body.id = id;
  return hermesFetch<JsonRecord>(ctx, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 10_000,
  });
}

export async function getMessages(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  return hermesFetch<JsonRecord>(ctx, `/api/sessions/${encodedId(record.sessionId)}/messages`, {
    method: 'GET',
    timeoutMs: 10_000,
  });
}

export async function sendMessage(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const sessionId = encodedId(record.sessionId);
  const message = requiredString(record.message ?? record.input, 'message');
  const body: JsonRecord = { input: message };
  const instructions = readString(record.instructions);
  if (instructions) body.instructions = instructions;
  const result = await hermesFetch<JsonRecord>(ctx, `/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });
  return compactChatResponse(result);
}

export async function startSessionRun(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const sessionId = requiredString(record.sessionId, 'sessionId');
  const message = requiredString(record.message ?? record.input, 'message');
  const body: JsonRecord = { input: message, session_id: sessionId };
  const instructions = readString(record.instructions);
  if (instructions) body.instructions = instructions;
  const result = await hermesFetch<JsonRecord>(ctx, '/v1/runs', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 10_000,
  });
  return compactRunResponse(result);
}

export async function getRun(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const runId = encodedId(record.runId, 'runId');
  const result = await hermesFetch<JsonRecord>(ctx, `/v1/runs/${runId}`, {
    method: 'GET',
    timeoutMs: 10_000,
  });
  return compactRunResponse(result);
}

export async function renameSession(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  return hermesFetch<JsonRecord>(ctx, `/api/sessions/${encodedId(record.sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: requiredString(record.title, 'title') }),
    timeoutMs: 10_000,
  });
}

export async function forkSession(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const body: JsonRecord = {};
  const title = readString(record.title);
  if (title) body.title = title;
  return hermesFetch<JsonRecord>(ctx, `/api/sessions/${encodedId(record.sessionId)}/fork`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 15_000,
  });
}

export async function deleteSession(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  return hermesFetch<JsonRecord>(ctx, `/api/sessions/${encodedId(record.sessionId)}`, {
    method: 'DELETE',
    timeoutMs: 10_000,
  });
}
