import { getStateRoot, resolveDesktopRootLayout } from '@neon-pilot/core';

import { type ActivityEntryBody, notifyActivityMutation, writeActivityEntry } from '../activity/activityEntries.js';
import type { DocumentsStore } from '../documents/store.js';
import { getDocumentsStore } from '../documents/store.js';
import { logError } from '../middleware/index.js';

export type AutomationLifecycleEvent = 'created' | 'updated' | 'enabled' | 'disabled' | 'deleted' | 'manual_run';

const AUTOMATION_LIFECYCLE_EVENTS: AutomationLifecycleEvent[] = ['created', 'updated', 'enabled', 'disabled', 'deleted', 'manual_run'];

/**
 * Write a durable Activity entry for an automations lifecycle event.
 *
 * Uses a deterministic id (`automation_lifecycle_<taskId>_<event>`) so
 * that repeated writes for the same event are idempotent. Callers are
 * responsible for providing the {@link DocumentsStore} (typically obtained
 * from route or API context).
 *
 * For enable/disable callers should only call this when the enabled state
 * actually changes, if the code has access to previous state.
 */
export function writeAutomationActivityEntry(
  store: DocumentsStore,
  taskId: string,
  event: AutomationLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  const id = `automation_lifecycle_${taskId}_${event}`;
  const type = `automation_${event}`;

  const body: ActivityEntryBody = {
    type,
    title: `Automation ${event}: ${title}`,
    source: 'Automation Service',
    kind: 'activity',
    metadata: {
      automationId: taskId,
      event,
      ...metadata,
    },
  };

  const doc = writeActivityEntry(store, body, id);
  notifyActivityMutation('activity.created', doc.id, doc.body as ActivityEntryBody, { automationId: taskId, event });
}

/**
 * Best-effort variant that acquires the DocumentsStore from the global
 * singleton and catches/logs any failure. Use this from capability functions
 * that do not already have a store reference.
 */
export function writeAutomationActivityEntrySafe(
  taskId: string,
  event: AutomationLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    const stateRoot = getStateRoot();
    const layout = resolveDesktopRootLayout();
    const store = getDocumentsStore(stateRoot, layout);
    writeAutomationActivityEntry(store, taskId, event, title, metadata);
  } catch (error) {
    logError('Failed to write automation activity entry', {
      taskId,
      event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Validate that an event string is a known lifecycle event.
 * Returns the validated event or undefined.
 */
export function parseAutomationLifecycleEvent(value: string): AutomationLifecycleEvent | undefined {
  const normalized = value.trim().toLowerCase() as AutomationLifecycleEvent;
  return AUTOMATION_LIFECYCLE_EVENTS.includes(normalized) ? normalized : undefined;
}
