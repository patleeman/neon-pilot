import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/modelGateway', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes model gateway runtime operations through the host runtime module', async () => {
    const modelGateway = await import('./modelGateway.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });
    const ctx = { runtime: 'ctx' };
    const settings = { port: 8766 };
    const request = { model: 'auto', input: 'hello' };

    await modelGateway.modelGatewaySettingsFrom({ port: 9000 });
    await modelGateway.listModelGatewayModels(ctx as never);
    await modelGateway.writeModelGatewayCatalog(ctx as never);
    await modelGateway.readModelGatewayCodexConfigStatus(ctx as never, { profile: 'default' });
    await modelGateway.installModelGatewayCodexConfig(ctx as never, settings as never, { profile: 'default' });
    await modelGateway.removeModelGatewayCodexConfig(ctx as never, { profile: 'default' });
    await modelGateway.createModelGatewayResponse(ctx as never, request as never, settings as never, { signal: undefined });
    await modelGateway.streamModelGatewayResponseEvents(ctx as never, request as never, settings as never, { signal: undefined });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../modelGatewayRuntime.js', 'modelGatewaySettingsFrom', {
      port: 9000,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../modelGatewayRuntime.js', 'listModelGatewayModels', ctx);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../../modelGatewayRuntime.js', 'writeModelGatewayCatalog', ctx);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../modelGatewayRuntime.js',
      'readModelGatewayCodexConfigStatus',
      ctx,
      { profile: 'default' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../modelGatewayRuntime.js',
      'installModelGatewayCodexConfig',
      ctx,
      settings,
      { profile: 'default' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      6,
      '../../modelGatewayRuntime.js',
      'removeModelGatewayCodexConfig',
      ctx,
      { profile: 'default' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      7,
      '../../modelGatewayRuntime.js',
      'createModelGatewayResponse',
      ctx,
      request,
      settings,
      { signal: undefined },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      8,
      '../../modelGatewayRuntime.js',
      'streamModelGatewayResponseEvents',
      ctx,
      request,
      settings,
      { signal: undefined },
    );
  });
});
