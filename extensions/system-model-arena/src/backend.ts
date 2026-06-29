import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const SETTINGS_KEY = 'settings';
const STATS_KEY = 'stats/models';
const DUEL_PREFIX = 'duels/';
const BLOCK_TYPE = 'model_arena_duel';

type Choice = 'a' | 'b' | 'tie' | 'neither';
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
  challengerModel: string;
  childConversationId: string;
  jobId: string;
  sideA: Side;
  sideB: Side;
  status: 'running' | 'ready' | 'failed' | 'voted';
  createdAt: string;
  updatedAt: string;
  primaryText?: string;
  challengerText?: string;
  vote?: Choice;
  revealed?: boolean;
  error?: string;
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
    challengerModels: Array.isArray(value.challengerModels) ? value.challengerModels.map(asString).filter(Boolean) : base.challengerModels,
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
  if (/\b(css|react|tsx|frontend|front-end|ui|layout|visual|design|component)\b/.test(text)) return 'frontend';
  if (/\b(api|database|server|backend|migration|schema|queue|worker)\b/.test(text)) return 'backend';
  if (/\b(review|audit|security|risk|regression)\b/.test(text)) return 'review';
  if (/\b(debug|bug|fix|failing|error|stack trace)\b/.test(text)) return 'debugging';
  if (/\b(plan|spec|architecture|approach|brainstorm)\b/.test(text)) return 'planning';
  if (/\bwrite|draft|summarize|copy|doc|readme\b/.test(text)) return 'writing';
  if (/\bimage|video|screenshot|vision|frame\b/.test(text)) return 'vision';
  return 'general';
}

function blockData(duel: Duel) {
  const textFor = (side: Side) => (side === 'primary' ? duel.primaryText : duel.challengerText) ?? '';
  return {
    schemaVersion: 1,
    duelId: duel.id,
    status: duel.status,
    taskType: duel.taskType,
    prompt: duel.prompt,
    sideA: { text: textFor(duel.sideA) },
    sideB: { text: textFor(duel.sideB) },
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
  await ctx.conversations.updateTranscriptBlock({
    conversationId: duel.conversationId,
    blockId: duel.blockId,
    blockType: BLOCK_TYPE,
    title: 'Model Arena duel',
    data: blockData(duel),
  });
}

function readBlocks(value: unknown): Array<Record<string, unknown>> {
  if (isRecord(value) && Array.isArray(value.blocks)) return value.blocks.filter(isRecord);
  return [];
}

async function latestAssistantText(ctx: ExtensionBackendContext, conversationId: string) {
  const blocks = readBlocks(await ctx.conversations.getBlocks(conversationId, { tailBlocks: 100 }));
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.type === 'text') {
      const text = asString(block.text);
      if (text) return text;
    }
  }
  return '';
}

function challenger(config: Settings, primary: string) {
  const models = config.challengerModels.filter((model) => model && model !== primary);
  return models[Math.floor(Math.random() * models.length)] ?? null;
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
  },
) {
  const id = crypto.randomUUID();
  const sideA: Side = Math.random() < 0.5 ? 'primary' : 'challenger';
  const taskType = classify(input.prompt);
  const started = await ctx.conversations.startParallelPrompt(input.conversationId, {
    text: input.prompt,
    model: input.challengerModel,
    purpose: 'model_arena_duel',
    metadata: { duelId: id, taskType },
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
    challengerModel: input.challengerModel,
    childConversationId: started.childConversationId,
    jobId: started.jobId,
    sideA,
    sideB: sideA === 'primary' ? 'challenger' : 'primary',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    primaryText: input.primaryText,
  };
  await ctx.conversations.appendTranscriptBlock({
    conversationId: duel.conversationId,
    blockId: duel.blockId,
    blockType: BLOCK_TYPE,
    title: 'Model Arena duel',
    data: blockData(duel),
  });
  await saveDuel(ctx, duel);
  return duel;
}

export async function onPromptSubmitted(input: { payload?: unknown }, ctx: ExtensionBackendContext) {
  const payload = isRecord(input.payload) ? input.payload : {};
  const prompt = asString(payload.prompt);
  const conversationId = asString(payload.conversationId);
  const primaryModel = asString(payload.currentModel);
  const config = await settings(ctx);
  const currentStats = await stats(ctx);
  const voteCount = Object.values(currentStats.models).reduce((sum, item) => sum + item.votes, 0);
  const rate = voteCount >= config.rampDownAfterVotes ? config.rampedSampleRate : config.sampleRate;
  if (!config.automaticDuels || prompt.length < config.minPromptChars || Math.random() >= rate) return { skipped: true };
  const challengerModel = challenger(config, primaryModel);
  if (!conversationId || !primaryModel || !challengerModel) return { skipped: true };
  const duel = await createDuel(ctx, {
    conversationId,
    prompt,
    primaryModel,
    primaryProvider: asString(payload.currentProvider) || null,
    challengerModel,
  });
  return { started: true, duelId: duel.id };
}

export async function onConversationRunEnded(input: { payload?: unknown }, ctx: ExtensionBackendContext) {
  const payload = isRecord(input.payload) ? input.payload : {};
  const conversationId = asString(payload.conversationId);
  if (!conversationId) return { updated: 0 };
  let updated = 0;
  for (const entry of await ctx.storage.list<Duel>(DUEL_PREFIX)) {
    const duel = entry.value;
    if (!isRecord(duel) || duel.status === 'voted') continue;
    let changed = false;
    if (duel.conversationId === conversationId && !duel.primaryText) {
      duel.primaryText = await latestAssistantText(ctx, duel.conversationId);
      changed = Boolean(duel.primaryText);
    }
    if (duel.childConversationId === conversationId && !duel.challengerText) {
      duel.challengerText = await latestAssistantText(ctx, duel.childConversationId);
      changed = Boolean(duel.challengerText);
    }
    if (duel.primaryText && duel.challengerText && duel.status !== 'ready') {
      duel.status = 'ready';
      changed = true;
    }
    if (changed) {
      duel.updatedAt = new Date().toISOString();
      await saveDuel(ctx, duel);
      await updateBlock(ctx, duel).catch(() => undefined);
      updated += 1;
    }
  }
  return { updated };
}

export async function startManualDuel(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? input : {};
  const conversationId = asString(record.conversationId);
  const primaryText = asString(record.messageText);
  const config = await settings(ctx);
  const blocks = readBlocks(await ctx.conversations.getBlocks(conversationId, { tailBlocks: 120 }));
  const prompt = asString([...blocks].reverse().find((block) => block.type === 'user')?.text);
  const meta = (await ctx.conversations.getMeta(conversationId).catch(() => null)) as { currentModel?: unknown } | null;
  const primaryModel = asString(meta?.currentModel) || 'current model';
  const challengerModel = challenger(config, primaryModel);
  if (!conversationId || !prompt || !primaryText || !challengerModel)
    throw new Error('Configure challenger models before starting a duel.');
  const duel = await createDuel(ctx, { conversationId, prompt, primaryModel, challengerModel, primaryText });
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
  if (!duel.vote) {
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
  }
  duel.vote = choice;
  duel.revealed = true;
  duel.status = 'voted';
  duel.updatedAt = new Date().toISOString();
  await saveDuel(ctx, duel);
  await updateBlock(ctx, duel);
  return { ok: true, duel: blockData(duel), stats: current };
}

export async function getArenaState(_input: unknown, ctx: ExtensionBackendContext) {
  const duels = (await ctx.storage.list<Duel>(DUEL_PREFIX)).map((entry) => entry.value).filter(isRecord);
  return { settings: await settings(ctx), stats: await stats(ctx), duels };
}

export async function saveArenaSettings(input: unknown, ctx: ExtensionBackendContext) {
  const next = normalizeSettings(input);
  await ctx.storage.put(SETTINGS_KEY, next);
  return { settings: next };
}
