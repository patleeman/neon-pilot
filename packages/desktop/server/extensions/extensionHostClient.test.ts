import { describe, expect, it, vi } from 'vitest';

const extensionBackend = vi.hoisted(() => ({ invokeExtensionAction: vi.fn() }));

vi.mock('./extensionBackend.js', () => extensionBackend);

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

  it('converts request handler throws into protocol errors', async () => {
    extensionBackend.invokeExtensionAction.mockRejectedValueOnce(new Error('boom'));

    await expect(
      handleInProcessExtensionHostRequest({ type: 'invokeAction', extensionId: 'ext', actionId: 'explode', input: null }),
    ).resolves.toEqual({ ok: false, error: 'boom' });
  });

  it('names requests for logs and future RPC diagnostics', () => {
    expect(extensionHostRequestName({ type: 'health' })).toBe('health');
    expect(extensionHostRequestName({ type: 'invokeAction', extensionId: 'ext', actionId: 'doThing', input: null })).toBe(
      'invokeAction:ext/doThing',
    );
  });
});
