#!/usr/bin/env node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const tsxBin = resolve(repoRoot, 'node_modules/.bin/tsx');
const cliSource = pathToFileURL(resolve(repoRoot, 'packages/desktop/server/protocolCli.ts')).href;
const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-fixtures-'));
const failures = [];

function runCli(args, options = {}) {
  const result = spawnSync(tsxBin, ['--eval', oneShotCliEval(args)], {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? 30_000,
    env: {
      ...process.env,
      NEON_PILOT_REPO_ROOT: repoRoot,
      NEON_PILOT_STATE_ROOT: join(tempRoot, 'state'),
      NEON_PILOT_CONFIG_ROOT: join(tempRoot, 'config'),
      NEON_PILOT_RUNTIME_CHANNEL: 'test',
      NEON_PILOT_FORCE_SOURCE_CLI: '1',
    },
  });
  return {
    args,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function oneShotCliEval(args) {
  return [
    `import(${JSON.stringify(cliSource)})`,
    `  .then(async (module) => {`,
    `    await module.main(${JSON.stringify(args)});`,
    `    process.exit(process.exitCode ?? 0);`,
    `  })`,
    `  .catch((error) => {`,
    `    console.error(error instanceof Error ? error.stack || error.message : String(error));`,
    `    process.exit(1);`,
    `  });`,
  ].join('\n');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertOk(result, label) {
  assert(result.status === 0, `${label} exited ${result.status}: ${result.stderr || result.stdout}`);
  assert(!result.error, `${label} errored: ${result.error?.message ?? ''}`);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${label} did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

try {
  const version = runCli(['version', '--json']);
  assertOk(version, 'version --json');
  assert(parseJson(version.stdout, 'version --json')?.runtimeChannel === 'test', 'version --json did not use isolated test channel.');

  const paths = runCli(['runtime', 'paths', '--json']);
  assertOk(paths, 'runtime paths --json');
  const parsedPaths = parseJson(paths.stdout, 'runtime paths --json');
  assert(String(parsedPaths?.stateRoot).startsWith(tempRoot), 'runtime paths did not use the temporary state root.');

  const quiet = runCli(['cli', 'install', '--dry-run', '--quiet']);
  assertOk(quiet, 'cli install --dry-run --quiet');
  assert(quiet.stdout === '', 'quiet dry-run should not print human output.');

  const unknown = runCli(['not-a-command', '--json']);
  assert(unknown.status !== 0, 'unknown command should fail.');
  assert(parseJson(unknown.stderr, 'unknown command --json')?.ok === false, 'unknown command did not return structured JSON error.');

  const usage = runCli(['doctor', '--wat', '--json']);
  assert(usage.status !== 0, 'doctor with unknown flag should fail.');
  assert(parseJson(usage.stderr, 'doctor unknown flag')?.error?.code === 'usage_error', 'doctor unknown flag did not return usage_error.');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`CLI fixture check failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CLI fixture check passed.');
