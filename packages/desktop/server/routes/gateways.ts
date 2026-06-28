import type { Express, Request, Response } from 'express';

import { listConversationSessionsSnapshot, readSessionDetailForRoute } from '../conversations/conversationService.js';
import {
  abortLiveSessionCapability,
  compactLiveSessionCapability,
  createLiveSessionCapability,
  submitLiveSessionPromptCapability,
} from '../conversations/liveSessionCapability.js';
import {
  getAvailableModelObjects,
  registerLiveSessionLifecycleHandler,
  renameSession,
  subscribe as subscribeLiveSessionEvents,
  updateLiveSessionModelPreferences,
} from '../conversations/liveSessions.js';
import type { TelegramGatewayHostApi } from '../extensions/backendApi/gateways.js';
import { TELEGRAM_GATEWAY_HOST_API_GLOBAL } from '../extensions/backendApi/gateways.js';
import { listExtensionGatewayProviderRegistrations } from '../extensions/extensionRegistry.js';
import {
  attachGatewayConversation,
  defaultGatewayProviders,
  detachGatewayConversation,
  ensureGatewayConnection,
  type GatewayProviderId,
  type GatewayProviderSummary,
  type GatewayStatus,
  normalizeGatewayProviderId,
  readGatewayState,
  recordGatewayEvent,
  updateGatewayConnectionStatus,
  upsertGatewayChatTarget,
} from '../gateways/gatewayState.js';
import { readTelegramAccessPolicy, writeTelegramAccessPolicy } from '../gateways/telegramAccess.js';
import { readTelegramBotToken, removeTelegramBotToken, writeTelegramBotToken } from '../gateways/telegramAuth.js';
import type { TelegramGatewayConversationSummary, TelegramGatewayTranscriptEntry } from '../gateways/telegramGateway.js';
import { TelegramGatewayRuntime } from '../gateways/telegramGateway.js';
import { logError } from '../middleware/index.js';
import { invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { transcribeAudio } from '../transcription/transcriptionService.js';
import type { ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for gateway routes');
};
let getStateRootFn: () => string = () => {
  throw new Error('getStateRoot not initialized for gateway routes');
};
let getAuthFileFn: () => string = () => {
  throw new Error('getAuthFile not initialized for gateway routes');
};
let routeContext: ServerRouteContext | null = null;
let telegramRuntime: TelegramGatewayRuntime | null = null;
let lifecycleRegistered = false;
let unregisterTelegramLifecycleDelivery: (() => void) | null = null;
const lastTelegramUserDeliveryByConversation = new Map<string, string>();
const lastTelegramDeliveryByConversation = new Map<string, string>();
const TELEGRAM_GATEWAY_LIST_LIMIT = 200;
const TELEGRAM_LIFECYCLE_DELIVERY_ATTEMPTS = 6;
const TELEGRAM_LIFECYCLE_DELIVERY_RETRY_MS = 500;

type TelegramTranscriptBlock =
  | { type: 'user'; text: string; ts?: string; id?: unknown; blockId?: unknown; entryId?: unknown }
  | { type: 'text'; text: string; ts?: string; id?: unknown; blockId?: unknown; entryId?: unknown }
  | { type: 'summary'; title: string; text?: string; detail?: string; ts?: string }
  | { type: 'tool_use'; tool: string; status?: 'running' | 'ok' | 'error'; output?: string; outputDeferred?: boolean; ts?: string };

interface TelegramLifecycleMessage {
  text: string;
  timestamp?: string;
  deliveryKey: string;
}

function publishTelegramGatewayHostApi(): void {
  (globalThis as typeof globalThis & { __neonPilotTelegramGatewayHostApi?: TelegramGatewayHostApi })[TELEGRAM_GATEWAY_HOST_API_GLOBAL] = {
    registerTelegramGatewayLifecycleDelivery,
    startTelegramGatewayRuntime,
    stopTelegramGatewayRuntime,
    readTelegramGatewayRuntimeStatus,
    readGatewayState: readCurrentGatewayState,
    ensureGatewayConnection: (input) => {
      const provider = requireRegisteredGatewayProvider(input.provider);
      ensureGatewayConnection({ ...currentGatewayContext(), provider });
      return readCurrentGatewayStateAfterMutation();
    },
    updateGatewayConnectionStatus: (input) => {
      const provider = requireRegisteredGatewayProvider(input.provider);
      const status = readStatus(input.status);
      if (!status) throw new Error('Gateway status is invalid.');
      updateGatewayConnectionStatus({
        ...currentGatewayContext(),
        provider,
        status,
        enabled: input.enabled,
        statusMessage: input.statusMessage,
      });
      return readCurrentGatewayStateAfterMutation();
    },
    attachGatewayConversation: (input) => {
      const provider = requireRegisteredGatewayProvider(input.provider);
      attachGatewayConversation({
        ...currentGatewayContext(),
        provider,
        conversationId: input.conversationId,
        conversationTitle: input.conversationTitle,
        externalChatId: input.externalChatId,
        externalChatLabel: input.externalChatLabel,
      });
      return readCurrentGatewayStateAfterMutation();
    },
    detachGatewayConversation: (input) => {
      const provider = input.provider === undefined ? undefined : requireRegisteredGatewayProvider(input.provider);
      detachGatewayConversation({ ...currentGatewayContext(), provider, conversationId: input.conversationId });
      return readCurrentGatewayStateAfterMutation();
    },
    recordGatewayEvent: (input) => {
      const provider = requireRegisteredGatewayProvider(input.provider);
      const kind =
        input.kind === 'inbound' ||
        input.kind === 'outbound' ||
        input.kind === 'routing' ||
        input.kind === 'status' ||
        input.kind === 'error'
          ? input.kind
          : null;
      if (!kind) throw new Error('Gateway event kind is invalid.');
      recordGatewayEvent({ ...currentGatewayContext(), provider, conversationId: input.conversationId, kind, message: input.message });
      return readCurrentGatewayStateAfterMutation();
    },
  };
}

function initializeGatewayRoutesContext(context: ServerRouteContext): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  getStateRootFn = context.getStateRoot;
  getAuthFileFn = context.getAuthFile;
  routeContext = context;
  unregisterTelegramLifecycleDelivery?.();
  unregisterTelegramLifecycleDelivery = null;
  lifecycleRegistered = false;
  lastTelegramUserDeliveryByConversation.clear();
  lastTelegramDeliveryByConversation.clear();
  publishTelegramGatewayHostApi();
}

export function registerTelegramGatewayLifecycleDelivery(): void {
  if (lifecycleRegistered) return;
  lifecycleRegistered = true;
  unregisterTelegramLifecycleDelivery = registerLiveSessionLifecycleHandler(async (event) => {
    if (event.trigger !== 'turn_end') return;
    for (let attempt = 0; attempt < TELEGRAM_LIFECYCLE_DELIVERY_ATTEMPTS; attempt += 1) {
      const handled = await deliverTelegramLifecycleTurn(event.conversationId);
      if (handled) return;
      await sleep(TELEGRAM_LIFECYCLE_DELIVERY_RETRY_MS);
    }
  });
}

async function deliverTelegramLifecycleTurn(conversationId: string): Promise<boolean> {
  const turn = await readLatestTelegramLifecycleTurn(conversationId);
  const runtime = ensureTelegramRuntime();
  if (turn.userPrompt && lastTelegramUserDeliveryByConversation.get(conversationId) !== turn.userPrompt.deliveryKey) {
    const delivered = await runtime.deliverDesktopUserPrompt({ conversationId, text: turn.userPrompt.text });
    if (delivered) {
      lastTelegramUserDeliveryByConversation.set(conversationId, turn.userPrompt.deliveryKey);
    }
  }
  const reply = turn.assistantReply;
  if (reply && lastTelegramDeliveryByConversation.get(conversationId) !== reply.deliveryKey) {
    if (runtime.hasRecentlyDeliveredAssistantReply({ conversationId, text: reply.text })) {
      lastTelegramDeliveryByConversation.set(conversationId, reply.deliveryKey);
    } else {
      const delivered = await runtime.deliverAssistantReply({ conversationId, text: reply.text });
      if (delivered) {
        lastTelegramDeliveryByConversation.set(conversationId, reply.deliveryKey);
      }
    }
  }
  return Boolean(reply);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentGatewayContext(): { stateRoot: string; profile: string } {
  return { stateRoot: getStateRootFn(), profile: getRuntimeScopeFn() };
}

function currentGatewayReadContext(): { stateRoot: string; profile: string; providers: GatewayProviderSummary[] } {
  return { ...currentGatewayContext(), providers: listGatewayProviderSummaries() };
}

function readCurrentGatewayState() {
  return readGatewayState(currentGatewayReadContext());
}

function readCurrentGatewayStateAfterMutation() {
  invalidateGatewayState();
  return readCurrentGatewayState();
}

function listGatewayProviderSummaries(): GatewayProviderSummary[] {
  const contributed = listExtensionGatewayProviderRegistrations(getStateRootFn()).map(
    (provider): GatewayProviderSummary => ({
      id: provider.id,
      label: provider.label,
      ...(provider.description ? { description: provider.description } : {}),
      ...(provider.icon ? { icon: provider.icon } : {}),
      implemented: provider.implemented,
      configurationLocation: provider.configurationLocation,
      extensionId: provider.extensionId,
      ...(provider.setupRoute ? { setupRoute: provider.setupRoute } : {}),
      ...(provider.docsUrl ? { docsUrl: provider.docsUrl } : {}),
      ...(provider.order !== undefined ? { order: provider.order } : {}),
    }),
  );
  return [...contributed, ...defaultGatewayProviders()];
}

function liveSessionContext(context: ServerRouteContext) {
  return {
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getDefaultWebCwd: context.getDefaultWebCwd,
    buildLiveSessionResourceOptions: context.buildLiveSessionResourceOptions,
    buildLiveSessionExtensionFactories: context.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
    listTasksForRuntimeScope: context.listTasksForRuntimeScope,
    listMemoryDocs: context.listMemoryDocs,
  };
}

function listTelegramGatewayConversations(
  context: ServerRouteContext,
  input: { scope?: 'active' | 'archived' | 'all'; query?: string } = {},
): TelegramGatewayConversationSummary[] {
  const scope = input.scope ?? 'active';
  const query = input.query?.trim().toLowerCase() ?? '';
  const sessions = listConversationSessionsSnapshot({
    includeLive: true,
    limit: TELEGRAM_GATEWAY_LIST_LIMIT,
    profile: context.getRuntimeScope(),
  });
  const saved = context.getSavedUiPreferences();
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const archivedIds = new Set(saved.archivedConversationIds);
  const activeIds = uniqueStrings([...saved.pinnedConversationIds, ...saved.openConversationIds, saved.activeConversationId ?? '']).filter(
    (id) => !archivedIds.has(id),
  );

  const active = activeIds.flatMap((id) => {
    const session = sessionById.get(id);
    return session ? [toTelegramConversationSummary(session, 'active')] : [];
  });
  const archived = saved.archivedConversationIds.flatMap((id) => {
    const session = sessionById.get(id);
    return session ? [toTelegramConversationSummary(session, 'archived')] : [];
  });

  const activeSet = new Set(active.map((session) => session.id));
  const archivedSet = new Set(archived.map((session) => session.id));
  const closed = sessions
    .filter((session) => !activeSet.has(session.id) && !archivedSet.has(session.id))
    .map((session) => toTelegramConversationSummary(session, 'closed'));

  const scoped = scope === 'active' ? active : scope === 'archived' ? archived : [...active, ...archived, ...closed];
  if (!query) return scoped;
  return scoped.filter((session) =>
    [session.id, session.title ?? '', session.snippet ?? ''].some((value) => value.toLowerCase().includes(query)),
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function toTelegramConversationSummary(
  session: ReturnType<typeof listConversationSessionsSnapshot>[number],
  placement: 'active' | 'archived' | 'closed',
): TelegramGatewayConversationSummary {
  return {
    id: session.id,
    title: session.title,
    updatedAt: session.lastActivityAt ?? session.timestamp,
    snippet: session.isRunning ? 'running' : undefined,
    placement,
  };
}

export function ensureTelegramRuntime(): TelegramGatewayRuntime {
  if (!routeContext) {
    throw new Error('Gateway routes are not initialized');
  }
  if (telegramRuntime) {
    return telegramRuntime;
  }
  const context = routeContext;
  telegramRuntime = new TelegramGatewayRuntime({
    stateRoot: context.getStateRoot(),
    profile: context.getRuntimeScope(),
    authFile: context.getAuthFile(),
    readBotToken: () => readTelegramBotToken(context.getAuthFile(), context.getStateRoot()),
    readAccessPolicy: () => readTelegramAccessPolicy(context.getStateRoot(), context.getRuntimeScope()),
    listConversations: (input) => listTelegramGatewayConversations(context, input),
    listModels: async () =>
      (await getAvailableModelObjects()).map((model) => ({
        id: model.id,
      })),
    createConversation: async (input) => {
      const created = await createLiveSessionCapability(
        {
          ...(input.cwd ? { cwd: input.cwd } : {}),
          ...(input.model !== undefined ? { model: input.model } : {}),
        },
        liveSessionContext(context),
      );
      renameSession(created.id, input.title);
      return { id: created.id };
    },
    notifyNewConversation: (conversationId) => {
      publishAppEvent({ type: 'open_session', sessionId: conversationId });
    },
    submitPrompt: async (input) => {
      await submitLiveSessionPromptCapability(
        { conversationId: input.conversationId, text: input.text, images: input.images },
        liveSessionContext(context),
      );
    },
    readLatestAssistantReply,
    readConversationTail,
    subscribeConversationEvents: (conversationId, listener) => subscribeLiveSessionEvents(conversationId, listener, { tailBlocks: 0 }),
    transcribeAudio,
    renameConversation: (conversationId, title) => renameSession(conversationId, title),
    compactConversation: async (conversationId) => {
      await compactLiveSessionCapability({ conversationId });
    },
    abortConversation: async (conversationId) => {
      await abortLiveSessionCapability({ conversationId });
    },
    readConversationStatus: async (conversationId) => readTelegramConversationStatus(conversationId),
    archiveConversation: async (conversationId) => {
      detachGatewayConversation({
        stateRoot: context.getStateRoot(),
        profile: context.getRuntimeScope(),
        provider: 'telegram',
        conversationId,
      });
    },
    getCurrentModel: () => null,
    setModel: async (conversationId, model) => {
      await updateLiveSessionModelPreferences(conversationId, { model }, await getAvailableModelObjects());
    },
  });
  return telegramRuntime;
}

async function readTelegramConversationStatus(
  conversationId: string,
): Promise<{ state: 'idle' | 'running' | 'queued' | 'unknown'; detail?: string }> {
  const sessions = listConversationSessionsSnapshot({
    includeLive: true,
    limit: TELEGRAM_GATEWAY_LIST_LIMIT,
    profile: getRuntimeScopeFn(),
  });
  const session = sessions.find((candidate) => candidate.id === conversationId);
  if (!session) return { state: 'unknown', detail: 'conversation not found' };
  if (session.isRunning) return { state: 'running' };
  return { state: 'idle' };
}

function readProvider(value: unknown): GatewayProviderId | null {
  return normalizeGatewayProviderId(value);
}

function hasRegisteredProvider(provider: GatewayProviderId): boolean {
  return listGatewayProviderSummaries().some((candidate) => candidate.id === provider);
}

function requireRegisteredGatewayProvider(value: unknown): GatewayProviderId {
  const provider = readProvider(value);
  if (!provider || !hasRegisteredProvider(provider)) {
    throw new Error('Gateway provider is not registered.');
  }
  return provider;
}

function readStatus(value: unknown): GatewayStatus | null {
  return value === 'needs_config' || value === 'connected' || value === 'active' || value === 'paused' || value === 'needs_attention'
    ? value
    : null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readTelegramIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!/^-?\d+$/.test(trimmed)) return null;
    if (!result.includes(trimmed)) result.push(trimmed);
  }
  return result;
}

function invalidateGatewayState(): void {
  invalidateAppTopics('gateways', 'sessions');
}

function startTelegramRuntimeWithDelivery(): void {
  registerTelegramGatewayLifecycleDelivery();
  const runtime = ensureTelegramRuntime();
  runtime.start();
  runtime.startMirroringBoundConversations();
}

export function startTelegramGatewayRuntime(): { running: boolean } {
  const initialTelegramState = readCurrentGatewayState().connections.find((connection) => connection.provider === 'telegram');
  if (initialTelegramState?.enabled && readTelegramBotToken(getAuthFileFn(), getStateRootFn())) {
    startTelegramRuntimeWithDelivery();
    return { running: true };
  }
  return { running: false };
}

export function stopTelegramGatewayRuntime(): { running: false } {
  telegramRuntime?.stop();
  return { running: false };
}

export function readTelegramGatewayRuntimeStatus(): { running: boolean } {
  return { running: telegramRuntime?.isRunning() ?? false };
}

async function readLatestAssistantReply(conversationId: string): Promise<{ text: string; timestamp?: string; deliveryKey: string } | null> {
  return (await readLatestTelegramLifecycleTurn(conversationId)).assistantReply;
}

async function readLatestTelegramLifecycleTurn(
  conversationId: string,
): Promise<{ userPrompt: TelegramLifecycleMessage | null; assistantReply: TelegramLifecycleMessage | null }> {
  const { sessionRead } = await readSessionDetailForRoute({ conversationId, profile: getRuntimeScopeFn(), tailBlocks: 20 });
  const blocks = [...(sessionRead.detail?.blocks ?? [])].reverse() as TelegramTranscriptBlock[];
  return {
    userPrompt: readLatestTelegramLifecycleMessage(blocks, 'user'),
    assistantReply: readLatestTelegramLifecycleMessage(blocks, 'text'),
  };
}

function readLatestTelegramLifecycleMessage(
  reversedBlocks: TelegramTranscriptBlock[],
  type: 'user' | 'text',
): TelegramLifecycleMessage | null {
  const block = reversedBlocks.find((candidate) => candidate.type === type);
  if (!block || (block.type !== 'user' && block.type !== 'text')) return null;
  const text = block.text.trim();
  if (!text) return null;
  const identity = [block.id, block.blockId, block.entryId].find((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    text,
    timestamp: typeof block.ts === 'string' ? block.ts : undefined,
    deliveryKey: identity ? `block:${identity}` : `text:${text}`,
  };
}

async function readConversationTail(conversationId: string, count: number): Promise<TelegramGatewayTranscriptEntry[]> {
  const safeCount = Math.min(Math.max(Math.trunc(count), 1), 50);
  const tailBlocks = Math.min(Math.max(safeCount * 4, 20), 200);
  const { sessionRead } = await readSessionDetailForRoute({ conversationId, profile: getRuntimeScopeFn(), tailBlocks });
  return (sessionRead.detail?.blocks ?? [])
    .flatMap((block) => telegramTranscriptEntryFromBlock(block as TelegramTranscriptBlock))
    .filter((entry) => entry.text.trim().length > 0)
    .slice(-safeCount);
}

function telegramTranscriptEntryFromBlock(block: TelegramTranscriptBlock): TelegramGatewayTranscriptEntry[] {
  switch (block.type) {
    case 'user':
      return [{ role: 'user', text: block.text, timestamp: block.ts }];
    case 'text':
      return [{ role: 'assistant', text: block.text, timestamp: block.ts }];
    case 'summary':
      return [
        {
          role: 'system',
          text: [block.title, block.text || block.detail].filter(Boolean).join(': '),
          timestamp: block.ts,
        },
      ];
    case 'tool_use': {
      const state = block.status === 'running' ? 'running' : block.status === 'error' ? 'failed' : 'finished';
      const output = block.outputDeferred ? 'output deferred' : block.output;
      return [{ role: 'tool', text: `${block.tool} ${state}${output ? `: ${output}` : ''}`, timestamp: block.ts }];
    }
    default:
      return [];
  }
}

function handleGatewayError(res: Response, err: unknown): void {
  logError('request handler error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: String(err) });
}

export function registerGatewayRoutes(router: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>, context: ServerRouteContext): void {
  initializeGatewayRoutesContext(context);
  try {
    startTelegramGatewayRuntime();
  } catch (err) {
    logError('gateway runtime startup failed', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
  router.get('/api/gateways', (_req, res) => {
    try {
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.post('/api/gateways/connections', (req: Request, res: Response) => {
    try {
      const provider = readProvider(req.body?.provider);
      if (!provider || !hasRegisteredProvider(provider)) {
        res.status(400).json({ error: 'provider must be a registered gateway provider' });
        return;
      }
      ensureGatewayConnection({ ...currentGatewayContext(), provider });
      invalidateGatewayState();
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.patch('/api/gateways/connections/:provider', (req: Request, res: Response) => {
    try {
      const provider = readProvider(req.params.provider);
      const status = readStatus(req.body?.status);
      if (!provider || !hasRegisteredProvider(provider) || !status) {
        res.status(400).json({ error: 'provider and status are required' });
        return;
      }
      const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined;
      const statusMessage = readOptionalString(req.body?.statusMessage);
      if (
        provider === 'telegram' &&
        (enabled === true || status === 'active' || status === 'connected') &&
        !readTelegramBotToken(getAuthFileFn(), getStateRootFn())
      ) {
        res.status(400).json({ error: 'Save a Telegram bot token before enabling the gateway.' });
        return;
      }
      updateGatewayConnectionStatus({ ...currentGatewayContext(), provider, status, enabled, statusMessage });
      if (provider === 'telegram') {
        if (enabled === false || status === 'paused' || status === 'needs_attention') {
          ensureTelegramRuntime().stop();
        } else {
          startTelegramRuntimeWithDelivery();
        }
      }
      invalidateGatewayState();
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.get('/api/gateways/telegram/token', (_req, res) => {
    try {
      res.json({ configured: readTelegramBotToken(getAuthFileFn(), getStateRootFn()) !== null });
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.get('/api/gateways/telegram/access', (_req, res) => {
    try {
      res.json(readTelegramAccessPolicy(getStateRootFn(), getRuntimeScopeFn()));
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.patch('/api/gateways/telegram/access', (req: Request, res: Response) => {
    try {
      const approvedUserIds = readTelegramIdList(req.body?.approvedUserIds);
      const approvedChatIds = readTelegramIdList(req.body?.approvedChatIds);
      if (!approvedUserIds || !approvedChatIds) {
        res.status(400).json({ error: 'Telegram access IDs must be numeric. Chat IDs may start with -.' });
        return;
      }
      const policy = writeTelegramAccessPolicy(getStateRootFn(), getRuntimeScopeFn(), { approvedUserIds, approvedChatIds });
      invalidateGatewayState();
      res.json(policy);
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.post('/api/gateways/telegram/test', async (_req: Request, res: Response) => {
    try {
      const token = readTelegramBotToken(getAuthFileFn(), getStateRootFn());
      if (!token) {
        res.status(400).json({ error: 'Telegram bot token is required' });
        return;
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        description?: string;
        result?: { id?: number; username?: string; first_name?: string };
      };
      if (!response.ok || payload.ok !== true) {
        res.status(502).json({ ok: false, error: payload.description || 'Telegram getMe failed' });
        return;
      }
      res.json({ ok: true, bot: payload.result ?? null });
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.post('/api/gateways/telegram/token', (req: Request, res: Response) => {
    try {
      const token = readOptionalString(req.body?.token);
      if (!token) {
        res.status(400).json({ error: 'token required' });
        return;
      }
      writeTelegramBotToken(getAuthFileFn(), getStateRootFn(), token);
      ensureGatewayConnection({ ...currentGatewayContext(), provider: 'telegram' });
      updateGatewayConnectionStatus({ ...currentGatewayContext(), provider: 'telegram', status: 'active', enabled: true });
      startTelegramRuntimeWithDelivery();
      invalidateGatewayState();
      res.json({ configured: true, state: readCurrentGatewayState() });
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.delete('/api/gateways/telegram/token', (_req, res) => {
    try {
      removeTelegramBotToken(getAuthFileFn(), getStateRootFn());
      ensureTelegramRuntime().stop();
      updateGatewayConnectionStatus({
        ...currentGatewayContext(),
        provider: 'telegram',
        status: 'needs_config',
        enabled: false,
        statusMessage: 'Telegram bot token removed',
      });
      invalidateGatewayState();
      res.json({ configured: false, state: readCurrentGatewayState() });
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.post('/api/gateways/telegram/chat', (req: Request, res: Response) => {
    try {
      const chatId = readOptionalString(req.body?.chatId);
      if (!chatId) {
        res.status(400).json({ error: 'chatId required' });
        return;
      }
      ensureGatewayConnection({ ...currentGatewayContext(), provider: 'telegram' });
      upsertGatewayChatTarget({
        ...currentGatewayContext(),
        provider: 'telegram',
        externalChatId: chatId,
        externalChatLabel: readOptionalString(req.body?.chatLabel) ?? chatId,
        conversationId: '',
        conversationTitle: '',
        repliesEnabled: false,
      });
      invalidateGatewayState();
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.post('/api/gateways/bindings', (req: Request, res: Response) => {
    try {
      const provider = readProvider(req.body?.provider);
      const conversationId = readOptionalString(req.body?.conversationId);
      if (!provider || !hasRegisteredProvider(provider) || !conversationId) {
        res.status(400).json({ error: 'provider and conversationId are required' });
        return;
      }
      attachGatewayConversation({
        ...currentGatewayContext(),
        provider,
        conversationId,
        conversationTitle: readOptionalString(req.body?.conversationTitle),
        externalChatId: readOptionalString(req.body?.externalChatId),
        externalChatLabel: readOptionalString(req.body?.externalChatLabel),
      });
      if (provider === 'telegram') {
        ensureTelegramRuntime().startMirroringConversation(conversationId);
      }
      invalidateGatewayState();
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });

  router.delete('/api/gateways/bindings/:conversationId', (req: Request, res: Response) => {
    try {
      const provider = readProvider(req.query.provider);
      detachGatewayConversation({
        ...currentGatewayContext(),
        provider: provider ?? undefined,
        conversationId: req.params.conversationId,
      });
      invalidateGatewayState();
      res.json(readCurrentGatewayState());
    } catch (err) {
      handleGatewayError(res, err);
    }
  });
}
