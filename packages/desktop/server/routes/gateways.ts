import type { Express, Request, Response } from 'express';

import { listConversationSessionsSnapshot, readSessionDetailForRoute } from '../conversations/conversationService.js';
import {
  compactLiveSessionCapability,
  createLiveSessionCapability,
  submitLiveSessionPromptCapability,
} from '../conversations/liveSessionCapability.js';
import { registerLiveSessionLifecycleHandler } from '../conversations/liveSessionLifecycle.js';
import {
  getAvailableModelObjects,
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
const lastTelegramDeliveryByConversation = new Map<string, string>();

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
  lifecycleRegistered = false;
  lastTelegramDeliveryByConversation.clear();
  publishTelegramGatewayHostApi();
}

export function registerTelegramGatewayLifecycleDelivery(): void {
  if (lifecycleRegistered) return;
  lifecycleRegistered = true;
  registerLiveSessionLifecycleHandler(async (event) => {
    if (event.trigger !== 'turn_end') return;
    const reply = await readLatestAssistantReply(event.conversationId);
    if (reply && lastTelegramDeliveryByConversation.get(event.conversationId) !== reply.deliveryKey) {
      const runtime = ensureTelegramRuntime();
      if (runtime.hasRecentlyDeliveredAssistantReply({ conversationId: event.conversationId, text: reply.text })) {
        lastTelegramDeliveryByConversation.set(event.conversationId, reply.deliveryKey);
        return;
      }
      const delivered = await runtime.deliverAssistantReply({ conversationId: event.conversationId, text: reply.text });
      if (delivered) {
        lastTelegramDeliveryByConversation.set(event.conversationId, reply.deliveryKey);
      }
    }
  });
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
    listConversations: () =>
      listConversationSessionsSnapshot({ includeLive: true, limit: 50, profile: context.getRuntimeScope() }).map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.lastActivityAt ?? session.timestamp,
      })),
    listModels: async () =>
      (await getAvailableModelObjects()).map((model) => ({
        id: model.id,
      })),
    createConversation: async (input) => {
      const created = await createLiveSessionCapability({}, liveSessionContext(context));
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
    subscribeConversationEvents: (conversationId, listener) => subscribeLiveSessionEvents(conversationId, listener, { tailBlocks: 0 }),
    transcribeAudio,
    renameConversation: (conversationId, title) => renameSession(conversationId, title),
    compactConversation: async (conversationId) => {
      await compactLiveSessionCapability({ conversationId });
    },
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
  ensureTelegramRuntime().start();
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
  const { sessionRead } = await readSessionDetailForRoute({ conversationId, profile: getRuntimeScopeFn(), tailBlocks: 20 });
  const block = [...(sessionRead.detail?.blocks ?? [])].reverse().find((candidate) => candidate.type === 'text');
  if (!block || block.type !== 'text') return null;
  const text = block.text.trim();
  if (!text) return null;
  const candidate = block as typeof block & { id?: unknown; blockId?: unknown; entryId?: unknown };
  const identity = [candidate.id, candidate.blockId, candidate.entryId].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return {
    text,
    timestamp: typeof block.ts === 'string' ? block.ts : undefined,
    deliveryKey: identity ? `block:${identity}` : `text:${text}`,
  };
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
