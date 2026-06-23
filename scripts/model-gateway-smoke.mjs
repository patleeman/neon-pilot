#!/usr/bin/env node

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key?.startsWith('--')) {
    args.set(key.slice(2), value && !value.startsWith('--') ? value : 'true');
    if (value && !value.startsWith('--')) index += 1;
  }
}

const baseUrl = String(args.get('base-url') ?? process.env.MODEL_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8766/v1').replace(/\/$/, '');
const model = String(args.get('model') ?? process.env.MODEL_GATEWAY_MODEL ?? 'neon-pilot-fake');
const prompt = String(args.get('prompt') ?? 'consumer smoke');
const hasExplicitAuthToken = args.has('auth-token') || Boolean(process.env.MODEL_GATEWAY_AUTH_TOKEN);
const authToken = String(args.get('auth-token') ?? process.env.MODEL_GATEWAY_AUTH_TOKEN ?? 'smoke');

function authFailureMessage(path, status, text) {
  const tokenSource = hasExplicitAuthToken ? 'provided' : 'default smoke';
  const setupHint =
    'Open Settings -> Extensions -> AI Gateway, copy the Auth token from the Codex client setup, then rerun with ' +
    'MODEL_GATEWAY_AUTH_TOKEN=<token> pnpm run smoke:model-gateway or pass --auth-token <token>.';
  return `${path} failed with ${status}: AI Gateway rejected the ${tokenSource} token. ${setupHint} Response: ${text}`;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return response;
}

async function json(path, init) {
  const response = await request(path, init);
  const text = await response.text();
  if (response.status === 401) {
    throw new Error(authFailureMessage(path, response.status, text));
  }
  assert.equal(response.ok, true, `${path} failed with ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function readSse(response) {
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) throw new Error(authFailureMessage('/responses', response.status, text));
    throw new Error(`stream failed with ${response.status}: ${text}`);
  }
  assert.ok(response.body, 'stream response did not include a body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice('data:'.length).trimStart();
        events.push(data === '[DONE]' ? data : JSON.parse(data));
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
  return events;
}

async function main() {
  const models = await json('/models');
  assert.equal(models.object, 'list');
  assert.ok(
    models.data.some((entry) => entry.id === model),
    `model ${model} was not returned by /models`,
  );

  const response = await json('/responses', {
    method: 'POST',
    body: JSON.stringify({ model, input: prompt }),
  });
  assert.equal(response.object, 'response');
  assert.equal(response.status, 'completed');

  const streamResponse = await request('/responses', {
    method: 'POST',
    body: JSON.stringify({ model, input: prompt, stream: true }),
  });
  const events = await readSse(streamResponse);
  assert.ok(
    events.some((event) => event?.type === 'response.created'),
    'stream did not emit response.created',
  );
  assert.ok(
    events.some((event) => event?.type === 'response.completed'),
    'stream did not emit response.completed',
  );
  assert.equal(events.at(-1), '[DONE]', 'stream did not terminate with [DONE]');

  console.log(JSON.stringify({ ok: true, baseUrl, model, events: events.length }, null, 2));
}

try {
  await Promise.race([
    main(),
    delay(15000, undefined, { ref: false }).then(() => {
      throw new Error(`Timed out waiting for ${baseUrl}`);
    }),
  ]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
