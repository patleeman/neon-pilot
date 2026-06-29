#!/usr/bin/env node
/* eslint-env node */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultMatrixPath = join(repoRoot, 'scripts', 'release-extension-golden-matrix.json');
const startupErrorPattern =
  /startup error|open logs\s+try again|could not load|was compiled against a different node\.js version|safe mode/i;

export function parseArgs(argv) {
  const args = [...argv];
  const options = {
    appPath: '',
    matrixPath: defaultMatrixPath,
    preserveState: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    } else if (arg === '--preserve-state') {
      options.preserveState = true;
    } else if (arg === '--matrix') {
      options.matrixPath = resolve(args[++index] ?? '');
    } else if (arg.startsWith('--matrix=')) {
      options.matrixPath = resolve(arg.slice('--matrix='.length));
    } else if (arg === '--app') {
      options.appPath = resolve(args[++index] ?? '');
    } else if (arg.startsWith('--app=')) {
      options.appPath = resolve(arg.slice('--app='.length));
    } else if (!arg.startsWith('--') && !options.appPath) {
      options.appPath = resolve(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function loadMatrix(matrixPath = defaultMatrixPath) {
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
  validateMatrix(matrix, matrixPath);
  return matrix;
}

export function validateMatrix(matrix, label = 'release extension golden matrix') {
  if (!matrix || typeof matrix !== 'object') throw new Error(`${label} must be an object.`);
  if (matrix.schemaVersion !== 1) throw new Error(`${label} schemaVersion must be 1.`);
  for (const field of ['requiredExtensions', 'appRoutes', 'routes', 'actions', 'installablePackages', 'catalogInstalls']) {
    if (!Array.isArray(matrix[field])) throw new Error(`${label} ${field} must be an array.`);
  }
  if (!matrix.registryMinimums || typeof matrix.registryMinimums !== 'object' || Array.isArray(matrix.registryMinimums)) {
    throw new Error(`${label} registryMinimums must be an object.`);
  }
  if (!matrix.agentTools || typeof matrix.agentTools !== 'object' || Array.isArray(matrix.agentTools)) {
    throw new Error(`${label} agentTools must be an object.`);
  }
  if (!Array.isArray(matrix.agentTools.expectedNames)) throw new Error(`${label} agentTools.expectedNames must be an array.`);
  if (!Array.isArray(matrix.agentTools.invocations)) throw new Error(`${label} agentTools.invocations must be an array.`);
  if (!Array.isArray(matrix.agentTools.contextInvocations)) throw new Error(`${label} agentTools.contextInvocations must be an array.`);
  for (const route of matrix.appRoutes) {
    if (typeof route.path !== 'string' || !route.path.startsWith('/')) throw new Error(`${label} app route path must start with /.`);
    if (route.text !== undefined && !Array.isArray(route.text)) throw new Error(`${label} app route text must be an array.`);
    if (route.selectors !== undefined && !Array.isArray(route.selectors)) throw new Error(`${label} app route selectors must be an array.`);
  }
  for (const extensionId of matrix.requiredExtensions) {
    if (typeof extensionId !== 'string' || !extensionId.trim()) throw new Error(`${label} requiredExtensions must contain ids.`);
  }
  for (const route of matrix.routes) {
    if (typeof route.extensionId !== 'string' || !route.extensionId) throw new Error(`${label} route extensionId is required.`);
    if (typeof route.path !== 'string' || !route.path.startsWith('/')) throw new Error(`${label} route path must start with /.`);
    if (route.text !== undefined && !Array.isArray(route.text)) throw new Error(`${label} route text must be an array.`);
    if (route.selectors !== undefined && !Array.isArray(route.selectors)) throw new Error(`${label} route selectors must be an array.`);
  }
  for (const action of matrix.actions) {
    if (typeof action.extensionId !== 'string' || !action.extensionId) throw new Error(`${label} action extensionId is required.`);
    if (typeof action.actionId !== 'string' || !action.actionId) throw new Error(`${label} action actionId is required.`);
    if (!Array.isArray(action.text)) throw new Error(`${label} action text must be an array.`);
  }
  for (const toolName of matrix.agentTools.expectedNames) {
    if (typeof toolName !== 'string' || !toolName) throw new Error(`${label} agentTools.expectedNames must contain tool names.`);
  }
  for (const invocation of matrix.agentTools.invocations) {
    if (typeof invocation.name !== 'string' || !invocation.name) throw new Error(`${label} agent tool invocation name is required.`);
    if (typeof invocation.extensionId !== 'string' || !invocation.extensionId)
      throw new Error(`${label} agent tool invocation extensionId is required.`);
    if (typeof invocation.actionId !== 'string' || !invocation.actionId)
      throw new Error(`${label} agent tool invocation actionId is required.`);
    if (!Array.isArray(invocation.text)) throw new Error(`${label} agent tool invocation text must be an array.`);
  }
  for (const invocation of matrix.agentTools.contextInvocations) {
    if (typeof invocation.name !== 'string' || !invocation.name)
      throw new Error(`${label} context agent tool invocation name is required.`);
    if (!Array.isArray(invocation.text)) throw new Error(`${label} context agent tool invocation text must be an array.`);
  }
  for (const entry of matrix.installablePackages) {
    if (typeof entry.zipPath !== 'string' || !entry.zipPath) throw new Error(`${label} installable package zipPath is required.`);
    if (typeof entry.extensionId !== 'string' || !entry.extensionId)
      throw new Error(`${label} installable package extensionId is required.`);
  }
  for (const entry of matrix.catalogInstalls) {
    if (typeof entry.extensionId !== 'string' || !entry.extensionId) throw new Error(`${label} catalog install extensionId is required.`);
  }
}

export function evaluateTextExpectations(value, expectedText) {
  const haystack = typeof value === 'string' ? value : JSON.stringify(value);
  return expectedText.filter((needle) => typeof needle === 'string' && needle.length > 0 && !haystack.includes(needle));
}

function contributionCount(extensions, key) {
  return extensions.reduce((total, extension) => {
    const contributes = extension?.manifest?.contributes;
    if (!contributes || typeof contributes !== 'object') return total;
    if (key === 'settings') {
      return total + (Array.isArray(contributes.settings) ? contributes.settings.length : 0) + (contributes.settingsComponent ? 1 : 0);
    }
    const value = contributes[key];
    return total + (Array.isArray(value) ? value.length : value ? 1 : 0);
  }, 0);
}

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
  if (!address || typeof address === 'string') throw new Error('Could not allocate a loopback port.');
  return address.port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForPageTarget(port, child, logs, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited during extension golden smoke with code ${child.exitCode}.\n${logs()}`);
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
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
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolvePending, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
    else resolvePending(message.result);
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

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails));
  return result?.result?.value;
}

async function waitForExpression(cdp, child, expression, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('App exited while waiting for renderer expression.');
    lastValue = await evalJs(cdp, expression);
    if (lastValue) return lastValue;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for expression: ${expression}. Last value: ${JSON.stringify(lastValue)}`);
}

async function fetchFromRenderer(cdp, path, options = {}) {
  return evalJs(
    cdp,
    `(async () => {
      const response = await fetch(${JSON.stringify(path)}, ${JSON.stringify(options)});
      const text = await response.text();
      let body = text;
      try { body = JSON.parse(text); } catch {}
      return { ok: response.ok, status: response.status, body };
    })()`,
  );
}

async function postJson(cdp, path, body) {
  const result = await fetchFromRenderer(cdp, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!result.ok) throw new Error(`${path} returned ${result.status}: ${JSON.stringify(result.body)}`);
  if (result.body && typeof result.body === 'object' && result.body.ok === false) {
    throw new Error(`${path} returned failure: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function waitForLoadedBody(cdp, child, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited while waiting for ${label}.`);
    const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
    lastBody = body;
    if (body.length > 0 && !startupErrorPattern.test(body) && !/Loading extension/i.test(body)) return body;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} to render. Last body text:\n${lastBody}`);
}

async function waitForBodyText(cdp, child, label, expectedText, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = '';
  let lastMissing = expectedText;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited while waiting for ${label}.`);
    const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
    lastBody = body;
    lastMissing = evaluateTextExpectations(body, expectedText);
    if (lastMissing.length === 0) return body;
    await sleep(500);
  }
  throw new Error(`${label} did not render expected text: ${lastMissing.join(', ')}. Last body text tail:\n${lastBody.slice(-1200)}`);
}

async function assertRequiredExtensions(cdp, matrix) {
  const registry = await fetchFromRenderer(cdp, '/api/extensions/registry');
  if (!registry.ok) throw new Error(`/api/extensions/registry returned ${registry.status}: ${JSON.stringify(registry.body)}`);
  const registryBody = registry.body && typeof registry.body === 'object' ? registry.body : {};
  const extensions = Array.isArray(registryBody.extensions) ? registryBody.extensions : [];
  const routes = Array.isArray(registryBody.routes) ? registryBody.routes : [];
  const byId = new Map(extensions.map((extension) => [extension.id, extension]));
  const failures = [];

  for (const extensionId of matrix.requiredExtensions) {
    const extension = byId.get(extensionId);
    if (!extension) failures.push(`${extensionId} is missing from the installed extension registry`);
    else if (extension.status && extension.status !== 'enabled') failures.push(`${extensionId} is ${extension.status}, expected enabled`);
  }

  for (const route of matrix.routes) {
    if (!routes.some((candidate) => candidate.extensionId === route.extensionId && candidate.route === route.path)) {
      failures.push(`${route.extensionId} route ${route.path} is missing from /api/extensions/registry`);
    }
  }

  for (const [key, minimum] of Object.entries(matrix.registryMinimums)) {
    if (!Number.isInteger(minimum) || minimum < 0) {
      failures.push(`registryMinimums.${key} must be a non-negative integer`);
      continue;
    }
    const actual = Array.isArray(registryBody[key]) ? registryBody[key].length : contributionCount(extensions, key);
    if (actual < minimum) failures.push(`registry ${key} has ${actual} entries, expected at least ${minimum}`);
  }

  if (failures.length > 0)
    throw new Error(`Extension registry golden checks failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
}

async function assertRouteExpectations(cdp, label, route, body) {
  const missingText = evaluateTextExpectations(body, route.text ?? []);
  if (missingText.length > 0)
    throw new Error(`${label} did not render expected text: ${missingText.join(', ')}. Body text tail:\n${String(body).slice(-1200)}`);
  for (const selector of route.selectors ?? []) {
    if (typeof selector !== 'string' || !selector) throw new Error(`${label} has an invalid selector expectation.`);
    const found = await evalJs(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (!found) throw new Error(`${label} did not render expected selector: ${selector}`);
  }
}

async function installMatrixPackages(cdp, matrix) {
  for (const entry of matrix.installablePackages) {
    const zipPath = resolve(repoRoot, entry.zipPath);
    if (!existsSync(zipPath)) throw new Error(`Golden extension package is missing: ${zipPath}`);
    await postJson(cdp, '/api/extensions/import', { zipPath });
    if (entry.enable !== false)
      await fetchFromRenderer(cdp, `/api/extensions/${encodeURIComponent(entry.extensionId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
  }

  for (const entry of matrix.catalogInstalls) {
    await postJson(cdp, '/api/extensions/system-extension-manager/actions/installCatalogExtension', { id: entry.extensionId });
    if (entry.enable !== false)
      await fetchFromRenderer(cdp, `/api/extensions/${encodeURIComponent(entry.extensionId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
  }

  if (matrix.installablePackages.length > 0 || matrix.catalogInstalls.length > 0) {
    await postJson(cdp, '/api/extensions/reload', {});
  }
}

async function assertRoutes(cdp, child, matrix) {
  for (const route of matrix.appRoutes) {
    await cdp.send('Page.navigate', { url: `neon-pilot://app${route.path}` });
    const body = route.text?.length
      ? await waitForBodyText(cdp, child, route.path, route.text)
      : await waitForLoadedBody(cdp, child, route.path);
    await assertRouteExpectations(cdp, route.path, route, body);
    console.log(`  app route ok: ${route.path}`);
  }

  for (const route of matrix.routes) {
    await cdp.send('Page.navigate', { url: `neon-pilot://app${route.path}` });
    const body = route.text?.length
      ? await waitForBodyText(cdp, child, `${route.extensionId} ${route.path}`, route.text)
      : await waitForLoadedBody(cdp, child, `${route.extensionId} ${route.path}`);
    await assertRouteExpectations(cdp, `${route.extensionId} ${route.path}`, route, body);
    console.log(`  route ok: ${route.extensionId} ${route.path}`);
  }
}

async function assertActions(cdp, matrix) {
  for (const action of matrix.actions) {
    const body = await postJson(
      cdp,
      `/api/extensions/${encodeURIComponent(action.extensionId)}/actions/${encodeURIComponent(action.actionId)}`,
      action.input ?? {},
    );
    const missing = evaluateTextExpectations(body, action.text);
    if (missing.length > 0) throw new Error(`${action.extensionId}.${action.actionId} missing expected text: ${missing.join(', ')}`);
    console.log(`  action ok: ${action.extensionId}.${action.actionId}`);
  }
}

async function suppressOnboardingTour(cdp, child) {
  try {
    await postJson(cdp, '/api/extensions/system-onboarding/actions/update', { status: 'skipped', stepIndex: 0 });
  } catch (error) {
    throw new Error(`Could not seed skipped onboarding state for release smoke: ${error instanceof Error ? error.message : String(error)}`);
  }

  await evalJs(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const skipButton = buttons.find((button) => button.textContent?.trim().toLowerCase() === 'skip tour');
      skipButton?.click();
      return Boolean(skipButton);
    })()`,
  );
  await cdp.send('Page.navigate', { url: 'neon-pilot://app/conversations/new' });
  await waitForLoadedBody(cdp, child, 'post-onboarding release smoke route');
}

async function assertAgentTools(cdp, child, matrix) {
  const inventory = await fetchFromRenderer(cdp, '/api/tools');
  if (!inventory.ok) throw new Error(`/api/tools returned ${inventory.status}: ${JSON.stringify(inventory.body)}`);
  const missing = evaluateTextExpectations(inventory.body, matrix.agentTools.expectedNames);
  if (missing.length > 0) throw new Error(`/api/tools did not include expected agent tools: ${missing.join(', ')}`);
  console.log(`  agent tool inventory ok: ${matrix.agentTools.expectedNames.length} expected tools`);

  for (const invocation of matrix.agentTools.invocations) {
    const body = await postJson(
      cdp,
      `/api/extensions/${encodeURIComponent(invocation.extensionId)}/actions/${encodeURIComponent(invocation.actionId)}`,
      invocation.input ?? {},
    );
    const missingText = evaluateTextExpectations(body, invocation.text);
    if (missingText.length > 0) throw new Error(`${invocation.name} tool smoke missing expected text: ${missingText.join(', ')}`);
    console.log(`  agent tool ok: ${invocation.name}`);
  }

  if (matrix.agentTools.contextInvocations.length > 0) {
    const created = await postJson(cdp, '/api/live-sessions', { cwd: repoRoot });
    const conversationId = typeof created?.id === 'string' ? created.id : '';
    if (!conversationId) throw new Error(`Could not create live conversation for context tool smoke: ${JSON.stringify(created)}`);

    for (const invocation of matrix.agentTools.contextInvocations) {
      const body = await postJson(cdp, '/api/tools/invoke', {
        name: invocation.name,
        input: invocation.input ?? {},
        toolContext: {
          conversationId,
          sessionId: conversationId,
          cwd: repoRoot,
        },
      });
      const missingText = evaluateTextExpectations(body, invocation.text);
      if (missingText.length > 0) throw new Error(`${invocation.name} context tool smoke missing expected text: ${missingText.join(', ')}`);
      console.log(`  context agent tool ok: ${invocation.name}`);
    }

    await cdp.send('Page.navigate', { url: `neon-pilot://app/conversations/${encodeURIComponent(conversationId)}` });
    await waitForBodyText(cdp, child, `context tool conversation ${conversationId}`, ['Release smoke context todo']);
    console.log(`  context agent tool conversation ok: ${conversationId}`);
  }
}

function tail(value, max = 8_000) {
  return value.length > max ? value.slice(value.length - max) : value;
}

export async function runGoldenSmoke({ appPath, matrixPath = defaultMatrixPath, preserveState = false }) {
  if (!appPath) throw new Error('Usage: node scripts/release-extension-golden-smoke.mjs --app="/path/to/Neon Pilot.app"');
  const matrix = loadMatrix(matrixPath);
  const executablePath = join(appPath, 'Contents', 'MacOS', basename(appPath, '.app'));
  if (!existsSync(executablePath)) throw new Error(`Packaged app executable not found: ${executablePath}`);

  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-golden-'));
  const stateRoot = join(tempRoot, 'state');
  const configRoot = join(tempRoot, 'config');
  const knowledgeRoot = join(tempRoot, 'knowledge');
  const homeRoot = join(tempRoot, 'home');
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
      ELECTRON_RUN_AS_NODE: undefined,
      HOME: homeRoot,
      XDG_CACHE_HOME: join(tempRoot, 'xdg-cache'),
      XDG_CONFIG_HOME: join(tempRoot, 'xdg-config'),
      XDG_DATA_HOME: join(tempRoot, 'xdg-data'),
      XDG_STATE_HOME: join(tempRoot, 'xdg-state'),
      NEON_PILOT_RUNTIME_CHANNEL: 'test',
      NEON_PILOT_STATE_ROOT: stateRoot,
      NEON_PILOT_CONFIG_ROOT: configRoot,
      NEON_PILOT_KNOWLEDGE_ROOT: knowledgeRoot,
      NEON_PILOT_DESKTOP_USER_DATA_DIR: join(tempRoot, 'user-data'),
      NEON_PILOT_DAEMON_SOCKET_PATH: join(tempRoot, 'daemon.sock'),
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
    await waitForLoadedBody(cdp, child, 'initial desktop route');
    await waitForExpression(
      cdp,
      child,
      "Boolean(document.querySelector('textarea')) || (document.body.innerText || '').length > 0",
      45_000,
    );
    await suppressOnboardingTour(cdp, child);

    await installMatrixPackages(cdp, matrix);
    await assertRequiredExtensions(cdp, matrix);
    await assertRoutes(cdp, child, matrix);
    await assertActions(cdp, matrix);
    await assertAgentTools(cdp, child, matrix);

    console.log(`Release extension golden smoke passed with isolated state root: ${stateRoot}`);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw new Error(`${message}\n\n${renderLogs()}`);
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(1_000);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!preserveState) rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runGoldenSmoke(parseArgs(process.argv.slice(2))).catch((error) => {
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  });
}
