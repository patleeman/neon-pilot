import { describe, expect, it, vi } from 'vitest';

const extensionBackend = vi.hoisted(() => ({
  checkEnabledExtensionBackendHealth: vi.fn(),
  invokeExtensionAction: vi.fn(),
  invokeExtensionRoute: vi.fn(),
  invokeExtensionProtocolEntrypoint: vi.fn(),
  listExtensionActionTelemetry: vi.fn(),
  reloadExtensionBackend: vi.fn(),
  runExtensionSelfTest: vi.fn(),
  startExtensionStartupActions: vi.fn(),
}));
const extensionSubscriptions = vi.hoisted(() => ({
  installSubscriptionsForExtension: vi.fn(),
  publishExtensionHostEvent: vi.fn(),
  uninstallExtensionSubscriptions: vi.fn(),
}));
const extensionServices = vi.hoisted(() => ({
  listRunningExtensionServices: vi.fn(),
  startExtensionServices: vi.fn(),
  stopExtensionServices: vi.fn(),
}));
const extensionRegistry = vi.hoisted(() => ({
  listExtensionAssemblyProviderRegistrations: vi.fn(),
  listExtensionPromptAssemblyHookRegistrations: vi.fn(),
  listExtensionPromptContextProviderRegistrations: vi.fn(),
  listExtensionSkillRegistrations: vi.fn(),
  listExtensionToolRegistrations: vi.fn(),
}));

vi.mock('./extensionBackend.js', () => extensionBackend);
vi.mock('./extensionSubscriptions.js', () => extensionSubscriptions);
vi.mock('./extensionServices.js', () => extensionServices);
vi.mock('./extensionRegistry.js', () => extensionRegistry);

import {
  createInProcessExtensionHostClient,
  getExtensionHostClient,
  handleInProcessExtensionHostRequest,
  setExtensionHostClient,
} from './extensionHostClient.js';
import { extensionHostRequestName } from './extensionHostProtocol.js';

describe('extension host client', () => {
  it('requires product callers to configure an extension host client', () => {
    setExtensionHostClient(undefined);

    expect(() => getExtensionHostClient()).toThrow('Extension host client is not configured');
  });

  it('reports in-process host health when explicitly configured', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());

    await expect(getExtensionHostClient().health()).resolves.toEqual({ status: 'ready' });
  });

  it('routes invokeAction through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      getExtensionHostClient().invokeAction({
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        serverContext: { getRuntimeScope: () => 'shared' },
        toolContext: { conversationId: 'conv' },
        agentToolContext: { callId: 'tool-call' },
      }),
    ).resolves.toEqual({ ok: true, result: { done: true } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      { getRuntimeScope: expect.any(Function) },
      { conversationId: 'conv' },
      { callId: 'tool-call' },
    );
  });

  it('reconstructs tool context snapshots for in-process request handling', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        toolContextSnapshot: {
          cwd: '/repo',
          conversationId: 'conversation-1',
          preferredVisionModel: 'openai/gpt-4o',
          sessionFile: '/repo/session.jsonl',
          sessionId: 'session-1',
        },
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      undefined,
      {
        cwd: '/repo',
        conversationId: 'conversation-1',
        preferredVisionModel: 'openai/gpt-4o',
        sessionFile: '/repo/session.jsonl',
        sessionId: 'session-1',
      },
      undefined,
    );
  });

  it('converts request handler throws into protocol errors', async () => {
    extensionBackend.invokeExtensionAction.mockRejectedValueOnce(new Error('boom'));

    await expect(
      handleInProcessExtensionHostRequest({ type: 'invokeAction', extensionId: 'ext', actionId: 'explode', input: null }),
    ).resolves.toEqual({ ok: false, error: 'boom' });
  });

  it('routes publishEvent through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionSubscriptions.publishExtensionHostEvent.mockResolvedValueOnce(undefined);

    await expect(getExtensionHostClient().publishEvent('settings', { type: 'changed' })).resolves.toBeUndefined();

    expect(extensionSubscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('settings', { type: 'changed' });
  });

  it('routes subscription lifecycle through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionSubscriptions.installSubscriptionsForExtension.mockResolvedValueOnce(undefined);

    await expect(
      getExtensionHostClient().installSubscriptions({
        extensionId: 'ext',
        serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' },
      }),
    ).resolves.toBeUndefined();
    await expect(getExtensionHostClient().uninstallSubscriptions('ext')).resolves.toBeUndefined();

    expect(extensionSubscriptions.installSubscriptionsForExtension).toHaveBeenCalledWith(
      'ext',
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(extensionSubscriptions.uninstallExtensionSubscriptions).toHaveBeenCalledWith('ext');
  });

  it('routes service lifecycle through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionServices.listRunningExtensionServices.mockReturnValueOnce([
      { extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z', stop: () => undefined },
    ]);
    extensionServices.startExtensionServices.mockResolvedValueOnce([{ extensionId: 'ext', serviceId: 'svc', ok: true }]);
    extensionServices.stopExtensionServices.mockResolvedValueOnce(undefined);

    await expect(getExtensionHostClient().listServices()).resolves.toEqual([
      { extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z', lastError: undefined },
    ]);
    await expect(
      getExtensionHostClient().startServices({ serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } }),
    ).resolves.toEqual([{ extensionId: 'ext', serviceId: 'svc', ok: true }]);
    await expect(getExtensionHostClient().stopServices('ext')).resolves.toBeUndefined();

    expect(extensionServices.startExtensionServices).toHaveBeenCalledWith(expect.objectContaining({ getRuntimeScope: expect.any(Function) }));
    expect(extensionServices.stopExtensionServices).toHaveBeenCalledWith('ext');
  });

  it('routes prompt assembly contribution reads through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionPromptContextProviderRegistrations.mockReturnValueOnce([{ extensionId: 'ext', id: 'ctx', handler: 'context' }]);
    extensionRegistry.listExtensionAssemblyProviderRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' },
    ]);
    extensionRegistry.listExtensionPromptAssemblyHookRegistrations.mockReturnValueOnce([{ extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' }]);

    await expect(getExtensionHostClient().listPromptAssemblyContributions()).resolves.toEqual({
      contextProviders: [{ extensionId: 'ext', id: 'ctx', handler: 'context' }],
      assemblyProviders: [{ extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' }],
      hooks: [{ extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' }],
    });
  });

  it('routes static contribution reads through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionToolRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} },
    ]);
    extensionRegistry.listExtensionSkillRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' },
    ]);

    await expect(getExtensionHostClient().listStaticContributions()).resolves.toEqual({
      tools: [{ extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} }],
      skills: [{ extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' }],
    });
  });

  it('routes backend health checks through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.checkEnabledExtensionBackendHealth.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(getExtensionHostClient().checkBackendHealth()).resolves.toEqual([{ extensionId: 'ext', ok: true }]);

    expect(extensionBackend.checkEnabledExtensionBackendHealth).toHaveBeenCalledWith();
  });

  it('routes extension backend routes through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionRoute.mockResolvedValueOnce({ status: 201, body: { ok: true } });

    await expect(
      getExtensionHostClient().invokeRoute({
        extensionId: 'ext',
        method: 'POST',
        routePath: '/do-thing',
        request: { method: 'POST', path: '/do-thing', query: {}, params: {}, body: { x: 1 } },
        serverContext: { getRuntimeScope: () => 'shared' },
      }),
    ).resolves.toEqual({ status: 201, body: { ok: true } });

    expect(extensionBackend.invokeExtensionRoute).toHaveBeenCalledWith(
      'ext',
      'POST',
      '/do-thing',
      { method: 'POST', path: '/do-thing', query: {}, params: {}, body: { x: 1 } },
      { getRuntimeScope: expect.any(Function) },
    );
  });

  it('routes telemetry, self-test, and reload operations through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.listExtensionActionTelemetry.mockReturnValueOnce([{ extensionId: 'ext', actionId: 'run', ok: true }]);
    extensionBackend.runExtensionSelfTest.mockResolvedValueOnce({
      ok: true,
      extensionId: 'ext',
      checks: [{ name: 'backend import', ok: true }],
    });
    extensionBackend.reloadExtensionBackend.mockResolvedValueOnce({ ok: true, extensionId: 'ext', rebuilt: false });

    await expect(getExtensionHostClient().listActionTelemetry('ext')).resolves.toEqual([
      { extensionId: 'ext', actionId: 'run', ok: true },
    ]);
    await expect(getExtensionHostClient().runSelfTest({ extensionId: 'ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'ext',
      checks: [{ name: 'backend import', ok: true }],
    });
    await expect(getExtensionHostClient().reloadBackend({ extensionId: 'ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'ext',
      rebuilt: false,
    });

    expect(extensionBackend.listExtensionActionTelemetry).toHaveBeenCalledWith('ext');
    expect(extensionBackend.runExtensionSelfTest).toHaveBeenCalledWith('ext');
    expect(extensionBackend.reloadExtensionBackend).toHaveBeenCalledWith('ext');
  });

  it('routes startup actions through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.startExtensionStartupActions.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(
      getExtensionHostClient().startStartupActions({ serverContext: { getRuntimeScope: () => 'shared' } }),
    ).resolves.toEqual([{ extensionId: 'ext', ok: true }]);

    expect(extensionBackend.startExtensionStartupActions).toHaveBeenCalledWith({ getRuntimeScope: expect.any(Function) });
  });

  it('routes protocol entrypoints through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionProtocolEntrypoint.mockResolvedValueOnce(undefined);
    const signal = new AbortController().signal;
    const stdio = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };

    await expect(
      getExtensionHostClient().invokeProtocolEntrypoint({
        protocolId: 'acp',
        input: { args: ['--stdio'] },
        serverContext: { getRuntimeScope: () => 'shared' },
        stdio,
        signal,
      }),
    ).resolves.toBeUndefined();

    expect(extensionBackend.invokeExtensionProtocolEntrypoint).toHaveBeenCalledWith('acp', { args: ['--stdio'] }, {
      serverContext: { getRuntimeScope: expect.any(Function) },
      stdio,
      signal,
    });
  });

  it('names requests for logs and future RPC diagnostics', () => {
    expect(extensionHostRequestName({ type: 'health' })).toBe('health');
    expect(extensionHostRequestName({ type: 'invokeAction', extensionId: 'ext', actionId: 'doThing', input: null })).toBe(
      'invokeAction:ext/doThing',
    );
    expect(
      extensionHostRequestName({
        type: 'invokeProtocolEntrypoint',
        protocolId: 'acp',
        input: null,
        stdio: { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
        signal: new AbortController().signal,
      }),
    ).toBe('invokeProtocolEntrypoint:acp');
    expect(extensionHostRequestName({ type: 'checkBackendHealth' })).toBe('checkBackendHealth');
    expect(extensionHostRequestName({ type: 'startStartupActions' })).toBe('startStartupActions');
    expect(
      extensionHostRequestName({
        type: 'invokeRoute',
        extensionId: 'ext',
        method: 'GET',
        routePath: '/status',
        request: { method: 'GET', path: '/status', query: {}, params: {} },
      }),
    ).toBe('invokeRoute:ext:GET:/status');
    expect(extensionHostRequestName({ type: 'listActionTelemetry', extensionId: 'ext' })).toBe('listActionTelemetry');
    expect(extensionHostRequestName({ type: 'runSelfTest', extensionId: 'ext' })).toBe('runSelfTest:ext');
    expect(extensionHostRequestName({ type: 'reloadBackend', extensionId: 'ext' })).toBe('reloadBackend:ext');
    expect(extensionHostRequestName({ type: 'publishEvent', source: 'settings', payload: null })).toBe('publishEvent:settings');
    expect(extensionHostRequestName({ type: 'installSubscriptions', extensionId: 'ext' })).toBe('installSubscriptions:ext');
    expect(extensionHostRequestName({ type: 'uninstallSubscriptions', extensionId: 'ext' })).toBe('uninstallSubscriptions:ext');
    expect(extensionHostRequestName({ type: 'listServices' })).toBe('listServices');
    expect(extensionHostRequestName({ type: 'startServices' })).toBe('startServices');
    expect(extensionHostRequestName({ type: 'stopServices', extensionId: 'ext' })).toBe('stopServices:ext');
    expect(extensionHostRequestName({ type: 'listPromptAssemblyContributions' })).toBe('listPromptAssemblyContributions');
    expect(extensionHostRequestName({ type: 'listStaticContributions' })).toBe('listStaticContributions');
  });
});
