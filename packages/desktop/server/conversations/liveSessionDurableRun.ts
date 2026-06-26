import { cancelDurableRun, clearDurableRunsListCache, listDurableRuns } from '../automation/durableRuns.js';
import type { ScannedDurableRun } from '../runs/store.js';
import { publishAppEvent } from '../shared/appEvents.js';
import { logError } from '../shared/logging.js';
import { syncWebLiveConversationRun, type WebLiveConversationRunState } from './conversationRuns.js';

export interface LiveSessionDurableRunHost {
  sessionId: string;
  cwd: string;
  title: string;
  lastDurableRunState?: WebLiveConversationRunState;
  session: {
    sessionFile?: string | null;
    sessionName?: string;
  };
}

export function resolveLiveSessionProfile(): string | undefined {
  return 'shared';
}

export function resolveDurableRunTitle(entry: LiveSessionDurableRunHost): string {
  const sessionName = entry.session.sessionName?.trim();
  if (sessionName) {
    return sessionName;
  }

  return entry.title.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRunMetadata(run: ScannedDurableRun): Record<string, unknown> {
  const spec = isRecord(run.manifest?.spec) ? run.manifest.spec : {};
  return isRecord(spec.metadata) ? spec.metadata : {};
}

function readCallbackConversation(run: ScannedDurableRun): { conversationId?: string; sessionFile?: string } {
  const metadata = readRunMetadata(run);
  const raw = isRecord(metadata.callbackConversation) ? metadata.callbackConversation : undefined;
  return {
    conversationId: readString(raw?.conversationId),
    sessionFile: readString(raw?.sessionFile),
  };
}

function isActiveOwnedBackgroundRun(run: ScannedDurableRun, owner: { sessionId: string; sessionFile?: string }): boolean {
  const status = run.status?.status;
  if (status !== 'queued' && status !== 'waiting' && status !== 'running' && status !== 'recovering') {
    return false;
  }

  const kind = run.manifest?.kind;
  if (kind !== 'raw-shell' && kind !== 'background-run') {
    return false;
  }

  const source = run.manifest?.source;
  if (readString(source?.id) === owner.sessionId) {
    return true;
  }

  if (owner.sessionFile && readString(source?.filePath) === owner.sessionFile) {
    return true;
  }

  const callbackConversation = readCallbackConversation(run);
  return (
    callbackConversation.conversationId === owner.sessionId ||
    Boolean(owner.sessionFile && callbackConversation.sessionFile === owner.sessionFile)
  );
}

export function selectAbortableConversationDurableRunIds(
  runs: ScannedDurableRun[],
  owner: { sessionId: string; sessionFile?: string | null },
): string[] {
  const sessionId = owner.sessionId.trim();
  const sessionFile = owner.sessionFile?.trim();
  if (!sessionId) {
    return [];
  }

  return runs
    .filter((run) =>
      isActiveOwnedBackgroundRun(run, {
        sessionId,
        ...(sessionFile ? { sessionFile } : {}),
      }),
    )
    .map((run) => run.runId);
}

export async function abortConversationDurableRuns(entry: LiveSessionDurableRunHost): Promise<string[]> {
  const runIds = selectAbortableConversationDurableRunIds((await listDurableRuns()).runs, {
    sessionId: entry.sessionId,
    sessionFile: entry.session.sessionFile,
  });

  const cancelled: string[] = [];
  for (const runId of runIds) {
    try {
      await cancelDurableRun(runId);
      cancelled.push(runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError('conversation durable run abort failed', { sessionId: entry.sessionId, runId, message });
    }
  }

  if (cancelled.length > 0) {
    clearDurableRunsListCache();
  }

  return cancelled;
}

export async function syncLiveSessionDurableRun(
  entry: LiveSessionDurableRunHost,
  state: WebLiveConversationRunState,
  input: { force?: boolean; lastError?: string } = {},
): Promise<void> {
  if (!input.force && entry.lastDurableRunState === state && !input.lastError) {
    return;
  }

  entry.lastDurableRunState = state;

  const sessionFile = entry.session.sessionFile?.trim();
  if (!sessionFile) {
    return;
  }

  try {
    await syncWebLiveConversationRun({
      conversationId: entry.sessionId,
      sessionFile,
      cwd: entry.cwd,
      title: resolveDurableRunTitle(entry),
      profile: resolveLiveSessionProfile(),
      state,
      lastError: input.lastError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('conversation durable run sync failed', { sessionId: entry.sessionId, state, message });
    publishAppEvent({
      type: 'notification',
      extensionId: 'core',
      message: `Durable run sync failed: ${message}`,
      severity: 'error',
    });
  }
}

export type { WebLiveConversationRunState };
