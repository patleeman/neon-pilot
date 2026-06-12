import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { proxyDesktopLocalApiStream } from './local-backend-stream-proxy.js';

class FakeRequest extends EventEmitter {}

class FakeResponse extends EventEmitter {
  readonly writes: string[] = [];
  readonly headers: Record<string, string> = {};
  writableEnded = false;
  destroyed = false;

  writeHead(_statusCode: number, headers: Record<string, string>) {
    Object.assign(this.headers, headers);
    return this;
  }

  write(chunk: string) {
    this.writes.push(chunk);
    return true;
  }

  end(chunk?: string) {
    if (typeof chunk === 'string') {
      this.writes.push(chunk);
    }
    this.writableEnded = true;
    this.emit('close');
    return this;
  }
}

describe('proxyDesktopLocalApiStream', () => {
  it('tears down late local API stream subscriptions when the request closes before subscribe resolves', async () => {
    const request = new FakeRequest();
    const response = new FakeResponse();
    const unsubscribe = vi.fn();
    let resolveSubscribe: ((value: () => void) => void) | null = null;
    const subscribeDesktopLocalApiStream = vi.fn(
      () =>
        new Promise<() => void>((resolve) => {
          resolveSubscribe = resolve;
        }),
    );

    const pending = proxyDesktopLocalApiStream(
      request as never,
      response as never,
      '/api/live-sessions/live-1/events',
      subscribeDesktopLocalApiStream as never,
    );
    request.emit('close');

    resolveSubscribe?.(unsubscribe);
    await pending;

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.writes).toEqual([]);
  });
});
