import { describe, expect, it, vi } from 'vitest';

const extensionBackend = vi.hoisted(() => ({
  checkEnabledExtensionBackendHealth: vi.fn(),
  invokeExtensionAction: vi.fn(),
  invokeExtensionProtocolEntrypoint: vi.fn(),
  startExtensionStartupActions: vi.fn(),
}));
const extensionSubscriptions = vi.hoisted(() => ({ publishExtensionHostEvent: vi.fn() }));

vi.mock('./extensionBackend.js', () => extensionBackend);
vi.mock('./extensionSubscriptions.js', () => extensionSubscriptions);

import { getExtensionHostClient, handleInProcessExtensionHostRequest, setExtensionHostClient } from './extensionHostClient.js';
import { extensionHostRequestName } from './extensionHostProtocol.js';

describe('extension host client', () => {
  it('reports in-process host health', async () => {
    setExtensionHostClient(undefined);

    await expect(getExtensionHostClient().health()).resolves.toEqual({ status: 'ready' });
  });

  it('routes invokeAction through the extension host request envelope', async () => {
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
    extensionSubscriptions.publishExtensionHostEvent.mockResolvedValueOnce(undefined);

    await expect(getExtensionHostClient().publishEvent('settings', { type: 'changed' })).resolves.toBeUndefined();

    expect(extensionSubscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('settings', { type: 'changed' });
  });

  it('routes backend health checks through the extension host request envelope', async () => {
    extensionBackend.checkEnabledExtensionBackendHealth.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(getExtensionHostClient().checkBackendHealth()).resolves.toEqual([{ extensionId: 'ext', ok: true }]);

    expect(extensionBackend.checkEnabledExtensionBackendHealth).toHaveBeenCalledWith();
  });

  it('routes startup actions through the extension host request envelope', async () => {
    extensionBackend.startExtensionStartupActions.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(
      getExtensionHostClient().startStartupActions({ serverContext: { getRuntimeScope: () => 'shared' } }),
    ).resolves.toEqual([{ extensionId: 'ext', ok: true }]);

    expect(extensionBackend.startExtensionStartupActions).toHaveBeenCalledWith({ getRuntimeScope: expect.any(Function) });
  });

  it('routes protocol entrypoints through the extension host request envelope', async () => {
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
    expect(extensionHostRequestName({ type: 'publishEvent', source: 'settings', payload: null })).toBe('publishEvent:settings');
  });
});
