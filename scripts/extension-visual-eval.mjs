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
  if (index < 0) return fallback;
  const next = args[index + 1];
  return next && !next.startsWith('--') ? next : 'true';
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

async function waitForBodyWithout(cdp, child, label, pattern, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited while waiting for ${label}.`);
    const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
    lastBody = body;
    if (!pattern.test(body)) return body;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}. Last body text:\n${lastBody.slice(-1200)}`);
}

async function waitForPathname(cdp, child, route, timeoutMs = 20_000) {
  const expected = route.split(/[?#]/)[0] || '/';
  const deadline = Date.now() + timeoutMs;
  let lastPathname = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`App exited while waiting for route ${route}.`);
    lastPathname = String(
      await evalJs(
        cdp,
        `(() => {
          try { return new URL(window.location.href).pathname || '/'; }
          catch { return window.location.pathname || '/'; }
        })()`,
      ),
    );
    if (lastPathname === expected) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for route ${route}; last pathname was ${lastPathname || '(empty)'}.`);
}

async function clickVisibleButton(cdp, label) {
  return evalJs(
    cdp,
    `(() => {
      const targetLabel = ${JSON.stringify(label)};
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => item.textContent?.trim() === targetLabel);
      if (!button) return false;
      button.click();
      return true;
    })()`,
  );
}

async function dismissOnboardingOverlayIfRequested(cdp, child) {
  if (!boolArg('skip-onboarding')) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await clickVisibleButton(cdp, 'Skip tour')) {
      await waitForBodyWithout(cdp, child, 'onboarding overlay to close', /TOUR \d+ OF \d+|Skip tour/i);
      await sleep(250);
      return;
    }
    await sleep(350);
  }
}

async function requestJson(cdp, method, path, body) {
  const result = await evalJs(
    cdp,
    `(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(method)},
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

async function postJson(cdp, path, body) {
  return requestJson(cdp, 'POST', path, body);
}

async function patchJson(cdp, path, body) {
  return requestJson(cdp, 'PATCH', path, body);
}

async function deleteJson(cdp, path) {
  return requestJson(cdp, 'DELETE', path, {});
}

function routeSlug(route) {
  return (
    route
      .replace(/^\/+/, '')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-|-$/g, '') || 'root'
  );
}

function numberArg(name, fallback) {
  const value = Number(arg(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resizeScreenshotForJudge(file, outDir, maxPixels) {
  if (!maxPixels) return '';
  const judgeDir = resolve(outDir, 'judge-screenshots');
  mkdirSync(judgeDir, { recursive: true });
  const resized = resolve(judgeDir, basename(file));
  const result = spawnSync('sips', ['-Z', String(maxPixels), file, '--out', resized], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`sips resize failed for ${file}:\n${result.stdout}\n${result.stderr}`);
  }
  return resized;
}

function captureModeSet() {
  const raw = arg('capture-modes', 'viewport,full,scroll')
    .split(',')
    .map((mode) => mode.trim().toLowerCase())
    .filter(Boolean);
  const modes = new Set(raw.length > 0 ? raw : ['viewport']);
  if (boolArg('viewport-only')) return new Set(['viewport']);
  return modes;
}

function screenshotFileName(route, variant) {
  return `${routeSlug(route)}${variant === 'viewport' ? '' : `.${variant}`}.png`;
}

async function findPrimaryScrollContainer(cdp) {
  return evalJs(
    cdp,
    `(() => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const candidates = [document.scrollingElement, document.documentElement, document.body, ...document.querySelectorAll('*')]
        .filter(Boolean)
        .map((el) => {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          const scrollable = /(auto|scroll|overlay)/.test(overflowY) || el === document.scrollingElement || el === document.body || el === document.documentElement;
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          const rect = el.getBoundingClientRect?.() ?? { top: 0, left: 0, width: window.innerWidth, height: viewportHeight };
          return {
            scrollable,
            maxScroll,
            tagName: el.tagName,
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className : '',
            visibleArea: Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)) * Math.max(0, rect.width),
          };
        })
        .filter((item) => item.scrollable && item.maxScroll > 24)
        .sort((a, b) => (b.maxScroll - a.maxScroll) || (b.visibleArea - a.visibleArea));
      return candidates[0] ?? null;
    })()`,
  );
}

async function setPrimaryScrollFraction(cdp, fraction) {
  return evalJs(
    cdp,
    `(() => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const candidates = [document.scrollingElement, document.documentElement, document.body, ...document.querySelectorAll('*')]
        .filter(Boolean)
        .map((el) => {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          const scrollable = /(auto|scroll|overlay)/.test(overflowY) || el === document.scrollingElement || el === document.body || el === document.documentElement;
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          const rect = el.getBoundingClientRect?.() ?? { top: 0, left: 0, width: window.innerWidth, height: viewportHeight };
          return { el, scrollable, maxScroll, visibleArea: Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)) * Math.max(0, rect.width) };
        })
        .filter((item) => item.scrollable && item.maxScroll > 24)
        .sort((a, b) => (b.maxScroll - a.maxScroll) || (b.visibleArea - a.visibleArea));
      const target = candidates[0]?.el ?? document.scrollingElement ?? document.documentElement;
      const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollTop = Math.round(maxScroll * ${JSON.stringify(fraction)});
      return { maxScroll, scrollTop: target.scrollTop };
    })()`,
  );
}

async function captureScreenshot(cdp, route, outDir, group, variant, captureBeyondViewport) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport });
  const file = resolve(outDir, group, screenshotFileName(route, variant));
  write(file, Buffer.from(screenshot.data, 'base64'));
  return file;
}

async function stripTestingAttributes(cdp) {
  await evalJs(
    cdp,
    `(() => {
      for (const element of document.querySelectorAll('[data-testid], [data-test], [data-qa]')) {
        element.removeAttribute('data-testid');
        element.removeAttribute('data-test');
        element.removeAttribute('data-qa');
      }
      for (const element of document.querySelectorAll('body *')) {
        const text = (element.textContent || '').trim().toUpperCase();
        if ((text === 'TESTING' || text === 'TEST' || text === 'DEV') && element.getBoundingClientRect().width <= 140) {
          element.remove();
        }
      }
      return true;
    })()`,
  );
}

async function captureRoute(cdp, child, route, outDir, group, modes = captureModeSet()) {
  await cdp.send('Page.navigate', { url: `neon-pilot://app${route}` });
  await waitForPathname(cdp, child, route);
  await waitForLoadedBody(cdp, child, route);
  await sleep(1200);
  await dismissOnboardingOverlayIfRequested(cdp, child);
  if (boolArg('strip-test-attrs')) await stripTestingAttributes(cdp);
  const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
  const captures = [];
  const textFile = resolve(outDir, group, `${routeSlug(route)}.txt`);
  write(textFile, `${body}\n`, 'utf8');

  if (modes.has('viewport')) {
    await setPrimaryScrollFraction(cdp, 0);
    await sleep(250);
    await dismissOnboardingOverlayIfRequested(cdp, child);
    captures.push({
      route,
      variant: 'viewport',
      screenshot: await captureScreenshot(cdp, route, outDir, group, 'viewport', false),
      text: textFile,
    });
  }

  if (modes.has('full') || modes.has('fullpage')) {
    await setPrimaryScrollFraction(cdp, 0);
    await sleep(250);
    await dismissOnboardingOverlayIfRequested(cdp, child);
    captures.push({
      route,
      variant: 'full-page',
      screenshot: await captureScreenshot(cdp, route, outDir, group, 'full-page', true),
      text: textFile,
    });
  }

  if (modes.has('scroll') || modes.has('scroll-depth')) {
    const scrollContainer = await findPrimaryScrollContainer(cdp);
    if (scrollContainer?.maxScroll > 24) {
      for (const [variant, fraction] of [
        ['scroll-top', 0],
        ['scroll-middle', 0.5],
        ['scroll-bottom', 1],
      ]) {
        await setPrimaryScrollFraction(cdp, fraction);
        await sleep(450);
        await dismissOnboardingOverlayIfRequested(cdp, child);
        captures.push({
          route,
          variant,
          scroll: { fraction, container: scrollContainer },
          screenshot: await captureScreenshot(cdp, route, outDir, group, variant, false),
          text: textFile,
        });
      }
    }
  }

  return captures;
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

function readManifestFromZip(zipPath) {
  const entries = spawnSync('zipinfo', ['-1', zipPath], { cwd: repoRoot, encoding: 'utf8' });
  if (entries.status !== 0) return {};
  const manifestEntry = entries.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.endsWith('/extension.json'));
  if (!manifestEntry) return {};
  const manifest = spawnSync('unzip', ['-p', zipPath, manifestEntry], { cwd: repoRoot, encoding: 'utf8' });
  if (manifest.status !== 0) return {};
  try {
    return JSON.parse(manifest.stdout);
  } catch {
    return {};
  }
}

function readTextFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readNamedDoc(label, path) {
  const absolutePath = resolve(repoRoot, path);
  const text = readTextFile(absolutePath).trim();
  return text ? [`## ${label}`, '', `Source: ${path}`, '', text].join('\n') : [`## ${label}`, '', `Source missing: ${path}`].join('\n');
}

function readJudgeContext() {
  return [
    readNamedDoc('Neon Pilot Taste Profile', 'docs/design/neon-pilot-taste.md'),
    readNamedDoc('Extension Visual Quality Rubric', 'benchmarks/extension-quality/visual-rubric.md'),
    readNamedDoc('Extension Visual Refinement Loop', 'docs/design/extension-visual-refinement.md'),
    readNamedDoc('Negative Example Gallery', 'docs/design/examples/README.md'),
    readNamedDoc('Negative Anchor: AI Generated SaaS', 'docs/design/examples/negative/ai-generated-saas.md'),
    readNamedDoc('Negative Anchor: Title Description Noise', 'docs/design/examples/negative/title-description-noise.md'),
    readNamedDoc('Negative Anchor: Text Button Sprawl', 'docs/design/examples/negative/text-button-sprawl.md'),
    readNamedDoc('Negative Anchor: Box In Box', 'docs/design/examples/negative/box-in-box.md'),
    readNamedDoc('Negative Anchor: Sparse Empty State', 'docs/design/examples/negative/sparse-empty-state.md'),
    readNamedDoc('Negative Anchor: Modal CRUD Flow', 'docs/design/examples/negative/modal-crud-flow.md'),
  ].join('\n\n---\n\n');
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

function calibrationRoutes(target) {
  if (target === 'settings')
    return [
      '/settings',
      '/settings#settings-providers',
      '/settings#settings-conversation',
      '/settings#settings-workspace',
      '/settings#settings-commands',
      '/settings#settings-security',
      '/settings#settings-extensions',
      '/settings#settings-desktop',
    ];
  return [];
}

function screenshotPathForJudge(item) {
  return item.judgeScreenshot || item.screenshot;
}

function writeJudgePrompt(outDir, baseline, generated, metadata) {
  const judgeContext = readJudgeContext();
  const generatedOrTarget = generated.length > 0 ? generated : baseline;
  const subjectHeading = generated.length > 0 ? 'Generated Screenshots' : 'Target Screenshots';
  const prompt = [
    '# Extension Visual Eval Judge Prompt',
    '',
    generated.length > 0
      ? 'You are judging whether a generated Neon Pilot extension visually fits the app and looks shippable in one shot.'
      : 'You are judging an existing Neon Pilot app surface to calibrate the visual taste rubric before a redesign.',
    '',
    '## Context',
    '',
    `Task: ${metadata.task ?? 'unknown'}`,
    `Generated extension: ${metadata.extensionId ?? 'unknown'}`,
    `Calibration target: ${metadata.calibrationTarget ?? 'none'}`,
    '',
    '## Baseline Screenshots',
    '',
    ...baseline.map((item) => `- ${item.route}${item.variant ? ` [${item.variant}]` : ''}: ${screenshotPathForJudge(item)}`),
    '',
    `## ${subjectHeading}`,
    '',
    ...generatedOrTarget.map((item) => `- ${item.route}${item.variant ? ` [${item.variant}]` : ''}: ${screenshotPathForJudge(item)}`),
    '',
    '## Taste Profile, Rubric, and Examples',
    '',
    judgeContext,
    '',
    'Judge requirements:',
    '',
    '- Inspect screenshots. Do not score from source code alone.',
    '- Cite screenshot routes when making findings.',
    '- Compare screenshots across routes and scroll positions. Do not judge each image in isolation.',
    '- Audit negative space: padding, row height, section gaps, control alignment, empty-state padding, and whether whitespace rhythm is consistent across the whole page.',
    '- Audit component grammar consistency: boxed versus unboxed rows, title sizes, divider use, action placement, and whether extension-provided panels inherit host settings layout.',
    '- Treat a good top viewport as insufficient when middle, bottom, full-page, or sibling-page screenshots show inconsistent spacing or controls.',
    '- Use the rubric dimensions and failure tags exactly where possible.',
    '- Be strict about IDE/tooling density, text economy, flat surfaces, action chrome, and neutral color.',
    '- Return strict JSON only.',
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
          workbenchFit: 1,
          hierarchy: 1,
          density: 1,
          negativeSpace: 1,
          surfaceDiscipline: 1,
          consistency: 1,
          sidebarDiscipline: 1,
          textEconomy: 1,
          states: 1,
          controlTaste: 1,
          actionChrome: 1,
          editingModel: 1,
          interactionClarity: 1,
          textRobustness: 1,
          accessibilitySignals: 1,
          colorRestraint: 1,
          polish: 1,
        },
        failureTags: ['too_sparse', 'title_description_noise'],
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
  const extensionZipArg = arg('extension-zip');
  const extensionZip = extensionZipArg ? resolve(extensionZipArg) : '';
  const preserveState = boolArg('preserve-state');
  const calibrationTarget = arg('calibration-target');
  const targetRoutes = calibrationRoutes(calibrationTarget);
  const baselineRoutes = arg('baseline-routes', targetRoutes.length ? targetRoutes.join(',') : '/conversations/new,/settings,/extensions')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  const requestedGeneratedRoutes = arg('generated-routes')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  const judgeImageMaxPixels = numberArg('judge-image-max-px', 900);
  const captureModes = captureModeSet();

  if (extensionDir && extensionZip) throw new Error('Pass either --extension-dir or --extension-zip, not both.');
  if (!existsSync(appPath)) throw new Error(`App not found: ${appPath}`);
  if (appEntry && !existsSync(resolve(appEntry))) throw new Error(`App entry not found: ${resolve(appEntry)}`);
  if (extensionZip && !existsSync(extensionZip)) throw new Error(`Extension zip not found: ${extensionZip}`);
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
    if (boolArg('skip-onboarding')) {
      await postJson(cdp, '/api/extensions/system-onboarding/actions/update', { status: 'skipped', stepIndex: 0 });
      await cdp.send('Page.reload', { ignoreCache: true });
      await waitForLoadedBody(cdp, child, 'post-onboarding-skip route');
      if (await clickVisibleButton(cdp, 'Skip tour')) {
        await waitForBodyWithout(cdp, child, 'onboarding overlay to close', /TOUR \d+ OF \d+|Skip tour/i);
      }
    }

    const baseline = [];
    for (const route of baselineRoutes) {
      const captures = await captureRoute(cdp, child, route, outDir, 'baseline-screenshots', captureModes);
      for (const capture of captures) {
        baseline.push({
          ...capture,
          judgeScreenshot: resizeScreenshotForJudge(capture.screenshot, outDir, judgeImageMaxPixels),
        });
      }
    }

    let generated = [];
    let manifest = {};
    if (extensionDir || extensionZip) {
      manifest = extensionDir ? readManifest(extensionDir) : readManifestFromZip(extensionZip);
      const zipPath = extensionZip || packExtension(extensionDir, outDir);
      if (typeof manifest?.id === 'string' && manifest.id.trim()) {
        await deleteJson(cdp, `/api/extensions/${encodeURIComponent(manifest.id)}`).catch(() => null);
      }
      const imported = await postJson(cdp, '/api/extensions/import', { zipPath });
      const importedExtensionId =
        typeof imported?.extension?.id === 'string' ? imported.extension.id : typeof manifest?.id === 'string' ? manifest.id : '';
      if (importedExtensionId) {
        await patchJson(cdp, `/api/extensions/${encodeURIComponent(importedExtensionId)}`, { enabled: true });
      }
      await postJson(cdp, '/api/extensions/reload', {});
      await cdp.send('Page.reload', { ignoreCache: true });
      await waitForLoadedBody(cdp, child, 'post-import reload');
      const routes = requestedGeneratedRoutes.length > 0 ? requestedGeneratedRoutes : inferGeneratedRoutes(manifest);
      generated = [];
      for (const route of routes) {
        const captures = await captureRoute(cdp, child, route, outDir, 'generated-screenshots', captureModes);
        for (const capture of captures) {
          generated.push({
            ...capture,
            judgeScreenshot: resizeScreenshotForJudge(capture.screenshot, outDir, judgeImageMaxPixels),
          });
        }
      }
    }

    const metadata = {
      appPath,
      outDir,
      tempRoot: preserveState ? tempRoot : undefined,
      stateRoot: preserveState ? stateRoot : undefined,
      extensionDir: extensionDir || undefined,
      extensionZip: extensionZip || undefined,
      extensionId: manifest?.id,
      calibrationTarget: calibrationTarget || undefined,
      task: arg('task', ''),
      baseline,
      generated,
      judgeImageMaxPixels,
      captureModes: [...captureModes],
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
