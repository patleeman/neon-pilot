/**
 * Document Activity Producers Tests
 *
 * Proves that document lifecycle events write Activity documents
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
import { parseDocumentLifecycleEvent, writeDocumentActivityEntry, writeDocumentActivityEntrySafe } from './documentActivityProducers.js';

describe('writeDocumentActivityEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'doc-activity-producers-'));
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

  it('writes an activity document for document created', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'my-app', 'my-collection', 'doc-abc', 'created', 'my-app/my-collection/doc-abc');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('document_lifecycle_my-app_my-collection_doc-abc_created');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('document_created');
    expect(body.title).toContain('my-app/my-collection/doc-abc');
    expect(body.source).toBe('Document Service');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({
      owner: 'my-app',
      collection: 'my-collection',
      documentId: 'doc-abc',
      event: 'created',
    });
  });

  it('writes an activity document for document deleted', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'my-app', 'my-collection', 'doc-xyz', 'deleted', 'my-app/my-collection/doc-xyz', {
      owner: 'my-app',
      collection: 'my-collection',
      source: 'api',
    });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('document_lifecycle_my-app_my-collection_doc-xyz_deleted');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('document_deleted');
    expect(body.title).toContain('doc-xyz');
    expect(body.source).toBe('Document Service');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({
      owner: 'my-app',
      collection: 'my-collection',
      documentId: 'doc-xyz',
      event: 'deleted',
      source: 'api',
    });
  });

  it('includes source in metadata when provided', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-1', 'created', 'title', { source: 'api' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.metadata).toMatchObject({ source: 'api' });
  });

  it('is idempotent because repeated writes with the same owner/collection/id and event overwrite', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-xyz', 'created', 'First');
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-xyz', 'created', 'Second');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    // The same deterministic id means the upsert replaces the existing document.
    expect(docs.total).toBe(1);
  });

  it('creates separate entries for created vs deleted on the same document', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-1', 'created', 'Created');
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-1', 'deleted', 'Deleted');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(2);
    const ids = docs.records.map((d) => d.id).sort();
    expect(ids).toEqual(['document_lifecycle_app_col_doc-1_created', 'document_lifecycle_app_col_doc-1_deleted']);
  });

  it('creates separate entries for the same id in different collections', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'app', 'col-a', 'same-id', 'created', 'In col-a');
    writeDocumentActivityEntry(store, 'app', 'col-b', 'same-id', 'created', 'In col-b');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(2);
  });

  it('notifies activity mutation (invalidates topics, publishes events)', () => {
    const store = getStore();
    writeDocumentActivityEntry(store, 'app', 'col', 'doc-notify', 'created', 'Notify test');

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

describe('writeDocumentActivityEntrySafe', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'doc-activity-safe-'));
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

  it('writes an activity entry successfully', () => {
    const store = getStore();
    writeDocumentActivityEntrySafe(store, 'app', 'col', 'doc-1', 'created', 'Safe entry');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);
    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('document_created');
  });

  it('logs an error and does not throw when store.putDocument fails', () => {
    // Simulate a failure by calling safe with a store that errors
    const badStore = {
      putDocument: vi.fn().mockImplementation(() => {
        throw new Error('Simulated DB error');
      }),
    } as never;

    expect(() => {
      writeDocumentActivityEntrySafe(badStore, 'app', 'col', 'doc-1', 'created', 'Fail gracefully');
    }).not.toThrow();

    expect(logErrorMock).toHaveBeenCalledWith(
      'Failed to write document activity entry',
      expect.objectContaining({
        documentId: 'doc-1',
        owner: 'app',
        collection: 'col',
        event: 'created',
      }),
    );
  });
});

describe('parseDocumentLifecycleEvent', () => {
  it('returns "created" for "created"', () => {
    expect(parseDocumentLifecycleEvent('created')).toBe('created');
  });

  it('returns "deleted" for "deleted"', () => {
    expect(parseDocumentLifecycleEvent('deleted')).toBe('deleted');
  });

  it('is case-insensitive', () => {
    expect(parseDocumentLifecycleEvent('CREATED')).toBe('created');
    expect(parseDocumentLifecycleEvent('Deleted')).toBe('deleted');
  });

  it('returns undefined for unknown events', () => {
    expect(parseDocumentLifecycleEvent('updated')).toBeUndefined();
    expect(parseDocumentLifecycleEvent('renamed')).toBeUndefined();
    expect(parseDocumentLifecycleEvent('')).toBeUndefined();
  });
});
