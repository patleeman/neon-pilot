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

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: 'Bearer smoke',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return response;
}

async function json(path, init) {
  const response = await request(path, init);
  const text = await response.text();
  assert.equal(response.ok, true, `${path} failed with ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function readSse(response) {
  if (!response.ok) {
    throw new Error(`stream failed with ${response.status}: ${await response.text()}`);
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
  assert.ok(models.data.some((entry) => entry.id === model), `model ${model} was not returned by /models`);

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
  assert.ok(events.some((event) => event?.type === 'response.created'), 'stream did not emit response.created');
  assert.ok(events.some((event) => event?.type === 'response.completed'), 'stream did not emit response.completed');
  assert.equal(events.at(-1), '[DONE]', 'stream did not terminate with [DONE]');

  console.log(JSON.stringify({ ok: true, baseUrl, model, events: events.length }, null, 2));
}

await Promise.race([
  main(),
  delay(15000).then(() => {
    throw new Error(`Timed out waiting for ${baseUrl}`);
  }),
]);
