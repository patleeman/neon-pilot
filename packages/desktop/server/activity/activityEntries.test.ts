/**
 * Activity Entries module tests
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

import { getDocumentsStore, resetDocumentsStoreSingleton } from '../documents/store.js';
import {
  ACTIVITY_COLLECTION,
  ACTIVITY_OWNER,
  generateActivityEntryId,
  notifyActivityMutation,
  writeActivityEntry,
} from './activityEntries.js';

describe('activityEntries', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'activity-entries-test-'));
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

  describe('generateActivityEntryId', () => {
    it('generates a unique id with act_ prefix', () => {
      const id1 = generateActivityEntryId();
      const id2 = generateActivityEntryId();
      expect(id1).toMatch(/^act_[a-z0-9_]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('writeActivityEntry', () => {
    it('writes an entry to the documents store', () => {
      const store = getStore();
      const doc = writeActivityEntry(store, {
        type: 'app_launch',
        title: 'Notes app launched',
        source: 'Window manager',
      });

      expect(doc.owner).toBe(ACTIVITY_OWNER);
      expect(doc.collection).toBe(ACTIVITY_COLLECTION);
      expect(doc.id).toMatch(/^act_/);
      expect(doc.body).toEqual(
        expect.objectContaining({
          type: 'app_launch',
          title: 'Notes app launched',
          source: 'Window manager',
        }),
      );
    });

    it('accepts an explicit id', () => {
      const store = getStore();
      const doc = writeActivityEntry(store, { type: 'info', title: 'Test' }, 'my-custom-id');

      expect(doc.id).toBe('my-custom-id');
    });

    it('stores optional fields', () => {
      const store = getStore();
      const doc = writeActivityEntry(store, {
        type: 'error',
        title: 'Something went wrong',
        subtitle: 'Error details here',
        kind: 'error',
        metadata: { code: 500, service: 'api' },
        processed: false,
      });

      const body = doc.body as Record<string, unknown>;
      expect(body.subtitle).toBe('Error details here');
      expect(body.kind).toBe('error');
      expect(body.metadata).toEqual({ code: 500, service: 'api' });
      expect(body.processed).toBe(false);
    });

    it('omits undefined optional fields from the stored body', () => {
      const store = getStore();
      const doc = writeActivityEntry(store, {
        type: 'info',
        title: 'Minimal entry',
      });

      const body = doc.body as Record<string, unknown>;
      expect(body.subtitle).toBeUndefined();
      expect(body.source).toBeUndefined();
      expect(body.kind).toBeUndefined();
      expect(body.metadata).toBeUndefined();
      expect(body.processed).toBeUndefined();
    });
  });

  describe('notifyActivityMutation', () => {
    it('invalidates activity and documents topics', () => {
      notifyActivityMutation('activity.created', 'test-id', { type: 'info', title: 'Test' });

      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('activity', 'documents');
    });

    it('publishes activity event', () => {
      notifyActivityMutation('activity.created', 'test-id', { type: 'info', title: 'Test' });

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('activity', {
        type: 'activity.created',
        owner: 'activity',
        collection: 'activity-entries',
        id: 'test-id',
      });
    });

    it('publishes documents event for create', () => {
      const body = { type: 'info', title: 'Test' };
      notifyActivityMutation('activity.created', 'test-id', body);

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.updated',
        owner: 'activity',
        collection: 'activity-entries',
        id: 'test-id',
        body,
      });
    });

    it('publishes documents event for delete (no body)', () => {
      notifyActivityMutation('activity.deleted', 'test-id', undefined);

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.deleted',
        owner: 'activity',
        collection: 'activity-entries',
        id: 'test-id',
      });
    });

    it('passes extra fields to the activity event', () => {
      notifyActivityMutation('activity.created', 'test-id', { type: 'info', title: 'Test' }, { changes: { foo: 'bar' } });

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
        'activity',
        expect.objectContaining({
          type: 'activity.created',
          id: 'test-id',
          changes: { foo: 'bar' },
        }),
      );
    });
  });
});
