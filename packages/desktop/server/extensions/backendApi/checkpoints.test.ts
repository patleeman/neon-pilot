import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/checkpoints', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes conversation checkpoint operations through core', async () => {
    const checkpoints = await import('./checkpoints.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await checkpoints.getConversationCommitCheckpoint({ conversationId: 'conv-1', checkpointId: 'checkpoint-1' });
    await checkpoints.listConversationCommitCheckpoints({ conversationId: 'conv-1' });
    await checkpoints.saveConversationCommitCheckpoint({ conversationId: 'conv-1', title: 'Checkpoint' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '@neon-pilot/core', 'getConversationCommitCheckpoint', {
      conversationId: 'conv-1',
      checkpointId: 'checkpoint-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '@neon-pilot/core', 'listConversationCommitCheckpoints', {
      conversationId: 'conv-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '@neon-pilot/core', 'saveConversationCommitCheckpoint', {
      conversationId: 'conv-1',
      title: 'Checkpoint',
    });
  });
});
