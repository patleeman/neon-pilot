import { join, resolve } from 'node:path';

import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir, getStateRoot, queryAppTelemetryEvents } from '@neon-pilot/core';

import { registerFileSystemAuthorityHostEvents } from '../filesystem/filesystemAuthority.js';
import type { LiveSessionResourceOptions, ServerRouteContext } from '../routes/context.js';
import { resolveSecret } from '../secrets/secretStore.js';
import { invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { logError, logInfo, logWarn } from '../shared/logging.js';
import { persistAppTelemetryEvent } from '../traces/appTelemetry.js';
import { createExtensionAttentionCapability } from './extensionAttention.js';
import { createExtensionAutomationsCapability } from './extensionAutomations.js';
import { createExtensionBackendCapabilityDispatcher } from './extensionBackendCapabilities.js';
import { registerExtensionToolUpdateHandle, unregisterExtensionToolUpdateHandle } from './extensionBackendLiveHandles.js';
import { resolveExtensionBackendLoadTarget } from './extensionBackendLoadTarget.js';
import {
  createWorkerImportExtensionBackendRunner,
  ExtensionBackendExportNotFoundError,
  type ExtensionBackendLoadTarget,
  type ExtensionBackendModule,
  type ExtensionBackendOperation,
  extensionBackendOperation,
  getExtensionBackendRunner,
} from './extensionBackendRunner.js';
import { executeHostCommandInRenderer } from './extensionCommandBridge.js';
import { createExtensionConversationsCapability } from './extensionConversations.js';
import { createExtensionDatabaseManager } from './extensionDatabase.js';
import { isLockedExtensionId } from './extensionEnabledConfig.js';
import { publishExtensionEvent, subscribeExtensionEvents } from './extensionEventBus.js';
import { createExtensionFilesystemCapability } from './extensionFilesystem.js';
import { createExtensionKnowledgeCapability } from './extensionKnowledge.js';
import type { ExtensionPermission } from './extensionManifest.js';
import { createExtensionModelsCapability } from './extensionModels.js';
import { isSystemNotificationAvailable, sendNotifyAsSystemNotification, setExtensionBadge } from './extensionNotifications.js';
import { assertExtensionAnyPermission, assertExtensionPermission, setExtensionPermissionGranted } from './extensionPermissions.js';
import { ExtensionProcessTerminationBlockedError } from './extensionProcessGuard.js';
import {
  clearBuildError,
  clearExtensionHealthError,
  findExtensionCommandRegistration,
  findExtensionEntry,
  invalidateExtensionRegistryReadCaches,
  isExtensionEnabled,
  listEnabledExtensionEntries,
  listExtensionAssemblyProviderRegistrations,
  listExtensionCommandRegistrations,
  listExtensionInstallSummaries,
  listExtensionPromptAssemblyHookRegistrations,
  listExtensionPromptContextProviderRegistrations,
  listExtensionRuntimeProviderRegistrations,
  listExtensionSkillRegistrations,
  listExtensionToolRegistrations,
  markExtensionStartupActive,
  recordExtensionFailure,
  setExtensionEnabled,
  setExtensionHealthError,
} from './extensionRegistry.js';
import { createExtensionExecutionsCapability } from './extensionRuns.js';
import { refreshHostSkillMcpConfig } from './extensionRuntimeCapability.js';
import { createExtensionGitCapability, createExtensionShellCapability } from './extensionShell.js';
import { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } from './extensionStorage.js';
import { requestExtensionUiConfirm } from './extensionUiConfirmBridge.js';
import { createExtensionWorkspaceCapability } from './extensionWorkspace.js';
import { isKnownHostCommand } from './hostCommands.js';
import { buildLiveSessionResourceOptionsForRuntime } from './runtimeAgentHooks.js';

export interface ExtensionBackendNotifyInput {
  /** Primary notification text. */
  message: string;
  /** Optional notification title (defaults to extension name). */
  title?: string;
  /** Optional subtitle (macOS only). */
  subtitle?: string;
  /** If true, the notification persists until acknowledged. */
  persistent?: boolean;
  /** Optional payload delivered on notification click. */
  actionPayload?: unknown;
}

export interface ExtensionBackendEventPublishInput {
  /** Event name, e.g. "task:completed". */
  event: string;
  /** Free-form payload. */
  payload: unknown;
}

export interface ExtensionBackendContext {
  extensionId: string;
  runtimeScope: string;
  /** Absolute path to the neon-pilot-runtime directory. */
  runtimeDir: string;
  /** Absolute path to the runtime settings file. */
  runtimeSettingsFilePath: string;
  toolContext?: {
    conversationId?: string;
    cwd?: string;
    sessionFile?: string;
    sessionId?: string;
    preferredVisionModel?: string;
    /** Streaming update callback for long-running tool operations. */
    onUpdate?: (update: { content?: Array<{ type: string; text: string }>; isError?: boolean }) => void;
  };
  agentToolContext?: unknown;
  runtime: {
    getLiveSessionResourceOptions(): LiveSessionResourceOptions;
    getRepoRoot(): string;
    refreshSkillMcpConfig(): Promise<unknown>;
  };
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    put(key: string, value: unknown, opts?: { expectedVersion?: number }): Promise<{ ok: true }>;
    delete(key: string): Promise<{ ok: true; deleted: boolean }>;
    list<T = unknown>(prefix?: string): Promise<Array<{ key: string; value: T }>>;
  };
  database: ReturnType<typeof createExtensionDatabaseManager>;
  documents: {
    listCollections(input?: { owner?: string }): Promise<unknown>;
    getCollection(input: { owner: string; collection: string }): Promise<unknown>;
    upsertCollection(input: {
      owner: string;
      collection: string;
      options?: {
        description?: string;
        defaultGrantRead?: 'owner' | 'all' | 'none';
        defaultGrantWrite?: 'owner' | 'all' | 'none';
      };
    }): Promise<unknown>;
    listDocuments(input: { owner: string; collection: string; limit?: number; offset?: number }): Promise<unknown>;
    getDocument(input: { owner: string; collection: string; id: string }): Promise<unknown>;
    putDocument(input: { owner: string; collection: string; id: string; body: unknown }): Promise<unknown>;
    deleteDocument(input: { owner: string; collection: string; id: string }): Promise<unknown>;
  };
  attention: ReturnType<typeof createExtensionAttentionCapability>;
  automations: ReturnType<typeof createExtensionAutomationsCapability>;
  executions: ReturnType<typeof createExtensionExecutionsCapability>;
  models: ReturnType<typeof createExtensionModelsCapability>;
  knowledge: ReturnType<typeof createExtensionKnowledgeCapability>;
  conversations: ReturnType<typeof createExtensionConversationsCapability>;
  filesystem: ReturnType<typeof createExtensionFilesystemCapability>;
  workspace: ReturnType<typeof createExtensionWorkspaceCapability>;
  git: ReturnType<typeof createExtensionGitCapability>;
  shell: ReturnType<typeof createExtensionShellCapability>;
  commands: {
    execute(command: string, args?: unknown): Promise<boolean>;
    list(): Promise<unknown[]>;
  };
  /** Notification and UI capabilities. */
  notify: {
    /** Show an in-app toast notification. */
    toast(message: string, type?: 'info' | 'warning' | 'error'): void;
    /**
     * Send a system/OS notification.
     * Returns true if the notification was delivered.
     */
    system(input: ExtensionBackendNotifyInput): boolean;
    /** Set the dock badge count (accumulated across all extensions). */
    setBadge(count: number): { badge: number; aggregated: number };
    /** Clear this extension's badge contribution. */
    clearBadge(): void;
    /** Check if system notification support is available. */
    isSystemAvailable(): boolean;
  };
  /** Inter-extension event bus. */
  events: {
    /** Publish an event that other extensions can subscribe to. */
    publish(input: ExtensionBackendEventPublishInput): Promise<void>;
    /** Subscribe to events matching a pattern. */
    subscribe(
      pattern: string,
      handler: (event: { event: string; payload: unknown; sourceExtensionId: string; publishedAt: string }) => void | Promise<void>,
    ): { unsubscribe: () => void };
  };
  /** Call actions exposed by other extensions. */
  extensions: {
    /** Invoke an action on another extension by its id and action id. */
    callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown>;
    invokeAction(input: { extensionId: string; actionId: string; input?: unknown; signal?: AbortSignal }): Promise<unknown>;
    /** List all installed extensions and their actions. */
    listActions(): Array<{
      extensionId: string;
      extensionName: string;
      actions: Array<{ id: string; title?: string; description?: string }>;
    }>;
    listPromptAssemblyContributions(): {
      contextProviders: unknown[];
      assemblyProviders: unknown[];
      hooks: unknown[];
    };
    listStaticContributions(): {
      tools: unknown[];
      skills: unknown[];
      modelDiscovery: unknown[];
    };
    getStatus(extensionId: string): { enabled: boolean; healthy: boolean; errors?: string[] };
    /** Enable or disable an extension by ID. */
    setEnabled(extensionId: string, enabled: boolean): void;
    /** Grant or revoke a declared permission for an extension by ID. */
    setPermissionGranted(extensionId: string, permission: ExtensionPermission, granted: boolean): Promise<void>;
  };
  secrets: {
    /** Resolve a secret registered in this extension's manifest. */
    get(secretId: string): string | undefined;
  };
  ui: {
    invalidate(topics: string | string[]): void;
    confirm(options: {
      title?: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      timeoutMs?: number;
      details?: Array<{ label: string; value: string }>;
    }): Promise<{ confirmed: boolean; status: 'confirmed' | 'declined' | 'timeout' }>;
  };
  telemetry: {
    record(event: {
      source?: 'server' | 'renderer' | 'agent' | 'system';
      category: string;
      name: string;
      sessionId?: string;
      runId?: string;
      route?: string;
      status?: number;
      durationMs?: number;
      count?: number;
      value?: number;
      metadata?: Record<string, unknown>;
    }): void;
  };
  runtimes: {
    list(): Promise<ExtensionRuntimeSummary[]>;
    get(runtimeId: string): Promise<ExtensionRuntimeSummary>;
    healthCheck(runtimeId: string): Promise<{ runtimeId: string; status: string; checkedAt: string }>;
  };
  log: {
    info(message: string, fields?: Record<string, unknown>): void;
    warn(message: string, fields?: Record<string, unknown>): void;
    error(message: string, fields?: Record<string, unknown>): void;
  };
}

interface ExtensionRuntimeSummary {
  id: string;
  providerId: string;
  extensionId: string;
  title: string;
  kind: string;
  status: string;
  version?: string;
  workspaceRoots?: Array<{ id: string; path: string; label?: string }>;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

async function listExtensionRuntimes(
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
  agentToolContext?: unknown,
): Promise<ExtensionRuntimeSummary[]> {
  const runtimes: ExtensionRuntimeSummary[] = [];
  for (const provider of listExtensionRuntimeProviderRegistrations()) {
    const result = await invokeExtensionAction(provider.extensionId, provider.handler, {}, serverContext, toolContext, agentToolContext);
    if (!result.ok) {
      runtimes.push({
        id: `${provider.extensionId}/${provider.id}`,
        providerId: provider.id,
        extensionId: provider.extensionId,
        title: provider.title,
        kind: 'remote',
        status: 'degraded',
        metadata: { error: result.error },
      });
      continue;
    }
    const items = Array.isArray((result.result as { runtimes?: unknown[] } | null)?.runtimes)
      ? (result.result as { runtimes: unknown[] }).runtimes
      : [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const value = item as Record<string, unknown>;
      const rawId = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : provider.id;
      runtimes.push({
        id: rawId.includes('/') ? rawId : `${provider.extensionId}/${rawId}`,
        providerId: provider.id,
        extensionId: provider.extensionId,
        title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : provider.title,
        kind: typeof value.kind === 'string' ? value.kind : 'remote',
        status: typeof value.status === 'string' ? value.status : 'unknown',
        ...(typeof value.version === 'string' ? { version: value.version } : {}),
        ...(Array.isArray(value.workspaceRoots)
          ? { workspaceRoots: value.workspaceRoots as ExtensionRuntimeSummary['workspaceRoots'] }
          : {}),
        ...(Array.isArray(value.capabilities)
          ? { capabilities: value.capabilities.filter((item) => typeof item === 'string') as string[] }
          : {}),
        ...(value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
          ? { metadata: value.metadata as Record<string, unknown> }
          : {}),
      });
    }
  }
  return runtimes;
}

export interface ExtensionProtocolContext extends ExtensionBackendContext {
  protocolId: string;
  stdio: {
    stdin: NodeJS.ReadableStream;
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
  };
  signal: AbortSignal;
}

export interface ExtensionActionTelemetryEntry {
  extensionId: string;
  actionId: string;
  ok: boolean;
  durationMs: number;
  at: string;
  error?: string;
}

const actionTelemetry: ExtensionActionTelemetryEntry[] = [];

function recordActionTelemetry(entry: ExtensionActionTelemetryEntry): void {
  actionTelemetry.unshift(entry);
  actionTelemetry.splice(100);
  persistAppTelemetryEvent({
    source: 'server',
    category: 'extension_action',
    name: entry.actionId,
    durationMs: entry.durationMs,
    metadata: {
      extensionId: entry.extensionId,
      ok: entry.ok,
      ...(entry.error ? { error: entry.error } : {}),
    },
  });
}

function parseTelemetryMetadata(metadataJson: string | null): Record<string, unknown> {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function listExtensionActionTelemetry(extensionId?: string): ExtensionActionTelemetryEntry[] {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const entries = queryAppTelemetryEvents({ since, limit: 1000 })
    .filter((event) => event.category === 'extension_action')
    .map((event): ExtensionActionTelemetryEntry | null => {
      const metadata = parseTelemetryMetadata(event.metadataJson);
      const eventExtensionId = typeof metadata.extensionId === 'string' ? metadata.extensionId : undefined;
      if (!eventExtensionId || (extensionId && eventExtensionId !== extensionId)) return null;
      return {
        extensionId: eventExtensionId,
        actionId: event.name,
        ok: metadata.ok === true,
        durationMs: event.durationMs ?? 0,
        at: event.ts,
        ...(typeof metadata.error === 'string' ? { error: metadata.error } : {}),
      };
    })
    .filter((entry): entry is ExtensionActionTelemetryEntry => entry != null)
    .slice(0, 100);

  if (entries.length > 0) return entries;
  return actionTelemetry.filter((entry) => !extensionId || entry.extensionId === extensionId);
}

export class ExtensionLoadError extends Error {
  readonly extensionId: string;
  readonly code: 'build_failure' | 'load_failure' | 'handler_not_found' | 'module_not_found' | 'extension_disabled' | 'worker_required';

  constructor(opts: { extensionId: string; code: ExtensionLoadError['code']; message: string; cause?: unknown }) {
    super(opts.message);
    this.name = 'ExtensionLoadError';
    this.extensionId = opts.extensionId;
    this.code = opts.code;
    if (opts.cause instanceof Error) {
      this.cause = opts.cause;
    }
  }
}

export type ExtensionActionInvokeResult = { ok: true; result: unknown } | { ok: false; error: string };

function isHostCommandAction(action: string): boolean {
  return isKnownHostCommand(action);
}

function createStorage(extensionId: string, options: { enforceManifestPermissions?: boolean } = {}): ExtensionBackendContext['storage'] {
  const assertStoragePermission = (kind: 'read' | 'write', capability: string) => {
    if (!options.enforceManifestPermissions) return;
    assertExtensionAnyPermission(
      extensionId,
      kind === 'write' ? ['storage:write', 'storage:readwrite'] : ['storage:read', 'storage:readwrite'],
      capability,
    );
  };

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      assertStoragePermission('read', 'storage.get');
      return readExtensionState<T>(extensionId, key)?.value ?? null;
    },
    async put(key: string, value: unknown, opts?: { expectedVersion?: number }): Promise<{ ok: true }> {
      assertStoragePermission('write', 'storage.put');
      writeExtensionState(extensionId, key, value, opts ? { expectedVersion: opts.expectedVersion } : {});
      return { ok: true };
    },
    async delete(key: string): Promise<{ ok: true; deleted: boolean }> {
      assertStoragePermission('write', 'storage.delete');
      return deleteExtensionState(extensionId, key);
    },
    async list<T = unknown>(prefix = ''): Promise<Array<{ key: string; value: T }>> {
      assertStoragePermission('read', 'storage.list');
      return listExtensionState<T>(extensionId, prefix).map((document) => ({ key: document.key, value: document.value }));
    },
  };
}

export type ExtensionBackendServerContext = Pick<ServerRouteContext, 'getRuntimeScope'> &
  Partial<
    Pick<
      ServerRouteContext,
      'buildLiveSessionResourceOptions' | 'getRepoRoot' | 'getSettingsFile' | 'materializeWebRuntimeConfig' | 'getAuthFile' | 'getStateRoot'
    >
  >;

function resolveRuntimeSettingsFilePath(runtimeDir: string, serverContext?: ExtensionBackendServerContext): string {
  const contextSettingsFile = serverContext?.getSettingsFile?.();
  if (contextSettingsFile && contextSettingsFile.trim()) return contextSettingsFile;
  return join(runtimeDir, 'settings.json');
}

export function createBackendContext(
  extensionId: string,
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
  agentToolContext?: unknown,
): ExtensionBackendContext {
  registerFileSystemAuthorityHostEvents();
  const stateRoot = serverContext?.getStateRoot?.() ?? getStateRoot();
  const resolvedPiAgentRuntimeDir = getPiAgentRuntimeDir(stateRoot);
  const runtimeScope = serverContext?.getRuntimeScope() ?? 'shared';
  const runtimeSettingsFilePath = resolveRuntimeSettingsFilePath(resolvedPiAgentRuntimeDir, serverContext);
  const liveSessionResourceOptions = () => {
    if (serverContext?.buildLiveSessionResourceOptions) {
      return serverContext.buildLiveSessionResourceOptions(serverContext.getRuntimeScope());
    }
    return buildLiveSessionResourceOptionsForRuntime();
  };
  const extensionBinDirs = () =>
    liveSessionResourceOptions().additionalExtensionPaths.map((extensionPath) => resolve(extensionPath, 'bin'));
  const shell = createExtensionShellCapability({ pathDirs: extensionBinDirs() });
  return {
    extensionId,
    runtimeScope,
    runtimeDir: resolvedPiAgentRuntimeDir,
    runtimeSettingsFilePath,
    ...(toolContext ? { toolContext } : {}),
    ...(agentToolContext ? { agentToolContext } : {}),
    runtime: {
      getLiveSessionResourceOptions: liveSessionResourceOptions,
      getRepoRoot: () => serverContext?.getRepoRoot?.() ?? process.cwd(),
      refreshSkillMcpConfig: () => {
        assertExtensionPermission(extensionId, 'mcp:write', 'runtime.refreshSkillMcpConfig');
        return refreshHostSkillMcpConfig({
          runtimeScope,
          repoRoot: serverContext?.getRepoRoot?.() ?? process.cwd(),
          runtimeDir: resolvedPiAgentRuntimeDir,
        });
      },
    },
    storage: createStorage(extensionId, { enforceManifestPermissions: true }),
    database: createExtensionDatabaseManager(extensionId),
    documents: {
      listCollections: (input = {}) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'listCollections',
          input,
        }) as Promise<unknown>,
      getCollection: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'getCollection',
          input,
        }) as Promise<unknown>,
      upsertCollection: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'upsertCollection',
          input,
        }) as Promise<unknown>,
      listDocuments: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'listDocuments',
          input,
        }) as Promise<unknown>,
      getDocument: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'getDocument',
          input,
        }) as Promise<unknown>,
      putDocument: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'putDocument',
          input,
        }) as Promise<unknown>,
      deleteDocument: (input) =>
        createExtensionBackendCapabilityDispatcher()({
          id: 0,
          kind: 'capabilityRequest',
          extensionId,
          capability: 'documents',
          operation: 'deleteDocument',
          input,
        }) as Promise<unknown>,
    },
    attention: createExtensionAttentionCapability(extensionId, toolContext),
    automations: createExtensionAutomationsCapability(serverContext, extensionId),
    executions: createExtensionExecutionsCapability(extensionId, { enforceManifestPermissions: true }),
    models: createExtensionModelsCapability(serverContext, extensionId),
    knowledge: createExtensionKnowledgeCapability(extensionId, { enforceManifestPermissions: true }),
    conversations: createExtensionConversationsCapability(serverContext, extensionId, { enforceManifestPermissions: true }),
    filesystem: createExtensionFilesystemCapability(extensionId, toolContext, { enforceManifestPermissions: true }),
    workspace: createExtensionWorkspaceCapability(extensionId, toolContext, { enforceManifestPermissions: true }),
    git: createExtensionGitCapability(extensionId, { enforceManifestPermissions: true }),
    shell: {
      exec: async (input) => {
        assertExtensionPermission(extensionId, 'shell:execute', 'shell.exec');
        return shell.exec(input);
      },
      spawn: async (input) => {
        assertExtensionPermission(extensionId, 'shell:execute', 'shell.spawn');
        return shell.spawn(input);
      },
    },
    commands: {
      execute: async (commandId, args) => {
        assertExtensionPermission(extensionId, 'commands:execute', 'commands.execute');
        const command = findExtensionCommandRegistration(commandId);
        if (command) {
          if (isHostCommandAction(command.action)) {
            return executeHostCommandInRenderer({ command: command.action, args: args ?? command.args, sourceExtensionId: extensionId });
          }
          const actionResult = await invokeExtensionAction(
            command.extensionId,
            command.action,
            args ?? command.args ?? {},
            serverContext,
            toolContext,
            agentToolContext,
          );
          if (!actionResult.ok) throw new Error(actionResult.error);
          return true;
        }
        return executeHostCommandInRenderer({ command: commandId, args, sourceExtensionId: extensionId });
      },
      list: async () => {
        assertExtensionPermission(extensionId, 'commands:read', 'commands.list');
        return listExtensionCommandRegistrations();
      },
    },
    notify: {
      toast: (message, type = 'info') => {
        assertExtensionPermission(extensionId, 'ui:notify', 'notify.toast');
        logInfo('extension notification', { extensionId, type, message });
        invalidateAppTopics('notifications');
        publishAppEvent({ type: 'notification', extensionId, message, severity: type });
      },
      system: (input) => {
        assertExtensionPermission(extensionId, 'ui:notify', 'notify.system');
        return sendNotifyAsSystemNotification(extensionId, input);
      },
      setBadge: (count) => {
        assertExtensionPermission(extensionId, 'ui:notify', 'notify.setBadge');
        return setExtensionBadge(extensionId, count);
      },
      clearBadge: () => {
        assertExtensionPermission(extensionId, 'ui:notify', 'notify.clearBadge');
        return setExtensionBadge(extensionId, 0);
      },
      isSystemAvailable: () => {
        assertExtensionPermission(extensionId, 'ui:notify', 'notify.isSystemAvailable');
        return isSystemNotificationAvailable();
      },
    },
    events: {
      publish: async (input) => {
        await publishExtensionEvent(extensionId, input.event, input.payload);
      },
      subscribe: (pattern, handler) => {
        return subscribeExtensionEvents(extensionId, pattern, handler);
      },
    },
    extensions: {
      callAction: async (targetExtensionId, actionId, input) => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.callAction');
        const entry = findExtensionEntry(targetExtensionId);
        if (!entry) throw new Error(`Extension "${targetExtensionId}" not found.`);
        const action = entry.manifest.backend?.actions?.find((candidate) => candidate.id === actionId);
        if (!action) throw new Error(`Action "${actionId}" not found on extension "${targetExtensionId}".`);
        const actionResult = await invokeExtensionAction(targetExtensionId, actionId, input, serverContext, toolContext, agentToolContext);
        if (!actionResult.ok) throw new Error(actionResult.error);
        return actionResult.result;
      },
      invokeAction: async (input) => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.invokeAction');
        return invokeExtensionAction(input.extensionId, input.actionId, input.input, serverContext, toolContext, agentToolContext);
      },
      listActions: () => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.listActions');
        return listExtensionInstallSummaries()
          .filter((summary) => summary.status === 'enabled' && (summary.backendActions?.length ?? 0) > 0)
          .map((summary) => ({
            extensionId: summary.id,
            extensionName: summary.name,
            actions: (summary.backendActions ?? []).map((action) => ({
              id: action.id,
              title: action.title,
              description: action.description,
            })),
          }));
      },
      listPromptAssemblyContributions: () => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.listPromptAssemblyContributions');
        return {
          contextProviders: listExtensionPromptContextProviderRegistrations(),
          assemblyProviders: listExtensionAssemblyProviderRegistrations(),
          hooks: listExtensionPromptAssemblyHookRegistrations(),
        };
      },
      listStaticContributions: () => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.listStaticContributions');
        return {
          tools: listExtensionToolRegistrations(),
          skills: listExtensionSkillRegistrations(),
          modelDiscovery: listEnabledExtensionEntries().flatMap((entry) => {
            const action = entry.manifest.contributes?.modelDiscovery?.action;
            return typeof action === 'string' ? [{ extensionId: entry.manifest.id, action }] : [];
          }),
        };
      },
      getStatus: (targetExtensionId) => {
        assertExtensionPermission(extensionId, 'extensions:read', 'extensions.getStatus');
        const summary = listExtensionInstallSummaries().find((e) => e.id === targetExtensionId);
        if (!summary) return { enabled: false, healthy: false };
        const enabled = summary.status === 'enabled';
        return {
          enabled,
          healthy: enabled && (!summary.errors || summary.errors.length === 0),
          ...(summary.errors?.length ? { errors: summary.errors } : {}),
        };
      },
      setEnabled: (targetExtensionId, enabled) => {
        assertExtensionPermission(extensionId, 'extensions:write', 'extensions.setEnabled');
        return setExtensionEnabled(targetExtensionId, enabled);
      },
      setPermissionGranted: async (targetExtensionId, permission, granted) => {
        assertExtensionPermission(extensionId, 'extensions:write', 'extensions.setPermissionGranted');
        setExtensionPermissionGranted(targetExtensionId, permission, granted);
        await reloadExtensionBackend(targetExtensionId);
      },
    },
    secrets: {
      get: (secretId) => {
        assertExtensionPermission(extensionId, 'secrets:read', 'secrets.get');
        return resolveSecret(extensionId, secretId);
      },
    },
    ui: {
      invalidate: (topics) => {
        assertExtensionPermission(extensionId, 'ui:invalidate', 'ui.invalidate');
        const items = Array.isArray(topics) ? topics : [topics];
        invalidateAppTopics(...(items as import('../shared/appEvents.js').AppEventTopic[]));
      },
      confirm: async (options) => {
        assertExtensionPermission(extensionId, 'ui:confirm', 'ui.confirm');
        return requestExtensionUiConfirm({ extensionId, ...options });
      },
    },
    telemetry: {
      record: (event) => {
        assertExtensionPermission(extensionId, 'telemetry:write', 'telemetry.record');
        persistAppTelemetryEvent({
          ...event,
          source: event.source ?? 'server',
          metadata: { ...(event.metadata ?? {}), extensionId },
        });
      },
    },
    runtimes: {
      list: async () => {
        assertExtensionPermission(extensionId, 'runtimes:read', 'runtimes.list');
        return listExtensionRuntimes(serverContext, toolContext, agentToolContext);
      },
      get: async (runtimeId) => {
        assertExtensionPermission(extensionId, 'runtimes:read', 'runtimes.get');
        const runtime = (await listExtensionRuntimes(serverContext, toolContext, agentToolContext)).find((item) => item.id === runtimeId);
        if (!runtime) throw new Error(`Runtime "${runtimeId}" not found.`);
        return runtime;
      },
      healthCheck: async (runtimeId) => {
        assertExtensionPermission(extensionId, 'runtimes:read', 'runtimes.healthCheck');
        const runtime = (await listExtensionRuntimes(serverContext, toolContext, agentToolContext)).find((item) => item.id === runtimeId);
        if (!runtime) throw new Error(`Runtime "${runtimeId}" not found.`);
        return { runtimeId, status: runtime.status, checkedAt: new Date().toISOString() };
      },
    },
    log: {
      info: (message, fields) => logInfo(`extension:${extensionId} ${message}`, fields),
      warn: (message, fields) => logWarn(`extension:${extensionId} ${message}`, fields),
      error: (message, fields) => logError(`extension:${extensionId} ${message}`, fields),
    },
  };
}

export function createProtocolContext(
  extensionId: string,
  protocolId: string,
  stdio: ExtensionProtocolContext['stdio'],
  signal: AbortSignal,
  serverContext?: ExtensionBackendServerContext,
): ExtensionProtocolContext {
  return {
    ...createBackendContext(extensionId, serverContext),
    protocolId,
    stdio,
    signal,
  };
}

function renderRequiredBackendArtifact(entry: { packageRoot: string }, backendEntry: string): string {
  if (/^(src\/|.*\.(ts|tsx|mts|cts)$)/i.test(backendEntry)) {
    return resolve(entry.packageRoot, 'dist', 'backend.mjs');
  }

  return resolve(entry.packageRoot, backendEntry);
}

function createPrebuiltBackendRequiredError(extensionId: string, entry: { packageRoot: string }, backendEntry: string): ExtensionLoadError {
  const expectedPath = renderRequiredBackendArtifact(entry, backendEntry);
  return new ExtensionLoadError({
    extensionId,
    code: 'build_failure',
    message: `Extension "${extensionId}" backend artifact is missing: ${expectedPath}. Build the extension outside the app, for example \`pnpm run extension:build -- <extension-dir>\`, then reload it.`,
  });
}

function resolveInstalledExtensionBackendLoadTarget(extensionId: string): ExtensionBackendLoadTarget {
  const entry = findExtensionEntry(extensionId);
  if (!entry) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'module_not_found',
      message: `Extension "${extensionId}" is not installed or has been removed.`,
    });
  }
  if (!entry.packageRoot) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'module_not_found',
      message: `Extension "${extensionId}" has no package root and cannot be loaded.`,
    });
  }
  const backendEntry = entry.manifest.backend?.entry;
  if (!backendEntry) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'handler_not_found',
      message: `Extension "${extensionId}" has no backend entry in its manifest.`,
    });
  }

  const loadTarget = resolveExtensionBackendLoadTarget(entry, backendEntry);
  if (!loadTarget) {
    throw createPrebuiltBackendRequiredError(extensionId, { packageRoot: entry.packageRoot }, backendEntry);
  }
  return loadTarget;
}

function loadCompiledExtensionBackendModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<ExtensionBackendModule> {
  return getExtensionBackendRunner().loadModule(extensionId, compiled);
}

export async function loadExtensionBackend(extensionId: string): Promise<ExtensionBackendModule> {
  return loadCompiledExtensionBackendModule(extensionId, resolveInstalledExtensionBackendLoadTarget(extensionId));
}

let workerImportBackendRunner: ReturnType<typeof createWorkerImportExtensionBackendRunner> | undefined;

function getWorkerImportBackendRunner(): ReturnType<typeof createWorkerImportExtensionBackendRunner> {
  workerImportBackendRunner ??= createWorkerImportExtensionBackendRunner();
  return workerImportBackendRunner;
}

export async function disposeExtensionBackendWorkers(): Promise<void> {
  const runner = workerImportBackendRunner;
  workerImportBackendRunner = undefined;
  await runner?.dispose?.();
}

function loadExtensionBackendForHealthCheck(extensionId: string): Promise<ExtensionBackendModule> {
  return getWorkerImportBackendRunner().loadModule(extensionId, resolveInstalledExtensionBackendLoadTarget(extensionId));
}

async function retryExtensionStartupOperation<T>(operation: () => Promise<T>): Promise<T> {
  const attempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error instanceof ExtensionProcessTerminationBlockedError || attempt === attempts) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150 * attempt));
    }
  }
  throw lastError;
}

function loadExtensionBackendForSelfTest(extensionId: string): Promise<ExtensionBackendModule> {
  return getWorkerImportBackendRunner().loadModule(extensionId, resolveInstalledExtensionBackendLoadTarget(extensionId));
}

function hasExtensionBackendExportForSelfTest(extensionId: string, exportName: string): Promise<boolean> {
  return getWorkerImportBackendRunner().hasExport(extensionId, resolveInstalledExtensionBackendLoadTarget(extensionId), exportName);
}

function runExtensionBackendExportForSelfTest(extensionId: string, exportName: string, actionId: string, input: unknown): Promise<unknown> {
  return getWorkerImportBackendRunner().runWorkerExport(
    extensionId,
    resolveInstalledExtensionBackendLoadTarget(extensionId),
    exportName,
    extensionBackendOperation('self-test-action', `self-test action ${actionId}`, { target: actionId }),
    [input],
    { context: { type: 'backend', toolContext: { conversationId: 'extension-self-test', cwd: process.cwd() } } },
  );
}

function canRunActionInBackendWorker(
  action: { worker?: { enabled?: boolean; inputActions?: string[]; ignoreLiveContext?: boolean; timeoutMs?: number } } | undefined,
  input: unknown,
): boolean {
  if (!action?.worker?.enabled) return false;
  if (action.worker.inputActions && action.worker.inputActions.length > 0) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const body = input as { action?: unknown; cli?: unknown; command?: unknown };
    const inputAction = typeof body.action === 'string' ? body.action : body.cli && typeof body.cli === 'object' ? 'cli' : body.command;
    return typeof inputAction === 'string' && action.worker.inputActions.includes(inputAction);
  }
  return true;
}

function actionWorkerTimeoutMs(action: { worker?: { timeoutMs?: number } } | undefined): number | undefined {
  return typeof action?.worker?.timeoutMs === 'number' && Number.isSafeInteger(action.worker.timeoutMs) && action.worker.timeoutMs > 0
    ? action.worker.timeoutMs
    : undefined;
}

function inputTimeoutMs(input: unknown): number | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const timeoutMs = (input as { timeoutMs?: unknown }).timeoutMs;
  return typeof timeoutMs === 'number' && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined;
}

function actionInvocationWorkerTimeoutMs(action: { worker?: { timeoutMs?: number } } | undefined, input: unknown): number | undefined {
  const manifestTimeoutMs = actionWorkerTimeoutMs(action);
  const requestedTimeoutMs = inputTimeoutMs(input);
  if (manifestTimeoutMs && requestedTimeoutMs) return Math.max(manifestTimeoutMs, requestedTimeoutMs);
  return manifestTimeoutMs ?? requestedTimeoutMs;
}

function workerBackendToolContext(
  toolContext?: ExtensionBackendContext['toolContext'],
  updateHandleId?: string,
):
  | {
      conversationId?: string;
      cwd?: string;
      sessionFile?: string;
      sessionId?: string;
      preferredVisionModel?: string;
      updateHandleId?: string;
    }
  | undefined {
  if (!toolContext) return undefined;
  return {
    ...(toolContext.conversationId ? { conversationId: toolContext.conversationId } : {}),
    ...(toolContext.cwd ? { cwd: toolContext.cwd } : {}),
    ...(toolContext.sessionFile ? { sessionFile: toolContext.sessionFile } : {}),
    ...(toolContext.sessionId ? { sessionId: toolContext.sessionId } : {}),
    ...(toolContext.preferredVisionModel ? { preferredVisionModel: toolContext.preferredVisionModel } : {}),
    ...(updateHandleId ? { updateHandleId } : {}),
  };
}

function toolContextFromAgentToolContext(agentToolContext: unknown): ExtensionBackendContext['toolContext'] | undefined {
  const record =
    agentToolContext && typeof agentToolContext === 'object' && !Array.isArray(agentToolContext)
      ? (agentToolContext as Record<string, unknown>)
      : undefined;
  const source =
    record?.toolContext && typeof record.toolContext === 'object' && !Array.isArray(record.toolContext)
      ? (record.toolContext as Record<string, unknown>)
      : record;
  if (!source) return undefined;
  const conversationId =
    typeof source.conversationId === 'string' && source.conversationId.trim() ? source.conversationId.trim() : undefined;
  const sessionId = typeof source.sessionId === 'string' && source.sessionId.trim() ? source.sessionId.trim() : conversationId;
  const cwd = typeof source.cwd === 'string' && source.cwd.trim() ? source.cwd.trim() : undefined;
  const sessionFile = typeof source.sessionFile === 'string' && source.sessionFile.trim() ? source.sessionFile.trim() : undefined;
  const preferredVisionModel =
    typeof source.preferredVisionModel === 'string' && source.preferredVisionModel.trim() ? source.preferredVisionModel.trim() : undefined;
  if (!conversationId && !sessionId && !cwd && !sessionFile && !preferredVisionModel) return undefined;
  return {
    ...(conversationId ? { conversationId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(cwd ? { cwd } : {}),
    ...(sessionFile ? { sessionFile } : {}),
    ...(preferredVisionModel ? { preferredVisionModel } : {}),
  };
}

function workerLiveSessionResourceOptions(serverContext?: ExtensionBackendServerContext): Record<string, unknown> {
  const options = serverContext?.buildLiveSessionResourceOptions
    ? serverContext.buildLiveSessionResourceOptions(serverContext.getRuntimeScope())
    : buildLiveSessionResourceOptionsForRuntime();
  return {
    additionalExtensionPaths: options.additionalExtensionPaths,
    additionalSkillPaths: options.additionalSkillPaths,
    additionalPromptTemplatePaths: options.additionalPromptTemplatePaths,
    additionalThemePaths: options.additionalThemePaths,
  };
}

function workerBackendContextOptions(
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
  agentToolContext?: unknown,
  updateHandleId?: string,
) {
  const stateRoot = serverContext?.getStateRoot?.() ?? getStateRoot();
  const runtimeDir = getPiAgentRuntimeDir(stateRoot);
  return {
    type: 'backend' as const,
    runtimeScope: serverContext?.getRuntimeScope() ?? 'shared',
    repoRoot: serverContext?.getRepoRoot?.() ?? process.cwd(),
    runtimeDir,
    runtimeSettingsFilePath: resolveRuntimeSettingsFilePath(runtimeDir, serverContext),
    authFile: serverContext?.getAuthFile?.(),
    stateRoot,
    liveSessionResourceOptions: workerLiveSessionResourceOptions(serverContext),
    toolContext: workerBackendToolContext(toolContext, updateHandleId),
    ...(agentToolContext ? { agentToolContext } : {}),
  };
}

async function runExtensionBackendActionInWorker(
  extensionId: string,
  actionId: string,
  exportName: string,
  input: unknown,
  timeoutMs?: number,
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
  agentToolContext?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const runner = getWorkerImportBackendRunner();
  const loadTarget = resolveInstalledExtensionBackendLoadTarget(extensionId);
  if (!(await runner.hasExport(extensionId, loadTarget, exportName))) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'handler_not_found',
      message: `Extension "${extensionId}" backend does not export action handler "${exportName}".`,
    });
  }
  const updateHandleId = registerExtensionToolUpdateHandle(toolContext?.onUpdate);
  try {
    return await runner.runWorkerExport(
      extensionId,
      loadTarget,
      exportName,
      extensionBackendOperation('action', `action ${actionId}`, { target: actionId }),
      [input],
      {
        context: workerBackendContextOptions(serverContext, toolContext, agentToolContext, updateHandleId),
        ...(timeoutMs ? { timeoutMs } : {}),
        ...(signal ? { signal } : {}),
      },
    );
  } finally {
    unregisterExtensionToolUpdateHandle(updateHandleId);
  }
}

export async function runExtensionBackendExportInWorker(
  extensionId: string,
  exportName: string,
  operation: ExtensionBackendOperation,
  args: unknown[],
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
): Promise<unknown> {
  const runner = getWorkerImportBackendRunner();
  const loadTarget = resolveInstalledExtensionBackendLoadTarget(extensionId);
  if (!(await runner.hasExport(extensionId, loadTarget, exportName))) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'handler_not_found',
      message: `Extension "${extensionId}" backend does not export handler "${exportName}".`,
    });
  }
  return runner.runWorkerExport(extensionId, loadTarget, exportName, operation, args, {
    context: workerBackendContextOptions(serverContext, toolContext),
  });
}

function canRunRouteInBackendWorker(route: { stream?: 'sse'; worker?: { enabled?: boolean } } | undefined): boolean {
  return route?.worker?.enabled === true;
}

function workerRouteRequest(request: ExtensionRouteRequest): Omit<ExtensionRouteRequest, 'signal'> {
  return {
    method: request.method,
    path: request.path,
    query: request.query,
    params: request.params,
    ...(request.body === undefined ? {} : { body: request.body }),
  };
}

async function runExtensionBackendRouteInWorker(
  extensionId: string,
  method: string,
  routePath: string,
  exportName: string,
  request: ExtensionRouteRequest,
  serverContext?: ExtensionBackendServerContext,
): Promise<unknown> {
  const runner = getWorkerImportBackendRunner();
  const loadTarget = resolveInstalledExtensionBackendLoadTarget(extensionId);
  if (!(await runner.hasExport(extensionId, loadTarget, exportName))) {
    throw new ExtensionLoadError({
      extensionId,
      code: 'handler_not_found',
      message: `Extension route handler not found: ${exportName}`,
    });
  }
  return runner.runWorkerExport(
    extensionId,
    loadTarget,
    exportName,
    extensionBackendOperation('route', `route ${method} ${routePath}`, { target: routePath }),
    [workerRouteRequest(request)],
    { context: workerBackendContextOptions(serverContext) },
  );
}

async function runExtensionBackendRouteInHost(
  extensionId: string,
  method: string,
  routePath: string,
  exportName: string,
  request: ExtensionRouteRequest,
  serverContext?: ExtensionBackendServerContext,
): Promise<unknown> {
  return runExtensionBackendExport(
    extensionId,
    exportName,
    extensionBackendOperation('route', `route ${method} ${routePath}`, { target: routePath }),
    (handler) => handler(request, createBackendContext(extensionId, serverContext)),
    {
      createMissingExportError: () =>
        new ExtensionLoadError({
          extensionId,
          code: 'handler_not_found',
          message: `Extension route handler not found: ${exportName}`,
        }),
    },
  );
}

function clearWorkerImportBackend(extensionId: string): void {
  workerImportBackendRunner?.clearModule(extensionId);
}

export function setWorkerImportBackendRunnerForTests(
  runner: ReturnType<typeof createWorkerImportExtensionBackendRunner> | undefined,
): void {
  workerImportBackendRunner = runner;
}

export type ExtensionBackendExportHandler = (...args: unknown[]) => unknown;

export async function runExtensionBackendExport<T>(
  extensionId: string,
  exportName: string,
  operation: ExtensionBackendOperation,
  invoke: (handler: ExtensionBackendExportHandler) => Promise<T> | T,
  options: { createMissingExportError?: () => Error; missingExportMessage?: string } = {},
): Promise<T> {
  try {
    return await getExtensionBackendRunner().runExport(
      extensionId,
      resolveInstalledExtensionBackendLoadTarget(extensionId),
      exportName,
      { ...operation, exportName: operation.exportName ?? exportName },
      invoke,
    );
  } catch (error) {
    if (error instanceof ExtensionBackendExportNotFoundError) {
      throw options.createMissingExportError?.() ?? new Error(options.missingExportMessage ?? error.message);
    }
    throw error;
  }
}

export async function loadExtensionAgentFactory(extensionId: string, exportName = 'default'): Promise<ExtensionFactory> {
  try {
    return (await getExtensionBackendRunner().loadAgentFactory(
      extensionId,
      resolveInstalledExtensionBackendLoadTarget(extensionId),
      exportName,
    )) as ExtensionFactory;
  } catch (error) {
    if (error instanceof ExtensionBackendExportNotFoundError) {
      throw new Error(`Extension agent factory export not found: ${exportName}`);
    }
    throw error;
  }
}

export async function runExtensionAgentFactory(
  extensionId: string,
  exportName: string,
  factory: ExtensionFactory,
  pi: Parameters<ExtensionFactory>[0],
): Promise<void> {
  await getExtensionBackendRunner().run(
    extensionId,
    extensionBackendOperation('agent-factory', 'agent extension factory', { exportName, target: exportName }),
    () => Promise.resolve(factory(pi)),
  );
}

export interface ExtensionRouteRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ExtensionRouteSseEvent {
  event?: string;
  data?: unknown;
  id?: string;
  retry?: number;
}

export interface ExtensionRouteResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: 'sse';
  events?: AsyncIterable<ExtensionRouteSseEvent>;
}

export async function invokeExtensionRoute(
  extensionId: string,
  method: string,
  routePath: string,
  request: ExtensionRouteRequest,
  serverContext?: ExtensionBackendServerContext,
): Promise<ExtensionRouteResponse> {
  const entry = findExtensionEntry(extensionId);
  if (!entry || !isExtensionEnabled(extensionId)) {
    return { status: 404, body: { error: 'Extension route not found.' } };
  }
  const route = entry.manifest.backend?.routes?.find((candidate) => candidate.method === method && candidate.path === routePath);
  if (!route) return { status: 404, body: { error: 'Extension route not found.' } };
  let result: unknown;
  try {
    if (route.stream === 'sse') {
      result = await runExtensionBackendRouteInHost(extensionId, method, routePath, route.handler, request, serverContext);
    } else if (canRunRouteInBackendWorker(route)) {
      result = await runExtensionBackendRouteInWorker(extensionId, method, routePath, route.handler, request, serverContext);
    } else {
      throw new ExtensionLoadError({
        extensionId,
        code: 'worker_required',
        message: `Extension route "${method} ${routePath}" must declare worker.enabled before it can run.`,
      });
    }
  } catch (error) {
    if (error instanceof ExtensionLoadError && error.code === 'handler_not_found') {
      return { status: 500, body: { error: error.message } };
    }
    throw error;
  }
  if (
    result &&
    typeof result === 'object' &&
    ('body' in result || 'status' in result || 'headers' in result || 'stream' in result || 'events' in result)
  ) {
    return result as ExtensionRouteResponse;
  }
  return { status: 200, body: result };
}

export async function invokeExtensionAction(
  extensionId: string,
  actionId: string,
  input: unknown,
  serverContext?: ExtensionBackendServerContext,
  toolContext?: ExtensionBackendContext['toolContext'],
  agentToolContext?: unknown,
  signal?: AbortSignal,
): Promise<ExtensionActionInvokeResult> {
  const started = Date.now();
  let actionHandlerStarted = false;
  try {
    const entry = findExtensionEntry(extensionId);
    if (!entry) {
      throw new ExtensionLoadError({
        extensionId,
        code: 'module_not_found',
        message: `Cannot invoke action "${actionId}": extension "${extensionId}" is not installed.`,
      });
    }
    if (!isExtensionEnabled(extensionId)) {
      throw new ExtensionLoadError({
        extensionId,
        code: 'extension_disabled',
        message: `Cannot invoke action "${actionId}": extension "${extensionId}" is disabled.`,
      });
    }
    const action = entry.manifest.backend?.actions?.find((candidate) => candidate.id === actionId);
    const handlerName = action?.handler ?? actionId;
    if (!canRunActionInBackendWorker(action, input)) {
      throw new ExtensionLoadError({
        extensionId,
        code: 'worker_required',
        message: `Extension "${extensionId}" action "${actionId}" must declare worker.enabled before it can run.`,
      });
    }
    actionHandlerStarted = true;
    const result = await runExtensionBackendActionInWorker(
      extensionId,
      actionId,
      handlerName,
      input,
      actionInvocationWorkerTimeoutMs(action, input),
      serverContext,
      toolContext ?? toolContextFromAgentToolContext(agentToolContext),
      agentToolContext,
      signal,
    );
    recordActionTelemetry({ extensionId, actionId, ok: true, durationMs: Date.now() - started, at: new Date().toISOString() });
    return { ok: true, result };
  } catch (error) {
    const message =
      error instanceof ExtensionLoadError
        ? error.message
        : `Extension "${extensionId}" action "${actionId}" failed: ${error instanceof Error ? error.message : String(error)}`;
    if (error instanceof ExtensionProcessTerminationBlockedError) {
      const locked = isLockedExtensionId(extensionId);
      setExtensionHealthError(extensionId, error.message);
      if (!locked) {
        setExtensionEnabled(extensionId, false);
      }
      invalidateAppTopics('extensions');
      publishAppEvent({
        type: 'notification',
        extensionId,
        message: locked
          ? `${error.message} The extension stayed enabled because it is required by the application.`
          : `${error.message} The extension was disabled to prevent a startup loop.`,
        severity: 'error',
      });
    } else if (!actionHandlerStarted && (!(error instanceof ExtensionLoadError) || error.code !== 'extension_disabled')) {
      setExtensionHealthError(extensionId, message);
      recordExtensionFailure({ extensionId, operation: `action ${actionId}`, error: message });
    }
    recordActionTelemetry({
      extensionId,
      actionId,
      ok: false,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
      error: message,
    });
    return { ok: false, error: message };
  }
}

export async function invokeExtensionProtocolEntrypoint(
  protocolId: string,
  input: unknown,
  options: {
    serverContext?: ExtensionBackendServerContext;
    stdio: ExtensionProtocolContext['stdio'];
    signal: AbortSignal;
  },
): Promise<void> {
  const enabled = listExtensionInstallSummaries().filter((summary) => summary.status === 'enabled');
  const matches = enabled.flatMap((summary) => {
    const entry = findExtensionEntry(summary.id);
    const manifestEntrypoints = entry?.manifest.backend?.protocolEntrypoints ?? [];
    return manifestEntrypoints
      .filter((entrypoint) => entrypoint.id === protocolId)
      .map((entrypoint) => ({ extensionId: summary.id, entrypoint }));
  });

  if (matches.length === 0) {
    throw new Error(`No enabled extension provides protocol entrypoint "${protocolId}".`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple enabled extensions provide protocol entrypoint "${protocolId}": ${matches.map((match) => match.extensionId).join(', ')}.`,
    );
  }

  const [{ extensionId, entrypoint }] = matches;
  await runExtensionBackendExport(
    extensionId,
    entrypoint.handler,
    extensionBackendOperation('protocol', `protocol ${protocolId}`, { target: protocolId }),
    (handler) =>
      Promise.resolve(handler(input, createProtocolContext(extensionId, protocolId, options.stdio, options.signal, options.serverContext))),
    { missingExportMessage: `Extension "${extensionId}" protocol handler not found: ${entrypoint.handler}` },
  );
}

const PRODUCT_CRITICAL_EXTENSION_SELF_TESTS: Record<string, Record<string, unknown>> = {
  'system-automations': { scheduledTask: { action: 'list' }, deferredResume: { action: 'list' } },
  'system-diffs': { checkpoint: { action: 'list' } },
  'system-knowledge': { readState: {}, knowledgeTree: {}, knowledgeSearch: { q: '', limit: 1 } },
};

export async function runExtensionSelfTest(
  extensionId: string,
): Promise<{ ok: boolean; extensionId: string; checks: Array<{ name: string; ok: boolean; error?: string }> }> {
  const checks: Array<{ name: string; ok: boolean; error?: string }> = [];
  const entry = findExtensionEntry(extensionId);
  if (!entry) throw new Error('Extension not found.');
  if (!entry.manifest.backend?.entry) return { ok: true, extensionId, checks: [{ name: 'backend', ok: true }] };

  try {
    await loadExtensionBackendForSelfTest(extensionId);
    clearExtensionHealthError(extensionId);
    checks.push({ name: 'backend import', ok: true });
    const actionEntries = entry.manifest.backend.actions ?? [];
    for (const action of actionEntries) {
      const handlerName = action.handler ?? action.id;
      const hasExport = await hasExtensionBackendExportForSelfTest(extensionId, handlerName);
      checks.push({
        name: `action export: ${action.id}`,
        ok: hasExport,
        ...(hasExport ? {} : { error: `Missing export ${handlerName}` }),
      });
    }

    for (const service of entry.manifest.backend.services ?? []) {
      const handlers = [service.handler, service.healthCheck, service.stopHandler].filter(
        (handler): handler is string => typeof handler === 'string' && handler.trim().length > 0,
      );
      for (const handlerName of handlers) {
        const hasExport = await hasExtensionBackendExportForSelfTest(extensionId, handlerName);
        checks.push({
          name: `service export: ${service.id}.${handlerName}`,
          ok: hasExport,
          ...(hasExport ? {} : { error: `Missing export ${handlerName}` }),
        });
      }
    }

    const actionInputs = PRODUCT_CRITICAL_EXTENSION_SELF_TESTS[extensionId] ?? {};
    for (const [actionId, input] of Object.entries(actionInputs)) {
      const action = actionEntries.find((candidate) => candidate.id === actionId);
      const handlerName = action?.handler ?? actionId;
      if (!(await hasExtensionBackendExportForSelfTest(extensionId, handlerName))) {
        checks.push({ name: `action smoke: ${actionId}`, ok: false, error: `Missing export ${handlerName}` });
        continue;
      }
      try {
        const result = await runExtensionBackendExportForSelfTest(extensionId, handlerName, actionId, input);
        checks.push({
          name: `action smoke: ${actionId}`,
          ok: !(result && typeof result === 'object' && 'ok' in result && result.ok === false),
          ...(result && typeof result === 'object' && 'ok' in result && result.ok === false
            ? { error: `Action returned failure: ${JSON.stringify(result)}` }
            : {}),
        });
      } catch (error) {
        checks.push({ name: `action smoke: ${actionId}`, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setExtensionHealthError(extensionId, message);
    checks.push({ name: 'backend import', ok: false, error: message });
  }
  invalidateAppTopics('extensions');
  return { ok: checks.every((check) => check.ok), extensionId, checks };
}

/**
 * Call the startupAction for every enabled extension that declares one.
 * Startup actions receive an empty object as input and run with the default
 * server context (no tool context). Errors are logged per-extension but do
 * not block other extensions from starting.
 */
export async function checkEnabledExtensionBackendHealth(): Promise<Array<{ extensionId: string; ok: boolean; error?: string }>> {
  const enabledWithBackend = listExtensionInstallSummaries().filter((s) => s.status === 'enabled' && s.manifest.backend?.entry);

  // Load all backends in parallel — they are isolated ESM modules with no
  // cross-extension dependencies at load time.
  const results = await Promise.all(
    enabledWithBackend.map(async (summary): Promise<{ extensionId: string; ok: boolean; error?: string }> => {
      try {
        markExtensionStartupActive(summary.id);
        await retryExtensionStartupOperation(() => loadExtensionBackendForHealthCheck(summary.id));
        markExtensionStartupActive(undefined);
        clearExtensionHealthError(summary.id);
        return { extensionId: summary.id, ok: true };
      } catch (error) {
        markExtensionStartupActive(undefined);
        const message = error instanceof Error ? error.message : String(error);
        setExtensionHealthError(summary.id, message);
        if (error instanceof ExtensionProcessTerminationBlockedError) {
          if (!isLockedExtensionId(summary.id)) {
            setExtensionEnabled(summary.id, false);
          }
        } else {
          recordExtensionFailure({ extensionId: summary.id, operation: 'backend health check', error: message });
        }
        logError('extension backend health check failed', { extensionId: summary.id, message });
        publishAppEvent({
          type: 'notification',
          extensionId: summary.id,
          message: `Extension backend failed to load: ${message}`,
          severity: 'error',
        });
        return { extensionId: summary.id, ok: false, error: message };
      }
    }),
  );

  invalidateAppTopics('extensions');
  return results;
}

let extensionServiceShutdownHookInstalled = false;
let extensionServiceHealthTimer: NodeJS.Timeout | null = null;

export async function startExtensionStartupActions(
  serverContext?: ExtensionBackendServerContext,
): Promise<Array<{ extensionId: string; ok: boolean; error?: string }>> {
  const results: Array<{ extensionId: string; ok: boolean; error?: string }> = [];

  for (const summary of listExtensionInstallSummaries()) {
    if (summary.status !== 'enabled') {
      continue;
    }

    const entry = findExtensionEntry(summary.id);
    const startupActionId = entry?.manifest.backend?.startupAction;
    if (!startupActionId) {
      continue;
    }

    try {
      markExtensionStartupActive(summary.id);
      try {
        await invokeExtensionAction(summary.id, startupActionId, {}, serverContext);
      } finally {
        markExtensionStartupActive(undefined);
      }
      results.push({ extensionId: summary.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError('extension startup action failed', { extensionId: summary.id, startupActionId, message });
      publishAppEvent({ type: 'notification', extensionId: summary.id, message: `Startup action failed: ${message}`, severity: 'error' });
      results.push({ extensionId: summary.id, ok: false, error: message });
    }
  }

  const { installExtensionSubscriptions } = await import('./extensionSubscriptions.js');
  await installExtensionSubscriptions(serverContext);
  const { runExtensionServiceHealthChecks, startExtensionServices, stopAllExtensionServices } = await import('./extensionServices.js');
  await startExtensionServices(serverContext);
  if (!extensionServiceShutdownHookInstalled) {
    extensionServiceShutdownHookInstalled = true;
    process.once('beforeExit', () => {
      void stopAllExtensionServices();
    });
  }
  if (!extensionServiceHealthTimer) {
    extensionServiceHealthTimer = setInterval(() => {
      void runExtensionServiceHealthChecks(serverContext);
    }, 30_000);
    extensionServiceHealthTimer.unref?.();
  }
  return results;
}

export async function reloadExtensionBackend(extensionId: string): Promise<{ ok: true; extensionId: string; rebuilt: boolean }> {
  invalidateExtensionRegistryReadCaches();
  const entry = findExtensionEntry(extensionId);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  const backendEntry = entry.manifest.backend?.entry;
  if (!backendEntry || !entry.packageRoot) {
    return { ok: true, extensionId, rebuilt: false };
  }

  const loadTarget = resolveExtensionBackendLoadTarget(entry, backendEntry);
  if (!loadTarget) {
    throw createPrebuiltBackendRequiredError(extensionId, { packageRoot: entry.packageRoot }, backendEntry);
  }

  const { stopExtensionServices, startExtensionServices } = await import('./extensionServices.js');
  await stopExtensionServices(extensionId);
  getExtensionBackendRunner().clearModule(extensionId);
  clearWorkerImportBackend(extensionId);
  await loadCompiledExtensionBackendModule(extensionId, loadTarget);
  clearExtensionHealthError(extensionId);
  clearBuildError(extensionId);
  await startExtensionServices();
  return { ok: true, extensionId, rebuilt: false };
}
