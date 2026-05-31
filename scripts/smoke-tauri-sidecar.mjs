#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const stateRoot = mkdtempSync('/tmp/npts-');
const token = `smoke-${process.pid}`;
const child = spawn(process.execPath, ['packages/desktop/dist/backend/local-backend-child.js'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NEON_PILOT_BACKEND_TOKEN: token,
    NEON_PILOT_REPO_ROOT: repoRoot,
    NEON_PILOT_STATE_ROOT: stateRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
let finished = false;
let handledReady = false;

function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  child.kill('SIGTERM');
  rmSync(stateRoot, { recursive: true, force: true });
  if (message) {
    const stream = code === 0 ? process.stdout : process.stderr;
    stream.write(`${message}\n`);
  }
  process.exit(code);
}

const timeout = setTimeout(() => {
  finish(1, `Timed out waiting for backend child readiness.\n${stderr}`);
}, 30_000);

child.stderr.on('data', (chunk) => {
  stderr += String(chunk);
});

child.stdout.on('data', async (chunk) => {
  stdout += String(chunk);
  if (handledReady) return;
  const line = stdout.split(/\r?\n/).find((candidate) => candidate.trim().startsWith('{'));
  if (!line) return;
  handledReady = true;

  try {
    const ready = JSON.parse(line);
    if (ready.type === 'fatal') {
      throw new Error(ready.error || 'Backend child reported fatal startup failure.');
    }
    if (ready.type !== 'ready') {
      throw new Error(`Unexpected ready payload: ${line}`);
    }
    const response = await fetch(`http://127.0.0.1:${ready.port}/health`, {
      headers: { authorization: `Bearer ${ready.token}` },
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true || body.daemonHealthy !== true || body.apiReady !== true || ready.token !== token) {
      throw new Error(JSON.stringify({ ready, health: body }));
    }
    const statusResponse = await fetch(`http://127.0.0.1:${ready.port}/dispatch`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ready.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ request: { method: 'GET', path: '/api/status' } }),
    });
    const statusBody = await statusResponse.json();
    if (!statusResponse.ok || statusBody.profile !== 'shared') {
      throw new Error(JSON.stringify({ dispatchStatus: statusResponse.status, statusBody }));
    }
    finish(
      0,
      JSON.stringify({
        ready: { type: ready.type, port: ready.port, tokenMatches: true },
        health: body,
        dispatch: { status: statusResponse.status, profile: statusBody.profile },
      }),
    );
  } catch (error) {
    finish(1, error instanceof Error ? error.message : String(error));
  }
});

child.on('exit', (code, signal) => {
  if (!finished && code !== null && code !== 0) {
    finish(code, `Backend child exited before readiness (code=${code}, signal=${String(signal)}).\n${stderr}`);
  }
});
