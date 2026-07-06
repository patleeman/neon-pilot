/**
 * Execution Activity Producers Tests
 *
 * Proves that execution lifecycle mutations write Activity documents
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
import { writeExecutionActivityEntry } from './executionService.js';

describe('writeExecutionActivityEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'exec-activity-producers-'));
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

  it('writes an activity document for a completed execution', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-abc', 'pnpm test', 'completed', 'activity');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('exec_lifecycle_run-abc_completed');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('execution_completed');
    expect(body.title).toContain('pnpm test');
    expect(body.source).toBe('Execution Service');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ executionId: 'run-abc', status: 'completed' });
  });

  it('writes an activity document for a failed execution', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-def', 'deploy --env prod', 'failed', 'error', { exitCode: 1 });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('exec_lifecycle_run-def_failed');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('execution_failed');
    expect(body.kind).toBe('error');
    expect(body.metadata).toMatchObject({ executionId: 'run-def', status: 'failed', exitCode: 1 });
  });

  it('writes an activity document for a cancelled execution', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-ghi', 'long-running task', 'cancelled', 'error');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('execution_cancelled');
    expect(body.kind).toBe('error');
  });

  it('writes an activity document for a started execution (rerun / follow-up)', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-jkl', 'code review', 'started', 'activity', {
      sourceRunId: 'run-original',
      rerun: true,
    });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('execution_started');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ sourceRunId: 'run-original', rerun: true });
  });

  it('is idempotent because repeated writes with the same executionId and status overwrite', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-xyz', 'pnpm build', 'completed', 'activity');
    writeExecutionActivityEntry(store, 'run-xyz', 'pnpm build', 'completed', 'activity');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    // The same deterministic id means the upsert replaces the existing document.
    expect(docs.total).toBe(1);
  });

  it('notifies activity mutation (invalidates topics, publishes events)', () => {
    const store = getStore();
    writeExecutionActivityEntry(store, 'run-notify', 'check', 'completed', 'activity');

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
