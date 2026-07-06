/**
 * Conversation Activity Producers
 *
 * Durable Activity entries for conversation lifecycle events.
 * Produces deterministic-id entries for clearly user-visible events:
 * created, forked, renamed, deleted, opened, closed, duplicated.
 *
 * Skips token/message/tool deltas, queue updates, and focus-only UI state.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import { type ActivityEntryBody, notifyActivityMutation, writeActivityEntry } from '../activity/activityEntries.js';
import type { DocumentsStore } from '../documents/store.js';

export type ConversationLifecycleEvent = 'created' | 'forked' | 'renamed' | 'deleted' | 'opened' | 'closed' | 'duplicated';

const CONVERSATION_LIFECYCLE_EVENTS: ConversationLifecycleEvent[] = [
  'created',
  'forked',
  'renamed',
  'deleted',
  'opened',
  'closed',
  'duplicated',
];

/**
 * Write an activity entry for a conversation lifecycle event.
 *
 * Uses a deterministic id (`conv_lifecycle_<conversationId>_<event>`) so
 * that repeated writes for the same event are idempotent. Callers are
 * responsible for providing the {@link DocumentsStore} (typically obtained
 * from route or API context).
 */
export function writeConversationActivityEntry(
  store: DocumentsStore,
  conversationId: string,
  event: ConversationLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  const id = `conv_lifecycle_${conversationId}_${event}`;
  const type = `conversation_${event}`;

  const body: ActivityEntryBody = {
    type,
    title: `Conversation ${event}: ${title}`,
    source: 'Conversation Service',
    kind: 'activity',
    metadata: {
      conversationId,
      event,
      ...metadata,
    },
  };

  const doc = writeActivityEntry(store, body, id);
  notifyActivityMutation('activity.created', doc.id, doc.body as ActivityEntryBody, { conversationId, event });
}

/**
 * Validate that an event string is a known lifecycle event.
 * Returns the validated event or undefined.
 */
export function parseConversationLifecycleEvent(value: string): ConversationLifecycleEvent | undefined {
  const normalized = value.trim().toLowerCase() as ConversationLifecycleEvent;
  return CONVERSATION_LIFECYCLE_EVENTS.includes(normalized) ? normalized : undefined;
}
