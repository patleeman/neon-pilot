/**
 * Activity Entries
 *
 * Durable activity timeline entries backed by the Documents store.
 * Entries live in the `activity` owner, `activity-entries` collection,
 * providing a lightweight, queryable timeline for host and system code.
 *
 * This is the foundation for richer activity surfacing in Windowed OS
 * and Agentic OS: background tasks, window/app lifecycle events,
 * milestone tracking, etc.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import type { DocumentRecord, DocumentsStore } from '../documents/store.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { invalidateAppTopics, logError } from '../middleware/index.js';

// ── Constants ──────────────────────────────────────────────────────────

export const ACTIVITY_OWNER = 'activity';
export const ACTIVITY_COLLECTION = 'activity-entries';

export const VALID_ACTIVITY_ENTRY_TYPES = [
  'window_open',
  'window_close',
  'app_launch',
  'app_close',
  'navigation',
  'milestone',
  'error',
  'state_change',
  'info',
  'system',
] as const;

export const VALID_ACTIVITY_ENTRY_KINDS = ['activity', 'milestone', 'error'] as const;

export type ActivityEntryType = (typeof VALID_ACTIVITY_ENTRY_TYPES)[number];
export type ActivityEntryKind = (typeof VALID_ACTIVITY_ENTRY_KINDS)[number];

// ── Types ──────────────────────────────────────────────────────────────

export interface ActivityEntryBody {
  /** Machine-readable type categorising this entry. */
  type: string;
  /** Human-readable title. */
  title: string;
  /** Optional subtitle / secondary text. */
  subtitle?: string;
  /** Who or what produced this entry (e.g. "Window manager", "Orchestrator"). */
  source?: string;
  /** Optional kind qualifier for UI treatment. */
  kind?: ActivityEntryKind;
  /** Arbitrary extensible metadata. */
  metadata?: Record<string, unknown>;
  /** Whether the entry has been consumed / processed downstream. */
  processed?: boolean;
}

export type CreateActivityEntryInput = ActivityEntryBody;

// ── ID generation ──────────────────────────────────────────────────────

export function generateActivityEntryId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `act_${time}_${rand}`;
}

// ── Write helper ───────────────────────────────────────────────────────

/**
 * Write an activity entry to the documents store.
 * Returns the created DocumentRecord.
 */
export function writeActivityEntry(store: DocumentsStore, input: CreateActivityEntryInput, id?: string): DocumentRecord {
  const entryId = id?.trim() || generateActivityEntryId();
  const body: ActivityEntryBody = {
    type: input.type,
    title: input.title,
    ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    ...(input.processed !== undefined ? { processed: input.processed } : {}),
  };

  return store.putDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, entryId, body);
}

// ── Event notification ─────────────────────────────────────────────────

function publishExtensionEvent(topic: 'documents' | 'activity', payload: unknown): void {
  let extensionHostClient: ReturnType<typeof getExtensionHostClient>;
  try {
    extensionHostClient = getExtensionHostClient();
  } catch (error) {
    logError(`${topic} event publish skipped`, { message: error instanceof Error ? error.message : String(error) });
    return;
  }
  void Promise.resolve(extensionHostClient.publishEvent(topic, payload)).catch((error) => {
    logError(`${topic} event publish failed`, { message: error instanceof Error ? error.message : String(error) });
  });
}

export function notifyActivityMutation(
  type: string,
  id: string,
  body: ActivityEntryBody | undefined,
  extra?: Record<string, unknown>,
): void {
  invalidateAppTopics('activity', 'documents');
  publishExtensionEvent('activity', { type, owner: ACTIVITY_OWNER, collection: ACTIVITY_COLLECTION, id, ...extra });
  publishExtensionEvent('documents', {
    type: type === 'activity.deleted' ? 'document.deleted' : 'document.updated',
    owner: ACTIVITY_OWNER,
    collection: ACTIVITY_COLLECTION,
    id,
    ...(body === undefined ? {} : { body }),
  });
}
