import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getStateRoot } from '@neon-pilot/core';

import { removeNeonPilotCliControlPlaneRecord, writeNeonPilotCliControlPlaneRecord } from '../../server/cliControlPlane.js';
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
  baseUrl?: string;
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

const DESKTOP_CHILD_ENV_ALLOWLIST = new Set([
  'CI',
  'DISPLAY',
  'HOME',
  'LANG',
  'LOGNAME',
  'PATH',
  'PWD',
  'SHELL',
  'SSH_AUTH_SOCK',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USER',
  'XAUTHORITY',
  'NEON_PILOT_CONFIG_ROOT',
  'NEON_PILOT_DAEMON_CONFIG',
  'NEON_PILOT_DAEMON_NAMESPACE',
  'NEON_PILOT_DAEMON_SOCKET_PATH',
  'NEON_PILOT_DESKTOP_USER_DATA_DIR',
  'NEON_PILOT_KNOWLEDGE_ROOT',
  'NEON_PILOT_RUNTIME_CHANNEL',
  'NEON_PILOT_STATE_ROOT',
  'NEON_PILOT_COMPANION_PORT',
  'NEON_PILOT_APP_ROOT',
  'NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR',
  'NEON_PILOT_RESOURCES_ROOT',
]);

export function createDesktopChildEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== 'string') continue;
    if (DESKTOP_CHILD_ENV_ALLOWLIST.has(key) || key.startsWith('LC_')) {
      env[key] = value;
    }
  }
  return { ...env, ...overrides };
}

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

function resolveExtensionHostChildEntry(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, 'extension-host-child.js'),
    resolve(currentDir, '..', '..', 'dist', 'backend', 'extension-host-child.js'),
    resolve(currentDir, '..', 'backend', 'extension-host-child.js'),
    resolve(currentDir, 'backend', 'extension-host-child.js'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function renderBackendChildExit(code: number | null, signal: NodeJS.Signals | null): Error {
  return new Error(`Local backend exited before it was ready (code=${String(code)} signal=${String(signal)})`);
}

async function readConversationWorkspaceFastPath(): Promise<unknown> {
  const { readSavedUiPreferences } = await import('../../server/ui/uiPreferences.js');
  const { buildDesktopConversationWorkspaceResponse } = await import('../../server/app/localApiConversationWorkspacePresentation.js');
  const { getRuntimeSettingsFilePath } = await import('../../server/ui/settingsPersistence.js');
  const saved = readSavedUiPreferences(getRuntimeSettingsFilePath(getStateRoot()));
  return buildDesktopConversationWorkspaceResponse(saved);
}

async function readSidebarConversationsFastPath(): Promise<unknown> {
  const { readSavedUiPreferences } = await import('../../server/ui/uiPreferences.js');
  const { buildDesktopSidebarConversationSnapshot } = await import('../../server/app/localApiSidebarConversations.js');
  const { getRuntimeSettingsFilePath } = await import('../../server/ui/settingsPersistence.js');
  const { readConversationSessionsCapability } = await import('../../server/conversations/conversationSessionCapability.js');
  return buildDesktopSidebarConversationSnapshot({
    saved: readSavedUiPreferences(getRuntimeSettingsFilePath(getStateRoot())),
    sessions: readConversationSessionsCapability(),
  });
}

async function saveConversationWorkspaceFastPath(input: unknown): Promise<unknown> {
  const { buildDesktopConversationWorkspaceResponse } = await import('../../server/app/localApiConversationWorkspacePresentation.js');
  const conversationWorkspaceModule: typeof import('../../server/app/localApiConversationWorkspace.js') =
    await import('../../server/app/localApiConversationWorkspace.js');
  const { writeSavedUiPreferences } = await import('../../server/ui/uiPreferences.js');
  const { getRuntimeSettingsFilePath, persistSettingsWrite } = await import('../../server/ui/settingsPersistence.js');
  conversationWorkspaceModule.validateDesktopConversationWorkspaceUpdate(input);
  const update = input as {
    sessionIds?: string[];
    pinnedSessionIds?: string[];
    archivedSessionIds?: string[];
    lockedConversationIds?: string[];
    activeConversationId?: string | null;
    workspacePaths?: string[];
    conversationWorkspaceMigrated?: boolean | null;
  };
  const saved = persistSettingsWrite(
    (settingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: update.sessionIds,
          pinnedConversationIds: update.pinnedSessionIds,
          archivedConversationIds: update.archivedSessionIds,
          lockedConversationIds: update.lockedConversationIds,
          activeConversationId: update.activeConversationId,
          workspacePaths: update.workspacePaths,
          conversationWorkspaceMigrated: update.conversationWorkspaceMigrated,
        },
        settingsFile,
      ),
    { runtimeSettingsFile: getRuntimeSettingsFilePath(getStateRoot()) },
  );
  return {
    ok: true,
    ...buildDesktopConversationWorkspaceResponse(saved),
  };
}

async function updateConversationWorkspaceByOperationFastPath(input: unknown): Promise<unknown> {
  const { buildDesktopConversationWorkspaceResponse } = await import('../../server/app/localApiConversationWorkspacePresentation.js');
  const conversationWorkspaceModule: typeof import('../../server/app/localApiConversationWorkspace.js') =
    await import('../../server/app/localApiConversationWorkspace.js');
  const { readSavedUiPreferences, writeSavedUiPreferences } = await import('../../server/ui/uiPreferences.js');
  const { getRuntimeSettingsFilePath, persistSettingsWrite } = await import('../../server/ui/settingsPersistence.js');
  conversationWorkspaceModule.validateDesktopConversationWorkspaceOperation(input);
  const settingsFile = getRuntimeSettingsFilePath(getStateRoot());
  const current = readSavedUiPreferences(settingsFile);
  const next = conversationWorkspaceModule.applyDesktopConversationWorkspaceOperation(
    {
      sessionIds: current.openConversationIds,
      pinnedSessionIds: current.pinnedConversationIds,
      archivedSessionIds: current.archivedConversationIds,
      lockedConversationIds: current.lockedConversationIds,
      activeConversationId: current.activeConversationId,
    },
    input,
  );
  const saved = persistSettingsWrite(
    (targetSettingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: next.sessionIds,
          pinnedConversationIds: next.pinnedSessionIds,
          archivedConversationIds: next.archivedSessionIds,
          lockedConversationIds: next.lockedConversationIds,
          activeConversationId: next.activeConversationId,
          conversationWorkspaceMigrated: true,
        },
        targetSettingsFile,
      ),
    { runtimeSettingsFile: settingsFile },
  );
  return {
    ok: true,
    ...buildDesktopConversationWorkspaceResponse(saved),
  };
}

export class LocalBackendProcesses {
  private child?: ChildProcess;
  private extensionHostChild?: ChildProcess;
  private extensionHostBaseUrl?: string;
  private extensionHostToken?: string;
  private startPromise?: Promise<void>;
  private disposed = false;
  private baseUrl?: string;
  private token?: string;
  private workbenchBrowserToolHost: LocalBackendWorkbenchBrowserToolHost | null = null;
  private reservedConversationIds = new Set<string>();
  private backendLiveConversationIds = new Set<string>();
  private pendingLocalApiRpcResponses = new Map<string, (message: LocalApiRpcResponseMessage) => void>();
  private lastStartPerf?: { totalMs: number; spawnMs: number; readyWaitMs: number; assignMs: number };
  private backendStartedWithExtensionHost = false;
  private criticalExtensionRegistryModulePromise?: Promise<
    typeof import('../../server/extensions/extensionCriticalRegistryPresentation.js')
  >;

  async ensureStarted(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (this.hasOwnedRuntime()) {
      return;
    }

    if (this.hasPartialRuntime()) {
      await this.clearOwnedRuntime();
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
        return { daemonHealthy: false, baseUrl: this.baseUrl };
      }
      const body = (await response.json()) as { daemonHealthy?: unknown };
      return { daemonHealthy: body.daemonHealthy === true, baseUrl: this.baseUrl };
    } catch {
      return { daemonHealthy: false, baseUrl: this.baseUrl };
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
    const extensionHostChild = this.extensionHostChild;
    this.child = undefined;
    this.extensionHostChild = undefined;
    this.baseUrl = undefined;
    this.token = undefined;
    this.extensionHostBaseUrl = undefined;
    this.extensionHostToken = undefined;
    this.backendStartedWithExtensionHost = false;
    removeNeonPilotCliControlPlaneRecord();

    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // Startup may fail during quit.
      }
    }

    await Promise.all([this.stopChild(child), this.stopChild(extensionHostChild)]);
  }

  async dispatchApiRequest(input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }): Promise<{ statusCode: number; headers: Record<string, string>; body: Uint8Array }> {
    const fastPath = await this.tryDispatchFastPath(input);
    if (fastPath) {
      return fastPath;
    }

    await this.ensureStarted();
    const request = { ...input };
    delete request.signal;
    const response = await this.fetch('/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
      signal: input.signal,
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
    return Boolean(
      this.child &&
      !this.child.killed &&
      this.baseUrl &&
      this.token &&
      (!this.backendStartedWithExtensionHost ||
        Boolean(this.extensionHostChild && !this.extensionHostChild.killed && this.extensionHostBaseUrl && this.extensionHostToken)),
    );
  }

  private hasPartialRuntime(): boolean {
    return Boolean(
      this.child || this.extensionHostChild || this.baseUrl || this.token || this.extensionHostBaseUrl || this.extensionHostToken,
    );
  }

  private async clearOwnedRuntime(): Promise<void> {
    const child = this.child;
    const extensionHostChild = this.extensionHostChild;
    this.child = undefined;
    this.extensionHostChild = undefined;
    this.baseUrl = undefined;
    this.token = undefined;
    this.extensionHostBaseUrl = undefined;
    this.extensionHostToken = undefined;
    this.backendStartedWithExtensionHost = false;
    removeNeonPilotCliControlPlaneRecord();
    await Promise.all([this.stopChild(child), this.stopChild(extensionHostChild)]);
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
        {
          conversationId: decodeURIComponent(forkMatch[1] ?? ''),
          entryId: jsonBody.entryId,
          beforeEntry: jsonBody.beforeEntry,
          preserveSource: jsonBody.preserveSource,
        },
      ]);
      if (result && typeof result === 'object' && typeof (result as { newSessionId?: unknown }).newSessionId === 'string') {
        this.backendLiveConversationIds.add(String((result as { newSessionId: string }).newSessionId));
      }
      return this.makeJsonResponse(result, 'backend-rpc');
    }

    if (input.method === 'GET' && path === '/api/sessions' && url.searchParams.has('limit')) {
      const limitValue = Number(url.searchParams.get('limit'));
      const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? limitValue : undefined;
      const args = [limit === undefined ? {} : { limit }];
      if (this.hasBackendChildForLiveState()) {
        return this.makeJsonResponse(await this.callLocalApiMethod('readDesktopSessions', args), 'backend-rpc');
      }

      const { readConversationSessionsCapability } = await import('../../server/conversations/conversationSessionCapability.js');
      const { setConversationServiceContext } = await import('../../server/conversations/conversationService.js');
      setConversationServiceContext({
        getRuntimeScope: () => 'shared',
        getRepoRoot: () => process.cwd(),
        getSavedUiPreferences: () => ({
          openConversationIds: [],
          pinnedConversationIds: [],
          archivedConversationIds: [],
          lockedConversationIds: [],
          activeConversationId: null,
          workspacePaths: [],
          remoteControlledConversationIds: [],
          conversationWorkspaceRevision: 0,
          conversationWorkspaceUpdatedAt: null,
          conversationWorkspaceMigratedAt: null,
          nodeBrowserViews: [],
        }),
      });
      return this.makeJsonResponse(readConversationSessionsCapability(args[0]), 'main-process');
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
    if (input.method === 'GET' && path === '/api/conversation-workspace') {
      this.warmBackendChild();
      this.warmCriticalExtensionRegistryModule();
      return this.makeJsonResponse(await readConversationWorkspaceFastPath(), 'main-process');
    }
    if (input.method === 'GET' && path === '/api/sidebar/conversations') {
      const hasBackendChild = this.hasBackendChildForLiveState();
      this.warmBackendChild();
      this.warmCriticalExtensionRegistryModule();
      if (hasBackendChild) {
        return this.makeJsonResponse(await this.callLocalApiMethod('readDesktopSidebarConversations', []), 'backend-rpc');
      }
      return this.makeJsonResponse(await readSidebarConversationsFastPath(), 'main-process');
    }
    if (input.method === 'PATCH' && path === '/api/conversation-workspace') {
      this.warmBackendChild();
      return this.makeJsonResponse(await saveConversationWorkspaceFastPath(jsonBody), 'main-process');
    }
    if (input.method === 'POST' && path === '/api/conversation-workspace/operation') {
      this.warmBackendChild();
      return this.makeJsonResponse(await updateConversationWorkspaceByOperationFastPath(jsonBody), 'main-process');
    }
    if (input.method === 'GET' && path === '/api/extensions/registry/critical') {
      const registry = await this.warmCriticalExtensionRegistryModule();
      return this.makeJsonResponse(registry.readCriticalExtensionRegistryResponse(), 'main-process');
    }
    if (input.method === 'POST' && path === '/api/conversations/reserve') {
      const { reserveConversationSession } = await import('../../server/conversations/conversationReservation.js');
      const reserved = reserveConversationSession({ cwd: typeof jsonBody.cwd === 'string' ? jsonBody.cwd : undefined, profile: 'shared' });
      if (reserved && typeof reserved === 'object' && typeof reserved.id === 'string') {
        this.reservedConversationIds.add(reserved.id);
      }
      this.warmBackendChild();
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
          lockedConversationIds: [],
          activeConversationId: null,
          workspacePaths: [],
          remoteControlledConversationIds: [],
          conversationWorkspaceRevision: 0,
          conversationWorkspaceUpdatedAt: null,
          conversationWorkspaceMigratedAt: null,
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
      const { readSessionDetailForRoute } = await import('../../server/conversations/conversationService.js');
      const result = await readSessionDetailForRoute({ conversationId: sessionId, profile: 'shared', tailBlocks });
      return this.makeJsonResponse(result.sessionRead.detail, 'main-process');
    }

    return null;
  }

  private hasBackendChildForLiveState(): boolean {
    const child = this.child;
    return Boolean(child && !child.killed);
  }

  private warmBackendChild(): void {
    void this.ensureStarted().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[desktop-backend] backend warmup failed: ${message}\n`);
    });
  }

  private warmCriticalExtensionRegistryModule(): Promise<
    typeof import('../../server/extensions/extensionCriticalRegistryPresentation.js')
  > {
    if (!this.criticalExtensionRegistryModulePromise) {
      this.criticalExtensionRegistryModulePromise = import('../../server/extensions/extensionCriticalRegistryPresentation.js');
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
    const startedAt = Date.now();
    const extensionHostAlreadyRunning = Boolean(
      this.extensionHostChild && !this.extensionHostChild.killed && this.extensionHostBaseUrl && this.extensionHostToken,
    );
    const token = randomUUID();
    let child: ChildProcess | undefined;

    try {
      const extensionHostReady = await this.startExtensionHostChild();
      const childSpawnedAt = Date.now();
      child = spawn(process.execPath, [resolveBackendChildEntry()], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: createDesktopChildEnv({
          ELECTRON_RUN_AS_NODE: '1',
          NEON_PILOT_BACKEND_TOKEN: token,
          ...(extensionHostReady
            ? {
                NEON_PILOT_EXTENSION_HOST_BASE_URL: `http://127.0.0.1:${String(extensionHostReady.port)}`,
                NEON_PILOT_EXTENSION_HOST_TOKEN: extensionHostReady.token,
              }
            : {}),
          ...(process.env.NEON_PILOT_REPO_ROOT ? { NEON_PILOT_REPO_ROOT: process.env.NEON_PILOT_REPO_ROOT } : {}),
        }),
      });

      const backendChild = child;

      this.child = backendChild;

      backendChild.stderr?.on('data', (chunk) => {
        process.stderr.write(`[desktop-backend] ${String(chunk)}`);
      });
      backendChild.on('message', (message) => {
        if (this.isNativeWorkbenchBrowserRequest(message)) {
          void this.handleNativeWorkbenchBrowserRequest(backendChild, message);
          return;
        }
        if (this.isLocalApiRpcResponse(message)) {
          this.pendingLocalApiRpcResponses.get(message.id)?.(message);
        }
      });

      const readyWaitStartedAt = Date.now();
      const ready = await new Promise<BackendReadyMessage>((resolveReady, rejectReady) => {
        const cleanup = () => {
          backendChild.off('message', onMessage);
          backendChild.off('exit', onExit);
          backendChild.off('error', onError);
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
        backendChild.on('message', onMessage);
        backendChild.once('exit', onExit);
        backendChild.once('error', onError);
      });

      if (this.disposed) {
        await this.stop();
        return;
      }

      const assignStartedAt = Date.now();
      this.token = ready.token || token;
      this.baseUrl = `http://127.0.0.1:${String(ready.port)}`;
      this.backendStartedWithExtensionHost = Boolean(this.extensionHostBaseUrl && this.extensionHostToken);
      this.writeCliControlPlaneRecord();
      const assignedAt = Date.now();
      this.lastStartPerf = {
        totalMs: assignedAt - startedAt,
        spawnMs: childSpawnedAt - startedAt,
        readyWaitMs: assignStartedAt - readyWaitStartedAt,
        assignMs: assignedAt - assignStartedAt,
      };
      child.once('exit', () => {
        if (this.child === child) {
          this.child = undefined;
          this.baseUrl = undefined;
          this.token = undefined;
          this.backendStartedWithExtensionHost = false;
          this.writeCliControlPlaneRecord();
        }
      });
    } catch (error) {
      if (this.child === child) {
        this.child = undefined;
      }
      this.baseUrl = undefined;
      this.token = undefined;
      this.backendStartedWithExtensionHost = false;
      if (!extensionHostAlreadyRunning) {
        const extensionHostChild = this.extensionHostChild;
        this.clearExtensionHostRuntime();
        await this.stopChild(extensionHostChild);
      } else {
        this.writeCliControlPlaneRecord();
      }
      await this.stopChild(child);
      throw error;
    }
  }

  private clearExtensionHostRuntime(): void {
    this.extensionHostChild = undefined;
    this.extensionHostBaseUrl = undefined;
    this.extensionHostToken = undefined;
    delete process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL;
    delete process.env.NEON_PILOT_EXTENSION_HOST_TOKEN;
    removeNeonPilotCliControlPlaneRecord();
  }

  private async stopChild(child: ChildProcess | undefined): Promise<void> {
    if (!child || child.killed) return;
    await new Promise<void>((resolveStop) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolveStop();
      }, 3_000);
      timeout.unref?.();
      child.once('exit', () => {
        clearTimeout(timeout);
        resolveStop();
      });
      if (typeof child.send === 'function' && child.connected) {
        child.send({ type: 'shutdown' });
      } else {
        child.kill('SIGTERM');
      }
    });
  }

  private async startExtensionHostChild(): Promise<BackendReadyMessage | undefined> {
    if (this.extensionHostChild && !this.extensionHostChild.killed && this.extensionHostBaseUrl && this.extensionHostToken) {
      return {
        type: 'ready',
        port: Number(new URL(this.extensionHostBaseUrl).port),
        token: this.extensionHostToken,
      };
    }

    const token = randomUUID();
    const child = spawn(process.execPath, [resolveExtensionHostChildEntry()], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: createDesktopChildEnv({
        ELECTRON_RUN_AS_NODE: '1',
        NEON_PILOT_EXTENSION_HOST_TOKEN: token,
        ...(process.env.NEON_PILOT_REPO_ROOT ? { NEON_PILOT_REPO_ROOT: process.env.NEON_PILOT_REPO_ROOT } : {}),
      }),
    });

    this.extensionHostChild = child;
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[extension-host] ${String(chunk)}`);
    });

    const ready = await new Promise<BackendReadyMessage>((resolveReady, rejectReady) => {
      const cleanup = () => {
        child.off('message', onMessage);
        child.off('exit', onExit);
        child.off('error', onError);
      };
      const onMessage = (message: unknown) => {
        if (!isBackendChildMessage(message)) return;
        cleanup();
        if (message.type === 'ready') {
          resolveReady(message);
          return;
        }
        rejectReady(new Error(message.error));
      };
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        rejectReady(new Error(`Extension host exited before it was ready (code=${String(code)} signal=${String(signal)})`));
      };
      const onError = (error: Error) => {
        cleanup();
        rejectReady(error);
      };
      child.on('message', onMessage);
      child.once('exit', onExit);
      child.once('error', onError);
    });

    if (ready.type === 'ready') {
      this.extensionHostToken = ready.token || token;
      this.extensionHostBaseUrl = `http://127.0.0.1:${String(ready.port)}`;
      process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL = this.extensionHostBaseUrl;
      process.env.NEON_PILOT_EXTENSION_HOST_TOKEN = this.extensionHostToken;
      this.writeCliControlPlaneRecord();
    }

    // Install a permanent message handler for the extension host child,
    // supporting native-workbench-browser-request IPC messages (e.g. from the
    // native process bridge in the extension host main thread).
    child.on('message', (message) => {
      if (this.isNativeWorkbenchBrowserRequest(message)) {
        void this.handleNativeWorkbenchBrowserRequest(child, message);
      }
    });
    child.once('exit', () => {
      if (this.extensionHostChild === child) {
        this.clearExtensionHostRuntime();
      }
    });
    return ready;
  }

  private writeCliControlPlaneRecord(): void {
    if (!this.extensionHostBaseUrl || !this.extensionHostToken) return;
    writeNeonPilotCliControlPlaneRecord({
      pid: process.pid,
      extensionHost: {
        baseUrl: this.extensionHostBaseUrl,
        token: this.extensionHostToken,
      },
      ...(this.baseUrl && this.token ? { localBackend: { baseUrl: this.baseUrl, token: this.token } } : {}),
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
