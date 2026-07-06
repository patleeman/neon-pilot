/**
 * Documents Store Tests
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DocumentsStore,
  getDocumentsStore,
  maybeMigrateLegacyDocumentsDb,
  resetDocumentsStoreSingleton,
  resolveDocumentsDbPath,
  resolveDocumentsDbPathFromLayout,
} from './store.js';

describe('DocumentsStore', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: DocumentsStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'documents-store-test-'));
    dbPath = resolveDocumentsDbPath(tmpDir);
    store = new DocumentsStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('collections', () => {
    it('lists collections (empty initially)', () => {
      expect(store.listCollections()).toEqual([]);
    });

    it('lists collections filtered by owner', () => {
      store.upsertCollection('app-a', 'notes');
      store.upsertCollection('app-b', 'contacts');
      store.upsertCollection('app-a', 'todos');

      const appACollections = store.listCollections('app-a');
      expect(appACollections).toHaveLength(2);
      expect(appACollections.map((c) => c.collection).sort()).toEqual(['notes', 'todos']);

      expect(store.listCollections('app-b')).toHaveLength(1);
      expect(store.listCollections('app-c')).toHaveLength(0);
    });

    it('upserts a collection with defaults', () => {
      const collection = store.upsertCollection('my-app', 'widgets');

      expect(collection.owner).toBe('my-app');
      expect(collection.collection).toBe('widgets');
      expect(collection.description).toBe('');
      expect(collection.defaultGrantRead).toBe('owner');
      expect(collection.defaultGrantWrite).toBe('owner');
      expect(collection.createdAt).toBeTruthy();
      expect(collection.updatedAt).toBeTruthy();
    });

    it('upserts a collection with custom options', () => {
      const collection = store.upsertCollection('my-app', 'public-data', {
        description: 'Shared data visible to all apps',
        defaultGrantRead: 'all',
        defaultGrantWrite: 'none',
      });

      expect(collection.description).toBe('Shared data visible to all apps');
      expect(collection.defaultGrantRead).toBe('all');
      expect(collection.defaultGrantWrite).toBe('none');
    });

    it('reuses existing collection on upsert with same key', () => {
      store.upsertCollection('app', 'col', { description: 'v1' });
      store.upsertCollection('app', 'col', { description: 'v2' });

      const collections = store.listCollections('app');
      expect(collections).toHaveLength(1);
      expect(collections[0].description).toBe('v2');
    });

    it('can clear an existing collection description', () => {
      store.upsertCollection('app', 'col', { description: 'v1' });
      store.upsertCollection('app', 'col', { description: '' });

      expect(store.getCollection('app', 'col')?.description).toBe('');
    });

    it('can reset default grants back to owner', () => {
      store.upsertCollection('app', 'col', {
        defaultGrantRead: 'all',
        defaultGrantWrite: 'none',
      });
      store.upsertCollection('app', 'col', {
        defaultGrantRead: 'owner',
        defaultGrantWrite: 'owner',
      });

      expect(store.getCollection('app', 'col')).toEqual(
        expect.objectContaining({
          defaultGrantRead: 'owner',
          defaultGrantWrite: 'owner',
        }),
      );
    });

    it('gets a single collection', () => {
      store.upsertCollection('app', 'col');
      const result = store.getCollection('app', 'col');
      expect(result).not.toBeNull();
      expect(result!.owner).toBe('app');
      expect(result!.collection).toBe('col');
    });

    it('returns null for missing collection', () => {
      expect(store.getCollection('nope', 'missing')).toBeNull();
    });
  });

  describe('documents CRUD', () => {
    it('puts and gets a document', () => {
      const doc = store.putDocument('my-app', 'widgets', 'widget-1', { name: 'Foo', count: 42 });

      expect(doc.owner).toBe('my-app');
      expect(doc.collection).toBe('widgets');
      expect(doc.id).toBe('widget-1');
      expect(doc.body).toEqual({ name: 'Foo', count: 42 });
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });

    it('auto-creates collection on first put', () => {
      store.putDocument('app', 'auto-col', 'rec-1', { test: true });

      const collections = store.listCollections('app');
      expect(collections.map((c) => c.collection)).toContain('auto-col');
    });

    it('upserts document with same id', () => {
      store.putDocument('app', 'col', 'same-id', { version: 1 });
      store.putDocument('app', 'col', 'same-id', { version: 2, extra: true });

      const doc = store.getDocument('app', 'col', 'same-id');
      expect(doc!.body).toEqual({ version: 2, extra: true });
    });

    it('gets null for missing document', () => {
      expect(store.getDocument('app', 'col', 'missing')).toBeNull();
    });

    it('lists documents with pagination', () => {
      for (let i = 0; i < 25; i++) {
        store.putDocument('app', 'col', `doc-${i}`, { index: i });
      }

      const page1 = store.listDocuments('app', 'col', { limit: 10, offset: 0 });
      expect(page1.records).toHaveLength(10);
      expect(page1.total).toBe(25);

      const page2 = store.listDocuments('app', 'col', { limit: 10, offset: 10 });
      expect(page2.records).toHaveLength(10);

      const page3 = store.listDocuments('app', 'col', { limit: 10, offset: 20 });
      expect(page3.records).toHaveLength(5);
    });

    it('lists documents with default limit', () => {
      for (let i = 0; i < 150; i++) {
        store.putDocument('app', 'col', `doc-${i}`, { index: i });
      }

      const result = store.listDocuments('app', 'col');
      expect(result.records).toHaveLength(100);
      expect(result.total).toBe(150);
    });

    it('deletes a document', () => {
      store.putDocument('app', 'col', 'delete-me', { value: true });
      expect(store.getDocument('app', 'col', 'delete-me')).not.toBeNull();

      const deleted = store.deleteDocument('app', 'col', 'delete-me');
      expect(deleted).toBe(true);
      expect(store.getDocument('app', 'col', 'delete-me')).toBeNull();
    });

    it('returns false when deleting non-existent document', () => {
      expect(store.deleteDocument('app', 'col', 'ghost')).toBe(false);
    });

    it('stores null body correctly', () => {
      const doc = store.putDocument('app', 'col', 'null-body', null);
      expect(doc.body).toBeNull();
    });

    it('stores array body correctly', () => {
      const doc = store.putDocument('app', 'col', 'array-body', [1, 2, { a: 'b' }]);
      expect(doc.body).toEqual([1, 2, { a: 'b' }]);
    });

    it('stores string body correctly', () => {
      const doc = store.putDocument('app', 'col', 'str-body', 'plain string');
      expect(doc.body).toBe('plain string');
    });

    it('rejects undefined bodies because they are not JSON-serializable records', () => {
      expect(() => store.putDocument('app', 'col', 'undefined-body', undefined)).toThrow(/JSON-serializable/);
    });
  });

  describe('grants', () => {
    it('lists grants (empty initially)', () => {
      store.upsertCollection('app', 'col');
      expect(store.listGrants('app', 'col')).toEqual([]);
    });

    it('sets and reads a grant', () => {
      store.upsertCollection('app', 'col');
      const grant = store.setGrant('app', 'col', 'other-app', true, false);

      expect(grant.granteeAppId).toBe('other-app');
      expect(grant.canRead).toBe(true);
      expect(grant.canWrite).toBe(false);
    });

    it('upserts a grant (same grantee updates)', () => {
      store.upsertCollection('app', 'col');
      store.setGrant('app', 'col', 'other-app', true, false);
      store.setGrant('app', 'col', 'other-app', false, true);

      const grants = store.listGrants('app', 'col');
      expect(grants).toHaveLength(1);
      expect(grants[0].canRead).toBe(false);
      expect(grants[0].canWrite).toBe(true);
    });

    it('lists multiple grants', () => {
      store.upsertCollection('app', 'col');
      store.setGrant('app', 'col', 'reader-app', true, false);
      store.setGrant('app', 'col', 'writer-app', false, true);
      store.setGrant('app', 'col', 'both-app', true, true);

      const grants = store.listGrants('app', 'col');
      expect(grants).toHaveLength(3);
    });

    it('gets a single grant', () => {
      store.upsertCollection('app', 'col');
      store.setGrant('app', 'col', 'some-app', true, true);

      const grant = store.getGrant('app', 'col', 'some-app');
      expect(grant).not.toBeNull();
      expect(grant!.granteeAppId).toBe('some-app');
    });

    it('returns null for missing grant', () => {
      store.upsertCollection('app', 'col');
      expect(store.getGrant('app', 'col', 'nobody')).toBeNull();
    });

    it('deletes a grant', () => {
      store.upsertCollection('app', 'col');
      store.setGrant('app', 'col', 'temp-app', true, false);

      expect(store.deleteGrant('app', 'col', 'temp-app')).toBe(true);
      expect(store.getGrant('app', 'col', 'temp-app')).toBeNull();
    });

    it('returns false when deleting non-existent grant', () => {
      store.upsertCollection('app', 'col');
      expect(store.deleteGrant('app', 'col', 'nobody')).toBe(false);
    });
  });

  describe('multi-owner isolation', () => {
    it('keeps documents isolated by owner+collection', () => {
      store.putDocument('app-a', 'items', '1', { owner: 'a' });
      store.putDocument('app-b', 'items', '1', { owner: 'b' });

      expect(store.listDocuments('app-a', 'items').records).toHaveLength(1);
      expect(store.listDocuments('app-a', 'items').records[0].body).toEqual({ owner: 'a' });
      expect(store.listDocuments('app-b', 'items').records).toHaveLength(1);
      expect(store.listDocuments('app-b', 'items').records[0].body).toEqual({ owner: 'b' });
    });
  });

  describe('resolveDocumentsDbPath', () => {
    it('resolves path under state root documents dir', () => {
      const path = resolveDocumentsDbPath('/tmp/test-root');
      expect(path).toMatch(/\/tmp\/test-root\/documents\/documents\.db$/);
    });
  });

  describe('resolveDocumentsDbPathFromLayout', () => {
    it('resolves path under desktop root data/documents dir', () => {
      const layout = resolveDesktopRootLayout({ root: '/desktop-root' });
      const path = resolveDocumentsDbPathFromLayout(layout);
      expect(path).toBe('/desktop-root/data/documents/documents.db');
    });
  });

  describe('maybeMigrateLegacyDocumentsDb', () => {
    it('copies legacy DB to new location when new DB is missing', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
      const legacyDbPath = resolveDocumentsDbPath(tmpDir);
      store.putDocument('legacy-app', 'notes', 'note-1', { text: 'legacy' });

      const newDbPath = resolveDocumentsDbPathFromLayout(layout);
      expect(existsSync(newDbPath)).toBe(false);

      maybeMigrateLegacyDocumentsDb(tmpDir, layout);

      expect(existsSync(newDbPath)).toBe(true);
      expect(existsSync(legacyDbPath)).toBe(true);

      const migratedStore = new DocumentsStore(newDbPath);
      expect(migratedStore.getDocument('legacy-app', 'notes', 'note-1')?.body).toEqual({ text: 'legacy' });
      migratedStore.close();
    });

    it('checkpoints WAL data before copying the legacy DB', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root-wal') });
      store.putDocument('legacy-app', 'notes', 'wal-note', { text: 'from wal' });

      const newDbPath = resolveDocumentsDbPathFromLayout(layout);
      maybeMigrateLegacyDocumentsDb(tmpDir, layout);

      const migratedStore = new DocumentsStore(newDbPath);
      expect(migratedStore.getDocument('legacy-app', 'notes', 'wal-note')?.body).toEqual({ text: 'from wal' });

      migratedStore.close();
    });

    it('does not overwrite an existing new DB with legacy DB', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
      const legacyDbPath = resolveDocumentsDbPath(tmpDir);
      const newDbPath = resolveDocumentsDbPathFromLayout(layout);

      mkdirSync(dirname(legacyDbPath), { recursive: true });
      writeFileSync(legacyDbPath, 'legacy-content', 'utf-8');
      mkdirSync(dirname(newDbPath), { recursive: true });
      writeFileSync(newDbPath, 'new-content', 'utf-8');

      maybeMigrateLegacyDocumentsDb(tmpDir, layout);

      expect(readFileSync(newDbPath, 'utf-8')).toBe('new-content');
    });

    it('does nothing when no legacy DB exists', () => {
      const stateRootWithoutLegacyDb = mkdtempSync(join(tmpdir(), 'documents-migration-empty-'));
      const layout = resolveDesktopRootLayout({ root: join(stateRootWithoutLegacyDb, 'desktop-root') });
      const newDbPath = resolveDocumentsDbPathFromLayout(layout);

      maybeMigrateLegacyDocumentsDb(stateRootWithoutLegacyDb, layout);

      expect(existsSync(newDbPath)).toBe(false);
      expect(existsSync(resolveDocumentsDbPath(stateRootWithoutLegacyDb))).toBe(false);
      rmSync(stateRootWithoutLegacyDb, { recursive: true, force: true });
    });

    it('creates the data/documents directory when copying legacy DB', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
      store.putDocument('legacy-app', 'notes', 'note-2', { text: 'migrate me' });

      const newDbPath = resolveDocumentsDbPathFromLayout(layout);
      expect(existsSync(dirname(newDbPath))).toBe(false);

      maybeMigrateLegacyDocumentsDb(tmpDir, layout);

      expect(existsSync(dirname(newDbPath))).toBe(true);
      expect(existsSync(newDbPath)).toBe(true);
    });
  });

  describe('getDocumentsStore with desktop root layout', () => {
    afterEach(() => {
      resetDocumentsStoreSingleton();
    });

    it('resolves DB path under data/documents when layout is provided', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
      const newDbPath = resolveDocumentsDbPathFromLayout(layout);
      expect(existsSync(newDbPath)).toBe(false);

      const layoutStore = getDocumentsStore(tmpDir, layout);

      expect(existsSync(newDbPath)).toBe(true);
      expect(layoutStore).toBeInstanceOf(DocumentsStore);
    });

    it('reuses the same singleton for the same desktop root layout', () => {
      const layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root-2') });
      const firstStore = getDocumentsStore(tmpDir, layout);
      const secondStore = getDocumentsStore(tmpDir, layout);

      expect(secondStore).toBe(firstStore);
    });
  });
});

describe('DocumentsStore with desktop root layout (routes/inbox compatible)', () => {
  let layoutRoot: string;
  let store: DocumentsStore;

  beforeEach(() => {
    layoutRoot = mkdtempSync(join(tmpdir(), 'documents-layout-store-test-'));
    const layout = resolveDesktopRootLayout({ root: layoutRoot });
    store = getDocumentsStore(layoutRoot, layout);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(layoutRoot, { recursive: true, force: true });
  });

  it('persists data under data/documents', () => {
    const layout = resolveDesktopRootLayout({ root: layoutRoot });
    const expectedDbPath = resolveDocumentsDbPathFromLayout(layout);
    expect(existsSync(expectedDbPath)).toBe(true);
  });

  it('can create collections and documents', () => {
    store.upsertCollection('app', 'test-col', { description: 'layout test' });
    store.putDocument('app', 'test-col', 'doc-1', { hello: 'world' });

    const doc = store.getDocument('app', 'test-col', 'doc-1');
    expect(doc).not.toBeNull();
    expect(doc!.body).toEqual({ hello: 'world' });
  });

  it('singleton resolves to the layout-based store', () => {
    const layout = resolveDesktopRootLayout({ root: layoutRoot });
    const sameStore = getDocumentsStore(layoutRoot, layout);
    expect(sameStore).toBe(store);
  });
});
