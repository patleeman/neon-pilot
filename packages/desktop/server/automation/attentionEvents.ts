import {
  type AttentionEventDeliveryMode,
  type AttentionEventPriority,
  type AttentionEventRecord,
  cancelAttentionEvent,
  createReadyAttentionEvent,
  getSessionAttentionEvents,
  loadAttentionEventsState,
  readSessionConversationId,
  saveAttentionEventsState,
  scheduleAttentionEvent,
} from '@personal-agent/core';

import { parseDeferredResumeDelayMs } from './deferredResumes.js';
import { parseFutureHumanDateTime } from './humanDateTime.js';

function createAttentionEventId(now: Date): string {
  return `attention_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveValidNow(input?: Date): Date {
  return input instanceof Date && Number.isFinite(input.getTime()) ? input : new Date();
}

function resolveDueAt(input: { delay?: string; at?: string; now: Date }): string {
  if (input.delay && input.at) throw new Error('Specify only one of delay or at.');
  if (!input.delay && !input.at) return input.now.toISOString();
  if (input.delay) {
    const delayMs = parseDeferredResumeDelayMs(input.delay);
    if (!delayMs) throw new Error('Invalid delay. Use forms like 30s, 10m, 10 minutes, 2h, or 1d.');
    return new Date(input.now.getTime() + delayMs).toISOString();
  }
  return parseFutureHumanDateTime(input.at as string, { now: input.now }).dueAt;
}

export interface EnqueueAttentionEventInput {
  sessionFile: string;
  conversationId?: string;
  title?: string;
  prompt: string;
  delay?: string;
  at?: string;
  source?: { kind: string; id?: string; extensionId?: string };
  delivery?: {
    mode?: AttentionEventDeliveryMode;
    priority?: AttentionEventPriority;
    requireAck?: boolean;
    autoResumeIfOpen?: boolean;
    behavior?: 'steer' | 'followUp';
    batchKey?: string;
  };
  now?: Date;
}

export function listAttentionEventsForSessionFile(sessionFile: string): AttentionEventRecord[] {
  return getSessionAttentionEvents(loadAttentionEventsState(), sessionFile);
}

export function enqueueAttentionEventForSessionFile(input: EnqueueAttentionEventInput): AttentionEventRecord {
  const now = resolveValidNow(input.now);
  const dueAt = resolveDueAt({ delay: input.delay, at: input.at, now });
  const state = loadAttentionEventsState();
  const base = {
    id: createAttentionEventId(now),
    sessionFile: input.sessionFile,
    ...(input.conversationId?.trim()
      ? { conversationId: input.conversationId.trim() }
      : { conversationId: readSessionConversationId(input.sessionFile) }),
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    prompt: input.prompt.trim(),
    dueAt,
    createdAt: now.toISOString(),
    attempts: 0,
    source: input.source ?? { kind: 'extension' },
    delivery: input.delivery,
  };

  const record =
    Date.parse(dueAt) <= now.getTime()
      ? createReadyAttentionEvent(state, { ...base, readyAt: now.toISOString() })
      : scheduleAttentionEvent(state, base);
  saveAttentionEventsState(state);
  return record;
}

export function cancelAttentionEventForSessionFile(input: { sessionFile: string; id: string }): AttentionEventRecord {
  const state = loadAttentionEventsState();
  const record = state.events[input.id];
  if (!record || record.sessionFile !== input.sessionFile) throw new Error(`No attention event found for this conversation: ${input.id}`);
  const cancelled = cancelAttentionEvent(state, { id: input.id });
  saveAttentionEventsState(state);
  return cancelled as AttentionEventRecord;
}
