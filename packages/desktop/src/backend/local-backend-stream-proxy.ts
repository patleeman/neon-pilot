import type { IncomingMessage, ServerResponse } from 'node:http';

import type { LocalApiModule } from '../local-api-module.js';

export async function proxyDesktopLocalApiStream(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  subscribeDesktopLocalApiStream: LocalApiModule['subscribeDesktopLocalApiStream'],
): Promise<void> {
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (closed) {
      return;
    }

    closed = true;
    if (unsubscribe) {
      const teardown = unsubscribe;
      unsubscribe = null;
      teardown();
    }
  };

  request.on('close', cleanup);
  response.on('close', cleanup);

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const teardown = await subscribeDesktopLocalApiStream(path, (event) => {
    if (closed || response.writableEnded || response.destroyed) {
      return;
    }

    response.write(`event: ${event.type}\n`);
    if ('data' in event && typeof event.data === 'string') {
      response.write(`data: ${event.data}\n`);
    } else if ('message' in event && typeof event.message === 'string') {
      response.write(`data: ${JSON.stringify({ message: event.message })}\n`);
    }
    response.write('\n');
  });

  if (closed || response.writableEnded || response.destroyed) {
    teardown();
    return;
  }

  unsubscribe = teardown;
}
