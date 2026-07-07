import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { callServerModuleExport, importServerModule } from './serverModuleResolver.js';

interface ImageInput {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ExtensionAgentRunTaskInput {
  cwd?: string;
  modelRef?: string;
  thinkingLevel?: string | null;
  prompt: string;
  images?: ImageInput[];
  tools?: 'none' | 'default';
  allowedToolNames?: string[];
  timeoutMs?: number;
}

export interface ExtensionAgentRunTaskResult {
  text: string;
  model?: string;
  provider?: string;
}

export interface ExtensionAgentConversationCreateInput {
  title?: string;
  cwd?: string;
  modelRef?: string;
  thinkingLevel?: string | null;
  tools?: 'none' | 'default';
  allowedToolNames?: string[];
  visibility?: 'hidden' | 'visible';
  persistence?: 'ephemeral' | 'saved';
}

export interface ExtensionAgentConversationSendInput {
  conversationId: string;
  text: string;
  images?: ImageInput[];
  timeoutMs?: number;
}

type ExtensionAgentConversationStreamEvent =
  | { type: 'user_message'; text: string; id?: string; ts?: string }
  | { type: 'agent_start' }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; toolName: string; isError: boolean; durationMs: number; output: string; details?: unknown }
  | { type: 'agent_end'; text?: string }
  | { type: 'turn_end' }
  | { type: 'error'; message: string };

export interface ExtensionAgentConversationStreamResult {
  stream: 'sse';
  events: AsyncIterable<{ event?: string; data?: ExtensionAgentConversationStreamEvent }>;
}

export interface ExtensionAgentConversationSummary {
  id: string;
  ownerExtensionId: string;
  title: string;
  cwd: string;
  model?: string;
  provider?: string;
  visibility: 'hidden' | 'visible';
  persistence: 'ephemeral' | 'saved';
  tools: 'none' | 'default';
  createdAt: string;
  updatedAt: string;
  isBusy: boolean;
  disposed: boolean;
  messageCount: number;
  lastText?: string;
}

export interface ExtensionAgentConversationMessageResult extends ExtensionAgentConversationSummary {
  text: string;
}

interface ExtensionBackendContextLike {
  extensionId?: string;
  toolContext?: { cwd?: string };
  agentToolContext?: unknown;
  runtime?: {
    getLiveSessionResourceOptions?: () => Record<string, unknown>;
  };
  conversations?: {
    create(input?: {
      cwd?: string;
      model?: string | null;
      thinkingLevel?: string | null;
      allowedToolNames?: string[];
    }): Promise<{ id: string }>;
    sendMessage(conversationId: string, text: string): Promise<{ accepted: boolean }>;
    getMeta(conversationId: string): Promise<unknown>;
    list(): Promise<unknown>;
    abort?(conversationId: string): Promise<{ ok: true }>;
  };
}

interface AgentSessionEventLike {
  type?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
  [key: string]: unknown;
}

interface AgentSessionLike {
  abort?: () => Promise<void> | void;
  dispose(): void;
  messages?: unknown[];
  prompt(text: string, options?: { images?: ImageInput[] }): Promise<unknown>;
  subscribe(listener: (event: AgentSessionEventLike) => void): () => void;
}

interface PiModule {
  AuthStorage: {
    create(path: string): unknown;
  };
  ModelRegistry: {
    create(authStorage: unknown, path: string): { getAvailable(): unknown[] };
  };
  SessionManager: {
    inMemory(cwd: string): unknown;
  };
  createAgentSession(options: Record<string, unknown>): Promise<{ session: AgentSessionLike }>;
}

interface ExtensionAgentConversationRecord {
  id: string;
  ownerExtensionId: string;
  title: string;
  cwd: string;
  model: unknown;
  modelRegistry?: unknown;
  liveSessionId?: string;
  tools: 'none' | 'default';
  visibility: 'hidden' | 'visible';
  persistence: 'ephemeral' | 'saved';
  createdAt: string;
  updatedAt: string;
  session?: AgentSessionLike;
  unsubscribe: () => void;
  isBusy: boolean;
  disposed: boolean;
  assistantTexts: string[];
  pendingAbort?: AbortController;
}

const conversations = new Map<string, ExtensionAgentConversationRecord>();
const defaultDynamicImport = importServerModule;
let dynamicImport = defaultDynamicImport;
const PI_CODING_AGENT_PACKAGE = '@earendil-works/pi-coding-agent';
const NEON_PILOT_CORE_PACKAGE = '@neon-pilot/core';
const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');
const EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS = Symbol.for('neon-pilot.extensionHostCapabilityEventHandlers');

interface ExtensionBackendWorkerCapabilityEventLike {
  kind: 'capabilityEvent';
  extensionId: string;
  capability: string;
  operation: string;
  input?: unknown;
}

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
  [EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS]?: Set<(event: ExtensionBackendWorkerCapabilityEventLike) => void>;
};

export function setExtensionAgentDynamicImportForTests(importer: typeof dynamicImport): void {
  dynamicImport = importer;
}

export function resetExtensionAgentDynamicImportForTests(): void {
  dynamicImport = defaultDynamicImport;
  for (const conversation of conversations.values()) disposeRecord(conversation);
  conversations.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

function workerCapabilityEventHandlers(): Set<(event: ExtensionBackendWorkerCapabilityEventLike) => void> {
  const target = globalThis as ExtensionBackendApiGlobal;
  target[EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS] ??= new Set();
  return target[EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS]!;
}

function ownerExtensionId(ctx: ExtensionBackendContextLike): string {
  if (!ctx.extensionId) throw new Error('Extension agent conversations require an extension id.');
  return ctx.extensionId;
}

function resolveOptionalAgentToolContext(ctx: ExtensionBackendContextLike): Record<string, unknown> | undefined {
  const raw = ctx.agentToolContext;
  const candidate = isRecord(raw) && isRecord(raw.toolContext) ? raw.toolContext : raw;
  return isRecord(candidate) ? candidate : undefined;
}

function resolveRuntimeModelsFilePath(ctx: ExtensionBackendContextLike): string | undefined {
  const options = ctx.runtime?.getLiveSessionResourceOptions?.();
  const modelsFilePath = options?.modelsFilePath;
  return typeof modelsFilePath === 'string' && modelsFilePath.trim() ? modelsFilePath : undefined;
}

function modelAcceptsImages(model: unknown): boolean {
  const input = (model as { input?: unknown } | undefined)?.input;
  return Array.isArray(input) && input.includes('image');
}

function extractDs4ToolParameter(text: string, name: string): string | null {
  const match = text.match(new RegExp(`<[^>]*parameter\\s+name="${name}"[^>]*>([\\s\\S]*?)<[^>]*\\/[^>]*parameter>`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function parseDs4RunToolCall(text: string): { toolName: string; params: unknown } | null {
  const directInvoke = text.match(/<Invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/Invoke>/i);
  if (directInvoke?.[1]) {
    const params: Record<string, string> = {};
    const body = directInvoke[2] ?? '';
    const parameterPattern = /<parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/parameter>/gi;
    for (const match of body.matchAll(parameterPattern)) {
      const name = match[1]?.trim();
      if (name) params[name] = (match[2] ?? '').trim();
    }
    return { toolName: directInvoke[1].trim(), params };
  }
  if (!text.includes('run_tool') || !text.includes('toolName')) return null;
  const toolName = extractDs4ToolParameter(text, 'toolName');
  if (!toolName) return null;
  const rawParams = extractDs4ToolParameter(text, 'params');
  if (!rawParams) return { toolName, params: {} };
  try {
    return { toolName, params: JSON.parse(rawParams) };
  } catch {
    return { toolName, params: rawParams };
  }
}

function toolResultText(result: unknown): string {
  if (isRecord(result) && Array.isArray(result.content)) {
    const text = result.content
      .map((entry) =>
        isRecord(entry) && (entry.type === 'text' || entry.type === undefined) && typeof entry.text === 'string' ? entry.text : '',
      )
      .filter(Boolean)
      .join('\n');
    if (text.trim()) return text.trim();
  }
  return JSON.stringify(result, null, 2);
}

function resolveModel(models: unknown[], modelRef: string): unknown | null {
  const normalized = modelRef.trim();
  if (!normalized) return null;
  const slashIndex = normalized.indexOf('/');
  if (slashIndex > 0 && slashIndex < normalized.length - 1) {
    const provider = normalized.slice(0, slashIndex);
    const id = normalized.slice(slashIndex + 1);
    return models.find((model) => (model as { provider?: unknown }).provider === provider && (model as { id?: unknown }).id === id) ?? null;
  }
  return models.find((model) => (model as { id?: unknown }).id === normalized) ?? null;
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (isRecord(part) && part.type === 'text') return typeof part.text === 'string' ? part.text : '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function collectAssistantTexts(session: { messages?: unknown[] }): string[] {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  return messages
    .filter((message) => isRecord(message) && message.role === 'assistant')
    .map((message) => extractTextContent((message as { content?: unknown }).content).trim())
    .filter(Boolean);
}

function readNestedTextDelta(event: unknown): string | null {
  if (!isRecord(event)) return null;
  if (event.type === 'text_delta' && typeof event.delta === 'string') return event.delta;
  if (event.type !== 'message_update' || !isRecord(event.assistantMessageEvent)) return null;
  const assistantEvent = event.assistantMessageEvent;
  return assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string' ? assistantEvent.delta : null;
}

function readPartialToolText(partialResult: unknown): string {
  if (typeof partialResult === 'string') return partialResult;
  if (isRecord(partialResult) && Array.isArray(partialResult.content)) {
    const first = partialResult.content[0];
    if (isRecord(first) && typeof first.text === 'string') return first.text;
  }
  return '';
}

function normalizeSessionEvent(event: unknown): ExtensionAgentConversationStreamEvent | null {
  if (!isRecord(event)) return null;
  const textDelta = readNestedTextDelta(event);
  if (textDelta !== null) return textDelta ? { type: 'text_delta', delta: textDelta } : null;
  if (event.type === 'agent_start') return { type: 'agent_start' };
  if (event.type === 'agent_end') return { type: 'agent_end' };
  if (event.type === 'turn_end') return { type: 'turn_end' };
  if (event.type === 'thinking_delta' && typeof event.delta === 'string')
    return event.delta ? { type: 'thinking_delta', delta: event.delta } : null;
  if (event.type === 'message_update' && isRecord(event.assistantMessageEvent)) {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === 'thinking_delta' && typeof assistantEvent.delta === 'string')
      return assistantEvent.delta ? { type: 'thinking_delta', delta: assistantEvent.delta } : null;
  }
  if (event.type === 'tool_start' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string') {
    return {
      type: 'tool_start',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: isRecord(event.args) ? event.args : {},
    };
  }
  if (event.type === 'tool_update' && typeof event.toolCallId === 'string') {
    if (!readPartialToolText(event.partialResult)) return null;
    return { type: 'tool_update', toolCallId: event.toolCallId, partialResult: event.partialResult };
  }
  if (event.type === 'tool_end' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string') {
    return {
      type: 'tool_end',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError === true,
      durationMs: typeof event.durationMs === 'number' ? event.durationMs : 0,
      output: typeof event.output === 'string' ? event.output : '',
      ...(event.details !== undefined ? { details: event.details } : {}),
    };
  }
  return null;
}

function normalizeLiveSessionEvent(event: unknown): ExtensionAgentConversationStreamEvent | null {
  if (!isRecord(event)) return null;
  if (event.type === 'text_delta' && typeof event.delta === 'string')
    return event.delta ? { type: 'text_delta', delta: event.delta } : null;
  if (event.type === 'thinking_delta' && typeof event.delta === 'string')
    return event.delta ? { type: 'thinking_delta', delta: event.delta } : null;
  if (event.type === 'agent_end') return { type: 'agent_end' };
  if (event.type === 'turn_end') return { type: 'turn_end' };
  if (event.type === 'error' && typeof event.message === 'string') return { type: 'error', message: event.message };
  if (event.type === 'tool_start' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string') {
    return {
      type: 'tool_start',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: isRecord(event.args) ? event.args : {},
    };
  }
  if (event.type === 'tool_update' && typeof event.toolCallId === 'string') {
    if (!readPartialToolText(event.partialResult)) return null;
    return { type: 'tool_update', toolCallId: event.toolCallId, partialResult: event.partialResult };
  }
  if (event.type === 'tool_end' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string') {
    return {
      type: 'tool_end',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError === true,
      durationMs: typeof event.durationMs === 'number' ? event.durationMs : 0,
      output: typeof event.output === 'string' ? event.output : '',
      ...(event.details !== undefined ? { details: event.details } : {}),
    };
  }
  return null;
}

async function assertPermission(ctx: ExtensionBackendContextLike, permission: 'agent:run' | 'agent:conversations'): Promise<void> {
  if (!ctx.extensionId) return;
  await callServerModuleExport(
    '../../extensions/extensionPermissions.js',
    'assertExtensionPermission',
    ctx.extensionId,
    permission,
    'agent conversations',
  );
}

function getAssistantErrorMessage(session: { messages?: unknown[] }): string | null {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== 'assistant') continue;
    if (typeof message.errorMessage === 'string' && message.errorMessage.trim()) return message.errorMessage.trim();
  }
  return null;
}

async function runWithTimeout<T>(operation: Promise<T>, timeoutMs: number | undefined, onTimeout: () => void): Promise<T> {
  if (timeoutMs === undefined) return operation;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Agent task timeoutMs must be a positive integer.');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          onTimeout();
          reject(new Error(`Agent task timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function validateConversationMode(input: ExtensionAgentConversationCreateInput): {
  visibility: 'hidden' | 'visible';
  persistence: 'ephemeral' | 'saved';
} {
  const visibility = input.visibility ?? 'hidden';
  const persistence = input.persistence ?? 'ephemeral';
  if (visibility !== 'hidden' && visibility !== 'visible')
    throw new Error('Extension agent conversations support hidden or visible visibility.');
  if (persistence !== 'ephemeral' && persistence !== 'saved')
    throw new Error('Extension agent conversations support ephemeral or saved persistence.');
  if ((visibility === 'visible') !== (persistence === 'saved'))
    throw new Error('Extension agent conversations support hidden+ephemeral or visible+saved modes.');
  if (input.tools && input.tools !== 'none' && input.tools !== 'default')
    throw new Error('Extension agent conversations support tools="none" or tools="default".');
  if (input.tools === 'none' && input.allowedToolNames && input.allowedToolNames.length > 0)
    throw new Error('Extension agent conversations cannot combine tools="none" with allowedToolNames.');
  return { visibility, persistence };
}

function normalizeAllowedToolNames(input: { tools?: 'none' | 'default'; allowedToolNames?: string[] }): string[] {
  if (input.tools === 'none') return [];
  return [...new Set(input.allowedToolNames ?? [])];
}

function isUnsupportedActiveToolUpdateError(error: unknown): boolean {
  return error instanceof Error && /does not support active tool updates/i.test(error.message);
}

async function createSession(input: ExtensionAgentConversationCreateInput, ctx: ExtensionBackendContextLike) {
  const mode = validateConversationMode(input);
  if (mode.visibility !== 'hidden' || mode.persistence !== 'ephemeral')
    throw new Error('createSession only supports hidden+ephemeral mode.');
  if (input.allowedToolNames && input.allowedToolNames.length > 0)
    throw new Error('Direct extension agent sessions do not support allowedToolNames.');
  const agentCtx = resolveOptionalAgentToolContext(ctx);
  const pi = await dynamicImport<PiModule>(PI_CODING_AGENT_PACKAGE);
  const runtimeDir = await callServerModuleExport<string>(NEON_PILOT_CORE_PACKAGE, 'getPiAgentRuntimeDir');
  const authStorage = pi.AuthStorage.create(join(runtimeDir, 'auth.json'));
  const modelRegistry =
    (agentCtx?.modelRegistry as { getAvailable(): unknown[] } | undefined) ??
    (pi.ModelRegistry.create(authStorage, resolveRuntimeModelsFilePath(ctx) ?? join(runtimeDir, 'models.json')) as {
      getAvailable(): unknown[];
    });
  const model = input.modelRef
    ? resolveModel(modelRegistry.getAvailable(), input.modelRef)
    : (agentCtx?.model ?? modelRegistry.getAvailable()[0]);
  if (!model) throw new Error(`Agent conversation model is not available: ${input.modelRef ?? '(current)'}`);
  const cwd = input.cwd ?? ctx.toolContext?.cwd ?? (typeof agentCtx?.cwd === 'string' ? agentCtx.cwd : process.cwd());
  const { session } = await pi.createAgentSession({
    cwd,
    model: model as never,
    authStorage,
    modelRegistry: modelRegistry as never,
    sessionManager: pi.SessionManager.inMemory(cwd),
    ...(normalizeAllowedToolNames(input).length === 0 ? { noTools: 'all' as const } : {}),
  });
  return { cwd, model, modelRegistry, session: session as AgentSessionLike };
}

async function createHiddenLiveSession(input: ExtensionAgentConversationCreateInput, ctx: ExtensionBackendContextLike) {
  const mode = validateConversationMode(input);
  if (mode.visibility !== 'hidden' || mode.persistence !== 'ephemeral')
    throw new Error('createHiddenLiveSession only supports hidden+ephemeral mode.');
  const agentCtx = resolveOptionalAgentToolContext(ctx);
  const cwd = input.cwd ?? ctx.toolContext?.cwd ?? (typeof agentCtx?.cwd === 'string' ? agentCtx.cwd : process.cwd());
  const options: Record<string, unknown> = {
    ...(input.modelRef ? { initialModel: input.modelRef } : {}),
    ...(input.thinkingLevel !== undefined ? { initialThinkingLevel: input.thinkingLevel } : {}),
    allowedToolNames: normalizeAllowedToolNames(input),
  };
  const created = await callServerModuleExport<{ id: string; sessionFile: string }>(
    '../../conversations/liveSessions.js',
    'createSession',
    cwd,
    options,
  );
  return {
    cwd,
    liveSessionId: created.id,
    model: input.modelRef ? { id: input.modelRef } : (agentCtx?.model ?? {}),
  };
}

function summarize(record: ExtensionAgentConversationRecord): ExtensionAgentConversationSummary {
  const fallbackTexts =
    record.assistantTexts.length > 0 ? record.assistantTexts : record.session ? collectAssistantTexts(record.session) : [];
  const lastText = fallbackTexts.at(-1)?.trim();
  return {
    id: record.id,
    ownerExtensionId: record.ownerExtensionId,
    title: record.title,
    cwd: record.cwd,
    model: (record.model as { id?: string }).id,
    provider: (record.model as { provider?: string }).provider,
    visibility: record.visibility,
    persistence: record.persistence,
    tools: record.tools,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isBusy: record.isBusy,
    disposed: record.disposed,
    messageCount: record.session && Array.isArray(record.session.messages) ? record.session.messages.length : 0,
    ...(lastText ? { lastText } : {}),
  };
}

function summarizeCanonicalConversation(value: unknown, owner: string): ExtensionAgentConversationSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
  const id = value.id.trim();
  const model = typeof value.currentModel === 'string' ? value.currentModel : typeof value.model === 'string' ? value.model : undefined;
  return {
    id,
    ownerExtensionId: owner,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Conversation',
    cwd: typeof value.cwd === 'string' ? value.cwd : '',
    ...(model ? { model } : {}),
    visibility: 'visible',
    persistence: 'saved',
    tools: 'default',
    createdAt: typeof value.timestamp === 'string' ? value.timestamp : typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt:
      typeof value.lastActivityAt === 'string'
        ? value.lastActivityAt
        : typeof value.updatedAt === 'string'
          ? value.updatedAt
          : typeof value.timestamp === 'string'
            ? value.timestamp
            : '',
    isBusy: Boolean(value.running ?? value.isRunning),
    disposed: false,
    messageCount: typeof value.messageCount === 'number' && Number.isFinite(value.messageCount) ? value.messageCount : 0,
  };
}

async function listCanonicalConversationSummaries(
  ctx: ExtensionBackendContextLike,
  owner: string,
): Promise<ExtensionAgentConversationSummary[]> {
  if (!ctx.conversations) return [];
  const listed = await ctx.conversations.list().catch(() => null);
  const raw = Array.isArray(listed) ? listed : isRecord(listed) && Array.isArray(listed.sessions) ? listed.sessions : [];
  return raw
    .map((value) => summarizeCanonicalConversation(value, owner))
    .filter((value): value is ExtensionAgentConversationSummary => value !== null);
}

function getOwnedRecord(conversationId: string, ctx: ExtensionBackendContextLike): ExtensionAgentConversationRecord {
  const record = conversations.get(conversationId);
  if (!record || record.disposed) throw new Error(`Agent conversation not found: ${conversationId}`);
  if (record.ownerExtensionId !== ownerExtensionId(ctx)) throw new Error(`Agent conversation not found: ${conversationId}`);
  return record;
}

function disposeRecord(record: ExtensionAgentConversationRecord): void {
  if (record.disposed) return;
  record.disposed = true;
  record.isBusy = false;
  record.pendingAbort?.abort();
  record.unsubscribe();
  record.session?.dispose();
  if (record.liveSessionId) {
    void callServerModuleExport('../../conversations/liveSessions.js', 'destroySession', record.liveSessionId).catch(() => undefined);
  }
}

async function streamAgentMessageThroughWorkerBridge(
  bridge: NonNullable<ReturnType<typeof workerBridge>>,
  input: ExtensionAgentConversationSendInput,
): Promise<ExtensionAgentConversationStreamResult> {
  const handleId = `agent-stream-${randomUUID()}`;
  async function* events(): AsyncIterable<{ event?: string; data?: ExtensionAgentConversationStreamEvent }> {
    const queue: ExtensionAgentConversationStreamEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;
    let failure: Error | null = null;
    const handlers = workerCapabilityEventHandlers();
    const listener = (event: ExtensionBackendWorkerCapabilityEventLike) => {
      if (event.capability !== 'agent') return;
      const eventInput = isRecord(event.input) ? event.input : {};
      if (eventInput.handleId !== handleId) return;
      if (event.operation === 'streamEvent') {
        queue.push(eventInput.event as ExtensionAgentConversationStreamEvent);
        notify?.();
        notify = null;
      } else if (event.operation === 'streamError') {
        failure = new Error(typeof eventInput.message === 'string' ? eventInput.message : 'Agent stream failed.');
        queue.push({ type: 'error', message: failure.message });
        notify?.();
        notify = null;
      } else if (event.operation === 'streamEnd') {
        done = true;
        notify?.();
        notify = null;
      }
    };
    handlers.add(listener);
    void bridge('agent', 'streamMessage', { handleId, input }).catch((error: unknown) => {
      failure = error instanceof Error ? error : new Error(String(error));
      queue.push({ type: 'error', message: failure.message });
      done = true;
      notify?.();
      notify = null;
    });
    try {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
          continue;
        }
        yield { data: queue.shift()! };
      }
      if (failure) return;
    } finally {
      handlers.delete(listener);
    }
  }
  return { stream: 'sse', events: events() };
}

export async function createAgentConversation(
  input: ExtensionAgentConversationCreateInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentConversationSummary> {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'createConversation', { input }) as Promise<ExtensionAgentConversationSummary>;

  await assertPermission(ctx, 'agent:conversations');
  return createAgentConversationInternal(input, ctx);
}

async function createAgentConversationInternal(
  input: ExtensionAgentConversationCreateInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentConversationSummary> {
  const owner = ownerExtensionId(ctx);
  const mode = validateConversationMode(input);
  const now = new Date().toISOString();
  if (mode.visibility === 'visible') {
    if (!ctx.conversations) throw new Error('Visible saved extension agent conversations require the host conversations capability.');
    const cwd = input.cwd ?? ctx.toolContext?.cwd ?? process.cwd();
    const created = await ctx.conversations.create({
      cwd,
      model: input.modelRef ?? null,
      ...(input.thinkingLevel !== undefined ? { thinkingLevel: input.thinkingLevel } : {}),
      allowedToolNames: normalizeAllowedToolNames(input),
    });
    const record: ExtensionAgentConversationRecord = {
      id: created.id,
      ownerExtensionId: owner,
      title: input.title?.trim() || 'Extension agent conversation',
      cwd,
      model: input.modelRef ? { id: input.modelRef } : {},
      tools: input.tools ?? 'default',
      visibility: 'visible',
      persistence: 'saved',
      createdAt: now,
      updatedAt: now,
      unsubscribe: () => undefined,
      isBusy: false,
      disposed: false,
      assistantTexts: [],
    };
    conversations.set(record.id, record);
    return summarize(record);
  }

  const created = await createHiddenLiveSession(input, ctx).catch(async (error) => {
    if (input.allowedToolNames && input.allowedToolNames.length > 0) {
      if (!isUnsupportedActiveToolUpdateError(error)) throw error;
      return createHiddenLiveSession({ ...input, allowedToolNames: undefined }, ctx);
    }
    return null;
  });
  if (created) {
    const id = `agent_${randomUUID()}`;
    const record: ExtensionAgentConversationRecord = {
      id,
      ownerExtensionId: owner,
      title: input.title?.trim() || 'Extension agent conversation',
      cwd: created.cwd,
      model: created.model,
      liveSessionId: created.liveSessionId,
      tools: input.tools ?? 'default',
      visibility: 'hidden',
      persistence: 'ephemeral',
      createdAt: now,
      updatedAt: now,
      unsubscribe: () => undefined,
      isBusy: false,
      disposed: false,
      assistantTexts: [],
    };
    conversations.set(id, record);
    return summarize(record);
  }

  const direct = await createSession(input, ctx);
  const id = `agent_${randomUUID()}`;
  const record: ExtensionAgentConversationRecord = {
    id,
    ownerExtensionId: owner,
    title: input.title?.trim() || 'Extension agent conversation',
    cwd: direct.cwd,
    model: direct.model,
    modelRegistry: direct.modelRegistry,
    tools: input.tools ?? 'default',
    visibility: 'hidden',
    persistence: 'ephemeral',
    createdAt: now,
    updatedAt: now,
    session: direct.session,
    unsubscribe: () => undefined,
    isBusy: false,
    disposed: false,
    assistantTexts: [],
  };
  record.unsubscribe = direct.session.subscribe((event) => {
    const message = event.message;
    if (event.type === 'message_end' && message?.role === 'assistant') {
      const text = extractTextContent(message.content).trim();
      if (text) record.assistantTexts.push(text);
    }
  });
  conversations.set(id, record);
  return summarize(record);
}

export async function sendAgentMessage(
  input: ExtensionAgentConversationSendInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentConversationMessageResult> {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'sendMessage', { input }) as Promise<ExtensionAgentConversationMessageResult>;

  await assertPermission(ctx, 'agent:conversations');
  return sendAgentMessageInternal(input, ctx);
}

async function sendAgentMessageInternal(
  input: ExtensionAgentConversationSendInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentConversationMessageResult> {
  const record = getOwnedRecord(input.conversationId, ctx);
  if (record.isBusy) throw new Error(`Agent conversation is already busy: ${input.conversationId}`);
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new Error('Agent conversation message text is required.');
  if (record.visibility === 'visible') {
    if ((input.images?.length ?? 0) > 0)
      throw new Error('Visible saved extension agent conversations do not support direct image payloads.');
    if (!ctx.conversations) throw new Error('Visible saved extension agent conversations require the host conversations capability.');
    record.isBusy = true;
    try {
      await runWithTimeout(ctx.conversations.sendMessage(record.id, text), input.timeoutMs, () => {
        record.pendingAbort?.abort();
        void ctx.conversations?.abort?.(record.id);
      });
      record.updatedAt = new Date().toISOString();
      return { ...summarize(record), text: '' };
    } finally {
      record.isBusy = false;
    }
  }

  if (record.liveSessionId) {
    record.isBusy = true;
    let streamedText = '';
    const unsubscribe =
      (await callServerModuleExport<(() => void) | null>(
        '../../conversations/liveSessions.js',
        'subscribe',
        record.liveSessionId,
        (event: unknown) => {
          const normalized = normalizeLiveSessionEvent(event);
          if (normalized?.type === 'text_delta') streamedText += normalized.delta;
        },
      )) ?? (() => undefined);
    try {
      const submitted = await callServerModuleExport<{ completion: Promise<void> }>(
        '../../conversations/liveSessions.js',
        'submitPromptSession',
        record.liveSessionId,
        text,
        undefined,
        input.images,
      );
      await runWithTimeout(submitted.completion, input.timeoutMs, () => {
        void callServerModuleExport('../../conversations/liveSessions.js', 'abortSession', record.liveSessionId);
      });
      if (streamedText.trim()) record.assistantTexts.push(streamedText.trim());
      record.updatedAt = new Date().toISOString();
      return { ...summarize(record), text: streamedText.trim() };
    } finally {
      unsubscribe();
      record.isBusy = false;
    }
  }

  if (!record.session) throw new Error(`Agent conversation session is not available: ${record.id}`);
  if ((input.images?.length ?? 0) > 0 && !modelAcceptsImages(record.model))
    throw new Error(`Agent conversation model does not accept images: ${record.id}`);
  record.isBusy = true;
  const startIndex = record.assistantTexts.length;
  try {
    await runWithTimeout(record.session.prompt(text, input.images?.length ? { images: input.images } : undefined), input.timeoutMs, () => {
      record.pendingAbort?.abort();
      void record.session?.abort?.();
    });
    const assistantError = getAssistantErrorMessage(record.session);
    if (assistantError) throw new Error(assistantError);
    if (record.assistantTexts.length === startIndex) record.assistantTexts.push(...collectAssistantTexts(record.session).slice(startIndex));
    record.updatedAt = new Date().toISOString();
    return { ...summarize(record), text: record.assistantTexts.at(-1)?.trim() || '' };
  } finally {
    record.isBusy = false;
  }
}

export async function streamAgentMessage(
  input: ExtensionAgentConversationSendInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentConversationStreamResult> {
  const bridge = workerBridge();
  if (bridge) return streamAgentMessageThroughWorkerBridge(bridge, input);

  await assertPermission(ctx, 'agent:conversations');
  const record = getOwnedRecord(input.conversationId, ctx);
  if (record.visibility === 'visible') {
    throw new Error('Visible saved extension conversations stream through the host live-session events endpoint.');
  }
  if (record.isBusy) throw new Error(`Agent conversation is already busy: ${input.conversationId}`);
  if (!record.session && !record.liveSessionId) throw new Error(`Agent conversation session is not available: ${record.id}`);
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new Error('Agent conversation message text is required.');
  if ((input.images?.length ?? 0) > 0 && !modelAcceptsImages(record.model))
    throw new Error(`Agent conversation model does not accept images: ${record.id}`);

  async function* events(): AsyncIterable<{ event?: string; data?: ExtensionAgentConversationStreamEvent }> {
    const queue: ExtensionAgentConversationStreamEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;
    let failure: Error | null = null;
    let streamedText = '';
    const enqueue = (event: ExtensionAgentConversationStreamEvent) => {
      if (event.type === 'text_delta') streamedText += event.delta;
      queue.push(event);
      notify?.();
      notify = null;
    };
    const unsubscribe = record.liveSessionId
      ? ((await callServerModuleExport<(() => void) | null>(
          '../../conversations/liveSessions.js',
          'subscribe',
          record.liveSessionId,
          (event: unknown) => {
            const normalized = normalizeLiveSessionEvent(event);
            if (normalized?.type === 'error') failure = new Error(normalized.message);
            if (normalized && normalized.type !== 'agent_end' && normalized.type !== 'turn_end') enqueue(normalized);
          },
          { deferInitialReplayMs: 0 },
        )) ?? (() => undefined))
      : record.session!.subscribe((event) => {
          const normalized = normalizeSessionEvent(event);
          if (normalized) enqueue(normalized);
          if (isRecord(event) && event.type === 'message_end' && isRecord(event.message) && event.message.role === 'assistant') {
            const finalText = extractTextContent(event.message.content).trim();
            if (finalText && !streamedText) enqueue({ type: 'text_delta', delta: finalText });
          }
        });
    if (!record.liveSessionId) {
      // Direct Pi sessions do not emit host snapshot events, so the direct subscription above is enough.
    }
    record.isBusy = true;
    enqueue({ type: 'user_message', text, ts: new Date().toISOString() });
    enqueue({ type: 'agent_start' });
    const promptOperation = record.liveSessionId
      ? callServerModuleExport<{ completion: Promise<void> }>(
          '../../conversations/liveSessions.js',
          'submitPromptSession',
          record.liveSessionId,
          text,
          undefined,
          input.images,
        ).then((submitted) => submitted.completion)
      : record.session!.prompt(text, input.images?.length ? { images: input.images } : undefined);
    void runWithTimeout(promptOperation, input.timeoutMs, () => {
      if (record.liveSessionId) void callServerModuleExport('../../conversations/liveSessions.js', 'abortSession', record.liveSessionId);
      else void record.session?.abort?.();
    })
      .then(() => {
        const assistantError = record.session ? getAssistantErrorMessage(record.session) : null;
        if (assistantError) throw new Error(assistantError);
        if (!streamedText && record.session) {
          const fallback = collectAssistantTexts(record.session!).at(-1)?.trim();
          if (fallback) enqueue({ type: 'text_delta', delta: fallback });
        }
        if (streamedText.trim()) record.assistantTexts.push(streamedText.trim());
        record.updatedAt = new Date().toISOString();
        enqueue({ type: 'agent_end', text: streamedText || record.assistantTexts.at(-1)?.trim() });
        enqueue({ type: 'turn_end' });
      })
      .catch((error: unknown) => {
        failure = error instanceof Error ? error : new Error(String(error));
        enqueue({ type: 'error', message: failure.message });
      })
      .finally(() => {
        record.isBusy = false;
        done = true;
        unsubscribe();
        notify?.();
        notify = null;
      });

    const streamStartedAt = Date.now();
    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        const remainingMs = input.timeoutMs === undefined ? undefined : Math.max(0, input.timeoutMs - (Date.now() - streamStartedAt));
        if (remainingMs !== undefined && remainingMs <= 0) {
          failure = new Error(`Agent task timed out after ${input.timeoutMs}ms.`);
          if (record.liveSessionId)
            void callServerModuleExport('../../conversations/liveSessions.js', 'abortSession', record.liveSessionId);
          else void record.session?.abort?.();
          done = true;
          record.isBusy = false;
          enqueue({ type: 'error', message: failure.message });
          continue;
        }
        await new Promise<void>((resolve) => {
          let timeout: ReturnType<typeof setTimeout> | undefined;
          notify = () => {
            if (timeout) clearTimeout(timeout);
            resolve();
          };
          if (remainingMs !== undefined) {
            timeout = setTimeout(() => {
              notify = null;
              resolve();
            }, remainingMs);
          }
        });
        continue;
      }
      const next = queue.shift()!;
      yield { data: next };
    }
    if (failure) return;
  }
  return { stream: 'sse', events: events() };
}

export async function getAgentConversation(input: { conversationId: string }, ctx: ExtensionBackendContextLike) {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'getConversation', { input });

  await assertPermission(ctx, 'agent:conversations');
  const record = getOwnedRecord(input.conversationId, ctx);
  if (record.visibility === 'visible' && ctx.conversations) {
    const meta = await ctx.conversations.getMeta(record.id).catch(() => null);
    if (isRecord(meta)) {
      if (typeof meta.title === 'string') record.title = meta.title;
      if (typeof meta.cwd === 'string') record.cwd = meta.cwd;
      if (typeof meta.running === 'boolean') record.isBusy = meta.running;
      if (typeof meta.currentModel === 'string') record.model = { id: meta.currentModel };
    }
  }
  return summarize(record);
}

export async function listAgentConversations(_input: unknown, ctx: ExtensionBackendContextLike) {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'listConversations', { input: {} });

  await assertPermission(ctx, 'agent:conversations');
  const owner = ownerExtensionId(ctx);
  const local = Array.from(conversations.values())
    .filter((record) => record.ownerExtensionId === owner && !record.disposed)
    .map(summarize);
  const canonical = await listCanonicalConversationSummaries(ctx, owner);
  const byId = new Map<string, ExtensionAgentConversationSummary>();
  for (const summary of canonical) byId.set(summary.id, summary);
  for (const summary of local) {
    const existing = byId.get(summary.id);
    byId.set(summary.id, existing && summary.visibility === 'visible' ? { ...summary, ...existing } : { ...existing, ...summary });
  }
  return Array.from(byId.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function abortAgentConversation(input: { conversationId: string }, ctx: ExtensionBackendContextLike) {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'abortConversation', { input });

  await assertPermission(ctx, 'agent:conversations');
  const record = getOwnedRecord(input.conversationId, ctx);
  if (record.visibility === 'visible') {
    if (!ctx.conversations?.abort) throw new Error('Visible saved extension agent conversations do not support abort in this host.');
    await ctx.conversations.abort(record.id);
  } else if (record.liveSessionId) {
    await callServerModuleExport('../../conversations/liveSessions.js', 'abortSession', record.liveSessionId);
  } else {
    await record.session?.abort?.();
  }
  record.isBusy = false;
  record.updatedAt = new Date().toISOString();
  return summarize(record);
}

export async function disposeAgentConversation(input: { conversationId: string }, ctx: ExtensionBackendContextLike) {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'disposeConversation', { input });

  await assertPermission(ctx, 'agent:conversations');
  return disposeAgentConversationInternal(input, ctx);
}

function disposeAgentConversationInternal(input: { conversationId: string }, ctx: ExtensionBackendContextLike) {
  const record = getOwnedRecord(input.conversationId, ctx);
  disposeRecord(record);
  conversations.delete(record.id);
  return { ok: true, conversationId: record.id };
}

export async function runAgentTask(
  input: ExtensionAgentRunTaskInput,
  ctx: ExtensionBackendContextLike,
): Promise<ExtensionAgentRunTaskResult> {
  const bridge = workerBridge();
  if (bridge) return bridge('agent', 'runTask', { input }) as Promise<ExtensionAgentRunTaskResult>;

  await assertPermission(ctx, 'agent:run');
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt) throw new Error('Agent task prompt is required.');
  if (input.tools && input.tools !== 'none' && input.tools !== 'default')
    throw new Error('Extension agent tasks support tools="none" or tools="default".');
  if (input.tools === 'none' && input.allowedToolNames && input.allowedToolNames.length > 0)
    throw new Error('Extension agent tasks cannot combine tools="none" with allowedToolNames.');
  if (input.allowedToolNames && input.allowedToolNames.length > 0) {
    const allowedToolNames = new Set(input.allowedToolNames);
    const conversation = await createAgentConversationInternal(
      {
        title: 'Extension agent task',
        cwd: input.cwd,
        modelRef: input.modelRef,
        thinkingLevel: input.thinkingLevel,
        tools: input.tools,
        allowedToolNames: input.allowedToolNames,
        visibility: 'hidden',
        persistence: 'ephemeral',
      },
      ctx,
    );
    try {
      let result = await sendAgentMessageInternal(
        { conversationId: conversation.id, text: prompt, images: input.images, timeoutMs: input.timeoutMs },
        ctx,
      );
      for (let index = 0; index < 16; index += 1) {
        const call = parseDs4RunToolCall(result.text);
        if (!call) break;
        if (!allowedToolNames.has(call.toolName)) {
          throw new Error(`Extension agent task attempted unavailable tool: ${call.toolName}`);
        }
        const record = getOwnedRecord(conversation.id, ctx);
        const toolResult = await callServerModuleExport('../../tools/toolGateway.js', 'invokeToolByName', {
          name: call.toolName,
          input: call.params,
          runtime: {
            ...(input.modelRef ? { modelRef: input.modelRef } : {}),
            directToolNames: [...allowedToolNames],
          },
          toolContext: {
            conversationId: record.liveSessionId ?? record.id,
            sessionId: record.liveSessionId ?? record.id,
            cwd: record.cwd,
          },
        });
        if (isRecord(toolResult) && toolResult.terminate === true) {
          return { text: toolResultText(toolResult), model: result.model, provider: result.provider };
        }
        result = await sendAgentMessageInternal(
          {
            conversationId: conversation.id,
            text: [
              `Tool ${call.toolName} result:`,
              toolResultText(toolResult),
              '',
              'Continue the task. If more tool calls are needed, call the next tool. If the task is complete, answer briefly.',
            ].join('\n'),
            timeoutMs: input.timeoutMs,
          },
          ctx,
        );
      }
      return { text: result.text, model: result.model, provider: result.provider };
    } finally {
      await Promise.resolve(disposeAgentConversationInternal({ conversationId: conversation.id }, ctx)).catch(() => undefined);
    }
  }
  const created = await createSession({ ...input, title: 'Extension agent task', visibility: 'hidden', persistence: 'ephemeral' }, ctx);
  const now = new Date().toISOString();
  const record: ExtensionAgentConversationRecord = {
    id: `agent_${randomUUID()}`,
    ownerExtensionId: ctx.extensionId ?? 'extension-agent-task',
    title: 'Extension agent task',
    cwd: created.cwd,
    model: created.model,
    modelRegistry: created.modelRegistry,
    tools: input.tools ?? 'default',
    visibility: 'hidden',
    persistence: 'ephemeral',
    createdAt: now,
    updatedAt: now,
    session: created.session,
    unsubscribe: () => undefined,
    isBusy: false,
    disposed: false,
    assistantTexts: [],
  };
  record.unsubscribe = created.session.subscribe((event) => {
    const message = event.message;
    if (event.type === 'message_end' && message?.role === 'assistant') {
      const text = extractTextContent(message.content).trim();
      if (text) record.assistantTexts.push(text);
    }
  });
  try {
    if ((input.images?.length ?? 0) > 0 && !modelAcceptsImages(record.model)) {
      throw new Error(`Agent task model does not accept images: ${input.modelRef ?? '(current)'}`);
    }
    const session = created.session;
    await runWithTimeout(session.prompt(prompt, input.images?.length ? { images: input.images } : undefined), input.timeoutMs, () => {
      void session.abort?.();
      session.dispose();
    });
    const assistantError = getAssistantErrorMessage(session);
    if (assistantError) throw new Error(assistantError);
    if (record.assistantTexts.length === 0) record.assistantTexts.push(...collectAssistantTexts(session));
    return {
      text: record.assistantTexts.at(-1)?.trim() || '',
      model: (record.model as { id?: string }).id,
      provider: (record.model as { provider?: string }).provider,
    };
  } finally {
    disposeRecord(record);
  }
}
