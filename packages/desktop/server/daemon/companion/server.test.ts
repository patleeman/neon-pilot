import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DaemonCompanionServer } from './server.js';

class FakeWebSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = this.OPEN;
  readonly sent: string[] = [];

  send(payload: string) {
    this.sent.push(payload);
  }
}

describe('DaemonCompanionServer websocket subscriptions', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) rmSync(root, { recursive: true, force: true });
    }
  });

  it('tears down late subscription setup when the socket closes before subscribe resolves', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-companion-server-'));
    tempRoots.push(stateRoot);

    const unsubscribe = vi.fn();
    let resolveSubscribe: ((value: () => void) => void) | null = null;
    const subscribeConversation = vi.fn(
      () =>
        new Promise<() => void>((resolve) => {
          resolveSubscribe = resolve;
        }),
    );
    const runtimeProvider = vi.fn(async () => ({ subscribeConversation }));

    const server = new DaemonCompanionServer({ companion: { enabled: true } } as never, stateRoot, runtimeProvider as never);
    const socket = new FakeWebSocket();

    await (server as never).handleSocketConnection(socket as never, {
      id: 'device-1',
      deviceLabel: 'Phone',
      createdAt: '2026-06-12T00:00:00.000Z',
      lastUsedAt: '2026-06-12T00:00:00.000Z',
      expiresAt: '2026-07-12T00:00:00.000Z',
    });

    socket.emit(
      'message',
      JSON.stringify({
        id: 'sub-1',
        type: 'subscribe',
        topic: 'conversation',
        key: 'conv-1',
      }),
    );
    await vi.waitFor(() => expect(subscribeConversation).toHaveBeenCalledTimes(1));
    socket.emit('close');

    resolveSubscribe?.(unsubscribe);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(
      socket.sent
        .map((payload) => JSON.parse(payload) as { type?: string; id?: string; ok?: boolean })
        .find((message) => message.type === 'response' && message.id === 'sub-1' && message.ok === true),
    ).toBeUndefined();
  });
});
