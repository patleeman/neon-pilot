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
const entry = arg('entry', '');
if (!app) {
  console.error('Usage: node scripts/perf-desktop-smoke.mjs --app=/path/to/Neon\ Pilot.app [--sessions=2500 --blocks=80]');
  process.exit(1);
}
const sessions = Number(arg('sessions', '2500')) || 2500;
const blocks = Number(arg('blocks', '80')) || 80;
const seconds = Number(arg('seconds', '30')) || 30;
const maxReadyMs = Number(arg('max-ready-ms', app ? '5000' : '15000')) || 5000;
const maxCpu = Number(arg('max-cpu', app ? '120' : '1000')) || 120;
const maxDraftSubmitVisibleMs = Number(arg('max-draft-submit-visible-ms', '8000')) || 8000;
const maxLongTranscriptOpenMs = Number(arg('max-long-transcript-open-ms', '2500')) || 2500;
const draftSubmitWaitMs = Math.max(0, Number(arg('draft-submit-wait-ms', '0')) || 0);
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
function childExited(child) {
  return child.exitCode !== null && child.exitCode !== undefined;
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
    msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result);
  });
  const opened = new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      ws.close();
    },
  };
}
async function evalJs(cdp, expression) {
  if (typeof expression !== 'string') throw new Error(`Runtime.evaluate expression must be string, got ${typeof expression}`);
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r?.result?.value;
}
async function waitForPage(port, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
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
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    const body = String((await evalJs(cdp, 'document.body?.innerText || ""')) || '').trim();
    if (body.length > 0 && !/startup error|could not load/i.test(body)) return body;
    await sleep(100);
  }
  throw new Error('timed out waiting for non-empty body');
}
async function waitAppHydrated(cdp, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    const hydrated = await evalJs(cdp, `!document.querySelector('#app-loader') && document.body?.innerText?.trim().length > 0`);
    if (hydrated) return;
    await sleep(100);
  }
  throw new Error('timed out waiting for app hydration');
}
async function waitAppUsable(cdp, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    const usable = await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        const composerReady = Boolean(document.querySelector('textarea:not([disabled])'));
        const registryReady = perf?.extensionRegistryLoading === false;
        const registryCounts = perf?.extensionRegistryCounts || {};
        const hasCriticalExtensionUi = (registryCounts.topBarElements ?? 0) > 0 || (registryCounts.composerButtons ?? 0) > 0 || (registryCounts.composerInputTools ?? 0) > 0 || (registryCounts.routes ?? 0) > 0;
        return !document.querySelector('#app-loader') && composerReady && registryReady && hasCriticalExtensionUi;
      })()`,
    );
    if (usable) return;
    await sleep(100);
  }
  throw new Error('timed out waiting for usable app');
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
  const result = await fn();
  return { durationMs: Math.round(performance.now() - t), result };
}
async function waitForExpression(cdp, child, expression, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    if (await evalJs(cdp, expression)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for expression: ${expression}`);
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
    [`--remote-debugging-port=${port}`, '--no-quit-confirmation', ...(entry ? [entry] : [])],
    {
      env,
      stdio: 'ignore',
    },
  );
  let cdp;
  try {
    const page = await waitForPage(port, child);
    const cdpReadyMs = Math.round(performance.now() - start);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await waitBody(cdp, child);
    const startupReadyMs = Math.round(performance.now() - start);
    const firstBodyMs = startupReadyMs - cdpReadyMs;
    await waitAppHydrated(cdp, child);
    const appHydratedMs = Math.round(performance.now() - start);
    await waitAppUsable(cdp, child);
    const appUsableMs = Math.round(performance.now() - start);
    const startupResources = await evalJs(
      cdp,
      `performance.getEntriesByType('resource')
        .filter((entry) => /\\.(js|css)(?:\\?|$)/.test(entry.name))
        .map((entry) => ({
          name: entry.name.split('/').pop(),
          startTime: Math.round(entry.startTime),
          durationMs: Math.round(entry.duration),
          transferKb: Math.round(((entry.transferSize || 0) / 1024) * 10) / 10,
          encodedKb: Math.round(((entry.encodedBodySize || 0) / 1024) * 10) / 10,
        }))
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 20)`,
    );
    const startupPerfStore = await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        if (!perf) return null;
        return {
          extensionRegistryLoadedAt: perf.extensionRegistryLoadedAt ?? null,
          extensionRegistryLoadedAtMs: perf.extensionRegistryLoadedAtMs ? Math.round(perf.extensionRegistryLoadedAtMs) : null,
          extensionRegistryCounts: perf.extensionRegistryCounts ?? null,
          clientSamples: perf.clientSamples ?? [],
          apiSamples: perf.apiSamples ?? [],
        };
      })()`,
    );
    const draftSubmitResult = await measure('draft submit visible', async () => {
      const prompt = `Perf draft submit ${Date.now()}`;
      await cdp.send('Page.navigate', { url: 'neon-pilot://app/conversations/new' });
      await waitAppHydrated(cdp, child);
      await waitForExpression(cdp, child, `Boolean(document.querySelector('textarea'))`);
      if (draftSubmitWaitMs > 0) await sleep(draftSubmitWaitMs);
      const clickStart = performance.now();
      await evalJs(
        cdp,
        `(async()=>{const prompt=${JSON.stringify(prompt)}; const textarea=document.querySelector('textarea'); textarea.focus(); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(textarea,prompt); textarea.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:prompt})); await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>setTimeout(r,50)); const button=document.querySelector('button[aria-label="Send"]'); if(!button) throw new Error('send button not found'); if(button.disabled) throw new Error('send button disabled'); button.click(); return true;})()`,
      );
      await waitForExpression(cdp, child, `location.pathname.startsWith('/conversations/') && !location.pathname.endsWith('/new')`, 45_000);
      const routeMs = Math.round(performance.now() - clickStart);
      await waitForExpression(
        cdp,
        child,
        `location.pathname.startsWith('/conversations/') && !location.pathname.endsWith('/new') && document.body.innerText.includes(${JSON.stringify(prompt)})`,
        90_000,
      );
      return { routeMs, promptVisibleAfterRouteMs: Math.round(performance.now() - clickStart) - routeMs };
    });
    const draftSubmitVisibleMs = draftSubmitResult.result.routeMs + draftSubmitResult.result.promptVisibleAfterRouteMs;
    const draftSubmitSetupMs = draftSubmitResult.durationMs - draftSubmitVisibleMs;
    const createLiveSessionClientMs = await evalJs(
      cdp,
      `globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.filter(s=>s.name==='desktop.createLiveSession').at(-1)?.durationMs ?? null`,
    );
    const createLiveSessionServerPerf = await evalJs(
      cdp,
      `globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.filter(s=>s.name==='desktop.createLiveSession').at(-1)?.meta?.serverPerf ?? null`,
    );
    const postDraftPerfStore = await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        if (!perf) return null;
        return {
          clientSamples: perf.clientSamples ?? [],
          apiSamples: perf.apiSamples ?? [],
          chatRenderSamples: perf.chatRenderSamples ?? [],
          longTaskSamples: perf.longTaskSamples ?? [],
        };
      })()`,
    );
    const draftSubmitNavigateCalledMs = (() => {
      const phase = postDraftPerfStore?.clientSamples
        ?.filter(
          (sample) => sample.name === 'conversation.submitComposer.phase' && sample.meta?.phase === 'afterNavigateCreatedConversation',
        )
        ?.at(-1);
      return typeof phase?.durationMs === 'number' ? Math.round(phase.durationMs) : null;
    })();
    const routeSettingsMs = (
      await measure('settings', async () => {
        await cdp.send('Page.navigate', { url: 'neon-pilot://app/settings' });
        await waitBody(cdp, child);
      })
    ).durationMs;
    const routeKnowledgeMs = (
      await measure('knowledge', async () => {
        await cdp.send('Page.navigate', { url: 'neon-pilot://app/knowledge' });
        await waitBody(cdp, child);
      })
    ).durationMs;
    const conversationSearchMs = (
      await measure('conversation search', async () => {
        await evalJs(
          cdp,
          `fetch('/api/sessions/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'suggested context release regression',limit:80})}).then(r=>r.json())`,
        );
      })
    ).durationMs;
    const modelFetchMs = (
      await measure('models', async () => {
        await evalJs(cdp, `fetch('/api/models').then(r=>r.json())`);
      })
    ).durationMs;
    const longTranscriptOpenMs = (
      await measure('long transcript', async () => {
        await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${longId}` });
        await waitForExpression(
          cdp,
          child,
          `location.pathname === ${JSON.stringify(`/conversations/${longId}`)} && document.body.innerText.includes('Long transcript message 4999')`,
          45_000,
        );
      })
    ).durationMs;
    await cdp.send('Page.navigate', { url: 'neon-pilot://app/conversations/new' });
    await waitAppHydrated(cdp, child);
    await waitForExpression(cdp, child, `Boolean(document.querySelector('textarea'))`);
    const interaction = await evalJs(
      cdp,
      `(async()=>{ const t=[]; function m(n,f){const s=performance.now(); f(); t.push([n, performance.now()-s]);} m('commandPalette',()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>requestAnimationFrame(r)); const el=document.querySelector('textarea'); if(el){m('composerFocus',()=>el.focus()); m('type100',()=>{ const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set; setter?.call(el,'x'.repeat(100)); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'x'.repeat(100)}));}); await new Promise(r=>requestAnimationFrame(r)); m('type500',()=>{ const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set; setter?.call(el,'y'.repeat(500)); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'y'.repeat(500)}));})} return t;})()`,
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
      cdpReadyMs,
      firstBodyMs,
      appHydratedMs,
      appUsableMs,
      startupResources,
      startupPerfStore,
      draftSubmitSetupMs,
      draftSubmitVisibleMs,
      draftSubmitRouteMs: draftSubmitResult.result.routeMs,
      draftSubmitNavigateCalledMs,
      draftPromptVisibleAfterRouteMs: draftSubmitResult.result.promptVisibleAfterRouteMs,
      createLiveSessionClientMs,
      createLiveSessionServerPerf,
      postDraftPerfStore,
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
      draftSubmitWaitMs,
    };
    console.log(JSON.stringify(report, null, 2));
    const failures = [];
    if (startupReadyMs > maxReadyMs) failures.push(`startupReadyMs ${startupReadyMs} > ${maxReadyMs}`);
    if (appUsableMs > maxReadyMs) failures.push(`appUsableMs ${appUsableMs} > ${maxReadyMs}`);
    if (cpuAvg > maxCpu || cpuPeak > maxCpu * 3)
      failures.push(`idleCpu peak=${cpuPeak.toFixed(1)} avg=${cpuAvg.toFixed(1)} avgLimit=${maxCpu} peakLimit=${maxCpu * 3}`);
    if (conversationSearchMs > 1000) failures.push(`conversationSearchMs ${conversationSearchMs} > 1000`);
    if (longTranscriptOpenMs > maxLongTranscriptOpenMs)
      failures.push(`longTranscriptOpenMs ${longTranscriptOpenMs} > ${maxLongTranscriptOpenMs}`);
    if (draftSubmitVisibleMs > maxDraftSubmitVisibleMs)
      failures.push(`draftSubmitVisibleMs ${draftSubmitVisibleMs} > ${maxDraftSubmitVisibleMs}`);
    if (failures.length)
      throw new Error(
        `Desktop perf smoke failed:\n${failures.join('\n')}\nTop offenders: ${JSON.stringify(cpuSamples.toSorted((a, b) => b.total - a.total)[0]?.offenders ?? [], null, 2)}`,
      );
  } finally {
    cdp?.close();
    if (!childExited(child)) {
      child.kill('SIGTERM');
      await sleep(1_000);
      if (!childExited(child)) child.kill('SIGKILL');
    }
    if (!keep) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exitCode = 1;
});
