#!/usr/bin/env node
/* eslint-env node */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(fileURLToPath(import.meta.url), '..', '..');
const repoRoot = resolve(packageDir, '..', '..');
const tauriDir = resolve(repoRoot, 'packages', 'tauri', 'desktop-shell');
const args = process.argv.slice(2).filter((arg) => arg !== '--prepare-only');

function buildDesktopLaunchEnv(baseEnv = process.env) {
  const {
    NEON_PILOT_STATE_ROOT: _stateRoot,
    NEON_PILOT_CONFIG_ROOT: _configRoot,
    NEON_PILOT_KNOWLEDGE_ROOT: _knowledgeRoot,
    NEON_PILOT_RUNTIME_CHANNEL: _runtimeChannel,
    NEON_PILOT_DESKTOP_VARIANT: _desktopVariant,
    NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR: _nativeModulesDir,
    ...cleanBaseEnv
  } = baseEnv;

  return {
    ...cleanBaseEnv,
    NEON_PILOT_DESKTOP_VARIANT: 'testing',
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_DAEMON_NAMESPACE: baseEnv.NEON_PILOT_DAEMON_NAMESPACE || `dev-${randomUUID().slice(0, 8)}`,
    NEON_PILOT_REPO_ROOT: repoRoot,
  };
}

if (process.argv.includes('--prepare-only')) {
  process.exit(0);
}

const child = spawn('pnpm', ['run', 'dev', ...args], {
  stdio: 'inherit',
  cwd: tauriDir,
  env: buildDesktopLaunchEnv(),
});

child.once('exit', (code) => {
  process.exit(code ?? 1);
});
