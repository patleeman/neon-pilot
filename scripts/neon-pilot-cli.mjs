#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliDistPath = resolve(repoRoot, 'packages/desktop/server/dist/protocolCli.js');
const cliSourcePath = resolve(repoRoot, 'packages/desktop/server/protocolCli.ts');
const tsxPath = resolve(repoRoot, 'node_modules/.bin/tsx');

function canUseBuiltCli() {
  if (process.env.NEON_PILOT_FORCE_SOURCE_CLI === '1') return false;
  if (!existsSync(cliDistPath)) return false;
  try {
    require.resolve('@neon-pilot/core');
    require.resolve('@neon-pilot/extensions');
    require.resolve('@neon-pilot/desktop');
    require.resolve('@neon-pilot/daemon');
    return true;
  } catch {
    return false;
  }
}

const cliArgs = process.argv.slice(2);
const command = canUseBuiltCli() ? process.execPath : tsxPath;
const args = canUseBuiltCli()
  ? [cliDistPath, ...cliArgs]
  : ['--eval', oneShotSourceCliEval(cliArgs)];

function oneShotSourceCliEval(args) {
  const cliSourceUrl = pathToFileURL(cliSourcePath).href;
  return [
    `import(${JSON.stringify(cliSourceUrl)})`,
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

const child = spawn(command, args, {
  stdio: 'inherit',
  cwd: repoRoot,
  env: { ...process.env, NEON_PILOT_REPO_ROOT: process.env.NEON_PILOT_REPO_ROOT || repoRoot },
});

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};
const killChildOnExit = () => {
  if (!child.killed) child.kill('SIGTERM');
};

process.on('SIGINT', forwardSignal);
process.on('SIGTERM', forwardSignal);
process.on('exit', killChildOnExit);

child.on('exit', (code, signal) => {
  process.off('SIGINT', forwardSignal);
  process.off('SIGTERM', forwardSignal);
  process.off('exit', killChildOnExit);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  process.off('SIGINT', forwardSignal);
  process.off('SIGTERM', forwardSignal);
  process.off('exit', killChildOnExit);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(127);
});
