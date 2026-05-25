import vm from 'node:vm';

import type { AgentToolResult, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type CodeModeContext = ExtensionContext & {
  cwd?: string;
  runtimeScope?: string;
  modelProfile?: { kind?: string; profile?: { id?: string } };
  getActiveTools?: () => string[];
  setActiveTools?: (toolNames: string[]) => void;
};

interface ExecCodeInput {
  code?: unknown;
  timeoutMs?: unknown;
}

interface ToolSummary {
  name: string;
  title?: string;
  description: string;
  inputSchema?: unknown;
  parameters?: unknown;
  source?: unknown;
}

interface CodeModeState {
  enabled: boolean;
  active: boolean | null;
  pending: boolean;
  running: boolean | null;
  toolNames?: string[];
  updatedAt?: string;
}

const CODE_TOOL_NAME = 'exec_code';
const METADATA_NAMESPACE = 'system-code-mode';
const DEFAULT_TOOL_NAMES = ['read', 'bash', 'edit', 'write'];
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const contexts = new Map<string, vm.Context>();

function sessionKey(ctx: CodeModeContext): string {
  return ctx.sessionManager?.getSessionId?.() ?? 'shared';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function conversationIdFrom(input: unknown, ctx: ExtensionBackendContext): string {
  const explicit = isRecord(input) && typeof input.conversationId === 'string' ? input.conversationId.trim() : '';
  const conversationId = explicit || ctx.toolContext?.conversationId?.trim() || ctx.toolContext?.sessionId?.trim();
  if (!conversationId) throw new Error('conversationId required');
  return conversationId;
}

function normalizePersistedState(value: unknown): { enabled: boolean; updatedAt?: string } {
  if (!isRecord(value)) return { enabled: false };
  return {
    enabled: value.enabled === true,
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
  };
}

function normalizeToolNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((toolName): toolName is string => typeof toolName === 'string' && toolName.trim().length > 0);
}

async function readLiveState(
  conversationId: string,
  ctx: ExtensionBackendContext,
): Promise<{ running: boolean | null; toolNames?: string[] }> {
  try {
    const detail = await ctx.conversations.get(conversationId);
    if (!isRecord(detail)) return { running: null };
    return {
      running: typeof detail.running === 'boolean' ? detail.running : null,
      toolNames: normalizeToolNames(detail.toolNames),
    };
  } catch {
    return { running: null };
  }
}

function toCodeModeState(
  persisted: { enabled: boolean; updatedAt?: string },
  live: { running: boolean | null; toolNames?: string[] },
): CodeModeState {
  const active = live.toolNames ? live.toolNames.length === 1 && live.toolNames[0] === CODE_TOOL_NAME : null;
  return {
    ...persisted,
    active,
    pending: persisted.enabled && active !== true,
    running: live.running,
    ...(live.toolNames ? { toolNames: live.toolNames } : {}),
  };
}

export async function readState(input: unknown, ctx: ExtensionBackendContext): Promise<CodeModeState> {
  const conversationId = conversationIdFrom(input, ctx);
  const persisted = normalizePersistedState(await ctx.conversations.metadata.get({ conversationId, namespace: METADATA_NAMESPACE }));
  return toCodeModeState(persisted, await readLiveState(conversationId, ctx));
}

async function writeState(
  conversationId: string,
  enabled: boolean,
  ctx: ExtensionBackendContext,
): Promise<{ enabled: boolean; updatedAt: string }> {
  const state = { enabled, updatedAt: new Date().toISOString() };
  await ctx.conversations.metadata.set({ conversationId, namespace: METADATA_NAMESPACE, values: state });
  ctx.ui.invalidate(['sessions', 'extensions']);
  return state;
}

async function appendLiveState(
  conversationId: string,
  state: { enabled: boolean; updatedAt: string },
  ctx: ExtensionBackendContext,
): Promise<void> {
  const conversations = ctx.conversations as typeof ctx.conversations & {
    appendCustomEntry?(conversationId: string, customType: string, data?: unknown): Promise<unknown>;
  };
  if (!conversations.appendCustomEntry) return;
  await conversations.appendCustomEntry(conversationId, 'code-mode-state', state);
}

async function setLiveTools(
  conversationId: string,
  enabled: boolean,
  ctx: ExtensionBackendContext,
): Promise<{ running: boolean | null; toolNames?: string[] }> {
  try {
    await ctx.conversations.setActiveTools(conversationId, enabled ? [CODE_TOOL_NAME] : DEFAULT_TOOL_NAMES);
  } catch {
    return readLiveState(conversationId, ctx);
  }
  return readLiveState(conversationId, ctx);
}

function readAction(input: unknown): 'toggle' | 'on' | 'off' | 'status' {
  const raw =
    isRecord(input) && typeof input.action === 'string'
      ? input.action
      : isRecord(input) && typeof input.argument === 'string'
        ? input.argument
        : '';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on' || normalized === 'enable' || normalized === 'enabled') return 'on';
  if (normalized === 'off' || normalized === 'disable' || normalized === 'disabled') return 'off';
  if (normalized === 'status' || normalized === 'state' || normalized === 'show') return 'status';
  if (!normalized || normalized === 'toggle') return 'toggle';
  throw new Error('Usage: /code, /code on, /code off, or /code status');
}

export async function toggleCodeMode(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<CodeModeState & { notice: { tone: 'accent'; text: string } }> {
  const conversationId = conversationIdFrom(input, ctx);
  const current = await readState({ conversationId }, ctx);
  const action = readAction(input);
  if (action === 'status') {
    return {
      ...current,
      notice: { tone: 'accent', text: current.enabled ? 'Code mode is on.' : 'Code mode is off.' },
    };
  }
  const enabled = action === 'toggle' ? !current.enabled : action === 'on';
  const next = await writeState(conversationId, enabled, ctx);
  await appendLiveState(conversationId, next, ctx);
  const live = await setLiveTools(conversationId, enabled, ctx);
  const state = toCodeModeState(next, live);
  return {
    ...state,
    notice: {
      tone: 'accent',
      text:
        enabled && state.running
          ? 'Code mode enabled. The current running turn may keep its existing tools; the next turn will expose exec_code.'
          : enabled
            ? 'Code mode enabled. The next turn will expose only exec_code.'
            : 'Code mode disabled. Start a new turn to restore the normal tool surface.',
    },
  };
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.max(1000, Math.min(MAX_TIMEOUT_MS, Math.round(value)));
}

function textResult(text: string, details?: unknown): AgentToolResult<unknown> {
  return {
    content: [{ type: 'text', text }],
    ...(details === undefined ? {} : { details }),
  };
}

function normalizeToolResult(result: AgentToolResult<unknown>): unknown {
  const text = result.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
  return {
    ok: result.isError !== true,
    text,
    content: result.content,
    details: result.details,
  };
}

function toToolContext(ctx: CodeModeContext) {
  return {
    conversationId: ctx.sessionManager?.getSessionId?.(),
    sessionId: ctx.sessionManager?.getSessionId?.(),
    cwd: ctx.sessionManager?.getCwd?.() ?? ctx.cwd,
    sessionFile: ctx.sessionManager?.getSessionFile?.(),
  };
}

function buildCatalog(pi: ExtensionAPI): ToolSummary[] {
  return pi
    .getAllTools()
    .filter((tool) => tool.name !== CODE_TOOL_NAME)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      source: tool.sourceInfo,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function callTool(pi: ExtensionAPI, ctx: CodeModeContext, name: string, input: unknown, signal?: AbortSignal): Promise<unknown> {
  if (name === CODE_TOOL_NAME) throw new Error('exec_code cannot call itself.');
  const { invokeToolByName } = await import('@neon-pilot/extensions/backend/tools');
  const result = await invokeToolByName({
    name,
    input,
    toolContext: toToolContext(ctx),
    agentContext: ctx,
    signal,
  });
  return normalizeToolResult(result as AgentToolResult<unknown>);
}

function buildSandbox(pi: ExtensionAPI, ctx: CodeModeContext, signal?: AbortSignal) {
  const output: string[] = [];
  const catalog = () => buildCatalog(pi);
  const sandbox: Record<string, unknown> = {
    state: {},
    console: {
      log: (...args: unknown[]) => output.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')),
      warn: (...args: unknown[]) => output.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')),
      error: (...args: unknown[]) => output.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')),
    },
    listTools: () => catalog().map(({ name, title, description }) => ({ name, title, description })),
    describeTool: (name: string) => {
      const tool = catalog().find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      return tool;
    },
    tools: new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop !== 'string') return undefined;
          return (input?: unknown) => callTool(pi, ctx, prop, input ?? {}, signal);
        },
      },
    ),
    __output: output,
  };
  return sandbox;
}

function getVmContext(pi: ExtensionAPI, ctx: CodeModeContext, signal?: AbortSignal): vm.Context {
  const key = sessionKey(ctx);
  const existing = contexts.get(key);
  if (existing) {
    const sandbox = buildSandbox(pi, ctx, signal);
    Object.assign(existing, {
      console: sandbox.console,
      listTools: sandbox.listTools,
      describeTool: sandbox.describeTool,
      tools: sandbox.tools,
      __output: sandbox.__output,
    });
    return existing;
  }
  const created = vm.createContext(buildSandbox(pi, ctx, signal), {
    name: `code-mode:${key}`,
    codeGeneration: { strings: false, wasm: false },
  });
  contexts.set(key, created);
  return created;
}

async function runCode(pi: ExtensionAPI, params: ExecCodeInput, signal: AbortSignal | undefined, ctx: CodeModeContext) {
  const code = readString(params.code);
  if (!code) throw new Error('code is required.');
  const timeoutMs = normalizeTimeout(params.timeoutMs);
  const context = getVmContext(pi, ctx, signal);
  const script = new vm.Script(`(async () => {\n${code}\n})()`);
  const execution = script.runInContext(context, { timeout: timeoutMs }) as Promise<unknown>;
  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error(`exec_code timed out after ${timeoutMs}ms`)), timeoutMs).unref();
  });
  const value = await Promise.race([execution, timeout]);
  const output = Array.isArray((context as { __output?: unknown }).__output) ? ((context as { __output: string[] }).__output ?? []) : [];
  return textResult(JSON.stringify({ result: value ?? null, output }, null, 2));
}

function activateCodeMode(ctx: CodeModeContext): void {
  ctx.setActiveTools?.([CODE_TOOL_NAME]);
}

function readCodeModeStateFromSession(ctx: CodeModeContext): { enabled: boolean } {
  const entries = ctx.sessionManager?.getEntries?.() ?? [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== 'code-mode-state') continue;
    return { enabled: isRecord(entry.data) && entry.data.enabled === true };
  }
  return { enabled: false };
}

function syncActiveTools(ctx: CodeModeContext): void {
  if (readCodeModeStateFromSession(ctx).enabled) {
    activateCodeMode(ctx);
    return;
  }
  const activeTools = ctx.getActiveTools?.();
  if (activeTools?.includes(CODE_TOOL_NAME)) {
    ctx.setActiveTools?.(activeTools.filter((toolName) => toolName !== CODE_TOOL_NAME));
  }
}

export default function codeModeExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: CODE_TOOL_NAME,
    label: 'exec_code',
    description:
      'Run JavaScript in the code-mode REPL. Existing tools are exposed as async functions on tools.<name>(). Use listTools() and describeTool(name) to inspect available tool APIs.',
    promptSnippet: 'Run JavaScript that can call existing tools through tools.<name>().',
    promptGuidelines: [
      'Use listTools() and describeTool(name) inside exec_code to discover tool APIs.',
      'Call existing tools as await tools.<name>(input).',
      'The only model-visible tool in code mode is exec_code.',
    ],
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        timeoutMs: { type: 'number', minimum: 1000, maximum: MAX_TIMEOUT_MS },
      },
      required: ['code'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return runCode(pi, params as ExecCodeInput, signal, ctx as CodeModeContext);
    },
  });

  pi.on('session_start', (_event, ctx) => syncActiveTools(ctx as CodeModeContext));
  pi.on('model_select', (_event, ctx) => syncActiveTools(ctx as CodeModeContext));
}
