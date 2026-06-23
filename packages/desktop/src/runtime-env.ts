import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import {
  getDefaultStateRoot,
  getPiAgentRuntimeDir,
  readPortOverride,
  resolveNeonPilotRuntimeChannel,
  resolveNeonPilotRuntimeChannelConfig,
} from '@neon-pilot/core';

const PRIVATE_RUNTIME_DIR_MODE = 0o700;
const PRIVATE_AUTH_FILE_MODE = 0o600;

function resolveDefaultStateRootForEnv(env: NodeJS.ProcessEnv): string {
  const xdgStateHome = env.XDG_STATE_HOME?.trim();
  return xdgStateHome ? join(xdgStateHome, 'neon-pilot') : getDefaultStateRoot();
}

function resolveVariantStateRoot(defaultStateRoot: string, suffix: string): string {
  return suffix ? join(dirname(defaultStateRoot), `${basename(defaultStateRoot)}${suffix}`) : defaultStateRoot;
}

interface DesktopRuntimeEnvironmentOptions {
  defaultStateRoot?: string;
  version?: string;
  packaged?: boolean;
}

export function resolveDesktopRuntimeEnvironmentOverrides(
  env: NodeJS.ProcessEnv = process.env,
  options: DesktopRuntimeEnvironmentOptions = {},
): {
  stateRoot?: string;
} {
  const channelConfig = resolveNeonPilotRuntimeChannelConfig(env, options);

  if (!channelConfig.stateRootSuffix) {
    return {};
  }

  return {
    ...(env.NEON_PILOT_STATE_ROOT?.trim()
      ? {}
      : {
          stateRoot: resolveVariantStateRoot(options.defaultStateRoot ?? resolveDefaultStateRootForEnv(env), channelConfig.stateRootSuffix),
        }),
  };
}

function readJsonRecord(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isEmptyJsonRecord(filePath: string): boolean {
  const record = readJsonRecord(filePath);
  return !record || Object.keys(record).length === 0;
}

function seedTestingAgentRuntimeFile(sourceFile: string, targetFile: string, options: { overwrite?: boolean } = {}): void {
  if (!existsSync(sourceFile)) {
    return;
  }

  if (!options.overwrite && existsSync(targetFile) && !isEmptyJsonRecord(targetFile)) {
    return;
  }

  mkdirSync(dirname(targetFile), { recursive: true });
  copyFileSync(sourceFile, targetFile);
}

function seedTestingAuthFile(sourceFile: string, targetFile: string): void {
  const sourceAuth = readJsonRecord(sourceFile);
  if (!sourceAuth) {
    return;
  }

  const variantAuth = readJsonRecord(targetFile) ?? {};
  mkdirSync(dirname(targetFile), { recursive: true });
  writeJsonRecord(targetFile, { ...sourceAuth, ...variantAuth });
}

function writeJsonRecord(filePath: string, record: Record<string, unknown>): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true, mode: PRIVATE_RUNTIME_DIR_MODE });
  chmodSync(dir, PRIVATE_RUNTIME_DIR_MODE);
  writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, { mode: PRIVATE_AUTH_FILE_MODE });
  chmodSync(filePath, PRIVATE_AUTH_FILE_MODE);
}

export function seedTestingRuntimeState(env: NodeJS.ProcessEnv = process.env, options: DesktopRuntimeEnvironmentOptions = {}): void {
  const channel = resolveNeonPilotRuntimeChannel(env, options);
  if (channel !== 'rc' && channel !== 'dev' && channel !== 'test') {
    return;
  }

  const variantStateRoot = env.NEON_PILOT_STATE_ROOT?.trim();
  if (!variantStateRoot) {
    return;
  }

  const stableAgentDir = getPiAgentRuntimeDir(resolveDefaultStateRootForEnv(env));
  const variantAgentDir = getPiAgentRuntimeDir(variantStateRoot);
  if (stableAgentDir === variantAgentDir) {
    return;
  }

  seedTestingAuthFile(join(stableAgentDir, 'auth.json'), join(variantAgentDir, 'auth.json'));
  seedTestingAgentRuntimeFile(join(stableAgentDir, 'models.json'), join(variantAgentDir, 'models.json'));
}

export function applyDesktopRuntimeEnvironmentOverrides(
  env: NodeJS.ProcessEnv = process.env,
  options: DesktopRuntimeEnvironmentOptions = {},
): void {
  const overrides = resolveDesktopRuntimeEnvironmentOverrides(env, options);

  if (overrides.stateRoot) {
    env.NEON_PILOT_STATE_ROOT = overrides.stateRoot;
  }

  const channelConfig = resolveNeonPilotRuntimeChannelConfig(env, options);
  const codexPort = readPortOverride(env.NEON_PILOT_CODEX_PORT) ?? channelConfig.codexPort;
  const companionPort = readPortOverride(env.NEON_PILOT_COMPANION_PORT) ?? channelConfig.companionPort;
  if (!env.CODEX_PORT && codexPort > 0) {
    env.CODEX_PORT = String(codexPort);
  }
  if (!env.NEON_PILOT_COMPANION_PORT && companionPort >= 0) {
    env.NEON_PILOT_COMPANION_PORT = String(companionPort);
  }
  env.NEON_PILOT_RUNTIME_CHANNEL = channelConfig.channel;

  if (
    (channelConfig.channel === 'dev' || channelConfig.channel === 'test') &&
    !env.NEON_PILOT_DAEMON_NAMESPACE?.trim() &&
    !env.NEON_PILOT_DAEMON_SOCKET_PATH?.trim()
  ) {
    env.NEON_PILOT_DAEMON_NAMESPACE = channelConfig.channel;
  }

  seedTestingRuntimeState(env, options);
}
