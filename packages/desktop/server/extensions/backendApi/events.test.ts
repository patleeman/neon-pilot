import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/events', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes app event operations through the shared app events module', async () => {
    const events = await import('./events.js');
    resolver.callServerModuleExport.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    await events.publishAppEvent({ type: 'extension.ready' });
    await events.invalidateAppTopics(['extensions']);

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../shared/appEvents.js', 'publishAppEvent', {
      type: 'extension.ready',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../shared/appEvents.js', 'invalidateAppTopics', ['extensions']);
  });
});
