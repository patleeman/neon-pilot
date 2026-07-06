/**
 * Extension Activity Producers
 *
 * Durable Activity entries for extension lifecycle events.
 * Produces deterministic-id entries for clearly user-visible events:
 * created, imported, enabled, disabled, deleted, snapshotted, exported.
 *
 * Skips status checks, read/list queries, action invocations, and other
 * non-lifecycle activity.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import { type DesktopRootLayout, getStateRoot, resolveDesktopRootLayout } from '@neon-pilot/core';

import { type ActivityEntryBody, notifyActivityMutation, writeActivityEntry } from '../activity/activityEntries.js';
import type { DocumentsStore } from '../documents/store.js';
import { getDocumentsStore } from '../documents/store.js';
import { logError } from '../middleware/index.js';

export type ExtensionLifecycleEvent = 'created' | 'imported' | 'enabled' | 'disabled' | 'deleted' | 'snapshotted' | 'exported';

const EXTENSION_LIFECYCLE_EVENTS: ExtensionLifecycleEvent[] = [
  'created',
  'imported',
  'enabled',
  'disabled',
  'deleted',
  'snapshotted',
  'exported',
];

/**
 * Write an activity entry for an extension lifecycle event.
 *
 * Uses a deterministic id (`extension_lifecycle_<extensionId>_<event>`)
 * so that repeated writes for the same event are idempotent. Callers are
 * responsible for providing the {@link DocumentsStore} (typically obtained
 * from route or API context).
 *
 * @param store        The documents store instance.
 * @param extensionId  The extension's id.
 * @param event        The lifecycle event.
 * @param title        Human-readable title for the activity entry.
 * @param metadata     Additional metadata to include.
 */
export function writeExtensionActivityEntry(
  store: DocumentsStore,
  extensionId: string,
  event: ExtensionLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  const id = `extension_lifecycle_${extensionId}_${event}`;
  const type = `extension_${event}`;

  const body: ActivityEntryBody = {
    type,
    title: `Extension ${event}: ${title}`,
    source: 'Extension Manager',
    kind: 'activity',
    metadata: {
      extensionId,
      event,
      ...metadata,
    },
  };

  const doc = writeActivityEntry(store, body, id);
  notifyActivityMutation('activity.created', doc.id, doc.body as ActivityEntryBody, { extensionId, event });
}

/**
 * Best-effort variant that acquires the DocumentsStore from the global
 * singleton and catches/logs any failure. Use this from route handlers
 * and capability functions that do not already have a store reference.
 */
export function writeExtensionActivityEntrySafe(
  extensionId: string,
  event: ExtensionLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
  layout?: DesktopRootLayout,
): void {
  try {
    const stateRoot = getStateRoot();
    const desktopRootLayout = layout ?? resolveDesktopRootLayout();
    const store = getDocumentsStore(stateRoot, desktopRootLayout);
    writeExtensionActivityEntry(store, extensionId, event, title, metadata);
  } catch (error) {
    logError('Failed to write extension activity entry', {
      extensionId,
      event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Validate that an event string is a known lifecycle event.
 * Returns the validated event or undefined.
 */
export function parseExtensionLifecycleEvent(value: string): ExtensionLifecycleEvent | undefined {
  const normalized = value.trim().toLowerCase() as ExtensionLifecycleEvent;
  return EXTENSION_LIFECYCLE_EVENTS.includes(normalized) ? normalized : undefined;
}
