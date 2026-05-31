import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { extractReadableHtml, parseDuckDuckGoHtml } from '@neon-pilot/extensions/backend/webContent';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PROVIDER = 'ds4';
const MODEL_ID = 'deepseek-v4-flash';
const MODEL_REF = `${PROVIDER}/${MODEL_ID}`;
const BASE_URL = 'http://127.0.0.1:8000/v1';
const API_KEY = 'dsv4-local';
const DEFAULT_READ_LINES = 500;
const DEFAULT_SEARCH_RESULTS = 80;
const MAX_INLINE_TEXT_BYTES = 256 * 1024;

type ToolResult = { content?: Array<{ type?: string; text?: string }>; details?: unknown; isError?: boolean };
type ShellJob = {
  id: number;
  command: string;
  cwd: string;
  pid: number | null;
  startedAt: string;
  done: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  readOffset: number;
  kill: () => void;
};

let nextJobId = 1;
const shellJobs = new Map<number, ShellJob>();

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

function booleanValue(value: unknown): boolean {
  return value === true;
}

function cwdFor(ctx: ExtensionBackendContext): string {
  return ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot();
}

function resolveWorkspacePath(ctx: ExtensionBackendContext, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(cwdFor(ctx), target);
}

function trimLargeText(text: string): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= MAX_INLINE_TEXT_BYTES) return { text, truncated: false };
  let end = Math.min(text.length, MAX_INLINE_TEXT_BYTES);
  while (end > 0 && Buffer.byteLength(text.slice(0, end), 'utf8') > MAX_INLINE_TEXT_BYTES) end -= 1;
  return { text: `${text.slice(0, end)}\n\n[Truncated at ${MAX_INLINE_TEXT_BYTES} bytes]`, truncated: true };
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

function formatJobUpdate(job: ShellJob, options: { stopped?: boolean } = {}) {
  const newOutput = job.output.slice(job.readOffset);
  job.readOffset = job.output.length;
  const lines = [
    `bash job=${job.id} pid=${job.pid ?? 'unknown'} ${job.done ? 'finished' : options.stopped ? 'stopped' : 'running'}`,
    `command: ${job.command}`,
  ];
  if (job.done) lines.push(`exit: ${job.signal ? `signal ${job.signal}` : job.code ?? 'unknown'}`);
  lines.push('', newOutput.trimEnd() || '(no new output)');
  if (!job.done) lines.push('', `Use bash_status job=${job.id} to get new output; use bash_stop job=${job.id} to stop execution.`);
  return {
    text: lines.join('\n'),
    content: [{ type: 'text' as const, text: lines.join('\n') }],
    details: { job: job.id, pid: job.pid, running: !job.done, command: job.command, cwd: job.cwd },
  };
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function bash(input: { command?: unknown; timeout_sec?: unknown; refresh_sec?: unknown }, ctx: ExtensionBackendContext) {
  const command = stringValue(input.command);
  if (!command) throw new Error('command is required.');
  const refreshSeconds = numeric(input.refresh_sec);
  if (refreshSeconds !== undefined) {
    const cwd = cwdFor(ctx);
    const id = nextJobId++;
    let output = '';
    const handle = await ctx.shell.spawn({
      command: 'sh',
      args: ['-lc', command],
      cwd,
      onStdout: (chunk) => {
        output += chunk;
        const job = shellJobs.get(id);
        if (job) job.output = output;
      },
      onStderr: (chunk) => {
        output += chunk;
        const job = shellJobs.get(id);
        if (job) job.output = output;
      },
      onExit: ({ code, signal }) => {
        const job = shellJobs.get(id);
        if (!job) return;
        job.done = true;
        job.code = code;
        job.signal = signal;
        job.output = output;
      },
    });
    const job: ShellJob = {
      id,
      command,
      cwd,
      pid: handle.pid,
      startedAt: new Date().toISOString(),
      done: false,
      code: null,
      signal: null,
      output,
      readOffset: 0,
      kill: handle.kill,
    };
    shellJobs.set(id, job);
    await delay(Math.min(Math.floor(refreshSeconds * 1000), 30_000));
    job.output = output;
    return formatJobUpdate(job);
  }
  return callHostTool(
    'bash',
    {
      command,
      ...(numeric(input.timeout_sec) ? { timeout: numeric(input.timeout_sec) } : {}),
    },
    ctx,
  );
}

function readJob(input: { job?: unknown }): ShellJob {
  const id = Math.floor(numeric(input.job) ?? 0);
  const job = shellJobs.get(id);
  if (!job) throw new Error(`bash job not found: job=${id}`);
  return job;
}

export async function bash_status(input: { job?: unknown; refresh_sec?: unknown }, _ctx: ExtensionBackendContext) {
  const job = readJob(input);
  const refreshSeconds = numeric(input.refresh_sec);
  if (!job.done && refreshSeconds !== undefined) {
    await delay(Math.min(Math.floor(refreshSeconds * 1000), 30_000));
  }
  return formatJobUpdate(job);
}

export async function bash_stop(input: { job?: unknown }, _ctx: ExtensionBackendContext) {
  const job = readJob(input);
  if (!job.done) {
    job.kill();
    await delay(100);
  }
  return formatJobUpdate(job, { stopped: true });
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
  if (booleanValue(input.raw)) {
    const filePath = resolveWorkspacePath(ctx, path);
    const raw = await readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const selected = whole ? raw : lines.slice(Math.max(0, startLine - 1), Math.max(0, startLine - 1) + count).join('\n');
    const formatted = trimLargeText(selected);
    await rememberRead(ctx, { path, startLine, count, whole });
    return { text: formatted.text, content: [{ type: 'text' as const, text: formatted.text }], details: { path, raw: true, truncated: formatted.truncated } };
  }
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
  if (input.old.includes('[upto]')) {
    const filePath = resolveWorkspacePath(ctx, path);
    const original = await readFile(filePath, 'utf8');
    const parts = input.old.split('[upto]');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('old with [upto] must include non-empty unique head and tail anchors.');
    }
    const [head, tail] = parts as [string, string];
    const headIndex = original.indexOf(head);
    if (headIndex < 0 || original.indexOf(head, headIndex + head.length) >= 0) {
      throw new Error('old [upto] head anchor must match exactly once.');
    }
    const tailIndex = original.indexOf(tail, headIndex + head.length);
    if (tailIndex < 0 || original.indexOf(tail, tailIndex + tail.length) >= 0) {
      throw new Error('old [upto] tail anchor must match exactly once after the head anchor.');
    }
    const endIndex = tailIndex + tail.length;
    const updated = `${original.slice(0, headIndex)}${input.new}${original.slice(endIndex)}`;
    await writeFile(filePath, updated, 'utf8');
    const text = `Edited ${path} with [upto] anchor replacement.`;
    return { text, content: [{ type: 'text' as const, text }], details: { path, replaced: true, upto: true } };
  }
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

export async function list(input: { path?: unknown }, ctx: ExtensionBackendContext) {
  const target = stringValue(input.path);
  if (!target) throw new Error('path is required.');
  const dir = resolveWorkspacePath(ctx, target);
  const entries = await readdir(dir, { withFileTypes: true });
  const rows = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const kind = entry.isDirectory() ? 'dir ' : entry.isSymbolicLink() ? 'link' : 'file';
        const size = entry.isFile() ? (await stat(path.join(dir, entry.name))).size : null;
        return `${kind} ${size === null ? ''.padStart(9) : String(size).padStart(9)} ${entry.name}${entry.isDirectory() ? '/' : ''}`;
      }),
  );
  const text = rows.length ? rows.join('\n') : '(empty directory)';
  return { text, content: [{ type: 'text' as const, text }], details: { path: target, count: rows.length } };
}

export async function google_search(input: { query?: unknown; count?: unknown; page?: unknown }, ctx: ExtensionBackendContext) {
  const query = stringValue(input.query);
  if (!query) throw new Error('query is required.');
  const page = Math.max(1, Math.floor(numeric(input.page) ?? 1));
  const maxResults = Math.min(Math.max(Math.floor(numeric(input.count) ?? 5), 1), 20);
  const offset = (page - 1) * 20;
  const params = new URLSearchParams({ q: query });
  if (offset > 0) {
    params.set('s', String(offset));
    params.set('dc', String(offset + 1));
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
  };
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);
  let results = await parseDuckDuckGoHtml({ html: await response.text(), maxResults }, ctx);
  if (results.length === 0) {
    const lite = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!lite.ok) throw new Error(`Search failed: HTTP ${lite.status}`);
    results = await parseDuckDuckGoHtml({ html: await lite.text(), maxResults }, ctx);
  }
  const start = offset + 1;
  const text = results.length
    ? `Search | Page ${page} | Results ${start}-${start + results.length - 1}\n\n${results
        .map((result, index) => `--- Result ${start + index} ---\nTitle: ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}`)
        .join('\n\n')}`
    : `No results found for: ${query}`;
  return { text, content: [{ type: 'text' as const, text }], details: { query, page, count: results.length, source: 'duckduckgo' } };
}

export async function visit_page(input: { url?: unknown; raw?: unknown }, ctx: ExtensionBackendContext) {
  const url = stringValue(input.url);
  if (!url) throw new Error('url is required.');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Page fetch failed: HTTP ${response.status}`);
  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const text =
    booleanValue(input.raw) || !contentType.includes('html') ? body : (await extractReadableHtml({ html: body, url }, ctx)).markdown;
  const formatted = trimLargeText(text);
  return { text: formatted.text, content: [{ type: 'text' as const, text: formatted.text }], details: { url, contentType, truncated: formatted.truncated } };
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
      const wanted = ['google_search', 'visit_page', 'bash', 'bash_status', 'bash_stop', 'read', 'more', 'write', 'edit', 'search', 'list'];
      ctx.setActiveTools?.([...new Set([...active, ...wanted])]);
    };

    pi.on('session_start', (_event, ctx) => activate(ctx));
    pi.on('model_select', (_event, ctx) => activate(ctx));
  };
}
