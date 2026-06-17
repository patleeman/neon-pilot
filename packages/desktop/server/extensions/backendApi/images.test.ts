import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/images', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('exposes image host capability only through the worker bridge', async () => {
    const images = await import('./images.js');
    expect(images.hasImageHostCapability()).toBe(false);
    await expect(images.generateImageInHost({ prompt: 'diagram' })).rejects.toThrow(
      'Image host capability is unavailable outside an extension backend worker request.',
    );

    const bridge = vi.fn(async (_capability: string, operation: string, input?: unknown) => ({ operation, input }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    expect(images.hasImageHostCapability()).toBe(true);
    await expect(images.generateImageInHost({ prompt: 'diagram' })).resolves.toEqual({
      operation: 'generate',
      input: { prompt: 'diagram' },
    });
    expect(bridge).toHaveBeenCalledWith('image', 'generate', { prompt: 'diagram' });
  });

  it('routes image probe attachment operations through the probe attachment store', async () => {
    const images = await import('./images.js');
    resolver.callServerModuleExport.mockResolvedValue([]);

    await images.clearImageProbeAttachmentCacheForTests();
    await images.getImageProbeAttachments({ sessionId: 'session-1' });
    await images.getImageProbeAttachmentsById({ sessionId: 'session-1', ids: ['image-1'] });
    await images.getImageProbeAttachmentsByIdFromAnySession(['image-1']);
    await images.rememberImageProbeAttachments({ sessionId: 'session-1', attachments: [] });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../extensions/imageProbeAttachmentStore.js',
      'clearImageProbeAttachmentCacheForTests',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../extensions/imageProbeAttachmentStore.js',
      'getImageProbeAttachments',
      { sessionId: 'session-1' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../extensions/imageProbeAttachmentStore.js',
      'getImageProbeAttachmentsById',
      { sessionId: 'session-1', ids: ['image-1'] },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../extensions/imageProbeAttachmentStore.js',
      'getImageProbeAttachmentsByIdFromAnySession',
      ['image-1'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../extensions/imageProbeAttachmentStore.js',
      'rememberImageProbeAttachments',
      { sessionId: 'session-1', attachments: [] },
    );
  });
});
