import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function htmlResponse(body = '<!doctype html><html><body>SPA fallback</body></html>', status = 200): Response {
  return new Response(body, {
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: { 'Content-Type': 'text/html' },
  });
}

function resetApiTestGlobals(): void {
  vi.resetModules();
}

describe('api request parsing', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the API path when an OK response is HTML instead of JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse()),
    );

    const { api } = await import('./api.js');
    await expect(api.extensionSlashCommands()).rejects.toThrow(
      'Expected JSON from /api/extensions/slash-commands, received text/html: <!doctype html>',
    );
  });

  it('includes non-JSON error body previews', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse('<!doctype html><html><body>Missing route</body></html>', 404)),
    );

    const { api } = await import('./api.js');
    await expect(api.extensionSlashCommands()).rejects.toThrow('404 Not Found from /api/extensions/slash-commands: <!doctype html>');
  });
});

describe('api.extensions', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads extension command registrations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([{ extensionId: 'agent-board', surfaceId: 'task', name: 'task' }]));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.extensionSlashCommands()).resolves.toEqual([{ extensionId: 'agent-board', surfaceId: 'task', name: 'task' }]);

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/slash-commands', { method: 'GET', cache: 'no-store' });
  });

  it('creates extension packages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, packageRoot: '/tmp/extensions/agent-board' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.createExtension({ id: 'agent-board', name: 'Agent Board' })).resolves.toEqual({
      ok: true,
      packageRoot: '/tmp/extensions/agent-board',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'agent-board', name: 'Agent Board' }),
    });
  });

  it('imports extension packages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, packageRoot: '/tmp/extensions/agent-board' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.importExtension({ zipPath: '/tmp/agent-board.zip' })).resolves.toEqual({
      ok: true,
      packageRoot: '/tmp/extensions/agent-board',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipPath: '/tmp/agent-board.zip' }),
    });
  });

  it('snapshots extension packages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, extensionId: 'agent-board', snapshotPath: '/tmp/snapshots/agent-board' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.snapshotExtension('agent-board')).resolves.toEqual({
      ok: true,
      extensionId: 'agent-board',
      snapshotPath: '/tmp/snapshots/agent-board',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/agent-board/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('exports extension packages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, extensionId: 'agent-board', exportPath: '/tmp/agent-board.zip' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.exportExtension('agent-board')).resolves.toEqual({
      ok: true,
      extensionId: 'agent-board',
      exportPath: '/tmp/agent-board.zip',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/agent-board/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('invokes extension actions', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, result: { text: 'created' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.invokeExtensionAction('agent-board', 'createTask', { argument: 'Ship it' })).resolves.toEqual({
      ok: true,
      result: { text: 'created' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/extensions/agent-board/actions/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ argument: 'Ship it' }),
    });
  });
});

describe('api live session surface forwarding', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards surface ids for branch and fork controls', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ newSessionId: 'branched', sessionFile: '/tmp/branched.jsonl' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await api.branchSession('thread-1', 'entry-1', 'surface-1');
    await api.forkSession('thread-1', 'entry-2', { preserveSource: false, beforeEntry: true, branchKind: 'rewind' }, 'surface-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/live-sessions/thread-1/branch',
      expect.objectContaining({ body: JSON.stringify({ entryId: 'entry-1', surfaceId: 'surface-1' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/live-sessions/thread-1/fork',
      expect.objectContaining({
        body: JSON.stringify({
          entryId: 'entry-2',
          preserveSource: false,
          beforeEntry: true,
          branchKind: 'rewind',
          surfaceId: 'surface-1',
        }),
      }),
    );
  });
});

describe('api.documents grants', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists document collections through the shared api path prefix', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ collections: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.collections('owner/app')).resolves.toEqual({ collections: [] });

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/collections?owner=owner%2Fapp', {
      method: 'GET',
      cache: 'no-store',
    });
  });

  it('saves documents through the shared api path prefix', async () => {
    const document = {
      owner: 'owner',
      collection: 'tasks',
      id: 'doc/1',
      content: { title: 'Plan' },
      createdAt: '2026-07-06T00:00:00.000Z',
      updatedAt: '2026-07-06T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async () => jsonResponse({ document }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.put('owner', 'tasks', 'doc/1', { title: 'Plan' })).resolves.toEqual({ document });

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/collections/owner/tasks/doc%2F1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Plan' }),
    });
  });

  it('lists collection grants with encoded owner and collection path segments', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ grants: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.listGrants('owner/app', 'tasks inbox')).resolves.toEqual({ grants: [] });

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/collections/owner%2Fapp/tasks%20inbox/grants', {
      method: 'GET',
      cache: 'no-store',
    });
  });

  it('sets collection grants with encoded grantee path segment', async () => {
    const grant = {
      id: 'owner::tasks::reader',
      owner: 'owner',
      collection: 'tasks',
      granteeAppId: 'reader/app',
      canRead: true,
      canWrite: false,
      createdAt: '2026-07-06T00:00:00.000Z',
      updatedAt: '2026-07-06T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async () => jsonResponse({ grant }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.setGrant('owner', 'tasks', 'reader/app', { canRead: true, canWrite: false })).resolves.toEqual({ grant });

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/collections/owner/tasks/grants/reader%2Fapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canRead: true, canWrite: false }),
    });
  });

  it('deletes collection grants with encoded grantee path segment', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ deleted: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.deleteGrant('owner', 'tasks', 'reader/app')).resolves.toEqual({ deleted: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/collections/owner/tasks/grants/reader%2Fapp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    });
  });
});

describe('api.documents search', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches documents through POST /documents/search', async () => {
    const searchResult = {
      query: 'test',
      limit: 10,
      offset: 0,
      total: 2,
      records: [
        {
          owner: 'app',
          collection: 'col',
          id: 'doc-1',
          body: { title: 'test doc' },
          createdAt: '2026-07-06T00:00:00.000Z',
          updatedAt: '2026-07-06T00:00:00.000Z',
        },
        {
          owner: 'app',
          collection: 'col',
          id: 'doc-2',
          body: { title: 'another test' },
          createdAt: '2026-07-06T00:00:00.000Z',
          updatedAt: '2026-07-06T00:00:00.000Z',
        },
      ],
    };
    const fetchMock = vi.fn(async () => jsonResponse(searchResult));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.search('test', { limit: 10 })).resolves.toEqual(searchResult);

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', limit: 10 }),
    });
  });

  it('searches documents with default options', async () => {
    const searchResult = { query: 'hello', limit: 20, offset: 0, total: 0, records: [] };
    const fetchMock = vi.fn(async () => jsonResponse(searchResult));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await expect(api.documents.search('hello')).resolves.toEqual(searchResult);

    expect(fetchMock).toHaveBeenCalledWith('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'hello' }),
    });
  });
});

describe('api.activity entries', () => {
  beforeEach(resetApiTestGlobals);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates activity entries through the host activity endpoint', async () => {
    const document = { owner: 'activity', collection: 'activity-entries', id: 'activity-1' };
    const fetchMock = vi.fn(async () => jsonResponse({ document }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    const input = { type: 'app_launch', title: 'Notes', source: 'Window manager', kind: 'activity' };
    await expect(api.createActivityEntry(input)).resolves.toEqual({ document });

    expect(fetchMock).toHaveBeenCalledWith('/api/activity/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });
});

describe('api.memory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dedupes concurrent memory requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/extensions/installed') return jsonResponse([knowledgeExtensionSummary()]);
      return jsonResponse({ ok: true, result: { skills: [], memoryDocs: [] } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    const [first, second] = await Promise.all([api.memory(), api.memory()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ skills: [], memoryDocs: [] });
    expect(second).toEqual(first);
  });

  it('ignores legacy profile arguments for memory requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/extensions/installed') return jsonResponse([knowledgeExtensionSummary()]);
      return jsonResponse({ ok: true, result: { skills: [], memoryDocs: [] } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api.js');
    await Promise.all([api.memory(), api.memory()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/extensions/installed');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/extensions/knowledge/actions/readMemory');
  });
});

function knowledgeExtensionSummary() {
  return {
    id: 'knowledge',
    name: 'Knowledge',
    enabled: true,
    manifest: {
      schemaVersion: 2,
      id: 'knowledge',
      name: 'Knowledge',
      backend: { entry: 'src/backend.ts', actions: [{ id: 'readMemory', handler: 'readMemory' }] },
      contributes: {
        views: [{ id: 'knowledge', title: 'Knowledge', location: 'main', component: 'Knowledge', routeCapabilities: ['knowledgeFiles'] }],
      },
    },
    surfaces: [],
    backendActions: [{ id: 'readMemory', handler: 'readMemory' }],
  };
}
