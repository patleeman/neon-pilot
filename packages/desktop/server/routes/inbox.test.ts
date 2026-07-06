/**
 * Inbox Route Tests
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
import { registerInboxRoutes } from './inbox.js';

describe('registerInboxRoutes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'inbox-route-test-'));
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
      patch: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`PATCH ${path}`] = handler;
      }),
      delete: vi.fn((path: string, handler: (req: unknown, res: unknown) => void) => {
        handlers[`DELETE ${path}`] = handler;
      }),
    };

    registerInboxRoutes(router as never, {
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

  function seedMessage(
    handlers: Record<string, (req: unknown, res: unknown) => void>,
    overrides: Record<string, unknown> = {},
  ): { document: { id: string } } {
    const res = createRes();
    handlers['POST /api/inbox'](
      {
        body: {
          from: 'worker-1',
          fromKind: 'worker',
          subject: 'Run finished',
          body: 'Done.',
          kind: 'result',
          ...overrides,
        },
      },
      res,
    );
    expect(res.json).toHaveBeenCalled();
    return res.json.mock.calls[0][0] as { document: { id: string } };
  }

  describe('create', () => {
    it('POST creates a message with default read and archived state', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/inbox'](
        {
          body: {
            from: 'worker-1',
            fromKind: 'worker',
            subject: 'Run finished',
            body: 'Done.',
            kind: 'result',
            refId: 'run-123',
          },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            owner: 'system-inbox',
            collection: 'messages',
            body: expect.objectContaining({
              from: 'worker-1',
              fromKind: 'worker',
              subject: 'Run finished',
              body: 'Done.',
              kind: 'result',
              read: false,
              archived: false,
              refId: 'run-123',
            }),
          }),
        }),
      );
    });

    it('POST accepts an explicit id and to field', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/inbox'](
        {
          body: {
            id: 'custom-id',
            from: 'persona',
            fromKind: 'persona',
            to: 'user',
            subject: 'Hello',
            body: 'Hi there',
            kind: 'note',
          },
        },
        res,
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ id: 'custom-id', body: expect.objectContaining({ to: 'user' }) }),
        }),
      );
    });

    it('POST rejects duplicate id', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'dup-id' });

      const res = createRes();
      handlers['POST /api/inbox'](
        {
          body: {
            id: 'dup-id',
            from: 'persona',
            fromKind: 'persona',
            subject: 'Second',
            body: 'nope',
            kind: 'note',
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('already exists') });
    });

    it('POST validates required fields', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/inbox'](
        {
          body: { from: 'persona', fromKind: 'persona', subject: 's', kind: 'bogus', body: 'x' },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('kind must be one of') });
    });

    it('POST rejects empty body text', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['POST /api/inbox'](
        {
          body: { from: 'persona', fromKind: 'persona', subject: 's', kind: 'note', body: '' },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('list', () => {
    it('returns messages newest-first', () => {
      const handlers = createHarness();
      const first = seedMessage(handlers, { id: 'a', subject: 'first' }).document;
      const second = seedMessage(handlers, { id: 'b', subject: 'second' }).document;

      // Mutate second via patch so its updatedAt moves past the first.
      handlers['PATCH /api/inbox/:id']({ params: { id: second.id }, body: { read: true } }, createRes());

      const res = createRes();
      handlers['GET /api/inbox']({ query: {} }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(2);
      expect(payload.records.map((r) => r.id)).toEqual([second.id, first.id]);
    });

    it('excludes archived messages by default', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'visible' });
      seedMessage(handlers, { id: 'archived' });
      handlers['PATCH /api/inbox/:id']({ params: { id: 'archived' }, body: { archived: true } }, createRes());

      const res = createRes();
      handlers['GET /api/inbox']({ query: {} }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.records.map((r) => r.id)).toEqual(['visible']);
      expect(payload.total).toBe(1);
    });

    it('returns archived messages when archived=true', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'visible' });
      seedMessage(handlers, { id: 'archived' });
      handlers['PATCH /api/inbox/:id']({ params: { id: 'archived' }, body: { archived: true } }, createRes());

      const res = createRes();
      handlers['GET /api/inbox']({ query: { archived: 'true' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.records.map((r) => r.id)).toEqual(['archived']);
    });

    it('supports unreadOnly filter', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'read' });
      seedMessage(handlers, { id: 'unread' });
      handlers['PATCH /api/inbox/:id']({ params: { id: 'read' }, body: { read: true } }, createRes());

      const res = createRes();
      handlers['GET /api/inbox']({ query: { unreadOnly: '1' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.records.map((r) => r.id)).toEqual(['unread']);
    });

    it('respects limit and offset', () => {
      const handlers = createHarness();
      for (let i = 0; i < 5; i++) {
        seedMessage(handlers, { id: `msg-${i}` });
      }

      const res = createRes();
      handlers['GET /api/inbox']({ query: { limit: '2', offset: '1' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(5);
      expect(payload.records).toHaveLength(2);
    });

    it('totals and pages beyond the first 500 stored messages', () => {
      const handlers = createHarness();
      for (let i = 0; i < 505; i++) {
        seedMessage(handlers, { id: `bulk-${String(i).padStart(3, '0')}` });
      }

      const res = createRes();
      handlers['GET /api/inbox']({ query: { limit: '10', offset: '500' } }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string }[]; total: number };
      expect(payload.total).toBe(505);
      expect(payload.records).toHaveLength(5);
    });

    it('ignores non-inbox documents owned by other collections', () => {
      // Sanity: a non-inbox document in the same store should not leak into list.
      const handlers = createHarness();
      // Use the route to put an inbox message; then directly use the documents
      // store to put a foreign-collection document and confirm it is excluded.
      seedMessage(handlers, { id: 'inbox-1' });
      const store = getHarnessStore();
      store.putDocument('another-app', 'messages', 'foreign-1', { from: 'x' });

      const res = createRes();
      handlers['GET /api/inbox']({ query: {} }, res);

      const payload = res.json.mock.calls[0][0] as { records: { id: string; owner: string }[]; total: number };
      expect(payload.records.every((r) => r.owner === 'system-inbox')).toBe(true);
      expect(payload.records.map((r) => r.id)).toEqual(['inbox-1']);
    });
  });

  describe('get', () => {
    it('GET retrieves a seeded message', () => {
      const handlers = createHarness();
      const created = seedMessage(handlers, { id: 'fetch-me' });

      const res = createRes();
      handlers['GET /api/inbox/:id']({ params: { id: created.document.id }, query: {} }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ document: expect.objectContaining({ id: 'fetch-me' }) }));
    });

    it('GET returns 404 for missing message', () => {
      const handlers = createHarness();
      const res = createRes();

      handlers['GET /api/inbox/:id']({ params: { id: 'missing' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Inbox message not found' });
    });

    it('GET does not return foreign-collection documents', () => {
      const handlers = createHarness();
      const store = getHarnessStore();
      store.putDocument('another-app', 'messages', 'leak-1', { from: 'x' });

      const res = createRes();
      handlers['GET /api/inbox/:id']({ params: { id: 'leak-1' }, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('patch', () => {
    it('marks a message read', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'mark-me' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'mark-me' }, body: { read: true } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ body: expect.objectContaining({ read: true, archived: false }) }),
        }),
      );
    });

    it('archives a message without touching read flag', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'archive' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'archive' }, body: { archived: true } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ body: expect.objectContaining({ archived: true, read: false }) }),
        }),
      );
    });

    it('restores an archived message with archived=false', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'restore' });
      handlers['PATCH /api/inbox/:id']({ params: { id: 'restore' }, body: { archived: true } }, createRes());

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'restore' }, body: { archived: false } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ body: expect.objectContaining({ archived: false }) }),
        }),
      );
    });

    it('accepts answer on a question-kind message', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'q1', kind: 'question', subject: 'Continue?', body: 'Should we proceed?' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'q1' }, body: { answer: 'Yes, proceed' } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            body: expect.objectContaining({
              answer: expect.objectContaining({ text: 'Yes, proceed', answeredAt: expect.any(String) }),
              archived: false,
              read: false,
            }),
          }),
        }),
      );
    });

    it('rejects replacing an existing question answer', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'q-answered', kind: 'question', subject: 'Continue?', body: 'Should we proceed?' });
      handlers['PATCH /api/inbox/:id']({ params: { id: 'q-answered' }, body: { answer: 'Yes, proceed' } }, createRes());

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'q-answered' }, body: { answer: 'Actually, no' } }, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('already has an answer') });
    });

    it('rejects answer on non-question messages', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'result-1', kind: 'result', subject: 'Done', body: 'Result body' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'result-1' }, body: { answer: 'Looks good' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('only supported for question messages') });
    });

    it('rejects empty answer string', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'q2', kind: 'question' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'q2' }, body: { answer: '' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('non-empty') });
    });

    it('rejects non-string answer', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'q3', kind: 'question' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'q3' }, body: { answer: 42 } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('non-empty') });
    });

    it('rejects patch with no recognized field (read, archived, or answer)', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'noop' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'noop' }, body: { subject: 'rewritten' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects invalid boolean patch values', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'bad-bool' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'bad-bool' }, body: { archived: 'yes' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'archived must be a boolean' });
    });

    it('returns 404 for missing message', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'ghost' }, body: { read: true } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('preserves other body fields through patch', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'keep', refId: 'run-1', subject: 'kept subject' });

      const res = createRes();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'keep' }, body: { read: true } }, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            body: expect.objectContaining({ refId: 'run-1', subject: 'kept subject', read: true }),
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes a message', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'remove-me' });

      const res = createRes();
      handlers['DELETE /api/inbox/:id']({ params: { id: 'remove-me' } }, res);

      expect(res.json).toHaveBeenCalledWith({ deleted: true });

      const getRes = createRes();
      handlers['GET /api/inbox/:id']({ params: { id: 'remove-me' } }, getRes);
      expect(getRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 for missing message', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['DELETE /api/inbox/:id']({ params: { id: 'ghost' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('invalidation and events', () => {
    it('invalidates inbox and documents after create', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'inv-1' });
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('inbox', 'documents');
    });

    it('invalidates after patch', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'inv-2' });
      invalidateAppTopicsMock.mockReset();

      handlers['PATCH /api/inbox/:id']({ params: { id: 'inv-2' }, body: { read: true } }, createRes());
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('inbox', 'documents');
    });

    it('invalidates after delete', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'inv-3' });
      invalidateAppTopicsMock.mockReset();

      handlers['DELETE /api/inbox/:id']({ params: { id: 'inv-3' } }, createRes());
      expect(invalidateAppTopicsMock).toHaveBeenCalledWith('inbox', 'documents');
    });

    it('does NOT invalidate on failed create (validation)', () => {
      const handlers = createHarness();
      const res = createRes();
      handlers['POST /api/inbox']({ body: { from: 'x' } }, res);
      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('does NOT invalidate on patch 404', () => {
      const handlers = createHarness();
      handlers['PATCH /api/inbox/:id']({ params: { id: 'missing' }, body: { read: true } }, createRes());
      expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    });

    it('publishes inbox and documents host events after create', () => {
      const handlers = createHarness();
      const created = seedMessage(handlers, { id: 'evt-1' });
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('inbox', {
        type: 'inbox.created',
        owner: 'system-inbox',
        collection: 'messages',
        id: created.document.id,
      });
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.updated',
        owner: 'system-inbox',
        collection: 'messages',
        id: created.document.id,
        body: expect.objectContaining({ subject: 'Run finished' }),
      });
    });

    it('publishes inbox and documents host events after patch with change summary', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'evt-2' });
      publishExtensionHostEventMock.mockReset();

      handlers['PATCH /api/inbox/:id']({ params: { id: 'evt-2' }, body: { read: true } }, createRes());
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
        'inbox',
        expect.objectContaining({
          type: 'inbox.updated',
          id: 'evt-2',
          changes: { read: true },
        }),
      );
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
        'documents',
        expect.objectContaining({
          type: 'document.updated',
          owner: 'system-inbox',
          collection: 'messages',
          id: 'evt-2',
          body: expect.objectContaining({ read: true }),
        }),
      );
    });

    it('publishes inbox and documents host events after delete', () => {
      const handlers = createHarness();
      seedMessage(handlers, { id: 'evt-3' });
      publishExtensionHostEventMock.mockReset();

      handlers['DELETE /api/inbox/:id']({ params: { id: 'evt-3' } }, createRes());
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('inbox', {
        type: 'inbox.deleted',
        owner: 'system-inbox',
        collection: 'messages',
        id: 'evt-3',
      });
      expect(publishExtensionHostEventMock).toHaveBeenCalledWith('documents', {
        type: 'document.deleted',
        owner: 'system-inbox',
        collection: 'messages',
        id: 'evt-3',
      });
    });

    it('does NOT publish host event on failed create', () => {
      const handlers = createHarness();
      handlers['POST /api/inbox']({ body: {} }, createRes());
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
        patch: vi.fn(),
        delete: vi.fn(),
      };

      registerInboxRoutes(router as never);

      const handler = handlers['GET /api/inbox'] as (req: unknown, res: unknown) => void;
      const res = createRes();
      handler({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('getStateRoot') });
    });
  });
});
