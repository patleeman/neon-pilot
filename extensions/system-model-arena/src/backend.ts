import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const SETTINGS_KEY = 'settings';
const STATS_KEY = 'stats/models';
const DUEL_PREFIX = 'duels/';
const BLOCK_TYPE = 'model_arena_duel';
const UNSUPPORTED_CHALLENGER_PROVIDERS = new Set(['openai-codex']);
const STALE_RUNNING_DUEL_MS = 6 * 60 * 60 * 1000;
const ARENA_STATE_RECOVERY_TIMEOUT_MS = 1_500;
const ARENA_MODEL_LIST_TIMEOUT_MS = 2_500;

type Choice = 'a' | 'b' | 'tie' | 'neither';
type DuelStatus = 'running' | 'ready' | 'failed' | 'voted' | 'cancelled';
type Side = 'primary' | 'challenger';

interface Settings {
  automaticDuels: boolean;
  sampleRate: number;
  rampDownAfterVotes: number;
  rampedSampleRate: number;
  challengerModels: string[];
  minPromptChars: number;
}

interface Duel {
  id: string;
  conversationId: string;
  blockId: string;
  prompt: string;
  taskType: string;
  primaryModel: string;
  primaryProvider?: string | null;
  sourceBlockId?: string;
  challengerModel: string;
  childConversationId: string;
  jobId: string;
  speculativeWorkspace?: {
    id: string;
    sourcePath: string;
    rootPath: string;
    strategy: string;
  };
  parallelJobCleared?: boolean;
  blockAppended?: boolean;
  sideA: Side;
  sideB: Side;
  status: DuelStatus;
  createdAt: string;
  updatedAt: string;
  primaryText?: string;
  challengerText?: string;
  vote?: Choice;
  revealed?: boolean;
  error?: string;
}

interface StartedChallengerRun {
  childConversationId: string;
  jobId: string;
  speculativeWorkspace?: Duel['speculativeWorkspace'];
  parallelJobCleared?: boolean;
}

interface PromptReplay {
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  attachmentRefs?: unknown;
  contextMessages?: unknown;
}

interface ModelStat {
  modelRef: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  neither: number;
  votes: number;
  byTask: Record<string, { wins: number; losses: number; ties: number; neither: number; votes: number }>;
}

interface Stats {
  models: Record<string, ModelStat>;
}

interface ArenaModel {
  id: string;
  name: string;
  provider: string;
  input: readonly string[];
  authConfigured: boolean;
}

interface ArenaModelLoad {
  models: ArenaModel[];
  refs: Set<string>;
}

const defaultSettings = (): Settings => ({
  automaticDuels: true,
  sampleRate: 0.35,
  rampDownAfterVotes: 60,
  rampedSampleRate: 0.15,
  challengerModels: [],
  minPromptChars: 24,
});

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeModelList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const item of value) {
    const model = asString(item);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    models.push(model);
    if (models.length >= 50) break;
  }
  return models;
}

function normalizeSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(value)) return base;
  return {
    automaticDuels: typeof value.automaticDuels === 'boolean' ? value.automaticDuels : base.automaticDuels,
    sampleRate: clamp(typeof value.sampleRate === 'number' ? value.sampleRate : base.sampleRate, 0, 1),
    rampDownAfterVotes: Math.max(
      0,
      Math.round(typeof value.rampDownAfterVotes === 'number' ? value.rampDownAfterVotes : base.rampDownAfterVotes),
    ),
    rampedSampleRate: clamp(typeof value.rampedSampleRate === 'number' ? value.rampedSampleRate : base.rampedSampleRate, 0, 1),
    challengerModels: normalizeModelList(value.challengerModels),
    minPromptChars: Math.max(0, Math.round(typeof value.minPromptChars === 'number' ? value.minPromptChars : base.minPromptChars)),
  };
}

async function settings(ctx: ExtensionBackendContext): Promise<Settings> {
  return normalizeSettings(await ctx.storage.get(SETTINGS_KEY));
}

async function stats(ctx: ExtensionBackendContext): Promise<Stats> {
  const value = await ctx.storage.get(STATS_KEY);
  return isRecord(value) && isRecord(value.models) ? (value as unknown as Stats) : { models: {} };
}

function classify(prompt: string): string {
  const text = prompt.toLowerCase();
  if (/\b(debug|bug|fix|failing|error|stack trace)\b/.test(text)) return 'debugging';
  if (/\b(api|database|server|backend|migration|schema|queue|worker)\b/.test(text)) return 'backend';
  if (/\b(css|react|tsx|frontend|front-end|ui|layout|visual|design|component)\b/.test(text)) return 'frontend';
  if (/\b(review|audit|security|risk|regression)\b/.test(text)) return 'review';
  if (/\b(plan|spec|architecture|approach|brainstorm)\b/.test(text)) return 'planning';
  if (/\bwrite|draft|summarize|copy|doc|readme\b/.test(text)) return 'writing';
  if (/\bimage|video|screenshot|vision|frame\b/.test(text)) return 'vision';
  return 'general';
}

function sourceBlockIdAliases(sourceBlockId: string): string[] {
  const normalized = sourceBlockId.trim();
  if (!normalized) return [];
  const aliases = [normalized];
  const entryId = normalized.replace(/-x\d+$/, '');
  if (entryId && entryId !== normalized) aliases.push(entryId);
  return aliases;
}

function sameSourceBlockId(left: string, right: string): boolean {
  const leftAliases = sourceBlockIdAliases(left);
  const rightAliases = sourceBlockIdAliases(right);
  return leftAliases.some((alias) => rightAliases.includes(alias));
}

function blockData(duel: Duel) {
  const textFor = (side: Side) => (side === 'primary' ? duel.primaryText : duel.challengerText) ?? '';
  return {
    schemaVersion: 1,
    duelId: duel.id,
    conversationId: duel.conversationId,
    sourceBlockId: duel.sourceBlockId ?? null,
    status: duel.status,
    taskType: duel.taskType,
    prompt: duel.prompt,
    sideA: { role: duel.sideA, text: textFor(duel.sideA) },
    sideB: { role: duel.sideB, text: textFor(duel.sideB) },
    revealed: Boolean(duel.revealed),
    vote: duel.vote ?? null,
    error: duel.error ?? null,
    models: duel.revealed
      ? {
          primary: duel.primaryModel,
          challenger: duel.challengerModel,
          a: duel.sideA === 'primary' ? duel.primaryModel : duel.challengerModel,
          b: duel.sideB === 'primary' ? duel.primaryModel : duel.challengerModel,
        }
      : null,
  };
}

async function saveDuel(ctx: ExtensionBackendContext, duel: Duel) {
  await ctx.storage.put(`${DUEL_PREFIX}${duel.id}`, duel);
}

async function updateBlock(ctx: ExtensionBackendContext, duel: Duel) {
  const block = {
    conversationId: duel.conversationId,
    blockId: duel.blockId,
    blockType: BLOCK_TYPE,
    title: 'Model Arena duel',
    data: blockData(duel),
  };
  if (duel.blockAppended === false) {
    await ctx.conversations.appendTranscriptBlock(block);
    duel.blockAppended = true;
    await saveDuel(ctx, duel);
    return;
  }
  await ctx.conversations.updateTranscriptBlock(block);
}

async function recoverDuel(ctx: ExtensionBackendContext, duel: Duel, nowMs = Date.now()) {
  if (duel.status === 'voted' || duel.status === 'cancelled' || duel.status === 'failed') return duel;
  await reconcileDuelAnswers(ctx, duel).catch(() => undefined);
  const updated = (await ctx.storage.get(`${DUEL_PREFIX}${duel.id}`)) as Duel | null;
  const current = updated && isRecord(updated) ? updated : duel;
  const updatedAtMs = Date.parse(current.updatedAt || current.createdAt || '');
  if (
    current.status === 'running' &&
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs > STALE_RUNNING_DUEL_MS &&
    (!current.primaryText?.trim() || !current.challengerText?.trim())
  ) {
    current.status = 'failed';
    current.error = 'Model Arena duel expired before both answers were captured.';
    current.updatedAt = new Date(nowMs).toISOString();
    await saveDuel(ctx, current);
    await updateBlock(ctx, current).catch(() => undefined);
  }
  return current;
}

type AssistantAnswer = {
  id: string;
  text: string;
};

type PromptSource = {
  id: string;
  text: string;
  imageCount: number;
};

async function reconcileDuelAnswers(
  ctx: ExtensionBackendContext,
  duel: Duel,
  options: { terminalConversationId?: string; runError?: string } = {},
) {
  let changed = false;
  const terminalConversationId = options.terminalConversationId;
  const runError = options.runError ?? '';

  if (!duel.primaryText) {
    const primaryAnswer = await latestAssistantAnswer(ctx, duel.conversationId);
    if (primaryAnswer) {
      duel.primaryText = primaryAnswer.text;
      if (!duel.sourceBlockId && primaryAnswer.id) duel.sourceBlockId = primaryAnswer.id;
      changed = true;
    }
  } else if (!duel.sourceBlockId) {
    const primaryAnswer = await latestAssistantAnswer(ctx, duel.conversationId);
    if (primaryAnswer?.id && primaryAnswer.text === duel.primaryText) {
      duel.sourceBlockId = primaryAnswer.id;
      changed = true;
    }
  }

  if (!duel.challengerText) {
    const challengerAnswer = await latestAssistantAnswer(ctx, duel.childConversationId);
    if (challengerAnswer) {
      duel.challengerText = challengerAnswer.text;
      changed = true;
    }
  }

  if (!duel.primaryText && duel.status !== 'failed') {
    const primaryError = await latestConversationError(ctx, duel.conversationId);
    if (primaryError) {
      duel.error = primaryError;
      duel.status = 'failed';
      if (await disposeSpeculativeWorkspace(ctx, duel).catch(() => false)) {
        changed = true;
      }
      changed = true;
    }
  }

  if (!duel.challengerText && duel.status !== 'failed') {
    const challengerError = await latestConversationError(ctx, duel.childConversationId);
    if (challengerError) {
      duel.error = challengerError;
      duel.status = 'failed';
      if (await disposeSpeculativeWorkspace(ctx, duel).catch(() => false)) {
        changed = true;
      }
      changed = true;
    }
  }

  if (terminalConversationId === duel.conversationId && (runError || !duel.primaryText)) {
    duel.error = runError || 'Primary model ended without an answer.';
    duel.status = 'failed';
    if (await disposeSpeculativeWorkspace(ctx, duel).catch(() => false)) {
      changed = true;
    }
    changed = true;
  }

  if (terminalConversationId === duel.childConversationId) {
    if (runError || !duel.challengerText) {
      duel.error = runError || 'Challenger model ended without an answer.';
      duel.status = 'failed';
      if (await disposeSpeculativeWorkspace(ctx, duel).catch(() => false)) {
        changed = true;
      }
      changed = true;
    }
    if (await cleanupParallelJob(ctx, duel)) {
      changed = true;
    }
  }

  if (
    duel.primaryText &&
    duel.challengerText &&
    duel.status !== 'ready' &&
    duel.status !== 'failed' &&
    duel.status !== 'voted' &&
    duel.status !== 'cancelled'
  ) {
    duel.status = 'ready';
    changed = true;
  }

  if (changed) {
    duel.updatedAt = new Date().toISOString();
    await saveDuel(ctx, duel);
    await updateBlock(ctx, duel).catch(() => undefined);
  }

  return changed;
}

function readBlocks(value: unknown): Array<Record<string, unknown>> {
  if (isRecord(value) && Array.isArray(value.blocks)) return value.blocks.filter(isRecord);
  if (isRecord(value) && isRecord(value.detail) && Array.isArray(value.detail.blocks)) return value.detail.blocks.filter(isRecord);
  if (isRecord(value) && isRecord(value.sessionRead)) return readBlocks(value.sessionRead);
  return [];
}

function blockId(block: Record<string, unknown>): string {
  return asString(block.id) || asString(block.blockId);
}

function promptBeforeBlock(blocks: Array<Record<string, unknown>>, selectedBlockId: string): PromptSource | null {
  const selectedIndex = selectedBlockId ? blocks.findIndex((block) => blockId(block) === selectedBlockId) : -1;
  const endIndex = selectedIndex >= 0 ? selectedIndex : blocks.length;
  for (let i = endIndex - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.type === 'user') {
      const text = asString(block.text);
      if (text) return { id: blockId(block), text, imageCount: Array.isArray(block.images) ? block.images.length : 0 };
    }
  }
  return null;
}

async function latestAssistantAnswer(ctx: ExtensionBackendContext, conversationId: string): Promise<AssistantAnswer | null> {
  const blocks = readBlocks(await ctx.conversations.getBlocks(conversationId, { tailBlocks: 100 }).catch(() => ({ blocks: [] })));
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.type === 'text') {
      const text = asString(block.text);
      if (text) return { id: blockId(block), text };
    }
  }
  return null;
}

async function latestConversationError(ctx: ExtensionBackendContext, conversationId: string) {
  const result = await ctx.conversations.getBlocks(conversationId, { tailBlocks: 100 }).catch((error) => ({
    blocks: [{ type: 'error', message: error instanceof Error ? error.message : String(error) }],
  }));
  const blocks = readBlocks(result);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.type !== 'error' && block?.status !== 'error' && block?.error !== true) continue;
    const message = asString(block.message) || asString(block.text) || asString(block.output) || asString(block.error);
    if (message) return message;
  }
  return '';
}

async function conversationModelMeta(ctx: ExtensionBackendContext, conversationId: string): Promise<Record<string, unknown> | null> {
  const meta = await ctx.conversations.getMeta(conversationId).catch(() => null);
  if (isRecord(meta) && (asString(meta.currentModel) || asString(meta.model))) return meta;
  const conversation = await ctx.conversations.get(conversationId).catch(() => null);
  if (isRecord(conversation)) return conversation;
  return isRecord(meta) ? meta : null;
}

function primaryModelRef(model: string, provider?: string | null): string {
  const normalizedModel = model.trim();
  const normalizedProvider = provider?.trim();
  return normalizedProvider && normalizedModel && !normalizedModel.includes('/')
    ? `${normalizedProvider}/${normalizedModel}`
    : normalizedModel;
}

function sameModelRef(a: string, b: string) {
  if (a === b) return true;
  if (a.includes('/') || b.includes('/')) return false;
  const bare = (value: string) => value.split('/').at(-1) ?? value;
  return bare(a) === bare(b);
}

function readPromptReplay(payload: Record<string, unknown>): PromptReplay {
  return {
    ...(Array.isArray(payload.images) ? { images: payload.images as Array<{ data: string; mimeType: string; name?: string }> } : {}),
    ...(Array.isArray(payload.videos)
      ? { videos: payload.videos as Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }> }
      : {}),
    ...(payload.attachmentRefs !== undefined ? { attachmentRefs: payload.attachmentRefs } : {}),
    ...(payload.contextMessages !== undefined ? { contextMessages: payload.contextMessages } : {}),
  };
}

function promptReplayRequiresImageInput(replay: PromptReplay): boolean {
  return Boolean((replay.images?.length ?? 0) > 0 || (replay.videos?.length ?? 0) > 0);
}

function challenger(
  config: Settings,
  primary: string,
  availableRefs?: Set<string>,
  modelsByRef?: Map<string, ArenaModel>,
  replay?: PromptReplay,
) {
  const requiresImage = replay ? promptReplayRequiresImageInput(replay) : false;
  const models = config.challengerModels.filter(
    (model) =>
      model &&
      !sameModelRef(model, primary) &&
      (!availableRefs || availableRefs.has(model)) &&
      (!requiresImage || modelsByRef?.get(model)?.input.includes('image')),
  );
  return models[Math.floor(Math.random() * models.length)] ?? null;
}

function arenaModelRef(model: ArenaModel): string {
  return `${model.provider}/${model.id}`;
}

async function loadArenaModels(ctx: ExtensionBackendContext): Promise<ArenaModelLoad | null> {
  const rawModels = await withTimeout(ctx.models.list(), ARENA_MODEL_LIST_TIMEOUT_MS, null).catch(() => null);
  if (!Array.isArray(rawModels)) return null;
  const models = rawModels
    .filter(isRecord)
    .map((model) => ({
      id: asString(model.id),
      name: asString(model.name) || asString(model.id),
      provider: asString(model.provider),
      input: Array.isArray(model.input) ? model.input.filter((item): item is string => typeof item === 'string') : ['text'],
      authConfigured: model.authConfigured !== false,
    }))
    .filter((model) => model.id && model.provider && model.authConfigured && !UNSUPPORTED_CHALLENGER_PROVIDERS.has(model.provider));
  return { models, refs: new Set(models.map(arenaModelRef)) };
}

async function saveSettings(ctx: ExtensionBackendContext, next: Settings) {
  await ctx.storage.put(SETTINGS_KEY, next);
}

async function settingsWithAvailableModels(
  ctx: ExtensionBackendContext,
): Promise<{ settings: Settings; models: ArenaModel[]; refs: Set<string> | null }> {
  const current = await settings(ctx);
  const loaded = await loadArenaModels(ctx);
  if (!loaded) {
    return { settings: current, models: [], refs: null };
  }

  const challengerModels = current.challengerModels.filter((model) => loaded.refs.has(model));
  if (challengerModels.length !== current.challengerModels.length) {
    const next = { ...current, challengerModels };
    await saveSettings(ctx, next);
    return { settings: next, models: loaded.models, refs: loaded.refs };
  }

  return { settings: current, models: loaded.models, refs: loaded.refs };
}

async function cleanupParallelJob(ctx: ExtensionBackendContext, duel: Duel) {
  if (duel.parallelJobCleared) return false;
  try {
    await ctx.conversations.manageParallelJob({ conversationId: duel.conversationId, jobId: duel.jobId, action: 'skip' });
    duel.parallelJobCleared = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/running/i.test(message)) return false;
    try {
      await ctx.conversations.manageParallelJob({ conversationId: duel.conversationId, jobId: duel.jobId, action: 'cancel' });
      duel.parallelJobCleared = true;
      return true;
    } catch {
      return false;
    }
  }
}

async function disposeSpeculativeWorkspace(ctx: ExtensionBackendContext, duel: Duel) {
  const workspace = duel.speculativeWorkspace;
  const workspaceId = workspace?.id?.trim();
  if (!workspaceId) return false;
  await ctx.conversations.disposeSpeculativeWorkspace({
    id: workspaceId,
    rootPath: workspace?.rootPath,
  });
  delete duel.speculativeWorkspace;
  return true;
}

async function applySpeculativeWorkspace(ctx: ExtensionBackendContext, duel: Duel) {
  const workspace = duel.speculativeWorkspace;
  const workspaceId = workspace?.id?.trim();
  if (!workspaceId) return false;
  await ctx.conversations.applySpeculativeWorkspace({
    id: workspaceId,
    sourcePath: workspace?.sourcePath,
    rootPath: workspace?.rootPath,
  });
  delete duel.speculativeWorkspace;
  return true;
}

async function createDuel(
  ctx: ExtensionBackendContext,
  input: {
    conversationId: string;
    prompt: string;
    primaryModel: string;
    challengerModel: string;
    primaryText?: string;
    primaryProvider?: string | null;
    sourceBlockId?: string;
    sourcePromptBlockId?: string;
    allowFallbackChallenger?: boolean;
    deferTranscriptBlock?: boolean;
    replay?: PromptReplay;
  },
) {
  const id = crypto.randomUUID();
  const sideA: Side = Math.random() < 0.5 ? 'primary' : 'challenger';
  const taskType = classify(input.prompt);
  const started = await startChallengerRun(ctx, {
    parentConversationId: input.conversationId,
    prompt: input.prompt,
    sourcePromptBlockId: input.sourcePromptBlockId,
    challengerModel: input.challengerModel,
    duelId: id,
    taskType,
    allowFallback: input.allowFallbackChallenger !== false,
    replay: input.replay,
  });
  const now = new Date().toISOString();
  const duel: Duel = {
    id,
    conversationId: input.conversationId,
    blockId: `model_arena_duel:${id}`,
    prompt: input.prompt,
    taskType,
    primaryModel: input.primaryModel,
    primaryProvider: input.primaryProvider,
    sourceBlockId: input.sourceBlockId,
    challengerModel: input.challengerModel,
    childConversationId: started.childConversationId,
    jobId: started.jobId,
    speculativeWorkspace: started.speculativeWorkspace,
    parallelJobCleared: started.parallelJobCleared,
    blockAppended: !input.deferTranscriptBlock,
    sideA,
    sideB: sideA === 'primary' ? 'challenger' : 'primary',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    primaryText: input.primaryText,
  };
  if (!input.deferTranscriptBlock) {
    await ctx.conversations.appendTranscriptBlock({
      conversationId: duel.conversationId,
      blockId: duel.blockId,
      blockType: BLOCK_TYPE,
      title: 'Model Arena duel',
      data: blockData(duel),
    });
  }
  await saveDuel(ctx, duel);
  return duel;
}

async function startChallengerRun(
  ctx: ExtensionBackendContext,
  input: {
    parentConversationId: string;
    prompt: string;
    sourcePromptBlockId?: string;
    challengerModel: string;
    duelId: string;
    taskType: string;
    allowFallback: boolean;
    replay?: PromptReplay;
  },
): Promise<StartedChallengerRun> {
  const workspace = await ctx.conversations.createSpeculativeWorkspace(input.parentConversationId);
  try {
    const started = await ctx.conversations.startParallelPrompt(input.parentConversationId, {
      text: input.prompt,
      cwd: workspace.rootPath,
      ...(input.replay?.images ? { images: input.replay.images } : {}),
      ...(input.replay?.videos ? { videos: input.replay.videos } : {}),
      ...(input.replay?.attachmentRefs !== undefined ? { attachmentRefs: input.replay.attachmentRefs } : {}),
      ...(input.replay?.contextMessages !== undefined ? { contextMessages: input.replay.contextMessages } : {}),
      model: input.challengerModel,
      purpose: 'model_arena_duel',
      metadata: { duelId: input.duelId, taskType: input.taskType },
    });
    return { childConversationId: started.childConversationId, jobId: started.jobId, speculativeWorkspace: workspace };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/only available while the conversation is busy/i.test(message)) {
      await ctx.conversations.disposeSpeculativeWorkspace(workspace.id).catch(() => undefined);
      throw error;
    }
  }

  if (!input.allowFallback) {
    await ctx.conversations.disposeSpeculativeWorkspace(workspace.id).catch(() => undefined);
    throw new Error('Automatic Model Arena duels require an active parallel prompt window.');
  }

  if (input.sourcePromptBlockId) {
    const forked = (await ctx.conversations.fork({
      conversationId: input.parentConversationId,
      atBlockId: input.sourcePromptBlockId,
      beforeEntry: true,
      title: 'Model Arena challenger',
      targetCwd: workspace.rootPath,
      model: input.challengerModel,
    })) as { id?: unknown; conversationId?: unknown };
    const forkedConversationId = asString(forked.conversationId) || asString(forked.id);
    if (!forkedConversationId) {
      await ctx.conversations.disposeSpeculativeWorkspace(workspace.id).catch(() => undefined);
      throw new Error('Failed to fork challenger conversation.');
    }
    try {
      await ctx.conversations.runTurn(forkedConversationId, input.prompt);
    } catch (error) {
      await ctx.conversations.disposeSpeculativeWorkspace(workspace.id).catch(() => undefined);
      throw error;
    }
    return {
      childConversationId: forkedConversationId,
      jobId: `conversation:${forkedConversationId}`,
      speculativeWorkspace: workspace,
      parallelJobCleared: true,
    };
  }

  const created = (await ctx.conversations.create({
    title: 'Model Arena challenger',
    prompt: input.prompt,
    cwd: workspace.rootPath,
    model: input.challengerModel,
  })) as { id?: unknown; conversationId?: unknown };
  const childConversationId = asString(created.conversationId) || asString(created.id);
  if (!childConversationId) {
    await ctx.conversations.disposeSpeculativeWorkspace(workspace.id).catch(() => undefined);
    throw new Error('Failed to create challenger conversation.');
  }
  return {
    childConversationId,
    jobId: `conversation:${childConversationId}`,
    speculativeWorkspace: workspace,
    parallelJobCleared: true,
  };
}

export async function onPromptSubmitted(input: { payload?: unknown }, ctx: ExtensionBackendContext) {
  const payload = isRecord(input.payload) ? input.payload : {};
  const prompt = asString(payload.prompt);
  const conversationId = asString(payload.conversationId);
  const primaryModel = primaryModelRef(asString(payload.currentModel), asString(payload.currentProvider) || null);
  const config = await settings(ctx);
  const loadedModels = await loadArenaModels(ctx);
  const currentStats = await stats(ctx);
  const voteCount = Object.values(currentStats.models).reduce((sum, item) => sum + item.votes, 0);
  const rate = voteCount >= config.rampDownAfterVotes ? config.rampedSampleRate : config.sampleRate;
  if (!config.automaticDuels || prompt.length < config.minPromptChars || Math.random() >= rate) return { skipped: true };
  if (asString(payload.delivery) && asString(payload.delivery) !== 'started') return { skipped: true, reason: 'queued_prompt' };
  if (!loadedModels) return { skipped: true, reason: 'models_unavailable' };
  const replay = readPromptReplay(payload);
  if ((Number(payload.imageCount) > 0 || Number(payload.videoCount) > 0) && !promptReplayRequiresImageInput(replay)) {
    return { skipped: true, reason: 'attachments_unsupported' };
  }
  if (Number(payload.contextMessageCount) > 0 && replay.contextMessages === undefined) {
    return { skipped: true, reason: 'context_unsupported' };
  }
  const modelsByRef = new Map(loadedModels.models.map((model) => [arenaModelRef(model), model]));
  const challengerModel = challenger(config, primaryModel, loadedModels.refs, modelsByRef, replay);
  if (!challengerModel && promptReplayRequiresImageInput(replay)) return { skipped: true, reason: 'no_capable_challenger' };
  if (!conversationId || !primaryModel || !challengerModel) return { skipped: true };
  let duel: Duel;
  try {
    duel = await createDuel(ctx, {
      conversationId,
      prompt,
      primaryModel,
      primaryProvider: asString(payload.currentProvider) || null,
      challengerModel,
      allowFallbackChallenger: false,
      deferTranscriptBlock: true,
      replay,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/active parallel prompt window/i.test(message)) return { skipped: true, reason: 'parallel_unavailable' };
    throw error;
  }
  return { started: true, duelId: duel.id };
}

export async function onConversationRunEnded(input: { payload?: unknown }, ctx: ExtensionBackendContext) {
  const payload = isRecord(input.payload) ? input.payload : {};
  const conversationId = asString(payload.conversationId);
  const runError = asString(payload.error);
  if (!conversationId) return { updated: 0 };
  let updated = 0;
  for (const entry of await ctx.storage.list<Duel>(DUEL_PREFIX)) {
    const duel = entry.value;
    if (!isRecord(duel) || duel.status === 'voted' || duel.status === 'cancelled') continue;
    if (duel.conversationId !== conversationId && duel.childConversationId !== conversationId) continue;
    if (await reconcileDuelAnswers(ctx, duel, { terminalConversationId: conversationId, runError })) {
      updated += 1;
    }
  }
  return { updated };
}

export async function refreshDuel(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const duelId = asString(record.duelId);
  const duel = (await ctx.storage.get(`${DUEL_PREFIX}${duelId}`)) as Duel | null;
  if (!duel || !isRecord(duel)) throw new Error('Duel not found.');
  if (duel.status !== 'voted' && duel.status !== 'cancelled') await reconcileDuelAnswers(ctx, duel);
  return { ok: true, duel: blockData(duel) };
}

export async function startManualDuel(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const conversationId = asString(record.conversationId);
  const selectedBlockId = asString(record.blockId);
  const primaryText = asString(record.messageText);
  if (!conversationId || !primaryText) throw new Error('Choose an assistant message inside a conversation to compare models.');
  const { settings: config, refs } = await settingsWithAvailableModels(ctx);
  if (!refs) throw new Error('Model list is unavailable. Try again after models finish loading.');
  const blocks = readBlocks(await ctx.conversations.getBlocks(conversationId, { tailBlocks: 120 }));
  const promptSource = promptBeforeBlock(blocks, selectedBlockId);
  const prompt = promptSource?.text ?? '';
  const meta = await conversationModelMeta(ctx, conversationId);
  const primaryModel = primaryModelRef(
    asString(meta?.currentModel) || asString(meta?.model) || 'current model',
    asString((meta as { currentProvider?: unknown } | null)?.currentProvider) || null,
  );
  const challengerModel = challenger(config, primaryModel, refs ?? undefined);
  if (!prompt) throw new Error('Choose an assistant message with a prompt to compare models.');
  if ((promptSource?.imageCount ?? 0) > 0) {
    throw new Error('Model Arena cannot compare image prompts yet because challenger runs would not receive the same images.');
  }
  if (!config.challengerModels.length) throw new Error('Add challenger models before starting a duel.');
  if (!challengerModel) throw new Error('Add a challenger model different from the current conversation model before starting a duel.');
  for (const entry of await ctx.storage.list<Duel>(DUEL_PREFIX)) {
    const existing = entry.value;
    if (!isRecord(existing) || existing.status === 'voted' || existing.status === 'cancelled') continue;
    if (existing.conversationId !== conversationId) continue;
    const existingSourceBlockId = asString(existing.sourceBlockId);
    const sameSource = existingSourceBlockId
      ? sameSourceBlockId(existingSourceBlockId, selectedBlockId)
      : existing.prompt === prompt && existing.primaryText === primaryText;
    if (!sameSource) continue;
    await reconcileDuelAnswers(ctx, existing as Duel).catch(() => undefined);
    await updateBlock(ctx, existing as Duel).catch(() => undefined);
    return { text: `Model duel ${existing.id} already exists for this answer.`, duelId: existing.id, existing: true };
  }
  await ctx.conversations.ensureLive(conversationId);
  const duel = await createDuel(ctx, {
    conversationId,
    prompt,
    primaryModel,
    challengerModel,
    primaryText,
    sourceBlockId: selectedBlockId,
    sourcePromptBlockId: promptSource?.id,
  });
  return { text: `Started model duel ${duel.id}.`, duelId: duel.id };
}

function stat(current: Stats, modelRef: string): ModelStat {
  current.models[modelRef] ??= {
    modelRef,
    rating: 1000,
    wins: 0,
    losses: 0,
    ties: 0,
    neither: 0,
    votes: 0,
    byTask: {},
  };
  return current.models[modelRef]!;
}

function taskStat(model: ModelStat, taskType: string) {
  model.byTask[taskType] ??= { wins: 0, losses: 0, ties: 0, neither: 0, votes: 0 };
  return model.byTask[taskType]!;
}

export async function voteDuel(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const duelId = asString(record.duelId);
  const choice = asString(record.choice) as Choice;
  const duel = (await ctx.storage.get(`${DUEL_PREFIX}${duelId}`)) as Duel | null;
  if (!duel || !['a', 'b', 'tie', 'neither'].includes(choice)) throw new Error('Duel vote is invalid.');
  const current = await stats(ctx);
  if (duel.vote) {
    if (duel.vote !== choice) throw new Error('This duel was already voted on.');
    return { ok: true, duel: blockData(duel), stats: current };
  }
  if (duel.status !== 'ready' || !duel.primaryText?.trim() || !duel.challengerText?.trim()) {
    throw new Error('Duel is not ready to vote on.');
  }
  const challengerWon =
    choice !== 'tie' &&
    choice !== 'neither' &&
    ((choice === 'a' && duel.sideA === 'challenger') || (choice === 'b' && duel.sideB === 'challenger'));
  if (challengerWon) {
    await applySpeculativeWorkspace(ctx, duel);
  } else {
    await disposeSpeculativeWorkspace(ctx, duel);
  }
  const primary = stat(current, duel.primaryModel);
  const challengerStat = stat(current, duel.challengerModel);
  const primaryTask = taskStat(primary, duel.taskType);
  const challengerTask = taskStat(challengerStat, duel.taskType);
  const primaryWon = (choice === 'a' && duel.sideA === 'primary') || (choice === 'b' && duel.sideB === 'primary');
  const score = choice === 'tie' || choice === 'neither' ? 0.5 : primaryWon ? 1 : 0;
  const expected = 1 / (1 + 10 ** ((challengerStat.rating - primary.rating) / 400));
  primary.rating = Math.round(primary.rating + 24 * (score - expected));
  challengerStat.rating = Math.round(challengerStat.rating + 24 * (1 - score - (1 - expected)));
  primary.votes += 1;
  challengerStat.votes += 1;
  primaryTask.votes += 1;
  challengerTask.votes += 1;
  if (choice === 'tie') {
    primary.ties += 1;
    challengerStat.ties += 1;
    primaryTask.ties += 1;
    challengerTask.ties += 1;
  } else if (choice === 'neither') {
    primary.neither += 1;
    challengerStat.neither += 1;
    primaryTask.neither += 1;
    challengerTask.neither += 1;
  } else if (primaryWon) {
    primary.wins += 1;
    challengerStat.losses += 1;
    primaryTask.wins += 1;
    challengerTask.losses += 1;
  } else {
    primary.losses += 1;
    challengerStat.wins += 1;
    primaryTask.losses += 1;
    challengerTask.wins += 1;
  }
  await ctx.storage.put(STATS_KEY, current);
  duel.vote = choice;
  duel.revealed = true;
  duel.status = 'voted';
  duel.updatedAt = new Date().toISOString();
  await saveDuel(ctx, duel);
  await updateBlock(ctx, duel);
  return { ok: true, duel: blockData(duel), stats: current };
}

export async function cancelDuel(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const duelId = asString(record.duelId);
  const duel = (await ctx.storage.get(`${DUEL_PREFIX}${duelId}`)) as Duel | null;
  if (!duel || !isRecord(duel)) throw new Error('Duel not found.');
  const sameSource = (candidate: Duel) => {
    if (candidate.id === duel.id) return true;
    if (candidate.conversationId !== duel.conversationId) return false;
    const sourceBlockId = asString(duel.sourceBlockId);
    const candidateSourceBlockId = asString(candidate.sourceBlockId);
    if (sourceBlockId || candidateSourceBlockId)
      return Boolean(sourceBlockId && candidateSourceBlockId) && sameSourceBlockId(sourceBlockId, candidateSourceBlockId);
    return candidate.prompt === duel.prompt && candidate.primaryText === duel.primaryText;
  };
  const now = new Date().toISOString();
  const cancelled: Duel[] = [];
  for (const entry of await ctx.storage.list<Duel>(DUEL_PREFIX)) {
    const candidate = entry.value;
    if (!isRecord(candidate) || candidate.status === 'voted' || candidate.status === 'cancelled') continue;
    if (!sameSource(candidate as Duel)) continue;
    await cleanupParallelJob(ctx, candidate as Duel).catch(() => false);
    await disposeSpeculativeWorkspace(ctx, candidate as Duel).catch(() => false);
    (candidate as Duel).status = 'cancelled';
    (candidate as Duel).updatedAt = now;
    await saveDuel(ctx, candidate as Duel);
    await updateBlock(ctx, candidate as Duel);
    cancelled.push(candidate as Duel);
  }
  const cancelledDuel = cancelled.find((candidate) => candidate.id === duel.id) ?? duel;
  return { ok: true, duel: blockData(cancelledDuel), cancelled: cancelled.length };
}

export async function getArenaState(_input: unknown, ctx: ExtensionBackendContext) {
  const duels = [];
  for (const entry of await ctx.storage.list<Duel>(DUEL_PREFIX)) {
    if (!isRecord(entry.value)) continue;
    duels.push(await withTimeout(recoverDuel(ctx, entry.value as Duel), ARENA_STATE_RECOVERY_TIMEOUT_MS, entry.value as Duel));
  }
  const arena = await settingsWithAvailableModels(ctx);
  return { settings: arena.settings, stats: await stats(ctx), duels, models: arena.models };
}

export async function saveArenaSettings(input: unknown, ctx: ExtensionBackendContext) {
  const next = normalizeSettings(input);
  const loaded = await loadArenaModels(ctx);
  if (!loaded) throw new Error('Model list is unavailable. Try again after models finish loading.');
  const settingsToSave = { ...next, challengerModels: next.challengerModels.filter((model) => loaded.refs.has(model)) };
  await saveSettings(ctx, settingsToSave);
  return { settings: settingsToSave };
}

export async function listArenaModels(_input: unknown, ctx: ExtensionBackendContext): Promise<ArenaModel[]> {
  return (await loadArenaModels(ctx))?.models ?? [];
}
