import { existsSync, readFileSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

import { callDaemonExport } from './daemonBridge.js';
import { callServerModuleExport } from './serverModuleResolver.js';

export interface ScheduledTaskThreadInput {
  threadMode?: string | null;
  threadConversationId?: string | null;
  threadSessionFile?: string | null;
}

export async function invalidateAppTopics(topics: string | string[]): Promise<void> {
  try {
    await callServerModuleExport<void>('../../shared/appEvents.js', 'invalidateAppTopics', topics);
  } catch {
    // Invalidation is best-effort for extension backend bundles.
  }
}

export async function pingDaemon(): Promise<boolean> {
  try {
    return await callDaemonExport<boolean>('pingDaemon');
  } catch {
    return false;
  }
}

export async function startBackgroundRun(input: unknown) {
  return callDaemonExport<Record<string, unknown>>('startBackgroundRun', input);
}

export async function listDurableRuns() {
  return callDaemonExport<{ runs: Array<Record<string, unknown>>; summary: { total: number } }>('listDurableRuns');
}

export async function getDurableRun(runId: string) {
  try {
    return await callDaemonExport<{ run: Record<string, unknown> }>('getDurableRun', runId);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('run not found')) return undefined;
    throw error;
  }
}

export async function cancelDurableRun(runId: string) {
  return callDaemonExport<Record<string, unknown>>('cancelDurableRun', runId);
}

export async function rerunDurableRun(runId: string) {
  return callDaemonExport<Record<string, unknown>>('rerunDurableRun', runId);
}

export async function followUpDurableRun(runId: string, prompt?: string) {
  return callDaemonExport<Record<string, unknown>>('followUpDurableRun', runId, prompt);
}

const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

function readRunStatus(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const run = (detail as { run?: { status?: { status?: unknown } } }).run;
  const status = run?.status?.status;
  return typeof status === 'string' && status.trim() ? status.trim() : undefined;
}

export async function waitForAnyDurableRun(
  runIds: string[],
  input: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<{ timedOut: boolean; run?: Record<string, unknown>; runId?: string; status?: string }> {
  const watchedRunIds = [...new Set(runIds.map((runId) => runId.trim()).filter(Boolean))];
  if (watchedRunIds.length === 0) {
    throw new Error('At least one run id is required.');
  }

  const timeoutMs = Math.max(0, Math.floor(input.timeoutMs ?? 60_000));
  const pollIntervalMs = Math.min(Math.max(Math.floor(input.pollIntervalMs ?? 1_000), 100), 10_000);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    for (const runId of watchedRunIds) {
      const detail = await getDurableRun(runId);
      const status = readRunStatus(detail);
      if (!detail?.run || !status || !TERMINAL_RUN_STATUSES.has(status)) continue;
      return {
        timedOut: false,
        runId,
        status,
        run: detail.run,
      };
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return { timedOut: true };
    await delay(Math.min(pollIntervalMs, remainingMs));
  }
}

function readTailText(filePath: string | undefined, maxLines = 120, maxBytes = 64 * 1024): string {
  if (!filePath || !existsSync(filePath)) return '';
  try {
    const size = statSync(filePath).size;
    const start = Math.max(0, size - maxBytes);
    return readFileSync(filePath, 'utf-8').slice(start).split(/\r?\n/).slice(-maxLines).join('\n').trim();
  } catch {
    return '';
  }
}

export async function getDurableRunLog(runId: string, tail = 120): Promise<{ path: string; log: string } | undefined> {
  const detail = await getDurableRun(runId);
  const run = detail?.run as { paths?: { outputLogPath?: string } } | undefined;
  const path = run?.paths?.outputLogPath;
  if (!path) return undefined;
  return { path, log: readTailText(path, tail) };
}

export function parseDeferredResumeDelayMs(value: string): number | undefined {
  const input = value.trim().toLowerCase();
  const match = input.match(
    /^(?:now\s*\+\s*)?(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/,
  );
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2];
  if (unit.startsWith('s')) return amount * 1000;
  if (unit.startsWith('m')) return amount * 60 * 1000;
  if (unit.startsWith('h')) return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

export async function createStoredAutomation(input: unknown) {
  return callDaemonExport<Record<string, unknown>>('createStoredAutomation', input);
}

export async function applyScheduledTaskThreadBinding(
  taskId: string,
  input: ScheduledTaskThreadInput & { cwd?: string | null; dbPath?: string },
) {
  const mode = input.threadMode === 'existing' || input.threadMode === 'none' ? input.threadMode : 'dedicated';
  const updated = await callDaemonExport<Record<string, unknown>>('setStoredAutomationThreadBinding', taskId, {
    dbPath: input.dbPath,
    mode,
    conversationId: mode === 'existing' ? input.threadConversationId : undefined,
    sessionFile: mode === 'existing' ? input.threadSessionFile : undefined,
  });
  if (mode === 'none') return updated;
  return callDaemonExport<Record<string, unknown>>('ensureAutomationThread', taskId, { dbPath: input.dbPath });
}

export async function setTaskCallbackBinding(input: unknown) {
  return callDaemonExport<void>('setTaskCallbackBinding', input);
}
