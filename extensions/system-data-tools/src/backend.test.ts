/**
 * system-data-tools backend tests
 *
 * Tests the tool handlers and subscription handler using mocked host document capabilities.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dataList, dataRead, dataWatch, dataWrite, onDocumentEvent } from './backend.js';

function mockContext(overrides: Partial<{ extensionId: string }> = {}) {
  const documents = {
    listCollections: vi.fn(),
    getCollection: vi.fn(),
    upsertCollection: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    putDocument: vi.fn(),
    deleteDocument: vi.fn(),
  };
  return {
    extensionId: overrides.extensionId ?? 'system-data-tools',
    runtimeScope: 'shared',
    runtimeDir: '/tmp',
    runtimeSettingsFilePath: '/tmp/settings.json',
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    database: { open: vi.fn(), close: vi.fn(), closeAll: vi.fn() },
    attention: { enqueue: vi.fn() },
    automations: { create: vi.fn(), remove: vi.fn(), list: vi.fn() },
    executions: { start: vi.fn(), cancel: vi.fn(), list: vi.fn(), getLog: vi.fn() },
    models: { complete: vi.fn() },
    knowledge: { search: vi.fn(), get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    conversations: { list: vi.fn(), getMeta: vi.fn(), getBlocks: vi.fn(), create: vi.fn() },
    filesystem: { workspace: vi.fn(), temp: vi.fn() },
    workspace: vi.fn(),
    git: { status: vi.fn(), diff: vi.fn() },
    shell: { exec: vi.fn() },
    runtime: {
      getLiveSessionResourceOptions: vi.fn(),
      getRepoRoot: vi.fn(() => '/repo'),
      refreshSkillMcpConfig: vi.fn(),
    },
    documents,
  } as never;
}

describe('dataList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns collections from the store', async () => {
    const collections = [
      {
        owner: 'app-a',
        collection: 'col-1',
        description: '',
        defaultGrantRead: 'owner',
        defaultGrantWrite: 'owner',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const ctx = mockContext({ extensionId: 'system-data-tools' });
    vi.mocked(ctx.documents.listCollections).mockResolvedValue(collections);

    const result = await dataList({ owner: 'app-a' }, ctx);

    expect(ctx.documents.listCollections).toHaveBeenCalledWith({ owner: 'app-a' });
    expect(result.collections).toEqual(collections);
  });

  it('returns all collections when no owner filter', async () => {
    const collections = [
      {
        owner: 'app-a',
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
    const ctx = mockContext({ extensionId: 'system-data-tools' });
    vi.mocked(ctx.documents.listCollections).mockResolvedValue(collections);

    const result = await dataList({}, ctx);

    expect(ctx.documents.listCollections).toHaveBeenCalledWith({});
    expect(result.collections).toHaveLength(2);
  });
});

describe('dataRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets a single document by id', async () => {
    const doc = { owner: 'app', collection: 'col', id: 'doc-1', body: { data: 42 }, createdAt: '', updatedAt: '' };
    const ctx = mockContext();
    vi.mocked(ctx.documents.getDocument).mockResolvedValue(doc);

    const result = await dataRead({ owner: 'app', collection: 'col', id: 'doc-1' }, ctx);

    expect(ctx.documents.getDocument).toHaveBeenCalledWith({ owner: 'app', collection: 'col', id: 'doc-1' });
    expect(result).toEqual({ document: doc });
  });

  it('returns error for not found', async () => {
    const ctx = mockContext();
    vi.mocked(ctx.documents.getDocument).mockResolvedValue(null);

    const result = await dataRead({ owner: 'app', collection: 'col', id: 'missing' }, ctx);

    expect(result).toEqual({ error: 'Document "app/col/missing" not found' });
  });

  it('lists documents with pagination', async () => {
    const records = [
      { owner: 'app', collection: 'col', id: 'doc-1', body: {}, createdAt: '', updatedAt: '' },
      { owner: 'app', collection: 'col', id: 'doc-2', body: {}, createdAt: '', updatedAt: '' },
    ];
    const ctx = mockContext();
    vi.mocked(ctx.documents.listDocuments).mockResolvedValue({ records, total: 2 });

    const result = await dataRead({ owner: 'app', collection: 'col' }, ctx);

    expect(ctx.documents.listDocuments).toHaveBeenCalledWith({ owner: 'app', collection: 'col', limit: 100, offset: 0 });
    expect(result).toEqual({ records, total: 2 });
  });

  it('respects limit and offset', async () => {
    const ctx = mockContext();
    vi.mocked(ctx.documents.listDocuments).mockResolvedValue({ records: [], total: 0 });

    await dataRead({ owner: 'app', collection: 'col', limit: 10, offset: 20 }, ctx);

    expect(ctx.documents.listDocuments).toHaveBeenCalledWith({ owner: 'app', collection: 'col', limit: 10, offset: 20 });
  });
});

describe('dataWrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('puts a document and returns it', async () => {
    const doc = { owner: 'app', collection: 'col', id: 'doc-1', body: { hello: 'world' }, createdAt: '', updatedAt: '' };
    const ctx = mockContext();
    vi.mocked(ctx.documents.putDocument).mockResolvedValue(doc);

    const result = await dataWrite({ owner: 'app', collection: 'col', id: 'doc-1', body: { hello: 'world' } }, ctx);

    expect(ctx.documents.putDocument).toHaveBeenCalledWith({
      owner: 'app',
      collection: 'col',
      id: 'doc-1',
      body: { hello: 'world' },
    });
    expect(result).toEqual({ document: doc });
  });

  it('uses ctx.documents so authority comes from the host bridge, not a caller-supplied app id', async () => {
    const ctx = mockContext({ extensionId: 'some-other-extension' });
    vi.mocked(ctx.documents.putDocument).mockResolvedValue({
      owner: 'any-owner',
      collection: 'any-collection',
      id: 'doc-1',
      body: {},
      createdAt: '',
      updatedAt: '',
    });

    const result = await dataWrite({ owner: 'any-owner', collection: 'any-collection', id: 'doc-1', body: { value: 42 } }, ctx);

    expect(ctx.documents.putDocument).toHaveBeenCalledWith({
      owner: 'any-owner',
      collection: 'any-collection',
      id: 'doc-1',
      body: { value: 42 },
    });
    expect(ctx.documents.putDocument).toHaveBeenCalledTimes(1);
    expect(result.document).toBeDefined();
  });
});

describe('dataWatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any pending watches between tests
  });

  it('resolves with event when matching document.updated fires', async () => {
    const watchPromise = dataWatch({ owner: 'my-app', timeout: 10 }, mockContext());

    // Simulate the subscription handler receiving a matching event
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: { type: 'document.updated', owner: 'my-app', collection: 'col', id: 'doc-1', body: { data: 1 } },
      sourceExtensionId: 'host',
    });

    const result = await watchPromise;
    expect(result.event).toEqual({
      type: 'document.updated',
      owner: 'my-app',
      collection: 'col',
      id: 'doc-1',
      body: { data: 1 },
    });
  });

  it('resolves with event when matching document.deleted fires', async () => {
    const watchPromise = dataWatch({ owner: 'my-app', collection: 'target-col', timeout: 10 }, mockContext());

    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.deleted',
      payload: { type: 'document.deleted', owner: 'my-app', collection: 'target-col', id: 'doc-2' },
      sourceExtensionId: 'host',
    });

    const result = await watchPromise;
    expect(result.event).toEqual({
      type: 'document.deleted',
      owner: 'my-app',
      collection: 'target-col',
      id: 'doc-2',
    });
  });

  it('ignores events for a different owner', async () => {
    const watchPromise = dataWatch({ owner: 'my-app', timeout: 1 }, mockContext());

    // Fire event for a different owner — should not resolve
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: { type: 'document.updated', owner: 'other-app', collection: 'col', id: 'doc-1', body: {} },
      sourceExtensionId: 'host',
    });

    // Wait briefly to confirm no early resolution
    await new Promise((r) => setTimeout(r, 50));

    // Now fire matching event
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: { type: 'document.updated', owner: 'my-app', collection: 'col', id: 'doc-2', body: { data: 2 } },
      sourceExtensionId: 'host',
    });

    const result = await watchPromise;
    expect(result.event).toBeTruthy();
    expect((result.event as { owner: string }).owner).toBe('my-app');
    expect((result.event as { id: string }).id).toBe('doc-2');
  }, 10_000);

  it('ignores events with non-matching collection filter', async () => {
    const watchPromise = dataWatch({ owner: 'my-app', collection: 'specific-col', timeout: 1 }, mockContext());

    // Fire event for wrong collection
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: { type: 'document.updated', owner: 'my-app', collection: 'other-col', id: 'doc-1', body: {} },
      sourceExtensionId: 'host',
    });

    await new Promise((r) => setTimeout(r, 50));

    // Fire event for correct collection
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: { type: 'document.updated', owner: 'my-app', collection: 'specific-col', id: 'doc-2', body: { data: 3 } },
      sourceExtensionId: 'host',
    });

    const result = await watchPromise;
    expect(result.event).toBeTruthy();
    expect((result.event as { id: string }).id).toBe('doc-2');
  }, 10_000);

  it('resolves with null on timeout', async () => {
    const watchPromise = dataWatch({ owner: 'my-app', timeout: 0.1 }, mockContext()); // 100ms timeout

    const result = await watchPromise;
    expect(result.event).toBeNull();
    expect(result.reason).toBe('timeout');
  }, 5_000);
});

describe('onDocumentEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-object payload', () => {
    // Should not throw
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: null as never,
      sourceExtensionId: 'host',
    });
  });

  it('ignores collection.updated events (not document-level)', () => {
    // No pending watches to resolve, but should not throw
    onDocumentEvent({
      subscriptionId: 'documents',
      event: 'host:documents:collection.updated',
      payload: { type: 'collection.updated', owner: 'app', collection: 'col' },
      sourceExtensionId: 'host',
    });
  });
});
