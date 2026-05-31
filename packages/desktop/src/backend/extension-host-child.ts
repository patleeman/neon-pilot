import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleInProcessExtensionHostRequest } from '../../server/extensions/extensionHostClient.js';
import type { ExtensionHostRequest } from '../../server/extensions/extensionHostProtocol.js';

interface ExtensionHostReadyMessage {
  type: 'ready';
  port: number;
  token: string;
}

interface ExtensionHostRequestBody {
  request?: ExtensionHostRequest;
}

let shuttingDown = false;

function sendParentMessage(message: ExtensionHostReadyMessage | { type: 'fatal'; error: string }): void {
  if (typeof process.send === 'function') {
    process.send(message);
    return;
  }
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function assertAuthorized(request: IncomingMessage, token: string): void {
  const auth = request.headers.authorization ?? '';
  if (auth !== `Bearer ${token}`) {
    throw new Error('Unauthorized');
  }
}

function readRequestBody(request: IncomingMessage): Promise<ExtensionHostRequestBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as ExtensionHostRequestBody);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (response.headersSent) {
    if (!response.writableEnded) response.end();
    return;
  }
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function shutdown(server: ReturnType<typeof createServer>): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  process.exit(0);
}

async function main(): Promise<void> {
  const token = process.env.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim() || randomUUID();
  const server = createServer((request, response) => {
    void (async () => {
      try {
        assertAuthorized(request, token);
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');

        if (request.method === 'GET' && url.pathname === '/health') {
          const result = await handleInProcessExtensionHostRequest({ type: 'health' });
          writeJson(response, result.ok ? 200 : 500, result);
          return;
        }

        if (request.method === 'POST' && url.pathname === '/rpc') {
          const body = await readRequestBody(request);
          if (!body.request) {
            throw new Error('Missing extension host request.');
          }
          const result = await handleInProcessExtensionHostRequest(body.request);
          writeJson(response, result.ok ? 200 : 500, result);
          return;
        }

        writeJson(response, 404, { ok: false, error: 'Not found' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeJson(response, message === 'Unauthorized' ? 401 : 500, { ok: false, error: message });
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Extension host child did not bind a TCP port.');
  }

  sendParentMessage({ type: 'ready', port: address.port, token });

  process.on('message', (message) => {
    if (message && typeof message === 'object' && (message as { type?: unknown }).type === 'shutdown') {
      void shutdown(server);
    }
  });
  process.on('disconnect', () => {
    void shutdown(server);
  });
  process.on('SIGTERM', () => {
    void shutdown(server);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  sendParentMessage({ type: 'fatal', error: message });
  process.exit(1);
});
