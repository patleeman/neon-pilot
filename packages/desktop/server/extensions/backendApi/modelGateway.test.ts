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
    const stream = async function* () {
      yield { type: 'response.created' };
      yield '[DONE]' as const;
    };

    await modelGateway.modelGatewaySettingsFrom({ port: 9000 });
    await modelGateway.listModelGatewayModels(ctx as never);
    await modelGateway.writeModelGatewayCatalog(ctx as never);
    await modelGateway.createModelGatewayResponse(ctx as never, request as never, settings as never, { signal: undefined });
    resolver.callServerModuleExport.mockResolvedValueOnce(stream());
    const streamed = [];
    for await (const event of modelGateway.streamModelGatewayResponseEvents(ctx as never, request as never, settings as never, {
      signal: undefined,
    })) {
      streamed.push(event);
    }

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../modelGatewayRuntime.js', 'modelGatewaySettingsFrom', {
      port: 9000,
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../modelGatewayRuntime.js', 'listModelGatewayModels', ctx);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(3, '../../modelGatewayRuntime.js', 'writeModelGatewayCatalog', ctx);
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../modelGatewayRuntime.js',
      'createModelGatewayResponse',
      ctx,
      request,
      settings,
      { signal: undefined },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../modelGatewayRuntime.js',
      'streamModelGatewayResponseEvents',
      ctx,
      request,
      settings,
      { signal: undefined },
    );
    expect(streamed).toEqual([{ type: 'response.created' }, '[DONE]']);
  });
});
