import type { ScannedDurableRun } from '@neon-pilot/daemon';

import {
  cancelDurableRun,
  followUpDurableRun,
  getDurableRun,
  getDurableRunLog,
  listDurableRuns,
  rerunDurableRun,
} from '../automation/durableRuns.js';

export type ExecutionKind = 'background-command' | 'subagent' | 'scheduled-task' | 'deferred-resume' | 'conversation' | 'unknown';
export type ExecutionVisibility = 'primary' | 'system' | 'hidden';

export interface ExecutionCapabilities {
  canCancel: boolean;
  canRerun: boolean;
  canFollowUp: boolean;
  hasLog: boolean;
  hasResult: boolean;
}

export type ExecutionWorkerRole = 'worker';

export interface ExecutionRecord {
  id: string;
  kind: ExecutionKind;
  visibility: ExecutionVisibility;
  conversationId?: string;
  sessionFile?: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
  title: string;
  subtitle?: string;
  status: string;
  cwd?: string;
  command?: string;
  prompt?: string;
  model?: string;
  taskId?: string;
  /** Non-persona worker role. Present for programmatic/background/automation runs. */
  workerRole?: ExecutionWorkerRole;
  /** Stable human-readable name for worker executions. */
  workerName?: string;
  createdAt?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  attention?: {
    required: boolean;
    reason?: string;
    dismissed?: boolean;
  };
  capabilities: ExecutionCapabilities;
}

export interface ConversationExecutionsResult {
  conversationId: string;
  primary: ExecutionRecord[];
  system: ExecutionRecord[];
  hidden: ExecutionRecord[];
  executions: ExecutionRecord[];
}

export interface ConversationExecutionsOptions {
  active?: boolean;
  visibility?: ExecutionVisibility | 'visible' | 'all';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function isExecutionActive(execution: ExecutionRecord): boolean {
  return isActiveExecutionStatus(execution.status);
}

function isTerminalExecutionStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'interrupted';
}

function isActiveExecutionStatus(status: string | undefined): boolean {
  return status === 'queued' || status === 'waiting' || status === 'running' || status === 'recovering';
}

function hasPendingOperation(run: ScannedDurableRun): boolean {
  const payload = readRecord(run.checkpoint?.payload);
  const pendingOperation = readRecord(payload?.pendingOperation);
  return Boolean(readString(pendingOperation?.type));
}

function shouldListExecution(run: ScannedDurableRun): boolean {
  if (run.manifest?.source?.type !== 'web-live-session' || run.status?.status !== 'waiting') {
    return true;
  }

  return hasPendingOperation(run);
}

function readMetadata(run: ScannedDurableRun): Record<string, unknown> | undefined {
  const spec = readRecord(run.manifest?.spec);
  return readRecord(spec?.metadata) ?? readRecord(spec?.manifestMetadata);
}

function readWorkerRole(run: ScannedDurableRun): ExecutionWorkerRole | undefined {
  if (run.manifest?.kind !== 'background-run') return undefined;
  const metadata = readMetadata(run);
  return readString(metadata?.agentRole) === 'worker' ? 'worker' : undefined;
}

function readWorkerName(run: ScannedDurableRun): string | undefined {
  if (run.manifest?.kind !== 'background-run') return undefined;
  return readString(readMetadata(run)?.workerName);
}

function readShellCommand(spec: Record<string, unknown> | undefined): string | undefined {
  const direct = readString(spec?.shellCommand);
  if (direct) return direct;
  const target = readRecord(spec?.target);
  return readString(target?.command);
}

function readCwd(spec: Record<string, unknown> | undefined): string | undefined {
  const direct = readString(spec?.cwd);
  if (direct) return direct;
  const target = readRecord(spec?.target);
  return readString(target?.cwd);
}

function inferExecutionKind(run: ScannedDurableRun): ExecutionKind {
  const manifest = run.manifest;
  const spec = readRecord(manifest?.spec);
  const sourceType = manifest?.source?.type;
  if (manifest?.kind === 'raw-shell' || readShellCommand(spec)) return 'background-command';
  if (manifest?.kind === 'background-run') return 'subagent';
  if (manifest?.kind === 'scheduled-task' || sourceType === 'scheduled-task') return 'scheduled-task';
  if (sourceType === 'deferred-resume') return 'deferred-resume';
  if (manifest?.kind === 'conversation') return 'conversation';
  return 'unknown';
}

function inferVisibility(kind: ExecutionKind): ExecutionVisibility {
  if (kind === 'background-command' || kind === 'subagent') return 'primary';
  if (kind === 'scheduled-task' || kind === 'deferred-resume' || kind === 'conversation') return 'system';
  return 'hidden';
}

function inferConversationId(run: ScannedDurableRun): string | undefined {
  const source = run.manifest?.source;
  const spec = readRecord(run.manifest?.spec);
  const metadata = readRecord(spec?.metadata) ?? readRecord(spec?.manifestMetadata);
  const callbackConversation = readRecord(metadata?.callbackConversation) ?? readRecord(spec?.callbackConversation);
  const metadataConversationId = readString(metadata?.conversationId) ?? readString(callbackConversation?.conversationId);
  if (metadataConversationId) return metadataConversationId;
  if (source?.type === 'tool') return readString(source.id);
  const sourceId = readString(source?.id);
  if (sourceId?.startsWith('conversation-live-')) return sourceId.replace(/^conversation-live-/, '');
  return undefined;
}

function inferSessionFile(run: ScannedDurableRun): string | undefined {
  const source = run.manifest?.source;
  const spec = readRecord(run.manifest?.spec);
  const metadata = readRecord(spec?.metadata) ?? readRecord(spec?.manifestMetadata);
  const callback = readRecord(spec?.callbackConversation) ?? readRecord(metadata?.callbackConversation);
  return readString(source?.filePath) ?? readString(callback?.sessionFile);
}

function inferTitle(run: ScannedDurableRun, kind: ExecutionKind): string {
  const spec = readRecord(run.manifest?.spec);
  const metadata = readRecord(spec?.metadata) ?? readRecord(spec?.manifestMetadata);
  const title = readString(metadata?.title) ?? readString(metadata?.taskSlug) ?? readString(spec?.taskSlug);
  if (title) return title;
  const command = readShellCommand(spec);
  if (command) return command;
  const prompt = readString(spec?.prompt) ?? readString(readRecord(spec?.agent)?.prompt);
  if (prompt) return prompt.split(/\s+/).slice(0, 8).join(' ');
  if (kind === 'scheduled-task') return 'Scheduled task execution';
  if (kind === 'deferred-resume') return 'Deferred resume';
  if (kind === 'conversation') return 'Conversation execution';
  return run.runId;
}

export function projectExecution(run: ScannedDurableRun): ExecutionRecord {
  const spec = readRecord(run.manifest?.spec);
  const agent = readRecord(spec?.agent);
  const kind = inferExecutionKind(run);
  const status = run.status?.status ?? 'unknown';
  const command = readShellCommand(spec);
  const cwd = readCwd(spec);
  const prompt = readString(spec?.prompt) ?? readString(agent?.prompt);
  const model = readString(spec?.model) ?? readString(agent?.model);
  const taskId = readString(spec?.taskId) ?? readString(spec?.taskSlug) ?? readString(run.manifest?.source?.id);
  const workerRole = readWorkerRole(run);
  const workerName = readWorkerName(run);
  const hasResult = Boolean(run.result && Object.keys(run.result).length > 0);
  const hasLog = Boolean(run.paths.outputLogPath);
  // Worker executions surface their generated worker name as the title.
  const title = workerRole === 'worker' && workerName ? workerName : inferTitle(run, kind);
  return {
    id: run.runId,
    kind,
    visibility: inferVisibility(kind),
    ...(inferConversationId(run) ? { conversationId: inferConversationId(run) } : {}),
    ...(inferSessionFile(run) ? { sessionFile: inferSessionFile(run) } : {}),
    title,
    ...(command && kind !== 'background-command' ? { subtitle: command } : {}),
    status,
    ...(cwd ? { cwd } : {}),
    ...(command ? { command } : {}),
    ...(prompt ? { prompt } : {}),
    ...(model ? { model } : {}),
    ...(taskId ? { taskId } : {}),
    ...(workerRole ? { workerRole } : {}),
    ...(workerName ? { workerName } : {}),
    ...(run.manifest?.createdAt ? { createdAt: run.manifest.createdAt } : {}),
    ...(run.status?.startedAt ? { startedAt: run.status.startedAt } : {}),
    ...(run.status?.updatedAt ? { updatedAt: run.status.updatedAt } : {}),
    ...(run.status?.completedAt ? { completedAt: run.status.completedAt } : {}),
    attention: {
      required: run.recoveryAction === 'attention' || status === 'interrupted',
      ...(run.recoveryAction ? { reason: run.recoveryAction } : {}),
    },
    capabilities: {
      canCancel: isActiveExecutionStatus(status) && (run.manifest?.kind === 'background-run' || run.manifest?.kind === 'raw-shell'),
      canRerun: isTerminalExecutionStatus(status) && (run.manifest?.kind === 'background-run' || run.manifest?.kind === 'raw-shell'),
      canFollowUp: kind === 'subagent' && isTerminalExecutionStatus(status),
      hasLog,
      hasResult,
    },
  };
}

function sortExecutions(left: ExecutionRecord, right: ExecutionRecord): number {
  const leftActive = isExecutionActive(left) ? 1 : 0;
  const rightActive = isExecutionActive(right) ? 1 : 0;
  if (leftActive !== rightActive) return rightActive - leftActive;
  return (right.updatedAt ?? right.startedAt ?? right.createdAt ?? '').localeCompare(
    left.updatedAt ?? left.startedAt ?? left.createdAt ?? '',
  );
}

export async function listExecutions(): Promise<{ executions: ExecutionRecord[] }> {
  const result = await listDurableRuns();
  return { executions: result.runs.filter(shouldListExecution).map(projectExecution).sort(sortExecutions) };
}

export async function listConversationExecutions(
  conversationId: string,
  options: ConversationExecutionsOptions = {},
): Promise<ConversationExecutionsResult> {
  const normalized = conversationId.trim();
  const executions = (await listExecutions()).executions
    .filter((execution) => execution.conversationId === normalized)
    .filter((execution) => (options.active ? isExecutionActive(execution) : true))
    .filter((execution) => {
      const visibility = options.visibility ?? 'all';
      if (visibility === 'all') return true;
      if (visibility === 'visible') return execution.visibility !== 'hidden';
      return execution.visibility === visibility;
    });
  return {
    conversationId: normalized,
    primary: executions.filter((execution) => execution.visibility === 'primary'),
    system: executions.filter((execution) => execution.visibility === 'system'),
    hidden: executions.filter((execution) => execution.visibility === 'hidden'),
    executions,
  };
}

export async function getExecution(id: string): Promise<{ execution: ExecutionRecord } | undefined> {
  const result = await getDurableRun(id);
  return result ? { execution: projectExecution(result.run) } : undefined;
}

export {
  cancelDurableRun as cancelExecution,
  followUpDurableRun as followUpExecution,
  getDurableRunLog as getExecutionLog,
  rerunDurableRun as rerunExecution,
};
