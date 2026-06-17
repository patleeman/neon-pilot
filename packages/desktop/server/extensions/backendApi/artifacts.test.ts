import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/artifacts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes conversation artifact operations through core', async () => {
    const artifacts = await import('./artifacts.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await artifacts.deleteConversationArtifact({ conversationId: 'conv-1', artifactId: 'artifact-1' });
    await artifacts.getConversationArtifact({ conversationId: 'conv-1', artifactId: 'artifact-1' });
    await artifacts.listConversationArtifacts({ conversationId: 'conv-1' });
    await artifacts.saveConversationArtifact({ conversationId: 'conv-1', title: 'Artifact' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '@neon-pilot/core', 'deleteConversationArtifact', {
      conversationId: 'conv-1',
      artifactId: 'artifact-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '@neon-pilot/core', 'getConversationArtifact', {
      conversationId: 'conv-1',
      artifactId: 'artifact-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '@neon-pilot/core', 'listConversationArtifacts', {
      conversationId: 'conv-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '@neon-pilot/core', 'saveConversationArtifact', {
      conversationId: 'conv-1',
      title: 'Artifact',
    });
  });
});
