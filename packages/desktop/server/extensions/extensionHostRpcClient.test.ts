import { createServer } from 'node:net';
import { PassThrough, Writable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { decodeExtensionHostProtocolFrame, encodeExtensionHostProtocolFrame } from './extensionHostProtocolFrames.js';
import {
  createExtensionHostRpcClient,
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

  it('uses action abort signals for RPC fetch without serializing them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: { ok: true, result: { done: true } } }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });
    const signal = new AbortController().signal;

    await expect(client.invokeAction({ extensionId: 'ext', actionId: 'doThing', input: { x: 1 }, signal })).resolves.toEqual({
      ok: true,
      result: { done: true },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'invokeAction', extensionId: 'ext', actionId: 'doThing', input: { x: 1 } } }),
        signal,
      }),
    );
  });

  it('does not expose live server contexts on invoke action client inputs', () => {
    // @ts-expect-error Product callers must pass serverContextSnapshot through the client boundary.
    const input: Parameters<ReturnType<typeof createExtensionHostRpcClient>['invokeAction']>[0] = {
      extensionId: 'ext',
      actionId: 'doThing',
      input: {},
      serverContext: { getRuntimeScope: () => 'shared' },
    };

    expect(input).toEqual(expect.objectContaining({ extensionId: 'ext', actionId: 'doThing' }));
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
      .mockResolvedValueOnce(jsonResponse({ ok: true, results: [{ extensionId: 'startup-ext', ok: true }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, subscriptionsUpdated: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, subscriptionsUpdated: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, services: [{ extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z' }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, serviceResults: [{ extensionId: 'ext', serviceId: 'svc', ok: true }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, servicesStopped: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          promptAssemblyContributions: {
            contextProviders: [{ extensionId: 'ext', id: 'ctx', handler: 'context' }],
            assemblyProviders: [{ extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' }],
            hooks: [{ extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          staticContributions: {
            tools: [{ extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} }],
            skills: [{ extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' }],
            modelDiscovery: [{ extensionId: 'ext', action: 'discoverModels' }],
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, eventSubscriptions: [{ extensionId: 'ext', pattern: 'host:*' }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, state: { operation: 'list', documents: [{ key: 'tasks/one', value: 1, version: 1 }] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, registryMaintained: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          registryPresentation: {
            schema: { manifestVersion: 2 },
            installSummaries: [{ id: 'ext', name: 'Ext' }],
            commandRegistrations: [{ id: 'command' }],
            keybindingRegistrations: [{ id: 'keybinding' }],
            slashCommandRegistrations: [{ name: 'run' }],
            mentionRegistrations: [{ id: 'mention' }],
            quickOpenRegistrations: [{ id: 'quick' }],
            searchProviderRegistrations: [{ id: 'search' }],
            snapshot: { extensions: [{ id: 'ext' }], routes: [], surfaces: [], views: [] },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, modelProfile: { kind: 'resolved', profile: { extensionId: 'ext', id: 'gpt' } } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, filePath: '/extensions/ext/dist/frontend.js' }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          promptReferences: {
            contextBlocks: ['Knowledge context'],
            references: [{ kind: 'knowledgeFile', id: 'k1', path: '/knowledge/k1.md' }],
          },
        }),
      );
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.checkBackendHealth()).resolves.toEqual([{ extensionId: 'ext', ok: true }]);
    await expect(client.startStartupActions({ serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } })).resolves.toEqual([
      { extensionId: 'startup-ext', ok: true },
    ]);
    await expect(
      client.installSubscriptions({ extensionId: 'ext', serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } }),
    ).resolves.toBeUndefined();
    await expect(client.uninstallSubscriptions('ext')).resolves.toBeUndefined();
    await expect(client.listServices()).resolves.toEqual([{ extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z' }]);
    await expect(client.startServices({ serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } })).resolves.toEqual([
      { extensionId: 'ext', serviceId: 'svc', ok: true },
    ]);
    await expect(client.stopServices('ext')).resolves.toBeUndefined();
    await expect(client.listPromptAssemblyContributions()).resolves.toEqual({
      contextProviders: [{ extensionId: 'ext', id: 'ctx', handler: 'context' }],
      assemblyProviders: [{ extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' }],
      hooks: [{ extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' }],
    });
    await expect(client.listStaticContributions()).resolves.toEqual({
      tools: [{ extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} }],
      skills: [{ extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' }],
      modelDiscovery: [{ extensionId: 'ext', action: 'discoverModels' }],
    });
    await expect(client.listEventSubscriptions()).resolves.toEqual([{ extensionId: 'ext', pattern: 'host:*' }]);
    await expect(client.stateOperation({ operation: 'list', extensionId: 'ext', prefix: 'tasks/' })).resolves.toEqual({
      operation: 'list',
      documents: [{ key: 'tasks/one', value: 1, version: 1 }],
    });
    await expect(client.registryMaintenance({ operation: 'invalidateReadCaches' })).resolves.toBeUndefined();
    await expect(client.readRegistryPresentation()).resolves.toEqual({
      schema: { manifestVersion: 2 },
      installSummaries: [{ id: 'ext', name: 'Ext' }],
      commandRegistrations: [{ id: 'command' }],
      keybindingRegistrations: [{ id: 'keybinding' }],
      slashCommandRegistrations: [{ name: 'run' }],
      mentionRegistrations: [{ id: 'mention' }],
      quickOpenRegistrations: [{ id: 'quick' }],
      searchProviderRegistrations: [{ id: 'search' }],
      snapshot: { extensions: [{ id: 'ext' }], routes: [], surfaces: [], views: [] },
    });
    await expect(client.resolveModelProfile({ provider: 'openai', model: 'gpt-5' })).resolves.toEqual({
      kind: 'resolved',
      profile: { extensionId: 'ext', id: 'gpt' },
    });
    await expect(client.resolveFilePath({ extensionId: 'ext', relativePath: 'dist/frontend.js' })).resolves.toBe(
      '/extensions/ext/dist/frontend.js',
    );
    await expect(client.resolvePromptReferences({ text: '@note:k1' })).resolves.toEqual({
      contextBlocks: ['Knowledge context'],
      references: [{ kind: 'knowledgeFile', id: 'k1', path: '/knowledge/k1.md' }],
    });

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
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({
          request: { type: 'installSubscriptions', extensionId: 'ext', serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } },
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'uninstallSubscriptions', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listServices' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({
          request: { type: 'startServices', serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } },
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'stopServices', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      8,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listPromptAssemblyContributions' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      9,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listStaticContributions' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      10,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listEventSubscriptions' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      11,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'stateOperation', operation: 'list', extensionId: 'ext', prefix: 'tasks/' } }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      12,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'registryMaintenance', operation: 'invalidateReadCaches' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      13,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'readRegistryPresentation' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      14,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'resolveModelProfile', provider: 'openai', model: 'gpt-5' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      15,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'resolveFilePath', extensionId: 'ext', relativePath: 'dist/frontend.js' } }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      16,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'resolvePromptReferences', text: '@note:k1' } }) }),
    );
  });

  it('runs extension management operations over RPC', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, telemetry: [{ extensionId: 'ext', actionId: 'run', ok: true }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, auditEvents: [{ id: 1, requestType: 'health', requestName: 'health', ok: true, durationMs: 1, at: '2026-01-01T00:00:00.000Z' }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, selfTest: { ok: true, extensionId: 'ext', checks: [] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, reload: { ok: true, extensionId: 'ext', rebuilt: false } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, enabledResult: { ok: true, extension: { id: 'ext', enabled: true } } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, keybindingUpdated: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, startupGuard: { safeMode: true, disabledIds: ['ext'] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, startupGuardCompleted: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, route: { status: 200, body: { ok: true } } }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    await expect(client.listActionTelemetry('ext')).resolves.toEqual([{ extensionId: 'ext', actionId: 'run', ok: true }]);
    await expect(client.listAuditEvents()).resolves.toEqual([
      { id: 1, requestType: 'health', requestName: 'health', ok: true, durationMs: 1, at: '2026-01-01T00:00:00.000Z' },
    ]);
    await expect(client.runSelfTest({ extensionId: 'ext' })).resolves.toEqual({ ok: true, extensionId: 'ext', checks: [] });
    await expect(client.reloadBackend({ extensionId: 'ext' })).resolves.toEqual({ ok: true, extensionId: 'ext', rebuilt: false });
    await expect(client.setEnabled({ extensionId: 'ext', enabled: true, serverContextSnapshot: { runtimeScope: 'shared' } })).resolves.toEqual({
      ok: true,
      extension: { id: 'ext', enabled: true },
    });
    await expect(client.setKeybinding({ extensionId: 'ext', keybindingId: 'open', keys: ['Meta+O'] })).resolves.toBeUndefined();
    await expect(client.beginStartupGuard()).resolves.toEqual({ safeMode: true, disabledIds: ['ext'] });
    await expect(client.completeStartupGuard()).resolves.toBeUndefined();
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
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'listAuditEvents' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'runSelfTest', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'http://host/rpc',
      expect.objectContaining({ body: JSON.stringify({ request: { type: 'reloadBackend', extensionId: 'ext' } }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({
          request: { type: 'setEnabled', extensionId: 'ext', enabled: true, serverContextSnapshot: { runtimeScope: 'shared' } },
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'setKeybinding', extensionId: 'ext', keybindingId: 'open', keys: ['Meta+O'] } }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'beginStartupGuard' } }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      8,
      'http://host/rpc',
      expect.objectContaining({
        body: JSON.stringify({ request: { type: 'completeStartupGuard' } }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      9,
      'http://host/route',
      expect.objectContaining({
        body: JSON.stringify({
          request: {
            extensionId: 'ext',
            method: 'GET',
            routePath: '/status',
            request: { method: 'GET', path: '/status', query: {}, params: {} },
          },
        }),
      }),
    );
  });

  it('parses extension route SSE responses from the route transport', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('event: ready\ndata: {"ok":true}\n\nid: 2\ndata: next\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
      }),
    );
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });

    const route = await client.invokeRoute({
      extensionId: 'ext',
      method: 'GET',
      routePath: '/events',
      request: { method: 'GET', path: '/events', query: {}, params: {} },
    });

    expect(route.stream).toBe('sse');
    const events = [];
    for await (const event of route.events ?? []) events.push(event);
    expect(events).toEqual([
      { event: 'ready', data: '{"ok":true}' },
      { id: '2', data: 'next' },
    ]);
  });

  it('streams action updates over the action transport', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('event: update\ndata: {"content":[{"type":"text","text":"working"}]}\n\nevent: result\ndata: {"ok":true,"result":{"done":true}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
      }),
    );
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl });
    const onUpdate = vi.fn();

    await expect(
      client.invokeAction({
        extensionId: 'ext',
        actionId: 'run',
        input: { x: 1 },
        toolContext: { onUpdate },
        toolContextSnapshot: { cwd: '/repo' },
      }),
    ).resolves.toEqual({ ok: true, result: { done: true } });

    expect(onUpdate).toHaveBeenCalledWith({ content: [{ type: 'text', text: 'working' }] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://host/action',
      expect.objectContaining({
        body: JSON.stringify({
          request: {
            extensionId: 'ext',
            actionId: 'run',
            input: { x: 1 },
            toolContextSnapshot: { cwd: '/repo' },
          },
        }),
      }),
    );
  });

  it('bridges protocol stdio over the protocol channel', async () => {
    const token = 'channel-secret';
    const protocolServer = createServer((socket) => {
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        buffer += chunk;
        for (;;) {
          const newline = buffer.indexOf('\n');
          if (newline < 0) break;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          const frame = decodeExtensionHostProtocolFrame(line);
          if (frame.type === 'stdin' && Buffer.from(frame.data, 'base64').toString('utf8') === token) {
            socket.write(encodeExtensionHostProtocolFrame({ type: 'stdout', data: Buffer.from('hello out').toString('base64') }));
            socket.write(encodeExtensionHostProtocolFrame({ type: 'stderr', data: Buffer.from('hello err').toString('base64') }));
            socket.write(encodeExtensionHostProtocolFrame({ type: 'result' }));
            socket.end();
          }
        }
      });
    });
    await new Promise<void>((resolve) => protocolServer.listen(0, '127.0.0.1', () => resolve()));
    const address = protocolServer.address();
    if (!address || typeof address === 'string') throw new Error('test protocol server did not bind');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, channel: { port: address.port, token } }));
    const client = createExtensionHostRpcClient({ baseUrl: 'http://127.0.0.1:1234', token: 'secret', fetchImpl });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const stdin = new PassThrough();
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        stdoutChunks.push(Buffer.from(chunk as Buffer));
        callback();
      },
    });
    const stderr = new Writable({
      write(chunk, _encoding, callback) {
        stderrChunks.push(Buffer.from(chunk as Buffer));
        callback();
      },
    });

    try {
      await expect(
        client.invokeProtocolEntrypoint({
          protocolId: 'acp',
          input: { args: ['--stdio'] },
          serverContextSnapshot: { runtimeScope: 'shared' },
          stdio: { stdin, stdout, stderr },
          signal: new AbortController().signal,
        }),
      ).resolves.toBeUndefined();
    } finally {
      protocolServer.close();
    }

    expect(Buffer.concat(stdoutChunks).toString('utf8')).toBe('hello out');
    expect(Buffer.concat(stderrChunks).toString('utf8')).toBe('hello err');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/protocol/start',
      expect.objectContaining({
        body: JSON.stringify({
          request: {
            protocolId: 'acp',
            input: { args: ['--stdio'] },
            serverContextSnapshot: { runtimeScope: 'shared' },
          },
        }),
      }),
    );
  });

  it('rejects function-bearing backend routes before transport', async () => {
    const client = createExtensionHostRpcClient({ baseUrl: 'http://host', token: 'secret', fetchImpl: vi.fn() });

    await expect(
      client.invokeRoute({
        extensionId: 'ext',
        method: 'GET',
        routePath: '/unsafe',
        request: { method: 'GET', path: '/unsafe', query: {}, params: {}, body: { callback: () => undefined } },
      }),
    ).rejects.toThrow('pass serializable route data');
  });

  it('does not expose live server contexts on startup action client inputs', () => {
    // @ts-expect-error Product callers must pass serverContextSnapshot through the client boundary.
    const input: NonNullable<Parameters<ReturnType<typeof createExtensionHostRpcClient>['startStartupActions']>[0]> = {
      serverContext: { getRuntimeScope: () => 'shared' },
    };

    expect(input).toEqual(expect.objectContaining({ serverContext: expect.any(Object) }));
  });
});
