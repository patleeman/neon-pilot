import { existsSync } from 'node:fs';

import { logWarn } from '../shared/logging.js';
import { readGitRepoInfo } from '../workspace/gitStatus.js';
import { buildParallelImportedContent, resolveStableForkEntryId } from './liveSessionForking.js';
import type { LiveSessionLoaderOptions } from './liveSessionLoader.js';
import {
  generateParallelWorkerName,
  normalizeParallelPromptList,
  type ParallelPromptJob,
  type ParallelPromptJobStatus,
  type ParallelPromptWorkerRole,
} from './liveSessionParallelJobs.js';
import {
  readParallelCurrentWorktreeDirtyPaths,
  readParallelJobCompletionFromSessionFile,
  replacePersistedParallelJob,
  type ResolveParallelChildSession,
} from './liveSessionParallelReconciliation.js';
import type { PromptAudioAttachment, PromptDocumentAttachment, PromptImageAttachment, PromptVideoAttachment } from './liveSessionQueue.js';

export interface LiveSessionParallelImportHost {
  sessionId: string;
  cwd: string;
  session: {
    isStreaming: boolean;
    sessionFile?: string | null;
    model?: { id?: string } | null;
    thinkingLevel?: string | null;
    sessionManager?: unknown;
  };
  parallelJobs?: ParallelPromptJob[];
  importingParallelJobs?: boolean;
}

export interface LiveSessionParallelChildHost {
  session: {
    isStreaming: boolean;
    abort: () => Promise<void>;
  };
  listeners: Set<unknown>;
  presenceBySurfaceId?: Map<string, unknown>;
}

export interface LiveSessionParallelImportCallbacks<TEntry extends LiveSessionParallelImportHost> {
  hasQueuedOrActiveStaleTurn: (entry: TEntry) => boolean;
  persistParallelJobs: (entry: TEntry) => void;
  broadcastParallelState: (entry: TEntry, force?: boolean) => void;
  appendParallelImportedMessage: (
    sessionId: string,
    content: string,
    details: { childConversationId: string; status: 'complete' | 'failed' },
  ) => Promise<void>;
  finalizeParallelChildLiveSession: (
    childConversationId: string,
    options?: { abortIfRunning?: boolean },
  ) => Promise<'destroyed' | 'preserved' | 'missing'>;
}

export async function startParallelPromptSession<TEntry extends LiveSessionParallelImportHost>(
  entry: TEntry,
  input: {
    text: string;
    images?: PromptImageAttachment[];
    videos?: PromptVideoAttachment[];
    audios?: PromptAudioAttachment[];
    documents?: PromptDocumentAttachment[];
    attachmentRefs?: string[];
    contextMessages?: Array<{ customType: string; content: string }>;
    cwd?: string;
    model?: string | null;
    thinkingLevel?: string | null;
    serviceTier?: string | null;
    ownerExtensionId?: string;
    purpose?: string;
    metadata?: Record<string, unknown>;
    autoImport?: boolean;
  },
  options: LiveSessionLoaderOptions,
  callbacks: {
    createJobId: () => string;
    createSession: (cwd: string, options: LiveSessionLoaderOptions) => Promise<{ id: string; sessionFile: string }>;
    forkSession: (
      sessionId: string,
      entryId: string,
      options: LiveSessionLoaderOptions & { preserveSource?: boolean; cwdOverride?: string },
    ) => Promise<{ newSessionId: string; sessionFile: string }>;
    queuePromptContext: (sessionId: string, customType: string, content: string) => Promise<void>;
    submitPromptSession: (
      sessionId: string,
      text: string,
      behavior?: 'steer' | 'followUp',
      images?: PromptImageAttachment[],
      videos?: PromptVideoAttachment[],
      audios?: PromptAudioAttachment[],
      documents?: PromptDocumentAttachment[],
    ) => Promise<{ acceptedAs: 'started' | 'queued'; completion: Promise<void> }>;
    resolveDefaultServiceTier: (entry: TEntry) => LiveSessionLoaderOptions['initialServiceTier'];
    hasQueuedOrActiveStaleTurn: (entry: TEntry) => boolean;
    persistParallelJobs: (entry: TEntry) => void;
    broadcastParallelState: (entry: TEntry, force?: boolean) => void;
    getCurrentEntry: () => TEntry | undefined;
    resolveParallelChildSession: ResolveParallelChildSession;
    tryImportReadyParallelJobs: (entry: TEntry) => Promise<void>;
  },
): Promise<{ jobId: string; childConversationId: string }> {
  const text = input.text.trim();
  if (
    !text &&
    (!input.images || input.images.length === 0) &&
    (!input.videos || input.videos.length === 0) &&
    (!input.audios || input.audios.length === 0) &&
    (!input.documents || input.documents.length === 0)
  ) {
    throw new Error('text, images, videos, audio, or documents required');
  }

  const sourceSessionFile = entry.session.sessionFile?.trim();
  if (!sourceSessionFile) {
    throw new Error('Parallel prompts require a persisted session file.');
  }

  const activeTurnInProgress = entry.session.isStreaming || callbacks.hasQueuedOrActiveStaleTurn(entry);
  if (!activeTurnInProgress) {
    throw new Error('Parallel prompts are only available while the conversation is busy.');
  }

  const parallelRepoRoot = readGitRepoInfo(entry.cwd)?.root;
  const childCwd = input.cwd?.trim() || entry.cwd;
  const stableEntryId = resolveStableForkEntryId(sourceSessionFile, { activeTurnInProgress });
  const forked = stableEntryId
    ? await callbacks.forkSession(entry.sessionId, stableEntryId, {
        preserveSource: true,
        ...options,
        cwdOverride: childCwd,
        ...(input.model !== undefined ? { initialModel: input.model } : {}),
        ...(input.thinkingLevel !== undefined ? { initialThinkingLevel: input.thinkingLevel } : {}),
        ...(input.serviceTier !== undefined ? { initialServiceTier: input.serviceTier } : {}),
      })
    : await callbacks.createSession(childCwd, {
        ...options,
        initialModel:
          input.model !== undefined
            ? input.model
            : options.initialModel === undefined
              ? (entry.session.model?.id ?? null)
              : options.initialModel,
        initialThinkingLevel:
          input.thinkingLevel !== undefined
            ? input.thinkingLevel
            : options.initialThinkingLevel === undefined
              ? (entry.session.thinkingLevel ?? null)
              : options.initialThinkingLevel,
        initialServiceTier:
          input.serviceTier !== undefined
            ? input.serviceTier
            : options.initialServiceTier === undefined
              ? callbacks.resolveDefaultServiceTier(entry)
              : options.initialServiceTier,
      });

  const childConversationId = 'id' in forked ? forked.id : forked.newSessionId;
  const job = createRunningParallelPromptJob({
    id: callbacks.createJobId(),
    prompt: text,
    childConversationId,
    childSessionFile: forked.sessionFile,
    imageCount: input.images?.length ?? 0,
    attachmentRefs: input.attachmentRefs,
    forkEntryId: stableEntryId ?? undefined,
    repoRoot: parallelRepoRoot,
    cwd: entry.cwd,
    childCwd,
    ownerExtensionId: input.ownerExtensionId,
    purpose: input.purpose,
    modelRef: input.model ?? undefined,
    metadata: input.metadata,
    autoImport: input.autoImport,
  });
  entry.parallelJobs ??= [];
  entry.parallelJobs.push(job);
  callbacks.persistParallelJobs(entry);
  callbacks.broadcastParallelState(entry, true);

  try {
    for (const message of input.contextMessages ?? []) {
      await callbacks.queuePromptContext(childConversationId, message.customType, message.content);
    }

    const submitted = await callbacks.submitPromptSession(
      childConversationId,
      text,
      undefined,
      input.images,
      input.videos,
      input.audios,
      input.documents,
    );
    const completionInput = {
      sourceSessionFile,
      jobId: job.id,
      childSessionFile: forked.sessionFile,
      cwd: entry.cwd,
      childCwd,
      repoRoot: parallelRepoRoot,
      getCurrentEntry: callbacks.getCurrentEntry,
      resolveParallelChildSession: callbacks.resolveParallelChildSession,
      broadcastParallelState: callbacks.broadcastParallelState,
      tryImportReadyParallelJobs: callbacks.tryImportReadyParallelJobs,
    };
    void submitted.completion
      .then(() => handleParallelPromptCompletion(completionInput))
      .catch((error: unknown) => handleParallelPromptCompletion({ ...completionInput, error }));

    return {
      jobId: job.id,
      childConversationId,
    };
  } catch (error) {
    entry.parallelJobs = entry.parallelJobs.filter((candidate) => candidate.id !== job.id);
    callbacks.persistParallelJobs(entry);
    callbacks.broadcastParallelState(entry, true);
    throw error;
  }
}

export function createRunningParallelPromptJob(input: {
  id: string;
  prompt: string;
  childConversationId: string;
  childSessionFile: string;
  imageCount?: number;
  attachmentRefs?: string[];
  forkEntryId?: string;
  repoRoot?: string;
  cwd: string;
  childCwd?: string;
  ownerExtensionId?: string;
  purpose?: string;
  modelRef?: string | null;
  metadata?: Record<string, unknown>;
  autoImport?: boolean;
}): ParallelPromptJob {
  const now = new Date().toISOString();
  const workerName = generateParallelWorkerName({
    id: input.id,
    prompt: input.prompt,
    childConversationId: input.childConversationId,
    purpose: input.purpose,
  });
  return {
    id: input.id,
    prompt: input.prompt,
    childConversationId: input.childConversationId,
    childSessionFile: input.childSessionFile,
    status: 'running',
    workerRole: 'worker' satisfies ParallelPromptWorkerRole,
    workerName,
    ...(input.ownerExtensionId ? { ownerExtensionId: input.ownerExtensionId } : {}),
    ...(input.purpose ? { purpose: input.purpose } : {}),
    ...(input.modelRef ? { modelRef: input.modelRef } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    autoImport: input.autoImport === false ? false : true,
    createdAt: now,
    updatedAt: now,
    imageCount: input.imageCount ?? 0,
    attachmentRefs: normalizeParallelPromptList(input.attachmentRefs, 12),
    touchedFiles: [],
    parentTouchedFiles: [],
    overlapFiles: [],
    sideEffects: [],
    ...(input.forkEntryId ? { forkEntryId: input.forkEntryId } : {}),
    ...(input.repoRoot ? { repoRoot: input.repoRoot } : {}),
    worktreeDirtyPathsAtStart: readParallelCurrentWorktreeDirtyPaths(input.cwd, input.repoRoot),
  };
}

export async function handleParallelPromptCompletion<TEntry extends LiveSessionParallelImportHost>(input: {
  sourceSessionFile: string;
  jobId: string;
  childSessionFile: string;
  cwd: string;
  childCwd?: string;
  repoRoot?: string;
  error?: unknown;
  getCurrentEntry: () => TEntry | undefined;
  resolveParallelChildSession: ResolveParallelChildSession;
  broadcastParallelState: (entry: TEntry, force?: boolean) => void;
  tryImportReadyParallelJobs: (entry: TEntry) => Promise<void>;
}): Promise<void> {
  const completion = existsSync(input.childSessionFile)
    ? readParallelJobCompletionFromSessionFile(input.childSessionFile, { cwd: input.childCwd ?? input.cwd, repoRoot: input.repoRoot })
    : { hasTerminalReply: false, touchedFiles: [] as string[], sideEffects: [] as string[] };
  const failed = input.error !== undefined;
  const nextJobs = replacePersistedParallelJob(
    input.sourceSessionFile,
    input.jobId,
    (currentJob) => ({
      ...currentJob,
      childSessionFile: input.childSessionFile,
      status: failed ? 'failed' : (completion.status ?? 'ready'),
      updatedAt: new Date().toISOString(),
      touchedFiles: completion.touchedFiles,
      sideEffects: completion.sideEffects,
      ...(failed || completion.status === 'failed'
        ? {
            error:
              completion.error ??
              (input.error instanceof Error
                ? input.error.message
                : input.error !== undefined
                  ? String(input.error)
                  : 'The parallel prompt failed before completing.'),
          }
        : {}),
      ...((!failed && completion.status === 'ready') || completion.resultText !== undefined
        ? { resultText: completion.resultText ?? '' }
        : {}),
    }),
    input.resolveParallelChildSession,
  );
  const currentEntry = input.getCurrentEntry();
  if (!currentEntry || currentEntry.session.sessionFile?.trim() !== input.sourceSessionFile) {
    return;
  }

  currentEntry.parallelJobs = nextJobs;
  input.broadcastParallelState(currentEntry, true);
  await input.tryImportReadyParallelJobs(currentEntry);
}

export function shouldPreserveParallelChildLiveSession(entry: LiveSessionParallelChildHost | undefined): boolean {
  if (!entry) {
    return false;
  }

  return entry.listeners.size > 0 || (entry.presenceBySurfaceId?.size ?? 0) > 0;
}

export async function finalizeParallelChildLiveSession(
  childConversationId: string,
  input: {
    childEntry: LiveSessionParallelChildHost | undefined;
    destroySession: (childConversationId: string) => void;
    abortIfRunning?: boolean;
  },
): Promise<'destroyed' | 'preserved' | 'missing'> {
  const childEntry = input.childEntry;
  if (!childEntry) {
    return 'missing';
  }

  if (input.abortIfRunning && childEntry.session.isStreaming) {
    try {
      await childEntry.session.abort();
    } catch (error) {
      logWarn('parallel child abort failed before cleanup', {
        conversationId: childConversationId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  if (shouldPreserveParallelChildLiveSession(childEntry)) {
    return 'preserved';
  }

  if (!input.abortIfRunning && childEntry.session.isStreaming) {
    return 'preserved';
  }

  input.destroySession(childConversationId);
  return 'destroyed';
}

export async function tryImportReadyParallelJobs<TEntry extends LiveSessionParallelImportHost>(
  entry: TEntry,
  callbacks: LiveSessionParallelImportCallbacks<TEntry>,
): Promise<void> {
  entry.parallelJobs ??= [];
  if (entry.importingParallelJobs || entry.session.isStreaming || callbacks.hasQueuedOrActiveStaleTurn(entry)) {
    return;
  }

  const nextJob = entry.parallelJobs[0];
  if (!nextJob || (nextJob.status !== 'ready' && nextJob.status !== 'failed')) {
    return;
  }

  entry.importingParallelJobs = true;
  try {
    while (!entry.session.isStreaming && !callbacks.hasQueuedOrActiveStaleTurn(entry)) {
      const currentJob = entry.parallelJobs[0];
      if (!currentJob || (currentJob.status !== 'ready' && currentJob.status !== 'failed')) {
        break;
      }
      if (currentJob.autoImport === false) {
        break;
      }

      const fallbackStatus: Extract<ParallelPromptJobStatus, 'ready' | 'failed'> = currentJob.error?.trim() ? 'failed' : 'ready';
      currentJob.status = 'importing';
      currentJob.updatedAt = new Date().toISOString();
      callbacks.persistParallelJobs(entry);
      callbacks.broadcastParallelState(entry, true);

      try {
        await callbacks.appendParallelImportedMessage(entry.sessionId, buildParallelImportedContent(currentJob), {
          childConversationId: currentJob.childConversationId,
          status: currentJob.error?.trim() ? 'failed' : 'complete',
        });
      } catch (error) {
        currentJob.status = fallbackStatus;
        currentJob.updatedAt = new Date().toISOString();
        callbacks.persistParallelJobs(entry);
        callbacks.broadcastParallelState(entry, true);
        throw error;
      }

      entry.parallelJobs.shift();
      callbacks.persistParallelJobs(entry);
      callbacks.broadcastParallelState(entry, true);
      await callbacks.finalizeParallelChildLiveSession(currentJob.childConversationId);
    }
  } finally {
    entry.importingParallelJobs = false;
  }
}

export async function manageParallelPromptJob<TEntry extends LiveSessionParallelImportHost>(
  entry: TEntry,
  input: { jobId: string; action: 'importNow' | 'skip' | 'cancel'; callerExtensionId?: string },
  callbacks: Pick<
    LiveSessionParallelImportCallbacks<TEntry>,
    'persistParallelJobs' | 'broadcastParallelState' | 'finalizeParallelChildLiveSession'
  > & {
    tryImportReadyParallelJobs: (entry: TEntry) => Promise<void>;
  },
): Promise<{ ok: true; status: 'imported' | 'queued' | 'skipped' | 'cancelled' }> {
  const jobId = input.jobId.trim();
  if (!jobId) {
    throw new Error('jobId required');
  }

  entry.parallelJobs ??= [];
  const jobIndex = entry.parallelJobs.findIndex((candidate) => candidate.id === jobId);
  if (jobIndex < 0) {
    throw new Error('Parallel prompt no longer exists.');
  }

  const job = entry.parallelJobs[jobIndex]!;
  const callerExtensionId = input.callerExtensionId?.trim();
  if (job.ownerExtensionId && callerExtensionId && job.ownerExtensionId !== callerExtensionId) {
    throw new Error('Parallel prompt is owned by another extension.');
  }
  if (input.action === 'skip') {
    if (job.status === 'running') {
      throw new Error('Use cancel to stop a running parallel prompt.');
    }
    if (job.status === 'importing') {
      throw new Error('Parallel prompt is already being appended.');
    }

    entry.parallelJobs.splice(jobIndex, 1);
    callbacks.persistParallelJobs(entry);
    callbacks.broadcastParallelState(entry, true);
    await callbacks.finalizeParallelChildLiveSession(job.childConversationId);
    return { ok: true, status: 'skipped' };
  }

  if (input.action === 'cancel') {
    if (job.status === 'importing') {
      throw new Error('Parallel prompt is already being appended.');
    }

    entry.parallelJobs.splice(jobIndex, 1);
    callbacks.persistParallelJobs(entry);
    callbacks.broadcastParallelState(entry, true);
    await callbacks.finalizeParallelChildLiveSession(job.childConversationId, { abortIfRunning: true });
    return { ok: true, status: 'cancelled' };
  }

  if (job.status !== 'ready' && job.status !== 'failed') {
    throw new Error('Only completed parallel prompts can be imported now.');
  }

  if (jobIndex > 0) {
    entry.parallelJobs.splice(jobIndex, 1);
    entry.parallelJobs.unshift(job);
    callbacks.persistParallelJobs(entry);
    callbacks.broadcastParallelState(entry, true);
  }

  await callbacks.tryImportReadyParallelJobs(entry);
  const imported = !(entry.parallelJobs ?? []).some((candidate) => candidate.id === jobId);
  return { ok: true, status: imported ? 'imported' : 'queued' };
}
