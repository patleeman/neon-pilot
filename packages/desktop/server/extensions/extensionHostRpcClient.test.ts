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

  it('runs backend lifecycle operations over RPC', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, results: [{ extensionId: 'ext', ok: true }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, results: [{ extensionId: 'startup-ext', ok: true }] }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.checkBackendHealth()).resolves.toEqual([{ extensionId: 'ext', ok: true }]);
    await expect(client.startStartupActions({ serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } })).resolves.toEqual([
      { extensionId: 'startup-ext', ok: true },
    ]);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'checkBackendHealth' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({
          request: { type: 'startStartupActions', serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } },
        }),
      }),
    );
  });

  it('runs extension management operations over RPC', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, telemetry: [{ extensionId: 'ext', actionId: 'run', ok: true }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, selfTest: { ok: true, extensionId: 'ext', checks: [] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, reload: { ok: true, extensionId: 'ext', rebuilt: false } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, route: { status: 200, body: { ok: true } } }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.listActionTelemetry('ext')).resolves.toEqual([{ extensionId: 'ext', actionId: 'run', ok: true }]);
    await expect(client.runSelfTest({ extensionId: 'ext' })).resolves.toEqual({ ok: true, extensionId: 'ext', checks: [] });
    await expect(client.reloadBackend({ extensionId: 'ext' })).resolves.toEqual({ ok: true, extensionId: 'ext', rebuilt: false });
    await expect(
      client.invokeRoute({
        extensionId: 'ext',
        method: 'GET',
        routePath: '/status',
        request: { method: 'GET', path: '/status', query: {}, params: {} },
      }),
    ).resolves.toEqual({ status: 200, body: { ok: true } });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listActionTelemetry', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'runSelfTest', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'reloadBackend', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({
          request: {
            type: 'invokeRoute',
            extensionId: 'ext',
            method: 'GET',
            routePath: '/status',
            request: { method: 'GET', path: '/status', query: {}, params: {} },
          },
        }),
      }),
    );
  });

  it('uses RPC for wire-safe calls and fallback for callback-bearing calls', async () => {
    const rpcClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'rpc' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'rpc' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const fallbackClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'fallback' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'fallback' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const client = createHybridExtensionHostClient({ rpcClient, fallbackClient });

    await expect(client.invokeAction({ extensionId: 'ext', actionId: 'safe', input: {} })).resolves.toEqual({ ok: true, result: 'rpc' });
    await expect(
      client.invokeAction({ extensionId: 'ext', actionId: 'unsafe', input: {}, toolContext: { onUpdate: () => undefined } }),
    ).resolves.toEqual({ ok: true, result: 'fallback' });

    expect(rpcClient.invokeAction).toHaveBeenCalledTimes(1);
    expect(fallbackClient.invokeAction).toHaveBeenCalledTimes(1);
  });

  it('keeps protocol entrypoints on fallback until stdio capability channels exist', async () => {
    const rpcClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'rpc' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'rpc' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const fallbackClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'fallback' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'fallback' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const client = createHybridExtensionHostClient({ rpcClient, fallbackClient });
    const signal = new AbortController().signal;
    const stdio = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };

    await expect(client.invokeProtocolEntrypoint({ protocolId: 'acp', input: {}, stdio, signal })).resolves.toBeUndefined();

    expect(rpcClient.invokeProtocolEntrypoint).not.toHaveBeenCalled();
    expect(fallbackClient.invokeProtocolEntrypoint).toHaveBeenCalledWith({ protocolId: 'acp', input: {}, stdio, signal });
  });

  it('keeps backend routes on fallback until route streaming channels exist', async () => {
    const rpcClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'rpc' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'rpc' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const fallbackClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'fallback' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'fallback' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const client = createHybridExtensionHostClient({ rpcClient, fallbackClient });

    await expect(
      client.invokeRoute({
        extensionId: 'ext',
        method: 'GET',
        routePath: '/status',
        request: { method: 'GET', path: '/status', query: {}, params: {} },
      }),
    ).resolves.toEqual({ status: 200, body: 'fallback' });

    expect(rpcClient.invokeRoute).not.toHaveBeenCalled();
    expect(fallbackClient.invokeRoute).toHaveBeenCalled();
  });

  it('keeps wire-safe lifecycle operations on RPC in the hybrid client', async () => {
    const rpcClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([{ extensionId: 'health-ext', ok: true }]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'rpc' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'rpc' }),
      listActionTelemetry: vi.fn().mockResolvedValue([{ extensionId: 'telemetry-ext', actionId: 'run', ok: true }]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'reload-ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'self-test-ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([{ extensionId: 'startup-ext', ok: true }]),
    };
    const fallbackClient = {
      checkBackendHealth: vi.fn().mockResolvedValue([]),
      health: vi.fn().mockResolvedValue({ status: 'ready' }),
      invokeAction: vi.fn().mockResolvedValue({ ok: true, result: 'fallback' }),
      invokeProtocolEntrypoint: vi.fn().mockResolvedValue(undefined),
      invokeRoute: vi.fn().mockResolvedValue({ status: 200, body: 'fallback' }),
      listActionTelemetry: vi.fn().mockResolvedValue([]),
      publishEvent: vi.fn().mockResolvedValue(undefined),
      reloadBackend: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', rebuilt: false }),
      runSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext', checks: [] }),
      startStartupActions: vi.fn().mockResolvedValue([]),
    };
    const client = createHybridExtensionHostClient({ rpcClient, fallbackClient });

    await expect(client.checkBackendHealth()).resolves.toEqual([{ extensionId: 'health-ext', ok: true }]);
    await expect(client.startStartupActions({ serverContextSnapshot: { runtimeScope: 'shared' } })).resolves.toEqual([
      { extensionId: 'startup-ext', ok: true },
    ]);
    await expect(client.listActionTelemetry('telemetry-ext')).resolves.toEqual([
      { extensionId: 'telemetry-ext', actionId: 'run', ok: true },
    ]);
    await expect(client.runSelfTest({ extensionId: 'self-test-ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'self-test-ext',
      checks: [],
    });
    await expect(client.reloadBackend({ extensionId: 'reload-ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'reload-ext',
      rebuilt: false,
    });

    expect(fallbackClient.checkBackendHealth).not.toHaveBeenCalled();
    expect(fallbackClient.startStartupActions).not.toHaveBeenCalled();
    expect(fallbackClient.listActionTelemetry).not.toHaveBeenCalled();
    expect(fallbackClient.runSelfTest).not.toHaveBeenCalled();
    expect(fallbackClient.reloadBackend).not.toHaveBeenCalled();
  });
});
