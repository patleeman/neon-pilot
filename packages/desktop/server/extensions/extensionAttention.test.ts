import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelAttentionEventForSessionFile = vi.fn();
const enqueueAttentionEventForSessionFile = vi.fn();
const listAttentionEventsForSessionFile = vi.fn();
const findExtensionEntry = vi.fn();

vi.mock('../automation/attentionEvents.js', () => ({
  cancelAttentionEventForSessionFile,
  enqueueAttentionEventForSessionFile,
  listAttentionEventsForSessionFile,
}));
vi.mock('./extensionRegistry.js', () => ({ findExtensionEntry }));

const { createExtensionAttentionCapability } = await import('./extensionAttention.js');

describe('extensionAttention', () => {
  beforeEach(() => {
    cancelAttentionEventForSessionFile.mockReset().mockResolvedValue({ cancelled: true });
    enqueueAttentionEventForSessionFile.mockReset().mockResolvedValue({ id: 'attention-1' });
    listAttentionEventsForSessionFile.mockReset().mockResolvedValue([{ id: 'attention-1' }]);
    findExtensionEntry.mockReset().mockReturnValue({ manifest: { permissions: ['attention:read', 'attention:write'] } });
  });

  it('enqueues attention events with explicit input and extension source metadata', async () => {
    const attention = createExtensionAttentionCapability('ext', { conversationId: 'ctx-conversation', sessionFile: '/ctx.json' });

    await expect(
      attention.enqueue({
        conversationId: ' input-conversation ',
        sessionFile: ' /session.json ',
        title: 'Review',
        prompt: 'Do the thing',
        delay: '10m',
        source: { kind: ' custom ', id: 'source-1' },
        delivery: { priority: 'high' },
      }),
    ).resolves.toEqual({ id: 'attention-1' });

    expect(enqueueAttentionEventForSessionFile).toHaveBeenCalledWith({
      sessionFile: '/session.json',
      conversationId: 'input-conversation',
      title: 'Review',
      prompt: 'Do the thing',
      delay: '10m',
      at: undefined,
      source: { kind: 'custom', id: 'source-1', extensionId: 'ext' },
      delivery: { priority: 'high' },
    });
  });

  it('falls back to active conversation context and defaults source kind to extension', async () => {
    const attention = createExtensionAttentionCapability('ext', { sessionId: 'session-id', sessionFile: '/ctx.json' });

    await attention.enqueue({ prompt: 'Follow up' });

    expect(enqueueAttentionEventForSessionFile).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionFile: '/ctx.json',
        conversationId: 'session-id',
        source: { kind: 'extension', id: undefined, extensionId: 'ext' },
      }),
    );
  });

  it('requires prompt, session file, and declared permissions', async () => {
    const attention = createExtensionAttentionCapability('ext');
    await expect(attention.enqueue({ prompt: '   ' })).rejects.toThrow('prompt is required');
    await expect(attention.enqueue({ prompt: 'go' })).rejects.toThrow('sessionFile');

    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['attention:read'] } });
    await expect(attention.enqueue({ prompt: 'go', sessionFile: '/s.json' })).rejects.toThrow('requires permission attention:write');

    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['attention:write'] } });
    await expect(attention.list({ sessionFile: '/s.json' })).rejects.toThrow('requires permission attention:read');
  });

  it('lists and cancels attention events for resolved sessions', async () => {
    const attention = createExtensionAttentionCapability('ext', { sessionFile: '/ctx.json' });

    await expect(attention.list()).resolves.toEqual([{ id: 'attention-1' }]);
    expect(listAttentionEventsForSessionFile).toHaveBeenCalledWith('/ctx.json');

    await expect(attention.cancel({ id: 'attention-1', sessionFile: '/explicit.json' })).resolves.toEqual({ cancelled: true });
    expect(cancelAttentionEventForSessionFile).toHaveBeenCalledWith({ sessionFile: '/explicit.json', id: 'attention-1' });
  });
});
