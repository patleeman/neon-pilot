/**
 * Documents Store Backend API Tests
 *
 * Tests that the backend API functions correctly resolve the DocumentsStore
 * singleton and apply caller-aware read/write grant checks.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks for serverModuleResolver so the store module is loaded from source
const { callServerModuleExportMock, getDocumentsStoreMock } = vi.hoisted(() => ({
  callServerModuleExportMock: vi.fn(async (_modulePath: string, exportName: string, ..._args: unknown[]) => {
    if (exportName === 'getDocumentsStore') {
      return getDocumentsStoreMock();
    }
    if (exportName === 'extensionHasPermission') {
      return false;
    }
    return undefined;
  }),
  getDocumentsStoreMock: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport: callServerModuleExportMock,
}));

import {
  deleteDocument,
  deleteGrant,
  getCollection,
  getDocument,
  getGrant,
  listCollections,
  listDocuments,
  listGrants,
  putDocument,
  setGrant,
  upsertCollection,
} from './documents-store.js';

describe('documents-store backend API', () => {
  let tmpDir: string;
  let store: {
    listCollections: ReturnType<typeof vi.fn>;
    getCollection: ReturnType<typeof vi.fn>;
    upsertCollection: ReturnType<typeof vi.fn>;
    listDocuments: ReturnType<typeof vi.fn>;
    getDocument: ReturnType<typeof vi.fn>;
    putDocument: ReturnType<typeof vi.fn>;
    deleteDocument: ReturnType<typeof vi.fn>;
    getGrant: ReturnType<typeof vi.fn>;
    listGrants: ReturnType<typeof vi.fn>;
    setGrant: ReturnType<typeof vi.fn>;
    deleteGrant: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'backend-api-documents-test-'));

    // Mock the store with a fake singleton
    store = {
      listCollections: vi.fn(),
      getCollection: vi.fn(),
      upsertCollection: vi.fn(),
      listDocuments: vi.fn(),
      getDocument: vi.fn(),
      putDocument: vi.fn(),
      deleteDocument: vi.fn(),
      getGrant: vi.fn(),
      listGrants: vi.fn(),
      setGrant: vi.fn(),
      deleteGrant: vi.fn(),
    };
    getDocumentsStoreMock.mockReturnValue(store);

    // Set state root for resolution
    process.env.NEON_PILOT_STATE_ROOT = tmpDir;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_STATE_ROOT;
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── listCollections ─────────────────────────────────────────────────

  describe('listCollections', () => {
    it('rejects anonymous callers instead of treating them as host callers', async () => {
      await expect(listCollections()).rejects.toThrow('documents.listCollections requires callerAppId');
      await expect(listCollections({ callerAppId: undefined })).rejects.toThrow('documents.listCollections requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('returns caller-readable collections for app caller', async () => {
      const collections = [
        {
          owner: 'my-app',
          collection: 'col-1',
          description: '',
          defaultGrantRead: 'owner',
          defaultGrantWrite: 'owner',
          createdAt: '',
          updatedAt: '',
        },
        {
          owner: 'app-b',
          collection: 'col-2',
          description: '',
          defaultGrantRead: 'all',
          defaultGrantWrite: 'owner',
          createdAt: '',
          updatedAt: '',
        },
      ];
      store.listCollections.mockReturnValue(collections);

      const result = await listCollections({ callerAppId: 'my-app' });
      expect(result).toEqual(collections);
    });

    it('filters out unreadable collections for app caller', async () => {
      const collections = [
        {
          owner: 'app-a',
          collection: 'private',
          description: '',
          defaultGrantRead: 'owner',
          defaultGrantWrite: 'owner',
          createdAt: '',
          updatedAt: '',
        },
        {
          owner: 'app-b',
          collection: 'public',
          description: '',
          defaultGrantRead: 'all',
          defaultGrantWrite: 'owner',
          createdAt: '',
          updatedAt: '',
        },
      ];
      store.listCollections.mockReturnValue(collections);
      store.getGrant.mockReturnValue(null); // no explicit grant

      const result = await listCollections({ callerAppId: 'app-c' });
      expect(result).toHaveLength(1);
      expect(result[0]?.collection).toBe('public');
    });

    it('shows owned collections to the owner app', async () => {
      const collections = [
        {
          owner: 'my-app',
          collection: 'mine',
          description: '',
          defaultGrantRead: 'owner',
          defaultGrantWrite: 'owner',
          createdAt: '',
          updatedAt: '',
        },
      ];
      store.listCollections.mockReturnValue(collections);

      const result = await listCollections({ callerAppId: 'my-app' });
      expect(result).toHaveLength(1);
    });
  });

  // ── getCollection ───────────────────────────────────────────────────

  describe('getCollection', () => {
    it('rejects anonymous callers', async () => {
      await expect(getCollection('app', 'col')).rejects.toThrow('documents.getCollection requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('returns collection for owner app caller', async () => {
      store.getCollection.mockReturnValue({ owner: 'app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);

      const result = await getCollection('app', 'col', 'app');
      expect(result).toBeTruthy();
    });

    it('returns null when collection not found', async () => {
      store.getCollection.mockReturnValue(null);

      const result = await getCollection('app', 'nonexistent', 'app');
      expect(result).toBeNull();
    });

    it('allows read-granted app to access', async () => {
      store.getCollection.mockReturnValue({ owner: 'app-a', collection: 'shared', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue({ canRead: true, canWrite: false });

      const result = await getCollection('app-a', 'shared', 'app-b');
      expect(result).toBeTruthy();
    });

    it('denies app without read grant', async () => {
      store.getCollection.mockReturnValue({ owner: 'app-a', collection: 'private', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);

      await expect(getCollection('app-a', 'private', 'app-b')).rejects.toThrow('Document collection access denied');
    });
  });

  // ── upsertCollection ────────────────────────────────────────────────

  describe('upsertCollection', () => {
    it('allows owner to upsert', async () => {
      store.upsertCollection.mockReturnValue({ owner: 'my-app', collection: 'col', description: 'test' });

      const result = await upsertCollection('my-app', 'col', { description: 'test' }, 'my-app');
      expect(result).toBeTruthy();
    });

    it('denies non-owner app to upsert', async () => {
      await expect(upsertCollection('owner-app', 'col', {}, 'other-app')).rejects.toThrow('Document collection access denied');
    });
  });

  // ── listDocuments ───────────────────────────────────────────────────

  describe('listDocuments', () => {
    it('rejects anonymous callers', async () => {
      await expect(listDocuments('app', 'col')).rejects.toThrow('documents.listDocuments requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('returns documents for owner app caller', async () => {
      store.getCollection.mockReturnValue({ owner: 'app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);
      store.listDocuments.mockReturnValue({
        records: [{ owner: 'app', collection: 'col', id: 'doc-1', body: {}, createdAt: '', updatedAt: '' }],
        total: 1,
      });

      const result = await listDocuments('app', 'col', {}, 'app');
      expect(result.total).toBe(1);
    });

    it('denies app without read access', async () => {
      store.getCollection.mockReturnValue({ owner: 'app-a', collection: 'private', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);

      await expect(listDocuments('app-a', 'private', {}, 'app-b')).rejects.toThrow('Document collection access denied');
    });
  });

  // ── getDocument ─────────────────────────────────────────────────────

  describe('getDocument', () => {
    it('rejects anonymous callers', async () => {
      await expect(getDocument('app', 'col', 'doc-1')).rejects.toThrow('documents.getDocument requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('returns document for owner app caller', async () => {
      store.getCollection.mockReturnValue({ owner: 'app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);
      store.getDocument.mockReturnValue({ owner: 'app', collection: 'col', id: 'doc-1', body: { x: 1 }, createdAt: '', updatedAt: '' });

      const result = await getDocument('app', 'col', 'doc-1', 'app');
      expect(result?.body).toEqual({ x: 1 });
    });
  });

  // ── putDocument ─────────────────────────────────────────────────────

  describe('putDocument', () => {
    it('rejects anonymous callers', async () => {
      await expect(putDocument('app', 'col', 'doc-1', {})).rejects.toThrow('documents.putDocument requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to put document', async () => {
      store.getCollection.mockReturnValue({ owner: 'my-app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);
      store.putDocument.mockReturnValue({
        owner: 'my-app',
        collection: 'col',
        id: 'doc-1',
        body: { data: 42 },
        createdAt: '',
        updatedAt: '',
      });

      const result = await putDocument('my-app', 'col', 'doc-1', { data: 42 }, 'my-app');
      expect(result?.body).toEqual({ data: 42 });
      expect(callServerModuleExportMock).toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        {
          type: 'document.updated',
          owner: 'my-app',
          collection: 'col',
          id: 'doc-1',
          body: { data: 42 },
        },
      );
    });

    it('denies write without grant', async () => {
      store.getCollection.mockReturnValue({ owner: 'app-a', collection: 'private', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);

      await expect(putDocument('app-a', 'private', 'doc-1', {}, 'app-b')).rejects.toThrow('Document collection access denied');
    });
  });

  // ── deleteDocument ──────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('rejects anonymous callers', async () => {
      await expect(deleteDocument('app', 'col', 'doc-1')).rejects.toThrow('documents.deleteDocument requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to delete', async () => {
      store.getCollection.mockReturnValue({ owner: 'my-app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);
      store.deleteDocument.mockReturnValue(true);

      const result = await deleteDocument('my-app', 'col', 'doc-1', 'my-app');
      expect(result.deleted).toBe(true);
      expect(callServerModuleExportMock).toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        {
          type: 'document.deleted',
          owner: 'my-app',
          collection: 'col',
          id: 'doc-1',
        },
      );
    });

    it('returns false for not found', async () => {
      store.getCollection.mockReturnValue({ owner: 'my-app', collection: 'col', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' });
      store.getGrant.mockReturnValue(null);
      store.deleteDocument.mockReturnValue(false);

      const result = await deleteDocument('my-app', 'col', 'ghost', 'my-app');
      expect(result.deleted).toBe(false);
      expect(callServerModuleExportMock).not.toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).not.toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        expect.objectContaining({ type: 'document.deleted' }),
      );
    });
  });

  // ── listGrants ─────────────────────────────────────────────────────

  describe('listGrants', () => {
    it('rejects anonymous callers', async () => {
      await expect(listGrants('app', 'col')).rejects.toThrow('documents.listGrants requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to list grants', async () => {
      store.listGrants.mockReturnValue([
        {
          id: 'g1',
          owner: 'my-app',
          collection: 'col',
          granteeAppId: 'other',
          canRead: true,
          canWrite: false,
          createdAt: '',
          updatedAt: '',
        },
      ]);

      const result = await listGrants('my-app', 'col', 'my-app');
      expect(result).toHaveLength(1);
      expect(result[0].granteeAppId).toBe('other');
    });

    it('denies non-owner app to list grants', async () => {
      store.listGrants.mockReturnValue([]);

      await expect(listGrants('owner-app', 'col', 'other-app')).rejects.toThrow('Document grant management denied');
    });
  });

  // ── getGrant ───────────────────────────────────────────────────────

  describe('getGrant', () => {
    it('rejects anonymous callers', async () => {
      await expect(getGrant('app', 'col', 'grantee')).rejects.toThrow('documents.getGrant requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to get any grant', async () => {
      store.getGrant.mockReturnValue({
        id: 'g1',
        owner: 'my-app',
        collection: 'col',
        granteeAppId: 'other-app',
        canRead: true,
        canWrite: false,
        createdAt: '',
        updatedAt: '',
      });

      const result = await getGrant('my-app', 'col', 'other-app', 'my-app');
      expect(result).not.toBeNull();
      expect(result!.granteeAppId).toBe('other-app');
    });

    it('allows an app to inspect its own grant', async () => {
      store.getGrant.mockReturnValue({
        id: 'g1',
        owner: 'owner-app',
        collection: 'col',
        granteeAppId: 'my-app',
        canRead: true,
        canWrite: false,
        createdAt: '',
        updatedAt: '',
      });

      const result = await getGrant('owner-app', 'col', 'my-app', 'my-app');
      expect(result).not.toBeNull();
      expect(result!.granteeAppId).toBe('my-app');
    });

    it("denies non-owner app to look up another app's grant", async () => {
      store.getGrant.mockReturnValue(null);

      await expect(getGrant('owner-app', 'col', 'some-other-app', 'my-app')).rejects.toThrow('Document grant management denied');
    });

    it('returns null for missing grant', async () => {
      store.getGrant.mockReturnValue(null);

      const result = await getGrant('my-app', 'col', 'nobody', 'my-app');
      expect(result).toBeNull();
    });
  });

  // ── setGrant ───────────────────────────────────────────────────────

  describe('setGrant', () => {
    it('rejects anonymous callers', async () => {
      await expect(setGrant('app', 'col', 'grantee', true, false)).rejects.toThrow('documents.setGrant requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to set a grant', async () => {
      store.setGrant.mockReturnValue({
        id: 'g1',
        owner: 'my-app',
        collection: 'col',
        granteeAppId: 'other-app',
        canRead: true,
        canWrite: false,
        createdAt: '',
        updatedAt: '',
      });

      const result = await setGrant('my-app', 'col', 'other-app', true, false, 'my-app');
      expect(result.granteeAppId).toBe('other-app');
      expect(result.canRead).toBe(true);
      expect(result.canWrite).toBe(false);
      expect(store.setGrant).toHaveBeenCalledWith('my-app', 'col', 'other-app', true, false);
      expect(callServerModuleExportMock).toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        { type: 'grant.updated', owner: 'my-app', collection: 'col', granteeAppId: 'other-app' },
      );
    });

    it('denies non-owner app to set a grant', async () => {
      await expect(setGrant('owner-app', 'col', 'some-app', true, false, 'other-app')).rejects.toThrow('Document grant management denied');
      expect(store.setGrant).not.toHaveBeenCalled();
    });
  });

  // ── deleteGrant ────────────────────────────────────────────────────

  describe('deleteGrant', () => {
    it('rejects anonymous callers', async () => {
      await expect(deleteGrant('app', 'col', 'grantee')).rejects.toThrow('documents.deleteGrant requires callerAppId');
      expect(getDocumentsStoreMock).not.toHaveBeenCalled();
    });

    it('allows owner to delete a grant', async () => {
      store.deleteGrant.mockReturnValue(true);

      const result = await deleteGrant('my-app', 'col', 'other-app', 'my-app');
      expect(result.deleted).toBe(true);
      expect(store.deleteGrant).toHaveBeenCalledWith('my-app', 'col', 'other-app');
      expect(callServerModuleExportMock).toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        { type: 'grant.deleted', owner: 'my-app', collection: 'col', granteeAppId: 'other-app' },
      );
    });

    it('returns false when deleting non-existent grant', async () => {
      store.deleteGrant.mockReturnValue(false);

      const result = await deleteGrant('my-app', 'col', 'ghost', 'my-app');
      expect(result.deleted).toBe(false);
      expect(callServerModuleExportMock).not.toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
      expect(callServerModuleExportMock).not.toHaveBeenCalledWith(
        '../../extensions/extensionSubscriptions.js',
        'publishExtensionHostEvent',
        'documents',
        expect.objectContaining({ type: 'grant.deleted' }),
      );
    });

    it('denies non-owner app to delete a grant', async () => {
      await expect(deleteGrant('owner-app', 'col', 'some-app', 'other-app')).rejects.toThrow('Document grant management denied');
      expect(store.deleteGrant).not.toHaveBeenCalled();
    });
  });
});
