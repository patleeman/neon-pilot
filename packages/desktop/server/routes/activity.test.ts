/**
 * Activity Entries Route Tests
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
import { registerActivityEntriesRoutes } from './activity.js';

describe('registerActivityEntriesRoutes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'activity-route-test-'));
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createHarness() {
    const desktopRootLayout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });
    const handlers: Record<string, (req: unknown, res: unknown) => void> = {};
    const router = {
      get: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`GET ${path}`] = handler;
      }),
      post: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`POST ${path}`] = handler;
      }),
      delete: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`DELETE ${path}`] = handler;
      }),
    };

    registerActivityEntriesRoutes(router as never, {
      getStateRoot: () => tmpDir,
      getDesktopRootLayout: () => desktopRootLayout,
    });

    return handlers;
  }

  function getHarnessStore(): ReturnType<typeof getDocumentsStore> {
    return getDocumentsStore(tmpDir, resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') }));
  }

  function createRes() {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
  }

  function seedEntry(
    handlers: Record<string, (req: unknown, res: unknown) => void>,
    overrides: Record<string, unknown> = {},
  ): { document: { id: string } } {
    const res = createRes();
    handlers['POST /api/activity/entries'](
      {
        body: {
          type: 'info',
          title: 'Test entry',
          ...overrides,
        },
      },
      res,
    );
    expect(res.json).toHaveBeenCalled();
    return res.json.mock.calls[0][0] as { document: { id: string } };
  }

  describe('create', () => {
    it('POST creates an entry with required fields', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/activity/entries'](
        {
          body: {
            type: 'app_launch',
            title: 'Notes app launched',
            source: 'Window manager',
          },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            owner: 'activity',
            collection: 'activity-entries',
            body: expect.objectContaining({
              type: 'app_launch',
              title: 'Notes app launched',
              source: 'Window manager',
            }),
          }),
        }),
      );
    });

    it('POST accepts optional fields', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/activity/entries'](
        {
          body: {
            type: 'error',
            title: 'Connection failed',
            subtitle: 'Timeout after 30s',
            kind: 'error',
            metadata: { code: 500 },
            processed: false,
          },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            body: expect.objectContaining({
              type: 'error',
              title: 'Connection failed',
              subtitle: 'Timeout after 30s',
              kind: 'error',
              metadata: { code: 500 },
              processed: false,
            }),
          }),
        }),
      );
    });

    it('POST accepts an explicit id', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/activity/entries'](
        {
          body: {
            id: 'custom-entry-id',
            type: 'info',
            title: 'Custom entry',
          },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ id: 'custom-entry-id' }),
        }),
      );
    });

    it('POST rejects duplicate id', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'dup-entry' });

      const res = createRes();
      handlers['POST /api/activity/entries'](
        {
          body: {
            id: 'dup-entry',
            type: 'info',
            title: 'Second entry',
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('already exists') });
    });

    it('POST validates required fields', () => {
      const handlers = createHarness();

      // Missing type
      const res1 = createRes();
      handlers['POST /api/activity/entries']({ body: { title: 'No type' } }, res1);
      expect(res1.status).toHaveBeenCalledWith(400);
      expect(res1.json).toHaveBeenCalledWith({ error: expect.stringContaining('type') });

      // Missing title
      const res2 = createRes();
      handlers['POST /api/activity/entries']({ body: { type: 'info' } }, res2);
      expect(res2.status).toHaveBeenCalledWith(400);
      expect(res2.json).toHaveBeenCalledWith({ error: expect.stringContaining('title') });
    });

    it('POST rejects invalid kind values', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/activity/entries'](
        {
          body: {
            type: 'info',
            title: 'Invalid kind',
            kind: 'unexpected',
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('kind must be one of') });
    });

    it('POST generates an id when none is provided', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/activity/entries'](
        {
          body: { type: 'info', title: 'Auto id' },
        },
        res,
      );

      const payload = res.json.mock.calls[0][0] as { document: { id: string } };
      expect(payload.document.id).toMatch(/^act_/);
    });
  });

  describe('list', () => {
    it('returns entries newest-first', () => {
      const handlers = createHarness();
      const first = seedEntry(handlers, { id: 'a', title: 'first' }).document;
      const second = seedEntry(handlers, { id: 'b', title: 'second' }).document;

      const res = createRes();
      handlers['GET /api/activity/entries']({ query: {} }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(2);
      // Most recent first (second was created after first)
      expect(payload.records.map((r) => r.id)).toEqual([second.id, first.id]);
    });

    it('filters by type', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'info-1', type: 'info' });
      seedEntry(handlers, { id: 'err-1', type: 'error' });
      seedEntry(handlers, { id: 'launch-1', type: 'app_launch' });

      const res = createRes();
      handlers['GET /api/activity/entries']({ query: { type: 'error' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(1);
      expect(payload.records[0].id).toBe('err-1');
    });

    it('filters by processed status', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'unprocessed', processed: false });
      seedEntry(handlers, { id: 'processed-1', processed: true });

      const res = createRes();
      handlers['GET /api/activity/entries']({ query: { processed: 'true' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(1);
      expect(payload.records[0].id).toBe('processed-1');
    });

    it('respects limit and offset', () => {
      const handlers = createHarness();
      for (let i = 0; i < 5; i++) {
        seedEntry(handlers, { id: `entry-${i}` });
      }

      const res = createRes();
      handlers['GET /api/activity/entries']({ query: { limit: '2', offset: '1' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(5);
      expect(payload.records).toHaveLength(2);
    });

    it('returns empty list when no entries exist', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['GET /api/activity/entries']({ query: {} }, res);

      expect(res.json).toHaveBeenCalledWith({ records: [], total: 0 });
    });

    it('ignores non-activity documents owned by other collections', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'activity-1' });
      // Directly write a foreign document
      const store = getHarnessStore();
      store.putDocument('other-app', 'entries', 'foreign-1', { type: 'info', title: 'Foreign' });

      const res = createRes();
      handlers['GET /api/activity/entries']({ query: {} }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string; owner: string }[]; total: number };
      expect(payload.records.every((r) => r.owner === 'activity')).toBe(true);
      expect(payload.records.map((r) => r.id)).toEqual(['activity-1']);
    });
  });

  describe('get', () => {
    it('GET retrieves a seeded entry', () => {
      const handlers = createHarness();
      const created = seedEntry(handlers, { id: 'fetch-me' });

      const res = createRes();
      handlers['GET /api/activity/entries/:id']({ params: { id: created.document.id }, query: {} }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ document: expect.objectContaining({ id: 'fetch-me' }) }));
    });

    it('GET returns 404 for missing entry', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['GET /api/activity/entries/:id']({ params: { id: 'missing' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Activity entry not found' });
    });

    it('GET does not return foreign-collection documents', () => {
      const handlers = createHarness();
      const store = getHarnessStore();
      store.putDocument('other-app', 'entries', 'foreign-1', { type: 'info', title: 'Foreign' });

      const res = createRes();
      handlers['GET /api/activity/entries/:id']({ params: { id: 'foreign-1' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('delete', () => {
    it('deletes an entry', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'remove-me' });

      const res = createRes();
      handlers['DELETE /api/activity/entries/:id']({ params: { id: 'remove-me' } }, res);

      expect(res.json).toHaveBeenCalledWith({ deleted: true });

      // Verify it's gone
      const getRes = createRes();
      handlers['GET /api/activity/entries/:id']({ params: { id: 'remove-me' } }, getRes);
      expect(getRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 for missing entry', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['DELETE /api/activity/entries/:id']({ params: { id: 'ghost' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('invalidation and events', () => {
    it('invalidates activity and documents after create', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'inv-1' });

      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('activity', 'documents');
    });

    it('invalidates after delete', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'inv-2' });
      invalidateAppTopicsMock.mockReset();

      handlers['DELETE /api/activity/entries/:id']({ params: { id: 'inv-2' } }, createRes());
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('activity', 'documents');
    });

    it('does NOT invalidate on failed create (validation)', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['POST /api/activity/entries']({ body: { type: 'info' } }, res);
      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('publishes activity and documents host events after create', () => {
      const handlers = createHarness();
      const created = seedEntry(handlers, { id: 'evt-1' });

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('activity', {
        type: 'activity.created',
        owner: 'activity',
        collection: 'activity-entries',
        id: created.document.id,
      });
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.updated',
        owner: 'activity',
        collection: 'activity-entries',
        id: created.document.id,
        body: expect.objectContaining({ title: 'Test entry' }),
      });
    });

    it('publishes activity and documents host events after delete', () => {
      const handlers = createHarness();
      seedEntry(handlers, { id: 'evt-2' });
      publishExtensionHostEventMock.mockReset();

      handlers['DELETE /api/activity/entries/:id']({ params: { id: 'evt-2' } }, createRes());

      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('activity', {
        type: 'activity.deleted',
        owner: 'activity',
        collection: 'activity-entries',
        id: 'evt-2',
      });
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.deleted',
        owner: 'activity',
        collection: 'activity-entries',
        id: 'evt-2',
      });
    });

    it('does NOT publish host event on failed create', () => {
      const handlers = createHarness();
      handlers['POST /api/activity/entries']({ body: {} }, createRes());
      expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
    });
  });

  describe('missing context', () => {
    it('handles missing context gracefully', () => {
      logErrorMock.mockReset();
      const handlers: Record<string, unknown> = {};
      const router = {
        get: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
          handlers[`GET ${path}`] = handler;
        }),
        post: vi.fn(),
        delete: vi.fn(),
      };

      registerActivityEntriesRoutes(router as never);

      const handler = handlers['GET /api/activity/entries'] as (req: unknown, res: unknown) => void;
      const res = createRes();
      handler({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('getStateRoot') });
    });
  });
});
