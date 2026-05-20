import { describe, expect, it } from 'vitest';

import { addItem, deleteItem, getState, looseEndsTool, provideTurnContext, setEnabled, updateItem } from './backend.js';

function createCtx() {
  const store = new Map<string, unknown>();
  return {
    toolContext: { conversationId: 'conv-1', sessionId: 'conv-1' },
    conversations: {
      metadata: {
        get: async ({ conversationId, namespace }: { conversationId: string; namespace: string }) =>
          store.get(`${conversationId}:${namespace}`),
        set: async ({ conversationId, namespace, values }: { conversationId: string; namespace: string; values: unknown }) => {
          store.set(`${conversationId}:${namespace}`, values);
        },
      },
    },
  } as never;
}

describe('loose ends backend', () => {
  it('adds lists updates deletes and provides enabled turn context', async () => {
    const ctx = createCtx();

    await setEnabled({ enabled: true }, ctx);
    let state = await addItem({ text: 'tool pass temporary loose end' }, ctx);
    const item = state.items[0]!;
    expect(item.text).toBe('tool pass temporary loose end');
    expect(item.status).toBe('open');

    const listed = (await looseEndsTool({ action: 'list' }, ctx)) as { text: string };
    expect(listed.text).toContain('tool pass temporary loose end');

    state = await updateItem({ id: item.id, text: 'updated loose end', status: 'resolved' }, ctx);
    expect(state.items[0]).toMatchObject({ id: item.id, text: 'updated loose end', status: 'resolved' });

    const context = await provideTurnContext({}, ctx);
    expect(context.blocks[0]?.content).toContain('Loose Ends is enabled.');

    state = await deleteItem({ id: item.id }, ctx);
    expect(state.items).toEqual([]);
    await expect(getState({}, ctx)).resolves.toMatchObject({ enabled: true, items: [] });
  });

  it('exposes add and update through the agent tool action surface', async () => {
    const ctx = createCtx();

    const added = (await looseEndsTool({ action: 'add', text: 'remember me' }, ctx)) as { text: string };
    expect(added.text).toContain('Added Loose End');

    const state = await getState({}, ctx);
    const updated = (await looseEndsTool({ action: 'update', id: state.items[0]!.id, status: 'dismissed' }, ctx)) as { text: string };
    expect(updated.text).toContain('Updated Loose End');
    await expect(getState({}, ctx)).resolves.toMatchObject({ items: [expect.objectContaining({ status: 'dismissed' })] });
  });
});
