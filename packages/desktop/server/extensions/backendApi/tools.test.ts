import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/tools', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes tool gateway operations through the host tool gateway module', async () => {
    const tools = await import('./tools.js');
    resolver.callServerModuleExport.mockResolvedValueOnce([{ name: 'search' }]);
    resolver.callServerModuleExport.mockResolvedValueOnce({ ok: true });
    resolver.callServerModuleExport.mockResolvedValueOnce({ content: 'done' });

    await expect(tools.listInvocableExtensionTools({ conversationId: 'conv-1' })).resolves.toEqual([{ name: 'search' }]);
    await expect(tools.invokeExtensionToolByName('search', { q: 'docs' })).resolves.toEqual({ ok: true });
    await expect(tools.invokeToolByName('bash', { command: 'pwd' })).resolves.toEqual({ content: 'done' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../tools/toolGateway.js', 'listInvocableExtensionTools', {
      conversationId: 'conv-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../tools/toolGateway.js',
      'invokeExtensionToolByName',
      'search',
      { q: 'docs' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../../tools/toolGateway.js', 'invokeToolByName', 'bash', {
      command: 'pwd',
    });
  });
});
