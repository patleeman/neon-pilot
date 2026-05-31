import { describe, expect, it, vi } from 'vitest';

import {
  createExtensionHostRpcClient,
  createHybridExtensionHostClient,
  hasFunction,
  isWireableExtensionHostInvokeActionInput,
} from './extensionHostRpcClient.js';

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

  it('classifies wireable invoke action inputs', () => {
    expect(isWireableExtensionHostInvokeActionInput({ extensionId: 'ext', actionId: 'safe', input: { nested: ['ok'] } })).toBe(true);
    expect(
      isWireableExtensionHostInvokeActionInput({
        extensionId: 'ext',
        actionId: 'safe-with-snapshot',
        input: {},
        serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' },
      }),
    ).toBe(true);
    expect(
      isWireableExtensionHostInvokeActionInput({
        extensionId: 'ext',
        actionId: 'unsafe',
        input: {},
        toolContext: { onUpdate: () => undefined },
      }),
    ).toBe(false);
    expect(
      isWireableExtensionHostInvokeActionInput({
        extensionId: 'ext',
        actionId: 'safe-tool-snapshot',
        input: {},
        toolContextSnapshot: { cwd: '/repo', sessionId: 'session-1' },
      }),
    ).toBe(true);
    expect(hasFunction({ nested: [{ fn: () => undefined }] })).toBe(true);
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

  it('uses RPC for wire-safe calls and fallback for callback-bearing calls', async () => {
    const rpcClient = {
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'rpc' }),
      publishEvent: vi.fn().mockResolvedValue(undefined),
    };
    const fallbackClient = {
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'fallback' }),
      publishEvent: vi.fn().mockResolvedValue(undefined),
    };
    const client = createHybridExtensionHostClient({ rpcClient, fallbackClient });

    await expect(client.invokeAction({ extensionId: 'ext', actionId: 'safe', input: {} })).resolves.toEqual({ ok: true, result: 'rpc' });
    await expect(
      client.invokeAction({ extensionId: 'ext', actionId: 'unsafe', input: {}, toolContext: { onUpdate: () => undefined } }),
    ).resolves.toEqual({ ok: true, result: 'fallback' });

    expect(rpcClient.invokeAction).toHaveBeenCalledTimes(1);
    expect(fallbackClient.invokeAction).toHaveBeenCalledTimes(1);
  });
});
