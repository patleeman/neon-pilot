/**
 * system-documents-counter-sample backend tests
 *
 * Tests the writeBeat and resetBeat actions with mocked host document capabilities.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetBeat, writeBeat } from './backend.js';

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
    extensionId: 'system-documents-counter-sample',
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

function mockPutDoc(body: unknown) {
  return {
    owner: 'system-documents-counter-sample',
    collection: 'shared-heartbeat',
    id: 'beat',
    body,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };
}

describe('writeBeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes first beat (count=1) when no document exists yet', async () => {
    const ctx = mockContext();
    // Collection does not exist -> will upsert
    vi.mocked(ctx.documents.getCollection).mockResolvedValue(null);
    vi.mocked(ctx.documents.upsertCollection).mockResolvedValue({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      description: '',
      defaultGrantRead: 'all',
      defaultGrantWrite: 'owner',
      createdAt: '',
      updatedAt: '',
    });
    // No existing document
    vi.mocked(ctx.documents.getDocument).mockResolvedValue(null);
    vi.mocked(ctx.documents.putDocument).mockImplementation(async ({ body }) => mockPutDoc(body));

    const result = await writeBeat({}, ctx);

    // Should have created the shared collection
    expect(ctx.documents.upsertCollection).toHaveBeenCalledWith({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      options: expect.objectContaining({ defaultGrantRead: 'all' }),
    });
    // Should have written the document with count=1
    expect(ctx.documents.putDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'beat', body: expect.objectContaining({ count: 1 }) }),
    );
    expect(result.document.body.count).toBe(1);
    expect(result.document.body.timestamp).toBeTruthy();
    // No previousTimestamp on first write
    expect(result.document.body.previousTimestamp).toBeUndefined();
  });

  it('increments counter on subsequent writes', async () => {
    const ctx = mockContext();
    // Collection already exists
    vi.mocked(ctx.documents.getCollection).mockResolvedValue({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      description: '',
      defaultGrantRead: 'all',
      defaultGrantWrite: 'owner',
      createdAt: '',
      updatedAt: '',
    });
    // Existing document at count=5
    vi.mocked(ctx.documents.getDocument).mockResolvedValue({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      id: 'beat',
      body: { count: 5, timestamp: '2024-06-01T12:00:00.000Z' },
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(ctx.documents.putDocument).mockImplementation(async ({ body }) => mockPutDoc(body));

    const result = await writeBeat({}, ctx);

    // Should NOT re-create collection
    expect(ctx.documents.upsertCollection).not.toHaveBeenCalled();
    // Count should be 6
    expect(ctx.documents.putDocument).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ count: 6 }) }));
    expect(result.document.body.count).toBe(6);
    expect(result.document.body.previousTimestamp).toBe('2024-06-01T12:00:00.000Z');
  });
});

describe('resetBeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets the heartbeat counter to 0', async () => {
    const ctx = mockContext();
    vi.mocked(ctx.documents.getCollection).mockResolvedValue(null);
    vi.mocked(ctx.documents.upsertCollection).mockResolvedValue({
      owner: 'system-documents-counter-sample',
      collection: 'shared-heartbeat',
      description: '',
      defaultGrantRead: 'all',
      defaultGrantWrite: 'owner',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(ctx.documents.putDocument).mockImplementation(async ({ body }) => mockPutDoc(body));

    const result = await resetBeat({}, ctx);

    expect(ctx.documents.putDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'system-documents-counter-sample',
        id: 'beat',
        body: expect.objectContaining({ count: 0 }),
      }),
    );
    expect(result).toEqual({ ok: true });
  });
});
