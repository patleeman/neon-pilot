import { describe, expect, it, vi } from 'vitest';

import { createExtensionHostRpcClient } from './extensionHostRpcClient.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

describe('extension host RPC client', () => {
  it('sends health requests with bearer auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, status: 'ready' }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://127.0.0.1:1234/', token: 'secret', fetchImpl });

    await expect(client.health()).resolves.toEqual({ status: 'ready' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/rpc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
        body: JSON.stringify({ request: { type: 'health' } }),
      }),
    );
  });

  it('invokes wireable action requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: { ok: true, result: { done: true } } }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.invokeAction({ extensionId: 'ext', actionId: 'doThing', input: { x: 1 } })).resolves.toEqual({
      ok: true,
      result: { done: true },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'invokeAction', extensionId: 'ext', actionId: 'doThing', input: { x: 1 } } }),
      }),
    );
  });

  it('refuses function-bearing invoke contexts until capability channels exist', async () => {
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl: vi.fn() });

    await expect(
      client.invokeAction({
        extensionId: 'ext',
        actionId: 'doThing',
        input: {},
        serverContext: { getRuntimeScope: () => 'shared' },
      }),
    ).rejects.toThrow('function-bearing contexts');
  });

  it('publishes events over RPC', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, published: true }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.publishEvent('settings', { changed: true })).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'publishEvent', source: 'settings', payload: { changed: true } } }),
      }),
    );
  });
});
