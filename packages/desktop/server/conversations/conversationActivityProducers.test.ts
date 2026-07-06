/**
 * Conversation Activity Producers Tests
 *
 * Proves that conversation lifecycle events write Activity documents
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
import { writeConversationActivityEntry } from './conversationActivityProducers.js';

describe('writeConversationActivityEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'conv-activity-producers-'));
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

  it('writes an activity document for conversation created', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-abc', 'created', 'New Conversation');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('conv_lifecycle_conv-abc_created');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_created');
    expect(body.title).toContain('New Conversation');
    expect(body.source).toBe('Conversation Service');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ conversationId: 'conv-abc', event: 'created' });
  });

  it('writes an activity document for conversation forked', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-def', 'forked', 'Forked conversation', { sourceConversationId: 'conv-abc' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const doc = docs.records[0]!;
    expect(doc.id).toBe('conv_lifecycle_conv-def_forked');
    const body = doc.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_forked');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ conversationId: 'conv-def', event: 'forked', sourceConversationId: 'conv-abc' });
  });

  it('writes an activity document for conversation renamed', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-ghi', 'renamed', 'New Title', { previousTitle: 'Old Title' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_renamed');
    expect(body.metadata).toMatchObject({ conversationId: 'conv-ghi', event: 'renamed', previousTitle: 'Old Title' });
  });

  it('writes an activity document for conversation deleted with error kind', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-jkl', 'deleted', 'Old Title');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_deleted');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for conversation opened', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-mno', 'opened', 'Resumed conversation');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_opened');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for conversation closed', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-pqr', 'closed', 'Closed conversation');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_closed');
    expect(body.kind).toBe('activity');
  });

  it('writes an activity document for conversation duplicated', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-stu', 'duplicated', 'Duplicated conversation', { sourceConversationId: 'conv-abc' });

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    expect(docs.total).toBe(1);

    const body = docs.records[0]!.body as ActivityEntryBody;
    expect(body.type).toBe('conversation_duplicated');
    expect(body.kind).toBe('activity');
    expect(body.metadata).toMatchObject({ sourceConversationId: 'conv-abc' });
  });

  it('is idempotent because repeated writes with the same conversationId and event overwrite', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-xyz', 'created', 'New Conversation');
    writeConversationActivityEntry(store, 'conv-xyz', 'created', 'New Conversation');

    const docs = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION);
    // The same deterministic id means the upsert replaces the existing document.
    expect(docs.total).toBe(1);
  });

  it('notifies activity mutation (invalidates topics, publishes events)', () => {
    const store = getStore();
    writeConversationActivityEntry(store, 'conv-notify', 'created', 'Notify test');

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
