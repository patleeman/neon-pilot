import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let server: ReturnType<typeof createServer> | null = null;
let baseUrl = '';

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function startFakeGateway() {
  server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/v1/') && request.headers.authorization !== 'Bearer secret-token') {
        writeJson(response, 401, { error: { message: 'Missing or invalid bearer token.' } });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/models') {
        writeJson(response, 200, { object: 'list', data: [{ id: 'neon-pilot-fake' }] });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/responses') {
        const body = await readJson(request);
        if (body.stream === true) {
          response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
          response.write('data: {"type":"response.created"}\n\n');
          response.write('data: {"type":"response.completed"}\n\n');
          response.end('data: [DONE]\n\n');
          return;
        }
        writeJson(response, 200, { object: 'response', status: 'completed' });
        return;
      }

      writeJson(response, 404, { error: { message: 'Route not found.' } });
    })().catch((error: unknown) => {
      writeJson(response, 500, { error: { message: error instanceof Error ? error.message : String(error) } });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fake gateway did not bind a TCP port.');
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
}

function runSmoke(env: Record<string, string | undefined>) {
  const child = spawn(process.execPath, [join(process.cwd(), 'scripts/model-gateway-smoke.mjs')], {
    cwd: process.cwd(),
    env: { ...process.env, MODEL_GATEWAY_BASE_URL: baseUrl, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('model gateway smoke script', () => {
  beforeEach(async () => {
    await startFakeGateway();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      server = null;
      baseUrl = '';
    });
  });

  it('uses the configured auth token for live gateway checks', async () => {
    const result = await runSmoke({ MODEL_GATEWAY_AUTH_TOKEN: 'secret-token' });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({ ok: true, baseUrl, model: 'neon-pilot-fake' }));
  });

  it('explains how to supply the gateway auth token when the default token is rejected', async () => {
    const result = await runSmoke({ MODEL_GATEWAY_AUTH_TOKEN: '' });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('AI Gateway rejected the default smoke token');
    expect(result.stderr).toContain('MODEL_GATEWAY_AUTH_TOKEN=<token>');
  });
});
