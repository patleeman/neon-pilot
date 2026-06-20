import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/events', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
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
    await events.delayEvent({ type: 'tweet.created', delayMs: 1000 });
    await events.replayEvent({ eventId: 'evt-1' });
    await events.listEvents({ limit: 10 });
    await events.listSubscriptions();
    await events.saveSubscription({ name: 'Worker' });
    await events.deleteSubscription({ subscriptionId: 'sub-1' });
    await events.cancelDelayedEvent({ delayedEventId: 'delay-1' });
    await events.pruneEvents({ keepLatest: 100 });
    await events.processDueEvents({ limit: 10 });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../automation/eventBusHost.js', 'emitEvent', {
      type: 'tweet.created',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../automation/eventBusHost.js', 'delayEvent', {
      type: 'tweet.created',
      delayMs: 1000,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../../automation/eventBusHost.js', 'replayEvent', {
      eventId: 'evt-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '../../automation/eventBusHost.js', 'listEvents', {
      limit: 10,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(5, '../../automation/eventBusHost.js', 'listSubscriptions', undefined);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(6, '../../automation/eventBusHost.js', 'saveSubscription', {
      name: 'Worker',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(7, '../../automation/eventBusHost.js', 'deleteSubscription', {
      subscriptionId: 'sub-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(8, '../../automation/eventBusHost.js', 'cancelDelayedEvent', {
      delayedEventId: 'delay-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(9, '../../automation/eventBusHost.js', 'pruneEvents', {
      keepLatest: 100,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(10, '../../automation/eventBusHost.js', 'processDueEvents', {
      limit: 10,
    });
  });

  it('routes durable event bus operations through the extension host capability bridge when active', async () => {
    const bridge = vi.fn().mockResolvedValue({});
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const events = await import('./events.js');

    await events.emitEvent({ type: 'tweet.created' });
    await events.delayEvent({ type: 'tweet.created', delayMs: 1000 });
    await events.replayEvent({ eventId: 'evt-1' });
    await events.listEvents({ limit: 10 });
    await events.listSubscriptions();
    await events.saveSubscription({ name: 'Worker' });
    await events.deleteSubscription({ subscriptionId: 'sub-1' });
    await events.cancelDelayedEvent({ delayedEventId: 'delay-1' });
    await events.pruneEvents({ keepLatest: 100 });
    await events.processDueEvents({ limit: 10 });

    expect(bridge).toHaveBeenNthCalledWith(1, 'events', 'emit', { type: 'tweet.created' });
    expect(bridge).toHaveBeenNthCalledWith(2, 'events', 'delay', { type: 'tweet.created', delayMs: 1000 });
    expect(bridge).toHaveBeenNthCalledWith(3, 'events', 'replay', { eventId: 'evt-1' });
    expect(bridge).toHaveBeenNthCalledWith(4, 'events', 'list', { limit: 10 });
    expect(bridge).toHaveBeenNthCalledWith(5, 'events', 'listSubscriptions', undefined);
    expect(bridge).toHaveBeenNthCalledWith(6, 'events', 'saveSubscription', { name: 'Worker' });
    expect(bridge).toHaveBeenNthCalledWith(7, 'events', 'deleteSubscription', { subscriptionId: 'sub-1' });
    expect(bridge).toHaveBeenNthCalledWith(8, 'events', 'cancelDelayed', { delayedEventId: 'delay-1' });
    expect(bridge).toHaveBeenNthCalledWith(9, 'events', 'prune', { keepLatest: 100 });
    expect(bridge).toHaveBeenNthCalledWith(10, 'events', 'processDue', { limit: 10 });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });
});
