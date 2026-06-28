import { describe, expect, it, vi } from 'vitest';

import {
  addItem,
  clearItems,
  deleteItem,
  getState,
  listTodoConnections,
  provideTurnContext,
  setPlan,
  todoTool,
  updateItem,
} from './backend';

function createCtx() {
  const store = new Map<string, unknown>();
  const ctx = {
    toolContext: { conversationId: 'conv-1' },
    conversations: {
      metadata: {
        get: vi.fn(async ({ conversationId, namespace }: { conversationId: string; namespace: string }) =>
          store.get(`${conversationId}:${namespace}`),
        ),
        set: vi.fn(async ({ conversationId, namespace, values }: { conversationId: string; namespace: string; values: unknown }) => {
          store.set(`${conversationId}:${namespace}`, values);
        }),
      },
    },
  };
  return ctx as never;
}

describe('system-todo backend', () => {
  it('adds, updates, deletes, and clears conversation todos', async () => {
    const ctx = createCtx();

    let state = await addItem({ text: 'Fix goal mode', status: 'todo' }, ctx);
    expect(state.items).toMatchObject([{ text: 'Fix goal mode', status: 'todo' }]);
    const id = state.items[0]!.id;

    state = await updateItem({ id, status: 'done', note: 'Validated' }, ctx);
    expect(state.items).toEqual([]);

    state = await addItem({ text: 'Keep another open' }, ctx);
    expect(state.items).toHaveLength(1);

    state = await clearItems({ scope: 'done' }, ctx);
    expect(state.items).toMatchObject([{ text: 'Keep another open', status: 'todo' }]);

    state = await deleteItem({ id: state.items[0]!.id }, ctx);
    expect(state.items).toEqual([]);
  });

  it('provides turn context for open todos only', async () => {
    const ctx = createCtx();
    await addItem({ text: 'Open work', note: 'Waiting' }, ctx);
    const done = await addItem({ text: 'Done work' }, ctx);
    await updateItem({ id: done.items[0]!.id, status: 'done' }, ctx);

    const context = await provideTurnContext({}, ctx);
    expect(context.blocks).toHaveLength(1);
    expect(context.blocks[0]!.content).toContain('Open work');
    expect(context.blocks[0]!.content).toContain('Waiting');
    expect(context.blocks[0]!.content).not.toContain('Done work');
  });

  it('preserves active and blocked open statuses', async () => {
    const ctx = createCtx();

    await expect(addItem({ text: 'Active work', status: 'doing' }, ctx)).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'doing' })],
    });
    const state = await addItem({ text: 'Blocked work', status: 'blocked' }, ctx);
    expect(state.items.map((item) => item.status)).toEqual(['blocked', 'doing']);
  });

  it('atomically replaces todos with a Codex-style plan', async () => {
    const ctx = createCtx();
    await addItem({ text: 'Old item' }, ctx);

    const state = await setPlan(
      {
        plan: [
          { step: 'Inspect files', status: 'completed' },
          { step: 'Implement change', status: 'in_progress' },
          { step: 'Run validation', status: 'pending' },
        ],
      },
      ctx,
    );

    expect(state.items.map((item) => ({ text: item.text, status: item.status }))).toEqual([
      { text: 'Implement change', status: 'doing' },
      { text: 'Run validation', status: 'todo' },
    ]);
  });

  it('rejects plans above the item limit before mutating state', async () => {
    const ctx = createCtx();
    await addItem({ text: 'Keep existing item' }, ctx);

    await expect(
      setPlan(
        {
          items: Array.from({ length: 201 }, (_, index) => ({ text: `Item ${index + 1}`, status: 'todo' })),
        },
        ctx,
      ),
    ).rejects.toThrow('items must contain at most 200 entries');

    await expect(getState({}, ctx)).resolves.toMatchObject({ items: [expect.objectContaining({ text: 'Keep existing item' })] });
  });

  it('trims long item text and notes in tool-visible prompt context', async () => {
    const ctx = createCtx();
    const longText = `Task ${'x'.repeat(600)}`;
    const longNote = `Note ${'y'.repeat(600)}`;

    await todoTool({ action: 'add', text: longText, note: longNote }, ctx);
    const context = await provideTurnContext({}, ctx);

    expect(context.blocks[0]!.content).toContain(`Task ${'x'.repeat(495)}`);
    expect(context.blocks[0]!.content).not.toContain('x'.repeat(501));
    expect(context.blocks[0]!.content).toContain(`Note ${'y'.repeat(495)}`);
    expect(context.blocks[0]!.content).not.toContain('y'.repeat(501));
  });

  it('supports the todo tool action surface', async () => {
    const ctx = createCtx();

    await expect(todoTool({ action: 'add', text: 'One' }, ctx)).resolves.toMatchObject({ text: expect.stringContaining('Added todo') });
    const state = await getState({}, ctx);
    await expect(todoTool({ action: 'update', id: state.items[0]!.id, status: 'done' }, ctx)).resolves.toMatchObject({
      text: expect.stringContaining('0 open'),
    });
    const listed = (await todoTool({ action: 'list' }, ctx)) as { text: string };
    expect(listed.text).not.toContain('One');
    await expect(todoTool({ action: 'update_plan', plan: [{ step: 'Next', status: 'in_progress' }] }, ctx)).resolves.toMatchObject({
      text: expect.stringContaining('Set todo plan'),
    });
    await expect(todoTool({ action: 'clear', scope: 'all' }, ctx)).resolves.toMatchObject({ text: expect.stringContaining('0 open') });
  });

  it('publishes a conversation connection only when todos are meaningful', async () => {
    const ctx = createCtx();

    await expect(listTodoConnections({}, ctx)).resolves.toEqual({ items: [] });

    await addItem({ text: 'Wire connection shelf', status: 'doing' }, ctx);
    await expect(listTodoConnections({}, ctx)).resolves.toMatchObject({
      items: [
        {
          id: 'todos',
          conversationId: 'conv-1',
          kind: 'state',
          title: 'Todos',
          subtitle: expect.stringContaining('1 open'),
          active: true,
          visibility: 'system',
          source: { type: 'conversation-metadata', id: 'system-todo' },
          surfaces: ['composerShelf', 'cli'],
        },
      ],
    });
  });
});
