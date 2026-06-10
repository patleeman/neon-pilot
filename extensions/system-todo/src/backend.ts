import type { ExtensionBackendContext } from '@neon-pilot/extensions';

const METADATA_NAMESPACE = 'system-todo';
const MAX_ITEM_TEXT_LENGTH = 500;
const MAX_NOTE_LENGTH = 500;
const MAX_ITEMS = 200;

type TodoStatus = 'todo' | 'doing' | 'blocked' | 'done';

interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface TodoState {
  schemaVersion: 1;
  updatedAt: string;
  items: TodoItem[];
}

interface ConversationInput {
  conversationId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `td_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function conversationIdFrom(input: unknown, ctx: ExtensionBackendContext): string {
  const explicit = input && typeof input === 'object' ? (input as ConversationInput).conversationId : undefined;
  const conversationId = explicit?.trim() || ctx.toolContext?.conversationId?.trim() || ctx.toolContext?.sessionId?.trim();
  if (!conversationId) throw new Error('conversationId required');
  return conversationId;
}

function normalizeStatus(value: unknown, fallback: TodoStatus = 'todo'): TodoStatus {
  if (value === 'done' || value === 'completed') return 'done';
  if (value === 'doing' || value === 'in_progress') return 'doing';
  if (value === 'blocked') return 'blocked';
  if (value === 'todo' || value === 'pending') return 'todo';
  return fallback;
}

function normalizeState(value: unknown): TodoState {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item): TodoItem[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : makeId();
        const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH) : '';
        if (!text) return [];
        const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, MAX_NOTE_LENGTH) : undefined;
        const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : nowIso();
        const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : createdAt;
        return [{ id, text, status: normalizeStatus(raw.status), ...(note ? { note } : {}), createdAt, updatedAt }];
      })
    : [];

  return {
    schemaVersion: 1,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.trim() ? record.updatedAt : nowIso(),
    items: items.slice(0, MAX_ITEMS),
  };
}

async function readState(conversationId: string, ctx: ExtensionBackendContext): Promise<TodoState> {
  return normalizeState(await ctx.conversations.metadata.get({ conversationId, namespace: METADATA_NAMESPACE }));
}

async function writeState(conversationId: string, state: TodoState, ctx: ExtensionBackendContext): Promise<TodoState> {
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

function optionalNote(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('note must be a string');
  return value.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
}

function summarize(state: TodoState): string {
  const open = state.items.filter((item) => item.status !== 'done').length;
  const done = state.items.filter((item) => item.status === 'done').length;
  return `${open} open${done ? ` · ${done} done` : ''}`;
}

export async function getState(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  return readState(conversationIdFrom(input, ctx), ctx);
}

export async function addItem(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  const conversationId = conversationIdFrom(input, ctx);
  const record = input && typeof input === 'object' ? (input as { text?: unknown; status?: unknown; note?: unknown }) : {};
  const text = requireText(record.text);
  const status = normalizeStatus(record.status);
  const note = optionalNote(record.note);
  const state = await readState(conversationId, ctx);
  const at = nowIso();
  return writeState(
    conversationId,
    { ...state, items: [{ id: makeId(), text, status, ...(note ? { note } : {}), createdAt: at, updatedAt: at }, ...state.items] },
    ctx,
  );
}

export async function updateItem(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  const conversationId = conversationIdFrom(input, ctx);
  const record = input && typeof input === 'object' ? (input as { id?: unknown; text?: unknown; status?: unknown; note?: unknown }) : {};
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) throw new Error('id required');
  const hasText = typeof record.text === 'string';
  const hasStatus = record.status !== undefined;
  const hasNote = record.note !== undefined;
  if (!hasText && !hasStatus && !hasNote) throw new Error('text, status, or note required');

  const state = await readState(conversationId, ctx);
  let found = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    found = true;
    const note = hasNote ? optionalNote(record.note) : item.note;
    return {
      ...item,
      ...(hasText ? { text: requireText(record.text) } : {}),
      ...(hasStatus ? { status: normalizeStatus(record.status, item.status) } : {}),
      ...(note ? { note } : { note: undefined }),
      updatedAt: nowIso(),
    };
  });
  if (!found) throw new Error(`Todo not found: ${id}`);
  return writeState(conversationId, { ...state, items }, ctx);
}

export async function deleteItem(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  const conversationId = conversationIdFrom(input, ctx);
  const id =
    input && typeof input === 'object' && typeof (input as { id?: unknown }).id === 'string' ? (input as { id: string }).id.trim() : '';
  if (!id) throw new Error('id required');
  const state = await readState(conversationId, ctx);
  return writeState(conversationId, { ...state, items: state.items.filter((item) => item.id !== id) }, ctx);
}

export async function clearItems(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  const conversationId = conversationIdFrom(input, ctx);
  const scope = input && typeof input === 'object' ? (input as { scope?: unknown }).scope : undefined;
  const state = await readState(conversationId, ctx);
  if (scope === 'all') return writeState(conversationId, { ...state, items: [] }, ctx);
  return writeState(conversationId, { ...state, items: state.items.filter((item) => item.status !== 'done') }, ctx);
}

function planItemsFrom(input: unknown): Array<{ text: string; status: TodoStatus; note?: string }> {
  const record = input && typeof input === 'object' ? (input as { items?: unknown; plan?: unknown }) : {};
  const rawItems = Array.isArray(record.items) ? record.items : Array.isArray(record.plan) ? record.plan : undefined;
  if (!rawItems) throw new Error('items or plan required');
  if (rawItems.length > MAX_ITEMS) throw new Error(`items must contain at most ${MAX_ITEMS} entries`);

  return rawItems.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`item ${index + 1} must be an object`);
    const raw = item as { text?: unknown; step?: unknown; status?: unknown; note?: unknown };
    const note = optionalNote(raw.note);
    return {
      text: requireText(typeof raw.text === 'string' ? raw.text : raw.step),
      status: normalizeStatus(raw.status),
      ...(note ? { note } : {}),
    };
  });
}

export async function setPlan(input: unknown, ctx: ExtensionBackendContext): Promise<TodoState> {
  const conversationId = conversationIdFrom(input, ctx);
  const at = nowIso();
  const items = planItemsFrom(input).map((item) => ({ id: makeId(), ...item, createdAt: at, updatedAt: at }));
  const state = await readState(conversationId, ctx);
  return writeState(conversationId, { ...state, items }, ctx);
}

export async function todoTool(input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
  if (action === 'list') {
    const state = await getState(input, ctx);
    return { text: JSON.stringify({ items: state.items, summary: summarize(state) }, null, 2) };
  }
  if (action === 'add') {
    const state = await addItem(input, ctx);
    return { text: `Added todo. ${summarize(state)}` };
  }
  if (action === 'update') {
    const state = await updateItem(input, ctx);
    return { text: `Updated todo. ${summarize(state)}` };
  }
  if (action === 'delete') {
    const state = await deleteItem(input, ctx);
    return { text: `Deleted todo. ${summarize(state)}` };
  }
  if (action === 'clear') {
    const state = await clearItems(input, ctx);
    return { text: `Cleared todos. ${summarize(state)}` };
  }
  if (action === 'set' || action === 'update_plan') {
    const state = await setPlan(input, ctx);
    return { text: `Set todo plan. ${summarize(state)}` };
  }
  throw new Error('action must be list, add, update, delete, clear, set, or update_plan');
}

export async function provideTurnContext(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ blocks: Array<{ title: string; content: string }> }> {
  const conversationId = conversationIdFrom(input, ctx);
  const state = await readState(conversationId, ctx);
  const openItems = state.items.filter((item) => item.status !== 'done');
  if (openItems.length === 0) return { blocks: [] };

  return {
    blocks: [
      {
        title: 'Todos',
        content: [
          'Conversation todos are short-lived execution state. Prefer `todo` action `update_plan`/`set` to replace the whole checklist atomically when planning or marking multiple steps. Use item-level add/update/delete for one-off manual edits only. Do not replace the active goal for temporary subtasks.',
          '',
          ...openItems.map((item) => `- ${item.id}: [${item.status}] ${item.text}${item.note ? ` — ${item.note}` : ''}`),
        ].join('\n'),
      },
    ],
  };
}
