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
  return hermesFetch<JsonRecord>(ctx, `/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });
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
