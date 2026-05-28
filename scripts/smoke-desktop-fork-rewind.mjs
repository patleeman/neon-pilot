#!/usr/bin/env node
/* eslint-env node */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const keep = process.argv.includes('--keep');
const desktopMainFile = join(repo, 'packages', 'desktop', 'dist', 'main.js');
const root = mkdtempSync(join(tmpdir(), 'neon-pilot-fork-rewind-smoke-'));
const stateRoot = join(root, 'state');
const sourceSessionId = 'fork-rewind-source';
const sourceWorkspace = 'fork-rewind-workspace';
const sourceSessionFile = join(stateRoot, 'sync', 'pi-agent', 'sessions', sourceWorkspace, `${sourceSessionId}.jsonl`);
const sourceCwd = '/tmp/neon-fixture/fork-rewind-workspace';
const sourceTitle = 'Fork Rewind E2E Source';
const promptOne = 'E2E user prompt one: put this back in composer on user branch';
const answerOne = 'E2E assistant answer one: fork through this assistant message';
const promptTwo = 'E2E user prompt two: rewind from assistant should restore this';
const answerTwo = 'E2E assistant answer two: this must be absent after assistant rewind';
const sourceMessagePreviewByText = new Map([
  [promptOne, 'E2E user prompt one'],
  [answerOne, 'E2E assistant answer one'],
  [promptTwo, 'E2E user prompt two'],
  [answerTwo, 'E2E assistant answer two'],
]);

if (!app) {
  console.error('Usage: node scripts/smoke-desktop-fork-rewind.mjs --app="/path/to/Neon Pilot Testing.app" [--keep]');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

function childExited(child) {
  return child.exitCode !== null && child.exitCode !== undefined;
}

function readDebuggingPort(fallbackPort) {
  const devToolsPortFile = join(root, 'user-data', 'DevToolsActivePort');
  try {
    const [portLine] = readFileSync(devToolsPortFile, 'utf8').split('\n');
    const port = Number(portLine);
    return Number.isFinite(port) && port > 0 ? port : fallbackPort;
  } catch {
    return fallbackPort;
  }
}

function connectCdp(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    message.error ? request.reject(new Error(`${request.method}: ${message.error.message}`)) : request.resolve(message.result);
  });
  const opened = new Promise((resolveOpen, reject) => {
    ws.once('open', resolveOpen);
    ws.once('error', reject);
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolveSend, reject) => pending.set(id, { resolve: resolveSend, reject, method }));
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      ws.close();
    },
  };
}

async function evalJs(cdp, expression) {
  let result;
  try {
    result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nExpression: ${expression.slice(0, 1000)}`);
  }
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result?.result?.value;
}

async function waitForPage(port, child, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastPort = port;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    lastPort = readDebuggingPort(port);
    try {
      const targets = await fetchJson(`http://127.0.0.1:${lastPort}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // CDP endpoint may still be starting.
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for CDP page on ${lastPort}`);
}

async function waitForExpression(cdp, child, expression, timeoutMs = 30_000, pollMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited(child)) throw new Error(`app exited ${child.exitCode}`);
    if (await evalJs(cdp, expression)) return;
    await sleep(pollMs);
  }
  const diagnostics = await evalJs(
    cdp,
    `(() => ({ pathname: location.pathname, bodyText: (document.body?.innerText || '').slice(0, 1800), textareas: Array.from(document.querySelectorAll('textarea')).map((t) => t.value) }))()`,
  ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
  throw new Error(`timed out waiting for expression: ${expression}\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
}

async function navigateSpa(cdp, path) {
  await evalJs(cdp, `window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: ${JSON.stringify(path)} } }))`);
}

async function openConversation(cdp, child, conversationId, expectedText) {
  const path = `/conversations/${conversationId}`;
  await navigateSpa(cdp, path);
  await waitForExpression(
    cdp,
    child,
    `location.pathname === ${JSON.stringify(path)} && !document.querySelector('#app-loader') && (document.body.textContent || '').includes(${JSON.stringify(expectedText)})`,
    45_000,
  );
}

function seedSourceSession() {
  mkdirSync(join(stateRoot, 'neon-pilot-runtime'), { recursive: true });
  writeFileSync(join(stateRoot, 'neon-pilot-runtime', 'auth.json'), '{}\n');
  writeFileSync(
    join(stateRoot, 'neon-pilot-runtime', 'settings.json'),
    `${JSON.stringify({ conversationAutoTitle: { reasoning: false } }, null, 2)}\n`,
  );
  mkdirSync(join(stateRoot, 'sync', 'pi-agent', 'sessions', sourceWorkspace), { recursive: true });
  const now = Date.now();
  const lines = [
    { type: 'session', id: sourceSessionId, timestamp: new Date(now).toISOString(), cwd: sourceCwd, version: 3 },
    { type: 'model_change', id: 'entry-model-change', parentId: null, modelId: 'openrouter/test-fork-rewind-model' },
    { type: 'session_info', id: 'entry-session-info', parentId: 'entry-model-change', name: sourceTitle },
    {
      type: 'message',
      id: 'entry-user-1',
      parentId: 'entry-session-info',
      timestamp: new Date(now + 1_000).toISOString(),
      message: { role: 'user', content: promptOne },
    },
    {
      type: 'message',
      id: 'entry-assistant-1',
      parentId: 'entry-user-1',
      timestamp: new Date(now + 2_000).toISOString(),
      message: { role: 'assistant', content: answerOne },
    },
    {
      type: 'message',
      id: 'entry-user-2',
      parentId: 'entry-assistant-1',
      timestamp: new Date(now + 3_000).toISOString(),
      message: { role: 'user', content: promptTwo },
    },
    {
      type: 'message',
      id: 'entry-assistant-2',
      parentId: 'entry-user-2',
      timestamp: new Date(now + 4_000).toISOString(),
      message: { role: 'assistant', content: answerTwo },
    },
  ];
  writeFileSync(sourceSessionFile, `${lines.map(JSON.stringify).join('\n')}\n`);
}

async function resumeSource(cdp) {
  const result = await evalJs(
    cdp,
    `(async () => {
      const response = await fetch('/api/live-sessions/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionFile: ${JSON.stringify(sourceSessionFile)}, cwd: ${JSON.stringify(sourceCwd)} })
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, id: body?.id || null, error: body?.error || null };
    })()`,
  );
  if (!result.ok || !result.id) {
    throw new Error(`resume source failed: ${JSON.stringify(result)}`);
  }
  return result.id;
}

async function clickMessageAction(cdp, child, text, action) {
  const clicked = await evalJs(
    cdp,
    `(() => {
      const needle = ${JSON.stringify(text)};
      const actionText = ${JSON.stringify(action)};
      const blocks = Array.from(document.querySelectorAll('[data-transcript-block-id]'));
      const block = blocks.find((candidate) => (candidate.textContent || '').includes(needle));
      if (!block) return { ok: false, reason: 'block not found', blocks: blocks.map((b) => (b.textContent || '').slice(0, 140)) };
      block.scrollIntoView({ block: 'center', inline: 'nearest' });
      const button = Array.from(block.querySelectorAll('button')).find((candidate) => (candidate.textContent || '').toLowerCase().includes(actionText));
      if (!button) return { ok: false, reason: 'button not found', blockText: block.textContent || '' };
      button.click();
      return { ok: true };
    })()`,
  );
  if (!clicked.ok) throw new Error(`could not click ${action}: ${JSON.stringify(clicked)}`);
  await waitForExpression(
    cdp,
    child,
    `location.pathname.startsWith('/conversations/') && !location.pathname.endsWith(${JSON.stringify(sourceSessionId)})`,
    30_000,
  );
  return evalJs(cdp, `location.pathname.split('/').filter(Boolean).at(-1)`);
}

async function readUiState(cdp) {
  return evalJs(
    cdp,
    `(() => ({
      pathname: location.pathname,
      conversationId: location.pathname.split('/').filter(Boolean).at(-1) || null,
      bodyText: document.body.innerText || '',
      composerValue: document.querySelector('textarea[placeholder*="Message"]')?.value ?? '',
      sidebarRows: (() => {
        let currentGroupKey = null;
        const rows = [];
        for (const row of Array.from(document.querySelectorAll('[data-sidebar-group-key], [data-sidebar-session-id]'))) {
          const groupKey = row.getAttribute('data-sidebar-group-key');
          if (groupKey !== null) {
            currentGroupKey = groupKey;
          }
          const sessionId = row.getAttribute('data-sidebar-session-id');
          if (sessionId) {
            rows.push({
              id: sessionId,
              groupKey: row.getAttribute('data-sidebar-group-key') || currentGroupKey,
              text: row.textContent || '',
              active: row.querySelector('a')?.classList.contains('ui-sidebar-session-row-active') ?? false,
            });
          }
        }
        return rows;
      })(),
      topologyLabels: Array.from(document.querySelectorAll('[data-topology-kind]')).map((row) => row.textContent || ''),
      transcriptBlocks: Array.from(document.querySelectorAll('[data-transcript-block-id]')).map((row) => ({
        id: row.getAttribute('data-transcript-block-id'),
        text: row.textContent || '',
      })),
    }))()`,
  );
}

async function readSessionMeta(cdp, sessionId) {
  const result = await evalJs(
    cdp,
    `(async () => {
      const response = await fetch('/api/sessions/${encodeURIComponent(sessionId)}/meta');
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    })()`,
  );
  if (!result.ok) {
    throw new Error(`session meta failed for ${sessionId}: ${JSON.stringify(result)}`);
  }
  return result.body;
}

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function assertJsonlTopology({ childMeta, sourceId, kind, sourceMessageText }) {
  assertState(childMeta.cwd === sourceCwd, `child cwd mismatch for ${childMeta.id}`, childMeta);
  assertState(childMeta.workspaceCwd === sourceCwd, `child workspaceCwd mismatch for ${childMeta.id}`, childMeta);
  assertState(childMeta.parentSessionId === sourceId, `child parentSessionId mismatch for ${childMeta.id}`, childMeta);
  assertState(childMeta.offshootKind === kind, `child offshoot kind mismatch for ${childMeta.id}`, childMeta);

  const childLines = readJsonl(childMeta.file);
  const offshoot = childLines.find((line) => line.customType === 'conversation_offshoot_metadata');
  assertState(offshoot?.data?.kind === kind, `child offshoot metadata missing ${kind}`, { childMeta, childLines: childLines.slice(-8) });
  assertState(offshoot?.data?.parentSessionId === sourceId, 'child offshoot metadata parent mismatch', offshoot);
  assertState(
    typeof offshoot?.data?.parentMessageId === 'string' && offshoot.data.parentMessageId.length > 0,
    'child offshoot metadata missing parentMessageId',
    offshoot,
  );

  const expectedBacklink = kind === 'rewind' ? 'Rewind conversation from parent' : 'Fork conversation from parent';
  const backlink = childLines.find((line) => line.customType === 'parent_conversation_backlink');
  assertState(backlink?.content?.includes(expectedBacklink), `child backlink missing ${expectedBacklink}`, {
    childMeta,
    childLines: childLines.slice(-8),
  });
  assertState(backlink?.content?.includes(sourceId), 'child backlink missing parent conversation id', backlink);

  const sourceLines = readJsonl(sourceSessionFile);
  const expectedTopology = kind === 'rewind' ? 'Rewind conversation created' : 'Fork conversation created';
  const preview = sourceMessagePreviewByText.get(sourceMessageText) ?? sourceMessageText.slice(0, 18);
  const topology = sourceLines.find(
    (line) =>
      line.customType === 'child_conversation_topology' &&
      typeof line.content === 'string' &&
      line.content.includes(expectedTopology) &&
      line.content.includes(childMeta.id),
  );
  assertState(topology, `source topology missing ${expectedTopology} for ${childMeta.id}`, { sourceLines: sourceLines.slice(-12) });
  assertState(topology.content.includes(`Source message: ${offshoot.data.parentMessageId}`), 'source topology source message mismatch', {
    topology,
    offshoot,
  });
  assertState(topology.content.includes(preview), 'source topology missing source preview', { topology, preview });
}

function assertState(condition, message, details) {
  if (!condition) {
    throw new Error(`${message}\n${JSON.stringify(details, null, 2).slice(0, 6000)}`);
  }
}

async function expectChild(cdp, child, { id, sourceId, kind, composer, includes = [], excludes = [], sourceMessageText }) {
  await waitForExpression(
    cdp,
    child,
    `location.pathname.endsWith('/${id}') && Boolean(document.querySelector('textarea[placeholder*="Message"]'))`,
    45_000,
  );
  const state = await readUiState(cdp);
  assertState(state.composerValue === composer, `${kind} child composer mismatch`, state);
  for (const text of includes) {
    assertState(state.bodyText.includes(text), `${kind} child missing expected text: ${text}`, state);
  }
  for (const text of excludes) {
    assertState(
      !state.transcriptBlocks.some((block) => block.text.includes(text)),
      `${kind} child transcript unexpectedly included: ${text}`,
      state,
    );
  }
  const expectedFrom = kind === 'rewind' ? 'Rewound from' : 'Forked from';
  assertState(
    state.topologyLabels.some((label) => label.includes(expectedFrom) && label.includes(sourceTitle)),
    `${kind} child missing ${expectedFrom} marker`,
    state,
  );
  const childRow = state.sidebarRows.find((row) => row.id === id);
  assertState(childRow && !/\\b(fork|rewind):/i.test(childRow.text), `${kind} child sidebar row leaked branch prefix`, state);
  assertState(childRow?.groupKey?.includes(sourceWorkspace), `${kind} child sidebar row is not grouped with source cwd`, state);
  assertJsonlTopology({ childMeta: await readSessionMeta(cdp, id), sourceId, kind, sourceMessageText });
}

async function expectParentMarker(cdp, child, sourceId, kind, childId) {
  await openConversation(cdp, child, sourceId, sourceTitle);
  const expectedTo = kind === 'rewind' ? 'Rewound to' : 'Forked to';
  await waitForExpression(
    cdp,
    child,
    `Array.from(document.querySelectorAll('[data-topology-kind]')).some((row) => (row.textContent || '').includes(${JSON.stringify(expectedTo)}))`,
    30_000,
  );
  const state = await readUiState(cdp);
  assertState(
    state.topologyLabels.some((label) => label.includes(expectedTo) && label.includes(childId)),
    `parent missing ${expectedTo} marker for ${childId}`,
    state,
  );
}

async function runCase(cdp, child, sourceId, { label, messageText, action, kind, composer, includes, excludes, sourceMessageText }) {
  await openConversation(cdp, child, sourceId, messageText);
  const childId = await clickMessageAction(cdp, child, messageText, action);
  await expectChild(cdp, child, {
    id: childId,
    sourceId,
    kind,
    composer,
    includes,
    excludes,
    sourceMessageText: sourceMessageText ?? messageText,
  });
  await expectParentMarker(cdp, child, sourceId, kind, childId);
  return { label, childId };
}

async function main() {
  seedSourceSession();
  const port = await allocatePort();
  const env = {
    ...process.env,
    NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
    NEON_PILOT_REPO_ROOT: repo,
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_CONFIG_ROOT: join(stateRoot, 'config'),
    NEON_PILOT_DESKTOP_USER_DATA_DIR: join(root, 'user-data'),
    NEON_PILOT_DAEMON_SOCKET_PATH: join(root, 'daemon.sock'),
    NEON_PILOT_COMPANION_PORT: '0',
  };
  const child = spawn(
    join(app, 'Contents', 'MacOS', basename(app, '.app')),
    [`--remote-debugging-port=${port}`, desktopMainFile, '--no-quit-confirmation'],
    {
      cwd: repo,
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
    await waitForExpression(cdp, child, `!document.querySelector('#app-loader') && Boolean(document.querySelector('textarea'))`, 45_000);
    const sourceId = await resumeSource(cdp);
    await openConversation(cdp, child, sourceId, promptOne);

    const results = [];
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'fork root user',
        messageText: promptOne,
        action: 'fork',
        kind: 'fork',
        composer: promptOne,
        includes: [sourceTitle],
        excludes: [promptOne, answerOne, promptTwo, answerTwo],
      }),
    );
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'rewind root user',
        messageText: promptOne,
        action: 'rewind',
        kind: 'rewind',
        composer: promptOne,
        includes: [sourceTitle],
        excludes: [promptOne, answerOne, promptTwo, answerTwo],
      }),
    );
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'fork user',
        messageText: promptTwo,
        action: 'fork',
        kind: 'fork',
        composer: promptTwo,
        includes: [promptOne, answerOne, sourceTitle],
        excludes: [promptTwo, answerTwo],
        sourceMessageText: promptTwo,
      }),
    );
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'fork assistant',
        messageText: answerOne,
        action: 'fork',
        kind: 'fork',
        composer: '',
        includes: [promptOne, answerOne, sourceTitle],
        excludes: [promptTwo, answerTwo],
      }),
    );
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'rewind user',
        messageText: promptTwo,
        action: 'rewind',
        kind: 'rewind',
        composer: promptTwo,
        includes: [promptOne, answerOne, sourceTitle],
        excludes: [promptTwo, answerTwo],
        sourceMessageText: promptTwo,
      }),
    );
    results.push(
      await runCase(cdp, child, sourceId, {
        label: 'rewind assistant',
        messageText: answerTwo,
        action: 'rewind',
        kind: 'rewind',
        composer: promptTwo,
        includes: [promptOne, answerOne, sourceTitle],
        excludes: [promptTwo, answerTwo],
        sourceMessageText: promptTwo,
      }),
    );

    console.log(JSON.stringify({ ok: true, sourceId, childIds: results, stateRoot }, null, 2));
  } finally {
    cdp?.close();
    if (!childExited(child)) {
      child.kill('SIGTERM');
      await sleep(500);
    }
    if (!childExited(child)) child.kill('SIGKILL');
    if (!keep) rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  if (keep) console.error(`State root kept at ${stateRoot}`);
  process.exit(1);
});
