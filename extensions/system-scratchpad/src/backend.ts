import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const METADATA_NAMESPACE = 'threadScratchpad';
const MAX_CONTENT_LENGTH = 200_000;

type ScratchpadAction = 'get' | 'set' | 'append' | 'prepend' | 'clear';

interface ScratchpadState {
  content: string;
  updatedAt: string | null;
}

function conversationIdFrom(input: unknown, ctx: ExtensionBackendContext): string {
  const explicit =
    input && typeof input === 'object' && typeof (input as { conversationId?: unknown }).conversationId === 'string'
      ? (input as { conversationId: string }).conversationId.trim()
      : '';
  const conversationId = explicit || ctx.toolContext?.conversationId?.trim() || ctx.toolContext?.sessionId?.trim();
  if (!conversationId) throw new Error('conversationId required');
  return conversationId;
}

function normalizeCliInput(input: unknown): unknown {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  const cli = record?.cli && typeof record.cli === 'object' && !Array.isArray(record.cli) ? (record.cli as Record<string, unknown>) : null;
  if (!record || !cli) return input;
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const flags = cli.flags && typeof cli.flags === 'object' && !Array.isArray(cli.flags) ? (cli.flags as Record<string, unknown>) : {};
  const action = typeof record.action === 'string' ? record.action : 'get';
  return {
    ...record,
    conversationId: typeof record.conversationId === 'string' ? record.conversationId : args[0],
    content:
      typeof record.content === 'string'
        ? record.content
        : typeof flags.content === 'string'
          ? flags.content
          : action === 'set'
            ? args.slice(1).join(' ')
            : args.slice(1).join(' '),
    action: action === 'append' && flags.operation === 'prepend' ? 'prepend' : action,
  };
}

function normalizeState(value: unknown): ScratchpadState {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    content: typeof record.content === 'string' ? record.content : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
}

function validateContent(value: unknown): string {
  if (typeof value !== 'string') throw new Error('content required');
  if (value.length > MAX_CONTENT_LENGTH) throw new Error(`Scratchpad content exceeds ${MAX_CONTENT_LENGTH} characters.`);
  return value;
}

function joinMarkdown(first: string, second: string): string {
  if (!first) return second;
  if (!second) return first;
  return `${first.replace(/\s+$/u, '')}\n\n${second.replace(/^\s+/u, '')}`;
}

async function readState(conversationId: string, ctx: ExtensionBackendContext): Promise<ScratchpadState> {
  return normalizeState(await ctx.conversations.metadata.get({ conversationId, namespace: METADATA_NAMESPACE }));
}

async function writeState(conversationId: string, content: string, ctx: ExtensionBackendContext): Promise<ScratchpadState> {
  const next = { content: validateContent(content), updatedAt: new Date().toISOString() };
  await ctx.conversations.metadata.set({ conversationId, namespace: METADATA_NAMESPACE, values: next });
  return next;
}

export async function getScratchpad(input: unknown, ctx: ExtensionBackendContext): Promise<ScratchpadState & { conversationId: string }> {
  const conversationId = conversationIdFrom(input, ctx);
  return { conversationId, ...(await readState(conversationId, ctx)) };
}

export async function setScratchpad(input: unknown, ctx: ExtensionBackendContext): Promise<ScratchpadState & { conversationId: string }> {
  const conversationId = conversationIdFrom(input, ctx);
  const content = validateContent(input && typeof input === 'object' ? (input as { content?: unknown }).content : undefined);
  return { conversationId, ...(await writeState(conversationId, content, ctx)) };
}

export async function patchScratchpad(input: unknown, ctx: ExtensionBackendContext): Promise<ScratchpadState & { conversationId: string }> {
  const conversationId = conversationIdFrom(input, ctx);
  const record = input && typeof input === 'object' ? (input as { operation?: unknown; content?: unknown }) : {};
  const operation = record.operation === 'prepend' ? 'prepend' : 'append';
  const content = validateContent(record.content);
  const existing = await readState(conversationId, ctx);
  const nextContent = operation === 'prepend' ? joinMarkdown(content, existing.content) : joinMarkdown(existing.content, content);
  return { conversationId, ...(await writeState(conversationId, nextContent, ctx)) };
}

function readAction(input: unknown): ScratchpadAction {
  const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
  if (action === 'get' || action === 'set' || action === 'append' || action === 'prepend' || action === 'clear') return action;
  throw new Error('action must be get, set, append, prepend, or clear');
}

function summarize(state: ScratchpadState): string {
  return state.content ? `${state.content.length} characters` : 'empty';
}

export async function scratchpadTool(input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  input = normalizeCliInput(input);
  const action = readAction(input);
  if (action === 'get') {
    const state = await getScratchpad(input, ctx);
    return { text: state.content || '(scratchpad empty)', details: state };
  }
  if (action === 'set') {
    const state = await setScratchpad(input, ctx);
    return { text: `Scratchpad updated (${summarize(state)}).`, details: state };
  }
  if (action === 'clear') {
    const conversationId = conversationIdFrom(input, ctx);
    const state = await writeState(conversationId, '', ctx);
    return { text: 'Scratchpad cleared.', details: { conversationId, ...state } };
  }
  const state = await patchScratchpad(
    { ...(input && typeof input === 'object' ? (input as Record<string, unknown>) : {}), operation: action },
    ctx,
  );
  return { text: `Scratchpad ${action === 'prepend' ? 'prepended' : 'appended'} (${summarize(state)}).`, details: state };
}

export async function provideTurnContext(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ blocks: Array<{ title: string; content: string }> }> {
  const conversationId = conversationIdFrom(input, ctx);
  const state = await readState(conversationId, ctx);
  if (!state.content.trim()) return { blocks: [] };
  return {
    blocks: [
      {
        title: 'Conversation Scratchpad',
        content: [
          'This is durable per-conversation working state from the Scratchpad extension. Treat it as thread-local notes, not verified source material. Keep it current with the `scratchpad` tool and do not store secrets.',
          '',
          state.content.trim(),
        ].join('\n'),
      },
    ],
  };
}
