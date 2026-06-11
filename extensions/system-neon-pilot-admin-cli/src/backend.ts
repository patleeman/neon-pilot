import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  applyScheduledTaskThreadBinding,
  createStoredAutomation,
  invalidateAppTopics,
  loadScheduledTasksForProfile,
  resolveScheduledTaskThreadBinding,
  updateStoredAutomation,
} from '@neon-pilot/extensions/backend/automations';

import { neonPilotAgent as runNeonPilotAgent } from './agentBackend.js';

export { __setNeonPilotAgentApisForTest, neonPilotAgent, neonPilotAgentCli, readSettings, updateSettings } from './agentBackend.js';

type AdminCommandId =
  | 'list_app_commands'
  | 'run_app_command'
  | 'control_plane_doctor'
  | 'heartbeat_start'
  | 'heartbeat_list'
  | 'heartbeat_stop';

type AutomationsApi = {
  applyScheduledTaskThreadBinding: typeof applyScheduledTaskThreadBinding;
  createStoredAutomation: typeof createStoredAutomation;
  invalidateAppTopics: typeof invalidateAppTopics;
  loadScheduledTasksForProfile: typeof loadScheduledTasksForProfile;
  resolveScheduledTaskThreadBinding: typeof resolveScheduledTaskThreadBinding;
  updateStoredAutomation: typeof updateStoredAutomation;
};

let automationsApiOverride: Partial<AutomationsApi> | null = null;

export function __setNeonPilotAdminApisForTest(input: { automations?: Partial<AutomationsApi> | null }): void {
  automationsApiOverride = input.automations ?? null;
}

function automationsApi(): AutomationsApi {
  return {
    applyScheduledTaskThreadBinding,
    createStoredAutomation,
    invalidateAppTopics,
    loadScheduledTasksForProfile,
    resolveScheduledTaskThreadBinding,
    updateStoredAutomation,
    ...automationsApiOverride,
  } as AutomationsApi;
}

interface AdminCommandDefinition {
  id: AdminCommandId;
  description: string;
  inputSchema: Record<string, unknown>;
}

const adminCommands: AdminCommandDefinition[] = [
  {
    id: 'list_app_commands',
    description: 'List command-palette/app commands available to extensions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    id: 'run_app_command',
    description: 'Run a command-palette/app command by id.',
    inputSchema: {
      type: 'object',
      properties: { commandId: { type: 'string' }, args: {} },
      required: ['commandId'],
      additionalProperties: true,
    },
  },
  {
    id: 'control_plane_doctor',
    description: 'Run non-destructive control-plane smoke checks.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    id: 'heartbeat_start',
    description: 'Start a recurring conversation heartbeat backed by scheduled automations.',
    inputSchema: {
      type: 'object',
      properties: {
        heartbeatId: { type: 'string' },
        intervalMinutes: { type: 'number', minimum: 1, maximum: 59 },
        conversationId: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['heartbeatId', 'intervalMinutes', 'conversationId', 'prompt'],
      additionalProperties: true,
    },
  },
  {
    id: 'heartbeat_list',
    description: 'List recurring conversation heartbeats.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    id: 'heartbeat_stop',
    description: 'Stop a recurring conversation heartbeat without deleting it.',
    inputSchema: {
      type: 'object',
      properties: { heartbeatId: { type: 'string' } },
      required: ['heartbeatId'],
      additionalProperties: true,
    },
  },
];

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = asRecord(input.cli);
  return Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
}

function cliCommand(input: Record<string, unknown>): string {
  const cli = asRecord(input.cli);
  return typeof cli.command === 'string' ? cli.command : '';
}

function cliFlags(input: Record<string, unknown>): Record<string, unknown> {
  return asRecord(asRecord(input.cli).flags);
}

function flagString(flags: Record<string, unknown>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseJsonFlag(flags: Record<string, unknown>, key: string): unknown {
  const value = flagString(flags, key);
  if (!value) return undefined;
  return JSON.parse(value);
}

function isAdminCommandId(value: string): value is AdminCommandId {
  return adminCommands.some((command) => command.id === value);
}

function commandIdFromAction(action: string): AdminCommandId | undefined {
  if (action === 'list') return 'list_app_commands';
  if (action === 'run') return 'run_app_command';
  if (action === 'doctor') return 'control_plane_doctor';
  if (action === 'start') return 'heartbeat_start';
  if (action === 'stop') return 'heartbeat_stop';
  return isAdminCommandId(action) ? action : undefined;
}

function normalizeAdminInput(input: unknown): { command: string | 'list_admin_commands'; input: Record<string, unknown> } {
  const body = asRecord(input);
  const cli = cliCommand(body);
  const args = cliArgs(body);
  const flags = cliFlags(body);
  if (cli === 'app-commands list') return { command: 'list_app_commands', input: body };
  if (cli === 'app-commands run') {
    return {
      command: 'run_app_command',
      input: { ...body, commandId: args[0], args: parseJsonFlag(flags, 'args') ?? (args.length > 1 ? args.slice(1) : undefined) },
    };
  }
  if (cli === 'control-plane doctor') return { command: 'control_plane_doctor', input: body };
  if (cli === 'heartbeats start') {
    return {
      command: 'heartbeat_start',
      input: {
        ...body,
        heartbeatId: args[0],
        intervalMinutes: flagString(flags, 'interval-minutes'),
        conversationId: flagString(flags, 'conversation-id'),
        prompt: flagString(flags, 'prompt'),
      },
    };
  }
  if (cli === 'heartbeats list') return { command: 'heartbeat_list', input: body };
  if (cli === 'heartbeats stop') return { command: 'heartbeat_stop', input: { ...body, heartbeatId: args[0] } };

  const action = typeof body.action === 'string' ? body.action : '';
  const command = typeof body.command === 'string' ? body.command : '';
  const resolved = commandIdFromAction(command) ?? commandIdFromAction(action);
  return { command: resolved ?? (command || action || 'list_admin_commands'), input: body };
}

async function check(name: string, run: () => Promise<unknown>) {
  const startedAt = Date.now();
  try {
    const result = await run();
    return { name, ok: true, durationMs: Date.now() - startedAt, result };
  } catch (error) {
    return { name, ok: false, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) };
  }
}

function countArray(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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

function heartbeatCron(intervalMinutes: number): string {
  const minutes = Math.trunc(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 59) {
    throw new Error('intervalMinutes must be an integer from 1 to 59. For other cadences, use scheduled task cron automation.');
  }
  return `*/${minutes} * * * *`;
}

function isHeartbeatTask(task: Record<string, unknown>): boolean {
  const schedule = asRecord(task.schedule);
  const policies = Array.isArray(task.policies) ? task.policies.map(asRecord) : [];
  return (
    task.targetType === 'conversation' &&
    readString(schedule.expression)?.startsWith('*/') === true &&
    policies.some((policy) => policy.kind === 'overlap' && policy.behavior === 'skip')
  );
}

function summarizeHeartbeat(task: Record<string, unknown>) {
  const schedule = asRecord(task.schedule);
  const expression = readString(schedule.expression);
  const match = expression?.match(/^\*\/(\d+) \* \* \* \*$/);
  return {
    id: readString(task.id),
    title: readString(task.title),
    enabled: task.enabled === true,
    intervalMinutes: match ? Number(match[1]) : undefined,
    cron: expression,
    conversationId: readString(task.threadConversationId),
    skipIfRunning: true,
    coalesce: true,
  };
}

async function startHeartbeat(input: Record<string, unknown>, ctx: ExtensionBackendContext) {
  const heartbeatId = requiredString(input.heartbeatId ?? input.taskId ?? input.id, 'heartbeatId');
  const intervalMinutes = readNumber(input.intervalMinutes);
  if (!intervalMinutes) throw new Error('intervalMinutes is required.');
  const prompt = requiredString(input.prompt, 'prompt');
  const cron = heartbeatCron(intervalMinutes);
  const loaded = await automationsApi().loadScheduledTasksForProfile('shared');
  const tasks = Array.isArray(loaded.tasks) ? loaded.tasks.map(asRecord) : [];
  const existing = tasks.find((task) => readString(task.id) === heartbeatId);
  const conversationId = readString(input.conversationId ?? input.threadConversationId) ?? ctx.toolContext?.conversationId;
  const binding = await automationsApi().resolveScheduledTaskThreadBinding({
    threadMode: 'existing',
    threadConversationId: conversationId,
    threadSessionFile:
      conversationId === ctx.toolContext?.conversationId ? ctx.toolContext?.sessionFile : readString(existing?.threadSessionFile),
    cwd: readString(input.cwd) ?? readString(existing?.cwd) ?? ctx.toolContext?.cwd,
  });
  const saved = existing
    ? await automationsApi().updateStoredAutomation(heartbeatId, {
        title: readString(input.title) ?? readString(existing.title) ?? heartbeatId,
        enabled: true,
        cron,
        prompt,
        targetType: 'conversation',
        conversationBehavior: readString(input.deliverAs) ?? readString(existing.conversationBehavior) ?? 'followUp',
        cwd: readString(input.cwd) ?? readString(existing.cwd),
        timeoutSeconds: readNumber(input.timeoutSeconds) ?? readNumber(existing.timeoutSeconds),
        policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
      })
    : await automationsApi().createStoredAutomation({
        id: heartbeatId,
        title: readString(input.title) ?? heartbeatId,
        enabled: true,
        cron,
        prompt,
        targetType: 'conversation',
        conversationBehavior: readString(input.deliverAs) ?? 'followUp',
        cwd: readString(input.cwd),
        timeoutSeconds: readNumber(input.timeoutSeconds),
        policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
      });
  const bound = await automationsApi().applyScheduledTaskThreadBinding(readString(saved.id) ?? heartbeatId, {
    threadMode: readString(binding.mode) ?? 'existing',
    threadConversationId: readString(binding.conversationId),
    threadSessionFile: readString(binding.sessionFile),
    cwd: readString(input.cwd) ?? readString(existing?.cwd),
  });
  await automationsApi().invalidateAppTopics(['tasks', 'runs', 'sessions']);
  return {
    ok: true,
    action: 'heartbeat_start',
    heartbeat: summarizeHeartbeat({ ...saved, ...bound, schedule: { type: 'cron', expression: cron } }),
  };
}

async function listHeartbeats() {
  const loaded = await automationsApi().loadScheduledTasksForProfile('shared');
  const tasks = Array.isArray(loaded.tasks) ? loaded.tasks.map(asRecord) : [];
  const heartbeats = tasks.filter(isHeartbeatTask).map(summarizeHeartbeat);
  return { ok: true, action: 'heartbeat_list', heartbeats, count: heartbeats.length };
}

async function stopHeartbeat(input: Record<string, unknown>) {
  const heartbeatId = requiredString(input.heartbeatId ?? input.taskId ?? input.id, 'heartbeatId');
  const loaded = await automationsApi().loadScheduledTasksForProfile('shared');
  const tasks = Array.isArray(loaded.tasks) ? loaded.tasks.map(asRecord) : [];
  const existing = tasks.find((task) => readString(task.id) === heartbeatId);
  if (!existing) throw new Error(`Heartbeat not found: ${heartbeatId}`);
  const schedule = asRecord(existing.schedule);
  const updated = await automationsApi().updateStoredAutomation(heartbeatId, {
    title: readString(existing.title) ?? heartbeatId,
    enabled: false,
    cron: readString(schedule.expression),
    prompt: readString(existing.prompt) ?? '',
    targetType: 'conversation',
    conversationBehavior: readString(existing.conversationBehavior) ?? 'followUp',
    cwd: readString(existing.cwd),
    timeoutSeconds: readNumber(existing.timeoutSeconds),
    policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
  });
  await automationsApi().invalidateAppTopics(['tasks', 'runs', 'sessions']);
  return { ok: true, action: 'heartbeat_stop', heartbeat: summarizeHeartbeat({ ...existing, ...updated, enabled: false }) };
}

export async function runAdminCommand(command: AdminCommandId | 'list_admin_commands', input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  if (command === 'list_admin_commands') return { ok: true, commands: adminCommands };
  if (command === 'list_app_commands') {
    const commands = await ctx.commands.list();
    return { ok: true, commands };
  }
  if (command === 'run_app_command') {
    const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
    if (!commandId) throw new Error('command id is required.');
    const executed = await ctx.commands.execute(commandId, body.args);
    return { ok: executed, commandId, executed };
  }
  if (command === 'heartbeat_start') return startHeartbeat(body, ctx);
  if (command === 'heartbeat_list') return listHeartbeats();
  if (command === 'heartbeat_stop') return stopHeartbeat(body);
  if (command === 'control_plane_doctor') {
    const checks = await Promise.all([
      check('app_commands_list', async () => ({ count: countArray(await ctx.commands.list()) })),
      check('conversations_list', async () => ({ count: countArray(await ctx.conversations.list()) })),
      check('conversations_workspace', async () => ctx.conversations.getWorkspace()),
      check('conversations_retention_dry_run', async () =>
        ctx.conversations.prune({ olderThanMs: 365 * 86_400_000, dryRun: true, archivedOnly: true }),
      ),
      check('runtime_repo_root', async () => ({ repoRoot: ctx.runtime.getRepoRoot() })),
      check('storage_round_trip', async () => {
        const key = `control-plane-doctor/${Date.now()}`;
        await ctx.storage.put(key, { ok: true });
        const stored = await ctx.storage.get(key);
        await ctx.storage.delete(key);
        return { stored: Boolean(stored) };
      }),
    ]);
    return { ok: checks.every((entry) => entry.ok), checks };
  }
}

function toolResult(result: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: result };
}

export async function neonPilotAdmin(input: unknown, ctx: ExtensionBackendContext) {
  const normalized = normalizeAdminInput(input);
  if (normalized.command === 'list_admin_commands' || isAdminCommandId(normalized.command)) {
    return runAdminCommand(normalized.command, normalized.input, ctx);
  }
  return runNeonPilotAgent({ ...normalized.input, action: normalized.command }, ctx);
}

export async function neonPilotTool(input: unknown, ctx: ExtensionBackendContext) {
  const result = await neonPilotAdmin(input, ctx);
  if (asRecord(result).content && Array.isArray(asRecord(result).content)) return result;
  return toolResult(result);
}

export async function controlPlaneDoctor(input: unknown, ctx: ExtensionBackendContext) {
  return runAdminCommand('control_plane_doctor', input, ctx);
}

export async function manageAppCommands(input: unknown, ctx: ExtensionBackendContext) {
  return neonPilotAdmin(input, ctx);
}
