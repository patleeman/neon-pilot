#!/usr/bin/env node
import { createServer } from 'node:http';
import { Readable } from 'node:stream';

import { BENCHMARK_PROXY_ALLOWED_PATHS } from './benchmark-provider-proxy-contract.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const targetBaseUrl = new URL(config.targetBaseUrl);
const apiKey = String(config.apiKey ?? '');
const proxyToken = String(config.proxyToken ?? '');
const authHeader = String(config.authStrategy?.header ?? '').toLowerCase();
const authPrefix = String(config.authStrategy?.prefix ?? '');
if (!apiKey || !proxyToken || !['authorization', 'x-api-key'].includes(authHeader)) {
  throw new Error('Benchmark proxy credential configuration is invalid.');
}
let activeRequests = 0;
let requestCount = 0;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_CONCURRENCY = 2;
const MAX_REQUESTS = 1000;

const server = createServer(async (request, response) => {
  let counted = false;
  try {
    const incoming = new URL(request.url ?? '/', 'http://benchmark.invalid');
    const suppliedToken =
      authHeader === 'authorization'
        ? String(request.headers.authorization ?? '').replace(/^Bearer\s+/iu, '')
        : String(request.headers['x-api-key'] ?? '');
    if (suppliedToken !== proxyToken) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unauthorized benchmark proxy request.' }));
      return;
    }
    if (request.method !== 'POST' || incoming.search || !BENCHMARK_PROXY_ALLOWED_PATHS.has(incoming.pathname)) {
      response.writeHead(405, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Benchmark proxy permits only inference POST requests.' }));
      return;
    }
    if (activeRequests >= MAX_CONCURRENCY || requestCount >= MAX_REQUESTS) {
      response.writeHead(429, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Benchmark proxy request limit reached.' }));
      return;
    }
    activeRequests += 1;
    requestCount += 1;
    counted = true;
    const basePath = targetBaseUrl.pathname.replace(/\/$/u, '');
    const target = new URL(targetBaseUrl);
    target.pathname = `${basePath}${incoming.pathname.startsWith('/') ? incoming.pathname : `/${incoming.pathname}`}`;
    target.search = incoming.search;
    const chunks = [];
    let bodyBytes = 0;
    for await (const chunk of request) {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) throw new Error('Benchmark proxy request body exceeds 8 MiB.');
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (!value || !['accept', 'anthropic-version', 'content-type'].includes(name.toLowerCase())) continue;
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set(authHeader, `${authPrefix}${apiKey}`);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      redirect: 'error',
    });
    response.writeHead(
      upstream.status,
      Object.fromEntries(
        [...upstream.headers.entries()].filter(
          ([name]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase()),
        ),
      ),
    );
    if (upstream.body) {
      await new Promise((resolveDone, rejectDone) => {
        const stream = Readable.fromWeb(upstream.body);
        stream.once('error', rejectDone);
        response.once('finish', resolveDone);
        stream.pipe(response);
      });
    } else response.end();
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Benchmark provider proxy request failed.' }));
    } else response.destroy();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    if (counted) activeRequests = Math.max(0, activeRequests - 1);
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Benchmark proxy failed to bind TCP port.');
  process.stdout.write(`${JSON.stringify({ ok: true, baseUrl: `http://127.0.0.1:${address.port}` })}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
