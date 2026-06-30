import { existsSync, readFileSync, statSync } from 'node:fs';

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

type RunAgentExtensionFactory = (api: RegisterToolApi) => void;

interface NativeBackendContext {
  toolContext?: {
    conversationId?: string;
    cwd?: string;
    sessionFile?: string;
    sessionId?: string;
    onUpdate?: (update: { content?: Array<{ type: string; text: string }>; isError?: boolean }) => void;
  };
  agentToolContext?: { signal?: AbortSignal };
  ui?: { invalidate?(topics: string | string[]): void };
  extensions?: {
    callAction?(extensionId: string, actionId: string, input: unknown): Promise<unknown>;
    invokeAction?(input: { extensionId: string; actionId: string; input?: unknown }): Promise<unknown>;
  };
  shell: {
    exec(input: { command: string; args?: string[]; cwd?: string; timeoutMs?: number; signal?: AbortSignal }): Promise<{
      stdout?: string;
      stderr?: string;
      executionWrappers?: Array<{ id: string; label?: string }>;
    }>;
    spawn?(input: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
      onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void;
    }): Promise<{ pid: number | null; executionWrappers: Array<{ id: string; label?: string }>; kill: () => Promise<void> | void }>;
  };
}

interface RegisteredTool {
  name?: string;
  execute?: (...args: unknown[]) => Promise<unknown> | unknown;
}

interface RegisterToolApi {
  registerTool(tool: RegisteredTool): void;
}

interface ToolExecutionResult {
  content?: Array<{ type?: string; text?: string }>;
  details?: Record<string, unknown>;
  isError?: boolean;
}

interface RoutineHookResult {
  blocked?: boolean;
  message?: string;
  status?: string;
  run?: RoutineActivityRun;
}

interface RoutineActivityStep {
  routineId: string;
  routineName: string;
  status: 'passed' | 'warned' | 'blocked' | 'failed' | 'skipped';
  outcome?: string;
  message?: string;
  skillRefs?: string[];
  model?: string;
  provider?: string;
  fallbackUsed?: boolean;
}

interface RoutineActivityRun {
  id: string;
  hookId: string;
  position: 'before' | 'after';
  status: 'passed' | 'warned' | 'blocked' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  steps: RoutineActivityStep[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readTimeoutSeconds(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readString(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function readAbortSignal(value: unknown): AbortSignal | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.aborted !== 'boolean') return undefined;
  if (typeof value.addEventListener !== 'function') return undefined;
  if (typeof value.removeEventListener !== 'function') return undefined;
  return value as AbortSignal;
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = isRecord(input.cli) ? input.cli : {};
  return Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
}

function cliFlags(input: Record<string, unknown>): Record<string, string | boolean> {
  const cli = isRecord(input.cli) ? input.cli : {};
  return isRecord(cli.flags) ? (cli.flags as Record<string, string | boolean>) : {};
}

function cliFlagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cliFlagNumber(flags: Record<string, string | boolean>, key: string): number | undefined {
  const value = cliFlagString(flags, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cliFlagBoolean(flags: Record<string, string | boolean>, key: string): boolean | undefined {
  const value = flags[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (['1', 'true', 'yes'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false;
  return undefined;
}

function normalizeRunCliInput(input: unknown): Record<string, unknown> {
  const params = isRecord(input) ? { ...input } : {};
  if (!isRecord(params.cli)) return params;
  const args = cliArgs(params);
  const flags = cliFlags(params);
  return {
    ...params,
    ...(args[0] ? { runId: args[0] } : {}),
    ...(cliFlagString(flags, 'task-slug') ? { taskSlug: cliFlagString(flags, 'task-slug') } : {}),
    ...(cliFlagString(flags, 'command') ? { command: cliFlagString(flags, 'command') } : {}),
    ...((cliFlagString(flags, 'prompt') ?? cliFlagString(flags, 'text'))
      ? { prompt: cliFlagString(flags, 'prompt') ?? cliFlagString(flags, 'text') }
      : {}),
    ...(cliFlagString(flags, 'cwd') ? { cwd: cliFlagString(flags, 'cwd') } : {}),
    ...(cliFlagString(flags, 'model') ? { model: cliFlagString(flags, 'model') } : {}),
    ...(cliFlagNumber(flags, 'tail') ? { tail: cliFlagNumber(flags, 'tail') } : {}),
    ...(cliFlagBoolean(flags, 'deliver-result-to-conversation') !== undefined
      ? { deliverResultToConversation: cliFlagBoolean(flags, 'deliver-result-to-conversation') }
      : {}),
  };
}

async function runForegroundBash(
  command: string,
  cwd: string | undefined,
  timeoutSeconds: number | undefined,
  ctx: NativeBackendContext,
): Promise<ToolExecutionResult> {
  if (ctx.shell.spawn && ctx.toolContext?.onUpdate) {
    return runStreamingForegroundBash(command, cwd, timeoutSeconds, ctx);
  }

  try {
    const result = await ctx.shell.exec({
      command: 'sh',
      args: ['-lc', command],
      cwd,
      timeoutMs: timeoutSeconds ? timeoutSeconds * 1000 : undefined,
      signal: readAbortSignal(ctx.agentToolContext?.signal),
    });
    const output = [result.stdout?.trimEnd(), result.stderr?.trimEnd()].filter(Boolean).join('\n');
    return {
      content: [{ type: 'text', text: output || '(no output)' }],
      details: { executionWrappers: result.executionWrappers ?? [] },
    };
  } catch (error) {
    return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true };
  }
}

async function runStreamingForegroundBash(
  command: string,
  cwd: string | undefined,
  timeoutSeconds: number | undefined,
  ctx: NativeBackendContext,
): Promise<ToolExecutionResult> {
  let output = '';
  let timeout: NodeJS.Timeout | undefined;
  let settled = false;
  let killedByTimeout = false;
  let killProcess: (() => Promise<void> | void) | undefined;
  let executionWrappers: Array<{ id: string; label?: string }> = [];
  const abortSignal = readAbortSignal(ctx.agentToolContext?.signal);

  const append = (chunk: string) => {
    if (!chunk) return;
    output += chunk;
    ctx.toolContext?.onUpdate?.({ content: [{ type: 'text', text: chunk }] });
  };

  return await new Promise<ToolExecutionResult>((resolve) => {
    const finish = (result: ToolExecutionResult) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      abortSignal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    const stopProcess = async () => {
      try {
        await killProcess?.();
      } catch {
        // The host may already have torn down the shell handle; the abort path
        // still needs to settle the tool call instead of leaving the UI running.
      }
    };

    const onAbort = () => {
      void (async () => {
        await stopProcess();
        finish({ content: [{ type: 'text', text: output.trimEnd() || 'cancelled' }], isError: true });
      })();
    };

    void (async () => {
      try {
        const processHandle = await ctx.shell.spawn!({
          command: 'sh',
          args: ['-lc', command],
          cwd,
          onStdout: append,
          onStderr: append,
          onExit: ({ code, signal }) => {
            const exitCode = typeof code === 'number' ? code : undefined;
            const isError = killedByTimeout || (exitCode !== undefined && exitCode !== 0) || signal !== null;
            finish({
              content: [{ type: 'text', text: output.trimEnd() || '(no output)' }],
              details: {
                executionWrappers,
                ...(exitCode !== undefined ? { exitCode } : {}),
                ...(killedByTimeout ? { cancelled: true } : {}),
              },
              ...(isError ? { isError: true } : {}),
            });
          },
        });
        killProcess = processHandle.kill;
        executionWrappers = processHandle.executionWrappers ?? [];

        if (abortSignal?.aborted) {
          onAbort();
          return;
        }
        abortSignal?.addEventListener('abort', onAbort, { once: true });

        if (timeoutSeconds) {
          timeout = setTimeout(() => {
            killedByTimeout = true;
            void stopProcess();
          }, timeoutSeconds * 1000);
        }
      } catch (error) {
        finish({ content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true });
      }
    })();
  });
}

async function loadRunAgentExtensionFactory(): Promise<RunAgentExtensionFactory> {
  const module = await import('./runTool.js');
  return module.createRunAgentExtension({
    getRuntimeScope: () => 'shared',
    repoRoot: process.cwd(),
    runtimeConfigRoot: process.cwd(),
  }) as RunAgentExtensionFactory;
}

async function executeRegisteredTool(factory: RunAgentExtensionFactory, input: unknown, ctx: NativeBackendContext, toolName: string) {
  const registeredTools = new Map<string, RegisteredTool>();
  let fallbackTool: RegisteredTool | undefined;
  factory({
    registerTool(tool: RegisteredTool) {
      fallbackTool ??= tool;
      if (tool.name) {
        registeredTools.set(tool.name, tool);
      }
    },
  } as RegisterToolApi);

  const registeredTool = registeredTools.get(toolName) ?? fallbackTool;
  if (!registeredTool?.execute) {
    throw new Error(`Run tool backend did not register an executable ${toolName} tool.`);
  }

  return registeredTool.execute('extension-backend-run', input, undefined, undefined, {
    cwd: ctx.toolContext?.cwd,
    sessionManager: {
      getSessionId: () => ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? '',
      getSessionFile: () => ctx.toolContext?.sessionFile,
      getCwd: () => ctx.toolContext?.cwd,
    },
  });
}

async function executeRunInput(input: unknown, ctx: NativeBackendContext, toolName: string) {
  const result = (await executeRegisteredTool(await loadRunAgentExtensionFactory(), input, ctx, toolName)) as ToolExecutionResult;
  ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
  const text = Array.isArray(result?.content)
    ? result.content.map((item) => (item.type === 'text' ? (item.text ?? '') : JSON.stringify(item))).join('\n')
    : JSON.stringify(result, null, 2);
  return { text, ...(result?.details ? { details: result.details } : {}), ...(result?.isError ? { isError: true } : {}) };
}

function normalizeRunLogTail(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(1000, value) : 120;
}

function readTailText(filePath: string | undefined, maxLines = 120, maxBytes = 64 * 1024): string {
  if (!filePath || !existsSync(filePath)) {
    return '';
  }

  try {
    const size = statSync(filePath).size;
    const start = Math.max(0, size - maxBytes);
    return readFileSync(filePath, 'utf-8').slice(start).split(/\r?\n/).slice(-maxLines).join('\n').trim();
  } catch {
    return '';
  }
}

function readRunId(run: Record<string, unknown>): string {
  return readString(run.runId) ?? 'unknown';
}

function readRunStatus(run: Record<string, unknown>): string {
  const status = isRecord(run.status) ? readString(run.status.status) : undefined;
  return status ?? 'unknown';
}

function readManifestKind(run: Record<string, unknown>): string | undefined {
  const manifest = isRecord(run.manifest) ? run.manifest : undefined;
  return readString(manifest?.kind);
}

function readRunSpec(run: Record<string, unknown>): Record<string, unknown> {
  const manifest = isRecord(run.manifest) ? run.manifest : undefined;
  return isRecord(manifest?.spec) ? manifest.spec : {};
}

function readRunTitle(run: Record<string, unknown>): string {
  const spec = readRunSpec(run);
  const metadata = isRecord(spec.metadata) ? spec.metadata : isRecord(spec.manifestMetadata) ? spec.manifestMetadata : {};
  const agent = isRecord(spec.agent) ? spec.agent : {};
  const prompt = readString(spec.prompt) ?? readString(agent.prompt);
  return (
    readString(metadata.title) ??
    readString(metadata.taskSlug) ??
    readString(spec.taskSlug) ??
    readString(spec.shellCommand) ??
    (prompt ? prompt.split(/\s+/).slice(0, 8).join(' ') : undefined) ??
    readRunId(run)
  );
}

function isBackgroundCommandRun(run: Record<string, unknown>): boolean {
  return readManifestKind(run) === 'raw-shell' || Boolean(readString(readRunSpec(run).shellCommand));
}

function isSubagentRun(run: Record<string, unknown>): boolean {
  return readManifestKind(run) === 'background-run';
}

function describeRunKind(run: Record<string, unknown>): string {
  if (isSubagentRun(run)) return 'subagent';
  if (isBackgroundCommandRun(run)) return 'background command';
  return readManifestKind(run) ?? 'unknown execution';
}

function assertRunKind(run: Record<string, unknown>, expected: 'background command' | 'subagent'): void {
  const matches = expected === 'background command' ? isBackgroundCommandRun(run) : isSubagentRun(run);
  if (matches) return;

  const actual = describeRunKind(run);
  const alternateTool = expected === 'background command' ? 'subagent' : 'background_bash';
  throw new Error(`Run ${readRunId(run)} is a ${actual}, not a ${expected}. Use ${alternateTool} for this execution.`);
}

function formatScopedRunList(label: string, runs: Array<Record<string, unknown>>): string {
  if (runs.length === 0) {
    return `No ${label.toLowerCase()} found.`;
  }

  return [`${label} (${runs.length}):`, ...runs.map((run) => `- ${readRunId(run)} [${readRunStatus(run)}] ${readRunTitle(run)}`)].join(
    '\n',
  );
}

function formatRunSummary(label: string, run: Record<string, unknown>): string {
  return [`${label} ${readRunId(run)}`, `status: ${readRunStatus(run)}`, `title: ${readRunTitle(run)}`].join('\n');
}

function deriveBackgroundCommandTaskSlug(command: string): string {
  return (
    command
      .split(/\s+/)
      .slice(0, 2)
      .join('-')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 40) || 'background-command'
  );
}

function isRoutineHookUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|disabled|requires permission/i.test(message);
}

function readRoutineActivityRun(result: RoutineHookResult | null): RoutineActivityRun | null {
  if (!result?.run || !Array.isArray(result.run.steps) || result.run.steps.length === 0) return null;
  return result.run;
}

async function runBackgroundCommandRoutineHook(
  ctx: NativeBackendContext,
  input: { command: string; cwd: string; taskSlug: string },
): Promise<RoutineHookResult | null> {
  if (!ctx.extensions?.callAction && !ctx.extensions?.invokeAction) return null;
  const hookInput = {
    hookId: 'background.command',
    position: 'before',
    context: {
      command: input.command,
      cwd: input.cwd,
      taskSlug: input.taskSlug,
      status: 'starting',
    },
  };
  try {
    if (ctx.extensions.callAction) {
      return (await ctx.extensions.callAction('system-routines', 'runHook', hookInput)) as RoutineHookResult;
    }
    const result = await ctx.extensions.invokeAction?.({
      extensionId: 'system-routines',
      actionId: 'runHook',
      input: hookInput,
    });
    if (isRecord(result) && result.ok === true && 'result' in result) {
      return result.result as RoutineHookResult;
    }
    return result as RoutineHookResult;
  } catch (error) {
    if (isRoutineHookUnavailable(error)) return null;
    throw error;
  }
}

async function startBackgroundCommand(input: unknown, ctx: NativeBackendContext) {
  const params = isRecord(input) ? input : {};
  const command = readRequiredString(params.command, 'command');
  const cwd = readRequiredString(readString(params.cwd) ?? ctx.toolContext?.cwd, 'cwd');
  const taskSlug = readString(params.taskSlug) ?? deriveBackgroundCommandTaskSlug(command);
  const conversationId = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? '';
  const conversationFile = ctx.toolContext?.sessionFile;
  const deliverResultToConversation = params.deliverResultToConversation === true;
  if (deliverResultToConversation && !conversationFile) {
    throw new Error('deliverResultToConversation requires an active persisted conversation.');
  }

  if (!(await pingDaemon())) {
    throw new Error('Daemon is not responding. Ensure the desktop app is running.');
  }

  const routineHook = await runBackgroundCommandRoutineHook(ctx, { command, cwd, taskSlug });
  if (routineHook?.blocked) {
    throw new Error(routineHook.message ?? 'A routine blocked this background command.');
  }
  const routineActivityRun = readRoutineActivityRun(routineHook);

  const result = await startBackgroundRun({
    taskSlug,
    cwd,
    shellCommand: command,
    source: {
      type: 'tool',
      id: conversationId,
      ...(conversationFile ? { filePath: conversationFile } : {}),
    },
    ...(deliverResultToConversation && conversationFile
      ? {
          callbackConversation: {
            conversationId,
            sessionFile: conversationFile,
            profile: 'shared',
            repoRoot: process.cwd(),
          },
          checkpointPayload: {
            resumeParentOnExit: true,
          },
        }
      : {}),
  });

  if (!result.accepted) {
    throw new Error(result.reason ?? `Could not start durable run for ${taskSlug}.`);
  }

  ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
  return {
    text: deliverResultToConversation
      ? `Started background command ${result.runId} for ${taskSlug}. Completion/failure will resume this conversation; do not schedule a polling wakeup for this run.`
      : `Started background command ${result.runId} for ${taskSlug}.`,
    details: {
      action: 'start',
      command,
      runId: result.runId,
      taskSlug,
      cwd,
      logPath: result.logPath,
      deliverResultToConversation,
      ...(routineActivityRun ? { routineHooks: [routineActivityRun] } : {}),
    },
  };
}

export async function bash(input: unknown, ctx: NativeBackendContext) {
  const params = isRecord(input) ? input : {};
  const command = readString(params.command);
  if (!command) {
    return { text: 'command is required', details: { isError: true } };
  }

  if (params.background === true) {
    const taskSlug = readString(params.taskSlug) ?? deriveBackgroundCommandTaskSlug(command);
    return startBackgroundCommand(
      {
        taskSlug,
        command,
        cwd: readString(params.cwd) ?? ctx.toolContext?.cwd,
        deliverResultToConversation: params.deliverResultToConversation === true,
      },
      ctx,
    );
  }

  const result = await runForegroundBash(command, readString(params.cwd) ?? ctx.toolContext?.cwd, readTimeoutSeconds(params.timeout), ctx);
  const text = Array.isArray(result.content) ? result.content.map((item) => item.text ?? '').join('\n') : '';
  return { text, ...(result.details ? { details: result.details } : {}), ...(result.isError ? { isError: true } : {}) };
}

export async function background_bash(input: unknown, ctx: NativeBackendContext) {
  const params = normalizeRunCliInput(input);
  const action = readRequiredString(params.action, 'action');
  if (action === 'start') {
    return startBackgroundCommand(params, ctx);
  }

  if (action === 'list') {
    const result = await listDurableRuns();
    const runs = (Array.isArray(result.runs) ? result.runs : []).filter(isBackgroundCommandRun);
    return {
      text: formatScopedRunList('Background commands', runs),
      details: { action: 'list', runCount: runs.length, runIds: runs.map(readRunId) },
    };
  }

  const runId = readRequiredString(params.runId, 'runId');
  const existing = await getDurableRun(runId);
  if (!existing) throw new Error(`Run not found: ${runId}`);
  const run = existing.run as Record<string, unknown>;
  assertRunKind(run, 'background command');

  if (action === 'get') {
    return {
      text: formatRunSummary('Background command', run),
      details: { action: 'get', runId, status: readRunStatus(run) },
    };
  }

  if (action === 'logs') {
    const path = isRecord(run.paths) ? readString(run.paths.outputLogPath) : undefined;
    const tail = normalizeRunLogTail(params.tail);
    return {
      text: [`Background command logs: ${runId}`, `path: ${path ?? ''}`, '', readTailText(path, tail) || '(empty log)'].join('\n'),
      details: { action: 'logs', runId, tail, path },
    };
  }

  if (action === 'cancel') {
    const result = await cancelDurableRun(runId);
    ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
    if (!result.cancelled) throw new Error(result.reason ?? `Could not cancel background command ${runId}.`);
    return { text: `Cancelled background command ${runId}.`, details: { action: 'cancel', runId, cancelled: true } };
  }

  if (action === 'rerun') {
    const result = await rerunDurableRun(runId);
    ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
    if (!result.accepted) throw new Error(result.reason ?? `Could not rerun background command ${runId}.`);
    return { text: `Rerun started ${result.runId} from ${runId}.`, details: { action: 'rerun', runId: result.runId, sourceRunId: runId } };
  }

  throw new Error(`Unsupported background command action: ${action}`);
}

export async function subagent(input: unknown, ctx: NativeBackendContext) {
  const params = normalizeRunCliInput(input);
  if (params.action === 'start') {
    params.action = 'start_agent';
    return executeRunInput(params, ctx, 'subagent');
  }

  const action = readRequiredString(params.action, 'action');
  if (action === 'list') {
    const result = await listDurableRuns();
    const runs = (Array.isArray(result.runs) ? result.runs : []).filter(isSubagentRun);
    return {
      text: formatScopedRunList('Subagents', runs),
      details: { action: 'list', runCount: runs.length, runIds: runs.map(readRunId) },
    };
  }

  const runId = readRequiredString(params.runId, 'runId');
  const existing = await getDurableRun(runId);
  if (!existing) throw new Error(`Subagent not found: ${runId}`);
  const run = existing.run as Record<string, unknown>;
  assertRunKind(run, 'subagent');

  if (action === 'get') {
    return {
      text: formatRunSummary('Subagent', run),
      details: { action: 'get', runId, status: readRunStatus(run) },
    };
  }

  if (action === 'logs') {
    const tail = normalizeRunLogTail(params.tail);
    const result = await getDurableRunLog(runId, tail);
    if (!result) throw new Error(`Subagent not found: ${runId}`);
    return {
      text: [`Subagent logs: ${runId}`, `path: ${result.path}`, '', result.log || '(empty log)'].join('\n'),
      details: { action: 'logs', runId, tail, path: result.path },
    };
  }

  if (action === 'cancel') {
    const result = await cancelDurableRun(runId);
    ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
    if (!result.cancelled) throw new Error(result.reason ?? `Could not cancel subagent ${runId}.`);
    return { text: `Cancelled subagent ${runId}.`, details: { action: 'cancel', runId, cancelled: true } };
  }

  if (action === 'rerun') {
    const result = await rerunDurableRun(runId);
    ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
    if (!result.accepted) throw new Error(result.reason ?? `Could not rerun subagent ${runId}.`);
    return {
      text: `Subagent rerun started ${result.runId} from ${runId}.`,
      details: { action: 'rerun', runId: result.runId, sourceRunId: runId },
    };
  }

  if (action === 'follow_up') {
    const prompt = readString(params.prompt) ?? 'Continue from where you left off.';
    const result = await followUpDurableRun(runId, prompt);
    ctx.ui?.invalidate?.(['executions', 'runs', 'tasks']);
    if (!result.accepted) throw new Error(result.reason ?? `Could not continue subagent ${runId}.`);
    return {
      text: `Subagent follow-up started ${result.runId} from ${runId}.`,
      details: { action: 'follow_up', runId: result.runId, sourceRunId: runId, prompt },
    };
  }

  throw new Error(`Unsupported subagent action: ${action}`);
}
