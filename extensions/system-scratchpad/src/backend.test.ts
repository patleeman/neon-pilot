import { describe, expect, it, vi } from 'vitest';

import { getScratchpad, patchScratchpad, provideTurnContext, scratchpadTool, setScratchpad } from './backend.js';

function createContext(initial: Record<string, unknown> = {}) {
  let metadata = { ...initial };
  return {
    ctx: {
      toolContext: { conversationId: 'conv-1' },
      conversations: {
        metadata: {
          get: vi.fn(async () => metadata),
          set: vi.fn(async ({ values }: { values: Record<string, unknown> }) => {
            metadata = { ...values };
            return metadata;
          }),
        },
      },
    } as never,
    get metadata() {
      return metadata;
    },
  };
}

describe('scratchpad backend', () => {
  it('reads and writes the preserved metadata namespace', async () => {
    const harness = createContext();

    await setScratchpad({ content: 'Plan' }, harness.ctx);
    await expect(getScratchpad({}, harness.ctx)).resolves.toMatchObject({ conversationId: 'conv-1', content: 'Plan' });
    expect(harness.ctx.conversations.metadata.set).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      namespace: 'threadScratchpad',
      values: expect.objectContaining({ content: 'Plan' }),
    });
  });

  it('appends and prepends markdown with spacing', async () => {
    const harness = createContext({ content: 'Middle', updatedAt: '2026-01-01T00:00:00.000Z' });

    await expect(patchScratchpad({ operation: 'append', content: 'End' }, harness.ctx)).resolves.toMatchObject({ content: 'Middle\n\nEnd' });
    await expect(patchScratchpad({ operation: 'prepend', content: 'Start' }, harness.ctx)).resolves.toMatchObject({
      content: 'Start\n\nMiddle\n\nEnd',
    });
  });

  it('exposes an agent tool and turn context', async () => {
    const harness = createContext();

    await expect(scratchpadTool({ action: 'set', content: 'Decision: use an extension.' }, harness.ctx)).resolves.toMatchObject({
      text: expect.stringContaining('Scratchpad updated'),
    });
    await expect(scratchpadTool({ action: 'get' }, harness.ctx)).resolves.toMatchObject({
      text: 'Decision: use an extension.',
    });
    await expect(provideTurnContext({}, harness.ctx)).resolves.toEqual({
      blocks: [
        {
          title: 'Conversation Scratchpad',
          content: expect.stringContaining('Decision: use an extension.'),
        },
      ],
    });
  });

  it('omits empty scratchpads from turn context', async () => {
    const harness = createContext({ content: '   ', updatedAt: '2026-01-01T00:00:00.000Z' });

    await expect(provideTurnContext({}, harness.ctx)).resolves.toEqual({ blocks: [] });
  });
});
