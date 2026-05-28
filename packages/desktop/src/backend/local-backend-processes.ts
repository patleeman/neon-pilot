import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DesktopApiStreamEvent } from '../hosts/types.js';

export interface LocalBackendWorkbenchBrowserToolHost {
  isActive(conversationId: string): Promise<boolean>;
  listTabs(): Promise<Array<{ sessionKey: string; url: string; title: string }>>;
  snapshot(conversationId: string, tabId?: string): Promise<unknown>;
  screenshot(conversationId: string, tabId?: string): Promise<unknown>;
  cdp(input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }): Promise<unknown>;
}

interface LocalBackendStatus {
  daemonHealthy: boolean;
}

interface BackendReadyMessage {
  type: 'ready';
  port: number;
  token: string;
}

interface BackendFatalMessage {
  type: 'fatal';
  error: string;
}

type BackendChildMessage = BackendReadyMessage | BackendFatalMessage;

const nativeWorkbenchBrowserMethods = new Set(['isActive', 'listTabs', 'snapshot', 'screenshot', 'cdp']);
const NATIVE_WORKBENCH_BROWSER_SLOW_MS = 1_000;

interface NativeWorkbenchBrowserRequest {
  type: 'native-workbench-browser-request';
  id: string;
  method: 'isActive' | 'listTabs' | 'snapshot' | 'screenshot' | 'cdp';
  args: unknown[];
}

interface LocalApiRpcResponseMessage {
  type: 'local-api-rpc-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

function isBackendChildMessage(value: unknown): value is BackendChildMessage {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');
}

function resolveBackendChildEntry(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, 'local-backend-child.js'),
    resolve(currentDir, '..', '..', 'dist', 'backend', 'local-backend-child.js'),
    resolve(currentDir, '..', 'backend', 'local-backend-child.js'),
    resolve(currentDir, 'backend', 'local-backend-child.js'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function renderBackendChildExit(code: number | null, signal: NodeJS.Signals | null): Error {
  return new Error(`Local backend exited before it was ready (code=${String(code)} signal=${String(signal)})`);
}

export class LocalBackendProcesses {
  private child?: ChildProcess;
  private startPromise?: Promise<void>;
  private disposed = false;
  private baseUrl?: string;
  private token?: string;
  private workbenchBrowserToolHost: LocalBackendWorkbenchBrowserToolHost | null = null;
  private reservedConversationIds = new Set<string>();
  private backendLiveConversationIds = new Set<string>();
  private pendingLocalApiRpcResponses = new Map<string, (message: LocalApiRpcResponseMessage) => void>();
  private lastStartPerf?: { totalMs: number; spawnMs: number; readyWaitMs: number; assignMs: number };
  private criticalExtensionRegistryModulePromise?: Promise<
    typeof import('../../server/extensions/extensionRegistry.js') &
      typeof import('../../server/app/localApiExtensionRegistryPresentation.js')
  >;

  async ensureStarted(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (this.hasOwnedRuntime()) {
      return;
    }

    await this.start();
  }

  async getStatus(): Promise<LocalBackendStatus> {
    if (!this.hasOwnedRuntime()) {
      return { daemonHealthy: false };
    }

    try {
      const response = await this.fetch('/health', { method: 'GET' });
      if (!response.ok) {
        return { daemonHealthy: false };
      }
      const body = (await response.json()) as { daemonHealthy?: unknown };
      return { daemonHealthy: body.daemonHealthy === true };
    } catch {
      return { daemonHealthy: false };
    }
  }

  async restart(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }
    await this.stop();
    this.disposed = false;
    await this.start();
  }

  async stop(): Promise<void> {
    this.disposed = true;
    const child = this.child;
    this.child = undefined;
    this.baseUrl = undefined;
    this.token = undefined;

    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // Startup may fail during quit.
      }
    }

    if (!child || child.killed) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve();
      }, 3_000);
      timeout.unref?.();
      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      if (typeof child.send === 'function' && child.connected) {
        child.send({ type: 'shutdown' });
      } else {
        child.kill('SIGTERM');
      }
    });
  }

  async dispatchApiRequest(input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ statusCode: number; headers: Record<string, string>; body: Uint8Array }> {
    const fastPath = await this.tryDispatchFastPath(input);
    if (fastPath) {
      return fastPath;
    }

    await this.ensureStarted();
    const response = await this.fetch('/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: input }),
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  }

  async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
    const ensureStartedAt = Date.now();
    await this.ensureStarted();
    const ensureStartedMs = Date.now() - ensureStartedAt;
    const child = this.child;
    if (child && !child.killed && child.connected && typeof child.send === 'function') {
      const id = randomUUID();
      const result = await new Promise<unknown>((resolveRpc, rejectRpc) => {
        this.pendingLocalApiRpcResponses.set(id, (message) => {
          this.pendingLocalApiRpcResponses.delete(id);
          if (message.ok) {
            resolveRpc(message.result);
          } else {
            rejectRpc(new Error(message.error || 'Local backend RPC failed.'));
          }
        });
        const sent = child.send?.({ type: 'local-api-rpc-request', id, method, args });
        if (!sent) {
          this.pendingLocalApiRpcResponses.delete(id);
          rejectRpc(new Error('Local backend IPC send failed.'));
        }
      });
      return this.withRpcPerf(result, ensureStartedMs, 'ipc');
    }

    const response = await this.fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    });
    const body = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error || `Local backend RPC failed: ${String(response.status)}`);
    }
    return this.withRpcPerf(body.result, ensureStartedMs, 'http');
  }

  async subscribeApiStream(path: string, onEvent: (event: DesktopApiStreamEvent) => void): Promise<() => void> {
    await this.ensureStarted();
    const controller = new AbortController();
    const url = new URL('/stream', this.baseUrl);
    url.searchParams.set('path', path);
    void this.fetch(`${url.pathname}${url.search}`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          onEvent({ type: 'error', message: `Stream failed: ${String(response.status)}` });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separator = buffer.indexOf('\n\n');
          while (separator >= 0) {
            const raw = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            this.emitSseEvent(raw, onEvent);
            separator = buffer.indexOf('\n\n');
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          onEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }

  setWorkbenchBrowserToolHost(host: LocalBackendWorkbenchBrowserToolHost | null): void {
    this.workbenchBrowserToolHost = host;
  }

  private emitSseEvent(raw: string, onEvent: (event: DesktopApiStreamEvent) => void): void {
    const lines = raw.split(/\r?\n/);
    const eventType =
      lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim() || 'message';
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');
    if (eventType === 'open' || eventType === 'close') {
      onEvent({ type: eventType });
      return;
    }
    if (eventType === 'error') {
      onEvent({ type: 'error', message: data ? JSON.parse(data).message : 'Stream error' });
      return;
    }
    onEvent({ type: 'message', data });
  }

  private hasOwnedRuntime(): boolean {
    return Boolean(this.child && !this.child.killed && this.baseUrl && this.token);
  }

  private makeJsonResponse(
    body: unknown,
    fastPath: 'backend-rpc' | 'main-process',
    statusCode = 200,
  ): { statusCode: number; headers: Record<string, string>; body: Uint8Array } {
    return {
      statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'X-PA-Perf': JSON.stringify({ localApi: { fastPath } }),
      },
      body: new TextEncoder().encode(JSON.stringify(body)),
    };
  }

  private async tryDispatchFastPath(input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ statusCode: number; headers: Record<string, string>; body: Uint8Array } | null> {
    const url = new URL(input.path, 'http://neon-pilot.local');
    const path = url.pathname;
    const jsonBody = input.body && typeof input.body === 'object' ? (input.body as Record<string, unknown>) : {};

    if (input.method === 'POST' && path === '/api/live-sessions') {
      const result = await this.callLocalApiMethod('createDesktopLiveSession', [jsonBody]);
      if (result && typeof result === 'object' && typeof (result as { id?: unknown }).id === 'string') {
        this.backendLiveConversationIds.add(String((result as { id: string }).id));
      }
      return this.makeJsonResponse(result, 'backend-rpc');
    }
    if (input.method === 'GET' && path === '/api/sessions' && !url.searchParams.has('limit')) {
      return this.makeJsonResponse(await this.callLocalApiMethod('readDesktopSessions', [{}]), 'backend-rpc');
    }
    if (input.method === 'POST' && path === '/api/live-sessions/resume') {
      const result = await this.callLocalApiMethod('resumeDesktopLiveSession', [jsonBody]);
      if (result && typeof result === 'object' && typeof (result as { id?: unknown }).id === 'string') {
        this.backendLiveConversationIds.add(String((result as { id: string }).id));
      }
      return this.makeJsonResponse(result, 'backend-rpc');
    }
    const liveSessionMatch = path.match(/^\/api\/live-sessions\/([^/]+)$/);
    if (input.method === 'GET' && liveSessionMatch) {
      return this.makeJsonResponse(
        await this.callLocalApiMethod('readDesktopLiveSession', [decodeURIComponent(liveSessionMatch[1] ?? '')]),
        'backend-rpc',
      );
    }
    const forkEntriesMatch = path.match(/^\/api\/live-sessions\/([^/]+)\/fork-entries$/);
    if (input.method === 'GET' && forkEntriesMatch) {
      return this.makeJsonResponse(
        await this.callLocalApiMethod('readDesktopLiveSessionForkEntries', [decodeURIComponent(forkEntriesMatch[1] ?? '')]),
        'backend-rpc',
      );
    }
    const forkMatch = path.match(/^\/api\/live-sessions\/([^/]+)\/fork$/);
    if (input.method === 'POST' && forkMatch) {
      const result = await this.callLocalApiMethod('forkDesktopLiveSession', [
        { conversationId: decodeURIComponent(forkMatch[1] ?? ''), entryId: jsonBody.entryId, beforeEntry: jsonBody.beforeEntry },
      ]);
      if (result && typeof result === 'object' && typeof (result as { newSessionId?: unknown }).newSessionId === 'string') {
        this.backendLiveConversationIds.add(String((result as { newSessionId: string }).newSessionId));
      }
      return this.makeJsonResponse(result, 'backend-rpc');
    }

    if (input.method === 'GET' && path === '/api/sessions' && url.searchParams.has('limit')) {
      const { readConversationSessionsCapability } = await import('../../server/conversations/conversationSessionCapability.js');
      return this.makeJsonResponse(readConversationSessionsCapability(), 'main-process');
    }
    if (input.method === 'POST' && path === '/api/sessions/search') {
      return this.makeJsonResponse({ query: jsonBody.query, mode: 'allTerms', scope: 'all', matches: [] }, 'main-process');
    }
    if (input.method === 'GET' && path === '/api/desktop/perf-diagnostics') {
      return this.makeJsonResponse({ operations: { active: [], recent: [] } }, 'main-process');
    }
    if (input.method === 'POST' && path === '/api/sessions/search-index') {
      const ids = Array.isArray(jsonBody.sessionIds) ? jsonBody.sessionIds.filter((id): id is string => typeof id === 'string') : [];
      return this.makeJsonResponse({ index: Object.fromEntries(ids.map((id) => [id, ''])) }, 'main-process');
    }
    if (input.method === 'GET' && path === '/api/ui/open-conversations') {
      void this.ensureStarted();
      this.warmCriticalExtensionRegistryModule();
      return this.makeJsonResponse(
        {
          sessionIds: [],
          pinnedSessionIds: [],
          archivedSessionIds: [],
          activeConversationId: null,
          workspacePaths: [],
          remoteControlledConversationIds: [],
        },
        'main-process',
      );
    }
    if (input.method === 'GET' && path === '/api/extensions/registry/critical') {
      const registry = await this.warmCriticalExtensionRegistryModule();
      return this.makeJsonResponse(
        registry.buildCriticalExtensionRegistryResponse(registry.readExtensionRegistrySnapshot()),
        'main-process',
      );
    }
    if (input.method === 'POST' && path === '/api/conversations/reserve') {
      const { reserveConversationSession } = await import('../../server/conversations/conversationReservation.js');
      const reserved = reserveConversationSession({ cwd: typeof jsonBody.cwd === 'string' ? jsonBody.cwd : undefined, profile: 'shared' });
      if (reserved && typeof reserved === 'object' && typeof reserved.id === 'string') {
        this.reservedConversationIds.add(reserved.id);
      }
      void this.ensureStarted();
      return this.makeJsonResponse(reserved, 'main-process');
    }

    const bootstrapMatch = path.match(/^\/api\/conversations\/([^/]+)\/bootstrap$/);
    if (input.method === 'GET' && bootstrapMatch) {
      const conversationId = decodeURIComponent(bootstrapMatch[1] ?? '');
      const tailBlocks = Number(url.searchParams.get('tailBlocks') ?? '0') || undefined;
      if (this.backendLiveConversationIds.has(conversationId)) {
        return this.makeJsonResponse(
          await this.callLocalApiMethod('readDesktopConversationBootstrap', [{ conversationId, profile: 'shared', tailBlocks }]),
          'backend-rpc',
        );
      }
      if (this.reservedConversationIds.has(conversationId)) {
        return this.makeJsonResponse({ conversationId, sessionDetail: null, perf: { reservedConversationShell: 1 } }, 'main-process');
      }
      const { readConversationBootstrapState } = await import('../../server/conversations/conversationBootstrap.js');
      const { setConversationServiceContext } = await import('../../server/conversations/conversationService.js');
      setConversationServiceContext({
        getRuntimeScope: () => 'desktop',
        getRepoRoot: () => process.cwd(),
        getSavedUiPreferences: () => ({
          openConversationIds: [],
          pinnedConversationIds: [],
          archivedConversationIds: [],
          activeConversationId: null,
          workspacePaths: [],
          remoteControlledConversationIds: [],
          nodeBrowserViews: [],
        }),
      });
      const result = await readConversationBootstrapState({ conversationId, profile: 'shared', tailBlocks });
      return this.makeJsonResponse({ ...result.state, perf: { contextMs: 0, sessionReadFastTail: 1 } }, 'main-process');
    }
    const sessionDetailMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
    if (input.method === 'GET' && sessionDetailMatch) {
      const sessionId = decodeURIComponent(sessionDetailMatch[1] ?? '');
      const tailBlocks = Number(url.searchParams.get('tailBlocks') ?? '0') || undefined;
      if (this.backendLiveConversationIds.has(sessionId)) {
        return this.makeJsonResponse(
          await this.callLocalApiMethod('readDesktopSessionDetail', [{ sessionId, profile: 'shared', tailBlocks }]),
          'backend-rpc',
        );
      }
      const { readConversationSessionSignature, readSessionDetailForRoute } =
        await import('../../server/conversations/conversationService.js');
      const knownSessionSignature = url.searchParams.get('knownSessionSignature');
      if (knownSessionSignature) {
        const signature = readConversationSessionSignature(sessionId);
        if (signature === knownSessionSignature) {
          return this.makeJsonResponse({ unchanged: true, sessionId, signature }, 'main-process');
        }
      }
      const result = await readSessionDetailForRoute({ conversationId: sessionId, profile: 'shared', tailBlocks });
      return this.makeJsonResponse(result.sessionRead.detail, 'main-process');
    }

    return null;
  }

  private warmCriticalExtensionRegistryModule(): Promise<
    typeof import('../../server/extensions/extensionRegistry.js') &
      typeof import('../../server/app/localApiExtensionRegistryPresentation.js')
  > {
    if (!this.criticalExtensionRegistryModulePromise) {
      this.criticalExtensionRegistryModulePromise = Promise.all([
        import('../../server/extensions/extensionRegistry.js'),
        import('../../server/app/localApiExtensionRegistryPresentation.js'),
      ]).then(([registry, presentation]) => ({ ...registry, ...presentation }));
    }
    return this.criticalExtensionRegistryModulePromise;
  }

  private withRpcPerf(result: unknown, ensureStartedMs: number, transport: 'http' | 'ipc'): unknown {
    if (!result || typeof result !== 'object') {
      return result;
    }
    const output = result as { perf?: Record<string, unknown> };
    output.perf = { ...(output.perf ?? {}), rpcEnsureStartedMs: ensureStartedMs, rpcTransport: transport };
    if (ensureStartedMs > 0 && this.lastStartPerf) {
      output.perf.rpcStartTotalMs = this.lastStartPerf.totalMs;
      output.perf.rpcStartSpawnMs = this.lastStartPerf.spawnMs;
      output.perf.rpcStartReadyWaitMs = this.lastStartPerf.readyWaitMs;
      output.perf.rpcStartAssignMs = this.lastStartPerf.assignMs;
    }
    return output;
  }

  private async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  }

  private async startInternal(): Promise<void> {
    const token = randomUUID();
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(currentDir, '..', '..', '..');
    const child = spawn(process.execPath, [resolveBackendChildEntry()], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NEON_PILOT_BACKEND_TOKEN: token,
        NEON_PILOT_REPO_ROOT: process.env.NEON_PILOT_REPO_ROOT ?? repoRoot,
      },
    });

    this.child = child;

    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[desktop-backend] ${String(chunk)}`);
    });
    child.on('message', (message) => {
      if (this.isNativeWorkbenchBrowserRequest(message)) {
        void this.handleNativeWorkbenchBrowserRequest(child, message);
        return;
      }
      if (this.isLocalApiRpcResponse(message)) {
        this.pendingLocalApiRpcResponses.get(message.id)?.(message);
      }
    });

    const ready = await new Promise<BackendReadyMessage>((resolveReady, rejectReady) => {
      const cleanup = () => {
        child.off('message', onMessage);
        child.off('exit', onExit);
        child.off('error', onError);
      };
      const onMessage = (message: unknown) => {
        if (!isBackendChildMessage(message)) return;
        if (message.type === 'ready') {
          cleanup();
          resolveReady(message);
          return;
        }
        cleanup();
        rejectReady(new Error(message.error));
      };
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        rejectReady(renderBackendChildExit(code, signal));
      };
      const onError = (error: Error) => {
        cleanup();
        rejectReady(error);
      };
      child.on('message', onMessage);
      child.once('exit', onExit);
      child.once('error', onError);
    });

    if (this.disposed) {
      await this.stop();
      return;
    }

    this.token = ready.token || token;
    this.baseUrl = `http://127.0.0.1:${String(ready.port)}`;
    this.lastStartPerf = { totalMs: 0, spawnMs: 0, readyWaitMs: 0, assignMs: 0 };
    child.once('exit', () => {
      if (this.child === child) {
        this.child = undefined;
        this.baseUrl = undefined;
        this.token = undefined;
      }
    });
  }

  private isNativeWorkbenchBrowserRequest(value: unknown): value is NativeWorkbenchBrowserRequest {
    return (
      Boolean(value && typeof value === 'object') &&
      (value as { type?: unknown }).type === 'native-workbench-browser-request' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { method?: unknown }).method === 'string' &&
      nativeWorkbenchBrowserMethods.has((value as { method: string }).method) &&
      Array.isArray((value as { args?: unknown }).args)
    );
  }

  private isLocalApiRpcResponse(value: unknown): value is LocalApiRpcResponseMessage {
    return (
      Boolean(value && typeof value === 'object') &&
      (value as { type?: unknown }).type === 'local-api-rpc-response' &&
      typeof (value as { id?: unknown }).id === 'string'
    );
  }

  private async handleNativeWorkbenchBrowserRequest(child: ChildProcess, request: NativeWorkbenchBrowserRequest): Promise<void> {
    const startedAt = Date.now();
    try {
      const host = this.workbenchBrowserToolHost;
      if (!host) {
        throw new Error('Workbench Browser native host is unavailable.');
      }

      let result: unknown;
      switch (request.method) {
        case 'isActive':
          result = await host.isActive(String(request.args[0] ?? ''));
          break;
        case 'listTabs':
          result = await host.listTabs();
          break;
        case 'snapshot':
          result = await host.snapshot(String(request.args[0] ?? ''), typeof request.args[1] === 'string' ? request.args[1] : undefined);
          break;
        case 'screenshot':
          result = await host.screenshot(String(request.args[0] ?? ''), typeof request.args[1] === 'string' ? request.args[1] : undefined);
          break;
        case 'cdp':
          result = await host.cdp(
            request.args[0] as { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string },
          );
          break;
      }

      const durationMs = Date.now() - startedAt;
      if (durationMs > NATIVE_WORKBENCH_BROWSER_SLOW_MS) {
        process.stderr.write(`[desktop-backend] Workbench Browser native ${request.method} took ${String(durationMs)}ms\n`);
      }
      child.send?.({ type: 'native-workbench-browser-response', id: request.id, ok: true, result });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[desktop-backend] Workbench Browser native ${request.method} failed after ${String(durationMs)}ms: ${message}\n`,
      );
      child.send?.({
        type: 'native-workbench-browser-response',
        id: request.id,
        ok: false,
        error: message,
      });
    }
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Local backend is not ready.');
    }
    return fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        ...(init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init.headers as Record<string, string> | undefined)),
        Authorization: `Bearer ${this.token}`,
      },
    });
  }
}
