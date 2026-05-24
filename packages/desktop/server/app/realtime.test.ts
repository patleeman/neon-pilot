import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

const subscribeAppEventsMock = vi.fn();

vi.mock('../shared/appEvents.js', () => ({
  subscribeAppEvents: subscribeAppEventsMock,
}));

class FakeWebSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(payload: string): void {
    this.sent.push(payload);
  }
}

describe('createDesktopRealtimeUpgradeHandler', () => {
  it('bridges app events over WebSocket and unsubscribes on close', async () => {
    const unsubscribe = vi.fn();
    let listener: ((event: { type: 'invalidate'; topics: string[] }) => void) | undefined;
    subscribeAppEventsMock.mockImplementation((nextListener) => {
      listener = nextListener;
      return unsubscribe;
    });

    const fakeSocket = new FakeWebSocket();
    const { createDesktopRealtimeUpgradeHandler } = await import('./realtime.js');
    const handler = createDesktopRealtimeUpgradeHandler();
    const server = (await import('ws')).WebSocketServer;
    const handleUpgrade = vi.spyOn(server.prototype, 'handleUpgrade').mockImplementation((_request, _socket, _head, cb) => {
      cb(fakeSocket as never);
    });

    handler({ url: '/api/realtime' } as never, { destroy: vi.fn() } as never, Buffer.alloc(0));

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fakeSocket.sent[0] ?? '{}')).toEqual({ type: 'connected' });
    listener?.({ type: 'invalidate', topics: ['sessions'] });
    expect(JSON.parse(fakeSocket.sent[1] ?? '{}')).toEqual({ type: 'app_event', event: { type: 'invalidate', topics: ['sessions'] } });

    fakeSocket.emit('close');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    handleUpgrade.mockRestore();
  });
});
