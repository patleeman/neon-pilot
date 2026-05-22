#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const sessions = Math.max(1, Number(arg('sessions', '1000')) || 1000);
const blocks = Math.max(2, Number(arg('blocks', '80')) || 80);
const root = arg('root', join(tmpdir(), `neon-pilot-startup-profile-${Date.now()}`));
const clean = process.argv.includes('--clean');

if (clean) rmSync(root, { recursive: true, force: true });

const sessionsRoot = join(root, 'sync', 'pi-agent', 'sessions');
const runtimeRoot = join(root, 'neon-pilot-runtime');
mkdirSync(sessionsRoot, { recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
writeFileSync(join(runtimeRoot, 'auth.json'), JSON.stringify({}, null, 2));
writeFileSync(join(runtimeRoot, 'settings.json'), JSON.stringify({ conversationAutoTitle: { reasoning: false } }, null, 2));

const topics = ['release', 'suggested context', 'extensions', 'settings', 'local models', 'browser', 'tasks', 'knowledge'];
const workspaces = ['personal-agent', 'dd-source', 'notes', 'scratch', 'website'];

function iso(daysAgo, offsetMs = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000 + offsetMs).toISOString();
}

function jsonl(lines) {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

for (let i = 0; i < sessions; i += 1) {
  const topic = topics[i % topics.length];
  const workspace = workspaces[i % workspaces.length];
  const cwd = `/tmp/neon-fixture/${workspace}`;
  const day = 7 + (i % 700);
  const id = `startup-fixture-${String(i).padStart(5, '0')}`;
  const lines = [
    { type: 'session', id, timestamp: iso(day), cwd },
    { type: 'model_change', modelId: 'openrouter/test-startup-model' },
    { type: 'session_info', name: `Fixture ${topic} thread ${i}` },
  ];

  for (let j = 0; j < blocks; j += 1) {
    const role = j % 2 === 0 ? 'user' : 'assistant';
    lines.push({
      type: 'message',
      timestamp: iso(day, j * 1000),
      message: {
        role,
        content:
          role === 'user'
            ? `Please investigate ${topic} regression ${i}.${j}. Workspace ${workspace}. Need concise fix and validation.`
            : `Investigated ${topic} regression ${i}.${j}. Touched src/${topic.replaceAll(' ', '-')}/${i % 20}.ts and validated behavior.`,
      },
    });
  }

  const slug = workspace;
  const dir = join(sessionsRoot, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.jsonl`), jsonl(lines));
}

console.log(JSON.stringify({ root, sessions, blocks, sessionsRoot }, null, 2));
