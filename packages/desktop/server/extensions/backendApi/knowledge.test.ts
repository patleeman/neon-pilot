import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/knowledge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes knowledge helpers through memory docs and core modules', async () => {
    const knowledge = await import('./knowledge.js');
    resolver.callServerModuleExport.mockResolvedValue('ok');

    await knowledge.buildRecentReadUsage('/vault');
    await knowledge.listMemoryDocs({ profile: 'assistant' });
    await knowledge.listSkillsForProfile('assistant');
    await knowledge.normalizeMemoryPath('notes/today.md');
    await knowledge.getDurableAgentFilePath('agent');
    await knowledge.getKnowledgeRoot();
    await knowledge.resolveRuntimeResources({ profile: 'assistant' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../knowledge/memoryDocs.js', 'buildRecentReadUsage', '/vault');
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../knowledge/memoryDocs.js', 'listMemoryDocs', {
      profile: 'assistant',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../knowledge/memoryDocs.js',
      'listSkillsForProfile',
      'assistant',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../knowledge/memoryDocs.js',
      'normalizeMemoryPath',
      'notes/today.md',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(5, '@neon-pilot/core', 'getDurableAgentFilePath', 'agent');
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(6, '@neon-pilot/core', 'getKnowledgeRoot');
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(7, '@neon-pilot/core', 'resolveRuntimeResources', {
      profile: 'assistant',
    });
  });
});
