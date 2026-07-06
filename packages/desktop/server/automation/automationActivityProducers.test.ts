/**
 * Automation Activity Producers Tests
 *
 * Proves that automation lifecycle events write Activity documents
 * and publish/invalidate the activity/documents topics.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateAppTopicsMock, logErrorMock, publishExtensionHostEventMock } = vi.hoisted(() => ({
  invalidateAppTopicsMock: vi.fn(),
  logErrorMock: vi.fn(),
  publishExtensionHostEventMock: vi.fn(),
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    publishEvent: publishExtensionHostEventMock,
  }),
}));

import { ACTIVITY_COLLECTION, ACTIVITY_OWNER, type ActivityEntryBody } from '../activity/activityEntries.js';
import { getDocumentsStore, resetDocumentsStoreSingleton } from '../documents/store.js';
import { writeAutomationActivityEntry } from './automationActivityProducers.js';

describe('writeAutomationActivityEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'automation-activity-producers-'));
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function getStore() {
    const desktopRootLayout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
    return getDocumentsStore(tmpDir, desktopRootLayout);
  }

  it('writes an activity document for automation created', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-abc', 'created', 'Daily Report');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('automation_lifecycle_task-abc_created');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('automation_created');
    expect(body.title).toContain('Daily Report');
    expect(body.source).toBe('Automation Service');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ automationId: 'task-abc', event: 'created' });
  });

  it('writes an activity document for automation updated', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-def', 'updated', 'Nightly Build', { changes: ['cron', 'model'] });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('automation_lifecycle_task-def_updated');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('automation_updated');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ automationId: 'task-def', event: 'updated', changes: ['cron', 'model'] });
  });

  it('writes an activity document for automation enabled', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-ghi', 'enabled', 'Weekly Digest');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('automation_enabled');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ automationId: 'task-ghi', event: 'enabled' });
  });

  it('writes an activity document for automation disabled', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-jkl', 'disabled', 'Legacy Check');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('automation_disabled');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for automation deleted', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-mno', 'deleted', 'Old Automation');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('automation_deleted');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for automation manual_run', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-pqr', 'manual_run', 'On-Demand Check', { triggeredBy: 'user' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('automation_manual_run');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ automationId: 'task-pqr', event: 'manual_run', triggeredBy: 'user' });
  });

  it('is idempotent because repeated writes with the same taskId and event overwrite', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-xyz', 'created', 'Idempotent Task');
    writeAutomationActivityEntry(store, 'task-xyz', 'created', 'Idempotent Task');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    // The same deterministic id means the upsert replaces the existing document.
    expect(docs.total).toBe(1);
  });

  it('notifies activity mutation (invalidates topics, publishes events)', () => {
    const store = getStore();
    writeAutomationActivityEntry(store, 'task-notify', 'created', 'Notify test');

    // invalidateAppTopics is called by notifyActivityMutation.
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('activity', 'documents');

    // publishEvent is called for both 'activity' and 'documents' topics.
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
      'activity',
      expect.objectContaining({
        type: 'activity.created',
        owner: 'activity',
        collection: 'activity-entries',
      }),
    );
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        type: 'document.updated',
        owner: 'activity',
        collection: 'activity-entries',
      }),
    );
  });
});
