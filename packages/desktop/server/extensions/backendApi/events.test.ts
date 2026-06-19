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

  it('routes durable event bus operations through the automation event bus host module', async () => {
    const events = await import('./events.js');
    resolver.callServerModuleExport.mockResolvedValue({});

    await events.emitEvent({ type: 'tweet.created' });
    await events.replayEvent({ eventId: 'evt-1' });
    await events.listEvents({ limit: 10 });
    await events.listSubscriptions();
    await events.saveSubscription({ name: 'Worker' });
    await events.deleteSubscription({ subscriptionId: 'sub-1' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../automation/eventBusHost.js', 'emitEvent', {
      type: 'tweet.created',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../automation/eventBusHost.js', 'replayEvent', {
      eventId: 'evt-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../../automation/eventBusHost.js', 'listEvents', {
      limit: 10,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '../../automation/eventBusHost.js', 'listSubscriptions', undefined);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(5, '../../automation/eventBusHost.js', 'saveSubscription', {
      name: 'Worker',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(6, '../../automation/eventBusHost.js', 'deleteSubscription', {
      subscriptionId: 'sub-1',
    });
  });
});
