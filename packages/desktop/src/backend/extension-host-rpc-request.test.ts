import { describe, expect, it } from 'vitest';

import { withRpcAbortSignal } from './extension-host-rpc-request.js';

describe('withRpcAbortSignal', () => {
  it('attaches request abort signals to action RPC requests and agent tool context', () => {
    const signal = new AbortController().signal;
    const request = withRpcAbortSignal(
      {
        type: 'invokeAction',
        extensionId: 'system-runs',
        actionId: 'bash',
        input: { command: 'sleep 120' },
        agentToolContext: { conversationId: 'conv-1' },
      },
      signal,
    );

    expect(request).toMatchObject({
      type: 'invokeAction',
      extensionId: 'system-runs',
      actionId: 'bash',
      input: { command: 'sleep 120' },
      signal,
      agentToolContext: { conversationId: 'conv-1', signal },
    });
  });

  it('attaches request abort signals to protocol RPC requests only', () => {
    const signal = new AbortController().signal;
    expect(
      withRpcAbortSignal(
        {
          type: 'invokeProtocolEntrypoint',
          protocolId: 'test-protocol',
          input: {},
        },
        signal,
      ),
    ).toMatchObject({ type: 'invokeProtocolEntrypoint', signal });

    const healthRequest = { type: 'health' as const };
    expect(withRpcAbortSignal(healthRequest, signal)).toBe(healthRequest);
  });
});
