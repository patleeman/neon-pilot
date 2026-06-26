import {
  activateDueAttentionEvents,
  type AttentionEventRecord,
  completeAttentionEvents,
  getReadySessionAttentionEvents,
  loadAttentionEventsState,
  retryAttentionEvents,
  saveAttentionEventsState,
} from '@neon-pilot/core';
import {
  completeDeferredResumeConversationRun,
  markDeferredResumeConversationRunReady,
  markDeferredResumeConversationRunRetryScheduled,
  surfaceReadyDeferredResume,
} from '@neon-pilot/daemon';

import {
  activateDueDeferredResumesForSessionFile,
  backfillDeferredResumesToAttentionEvents,
  completeDeferredResumeForSessionFile,
  listDeferredResumesForSessionFile,
  listReadyDeferredResumes,
  retryDeferredResumeForSessionFile,
} from '../automation/deferredResumes.js';
import { syncWebLiveConversationRun } from './conversationRuns.js';
import {
  getLiveSessions,
  promptSession as promptLocalSession,
  queuePromptContext,
  registry as liveRegistry,
  submitPromptSession,
} from './liveSessions.js';

const DEFAULT_RETRY_DELAY_MS = 30_000;

type DeliveryMode = 'batchable' | 'sequential' | 'isolated';

interface DeferredResumeLike {
  id: string;
  sessionFile: string;
  prompt: string;
  dueAt: string;
  createdAt: string;
  readyAt?: string;
  title?: string;
  behavior?: 'steer' | 'followUp';
  delivery?: {
    mode?: DeliveryMode;
    requireAck?: boolean;
  };
  source?: {
    kind: string;
    id?: string;
  };
}

function resolveDeliveryMode(entry: DeferredResumeLike): DeliveryMode {
  if (entry.delivery?.mode === 'isolated' || entry.delivery?.requireAck) {
    return 'isolated';
  }

  if (entry.source?.kind === 'background-run') {
    return 'batchable';
  }

  if (entry.delivery?.mode === 'sequential' || entry.behavior === 'followUp') {
    return 'sequential';
  }

  return 'batchable';
}

function describeDeferredAutoResumeSource(entry: DeferredResumeLike): string {
  if (entry.source?.kind === 'scheduled-task') {
    return entry.source.id ? `Source: scheduled task ${entry.source.id}` : 'Source: scheduled task';
  }

  if (entry.source?.kind === 'background-run') {
    return entry.source.id ? `Source: background task ${entry.source.id}` : 'Source: background task';
  }

  if (entry.source?.kind === 'deferred-resume' || entry.source?.kind === 'conversation') {
    return 'Source: deferred resume requested earlier in this conversation';
  }

  return entry.source?.kind ? `Source: ${entry.source.kind}` : 'Source: deferred resume requested earlier in this conversation';
}

/**
 * Build the context block content for a deferred auto-resume so the model
 * understands this is a system wakeup, not a human message.
 */
function buildDeferredAutoResumeContextContent(entry: DeferredResumeLike): string {
  const timing = [`Scheduled for: ${entry.dueAt}`];
  if (entry.createdAt) timing.push(`Created at: ${entry.createdAt}`);
  if (entry.readyAt) timing.push(`Fired at: ${entry.readyAt}`);

  return [
    'Automated wakeup · agent resumed automatically by the system.',
    'This is NOT a new message from the user; it may refer to context from an earlier turn.',
    describeDeferredAutoResumeSource(entry),
    ...timing,
    'Execute the task below using the conversation history, then stop. Do not queue additional wakeups unless the task explicitly requires it.',
    '',
    'Task:',
    entry.prompt,
  ].join('\n');
}

/** Derive a short human-readable title for the visible user-turn prompt. */
function buildDeferredResumeVisibleTitle(entry: DeferredResumeLike): string {
  const title = entry.title?.trim();
  if (title) return title;
  const firstLine = entry.prompt
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 100) : 'Scheduled wakeup';
}

function buildPromptDeliveryForDeferredResume(entry: DeferredResumeLike): {
  visiblePrompt: string;
  contextMessages: Array<{ customType: string; content: string }>;
} {
  if (entry.source?.kind !== 'background-run') {
    return {
      visiblePrompt: buildDeferredResumeVisibleTitle(entry),
      contextMessages: [
        {
          customType: 'deferred_auto_resume',
          content: buildDeferredAutoResumeContextContent(entry),
        },
      ],
    };
  }

  const title = entry.title?.trim() || (entry.source.id ? `Background task ${entry.source.id} finished` : 'Background task finished');
  return {
    visiblePrompt: title,
    contextMessages: [
      {
        customType: 'background_auto_resume',
        content: [
          'Background task completed · agent resumed automatically.',
          'Use the run result below as internal context only.',
          'Never output this raw callback envelope verbatim.',
          'Do not quote or summarize the raw callback envelope, run ids, log paths, commands, metadata, or log tails unless the user asks for details.',
          'Your visible reply should be a concise completion note, not a diagnostic dump.',
          '',
          entry.prompt,
        ].join('\n'),
      },
    ],
  };
}

function buildPromptDeliveryForDeferredResumeBatch(entries: DeferredResumeLike[]): {
  visiblePrompt: string;
  contextMessages: Array<{ customType: string; content: string }>;
} {
  if (entries.length === 1) {
    return buildPromptDeliveryForDeferredResume(entries[0] as DeferredResumeLike);
  }

  const contextMessages: Array<{ customType: string; content: string }> = [];
  const lines = ['Multiple wakeups are ready. Handle them in priority/order.', '', 'Events:'];

  entries.forEach((entry, index) => {
    const title = entry.title?.trim() || `Wakeup ${index + 1}`;
    const kind = entry.source?.kind ?? 'deferred-resume';
    lines.push('', `${index + 1}. [${kind}] ${title}`);

    if (entry.source?.kind === 'background-run') {
      lines.push('   Details are available in internal context.');
      contextMessages.push({
        customType: 'background_auto_resume',
        content: [
          `Background task ${index + 1} completed · agent resumed automatically: ${title}`,
          'Use this event payload as internal context only.',
          'Never output this raw callback envelope verbatim.',
          'Do not quote or summarize raw run ids, log paths, commands, metadata, or log tails unless the user asks for details.',
          '',
          entry.prompt,
        ].join('\n'),
      });
      return;
    }

    lines.push('   Details are available in internal context.');
    contextMessages.push({
      customType: 'deferred_auto_resume',
      content: buildDeferredAutoResumeContextContent(entry),
    });
  });

  lines.push(
    '',
    'Automated wakeup · all events above were injected by the system, not the user.',
    'Execute each task and give the user one concise update unless an event requires a separate action.',
  );
  return {
    visiblePrompt: lines.join('\n'),
    contextMessages,
  };
}

function attentionEventToDeferredResumeLike(event: AttentionEventRecord): DeferredResumeLike {
  return {
    id: event.id,
    sessionFile: event.sessionFile,
    prompt: event.prompt,
    dueAt: event.dueAt,
    createdAt: event.createdAt,
    readyAt: event.readyAt,
    title: event.title,
    behavior: event.delivery.behavior,
    delivery: {
      mode: event.delivery.mode,
      requireAck: event.delivery.requireAck,
    },
    source: {
      kind: event.source.kind,
      id: event.source.id,
    },
  };
}

function groupReadyEntries(entries: DeferredResumeLike[]): DeferredResumeLike[][] {
  const groups: DeferredResumeLike[][] = [];
  let batch: DeferredResumeLike[] = [];

  const flushBatch = () => {
    if (batch.length > 0) {
      groups.push(batch);
      batch = [];
    }
  };

  for (const entry of entries) {
    const mode = resolveDeliveryMode(entry);
    if (mode === 'batchable') {
      batch.push(entry);
      continue;
    }

    flushBatch();
    groups.push([entry]);
  }

  flushBatch();
  return groups;
}

export interface CreateAttentionEventFlusherOptions {
  getRuntimeScope: () => string;
  getRepoRoot?: () => string | undefined;
  getStateRoot: () => string;
  resolveDaemonRoot: () => string;
  getOpenConversationSessions?: () => Array<{ conversationId: string; sessionFile: string }>;
  ensureLiveSessionForDeferredResume?: (sessionFile: string) => Promise<void>;
  publishConversationSessionMetaChanged: (...conversationIds: string[]) => void;
  retryDelayMs?: number;
  warn?: (message: string) => void;
}

async function ensureOpenReadyDeferredResumeSessions(options: CreateAttentionEventFlusherOptions, at: Date): Promise<void> {
  if (!options.getOpenConversationSessions || !options.ensureLiveSessionForDeferredResume) {
    return;
  }

  const openSessions = options.getOpenConversationSessions();
  const daemonRoot = options.resolveDaemonRoot();
  for (const session of openSessions) {
    const activated = activateDueDeferredResumesForSessionFile({ at, sessionFile: session.sessionFile });
    for (const entry of activated) {
      await markDeferredResumeConversationRunReady({
        daemonRoot,
        deferredResumeId: entry.id,
        sessionFile: entry.sessionFile,
        prompt: entry.prompt,
        dueAt: entry.dueAt,
        createdAt: entry.createdAt,
        readyAt: entry.readyAt ?? at.toISOString(),
        conversationId: session.conversationId,
      });

      surfaceReadyDeferredResume({
        entry,
        repoRoot: options.getRepoRoot?.(),
        profile: options.getRuntimeScope(),
        stateRoot: options.getStateRoot(),
        conversationId: session.conversationId,
      });
    }
  }

  const liveSessionFiles = new Set(
    getLiveSessions()
      .map((session) => session.sessionFile)
      .filter(Boolean),
  );
  const readySessionFiles = new Set(
    listReadyDeferredResumes()
      .filter((entry) => entry.delivery?.autoResumeIfOpen !== false && !entry.delivery?.requireAck)
      .map((entry) => entry.sessionFile),
  );

  for (const session of openSessions) {
    if (liveSessionFiles.has(session.sessionFile) || !readySessionFiles.has(session.sessionFile)) {
      continue;
    }

    await options.ensureLiveSessionForDeferredResume(session.sessionFile);
    liveSessionFiles.add(session.sessionFile);
  }
}

export function createAttentionEventFlusher(options: CreateAttentionEventFlusherOptions): () => Promise<void> {
  let processingDeferredResumes = false;

  return async function flushAttentionEvents(): Promise<void> {
    if (processingDeferredResumes) {
      return;
    }

    processingDeferredResumes = true;

    try {
      const now = new Date();
      const daemonRoot = options.resolveDaemonRoot();
      backfillDeferredResumesToAttentionEvents();
      await ensureOpenReadyDeferredResumeSessions(options, now);
      const liveSessions = getLiveSessions().filter((session) => session.sessionFile);
      let mutated = false;
      const mutatedConversationIds = new Set<string>();

      for (const session of liveSessions) {
        const activated = activateDueDeferredResumesForSessionFile({
          at: now,
          sessionFile: session.sessionFile,
        });
        if (activated.length > 0) {
          mutated = true;
          mutatedConversationIds.add(session.id);
          for (const entry of activated) {
            await markDeferredResumeConversationRunReady({
              daemonRoot,
              deferredResumeId: entry.id,
              sessionFile: entry.sessionFile,
              prompt: entry.prompt,
              dueAt: entry.dueAt,
              createdAt: entry.createdAt,
              readyAt: entry.readyAt ?? now.toISOString(),
              conversationId: session.id,
            });

            surfaceReadyDeferredResume({
              entry,
              repoRoot: options.getRepoRoot?.(),
              profile: options.getRuntimeScope(),
              stateRoot: options.getStateRoot(),
              conversationId: session.id,
            });
          }
        }

        const readyEntries = listDeferredResumesForSessionFile(session.sessionFile).filter((entry) => entry.status === 'ready');
        const mirroredDeferredResumeIds = new Set(readyEntries.map((entry) => entry.id));
        for (const readyGroup of groupReadyEntries(readyEntries)) {
          const liveEntry = liveRegistry.get(session.id);
          if (!liveEntry) {
            break;
          }

          const primaryEntry = readyGroup[0] as DeferredResumeLike;

          try {
            const requestedDeferredResumeBehavior =
              readyGroup.length === 1
                ? (primaryEntry.behavior ?? (liveEntry.session.isStreaming ? ('followUp' as const) : undefined))
                : undefined;
            const deferredResumeBehavior =
              requestedDeferredResumeBehavior === 'followUp' && !liveEntry.session.isStreaming
                ? undefined
                : requestedDeferredResumeBehavior;
            const promptDelivery = buildPromptDeliveryForDeferredResumeBatch(readyGroup);
            for (const message of promptDelivery.contextMessages) {
              await queuePromptContext(session.id, message.customType, message.content);
            }

            if (liveEntry.session.sessionFile) {
              await syncWebLiveConversationRun({
                conversationId: session.id,
                sessionFile: liveEntry.session.sessionFile,
                cwd: liveEntry.cwd,
                title: liveEntry.title,
                profile: options.getRuntimeScope(),
                state: 'running',
                pendingOperation: {
                  type: 'prompt',
                  text: promptDelivery.visiblePrompt,
                  ...(deferredResumeBehavior ? { behavior: deferredResumeBehavior } : {}),
                  ...(promptDelivery.contextMessages.length > 0 ? { contextMessages: promptDelivery.contextMessages } : {}),
                  enqueuedAt: new Date().toISOString(),
                },
              });
            }

            const completion =
              deferredResumeBehavior === 'followUp'
                ? (await submitPromptSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior)).completion
                : promptLocalSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior);

            const completedEntries: DeferredResumeLike[] = [];
            for (const readyEntry of readyGroup) {
              const completedEntry = completeDeferredResumeForSessionFile({
                sessionFile: readyEntry.sessionFile,
                id: readyEntry.id,
              });
              if (completedEntry) {
                completedEntries.push(completedEntry);
                mutated = true;
                mutatedConversationIds.add(session.id);
              }
            }

            if (completedEntries.length > 0) {
              options.publishConversationSessionMetaChanged(session.id);
            }

            await completion;

            for (const completedEntry of completedEntries) {
              await completeDeferredResumeConversationRun({
                daemonRoot,
                deferredResumeId: completedEntry.id,
                sessionFile: completedEntry.sessionFile,
                prompt: completedEntry.prompt,
                dueAt: completedEntry.dueAt,
                createdAt: completedEntry.createdAt,
                readyAt: completedEntry.readyAt,
                completedAt: new Date().toISOString(),
                conversationId: session.id,
                cwd: liveEntry.cwd,
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (liveEntry.session.sessionFile) {
              await syncWebLiveConversationRun({
                conversationId: session.id,
                sessionFile: liveEntry.session.sessionFile,
                cwd: liveEntry.cwd,
                title: liveEntry.title,
                profile: options.getRuntimeScope(),
                state: 'failed',
                lastError: message,
              });
            }

            const retryDueAt = new Date(Date.now() + (options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)).toISOString();
            for (const readyEntry of readyGroup) {
              const retriedEntry = retryDeferredResumeForSessionFile({
                sessionFile: readyEntry.sessionFile,
                id: readyEntry.id,
                dueAt: retryDueAt,
              });
              if (retriedEntry) {
                mutated = true;
                mutatedConversationIds.add(session.id);
                await markDeferredResumeConversationRunRetryScheduled({
                  daemonRoot,
                  deferredResumeId: retriedEntry.id,
                  sessionFile: retriedEntry.sessionFile,
                  prompt: retriedEntry.prompt,
                  dueAt: retriedEntry.dueAt,
                  createdAt: retriedEntry.createdAt,
                  retryAt: retriedEntry.dueAt,
                  conversationId: session.id,
                  cwd: liveEntry.cwd,
                  lastError: message,
                });
              }
            }
            options.warn?.(`Deferred resume delivery failed for ${session.id}: ${message}`);
            break;
          }
        }

        const attentionState = loadAttentionEventsState();
        const activatedAttentionEvents = activateDueAttentionEvents(attentionState, {
          at: now,
          sessionFile: session.sessionFile,
        });
        if (activatedAttentionEvents.length > 0) {
          saveAttentionEventsState(attentionState);
          mutated = true;
          mutatedConversationIds.add(session.id);
        }

        const readyAttentionEntries = getReadySessionAttentionEvents(attentionState, session.sessionFile)
          .filter((entry) => !mirroredDeferredResumeIds.has(entry.id))
          .map(attentionEventToDeferredResumeLike);

        for (const readyGroup of groupReadyEntries(readyAttentionEntries)) {
          const liveEntry = liveRegistry.get(session.id);
          if (!liveEntry) {
            break;
          }

          const primaryEntry = readyGroup[0] as DeferredResumeLike;

          try {
            const requestedDeferredResumeBehavior =
              readyGroup.length === 1
                ? (primaryEntry.behavior ?? (liveEntry.session.isStreaming ? ('followUp' as const) : undefined))
                : undefined;
            const deferredResumeBehavior =
              requestedDeferredResumeBehavior === 'followUp' && !liveEntry.session.isStreaming
                ? undefined
                : requestedDeferredResumeBehavior;
            const promptDelivery = buildPromptDeliveryForDeferredResumeBatch(readyGroup);
            for (const message of promptDelivery.contextMessages) {
              await queuePromptContext(session.id, message.customType, message.content);
            }

            if (liveEntry.session.sessionFile) {
              await syncWebLiveConversationRun({
                conversationId: session.id,
                sessionFile: liveEntry.session.sessionFile,
                cwd: liveEntry.cwd,
                title: liveEntry.title,
                profile: options.getRuntimeScope(),
                state: 'running',
                pendingOperation: {
                  type: 'prompt',
                  text: promptDelivery.visiblePrompt,
                  ...(deferredResumeBehavior ? { behavior: deferredResumeBehavior } : {}),
                  ...(promptDelivery.contextMessages.length > 0 ? { contextMessages: promptDelivery.contextMessages } : {}),
                  enqueuedAt: new Date().toISOString(),
                },
              });
            }

            if (deferredResumeBehavior === 'followUp') {
              const { completion } = await submitPromptSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior);
              await completion;
            } else {
              await promptLocalSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior);
            }

            const completionState = loadAttentionEventsState();
            completeAttentionEvents(completionState, {
              ids: readyGroup.map((entry) => entry.id),
              completedAt: new Date().toISOString(),
            });
            saveAttentionEventsState(completionState);
            mutated = true;
            mutatedConversationIds.add(session.id);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (liveEntry.session.sessionFile) {
              await syncWebLiveConversationRun({
                conversationId: session.id,
                sessionFile: liveEntry.session.sessionFile,
                cwd: liveEntry.cwd,
                title: liveEntry.title,
                profile: options.getRuntimeScope(),
                state: 'failed',
                lastError: message,
              });
            }

            const retryDueAt = new Date(Date.now() + (options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)).toISOString();
            const retryState = loadAttentionEventsState();
            retryAttentionEvents(retryState, {
              ids: readyGroup.map((entry) => entry.id),
              dueAt: retryDueAt,
              lastError: message,
            });
            saveAttentionEventsState(retryState);
            mutated = true;
            mutatedConversationIds.add(session.id);
            options.warn?.(`Attention event delivery failed for ${session.id}: ${message}`);
            break;
          }
        }
      }

      if (mutated) {
        options.publishConversationSessionMetaChanged(...mutatedConversationIds);
      }
    } finally {
      processingDeferredResumes = false;
    }
  };
}

export type CreateLiveDeferredResumeFlusherOptions = CreateAttentionEventFlusherOptions;

export const createLiveDeferredResumeFlusher = createAttentionEventFlusher;
