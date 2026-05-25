import vm from 'node:vm';

import type { AgentToolResult, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

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

const CODE_TOOL_NAME = 'exec_code';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const contexts = new Map<string, vm.Context>();

function sessionKey(ctx: CodeModeContext): string {
  return ctx.sessionManager?.getSessionId?.() ?? 'shared';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
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

  pi.on('session_start', (_event, ctx) => activateCodeMode(ctx as CodeModeContext));
  pi.on('model_select', (_event, ctx) => activateCodeMode(ctx as CodeModeContext));
}
