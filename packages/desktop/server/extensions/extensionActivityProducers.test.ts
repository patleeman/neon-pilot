/**
 * Extension Activity Producers Tests
 *
 * Proves that extension lifecycle events write Activity documents
 * and publish/invalidate the activity/documents topics.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
import {
  parseExtensionLifecycleEvent,
  writeExtensionActivityEntry,
  writeExtensionActivityEntrySafe,
} from './extensionActivityProducers.js';

describe('writeExtensionActivityEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ext-activity-producers-'));
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

  it('writes an activity document for extension created', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'my-extension', 'created', 'My Extension');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('extension_lifecycle_my-extension_created');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('extension_created');
    expect(body.title).toContain('My Extension');
    expect(body.source).toBe('Extension Manager');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'my-extension', event: 'created' });
  });

  it('writes an activity document for extension imported', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'imported-ext', 'imported', 'Imported Extension');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_imported');
    expect(body.title).toContain('Imported Extension');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'imported-ext', event: 'imported' });
  });

  it('writes an activity document for extension enabled', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-one', 'enabled', 'Extension One');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_enabled');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'ext-one', event: 'enabled' });
  });

  it('writes an activity document for extension disabled', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-two', 'disabled', 'Extension Two');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_disabled');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'ext-two', event: 'disabled' });
  });

  it('writes an activity document for extension deleted', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-three', 'deleted', 'Extension Three');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_deleted');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for extension snapshotted', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-four', 'snapshotted', 'Extension Four');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_snapshotted');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'ext-four', event: 'snapshotted' });
  });

  it('writes an activity document for extension exported', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-five', 'exported', 'Extension Five', { exportFormat: 'zip' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('extension_exported');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ extensionId: 'ext-five', event: 'exported', exportFormat: 'zip' });
  });

  it('is idempotent because repeated writes with the same extensionId and event overwrite', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-xyz', 'created', 'Idempotent Ext');
    writeExtensionActivityEntry(store, 'ext-xyz', 'created', 'Idempotent Ext');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    // The same deterministic id means the upsert replaces the existing document.
    expect(docs.total).toBe(1);
  });

  it('creates separate entries for different events on the same extension', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-1', 'created', 'Created');
    writeExtensionActivityEntry(store, 'ext-1', 'deleted', 'Deleted');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(2);
    const ids = docs.records.map((d) => d.id).sort();
    expect(ids).toEqual(['extension_lifecycle_ext-1_created', 'extension_lifecycle_ext-1_deleted']);
  });

  it('notifies activity mutation (invalidates topics, publishes events)', () => {
    const store = getStore();
    writeExtensionActivityEntry(store, 'ext-notify', 'created', 'Notify test');

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

describe('writeExtensionActivityEntrySafe', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ext-activity-safe-'));
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    delete process.env.NEON_PILOT_CONFIG_FILE;
    delete process.env.NEON_PILOT_STATE_ROOT;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes an activity entry successfully via global store', () => {
    process.env.NEON_PILOT_STATE_ROOT = tmpDir;
    process.env.NEON_PILOT_CONFIG_FILE = join(tmpDir, 'machine-config.json');
    const desktopRoot = join(tmpDir, 'desktop-root');
    writeFileSync(process.env.NEON_PILOT_CONFIG_FILE, JSON.stringify({ desktopRoot }), { mode: 0o600 });

    expect(() => {
      writeExtensionActivityEntrySafe('ext-safe', 'created', 'Safe creation');
    }).not.toThrow();

    const docs = getDocumentsStore(tmpDir, resolveDesktopRootLayout({ root: desktopRoot })).listDocuments(
      ACTIVITY_OWNER,
      ACTIVITY_COLLECTION,
    );
    expect(docs.total).toBe(1);
  });

  it('logs an error and does not throw when store acquisition fails', async () => {
    // Spy on getStateRoot to simulate a failure.
    const coreModule = await import('@neon-pilot/core');
    const spy = vi.spyOn(coreModule, 'getStateRoot').mockImplementation(() => {
      throw new Error('Simulated store error');
    });

    expect(() => {
      writeExtensionActivityEntrySafe('ext-fail', 'created', 'Fail gracefully');
    }).not.toThrow();

    expect(logErrorMock).toHaveBeenCalledWith(
      'Failed to write extension activity entry',
      expect.objectContaining({
        extensionId: 'ext-fail',
        event: 'created',
      }),
    );

    spy.mockRestore();
  });
});

describe('parseExtensionLifecycleEvent', () => {
  it('returns "created" for "created"', () => {
    expect(parseExtensionLifecycleEvent('created')).toBe('created');
  });

  it('returns "imported" for "imported"', () => {
    expect(parseExtensionLifecycleEvent('imported')).toBe('imported');
  });

  it('returns "enabled" for "enabled"', () => {
    expect(parseExtensionLifecycleEvent('enabled')).toBe('enabled');
  });

  it('returns "disabled" for "disabled"', () => {
    expect(parseExtensionLifecycleEvent('disabled')).toBe('disabled');
  });

  it('returns "deleted" for "deleted"', () => {
    expect(parseExtensionLifecycleEvent('deleted')).toBe('deleted');
  });

  it('returns "snapshotted" for "snapshotted"', () => {
    expect(parseExtensionLifecycleEvent('snapshotted')).toBe('snapshotted');
  });

  it('returns "exported" for "exported"', () => {
    expect(parseExtensionLifecycleEvent('exported')).toBe('exported');
  });

  it('is case-insensitive', () => {
    expect(parseExtensionLifecycleEvent('CREATED')).toBe('created');
    expect(parseExtensionLifecycleEvent('Enabled')).toBe('enabled');
    expect(parseExtensionLifecycleEvent('DELETED')).toBe('deleted');
  });

  it('returns undefined for unknown events', () => {
    expect(parseExtensionLifecycleEvent('updated')).toBeUndefined();
    expect(parseExtensionLifecycleEvent('installed')).toBeUndefined();
    expect(parseExtensionLifecycleEvent('validated')).toBeUndefined();
    expect(parseExtensionLifecycleEvent('reloaded')).toBeUndefined();
    expect(parseExtensionLifecycleEvent('')).toBeUndefined();
  });
});
