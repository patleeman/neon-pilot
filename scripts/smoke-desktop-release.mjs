#!/usr/bin/env node
/* eslint-env node */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const args = process.argv.slice(2);
const preserveSmokeState = args.includes('--preserve-state');
const appArg = args.find((arg) => arg !== '--preserve-state');
const appPath = appArg ? resolve(appArg) : '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  if (!address || typeof address === 'string') {
    throw new Error('Could not allocate a loopback port.');
  }
  return address.port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function waitForPageTarget(port, child, logs, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`App exited during smoke test with code ${child.exitCode}.\n${logs()}`);
    }

    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) {
        return page;
      }
      lastError = 'CDP responded but no page target was available yet.';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for desktop app CDP page target: ${lastError}\n${logs()}`);
}

function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (!message.id || !pending.has(message.id)) {
      return;
    }

    const { resolve: resolvePending, reject } = pending.get(message.id);
    pending.delete(message.id);

    if (message.error) {
      reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      return;
    }

    resolvePending(message.result);
  });

  const opened = new Promise((resolveOpen, rejectOpen) => {
    ws.once('open', resolveOpen);
    ws.once('error', rejectOpen);
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId;
      nextId += 1;
      const promise = new Promise((resolveCommand, rejectCommand) => {
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
      });
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      ws.close();
    },
  };
}

async function waitForLoadedBody(cdp, child, logs, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = '';

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`App exited while waiting for ${label}.\n${logs()}`);
    }

    const result = await cdp.send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText : ""',
      returnByValue: true,
    });
    const body = String(result?.result?.value ?? '').trim();
    lastBody = body;

    if (
      body.length > 0 &&
      !/startup error|open logs\s+try again|could not load|was compiled against a different node\.js version/i.test(body)
    ) {
      return body;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label} to render. Last body text:\n${lastBody}\n\n${logs()}`);
}

async function navigateAndAssert(cdp, child, logs, url, label) {
  await cdp.send('Page.navigate', { url });
  await waitForLoadedBody(cdp, child, logs, label);
}

async function assertDesktopApiEndpoints(cdp, child, logs) {
  if (child.exitCode !== null) {
    throw new Error(`App exited before desktop API smoke checks.\n${logs()}`);
  }

  const endpoints = [
    '/api/extensions/installed',
    '/api/extensions/routes',
    '/api/extensions/surfaces',
    '/api/gateways',
    '/api/extensions/keybindings',
    '/api/extensions',
    '/api/extensions/slash-commands',
    '/api/extensions/mentions',
  ];
  const expression = `
    (async () => {
      const endpoints = ${JSON.stringify(endpoints)};
      return Promise.all(endpoints.map(async (path) => {
        try {
          const response = await fetch(path);
          const body = await response.text();
          return { path, status: response.status, ok: response.ok, body: body.slice(0, 500) };
        } catch (error) {
          return { path, status: 0, ok: false, body: error instanceof Error ? error.message : String(error) };
        }
      }));
    })()
  `;

  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  const checks = result?.result?.value;
  if (!Array.isArray(checks)) {
    throw new Error(`Desktop API smoke checks returned an unexpected result: ${JSON.stringify(result)}\n${logs()}`);
  }

  const failures = checks.filter((check) => !check?.ok);
  if (failures.length > 0) {
    throw new Error(
      [`Packaged desktop API smoke checks failed:`, ...failures.map((check) => `${check.path} -> ${check.status}: ${check.body}`), logs()]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

/**
 * Sample renderer process memory metrics via CDP and fail if the heap or DOM
 * node count is growing unboundedly during an idle window. Catches infinite
 * render loops and event-listener leaks before they ship.
 *
 * Strategy:
 *   1. Force a GC pass so we get a clean baseline.
 *   2. Record heap size + DOM node count.
 *   3. Wait idleMs with no user activity.
 *   4. Force GC again and re-sample.
 *   5. Fail if heap grew by more than maxHeapGrowthMb OR node count grew by
 *      more than maxDomNodeGrowth during the idle window.
 */
async function assertNoMemoryLeak(cdp, child, logs, { idleMs = 10_000, maxHeapGrowthMb = 30, maxDomNodeGrowth = 2_000 } = {}) {
  if (child.exitCode !== null) {
    throw new Error(`App exited before memory leak check.\n${logs()}`);
  }

  const collectGarbage = () =>
    cdp.send('HeapProfiler.collectGarbage').catch(() => {
      // HeapProfiler may not be available in all builds; best-effort.
    });

  const sample = async () => {
    const result = await cdp.send('Performance.getMetrics');
    const metrics = Object.fromEntries((result?.metrics ?? []).map(({ name, value }) => [name, value]));
    return {
      heapMb: (metrics.JSHeapUsedSize ?? 0) / 1024 / 1024,
      domNodes: metrics.Nodes ?? 0,
    };
  };

  await cdp.send('Performance.enable');

  // The packaged app can finish route hydration and daemon-backed bootstrap
  // shortly after the smoke navigation succeeds. Do not treat that legitimate
  // one-time DOM growth as an idle leak; first wait for the renderer to settle.
  let settled = false;
  let previous = await sample();
  const settleDeadline = Date.now() + 20_000;
  while (Date.now() < settleDeadline) {
    await sleep(1_000);
    await collectGarbage();
    const current = await sample();
    const heapDeltaMb = Math.abs(current.heapMb - previous.heapMb);
    const domDelta = Math.abs(current.domNodes - previous.domNodes);
    if (heapDeltaMb < 2 && domDelta < 200) {
      settled = true;
      break;
    }
    previous = current;
  }

  if (!settled) {
    throw new Error(`Renderer did not settle before memory leak check; last sample had ${previous.domNodes} DOM nodes.
${logs()}`);
  }

  await collectGarbage();
  const before = await sample();

  console.log(`  memory baseline — heap: ${before.heapMb.toFixed(1)} MB, DOM nodes: ${before.domNodes}`);
  await sleep(idleMs);

  await collectGarbage();
  const after = await sample();
  const heapGrowthMb = after.heapMb - before.heapMb;
  const domGrowth = after.domNodes - before.domNodes;

  console.log(
    `  memory after ${idleMs / 1000}s idle — heap: ${after.heapMb.toFixed(1)} MB (+${heapGrowthMb.toFixed(1)} MB), DOM nodes: ${after.domNodes} (+${domGrowth})`,
  );

  if (heapGrowthMb > maxHeapGrowthMb) {
    throw new Error(
      `Memory leak detected: JS heap grew ${heapGrowthMb.toFixed(1)} MB during a ${idleMs / 1000}s idle window (limit: ${maxHeapGrowthMb} MB).\n${logs()}`,
    );
  }
  if (domGrowth > maxDomNodeGrowth) {
    throw new Error(
      `Memory leak detected: DOM node count grew by ${domGrowth} during a ${idleMs / 1000}s idle window (limit: ${maxDomNodeGrowth}).\n${logs()}`,
    );
  }
}

function tail(value, max = 8_000) {
  return value.length > max ? value.slice(value.length - max) : value;
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertPackagedAgentReadableResources(appBundlePath) {
  const appResourcesDir = join(appBundlePath, 'Contents', 'Resources');
  const requiredResources = ['docs/README.md', 'extensions/system-settings/README.md', 'extensions/system-runs/skills/runs/SKILL.md'];
  const missing = requiredResources.filter((relativePath) => !existsSync(join(appResourcesDir, relativePath)));

  for (const extensionRootRelativePath of ['extensions']) {
    const extensionsRoot = join(appResourcesDir, extensionRootRelativePath);
    if (!existsSync(extensionsRoot)) continue;
    for (const entry of readdirSync(extensionsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(extensionsRoot, entry.name, 'extension.json');
      if (!existsSync(manifestPath)) continue;
      const manifest = readJsonFile(manifestPath);
      // Skip non-system extensions — only system-* extensions are built and bundled with the app.
      if (!entry.name.startsWith('system-')) continue;
      for (const builtEntry of [manifest.frontend?.entry, ...(manifest.frontend?.styles ?? []), manifest.backend?.entry]) {
        if (typeof builtEntry === 'string' && builtEntry.trim().length > 0 && !existsSync(join(extensionsRoot, entry.name, builtEntry))) {
          missing.push(`${extensionRootRelativePath}/${entry.name}/${builtEntry}`);
        }
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Packaged app is missing agent-readable resources:\n${missing.map((path) => `- ${path}`).join('\n')}`);
  }
}

async function main() {
  if (!appPath) {
    fail('Usage: node scripts/smoke-desktop-release.mjs <path-to-Neon Pilot.app>');
  }

  assertPackagedAgentReadableResources(appPath);

  const executablePath = join(appPath, 'Contents', 'MacOS', basename(appPath, '.app'));
  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-release-smoke-'));
  const stateRoot = join(tempRoot, 'state');
  const daemonSocketPath = join(tempRoot, 'daemon.sock');
  const debugPort = await allocatePort();
  const companionPort = await allocatePort();
  const stdoutChunks = [];
  const stderrChunks = [];
  const renderLogs = () =>
    [
      stdoutChunks.length ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
      stderrChunks.length ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const child = spawn(executablePath, [`--remote-debugging-port=${debugPort}`, '--no-quit-confirmation'], {
    env: {
      ...process.env,
      NEON_PILOT_RUNTIME_CHANNEL: 'test',
      NEON_PILOT_STATE_ROOT: stateRoot,
      NEON_PILOT_DESKTOP_USER_DATA_DIR: join(tempRoot, 'user-data'),
      NEON_PILOT_DAEMON_SOCKET_PATH: daemonSocketPath,
      NEON_PILOT_COMPANION_PORT: String(companionPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => stdoutChunks.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)));

  let cdp;
  try {
    const page = await waitForPageTarget(debugPort, child, renderLogs);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await waitForLoadedBody(cdp, child, renderLogs, 'initial desktop route');
    await assertDesktopApiEndpoints(cdp, child, renderLogs);
    await navigateAndAssert(cdp, child, renderLogs, 'neon-pilot://app/knowledge', 'Knowledge route');
    await assertDesktopApiEndpoints(cdp, child, renderLogs);
    await navigateAndAssert(cdp, child, renderLogs, 'neon-pilot://app/', 'conversation route');
    await assertDesktopApiEndpoints(cdp, child, renderLogs);

    // Navigate back to the main conversation route and let the app sit idle
    // while we watch for memory growth. Catches infinite render loops and
    // event-listener leaks that manifest as unbounded heap expansion.
    await navigateAndAssert(cdp, child, renderLogs, 'neon-pilot://app/', 'conversation route (pre-memory check)');
    await assertNoMemoryLeak(cdp, child, renderLogs);

    console.log(`Release desktop smoke test passed with isolated state root: ${stateRoot}`);
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(1_000);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }

    if (!preserveSmokeState) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
});
