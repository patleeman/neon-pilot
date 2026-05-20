import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const METADATA_NAMESPACE = 'system-loose-ends';
const MAX_ITEM_TEXT_LENGTH = 1000;
const MAX_ITEMS = 200;

type LooseEndStatus = 'open' | 'resolved' | 'dismissed';

interface LooseEndItem {
  id: string;
  text: string;
  status: LooseEndStatus;
  createdAt: string;
  updatedAt: string;
}

interface LooseEndsState {
  schemaVersion: 1;
  enabled: boolean;
  updatedAt: string;
  items: LooseEndItem[];
}

interface ConversationInput {
  conversationId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `le_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function conversationIdFrom(input: unknown, ctx: ExtensionBackendContext): string {
  const explicit = input && typeof input === 'object' ? (input as ConversationInput).conversationId : undefined;
  const conversationId = explicit?.trim() || ctx.toolContext?.conversationId?.trim() || ctx.toolContext?.sessionId?.trim();
  if (!conversationId) throw new Error('conversationId required');
  return conversationId;
}

function normalizeStatus(value: unknown, fallback: LooseEndStatus = 'open'): LooseEndStatus {
  return value === 'open' || value === 'resolved' || value === 'dismissed' ? value : fallback;
}

function normalizeState(value: unknown): LooseEndsState {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item): LooseEndItem[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : makeId();
        const text = typeof raw.text === 'string' ? raw.text.trim() : '';
        if (!text) return [];
        const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : nowIso();
        const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : createdAt;
        return [{ id, text, status: normalizeStatus(raw.status), createdAt, updatedAt }];
      })
    : [];

  return {
    schemaVersion: 1,
    enabled: record.enabled === true,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.trim() ? record.updatedAt : nowIso(),
    items: items.slice(0, MAX_ITEMS),
  };
}

async function readState(conversationId: string, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  return normalizeState(await ctx.conversations.metadata.get({ conversationId, namespace: METADATA_NAMESPACE }));
}

async function writeState(conversationId: string, state: LooseEndsState, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  const next = { ...state, schemaVersion: 1 as const, updatedAt: nowIso(), items: state.items.slice(0, MAX_ITEMS) };
  await ctx.conversations.metadata.set({
    conversationId,
    namespace: METADATA_NAMESPACE,
    values: next as unknown as Record<string, unknown>,
  });
  return next;
}

function requireText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('text required');
  return value.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
}

export async function getState(input: unknown, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  return readState(conversationIdFrom(input, ctx), ctx);
}

export async function setEnabled(input: unknown, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  const conversationId = conversationIdFrom(input, ctx);
  const enabled = Boolean(input && typeof input === 'object' && (input as { enabled?: unknown }).enabled);
  const state = await readState(conversationId, ctx);
  return writeState(conversationId, { ...state, enabled }, ctx);
}

export async function addItem(input: unknown, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  const conversationId = conversationIdFrom(input, ctx);
  const text = requireText(input && typeof input === 'object' ? (input as { text?: unknown }).text : undefined);
  const state = await readState(conversationId, ctx);
  const at = nowIso();
  return writeState(
    conversationId,
    { ...state, items: [{ id: makeId(), text, status: 'open', createdAt: at, updatedAt: at }, ...state.items] },
    ctx,
  );
}

export async function updateItem(input: unknown, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  const conversationId = conversationIdFrom(input, ctx);
  const record = input && typeof input === 'object' ? (input as { id?: unknown; text?: unknown; status?: unknown }) : {};
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) throw new Error('id required');
  const hasText = typeof record.text === 'string';
  const hasStatus = record.status !== undefined;
  if (!hasText && !hasStatus) throw new Error('text or status required');
  const state = await readState(conversationId, ctx);
  let found = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return {
      ...item,
      ...(hasText ? { text: requireText(record.text) } : {}),
      ...(hasStatus ? { status: normalizeStatus(record.status, item.status) } : {}),
      updatedAt: nowIso(),
    };
  });
  if (!found) throw new Error(`Loose End not found: ${id}`);
  return writeState(conversationId, { ...state, items }, ctx);
}

export async function deleteItem(input: unknown, ctx: ExtensionBackendContext): Promise<LooseEndsState> {
  const conversationId = conversationIdFrom(input, ctx);
  const id =
    input && typeof input === 'object' && typeof (input as { id?: unknown }).id === 'string' ? (input as { id: string }).id.trim() : '';
  if (!id) throw new Error('id required');
  const state = await readState(conversationId, ctx);
  return writeState(conversationId, { ...state, items: state.items.filter((item) => item.id !== id) }, ctx);
}

export async function looseEndsTool(input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
  if (action === 'list') {
    const state = await getState(input, ctx);
    return { text: JSON.stringify({ enabled: state.enabled, items: state.items }, null, 2) };
  }
  if (action === 'add') {
    const state = await addItem(input, ctx);
    return { text: `Added Loose End. Open items: ${state.items.filter((item) => item.status === 'open').length}` };
  }
  if (action === 'update') {
    const state = await updateItem(input, ctx);
    return { text: `Updated Loose End. Open items: ${state.items.filter((item) => item.status === 'open').length}` };
  }
  throw new Error('action must be list, add, or update');
}

export async function provideTurnContext(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ blocks: Array<{ title: string; content: string }> }> {
  const conversationId = conversationIdFrom(input, ctx);
  const state = await readState(conversationId, ctx);
  if (!state.enabled) return { blocks: [] };

  const openItems = state.items.filter((item) => item.status === 'open');
  const existing =
    openItems.length > 0 ? `\n\nCurrent open Loose Ends:\n${openItems.map((item) => `- ${item.id}: ${item.text}`).join('\n')}` : '';
  return {
    blocks: [
      {
        title: 'Loose Ends',
        content: [
          'Loose Ends is enabled.',
          '',
          'Use `loose_ends` to capture important context that might otherwise be lost: assumptions, non-obvious tradeoffs, surprises, nearby bugs/tech debt, follow-ups, risks, or validation limits.',
          '',
          'Do not use it as a work log. Skip ordinary steps, file changes, commands, and test output.',
          '',
          'Add or resolve items only when they would help the user later. Before finishing, check whether any Loose Ends need updating.',
          existing,
        ].join('\n'),
      },
    ],
  };
}
