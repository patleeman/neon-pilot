import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setDefaultExtensionBackendWorkerUrl } from '../extensions/extensionBackendWorkerClient.js';
import { clearExtensionHostAuditEvents } from '../extensions/extensionHostAudit.js';
import { createInProcessExtensionHostClient, setExtensionHostClient } from '../extensions/extensionHostClient.js';
import { createExtensionRequestAbortSignal, readSystemConversationSetTitleMutation, registerExtensionRoutes } from './extensions.js';

const { writeExtensionActivityEntrySafeMock } = vi.hoisted(() => ({
  writeExtensionActivityEntrySafeMock: vi.fn(),
}));

vi.mock('../extensions/extensionActivityProducers.js', () => ({
  writeExtensionActivityEntrySafe: writeExtensionActivityEntrySafeMock,
}));

const originalResourcesPathDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');

type Handler = (
  req: { method?: string; params?: Record<string, string>; body?: unknown; query?: Record<string, string> },
  res: ReturnType<typeof createResponse>,
) => void | Promise<void>;

function createResponse() {
  return Object.assign(new EventEmitter(), {
    json: vi.fn(),
    send: vi.fn(),
    sendFile: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    flushHeaders: vi.fn(),
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
  });
}

function createHarness(context?: Parameters<typeof registerExtensionRoutes>[1]) {
  const getHandlers = new Map<string, Handler>();
  const postHandlers = new Map<string, Handler>();
  const patchHandlers = new Map<string, Handler>();
  const putHandlers = new Map<string, Handler>();
  const deleteHandlers = new Map<string, Handler>();
  const router = {
    get: vi.fn((path: string, handler: Handler) => getHandlers.set(path, handler)),
    post: vi.fn((path: string, handler: Handler) => postHandlers.set(path, handler)),
    patch: vi.fn((path: string, handler: Handler) => patchHandlers.set(path, handler)),
    put: vi.fn((path: string, handler: Handler) => putHandlers.set(path, handler)),
    delete: vi.fn((path: string, handler: Handler) => deleteHandlers.set(path, handler)),
  };
  registerExtensionRoutes(router as never, context);
  return {
    getHandler: (path: string) => getHandlers.get(path)!,
    postHandler: (path: string) => postHandlers.get(path)!,
    patchHandler: (path: string) => patchHandlers.get(path)!,
    putHandler: (path: string) => putHandlers.get(path)!,
    deleteHandler: (path: string) => deleteHandlers.get(path)!,
  };
}

function setPackagedResourcesPath(value = '/Applications/Neon Pilot.app/Contents/Resources') {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  setExtensionHostClient(createInProcessExtensionHostClient());
  setDefaultExtensionBackendWorkerUrl(new URL('../dist/extensions/extensionBackendWorker.js', import.meta.url));
  writeExtensionActivityEntrySafeMock.mockReset();
});

afterEach(() => {
  setExtensionHostClient(undefined);
  setDefaultExtensionBackendWorkerUrl(undefined);
  delete process.env.NEON_PILOT_STATE_ROOT;
  delete process.env.NEON_PILOT_DESKTOP_DEV_BUNDLE;
  if (originalResourcesPathDescriptor) {
    Object.defineProperty(process, 'resourcesPath', originalResourcesPathDescriptor);
  } else {
    Reflect.deleteProperty(process, 'resourcesPath');
  }
});

describe('registerExtensionRoutes', () => {
  it('creates abort signals from extension request lifecycle events', () => {
    const request = new EventEmitter();
    const response = new EventEmitter();
    const signal = createExtensionRequestAbortSignal(request as never, response as never);

    expect(signal.aborted).toBe(false);
    response.emit('close');
    expect(signal.aborted).toBe(true);

    const abortedRequest = new EventEmitter();
    const secondSignal = createExtensionRequestAbortSignal(abortedRequest as never, new EventEmitter() as never);
    abortedRequest.emit('aborted');
    expect(secondSignal.aborted).toBe(true);
  });

  it('serves extension schema, registry, routes, and surfaces', async () => {
    const harness = createHarness();

    const schemaRes = createResponse();
    await harness.getHandler('/api/extensions/schema')({}, schemaRes);
    expect(schemaRes.json).toHaveBeenCalledWith(expect.objectContaining({ placements: expect.arrayContaining(['main', 'right']) }));

    clearExtensionHostAuditEvents();
    await harness.getHandler('/api/extensions/schema')({}, createResponse());
    const auditRes = createResponse();
    await harness.getHandler('/api/extensions/audit-events')({}, auditRes);
    expect(auditRes.json).toHaveBeenCalledWith([
      expect.objectContaining({
        requestType: 'readRegistryPresentation',
        requestName: 'readRegistryPresentation',
        ok: true,
      }),
    ]);

    const listRes = createResponse();
    await harness.getHandler('/api/extensions')({}, listRes);
    expect(listRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'system-automations', packageType: 'system' }),
        expect.objectContaining({ id: 'system-files', packageType: 'system' }),
        expect.objectContaining({ id: 'system-diffs', packageType: 'system' }),
        expect.objectContaining({ id: 'system-runs', packageType: 'system' }),
      ]),
    );

    const installedRes = createResponse();
    await harness.getHandler('/api/extensions/installed')({}, installedRes);
    expect(installedRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'system-automations', enabled: true }),
        expect.objectContaining({ id: 'system-files', enabled: true }),
        expect.objectContaining({ id: 'system-diffs', enabled: true }),
        expect.objectContaining({ id: 'system-runs', enabled: true }),
      ]),
    );

    const registryRes = createResponse();
    await harness.getHandler('/api/extensions/registry')({}, registryRes);
    expect(registryRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: expect.arrayContaining([expect.objectContaining({ id: 'system-automations', packageType: 'system' })]),
        routes: expect.arrayContaining([
          { route: '/automations', extensionId: 'system-automations', surfaceId: 'page', packageType: 'system' },
        ]),
        surfaces: expect.arrayContaining([
          expect.objectContaining({ extensionId: 'system-automations', location: 'main', component: 'AutomationsPage' }),
        ]),
        settings: expect.any(Object),
      }),
    );

    const criticalRegistryRes = createResponse();
    await harness.getHandler('/api/extensions/registry/critical')({}, criticalRegistryRes);
    expect(criticalRegistryRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: expect.arrayContaining([expect.objectContaining({ id: 'system-automations', packageType: 'system' })]),
        routes: expect.arrayContaining([
          { route: '/automations', extensionId: 'system-automations', surfaceId: 'page', packageType: 'system' },
        ]),
        surfaces: expect.arrayContaining([
          expect.objectContaining({ extensionId: 'system-automations', location: 'main', component: 'AutomationsPage' }),
        ]),
        settings: {},
      }),
    );

    const routesRes = createResponse();
    await harness.getHandler('/api/extensions/routes')({}, routesRes);
    expect(routesRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([{ route: '/automations', extensionId: 'system-automations', surfaceId: 'page', packageType: 'system' }]),
    );

    const surfacesRes = createResponse();
    await harness.getHandler('/api/extensions/surfaces')({}, surfacesRes);
    expect(surfacesRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ extensionId: 'system-automations', location: 'main', component: 'AutomationsPage' }),
        expect.objectContaining({ extensionId: 'system-files', location: 'rightRail', component: 'WorkspaceFilesPanel' }),
        expect.objectContaining({ extensionId: 'system-files', location: 'workbench', component: 'WorkspaceFileDetailPanel' }),
      ]),
    );
  }, 30000);

  it('dispatches namespaced extension backend routes', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        enabled: true,
        backend: { entry: 'dist/backend.mjs', routes: [{ method: 'GET', path: '/status', handler: 'status', worker: { enabled: true } }] },
      }),
    );
    writeFileSync(
      join(extensionRoot, 'dist', 'backend.mjs'),
      'export function status(req) { return { status: 201, body: { ok: true, q: req.query.q } }; }',
    );
    const harness = createHarness();

    const res = createResponse();
    await harness.getHandler('/api/extensions/:id/routes/*')(
      { method: 'GET', params: { id: 'agent-board', 0: 'status' }, query: { q: 'hello' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.json).toHaveBeenCalledWith({ ok: true, q: 'hello' });

    const directRes = createResponse();
    await harness.getHandler('/api/extensions/:id/*')(
      { method: 'GET', params: { id: 'agent-board', 0: 'status' }, query: { q: 'direct' } },
      directRes,
    );
    expect(directRes.status).toHaveBeenCalledWith(201);
    expect(directRes.json).toHaveBeenCalledWith({ ok: true, q: 'direct' });
  });

  it('dispatches extension backend SSE routes', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        enabled: true,
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/events', handler: 'events', stream: 'sse', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(
      join(extensionRoot, 'dist', 'backend.mjs'),
      'export function events() { return { status: 200, stream: "sse", events: (async function* () { yield { event: "ready", data: { ok: true } }; })() }; }',
    );
    const harness = createHarness();
    const res = createResponse();

    await harness.getHandler('/api/extensions/:id/*')({ method: 'GET', params: { id: 'agent-board', 0: 'events' }, query: {} }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(res.write).toHaveBeenCalledWith('event: ready\n');
    expect(res.write).toHaveBeenCalledWith('data: {"ok":true}\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('closes suspended extension backend SSE iterators when the client disconnects', async () => {
    const returnSpy = vi.fn(async () => ({ done: true, value: undefined }));
    const events = {
      [Symbol.asyncIterator]() {
        return {
          next: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: { event: 'ready', data: { ok: true } } })
            .mockImplementation(() => new Promise(() => undefined)),
          return: returnSpy,
        };
      },
    };
    setExtensionHostClient({
      invokeRoute: vi.fn(async () => ({ status: 200, stream: 'sse', events })),
    } as never);
    const harness = createHarness();
    const res = createResponse();

    const request = new EventEmitter() as EventEmitter & {
      method: string;
      params: Record<string, string>;
      query: Record<string, string>;
      body?: unknown;
    };
    request.method = 'GET';
    request.params = { id: 'agent-board', 0: 'events' };
    request.query = {};

    const routePromise = harness.getHandler('/api/extensions/:id/*')(request, res);
    await vi.waitFor(() => expect(res.write).toHaveBeenCalledWith('event: ready\n'));

    res.emit('close');
    await routePromise;

    expect(returnSpy).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalled();
  });

  it('lists and serves extension webapps from package assets', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-webapp-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist', 'webapp'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        enabled: true,
        contributes: {
          webapps: [{ id: 'board', title: 'Board Webapp', entry: 'dist/webapp/index.html' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'webapp', 'index.html'), '<h1>Board</h1>');
    writeFileSync(join(extensionRoot, 'dist', 'webapp', 'app.js'), 'globalThis.loaded = true;');
    writeFileSync(join(extensionRoot, 'dist', 'private.txt'), 'private build artifact');
    const harness = createHarness();

    const listRes = createResponse();
    await harness.getHandler('/api/extensions/webapps')({}, listRes);
    expect(listRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'board',
          extensionId: 'agent-board',
          localhostName: 'board-agent-board',
          localhostUrl: 'https://board-agent-board.localhost',
        }),
      ]),
    );

    const assetRes = createResponse();
    await harness.getHandler('/webapps/:id/:webappId/*')(
      { method: 'GET', params: { id: 'agent-board', webappId: 'board', 0: 'app.js' }, query: {} },
      assetRes,
    );
    expect(assetRes.type).toHaveBeenCalledWith('text/javascript; charset=utf-8');
    expect(assetRes.sendFile).toHaveBeenCalledWith(join(extensionRoot, 'dist', 'webapp', 'app.js'));

    const traversalRes = createResponse();
    await harness.getHandler('/webapps/:id/:webappId/*')(
      { method: 'GET', params: { id: 'agent-board', webappId: 'board', 0: '../private.txt' }, query: {} },
      traversalRes,
    );
    expect(traversalRes.status).toHaveBeenCalledWith(400);
    expect(traversalRes.json).toHaveBeenCalledWith({ error: 'Extension webapp asset path escapes entry directory.' });
    expect(traversalRes.sendFile).not.toHaveBeenCalled();

    const baseClient = createInProcessExtensionHostClient();
    setExtensionHostClient({
      ...baseClient,
      resolveFilePath: vi.fn(async (input) =>
        input.relativePath === 'dist/webapp/app.js' ? join(extensionRoot, 'dist', 'private.txt') : baseClient.resolveFilePath(input),
      ),
    });
    const compromisedHostRes = createResponse();
    await harness.getHandler('/webapps/:id/:webappId/*')(
      { method: 'GET', params: { id: 'agent-board', webappId: 'board', 0: 'app.js' }, query: {} },
      compromisedHostRes,
    );
    expect(compromisedHostRes.status).toHaveBeenCalledWith(400);
    expect(compromisedHostRes.json).toHaveBeenCalledWith({ error: 'Extension webapp asset path escapes resolved entry directory.' });
    expect(compromisedHostRes.sendFile).not.toHaveBeenCalled();
    setExtensionHostClient(createInProcessExtensionHostClient());

    const hostRes = createResponse();
    await harness.getHandler('*')(
      {
        method: 'GET',
        path: '/',
        get: (name: string) => (name.toLowerCase() === 'host' ? 'board-agent-board.localhost' : undefined),
      } as never,
      hostRes,
    );
    expect(hostRes.type).toHaveBeenCalledWith('text/html; charset=utf-8');
    expect(hostRes.sendFile).toHaveBeenCalledWith(join(extensionRoot, 'dist', 'webapp', 'index.html'));
  });

  it('serves webapp bridge discovery and extension actions from localhost webapp origins', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-webapp-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist', 'webapp'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        enabled: true,
        permissions: ['storage:readwrite'],
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'saveTask', handler: 'saveTask', worker: { enabled: true } }] },
        contributes: {
          webapps: [{ id: 'board', title: 'Board Webapp', entry: 'dist/webapp/index.html' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'webapp', 'index.html'), '<h1>Board</h1>');
    writeFileSync(
      join(extensionRoot, 'dist', 'backend.mjs'),
      'export async function saveTask(input, ctx) { await ctx.storage.put("tasks/one", input); return { saved: await ctx.storage.get("tasks/one") }; }',
    );
    const harness = createHarness();

    const discoveryRes = createResponse();
    await harness.getHandler('*')(
      {
        method: 'GET',
        path: '/.neon/api/extensions/webapps',
        get: (name: string) => (name.toLowerCase() === 'host' ? 'board-agent-board.localhost' : undefined),
      } as never,
      discoveryRes,
    );
    expect(discoveryRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'board',
          extensionId: 'agent-board',
          localhostUrl: 'https://board-agent-board.localhost',
        }),
      ]),
    );

    const actionRes = createResponse();
    await harness.postHandler('*')(
      {
        method: 'POST',
        protocol: 'http',
        path: '/.neon/api/extensions/agent-board/actions/saveTask',
        body: { title: 'Ship it' },
        get: (name: string) =>
          name.toLowerCase() === 'host'
            ? 'board-agent-board.localhost'
            : name.toLowerCase() === 'origin'
              ? 'http://board-agent-board.localhost'
              : undefined,
      } as never,
      actionRes,
    );
    expect(actionRes.json).toHaveBeenCalledWith({ ok: true, result: { saved: { title: 'Ship it' } } });

    const crossOriginRes = createResponse();
    await harness.postHandler('*')(
      {
        method: 'POST',
        protocol: 'http',
        path: '/.neon/api/extensions/agent-board/actions/saveTask',
        body: { title: 'Blocked' },
        get: (name: string) =>
          name.toLowerCase() === 'host'
            ? 'board-agent-board.localhost'
            : name.toLowerCase() === 'origin'
              ? 'https://evil.example'
              : undefined,
      } as never,
      crossOriginRes,
    );
    expect(crossOriginRes.status).toHaveBeenCalledWith(403);
    expect(crossOriginRes.json).toHaveBeenCalledWith({ error: 'Cross-origin request rejected.' });

    const forwardedBodyRes = createResponse();
    await harness.postHandler('*')(
      {
        method: 'POST',
        protocol: 'http',
        path: '/.neon/api/extensions/agent-board/actions/saveTask',
        body: Buffer.from(JSON.stringify({ title: 'Forwarded through localhost proxy' })).toJSON(),
        get: (name: string) =>
          name.toLowerCase() === 'host'
            ? 'board-agent-board.localhost'
            : name.toLowerCase() === 'origin'
              ? 'http://board-agent-board.localhost'
              : name.toLowerCase() === 'content-type'
                ? 'application/json'
                : undefined,
      } as never,
      forwardedBodyRes,
    );
    expect(forwardedBodyRes.json).toHaveBeenCalledWith({
      ok: true,
      result: { saved: { title: 'Forwarded through localhost proxy' } },
    });
  }, 30000);

  it('proxies extension webapp requests without inventing empty request bodies', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-webapp-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        enabled: true,
        contributes: {
          webapps: [{ id: 'board', title: 'Board Webapp', target: 'http://127.0.0.1:5173' }],
        },
      }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const harness = createHarness();

    const emptyPostRes = createResponse();
    await harness.postHandler('*')(
      {
        method: 'POST',
        path: '/api/refresh',
        originalUrl: '/api/refresh?force=1',
        headers: {
          host: 'board-agent-board.localhost',
          'content-type': 'application/json',
          authorization: 'Bearer secret',
          cookie: 'session=secret',
          'x-forwarded-for': '192.0.2.20',
        },
        body: undefined,
        get: (name: string) => (name.toLowerCase() === 'host' ? 'board-agent-board.localhost' : undefined),
      } as never,
      emptyPostRes,
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL('http://127.0.0.1:5173/api/refresh?force=1'),
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
    const [, emptyPostInit] = fetchMock.mock.calls.at(-1) ?? [];
    const emptyPostHeaders =
      emptyPostInit instanceof Object && 'headers' in emptyPostInit ? (emptyPostInit.headers as Headers) : new Headers();
    expect(emptyPostHeaders.get('content-type')).toBe('application/json');
    expect(emptyPostHeaders.get('authorization')).toBeNull();
    expect(emptyPostHeaders.get('cookie')).toBeNull();
    expect(emptyPostHeaders.get('x-forwarded-for')).toBeNull();
    expect(emptyPostRes.status).toHaveBeenCalledWith(202);

    const jsonPostRes = createResponse();
    await harness.postHandler('*')(
      {
        method: 'POST',
        path: '/api/refresh',
        originalUrl: '/api/refresh',
        headers: { host: 'board-agent-board.localhost', 'content-type': 'application/json' },
        body: { mode: 'full' },
        get: (name: string) => (name.toLowerCase() === 'host' ? 'board-agent-board.localhost' : undefined),
      } as never,
      jsonPostRes,
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL('http://127.0.0.1:5173/api/refresh'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ mode: 'full' }) }),
    );
  });

  it('rejects forged extension webapp proxy targets from host snapshots', async () => {
    const baseClient = createInProcessExtensionHostClient();
    setExtensionHostClient({
      ...baseClient,
      async readRegistryPresentation() {
        return {
          installSummaries: [],
          snapshot: {
            extensions: [],
            routes: [],
            surfaces: [],
            views: [],
            webapps: [
              {
                id: 'board',
                title: 'Board Webapp',
                extensionId: 'agent-board',
                packageType: 'user',
                localhostName: 'board-agent-board',
                target: 'https://example.com/internal',
              },
            ],
          },
        };
      },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockClear();
    const harness = createHarness();

    const res = createResponse();
    await harness.getHandler('*')(
      {
        method: 'GET',
        path: '/api/refresh',
        originalUrl: '/api/refresh',
        headers: { host: 'board-agent-board.localhost' },
        get: (name: string) => (name.toLowerCase() === 'host' ? 'board-agent-board.localhost' : undefined),
      } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'Extension webapp proxy target must be a loopback HTTP URL.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves per-extension manifest and surfaces', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    const view = { id: 'page', title: 'Agent Board', location: 'main', route: '/ext/agent-board', component: 'AgentBoardPage' };
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
        contributes: { views: [view] },
      }),
    );

    const harness = createHarness();
    const manifestRes = createResponse();
    await harness.getHandler('/api/extensions/:id/manifest')({ params: { id: 'agent-board' } }, manifestRes);
    expect(manifestRes.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-board', contributes: { views: [view] } }));

    const surfacesRes = createResponse();
    await harness.getHandler('/api/extensions/:id/surfaces')({ params: { id: 'agent-board' } }, surfacesRes);
    expect(surfacesRes.json).toHaveBeenCalledWith([view]);
  });

  it('serves runtime extension bundles inside the package root', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id: 'agent-board', name: 'Agent Board' }));
    writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');

    const harness = createHarness();
    const res = createResponse();
    await harness.getHandler('/api/extensions/:id/files/*')({ params: { id: 'agent-board', 0: 'dist/frontend.js' } }, res);

    expect(res.type).toHaveBeenCalledWith('text/javascript; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('AgentBoardPage'));
  });

  it('rejects extension file traversal', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    const harness = createHarness();
    const res = createResponse();
    await harness.getHandler('/api/extensions/:id/files/*')({ params: { id: 'agent-board', 0: '../escape.html' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Extension file path escapes package root.' });
  });

  it('serves command and slash command registrations for enabled extensions', async () => {
    const harness = createHarness();
    const commandsRes = createResponse();
    await harness.getHandler('/api/extensions/commands')({}, commandsRes);
    expect(commandsRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          extensionId: 'system-automations',
          surfaceId: 'new',
          packageType: 'system',
          title: 'New Automation',
          action: 'app.navigate',
          args: { to: '/automations?action=new' },
          icon: 'automation',
          category: 'Automations',
          description: 'Open the automation creation flow.',
        },
      ]),
    );

    const commandRes = createResponse();
    await harness.postHandler('/api/extensions/commands/:commandId/execute')(
      { params: { commandId: 'system-automations.new' }, body: {} },
      commandRes,
    );
    expect(commandRes.json).toHaveBeenCalledWith({ ok: true, result: false });

    const slashRes = createResponse();
    await harness.getHandler('/api/extensions/slash-commands')({}, slashRes);
    expect(slashRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          extensionId: 'system-auto-mode',
          surfaceId: 'goal',
          packageType: 'system',
          name: 'goal',
          description: expect.stringContaining('Set, view, pause, resume, or clear the current goal.'),
          action: 'handleSlashGoal',
        },
      ]),
    );
  });

  it('serves extension state documents with optimistic concurrency', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();

    const putRes = createResponse();
    await harness.putHandler('/api/extensions/:id/state/*')(
      { params: { id: 'agent-board', 0: 'tasks/one' }, body: { value: { title: 'Ship it' } } },
      putRes,
    );
    expect(putRes.json).toHaveBeenCalledWith(expect.objectContaining({ key: 'tasks/one', value: { title: 'Ship it' }, version: 1 }));

    const getRes = createResponse();
    await harness.getHandler('/api/extensions/:id/state/*')({ params: { id: 'agent-board', 0: 'tasks/one' } }, getRes);
    expect(getRes.json).toHaveBeenCalledWith(expect.objectContaining({ key: 'tasks/one', value: { title: 'Ship it' }, version: 1 }));

    const conflictRes = createResponse();
    await harness.putHandler('/api/extensions/:id/state/*')(
      { params: { id: 'agent-board', 0: 'tasks/one' }, body: { value: { title: 'Nope' }, expectedVersion: 99 } },
      conflictRes,
    );
    expect(conflictRes.status).toHaveBeenCalledWith(409);
    expect(conflictRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Extension state version conflict.' }));

    const listRes = createResponse();
    await harness.getHandler('/api/extensions/:id/state')({ params: { id: 'agent-board' }, query: { prefix: 'tasks/' } }, listRes);
    expect(listRes.json).toHaveBeenCalledWith([expect.objectContaining({ key: 'tasks/one' })]);

    const deleteRes = createResponse();
    await harness.deleteHandler('/api/extensions/:id/state/*')({ params: { id: 'agent-board', 0: 'tasks/one' } }, deleteRes);
    expect(deleteRes.json).toHaveBeenCalledWith({ ok: true, deleted: true });
  });

  it('creates starter runtime extensions', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();

    const res = createResponse();
    harness.postHandler('/api/extensions')({ body: { id: 'agent-board', name: "Patrick's <Tool>", description: 'Track work' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      packageRoot: join(stateRoot, 'extensions', 'agent-board'),
      extension: expect.objectContaining({
        id: 'agent-board',
        name: "Patrick's <Tool>",
        packageRoot: join(stateRoot, 'extensions', 'agent-board'),
        routes: [{ route: '/ext/agent-board', surfaceId: 'page' }],
      }),
    });

    const frontend = readFileSync(join(stateRoot, 'extensions', 'agent-board', 'src', 'frontend.tsx'), 'utf-8');
    expect(frontend).toContain(`const EXTENSION_NAME = "Patrick's <Tool>";`);
    expect(frontend).toContain('<AppPageIntro title={EXTENSION_NAME} />');
    expect(frontend).toContain("pa.ui.toast(EXTENSION_NAME + ' is wired up.')");
    expect(frontend).not.toContain("pa.ui.toast('Patrick's <Tool>");
  });

  it('validates runtime extensions through the extension doctor route', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();

    const createRes = createResponse();
    harness.postHandler('/api/extensions')({ body: { id: 'agent-board', name: 'Agent Board' } }, createRes);

    const res = createResponse();
    await harness.postHandler('/api/extensions/:id/validate')({ params: { id: 'agent-board' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        extensionId: 'agent-board',
        findings: expect.arrayContaining([expect.objectContaining({ code: 'missing-frontend-dist' })]),
      }),
    );
  });

  it('creates paired workbench starter runtime extensions', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();

    const res = createResponse();
    harness.postHandler('/api/extensions')({ body: { id: 'agent-board', name: 'Agent Board', template: 'workbench-detail' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      packageRoot: join(stateRoot, 'extensions', 'agent-board'),
      extension: expect.objectContaining({
        id: 'agent-board',
        routes: [],
        manifest: expect.objectContaining({
          contributes: expect.objectContaining({
            views: expect.arrayContaining([
              expect.objectContaining({ id: 'rail', location: 'rightRail', detailView: 'detail' }),
              expect.objectContaining({ id: 'detail', location: 'workbench' }),
            ]),
          }),
        }),
      }),
    });
  });

  it('creates runtime extensions under the desktop root layout when provided', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-legacy-'));
    const layout = resolveDesktopRootLayout({ root: mkdtempSync(join(tmpdir(), 'pa-ext-route-layout-')) });
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness({
      getRuntimeScope: () => 'default',
      getStateRoot: () => stateRoot,
      getDesktopRootLayout: () => layout,
    });

    const res = createResponse();
    harness.postHandler('/api/extensions')({ body: { id: 'agent-board', name: 'Agent Board' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        packageRoot: join(layout.apps, 'extensions', 'agent-board'),
      }),
    );
    expect(existsSync(join(layout.apps, 'extensions', 'agent-board', 'extension.json'))).toBe(true);
    expect(existsSync(join(stateRoot, 'extensions', 'agent-board'))).toBe(false);
  });

  it('exports and imports runtime extension bundles', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Agent Board', location: 'main', route: '/ext/agent-board', component: 'AgentBoardPage' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');
    writeFileSync(join(extensionRoot, 'dist', 'build-manifest.json'), '{}');

    const harness = createHarness();
    const exportRes = createResponse();
    harness.postHandler('/api/extensions/:id/export')({ params: { id: 'agent-board' } }, exportRes);
    const exportPayload = exportRes.json.mock.calls[0]?.[0] as { exportPath: string };

    expect(exportRes.status).toHaveBeenCalledWith(201);
    expect(existsSync(exportPayload.exportPath)).toBe(true);

    process.env.NEON_PILOT_STATE_ROOT = mkdtempSync(join(tmpdir(), 'pa-ext-route-import-'));
    const importHarness = createHarness();
    const importRes = createResponse();
    importHarness.postHandler('/api/extensions/import')({ body: { zipPath: exportPayload.exportPath } }, importRes);

    expect(importRes.status).toHaveBeenCalledWith(201);
    expect(importRes.json).toHaveBeenCalledWith({
      ok: true,
      packageRoot: join(process.env.NEON_PILOT_STATE_ROOT, 'extensions', 'agent-board'),
      extension: expect.objectContaining({ id: 'agent-board', name: 'Agent Board' }),
    });
  });

  it('rejects unsafe extension bundles', () => {
    const zipRoot = mkdtempSync(join(tmpdir(), 'pa-ext-unsafe-'));
    const unsafeZip = join(zipRoot, 'unsafe.zip');
    const payloadRoot = join(zipRoot, 'payload');
    writeFileSync(join(zipRoot, 'escape.txt'), 'nope');
    mkdirSync(join(payloadRoot, 'agent-board'), { recursive: true });
    writeFileSync(
      join(payloadRoot, 'agent-board', 'extension.json'),
      JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }),
    );
    execFileSync('zip', ['-q', unsafeZip, '../escape.txt', 'agent-board/extension.json'], { cwd: payloadRoot });

    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();
    const res = createResponse();
    harness.postHandler('/api/extensions/import')({ body: { zipPath: unsafeZip } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Extension bundle contains unsafe paths.' });
  });

  it('rejects extension bundles containing symlink entries', () => {
    const zipRoot = mkdtempSync(join(tmpdir(), 'pa-ext-symlink-'));
    const symlinkZip = join(zipRoot, 'symlink.zip');
    const payloadRoot = join(zipRoot, 'payload');
    mkdirSync(join(payloadRoot, 'agent-board', 'dist'), { recursive: true });
    writeFileSync(
      join(payloadRoot, 'agent-board', 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
      }),
    );
    writeFileSync(join(payloadRoot, 'agent-board', 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');
    writeFileSync(join(payloadRoot, 'agent-board', 'dist', 'build-manifest.json'), '{}');
    symlinkSync('/tmp', join(payloadRoot, 'agent-board', 'dist', 'linked-target'));
    execFileSync('zip', ['-qry', symlinkZip, 'agent-board'], { cwd: payloadRoot });

    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();
    const res = createResponse();
    harness.postHandler('/api/extensions/import')({ body: { zipPath: symlinkZip } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Extension bundle contains symlink entries.' });
  });

  it('snapshots runtime extensions', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    const harness = createHarness();
    const res = createResponse();
    harness.postHandler('/api/extensions/:id/snapshot')({ params: { id: 'agent-board' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      extensionId: 'agent-board',
      snapshotPath: expect.stringContaining(join('extension-snapshots', 'agent-board')),
    });
  });

  it('toggles runtime extensions', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    const harness = createHarness();
    const res = createResponse();
    await harness.patchHandler('/api/extensions/:id')({ params: { id: 'agent-board' }, body: { enabled: false } }, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, extension: expect.objectContaining({ id: 'agent-board', enabled: false }) });
  });

  it('updates extension keybindings through the extension host client', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        contributes: {
          commands: [{ id: 'plan', title: 'Plan board sprint', action: 'planSprint' }],
          keybindings: [{ id: 'plan', title: 'Plan board sprint', command: 'agent-board.plan', keys: ['Meta+P'] }],
        },
      }),
    );

    const harness = createHarness();
    const res = createResponse();
    await harness.patchHandler('/api/extensions/keybindings/:extensionId/:keybindingId')(
      {
        params: { extensionId: 'agent-board', keybindingId: 'command:plan' },
        body: {
          title: 'Plan board sprint',
          command: 'agent-board.plan',
          keys: ['Meta+O'],
          when: 'board.focused',
          enabled: true,
        },
      },
      res,
    );

    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const keybindingsRes = createResponse();
    await harness.getHandler('/api/extensions/keybindings')({}, keybindingsRes);
    expect(keybindingsRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: 'agent-board',
          surfaceId: 'command:plan',
          command: 'agent-board.plan',
          when: 'board.focused',
          keys: ['Meta+O'],
          enabled: true,
        }),
      ]),
    );
  });

  it('rejects toggles and reloads for invalid runtime extensions', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'bad-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'bad-board',
        name: 'Bad Board',
        contributes: { views: [{ id: 'page', title: 'Bad', location: 'somewhere', component: 'BadPage' }] },
      }),
    );

    const harness = createHarness();
    const toggleRes = createResponse();
    await harness.patchHandler('/api/extensions/:id')({ params: { id: 'bad-board' }, body: { enabled: false } }, toggleRes);
    expect(toggleRes.status).toHaveBeenCalledWith(400);
    expect(toggleRes.json).toHaveBeenCalledWith({ error: expect.stringContaining('contributes.views[0].location') });

    const reloadRes = createResponse();
    await harness.postHandler('/api/extensions/:id/reload')({ params: { id: 'bad-board' } }, reloadRes);
    expect(reloadRes.status).toHaveBeenCalledWith(400);
    expect(reloadRes.json).toHaveBeenCalledWith({ error: expect.stringContaining('contributes.views[0].location') });
  });

  it('toggles system extensions', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const harness = createHarness();
    const res = createResponse();
    await harness.patchHandler('/api/extensions/:id')({ params: { id: 'system-automations' }, body: { enabled: false } }, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, extension: expect.objectContaining({ id: 'system-automations', enabled: false }) });
  });

  it('invokes runtime extension backend actions', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        permissions: ['storage:readwrite'],
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'saveTask', handler: 'saveTask', worker: { enabled: true } }] },
      }),
    );
    writeFileSync(
      join(extensionRoot, 'dist', 'backend.mjs'),
      `export async function saveTask(input, ctx) { await ctx.storage.put('tasks/one', input); return { saved: await ctx.storage.get('tasks/one') }; }`,
    );

    const harness = createHarness();
    const res = createResponse();
    await harness.postHandler('/api/extensions/:id/actions/:actionId')(
      { params: { id: 'agent-board', actionId: 'saveTask' }, body: { title: 'Ship it' } },
      res,
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: {
        saved: { title: 'Ship it' },
      },
    });

    writeFileSync(join(extensionRoot, 'src-backend.ts'), `export async function saveTask(`);
    const staleRes = createResponse();
    await harness.postHandler('/api/extensions/:id/actions/:actionId')(
      { params: { id: 'agent-board', actionId: 'saveTask' }, body: { title: 'Still works from cache' } },
      staleRes,
    );

    expect(staleRes.json).toHaveBeenCalledWith({
      ok: true,
      result: expect.objectContaining({ saved: { title: 'Still works from cache' } }),
    });
  }, 30000);

  it('reads targeted system conversation title mutations from wrapped action results', () => {
    expect(
      readSystemConversationSetTitleMutation(
        { action: 'set_title', conversationId: 'conv-body', title: 'Body Title' },
        { ok: true, result: { details: { conversationId: 'conv-result', title: 'Result Title' } } },
      ),
    ).toEqual({ conversationId: 'conv-body', title: 'Body Title' });

    expect(
      readSystemConversationSetTitleMutation(
        { action: 'set_title' },
        { ok: true, result: { details: { conversationId: 'conv-result', title: 'Result Title' } } },
      ),
    ).toEqual({ conversationId: 'conv-result', title: 'Result Title' });
  });

  it('searches extension providers through the extension host registry presentation', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'searchTasks', handler: 'searchTasks', worker: { enabled: true } }] },
        contributes: { searchProviders: [{ id: 'tasks', title: 'Tasks', action: 'searchTasks' }] },
      }),
    );
    writeFileSync(
      join(extensionRoot, 'dist', 'backend.mjs'),
      `export function searchTasks(input) { return [{ title: input.query, limit: input.limit, providerId: input.providerId }]; }`,
    );

    const harness = createHarness();
    const res = createResponse();
    await harness.postHandler('/api/extensions/search')({ body: { query: 'ship', providerId: 'tasks', limit: 5 } }, res);

    expect(res.json).toHaveBeenCalledWith({
      providers: [
        expect.objectContaining({
          extensionId: 'agent-board',
          id: 'tasks',
          action: 'searchTasks',
        }),
      ],
      items: [
        {
          providerId: 'tasks',
          extensionId: 'agent-board',
          title: 'ship',
          limit: 5,
        },
      ],
    });
  });

  it('lists extension event subscriptions through the extension host client', async () => {
    const { subscribeExtensionEvents, unsubscribeExtensionEvents } = await import('../extensions/extensionEventBus.js');
    subscribeExtensionEvents('agent-board', 'host:*', () => undefined);
    try {
      const harness = createHarness();
      const res = createResponse();
      await harness.getHandler('/api/extensions/events/subscriptions')({}, res);

      expect(res.json).toHaveBeenCalledWith([{ extensionId: 'agent-board', pattern: 'host:*' }]);
    } finally {
      unsubscribeExtensionEvents('agent-board');
    }
  });

  it('lists extension actions and status through the extension host registry presentation', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping', title: 'Ping', description: 'Ping board' }] },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export async function ping() { return { ok: true }; }');

    const harness = createHarness();
    const actionsRes = createResponse();
    await harness.getHandler('/api/extensions/actions')({}, actionsRes);
    expect(actionsRes.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          extensionId: 'agent-board',
          extensionName: 'Agent Board',
          actions: [{ id: 'ping', title: 'Ping', description: 'Ping board' }],
        },
      ]),
    );

    const statusRes = createResponse();
    await harness.getHandler('/api/extensions/:id/status')({ params: { id: 'agent-board' } }, statusRes);
    expect(statusRes.json).toHaveBeenCalledWith({ enabled: true, healthy: true });
  });

  it('rejects runtime extension builds', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'src'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js', styles: [] },
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
      }),
    );
    writeFileSync(join(extensionRoot, 'src', 'frontend.tsx'), 'export function AgentBoard() { return null; }');
    writeFileSync(join(extensionRoot, 'src', 'backend.ts'), 'export async function ping() { return { ok: true }; }');
    setPackagedResourcesPath();

    const harness = createHarness();
    const res = createResponse();
    await harness.postHandler('/api/extensions/:id/build')({ params: { id: 'agent-board' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('The app no longer builds extensions at runtime.'),
    });
  });

  it('reloads prebuilt runtime extension backends without rebuilding in packaged desktop mode', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export async function ping() { return { ok: true }; }');
    setPackagedResourcesPath();

    const harness = createHarness();
    const res = createResponse();
    await harness.postHandler('/api/extensions/:id/reload')({ params: { id: 'agent-board' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      id: 'agent-board',
      reloaded: true,
      message: 'Extension backend reloaded.',
    });
  });

  it('accepts explicit reload calls for runtime manifests', async () => {
    const harness = createHarness();
    const reloadAllRes = createResponse();
    await harness.postHandler('/api/extensions/reload')({}, reloadAllRes);
    expect(reloadAllRes.json).toHaveBeenCalledWith({
      ok: true,
      reloaded: true,
      message: 'Extension registry caches were invalidated; reopen contributed routes if needed.',
    });

    const reloadOneRes = createResponse();
    await harness.postHandler('/api/extensions/:id/reload')({ params: { id: 'system-extension-manager' } }, reloadOneRes);
    expect(reloadOneRes.json).toHaveBeenCalledWith({
      ok: true,
      id: 'system-extension-manager',
      reloaded: true,
      message: 'Extension backend reloaded.',
    });
  }, 30000);

  it('returns not found when reloading an unknown extension', async () => {
    const harness = createHarness();
    const res = createResponse();

    await harness.postHandler('/api/extensions/:id/reload')({ params: { id: 'missing-extension' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Extension not found.' });
  });

  it('writes an activity entry when a runtime extension is created', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    const layout = resolveDesktopRootLayout({ root: mkdtempSync(join(tmpdir(), 'pa-ext-route-layout-')) });
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness({ getRuntimeScope: () => 'shared', getStateRoot: () => stateRoot, getDesktopRootLayout: () => layout });
    const res = createResponse();
    harness.postHandler('/api/extensions')({ body: { id: 'agent-board', name: 'Agent Board' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'created', 'Agent Board', undefined, layout);
  });

  it('writes an activity entry when a runtime extension is imported', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');
    writeFileSync(join(extensionRoot, 'dist', 'build-manifest.json'), '{}');

    const exportHarness = createHarness();
    const exportRes = createResponse();
    exportHarness.postHandler('/api/extensions/:id/export')({ params: { id: 'agent-board' } }, exportRes);
    const exportPayload = exportRes.json.mock.calls[0]?.[0] as { exportPath: string };

    // Import into a fresh state root so the same extension id does not conflict.
    process.env.NEON_PILOT_STATE_ROOT = mkdtempSync(join(tmpdir(), 'pa-ext-route-import-'));
    writeExtensionActivityEntrySafeMock.mockReset();
    const importHarness = createHarness();
    const importRes = createResponse();
    importHarness.postHandler('/api/extensions/import')({ body: { zipPath: exportPayload.exportPath } }, importRes);

    expect(importRes.status).toHaveBeenCalledWith(201);
    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'imported', 'Agent Board', undefined, undefined);
  });

  it('writes an activity entry when a runtime extension is snapshotted', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness();
    const res = createResponse();
    harness.postHandler('/api/extensions/:id/snapshot')({ params: { id: 'agent-board' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'snapshotted', 'agent-board', undefined, undefined);
  });

  it('writes an activity entry when a runtime extension is toggled (enabled or disabled)', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness();
    const disableRes = createResponse();
    await harness.patchHandler('/api/extensions/:id')({ params: { id: 'agent-board' }, body: { enabled: false } }, disableRes);

    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'disabled', 'Agent Board', undefined, undefined);

    writeExtensionActivityEntrySafeMock.mockReset();
    const enableRes = createResponse();
    await harness.patchHandler('/api/extensions/:id')({ params: { id: 'agent-board' }, body: { enabled: true } }, enableRes);

    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'enabled', 'Agent Board', undefined, undefined);
  });

  it('writes an activity entry when a runtime extension is exported', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');
    writeFileSync(join(extensionRoot, 'dist', 'build-manifest.json'), '{}');

    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness();
    const res = createResponse();
    harness.postHandler('/api/extensions/:id/export')({ params: { id: 'agent-board' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'exported', 'agent-board', undefined, undefined);
  });

  it('writes an activity entry when a runtime extension is deleted', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 1, id: 'agent-board', name: 'Agent Board' }));

    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness();
    const res = createResponse();
    await harness.deleteHandler('/api/extensions/:id')({ params: { id: 'agent-board' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, extensionId: 'agent-board', deleted: true }));
    expect(writeExtensionActivityEntrySafeMock).toHaveBeenCalledWith('agent-board', 'deleted', 'agent-board', undefined, undefined);
  });

  it('does not write a deleted activity entry when no extension package was deleted', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-route-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    writeExtensionActivityEntrySafeMock.mockReset();
    const harness = createHarness();
    const res = createResponse();
    await harness.deleteHandler('/api/extensions/:id')({ params: { id: 'missing-extension' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, extensionId: 'missing-extension', deleted: false }));
    expect(writeExtensionActivityEntrySafeMock).not.toHaveBeenCalled();
  });
});
