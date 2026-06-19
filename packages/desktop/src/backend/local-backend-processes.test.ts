import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const { bootstrapMocks, childProcessMocks, criticalRegistryMocks, readConversationSessionsCapabilityMock, reserveConversationSessionMock } =
  vi.hoisted(() => ({
    bootstrapMocks: {
      inlineConversationBootstrapAssetsCapability: vi.fn((state: unknown) => state),
      inlineConversationSessionDetailAppendOnlyAssetsCapability: vi.fn((_sessionId: string, detail: unknown) => detail),
      inlineConversationSessionDetailAssetsCapability: vi.fn((_sessionId: string, detail: unknown) => detail),
      isMissingConversationBootstrapState: vi.fn(() => false),
      readConversationBootstrapState: vi.fn(async (input: { conversationId: string }) => ({
        state: {
          conversationId: input.conversationId,
          sessionDetail: { id: input.conversationId, blocks: [] },
          liveSession: { live: false },
        },
        telemetry: {
          sessionRead: {
            durationMs: 1,
            cache: 'miss',
            loader: 'fast-tail',
          },
          sessionDetailReused: false,
          remoteMirror: { durationMs: 0 },
          sessionSignatureMs: 0,
          sessionSignature: {
            liveLookupMs: 0,
            liveFileExistsMs: 0,
            ensureMs: 0,
            ensuredLiveLookupMs: 0,
            ensuredFileExistsMs: 0,
            snapshotLookupMs: 0,
            source: 'missing',
            signatureFileExistsMs: 0,
            signatureStatMs: 0,
          },
          liveSessionLookupMs: 0,
        },
      })),
      readConversationSessionSignature: vi.fn(() => 'signature-1'),
      readSessionDetailForRoute: vi.fn(async (input: { conversationId: string; tailBlocks?: number }) => ({
        sessionRead: {
          detail: {
            id: input.conversationId,
            blocks: [],
            blockOffset: 0,
            totalBlocks: 0,
            signature: 'signature-1',
          },
        },
        remoteMirror: { status: 'deferred', durationMs: 0 },
      })),
      setConversationServiceContext: vi.fn(),
    },
    criticalRegistryMocks: {
      moduleLoaded: vi.fn(),
      readCriticalExtensionRegistryResponse: vi.fn(() => ({
        extensions: [],
        routes: [],
        surfaces: [],
        settings: {},
      })),
    },
    childProcessMocks: {
      spawn: vi.fn(),
    },
    readConversationSessionsCapabilityMock: vi.fn(() => [{ id: 'limited' }]),
    reserveConversationSessionMock: vi.fn(() => ({ id: 'reserved-1', sessionFile: '/tmp/reserved-1.jsonl', cwd: '/repo' })),
  }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: childProcessMocks.spawn,
  };
});
vi.mock('../../server/conversations/conversationSessionCapability.js', () => ({
  readConversationSessionsCapability: readConversationSessionsCapabilityMock,
}));
vi.mock('../../server/conversations/conversationBootstrap.js', () => ({
  isMissingConversationBootstrapState: bootstrapMocks.isMissingConversationBootstrapState,
  readConversationBootstrapState: bootstrapMocks.readConversationBootstrapState,
}));
vi.mock('../../server/conversations/conversationService.js', () => ({
  buildAppendOnlyConversationDetailResponse: vi.fn((input: { detail: unknown }) => ({ appendOnly: true, detail: input.detail })),
  readConversationSessionSignature: bootstrapMocks.readConversationSessionSignature,
  readSessionDetailForRoute: bootstrapMocks.readSessionDetailForRoute,
  setConversationServiceContext: bootstrapMocks.setConversationServiceContext,
}));
vi.mock('../../server/conversations/conversationSessionAssetCapability.js', () => ({
  inlineConversationBootstrapAssetsCapability: bootstrapMocks.inlineConversationBootstrapAssetsCapability,
  inlineConversationSessionDetailAppendOnlyAssetsCapability: bootstrapMocks.inlineConversationSessionDetailAppendOnlyAssetsCapability,
  inlineConversationSessionDetailAssetsCapability: bootstrapMocks.inlineConversationSessionDetailAssetsCapability,
}));
vi.mock('../../server/conversations/conversationReservation.js', () => ({
  reserveConversationSession: reserveConversationSessionMock,
}));
vi.mock('../../server/extensions/extensionCriticalRegistryPresentation.js', () => {
  criticalRegistryMocks.moduleLoaded();
  return {
    readCriticalExtensionRegistryResponse: criticalRegistryMocks.readCriticalExtensionRegistryResponse,
  };
});

import { createDesktopChildEnv, LocalBackendProcesses, type LocalBackendWorkbenchBrowserToolHost } from './local-backend-processes.js';

class FakeChildProcess extends EventEmitter {
  stderr = new EventEmitter();
  killed = false;
  connected = true;
  send = vi.fn((message: unknown) => {
    if ((message as { type?: string })?.type === 'shutdown') {
      this.connected = false;
      queueMicrotask(() => this.emit('exit', 0, null));
    }
    return true;
  });

  kill = vi.fn(() => {
    this.killed = true;
    this.connected = false;
    queueMicrotask(() => this.emit('exit', null, 'SIGTERM'));
    return true;
  });
}

function createHost(): LocalBackendWorkbenchBrowserToolHost {
  return {
    isActive: vi.fn().mockResolvedValue(true),
    listTabs: vi.fn().mockResolvedValue([{ sessionKey: 'tab-1', url: 'https://example.com/', title: 'Example' }]),
    snapshot: vi.fn().mockResolvedValue({ title: 'Snapshot' }),
    screenshot: vi.fn().mockResolvedValue({ data: 'image' }),
    cdp: vi.fn().mockResolvedValue({ value: 42 }),
  };
}

async function handleNativeRequest(
  backend: LocalBackendProcesses,
  request: { id: string; method: string; args: unknown[] },
): Promise<unknown> {
  const child = { send: vi.fn() };
  await (
    backend as unknown as {
      handleNativeWorkbenchBrowserRequest(
        child: { send: ReturnType<typeof vi.fn> },
        request: { type: 'native-workbench-browser-request'; id: string; method: string; args: unknown[] },
      ): Promise<void>;
    }
  ).handleNativeWorkbenchBrowserRequest(child, {
    type: 'native-workbench-browser-request',
    ...request,
  });
  return child.send.mock.calls.at(-1)?.[0];
}

describe('LocalBackendProcesses', () => {
  const originalStderrWrite = process.stderr.write;

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
    childProcessMocks.spawn.mockReset();
    criticalRegistryMocks.moduleLoaded.mockClear();
    criticalRegistryMocks.readCriticalExtensionRegistryResponse.mockClear();
    vi.unstubAllGlobals();
  });

  it('starts', async () => {
    const backend = new LocalBackendProcesses();
    expect(backend).toBeDefined();
  });

  it('rolls back extension host state when backend child startup fails and can retry', async () => {
    const firstExtensionHost = new FakeChildProcess();
    const firstBackend = new FakeChildProcess();
    const secondExtensionHost = new FakeChildProcess();
    const secondBackend = new FakeChildProcess();
    childProcessMocks.spawn
      .mockImplementationOnce(() => {
        queueMicrotask(() => firstExtensionHost.emit('message', { type: 'ready', port: 4101, token: 'extension-host-token-1' }));
        return firstExtensionHost;
      })
      .mockImplementationOnce(() => {
        queueMicrotask(() => firstBackend.emit('message', { type: 'fatal', error: 'backend failed before ready' }));
        return firstBackend;
      })
      .mockImplementationOnce(() => {
        queueMicrotask(() => secondExtensionHost.emit('message', { type: 'ready', port: 4102, token: 'extension-host-token-2' }));
        return secondExtensionHost;
      })
      .mockImplementationOnce(() => {
        queueMicrotask(() => secondBackend.emit('message', { type: 'ready', port: 5102, token: 'backend-token-2' }));
        return secondBackend;
      });

    const backend = new LocalBackendProcesses() as LocalBackendProcesses & {
      child?: unknown;
      extensionHostChild?: unknown;
      extensionHostBaseUrl?: string;
      extensionHostToken?: string;
      baseUrl?: string;
      token?: string;
      lastStartPerf?: { totalMs: number; spawnMs: number; readyWaitMs: number; assignMs: number };
    };

    await expect(backend.ensureStarted()).rejects.toThrow('backend failed before ready');

    expect(firstBackend.send).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(firstExtensionHost.send).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(backend.child).toBeUndefined();
    expect(backend.extensionHostChild).toBeUndefined();
    expect(backend.baseUrl).toBeUndefined();
    expect(backend.token).toBeUndefined();
    expect(backend.extensionHostBaseUrl).toBeUndefined();
    expect(backend.extensionHostToken).toBeUndefined();
    expect(process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL).toBeUndefined();
    expect(process.env.NEON_PILOT_EXTENSION_HOST_TOKEN).toBeUndefined();

    await expect(backend.ensureStarted()).resolves.toBeUndefined();

    expect(backend.extensionHostBaseUrl).toBe('http://127.0.0.1:4102');
    expect(backend.baseUrl).toBe('http://127.0.0.1:5102');
    expect(backend.lastStartPerf).toEqual({
      totalMs: expect.any(Number),
      spawnMs: expect.any(Number),
      readyWaitMs: expect.any(Number),
      assignMs: expect.any(Number),
    });
    expect(backend.lastStartPerf?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves packaged app roots without synthesizing a repo root for child processes', () => {
    const originalEnv = { ...process.env };
    try {
      process.env = {
        HOME: '/Users/patrick',
        PATH: '/usr/bin',
        NEON_PILOT_APP_ROOT: '/Applications/Neon Pilot.app/Contents/Resources/app.asar',
        NEON_PILOT_RESOURCES_ROOT: '/Applications/Neon Pilot.app/Contents/Resources',
        NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR: '/Applications/Neon Pilot.app/Contents/Resources/app.asar.unpacked',
      };

      expect(createDesktopChildEnv({ ELECTRON_RUN_AS_NODE: '1' })).toEqual({
        HOME: '/Users/patrick',
        PATH: '/usr/bin',
        NEON_PILOT_APP_ROOT: '/Applications/Neon Pilot.app/Contents/Resources/app.asar',
        NEON_PILOT_RESOURCES_ROOT: '/Applications/Neon Pilot.app/Contents/Resources',
        NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR: '/Applications/Neon Pilot.app/Contents/Resources/app.asar.unpacked',
        ELECTRON_RUN_AS_NODE: '1',
      });
    } finally {
      process.env = originalEnv;
    }
  });

  it('routes hot product API requests through direct backend RPC instead of generic dispatch', async () => {
    class FastPathBackend extends LocalBackendProcesses {
      readonly calls: Array<{ method: string; args: unknown[] }> = [];

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push({ method, args });
        return { ok: true, method, args };
      }
    }

    const backend = new FastPathBackend();
    const response = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/live-sessions',
      body: { cwd: '/repo' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({
      ok: true,
      method: 'createDesktopLiveSession',
      args: [{ cwd: '/repo' }],
    });
    const sessionsResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/sessions',
    });

    expect(sessionsResponse.statusCode).toBe(200);
    expect(JSON.parse(sessionsResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(sessionsResponse.body))).toEqual({
      ok: true,
      method: 'readDesktopSessions',
      args: [{}],
    });
    const limitedSessionsResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/sessions?limit=100',
    });

    expect(JSON.parse(limitedSessionsResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(limitedSessionsResponse.body))).toEqual([{ id: 'limited' }]);
    expect(readConversationSessionsCapabilityMock).toHaveBeenCalledWith({ limit: 100 });
    expect(bootstrapMocks.setConversationServiceContext).toHaveBeenCalledWith(
      expect.objectContaining({
        getRuntimeScope: expect.any(Function),
        getRepoRoot: expect.any(Function),
        getSavedUiPreferences: expect.any(Function),
      }),
    );
    expect(bootstrapMocks.setConversationServiceContext.mock.calls.at(-1)?.[0].getRuntimeScope()).toBe('shared');
    const sessionDetailResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/sessions/conversation%201?tailBlocks=40',
    });

    expect(sessionDetailResponse.statusCode).toBe(200);
    expect(JSON.parse(sessionDetailResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(sessionDetailResponse.body))).toMatchObject({
      id: 'conversation 1',
      signature: 'signature-1',
    });
    expect(bootstrapMocks.readSessionDetailForRoute).toHaveBeenCalledWith({
      conversationId: 'conversation 1',
      profile: 'shared',
      tailBlocks: 40,
    });
    expect(bootstrapMocks.readConversationSessionSignature).not.toHaveBeenCalled();
    const resumeResponse = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/live-sessions/resume',
      body: { sessionFile: '/sessions/one.jsonl', cwd: '/repo' },
    });

    expect(resumeResponse.statusCode).toBe(200);
    expect(JSON.parse(resumeResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(resumeResponse.body))).toEqual({
      ok: true,
      method: 'resumeDesktopLiveSession',
      args: [{ sessionFile: '/sessions/one.jsonl', cwd: '/repo' }],
    });
    const liveSessionResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/live-sessions/conversation%201',
    });

    expect(liveSessionResponse.statusCode).toBe(200);
    expect(JSON.parse(liveSessionResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(liveSessionResponse.body))).toEqual({
      ok: true,
      method: 'readDesktopLiveSession',
      args: ['conversation 1'],
    });
    const forkEntriesResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/live-sessions/conversation%201/fork-entries',
    });

    expect(forkEntriesResponse.statusCode).toBe(200);
    expect(JSON.parse(forkEntriesResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(forkEntriesResponse.body))).toEqual({
      ok: true,
      method: 'readDesktopLiveSessionForkEntries',
      args: ['conversation 1'],
    });
    const forkResponse = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/live-sessions/conversation%201/fork',
      body: { entryId: 'entry-1', beforeEntry: true },
    });

    expect(forkResponse.statusCode).toBe(200);
    expect(JSON.parse(forkResponse.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'backend-rpc',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(forkResponse.body))).toEqual({
      ok: true,
      method: 'forkDesktopLiveSession',
      args: [{ conversationId: 'conversation 1', entryId: 'entry-1', beforeEntry: true }],
    });
    expect(backend.calls).toEqual([
      { method: 'createDesktopLiveSession', args: [{ cwd: '/repo' }] },
      { method: 'readDesktopSessions', args: [{}] },
      { method: 'resumeDesktopLiveSession', args: [{ sessionFile: '/sessions/one.jsonl', cwd: '/repo' }] },
      { method: 'readDesktopLiveSession', args: ['conversation 1'] },
      { method: 'readDesktopLiveSessionForkEntries', args: ['conversation 1'] },
      { method: 'forkDesktopLiveSession', args: [{ conversationId: 'conversation 1', entryId: 'entry-1', beforeEntry: true }] },
    ]);
  });

  it('serves conversation content search in the main process', async () => {
    class MainProcessSearchBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('search should not start the backend child');
      }
    }

    const backend = new MainProcessSearchBackend();
    const response = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/sessions/search',
      body: { query: 'suggested context release regression', limit: 80 },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      query: 'suggested context release regression',
      mode: 'allTerms',
      scope: 'all',
      matches: expect.any(Array),
    });
  });

  it('serves main-process perf diagnostics without starting the backend child', async () => {
    class DiagnosticsBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('perf diagnostics should not start the backend child');
      }
    }

    const backend = new DiagnosticsBackend();
    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/desktop/perf-diagnostics',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({
      operations: {
        active: [],
        recent: [],
      },
    });
  });

  it('serves session search index in the main process', async () => {
    class MainProcessSearchBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('search index should not start the backend child');
      }
    }

    const backend = new MainProcessSearchBackend();
    const response = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/sessions/search-index',
      body: { sessionIds: ['conversation-1', 2, 'conversation-2'] },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      index: {
        'conversation-1': expect.any(String),
        'conversation-2': expect.any(String),
      },
    });
  });

  it('serves conversation bootstrap in the main process without starting the backend child', async () => {
    class MainProcessBootstrapBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('conversation bootstrap should not start the backend child');
      }
    }

    const backend = new MainProcessBootstrapBackend();
    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/conversations/perf-long-transcript/bootstrap?tailBlocks=40',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      conversationId: 'perf-long-transcript',
      perf: {
        contextMs: 0,
        sessionReadFastTail: 1,
      },
    });
    expect(bootstrapMocks.setConversationServiceContext).toHaveBeenCalledWith(
      expect.objectContaining({
        getRuntimeScope: expect.any(Function),
        getRepoRoot: expect.any(Function),
      }),
    );
    expect(bootstrapMocks.readConversationBootstrapState).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'perf-long-transcript',
        profile: 'shared',
        tailBlocks: 40,
      }),
    );
  });

  it('short-circuits bootstrap for conversations reserved in the main process', async () => {
    class MainProcessBootstrapBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('reserved conversation bootstrap should not start the backend child');
      }
    }

    const backend = new MainProcessBootstrapBackend();
    const reserved = { id: 'reserved-conversation-1' };
    (backend as unknown as { reservedConversationIds: Set<string> }).reservedConversationIds.add(reserved.id);
    bootstrapMocks.readConversationBootstrapState.mockClear();

    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: `/api/conversations/${encodeURIComponent(reserved.id)}/bootstrap?tailBlocks=40`,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      conversationId: reserved.id,
      sessionDetail: null,
      perf: {
        reservedConversationShell: 1,
      },
    });
    expect(bootstrapMocks.readConversationBootstrapState).not.toHaveBeenCalled();
  });

  it('routes backend-owned live conversation bootstrap through the backend child', async () => {
    class BackendOwnedBootstrapBackend extends LocalBackendProcesses {
      readonly calls: Array<{ method: string; args: unknown[] }> = [];

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push({ method, args });
        return {
          conversationId: 'forked-live-1',
          sessionDetail: { id: 'forked-live-1', blocks: [] },
          liveSession: { live: true, id: 'forked-live-1' },
          perf: { childBootstrap: 1 },
        };
      }
    }

    const backend = new BackendOwnedBootstrapBackend();
    (backend as unknown as { backendLiveConversationIds: Set<string> }).backendLiveConversationIds.add('forked-live-1');
    bootstrapMocks.readConversationBootstrapState.mockClear();

    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/conversations/forked-live-1/bootstrap?tailBlocks=40',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      conversationId: 'forked-live-1',
      perf: { childBootstrap: 1 },
    });
    expect(backend.calls).toEqual([
      {
        method: 'readDesktopConversationBootstrap',
        args: [
          expect.objectContaining({
            conversationId: 'forked-live-1',
            tailBlocks: 40,
          }),
        ],
      },
    ]);
    expect(bootstrapMocks.readConversationBootstrapState).not.toHaveBeenCalled();
  });

  it('tracks forked live conversations as backend-owned before the next bootstrap read', async () => {
    class ForkTrackingBackend extends LocalBackendProcesses {
      readonly calls: Array<{ method: string; args: unknown[] }> = [];

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push({ method, args });
        if (method === 'forkDesktopLiveSession') {
          return { newSessionId: 'forked-live-2', sessionFile: '/sessions/forked-live-2.jsonl' };
        }
        return {
          conversationId: 'forked-live-2',
          sessionDetail: { id: 'forked-live-2', blocks: [] },
          liveSession: { live: true, id: 'forked-live-2' },
        };
      }
    }

    const backend = new ForkTrackingBackend();
    bootstrapMocks.readConversationBootstrapState.mockClear();

    const forkResponse = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/live-sessions/source-live/fork',
      body: { entryId: 'entry-2', beforeEntry: true, preserveSource: true },
    });
    expect(forkResponse.statusCode).toBe(200);

    const bootstrapResponse = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/conversations/forked-live-2/bootstrap?tailBlocks=40',
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    expect(backend.calls).toEqual([
      {
        method: 'forkDesktopLiveSession',
        args: [{ conversationId: 'source-live', entryId: 'entry-2', beforeEntry: true, preserveSource: true }],
      },
      {
        method: 'readDesktopConversationBootstrap',
        args: [
          expect.objectContaining({
            conversationId: 'forked-live-2',
            tailBlocks: 40,
          }),
        ],
      },
    ]);
    expect(bootstrapMocks.readConversationBootstrapState).not.toHaveBeenCalled();
  });

  it('ignores renderer transcript delta hints on the session detail route', async () => {
    class MainProcessSessionDetailBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('session detail should not start the backend child');
      }
    }

    const backend = new MainProcessSessionDetailBackend();
    bootstrapMocks.readConversationSessionSignature.mockClear();
    bootstrapMocks.readSessionDetailForRoute.mockClear();

    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/sessions/conversation%201?tailBlocks=40&knownSessionSignature=signature-1',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({
      id: 'conversation 1',
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      signature: 'signature-1',
    });
    expect(bootstrapMocks.readConversationSessionSignature).not.toHaveBeenCalled();
    expect(bootstrapMocks.readSessionDetailForRoute).toHaveBeenCalledWith({
      conversationId: 'conversation 1',
      profile: 'shared',
      tailBlocks: 40,
    });
  });

  it('routes backend-owned live session detail through the backend child', async () => {
    class BackendOwnedSessionDetailBackend extends LocalBackendProcesses {
      readonly calls: Array<{ method: string; args: unknown[] }> = [];

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push({ method, args });
        return {
          sessionId: 'forked-live-1',
          detail: { id: 'forked-live-1', blocks: [] },
          perf: { childSessionDetail: 1 },
        };
      }
    }

    const backend = new BackendOwnedSessionDetailBackend();
    (backend as unknown as { backendLiveConversationIds: Set<string> }).backendLiveConversationIds.add('forked-live-1');

    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/sessions/forked-live-1?tailBlocks=40',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      sessionId: 'forked-live-1',
      perf: { childSessionDetail: 1 },
    });
    expect(backend.calls).toEqual([
      {
        method: 'readDesktopSessionDetail',
        args: [
          expect.objectContaining({
            sessionId: 'forked-live-1',
            tailBlocks: 40,
          }),
        ],
      },
    ]);
  });

  it('serves conversation workspaces in the main process and warms the backend child', async () => {
    const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-workspace-read-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    class MainProcessLayoutBackend extends LocalBackendProcesses {
      readonly calls: string[] = [];

      override async ensureStarted(): Promise<void> {
        this.calls.push('ensureStarted');
      }

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push(`rpc:${method}:${String(args.length)}`);
        return {};
      }
    }

    try {
      const runtimeSettingsFile = join(stateRoot, 'neon-pilot-runtime', 'settings.json');
      mkdirSync(join(stateRoot, 'neon-pilot-runtime'), { recursive: true });
      writeFileSync(
        runtimeSettingsFile,
        JSON.stringify({
          ui: {
            openConversationIds: ['runtime-conv'],
            activeConversationId: 'runtime-conv',
            conversationWorkspaceRevision: 3,
            conversationWorkspaceUpdatedAt: '2026-06-16T00:00:00.000Z',
            conversationWorkspaceMigratedAt: '2026-06-16T00:00:00.000Z',
          },
        }),
      );
      mkdirSync(stateRoot, { recursive: true });
      writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ ui: { openConversationIds: ['wrong-root-conv'] } }));

      const backend = new MainProcessLayoutBackend();
      const response = await backend.dispatchApiRequest({
        method: 'GET',
        path: '/api/conversation-workspace',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
        localApi: {
          fastPath: 'main-process',
        },
      });
      expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
        sessionIds: ['runtime-conv'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: 'runtime-conv',
        workspacePaths: [],
        remoteControlledConversationIds: [],
      });
      await vi.waitFor(() => expect(backend.calls).toEqual(['ensureStarted']));
      await vi.waitFor(() =>
        expect(
          (backend as unknown as { criticalExtensionRegistryModulePromise?: Promise<unknown> }).criticalExtensionRegistryModulePromise,
        ).toBeTruthy(),
      );
    } finally {
      if (originalStateRoot === undefined) {
        delete process.env.NEON_PILOT_STATE_ROOT;
      } else {
        process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
      }
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('serves sidebar conversations from the main process with backend-confirmed sessions', async () => {
    const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-sidebar-conversations-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    class MainProcessSidebarBackend extends LocalBackendProcesses {
      readonly calls: string[] = [];

      override async ensureStarted(): Promise<void> {
        this.calls.push('ensureStarted');
      }
    }

    try {
      const runtimeSettingsFile = join(stateRoot, 'neon-pilot-runtime', 'settings.json');
      mkdirSync(join(stateRoot, 'neon-pilot-runtime'), { recursive: true });
      writeFileSync(
        runtimeSettingsFile,
        JSON.stringify({
          ui: {
            openConversationIds: ['known-open', 'missing-open', 'known-pinned'],
            pinnedConversationIds: ['known-pinned', 'missing-pinned'],
            archivedConversationIds: ['known-archived', 'known-open'],
            activeConversationId: 'missing-open',
            workspacePaths: ['/repo'],
            conversationWorkspaceRevision: 4,
            conversationWorkspaceUpdatedAt: '2026-06-19T12:00:00.000Z',
          },
        }),
      );
      readConversationSessionsCapabilityMock.mockReturnValueOnce([
        { id: 'known-archived', timestamp: '2026-06-19T12:00:02.000Z' },
        { id: 'known-open', timestamp: '2026-06-19T12:00:01.000Z' },
        { id: 'known-pinned', timestamp: '2026-06-19T12:00:00.000Z' },
      ]);

      const backend = new MainProcessSidebarBackend();
      const response = await backend.dispatchApiRequest({
        method: 'GET',
        path: '/api/sidebar/conversations',
      });
      const body = JSON.parse(new TextDecoder().decode(response.body));

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
        localApi: {
          fastPath: 'main-process',
        },
      });
      expect(body).toMatchObject({
        sessionIds: ['known-open'],
        pinnedSessionIds: ['known-pinned'],
        archivedSessionIds: ['known-archived'],
        activeConversationId: null,
        workspacePaths: ['/repo'],
        conversationWorkspaceRevision: 4,
      });
      expect(body.sessions.map((session: { id: string }) => session.id)).toEqual(['known-archived', 'known-open', 'known-pinned']);
      await vi.waitFor(() => expect(backend.calls).toEqual(['ensureStarted']));
      await vi.waitFor(() =>
        expect(
          (backend as unknown as { criticalExtensionRegistryModulePromise?: Promise<unknown> }).criticalExtensionRegistryModulePromise,
        ).toBeTruthy(),
      );
    } finally {
      if (originalStateRoot === undefined) {
        delete process.env.NEON_PILOT_STATE_ROOT;
      } else {
        process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
      }
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('serves the critical extension registry from warmed main-process modules', async () => {
    class MainProcessRegistryBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        // The registry fast path warms the backend in the background, but this
        // test only needs the main-process registry modules.
      }
    }

    const backend = new MainProcessRegistryBackend();

    await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/conversation-workspace',
    });
    await vi.waitFor(() =>
      expect(
        (backend as unknown as { criticalExtensionRegistryModulePromise?: Promise<unknown> }).criticalExtensionRegistryModulePromise,
      ).toBeTruthy(),
    );
    const warmedPromise = (backend as unknown as { criticalExtensionRegistryModulePromise?: Promise<unknown> })
      .criticalExtensionRegistryModulePromise;

    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/extensions/registry/critical',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      routes: expect.any(Array),
      surfaces: expect.any(Array),
      settings: {},
    });
    expect(
      (backend as unknown as { criticalExtensionRegistryModulePromise?: Promise<unknown> }).criticalExtensionRegistryModulePromise,
    ).toBe(warmedPromise);
  });

  it('keeps main-process fast paths usable when backend warmup fails', async () => {
    const stderrWrite = vi.fn();
    process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;
    class FailingWarmupBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        throw new Error('backend child missing');
      }
    }

    const backend = new FailingWarmupBackend();
    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/conversation-workspace',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      sessionIds: [],
      activeConversationId: null,
    });
    await vi.waitFor(() => expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('backend warmup failed')));
  });

  it('keeps the legacy open-conversations route as a compatibility alias', async () => {
    class AliasBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        // The alias should resolve through the same main-process fast path.
      }
    }

    const backend = new AliasBackend();
    const response = await backend.dispatchApiRequest({
      method: 'GET',
      path: '/api/ui/open-conversations',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      sessionIds: expect.any(Array),
      workspacePaths: expect.any(Array),
    });
  });

  it('persists full conversation workspace updates in the main process', async () => {
    const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-workspace-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    try {
      class MainProcessLayoutBackend extends LocalBackendProcesses {
        override async ensureStarted(): Promise<void> {
          // The write must not depend on the child backend.
        }
      }

      const backend = new MainProcessLayoutBackend();
      const response = await backend.dispatchApiRequest({
        method: 'PATCH',
        path: '/api/conversation-workspace',
        body: {
          sessionIds: ['conv-open'],
          pinnedSessionIds: ['conv-pinned'],
          archivedSessionIds: ['conv-archived'],
          activeConversationId: 'conv-pinned',
          workspacePaths: ['/repo'],
          conversationWorkspaceMigrated: true,
        },
      });

      const body = JSON.parse(new TextDecoder().decode(response.body));
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
        localApi: {
          fastPath: 'main-process',
        },
      });
      expect(body).toMatchObject({
        ok: true,
        sessionIds: ['conv-open'],
        pinnedSessionIds: ['conv-pinned'],
        archivedSessionIds: ['conv-archived'],
        activeConversationId: 'conv-pinned',
        workspacePaths: ['/repo'],
        conversationWorkspaceRevision: 1,
      });
      expect(body.conversationWorkspaceUpdatedAt).toEqual(expect.any(String));
      expect(body.conversationWorkspaceMigratedAt).toEqual(expect.any(String));
      expect(JSON.parse(readFileSync(join(stateRoot, 'neon-pilot-runtime', 'settings.json'), 'utf-8'))).toMatchObject({
        ui: {
          openConversationIds: ['conv-open'],
          pinnedConversationIds: ['conv-pinned'],
          archivedConversationIds: ['conv-archived'],
          activeConversationId: 'conv-pinned',
          workspacePaths: ['/repo'],
          conversationWorkspaceRevision: 1,
        },
      });
      expect(JSON.parse(readFileSync(join(stateRoot, 'config', 'local', 'settings.json'), 'utf-8'))).toMatchObject({
        ui: {
          openConversationIds: ['conv-open'],
          pinnedConversationIds: ['conv-pinned'],
          archivedConversationIds: ['conv-archived'],
          activeConversationId: 'conv-pinned',
          workspacePaths: ['/repo'],
          conversationWorkspaceRevision: 1,
        },
      });
    } finally {
      if (originalStateRoot === undefined) {
        delete process.env.NEON_PILOT_STATE_ROOT;
      } else {
        process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
      }
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('persists conversation workspace operations when backend warmup fails', async () => {
    const stderrWrite = vi.fn();
    process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;
    const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-workspace-operation-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    try {
      class FailingWarmupBackend extends LocalBackendProcesses {
        override async ensureStarted(): Promise<void> {
          throw new Error('backend child missing');
        }
      }

      const backend = new FailingWarmupBackend();
      const response = await backend.dispatchApiRequest({
        method: 'POST',
        path: '/api/conversation-workspace/operation',
        body: { operation: 'open', sessionId: 'conv-fast', active: true },
      });

      const body = JSON.parse(new TextDecoder().decode(response.body));
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
        localApi: {
          fastPath: 'main-process',
        },
      });
      expect(body).toMatchObject({
        ok: true,
        sessionIds: ['conv-fast'],
        activeConversationId: 'conv-fast',
        conversationWorkspaceRevision: 1,
      });
      expect(JSON.parse(readFileSync(join(stateRoot, 'neon-pilot-runtime', 'settings.json'), 'utf-8'))).toMatchObject({
        ui: {
          openConversationIds: ['conv-fast'],
          activeConversationId: 'conv-fast',
          conversationWorkspaceRevision: 1,
        },
      });
      expect(JSON.parse(readFileSync(join(stateRoot, 'config', 'local', 'settings.json'), 'utf-8'))).toMatchObject({
        ui: {
          openConversationIds: ['conv-fast'],
          activeConversationId: 'conv-fast',
          conversationWorkspaceRevision: 1,
        },
      });
      await vi.waitFor(() => expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('backend warmup failed')));
    } finally {
      if (originalStateRoot === undefined) {
        delete process.env.NEON_PILOT_STATE_ROOT;
      } else {
        process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
      }
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('reserves conversations in the main process and warms the backend child without prewarming live resources', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    class MainProcessReservationBackend extends LocalBackendProcesses {
      readonly calls: string[] = [];

      override async ensureStarted(): Promise<void> {
        this.calls.push('ensureStarted');
      }
    }

    reserveConversationSessionMock.mockClear();
    const backend = new MainProcessReservationBackend() as MainProcessReservationBackend & { baseUrl: string; token: string };
    backend.baseUrl = 'http://127.0.0.1:1234';
    backend.token = 'token';
    const response = await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/conversations/reserve',
      body: { cwd: '/repo' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.headers['X-PA-Perf'])).toMatchObject({
      localApi: {
        fastPath: 'main-process',
      },
    });
    expect(JSON.parse(new TextDecoder().decode(response.body))).toMatchObject({
      id: 'reserved-1',
      sessionFile: '/tmp/reserved-1.jsonl',
      cwd: '/repo',
    });
    expect(reserveConversationSessionMock).toHaveBeenCalledWith({ cwd: '/repo', profile: 'shared' });
    await vi.waitFor(() => expect(backend.calls).toEqual(['ensureStarted']));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses dispatch abort signals for backend fetch without serializing them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    class StartedBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {}
    }

    const backend = new StartedBackend() as StartedBackend & { baseUrl: string; token: string };
    backend.baseUrl = 'http://127.0.0.1:1234';
    backend.token = 'token';
    const signal = new AbortController().signal;

    await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/extensions/agent-board/actions/saveTask',
      body: { title: 'Ship it' },
      signal,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://127.0.0.1:1234/dispatch');
    expect(init).toEqual(
      expect.objectContaining({
        signal,
        body: JSON.stringify({
          request: { method: 'POST', path: '/api/extensions/agent-board/actions/saveTask', body: { title: 'Ship it' } },
        }),
      }),
    );
  });

  it('creates a reserved live session without waiting on reservation-time prewarm work', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    class MainProcessReservationBackend extends LocalBackendProcesses {
      readonly calls: string[] = [];

      override async ensureStarted(): Promise<void> {
        this.calls.push('ensureStarted');
      }

      override async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
        this.calls.push(`rpc:${method}`);
        return { ok: true, method, args };
      }
    }

    const backend = new MainProcessReservationBackend() as MainProcessReservationBackend & { baseUrl: string; token: string };
    backend.baseUrl = 'http://127.0.0.1:1234';
    backend.token = 'token';

    await backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/conversations/reserve',
      body: { cwd: '/repo' },
    });
    const createPromise = backend.dispatchApiRequest({
      method: 'POST',
      path: '/api/live-sessions',
      body: { cwd: '/repo', reservedSessionFile: '/tmp/reserved-1.jsonl' },
    });

    await Promise.resolve();

    const response = await createPromise;
    expect(response.statusCode).toBe(200);
    expect(backend.calls).toEqual(['ensureStarted', 'rpc:createDesktopLiveSession']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(new TextDecoder().decode(response.body))).toEqual({
      ok: true,
      method: 'createDesktopLiveSession',
      args: [{ cwd: '/repo', reservedSessionFile: '/tmp/reserved-1.jsonl' }],
    });
  });

  it('does not send duplicate parent live-session prewarms after the backend is ready', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const backend = new LocalBackendProcesses() as LocalBackendProcesses & {
      child: { killed: boolean };
      baseUrl: string;
      token: string;
    };
    backend.baseUrl = 'http://127.0.0.1:1234';
    backend.token = 'token';
    backend.child = { killed: false };

    await backend.ensureStarted();
    await backend.ensureStarted();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses child-process IPC for local API RPC when the backend child is connected', async () => {
    const backend = new LocalBackendProcesses() as LocalBackendProcesses & {
      child: { connected: boolean; killed: boolean; send: ReturnType<typeof vi.fn> };
      baseUrl: string;
      token: string;
      pendingLocalApiRpcResponses: Map<string, (message: unknown) => void>;
    };
    backend.baseUrl = 'http://127.0.0.1:1';
    backend.token = 'token';
    backend.child = {
      connected: true,
      killed: false,
      send: vi.fn((message: unknown) => {
        const request = message as { id: string; method: string; args: unknown[] };
        queueMicrotask(() => {
          backend.pendingLocalApiRpcResponses.get(request.id)?.({
            type: 'local-api-rpc-response',
            id: request.id,
            ok: true,
            result: { id: 'conversation-1', perf: { totalBeforeReturnMs: 12 } },
          });
        });
        return true;
      }),
    };

    await expect(backend.callLocalApiMethod('createDesktopLiveSession', [{ cwd: '/repo' }])).resolves.toMatchObject({
      id: 'conversation-1',
      perf: {
        totalBeforeReturnMs: 12,
        rpcTransport: 'ipc',
      },
    });
    expect(backend.child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'local-api-rpc-request',
        method: 'createDesktopLiveSession',
        args: [{ cwd: '/repo' }],
      }),
    );
  });

  it('does not attach stale backend start timing after the backend is already ready', async () => {
    const backend = new LocalBackendProcesses() as LocalBackendProcesses & {
      child: { connected: boolean; killed: boolean; send: ReturnType<typeof vi.fn> };
      baseUrl: string;
      token: string;
      pendingLocalApiRpcResponses: Map<string, (message: unknown) => void>;
      lastStartPerf: { totalMs: number; spawnMs: number; readyWaitMs: number; assignMs: number };
    };
    backend.baseUrl = 'http://127.0.0.1:1';
    backend.token = 'token';
    backend.lastStartPerf = { totalMs: 42, spawnMs: 2, readyWaitMs: 39, assignMs: 1 };
    backend.child = {
      connected: true,
      killed: false,
      send: vi.fn((message: unknown) => {
        const request = message as { id: string };
        queueMicrotask(() => {
          backend.pendingLocalApiRpcResponses.get(request.id)?.({
            type: 'local-api-rpc-response',
            id: request.id,
            ok: true,
            result: { id: 'conversation-1', perf: { totalBeforeReturnMs: 12 } },
          });
        });
        return true;
      }),
    };

    const firstResult = (await backend.callLocalApiMethod('createDesktopLiveSession', [{ cwd: '/repo' }])) as {
      perf?: Record<string, unknown>;
    };
    expect(firstResult).toMatchObject({
      id: 'conversation-1',
      perf: {
        rpcTransport: 'ipc',
      },
    });
    expect(firstResult.perf?.rpcEnsureStartedMs).toEqual(expect.any(Number));
    const result = (await backend.callLocalApiMethod('createDesktopLiveSession', [{ cwd: '/repo' }])) as { perf?: Record<string, unknown> };
    expect(result.perf).not.toHaveProperty('rpcStartTotalMs');
  });

  it('attaches backend start timing when an RPC waits for startup', async () => {
    class WaitingBackend extends LocalBackendProcesses {
      override async ensureStarted(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    const backend = new WaitingBackend() as WaitingBackend & {
      child: { connected: boolean; killed: boolean; send: ReturnType<typeof vi.fn> };
      baseUrl: string;
      token: string;
      pendingLocalApiRpcResponses: Map<string, (message: unknown) => void>;
      lastStartPerf: { totalMs: number; spawnMs: number; readyWaitMs: number; assignMs: number };
    };
    backend.baseUrl = 'http://127.0.0.1:1';
    backend.token = 'token';
    backend.lastStartPerf = { totalMs: 42, spawnMs: 2, readyWaitMs: 39, assignMs: 1 };
    backend.child = {
      connected: true,
      killed: false,
      send: vi.fn((message: unknown) => {
        const request = message as { id: string };
        queueMicrotask(() => {
          backend.pendingLocalApiRpcResponses.get(request.id)?.({
            type: 'local-api-rpc-response',
            id: request.id,
            ok: true,
            result: { id: 'conversation-1', perf: { totalBeforeReturnMs: 12 } },
          });
        });
        return true;
      }),
    };

    await expect(backend.callLocalApiMethod('createDesktopLiveSession', [{ cwd: '/repo' }])).resolves.toMatchObject({
      id: 'conversation-1',
      perf: {
        rpcStartTotalMs: 42,
        rpcStartSpawnMs: 2,
        rpcStartReadyWaitMs: 39,
        rpcStartAssignMs: 1,
      },
    });
  });

  it('routes native Workbench Browser requests to the registered host', async () => {
    const backend = new LocalBackendProcesses();
    const host = createHost();
    backend.setWorkbenchBrowserToolHost(host);

    await expect(handleNativeRequest(backend, { id: 'active', method: 'isActive', args: ['conversation-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'active',
      ok: true,
      result: true,
    });
    await expect(handleNativeRequest(backend, { id: 'tabs', method: 'listTabs', args: [] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'tabs',
      ok: true,
      result: [{ sessionKey: 'tab-1', url: 'https://example.com/', title: 'Example' }],
    });
    await expect(handleNativeRequest(backend, { id: 'snapshot', method: 'snapshot', args: ['conversation-1', 'tab-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'snapshot',
      ok: true,
      result: { title: 'Snapshot' },
    });
    await expect(
      handleNativeRequest(backend, { id: 'screenshot', method: 'screenshot', args: ['conversation-1', 'tab-1'] }),
    ).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'screenshot',
      ok: true,
      result: { data: 'image' },
    });
    await expect(
      handleNativeRequest(backend, {
        id: 'cdp',
        method: 'cdp',
        args: [{ conversationId: 'conversation-1', command: { method: 'Runtime.evaluate' }, tabId: 'tab-1' }],
      }),
    ).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'cdp',
      ok: true,
      result: { value: 42 },
    });

    expect(host.isActive).toHaveBeenCalledWith('conversation-1');
    expect(host.listTabs).toHaveBeenCalledTimes(1);
    expect(host.snapshot).toHaveBeenCalledWith('conversation-1', 'tab-1');
    expect(host.screenshot).toHaveBeenCalledWith('conversation-1', 'tab-1');
    expect(host.cdp).toHaveBeenCalledWith({ conversationId: 'conversation-1', command: { method: 'Runtime.evaluate' }, tabId: 'tab-1' });
  });

  it('rejects native Workbench Browser requests when no host is registered', async () => {
    const backend = new LocalBackendProcesses();
    const stderrWrite = vi.fn();
    process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;

    await expect(handleNativeRequest(backend, { id: 'missing', method: 'snapshot', args: ['conversation-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'missing',
      ok: false,
      error: 'Workbench Browser native host is unavailable.',
    });
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Workbench Browser native snapshot failed after'));
  });

  it('validates native Workbench Browser request methods before dispatch', () => {
    const backend = new LocalBackendProcesses();
    const isRequest = (
      backend as unknown as {
        isNativeWorkbenchBrowserRequest(value: unknown): boolean;
      }
    ).isNativeWorkbenchBrowserRequest.bind(backend);

    expect(isRequest({ type: 'native-workbench-browser-request', id: 'ok', method: 'cdp', args: [] })).toBe(true);
    expect(isRequest({ type: 'native-workbench-browser-request', id: 'bad', method: 'unknown', args: [] })).toBe(false);
  });
});
