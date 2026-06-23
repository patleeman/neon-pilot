import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import type { HostManager } from '../hosts/host-manager.js';
import { createDesktopCompanionRuntime } from './runtime.js';

let server: Server | undefined;

function listen(input: Server): Promise<number> {
  return new Promise((resolve) => {
    input.listen(0, '127.0.0.1', () => {
      const address = input.address();
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port.');
      }
      resolve(address.port);
    });
  });
}

afterEach(async () => {
  if (!server) {
    return;
  }
  const closing = server;
  server = undefined;
  await new Promise<void>((resolve) => closing.close(() => resolve()));
});

describe('createDesktopCompanionRuntime conversation subscriptions', () => {
  it('subscribes to conversation aggregate deltas over the desktop realtime WebSocket', async () => {
    server = createServer();
    const websocketServer = new WebSocketServer({ server });
    const port = await listen(server);
    const messages: unknown[] = [];
    let resolveTextDelta: (() => void) | undefined;
    const sawTextDelta = new Promise<void>((resolve) => {
      resolveTextDelta = resolve;
    });
    let resolveUnsubscribe: (() => void) | undefined;
    const sawUnsubscribe = new Promise<void>((resolve) => {
      resolveUnsubscribe = resolve;
    });

    websocketServer.on('connection', (socket) => {
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw));
        messages.push(message);
        if (message.type === 'conversation_subscribe') {
          socket.send(
            JSON.stringify({
              type: 'conversation_snapshot',
              subscriptionId: 'sub-1',
              state: {
                conversationId: 'conv-1',
                revision: 0,
                updatedAt: '2026-06-23T00:00:00.000Z',
                conversation: { conversationId: 'conv-1', sessionDetail: null, liveSession: { live: false }, stream: {} },
                activity: { conversationId: 'conv-1', items: [], primary: [], system: [], hidden: [] },
              },
            }),
          );
          socket.send(
            JSON.stringify({
              type: 'conversation_delta',
              subscriptionId: 'sub-1',
              delta: {
                type: 'stream_events',
                conversationId: 'conv-1',
                revision: 1,
                events: [{ type: 'text_delta', delta: 'hello' }],
              },
            }),
          );
        }
        if (message.type === 'unsubscribe') {
          resolveUnsubscribe?.();
        }
      });
    });

    const hostManager = {
      getHostController: vi.fn(() => ({
        getRealtimeUrl: vi.fn(async () => `ws://127.0.0.1:${String(port)}/api/realtime`),
      })),
    } as unknown as HostManager;
    const runtime = createDesktopCompanionRuntime(hostManager);
    const events: unknown[] = [];

    const unsubscribe = await runtime.subscribeConversation(
      { conversationId: 'conv-1', surfaceId: 'automation-task-1', surfaceType: 'desktop_ui', tailBlocks: 20 },
      (event) => {
        events.push(event);
        if (typeof event === 'object' && event !== null && 'type' in event && event.type === 'text_delta') {
          resolveTextDelta?.();
        }
      },
    );

    await sawTextDelta;
    expect(messages[0]).toMatchObject({
      type: 'conversation_subscribe',
      conversationId: 'conv-1',
      surfaceId: 'automation-task-1',
      surfaceType: 'desktop_web',
      tailBlocks: 20,
    });
    expect(events).toContainEqual({ type: 'open' });
    expect(events).toContainEqual(expect.objectContaining({ type: 'conversation_snapshot' }));
    expect(events).toContainEqual({ type: 'text_delta', delta: 'hello' });

    unsubscribe();
    await sawUnsubscribe;
    expect(messages.at(-1)).toMatchObject({ type: 'unsubscribe', subscriptionId: 'sub-1' });
    websocketServer.close();
  });
});
