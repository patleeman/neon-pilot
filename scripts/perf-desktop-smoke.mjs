#!/usr/bin/env node
/* eslint-env node */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const repo = resolve(new URL('..', import.meta.url).pathname);

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
const app = arg('app', '');
if (!app) {
  console.error('Usage: node scripts/perf-desktop-smoke.mjs --app=/path/to/Neon\ Pilot.app [--sessions=2500 --blocks=80]');
  process.exit(1);
}
const sessions = Number(arg('sessions', '2500')) || 2500;
const blocks = Number(arg('blocks', '80')) || 80;
const seconds = Number(arg('seconds', '30')) || 30;
const maxReadyMs = Number(arg('max-ready-ms', app ? '5000' : '15000')) || 5000;
const maxCpu = Number(arg('max-cpu', app ? '120' : '1000')) || 120;
const keep = process.argv.includes('--keep');
const root = mkdtempSync(join(tmpdir(), 'neon-pilot-perf-smoke-'));
const stateRoot = join(root, 'state');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => (stdout += c));
    child.stderr?.on('data', (c) => (stderr += c));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolveRun({ stdout, stderr }) : reject(new Error(`${command} failed ${code}\n${stdout}\n${stderr}`)),
    );
  });
}
async function allocatePort() {
  const server = createServer();
  await new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', res);
  });
  const address = server.address();
  await new Promise((res) => server.close(res));
  return address.port;
}
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
function connectCdp(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    if (!msg.id || !pending.has(msg.id)) return;
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  const opened = new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      ws.close();
    },
  };
}
async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r?.result?.value;
}
async function waitForPage(port, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`app exited ${child.exitCode}`);
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error('timed out waiting for CDP page');
}
async function waitBody(cdp, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`app exited ${child.exitCode}`);
    const body = String((await evalJs(cdp, 'document.body?.innerText || ""')) || '').trim();
    if (body.length > 0 && !/startup error|could not load/i.test(body)) return body;
    await sleep(100);
  }
  throw new Error('timed out waiting for non-empty body');
}
async function sampleCpu(rootPid) {
  const { stdout } = await run('ps', ['-axo', 'pid,ppid,%cpu,command']);
  const rows = stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+([0-9.]+)\s+(.+)$/))
    .filter(Boolean)
    .map((m) => ({ pid: +m[1], ppid: +m[2], cpu: +m[3], command: m[4] }));
  const desc = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows)
      if (!desc.has(row.pid) && desc.has(row.ppid)) {
        desc.add(row.pid);
        changed = true;
      }
  }
  const offenders = rows.filter((r) => desc.has(r.pid) && r.cpu > 5).map((r) => ({ ...r, command: r.command.slice(0, 140) }));
  return { total: rows.filter((r) => desc.has(r.pid)).reduce((s, r) => s + r.cpu, 0), offenders };
}
function writeLongTranscript() {
  const dir = join(stateRoot, 'sync', 'pi-agent', 'sessions', 'perf-long');
  mkdirSync(dir, { recursive: true });
  const id = 'perf-long-transcript';
  const lines = [
    { type: 'session', id, timestamp: new Date().toISOString(), cwd: '/tmp/perf-long' },
    { type: 'session_info', name: 'Perf long transcript' },
  ];
  for (let i = 0; i < 5000; i++)
    lines.push({
      type: 'message',
      timestamp: new Date(Date.now() + i).toISOString(),
      message: { role: i % 2 ? 'assistant' : 'user', content: `Long transcript message ${i} ${'x'.repeat(120)}` },
    });
  writeFileSync(join(dir, `${id}.jsonl`), `${lines.map(JSON.stringify).join('\n')}\n`);
  return id;
}
async function measure(name, fn) {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}
async function main() {
  await run(process.execPath, [
    join(repo, 'scripts/seed-startup-profile.mjs'),
    `--root=${stateRoot}`,
    `--sessions=${sessions}`,
    `--blocks=${blocks}`,
  ]);
  const longId = writeLongTranscript();
  const port = await allocatePort();
  const env = {
    ...process.env,
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_CONFIG_ROOT: join(stateRoot, 'config'),
    NEON_PILOT_DESKTOP_USER_DATA_DIR: join(root, 'user-data'),
    NEON_PILOT_DAEMON_SOCKET_PATH: join(root, 'daemon.sock'),
    NEON_PILOT_COMPANION_PORT: '0',
  };
  const start = performance.now();
  const child = spawn(
    join(app, 'Contents', 'MacOS', basename(app, '.app')),
    [`--remote-debugging-port=${port}`, '--no-quit-confirmation'],
    {
      env,
      stdio: 'ignore',
    },
  );
  let cdp;
  try {
    const page = await waitForPage(port, child);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await waitBody(cdp, child);
    const startupReadyMs = Math.round(performance.now() - start);
    const routeSettingsMs = await measure('settings', async () => {
      await cdp.send('Page.navigate', { url: 'neon-pilot://app/settings' });
      await waitBody(cdp, child);
    });
    const routeKnowledgeMs = await measure('knowledge', async () => {
      await cdp.send('Page.navigate', { url: 'neon-pilot://app/knowledge' });
      await waitBody(cdp, child);
    });
    const conversationSearchMs = await measure('conversation search', async () => {
      await evalJs(
        cdp,
        `fetch('/api/sessions/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'suggested context release regression',limit:80})}).then(r=>r.json())`,
      );
    });
    const modelFetchMs = await measure('models', async () => {
      await evalJs(cdp, `fetch('/api/models').then(r=>r.json())`);
    });
    const longTranscriptOpenMs = await measure('long transcript', async () => {
      await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${longId}` });
      await waitBody(cdp, child);
    });
    const interaction = await evalJs(
      cdp,
      `(async()=>{ const t=[]; function m(n,f){const s=performance.now(); f(); t.push([n, performance.now()-s]);} m('commandPalette',()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))); await new Promise(r=>requestAnimationFrame(r)); const el=document.querySelector('textarea,[contenteditable="true"],input'); if(el){m('composerFocus',()=>el.focus()); m('type100',()=>{ if('value' in el){el.value='x'.repeat(100); el.dispatchEvent(new Event('input',{bubbles:true}));} else {el.textContent='x'.repeat(100); el.dispatchEvent(new InputEvent('input',{bubbles:true}));}})} return t;})()`,
    );
    const memBefore = await evalJs(cdp, `performance.memory ? performance.memory.usedJSHeapSize : 0`);
    const cpuSamples = [];
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      cpuSamples.push(await sampleCpu(child.pid));
      await sleep(1000);
    }
    const memAfter = await evalJs(cdp, `performance.memory ? performance.memory.usedJSHeapSize : 0`);
    const cpuPeak = Math.max(...cpuSamples.map((s) => s.total));
    const cpuAvg = cpuSamples.reduce((s, v) => s + v.total, 0) / cpuSamples.length;
    const report = {
      startupReadyMs,
      routeSettingsMs,
      routeKnowledgeMs,
      conversationSearchMs,
      modelFetchMs,
      longTranscriptOpenMs,
      interactions: interaction,
      idleCpuPeak: Math.round(cpuPeak * 10) / 10,
      idleCpuAvg: Math.round(cpuAvg * 10) / 10,
      rendererHeapDeltaMb: Math.round(((memAfter - memBefore) / 1024 / 1024) * 10) / 10,
      sessions,
      blocks,
      seconds,
    };
    console.log(JSON.stringify(report, null, 2));
    const failures = [];
    if (startupReadyMs > maxReadyMs) failures.push(`startupReadyMs ${startupReadyMs} > ${maxReadyMs}`);
    if (cpuPeak > maxCpu) failures.push(`idleCpuPeak ${cpuPeak.toFixed(1)} > ${maxCpu}`);
    if (conversationSearchMs > 1000) failures.push(`conversationSearchMs ${conversationSearchMs} > 1000`);
    if (longTranscriptOpenMs > 2500) failures.push(`longTranscriptOpenMs ${longTranscriptOpenMs} > 2500`);
    if (failures.length)
      throw new Error(
        `Desktop perf smoke failed:\n${failures.join('\n')}\nTop offenders: ${JSON.stringify(cpuSamples.toSorted((a, b) => b.total - a.total)[0]?.offenders ?? [], null, 2)}`,
      );
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(1_000);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!keep) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exitCode = 1;
});
