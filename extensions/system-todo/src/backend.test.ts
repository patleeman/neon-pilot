import { describe, expect, it, vi } from 'vitest';

import { addItem, clearItems, deleteItem, getState, provideTurnContext, setPlan, todoTool, updateItem } from './backend';

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
    expect(state.items[0]).toMatchObject({ id, text: 'Fix goal mode', status: 'done', note: 'Validated' });

    state = await addItem({ text: 'Keep another open' }, ctx);
    expect(state.items).toHaveLength(2);

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
      { text: 'Inspect files', status: 'done' },
      { text: 'Implement change', status: 'doing' },
      { text: 'Run validation', status: 'todo' },
    ]);
  });

  it('supports the todo tool action surface', async () => {
    const ctx = createCtx();

    await expect(todoTool({ action: 'add', text: 'One' }, ctx)).resolves.toMatchObject({ text: expect.stringContaining('Added todo') });
    const state = await getState({}, ctx);
    await expect(todoTool({ action: 'update', id: state.items[0]!.id, status: 'done' }, ctx)).resolves.toMatchObject({
      text: expect.stringContaining('Updated todo'),
    });
    await expect(todoTool({ action: 'list' }, ctx)).resolves.toMatchObject({ text: expect.stringContaining('One') });
    await expect(todoTool({ action: 'update_plan', plan: [{ step: 'Next', status: 'in_progress' }] }, ctx)).resolves.toMatchObject({
      text: expect.stringContaining('Set todo plan'),
    });
    await expect(todoTool({ action: 'clear', scope: 'all' }, ctx)).resolves.toMatchObject({ text: expect.stringContaining('0 open') });
  });
});
