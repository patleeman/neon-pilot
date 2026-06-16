#!/usr/bin/env node
/* eslint-env node */
import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

const defaultTargets = [
  { route: '/conversations/new', file: 'workbench.png' },
  { route: '/settings', file: 'settings.png' },
  { route: '/extensions', file: 'extensions.png' },
];

function parseTargets() {
  const raw = arg('targets');
  if (!raw) return defaultTargets;
  return raw.split(',').map((entry) => {
    const [route, file] = entry.split('=');
    if (!route || !file) throw new Error(`Invalid target ${entry}. Use /route=file.png.`);
    return { route: route.trim(), file: file.trim() };
  });
}

function routeSlug(route) {
  return route.replace(/^\/+/, '').replace(/[^a-z0-9._-]+/gi, '-') || 'root';
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function gitAdd(paths) {
  run('git', ['add', '--', ...paths]);
}

function main() {
  const targets = parseTargets();
  const out = resolve(repoRoot, arg('out', `artifacts/site-quality/app-screenshots-${timestamp()}`));
  const theme = arg('theme', 'dark');
  const destination = resolve(repoRoot, arg('destination', `apps/site/screenshots/${theme}`));
  const shouldStage = boolArg('stage') || arg('stage', 'true') === 'true';
  const routes = targets.map((target) => target.route).join(',');

  const captureArgs = [
    'scripts/extension-visual-eval.mjs',
    `--out=${out}`,
    `--baseline-routes=${routes}`,
    '--capture-modes=viewport',
    '--viewport-only=true',
    '--judge-image-max-px=0',
    '--strip-test-attrs=true',
  ];
  const app = arg('app');
  const appEntry = arg('app-entry');
  if (app) captureArgs.push(`--app=${app}`);
  if (appEntry) captureArgs.push(`--app-entry=${appEntry}`);
  run('node', captureArgs);

  const summaryPath = resolve(out, 'visual-capture-summary.json');
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  mkdirSync(destination, { recursive: true });
  const stagedPaths = [];
  const copied = [];
  for (const target of targets) {
    const capture = summary.baseline.find((item) => item.route === target.route && item.variant === 'viewport');
    if (!capture?.screenshot || !existsSync(capture.screenshot)) throw new Error(`Missing screenshot for ${target.route}`);
    const dest = resolve(destination, target.file);
    copyFileSync(capture.screenshot, dest);
    stagedPaths.push(dest);
    copied.push({ route: target.route, source: capture.screenshot, destination: dest });
  }

  const manifest = { capturedAt: new Date().toISOString(), theme, stripTestAttributes: true, copied };
  write(resolve(out, 'site-screenshot-staging-summary.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (shouldStage) gitAdd(stagedPaths.map((path) => path.replace(`${repoRoot}/`, '')));
  console.log(JSON.stringify(manifest, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
