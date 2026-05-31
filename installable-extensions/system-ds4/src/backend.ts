import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const PROVIDER = 'ds4';
const MODEL_ID = 'deepseek-v4-flash';
const MODEL_REF = `${PROVIDER}/${MODEL_ID}`;
const BASE_URL = 'http://127.0.0.1:8000/v1';
const API_KEY = 'dsv4-local';
const DEFAULT_READ_LINES = 200;
const DEFAULT_SEARCH_RESULTS = 80;

type ToolResult = { content?: Array<{ type?: string; text?: string }>; details?: unknown; isError?: boolean };

function toolRuntime(ctx: ExtensionBackendContext) {
  return {
    runtimeScope: ctx.runtimeScope,
    repoRoot: ctx.runtime.getRepoRoot(),
    modelRef: MODEL_REF,
  };
}

function textFrom(result: ToolResult): string {
  const text = result.content
    ?.map((entry) => (entry.type === 'text' || !entry.type ? (entry.text ?? '') : ''))
    .filter(Boolean)
    .join('\n');
  return text || JSON.stringify(result.details ?? result, null, 2);
}

async function callHostTool(name: string, input: unknown, ctx: ExtensionBackendContext) {
  const { invokeToolByName } = await import('@neon-pilot/extensions/backend/tools');
  const result = (await invokeToolByName({
    name,
    input,
    runtime: toolRuntime(ctx),
    toolContext: ctx.toolContext,
  })) as ToolResult;
  return {
    text: textFrom(result),
    content: result.content ?? [{ type: 'text' as const, text: textFrom(result) }],
    ...(result.details !== undefined ? { details: result.details } : {}),
    ...(result.isError ? { isError: true } : {}),
  };
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readKey(ctx: ExtensionBackendContext): string {
  const id = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? 'global';
  return `read-state:${id}`;
}

async function rememberRead(ctx: ExtensionBackendContext, input: { path: string; startLine: number; count: number; whole?: boolean }) {
  if (input.whole) {
    await ctx.storage.delete(readKey(ctx));
    return;
  }
  await ctx.storage.put(readKey(ctx), {
    path: input.path,
    nextLine: input.startLine + input.count,
    count: input.count,
  });
}

export async function installProvider(_input: unknown, ctx: ExtensionBackendContext) {
  await ctx.models.saveProvider({
    provider: PROVIDER,
    baseUrl: BASE_URL,
    api: 'openai-completions',
    apiKey: API_KEY,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      supportsUsageInStreaming: true,
      maxTokensField: 'max_tokens',
      supportsStrictMode: false,
      thinkingFormat: 'deepseek',
      requiresReasoningContentOnAssistantMessages: true,
    },
  });
  const state = await ctx.models.saveProviderModel({
    provider: PROVIDER,
    modelId: MODEL_ID,
    name: 'DeepSeek V4 Flash (ds4.c local)',
    reasoning: true,
    input: ['text'],
    contextWindow: 100000,
    maxTokens: 384000,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
  });
  return { ok: true, provider: PROVIDER, model: MODEL_REF, state };
}

export async function status() {
  try {
    const response = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) {
      return { ok: true, reachable: false, status: response.status, baseUrl: BASE_URL, models: [] };
    }
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return {
      ok: true,
      reachable: true,
      baseUrl: BASE_URL,
      models: (body.data ?? []).map((model) => model.id).filter(Boolean),
    };
  } catch (error) {
    return {
      ok: true,
      reachable: false,
      baseUrl: BASE_URL,
      models: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function discover() {
  const current = await status();
  if (!current.reachable) return null;
  return {
    provider: PROVIDER,
    baseUrl: BASE_URL,
    api: 'openai-completions',
    apiKey: API_KEY,
    models: [
      {
        id: MODEL_ID,
        name: 'DeepSeek V4 Flash (ds4.c local)',
        reasoning: true,
        input: ['text'],
        contextWindow: 100000,
      },
    ],
  };
}

export async function bash(input: { command?: unknown; timeout_sec?: unknown }, ctx: ExtensionBackendContext) {
  const command = stringValue(input.command);
  if (!command) throw new Error('command is required.');
  return callHostTool(
    'bash',
    {
      command,
      ...(numeric(input.timeout_sec) ? { timeout: numeric(input.timeout_sec) } : {}),
    },
    ctx,
  );
}

export async function read(
  input: { path?: unknown; start_line?: unknown; max_lines?: unknown; whole?: unknown; raw?: unknown },
  ctx: ExtensionBackendContext,
) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  const startLine = Math.floor(numeric(input.start_line) ?? 1);
  const count = Math.floor(numeric(input.max_lines) ?? DEFAULT_READ_LINES);
  const whole = input.whole === true;
  const result = await callHostTool(
    'read',
    {
      path,
      ...(whole ? {} : { offset: startLine, limit: count }),
    },
    ctx,
  );
  await rememberRead(ctx, { path, startLine, count, whole });
  return result;
}

export async function more(input: { count?: unknown }, ctx: ExtensionBackendContext) {
  const state = await ctx.storage.get<{ path?: string; nextLine?: number; count?: number }>(readKey(ctx));
  const path = stringValue(state?.path);
  if (!path) throw new Error('No previous read is available for this conversation.');
  const count = Math.floor(numeric(input.count) ?? numeric(state?.count) ?? DEFAULT_READ_LINES);
  const startLine = Math.floor(numeric(state?.nextLine) ?? 1);
  const result = await callHostTool('read', { path, offset: startLine, limit: count }, ctx);
  await rememberRead(ctx, { path, startLine, count });
  return result;
}

export async function write(input: { path?: unknown; content?: unknown }, ctx: ExtensionBackendContext) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  if (typeof input.content !== 'string') throw new Error('content is required.');
  return callHostTool('write', { path, content: input.content }, ctx);
}

export async function edit(input: { path?: unknown; old?: unknown; new?: unknown }, ctx: ExtensionBackendContext) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  if (typeof input.old !== 'string') throw new Error('old is required.');
  if (typeof input.new !== 'string') throw new Error('new is required.');
  return callHostTool('edit', { path, edits: [{ oldText: input.old, newText: input.new }] }, ctx);
}

export async function search(
  input: {
    query?: unknown;
    path?: unknown;
    mode?: unknown;
    glob?: unknown;
    context?: unknown;
    max_results?: unknown;
    case_sensitive?: unknown;
  },
  ctx: ExtensionBackendContext,
) {
  const query = stringValue(input.query);
  if (!query) throw new Error('query is required.');
  const args = ['--line-number', '--with-filename', '--no-heading', '--color', 'never'];
  const contextLines = numeric(input.context);
  if (contextLines !== undefined) args.push('--context', String(Math.floor(contextLines)));
  if (input.case_sensitive !== true) args.push('--ignore-case');
  if (input.mode === 'literal') args.push('--fixed-strings');
  const glob = stringValue(input.glob);
  if (glob) args.push('--glob', glob);
  args.push(query, stringValue(input.path) ?? '.');

  try {
    const result = await ctx.shell.exec({
      command: 'rg',
      args,
      cwd: ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot(),
      timeoutMs: 30_000,
      maxBuffer: 512_000,
    });
    const maxResults = Math.floor(numeric(input.max_results) ?? DEFAULT_SEARCH_RESULTS);
    const lines = result.stdout.split('\n').filter(Boolean);
    const shown = lines.slice(0, maxResults);
    const suffix = lines.length > shown.length ? `\n... ${lines.length - shown.length} more matches truncated.` : '';
    const text = shown.length ? `${shown.join('\n')}${suffix}` : 'No matches.';
    return { text, content: [{ type: 'text' as const, text }], details: { command: 'rg', args, matches: lines.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/exit code 1|No such file|No matches/i.test(message)) {
      return { text: 'No matches.', content: [{ type: 'text' as const, text: 'No matches.' }], details: { command: 'rg', args } };
    }
    throw error;
  }
}

export function createDs4AgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    const activate = (ctx: {
      modelProfile?: { kind?: string; profile?: { id?: string; extensionId?: string } };
      getActiveTools?: () => string[];
      setActiveTools?: (toolNames: string[]) => void;
    }) => {
      if (ctx.modelProfile?.kind !== 'resolved' || ctx.modelProfile.profile?.id !== 'ds4-compatible') {
        return;
      }
      const active = ctx.getActiveTools?.() ?? [];
      const wanted = ['bash', 'read', 'more', 'write', 'edit', 'search'];
      ctx.setActiveTools?.([...new Set([...active, ...wanted])]);
    };

    pi.on('session_start', (_event, ctx) => activate(ctx));
    pi.on('model_select', (_event, ctx) => activate(ctx));
  };
}
