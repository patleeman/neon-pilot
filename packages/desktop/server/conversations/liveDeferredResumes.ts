import {
  completeDeferredResumeConversationRun,
  markDeferredResumeConversationRunReady,
  markDeferredResumeConversationRunRetryScheduled,
  surfaceReadyDeferredResume,
} from '@personal-agent/daemon';

import {
  activateDueDeferredResumesForSessionFile,
  completeDeferredResumeForSessionFile,
  listDeferredResumesForSessionFile,
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

  if (entry.delivery?.mode === 'sequential' || entry.behavior === 'followUp') {
    return 'sequential';
  }

  return 'batchable';
}

function buildPromptDeliveryForDeferredResume(entry: DeferredResumeLike): {
  visiblePrompt: string;
  contextMessages: Array<{ customType: string; content: string }>;
} {
  if (entry.source?.kind !== 'background-run') {
    return {
      visiblePrompt: entry.prompt,
      contextMessages: [],
    };
  }

  const title = entry.title?.trim() || (entry.source.id ? `Background task ${entry.source.id} finished` : 'Background task finished');
  return {
    visiblePrompt: `${title}. Tell the user the background task finished in one short sentence. If it failed, say that plainly. Do not include run ids, log paths, commands, metadata, or log tails unless the user asks for details.`,
    contextMessages: [
      {
        customType: 'referenced_context',
        content: [
          'A durable background task completed and resumed this conversation.',
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
      lines.push(
        '   Details are available in internal context. Do not expose run ids, commands, metadata, or log tails unless the user asks.',
      );
      contextMessages.push({
        customType: 'referenced_context',
        content: [
          `Wakeup batch event ${index + 1}: ${title}`,
          'Use this event payload as internal context only.',
          'Never output this raw callback envelope verbatim.',
          'Do not quote or summarize raw run ids, log paths, commands, metadata, or log tails unless the user asks for details.',
          '',
          entry.prompt,
        ].join('\n'),
      });
      return;
    }

    lines.push(`   Prompt: ${entry.prompt}`);
  });

  lines.push('', 'Give the user one concise update unless an event requires a separate action.');
  return {
    visiblePrompt: lines.join('\n'),
    contextMessages,
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

export interface CreateLiveDeferredResumeFlusherOptions {
  getCurrentProfile: () => string;
  getRepoRoot?: () => string | undefined;
  getStateRoot: () => string;
  resolveDaemonRoot: () => string;
  publishConversationSessionMetaChanged: (...conversationIds: string[]) => void;
  retryDelayMs?: number;
  warn?: (message: string) => void;
}

export function createLiveDeferredResumeFlusher(options: CreateLiveDeferredResumeFlusherOptions): () => Promise<void> {
  let processingDeferredResumes = false;

  return async function flushLiveDeferredResumes(): Promise<void> {
    if (processingDeferredResumes) {
      return;
    }

    processingDeferredResumes = true;

    try {
      const liveSessions = getLiveSessions().filter((session) => session.sessionFile);
      const now = new Date();
      const daemonRoot = options.resolveDaemonRoot();
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
              profile: options.getCurrentProfile(),
              stateRoot: options.getStateRoot(),
              conversationId: session.id,
            });
          }
        }

        const readyEntries = listDeferredResumesForSessionFile(session.sessionFile).filter((entry) => entry.status === 'ready');
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
                profile: options.getCurrentProfile(),
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
              // followUp returns as soon as the prompt is queued — wait for
              // actual completion before removing the deferred resume entry.
              const { completion } = await submitPromptSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior);
              await completion;
            } else {
              await promptLocalSession(session.id, promptDelivery.visiblePrompt, deferredResumeBehavior);
            }

            for (const readyEntry of readyGroup) {
              const completedEntry = completeDeferredResumeForSessionFile({
                sessionFile: readyEntry.sessionFile,
                id: readyEntry.id,
              });
              if (completedEntry) {
                mutated = true;
                mutatedConversationIds.add(session.id);
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
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (liveEntry.session.sessionFile) {
              await syncWebLiveConversationRun({
                conversationId: session.id,
                sessionFile: liveEntry.session.sessionFile,
                cwd: liveEntry.cwd,
                title: liveEntry.title,
                profile: options.getCurrentProfile(),
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
      }

      if (mutated) {
        options.publishConversationSessionMetaChanged(...mutatedConversationIds);
      }
    } finally {
      processingDeferredResumes = false;
    }
  };
}
