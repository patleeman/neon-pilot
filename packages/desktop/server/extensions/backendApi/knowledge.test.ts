import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/knowledge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reads knowledge base state from core', async () => {
    const knowledge = await import('./knowledge.js');
    resolver.callServerModuleExport.mockResolvedValueOnce({ configured: true, repoUrl: 'git@example.com:kb.git' });

    await expect(knowledge.readKnowledgeState()).resolves.toEqual({ configured: true, repoUrl: 'git@example.com:kb.git' });
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('@neon-pilot/core', 'readKnowledgeBaseState');
  });

  it('updates knowledge base state through core and returns the next state', async () => {
    const knowledge = await import('./knowledge.js');
    const nextState = { configured: true, repoUrl: 'git@example.com:kb.git', branch: 'main' };
    resolver.callServerModuleExport.mockResolvedValueOnce(nextState);

    await expect(knowledge.updateKnowledgeState({ repoUrl: 'git@example.com:kb.git', branch: 'main' })).resolves.toBe(nextState);
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('@neon-pilot/core', 'updateKnowledgeBase', {
      repoUrl: 'git@example.com:kb.git',
      branch: 'main',
    });
  });

  it('syncs knowledge base state through core and ignores best-effort invalidation failures', async () => {
    const knowledge = await import('./knowledge.js');
    const nextState = { configured: true, lastSyncStatus: 'ok' };
    resolver.callServerModuleExport.mockResolvedValueOnce(nextState);

    await expect(knowledge.syncKnowledgeState()).resolves.toBe(nextState);
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('@neon-pilot/core', 'syncKnowledgeBaseNow');
  });
});
