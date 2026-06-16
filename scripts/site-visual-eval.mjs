#!/usr/bin/env node
/* eslint-env node */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

function numberArg(name, fallback) {
  const value = Number(arg(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

async function waitForHttp(url, child, logs, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`Server exited with code ${child.exitCode}.\n${logs()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${url} returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}\n${logs()}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForPageTarget(port, child, logs, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Browser exited with code ${child.exitCode}.\n${logs()}`);
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
      lastError = 'CDP responded but no page target was available yet.';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(300);
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
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails));
  return result?.result?.value;
}

async function waitForLoaded(cdp, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = '';
  while (Date.now() < deadline) {
    const state = await evalJs(cdp, 'document.readyState');
    const body = String(await evalJs(cdp, 'document.body ? document.body.innerText : ""')).trim();
    lastState = `${state}: ${body.slice(0, 400)}`;
    if (state === 'complete' && body.length > 0) return body;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${label}. Last state: ${lastState}`);
}

function routeSlug(route) {
  return route.replace(/^\/+/, '').replace(/[^a-z0-9._-]+/gi, '-') || 'root';
}

function viewportSlug(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function screenshotFileName(route, viewport, variant) {
  const suffix = variant === 'viewport' ? '' : `.${variant}`;
  return `${routeSlug(route)}.${viewportSlug(viewport)}${suffix}.png`;
}

function resizeScreenshotForJudge(file, outDir, maxPixels) {
  if (!maxPixels) return '';
  const judgeDir = resolve(outDir, 'judge-screenshots');
  mkdirSync(judgeDir, { recursive: true });
  const resized = resolve(judgeDir, basename(file));
  const result = spawnSync('sips', ['-Z', String(maxPixels), file, '--out', resized], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`sips resize failed for ${file}:\n${result.stdout}\n${result.stderr}`);
  return resized;
}

function captureModeSet() {
  const raw = arg('capture-modes', 'viewport,full,scroll')
    .split(',')
    .map((mode) => mode.trim().toLowerCase())
    .filter(Boolean);
  if (boolArg('viewport-only')) return new Set(['viewport']);
  return new Set(raw.length > 0 ? raw : ['viewport']);
}

function readViewports() {
  return arg('viewports', 'desktop:1440x1100,mobile:390x844')
    .split(',')
    .map((item) => {
      const [name, size] = item.split(':');
      const [width, height] = (size ?? name).split('x').map((value) => Number(value));
      if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid viewport: ${item}`);
      return { name: size ? name : `${width}x${height}`, width, height };
    });
}

async function setScrollFraction(cdp, fraction) {
  return evalJs(
    cdp,
    `(() => {
      const target = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollTop = Math.round(maxScroll * ${JSON.stringify(fraction)});
      return { maxScroll, scrollTop: target.scrollTop };
    })()`,
  );
}

async function captureScreenshot(cdp, route, viewport, outDir, group, variant, captureBeyondViewport) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport });
  const file = resolve(outDir, group, screenshotFileName(route, viewport, variant));
  write(file, Buffer.from(screenshot.data, 'base64'));
  return file;
}

async function captureRoute(cdp, route, baseUrl, viewport, outDir, modes) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1,
    mobile: viewport.name === 'mobile' || viewport.width <= 480,
  });
  const url = new URL(route, baseUrl).toString();
  await cdp.send('Page.navigate', { url });
  const body = await waitForLoaded(cdp, `${route} ${viewport.name}`);
  await sleep(500);
  const group = `screenshots/${viewport.name}`;
  const textFile = resolve(outDir, group, `${routeSlug(route)}.txt`);
  write(textFile, `${body}\n`, 'utf8');
  const captures = [];

  if (modes.has('viewport')) {
    await setScrollFraction(cdp, 0);
    await sleep(150);
    captures.push({
      route,
      url,
      viewport,
      variant: 'viewport',
      screenshot: await captureScreenshot(cdp, route, viewport, outDir, group, 'viewport', false),
      text: textFile,
    });
  }

  if (modes.has('full') || modes.has('fullpage')) {
    await setScrollFraction(cdp, 0);
    await sleep(150);
    captures.push({
      route,
      url,
      viewport,
      variant: 'full-page',
      screenshot: await captureScreenshot(cdp, route, viewport, outDir, group, 'full-page', true),
      text: textFile,
    });
  }

  if (modes.has('scroll') || modes.has('scroll-depth')) {
    const scroll = await setScrollFraction(cdp, 0);
    if (scroll?.maxScroll > 24) {
      for (const [variant, fraction] of [
        ['scroll-top', 0],
        ['scroll-middle', 0.5],
        ['scroll-bottom', 1],
      ]) {
        await setScrollFraction(cdp, fraction);
        await sleep(250);
        captures.push({
          route,
          url,
          viewport,
          variant,
          screenshot: await captureScreenshot(cdp, route, viewport, outDir, group, variant, false),
          text: textFile,
        });
      }
    }
  }

  return captures;
}

function readNamedDoc(label, path) {
  const absolute = resolve(repoRoot, path);
  const text = existsSync(absolute) ? readFileSync(absolute, 'utf8').trim() : '';
  return text ? [`## ${label}`, '', `Source: ${path}`, '', text].join('\n') : [`## ${label}`, '', `Source missing: ${path}`].join('\n');
}

function writeJudgePrompt(outDir, captures, metadata) {
  const prompt = [
    '# Neonpilot.net Visual Eval Judge Prompt',
    '',
    'You are judging whether the public Neon Pilot website looks shippable and communicates the product clearly.',
    '',
    '## Context',
    '',
    `Base URL: ${metadata.baseUrl}`,
    `Routes: ${metadata.routes.join(', ')}`,
    `Style concept status: ${metadata.styleConceptStatus}`,
    '',
    '## Screenshots',
    '',
    ...captures.map((item) => `- ${item.route} ${item.viewport.name} ${item.variant}: ${item.judgeScreenshot || item.screenshot}`),
    '',
    '## Rubric and Taste Profile',
    '',
    readNamedDoc('Neon Pilot Taste Profile', 'docs/design/neon-pilot-taste.md'),
    '',
    readNamedDoc('Neonpilot.net Visual Quality Rubric', 'benchmarks/site-quality/visual-rubric.md'),
    '',
    readNamedDoc('Neonpilot.net Visual Refinement Loop', 'docs/design/site-visual-refinement.md'),
    '',
    'Judge requirements:',
    '',
    '- Inspect attached screenshots. Do not score from source code alone.',
    '- Cite screenshot route, viewport, and variant when making findings.',
    '- Judge product clarity, screenshot truthfulness, first viewport, responsive quality, and public-site credibility.',
    '- Do not accept a generated style concept unless it is explicitly approved by Patrick; unapproved concepts are only references.',
    '- Return strict JSON only using the rubric schema.',
  ].join('\n');
  write(resolve(outDir, 'visual-judge-prompt.md'), `${prompt}\n`, 'utf8');
}

async function runSiteVisualCapture() {
  const outDir = resolve(repoRoot, arg('out', `artifacts/site-quality/visual-${timestamp()}`));
  const routes = arg('routes', '/,/extensions.html,/docs/')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  const modes = captureModeSet();
  const viewports = readViewports();
  const judgeImageMaxPixels = numberArg('judge-image-max-px', 1200);
  const useDeployed = boolArg('deployed');
  const explicitBaseUrl = arg('base-url');
  const styleConceptStatus = arg('style-concept-status', 'unapproved-reference-only');
  mkdirSync(outDir, { recursive: true });

  let server;
  let serverBaseUrl = explicitBaseUrl || (useDeployed ? 'https://neonpilot.net/' : '');
  const serverLogs = [];
  const renderServerLogs = () => serverLogs.join('').slice(-4000);
  if (!serverBaseUrl) {
    const port = await allocatePort();
    serverBaseUrl = `http://127.0.0.1:${port}/`;
    server = spawn('python3', ['-m', 'http.server', String(port)], {
      cwd: resolve(repoRoot, 'apps/site'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => serverLogs.push(String(chunk)));
    server.stderr.on('data', (chunk) => serverLogs.push(String(chunk)));
    await waitForHttp(serverBaseUrl, server, renderServerLogs);
  }

  const browserPort = await allocatePort();
  const chrome = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${browserPort}`,
      `--user-data-dir=${resolve(tmpdir(), `neon-pilot-site-visual-${Date.now()}`)}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const browserLogs = [];
  chrome.stdout.on('data', (chunk) => browserLogs.push(String(chunk)));
  chrome.stderr.on('data', (chunk) => browserLogs.push(String(chunk)));
  const renderBrowserLogs = () => browserLogs.join('').slice(-4000);

  let cdp;
  try {
    const page = await waitForPageTarget(browserPort, chrome, renderBrowserLogs);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const captures = [];
    for (const viewport of viewports) {
      for (const route of routes) {
        const routeCaptures = await captureRoute(cdp, route, serverBaseUrl, viewport, outDir, modes);
        for (const capture of routeCaptures) {
          captures.push({ ...capture, judgeScreenshot: resizeScreenshotForJudge(capture.screenshot, outDir, judgeImageMaxPixels) });
        }
      }
    }
    const metadata = {
      kind: 'site-visual',
      baseUrl: serverBaseUrl,
      routes,
      viewports,
      captureModes: [...modes],
      styleConceptStatus,
      captures,
      judgeImageMaxPixels,
    };
    write(resolve(outDir, 'visual-capture-summary.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    writeJudgePrompt(outDir, captures, metadata);
    console.log(JSON.stringify(metadata, null, 2));
  } finally {
    cdp?.close();
    if (chrome.exitCode === null) chrome.kill('SIGTERM');
    if (server && server.exitCode === null) server.kill('SIGTERM');
  }
}

runSiteVisualCapture().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
