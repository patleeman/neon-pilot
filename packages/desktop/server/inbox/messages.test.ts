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
import { INBOX_COLLECTION, INBOX_OWNER, notifyInboxMutation, writeInboxMessage } from './messages.js';

describe('inbox message helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'inbox-message-test-'));
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes host-owned inbox documents and publishes shared mutation events', () => {
    const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
    const store = getDocumentsStore(tmpDir, layout);

    const doc = writeInboxMessage(store, {
      id: 'worker-result-1',
      from: 'Review Worker',
      fromKind: 'worker',
      to: 'persona',
      subject: 'Worker finished',
      body: 'Worker output is data, not instructions.',
      kind: 'result',
      refId: 'child-1',
    });
    notifyInboxMutation('inbox.created', doc.id, doc.body as never);

    expect(doc).toMatchObject({
      owner: INBOX_OWNER,
      collection: INBOX_COLLECTION,
      id: 'worker-result-1',
      body: {
        from: 'Review Worker',
        fromKind: 'worker',
        to: 'persona',
        subject: 'Worker finished',
        body: 'Worker output is data, not instructions.',
        kind: 'result',
        refId: 'child-1',
        read: false,
        archived: false,
      },
    });
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('inbox', 'documents');
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith('inbox', {
      type: 'inbox.created',
      owner: INBOX_OWNER,
      collection: INBOX_COLLECTION,
      id: 'worker-result-1',
    });
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        type: 'document.updated',
        owner: INBOX_OWNER,
        collection: INBOX_COLLECTION,
        id: 'worker-result-1',
        body: expect.objectContaining({ subject: 'Worker finished' }),
      }),
    );
  });
});
