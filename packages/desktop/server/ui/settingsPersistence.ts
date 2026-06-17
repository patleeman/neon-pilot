import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { getConfigRoot, getPiAgentRuntimeDir } from '@neon-pilot/core';

export function getRuntimeSettingsFilePath(stateRoot?: string): string {
  return join(getPiAgentRuntimeDir(stateRoot), 'settings.json');
}

function getDefaultLocalRuntimeConfigDir(): string {
  return join(getConfigRoot(), 'local');
}

function readLocalRuntimeConfigDir(explicitLocalRuntimeConfigDir?: string): string {
  const value = explicitLocalRuntimeConfigDir;

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return getDefaultLocalRuntimeConfigDir();
}

export function resolveLocalRuntimeSettingsFilePath(explicitLocalRuntimeConfigDir?: string): string {
  const localRuntimeConfigDir = readLocalRuntimeConfigDir(explicitLocalRuntimeConfigDir);
  const nestedAgentDir = join(localRuntimeConfigDir, 'agent');

  if (existsSync(nestedAgentDir) && statSync(nestedAgentDir).isDirectory()) {
    return join(nestedAgentDir, 'settings.json');
  }

  if (existsSync(localRuntimeConfigDir) && !statSync(localRuntimeConfigDir).isDirectory()) {
    throw new Error(`Local runtime config path is not a directory: ${localRuntimeConfigDir}`);
  }

  return join(localRuntimeConfigDir, 'settings.json');
}

export interface PersistSettingsWriteOptions {
  runtimeSettingsFile?: string;
  localSettingsFile?: string;
  localRuntimeConfigDir?: string;
}

export function persistSettingsWrite<T>(writeSettingsFile: (settingsFile: string) => T, options: PersistSettingsWriteOptions = {}): T {
  const localSettingsFile = options.localSettingsFile ?? resolveLocalRuntimeSettingsFilePath(options.localRuntimeConfigDir);
  const runtimeSettingsFile = options.runtimeSettingsFile ?? getRuntimeSettingsFilePath();

  writeSettingsFile(localSettingsFile);
  return writeSettingsFile(runtimeSettingsFile);
}
