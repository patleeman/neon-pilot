import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { getConfigRoot, getPiAgentRuntimeDir } from '@neon-pilot/core';

export function getRuntimeSettingsFilePath(stateRoot?: string): string {
  return join(getPiAgentRuntimeDir(stateRoot), 'settings.json');
}

function getDefaultLocalRuntimeConfigDir(): string {
  return join(getConfigRoot(), 'local');
}

function readLocalProfileDir(explicitLocalProfileDir?: string): string {
  const value = explicitLocalProfileDir ?? process.env.NEON_PILOT_LOCAL_PROFILE_DIR;

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return getDefaultLocalRuntimeConfigDir();
}

export function resolveLocalProfileSettingsFilePath(explicitLocalProfileDir?: string): string {
  const localProfileDir = readLocalProfileDir(explicitLocalProfileDir);
  const nestedAgentDir = join(localProfileDir, 'agent');

  if (existsSync(nestedAgentDir) && statSync(nestedAgentDir).isDirectory()) {
    return join(nestedAgentDir, 'settings.json');
  }

  if (existsSync(localProfileDir) && !statSync(localProfileDir).isDirectory()) {
    throw new Error(`Local runtime config path is not a directory: ${localProfileDir}`);
  }

  return join(localProfileDir, 'settings.json');
}

export interface PersistSettingsWriteOptions {
  runtimeSettingsFile?: string;
  localSettingsFile?: string;
  localProfileDir?: string;
}

export function persistSettingsWrite<T>(writeSettingsFile: (settingsFile: string) => T, options: PersistSettingsWriteOptions = {}): T {
  const localSettingsFile = options.localSettingsFile ?? resolveLocalProfileSettingsFilePath(options.localProfileDir);
  const runtimeSettingsFile = options.runtimeSettingsFile ?? getRuntimeSettingsFilePath();

  writeSettingsFile(localSettingsFile);
  return writeSettingsFile(runtimeSettingsFile);
}
