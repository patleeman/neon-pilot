#!/usr/bin/env node
/* eslint-env node */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { cpus, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import {
  readNumericSourceExport,
  readRecentOperationDurationMs,
  samplesAfterCount,
  summarizeCpuOffenders,
} from './perf-desktop-smoke-utils.mjs';

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
const output = arg('output', '');
const desktopMainFile = join(repo, 'packages', 'desktop', 'dist', 'main.js');
const desktopUiIndexFile = join(repo, 'packages', 'desktop', 'ui', 'dist', 'index.html');
const desktopServerBundleFile = join(repo, 'packages', 'desktop', 'server', 'dist', 'app', 'localApi.js');
const systemTodoFrontendBundleFile = join(repo, 'extensions', 'system-todo', 'dist', 'frontend.js');
const systemTodoBackendBundleFile = join(repo, 'extensions', 'system-todo', 'dist', 'backend.mjs');
const longTranscriptBlockCount = 5000;
const systemTodoSourceFiles = [
  join(repo, 'extensions', 'system-todo', 'extension.json'),
  join(repo, 'extensions', 'system-todo', 'src', 'backend.ts'),
  join(repo, 'extensions', 'system-todo', 'src', 'frontend.tsx'),
];
const desktopConversationTranscriptPagingFile = join(
  repo,
  'packages',
  'desktop',
  'ui',
  'src',
  'conversation',
  'conversationTranscriptPaging.ts',
);
const desktopUiSourceFiles = [
  join(repo, 'packages', 'desktop', 'ui', 'src', 'app', 'App.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'client', 'api.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'client', 'perfDiagnostics.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'components', 'Layout.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'components', 'chat', 'ChatView.tsx'),
  desktopConversationTranscriptPagingFile,
  join(repo, 'packages', 'desktop', 'ui', 'src', 'conversation', 'newConversationNavigation.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'conversation', 'pendingConversationShell.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'extensions', 'ExtensionRouteHost.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'extensions', 'ComposerShelfHost.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'extensions', 'NativeExtensionSurfaceHost.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'extensions', 'useExtensionRegistry.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'hooks', 'sessionDetailCacheReuse.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'hooks', 'useConversationBootstrap.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'hooks', 'useDesktopConversationState.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'hooks', 'useSessions.ts'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'pages', 'ConversationPage.tsx'),
  join(repo, 'packages', 'desktop', 'ui', 'src', 'transcript', 'messageBlocks.ts'),
];
const desktopServerSourceFiles = [
  join(repo, 'packages', 'desktop', 'server', 'app', 'localApi.ts'),
  join(repo, 'packages', 'desktop', 'server', 'app', 'localApiCreateLiveSessionResponse.ts'),
  join(repo, 'packages', 'desktop', 'server', 'app', 'localApiExtensionRegistryPresentation.ts'),
  join(repo, 'packages', 'desktop', 'server', 'app', 'runtimeState.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'conversationBootstrap.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'conversationService.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'desktopConversationState.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionBranching.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionBroadcasts.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionCapability.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionReadApi.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionStateBroadcasts.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionStateSnapshot.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessionSubscription.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'liveSessions.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'sessions.ts'),
  join(repo, 'packages', 'desktop', 'server', 'conversations', 'transcriptRenderItems.ts'),
];
if (!app) {
  console.error('Usage: node scripts/perf-desktop-smoke.mjs --app="/path/to/Neon Pilot.app" [--sessions=2500 --blocks=80 --skip-fork]');
  process.exit(1);
}
const sessions = Number(arg('sessions', '2500')) || 2500;
const blocks = Number(arg('blocks', '80')) || 80;
const seconds = Number(arg('seconds', '30')) || 30;
const maxReadyMs = Number(arg('max-ready-ms', app ? '5000' : '15000')) || 5000;
const maxExtensionRegistryReadyMs = Number(arg('max-extension-registry-ready-ms', '5000')) || 5000;
const maxCpu = Number(arg('max-cpu', app ? '30' : '1000')) || 30;
const maxDraftSubmitVisibleMs = Number(arg('max-draft-submit-visible-ms', '8000')) || 8000;
const maxDraftFirstPromptVisibleMs = Number(arg('max-draft-first-prompt-visible-ms', '2500')) || 2500;
const maxDraftPendingPromptVisibleMs = Number(arg('max-draft-pending-prompt-visible-ms', '1000')) || 1000;
const maxDraftCreatedAttachArg = arg('max-draft-created-attach-ms');
const maxDraftCreatedAttachMs = maxDraftCreatedAttachArg === undefined ? null : Number(maxDraftCreatedAttachArg);
const maxDraftInitialPromptDispatchMs = Number(arg('max-draft-initial-prompt-dispatch-ms', '1000')) || 1000;
const maxCreateLiveSessionIpcQueueMs = Number(arg('max-create-live-session-ipc-queue-ms', '25')) || 25;
const maxRecentInitialPromptRpcMs = Number(arg('max-recent-initial-prompt-rpc-ms', '25')) || 25;
const maxLongTranscriptOpenMs = Number(arg('max-long-transcript-open-ms', '2500')) || 2500;
const maxLongTranscriptLoadPreviousMs = Number(arg('max-long-transcript-load-previous-ms', '750')) || 750;
const maxLongTranscriptExpandedRenderMs = Number(arg('max-long-transcript-expanded-render-ms', '500')) || 500;
const maxLongTranscriptMountedMessages = Number(arg('max-long-transcript-mounted-messages', '48')) || 48;
const maxConversationSwitchMs = Number(arg('max-conversation-switch-ms', '500')) || 500;
const maxConversationSwitchContentMs = Number(arg('max-conversation-switch-content-ms', '120')) || 120;
const maxConversationSwitchRenderMs = Number(arg('max-conversation-switch-render-ms', '80')) || 80;
const maxConversationContentOpenPhaseMs = Number(arg('max-conversation-content-open-phase-ms', '750')) || 750;
const maxConversationExtensionOpenPhaseMs = Number(arg('max-conversation-extension-open-phase-ms', '750')) || 750;
const maxRelatedConversationResultsMs = Number(arg('max-related-conversation-results-ms', '1000')) || 1000;
const maxWorkbenchToggleMs = Number(arg('max-workbench-toggle-ms', '750')) || 750;
const maxSideChatOpenMs = Number(arg('max-side-chat-open-ms', '2500')) || 2500;
const maxSideChatPromptVisibleMs = Number(arg('max-side-chat-prompt-visible-ms', '2500')) || 2500;
const maxRecoveryMs = Number(arg('max-recovery-ms', '2000')) || 2000;
const maxPostSubmitLongTaskMs = Number(arg('max-post-submit-longtask-ms', '250')) || 250;
const maxForkMs = Number(arg('max-fork-ms', '2000')) || 2000;
const draftSubmitWaitMs = Math.max(0, Number(arg('draft-submit-wait-ms', '0')) || 0);
const idleSettleMs = Math.max(0, Number(arg('idle-settle-ms', '2000')) || 0);
const traceDraftRoute = process.argv.includes('--trace-draft-route');
const measureFork = !process.argv.includes('--skip-fork');
const keep = process.argv.includes('--keep');
const root = mkdtempSync(join(tmpdir(), 'neon-pilot-perf-smoke-'));
const stateRoot = join(root, 'state');
const initialTranscriptTailBlocks = readNumericSourceExport(
  desktopConversationTranscriptPagingFile,
  'INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS',
);
const transcriptTailBlocksStep = readNumericSourceExport(
  desktopConversationTranscriptPagingFile,
  'CONVERSATION_TRANSCRIPT_TAIL_BLOCKS_STEP',
);
const expandedTranscriptTargetBlocks = initialTranscriptTailBlocks + transcriptTailBlocksStep;

function assertFreshFile(outputFile, inputFiles, commandHint) {
  let outputStat;
  try {
    outputStat = statSync(outputFile);
  } catch {
    throw new Error(`Missing build output: ${outputFile}\nRun: ${commandHint}`);
  }

  const staleInput = inputFiles
    .map((file) => {
      try {
        return { file, stat: statSync(file) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .find(({ stat }) => stat.mtimeMs > outputStat.mtimeMs);

  if (staleInput) {
    throw new Error(`Stale build output: ${outputFile} is older than ${staleInput.file}\nRun: ${commandHint}`);
  }
}

assertFreshFile(
  desktopMainFile,
  [
    join(repo, 'packages', 'desktop', 'src', 'backend', 'local-backend-child.ts'),
    join(repo, 'packages', 'desktop', 'src', 'backend', 'local-backend-processes.ts'),
    join(repo, 'packages', 'desktop', 'src', 'hosts', 'local-host-controller.ts'),
    join(repo, 'packages', 'desktop', 'src', 'main.ts'),
  ],
  'pnpm --dir packages/desktop run build:main',
);
assertFreshFile(desktopUiIndexFile, desktopUiSourceFiles, 'pnpm --dir packages/desktop run build:ui');
assertFreshFile(desktopServerBundleFile, desktopServerSourceFiles, 'pnpm --dir packages/desktop run build:server');
assertFreshFile(systemTodoFrontendBundleFile, systemTodoSourceFiles, 'pnpm run build:extensions');
assertFreshFile(systemTodoBackendBundleFile, systemTodoSourceFiles, 'pnpm run build:extensions');

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
function readOpenPhaseDurationMs(openResult, phase) {
  const durationMs = openResult?.result?.[`${phase}OpenPhase`]?.durationMs;
  return typeof durationMs === 'number' ? durationMs : null;
}
function pushOpenPhaseDurationFailure(failures, label, openResult, phase, maxMs) {
  const durationMs = readOpenPhaseDurationMs(openResult, phase);
  if (durationMs !== null && durationMs > maxMs) {
    failures.push(`${label}.${phase}OpenPhaseMs ${durationMs} > ${maxMs}`);
  }
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
    } catch {
      // CDP endpoint may not be ready yet.
    }
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
async function waitChatUsable(cdp, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    const usable = await evalJs(
      cdp,
      `(() => {
        const composerReady = Boolean(document.querySelector('textarea:not([disabled])'));
        return !document.querySelector('#app-loader') && composerReady;
      })()`,
    );
    if (usable) return;
    await sleep(100);
  }
  const diagnostics = await evalJs(
    cdp,
    `(() => ({
      location: location.href,
      pathname: location.pathname,
      title: document.title,
      loader: Boolean(document.querySelector('#app-loader')),
      textareaCount: document.querySelectorAll('textarea').length,
      enabledTextareaCount: document.querySelectorAll('textarea:not([disabled])').length,
      buttonCount: document.querySelectorAll('button').length,
      bodyText: (document.body?.innerText || '').slice(0, 1200),
      perf: globalThis.__NEON_PILOT_APP_PERF__ ? {
        extensionRegistryLoading: globalThis.__NEON_PILOT_APP_PERF__.extensionRegistryLoading,
        extensionRegistryCounts: globalThis.__NEON_PILOT_APP_PERF__.extensionRegistryCounts,
      } : null,
    }))()`,
  ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
  throw new Error(`timed out waiting for usable chat composer: ${JSON.stringify(diagnostics)}`);
}
async function waitExtensionRegistryReady(cdp, child, timeoutMs = 45_000) {
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
  throw new Error('timed out waiting for extension registry readiness');
}
async function waitAppSettled(cdp, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    const settled = await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        return !document.querySelector('#app-loader') && perf?.extensionRegistryLoading === false;
      })()`,
    );
    if (settled) return;
    await sleep(100);
  }
  throw new Error('timed out waiting for settled app shell');
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
  let parentId = null;
  for (let i = 0; i < longTranscriptBlockCount; i++) {
    const entryId = `${id}-message-${String(i).padStart(5, '0')}`;
    lines.push({
      type: 'message',
      id: entryId,
      parentId,
      timestamp: new Date(Date.now() + i).toISOString(),
      message: { role: i % 2 ? 'assistant' : 'user', content: `Long transcript message ${i} ${'x'.repeat(120)}` },
    });
    parentId = entryId;
  }
  writeFileSync(join(dir, `${id}.jsonl`), `${lines.map(JSON.stringify).join('\n')}\n`);
  return id;
}
function installTodoExtensionFixture() {
  const destination = join(stateRoot, 'extensions', 'system-todo');
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    join(stateRoot, 'extensions', 'registry.json'),
    `${JSON.stringify(
      {
        disabledIds: [],
        enabledIds: ['system-todo'],
        disabledKeybindings: [],
        keybindingOverrides: {},
        commandKeybindings: {},
        quarantined: {},
      },
      null,
      2,
    )}\n`,
  );
}
async function measure(name, fn) {
  const t = performance.now();
  const result = await fn();
  return { durationMs: Math.round(performance.now() - t), result };
}
async function waitForExpression(cdp, child, expression, timeoutMs = 30_000, pollMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    if (await evalJs(cdp, expression)) return;
    await sleep(pollMs);
  }
  const diagnostics = await evalJs(
    cdp,
    `(() => ({
      location: location.href,
      pathname: location.pathname,
      loader: Boolean(document.querySelector('#app-loader')),
      textareaCount: document.querySelectorAll('textarea').length,
      enabledTextareaCount: document.querySelectorAll('textarea:not([disabled])').length,
      buttonCount: document.querySelectorAll('button').length,
      bodyText: (document.body?.innerText || '').slice(0, 1200),
      bodyTextTail: (document.body?.innerText || '').slice(-1200)
    }))()`,
  ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
  throw new Error(`timed out waiting for expression: ${expression}; diagnostics=${JSON.stringify(diagnostics)}`);
}
async function navigateSpa(cdp, path) {
  return evalJs(
    cdp,
    `(() => {
      globalThis.__NEON_PILOT_LAST_SPA_NAVIGATION__ = {
        path: ${JSON.stringify(path)},
        startedAtMs: performance.now(),
        recordedAt: new Date().toISOString()
      };
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: ${JSON.stringify(path)} } }));
      return globalThis.__NEON_PILOT_LAST_SPA_NAVIGATION__;
    })()`,
  );
}
async function readSpaNavigationElapsedMs(cdp, path) {
  return evalJs(
    cdp,
    `(() => {
      const marker = globalThis.__NEON_PILOT_LAST_SPA_NAVIGATION__;
      if (!marker || marker.path !== ${JSON.stringify(path)} || typeof marker.startedAtMs !== 'number') return null;
      return Math.max(0, performance.now() - marker.startedAtMs);
    })()`,
  );
}
function latestSampleDuration(samples, name) {
  const sample = samples?.filter((entry) => entry.name === name).at(-1);
  return typeof sample?.durationMs === 'number' ? Math.round(sample.durationMs) : null;
}
function latestConversationOpenPhaseAfter(samples, conversationId, phase, beforeCount) {
  return (
    samples
      ?.filter((entry) => entry.conversationId === conversationId && entry.phase === phase)
      .slice(beforeCount)
      .at(-1) ?? null
  );
}
function latestClientSampleAfter(samples, predicate, beforeCount) {
  return samples?.filter(predicate).slice(beforeCount).at(-1) ?? null;
}
async function readConversationPerfStore(cdp) {
  return evalJs(
    cdp,
    `(() => {
      const perf = globalThis.__NEON_PILOT_APP_PERF__;
      if (!perf) return null;
      return {
        clientSamples: perf.clientSamples ?? [],
        conversationOpenSamples: perf.conversationOpenSamples ?? [],
        chatRenderSamples: perf.chatRenderSamples ?? [],
        apiSamples: perf.apiSamples ?? [],
      };
    })()`,
  );
}
async function openConversationSpa(cdp, child, conversationId, options = {}) {
  const path = `/conversations/${conversationId}`;
  const beforeCounts = await evalJs(
    cdp,
    `(() => {
      const perf = globalThis.__NEON_PILOT_APP_PERF__ ?? {};
      const conversationId = ${JSON.stringify(conversationId)};
      return {
        render: perf.chatRenderSamples?.filter((sample) => sample.conversationId === conversationId).length ?? 0,
        content: perf.conversationOpenSamples?.filter((sample) => sample.conversationId === conversationId && sample.phase === 'content').length ?? 0,
        extensions: perf.conversationOpenSamples?.filter((sample) => sample.conversationId === conversationId && sample.phase === 'extensions').length ?? 0,
        shelves:
          perf.clientSamples?.filter(
            (sample) => sample.name === 'conversation.composerShelvesReady' && sample.meta?.conversationId === conversationId,
          ).length ?? 0,
        navigateHandle:
          perf.clientSamples?.filter((sample) => sample.name === 'desktopNavigate.handle' && sample.meta?.route === ${JSON.stringify(path)})
            .length ?? 0,
        routeRender:
          perf.clientSamples?.filter((sample) => sample.name === 'conversation.routeRender' && sample.meta?.conversationId === conversationId)
            .length ?? 0,
        routeToBootstrap:
          perf.clientSamples?.filter(
            (sample) => sample.name === 'conversation.routeToBootstrapFetch' && sample.meta?.conversationId === conversationId,
          ).length ?? 0,
        bootstrap:
          perf.clientSamples?.filter((sample) => sample.name === 'desktop.conversationBootstrap' && sample.meta?.conversationId === conversationId)
            .length ?? 0,
        api: perf.apiSamples?.filter((sample) => typeof sample.path === 'string' && sample.path.includes(conversationId)).length ?? 0,
      };
    })()`,
  );
  await navigateSpa(cdp, path);
  await waitForExpression(
    cdp,
    child,
    `location.pathname === ${JSON.stringify(path)} && !document.querySelector('#app-loader')`,
    options.timeoutMs ?? 45_000,
    options.pollMs ?? 16,
  );
  const pathReadyMs = Math.round((await readSpaNavigationElapsedMs(cdp, path)) ?? 0);
  let expectedTextReadyMs = null;
  let renderReadyMs = null;
  const expectedText = options.expectedText;
  if (expectedText) {
    await waitForExpression(
      cdp,
      child,
      `(document.body.textContent || '').includes(${JSON.stringify(expectedText)})`,
      options.timeoutMs ?? 45_000,
      options.pollMs ?? 16,
    );
    expectedTextReadyMs = Math.round((await readSpaNavigationElapsedMs(cdp, path)) ?? pathReadyMs);
  } else if (options.waitForNewRender !== false) {
    await waitForExpression(
      cdp,
      child,
      `(() => {
        const samples = globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples ?? [];
        return samples.filter((sample) => sample.conversationId === ${JSON.stringify(conversationId)}).length > ${JSON.stringify(beforeCounts.render ?? 0)};
      })()`,
      options.timeoutMs ?? 45_000,
      options.pollMs ?? 16,
    );
    renderReadyMs = Math.round((await readSpaNavigationElapsedMs(cdp, path)) ?? pathReadyMs);
  }
  const usableReadyMs = expectedTextReadyMs ?? renderReadyMs ?? pathReadyMs;
  const perfStore = await readConversationPerfStore(cdp);
  const renderSamples = perfStore?.chatRenderSamples?.filter((sample) => sample.conversationId === conversationId) ?? [];
  const bootstrapSamples =
    perfStore?.clientSamples?.filter(
      (entry) => entry.name === 'desktop.conversationBootstrap' && entry.meta?.conversationId === conversationId,
    ) ?? [];
  const apiSamples =
    perfStore?.apiSamples?.filter((sample) => typeof sample.path === 'string' && sample.path.includes(conversationId)) ?? [];
  return {
    conversationId,
    readyMs: usableReadyMs,
    pathReadyMs,
    expectedTextReadyMs,
    renderReadyMs,
    waitForNewRender: options.waitForNewRender !== false,
    renderSample: renderSamples.slice(beforeCounts.render ?? 0).at(-1) ?? renderSamples.at(-1) ?? null,
    bootstrapSample: bootstrapSamples.slice(beforeCounts.bootstrap ?? 0).at(-1) ?? null,
    navigateHandleSample: latestClientSampleAfter(
      perfStore?.clientSamples,
      (sample) => sample.name === 'desktopNavigate.handle' && sample.meta?.route === path,
      beforeCounts.navigateHandle ?? 0,
    ),
    routeRenderSample: latestClientSampleAfter(
      perfStore?.clientSamples,
      (sample) => sample.name === 'conversation.routeRender' && sample.meta?.conversationId === conversationId,
      beforeCounts.routeRender ?? 0,
    ),
    routeToBootstrapSample: latestClientSampleAfter(
      perfStore?.clientSamples,
      (sample) => sample.name === 'conversation.routeToBootstrapFetch' && sample.meta?.conversationId === conversationId,
      beforeCounts.routeToBootstrap ?? 0,
    ),
    contentOpenPhase: latestConversationOpenPhaseAfter(
      perfStore?.conversationOpenSamples,
      conversationId,
      'content',
      beforeCounts.content ?? 0,
    ),
    extensionOpenPhase: latestConversationOpenPhaseAfter(
      perfStore?.conversationOpenSamples,
      conversationId,
      'extensions',
      beforeCounts.extensions ?? 0,
    ),
    shelvesReadySample:
      perfStore?.clientSamples
        ?.filter((sample) => sample.name === 'conversation.composerShelvesReady' && sample.meta?.conversationId === conversationId)
        .slice(beforeCounts.shelves ?? 0)
        .at(-1) ?? null,
    apiSamples: apiSamples.slice(beforeCounts.api ?? 0),
  };
}
async function abortSmokeLiveSession(cdp, conversationId) {
  if (!conversationId) return { skipped: true, reason: 'missing conversation id' };
  return evalJs(
    cdp,
    `(async()=> {
      const response = await fetch('/api/live-sessions/${encodeURIComponent(conversationId)}/abort', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    })()`,
  );
}
async function readDraftPromptDiagnostics(cdp, prompt) {
  return evalJs(
    cdp,
    `(() => ({
      pathname: location.pathname,
      bodyIncludesPrompt: document.body.innerText.includes(${JSON.stringify(prompt)}),
      textContentIncludesPrompt: (document.body.textContent || '').includes(${JSON.stringify(prompt)}),
      textareas: Array.from(document.querySelectorAll('textarea')).map((textarea) => textarea.value),
      sendDisabled: document.querySelector('button[aria-label="Send"]')?.disabled ?? null,
      bodyTextTail: document.body.innerText.slice(-1000),
      pendingPromptStorage: (() => {
        const id = location.pathname.split('/').filter(Boolean).at(-1);
        return id ? sessionStorage.getItem(\`pa:reload:conversation:\${id}:pending-prompt\`) : null;
      })(),
      pendingPromptStorageKeys: Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).filter((key) =>
        key?.includes('pending-prompt'),
      ),
      perf: globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.slice(-8) ?? null,
      routeTrace: globalThis.__NEON_PILOT_ROUTE_TRACE__ ?? null,
    }))()`,
  );
}
async function main() {
  await run(process.execPath, [
    join(repo, 'scripts/seed-startup-profile.mjs'),
    `--root=${stateRoot}`,
    `--sessions=${sessions}`,
    `--blocks=${blocks}`,
  ]);
  const longId = writeLongTranscript();
  installTodoExtensionFixture();
  const port = await allocatePort();
  const isPackagedApp = Boolean(app);
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined,
    ...(isPackagedApp
      ? {}
      : {
          NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
          NEON_PILOT_REPO_ROOT: repo,
        }),
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_CONFIG_ROOT: join(stateRoot, 'config'),
    NEON_PILOT_DESKTOP_USER_DATA_DIR: join(root, 'user-data'),
    NEON_PILOT_DAEMON_SOCKET_PATH: join(root, 'daemon.sock'),
    NEON_PILOT_COMPANION_PORT: '0',
  };
  const start = performance.now();
  const launchArgs = isPackagedApp
    ? [`--remote-debugging-port=${port}`, '--no-quit-confirmation', ...(entry ? [entry] : [])]
    : [`--remote-debugging-port=${port}`, desktopMainFile, '--no-quit-confirmation', ...(entry ? [entry] : [])];
  const child = spawn(join(app, 'Contents', 'MacOS', basename(app, '.app')), launchArgs, {
    env,
    stdio: 'ignore',
  });
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
    await waitChatUsable(cdp, child);
    const chatUsableMs = Math.round(performance.now() - start);
    await waitExtensionRegistryReady(cdp, child);
    const extensionRegistryReadyMs = Math.round(performance.now() - start);
    const appUsableMs = chatUsableMs;
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
      if (traceDraftRoute) {
        await evalJs(
          cdp,
          `(() => {
            const traces = [];
            const push = (kind, detail) => traces.push({
              kind,
              detail,
              pathname: location.pathname,
              search: location.search,
              at: Math.round(performance.now()),
              stack: (new Error()).stack?.split('\\n').slice(1, 8).join('\\n') ?? null,
            });
            const wrap = (name) => {
              const original = history[name];
              if (original.__paRouteTraceWrapped) return;
              const wrapped = function(...args) {
                const result = original.apply(this, args);
                push(name, { url: args[2] ?? args[1] ?? null });
                return result;
              };
              wrapped.__paRouteTraceWrapped = true;
              history[name] = wrapped;
            };
            wrap('pushState');
            wrap('replaceState');
            window.addEventListener('popstate', () => push('popstate', null), true);
            window.addEventListener('pa:desktop-navigate', (event) => push('desktopNavigate', event.detail ?? null), true);
            window.__NEON_PILOT_ROUTE_TRACE__ = traces;
            push('traceInstalled', null);
          })()`,
        );
      }
      if (draftSubmitWaitMs > 0) await sleep(draftSubmitWaitMs);
      await evalJs(cdp, `document.querySelector('textarea')?.focus()`);
      await cdp.send('Input.insertText', { text: prompt });
      await waitForExpression(cdp, child, `document.querySelector('textarea')?.value === ${JSON.stringify(prompt)}`, 5_000, 16);
      await evalJs(
        cdp,
        `(async()=>{let button=null; for(let i=0;i<60;i++){await new Promise(r=>requestAnimationFrame(r)); button=document.querySelector('button[aria-label="Send"]'); if(button&&!button.disabled) break;} if(!button) throw new Error('send button not found'); if(button.disabled) throw new Error('send button disabled'); globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__=performance.now(); button.click(); return true;})()`,
      );
      try {
        await waitForExpression(
          cdp,
          child,
          `location.pathname.startsWith('/conversations/') && !location.pathname.endsWith('/new')`,
          45_000,
          16,
        );
      } catch (error) {
        const diagnostics = await readDraftPromptDiagnostics(cdp, prompt).catch((diagnosticError) => ({
          diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
        }));
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
      }
      const routeMs = await evalJs(
        cdp,
        `Math.round(performance.now() - (globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? performance.now()))`,
      );
      await waitForExpression(
        cdp,
        child,
        `(() => {
          if (!location.pathname.startsWith('/conversations/') || location.pathname.endsWith('/new')) return false;
          return (document.body.textContent || '').includes(${JSON.stringify(prompt)});
        })()`,
        45_000,
        16,
      );
      const promptTextVisibleMs = await evalJs(
        cdp,
        `Math.round(performance.now() - (globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? performance.now()))`,
      );
      const promptVisibleAfterRouteMs = promptTextVisibleMs - routeMs;
      let pendingPromptBlockVisibleMs = null;
      try {
        await waitForExpression(
          cdp,
          child,
          `(() => {
            if (!location.pathname.startsWith('/conversations/') || location.pathname.endsWith('/new')) return false;
            const block = document.querySelector('[data-transcript-block-id="pending-initial-prompt"]');
            return Boolean(block && (block.textContent || '').includes(${JSON.stringify(prompt)}));
          })()`,
          90_000,
          16,
        );
        pendingPromptBlockVisibleMs = await evalJs(
          cdp,
          `Math.round(performance.now() - (globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? performance.now()))`,
        );
      } catch (error) {
        const diagnostics = await readDraftPromptDiagnostics(cdp, prompt).catch((diagnosticError) => ({
          diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
        }));
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
      }
      let reservedConversationAttachMs = null;
      let createdConversationAttachMs = null;
      try {
        await waitForExpression(
          cdp,
          child,
          `Boolean(globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.some(s=>s.name==='conversation.submitComposer.phase'&&s.meta?.phase==='afterNavigateReservedConversation'))`,
          45_000,
          16,
        );
        reservedConversationAttachMs = await evalJs(
          cdp,
          `Math.round(performance.now() - (globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? performance.now()))`,
        );
      } catch {
        reservedConversationAttachMs = null;
      }
      try {
        await waitForExpression(
          cdp,
          child,
          `Boolean(globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.some(s=>s.name==='conversation.submitComposer.phase'&&(s.meta?.phase==='createReservedLiveSession'||s.meta?.phase==='afterNavigateCreatedConversation'||s.meta?.phase==='skipDuplicateCreatedConversationNavigate')))`,
          45_000,
          16,
        );
        createdConversationAttachMs = await evalJs(
          cdp,
          `Math.round(performance.now() - (globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? performance.now()))`,
        );
      } catch {
        createdConversationAttachMs = null;
      }
      return {
        prompt,
        routeMs,
        promptTextVisibleMs,
        promptVisibleAfterRouteMs,
        pendingPromptBlockVisibleMs,
        reservedConversationAttachMs,
        createdConversationAttachMs,
      };
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
    const reserveConversationClientMs = await evalJs(
      cdp,
      `globalThis.__NEON_PILOT_APP_PERF__?.clientSamples?.filter(s=>s.name==='desktop.reserveConversation').at(-1)?.durationMs ?? null`,
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
          smokeDraftClickStartMs: globalThis.__NEON_PILOT_SMOKE_DRAFT_CLICK_START_MS__ ?? null,
        };
      })()`,
    );
    const draftSubmitFirstPromptVisibleMs = (() => {
      const clickStartMs = postDraftPerfStore?.smokeDraftClickStartMs;
      const sample = postDraftPerfStore?.chatRenderSamples
        ?.filter((entry) => entry.conversationId === 'draft-conversation' && typeof entry.startTimeMs === 'number')
        ?.filter((entry) => typeof clickStartMs !== 'number' || entry.startTimeMs >= clickStartMs)
        ?.at(0);
      return typeof clickStartMs === 'number' && typeof sample?.startTimeMs === 'number'
        ? Math.max(0, Math.round(sample.startTimeMs - clickStartMs))
        : draftSubmitVisibleMs;
    })();
    const draftSubmitNavigateCalledMs = (() => {
      const phase = postDraftPerfStore?.clientSamples
        ?.filter(
          (sample) => sample.name === 'conversation.submitComposer.phase' && sample.meta?.phase === 'afterNavigateReservedConversation',
        )
        ?.at(-1);
      return typeof phase?.durationMs === 'number' ? Math.round(phase.durationMs) : null;
    })();
    const draftSubmitCreatedNavigateCalledMs = (() => {
      const phase = postDraftPerfStore?.clientSamples
        ?.filter(
          (sample) =>
            sample.name === 'conversation.submitComposer.phase' &&
            (sample.meta?.phase === 'createReservedLiveSession' ||
              sample.meta?.phase === 'afterNavigateCreatedConversation' ||
              sample.meta?.phase === 'skipDuplicateCreatedConversationNavigate'),
        )
        ?.at(-1);
      return typeof phase?.durationMs === 'number' ? Math.round(phase.durationMs) : null;
    })();
    const draftSubmitInitialPromptDispatchMs = (() => {
      const phase = postDraftPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'conversation.submitComposer.phase' && sample.meta?.phase === 'beforeDispatchInitialPrompt')
        ?.at(-1);
      return typeof phase?.durationMs === 'number' ? Math.round(phase.durationMs) : null;
    })();
    const draftSubmitCreatedConversationId = (() => {
      const phase = postDraftPerfStore?.clientSamples
        ?.filter(
          (sample) =>
            sample.name === 'conversation.submitComposer.phase' &&
            typeof sample.meta?.conversationId === 'string' &&
            (sample.meta?.phase === 'afterNavigateReservedConversation' ||
              sample.meta?.phase === 'createReservedLiveSession' ||
              sample.meta?.phase === 'afterNavigateCreatedConversation' ||
              sample.meta?.phase === 'skipDuplicateCreatedConversationNavigate'),
        )
        ?.at(-1);
      return typeof phase?.meta?.conversationId === 'string' ? phase.meta.conversationId : null;
    })();
    const draftSubmitSavedRouteRenderMs = (() => {
      const clickStartMs = postDraftPerfStore?.smokeDraftClickStartMs;
      if (typeof clickStartMs !== 'number' || !draftSubmitCreatedConversationId) return null;
      const sample = postDraftPerfStore?.chatRenderSamples
        ?.filter(
          (entry) =>
            entry.conversationId === draftSubmitCreatedConversationId &&
            typeof entry.startTimeMs === 'number' &&
            entry.startTimeMs >= clickStartMs,
        )
        ?.at(0);
      return typeof sample?.startTimeMs === 'number' ? Math.max(0, Math.round(sample.startTimeMs - clickStartMs)) : null;
    })();
    const draftSubmitSavedRouteCommitMs = (() => {
      const clickStartMs = postDraftPerfStore?.smokeDraftClickStartMs;
      if (typeof clickStartMs !== 'number' || !draftSubmitCreatedConversationId) return null;
      const sample = postDraftPerfStore?.chatRenderSamples
        ?.filter(
          (entry) =>
            entry.conversationId === draftSubmitCreatedConversationId &&
            typeof entry.committedAtMs === 'number' &&
            entry.committedAtMs >= clickStartMs,
        )
        ?.at(0);
      return typeof sample?.committedAtMs === 'number' ? Math.max(0, Math.round(sample.committedAtMs - clickStartMs)) : null;
    })();
    const workbenchSideChat = await measure('workbench side chat open and start', async () => {
      if (!draftSubmitCreatedConversationId) {
        return { skipped: true, reason: 'draft created conversation id missing' };
      }

      await openConversationSpa(cdp, child, draftSubmitCreatedConversationId, { waitForNewRender: false });

      const clickWorkbenchToggle = async (label) =>
        evalJs(
          cdp,
          `(() => {
            const label = ${JSON.stringify(label)};
            const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
              candidate.getAttribute('aria-label') === label ||
              candidate.getAttribute('title') === label ||
              (candidate.textContent || '').trim() === label
            );
            if (!button) return false;
            button.click();
            return true;
          })()`,
        );

      const openStartedAtMs = await evalJs(cdp, `performance.now()`);
      if (
        !(await clickWorkbenchToggle('Show workbench')) &&
        !(await evalJs(cdp, `Boolean(document.querySelector('[data-workbench-document-pane="true"]'))`))
      ) {
        return { skipped: true, reason: 'show workbench button missing' };
      }
      await waitForExpression(cdp, child, `Boolean(document.querySelector('[data-workbench-document-pane="true"]'))`, 5_000, 16);
      const openMs = Math.round((await evalJs(cdp, `performance.now()`)) - openStartedAtMs);

      const collapseStartedAtMs = await evalJs(cdp, `performance.now()`);
      if (!(await clickWorkbenchToggle('Hide workbench'))) {
        return { skipped: true, reason: 'hide workbench button missing' };
      }
      await waitForExpression(cdp, child, `!document.querySelector('[data-workbench-document-pane="true"]')`, 5_000, 16);
      const collapseMs = Math.round((await evalJs(cdp, `performance.now()`)) - collapseStartedAtMs);
      const collapsedPaneCount = await evalJs(cdp, `document.querySelectorAll('[data-workbench-document-pane="true"]').length`);
      const workbenchChatActionExpression = `document.querySelector('[data-workbench-new-tab-action="chat"]:not([disabled])')`;

      const reopenStartedAtMs = await evalJs(cdp, `performance.now()`);
      if (!(await clickWorkbenchToggle('Show workbench'))) {
        return { skipped: true, reason: 'show workbench button missing after collapse' };
      }
      await waitForExpression(
        cdp,
        child,
        `Boolean(document.querySelector('[data-workbench-document-pane="true"]')) &&
          Boolean(${workbenchChatActionExpression})`,
        5_000,
        16,
      );
      const reopenMs = Math.round((await evalJs(cdp, `performance.now()`)) - reopenStartedAtMs);

      const sidePrompt = `Perf side chat ${Date.now()}`;
      const sideOpenStartedAtMs = await evalJs(
        cdp,
        `(() => {
          const button = ${workbenchChatActionExpression};
          if (!button) return null;
          const startedAtMs = performance.now();
          button.click();
          return startedAtMs;
        })()`,
      );
      if (typeof sideOpenStartedAtMs !== 'number') {
        return { skipped: true, reason: 'side chat button missing' };
      }
      await waitForExpression(cdp, child, `Boolean(document.querySelector('[data-chat-rail="1"] textarea:not([disabled])'))`, 5_000, 16);
      const sideChatOpenMs = Math.round((await evalJs(cdp, `performance.now()`)) - sideOpenStartedAtMs);
      const sideConversationId = await evalJs(
        cdp,
        `(() => {
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.clientSamples ?? [];
          const reserveSample = samples
            .filter((sample) =>
              sample.name === 'desktop.reserveConversation' &&
              typeof sample.startTimeMs === 'number' &&
              sample.startTimeMs >= ${JSON.stringify(sideOpenStartedAtMs)} &&
              typeof sample.meta?.conversationId === 'string'
            )
            .at(-1);
          if (reserveSample?.meta?.conversationId) return reserveSample.meta.conversationId;
          const closeButton = Array.from(document.querySelectorAll('button')).find((button) =>
            (button.getAttribute('aria-label') || '').startsWith('Close Chat ')
          );
          return (closeButton?.getAttribute('aria-label') || '').replace(/^Close Chat\\s+/, '') || null;
        })()`,
      );

      await evalJs(
        cdp,
        `(() => {
          const rail = document.querySelector('[data-chat-rail="1"]');
          const textarea = rail?.querySelector('textarea:not([disabled])');
          if (!(textarea instanceof HTMLTextAreaElement)) return null;
          const prompt = ${JSON.stringify(sidePrompt)};
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(textarea, prompt);
          textarea.focus();
          textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
          return true;
        })()`,
      );
      await waitForExpression(
        cdp,
        child,
        `(() => {
          const rail = document.querySelector('[data-chat-rail="1"]');
          return Array.from(rail?.querySelectorAll('button') ?? []).some((candidate) =>
            !candidate.disabled &&
            (candidate.getAttribute('aria-label') === 'Send' ||
              candidate.getAttribute('title') === 'Send' ||
              (candidate.textContent || '').trim() === 'Send')
          );
        })()`,
        5_000,
        16,
      );
      const promptStartedAtMs = await evalJs(
        cdp,
        `(() => {
          const rail = document.querySelector('[data-chat-rail="1"]');
          const button = Array.from(rail.querySelectorAll('button')).find((candidate) =>
            candidate.getAttribute('aria-label') === 'Send' ||
            candidate.getAttribute('title') === 'Send' ||
            (candidate.textContent || '').trim() === 'Send'
          );
          if (!button || button.disabled) return null;
          const startedAtMs = performance.now();
          button.click();
          return startedAtMs;
        })()`,
      );
      if (typeof promptStartedAtMs !== 'number') {
        return { skipped: true, reason: 'side chat send button unavailable', sideChatOpenMs, sideConversationId };
      }
      await waitForExpression(
        cdp,
        child,
        `(() => {
          const railText = document.querySelector('[data-chat-rail="1"]')?.textContent || '';
          if (railText.includes(${JSON.stringify(sidePrompt)})) return true;
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.clientSamples ?? [];
          return samples.some((sample) =>
            sample.name === 'desktop.promptSession' &&
            sample.meta?.conversationId === ${JSON.stringify(sideConversationId)} &&
            sample.meta?.promptLength === ${JSON.stringify(sidePrompt.length)} &&
            typeof sample.endTimeMs === 'number' &&
            sample.endTimeMs >= ${JSON.stringify(promptStartedAtMs)}
          );
        })()`,
        5_000,
        16,
      );
      const promptResult = await evalJs(
        cdp,
        `(() => {
          const railText = document.querySelector('[data-chat-rail="1"]')?.textContent || '';
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.clientSamples ?? [];
          const sample = samples.find((entry) =>
            entry.name === 'desktop.promptSession' &&
            entry.meta?.conversationId === ${JSON.stringify(sideConversationId)} &&
            entry.meta?.promptLength === ${JSON.stringify(sidePrompt.length)} &&
            typeof entry.endTimeMs === 'number' &&
            entry.endTimeMs >= ${JSON.stringify(promptStartedAtMs)}
          );
          return {
            promptVisible: railText.includes(${JSON.stringify(sidePrompt)}),
            promptStartMs: Math.round(((sample?.endTimeMs ?? performance.now()) - ${JSON.stringify(promptStartedAtMs)})),
            promptSessionSample: sample ?? null,
          };
        })()`,
      );
      const finalCollapseStartedAtMs = await evalJs(cdp, `performance.now()`);
      let finalCollapseMs = null;
      if (await evalJs(cdp, `Boolean(document.querySelector('[data-workbench-document-pane="true"]'))`)) {
        if (!(await clickWorkbenchToggle('Hide workbench'))) {
          return { skipped: true, reason: 'hide workbench button missing after side chat', sideChatOpenMs, sideConversationId };
        }
        await waitForExpression(cdp, child, `!document.querySelector('[data-workbench-document-pane="true"]')`, 5_000, 16);
        finalCollapseMs = Math.round((await evalJs(cdp, `performance.now()`)) - finalCollapseStartedAtMs);
      }

      return {
        skipped: false,
        openMs,
        collapseMs,
        collapsedPaneCount,
        reopenMs,
        finalCollapseMs,
        sideChatOpenMs,
        sideChatPromptStartMs: promptResult?.promptStartMs ?? null,
        sideChatPromptVisibleMs: promptResult?.promptVisible ? promptResult.promptStartMs : null,
        sideChatPromptSessionSample: promptResult?.promptSessionSample ?? null,
        sideConversationId,
        prompt: sidePrompt,
      };
    });
    const forkFixture = {
      sessionFile: join(stateRoot, 'sync', 'pi-agent', 'sessions', 'personal-agent', 'startup-fixture-00000.jsonl'),
      cwd: '/tmp/neon-fixture/personal-agent',
    };
    const forkSmoke = measureFork
      ? await measure('fork and rewind live conversation', async () =>
          evalJs(
            cdp,
            `(async()=> {
              const timings = {};
              const measureStep = async (name, fn) => {
                const startedAt = performance.now();
                const result = await fn();
                timings[name + 'Ms'] = Math.round(performance.now() - startedAt);
                return result;
              };
              const resumed = await measureStep('resume', () => fetch('/api/live-sessions/resume', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  sessionFile: ${JSON.stringify(forkFixture.sessionFile)},
                  cwd: ${JSON.stringify(forkFixture.cwd)}
                })
              }).then(r => r.json()));
              timings.resumePerf = resumed.perf || null;
              const conversationId = resumed.id;
              if (!conversationId) return { skipped: true, reason: resumed?.error || 'resume failed', timings };
              const entries = await measureStep('forkEntries', () => fetch('/api/live-sessions/' + encodeURIComponent(conversationId) + '/fork-entries').then(r => r.ok ? r.json() : []));
              const entryId = Array.isArray(entries) ? (entries.at(-1)?.entryId ?? entries.at(-1)?.id) : null;
              if (!entryId) return { skipped: true, reason: 'no fork entries after fixture resume', timings };
              const rewindResponse = await measureStep('rewind', () => fetch('/api/live-sessions/' + encodeURIComponent(conversationId) + '/fork', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ entryId, preserveSource: true, beforeEntry: true })
              }));
              const rewindBody = await rewindResponse.json().catch(() => ({}));
              if (!rewindResponse.ok) return { skipped: true, reason: rewindBody?.error || 'rewind failed', timings };
              const forkResponse = await measureStep('fork', () => fetch('/api/live-sessions/' + encodeURIComponent(conversationId) + '/fork', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ entryId, preserveSource: true, beforeEntry: false })
              }));
              const forkBody = await forkResponse.json().catch(() => ({}));
              if (!forkResponse.ok) return { skipped: true, reason: forkBody?.error || 'fork failed', timings, rewindSessionId: rewindBody.newSessionId || null, rewindPerf: rewindBody.perf || null };
              return {
                skipped: false,
                entryId,
                rewindSessionId: rewindBody.newSessionId || null,
                forkSessionId: forkBody.newSessionId || null,
                newSessionId: rewindBody.newSessionId || null,
                timings,
                rewindPerf: rewindBody.perf || null,
                forkPerf: forkBody.perf || null,
                perf: rewindBody.perf || null
              };
            })()`,
          ),
        )
      : {
          durationMs: null,
          result: { skipped: true, reason: measureFork ? 'no live conversation id' : 'fork measurement disabled' },
        };
    const rewindConversationOpen = await measure('rewound conversation spa open', async () => {
      const rewindId = forkSmoke.result?.rewindSessionId ?? forkSmoke.result?.newSessionId;
      if (!rewindId) return { skipped: true, reason: forkSmoke.result?.reason ?? 'rewind did not produce a conversation id' };
      return {
        skipped: false,
        ...(await openConversationSpa(cdp, child, rewindId)),
      };
    });
    const forkedConversationOpen = await measure('forked conversation spa open', async () => {
      const forkedId = forkSmoke.result?.forkSessionId;
      if (!forkedId) return { skipped: true, reason: forkSmoke.result?.reason ?? 'fork did not produce a conversation id' };
      return {
        skipped: false,
        ...(await openConversationSpa(cdp, child, forkedId)),
      };
    });
    const spaRouteSettings = await measure('settings spa route', async () => {
      await navigateSpa(cdp, '/settings');
      await waitForExpression(
        cdp,
        child,
        `location.pathname === '/settings' && Boolean(document.querySelector('[data-extension-id="system-settings"]'))`,
        5_000,
        16,
      );
      return Math.round((await readSpaNavigationElapsedMs(cdp, '/settings')) ?? 0);
    });
    const spaRouteSettingsMs = spaRouteSettings.durationMs;
    const spaRouteSettingsReadyMs = spaRouteSettings.result || spaRouteSettingsMs;
    const settingsRoutePerfStore = await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        if (!perf) return null;
        return { clientSamples: perf.clientSamples ?? [] };
      })()`,
    );
    const spaRouteSettingsSamples =
      settingsRoutePerfStore?.clientSamples
        ?.filter(
          (sample) =>
            ['desktopNavigate.handle', 'extensionRoute.render', 'extensionSurface.render', 'extensionModule.loaded'].includes(
              sample.name,
            ) &&
            (sample.meta?.route === '/settings' || sample.route === '/settings'),
        )
        ?.slice(-8) ?? [];
    const spaRouteSettingsPhaseMs = {
      navigateHandle: latestSampleDuration(spaRouteSettingsSamples, 'desktopNavigate.handle'),
      routeRender: latestSampleDuration(spaRouteSettingsSamples, 'extensionRoute.render'),
      surfaceRender: latestSampleDuration(spaRouteSettingsSamples, 'extensionSurface.render'),
      moduleLoaded: latestSampleDuration(spaRouteSettingsSamples, 'extensionModule.loaded'),
    };
    const spaRouteExtensions = await measure('extensions spa route', async () => {
      await navigateSpa(cdp, '/extensions');
      await waitForExpression(
        cdp,
        child,
        `location.pathname === '/extensions' && Boolean(document.querySelector('[data-extension-id="system-extension-manager"]'))`,
        5_000,
        16,
      );
      return Math.round((await readSpaNavigationElapsedMs(cdp, '/extensions')) ?? 0);
    });
    const spaRouteExtensionsMs = spaRouteExtensions.durationMs;
    const spaRouteExtensionsReadyMs = spaRouteExtensions.result || spaRouteExtensionsMs;
    const routeSettingsMs = (
      await measure('settings', async () => {
        await cdp.send('Page.navigate', { url: 'neon-pilot://app/settings' });
        await waitBody(cdp, child);
      })
    ).durationMs;
    const routeExtensionsMs = (
      await measure('extensions', async () => {
        await cdp.send('Page.navigate', { url: 'neon-pilot://app/extensions' });
        await waitBody(cdp, child);
      })
    ).durationMs;
    await waitAppSettled(cdp, child);
    const conversationSearchMs = (
      await measure('conversation search', async () => {
        await evalJs(
          cdp,
          `fetch('/api/sessions/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'suggested context release regression',limit:80})}).then(r=>r.json())`,
        );
      })
    ).durationMs;
    const relatedConversationResults = await measure('related conversation results', async () => {
      return evalJs(
        cdp,
        `(async()=> {
            const startedAt = performance.now();
            const sessions = await fetch('/api/sessions?limit=100').then(r => r.json());
            const sessionsAt = performance.now();
            const candidates = (Array.isArray(sessions) ? sessions : []).slice(0, 100);
            const sessionIds = candidates.map(session => session.id).filter(Boolean);
            if (sessionIds.length === 0) {
              const skippedAt = performance.now();
              return {
                results: { searchResults: [], recentResults: [], visibleResults: [] },
                perfHeader: null,
                timings: {
                  candidateCount: 0,
                  sessionsMs: Math.round(sessionsAt - startedAt),
                  searchIndexMs: 0,
                  resultsStringifyMs: 0,
                  resultsFetchMs: 0,
                  resultsDecodeMs: 0,
                  resultsMs: 0,
                  totalMs: Math.round(skippedAt - startedAt),
                  skipped: true
                }
              };
            }
            const searchIndex = await fetch('/api/sessions/search-index', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionIds })
            }).then(r => r.json()).then(r => r.index || {});
            const searchIndexAt = performance.now();
            const resultsBodyStartedAt = performance.now();
            const resultsBody = JSON.stringify({
              sessionIds,
              summaries: {},
              query: 'transcript loading backend performance',
              workspaceCwd: candidates[0]?.cwd ?? null,
              selectedRelatedThreadIds: [],
              limit: 9
            });
            const resultsFetchStartedAt = performance.now();
            const resultsResponse = await fetch('/api/related-conversations/results', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: resultsBody
            });
            const resultsPerfHeader = resultsResponse.headers.get('X-PA-Perf');
            const resultsResponseAt = performance.now();
            const results = await resultsResponse.json();
            const resultsAt = performance.now();
            return {
              results,
              perfHeader: resultsPerfHeader ? JSON.parse(resultsPerfHeader) : null,
              timings: {
                sessionsMs: Math.round(sessionsAt - startedAt),
                candidateCount: sessionIds.length,
                searchIndexMs: Math.round(searchIndexAt - sessionsAt),
                resultsStringifyMs: Math.round(resultsFetchStartedAt - resultsBodyStartedAt),
                resultsFetchMs: Math.round(resultsResponseAt - resultsFetchStartedAt),
                resultsDecodeMs: Math.round(resultsAt - resultsResponseAt),
                resultsMs: Math.round(resultsAt - searchIndexAt),
                totalMs: Math.round(resultsAt - startedAt)
              }
            };
          })()`,
      );
    });
    const relatedConversationResultsMs = relatedConversationResults.durationMs;
    const modelFetch = await measure('models', async () =>
      evalJs(
        cdp,
        `(async()=> {
          const response = await fetch('/api/models');
          const perfHeader = response.headers.get('X-PA-Perf');
          await response.json();
          return { perfHeader: perfHeader ? JSON.parse(perfHeader) : null };
        })()`,
      ),
    );
    const modelFetchMs = modelFetch.durationMs;
    const spaLongTranscriptOpen = await measure('long transcript spa route', async () => {
      const beforeSampleCount = await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length ?? 0`,
      );
      await navigateSpa(cdp, `/conversations/${longId}`);
      await waitForExpression(
        cdp,
        child,
        `location.pathname === ${JSON.stringify(`/conversations/${longId}`)} && !document.querySelector('#app-loader')`,
        45_000,
        16,
      );
      await waitForExpression(cdp, child, `(document.body.textContent || '').includes('Long transcript message 4999')`, 45_000, 16);
      await waitForExpression(
        cdp,
        child,
        `(() => {
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples ?? [];
          return samples.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length > ${JSON.stringify(beforeSampleCount)};
        })()`,
        45_000,
        16,
      );
      const sample = await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1) ?? null`,
      );
      return {
        sample,
        readyMs: Math.round((await readSpaNavigationElapsedMs(cdp, `/conversations/${longId}`)) ?? 0),
      };
    });
    const spaLongTranscriptOpenMs = spaLongTranscriptOpen.durationMs;
    const spaLongTranscriptReadyMs = spaLongTranscriptOpen.result.readyMs || spaLongTranscriptOpenMs;
    const spaLongTranscriptRenderSample = spaLongTranscriptOpen.result.renderSample;
    const spaLongTranscriptPerfStore = await evalJs(
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
    const spaLongTranscriptBootstrapSample =
      spaLongTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'desktop.conversationBootstrap' && sample.meta?.conversationId === longId)
        ?.at(-1) ?? null;
    const spaLongTranscriptRouteToBootstrapSample =
      spaLongTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'conversation.routeToBootstrapFetch' && sample.meta?.conversationId === longId)
        ?.at(-1) ?? null;
    const spaLongTranscriptNavigateHandleSample =
      spaLongTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'desktopNavigate.handle' && sample.meta?.route === `/conversations/${longId}`)
        ?.at(-1) ?? null;
    const spaLongTranscriptRouteRenderSample =
      spaLongTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'conversation.routeRender' && sample.meta?.conversationId === longId)
        ?.at(-1) ?? null;
    const spaLongTranscriptApiSamples =
      spaLongTranscriptPerfStore?.apiSamples?.filter((sample) => typeof sample.path === 'string' && sample.path.includes(longId)) ?? [];
    const spaSwitchLongToDraftCreated = await measure('long transcript to created conversation spa route', async () => {
      const targetId = draftSubmitCreatedConversationId;
      if (!targetId) return { skipped: true, reason: 'draft created conversation id missing' };
      const opened = await openConversationSpa(cdp, child, targetId, { waitForNewRender: false });
      await waitForExpression(cdp, child, `Boolean(document.querySelector('textarea'))`, 45_000, 16);
      const bodyIncludesPrompt = await evalJs(
        cdp,
        `(document.body.textContent || '').includes(${JSON.stringify(draftSubmitResult.result.prompt)})`,
      );
      const bodyTextAroundPrompt = await evalJs(
        cdp,
        `(() => {
          const text = document.body.textContent || '';
          const prompt = ${JSON.stringify(draftSubmitResult.result.prompt)};
          const index = text.indexOf(prompt);
          if (index >= 0) return text.slice(Math.max(0, index - 240), index + prompt.length + 240);
          return text.slice(-1200);
        })()`,
      );
      const currentPathname = await evalJs(cdp, `location.pathname`);
      const transcriptBlocks = await evalJs(
        cdp,
        `Array.from(document.querySelectorAll('[data-transcript-block-id]')).map((element) => ({
          id: element.getAttribute('data-transcript-block-id'),
          text: (element.textContent || '').slice(0, 300)
        }))`,
      );
      const pendingPromptStorage = await evalJs(
        cdp,
        `(() => {
          const prefix = 'pa:reload:conversation:${targetId}:pending-prompt';
          return {
            prompt: sessionStorage.getItem(prefix),
            dispatching: sessionStorage.getItem(prefix + '-dispatching'),
          };
        })()`,
      );
      const bootstrapState = await evalJs(
        cdp,
        `(async () => {
          const response = await fetch('/api/conversations/${encodeURIComponent(targetId)}/bootstrap?tailBlocks=24');
          const body = await response.json().catch(() => null);
          return {
            status: response.status,
            sessionDetail: body?.sessionDetail ? {
              blockOffset: body.sessionDetail.blockOffset,
              totalBlocks: body.sessionDetail.totalBlocks,
              blocks: Array.isArray(body.sessionDetail.blocks)
                ? body.sessionDetail.blocks.map((block) => ({
                    id: block?.id,
                    type: block?.type,
                    text: typeof block?.text === 'string' ? block.text.slice(0, 300) : undefined,
                    role: block?.role,
                  }))
                : null,
            } : null,
            live: body?.liveSession ?? null,
          };
        })()`,
      );
      return {
        skipped: false,
        ...opened,
        currentPathname,
        bodyIncludesPrompt,
        bodyTextAroundPrompt,
        transcriptBlocks,
        pendingPromptStorage,
        bootstrapState,
      };
    });
    const todoShelfSeed = await evalJs(
      cdp,
      `(async()=> {
        const startedAt = performance.now();
        const response = await fetch('/api/extensions/system-todo/actions/addItem', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: ${JSON.stringify(longId)},
            text: 'Perf smoke todo item'
          })
        });
        const body = await response.json().catch(() => ({}));
        return {
          ok: response.ok && body?.ok !== false,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
          body
        };
      })()`,
    );
    const todoShelfConversationOpen = await measure('long transcript with todo shelf spa open', async () => {
      if (!todoShelfSeed?.ok) {
        return {
          skipped: true,
          reason: todoShelfSeed?.body?.error || `system-todo addItem failed with ${todoShelfSeed?.status ?? 'unknown status'}`,
          seed: todoShelfSeed,
        };
      }
      await navigateSpa(cdp, '/conversations/new');
      await waitForExpression(
        cdp,
        child,
        `location.pathname === '/conversations/new' && Boolean(document.querySelector('textarea'))`,
        5_000,
        16,
      );
      const opened = await openConversationSpa(cdp, child, longId, { expectedText: 'Long transcript message 4999' });
      const todoVisibleStartedAtMs = performance.now();
      try {
        await waitForExpression(
          cdp,
          child,
          `(document.body.textContent || '').includes('Todos') && (document.body.textContent || '').includes('Perf smoke todo item')`,
          45_000,
          16,
        );
      } catch (error) {
        return {
          skipped: true,
          reason: error instanceof Error ? error.message : String(error),
          seed: todoShelfSeed,
          opened,
          diagnostics: await evalJs(
            cdp,
            `(async()=> {
              const registry = await fetch('/api/extensions/registry').then((response) => response.json()).catch((error) => ({ error: String(error) }));
              const state = await fetch('/api/extensions/system-todo/actions/getState', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ conversationId: ${JSON.stringify(longId)} })
              }).then((response) => response.json()).catch((error) => ({ error: String(error) }));
              const bodyText = document.body.textContent || '';
              return {
                location: location.pathname,
                hasTodosText: bodyText.includes('Todos'),
                hasTodoItemText: bodyText.includes('Perf smoke todo item'),
                bodyTextTail: bodyText.slice(-1200),
                composerShelfHosts: Array.from(document.querySelectorAll('[data-composer-shelf-id]')).map((element) => ({
                  extensionId: element.getAttribute('data-extension-id'),
                  shelfId: element.getAttribute('data-composer-shelf-id'),
                  text: (element.textContent || '').slice(0, 300)
                })),
                registryHasTodo: Array.isArray(registry?.extensions)
                  ? registry.extensions.some((extension) => extension.id === 'system-todo')
                  : false,
                composerShelfCount: Array.isArray(registry?.composerShelves) ? registry.composerShelves.length : null,
                todoState: state
              };
            })()`,
          ),
        };
      }
      const todoPerfMeasures = await evalJs(
        cdp,
        `performance.getEntriesByType('measure')
          .filter((entry) => entry.name.startsWith('system-todo.shelf.'))
          .slice(-20)
          .map((entry) => ({
            name: entry.name,
            startTime: Math.round(entry.startTime),
            durationMs: Math.round(entry.duration),
            detail: entry.detail ?? null,
          }))`,
      );
      const shelvesReadyAfterVisibleSample = await evalJs(
        cdp,
        `(() => {
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.clientSamples ?? [];
          return samples
            .filter((sample) => sample.name === 'conversation.composerShelvesReady' && sample.meta?.conversationId === ${JSON.stringify(longId)})
            .at(-1) ?? null;
        })()`,
      );
      return {
        skipped: false,
        seed: todoShelfSeed,
        todoVisibleAfterOpenMs: Math.round(performance.now() - todoVisibleStartedAtMs),
        todoPerfMeasures,
        shelvesReadyAfterVisibleSample,
        ...opened,
      };
    });
    const repeatedConversationSwitch = await measure('repeated conversation switching', async () => {
      const targets = [
        ...(forkSmoke.result?.rewindSessionId ? [{ label: 'rewound', conversationId: forkSmoke.result.rewindSessionId, options: {} }] : []),
        ...(forkSmoke.result?.forkSessionId ? [{ label: 'forked', conversationId: forkSmoke.result.forkSessionId, options: {} }] : []),
        ...(draftSubmitCreatedConversationId
          ? [{ label: 'created', conversationId: draftSubmitCreatedConversationId, options: { waitForNewRender: false } }]
          : []),
        { label: 'long', conversationId: longId, options: { expectedText: 'Long transcript message 4999' } },
      ];
      if (targets.length < 2) return { skipped: true, reason: 'not enough switch targets' };
      const iterations = [];
      for (let index = 0; index < 6; index += 1) {
        const target = targets[index % targets.length];
        const measured = await measure(`switch ${target.label}`, async () =>
          openConversationSpa(cdp, child, target.conversationId, target.options),
        );
        iterations.push({
          label: target.label,
          conversationId: target.conversationId,
          durationMs: measured.durationMs,
          readyMs: measured.result.readyMs,
          waitForNewRender: measured.result.waitForNewRender,
          bootstrapMs: measured.result.bootstrapSample?.durationMs ?? null,
          contentMs: measured.result.contentOpenPhase?.durationMs ?? null,
          shelvesMs: measured.result.shelvesReadySample?.durationMs ?? null,
          renderMs: measured.result.renderSample?.durationMs ?? null,
        });
      }
      const durations = iterations.map((entry) => entry.durationMs).filter((value) => typeof value === 'number');
      return {
        skipped: false,
        iterations,
        maxMs: Math.max(0, ...durations),
        avgMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      };
    });
    await navigateSpa(cdp, '/conversations/new');
    await waitForExpression(
      cdp,
      child,
      `location.pathname === '/conversations/new' && Boolean(document.querySelector('textarea'))`,
      5_000,
      16,
    );
    await evalJs(
      cdp,
      `(() => {
        const perf = globalThis.__NEON_PILOT_APP_PERF__;
        if (perf && Array.isArray(perf.chatRenderSamples)) {
          perf.chatRenderSamples = perf.chatRenderSamples.filter((sample) => sample.conversationId !== ${JSON.stringify(longId)});
        }
      })()`,
    );
    const longTranscriptOpen = await measure('long transcript', async () => {
      const beforeSampleCount = await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length ?? 0`,
      );
      await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${longId}` });
      await waitForExpression(
        cdp,
        child,
        `location.pathname === ${JSON.stringify(`/conversations/${longId}`)} && !document.querySelector('#app-loader')`,
        45_000,
        16,
      );
      await waitForExpression(cdp, child, `(document.body.textContent || '').includes('Long transcript message 4999')`, 45_000, 16);
      await waitForExpression(
        cdp,
        child,
        `(() => {
          const samples = globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples ?? [];
          return samples.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length > ${JSON.stringify(beforeSampleCount)};
        })()`,
        45_000,
        16,
      );
      return evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1) ?? null`,
      );
    });
    const longTranscriptOpenMs = longTranscriptOpen.durationMs;
    const longTranscriptRenderSample = longTranscriptOpen.result;
    const longTranscriptPerfStore = await evalJs(
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
    const longTranscriptConversationStateSample =
      longTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'desktop.conversationState' && sample.meta?.conversationId === longId)
        ?.at(-1) ?? null;
    const longTranscriptBootstrapSample =
      longTranscriptPerfStore?.clientSamples
        ?.filter((sample) => sample.name === 'desktop.conversationBootstrap' && sample.meta?.conversationId === longId)
        ?.at(-1) ?? null;
    const longTranscriptApiSamples =
      longTranscriptPerfStore?.apiSamples?.filter((sample) => typeof sample.path === 'string' && sample.path.includes(longId)) ?? [];
    await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${longId}` });
    await waitForExpression(
      cdp,
      child,
      `location.pathname === ${JSON.stringify(`/conversations/${longId}`)} && !document.querySelector('#app-loader')`,
      45_000,
    );
    await waitForExpression(
      cdp,
      child,
      `Array.from(document.querySelectorAll('button')).some((button) => /Load previous/i.test(button.textContent || '') && !button.disabled)`,
      45_000,
      16,
    );
    const longTranscriptLoadPrevious = await measure('long transcript previous page', async () => {
      const beforeSampleCount = await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length ?? 0`,
      );
      const beforeApiSampleCount = await evalJs(cdp, `globalThis.__NEON_PILOT_APP_PERF__?.apiSamples?.length ?? 0`);
      const buttonSelector = `button`;
      const clicked = await evalJs(
        cdp,
        `(() => {
            const buttons = Array.from(document.querySelectorAll(${JSON.stringify(buttonSelector)}));
            const button = buttons.find((candidate) => /Load previous/i.test(candidate.textContent || ''));
            if (!button) return false;
            button.click();
            return true;
          })()`,
      );
      if (!clicked) return { skipped: true, reason: 'load previous button not visible' };
      const grew = await waitForExpression(
        cdp,
        child,
        `(() => {
            const samples = globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples ?? [];
            const latest = samples.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1);
            return samples.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length > ${JSON.stringify(
              beforeSampleCount,
            )} && (latest?.meta?.messageCount ?? 0) > ${JSON.stringify(initialTranscriptTailBlocks)};
          })()`,
        45_000,
        16,
      ).then(
        () => true,
        () => false,
      );
      const sample = await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1) ?? null`,
      );
      const diagnostics = await evalJs(
        cdp,
        `(() => {
            const scrollShell = document.querySelector('[data-conversation-scroll-shell]');
            const perf = globalThis.__NEON_PILOT_APP_PERF__;
            const apiSamples = (${samplesAfterCount.toString()})(perf?.apiSamples ?? [], ${JSON.stringify(beforeApiSampleCount)});
            return {
              scrollShellDataset: scrollShell ? { ...scrollShell.dataset } : null,
              buttonTexts: Array.from(document.querySelectorAll('button')).map((button) => ({
                text: (button.textContent || '').trim(),
                disabled: button.disabled,
              })).filter((button) => /Load previous|Loading earlier/i.test(button.text)),
              apiSamples: apiSamples.filter((sample) => typeof sample.path === 'string' && sample.path.includes(${JSON.stringify(
                longId,
              )})).slice(-6) ?? [],
            };
          })()`,
      );
      return { skipped: false, grew, sample, diagnostics };
    });
    const longTranscriptLoadPreviousMs = longTranscriptLoadPrevious.durationMs;
    await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${longId}` });
    await waitForExpression(
      cdp,
      child,
      `location.pathname === ${JSON.stringify(`/conversations/${longId}`)} && !document.querySelector('#app-loader')`,
      45_000,
    );
    await waitForExpression(cdp, child, `(document.body.textContent || '').includes('Long transcript message 4999')`, 45_000);
    const longTranscriptExpandedWindowing = await measure('long transcript expanded windowing', async () => {
      let clicked = 0;
      let latestSample = null;
      for (let index = 0; index < 12; index += 1) {
        const buttonReady = await evalJs(
          cdp,
          `Array.from(document.querySelectorAll('button')).some((button) => /Load previous/i.test(button.textContent || '') && !button.disabled)`,
        );
        if (!buttonReady) {
          await waitForExpression(
            cdp,
            child,
            `!Array.from(document.querySelectorAll('button')).some((button) => /Loading earlier/i.test(button.textContent || ''))`,
            45_000,
            16,
          ).catch(() => null);
        }
        const beforeSampleCount = await evalJs(
          cdp,
          `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).length ?? 0`,
        );
        const didClick = await evalJs(
          cdp,
          `(() => {
            const button = Array.from(document.querySelectorAll('button')).find((candidate) => /Load previous/i.test(candidate.textContent || ''));
            if (!button) return false;
            button.click();
            return true;
          })()`,
        );
        if (!didClick) {
          break;
        }
        clicked += 1;
        await waitForExpression(
          cdp,
          child,
          `(() => {
            const samples = globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples ?? [];
            const scrollShell = document.querySelector('[data-conversation-scroll-shell]');
            const loadedTailBlocks = Number(scrollShell?.dataset?.historicalTailBlocks ?? 0);
            return samples.filter((sample) => sample.conversationId === ${JSON.stringify(
              longId,
            )}).length > ${JSON.stringify(beforeSampleCount)} || loadedTailBlocks >= ${JSON.stringify(expandedTranscriptTargetBlocks)};
          })()`,
          45_000,
          16,
        );
        latestSample = await evalJs(
          cdp,
          `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1) ?? null`,
        );
        const messageCount = latestSample?.meta?.messageCount ?? 0;
        const loadedTailBlocks = await evalJs(
          cdp,
          `Number(document.querySelector('[data-conversation-scroll-shell]')?.dataset?.historicalTailBlocks ?? 0)`,
        );
        if (messageCount >= expandedTranscriptTargetBlocks || loadedTailBlocks >= expandedTranscriptTargetBlocks) {
          break;
        }
      }

      latestSample ??= await evalJs(
        cdp,
        `globalThis.__NEON_PILOT_APP_PERF__?.chatRenderSamples?.filter((sample) => sample.conversationId === ${JSON.stringify(longId)}).at(-1) ?? null`,
      );
      const diagnostics = await evalJs(
        cdp,
        `(async () => {
          const scrollShell = document.querySelector('[data-conversation-scroll-shell]');
          const bootstrapResponse = await fetch('/api/conversations/${encodeURIComponent(longId)}/bootstrap?tailBlocks=${encodeURIComponent(
            String(initialTranscriptTailBlocks),
          )}');
          const bootstrap = await bootstrapResponse.json().catch(() => null);
          return {
            pathname: location.pathname,
            hasHiddenHeader: (document.body.textContent || '').includes('Earlier conversation hidden'),
            buttonTexts: Array.from(document.querySelectorAll('button')).map((button) => (button.textContent || '').trim()).filter(Boolean),
            scrollShellDataset: scrollShell ? { ...scrollShell.dataset } : null,
            bootstrapStatus: bootstrapResponse.status,
            bootstrapSessionDetail: bootstrap?.sessionDetail
              ? {
                  blocks: Array.isArray(bootstrap.sessionDetail.blocks) ? bootstrap.sessionDetail.blocks.length : null,
                  blockOffset: bootstrap.sessionDetail.blockOffset,
                  totalBlocks: bootstrap.sessionDetail.totalBlocks,
                  metaMessageCount: bootstrap.sessionDetail.meta?.messageCount,
                }
              : null,
            bootstrapSessionDetailAppendOnly: bootstrap?.sessionDetailAppendOnly
              ? {
                  blocks: Array.isArray(bootstrap.sessionDetailAppendOnly.blocks) ? bootstrap.sessionDetailAppendOnly.blocks.length : null,
                  blockOffset: bootstrap.sessionDetailAppendOnly.blockOffset,
                  totalBlocks: bootstrap.sessionDetailAppendOnly.totalBlocks,
                }
              : null,
          };
        })()`,
      );
      return {
        clicked,
        targetBlocks: expandedTranscriptTargetBlocks,
        sample: latestSample,
        diagnostics,
      };
    });
    const longTranscriptRecovery = await measure('long transcript recovery', async () =>
      evalJs(
        cdp,
        `(async()=> {
          const response = await fetch('/api/conversations/${encodeURIComponent(longId)}/recover', { method: 'POST' });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) return { skipped: true, reason: body?.error || 'recover failed', status: response.status };
          return { skipped: false, result: body, perf: body.perf || null };
        })()`,
      ),
    );
    const longTranscriptRecoveryOpen = await measure('recovered long transcript spa open', async () => {
      const recoveredId = longTranscriptRecovery.result?.result?.conversationId;
      if (!recoveredId)
        return { skipped: true, reason: longTranscriptRecovery.result?.reason ?? 'recovery did not return conversation id' };
      await navigateSpa(cdp, '/conversations/new');
      await waitForExpression(
        cdp,
        child,
        `location.pathname === '/conversations/new' && Boolean(document.querySelector('textarea'))`,
        5_000,
        16,
      );
      return {
        skipped: false,
        ...(await openConversationSpa(cdp, child, recoveredId, { expectedText: 'Long transcript message 4999' })),
      };
    });
    await cdp.send('Page.navigate', { url: 'neon-pilot://app/conversations/new' });
    await waitAppHydrated(cdp, child);
    await waitForExpression(cdp, child, `Boolean(document.querySelector('textarea'))`);
    const interaction = await evalJs(
      cdp,
      `(async()=>{ const t=[]; function m(n,f){const s=performance.now(); f(); t.push([n, performance.now()-s]);} m('commandPalette',()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>requestAnimationFrame(r)); const el=document.querySelector('textarea'); if(el){m('composerFocus',()=>el.focus()); m('type100',()=>{ const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set; setter?.call(el,'x'.repeat(100)); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'x'.repeat(100)}));}); await new Promise(r=>requestAnimationFrame(r)); m('type500',()=>{ const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set; setter?.call(el,'y'.repeat(500)); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'y'.repeat(500)}));})} return t;})()`,
    );
    const quiesceLiveSessions = [];
    for (const conversationId of new Set(
      [
        draftSubmitCreatedConversationId,
        workbenchSideChat.result?.sideConversationId,
        forkSmoke.result?.forkSessionId,
        forkSmoke.result?.rewindSessionId,
        longTranscriptRecovery.result?.result?.conversationId,
      ].filter(Boolean),
    )) {
      quiesceLiveSessions.push({ conversationId, ...(await abortSmokeLiveSession(cdp, conversationId)) });
    }
    if (idleSettleMs > 0) {
      await sleep(idleSettleMs);
    }
    const memBefore = await evalJs(cdp, `performance.memory ? performance.memory.usedJSHeapSize : 0`);
    const cpuSamples = [];
    const idleCpuStartedAtMs = Date.now();
    const deadline = idleCpuStartedAtMs + seconds * 1000;
    while (Date.now() < deadline) {
      const sample = await sampleCpu(child.pid);
      const mainProcessDiagnostics = await evalJs(
        cdp,
        `(async()=> {
          const response = await fetch('/api/desktop/perf-diagnostics').catch(() => null);
          if (!response?.ok) return null;
          return response.json().catch(() => null);
        })()`,
      );
      cpuSamples.push({
        ...sample,
        mainProcessOperations: mainProcessDiagnostics?.operations ?? null,
        offsetMs: Date.now() - idleCpuStartedAtMs,
      });
      await sleep(1000);
    }
    const memAfter = await evalJs(cdp, `performance.memory ? performance.memory.usedJSHeapSize : 0`);
    const cpuPeak = Math.max(...cpuSamples.map((s) => s.total));
    const cpuAvg = cpuSamples.reduce((s, v) => s + v.total, 0) / cpuSamples.length;
    const idleCpuPeakSample = cpuSamples.toSorted((a, b) => b.total - a.total)[0] ?? { offenders: [] };
    const idleCpuOffenderSummary = summarizeCpuOffenders(cpuSamples);
    const report = {
      startupReadyMs,
      cdpReadyMs,
      firstBodyMs,
      appHydratedMs,
      appUsableMs,
      chatUsableMs,
      extensionRegistryReadyMs,
      startupResources,
      startupPerfStore,
      draftSubmitSetupMs,
      draftSubmitVisibleMs,
      draftSubmitPrompt: draftSubmitResult.result.prompt,
      draftSubmitFirstPromptVisibleMs,
      draftSubmitRouteMs: draftSubmitResult.result.routeMs,
      draftSubmitPromptTextVisibleMs: draftSubmitResult.result.promptTextVisibleMs,
      draftSubmitNavigateCalledMs,
      draftSubmitCreatedNavigateCalledMs,
      draftSubmitInitialPromptDispatchMs,
      draftSubmitCreatedConversationId,
      draftSubmitSavedRouteRenderMs,
      draftSubmitSavedRouteCommitMs,
      draftSubmitPendingPromptBlockVisibleMs: draftSubmitResult.result.pendingPromptBlockVisibleMs,
      draftSubmitReservedConversationAttachMs: draftSubmitResult.result.reservedConversationAttachMs,
      draftSubmitCreatedConversationAttachMs: draftSubmitResult.result.createdConversationAttachMs,
      draftPromptVisibleAfterRouteMs: draftSubmitResult.result.promptVisibleAfterRouteMs,
      workbenchSideChatMs: workbenchSideChat.durationMs,
      workbenchSideChatResult: workbenchSideChat.result,
      reserveConversationClientMs,
      createLiveSessionClientMs,
      createLiveSessionServerPerf,
      forkSmokeMs: forkSmoke.durationMs,
      forkSmokeResult: forkSmoke.result,
      rewindConversationOpenMs: rewindConversationOpen.durationMs,
      rewindConversationOpenResult: rewindConversationOpen.result,
      forkedConversationOpenMs: forkedConversationOpen.durationMs,
      forkedConversationOpenResult: forkedConversationOpen.result,
      postDraftPerfStore,
      spaRouteSettingsMs,
      spaRouteSettingsReadyMs,
      spaRouteSettingsPhaseMs,
      spaRouteSettingsSamples,
      spaRouteExtensionsMs,
      spaRouteExtensionsReadyMs,
      routeSettingsMs,
      routeExtensionsMs,
      conversationSearchMs,
      relatedConversationResultsMs,
      relatedConversationResultTimings: relatedConversationResults.result?.timings ?? null,
      relatedConversationResultPerfHeader: relatedConversationResults.result?.perfHeader ?? null,
      modelFetchMs,
      modelFetchPerfHeader: modelFetch.result?.perfHeader ?? null,
      spaLongTranscriptOpenMs,
      spaLongTranscriptReadyMs,
      spaLongTranscriptRenderSample,
      spaLongTranscriptBootstrapSample,
      spaLongTranscriptRouteToBootstrapSample,
      spaLongTranscriptNavigateHandleSample,
      spaLongTranscriptRouteRenderSample,
      spaLongTranscriptApiSamples,
      spaSwitchLongToDraftCreatedMs: spaSwitchLongToDraftCreated.durationMs,
      spaSwitchLongToDraftCreatedReadyMs: spaSwitchLongToDraftCreated.result?.readyMs ?? spaSwitchLongToDraftCreated.durationMs,
      spaSwitchLongToDraftCreatedResult: spaSwitchLongToDraftCreated.result,
      todoShelfSeed,
      todoShelfConversationOpenMs: todoShelfConversationOpen.durationMs,
      todoShelfConversationOpenResult: todoShelfConversationOpen.result,
      repeatedConversationSwitchMs: repeatedConversationSwitch.durationMs,
      repeatedConversationSwitchResult: repeatedConversationSwitch.result,
      longTranscriptOpenMs,
      longTranscriptRenderSample,
      longTranscriptConversationStateSample,
      longTranscriptBootstrapSample,
      longTranscriptApiSamples,
      longTranscriptLoadPreviousMs,
      longTranscriptLoadPreviousResult: longTranscriptLoadPrevious.result,
      longTranscriptExpandedWindowingMs: longTranscriptExpandedWindowing.durationMs,
      longTranscriptExpandedWindowingResult: longTranscriptExpandedWindowing.result,
      longTranscriptRecoveryMs: longTranscriptRecovery.durationMs,
      longTranscriptRecoveryResult: longTranscriptRecovery.result,
      longTranscriptRecoveryOpenMs: longTranscriptRecoveryOpen.durationMs,
      longTranscriptRecoveryOpenResult: longTranscriptRecoveryOpen.result,
      interactions: interaction,
      quiesceLiveSessions,
      idleCpuPeak: Math.round(cpuPeak * 10) / 10,
      idleCpuAvg: Math.round(cpuAvg * 10) / 10,
      idleCpuPeakOffsetMs: idleCpuPeakSample.offsetMs ?? null,
      idleCpuSampleTotals: cpuSamples.map((sample) => ({
        offsetMs: sample.offsetMs,
        total: Math.round(sample.total * 10) / 10,
        mainProcessOperations: sample.mainProcessOperations ?? null,
      })),
      idleCpuOffenders: idleCpuPeakSample.offenders ?? [],
      idleCpuPeakMainProcessOperations: idleCpuPeakSample.mainProcessOperations ?? null,
      idleCpuOffenderSummary,
      rendererHeapDeltaMb: Math.round(((memAfter - memBefore) / 1024 / 1024) * 10) / 10,
      sessions,
      blocks,
      seconds,
      draftSubmitWaitMs,
      idleSettleMs,
    };
    const reportJson = JSON.stringify(report, null, 2);
    if (output) {
      mkdirSync(dirname(resolve(output)), { recursive: true });
      writeFileSync(output, `${reportJson}\n`);
    }
    console.log(reportJson);
    const failures = [];
    if (startupReadyMs > maxReadyMs) failures.push(`startupReadyMs ${startupReadyMs} > ${maxReadyMs}`);
    if (appUsableMs > maxReadyMs) failures.push(`appUsableMs ${appUsableMs} > ${maxReadyMs}`);
    if (extensionRegistryReadyMs > maxExtensionRegistryReadyMs)
      failures.push(`extensionRegistryReadyMs ${extensionRegistryReadyMs} > ${maxExtensionRegistryReadyMs}`);
    const maxPeakCpu = Math.max(maxCpu * 3, cpus().length * 100);
    if (cpuAvg > maxCpu || cpuPeak > maxPeakCpu)
      failures.push(`idleCpu peak=${cpuPeak.toFixed(1)} avg=${cpuAvg.toFixed(1)} avgLimit=${maxCpu} peakLimit=${maxPeakCpu}`);
    if (conversationSearchMs > 1000) failures.push(`conversationSearchMs ${conversationSearchMs} > 1000`);
    if (relatedConversationResultsMs > maxRelatedConversationResultsMs)
      failures.push(`relatedConversationResultsMs ${relatedConversationResultsMs} > ${maxRelatedConversationResultsMs}`);
    if (longTranscriptOpenMs > maxLongTranscriptOpenMs)
      failures.push(`longTranscriptOpenMs ${longTranscriptOpenMs} > ${maxLongTranscriptOpenMs}`);
    if (longTranscriptRecovery.result?.skipped) {
      failures.push(`longTranscriptRecovery skipped: ${longTranscriptRecovery.result.reason ?? 'unknown reason'}`);
    } else if (longTranscriptRecovery.durationMs > maxRecoveryMs) {
      failures.push(`longTranscriptRecoveryMs ${longTranscriptRecovery.durationMs} > ${maxRecoveryMs}`);
    }
    if (longTranscriptRecoveryOpen.result?.skipped) {
      failures.push(`longTranscriptRecoveryOpen skipped: ${longTranscriptRecoveryOpen.result.reason ?? 'unknown reason'}`);
    } else if (longTranscriptRecoveryOpen.durationMs > maxLongTranscriptOpenMs) {
      failures.push(`longTranscriptRecoveryOpenMs ${longTranscriptRecoveryOpen.durationMs} > ${maxLongTranscriptOpenMs}`);
    }
    pushOpenPhaseDurationFailure(
      failures,
      'longTranscriptRecoveryOpen',
      longTranscriptRecoveryOpen,
      'content',
      maxConversationContentOpenPhaseMs,
    );
    pushOpenPhaseDurationFailure(
      failures,
      'longTranscriptRecoveryOpen',
      longTranscriptRecoveryOpen,
      'extension',
      maxConversationExtensionOpenPhaseMs,
    );
    if ((longTranscriptRenderSample?.meta?.messageCount ?? 0) < Math.min(blocks, initialTranscriptTailBlocks))
      failures.push(`longTranscriptRenderSample messageCount too low: ${longTranscriptRenderSample?.meta?.messageCount ?? 'missing'}`);
    if (draftSubmitVisibleMs > maxDraftSubmitVisibleMs)
      failures.push(`draftSubmitVisibleMs ${draftSubmitVisibleMs} > ${maxDraftSubmitVisibleMs}`);
    if (draftSubmitFirstPromptVisibleMs > maxDraftFirstPromptVisibleMs)
      failures.push(`draftSubmitFirstPromptVisibleMs ${draftSubmitFirstPromptVisibleMs} > ${maxDraftFirstPromptVisibleMs}`);
    if (
      typeof draftSubmitResult.result.pendingPromptBlockVisibleMs === 'number' &&
      draftSubmitResult.result.pendingPromptBlockVisibleMs > maxDraftPendingPromptVisibleMs
    ) {
      failures.push(
        `draftSubmitPendingPromptBlockVisibleMs ${draftSubmitResult.result.pendingPromptBlockVisibleMs} > ${maxDraftPendingPromptVisibleMs}`,
      );
    }
    if (
      Number.isFinite(maxDraftCreatedAttachMs) &&
      typeof draftSubmitResult.result.createdConversationAttachMs === 'number' &&
      draftSubmitResult.result.createdConversationAttachMs > maxDraftCreatedAttachMs
    ) {
      failures.push(
        `draftSubmitCreatedConversationAttachMs ${draftSubmitResult.result.createdConversationAttachMs} > ${maxDraftCreatedAttachMs}`,
      );
    }
    if (typeof draftSubmitInitialPromptDispatchMs === 'number' && draftSubmitInitialPromptDispatchMs > maxDraftInitialPromptDispatchMs) {
      failures.push(`draftSubmitInitialPromptDispatchMs ${draftSubmitInitialPromptDispatchMs} > ${maxDraftInitialPromptDispatchMs}`);
    }
    if (workbenchSideChat.result?.skipped) {
      failures.push(`workbenchSideChat skipped: ${workbenchSideChat.result.reason ?? 'unknown reason'}`);
    } else {
      const workbenchResult = workbenchSideChat.result ?? {};
      if (workbenchResult.collapsedPaneCount !== 0) {
        failures.push(`workbenchSideChat collapsedPaneCount ${workbenchResult.collapsedPaneCount} !== 0`);
      }
      if (typeof workbenchResult.openMs === 'number' && workbenchResult.openMs > maxWorkbenchToggleMs) {
        failures.push(`workbenchSideChat openMs ${workbenchResult.openMs} > ${maxWorkbenchToggleMs}`);
      }
      if (typeof workbenchResult.collapseMs === 'number' && workbenchResult.collapseMs > maxWorkbenchToggleMs) {
        failures.push(`workbenchSideChat collapseMs ${workbenchResult.collapseMs} > ${maxWorkbenchToggleMs}`);
      }
      if (typeof workbenchResult.reopenMs === 'number' && workbenchResult.reopenMs > maxWorkbenchToggleMs) {
        failures.push(`workbenchSideChat reopenMs ${workbenchResult.reopenMs} > ${maxWorkbenchToggleMs}`);
      }
      if (typeof workbenchResult.finalCollapseMs === 'number' && workbenchResult.finalCollapseMs > maxWorkbenchToggleMs) {
        failures.push(`workbenchSideChat finalCollapseMs ${workbenchResult.finalCollapseMs} > ${maxWorkbenchToggleMs}`);
      }
      if (typeof workbenchResult.sideChatOpenMs === 'number' && workbenchResult.sideChatOpenMs > maxSideChatOpenMs) {
        failures.push(`workbenchSideChat sideChatOpenMs ${workbenchResult.sideChatOpenMs} > ${maxSideChatOpenMs}`);
      }
      if (typeof workbenchResult.sideChatPromptStartMs === 'number' && workbenchResult.sideChatPromptStartMs > maxSideChatPromptVisibleMs) {
        failures.push(`workbenchSideChat sideChatPromptStartMs ${workbenchResult.sideChatPromptStartMs} > ${maxSideChatPromptVisibleMs}`);
      }
    }
    const draftClickStartMs = postDraftPerfStore?.smokeDraftClickStartMs;
    const postDraftApiPaths = (postDraftPerfStore?.apiSamples ?? [])
      .filter(
        (sample) => typeof draftClickStartMs !== 'number' || typeof sample.endTimeMs !== 'number' || sample.endTimeMs >= draftClickStartMs,
      )
      .map((sample) => sample.path)
      .filter((path) => typeof path === 'string');
    if (postDraftApiPaths.some((path) => path === '/api/models')) {
      failures.push('draft submit loaded /api/models on the immediate path');
    }
    if (postDraftApiPaths.some((path) => path.includes('/api/live-sessions/prewarm'))) {
      failures.push('draft submit queued /api/live-sessions/prewarm on the immediate path');
    }
    const createRecentOperations = Array.isArray(createLiveSessionServerPerf?.rpcIpcRecentOperations)
      ? createLiveSessionServerPerf.rpcIpcRecentOperations
      : [];
    if (createRecentOperations.some((entry) => typeof entry === 'string' && entry.includes('/api/live-sessions/prewarm'))) {
      failures.push('createLiveSession waited behind live-session prewarm');
    }
    if ((createLiveSessionServerPerf?.rpcIpcQueueMs ?? 0) > maxCreateLiveSessionIpcQueueMs) {
      failures.push(`createLiveSession rpcIpcQueueMs ${createLiveSessionServerPerf.rpcIpcQueueMs} > ${maxCreateLiveSessionIpcQueueMs}`);
    }
    const createLiveSessionResourceOptionsMs =
      createLiveSessionServerPerf?.['capability.capabilityResourceOptionsMs'] ??
      createLiveSessionServerPerf?.capabilityResourceOptionsMs ??
      Number.POSITIVE_INFINITY;
    if (createLiveSessionServerPerf?.['capability.resourceOptions.cacheHit'] !== 1 && createLiveSessionResourceOptionsMs > 50) {
      failures.push(
        `createLiveSession missed the prewarmed live-session resource options cache and resourceOptionsMs ${
          Number.isFinite(createLiveSessionResourceOptionsMs) ? createLiveSessionResourceOptionsMs : 'missing'
        } > 50`,
      );
    }
    if (longTranscriptLoadPrevious.result?.skipped) {
      failures.push(`longTranscriptLoadPrevious skipped: ${longTranscriptLoadPrevious.result.reason ?? 'unknown reason'}`);
    }
    if (longTranscriptLoadPrevious.result && !longTranscriptLoadPrevious.result.skipped && !longTranscriptLoadPrevious.result.grew) {
      failures.push('longTranscriptLoadPrevious did not grow the rendered transcript window');
    }
    if (longTranscriptLoadPreviousMs > maxLongTranscriptLoadPreviousMs)
      failures.push(`longTranscriptLoadPreviousMs ${longTranscriptLoadPreviousMs} > ${maxLongTranscriptLoadPreviousMs}`);
    if (
      (longTranscriptLoadPrevious.result?.sample?.meta?.mountedMessageCount ?? Number.POSITIVE_INFINITY) > maxLongTranscriptMountedMessages
    ) {
      failures.push(
        `longTranscriptLoadPrevious mountedMessageCount ${
          longTranscriptLoadPrevious.result?.sample?.meta?.mountedMessageCount ?? 'missing'
        } > ${maxLongTranscriptMountedMessages}`,
      );
    }
    const expandedWindowingLoadedTailBlocks = Number(
      longTranscriptExpandedWindowing.result?.diagnostics?.scrollShellDataset?.historicalTailBlocks ?? 0,
    );
    if (expandedWindowingLoadedTailBlocks < expandedTranscriptTargetBlocks) {
      failures.push(
        `longTranscriptExpandedWindowing loaded tail too low: ${expandedWindowingLoadedTailBlocks || 'missing'} < ${expandedTranscriptTargetBlocks}`,
      );
    }
    if (
      expandedWindowingLoadedTailBlocks < expandedTranscriptTargetBlocks &&
      (longTranscriptExpandedWindowing.result?.sample?.meta?.messageCount ?? 0) <= initialTranscriptTailBlocks
    ) {
      failures.push(
        `longTranscriptExpandedWindowing messageCount did not grow: ${
          longTranscriptExpandedWindowing.result?.sample?.meta?.messageCount ?? 'missing'
        } <= ${initialTranscriptTailBlocks}`,
      );
    }
    if (longTranscriptExpandedWindowing.result?.sample?.meta?.shouldWindowTranscript !== true) {
      failures.push('longTranscriptExpandedWindowing did not enable transcript windowing');
    }
    if (
      (longTranscriptExpandedWindowing.result?.sample?.meta?.mountedMessageCount ?? Number.POSITIVE_INFINITY) >
      maxLongTranscriptMountedMessages
    ) {
      failures.push(
        `longTranscriptExpandedWindowing mountedMessageCount ${
          longTranscriptExpandedWindowing.result?.sample?.meta?.mountedMessageCount ?? 'missing'
        } > ${maxLongTranscriptMountedMessages}`,
      );
    }
    if ((longTranscriptExpandedWindowing.result?.sample?.durationMs ?? Number.POSITIVE_INFINITY) > maxLongTranscriptExpandedRenderMs) {
      failures.push(
        `longTranscriptExpandedWindowing renderMs ${
          longTranscriptExpandedWindowing.result?.sample?.durationMs ?? 'missing'
        } > ${maxLongTranscriptExpandedRenderMs}`,
      );
    }
    const postSubmitLongTaskPeakMs = Math.max(0, ...(postDraftPerfStore?.longTaskSamples ?? []).map((sample) => sample.durationMs ?? 0));
    if (postSubmitLongTaskPeakMs > maxPostSubmitLongTaskMs)
      failures.push(`postSubmitLongTaskPeakMs ${postSubmitLongTaskPeakMs} > ${maxPostSubmitLongTaskMs}`);
    if (measureFork) {
      if (forkSmoke.result?.skipped) {
        failures.push(`forkSmoke skipped: ${forkSmoke.result.reason ?? 'unknown reason'}`);
      } else if (typeof forkSmoke.durationMs === 'number' && forkSmoke.durationMs > maxForkMs) {
        failures.push(`forkSmokeMs ${forkSmoke.durationMs} > ${maxForkMs}`);
      }
      const resumeRecentInitialPromptRpcMs = readRecentOperationDurationMs(
        forkSmoke.result?.timings?.resumePerf?.rpcIpcRecentOperations,
        'rpc:submitDesktopLiveSessionPrompt',
      );
      if (resumeRecentInitialPromptRpcMs !== null && resumeRecentInitialPromptRpcMs > maxRecentInitialPromptRpcMs) {
        failures.push(
          `forkSmoke recent submitDesktopLiveSessionPromptMs ${resumeRecentInitialPromptRpcMs} > ${maxRecentInitialPromptRpcMs}`,
        );
      }
      if (rewindConversationOpen.result?.skipped) {
        failures.push(`rewindConversationOpen skipped: ${rewindConversationOpen.result.reason ?? 'unknown reason'}`);
      } else if (typeof rewindConversationOpen.durationMs === 'number' && rewindConversationOpen.durationMs > maxLongTranscriptOpenMs) {
        failures.push(`rewindConversationOpenMs ${rewindConversationOpen.durationMs} > ${maxLongTranscriptOpenMs}`);
      }
      pushOpenPhaseDurationFailure(
        failures,
        'rewindConversationOpen',
        rewindConversationOpen,
        'content',
        maxConversationContentOpenPhaseMs,
      );
      pushOpenPhaseDurationFailure(
        failures,
        'rewindConversationOpen',
        rewindConversationOpen,
        'extension',
        maxConversationExtensionOpenPhaseMs,
      );
      if (forkedConversationOpen.result?.skipped) {
        failures.push(`forkedConversationOpen skipped: ${forkedConversationOpen.result.reason ?? 'unknown reason'}`);
      } else if (typeof forkedConversationOpen.durationMs === 'number' && forkedConversationOpen.durationMs > maxLongTranscriptOpenMs) {
        failures.push(`forkedConversationOpenMs ${forkedConversationOpen.durationMs} > ${maxLongTranscriptOpenMs}`);
      }
      pushOpenPhaseDurationFailure(
        failures,
        'forkedConversationOpen',
        forkedConversationOpen,
        'content',
        maxConversationContentOpenPhaseMs,
      );
      pushOpenPhaseDurationFailure(
        failures,
        'forkedConversationOpen',
        forkedConversationOpen,
        'extension',
        maxConversationExtensionOpenPhaseMs,
      );
    }
    if (spaSwitchLongToDraftCreated.result?.skipped) {
      failures.push(`spaSwitchLongToDraftCreated skipped: ${spaSwitchLongToDraftCreated.result.reason ?? 'unknown reason'}`);
    } else if (
      typeof spaSwitchLongToDraftCreated.result?.readyMs === 'number' &&
      spaSwitchLongToDraftCreated.result.readyMs > maxLongTranscriptOpenMs
    ) {
      failures.push(`spaSwitchLongToDraftCreatedReadyMs ${spaSwitchLongToDraftCreated.result.readyMs} > ${maxLongTranscriptOpenMs}`);
    }
    if (todoShelfConversationOpen.result?.skipped) {
      failures.push(`todoShelfConversationOpen skipped: ${todoShelfConversationOpen.result.reason ?? 'unknown reason'}`);
    } else if (typeof todoShelfConversationOpen.durationMs === 'number' && todoShelfConversationOpen.durationMs > maxLongTranscriptOpenMs) {
      failures.push(`todoShelfConversationOpenMs ${todoShelfConversationOpen.durationMs} > ${maxLongTranscriptOpenMs}`);
    }
    pushOpenPhaseDurationFailure(
      failures,
      'todoShelfConversationOpen',
      todoShelfConversationOpen,
      'content',
      maxConversationContentOpenPhaseMs,
    );
    pushOpenPhaseDurationFailure(
      failures,
      'todoShelfConversationOpen',
      todoShelfConversationOpen,
      'extension',
      maxConversationExtensionOpenPhaseMs,
    );
    if (repeatedConversationSwitch.result?.skipped) {
      failures.push(`repeatedConversationSwitch skipped: ${repeatedConversationSwitch.result.reason ?? 'unknown reason'}`);
    } else if (
      typeof repeatedConversationSwitch.result?.maxMs === 'number' &&
      repeatedConversationSwitch.result.maxMs > maxConversationSwitchMs
    ) {
      failures.push(`repeatedConversationSwitch maxMs ${repeatedConversationSwitch.result.maxMs} > ${maxConversationSwitchMs}`);
    } else {
      for (const iteration of repeatedConversationSwitch.result?.iterations ?? []) {
        if (typeof iteration.contentMs === 'number' && iteration.contentMs > maxConversationSwitchContentMs) {
          failures.push(
            `repeatedConversationSwitch ${iteration.label} contentMs ${iteration.contentMs} > ${maxConversationSwitchContentMs}`,
          );
        }
        if (typeof iteration.renderMs === 'number' && iteration.renderMs > maxConversationSwitchRenderMs) {
          failures.push(`repeatedConversationSwitch ${iteration.label} renderMs ${iteration.renderMs} > ${maxConversationSwitchRenderMs}`);
        }
      }
    }
    if (failures.length)
      throw new Error(
        `Desktop perf smoke failed:\n${failures.join('\n')}\nTop offenders: ${JSON.stringify(idleCpuPeakSample.offenders ?? [], null, 2)}`,
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
