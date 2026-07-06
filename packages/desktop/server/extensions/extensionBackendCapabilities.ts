import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import {
  type DesktopRootLayout,
  getPiAgentRuntimeDir,
  getStateRoot,
  queryAppTelemetryEvents,
  readTraceTelemetryLogEvents,
} from '@neon-pilot/core';

import {
  cancelDelayedEvent,
  delayEvent,
  deleteSubscription,
  emitEvent,
  listEvents,
  listSubscriptions,
  processDueEvents,
  pruneEvents,
  replayEvent,
  saveSubscription,
} from '../automation/eventBusHost.js';
import { getDocumentsStore } from '../documents/store.js';
import type { FileAccess, ScopedFileSystem } from '../filesystem/filesystemAuthority.js';
import { createModelRegistryForAuthFile } from '../models/modelRegistry.js';
import { resolveSecret } from '../secrets/secretStore.js';
import { createSettingsStore } from '../settings/settingsStore.js';
import { type AppEventTopic, invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { logError, logInfo, logWarn } from '../shared/logging.js';
import { persistAppTelemetryEvent } from '../traces/appTelemetry.js';
import {
  abortAgentConversation,
  createAgentConversation,
  disposeAgentConversation,
  getAgentConversation,
  listAgentConversations,
  runAgentTask,
  sendAgentMessage,
  streamAgentMessage,
} from './backendApi/agent.js';
import { callDaemonExport } from './backendApi/daemonBridge.js';
import { callServerModuleExport } from './backendApi/serverModuleResolver.js';
import { emitExtensionToolUpdate } from './extensionBackendLiveHandles.js';
import { resolveExtensionBackendLoadTarget } from './extensionBackendLoadTarget.js';
import type { ExtensionBackendWorkerCapabilityEvent, ExtensionBackendWorkerCapabilityRequest } from './extensionBackendWorkerProtocol.js';
import { executeHostCommandInRenderer } from './extensionCommandBridge.js';
import { queryConversationMetadata, readConversationMetadata, writeConversationMetadata } from './extensionConversationMetadata.js';
import { createExtensionConversationsCapability } from './extensionConversations.js';
import { publishExtensionEvent } from './extensionEventBus.js';
import { createExtensionFilesystemCapability } from './extensionFilesystem.js';
import { createExtensionBackendServerContextFromSnapshot } from './extensionHostServerContext.js';
import type { ExtensionPermission } from './extensionManifest.js';
import { createExtensionModelsCapability } from './extensionModels.js';
import { isSystemNotificationAvailable, sendNotifyAsSystemNotification, setExtensionBadge } from './extensionNotifications.js';
import { assertExtensionAnyPermission, setExtensionPermissionGranted } from './extensionPermissions.js';
import {
  findExtensionCommandRegistration,
  findExtensionEntry,
  listEnabledExtensionEntries,
  listExtensionAssemblyProviderRegistrations,
  listExtensionCommandRegistrations,
  listExtensionInstallSummaries,
  listExtensionPromptAssemblyHookRegistrations,
  listExtensionPromptContextProviderRegistrations,
  listExtensionSkillRegistrations,
  listExtensionToolRegistrations,
  setExtensionEnabled,
} from './extensionRegistry.js';
import { type ExtensionRuntimeRefreshSkillMcpConfigInput, refreshHostSkillMcpConfig } from './extensionRuntimeCapability.js';
import { createExtensionGitCapability, createExtensionShellCapability, terminateSpawnedExtensionProcesses } from './extensionShell.js';
import { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } from './extensionStorage.js';
import { publishExtensionHostEvent } from './extensionSubscriptions.js';
import { requestExtensionUiConfirm } from './extensionUiConfirmBridge.js';
import { createExtensionWorkspaceCapability } from './extensionWorkspace.js';
import { isKnownHostCommand } from './hostCommands.js';
import {
  closeTerminalSession,
  createTerminalSession,
  drainTerminalSession,
  resizeTerminalSession,
  streamTerminalSession,
  writeTerminalSession,
} from './terminalSessions.js';
import { getWorkbenchBrowserToolHost } from './workbenchBrowserToolHost.js';

type ExtensionLogLevel = 'info' | 'warn' | 'error';
type ExtensionTelemetrySource = 'server' | 'renderer' | 'agent' | 'system';

interface ExtensionBackendCapabilityLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

interface ExtensionBackendCapabilityGit {
  status(input: { cwd: string }): Promise<unknown> | unknown;
  diff(input: { cwd: string; path?: string; staged?: boolean }): Promise<unknown> | unknown;
  log(input: { cwd: string; maxCount?: number }): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityRuntime {
  refreshSkillMcpConfig(input: ExtensionRuntimeRefreshSkillMcpConfigInput): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilitySettings {
  read(stateRoot?: string): Promise<unknown> | unknown;
  readSchema(stateRoot?: string): Promise<unknown> | unknown;
  update(overrides: Record<string, unknown>, stateRoot?: string): Promise<unknown> | unknown;
  reset(keys: string[], stateRoot?: string): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityEvents {
  publish(extensionId: string, event: string, payload: unknown): Promise<unknown> | unknown;
  emit(input: unknown): Promise<unknown> | unknown;
  delay(input: unknown): Promise<unknown> | unknown;
  replay(input: unknown): Promise<unknown> | unknown;
  list(input?: unknown): Promise<unknown> | unknown;
  listSubscriptions(input?: unknown): Promise<unknown> | unknown;
  saveSubscription(input: unknown): Promise<unknown> | unknown;
  deleteSubscription(input: unknown): Promise<unknown> | unknown;
  cancelDelayed(input: unknown): Promise<unknown> | unknown;
  prune(input: unknown): Promise<unknown> | unknown;
  processDue(input?: unknown): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityDocuments {
  stateRoot?: string;
  desktopRootLayout?: DesktopRootLayout;
}

interface ExtensionBackendCapabilityAutomations {
  call(operation: string, input?: unknown): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityImage {
  generate(
    extensionId: string,
    input: { input: unknown; toolContext?: { preferredVisionModel?: string; sessionFile?: string } },
  ): Promise<unknown>;
}

interface ExtensionBackendCapabilityVideo {
  extractFrame(input: unknown, context?: { sessionId?: string }): Promise<unknown>;
  sampleFrames(input: unknown, context?: { sessionId?: string }): Promise<unknown>;
  transcribe(input: unknown): Promise<unknown>;
}

interface ExtensionBackendCapabilityConversations {
  list?(extensionId: string, input?: { runtimeScope?: string; runtimeSettingsFilePath?: string }): Promise<unknown> | unknown;
  activity?(
    extensionId: string,
    conversationId: string,
    options?: { active?: boolean; visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all' },
  ): Promise<unknown> | unknown;
  connections?(
    extensionId: string,
    conversationId: string,
    options?: {
      active?: boolean;
      kind?: 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface' | 'all';
      surface?: 'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli' | 'all';
      visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all';
    },
  ): Promise<unknown> | unknown;
  get(extensionId: string, conversationId: string): Promise<unknown> | unknown;
  getMeta?(extensionId: string, conversationId: string): Promise<unknown> | unknown;
  getBlocks?(extensionId: string, conversationId: string, options?: { tailBlocks?: number }): Promise<unknown> | unknown;
  create?(
    extensionId: string,
    input?: {
      cwd?: string;
      live?: boolean;
      title?: string;
      prompt?: string;
      initialPrompt?: string;
      model?: string | null;
      thinkingLevel?: string | null;
      serviceTier?: string | null;
      allowedToolNames?: string[];
    },
  ): Promise<unknown> | unknown;
  setActiveTools(extensionId: string, conversationId: string, toolNames: string[]): Promise<unknown> | unknown;
  appendCustomEntry(extensionId: string, conversationId: string, customType: string, data?: unknown): Promise<unknown> | unknown;
  appendTranscriptBlock?(
    extensionId: string,
    input: { conversationId: string; blockType: string; data: unknown; title?: string; blockId?: string },
  ): Promise<unknown> | unknown;
  updateTranscriptBlock?(
    extensionId: string,
    input: { conversationId: string; blockType: string; blockId: string; data: unknown; title?: string },
  ): Promise<unknown> | unknown;
  getWorkspace?(extensionId: string, input?: { runtimeScope?: string; runtimeSettingsFilePath?: string }): Promise<unknown> | unknown;
  updateWorkspace?(
    extensionId: string,
    input: {
      runtimeScope?: string;
      runtimeSettingsFilePath?: string;
      openConversationIds?: string[] | null;
      pinnedConversationIds?: string[] | null;
      archivedConversationIds?: string[] | null;
      activeConversationId?: string | null;
      workspacePaths?: string[] | null;
      remoteControlledConversationIds?: string[] | null;
    },
  ): Promise<unknown> | unknown;
  ensureLive?(extensionId: string, conversationId: string, options?: { cwd?: string }): Promise<unknown> | unknown;
  requestWorkingDirectoryChange?(
    extensionId: string,
    conversationId: string,
    cwd: string,
    options?: { continuePrompt?: string },
  ): Promise<unknown> | unknown;
  sendMessage?(
    extensionId: string,
    conversationId: string,
    text: string,
    options?: {
      steer?: boolean;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
    },
  ): Promise<unknown> | unknown;
  startParallelPrompt?(
    extensionId: string,
    conversationId: string,
    input: {
      text: string;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      model?: string | null;
      thinkingLevel?: string | null;
      serviceTier?: string | null;
      purpose?: string;
      metadata?: Record<string, unknown>;
      autoImport?: boolean;
    },
  ): Promise<unknown> | unknown;
  manageParallelJob?(
    extensionId: string,
    input: { conversationId: string; jobId: string; action: 'importNow' | 'skip' | 'cancel' },
  ): Promise<unknown> | unknown;
  runTurn?(
    extensionId: string,
    conversationId: string,
    text: string,
    options?: {
      cwd?: string;
      steer?: boolean;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      timeoutMs?: number;
      onEvent?: (event: unknown) => void;
    },
  ): Promise<unknown> | unknown;
  startParallelPrompt?(
    extensionId: string,
    conversationId: string,
    input: {
      text: string;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      attachmentRefs?: unknown;
      contextMessages?: unknown;
      relatedConversationIds?: unknown;
      surfaceId?: string;
      cwd?: string;
      model?: string | null;
      thinkingLevel?: string | null;
      serviceTier?: string | null;
      purpose?: string;
      metadata?: Record<string, unknown>;
      autoImport?: boolean;
    },
  ): Promise<unknown> | unknown;
  manageParallelJob?(
    extensionId: string,
    input: { conversationId: string; jobId: string; action: 'importNow' | 'skip' | 'cancel' },
  ): Promise<unknown> | unknown;
  createSpeculativeWorkspace?(extensionId: string, conversationId: string): Promise<unknown> | unknown;
  applySpeculativeWorkspace?(
    extensionId: string,
    input: { id: string; sourcePath?: string; rootPath?: string; paths?: string[] },
  ): Promise<unknown> | unknown;
  disposeSpeculativeWorkspace?(extensionId: string, input: string | { id: string; rootPath?: string }): Promise<unknown> | unknown;
  abort?(extensionId: string, conversationId: string): Promise<unknown> | unknown;
  compact?(extensionId: string, conversationId: string, customInstructions?: string): Promise<unknown> | unknown;
  fork?(
    extensionId: string,
    input: { conversationId: string; targetCwd?: string; cwd?: string; title?: string },
  ): Promise<unknown> | unknown;
  setTitle?(extensionId: string, conversationId: string, title: string): Promise<unknown> | unknown;
  delete?(extensionId: string, input: { conversationIds: string[] }): Promise<unknown> | unknown;
  rollback?(extensionId: string, conversationId: string, count: number): Promise<unknown> | unknown;
  prune?(
    extensionId: string,
    input: { olderThanMs: number; archivedOnly?: boolean | null; dryRun?: boolean | null },
  ): Promise<unknown> | unknown;
  metadata: {
    get(extensionId: string, input: { conversationId: string; namespace?: string; runtimeScope?: string }): Promise<unknown> | unknown;
    set(
      extensionId: string,
      input: { conversationId: string; namespace?: string; values: Record<string, unknown>; runtimeScope?: string },
    ): Promise<unknown> | unknown;
    query(
      extensionId: string,
      input: {
        namespace?: string;
        where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
        limit?: number;
        runtimeScope?: string;
      },
    ): Promise<unknown> | unknown;
  };
}

interface ExtensionBackendCapabilityExtensions {
  invokeAction(input: { extensionId: string; actionId: string; input?: unknown; signal?: AbortSignal }): unknown;
  listActions(): unknown;
  listPromptAssemblyContributions(): unknown;
  listStaticContributions(): unknown;
  getStatus(extensionId: string): unknown;
  setEnabled(extensionId: string, enabled: boolean): unknown;
  setPermissionGranted(extensionId: string, permission: ExtensionPermission, granted: boolean): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityCommands {
  list(): Promise<unknown[]> | unknown[];
  execute(extensionId: string, commandId: string, args?: unknown): Promise<boolean> | boolean;
}

function isHostCommandAction(action: string): boolean {
  return isKnownHostCommand(action);
}

interface ExtensionBackendCapabilityModels {
  list(context?: ExtensionBackendModelWriteContext): Promise<unknown> | unknown;
  saveProvider?(input: unknown, context?: ExtensionBackendModelWriteContext): Promise<unknown> | unknown;
  saveProviderModel?(input: unknown, context?: ExtensionBackendModelWriteContext): Promise<unknown> | unknown;
  deleteProvider?(provider: string, context?: ExtensionBackendModelWriteContext): Promise<unknown> | unknown;
  deleteProviderModel?(
    input: { provider: string; modelId: string },
    context?: ExtensionBackendModelWriteContext,
  ): Promise<unknown> | unknown;
}

interface ExtensionBackendModelWriteContext {
  runtimeScope?: string;
  repoRoot?: string;
  runtimeDir?: string;
  runtimeSettingsFilePath?: string;
  authFile?: string;
  stateRoot?: string;
}

interface ExtensionBackendCapabilityNotify {
  toast(extensionId: string, message: string, type: 'info' | 'warning' | 'error'): unknown;
  system(
    extensionId: string,
    input: {
      message: string;
      title?: string;
      subtitle?: string;
      persistent?: boolean;
      actionPayload?: unknown;
    },
  ): unknown;
  setBadge(extensionId: string, count: number): unknown;
  clearBadge(extensionId: string): unknown;
  isSystemAvailable(): unknown;
}

interface ExtensionBackendCapabilityStorage {
  get(extensionId: string, key: string): unknown;
  put(extensionId: string, key: string, value: unknown, options?: { expectedVersion?: number }): unknown;
  delete(extensionId: string, key: string): unknown;
  list(extensionId: string, prefix?: string): unknown;
}

interface ExtensionBackendCapabilityTelemetryEvent {
  source?: ExtensionTelemetrySource;
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
}

interface ExtensionBackendCapabilityTelemetry {
  record(extensionId: string, event: ExtensionBackendCapabilityTelemetryEvent): unknown;
  readTrace(input: { since: string; limit: number }): unknown;
  queryApp(input: { since: string; limit: number }): unknown;
}

interface ExtensionBackendShellSpawnHandle {
  pid: number | null;
  usingPty: boolean;
  executionWrappers: Array<{ id: string; label?: string }>;
  kill: () => void | Promise<void>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
}

interface ExtensionBackendShellSpawnRecord {
  handle: ExtensionBackendShellSpawnHandle;
  workerRequestId?: number;
  conversationId?: string;
  sessionId?: string;
}

interface ExtensionBackendCapabilityShell {
  exec(input: {
    command: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxBuffer?: number;
    env?: Record<string, string>;
  }): Promise<unknown> | unknown;
  spawn?(input: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    pty?: boolean | { cols?: number; rows?: number };
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void;
  }): Promise<ExtensionBackendShellSpawnHandle> | ExtensionBackendShellSpawnHandle;
}

interface ExtensionBackendCapabilitySecrets {
  get(extensionId: string, secretId: string): string | undefined;
}

export interface ExtensionBackendCapabilityUi {
  invalidate(topics: string | string[]): unknown;
  confirm(
    extensionId: string,
    input: {
      title?: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      timeoutMs?: number;
      details?: Array<{ label: string; value: string }>;
    },
  ): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityWorkspace {
  readText(extensionId: string, input: { cwd: string; path: string; maxBytes?: number }): Promise<unknown> | unknown;
  writeText(extensionId: string, input: { cwd: string; path: string; content: string }): Promise<unknown> | unknown;
  list(extensionId: string, input: { cwd: string; path?: string; depth?: number }): Promise<unknown> | unknown;
}

type ExtensionFilesystemRootKind = 'workspace' | 'app' | 'cache' | 'temp';

interface ExtensionBackendCapabilityFilesystem {
  requestRoot(
    extensionId: string,
    input: { kind?: ExtensionFilesystemRootKind; cwd?: string; access?: FileAccess[]; reason?: string; prefix?: string },
  ): Promise<ScopedFileSystem> | ScopedFileSystem;
}

export type ExtensionBackendCapabilityEventEmitter = (event: ExtensionBackendWorkerCapabilityEvent) => void;

export type ExtensionBackendCapabilityDispatcher = (
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: ExtensionBackendCapabilityEventEmitter,
) => Promise<unknown> | unknown;

const shellSpawnHandleMaps = new Set<Map<string, ExtensionBackendShellSpawnRecord>>();

function contextString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

function shellSpawnRecordOwner(
  context: ExtensionBackendWorkerCapabilityRequest['context'] | undefined,
): Pick<ExtensionBackendShellSpawnRecord, 'conversationId' | 'sessionId' | 'workerRequestId'> {
  return {
    ...(typeof context?.workerRequestId === 'number' ? { workerRequestId: context.workerRequestId } : {}),
    ...((contextString(context?.agentToolContext, 'conversationId') ?? contextString(context?.toolContext, 'conversationId'))
      ? {
          conversationId:
            contextString(context?.agentToolContext, 'conversationId') ?? contextString(context?.toolContext, 'conversationId'),
        }
      : {}),
    ...((contextString(context?.agentToolContext, 'sessionId') ?? contextString(context?.toolContext, 'sessionId'))
      ? { sessionId: contextString(context?.agentToolContext, 'sessionId') ?? contextString(context?.toolContext, 'sessionId') }
      : {}),
  };
}

async function stopShellSpawnRecord(record: ExtensionBackendShellSpawnRecord): Promise<void> {
  try {
    await record.handle.kill();
  } catch {
    // The process may already have exited.
  }
}

export async function abortExtensionShellSpawnHandlesForConversation(conversationId: string): Promise<{ ok: true; killed: number }> {
  const ownerId = conversationId.trim();
  if (!ownerId) return { ok: true, killed: 0 };
  let killed = 0;
  const stopTasks: Array<Promise<void>> = [];

  const stopMatchingRecords = (matches: (record: ExtensionBackendShellSpawnRecord) => boolean) => {
    for (const shellSpawnHandles of shellSpawnHandleMaps) {
      for (const [key, record] of shellSpawnHandles) {
        if (!matches(record)) continue;
        shellSpawnHandles.delete(key);
        killed += 1;
        stopTasks.push(stopShellSpawnRecord(record));
      }
    }
  };

  stopMatchingRecords((record) => record.conversationId === ownerId || record.sessionId === ownerId);
  if (killed === 0) {
    stopMatchingRecords((record) => !record.conversationId && !record.sessionId);
  }
  if (killed === 0) {
    killed += terminateSpawnedExtensionProcesses();
  }

  await Promise.all(stopTasks);
  return { ok: true, killed };
}

export interface ExtensionBackendCapabilityDispatcherOptions {
  automations?: ExtensionBackendCapabilityAutomations;
  commands?: ExtensionBackendCapabilityCommands;
  conversations?: ExtensionBackendCapabilityConversations;
  documents?: ExtensionBackendCapabilityDocuments;
  events?: ExtensionBackendCapabilityEvents;
  extensions?: ExtensionBackendCapabilityExtensions;
  filesystem?: ExtensionBackendCapabilityFilesystem;
  git?: ExtensionBackendCapabilityGit;
  image?: ExtensionBackendCapabilityImage;
  video?: ExtensionBackendCapabilityVideo;
  log?: ExtensionBackendCapabilityLogger;
  models?: ExtensionBackendCapabilityModels;
  notify?: ExtensionBackendCapabilityNotify;
  runtime?: ExtensionBackendCapabilityRuntime;
  secrets?: ExtensionBackendCapabilitySecrets;
  settings?: ExtensionBackendCapabilitySettings;
  shell?: ExtensionBackendCapabilityShell;
  storage?: ExtensionBackendCapabilityStorage;
  telemetry?: ExtensionBackendCapabilityTelemetry;
  ui?: ExtensionBackendCapabilityUi;
  workspace?: ExtensionBackendCapabilityWorkspace;
}

function listEnabledExtensionBinDirs(): string[] {
  return listExtensionInstallSummaries()
    .filter((summary) => summary.status === 'enabled' && summary.packageRoot)
    .map((summary) => join(summary.packageRoot!, 'bin'));
}

function normalizeLogInput(input: unknown): { message: string; fields?: Record<string, unknown> } {
  if (!input || typeof input !== 'object') {
    throw new Error('Log capability input must be an object.');
  }
  const candidate = input as { message?: unknown; fields?: unknown };
  if (typeof candidate.message !== 'string') {
    throw new Error('Log capability input must include a string message.');
  }
  if (candidate.fields !== undefined && (!candidate.fields || typeof candidate.fields !== 'object' || Array.isArray(candidate.fields))) {
    throw new Error('Log capability fields must be an object when provided.');
  }
  return {
    message: candidate.message,
    ...(candidate.fields ? { fields: candidate.fields as Record<string, unknown> } : {}),
  };
}

function permissionForReadWriteOperation(
  readPermission: ExtensionPermission,
  writePermission: ExtensionPermission,
  readwritePermission: ExtensionPermission,
  operation: string,
  writeOperations: string[],
): ExtensionPermission[] {
  return writeOperations.includes(operation) ? [writePermission, readwritePermission] : [readPermission, readwritePermission];
}

function extensionBackendCapabilityPermissions(request: ExtensionBackendWorkerCapabilityRequest): ExtensionPermission[] {
  if (request.capability === 'shell') {
    return ['shell:execute'];
  }

  if (request.capability === 'terminal') {
    return ['shell:execute'];
  }

  if (request.capability === 'storage') {
    return permissionForReadWriteOperation('storage:read', 'storage:write', 'storage:readwrite', request.operation, ['put', 'delete']);
  }

  if (request.capability === 'settings') {
    return permissionForReadWriteOperation('settings:read', 'settings:write', 'settings:readwrite', request.operation, ['update', 'reset']);
  }

  if (request.capability === 'commands') {
    return request.operation === 'execute' ? ['commands:execute'] : ['commands:read'];
  }

  if (request.capability === 'events') {
    return permissionForReadWriteOperation('automations:read', 'automations:write', 'automations:readwrite', request.operation, [
      'emit',
      'delay',
      'replay',
      'saveSubscription',
      'deleteSubscription',
      'cancelDelayed',
      'prune',
      'processDue',
    ]);
  }

  if (request.capability === 'automations') {
    const readOperations = new Set([
      'loadScheduledTasksForProfile',
      'resolveScheduledTaskForProfile',
      'validateScheduledTaskDefinition',
      'resolveScheduledTaskThreadBinding',
      'buildScheduledTaskThreadDetail',
      'listStoredAutomations',
      'loadAutomationRuntimeStateMap',
      'getTaskCallbackBinding',
    ]);
    const writeOperations = new Set([
      'applyScheduledTaskThreadBinding',
      'createStoredAutomation',
      'updateStoredAutomation',
      'deleteStoredAutomation',
      'setTaskCallbackBinding',
      'clearTaskCallbackBinding',
    ]);
    if (request.operation === 'startScheduledTaskRun') return ['automations:run'];
    if (writeOperations.has(request.operation)) return ['automations:write', 'automations:readwrite'];
    if (readOperations.has(request.operation)) return ['automations:read', 'automations:readwrite'];
    return [];
  }

  if (request.capability === 'extensions') {
    return request.operation === 'setEnabled' || request.operation === 'setPermissionGranted' ? ['extensions:write'] : ['extensions:read'];
  }

  if (request.capability === 'browser') {
    return request.operation === 'cdp' ? ['browser:control'] : ['browser:read'];
  }

  if (request.capability === 'desktop') {
    return ['desktop:control'];
  }

  if (request.capability === 'documents') {
    return permissionForReadWriteOperation('documents:read', 'documents:write', 'documents:readwrite', request.operation, [
      'upsertCollection',
      'putDocument',
      'deleteDocument',
    ]);
  }

  if (request.capability === 'conversations') {
    return permissionForReadWriteOperation('conversations:read', 'conversations:write', 'conversations:readwrite', request.operation, [
      'activity',
      'create',
      'setActiveTools',
      'appendCustomEntry',
      'appendTranscriptBlock',
      'updateTranscriptBlock',
      'updateWorkspace',
      'rollback',
      'ensureLive',
      'sendMessage',
      'startParallelPrompt',
      'manageParallelJob',
      'createSpeculativeWorkspace',
      'applySpeculativeWorkspace',
      'disposeSpeculativeWorkspace',
      'runTurn',
      'abort',
      'compact',
      'fork',
      'setTitle',
      'delete',
      'prune',
      'metadata.set',
    ]);
  }

  if (request.capability === 'workspace') {
    return permissionForReadWriteOperation('workspace:read', 'workspace:write', 'workspace:readwrite', request.operation, ['writeText']);
  }

  if (request.capability === 'filesystem') {
    if (request.operation === 'requestRoot') {
      const input =
        request.input && typeof request.input === 'object' && !Array.isArray(request.input)
          ? (request.input as Record<string, unknown>)
          : {};
      const access = Array.isArray(input.access) ? input.access : [];
      return access.includes('write') ? ['filesystem:write', 'filesystem:readwrite'] : ['filesystem:read', 'filesystem:readwrite'];
    }
    return permissionForReadWriteOperation('filesystem:read', 'filesystem:write', 'filesystem:readwrite', request.operation, [
      'writeBytes',
      'writeText',
      'writeJson',
      'createDirectory',
      'move',
      'copyIn',
      'remove',
      'createTempWorkspace',
    ]);
  }

  if (request.capability === 'git') {
    return ['git:read'];
  }

  if (request.capability === 'notify') {
    return ['ui:notify'];
  }

  if (request.capability === 'secrets') {
    return ['secrets:read'];
  }

  if (request.capability === 'telemetry') {
    return request.operation === 'record' ? ['telemetry:write'] : ['telemetry:read'];
  }

  if (request.capability === 'ui') {
    return request.operation === 'confirm' ? ['ui:confirm'] : ['ui:invalidate'];
  }

  if (request.capability === 'models') {
    return permissionForReadWriteOperation('models:read', 'models:write', 'models:readwrite', request.operation, [
      'saveProvider',
      'saveProviderModel',
      'deleteProvider',
      'deleteProviderModel',
    ]);
  }

  if (request.capability === 'image') {
    return request.operation === 'generate' ? ['images:write'] : [];
  }

  if (request.capability === 'video') {
    return ['videos:read'];
  }

  if (request.capability === 'runtime') {
    return request.operation === 'refreshSkillMcpConfig' ? ['mcp:write'] : [];
  }

  return [];
}

function assertExtensionBackendCapabilityPermission(request: ExtensionBackendWorkerCapabilityRequest): void {
  const permissions = extensionBackendCapabilityPermissions(request);
  if (permissions.length === 0) return;
  assertExtensionAnyPermission(request.extensionId, permissions, `${request.capability}.${request.operation}`);
}

function dispatchLogCapability(logger: ExtensionBackendCapabilityLogger, request: ExtensionBackendWorkerCapabilityRequest): undefined {
  if (request.operation !== 'info' && request.operation !== 'warn' && request.operation !== 'error') {
    throw new Error(`Unsupported log capability operation: ${request.operation}`);
  }
  const level = request.operation as ExtensionLogLevel;
  const { message, fields } = normalizeLogInput(request.input);
  logger[level](`extension:${request.extensionId} ${message}`, fields);
  return undefined;
}

function automationCapabilityArgs(input: unknown): unknown[] {
  const record = normalizeRecordInput(input, 'Automations');
  if (!Array.isArray(record.args)) {
    throw new Error('Automations capability input must include args.');
  }
  return record.args;
}

function createDefaultAutomationsCapability(): ExtensionBackendCapabilityAutomations {
  const moduleOperations: Record<string, { specifier: string; name: string }> = {
    loadScheduledTasksForProfile: { specifier: '../../automation/scheduledTasks.js', name: 'loadScheduledTasksForProfile' },
    resolveScheduledTaskForProfile: { specifier: '../../automation/scheduledTasks.js', name: 'resolveScheduledTaskForProfile' },
    validateScheduledTaskDefinition: { specifier: '../../automation/scheduledTasks.js', name: 'validateScheduledTaskDefinition' },
    resolveScheduledTaskThreadBinding: { specifier: '../../automation/scheduledTaskThreads.js', name: 'resolveScheduledTaskThreadBinding' },
    applyScheduledTaskThreadBinding: { specifier: '../../automation/scheduledTaskThreads.js', name: 'applyScheduledTaskThreadBinding' },
    buildScheduledTaskThreadDetail: { specifier: '../../automation/scheduledTaskThreads.js', name: 'buildScheduledTaskThreadDetail' },
    createStoredAutomation: { specifier: '../../automation/store.js', name: 'createStoredAutomation' },
    updateStoredAutomation: { specifier: '../../automation/store.js', name: 'updateStoredAutomation' },
    deleteStoredAutomation: { specifier: '../../automation/store.js', name: 'deleteStoredAutomation' },
    listStoredAutomations: { specifier: '../../automation/store.js', name: 'listStoredAutomations' },
    loadAutomationRuntimeStateMap: { specifier: '../../automation/store.js', name: 'loadAutomationRuntimeStateMap' },
    getTaskCallbackBinding: { specifier: '@neon-pilot/core', name: 'getTaskCallbackBinding' },
    setTaskCallbackBinding: { specifier: '@neon-pilot/core', name: 'setTaskCallbackBinding' },
    clearTaskCallbackBinding: { specifier: '@neon-pilot/core', name: 'clearTaskCallbackBinding' },
  };

  return {
    async call(operation, input) {
      const args = automationCapabilityArgs(input);
      if (operation === 'startScheduledTaskRun') {
        return callDaemonExport('startScheduledTaskRun', ...args);
      }
      const target = moduleOperations[operation];
      if (!target) {
        throw new Error(`Unsupported automations capability operation: ${operation}`);
      }
      return callServerModuleExport(target.specifier, target.name, ...args);
    },
  };
}

function dispatchAutomationsCapability(
  automations: ExtensionBackendCapabilityAutomations,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  return automations.call(request.operation, request.input);
}

function dispatchEventsCapability(events: ExtensionBackendCapabilityEvents, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation === 'publish') {
    const input = normalizeRecordInput(request.input, 'Events');
    return events.publish(request.extensionId, requireString(input.event, 'Event name'), input.payload);
  }
  if (request.operation === 'emit') {
    return events.emit(request.input);
  }
  if (request.operation === 'delay') {
    return events.delay(request.input);
  }
  if (request.operation === 'replay') {
    return events.replay(request.input);
  }
  if (request.operation === 'list') {
    return events.list(request.input);
  }
  if (request.operation === 'listSubscriptions') {
    return events.listSubscriptions(request.input);
  }
  if (request.operation === 'saveSubscription') {
    return events.saveSubscription(request.input);
  }
  if (request.operation === 'deleteSubscription') {
    return events.deleteSubscription(request.input);
  }
  if (request.operation === 'cancelDelayed') {
    return events.cancelDelayed(request.input);
  }
  if (request.operation === 'prune') {
    return events.prune(request.input);
  }
  if (request.operation === 'processDue') {
    return events.processDue(request.input);
  }
  throw new Error(`Unsupported events capability operation: ${request.operation}`);
}

function dispatchCommandsCapability(
  commands: ExtensionBackendCapabilityCommands,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  if (request.operation === 'list') {
    return commands.list();
  }
  if (request.operation === 'execute') {
    const input = normalizeRecordInput(request.input, 'Commands');
    return commands.execute(request.extensionId, requireString(input.commandId, 'Command id'), input.args);
  }
  throw new Error(`Unsupported commands capability operation: ${request.operation}`);
}

function optionalConversationMetadataWhere(
  value: unknown,
): Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('Conversation metadata where must be an array when provided.');
  }
  return value.map((item) => {
    const record = normalizeRecordInput(item, 'Conversation metadata where');
    const op = record.op;
    if (op !== undefined && op !== 'eq' && op !== 'neq' && op !== 'in' && op !== 'exists') {
      throw new Error('Conversation metadata where op must be eq, neq, in, or exists when provided.');
    }
    return {
      key: requireString(record.key, 'Conversation metadata where key'),
      ...(op === undefined ? {} : { op }),
      ...(record.value === undefined ? {} : { value: record.value }),
    };
  });
}

function dispatchConversationsCapability(
  conversations: ExtensionBackendCapabilityConversations,
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: (event: ExtensionBackendWorkerCapabilityEvent) => void,
): unknown {
  const input = normalizeRecordInput(request.input, 'Conversations');

  if (request.operation === 'list') {
    if (!conversations.list) {
      throw new Error('Conversation list capability is unavailable.');
    }
    return conversations.list(request.extensionId, {
      ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation runtime scope') } : {}),
      ...(input.runtimeSettingsFilePath !== undefined
        ? { runtimeSettingsFilePath: optionalString(input.runtimeSettingsFilePath, 'Conversation runtime settings file path') }
        : {}),
    });
  }

  if (request.operation === 'activity') {
    if (!conversations.activity) {
      throw new Error('Conversation activity capability is unavailable.');
    }
    const visibility = input.visibility !== undefined ? optionalString(input.visibility, 'Conversation activity visibility') : undefined;
    if (visibility !== undefined && !['primary', 'system', 'hidden', 'visible', 'all'].includes(visibility)) {
      throw new Error('Conversation activity visibility must be one of: primary, system, hidden, visible, all.');
    }
    return conversations.activity(request.extensionId, requireString(input.conversationId, 'Conversation id'), {
      ...(input.active !== undefined ? { active: optionalBoolean(input.active, 'Conversation activity active') } : {}),
      ...(visibility !== undefined ? { visibility: visibility as 'primary' | 'system' | 'hidden' | 'visible' | 'all' } : {}),
    });
  }

  if (request.operation === 'connections') {
    if (!conversations.connections) {
      throw new Error('Conversation connections capability is unavailable.');
    }
    const visibility = input.visibility !== undefined ? optionalString(input.visibility, 'Conversation connections visibility') : undefined;
    if (visibility !== undefined && !['primary', 'system', 'hidden', 'visible', 'all'].includes(visibility)) {
      throw new Error('Conversation connections visibility must be one of: primary, system, hidden, visible, all.');
    }
    const kind = input.kind !== undefined ? optionalString(input.kind, 'Conversation connection kind') : undefined;
    if (kind !== undefined && !['activity', 'state', 'asset', 'context', 'integration', 'surface', 'all'].includes(kind)) {
      throw new Error('Conversation connection kind must be one of: activity, state, asset, context, integration, surface, all.');
    }
    const surface = input.surface !== undefined ? optionalString(input.surface, 'Conversation connection surface') : undefined;
    if (surface !== undefined && !['activityShelf', 'composerShelf', 'rightRail', 'workbench', 'sidebar', 'cli', 'all'].includes(surface)) {
      throw new Error(
        'Conversation connection surface must be one of: activityShelf, composerShelf, rightRail, workbench, sidebar, cli, all.',
      );
    }
    return conversations.connections(request.extensionId, requireString(input.conversationId, 'Conversation id'), {
      ...(input.active !== undefined ? { active: optionalBoolean(input.active, 'Conversation connections active') } : {}),
      ...(kind !== undefined ? { kind: kind as 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface' | 'all' } : {}),
      ...(surface !== undefined
        ? { surface: surface as 'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli' | 'all' }
        : {}),
      ...(visibility !== undefined ? { visibility: visibility as 'primary' | 'system' | 'hidden' | 'visible' | 'all' } : {}),
    });
  }

  if (request.operation === 'get') {
    return conversations.get(request.extensionId, requireString(input.conversationId, 'Conversation id'));
  }

  if (request.operation === 'getMeta') {
    if (!conversations.getMeta) {
      throw new Error('Conversation getMeta capability is unavailable.');
    }
    return conversations.getMeta(request.extensionId, requireString(input.conversationId, 'Conversation id'));
  }

  if (request.operation === 'getBlocks') {
    if (!conversations.getBlocks) {
      throw new Error('Conversation getBlocks capability is unavailable.');
    }
    return conversations.getBlocks(request.extensionId, requireString(input.conversationId, 'Conversation id'), {
      ...(input.tailBlocks !== undefined ? { tailBlocks: optionalNumber(input.tailBlocks, 'Conversation tailBlocks') } : {}),
    });
  }

  if (request.operation === 'create') {
    if (!conversations.create) {
      throw new Error('Conversation create capability is unavailable.');
    }
    return conversations.create(request.extensionId, {
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation cwd') } : {}),
      ...(input.live !== undefined ? { live: optionalBoolean(input.live, 'Conversation live') } : {}),
      ...(input.title !== undefined ? { title: optionalString(input.title, 'Conversation title') } : {}),
      ...(input.prompt !== undefined ? { prompt: optionalString(input.prompt, 'Conversation prompt') } : {}),
      ...(input.initialPrompt !== undefined ? { initialPrompt: optionalString(input.initialPrompt, 'Conversation initialPrompt') } : {}),
      ...(input.model === null
        ? { model: null }
        : input.model !== undefined
          ? { model: optionalString(input.model, 'Conversation model') }
          : {}),
      ...(input.thinkingLevel === null
        ? { thinkingLevel: null }
        : input.thinkingLevel !== undefined
          ? { thinkingLevel: optionalString(input.thinkingLevel, 'Conversation thinkingLevel') }
          : {}),
      ...(input.serviceTier === null
        ? { serviceTier: null }
        : input.serviceTier !== undefined
          ? { serviceTier: optionalString(input.serviceTier, 'Conversation serviceTier') }
          : {}),
      ...(input.allowedToolNames !== undefined
        ? { allowedToolNames: optionalStringArray(input.allowedToolNames, 'Conversation allowed tool names') }
        : {}),
    });
  }

  if (request.operation === 'setActiveTools') {
    return conversations.setActiveTools(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireStringArray(input.toolNames, 'Conversation tool names'),
    );
  }

  if (request.operation === 'appendCustomEntry') {
    return conversations.appendCustomEntry(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireString(input.customType, 'Conversation custom type'),
      input.data,
    );
  }

  if (request.operation === 'appendTranscriptBlock') {
    if (!conversations.appendTranscriptBlock) {
      throw new Error('Conversation appendTranscriptBlock capability is unavailable.');
    }
    return conversations.appendTranscriptBlock(request.extensionId, {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      blockType: requireString(input.blockType, 'Conversation transcript block type'),
      data: input.data,
      ...(input.title !== undefined ? { title: optionalString(input.title, 'Conversation transcript title') } : {}),
      ...(input.blockId !== undefined ? { blockId: optionalString(input.blockId, 'Conversation transcript block id') } : {}),
    });
  }

  if (request.operation === 'updateTranscriptBlock') {
    if (!conversations.updateTranscriptBlock) {
      throw new Error('Conversation updateTranscriptBlock capability is unavailable.');
    }
    return conversations.updateTranscriptBlock(request.extensionId, {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      blockType: requireString(input.blockType, 'Conversation transcript block type'),
      blockId: requireString(input.blockId, 'Conversation transcript block id'),
      data: input.data,
      ...(input.title !== undefined ? { title: optionalString(input.title, 'Conversation transcript title') } : {}),
    });
  }

  if (request.operation === 'getWorkspace') {
    if (!conversations.getWorkspace) {
      throw new Error('Conversation getWorkspace capability is unavailable.');
    }
    return conversations.getWorkspace(request.extensionId, {
      ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation runtime scope') } : {}),
      ...(input.runtimeSettingsFilePath !== undefined
        ? { runtimeSettingsFilePath: optionalString(input.runtimeSettingsFilePath, 'Conversation runtime settings file path') }
        : {}),
    });
  }

  if (request.operation === 'updateWorkspace') {
    if (!conversations.updateWorkspace) {
      throw new Error('Conversation updateWorkspace capability is unavailable.');
    }
    return conversations.updateWorkspace(request.extensionId, {
      ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation runtime scope') } : {}),
      ...(input.runtimeSettingsFilePath !== undefined
        ? { runtimeSettingsFilePath: optionalString(input.runtimeSettingsFilePath, 'Conversation runtime settings file path') }
        : {}),
      ...(input.openConversationIds !== undefined
        ? { openConversationIds: optionalNullableStringArray(input.openConversationIds, 'Conversation workspace open ids') }
        : {}),
      ...(input.pinnedConversationIds !== undefined
        ? { pinnedConversationIds: optionalNullableStringArray(input.pinnedConversationIds, 'Conversation workspace pinned ids') }
        : {}),
      ...(input.archivedConversationIds !== undefined
        ? { archivedConversationIds: optionalNullableStringArray(input.archivedConversationIds, 'Conversation workspace archived ids') }
        : {}),
      ...(input.activeConversationId !== undefined
        ? { activeConversationId: optionalNullableString(input.activeConversationId, 'Conversation workspace active id') }
        : {}),
      ...(input.workspacePaths !== undefined
        ? { workspacePaths: optionalNullableStringArray(input.workspacePaths, 'Conversation workspace paths') }
        : {}),
      ...(input.remoteControlledConversationIds !== undefined
        ? {
            remoteControlledConversationIds: optionalNullableStringArray(
              input.remoteControlledConversationIds,
              'Conversation workspace remote-controlled ids',
            ),
          }
        : {}),
    });
  }

  if (request.operation === 'rollback') {
    if (!conversations.rollback) {
      throw new Error('Conversation rollback capability is unavailable.');
    }
    return conversations.rollback(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireNumber(input.count, 'Conversation rollback count'),
    );
  }

  if (request.operation === 'ensureLive') {
    if (!conversations.ensureLive) {
      throw new Error('Conversation ensureLive capability is unavailable.');
    }
    return conversations.ensureLive(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation cwd') } : undefined,
    );
  }

  if (request.operation === 'requestWorkingDirectoryChange') {
    if (!conversations.requestWorkingDirectoryChange) {
      throw new Error('Conversation working directory change capability is unavailable.');
    }
    return conversations.requestWorkingDirectoryChange(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireString(input.cwd, 'Conversation cwd'),
      input.continuePrompt !== undefined
        ? { continuePrompt: optionalString(input.continuePrompt, 'Conversation continue prompt') }
        : undefined,
    );
  }

  if (request.operation === 'sendMessage') {
    if (!conversations.sendMessage) {
      throw new Error('Conversation sendMessage capability is unavailable.');
    }
    return conversations.sendMessage(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireString(input.text, 'Conversation message text'),
      normalizeConversationSendOptions(input),
    );
  }

  if (request.operation === 'startParallelPrompt') {
    if (!conversations.startParallelPrompt) {
      throw new Error('Conversation startParallelPrompt capability is unavailable.');
    }
    const metadata = input.metadata !== undefined ? optionalRecord(input.metadata, 'Conversation parallel prompt metadata') : undefined;
    return conversations.startParallelPrompt(request.extensionId, requireString(input.conversationId, 'Conversation id'), {
      text: requireString(input.text, 'Conversation parallel prompt text'),
      ...normalizeConversationSendOptions(input),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation parallel prompt cwd') } : {}),
      ...(input.model === null
        ? { model: null }
        : input.model !== undefined
          ? { model: optionalString(input.model, 'Conversation parallel prompt model') }
          : {}),
      ...(input.thinkingLevel === null
        ? { thinkingLevel: null }
        : input.thinkingLevel !== undefined
          ? { thinkingLevel: optionalString(input.thinkingLevel, 'Conversation parallel prompt thinkingLevel') }
          : {}),
      ...(input.serviceTier === null
        ? { serviceTier: null }
        : input.serviceTier !== undefined
          ? { serviceTier: optionalString(input.serviceTier, 'Conversation parallel prompt serviceTier') }
          : {}),
      ...(input.purpose !== undefined ? { purpose: optionalString(input.purpose, 'Conversation parallel prompt purpose') } : {}),
      ...(metadata ? { metadata } : {}),
      ...(input.autoImport !== undefined
        ? { autoImport: optionalBoolean(input.autoImport, 'Conversation parallel prompt autoImport') }
        : {}),
    });
  }

  if (request.operation === 'manageParallelJob') {
    if (!conversations.manageParallelJob) {
      throw new Error('Conversation manageParallelJob capability is unavailable.');
    }
    const action = requireString(input.action, 'Conversation parallel job action');
    if (action !== 'importNow' && action !== 'skip' && action !== 'cancel') {
      throw new Error('Conversation parallel job action must be importNow, skip, or cancel.');
    }
    return conversations.manageParallelJob(request.extensionId, {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      jobId: requireString(input.jobId, 'Conversation parallel job id'),
      action,
    });
  }

  if (request.operation === 'runTurn') {
    if (!conversations.runTurn) {
      throw new Error('Conversation runTurn capability is unavailable.');
    }
    const textDeltas: string[] = [];
    let finalText = '';
    const eventHandleId = typeof input.runTurnEventHandleId === 'string' ? input.runTurnEventHandleId : '';
    return Promise.resolve(
      conversations.runTurn(
        request.extensionId,
        requireString(input.conversationId, 'Conversation id'),
        requireString(input.text, 'Conversation message text'),
        {
          ...normalizeConversationSendOptions(input),
          ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation cwd') } : {}),
          ...(input.timeoutMs !== undefined ? { timeoutMs: requireNumber(input.timeoutMs, 'Conversation runTurn timeoutMs') } : {}),
          onEvent(event: unknown) {
            if (eventHandleId) {
              emit?.({
                kind: 'capabilityEvent',
                extensionId: request.extensionId,
                capability: 'conversations',
                operation: 'runTurnEvent',
                input: { handleId: eventHandleId, event },
              });
            }
            const record = typeof event === 'object' && event !== null ? (event as Record<string, unknown>) : undefined;
            if (!record) return;
            if (record.type === 'text_delta' && typeof record.delta === 'string') {
              textDeltas.push(record.delta);
              return;
            }
            if (record.type === 'agent_end' && typeof record.text === 'string') {
              finalText = record.text;
              return;
            }
            const assistantMessageEvent =
              record.type === 'message_update' && typeof record.assistantMessageEvent === 'object' && record.assistantMessageEvent !== null
                ? (record.assistantMessageEvent as Record<string, unknown>)
                : undefined;
            if (assistantMessageEvent?.type === 'text_delta' && typeof assistantMessageEvent.delta === 'string') {
              textDeltas.push(assistantMessageEvent.delta);
            }
          },
        },
      ),
    ).then((result) => ({
      ...(typeof result === 'object' && result !== null ? result : { accepted: true }),
      text: textDeltas.join('') || finalText,
    }));
  }

  if (request.operation === 'startParallelPrompt') {
    if (!conversations.startParallelPrompt) {
      throw new Error('Conversation startParallelPrompt capability is unavailable.');
    }
    return conversations.startParallelPrompt(request.extensionId, requireString(input.conversationId, 'Conversation id'), {
      text: requireString(input.text, 'Parallel prompt text'),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Parallel prompt cwd') } : {}),
      ...(input.images !== undefined ? { images: input.images as Array<{ data: string; mimeType: string; name?: string }> } : {}),
      ...(input.videos !== undefined
        ? { videos: input.videos as Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }> }
        : {}),
      ...(input.attachmentRefs !== undefined ? { attachmentRefs: input.attachmentRefs } : {}),
      ...(input.contextMessages !== undefined ? { contextMessages: input.contextMessages } : {}),
      ...(input.relatedConversationIds !== undefined ? { relatedConversationIds: input.relatedConversationIds } : {}),
      ...(input.surfaceId !== undefined ? { surfaceId: optionalString(input.surfaceId, 'Parallel prompt surface id') } : {}),
      ...(input.model === null
        ? { model: null }
        : input.model !== undefined
          ? { model: optionalString(input.model, 'Parallel prompt model') }
          : {}),
      ...(input.thinkingLevel === null
        ? { thinkingLevel: null }
        : input.thinkingLevel !== undefined
          ? { thinkingLevel: optionalString(input.thinkingLevel, 'Parallel prompt thinking level') }
          : {}),
      ...(input.serviceTier === null
        ? { serviceTier: null }
        : input.serviceTier !== undefined
          ? { serviceTier: optionalString(input.serviceTier, 'Parallel prompt service tier') }
          : {}),
      ...(input.purpose !== undefined ? { purpose: optionalString(input.purpose, 'Parallel prompt purpose') } : {}),
      ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? { metadata: input.metadata as Record<string, unknown> }
        : {}),
    });
  }

  if (request.operation === 'manageParallelJob') {
    if (!conversations.manageParallelJob) {
      throw new Error('Conversation manageParallelJob capability is unavailable.');
    }
    const action = requireString(input.action, 'Parallel prompt action');
    if (action !== 'importNow' && action !== 'skip' && action !== 'cancel') {
      throw new Error('Parallel prompt action must be importNow, skip, or cancel.');
    }
    return conversations.manageParallelJob(request.extensionId, {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      jobId: requireString(input.jobId, 'Parallel prompt job id'),
      action,
    });
  }

  if (request.operation === 'createSpeculativeWorkspace') {
    if (!conversations.createSpeculativeWorkspace) {
      throw new Error('Conversation createSpeculativeWorkspace capability is unavailable.');
    }
    return conversations.createSpeculativeWorkspace(request.extensionId, requireString(input.conversationId, 'Conversation id'));
  }

  if (request.operation === 'applySpeculativeWorkspace') {
    if (!conversations.applySpeculativeWorkspace) {
      throw new Error('Conversation applySpeculativeWorkspace capability is unavailable.');
    }
    return conversations.applySpeculativeWorkspace(request.extensionId, {
      id: requireString(input.id, 'Speculative workspace id'),
      ...(input.sourcePath !== undefined ? { sourcePath: requireString(input.sourcePath, 'Speculative workspace source path') } : {}),
      ...(input.rootPath !== undefined ? { rootPath: requireString(input.rootPath, 'Speculative workspace root path') } : {}),
      ...(input.paths !== undefined
        ? { paths: Array.isArray(input.paths) ? input.paths.map((path) => requireString(path, 'Speculative workspace path')) : [] }
        : {}),
    });
  }

  if (request.operation === 'disposeSpeculativeWorkspace') {
    if (!conversations.disposeSpeculativeWorkspace) {
      throw new Error('Conversation disposeSpeculativeWorkspace capability is unavailable.');
    }
    return conversations.disposeSpeculativeWorkspace(request.extensionId, {
      id: requireString(input.id, 'Speculative workspace id'),
      ...(input.rootPath !== undefined ? { rootPath: requireString(input.rootPath, 'Speculative workspace root path') } : {}),
    });
  }

  if (request.operation === 'abort') {
    if (!conversations.abort) {
      throw new Error('Conversation abort capability is unavailable.');
    }
    return conversations.abort(request.extensionId, requireString(input.conversationId, 'Conversation id'));
  }

  if (request.operation === 'compact') {
    if (!conversations.compact) {
      throw new Error('Conversation compact capability is unavailable.');
    }
    return conversations.compact(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      input.customInstructions !== undefined
        ? optionalString(input.customInstructions, 'Conversation compact custom instructions')
        : undefined,
    );
  }

  if (request.operation === 'fork') {
    if (!conversations.fork) {
      throw new Error('Conversation fork capability is unavailable.');
    }
    return conversations.fork(request.extensionId, {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      ...(input.atBlockId !== undefined ? { atBlockId: optionalString(input.atBlockId, 'Conversation fork block id') } : {}),
      ...(input.beforeEntry !== undefined ? { beforeEntry: optionalBoolean(input.beforeEntry, 'Conversation fork beforeEntry') } : {}),
      ...(input.targetCwd !== undefined ? { targetCwd: optionalString(input.targetCwd, 'Conversation fork target cwd') } : {}),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation fork cwd') } : {}),
      ...(input.title !== undefined ? { title: optionalString(input.title, 'Conversation fork title') } : {}),
      ...(input.model === null
        ? { model: null }
        : input.model !== undefined
          ? { model: optionalString(input.model, 'Conversation fork model') }
          : {}),
      ...(input.thinkingLevel === null
        ? { thinkingLevel: null }
        : input.thinkingLevel !== undefined
          ? { thinkingLevel: optionalString(input.thinkingLevel, 'Conversation fork thinking level') }
          : {}),
      ...(input.serviceTier === null
        ? { serviceTier: null }
        : input.serviceTier !== undefined
          ? { serviceTier: optionalString(input.serviceTier, 'Conversation fork service tier') }
          : {}),
    });
  }

  if (request.operation === 'setTitle') {
    if (!conversations.setTitle) {
      throw new Error('Conversation setTitle capability is unavailable.');
    }
    return conversations.setTitle(
      request.extensionId,
      requireString(input.conversationId, 'Conversation id'),
      requireString(input.title, 'Conversation title'),
    );
  }

  if (request.operation === 'delete') {
    if (!conversations.delete) {
      throw new Error('Conversation delete capability is unavailable.');
    }
    return conversations.delete(request.extensionId, {
      conversationIds: requireStringArray(input.conversationIds, 'Conversation ids'),
      ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation runtime scope') } : {}),
      ...(input.runtimeSettingsFilePath !== undefined
        ? { runtimeSettingsFilePath: optionalString(input.runtimeSettingsFilePath, 'Conversation runtime settings file') }
        : {}),
    });
  }

  if (request.operation === 'prune') {
    if (!conversations.prune) {
      throw new Error('Conversation prune capability is unavailable.');
    }
    return conversations.prune(request.extensionId, {
      olderThanMs: requireNumber(input.olderThanMs, 'Conversation retention olderThanMs'),
      ...(input.archivedOnly !== undefined
        ? { archivedOnly: optionalBoolean(input.archivedOnly, 'Conversation retention archivedOnly') }
        : {}),
      ...(input.dryRun !== undefined ? { dryRun: optionalBoolean(input.dryRun, 'Conversation retention dryRun') } : {}),
      ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation runtime scope') } : {}),
      ...(input.runtimeSettingsFilePath !== undefined
        ? { runtimeSettingsFilePath: optionalString(input.runtimeSettingsFilePath, 'Conversation runtime settings file') }
        : {}),
    });
  }

  if (request.operation === 'metadata.get') {
    const metadataInput = {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.runtimeScope !== undefined
        ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation metadata runtimeScope') }
        : {}),
    };
    return conversations.metadata.get(request.extensionId, metadataInput);
  }

  if (request.operation === 'metadata.set') {
    const metadataInput = {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.runtimeScope !== undefined
        ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation metadata runtimeScope') }
        : {}),
    };
    const values = optionalRecord(input.values, 'Conversation metadata values');
    if (!values) throw new Error('Conversation metadata values must be an object.');
    return conversations.metadata.set(request.extensionId, { ...metadataInput, values });
  }

  if (request.operation === 'metadata.query') {
    return conversations.metadata.query(request.extensionId, {
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.runtimeScope !== undefined
        ? { runtimeScope: optionalString(input.runtimeScope, 'Conversation metadata runtimeScope') }
        : {}),
      ...(input.where !== undefined ? { where: optionalConversationMetadataWhere(input.where) } : {}),
      ...(input.limit !== undefined ? { limit: optionalNumber(input.limit, 'Conversation metadata limit') } : {}),
    });
  }

  throw new Error(`Unsupported conversations capability operation: ${request.operation}`);
}

function dispatchExtensionsCapability(
  extensions: ExtensionBackendCapabilityExtensions,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  if (request.operation === 'invokeAction') {
    const input = normalizeRecordInput(request.input, 'Extensions invoke action');
    return extensions.invokeAction({
      extensionId: requireString(input.extensionId, 'Extension id'),
      actionId: requireString(input.actionId, 'Action id'),
      ...(input.input !== undefined ? { input: input.input } : {}),
    });
  }

  if (request.operation === 'listActions') {
    return extensions.listActions();
  }

  if (request.operation === 'listPromptAssemblyContributions') {
    return extensions.listPromptAssemblyContributions();
  }

  if (request.operation === 'listStaticContributions') {
    return extensions.listStaticContributions();
  }

  const input = normalizeRecordInput(request.input, 'Extensions');

  if (request.operation === 'getStatus') {
    return extensions.getStatus(requireString(input.extensionId, 'Extension id'));
  }

  if (request.operation === 'setEnabled') {
    const enabled = input.enabled;
    if (typeof enabled !== 'boolean') {
      throw new Error('Extension enabled must be a boolean.');
    }
    return extensions.setEnabled(requireString(input.extensionId, 'Extension id'), enabled);
  }

  if (request.operation === 'setPermissionGranted') {
    const granted = input.granted;
    if (typeof granted !== 'boolean') {
      throw new Error('Extension permission granted must be a boolean.');
    }
    return extensions.setPermissionGranted(
      requireString(input.extensionId, 'Extension id'),
      requireString(input.permission, 'Extension permission') as ExtensionPermission,
      granted,
    );
  }

  throw new Error(`Unsupported extensions capability operation: ${request.operation}`);
}

function dispatchModelsCapability(models: ExtensionBackendCapabilityModels, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation === 'list') {
    return models.list(request.context);
  }

  const input = normalizeRecordInput(request.input, 'Models');
  const context = normalizeModelWriteContext(input);

  if (request.operation === 'saveProvider') {
    if (!models.saveProvider) throw new Error('Model provider write capability is unavailable.');
    return models.saveProvider(normalizeRecordInput(input.input, 'Model provider'), context);
  }

  if (request.operation === 'saveProviderModel') {
    if (!models.saveProviderModel) throw new Error('Model provider model write capability is unavailable.');
    return models.saveProviderModel(normalizeRecordInput(input.input, 'Model provider model'), context);
  }

  if (request.operation === 'deleteProvider') {
    if (!models.deleteProvider) throw new Error('Model provider delete capability is unavailable.');
    return models.deleteProvider(requireString(input.provider, 'Model provider'), context);
  }

  if (request.operation === 'deleteProviderModel') {
    if (!models.deleteProviderModel) throw new Error('Model provider model delete capability is unavailable.');
    const deleteInput = normalizeRecordInput(input.input, 'Model provider model delete');
    return models.deleteProviderModel(
      {
        provider: requireString(deleteInput.provider, 'Model provider'),
        modelId: requireString(deleteInput.modelId, 'Model id'),
      },
      context,
    );
  }

  throw new Error(`Unsupported models capability operation: ${request.operation}`);
}

function parseModelRef(modelRef: unknown): { provider: string; modelId: string } | undefined {
  if (typeof modelRef !== 'string') return undefined;
  const normalized = modelRef.trim();
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= normalized.length - 1) return undefined;
  return { provider: normalized.slice(0, slashIndex), modelId: normalized.slice(slashIndex + 1) };
}

async function generateImageWithInstalledExtension(
  extensionId: string,
  input: { input: unknown; toolContext?: { preferredVisionModel?: string; sessionFile?: string } },
): Promise<unknown> {
  const entry = findExtensionEntry(extensionId);
  const backendEntry = entry?.manifest.backend?.entry;
  if (!entry || !backendEntry) {
    throw new Error(`Extension "${extensionId}" has no backend entry for image generation.`);
  }
  const loadTarget = resolveExtensionBackendLoadTarget(entry, backendEntry);
  if (!loadTarget) {
    throw new Error(`Extension "${extensionId}" backend artifact is unavailable for image generation.`);
  }
  const module = (await import(`${pathToFileURL(loadTarget.path).href}?v=${encodeURIComponent(loadTarget.hash)}`)) as {
    generateImageForHost?: (imageInput: unknown, hostContext: unknown) => Promise<unknown>;
  };
  if (typeof module.generateImageForHost !== 'function') {
    throw new Error(`Extension "${extensionId}" does not export generateImageForHost.`);
  }

  const authFile = join(getPiAgentRuntimeDir(), 'auth.json');
  const modelRegistry = createModelRegistryForAuthFile(authFile);
  const preferred = parseModelRef(input.toolContext?.preferredVisionModel);
  const model = preferred ? modelRegistry.find(preferred.provider, preferred.modelId) : undefined;
  const sessionFile = input.toolContext?.sessionFile?.trim();
  const sessionManager = sessionFile ? SessionManager.open(sessionFile) : undefined;

  return module.generateImageForHost(input.input, {
    ...(model ? { model } : {}),
    modelRegistry,
    ...(sessionManager ? { sessionManager } : {}),
  });
}

function dispatchImageCapability(image: ExtensionBackendCapabilityImage, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'generate') {
    throw new Error(`Unsupported image capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Image');
  return image.generate(request.extensionId, {
    input: input.input,
    ...(input.toolContext && typeof input.toolContext === 'object' && !Array.isArray(input.toolContext)
      ? { toolContext: input.toolContext as { preferredVisionModel?: string; sessionFile?: string } }
      : {}),
  });
}

function dispatchVideoCapability(video: ExtensionBackendCapabilityVideo, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  const sessionId =
    contextString(request.context?.agentToolContext, 'sessionId') ?? contextString(request.context?.toolContext, 'sessionId');
  const context = sessionId ? { sessionId } : undefined;
  if (request.operation === 'extractFrame') return video.extractFrame(request.input, context);
  if (request.operation === 'sampleFrames') return video.sampleFrames(request.input, context);
  if (request.operation === 'transcribe') return video.transcribe(request.input);
  throw new Error(`Unsupported video capability operation: ${request.operation}`);
}

function normalizeModelWriteContext(input: Record<string, unknown>): ExtensionBackendModelWriteContext {
  return {
    ...(input.runtimeScope !== undefined ? { runtimeScope: optionalString(input.runtimeScope, 'Model runtime scope') } : {}),
    ...(input.repoRoot !== undefined ? { repoRoot: optionalString(input.repoRoot, 'Model repo root') } : {}),
    ...(input.authFile !== undefined ? { authFile: optionalString(input.authFile, 'Model auth file') } : {}),
    ...(input.stateRoot !== undefined ? { stateRoot: optionalString(input.stateRoot, 'Model state root') } : {}),
  };
}

function createModelsCapabilityForWriteContext(
  context?: ExtensionBackendModelWriteContext,
): ReturnType<typeof createExtensionModelsCapability> {
  const runtimeDir = context?.runtimeDir?.trim();
  const authFile = context?.authFile?.trim() || (runtimeDir ? join(runtimeDir, 'auth.json') : undefined);
  const settingsFile = context?.runtimeSettingsFilePath?.trim();
  return createExtensionModelsCapability(
    createExtensionBackendServerContextFromSnapshot({
      runtimeScope: context?.runtimeScope ?? 'shared',
      ...(context?.repoRoot ? { repoRoot: context.repoRoot } : {}),
      ...(settingsFile ? { settingsFile } : {}),
      ...(authFile ? { authFile } : {}),
      ...(context?.stateRoot ? { stateRoot: context.stateRoot } : {}),
    }) as never,
  );
}

function dispatchGitCapability(git: ExtensionBackendCapabilityGit, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  const input = normalizeRecordInput(request.input, 'Git');

  if (request.operation === 'status') {
    return git.status({ cwd: requireString(input.cwd, 'Git cwd') });
  }

  if (request.operation === 'diff') {
    const path = input.path;
    const staged = input.staged;
    if (path !== undefined && typeof path !== 'string') {
      throw new Error('Git path must be a string when provided.');
    }
    if (staged !== undefined && typeof staged !== 'boolean') {
      throw new Error('Git staged must be a boolean when provided.');
    }
    return git.diff({
      cwd: requireString(input.cwd, 'Git cwd'),
      ...(path === undefined ? {} : { path }),
      ...(staged === undefined ? {} : { staged }),
    });
  }

  if (request.operation === 'log') {
    const maxCount = input.maxCount;
    if (maxCount !== undefined && typeof maxCount !== 'number') {
      throw new Error('Git maxCount must be a number when provided.');
    }
    return git.log({ cwd: requireString(input.cwd, 'Git cwd'), ...(maxCount === undefined ? {} : { maxCount }) });
  }

  throw new Error(`Unsupported git capability operation: ${request.operation}`);
}

function normalizeNotificationType(value: unknown): 'info' | 'warning' | 'error' {
  if (value === undefined) return 'info';
  if (value === 'info' || value === 'warning' || value === 'error') return value;
  throw new Error('Notify type must be info, warning, or error when provided.');
}

function dispatchNotifyCapability(notify: ExtensionBackendCapabilityNotify, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation === 'isSystemAvailable') {
    return notify.isSystemAvailable();
  }

  if (request.operation === 'clearBadge') {
    return notify.clearBadge(request.extensionId);
  }

  const input = normalizeRecordInput(request.input, 'Notify');

  if (request.operation === 'toast') {
    return notify.toast(request.extensionId, requireString(input.message, 'Notify message'), normalizeNotificationType(input.type));
  }

  if (request.operation === 'system') {
    const message = requireString(input.message, 'Notify message');
    return notify.system(request.extensionId, {
      message,
      title: optionalString(input.title, 'Notify title'),
      subtitle: optionalString(input.subtitle, 'Notify subtitle'),
      persistent: optionalBoolean(input.persistent, 'Notify persistent'),
      actionPayload: input.actionPayload,
    });
  }

  if (request.operation === 'setBadge') {
    return notify.setBadge(request.extensionId, requireNumber(input.count, 'Notify badge count'));
  }

  throw new Error(`Unsupported notify capability operation: ${request.operation}`);
}

function normalizeRecordInput(input: unknown, capability: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${capability} capability input must be an object.`);
  }
  return input as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function dispatchStorageCapability(storage: ExtensionBackendCapabilityStorage, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  const input = normalizeRecordInput(request.input, 'Storage');

  if (request.operation === 'get') {
    return storage.get(request.extensionId, requireString(input.key, 'Storage key'));
  }

  if (request.operation === 'put') {
    const key = requireString(input.key, 'Storage key');
    const expectedVersion = input.expectedVersion;
    if (expectedVersion !== undefined && typeof expectedVersion !== 'number') {
      throw new Error('Storage expectedVersion must be a number when provided.');
    }
    return storage.put(request.extensionId, key, input.value, expectedVersion === undefined ? undefined : { expectedVersion });
  }

  if (request.operation === 'delete') {
    return storage.delete(request.extensionId, requireString(input.key, 'Storage key'));
  }

  if (request.operation === 'list') {
    const prefix = input.prefix;
    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('Storage prefix must be a string when provided.');
    }
    return storage.list(request.extensionId, prefix);
  }

  throw new Error(`Unsupported storage capability operation: ${request.operation}`);
}

function optionalTelemetrySource(value: unknown): ExtensionTelemetrySource | undefined {
  if (value === undefined) return undefined;
  if (value === 'server' || value === 'renderer' || value === 'agent' || value === 'system') return value;
  throw new Error('Telemetry source must be server, renderer, agent, or system when provided.');
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object when provided.`);
  }
  return value as Record<string, unknown>;
}

function normalizeTelemetryEvent(input: unknown): ExtensionBackendCapabilityTelemetryEvent {
  const record = normalizeRecordInput(input, 'Telemetry');
  return {
    ...(record.source === undefined ? {} : { source: optionalTelemetrySource(record.source) }),
    category: requireString(record.category, 'Telemetry category'),
    name: requireString(record.name, 'Telemetry name'),
    ...(record.sessionId === undefined ? {} : { sessionId: optionalString(record.sessionId, 'Telemetry sessionId') }),
    ...(record.runId === undefined ? {} : { runId: optionalString(record.runId, 'Telemetry runId') }),
    ...(record.route === undefined ? {} : { route: optionalString(record.route, 'Telemetry route') }),
    ...(record.status === undefined ? {} : { status: optionalNumber(record.status, 'Telemetry status') }),
    ...(record.durationMs === undefined ? {} : { durationMs: optionalNumber(record.durationMs, 'Telemetry durationMs') }),
    ...(record.count === undefined ? {} : { count: optionalNumber(record.count, 'Telemetry count') }),
    ...(record.value === undefined ? {} : { value: optionalNumber(record.value, 'Telemetry value') }),
    ...(record.metadata === undefined ? {} : { metadata: optionalRecord(record.metadata, 'Telemetry metadata') }),
  };
}

function clampTelemetryLimit(limit: unknown, fallback: number, max: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.trunc(limit), max));
}

function normalizeTelemetryReadInput(input: unknown, fallbackLimit: number, maxLimit: number): { since: string; limit: number } {
  const record = normalizeRecordInput(input, 'Telemetry read');
  return {
    since: requireString(record.since, 'Telemetry read since'),
    limit: clampTelemetryLimit(record.limit, fallbackLimit, maxLimit),
  };
}

function normalizeRuntimeRefreshSkillMcpConfigInput(input: unknown): ExtensionRuntimeRefreshSkillMcpConfigInput {
  const record = normalizeRecordInput(input, 'Runtime');
  return {
    runtimeDir: requireString(record.runtimeDir, 'Runtime dir'),
    ...(record.runtimeScope !== undefined ? { runtimeScope: optionalString(record.runtimeScope, 'Runtime scope') } : {}),
    ...(record.repoRoot !== undefined ? { repoRoot: optionalString(record.repoRoot, 'Runtime repo root') } : {}),
  };
}

function dispatchRuntimeCapability(runtime: ExtensionBackendCapabilityRuntime, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation === 'refreshSkillMcpConfig') {
    return runtime.refreshSkillMcpConfig(normalizeRuntimeRefreshSkillMcpConfigInput(request.input));
  }
  throw new Error(`Unsupported runtime capability operation: ${request.operation}`);
}

function dispatchTelemetryCapability(
  telemetry: ExtensionBackendCapabilityTelemetry,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  if (request.operation === 'record') {
    return telemetry.record(request.extensionId, normalizeTelemetryEvent(request.input));
  }
  if (request.operation === 'readTrace') {
    return telemetry.readTrace(normalizeTelemetryReadInput(request.input, 50_000, 100_000));
  }
  if (request.operation === 'queryApp') {
    return telemetry.queryApp(normalizeTelemetryReadInput(request.input, 200, 1000));
  }
  throw new Error(`Unsupported telemetry capability operation: ${request.operation}`);
}

function dispatchSecretsCapability(secrets: ExtensionBackendCapabilitySecrets, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'get') {
    throw new Error(`Unsupported secrets capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Secrets');
  return secrets.get(request.extensionId, requireString(input.secretId, 'Secret id'));
}

function dispatchSettingsCapability(
  settings: ExtensionBackendCapabilitySettings,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  const stateRoot = request.context?.stateRoot?.trim() || undefined;

  if (request.operation === 'read') {
    return settings.read(stateRoot);
  }
  if (request.operation === 'readSchema') {
    return settings.readSchema(stateRoot);
  }
  if (request.operation === 'update') {
    const input = normalizeRecordInput(request.input, 'Settings');
    const overrides = optionalRecord(input.overrides, 'Settings overrides');
    if (!overrides) throw new Error('Settings overrides must be an object.');
    return settings.update(overrides, stateRoot);
  }
  if (request.operation === 'reset') {
    const input = normalizeRecordInput(request.input, 'Settings');
    const keys = optionalStringArray(input.keys, 'Settings reset keys');
    if (!keys) throw new Error('Settings reset keys must be an array of strings.');
    return settings.reset(keys, stateRoot);
  }

  throw new Error(`Unsupported settings capability operation: ${request.operation}`);
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings when provided.`);
  }
  return value;
}

function optionalNullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return optionalString(value, label) ?? null;
}

function optionalNullableStringArray(value: unknown, label: string): string[] | null {
  if (value === null) return null;
  return optionalStringArray(value, label) ?? null;
}

function normalizeConversationImages(value: unknown): Array<{ data: string; mimeType: string; name?: string }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('Conversation images must be an array when provided.');
  }
  return value.map((item) => {
    const image = normalizeRecordInput(item, 'Conversation image');
    return {
      data: requireString(image.data, 'Conversation image data'),
      mimeType: requireString(image.mimeType, 'Conversation image mimeType'),
      ...(image.name !== undefined ? { name: optionalString(image.name, 'Conversation image name') } : {}),
    };
  });
}

function normalizeConversationPathBackedAttachments(
  value: unknown,
  label: string,
  options: { mimePrefix?: string },
): Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array when provided.`);
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label} ${index + 1} must be an object.`);
    const path = requireString((item as { path?: unknown }).path, `${label} ${index + 1} path`);
    const mimeType = requireString((item as { mimeType?: unknown }).mimeType, `${label} ${index + 1} MIME type`);
    if (options.mimePrefix && !mimeType.toLowerCase().startsWith(options.mimePrefix)) {
      throw new Error(`${label} ${index + 1} MIME type must start with ${options.mimePrefix}.`);
    }
    const sizeBytes = (item as { sizeBytes?: unknown }).sizeBytes;
    const name =
      (item as { name?: unknown }).name !== undefined
        ? optionalString((item as { name?: unknown }).name, `${label} ${index + 1} name`)
        : undefined;
    return [
      {
        path,
        mimeType,
        ...(name ? { name } : {}),
        ...(Number.isSafeInteger(sizeBytes) && Number(sizeBytes) >= 0 ? { sizeBytes: Number(sizeBytes) } : {}),
      },
    ];
  });
}

function normalizeConversationSendOptions(input: Record<string, unknown>):
  | {
      steer?: boolean;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
    }
  | undefined {
  const options = {
    ...(input.steer !== undefined ? { steer: optionalBoolean(input.steer, 'Conversation steer') } : {}),
    ...(input.images !== undefined ? { images: normalizeConversationImages(input.images) } : {}),
    ...(input.videos !== undefined
      ? { videos: normalizeConversationPathBackedAttachments(input.videos, 'Conversation videos', { mimePrefix: 'video/' }) }
      : {}),
    ...(input.audios !== undefined
      ? { audios: normalizeConversationPathBackedAttachments(input.audios, 'Conversation audio', { mimePrefix: 'audio/' }) }
      : {}),
    ...(input.documents !== undefined
      ? { documents: normalizeConversationPathBackedAttachments(input.documents, 'Conversation documents', {}) }
      : {}),
  };
  return Object.keys(options).length > 0 ? options : undefined;
}

function optionalStringRecord(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object when provided.`);
  }
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) {
    throw new Error(`${label} values must be strings.`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function optionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number when provided.`);
  }
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean when provided.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string when provided.`);
  }
  return value;
}

function normalizePtyInput(value: unknown): boolean | { cols?: number; rows?: number } | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  const record = optionalRecord(value, 'Shell pty');
  if (!record) return undefined;
  return {
    ...(record.cols !== undefined ? { cols: requireNumber(record.cols, 'Shell pty cols') } : {}),
    ...(record.rows !== undefined ? { rows: requireNumber(record.rows, 'Shell pty rows') } : {}),
  };
}

async function dispatchShellCapability(
  shell: ExtensionBackendCapabilityShell,
  shellSpawnHandles: Map<string, ExtensionBackendShellSpawnRecord>,
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: ExtensionBackendCapabilityEventEmitter,
): Promise<unknown> {
  const input = normalizeRecordInput(request.input, 'Shell');

  if (request.operation === 'abortOwner') {
    const workerRequestId =
      typeof input.workerRequestId === 'number'
        ? input.workerRequestId
        : typeof request.context?.workerRequestId === 'number'
          ? request.context.workerRequestId
          : undefined;
    if (workerRequestId === undefined) {
      return { ok: true, killed: 0 };
    }

    let killed = 0;
    for (const [key, record] of shellSpawnHandles) {
      if (!key.startsWith(`${request.extensionId}:`) || record.workerRequestId !== workerRequestId) {
        continue;
      }
      shellSpawnHandles.delete(key);
      killed += 1;
      await stopShellSpawnRecord(record);
    }
    return { ok: true, killed };
  }

  if (request.operation === 'exec') {
    return shell.exec({
      command: requireString(input.command, 'Shell command'),
      ...(input.args !== undefined ? { args: optionalStringArray(input.args, 'Shell args') } : {}),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Shell cwd') } : {}),
      ...(input.timeoutMs !== undefined ? { timeoutMs: optionalNumber(input.timeoutMs, 'Shell timeoutMs') } : {}),
      ...(input.maxBuffer !== undefined ? { maxBuffer: optionalNumber(input.maxBuffer, 'Shell maxBuffer') } : {}),
      ...(input.env !== undefined ? { env: optionalStringRecord(input.env, 'Shell env') } : {}),
    });
  }

  if (request.operation === 'spawn') {
    if (!shell.spawn) {
      throw new Error('Shell spawn capability is unavailable.');
    }
    const handleId = requireString(input.handleId, 'Shell handleId');
    const handle = await shell.spawn({
      command: requireString(input.command, 'Shell command'),
      ...(input.args !== undefined ? { args: optionalStringArray(input.args, 'Shell args') } : {}),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Shell cwd') } : {}),
      ...(input.env !== undefined ? { env: optionalStringRecord(input.env, 'Shell env') } : {}),
      ...(input.pty !== undefined ? { pty: normalizePtyInput(input.pty) } : {}),
      ...(input.onStdout === true
        ? {
            onStdout: (chunk: string) =>
              emit?.({
                kind: 'capabilityEvent',
                extensionId: request.extensionId,
                capability: 'shell',
                operation: 'stdout',
                input: { handleId, chunk },
              }),
          }
        : {}),
      ...(input.onStderr === true
        ? {
            onStderr: (chunk: string) =>
              emit?.({
                kind: 'capabilityEvent',
                extensionId: request.extensionId,
                capability: 'shell',
                operation: 'stderr',
                input: { handleId, chunk },
              }),
          }
        : {}),
      ...(input.onExit === true
        ? {
            onExit: (event: { code: number | null; signal: NodeJS.Signals | null }) => {
              shellSpawnHandles.delete(`${request.extensionId}:${handleId}`);
              emit?.({
                kind: 'capabilityEvent',
                extensionId: request.extensionId,
                capability: 'shell',
                operation: 'exit',
                input: { handleId, code: event.code, signal: event.signal },
              });
            },
          }
        : {}),
    });
    shellSpawnHandles.set(`${request.extensionId}:${handleId}`, { handle, ...shellSpawnRecordOwner(request.context) });
    return { pid: handle.pid, usingPty: handle.usingPty, executionWrappers: handle.executionWrappers };
  }

  const handleId = requireString(input.handleId, 'Shell handleId');
  const record = shellSpawnHandles.get(`${request.extensionId}:${handleId}`);
  if (!record) {
    throw new Error(`Shell handle not found: ${handleId}`);
  }
  const { handle } = record;

  if (request.operation === 'kill') {
    shellSpawnHandles.delete(`${request.extensionId}:${handleId}`);
    await stopShellSpawnRecord(record);
    return { ok: true };
  }

  if (request.operation === 'write') {
    handle.write(requireString(input.data, 'Shell write data'));
    return { ok: true };
  }

  if (request.operation === 'resize') {
    handle.resize(requireNumber(input.cols, 'Shell resize cols'), requireNumber(input.rows, 'Shell resize rows'));
    return { ok: true };
  }

  throw new Error(`Unsupported shell capability operation: ${request.operation}`);
}

async function dispatchTerminalCapability(request: ExtensionBackendWorkerCapabilityRequest): Promise<unknown> {
  const input = normalizeRecordInput(request.input, 'Terminal');
  if (request.operation === 'create') {
    const cwd = input.cwd !== undefined ? optionalString(input.cwd, 'Terminal cwd') : request.context?.desktopRootLayout?.root;
    return createTerminalSession({
      ...(cwd ? { cwd } : {}),
    });
  }
  if (request.operation === 'write') {
    return writeTerminalSession({
      id: requireString(input.id, 'Terminal id'),
      data: requireString(input.data, 'Terminal data'),
    });
  }
  if (request.operation === 'drain') {
    return drainTerminalSession({ id: requireString(input.id, 'Terminal id') });
  }
  if (request.operation === 'stream') {
    return streamTerminalSession({
      method: 'GET',
      path: '/stream',
      query: { id: requireString(input.id, 'Terminal id') },
      params: {},
    });
  }
  if (request.operation === 'resize') {
    return resizeTerminalSession({
      id: requireString(input.id, 'Terminal id'),
      cols: requireNumber(input.cols, 'Terminal cols'),
      rows: requireNumber(input.rows, 'Terminal rows'),
    });
  }
  if (request.operation === 'close') {
    return closeTerminalSession({ id: requireString(input.id, 'Terminal id') });
  }
  throw new Error(`Unsupported terminal capability operation: ${request.operation}`);
}

async function dispatchAgentCapability(
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: ExtensionBackendCapabilityEventEmitter,
): Promise<unknown> {
  const input = normalizeRecordInput(request.input, 'Agent');
  const ctx = {
    extensionId: request.extensionId,
    ...(request.context?.toolContext ? { toolContext: request.context.toolContext } : {}),
    ...(request.context?.agentToolContext ? { agentToolContext: request.context.agentToolContext } : {}),
  };

  if (request.operation === 'createConversation') {
    return createAgentConversation(normalizeRecordInput(input.input, 'Agent create conversation') as never, ctx);
  }
  if (request.operation === 'sendMessage') {
    return sendAgentMessage(normalizeRecordInput(input.input, 'Agent send message') as never, ctx);
  }
  if (request.operation === 'runTask') {
    return runAgentTask(normalizeRecordInput(input.input, 'Agent run task') as never, ctx);
  }
  if (request.operation === 'getConversation') {
    return getAgentConversation(normalizeRecordInput(input.input, 'Agent get conversation') as never, ctx);
  }
  if (request.operation === 'listConversations') {
    return listAgentConversations(input.input, ctx);
  }
  if (request.operation === 'abortConversation') {
    return abortAgentConversation(normalizeRecordInput(input.input, 'Agent abort conversation') as never, ctx);
  }
  if (request.operation === 'disposeConversation') {
    return disposeAgentConversation(normalizeRecordInput(input.input, 'Agent dispose conversation') as never, ctx);
  }
  if (request.operation === 'streamMessage') {
    const handleId = requireString(input.handleId, 'Agent stream handle id');
    try {
      const result = await streamAgentMessage(normalizeRecordInput(input.input, 'Agent stream message') as never, ctx);
      for await (const event of result.events) {
        emit?.({
          kind: 'capabilityEvent',
          extensionId: request.extensionId,
          capability: 'agent',
          operation: 'streamEvent',
          input: { handleId, event: event.data },
        });
      }
      emit?.({
        kind: 'capabilityEvent',
        extensionId: request.extensionId,
        capability: 'agent',
        operation: 'streamEnd',
        input: { handleId },
      });
      return { ok: true };
    } catch (error) {
      emit?.({
        kind: 'capabilityEvent',
        extensionId: request.extensionId,
        capability: 'agent',
        operation: 'streamError',
        input: { handleId, message: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  throw new Error(`Unsupported agent capability operation: ${request.operation}`);
}

async function dispatchBrowserCapability(request: ExtensionBackendWorkerCapabilityRequest): Promise<unknown> {
  const host = getWorkbenchBrowserToolHost();
  if (!host) {
    throw new Error('Workbench Browser tools are only available in the desktop app.');
  }
  const input =
    request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? (request.input as Record<string, unknown>) : {};
  if (request.operation === 'isActive') {
    return host.isActive(requireString(input.conversationId, 'Browser conversationId'));
  }
  if (request.operation === 'listTabs') {
    return host.listTabs();
  }
  if (request.operation === 'snapshot') {
    return host.snapshot(
      requireString(input.conversationId, 'Browser conversationId'),
      input.tabId !== undefined ? optionalString(input.tabId, 'Browser tabId') : undefined,
    );
  }
  if (request.operation === 'screenshot') {
    return host.screenshot(
      requireString(input.conversationId, 'Browser conversationId'),
      input.tabId !== undefined ? optionalString(input.tabId, 'Browser tabId') : undefined,
    );
  }
  if (request.operation === 'cdp') {
    return host.cdp({
      conversationId: requireString(input.conversationId, 'Browser conversationId'),
      command: input.command,
      ...(input.continueOnError !== undefined ? { continueOnError: Boolean(input.continueOnError) } : {}),
      ...(input.tabId !== undefined ? { tabId: optionalString(input.tabId, 'Browser tabId') } : {}),
    });
  }
  throw new Error(`Unsupported browser capability operation: ${request.operation}`);
}

async function dispatchDesktopCapability(request: ExtensionBackendWorkerCapabilityRequest): Promise<unknown> {
  if (request.operation === 'control') {
    return callServerModuleExport('../../desktop/desktopControl.js', 'issueDesktopControlCommand', request.input);
  }
  if (request.operation === 'screenshot') {
    return callServerModuleExport('../../desktop/desktopScreenshot.js', 'issueDesktopScreenshotRequest', request.input);
  }
  if (request.operation === 'state') {
    return callServerModuleExport('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
  }
  if (request.operation === 'events') {
    return callServerModuleExport('../../desktop/desktopEventReader.js', 'readDesktopUserActionEvents', request.input);
  }
  throw new Error(`Unsupported desktop capability operation: ${request.operation}`);
}

function canReadDocumentCollection(
  store: ReturnType<typeof getDocumentsStore>,
  callerAppId: string | undefined,
  owner: string,
  collection: string,
): boolean {
  if (!callerAppId || callerAppId === owner) return true;
  const summary = store.getCollection(owner, collection);
  if (!summary) return false;
  if (summary.defaultGrantRead === 'all') return true;
  return store.getGrant(owner, collection, callerAppId)?.canRead === true;
}

function canWriteDocumentCollection(
  store: ReturnType<typeof getDocumentsStore>,
  callerAppId: string | undefined,
  owner: string,
  collection: string,
): boolean {
  if (!callerAppId || callerAppId === owner) return true;
  const summary = store.getCollection(owner, collection);
  if (!summary) return false;
  if (summary.defaultGrantWrite === 'all') return true;
  return store.getGrant(owner, collection, callerAppId)?.canWrite === true;
}

function assertCanManageDocumentCollection(callerAppId: string | undefined, owner: string): void {
  if (!callerAppId || callerAppId === owner) return;
  throw new Error('Document collection access denied');
}

function assertCanReadDocumentCollection(
  store: ReturnType<typeof getDocumentsStore>,
  callerAppId: string | undefined,
  owner: string,
  collection: string,
): void {
  if (canReadDocumentCollection(store, callerAppId, owner, collection)) return;
  const summary = store.getCollection(owner, collection);
  if (!summary) throw new Error(`Collection "${owner}/${collection}" not found`);
  throw new Error('Document collection access denied');
}

function assertCanWriteDocumentCollection(
  store: ReturnType<typeof getDocumentsStore>,
  callerAppId: string | undefined,
  owner: string,
  collection: string,
): void {
  if (canWriteDocumentCollection(store, callerAppId, owner, collection)) return;
  const summary = store.getCollection(owner, collection);
  if (!summary) throw new Error(`Collection "${owner}/${collection}" not found`);
  throw new Error('Document collection access denied');
}

async function publishDocumentMutation(payload: {
  type: 'collection.updated' | 'document.updated' | 'document.deleted';
  owner: string;
  collection: string;
  id?: string;
  body?: unknown;
}): Promise<void> {
  invalidateAppTopics('documents');
  await publishExtensionHostEvent('documents', payload);
}

async function dispatchDocumentsCapability(
  documents: ExtensionBackendCapabilityDocuments,
  request: ExtensionBackendWorkerCapabilityRequest,
): Promise<unknown> {
  const input = normalizeRecordInput(request.input ?? {}, 'Documents');
  const store = getDocumentsStore(
    request.context?.stateRoot ?? documents.stateRoot ?? getStateRoot(),
    request.context?.desktopRootLayout ?? documents.desktopRootLayout,
  );
  const callerAppId = request.extensionId === 'system-data-tools' ? undefined : request.extensionId;

  if (request.operation === 'listCollections') {
    const owner = input.owner === undefined ? undefined : optionalString(input.owner, 'Documents owner');
    return store
      .listCollections(owner)
      .filter((collection) => canReadDocumentCollection(store, callerAppId, collection.owner, collection.collection));
  }

  const owner = requireString(input.owner, 'Documents owner');
  const collection = requireString(input.collection, 'Documents collection');

  if (request.operation === 'getCollection') {
    const result = store.getCollection(owner, collection);
    if (result) assertCanReadDocumentCollection(store, callerAppId, owner, collection);
    return result;
  }

  if (request.operation === 'upsertCollection') {
    assertCanManageDocumentCollection(callerAppId, owner);
    const options = normalizeRecordInput(input.options ?? {}, 'Documents collection options');
    const result = store.upsertCollection(owner, collection, {
      ...(options.description !== undefined
        ? { description: optionalString(options.description, 'Documents collection description') }
        : {}),
      ...(options.defaultGrantRead !== undefined
        ? { defaultGrantRead: requireString(options.defaultGrantRead, 'Documents collection read grant') as 'owner' | 'all' | 'none' }
        : {}),
      ...(options.defaultGrantWrite !== undefined
        ? { defaultGrantWrite: requireString(options.defaultGrantWrite, 'Documents collection write grant') as 'owner' | 'all' | 'none' }
        : {}),
    });
    await publishDocumentMutation({ type: 'collection.updated', owner, collection });
    return result;
  }

  if (request.operation === 'listDocuments') {
    assertCanReadDocumentCollection(store, callerAppId, owner, collection);
    const limit = typeof input.limit === 'number' ? input.limit : undefined;
    const offset = typeof input.offset === 'number' ? input.offset : undefined;
    return store.listDocuments(owner, collection, { limit, offset });
  }

  const id = requireString(input.id, 'Documents id');

  if (request.operation === 'getDocument') {
    assertCanReadDocumentCollection(store, callerAppId, owner, collection);
    return store.getDocument(owner, collection, id);
  }

  if (request.operation === 'putDocument') {
    assertCanWriteDocumentCollection(store, callerAppId, owner, collection);
    const result = store.putDocument(owner, collection, id, input.body);
    await publishDocumentMutation({ type: 'document.updated', owner, collection, id, body: input.body });
    return result;
  }

  if (request.operation === 'deleteDocument') {
    assertCanWriteDocumentCollection(store, callerAppId, owner, collection);
    const deleted = store.deleteDocument(owner, collection, id);
    if (deleted) {
      await publishDocumentMutation({ type: 'document.deleted', owner, collection, id });
    }
    return { deleted };
  }

  throw new Error(`Unsupported documents capability operation: ${request.operation}`);
}

function dispatchUiCapability(ui: ExtensionBackendCapabilityUi, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  const input = normalizeRecordInput(request.input, 'UI');
  if (request.operation === 'invalidate') {
    const topics = input.topics;
    if (typeof topics !== 'string' && (!Array.isArray(topics) || topics.some((topic) => typeof topic !== 'string'))) {
      throw new Error('UI topics must be a string or array of strings.');
    }
    return ui.invalidate(topics);
  }
  if (request.operation === 'confirm') {
    const details = input.details;
    if (details !== undefined) {
      if (!Array.isArray(details)) throw new Error('UI confirmation details must be an array when provided.');
      for (const detail of details) {
        if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
          throw new Error('UI confirmation details must be objects.');
        }
        const record = detail as Record<string, unknown>;
        if (typeof record.label !== 'string' || typeof record.value !== 'string') {
          throw new Error('UI confirmation detail labels and values must be strings.');
        }
      }
    }
    const timeoutMs = input.timeoutMs;
    if (timeoutMs !== undefined && typeof timeoutMs !== 'number') {
      throw new Error('UI confirmation timeoutMs must be a number when provided.');
    }
    return ui.confirm(request.extensionId, {
      message: requireString(input.message, 'UI confirmation message'),
      ...(optionalString(input.title, 'UI confirmation title') ? { title: optionalString(input.title, 'UI confirmation title') } : {}),
      ...(optionalString(input.confirmLabel, 'UI confirmation label')
        ? { confirmLabel: optionalString(input.confirmLabel, 'UI confirmation label') }
        : {}),
      ...(optionalString(input.cancelLabel, 'UI cancellation label')
        ? { cancelLabel: optionalString(input.cancelLabel, 'UI cancellation label') }
        : {}),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(Array.isArray(details) ? { details: details as Array<{ label: string; value: string }> } : {}),
    });
  }
  throw new Error(`Unsupported ui capability operation: ${request.operation}`);
}

function dispatchWorkspaceCapability(
  workspace: ExtensionBackendCapabilityWorkspace,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  const input = normalizeRecordInput(request.input, 'Workspace');
  const cwd = requireString(input.cwd, 'Workspace cwd');

  if (request.operation === 'readText') {
    return workspace.readText(request.extensionId, {
      cwd,
      path: requireString(input.path, 'Workspace path'),
      ...(input.maxBytes !== undefined ? { maxBytes: optionalNumber(input.maxBytes, 'Workspace maxBytes') } : {}),
    });
  }

  if (request.operation === 'writeText') {
    return workspace.writeText(request.extensionId, {
      cwd,
      path: requireString(input.path, 'Workspace path'),
      content: requireString(input.content, 'Workspace content'),
    });
  }

  if (request.operation === 'list') {
    return workspace.list(request.extensionId, {
      cwd,
      ...(input.path !== undefined ? { path: optionalString(input.path, 'Workspace path') } : {}),
      ...(input.depth !== undefined ? { depth: optionalNumber(input.depth, 'Workspace depth') } : {}),
    });
  }

  throw new Error(`Unsupported workspace capability operation: ${request.operation}`);
}

function serializeFilesystemRoot(root: ScopedFileSystem): {
  handleId: string;
  root: { kind: string; id: string; path: string; displayName?: string; labels?: Record<string, string> };
} {
  return {
    handleId: `fs-${randomUUID()}`,
    root: {
      kind: root.root.kind,
      id: root.root.id,
      path: root.root.path,
      ...(root.root.displayName !== undefined ? { displayName: root.root.displayName } : {}),
      ...(root.root.labels !== undefined ? { labels: root.root.labels } : {}),
    },
  };
}

function normalizeFilesystemAccess(value: unknown): FileAccess[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Filesystem access must be an array of strings when provided.');
  }
  return value as FileAccess[];
}

function normalizeFilesystemRootKind(value: unknown): ExtensionFilesystemRootKind | undefined {
  if (value === undefined) return undefined;
  if (value !== 'workspace' && value !== 'app' && value !== 'cache' && value !== 'temp') {
    throw new Error('Filesystem root kind must be workspace, app, cache, or temp when provided.');
  }
  return value;
}

function dispatchFilesystemCapability(
  filesystem: ExtensionBackendCapabilityFilesystem,
  handles: Map<string, ScopedFileSystem>,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  const input = normalizeRecordInput(request.input, 'Filesystem');

  if (request.operation === 'requestRoot') {
    const root = filesystem.requestRoot(request.extensionId, {
      ...(input.kind !== undefined ? { kind: normalizeFilesystemRootKind(input.kind) } : {}),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Filesystem cwd') } : {}),
      ...(input.access !== undefined ? { access: normalizeFilesystemAccess(input.access) } : {}),
      ...(input.reason !== undefined ? { reason: optionalString(input.reason, 'Filesystem reason') } : {}),
      ...(input.prefix !== undefined ? { prefix: optionalString(input.prefix, 'Filesystem prefix') } : {}),
    });
    return Promise.resolve(root).then((scopedRoot) => {
      const serialized = serializeFilesystemRoot(scopedRoot);
      handles.set(serialized.handleId, scopedRoot);
      return serialized;
    });
  }

  const handleId = requireString(input.handleId, 'Filesystem handle id');
  const root = handles.get(handleId);
  if (!root) throw new Error('Filesystem handle not found.');

  if (request.operation === 'readBytes') {
    return root.readBytes(requireString(input.path, 'Filesystem path'), {
      ...(input.maxBytes !== undefined ? { maxBytes: optionalNumber(input.maxBytes, 'Filesystem maxBytes') } : {}),
    });
  }

  if (request.operation === 'readText') {
    return root.readText(requireString(input.path, 'Filesystem path'), {
      ...(input.maxBytes !== undefined ? { maxBytes: optionalNumber(input.maxBytes, 'Filesystem maxBytes') } : {}),
    });
  }

  if (request.operation === 'writeBytes') {
    const data = input.data;
    if (!(data instanceof Uint8Array) && !Array.isArray(data)) throw new Error('Filesystem data must be bytes.');
    return root.writeBytes(requireString(input.path, 'Filesystem path'), data instanceof Uint8Array ? data : Uint8Array.from(data), {
      ...(input.atomic !== undefined ? { atomic: optionalBoolean(input.atomic, 'Filesystem atomic') } : {}),
    });
  }

  if (request.operation === 'writeText') {
    return root.writeText(requireString(input.path, 'Filesystem path'), requireString(input.data, 'Filesystem text'), {
      ...(input.atomic !== undefined ? { atomic: optionalBoolean(input.atomic, 'Filesystem atomic') } : {}),
    });
  }

  if (request.operation === 'readJson') {
    return root.readJson(requireString(input.path, 'Filesystem path'), {
      ...(input.maxBytes !== undefined ? { maxBytes: optionalNumber(input.maxBytes, 'Filesystem maxBytes') } : {}),
    });
  }

  if (request.operation === 'writeJson') {
    return root.writeJson(requireString(input.path, 'Filesystem path'), input.value, {
      ...(input.atomic !== undefined ? { atomic: optionalBoolean(input.atomic, 'Filesystem atomic') } : {}),
    });
  }

  if (request.operation === 'list') {
    return root.list(input.path !== undefined ? optionalString(input.path, 'Filesystem path') : undefined, {
      ...(input.depth !== undefined ? { depth: optionalNumber(input.depth, 'Filesystem depth') } : {}),
      ...(input.excludeNames !== undefined
        ? { excludeNames: optionalStringArray(input.excludeNames, 'Filesystem excludeNames') ?? [] }
        : {}),
    });
  }

  if (request.operation === 'stat') return root.stat(requireString(input.path, 'Filesystem path'));
  if (request.operation === 'exists') return root.exists(requireString(input.path, 'Filesystem path'));
  if (request.operation === 'createDirectory') return root.createDirectory(requireString(input.path, 'Filesystem path'));
  if (request.operation === 'move') {
    return root.move(requireString(input.from, 'Filesystem move source'), requireString(input.to, 'Filesystem move destination'), {
      ...(input.overwrite !== undefined ? { overwrite: optionalBoolean(input.overwrite, 'Filesystem overwrite') } : {}),
    });
  }
  if (request.operation === 'copyIn') {
    return root.copyIn(
      requireString(input.to, 'Filesystem copy destination'),
      requireString(input.absoluteSource, 'Filesystem copy source'),
    );
  }
  if (request.operation === 'remove') {
    return root.remove(requireString(input.path, 'Filesystem path'), {
      ...(input.recursive !== undefined ? { recursive: optionalBoolean(input.recursive, 'Filesystem recursive') } : {}),
      ...(input.force !== undefined ? { force: optionalBoolean(input.force, 'Filesystem force') } : {}),
    });
  }
  if (request.operation === 'createTempWorkspace') {
    const tempRoot = root.createTempWorkspace({
      ...(input.prefix !== undefined ? { prefix: optionalString(input.prefix, 'Filesystem prefix') } : {}),
    });
    return Promise.resolve(tempRoot).then((scopedRoot) => {
      const serialized = serializeFilesystemRoot(scopedRoot);
      handles.set(serialized.handleId, scopedRoot);
      return serialized;
    });
  }

  throw new Error(`Unsupported filesystem capability operation: ${request.operation}`);
}

export function createExtensionBackendCapabilityDispatcher(
  options: ExtensionBackendCapabilityDispatcherOptions = {},
): ExtensionBackendCapabilityDispatcher {
  const filesystemHandles = new Map<string, ScopedFileSystem>();
  const automations = options.automations ?? createDefaultAutomationsCapability();
  const commands = options.commands ?? {
    list: () => listExtensionCommandRegistrations(),
    execute: async (extensionId: string, commandId: string, args?: unknown) => {
      const command = findExtensionCommandRegistration(commandId);
      if (command) {
        if (isHostCommandAction(command.action)) {
          return executeHostCommandInRenderer({ command: command.action, args: args ?? command.args, sourceExtensionId: extensionId });
        }
        const { invokeExtensionAction } = await import('./extensionBackend.js');
        const actionResult = await invokeExtensionAction(command.extensionId, command.action, args ?? command.args ?? {});
        if (!actionResult.ok) throw new Error(actionResult.error);
        return true;
      }
      return executeHostCommandInRenderer({ command: commandId, args, sourceExtensionId: extensionId });
    },
  };
  const conversations = options.conversations ?? {
    list: (_extensionId: string, input?: { runtimeScope?: string; runtimeSettingsFilePath?: string }) =>
      createExtensionConversationsCapability(
        input?.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).list(),
    activity: (
      _extensionId: string,
      conversationId: string,
      options?: { active?: boolean; visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all' },
    ) => createExtensionConversationsCapability().activity(conversationId, options),
    connections: (
      _extensionId: string,
      conversationId: string,
      options?: {
        active?: boolean;
        kind?: 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface' | 'all';
        surface?: 'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli' | 'all';
        visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all';
      },
    ) => createExtensionConversationsCapability().connections(conversationId, options),
    get: (_extensionId: string, conversationId: string) => createExtensionConversationsCapability().get(conversationId),
    create: (
      _extensionId: string,
      input?: Parameters<ReturnType<typeof createExtensionConversationsCapability>['create']>[0] & {
        runtimeScope?: string;
        runtimeSettingsFilePath?: string;
      },
    ) =>
      createExtensionConversationsCapability(
        input?.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).create(input),
    setActiveTools: (_extensionId: string, conversationId: string, toolNames: string[]) =>
      createExtensionConversationsCapability().setActiveTools(conversationId, toolNames),
    getMeta: (_extensionId: string, conversationId: string) => createExtensionConversationsCapability().getMeta(conversationId),
    getBlocks: (_extensionId: string, conversationId: string, options?: { tailBlocks?: number }) =>
      createExtensionConversationsCapability().getBlocks(conversationId, options),
    appendCustomEntry: (_extensionId: string, conversationId: string, customType: string, data?: unknown) =>
      createExtensionConversationsCapability().appendCustomEntry(conversationId, customType, data),
    appendTranscriptBlock: (
      extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['appendTranscriptBlock']>[0],
    ) => createExtensionConversationsCapability(undefined, extensionId, { enforceManifestPermissions: true }).appendTranscriptBlock(input),
    updateTranscriptBlock: (
      extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['updateTranscriptBlock']>[0],
    ) => createExtensionConversationsCapability(undefined, extensionId, { enforceManifestPermissions: true }).updateTranscriptBlock(input),
    getWorkspace: (_extensionId: string, input?: { runtimeScope?: string; runtimeSettingsFilePath?: string }) =>
      createExtensionConversationsCapability(
        input?.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).getWorkspace(),
    updateWorkspace: (
      _extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['updateWorkspace']>[0] & {
        runtimeScope?: string;
        runtimeSettingsFilePath?: string;
      },
    ) =>
      createExtensionConversationsCapability(
        input.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).updateWorkspace(input),
    rollback: (_extensionId: string, conversationId: string, count: number) =>
      createExtensionConversationsCapability().rollback(conversationId, count),
    ensureLive: (_extensionId: string, conversationId: string, options?: { cwd?: string }) =>
      createExtensionConversationsCapability().ensureLive(conversationId, options),
    requestWorkingDirectoryChange: (_extensionId: string, conversationId: string, cwd: string, options?: { continuePrompt?: string }) =>
      createExtensionConversationsCapability().requestWorkingDirectoryChange(conversationId, cwd, options),
    sendMessage: (
      _extensionId: string,
      conversationId: string,
      text: string,
      options?: Parameters<ReturnType<typeof createExtensionConversationsCapability>['sendMessage']>[2],
    ) => createExtensionConversationsCapability().sendMessage(conversationId, text, options),
    startParallelPrompt: (
      extensionId: string,
      conversationId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['startParallelPrompt']>[1],
    ) => createExtensionConversationsCapability(undefined, extensionId).startParallelPrompt(conversationId, input),
    manageParallelJob: (
      extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['manageParallelJob']>[0],
    ) => createExtensionConversationsCapability(undefined, extensionId).manageParallelJob(input),
    createSpeculativeWorkspace: (extensionId: string, conversationId: string) =>
      createExtensionConversationsCapability(undefined, extensionId).createSpeculativeWorkspace(conversationId),
    applySpeculativeWorkspace: (
      extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['applySpeculativeWorkspace']>[0],
    ) => createExtensionConversationsCapability(undefined, extensionId).applySpeculativeWorkspace(input),
    disposeSpeculativeWorkspace: (extensionId: string, id: string) =>
      createExtensionConversationsCapability(undefined, extensionId).disposeSpeculativeWorkspace(id),
    runTurn: (
      _extensionId: string,
      conversationId: string,
      text: string,
      options?: {
        cwd?: string;
        steer?: boolean;
        images?: Array<{ data: string; mimeType: string; name?: string }>;
        timeoutMs?: number;
        onEvent?: (event: unknown) => void;
      },
    ) => createExtensionConversationsCapability().runTurn(conversationId, text, options),
    abort: (_extensionId: string, conversationId: string) => createExtensionConversationsCapability().abort(conversationId),
    compact: (_extensionId: string, conversationId: string, customInstructions?: string) =>
      createExtensionConversationsCapability().compact(conversationId, customInstructions),
    fork: (_extensionId: string, input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['fork']>[0]) =>
      createExtensionConversationsCapability().fork(input),
    setTitle: (_extensionId: string, conversationId: string, title: string) =>
      createExtensionConversationsCapability().setTitle(conversationId, title),
    delete: (
      _extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['delete']>[0] & {
        runtimeScope?: string;
        runtimeSettingsFilePath?: string;
      },
    ) =>
      createExtensionConversationsCapability(
        input.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).delete(input),
    prune: (
      _extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['prune']>[0] & {
        runtimeScope?: string;
        runtimeSettingsFilePath?: string;
      },
    ) =>
      createExtensionConversationsCapability(
        input.runtimeSettingsFilePath
          ? {
              getRuntimeScope: () => input.runtimeScope ?? 'shared',
              getSettingsFile: () => input.runtimeSettingsFilePath!,
            }
          : undefined,
      ).prune(input),
    metadata: {
      get: (extensionId: string, input: { conversationId: string; namespace?: string; runtimeScope?: string }) =>
        readConversationMetadata({ ...input, extensionId }),
      set: (
        extensionId: string,
        input: { conversationId: string; namespace?: string; values: Record<string, unknown>; runtimeScope?: string },
      ) => writeConversationMetadata({ ...input, extensionId }),
      query: (
        extensionId: string,
        input: {
          namespace?: string;
          where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
          limit?: number;
          runtimeScope?: string;
        },
      ) => queryConversationMetadata({ ...input, namespace: input.namespace?.trim() || extensionId }),
    },
  };
  const events = options.events ?? {
    publish: publishExtensionEvent,
    emit: emitEvent,
    delay: delayEvent,
    replay: replayEvent,
    list: listEvents,
    listSubscriptions,
    saveSubscription,
    deleteSubscription,
    cancelDelayed: cancelDelayedEvent,
    prune: pruneEvents,
    processDue: processDueEvents,
  };
  const documents = options.documents ?? {};
  const extensions = options.extensions ?? {
    invokeAction: async (input: { extensionId: string; actionId: string; input?: unknown }) => {
      const { invokeExtensionAction } = await import('./extensionBackend.js');
      return invokeExtensionAction(input.extensionId, input.actionId, input.input);
    },
    listActions: () =>
      listExtensionInstallSummaries()
        .filter((summary) => summary.status === 'enabled' && (summary.backendActions?.length ?? 0) > 0)
        .map((summary) => ({
          extensionId: summary.id,
          extensionName: summary.name,
          actions: (summary.backendActions ?? []).map((action) => ({
            id: action.id,
            title: action.title,
            description: action.description,
          })),
        })),
    listPromptAssemblyContributions: () => ({
      contextProviders: listExtensionPromptContextProviderRegistrations(),
      assemblyProviders: listExtensionAssemblyProviderRegistrations(),
      hooks: listExtensionPromptAssemblyHookRegistrations(),
    }),
    listStaticContributions: () => ({
      tools: listExtensionToolRegistrations(),
      skills: listExtensionSkillRegistrations(),
      modelDiscovery: listEnabledExtensionEntries().flatMap((entry) => {
        const action = entry.manifest.contributes?.modelDiscovery?.action;
        return typeof action === 'string' ? [{ extensionId: entry.manifest.id, action }] : [];
      }),
    }),
    getStatus: (extensionId: string) => {
      const summary = listExtensionInstallSummaries().find((item) => item.id === extensionId);
      if (!summary) return { enabled: false, healthy: false };
      const enabled = summary.status === 'enabled';
      return {
        enabled,
        healthy: enabled && (!summary.errors || summary.errors.length === 0),
        ...(summary.errors?.length ? { errors: summary.errors } : {}),
      };
    },
    setEnabled: (extensionId: string, enabled: boolean) => setExtensionEnabled(extensionId, enabled),
    setPermissionGranted: async (extensionId: string, permission: ExtensionPermission, granted: boolean) => {
      setExtensionPermissionGranted(extensionId, permission, granted);
      await callServerModuleExport('../../extensions/extensionBackend.js', 'reloadExtensionBackend', extensionId);
    },
  };
  const git = options.git ?? createExtensionGitCapability();
  const image = options.image ?? { generate: generateImageWithInstalledExtension };
  const video =
    options.video ??
    ({
      extractFrame: async (input: unknown, context?: { sessionId?: string }) => {
        const module = await import('./videoProbeAttachmentStore.js');
        return module.extractVideoFrame(input, context);
      },
      sampleFrames: async (input: unknown, context?: { sessionId?: string }) => {
        const module = await import('./videoProbeAttachmentStore.js');
        return module.sampleVideoFrames(input, context);
      },
      transcribe: async (input: unknown) => {
        const module = await import('./videoProbeAttachmentStore.js');
        return module.transcribeVideo(input);
      },
    } satisfies ExtensionBackendCapabilityVideo);
  const logger = options.log ?? { info: logInfo, warn: logWarn, error: logError };
  const models = options.models ?? {
    list: (context?: ExtensionBackendModelWriteContext) => createModelsCapabilityForWriteContext(context).list(),
    saveProvider: (input: unknown, context?: ExtensionBackendModelWriteContext) =>
      createModelsCapabilityForWriteContext(context).saveProvider(input as never),
    saveProviderModel: (input: unknown, context?: ExtensionBackendModelWriteContext) =>
      createModelsCapabilityForWriteContext(context).saveProviderModel(input as never),
    deleteProvider: (provider: string, context?: ExtensionBackendModelWriteContext) =>
      createModelsCapabilityForWriteContext(context).deleteProvider(provider),
    deleteProviderModel: (input: { provider: string; modelId: string }, context?: ExtensionBackendModelWriteContext) =>
      createModelsCapabilityForWriteContext(context).deleteProviderModel(input),
  };
  const notify = options.notify ?? {
    toast: (extensionId: string, message: string, type: 'info' | 'warning' | 'error') => {
      logInfo('extension notification', { extensionId, type, message });
      invalidateAppTopics('notifications');
      publishAppEvent({ type: 'notification', extensionId, message, severity: type });
    },
    system: (extensionId: string, input: { message: string }) => sendNotifyAsSystemNotification(extensionId, input),
    setBadge: (extensionId: string, count: number) => setExtensionBadge(extensionId, count),
    clearBadge: (extensionId: string) => setExtensionBadge(extensionId, 0),
    isSystemAvailable: () => isSystemNotificationAvailable(),
  };
  const runtime = options.runtime ?? {
    refreshSkillMcpConfig: refreshHostSkillMcpConfig,
  };
  const secrets = options.secrets ?? { get: (extensionId: string, secretId: string) => resolveSecret(extensionId, secretId) };
  const settings = options.settings ?? {
    read: (stateRoot?: string) => createSettingsStore(stateRoot).read(),
    readSchema: (stateRoot?: string) => createSettingsStore(stateRoot).readSchema(),
    update: (overrides: Record<string, unknown>, stateRoot?: string) => createSettingsStore(stateRoot).update(overrides),
    reset: (keys: string[], stateRoot?: string) => createSettingsStore(stateRoot).reset(keys),
  };
  const shell = options.shell ?? createExtensionShellCapability({ pathDirs: listEnabledExtensionBinDirs() });
  const shellSpawnHandles = new Map<string, ExtensionBackendShellSpawnRecord>();
  shellSpawnHandleMaps.add(shellSpawnHandles);
  const telemetry = options.telemetry ?? {
    record: (extensionId: string, event: ExtensionBackendCapabilityTelemetryEvent) => {
      persistAppTelemetryEvent({
        ...event,
        source: event.source ?? 'server',
        metadata: { ...(event.metadata ?? {}), extensionId },
      });
    },
    readTrace: (input: { since: string; limit: number }) => readTraceTelemetryLogEvents(input),
    queryApp: (input: { since: string; limit: number }) => queryAppTelemetryEvents(input),
  };
  const ui = options.ui ?? {
    invalidate: (topics: string | string[]) => {
      const items = Array.isArray(topics) ? topics : [topics];
      invalidateAppTopics(...(items as AppEventTopic[]));
    },
    confirm: (
      extensionId: string,
      input: {
        title?: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        timeoutMs?: number;
        details?: Array<{ label: string; value: string }>;
      },
    ) => requestExtensionUiConfirm({ extensionId, ...input }),
  };
  const workspace = options.workspace ?? {
    readText: (extensionId: string, input: { cwd: string; path: string; maxBytes?: number }) =>
      createExtensionWorkspaceCapability(extensionId).readText(input),
    writeText: (extensionId: string, input: { cwd: string; path: string; content: string }) =>
      createExtensionWorkspaceCapability(extensionId).writeText(input),
    list: (extensionId: string, input: { cwd: string; path?: string; depth?: number }) =>
      createExtensionWorkspaceCapability(extensionId).list(input),
  };
  const filesystem = options.filesystem ?? {
    requestRoot: (
      extensionId: string,
      input: { kind?: ExtensionFilesystemRootKind; cwd?: string; access?: FileAccess[]; reason?: string; prefix?: string },
    ) => createExtensionFilesystemCapability(extensionId, input.cwd ? { cwd: input.cwd } : undefined).requestRoot(input),
  };
  const storage = options.storage ?? {
    get: (extensionId: string, key: string) => readExtensionState(extensionId, key)?.value ?? null,
    put: (extensionId: string, key: string, value: unknown, storageOptions?: { expectedVersion?: number }) => {
      writeExtensionState(extensionId, key, value, storageOptions ? { expectedVersion: storageOptions.expectedVersion } : {});
      return { ok: true };
    },
    delete: (extensionId: string, key: string) => deleteExtensionState(extensionId, key),
    list: (extensionId: string, prefix = '') =>
      listExtensionState(extensionId, prefix).map((document) => ({ key: document.key, value: document.value })),
  };
  return (request, emit) => {
    assertExtensionBackendCapabilityPermission(request);

    if (request.capability === 'agent') {
      return dispatchAgentCapability(request, emit);
    }
    if (request.capability === 'automations') {
      return dispatchAutomationsCapability(automations, request);
    }
    if (request.capability === 'browser') {
      return dispatchBrowserCapability(request);
    }
    if (request.capability === 'desktop') {
      return dispatchDesktopCapability(request);
    }
    if (request.capability === 'documents') {
      return dispatchDocumentsCapability(documents, request);
    }
    if (request.capability === 'commands') {
      return dispatchCommandsCapability(commands, request);
    }
    if (request.capability === 'conversations') {
      return dispatchConversationsCapability(conversations, request, emit);
    }
    if (request.capability === 'events') {
      return dispatchEventsCapability(events, request);
    }
    if (request.capability === 'extensions') {
      return dispatchExtensionsCapability(extensions, request);
    }
    if (request.capability === 'filesystem') {
      return dispatchFilesystemCapability(filesystem, filesystemHandles, request);
    }
    if (request.capability === 'git') {
      return dispatchGitCapability(git, request);
    }
    if (request.capability === 'image') {
      return dispatchImageCapability(image, request);
    }
    if (request.capability === 'video') {
      return dispatchVideoCapability(video, request);
    }
    if (request.capability === 'log') {
      return dispatchLogCapability(logger, request);
    }
    if (request.capability === 'models') {
      return dispatchModelsCapability(models, request);
    }
    if (request.capability === 'notify') {
      return dispatchNotifyCapability(notify, request);
    }
    if (request.capability === 'runtime') {
      return dispatchRuntimeCapability(runtime, request);
    }
    if (request.capability === 'shell') {
      return dispatchShellCapability(shell, shellSpawnHandles, request, emit);
    }
    if (request.capability === 'secrets') {
      return dispatchSecretsCapability(secrets, request);
    }
    if (request.capability === 'settings') {
      return dispatchSettingsCapability(settings, request);
    }
    if (request.capability === 'storage') {
      return dispatchStorageCapability(storage, request);
    }
    if (request.capability === 'telemetry') {
      return dispatchTelemetryCapability(telemetry, request);
    }
    if (request.capability === 'terminal') {
      return dispatchTerminalCapability(request);
    }
    if (request.capability === 'toolContext') {
      const input =
        request.input && typeof request.input === 'object' && !Array.isArray(request.input)
          ? (request.input as Record<string, unknown>)
          : {};
      const handleId = typeof input.handleId === 'string' ? input.handleId : '';
      if (!handleId) throw new Error('Missing tool context update handle.');
      if (request.operation === 'update') {
        emitExtensionToolUpdate(handleId, input.update as never);
        return { ok: true };
      }
    }
    if (request.capability === 'ui') {
      return dispatchUiCapability(ui, request);
    }
    if (request.capability === 'workspace') {
      return dispatchWorkspaceCapability(workspace, request);
    }
    throw new Error(`Unsupported extension backend capability: ${request.capability}`);
  };
}
