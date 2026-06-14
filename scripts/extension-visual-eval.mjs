#!/usr/bin/env node
/* eslint-env node */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { mkdtempSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultApp = resolve(repoRoot, 'dist/dev-desktop/Neon Pilot Testing.app');
const defaultAppEntry = resolve(repoRoot, 'packages/desktop/dist/main.js');
const desktopPackageDir = resolve(repoRoot, 'packages/desktop');
const startupErrorPattern = /startup error|open logs\s+try again|could not load|safe mode/i;

function arg(name, fallback = '') {
  const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const found = args.find((value) => value.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = args.indexOf(exact);
  return index >= 0 ? (args[index + 1] ?? 'true') : fallback;
}

function boolArg(name) {
  return arg(name, 'false') === 'true';
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function write(file, textOrBuffer, encoding) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, textOrBuffer, encoding);
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
    if (child.exitCode !== null) throw new Error(`App exited with code ${child.exitCode}.\n${logs()}`);
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
  throw new Error(`Timed out waiting for CDP page target: ${lastError}\n${logs()}`);
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

async function waitForLoadedBody(cdp, child, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited while waiting for ${label}.`);
    const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
    lastBody = body;
    if (body.length > 0 && !startupErrorPattern.test(body) && !/Loading extension/i.test(body)) return body;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label}. Last body text:\n${lastBody.slice(-1200)}`);
}

async function postJson(cdp, path, body) {
  const result = await evalJs(
    cdp,
    `(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: ${JSON.stringify(JSON.stringify(body ?? {}))}
      });
      const text = await response.text();
      let parsed = text;
      try { parsed = JSON.parse(text); } catch {}
      return { ok: response.ok, status: response.status, body: parsed };
    })()`,
  );
  if (!result.ok) throw new Error(`${path} returned ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

function routeSlug(route) {
  return (
    route
      .replace(/^\/+/, '')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-|-$/g, '') || 'root'
  );
}

async function captureRoute(cdp, child, route, outDir, group) {
  await cdp.send('Page.navigate', { url: `neon-pilot://app${route}` });
  const body = await waitForLoadedBody(cdp, child, route);
  await sleep(900);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = resolve(outDir, group, `${routeSlug(route)}.png`);
  write(file, Buffer.from(screenshot.data, 'base64'));
  const textFile = file.replace(/\.png$/, '.txt');
  write(textFile, `${body}\n`, 'utf8');
  return { route, screenshot: file, text: textFile };
}

function packExtension(extensionDir, outDir) {
  const zipPath = resolve(outDir, 'generated-extension.neon-extension.zip');
  const result = spawnSync('node', ['scripts/extension-pack.mjs', extensionDir, '--out', zipPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`extension-pack failed:\n${result.stdout}\n${result.stderr}`);
  return zipPath;
}

function readManifest(extensionDir) {
  const manifestPath = resolve(extensionDir, 'extension.json');
  if (!existsSync(manifestPath)) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return {};
  }
}

function inferGeneratedRoutes(manifest) {
  const contributes = manifest?.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
  const routes = [];
  for (const view of Array.isArray(contributes.views) ? contributes.views : []) {
    if (typeof view?.route === 'string') routes.push(view.route);
    if (typeof view?.path === 'string') routes.push(view.path);
  }
  for (const item of Array.isArray(contributes.navigation) ? contributes.navigation : []) {
    if (typeof item?.route === 'string') routes.push(item.route);
    if (typeof item?.path === 'string') routes.push(item.path);
  }
  if (typeof manifest?.id === 'string' && routes.length === 0) routes.push(`/ext/${manifest.id}`);
  return [...new Set(routes)].filter((route) => route.startsWith('/'));
}

function writeJudgePrompt(outDir, baseline, generated, metadata) {
  const prompt = [
    '# Extension Visual Eval Judge Prompt',
    '',
    'You are judging whether a generated Neon Pilot extension visually fits the app and looks shippable in one shot.',
    '',
    '## Context',
    '',
    `Task: ${metadata.task ?? 'unknown'}`,
    `Generated extension: ${metadata.extensionId ?? 'unknown'}`,
    '',
    '## Baseline Screenshots',
    '',
    ...baseline.map((item) => `- ${item.route}: ${item.screenshot}`),
    '',
    '## Generated Screenshots',
    '',
    ...generated.map((item) => `- ${item.route}: ${item.screenshot}`),
    '',
    '## Rubric',
    '',
    'Score 1-5 for each dimension:',
    '',
    '- hostFit: matches Neon Pilot visual language, not generic SaaS chrome',
    '- hierarchy: main job and primary action are obvious within 3 seconds',
    '- density: spacing and information density fit the surface',
    '- states: visible empty/loading/error/success/disabled states are intentional',
    '- interactionClarity: primary/secondary/destructive actions are clear',
    '- textRobustness: long labels, paths, prompts, logs, and row text behave well',
    '- accessibilitySignals: labels, focus affordances, button semantics, icon clarity',
    '- polish: alignment, rhythm, typography, no overlap/clipping/nested-card mess',
    '',
    'Return strict JSON:',
    '',
    '```json',
    JSON.stringify(
      {
        judge: 'model-name',
        overall: 1,
        decision: 'pass|borderline|fail',
        scores: {
          hostFit: 1,
          hierarchy: 1,
          density: 1,
          states: 1,
          interactionClarity: 1,
          textRobustness: 1,
          accessibilitySignals: 1,
          polish: 1,
        },
        failureTags: ['too_sparse'],
        topFindings: ['Short concrete finding with screenshot reference.'],
        mustFix: ['Specific change required before shipping.'],
      },
      null,
      2,
    ),
    '```',
  ].join('\n');
  write(resolve(outDir, 'visual-judge-prompt.md'), `${prompt}\n`, 'utf8');
}

export async function runVisualCapture() {
  const appPath = resolve(arg('app', defaultApp));
  const appEntry = arg('app-entry', appPath === defaultApp ? defaultAppEntry : '');
  const outDir = resolve(repoRoot, arg('out', `artifacts/extension-quality/visual-${timestamp()}`));
  const extensionDirArg = arg('extension-dir');
  const extensionDir = extensionDirArg ? resolve(extensionDirArg) : '';
  const preserveState = boolArg('preserve-state');
  const baselineRoutes = arg('baseline-routes', '/conversations/new,/settings,/extensions')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  const requestedGeneratedRoutes = arg('generated-routes')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);

  if (!existsSync(appPath)) throw new Error(`App not found: ${appPath}`);
  if (appEntry && !existsSync(resolve(appEntry))) throw new Error(`App entry not found: ${resolve(appEntry)}`);
  mkdirSync(outDir, { recursive: true });

  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-visual-'));
  const stateRoot = join(tempRoot, 'state');
  const debugPort = await allocatePort();
  const companionPort = await allocatePort();
  const executablePath = join(appPath, 'Contents', 'MacOS', basename(appPath, '.app'));
  const stdoutChunks = [];
  const stderrChunks = [];
  const renderLogs = () =>
    [
      stdoutChunks.length ? `stdout:\n${stdoutChunks.join('').slice(-6000)}` : '',
      stderrChunks.length ? `stderr:\n${stderrChunks.join('').slice(-6000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const childArgs = [`--remote-debugging-port=${debugPort}`];
  if (appEntry) childArgs.push(resolve(appEntry));
  childArgs.push('--no-quit-confirmation');
  const child = spawn(executablePath, childArgs, {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      HOME: join(tempRoot, 'home'),
      XDG_CACHE_HOME: join(tempRoot, 'xdg-cache'),
      XDG_CONFIG_HOME: join(tempRoot, 'xdg-config'),
      XDG_DATA_HOME: join(tempRoot, 'xdg-data'),
      XDG_STATE_HOME: join(tempRoot, 'xdg-state'),
      NEON_PILOT_RUNTIME_CHANNEL: 'test',
      NEON_PILOT_STATE_ROOT: stateRoot,
      NEON_PILOT_CONFIG_ROOT: join(tempRoot, 'config'),
      NEON_PILOT_KNOWLEDGE_ROOT: join(tempRoot, 'knowledge'),
      NEON_PILOT_DESKTOP_USER_DATA_DIR: join(tempRoot, 'user-data'),
      NEON_PILOT_DAEMON_SOCKET_PATH: join(tempRoot, 'daemon.sock'),
      NEON_PILOT_COMPANION_PORT: String(companionPort),
      NEON_PILOT_DESKTOP_DEV_BUNDLE: appEntry ? '1' : undefined,
      NEON_PILOT_REPO_ROOT: repoRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: appEntry ? desktopPackageDir : repoRoot,
  });
  child.stdout.on('data', (chunk) => stdoutChunks.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)));

  let cdp;
  try {
    const page = await waitForPageTarget(debugPort, child, renderLogs);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await waitForLoadedBody(cdp, child, 'initial route');

    const baseline = [];
    for (const route of baselineRoutes) baseline.push(await captureRoute(cdp, child, route, outDir, 'baseline-screenshots'));

    let generated = [];
    let manifest = {};
    if (extensionDir) {
      manifest = readManifest(extensionDir);
      const zipPath = packExtension(extensionDir, outDir);
      await postJson(cdp, '/api/extensions/import', { zipPath });
      await postJson(cdp, '/api/extensions/reload', {});
      const routes = requestedGeneratedRoutes.length > 0 ? requestedGeneratedRoutes : inferGeneratedRoutes(manifest);
      generated = [];
      for (const route of routes) generated.push(await captureRoute(cdp, child, route, outDir, 'generated-screenshots'));
    }

    const metadata = {
      appPath,
      outDir,
      tempRoot: preserveState ? tempRoot : undefined,
      stateRoot: preserveState ? stateRoot : undefined,
      extensionDir: extensionDir || undefined,
      extensionId: manifest?.id,
      task: arg('task', ''),
      baseline,
      generated,
    };
    write(resolve(outDir, 'visual-capture-summary.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    writeJudgePrompt(outDir, baseline, generated, metadata);
    console.log(JSON.stringify(metadata, null, 2));
  } catch (error) {
    throw new Error(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n\n${renderLogs()}`);
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(1000);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!preserveState) rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVisualCapture().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
