import { createServer, request, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getLocalhostWebappProxyStatus, startLocalhostWebappProxy, type LocalhostWebappProxy } from './localhostWebappProxy.js';

let proxy: LocalhostWebappProxy | null = null;
let occupiedServer: Server | null = null;

function httpRequest(input: {
  port: number;
  path: string;
  host?: string;
  method?: string;
  body?: string;
}): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: input.port,
        path: input.path,
        method: input.method ?? 'GET',
        headers: {
          ...(input.host ? { Host: input.host } : {}),
          ...(input.body ? { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(input.body) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (input.body) req.write(input.body);
    req.end();
  });
}

afterEach(async () => {
  await proxy?.close();
  proxy = null;
  await new Promise<void>((resolve) => {
    if (!occupiedServer) {
      resolve();
      return;
    }
    occupiedServer.close(() => resolve());
  });
  occupiedServer = null;
});

describe('localhost webapp proxy', () => {
  it('dispatches .localhost requests through the local API boundary', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-localhost-proxy-'));
    try {
      const seen: Array<{ path: string; host?: string; body?: unknown }> = [];
      proxy = await startLocalhostWebappProxy({
        stateRoot,
        httpPort: 0,
        httpsPort: null,
        dispatch: async (input) => {
          seen.push({ path: input.path, host: input.headers?.host, body: input.body });
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
            body: new TextEncoder().encode('<h1>Sidecar</h1>'),
          };
        },
      });

      const status = proxy.status();
      expect(status.running).toBe(true);
      expect(status.http.enabled).toBe(true);
      expect(getLocalhostWebappProxyStatus()?.http.enabled).toBe(true);

      const response = await httpRequest({
        port: status.http.port,
        path: '/board?view=mine',
        host: 'board-agent-board.localhost',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-neon-pilot-localhost-proxy']).toBe('1');
      expect(response.body).toContain('Sidecar');
      expect(seen).toEqual([{ path: '/board?view=mine', host: 'board-agent-board.localhost', body: undefined }]);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('rejects non-webapp localhost hosts before dispatch', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-localhost-proxy-'));
    try {
      let dispatched = false;
      proxy = await startLocalhostWebappProxy({
        stateRoot,
        httpPort: 0,
        httpsPort: null,
        dispatch: async () => {
          dispatched = true;
          return { statusCode: 200, headers: {}, body: new Uint8Array() };
        },
      });

      const status = proxy.status();
      const response = await httpRequest({ port: status.http.port, path: '/', host: 'localhost' });

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('No Neon Pilot webapp is registered');
      expect(dispatched).toBe(false);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('falls back to an available loopback port when the preferred HTTP port is busy', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-localhost-proxy-'));
    try {
      occupiedServer = createServer((_req, res) => res.end('occupied'));
      await new Promise<void>((resolve) => occupiedServer!.listen(0, '127.0.0.1', () => resolve()));
      const address = occupiedServer.address();
      if (!address || typeof address === 'string') throw new Error('Could not bind occupied server.');

      proxy = await startLocalhostWebappProxy({
        stateRoot,
        httpPort: address.port,
        httpsPort: null,
        dispatch: async () => ({
          statusCode: 204,
          headers: {},
          body: new Uint8Array(),
        }),
      });

      const status = proxy.status();
      expect(status.http.enabled).toBe(true);
      expect(status.http.port).not.toBe(address.port);
      expect(status.urls.defaultPort).toBe(false);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });
});
