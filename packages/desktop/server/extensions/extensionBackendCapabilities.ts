import { resolveSecret } from '../secrets/secretStore.js';
import { type AppEventTopic, invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { logError, logInfo, logWarn } from '../shared/logging.js';
import { persistAppTelemetryEvent } from '../traces/appTelemetry.js';
import type {
  ExtensionBackendWorkerCapabilityEvent,
  ExtensionBackendWorkerCapabilityRequest,
} from './extensionBackendWorkerProtocol.js';
import { queryConversationMetadata, readConversationMetadata, writeConversationMetadata } from './extensionConversationMetadata.js';
import { createExtensionConversationsCapability } from './extensionConversations.js';
import { publishExtensionEvent } from './extensionEventBus.js';
import { createExtensionModelsCapability } from './extensionModels.js';
import {
  isSystemNotificationAvailable,
  sendNotifyAsSystemNotification,
  setExtensionBadge,
} from './extensionNotifications.js';
import { listExtensionInstallSummaries, setExtensionEnabled } from './extensionRegistry.js';
import { createExtensionGitCapability, createExtensionShellCapability } from './extensionShell.js';
import { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } from './extensionStorage.js';
import { createExtensionWorkspaceCapability } from './extensionWorkspace.js';

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

interface ExtensionBackendCapabilityEvents {
  publish(extensionId: string, event: string, payload: unknown): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityConversations {
  get(extensionId: string, conversationId: string): Promise<unknown> | unknown;
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
  sendMessage?(
    extensionId: string,
    conversationId: string,
    text: string,
    options?: { steer?: boolean; images?: Array<{ data: string; mimeType: string; name?: string }> },
  ): Promise<unknown> | unknown;
  abort?(extensionId: string, conversationId: string): Promise<unknown> | unknown;
  compact?(extensionId: string, conversationId: string, customInstructions?: string): Promise<unknown> | unknown;
  fork?(
    extensionId: string,
    input: { conversationId: string; targetCwd?: string; cwd?: string; title?: string },
  ): Promise<unknown> | unknown;
  setTitle?(extensionId: string, conversationId: string, title: string): Promise<unknown> | unknown;
  rollback?(extensionId: string, conversationId: string, count: number): Promise<unknown> | unknown;
  metadata: {
    get(extensionId: string, input: { conversationId: string; namespace?: string; profile?: string }): Promise<unknown> | unknown;
    set(
      extensionId: string,
      input: { conversationId: string; namespace?: string; values: Record<string, unknown>; profile?: string },
    ): Promise<unknown> | unknown;
    query(
      extensionId: string,
      input: {
        namespace?: string;
        where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
        limit?: number;
        profile?: string;
      },
    ): Promise<unknown> | unknown;
  };
}

interface ExtensionBackendCapabilityExtensions {
  listActions(): unknown;
  getStatus(extensionId: string): unknown;
  setEnabled(extensionId: string, enabled: boolean): unknown;
}

interface ExtensionBackendCapabilityModels {
  list(): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityNotify {
  toast(extensionId: string, message: string, type: 'info' | 'warning' | 'error'): unknown;
  system(extensionId: string, input: {
    message: string;
    title?: string;
    subtitle?: string;
    persistent?: boolean;
    actionPayload?: unknown;
  }): unknown;
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
}

interface ExtensionBackendShellSpawnHandle {
  pid: number | null;
  usingPty: boolean;
  executionWrappers: Array<{ id: string; label?: string }>;
  kill: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
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

interface ExtensionBackendCapabilityUi {
  invalidate(topics: string | string[]): unknown;
}

interface ExtensionBackendCapabilityWorkspace {
  readText(extensionId: string, input: { cwd: string; path: string; maxBytes?: number }): Promise<unknown> | unknown;
  writeText(extensionId: string, input: { cwd: string; path: string; content: string }): Promise<unknown> | unknown;
  list(extensionId: string, input: { cwd: string; path?: string; depth?: number }): Promise<unknown> | unknown;
}

export type ExtensionBackendCapabilityEventEmitter = (event: ExtensionBackendWorkerCapabilityEvent) => void;

export type ExtensionBackendCapabilityDispatcher = (
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: ExtensionBackendCapabilityEventEmitter,
) => Promise<unknown> | unknown;

export interface ExtensionBackendCapabilityDispatcherOptions {
  conversations?: ExtensionBackendCapabilityConversations;
  events?: ExtensionBackendCapabilityEvents;
  extensions?: ExtensionBackendCapabilityExtensions;
  git?: ExtensionBackendCapabilityGit;
  log?: ExtensionBackendCapabilityLogger;
  models?: ExtensionBackendCapabilityModels;
  notify?: ExtensionBackendCapabilityNotify;
  secrets?: ExtensionBackendCapabilitySecrets;
  shell?: ExtensionBackendCapabilityShell;
  storage?: ExtensionBackendCapabilityStorage;
  telemetry?: ExtensionBackendCapabilityTelemetry;
  ui?: ExtensionBackendCapabilityUi;
  workspace?: ExtensionBackendCapabilityWorkspace;
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

function dispatchLogCapability(logger: ExtensionBackendCapabilityLogger, request: ExtensionBackendWorkerCapabilityRequest): undefined {
  if (request.operation !== 'info' && request.operation !== 'warn' && request.operation !== 'error') {
    throw new Error(`Unsupported log capability operation: ${request.operation}`);
  }
  const level = request.operation as ExtensionLogLevel;
  const { message, fields } = normalizeLogInput(request.input);
  logger[level](`extension:${request.extensionId} ${message}`, fields);
  return undefined;
}

function dispatchEventsCapability(events: ExtensionBackendCapabilityEvents, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'publish') {
    throw new Error(`Unsupported events capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Events');
  return events.publish(request.extensionId, requireString(input.event, 'Event name'), input.payload);
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
): unknown {
  const input = normalizeRecordInput(request.input, 'Conversations');

  if (request.operation === 'get') {
    return conversations.get(request.extensionId, requireString(input.conversationId, 'Conversation id'));
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
      ...(input.model === null ? { model: null } : input.model !== undefined ? { model: optionalString(input.model, 'Conversation model') } : {}),
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
      ...(input.targetCwd !== undefined ? { targetCwd: optionalString(input.targetCwd, 'Conversation fork target cwd') } : {}),
      ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Conversation fork cwd') } : {}),
      ...(input.title !== undefined ? { title: optionalString(input.title, 'Conversation fork title') } : {}),
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

  if (request.operation === 'metadata.get') {
    const metadataInput = {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.profile !== undefined ? { profile: optionalString(input.profile, 'Conversation metadata profile') } : {}),
    };
    return conversations.metadata.get(request.extensionId, metadataInput);
  }

  if (request.operation === 'metadata.set') {
    const metadataInput = {
      conversationId: requireString(input.conversationId, 'Conversation id'),
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.profile !== undefined ? { profile: optionalString(input.profile, 'Conversation metadata profile') } : {}),
    };
    const values = optionalRecord(input.values, 'Conversation metadata values');
    if (!values) throw new Error('Conversation metadata values must be an object.');
    return conversations.metadata.set(request.extensionId, { ...metadataInput, values });
  }

  if (request.operation === 'metadata.query') {
    return conversations.metadata.query(request.extensionId, {
      ...(input.namespace !== undefined ? { namespace: optionalString(input.namespace, 'Conversation metadata namespace') } : {}),
      ...(input.profile !== undefined ? { profile: optionalString(input.profile, 'Conversation metadata profile') } : {}),
      ...(input.where !== undefined ? { where: optionalConversationMetadataWhere(input.where) } : {}),
      ...(input.limit !== undefined ? { limit: optionalNumber(input.limit, 'Conversation metadata limit') } : {}),
    });
  }

  throw new Error(`Unsupported conversations capability operation: ${request.operation}`);
}

function dispatchExtensionsCapability(extensions: ExtensionBackendCapabilityExtensions, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation === 'listActions') {
    return extensions.listActions();
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

  throw new Error(`Unsupported extensions capability operation: ${request.operation}`);
}

function dispatchModelsCapability(models: ExtensionBackendCapabilityModels, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'list') {
    throw new Error(`Unsupported models capability operation: ${request.operation}`);
  }
  return models.list();
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
    return git.diff({ cwd: requireString(input.cwd, 'Git cwd'), ...(path === undefined ? {} : { path }), ...(staged === undefined ? {} : { staged }) });
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

function dispatchTelemetryCapability(
  telemetry: ExtensionBackendCapabilityTelemetry,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  if (request.operation !== 'record') {
    throw new Error(`Unsupported telemetry capability operation: ${request.operation}`);
  }
  return telemetry.record(request.extensionId, normalizeTelemetryEvent(request.input));
}

function dispatchSecretsCapability(secrets: ExtensionBackendCapabilitySecrets, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'get') {
    throw new Error(`Unsupported secrets capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Secrets');
  return secrets.get(request.extensionId, requireString(input.secretId, 'Secret id'));
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

function normalizeConversationSendOptions(
  input: Record<string, unknown>,
): { steer?: boolean; images?: Array<{ data: string; mimeType: string; name?: string }> } | undefined {
  const options = {
    ...(input.steer !== undefined ? { steer: optionalBoolean(input.steer, 'Conversation steer') } : {}),
    ...(input.images !== undefined ? { images: normalizeConversationImages(input.images) } : {}),
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
  shellSpawnHandles: Map<string, ExtensionBackendShellSpawnHandle>,
  request: ExtensionBackendWorkerCapabilityRequest,
  emit?: ExtensionBackendCapabilityEventEmitter,
): Promise<unknown> {
  const input = normalizeRecordInput(request.input, 'Shell');

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
    shellSpawnHandles.set(`${request.extensionId}:${handleId}`, handle);
    return { pid: handle.pid, usingPty: handle.usingPty, executionWrappers: handle.executionWrappers };
  }

  const handleId = requireString(input.handleId, 'Shell handleId');
  const handle = shellSpawnHandles.get(`${request.extensionId}:${handleId}`);
  if (!handle) {
    throw new Error(`Shell handle not found: ${handleId}`);
  }

  if (request.operation === 'kill') {
    shellSpawnHandles.delete(`${request.extensionId}:${handleId}`);
    handle.kill();
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

function dispatchUiCapability(ui: ExtensionBackendCapabilityUi, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'invalidate') {
    throw new Error(`Unsupported ui capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'UI');
  const topics = input.topics;
  if (typeof topics !== 'string' && (!Array.isArray(topics) || topics.some((topic) => typeof topic !== 'string'))) {
    throw new Error('UI topics must be a string or array of strings.');
  }
  return ui.invalidate(topics);
}

function dispatchWorkspaceCapability(workspace: ExtensionBackendCapabilityWorkspace, request: ExtensionBackendWorkerCapabilityRequest): unknown {
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

export function createExtensionBackendCapabilityDispatcher(
  options: ExtensionBackendCapabilityDispatcherOptions = {},
): ExtensionBackendCapabilityDispatcher {
  const conversations = options.conversations ?? {
    get: (_extensionId: string, conversationId: string) => createExtensionConversationsCapability().get(conversationId),
    create: (_extensionId: string, input?: Parameters<ReturnType<typeof createExtensionConversationsCapability>['create']>[0]) =>
      createExtensionConversationsCapability().create(input),
    setActiveTools: (_extensionId: string, conversationId: string, toolNames: string[]) =>
      createExtensionConversationsCapability().setActiveTools(conversationId, toolNames),
    appendCustomEntry: (_extensionId: string, conversationId: string, customType: string, data?: unknown) =>
      createExtensionConversationsCapability().appendCustomEntry(conversationId, customType, data),
    appendTranscriptBlock: (
      _extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['appendTranscriptBlock']>[0],
    ) => createExtensionConversationsCapability().appendTranscriptBlock(input),
    updateTranscriptBlock: (
      _extensionId: string,
      input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['updateTranscriptBlock']>[0],
    ) => createExtensionConversationsCapability().updateTranscriptBlock(input),
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
    sendMessage: (
      _extensionId: string,
      conversationId: string,
      text: string,
      options?: { steer?: boolean; images?: Array<{ data: string; mimeType: string; name?: string }> },
    ) => createExtensionConversationsCapability().sendMessage(conversationId, text, options),
    abort: (_extensionId: string, conversationId: string) => createExtensionConversationsCapability().abort(conversationId),
    compact: (_extensionId: string, conversationId: string, customInstructions?: string) =>
      createExtensionConversationsCapability().compact(conversationId, customInstructions),
    fork: (_extensionId: string, input: Parameters<ReturnType<typeof createExtensionConversationsCapability>['fork']>[0]) =>
      createExtensionConversationsCapability().fork(input),
    setTitle: (_extensionId: string, conversationId: string, title: string) =>
      createExtensionConversationsCapability().setTitle(conversationId, title),
    metadata: {
      get: (extensionId: string, input: { conversationId: string; namespace?: string; profile?: string }) =>
        readConversationMetadata({ ...input, extensionId }),
      set: (extensionId: string, input: { conversationId: string; namespace?: string; values: Record<string, unknown>; profile?: string }) =>
        writeConversationMetadata({ ...input, extensionId }),
      query: (
        extensionId: string,
        input: {
          namespace?: string;
          where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
          limit?: number;
          profile?: string;
        },
      ) => queryConversationMetadata({ ...input, namespace: input.namespace?.trim() || extensionId }),
    },
  };
  const events = options.events ?? { publish: publishExtensionEvent };
  const extensions = options.extensions ?? {
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
  };
  const git = options.git ?? createExtensionGitCapability();
  const logger = options.log ?? { info: logInfo, warn: logWarn, error: logError };
  const models = options.models ?? { list: () => createExtensionModelsCapability().list() };
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
  const secrets = options.secrets ?? { get: (extensionId: string, secretId: string) => resolveSecret(extensionId, secretId) };
  const shell = options.shell ?? createExtensionShellCapability();
  const shellSpawnHandles = new Map<string, ExtensionBackendShellSpawnHandle>();
  const telemetry = options.telemetry ?? {
    record: (extensionId: string, event: ExtensionBackendCapabilityTelemetryEvent) => {
      persistAppTelemetryEvent({
        ...event,
        source: event.source ?? 'server',
        metadata: { ...(event.metadata ?? {}), extensionId },
      });
    },
  };
  const ui = options.ui ?? {
    invalidate: (topics: string | string[]) => {
      const items = Array.isArray(topics) ? topics : [topics];
      invalidateAppTopics(...(items as AppEventTopic[]));
    },
  };
  const workspace = options.workspace ?? {
    readText: (extensionId: string, input: { cwd: string; path: string; maxBytes?: number }) =>
      createExtensionWorkspaceCapability(extensionId).readText(input),
    writeText: (extensionId: string, input: { cwd: string; path: string; content: string }) =>
      createExtensionWorkspaceCapability(extensionId).writeText(input),
    list: (extensionId: string, input: { cwd: string; path?: string; depth?: number }) =>
      createExtensionWorkspaceCapability(extensionId).list(input),
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
    if (request.capability === 'conversations') {
      return dispatchConversationsCapability(conversations, request);
    }
    if (request.capability === 'events') {
      return dispatchEventsCapability(events, request);
    }
    if (request.capability === 'extensions') {
      return dispatchExtensionsCapability(extensions, request);
    }
    if (request.capability === 'git') {
      return dispatchGitCapability(git, request);
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
    if (request.capability === 'shell') {
      return dispatchShellCapability(shell, shellSpawnHandles, request, emit);
    }
    if (request.capability === 'secrets') {
      return dispatchSecretsCapability(secrets, request);
    }
    if (request.capability === 'storage') {
      return dispatchStorageCapability(storage, request);
    }
    if (request.capability === 'telemetry') {
      return dispatchTelemetryCapability(telemetry, request);
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
