/**
 * system-documents-reader-sample backend tests
 *
 * Tests the readBeat action (reading from a shared collection) and the
 * onDocumentChanged subscription handler (recording document events).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetReceivedEventsForTests, getEvents, onDocumentChanged, readBeat } from './backend.js';

function mockContext() {
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
    extensionId: 'system-documents-reader-sample',
    runtimeScope: 'shared',
    runtimeDir: '/tmp',
    runtimeSettingsFilePath: '/tmp/settings.json',
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    database: { open: vi.fn(), close: vi.fn(), closeAll: vi.fn() },
    attention: { enqueue: vi.fn() },
    automations: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    executions: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    models: { list: vi.fn() } as Record<string, (...args: never[]) => Promise<unknown>>,
    knowledge: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    conversations: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    filesystem: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    workspace: vi.fn(),
    git: {} as Record<string, (...args: never[]) => Promise<unknown>>,
    shell: { exec: vi.fn() },
    runtime: {
      getLiveSessionResourceOptions: vi.fn(),
      getRepoRoot: vi.fn(() => '/repo'),
      refreshSkillMcpConfig: vi.fn(),
    },
    documents,
  } as never;
}

describe('readBeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the heartbeat document when it exists', async () => {
    const ctx = mockContext();
    const expectedDoc = {
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      id: 'beat',
      body: { count: 7, timestamp: '2024-07-01T00:00:00.000Z', previousTimestamp: '2024-06-01T00:00:00.000Z' },
      createdAt: '2024-06-01T00:00:00.000Z',
      updatedAt: '2024-07-01T00:00:00.000Z',
    };
    vi.mocked(ctx.documents.getDocument).mockResolvedValue(expectedDoc);

    const result = await readBeat({}, ctx);

    expect(ctx.documents.getDocument).toHaveBeenCalledWith({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      id: 'beat',
    });
    expect(result.document).toEqual(expectedDoc);
    expect(result.document!.body.count).toBe(7);
  });

  it('returns null when no heartbeat document exists', async () => {
    const ctx = mockContext();
    vi.mocked(ctx.documents.getDocument).mockResolvedValue(null);

    const result = await readBeat({}, ctx);

    expect(result.document).toBeNull();
  });
});

describe('onDocumentChanged (subscription handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetReceivedEventsForTests();
  });

  it('records a document.updated event for the shared heartbeat collection', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: {
        type: 'document.updated',
        owner: 'system-documents-counter-sample',
        collection: 'shared-heartbeat',
        id: 'beat',
        body: { count: 3, timestamp: '2024-07-01T00:00:00.000Z' },
      },
      sourceExtensionId: 'host',
    });

    const { events } = await getEvents({});
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'document.updated',
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      id: 'beat',
    });
    expect((events[0].body as Record<string, unknown>).count).toBe(3);
  });

  it('accumulates multiple events', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: {
        type: 'document.updated',
        owner: 'system-documents-counter-sample',
        collection: 'shared-heartbeat',
        id: 'beat',
        body: { count: 4, timestamp: '2024-07-02T00:00:00.000Z' },
      },
      sourceExtensionId: 'host',
    });

    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: {
        type: 'document.updated',
        owner: 'system-documents-counter-sample',
        collection: 'shared-heartbeat',
        id: 'beat',
        body: { count: 5, timestamp: '2024-07-03T00:00:00.000Z' },
      },
      sourceExtensionId: 'host',
    });

    const { events } = await getEvents({});
    expect(events).toHaveLength(2);
    expect((events[0].body as Record<string, unknown>).count).toBe(4);
    expect((events[1].body as Record<string, unknown>).count).toBe(5);
  });

  it('ignores events for non-heartbeat collections', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: {
        type: 'document.updated',
        owner: 'some-other-app',
        collection: 'unrelated-collection',
        id: 'doc-1',
        body: { data: 42 },
      },
      sourceExtensionId: 'host',
    });

    const { events } = await getEvents({});
    // Only events from shared-heartbeat should be recorded
    const heartbeatEvents = events.filter((e) => e.collection === 'shared-heartbeat');
    expect(heartbeatEvents).toHaveLength(0);
  });

  it('ignores heartbeat collection events from other owners', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: {
        type: 'document.updated',
        owner: 'some-other-app',
        collection: 'shared-heartbeat',
        id: 'beat',
        body: { count: 99 },
      },
      sourceExtensionId: 'host',
    });

    const { events } = await getEvents({});
    expect(events).toHaveLength(0);
  });

  it('ignores collection.updated events (not document-level)', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:collection.updated',
      payload: {
        type: 'collection.updated' as never,
        owner: 'system-documents-counter-sample',
        collection: 'shared-heartbeat',
      },
      sourceExtensionId: 'host',
    });

    const { events } = await getEvents({});
    const collectionEvents = events.filter((e) => e.type === 'collection.updated');
    expect(collectionEvents).toHaveLength(0);
  });

  it('handles null payload gracefully', async () => {
    onDocumentChanged({
      subscriptionId: 'documents',
      event: 'host:documents:document.updated',
      payload: null as never,
      sourceExtensionId: 'host',
    });

    // Should not throw, events should remain unchanged
    const { events } = await getEvents({});
    expect(Array.isArray(events)).toBe(true);
  });
});
