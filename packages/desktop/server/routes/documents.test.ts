/**
 * Documents Route Tests
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

import type { DocumentsRouteCaller } from './documents.js';
import { resetDocumentsStoreForTests } from './documents.js';
import { registerDocumentsRoutes } from './documents.js';

describe('registerDocumentsRoutes', () => {
  let tmpDir: string;
  let caller: DocumentsRouteCaller;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'documents-route-test-'));
    caller = { kind: 'host' };
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreForTests();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createHarness() {
    const handlers: Record<string, (req: unknown, res: unknown) => void> = {};
    const router = {
      get: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`GET ${path}`] = handler;
      }),
      put: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`PUT ${path}`] = handler;
      }),
      delete: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`DELETE ${path}`] = handler;
      }),
      patch: vi.fn(),
    };

    registerDocumentsRoutes(router as never, {
      getDocumentsRouteCaller: () => caller,
      getStateRoot: () => tmpDir,
    });

    return handlers;
  }

  function createOrderedHarness() {
    const registrations: string[] = [];
    const router = {
      get: vi.fn((path: string) => {
        registrations.push(`GET ${path}`);
      }),
      put: vi.fn((path: string) => {
        registrations.push(`PUT ${path}`);
      }),
      delete: vi.fn((path: string) => {
        registrations.push(`DELETE ${path}`);
      }),
      patch: vi.fn(),
    };

    registerDocumentsRoutes(router as never, {
      getDocumentsRouteCaller: () => caller,
      getStateRoot: () => tmpDir,
    });

    return registrations;
  }

  function createRes() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
  }

  describe('collection endpoints', () => {
    it('GET /api/documents/collections lists collections', () => {
      const handlers = createHarness();
      const handler = handlers['GET /api/documents/collections'];
      const res = createRes();

      handler({ query: {} }, res);

      expect(res.json).toHaveBeenCalledWith({ collections: [] });
    });

    it('PUT /api/documents/collections/:owner/:collection creates a collection', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];
      const res = createRes();

      handler({ params: { owner: 'my-app', collection: 'my-col' }, body: {} }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({
            owner: 'my-app',
            collection: 'my-col',
          }),
        }),
      );
    });

    it('PUT rejects missing owner', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];
      const res = createRes();

      handler({ params: { owner: '', collection: 'col' }, body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
    });

    it('PUT can clear description and reset grant defaults to owner', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler(
        {
          params: { owner: 'app', collection: 'policy' },
          body: { description: 'shared', defaultGrantRead: 'all', defaultGrantWrite: 'none' },
        },
        createRes(),
      );

      const res = createRes();
      handler(
        {
          params: { owner: 'app', collection: 'policy' },
          body: { description: '', defaultGrantRead: 'owner', defaultGrantWrite: 'owner' },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({
            description: '',
            defaultGrantRead: 'owner',
            defaultGrantWrite: 'owner',
          }),
        }),
      );
    });

    it('PUT preserves omitted collection policy fields', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler(
        {
          params: { owner: 'app', collection: 'policy' },
          body: { description: 'kept', defaultGrantRead: 'owner', defaultGrantWrite: 'all' },
        },
        createRes(),
      );

      const res = createRes();
      handler(
        {
          params: { owner: 'app', collection: 'policy' },
          body: { defaultGrantRead: 'all' },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({
            description: 'kept',
            defaultGrantRead: 'all',
            defaultGrantWrite: 'all',
          }),
        }),
      );
    });
  });

  describe('document CRUD', () => {
    it('PUT creates a document', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      const res = createRes();

      putHandler({ params: { owner: 'app', collection: 'col', id: 'doc-1' }, body: { hello: 'world' } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            owner: 'app',
            collection: 'col',
            id: 'doc-1',
            body: { hello: 'world' },
          }),
        }),
      );
    });

    it('PUT rejects missing body', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      const res = createRes();

      handler({ params: { owner: 'app', collection: 'col', id: 'doc-1' }, body: undefined }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request body is required' });
    });

    it('GET retrieves a document after PUT', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      const getHandler = handlers['GET /api/documents/collections/:owner/:collection/:id'];
      const putRes = createRes();

      putHandler({ params: { owner: 'app', collection: 'col', id: 'the-doc' }, body: { data: 42 } }, putRes);

      const getRes = createRes();
      getHandler({ params: { owner: 'app', collection: 'col', id: 'the-doc' }, query: {} }, getRes);

      expect(getRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            owner: 'app',
            collection: 'col',
            id: 'the-doc',
            body: { data: 42 },
          }),
        }),
      );
    });

    it('GET returns 404 for missing document', () => {
      const handlers = createHarness();
      const handler = handlers['GET /api/documents/collections/:owner/:collection/:id'];
      const res = createRes();

      handler({ params: { owner: 'app', collection: 'col', id: 'missing' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
    });

    it('DELETE removes a document', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      const delHandler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];

      putHandler({ params: { owner: 'app', collection: 'col', id: 'delete-me' }, body: {} }, createRes());

      const res = createRes();
      delHandler({ params: { owner: 'app', collection: 'col', id: 'delete-me' } }, res);

      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });

    it('DELETE returns 404 for missing document', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];
      const res = createRes();

      handler({ params: { owner: 'app', collection: 'col', id: 'ghost' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
    });

    it('GET lists documents', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];

      putHandler({ params: { owner: 'app', collection: 'col', id: 'doc-a' }, body: { idx: 0 } }, createRes());
      putHandler({ params: { owner: 'app', collection: 'col', id: 'doc-b' }, body: { idx: 1 } }, createRes());

      const listHandler = handlers['GET /api/documents/collections/:owner/:collection'];
      const res = createRes();
      listHandler({ params: { owner: 'app', collection: 'col' }, query: {} }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          records: expect.arrayContaining([expect.objectContaining({ id: 'doc-a' }), expect.objectContaining({ id: 'doc-b' })]),
          total: 2,
        }),
      );
    });

    it('GET list validates missing params', () => {
      const handlers = createHarness();
      const handler = handlers['GET /api/documents/collections/:owner/:collection'];
      const res = createRes();

      handler({ params: { owner: '', collection: '' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('denies another app reading owner-only documents', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      putHandler({ params: { owner: 'app-a', collection: 'private', id: 'doc-1' }, body: { secret: true } }, createRes());

      caller = { appId: 'app-b', kind: 'app' };
      const listHandler = handlers['GET /api/documents/collections/:owner/:collection'];
      const res = createRes();
      listHandler({ params: { owner: 'app-a', collection: 'private' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Document collection access denied' });
    });

    it('allows another app to read through an explicit read grant but not write', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection/:id'](
        { params: { owner: 'app-a', collection: 'shared', id: 'doc-1' }, body: { value: 1 } },
        createRes(),
      );
      handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'](
        { params: { owner: 'app-a', collection: 'shared', granteeAppId: 'app-b' }, body: { canRead: true, canWrite: false } },
        createRes(),
      );

      caller = { appId: 'app-b', kind: 'app' };
      const readRes = createRes();
      handlers['GET /api/documents/collections/:owner/:collection/:id'](
        { params: { owner: 'app-a', collection: 'shared', id: 'doc-1' }, query: {} },
        readRes,
      );
      expect(readRes.json).toHaveBeenCalledWith(expect.objectContaining({ document: expect.objectContaining({ id: 'doc-1' }) }));

      const writeRes = createRes();
      handlers['PUT /api/documents/collections/:owner/:collection/:id'](
        { params: { owner: 'app-a', collection: 'shared', id: 'doc-2' }, body: { value: 2 } },
        writeRes,
      );
      expect(writeRes.status).toHaveBeenCalledWith(403);
    });

    it('allows another app to read through an all-read default grant', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app-a', collection: 'public' }, body: { defaultGrantRead: 'all', defaultGrantWrite: 'owner' } },
        createRes(),
      );
      handlers['PUT /api/documents/collections/:owner/:collection/:id'](
        { params: { owner: 'app-a', collection: 'public', id: 'doc-1' }, body: { visible: true } },
        createRes(),
      );

      caller = { appId: 'app-b', kind: 'app' };
      const res = createRes();
      handlers['GET /api/documents/collections/:owner/:collection/:id'](
        { params: { owner: 'app-a', collection: 'public', id: 'doc-1' }, query: {} },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ document: expect.objectContaining({ id: 'doc-1' }) }));
    });
  });

  describe('grant endpoints', () => {
    it('registers grant routes before document-id routes so real Express does not shadow them', () => {
      const registrations = createOrderedHarness();

      expect(registrations.indexOf('GET /api/documents/collections/:owner/:collection/grants')).toBeLessThan(
        registrations.indexOf('GET /api/documents/collections/:owner/:collection/:id'),
      );
      expect(registrations.indexOf('PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId')).toBeLessThan(
        registrations.indexOf('PUT /api/documents/collections/:owner/:collection/:id'),
      );
      expect(registrations.indexOf('DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId')).toBeLessThan(
        registrations.indexOf('DELETE /api/documents/collections/:owner/:collection/:id'),
      );
    });

    it('creates a collection via PUT then manages grants', () => {
      const handlers = createHarness();
      const colHandler = handlers['PUT /api/documents/collections/:owner/:collection'];

      colHandler({ params: { owner: 'app', collection: 'secured' }, body: {} }, createRes());

      const setGrantHandler = handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      const grantRes = createRes();
      setGrantHandler(
        { params: { owner: 'app', collection: 'secured', granteeAppId: 'other-app' }, body: { canRead: true, canWrite: false } },
        grantRes,
      );

      expect(grantRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          grant: expect.objectContaining({
            granteeAppId: 'other-app',
            canRead: true,
            canWrite: false,
          }),
        }),
      );

      const listGrantHandler = handlers['GET /api/documents/collections/:owner/:collection/grants'];
      const listRes = createRes();
      listGrantHandler({ params: { owner: 'app', collection: 'secured' } }, listRes);

      expect(listRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          grants: expect.arrayContaining([expect.objectContaining({ granteeAppId: 'other-app' })]),
        }),
      );

      const delGrantHandler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      const delRes = createRes();
      delGrantHandler({ params: { owner: 'app', collection: 'secured', granteeAppId: 'other-app' } }, delRes);

      expect(delRes.json).toHaveBeenCalledWith({ deleted: true });
    });

    it('DELETE grant returns 404 for missing', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      const res = createRes();

      handler({ params: { owner: 'app', collection: 'col', granteeAppId: 'nobody' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Grant not found' });
    });

    it('denies another app mutating collection grants', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app-a', collection: 'secured' }, body: {} },
        createRes(),
      );

      caller = { appId: 'app-b', kind: 'app' };
      const res = createRes();
      handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'](
        { params: { owner: 'app-a', collection: 'secured', granteeAppId: 'app-b' }, body: { canRead: true, canWrite: true } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Document collection access denied' });
    });
  });

  describe('invalidation', () => {
    it('invalidates after collection upsert', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler({ params: { owner: 'app', collection: 'col' }, body: { description: 'test' } }, createRes());

      expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('documents');
    });

    it('invalidates after document put', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];

      handler({ params: { owner: 'app', collection: 'col', id: 'doc-1' }, body: { data: 1 } }, createRes());

      expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('documents');
    });

    it('invalidates after document delete', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      putHandler({ params: { owner: 'app', collection: 'col', id: 'delete-me' }, body: {} }, createRes());

      invalidateAppTopicsMock.mockReset();

      const delHandler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];
      delHandler({ params: { owner: 'app', collection: 'col', id: 'delete-me' } }, createRes());

      expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('documents');
    });

    it('invalidates after grant set', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'shared' }, body: {} },
        createRes(),
      );

      invalidateAppTopicsMock.mockReset();

      const handler = handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      handler(
        { params: { owner: 'app', collection: 'shared', granteeAppId: 'other' }, body: { canRead: true, canWrite: false } },
        createRes(),
      );

      expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('documents');
    });

    it('invalidates after grant delete', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'shared' }, body: {} },
        createRes(),
      );
      handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'](
        { params: { owner: 'app', collection: 'shared', granteeAppId: 'other' }, body: { canRead: true, canWrite: true } },
        createRes(),
      );

      invalidateAppTopicsMock.mockReset();

      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      handler({ params: { owner: 'app', collection: 'shared', granteeAppId: 'other' } }, createRes());

      expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('documents');
    });

    it('does NOT invalidate on validation failure', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler({ params: { owner: '', collection: '' }, body: {} }, createRes());

      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('does NOT invalidate on forbidden write', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app-a', collection: 'private' }, body: {} },
        createRes(),
      );

      invalidateAppTopicsMock.mockReset();

      caller = { appId: 'app-b', kind: 'app' };
      const handler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      handler({ params: { owner: 'app-a', collection: 'private', id: 'doc-1' }, body: { x: 1 } }, createRes());

      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('does NOT invalidate on document delete 404', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];

      handler({ params: { owner: 'app', collection: 'col', id: 'ghost' } }, createRes());

      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('does NOT invalidate on grant delete 404', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];

      handler({ params: { owner: 'app', collection: 'col', granteeAppId: 'nobody' } }, createRes());

      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('does NOT invalidate on read-only routes', () => {
      const handlers = createHarness();

      handlers['GET /api/documents/collections']({ query: {} }, createRes());
      handlers['GET /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'col' }, query: {} },
        createRes(),
      );

      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    // ── Extension host event publication ────────────────────────────

    it('publishes host event after collection upsert', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler({ params: { owner: 'test-app', collection: 'test-col' }, body: { description: 'test' } }, createRes());

      expect(publishExtensionHostEventMock).toHaveBeenCalledTimes(1);
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'collection.updated',
        owner: 'test-app',
        collection: 'test-col',
      });
    });

    it('publishes host event after document put', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];

      handler({ params: { owner: 'app', collection: 'col', id: 'doc-1' }, body: { data: 1 } }, createRes());

      expect(publishExtensionHostEventMock).toHaveBeenCalledTimes(1);
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.updated',
        owner: 'app',
        collection: 'col',
        id: 'doc-1',
        body: { data: 1 },
      });
    });

    it('publishes host event after document delete', () => {
      const handlers = createHarness();
      const putHandler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      putHandler({ params: { owner: 'app', collection: 'col', id: 'del-doc' }, body: {} }, createRes());

      publishExtensionHostEventMock.mockReset();

      const delHandler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];
      delHandler({ params: { owner: 'app', collection: 'col', id: 'del-doc' } }, createRes());

      expect(publishExtensionHostEventMock).toHaveBeenCalledTimes(1);
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.deleted',
        owner: 'app',
        collection: 'col',
        id: 'del-doc',
      });
    });

    it('publishes host event after grant set', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'shared' }, body: {} },
        createRes(),
      );

      publishExtensionHostEventMock.mockReset();

      const handler = handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      handler(
        { params: { owner: 'app', collection: 'shared', granteeAppId: 'other' }, body: { canRead: true, canWrite: false } },
        createRes(),
      );

      expect(publishExtensionHostEventMock).toHaveBeenCalledTimes(1);
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'grant.updated',
        owner: 'app',
        collection: 'shared',
        granteeAppId: 'other',
      });
    });

    it('publishes host event after grant delete', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'shared' }, body: {} },
        createRes(),
      );
      handlers['PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId'](
        { params: { owner: 'app', collection: 'shared', granteeAppId: 'other' }, body: { canRead: true, canWrite: true } },
        createRes(),
      );

      publishExtensionHostEventMock.mockReset();

      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];
      handler({ params: { owner: 'app', collection: 'shared', granteeAppId: 'other' } }, createRes());

      expect(publishExtensionHostEventMock).toHaveBeenCalledTimes(1);
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'grant.deleted',
        owner: 'app',
        collection: 'shared',
        granteeAppId: 'other',
      });
    });

    it('does NOT publish host event on validation failure', () => {
      const handlers = createHarness();
      const handler = handlers['PUT /api/documents/collections/:owner/:collection'];

      handler({ params: { owner: '', collection: '' }, body: {} }, createRes());

      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });

    it('does NOT publish host event on forbidden write', () => {
      const handlers = createHarness();
      handlers['PUT /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app-a', collection: 'private' }, body: {} },
        createRes(),
      );

      publishExtensionHostEventMock.mockReset();

      caller = { appId: 'app-b', kind: 'app' };
      const handler = handlers['PUT /api/documents/collections/:owner/:collection/:id'];
      handler({ params: { owner: 'app-a', collection: 'private', id: 'doc-1' }, body: { x: 1 } }, createRes());

      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });

    it('does NOT publish host event on document delete 404', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/:id'];

      handler({ params: { owner: 'app', collection: 'col', id: 'ghost' } }, createRes());

      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });

    it('does NOT publish host event on grant delete 404', () => {
      const handlers = createHarness();
      const handler = handlers['DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId'];

      handler({ params: { owner: 'app', collection: 'col', granteeAppId: 'nobody' } }, createRes());

      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });

    it('does NOT publish host event on read-only routes', () => {
      const handlers = createHarness();

      handlers['GET /api/documents/collections']({ query: {} }, createRes());
      handlers['GET /api/documents/collections/:owner/:collection'](
        { params: { owner: 'app', collection: 'col' }, query: {} },
        createRes(),
      );

      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles missing context gracefully', () => {
      logErrorMock.mockReset();
      const handlers: Record<string, unknown> = {};
      const router = {
        get: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
          handlers[`GET ${path}`] = handler;
        }),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
      };

      // Register with no context
      registerDocumentsRoutes(router as never);

      const handler = handlers['GET /api/documents/collections'] as (req: unknown, res: unknown) => void;
      const res = createRes();
      handler({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('getStateRoot') });
    });
  });
});
