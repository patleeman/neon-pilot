import type { ExtensionBackendContext, ExtensionProtocolContext } from '@neon-pilot/extensions';
import {
  abortAgentConversation,
  createAgentConversation,
  disposeAgentConversation,
  getAgentConversation,
  listAgentConversations,
  runAgentTask,
  sendAgentMessage,
} from '@neon-pilot/extensions/backend/agent';
import {
  cancelDurableRun,
  followUpDurableRun,
  getDurableRun,
  getDurableRunLog,
  listDurableRuns,
  pingDaemon,
  rerunDurableRun,
  startBackgroundRun,
} from '@neon-pilot/extensions/backend/runs';

type JsonRecord = Record<string, unknown>;
type ToolMode = 'none' | 'default';
type ConversationVisibility = 'hidden' | 'visible';
type ConversationPersistence = 'ephemeral' | 'saved';
type NeonPilotAgentSettings = {
  cliEnabled: boolean;
  mcpEnabled: boolean;
};

const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS: NeonPilotAgentSettings = {
  cliEnabled: true,
  mcpEnabled: true,
};

type AgentApi = {
  runAgentTask: typeof runAgentTask;
  createAgentConversation: typeof createAgentConversation;
  sendAgentMessage: typeof sendAgentMessage;
  getAgentConversation: typeof getAgentConversation;
  listAgentConversations: typeof listAgentConversations;
  abortAgentConversation: typeof abortAgentConversation;
  disposeAgentConversation: typeof disposeAgentConversation;
};

type RunsApi = {
  cancelDurableRun: typeof cancelDurableRun;
  followUpDurableRun: typeof followUpDurableRun;
  getDurableRun: typeof getDurableRun;
  getDurableRunLog: typeof getDurableRunLog;
  listDurableRuns: typeof listDurableRuns;
  pingDaemon: typeof pingDaemon;
  rerunDurableRun: typeof rerunDurableRun;
  startBackgroundRun: typeof startBackgroundRun;
};

let agentApiOverride: Partial<AgentApi> | null = null;
let runsApiOverride: Partial<RunsApi> | null = null;

export function __setNeonPilotAgentApisForTest(input: { agent?: Partial<AgentApi> | null; runs?: Partial<RunsApi> | null }): void {
  agentApiOverride = input.agent ?? null;
  runsApiOverride = input.runs ?? null;
}

function agentApi(): AgentApi {
  return {
    runAgentTask,
    createAgentConversation,
    sendAgentMessage,
    getAgentConversation,
    listAgentConversations,
    abortAgentConversation,
    disposeAgentConversation,
    ...agentApiOverride,
  } as AgentApi;
}

function runsApi(): RunsApi {
  return {
    cancelDurableRun,
    followUpDurableRun,
    getDurableRun,
    getDurableRunLog,
    listDurableRuns,
    pingDaemon,
    rerunDurableRun,
    startBackgroundRun,
    ...runsApiOverride,
  } as RunsApi;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : undefined;
}

function requiredString(value: unknown, label: string): string {
  const text = readString(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function readToolMode(value: unknown, fallback: ToolMode = 'none'): ToolMode {
  return value === 'default' ? 'default' : value === 'none' ? 'none' : fallback;
}

function readVisibility(value: unknown): ConversationVisibility | undefined {
  return value === 'visible' || value === 'hidden' ? value : undefined;
}

function readPersistence(value: unknown): ConversationPersistence | undefined {
  return value === 'saved' || value === 'ephemeral' ? value : undefined;
}

function normalizeSettings(value: unknown): NeonPilotAgentSettings {
  const record = isRecord(value) ? value : {};
  return {
    cliEnabled: typeof record.cliEnabled === 'boolean' ? record.cliEnabled : DEFAULT_SETTINGS.cliEnabled,
    mcpEnabled: typeof record.mcpEnabled === 'boolean' ? record.mcpEnabled : DEFAULT_SETTINGS.mcpEnabled,
  };
}

async function loadSettings(ctx: ExtensionBackendContext): Promise<NeonPilotAgentSettings> {
  return normalizeSettings(await ctx.storage.get(SETTINGS_KEY).catch(() => null));
}

async function assertEntrypointEnabled(ctx: ExtensionBackendContext, key: keyof NeonPilotAgentSettings, label: string): Promise<void> {
  const settings = await loadSettings(ctx);
  if (!settings[key]) {
    throw new Error(`${label} entrypoint is disabled in Settings.`);
  }
}

function readAllowedTools(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const tools = value.map(readString).filter((item): item is string => Boolean(item));
    return tools.length ? tools : undefined;
  }
  const text = readString(value);
  if (!text) return undefined;
  const tools = text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return tools.length ? tools : undefined;
}

function defaultTaskSlug(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'neon-pilot-subagent';
}

function getCwd(input: JsonRecord, ctx: ExtensionBackendContext): string {
  return readString(input.cwd) ?? ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot();
}

function textResult(text: string, details?: JsonRecord) {
  return {
    text,
    content: [{ type: 'text' as const, text }],
    ...(details ? { details } : {}),
  };
}

function runKind(run: JsonRecord): 'subagent' | 'background-command' | 'unknown' {
  const manifest = isRecord(run.manifest) ? run.manifest : {};
  const spec = isRecord(manifest.spec) ? manifest.spec : {};
  if (manifest.kind === 'background-run') return 'subagent';
  if (manifest.kind === 'raw-shell' || readString(spec.shellCommand)) return 'background-command';
  return 'unknown';
}

function simplifyRun(run: JsonRecord): JsonRecord {
  const manifest = isRecord(run.manifest) ? run.manifest : {};
  const spec = isRecord(manifest.spec) ? manifest.spec : {};
  const metadata = isRecord(spec.metadata) ? spec.metadata : {};
  const agent = isRecord(spec.agent) ? spec.agent : {};
  const status = isRecord(run.status) ? run.status : {};
  const paths = isRecord(run.paths) ? run.paths : {};
  return {
    id: readString(run.runId) ?? readString(run.id) ?? 'unknown',
    kind: runKind(run),
    status: readString(status.status) ?? 'unknown',
    taskSlug: readString(metadata.taskSlug) ?? readString(spec.taskSlug),
    cwd: readString(spec.cwd),
    title:
      readString(metadata.title) ??
      readString(metadata.taskSlug) ??
      readString(spec.taskSlug) ??
      readString(spec.shellCommand) ??
      readString(agent.prompt)?.split(/\s+/).slice(0, 10).join(' '),
    createdAt: readString(run.createdAt),
    updatedAt: readString(run.updatedAt),
    logPath: readString(paths.outputLogPath),
    canCancel: true,
    canRerun: true,
    canFollowUp: runKind(run) === 'subagent',
  };
}

function filterRuns(runs: unknown[], kind?: string): JsonRecord[] {
  return runs
    .filter(isRecord)
    .map(simplifyRun)
    .filter((run) => !kind || run.kind === kind);
}

async function ensureDaemon(): Promise<void> {
  if (!(await runsApi().pingDaemon())) {
    throw new Error('Daemon is not responding. Ensure Neon Pilot desktop is running.');
  }
}

export async function readSettings(_input: unknown, ctx: ExtensionBackendContext) {
  return { settings: await loadSettings(ctx) };
}

export async function updateSettings(input: unknown, ctx: ExtensionBackendContext) {
  const current = await loadSettings(ctx);
  const patch = isRecord(input) ? input : {};
  const next = normalizeSettings({ ...current, ...patch });
  await ctx.storage.put(SETTINGS_KEY, next);
  return { settings: next };
}

export async function neonPilotAgent(input: unknown, ctx: ExtensionBackendContext) {
  const params = isRecord(input) ? input : {};
  const action = requiredString(params.action, 'action');

  switch (action) {
    case 'run_task': {
      const prompt = requiredString(params.prompt, 'prompt');
      const result = await agentApi().runAgentTask(
        {
          prompt,
          cwd: getCwd(params, ctx),
          modelRef: readString(params.modelRef) ?? readString(params.model),
          tools: readToolMode(params.tools, 'none'),
          timeoutMs: readNumber(params.timeoutMs),
        },
        ctx,
      );
      return textResult(result.text, { action, model: result.model, provider: result.provider });
    }

    case 'conversation_create': {
      const result = await agentApi().createAgentConversation(
        {
          title: readString(params.title),
          cwd: getCwd(params, ctx),
          modelRef: readString(params.modelRef) ?? readString(params.model),
          tools: readToolMode(params.tools, 'none'),
          visibility: readVisibility(params.visibility),
          persistence: readPersistence(params.persistence),
        },
        ctx,
      );
      return textResult(`Created conversation ${result.id}.`, { action, conversation: result });
    }

    case 'conversation_send': {
      const result = await agentApi().sendAgentMessage(
        {
          conversationId: requiredString(params.conversationId, 'conversationId'),
          text: requiredString(params.prompt ?? params.text, 'prompt'),
          timeoutMs: readNumber(params.timeoutMs),
        },
        ctx,
      );
      return textResult(result.text, { action, conversation: result });
    }

    case 'conversation_get': {
      const result = await agentApi().getAgentConversation({ conversationId: requiredString(params.conversationId, 'conversationId') }, ctx);
      return textResult(JSON.stringify(result, null, 2), { action, conversation: result });
    }

    case 'conversation_list': {
      const result = await agentApi().listAgentConversations({}, ctx);
      return textResult(JSON.stringify(result, null, 2), { action, conversations: result });
    }

    case 'conversation_abort': {
      const result = await agentApi().abortAgentConversation({ conversationId: requiredString(params.conversationId, 'conversationId') }, ctx);
      return textResult(`Aborted conversation ${result.id}.`, { action, conversation: result });
    }

    case 'conversation_close': {
      const result = await agentApi().disposeAgentConversation({ conversationId: requiredString(params.conversationId, 'conversationId') }, ctx);
      return textResult(`Closed conversation ${result.conversationId}.`, { action, ...result });
    }

    case 'subagent_start': {
      const prompt = requiredString(params.prompt, 'prompt');
      const taskSlug = readString(params.taskSlug) ?? defaultTaskSlug(prompt);
      const cwd = getCwd(params, ctx);
      await ensureDaemon();
      const result = await runsApi().startBackgroundRun({
        taskSlug,
        cwd,
        agent: {
          prompt,
          ...(readString(params.modelRef) ?? readString(params.model) ? { model: readString(params.modelRef) ?? readString(params.model) } : {}),
          ...(readAllowedTools(params.allowedTools) ? { allowedTools: readAllowedTools(params.allowedTools) } : {}),
        },
        source: {
          type: 'tool',
          id: ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? 'neon-pilot-agent',
          ...(ctx.toolContext?.sessionFile ? { filePath: ctx.toolContext.sessionFile } : {}),
        },
        checkpointPayload: {
          ...(readBoolean(params.deliverResultToConversation) ? { resumeParentOnExit: true } : {}),
        },
      });
      if (!isRecord(result) || result.accepted === false) throw new Error(readString(result?.reason) ?? `Could not start subagent ${taskSlug}.`);
      ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
      return textResult(`Started subagent ${readString(result.runId) ?? 'unknown'} for ${taskSlug}.`, {
        action,
        runId: readString(result.runId),
        taskSlug,
        cwd,
        logPath: readString(result.logPath),
      });
    }

    case 'runs_list': {
      const result = await runsApi().listDurableRuns();
      const runs = filterRuns(Array.isArray((result as { runs?: unknown[] }).runs) ? (result as { runs: unknown[] }).runs : [], readString(params.kind));
      return textResult(JSON.stringify(runs, null, 2), { action, runs, runCount: runs.length });
    }

    case 'runs_get': {
      const runId = requiredString(params.runId, 'runId');
      const result = await runsApi().getDurableRun(runId);
      if (!result || !isRecord((result as { run?: unknown }).run)) throw new Error(`Run not found: ${runId}`);
      const run = simplifyRun((result as { run: JsonRecord }).run);
      return textResult(JSON.stringify(run, null, 2), { action, run });
    }

    case 'runs_logs': {
      const runId = requiredString(params.runId, 'runId');
      const tail = Math.min(Math.max(Math.floor(readNumber(params.tail) ?? 120), 1), 1000);
      const result = await runsApi().getDurableRunLog(runId, tail);
      if (!result || !isRecord(result)) throw new Error(`Run not found: ${runId}`);
      return textResult(String(result.log || '(empty log)'), { action, runId, tail, path: readString(result.path) });
    }

    case 'runs_cancel': {
      const runId = requiredString(params.runId, 'runId');
      await ensureDaemon();
      const result = await runsApi().cancelDurableRun(runId);
      if (!isRecord(result) || result.cancelled !== true) throw new Error(readString(result?.reason) ?? `Could not cancel run ${runId}.`);
      ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
      return textResult(`Cancelled run ${runId}.`, { action, runId, cancelled: true });
    }

    case 'runs_rerun': {
      const runId = requiredString(params.runId, 'runId');
      await ensureDaemon();
      const result = await runsApi().rerunDurableRun(runId);
      if (!isRecord(result) || result.accepted === false) throw new Error(readString(result?.reason) ?? `Could not rerun ${runId}.`);
      ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
      return textResult(`Started rerun ${readString(result.runId) ?? 'unknown'} from ${runId}.`, { action, runId: result.runId, sourceRunId: runId });
    }

    case 'subagent_follow_up': {
      const runId = requiredString(params.runId, 'runId');
      await ensureDaemon();
      const prompt = readString(params.prompt) ?? 'Continue from where you left off.';
      const result = await runsApi().followUpDurableRun(runId, prompt);
      if (!isRecord(result) || result.accepted === false) throw new Error(readString(result?.reason) ?? `Could not continue ${runId}.`);
      ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
      return textResult(`Started follow-up ${readString(result.runId) ?? 'unknown'} from ${runId}.`, {
        action,
        runId: result.runId,
        sourceRunId: runId,
      });
    }

    case 'capabilities':
      return textResult(
        JSON.stringify(
          {
            actions: [
              'run_task',
              'conversation_create',
              'conversation_send',
              'conversation_get',
              'conversation_list',
              'conversation_abort',
              'conversation_close',
              'subagent_start',
              'subagent_follow_up',
              'runs_list',
              'runs_get',
              'runs_logs',
              'runs_cancel',
              'runs_rerun',
            ],
          },
          null,
          2,
        ),
        { action },
      );

    default:
      throw new Error(`Unsupported Neon Pilot agent action: ${action}`);
  }
}

function parseCliArgs(args: string[]): JsonRecord {
  const params: JsonRecord = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      params[key] = true;
      continue;
    }
    params[key] = next;
    index += 1;
  }
  return params;
}

function cliUsage(): string {
  return `Usage:
  neon-pilot protocol neon-pilot-agent run --prompt <text> [--cwd <path>] [--tools none|default] [--json]
  neon-pilot protocol neon-pilot-agent start --prompt <text> [--task-slug <slug>] [--cwd <path>] [--model <ref>] [--allowed-tools a,b] [--json]
  neon-pilot protocol neon-pilot-agent runs list [--kind subagent|background-command] [--json]
  neon-pilot protocol neon-pilot-agent runs get <runId> [--json]
  neon-pilot protocol neon-pilot-agent runs logs <runId> [--tail 200]
  neon-pilot protocol neon-pilot-agent runs cancel <runId> [--json]
  neon-pilot protocol neon-pilot-agent runs rerun <runId> [--json]
  neon-pilot protocol neon-pilot-agent subagents follow-up <runId> --prompt <text> [--json]
  neon-pilot protocol neon-pilot-agent conversation create [--title <text>] [--cwd <path>] [--tools none|default] [--json]
  neon-pilot protocol neon-pilot-agent conversation send <conversationId> --prompt <text> [--json]
  neon-pilot protocol neon-pilot-agent conversation close <conversationId> [--json]
  neon-pilot protocol neon-pilot-agent capabilities [--json]
`;
}

function inputFromCli(args: string[]): { input: JsonRecord; json: boolean } {
  const [command, subcommand, idOrAction, maybeAction] = args;
  const flags = parseCliArgs(args);
  const json = flags.json === true;
  const common = { ...flags, modelRef: flags.modelRef ?? flags.model };
  delete common.json;

  if (command === 'run') return { input: { ...common, action: 'run_task' }, json };
  if (command === 'start') return { input: { ...common, action: 'subagent_start' }, json };
  if (command === 'capabilities') return { input: { action: 'capabilities' }, json };
  if (command === 'runs') {
    if (subcommand === 'list') return { input: { ...common, action: 'runs_list' }, json };
    if (subcommand === 'get') return { input: { ...common, action: 'runs_get', runId: idOrAction }, json };
    if (subcommand === 'logs') return { input: { ...common, action: 'runs_logs', runId: idOrAction }, json };
    if (subcommand === 'cancel') return { input: { ...common, action: 'runs_cancel', runId: idOrAction }, json };
    if (subcommand === 'rerun') return { input: { ...common, action: 'runs_rerun', runId: idOrAction }, json };
  }
  if (command === 'subagents' && subcommand === 'follow-up') {
    return { input: { ...common, action: 'subagent_follow_up', runId: idOrAction }, json };
  }
  if (command === 'conversation') {
    if (subcommand === 'create') return { input: { ...common, action: 'conversation_create' }, json };
    if (subcommand === 'send') return { input: { ...common, action: 'conversation_send', conversationId: idOrAction }, json };
    if (subcommand === 'get') return { input: { ...common, action: 'conversation_get', conversationId: idOrAction }, json };
    if (subcommand === 'list') return { input: { ...common, action: 'conversation_list' }, json };
    if (subcommand === 'abort') return { input: { ...common, action: 'conversation_abort', conversationId: idOrAction }, json };
    if (subcommand === 'close' || subcommand === 'dispose') return { input: { ...common, action: 'conversation_close', conversationId: idOrAction }, json };
  }
  if (command === 'agent' && subcommand === 'dispose') {
    return { input: { ...common, action: 'conversation_close', conversationId: idOrAction ?? maybeAction }, json };
  }
  throw new Error(cliUsage());
}

export async function neonPilotAgentCli(input: unknown, ctx: ExtensionProtocolContext): Promise<void> {
  await assertEntrypointEnabled(ctx, 'cliEnabled', 'CLI');
  const args = isRecord(input) && Array.isArray(input.args) ? input.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const parsed = inputFromCli(args);
  const result = await neonPilotAgent(parsed.input, ctx);
  const payload = isRecord(result) && isRecord(result.details) ? result.details : result;
  ctx.stdio.stdout.write(parsed.json ? `${JSON.stringify(payload, null, 2)}\n` : `${String((result as { text?: unknown }).text ?? '')}\n`);
}

const MCP_TOOLS = [
  { name: 'neon_pilot_run_task', action: 'run_task', description: 'Run a one-shot hidden Neon Pilot task.' },
  { name: 'neon_pilot_start_subagent', action: 'subagent_start', description: 'Start a durable Neon Pilot subagent.' },
  { name: 'neon_pilot_continue_subagent', action: 'subagent_follow_up', description: 'Send a follow-up prompt to a durable subagent.' },
  { name: 'neon_pilot_list_runs', action: 'runs_list', description: 'List durable Neon Pilot runs.' },
  { name: 'neon_pilot_get_run', action: 'runs_get', description: 'Inspect one durable run.' },
  { name: 'neon_pilot_get_run_logs', action: 'runs_logs', description: 'Read durable run logs.' },
  { name: 'neon_pilot_cancel_run', action: 'runs_cancel', description: 'Cancel a durable run.' },
  { name: 'neon_pilot_rerun', action: 'runs_rerun', description: 'Rerun a durable run.' },
  { name: 'neon_pilot_create_conversation', action: 'conversation_create', description: 'Create an extension-owned Neon Pilot conversation.' },
  { name: 'neon_pilot_send_message', action: 'conversation_send', description: 'Send a message to an extension-owned conversation.' },
  { name: 'neon_pilot_close_conversation', action: 'conversation_close', description: 'Close an ephemeral extension-owned conversation.' },
] as const;

function toolSchema() {
  return {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      text: { type: 'string' },
      cwd: { type: 'string' },
      model: { type: 'string' },
      modelRef: { type: 'string' },
      tools: { type: 'string', enum: ['none', 'default'] },
      timeoutMs: { type: 'number' },
      taskSlug: { type: 'string' },
      runId: { type: 'string' },
      conversationId: { type: 'string' },
      kind: { type: 'string', enum: ['subagent', 'background-command'] },
      tail: { type: 'number', minimum: 1, maximum: 1000 },
      allowedTools: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    },
    additionalProperties: true,
  };
}

function encodeMcpMessage(message: unknown): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function mcpResponse(id: unknown, result: unknown): string {
  return encodeMcpMessage({ jsonrpc: '2.0', id, result });
}

function mcpError(id: unknown, message: string, code = -32000): string {
  return encodeMcpMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMcpMessage(message: JsonRecord, ctx: ExtensionProtocolContext): Promise<string | undefined> {
  const method = readString(message.method);
  const id = message.id;
  if (method === 'initialize') {
    return mcpResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'neon-pilot-agent', version: '0.1.0' },
      capabilities: { tools: {}, resources: {} },
    });
  }
  if (method === 'notifications/initialized') return undefined;
  if (method === 'tools/list') {
    return mcpResponse(id, {
      tools: MCP_TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: toolSchema() })),
    });
  }
  if (method === 'tools/call') {
    const params = isRecord(message.params) ? message.params : {};
    const name = requiredString(params.name, 'name');
    const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
    if (!tool) return mcpError(id, `Unknown tool: ${name}`, -32602);
    try {
      const args = isRecord(params.arguments) ? params.arguments : {};
      const result = await neonPilotAgent({ ...args, action: tool.action }, ctx);
      return mcpResponse(id, {
        content: (result as { content?: unknown }).content ?? [{ type: 'text', text: String((result as { text?: unknown }).text ?? '') }],
        isError: Boolean((result as { isError?: unknown }).isError),
      });
    } catch (error) {
      return mcpResponse(id, {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      });
    }
  }
  if (method === 'resources/list') {
    return mcpResponse(id, {
      resources: [
        { uri: 'neon-pilot://capabilities', name: 'Neon Pilot capabilities', mimeType: 'application/json' },
        { uri: 'neon-pilot://runs', name: 'Neon Pilot durable runs', mimeType: 'application/json' },
      ],
    });
  }
  if (method === 'resources/read') {
    const uri = readString(isRecord(message.params) ? message.params.uri : undefined);
    if (uri === 'neon-pilot://capabilities') {
      const result = await neonPilotAgent({ action: 'capabilities' }, ctx);
      return mcpResponse(id, { contents: [{ uri, mimeType: 'application/json', text: String((result as { text?: unknown }).text ?? '') }] });
    }
    if (uri === 'neon-pilot://runs') {
      const result = await neonPilotAgent({ action: 'runs_list' }, ctx);
      return mcpResponse(id, { contents: [{ uri, mimeType: 'application/json', text: String((result as { text?: unknown }).text ?? '') }] });
    }
    return mcpError(id, `Unknown resource: ${uri}`, -32602);
  }
  return id === undefined ? undefined : mcpError(id, `Unsupported method: ${method}`, -32601);
}

export async function neonPilotAgentMcp(_input: unknown, ctx: ExtensionProtocolContext): Promise<void> {
  await assertEntrypointEnabled(ctx, 'mcpEnabled', 'MCP');
  let buffer = '';
  const pending = new Set<Promise<void>>();
  const dispatch = (line: string) => {
    if (!line) return;
    const task = (async () => {
      try {
        const parsed = JSON.parse(line);
        if (!isRecord(parsed)) throw new Error('MCP message must be a JSON object.');
        const response = await handleMcpMessage(parsed, ctx);
        if (response) ctx.stdio.stdout.write(response);
      } catch (error) {
        ctx.stdio.stdout.write(mcpError(null, error instanceof Error ? error.message : String(error), -32700));
      }
    })();
    pending.add(task);
    task.finally(() => pending.delete(task));
  };
  const drain = () => {
    while (buffer.length > 0) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd >= 0) {
        const header = buffer.slice(0, headerEnd);
        const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)(?:\r\n|$)/i);
        if (!match) {
          ctx.stdio.stdout.write(mcpError(null, 'MCP frame is missing Content-Length.', -32700));
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + length) return;
        const body = buffer.slice(bodyStart, bodyStart + length);
        buffer = buffer.slice(bodyStart + length);
        dispatch(body);
        continue;
      }

      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      dispatch(line);
    }
  };

  await new Promise<void>((resolve) => {
    ctx.signal.addEventListener('abort', () => resolve(), { once: true });
    ctx.stdio.stdin.on('data', (chunk) => {
      buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      drain();
    });
    ctx.stdio.stdin.on('end', () => {
      void Promise.allSettled([...pending]).then(() => resolve());
    });
  });
}
