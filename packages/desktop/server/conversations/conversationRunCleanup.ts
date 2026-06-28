import { type AttentionEventRecord, resolveAttentionEventsStateFile, withAttentionEventsLock } from '@neon-pilot/core';

import { cancelDurableRun, clearDurableRunsListCache } from '../automation/durableRuns.js';
import { loadDaemonConfig } from '../config.js';
import { resolveDaemonPaths } from '../paths.js';
import { readBackgroundRunCallbackOwner } from '../runs/background-run-callback-ownership.js';
import { deleteDurableRun, resolveDurableRunsRoot, scanDurableRunsForRecovery, type ScannedDurableRun } from '../runs/store.js';

export interface DeletedConversationRuntimeCleanupTarget {
  id: string;
  sessionFile?: string;
}

export interface DeletedConversationRuntimeCleanupResult {
  deletedRunIds: string[];
  cancelledRunIds: string[];
  removedAttentionEventIds: string[];
  failedCancellationRunIds: string[];
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readMetadata(run: ScannedDurableRun): Record<string, unknown> | undefined {
  const spec = readRecord(run.manifest?.spec);
  return readRecord(spec?.metadata) ?? readRecord(run.checkpoint?.payload?.metadata);
}

function readCheckpointConversationId(run: ScannedDurableRun): string | undefined {
  const payload = readRecord(run.checkpoint?.payload);
  return readString(payload?.conversationId) ?? readString(readMetadata(run)?.conversationId);
}

function readCheckpointSessionFile(run: ScannedDurableRun): string | undefined {
  const payload = readRecord(run.checkpoint?.payload);
  return readString(payload?.sessionFile) ?? readString(readMetadata(run)?.sessionFile);
}

function isActiveRun(run: ScannedDurableRun): boolean {
  const status = run.status?.status;
  return status === 'queued' || status === 'waiting' || status === 'running' || status === 'recovering';
}

function runBelongsToDeletedConversation(run: ScannedDurableRun, target: DeletedConversationRuntimeCleanupTarget): boolean {
  const id = target.id.trim();
  const sessionFile = target.sessionFile?.trim();
  if (!id) {
    return false;
  }

  const source = run.manifest?.source;
  const sourceId = readString(source?.id);
  const sourceFile = readString(source?.filePath);
  if (sourceId === id || sourceId === `conversation-live-${id}` || sourceId === `conversation-deferred-resume-${id}`) {
    return true;
  }
  if (sessionFile && sourceFile === sessionFile) {
    return true;
  }

  const callbackOwner = readBackgroundRunCallbackOwner(run);
  if (callbackOwner?.conversationId === id || (sessionFile && callbackOwner?.sessionFile === sessionFile)) {
    return true;
  }

  const checkpointConversationId = readCheckpointConversationId(run);
  const checkpointSessionFile = readCheckpointSessionFile(run);
  return checkpointConversationId === id || Boolean(sessionFile && checkpointSessionFile === sessionFile);
}

function attentionEventBelongsToDeletedConversation(event: AttentionEventRecord, target: DeletedConversationRuntimeCleanupTarget): boolean {
  const id = target.id.trim();
  const sessionFile = target.sessionFile?.trim();
  return event.conversationId === id || Boolean(sessionFile && event.sessionFile === sessionFile);
}

function removeDeletedConversationAttentionEvents(targets: DeletedConversationRuntimeCleanupTarget[]): string[] {
  const normalizedTargets = targets.filter((target) => target.id.trim().length > 0);
  if (normalizedTargets.length === 0) {
    return [];
  }

  const statePath = resolveAttentionEventsStateFile();
  return withAttentionEventsLock((state) => {
    const removed: string[] = [];
    for (const [eventId, event] of Object.entries(state.events)) {
      if (!normalizedTargets.some((target) => attentionEventBelongsToDeletedConversation(event, target))) {
        continue;
      }
      delete state.events[eventId];
      removed.push(eventId);
    }
    return removed.sort();
  }, statePath);
}

function resolveRunsRoot(): string {
  return resolveDurableRunsRoot(resolveDaemonPaths(loadDaemonConfig().ipc.socketPath).root);
}

export async function cleanupDeletedConversationRuntime(
  targets: DeletedConversationRuntimeCleanupTarget[],
): Promise<DeletedConversationRuntimeCleanupResult> {
  const normalizedTargets = targets
    .map((target) => ({
      id: target.id.trim(),
      ...(target.sessionFile?.trim() ? { sessionFile: target.sessionFile.trim() } : {}),
    }))
    .filter((target) => target.id.length > 0);

  const result: DeletedConversationRuntimeCleanupResult = {
    deletedRunIds: [],
    cancelledRunIds: [],
    removedAttentionEventIds: removeDeletedConversationAttentionEvents(normalizedTargets),
    failedCancellationRunIds: [],
  };

  if (normalizedTargets.length === 0) {
    return result;
  }

  const runsRoot = resolveRunsRoot();
  const ownedRuns = scanDurableRunsForRecovery(runsRoot).filter((run) =>
    normalizedTargets.some((target) => runBelongsToDeletedConversation(run, target)),
  );

  for (const run of ownedRuns) {
    if (isActiveRun(run)) {
      try {
        await cancelDurableRun(run.runId);
        result.cancelledRunIds.push(run.runId);
      } catch {
        result.failedCancellationRunIds.push(run.runId);
        continue;
      }
    }

    if (deleteDurableRun(runsRoot, run.runId)) {
      result.deletedRunIds.push(run.runId);
    }
  }

  if (result.deletedRunIds.length > 0) {
    clearDurableRunsListCache();
  }

  result.deletedRunIds.sort();
  result.cancelledRunIds.sort();
  result.failedCancellationRunIds.sort();
  return result;
}
