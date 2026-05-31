import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

import { listExtensionSecretRegistrations } from '../extensions/extensionRegistry.js';
import {
  deleteTauriHostSecret,
  getTauriHostSecret,
  isTauriHostCoreAvailable,
  setTauriHostSecret,
} from '../tauriHostCoreClient.js';

export type SecretBackendId = 'keychain' | 'file' | 'env-only';
export type SecretSource = 'env' | SecretBackendId;

export interface SecretStatus {
  extensionId: string;
  secretId: string;
  key: string;
  label: string;
  description?: string;
  env?: string;
  configured: boolean;
  source: SecretSource | null;
  writable: boolean;
}

export interface SecretBackend {
  id: SecretBackendId;
  writable: boolean;
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

const KEYCHAIN_SERVICE = 'neon-pilot';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSettingsObject(stateRoot: string): Record<string, unknown> {
  const settingsFile = join(stateRoot, 'settings.json');
  if (!existsSync(settingsFile)) return {};
  try {
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf-8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readSecretBackendId(stateRoot: string = getStateRoot()): SecretBackendId {
  const settings = readSettingsObject(stateRoot);
  const nested = isRecord(settings.secrets) ? settings.secrets.provider : undefined;
  const flat = settings['secrets.provider'];
  const value = typeof nested === 'string' ? nested : typeof flat === 'string' ? flat : undefined;
  if (value === 'keychain' || value === 'file' || value === 'env-only') return value;
  return process.platform === 'darwin' ? 'keychain' : 'file';
}

export function makeSecretKey(extensionId: string, secretId: string): string {
  const extension = extensionId.trim();
  const secret = secretId.trim();
  if (!extension || !secret) throw new Error('extensionId and secretId are required');
  return `extension:${extension}:${secret}`;
}

export function makeProviderApiKeySecretKey(provider: string): string {
  const normalized = provider.trim();
  if (!normalized) throw new Error('provider is required');
  return `provider:${normalized}:apiKey`;
}

function fileSecretsPath(stateRoot: string): string {
  return join(stateRoot, 'secrets.json');
}

function secretIndexPath(stateRoot: string): string {
  return join(stateRoot, 'secrets.index.json');
}

function readSecretIndex(stateRoot: string): string[] {
  const path = secretIndexPath(stateRoot);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
      : [];
  } catch {
    return [];
  }
}

function writeSecretIndex(stateRoot: string, keys: string[]): void {
  const path = secretIndexPath(stateRoot);
  const normalized = [...new Set(keys.map((key) => key.trim()).filter(Boolean))].sort();
  if (normalized.length === 0) {
    if (existsSync(path)) rmSync(path);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
}

function addSecretIndexKey(stateRoot: string, key: string): void {
  writeSecretIndex(stateRoot, [...readSecretIndex(stateRoot), key]);
}

function removeSecretIndexKey(stateRoot: string, key: string): void {
  writeSecretIndex(
    stateRoot,
    readSecretIndex(stateRoot).filter((entry) => entry !== key),
  );
}

function readFileSecrets(stateRoot: string): Record<string, string> {
  const path = fileSecretsPath(stateRoot);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

function createFileSecretBackend(stateRoot: string): SecretBackend {
  return {
    id: 'file',
    writable: true,
    get(key) {
      return readFileSecrets(stateRoot)[key];
    },
    set(key, value) {
      const path = fileSecretsPath(stateRoot);
      const secrets = readFileSecrets(stateRoot);
      secrets[key] = value;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
      addSecretIndexKey(stateRoot, key);
    },
    delete(key) {
      const path = fileSecretsPath(stateRoot);
      const secrets = readFileSecrets(stateRoot);
      delete secrets[key];
      if (Object.keys(secrets).length === 0) {
        if (existsSync(path)) rmSync(path);
        removeSecretIndexKey(stateRoot, key);
        return;
      }
      writeFileSync(path, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
      removeSecretIndexKey(stateRoot, key);
    },
  };
}

function createEnvOnlySecretBackend(): SecretBackend {
  return {
    id: 'env-only',
    writable: false,
    get() {
      return undefined;
    },
    set() {
      throw new Error('The env-only secret backend is read-only. Set the configured environment variable instead.');
    },
    delete() {
      throw new Error('The env-only secret backend is read-only.');
    },
  };
}

function createKeychainSecretBackend(stateRoot: string): SecretBackend {
  return {
    id: 'keychain',
    writable: true,
    get(key) {
      try {
        return (
          execFileSync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', key, '-w'], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
          }).trim() || undefined
        );
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      execFileSync('security', ['add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', key, '-w', value], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      addSecretIndexKey(stateRoot, key);
    },
    delete(key) {
      try {
        execFileSync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', key], {
          stdio: ['ignore', 'ignore', 'pipe'],
        });
      } catch {
        // Deleting an absent secret is a no-op.
      }
      removeSecretIndexKey(stateRoot, key);
    },
  };
}

function createSecretBackendForId(backendId: SecretBackendId, stateRoot: string): SecretBackend {
  if (backendId === 'env-only') return createEnvOnlySecretBackend();
  if (backendId === 'keychain') {
    if (process.platform === 'darwin') return createKeychainSecretBackend(stateRoot);
    return createFileSecretBackend(stateRoot);
  }
  return createFileSecretBackend(stateRoot);
}

export function createSecretBackend(stateRoot: string = getStateRoot()): SecretBackend {
  return createSecretBackendForId(readSecretBackendId(stateRoot), stateRoot);
}

function findSecretRegistration(
  extensionId: string,
  secretId: string,
  stateRoot: string,
): ReturnType<typeof listExtensionSecretRegistrations>[number] {
  const declaration = listExtensionSecretRegistrations(stateRoot).find(
    (secret) => secret.extensionId === extensionId && secret.id === secretId,
  );
  if (!declaration) throw new Error(`Secret "${extensionId}/${secretId}" is not registered by an enabled extension.`);
  return declaration;
}

export function resolveSecret(extensionId: string, secretId: string, stateRoot: string = getStateRoot()): string | undefined {
  const declaration = findSecretRegistration(extensionId, secretId, stateRoot);
  const backendValue = createSecretBackend(stateRoot).get(makeSecretKey(extensionId, secretId));
  if (backendValue) return backendValue;
  const envName = declaration?.env;
  if (envName) {
    const envValue = process.env[envName]?.trim();
    if (envValue) return envValue;
  }
  return undefined;
}

async function getStoredSecretValue(key: string, stateRoot: string): Promise<string | undefined> {
  const backend = readSecretBackendId(stateRoot);
  if (backend === 'env-only') return undefined;
  if (isTauriHostCoreAvailable()) {
    return getTauriHostSecret(key, backend);
  }
  return createSecretBackendForId(backend, stateRoot).get(key);
}

async function setStoredSecretValue(key: string, value: string, stateRoot: string): Promise<void> {
  const backend = readSecretBackendId(stateRoot);
  if (backend === 'env-only') {
    throw new Error('The env-only secret backend is read-only. Set the configured environment variable instead.');
  }
  if (isTauriHostCoreAvailable()) {
    await setTauriHostSecret(key, value, backend);
    return;
  }
  createSecretBackendForId(backend, stateRoot).set(key, value);
}

async function deleteStoredSecretValue(key: string, stateRoot: string): Promise<void> {
  const backend = readSecretBackendId(stateRoot);
  if (backend === 'env-only') {
    throw new Error('The env-only secret backend is read-only.');
  }
  if (isTauriHostCoreAvailable()) {
    await deleteTauriHostSecret(key, backend);
    return;
  }
  createSecretBackendForId(backend, stateRoot).delete(key);
}

export async function resolveSecretAsync(
  extensionId: string,
  secretId: string,
  stateRoot: string = getStateRoot(),
): Promise<string | undefined> {
  const declaration = findSecretRegistration(extensionId, secretId, stateRoot);
  const backendValue = await getStoredSecretValue(makeSecretKey(extensionId, secretId), stateRoot);
  if (backendValue) return backendValue;
  const envName = declaration?.env;
  if (envName) {
    const envValue = process.env[envName]?.trim();
    if (envValue) return envValue;
  }
  return undefined;
}

export function listSecretStatuses(stateRoot: string = getStateRoot()): SecretStatus[] {
  const backend = createSecretBackend(stateRoot);
  return listExtensionSecretRegistrations(stateRoot).map((secret) => {
    const key = makeSecretKey(secret.extensionId, secret.id);
    const envValue = secret.env ? process.env[secret.env]?.trim() : undefined;
    const backendValue = backend.get(key);
    const source: SecretSource | null = backendValue ? backend.id : envValue ? 'env' : null;
    return {
      extensionId: secret.extensionId,
      secretId: secret.id,
      key,
      label: secret.label,
      description: secret.description,
      env: secret.env,
      configured: source !== null,
      source,
      writable: backend.writable,
    };
  });
}

export async function listSecretStatusesAsync(stateRoot: string = getStateRoot()): Promise<SecretStatus[]> {
  const backend = readSecretBackendId(stateRoot);
  return Promise.all(
    listExtensionSecretRegistrations(stateRoot).map(async (secret) => {
      const key = makeSecretKey(secret.extensionId, secret.id);
      const envValue = secret.env ? process.env[secret.env]?.trim() : undefined;
      const backendValue = await getStoredSecretValue(key, stateRoot);
      const source: SecretSource | null = backendValue ? backend : envValue ? 'env' : null;
      return {
        extensionId: secret.extensionId,
        secretId: secret.id,
        key,
        label: secret.label,
        description: secret.description,
        env: secret.env,
        configured: source !== null,
        source,
        writable: backend !== 'env-only',
      };
    }),
  );
}

export function setSecret(extensionId: string, secretId: string, value: string, stateRoot: string = getStateRoot()): SecretStatus[] {
  const normalized = value.trim();
  if (!normalized) throw new Error('secret value is required');
  findSecretRegistration(extensionId, secretId, stateRoot);
  const key = makeSecretKey(extensionId, secretId);
  createSecretBackend(stateRoot).set(key, normalized);
  addSecretIndexKey(stateRoot, key);
  return listSecretStatuses(stateRoot);
}

export async function setSecretAsync(
  extensionId: string,
  secretId: string,
  value: string,
  stateRoot: string = getStateRoot(),
): Promise<SecretStatus[]> {
  const normalized = value.trim();
  if (!normalized) throw new Error('secret value is required');
  findSecretRegistration(extensionId, secretId, stateRoot);
  const key = makeSecretKey(extensionId, secretId);
  await setStoredSecretValue(key, normalized, stateRoot);
  addSecretIndexKey(stateRoot, key);
  return listSecretStatusesAsync(stateRoot);
}

export function deleteSecret(extensionId: string, secretId: string, stateRoot: string = getStateRoot()): SecretStatus[] {
  findSecretRegistration(extensionId, secretId, stateRoot);
  const key = makeSecretKey(extensionId, secretId);
  createSecretBackend(stateRoot).delete(key);
  removeSecretIndexKey(stateRoot, key);
  return listSecretStatuses(stateRoot);
}

export async function deleteSecretAsync(
  extensionId: string,
  secretId: string,
  stateRoot: string = getStateRoot(),
): Promise<SecretStatus[]> {
  findSecretRegistration(extensionId, secretId, stateRoot);
  const key = makeSecretKey(extensionId, secretId);
  await deleteStoredSecretValue(key, stateRoot);
  removeSecretIndexKey(stateRoot, key);
  return listSecretStatusesAsync(stateRoot);
}

export function resolveProviderApiKey(provider: string, stateRoot: string = getStateRoot()): string | undefined {
  return createSecretBackend(stateRoot).get(makeProviderApiKeySecretKey(provider))?.trim() || undefined;
}

export async function resolveProviderApiKeyAsync(provider: string, stateRoot: string = getStateRoot()): Promise<string | undefined> {
  return (await getStoredSecretValue(makeProviderApiKeySecretKey(provider), stateRoot))?.trim() || undefined;
}

export function resolveIndexedProviderApiKey(provider: string, stateRoot: string = getStateRoot()): string | undefined {
  const key = makeProviderApiKeySecretKey(provider);
  if (readSecretBackendId(stateRoot) === 'keychain' && !readSecretIndex(stateRoot).includes(key)) {
    return undefined;
  }
  return resolveProviderApiKey(provider, stateRoot);
}

export async function resolveIndexedProviderApiKeyAsync(
  provider: string,
  stateRoot: string = getStateRoot(),
): Promise<string | undefined> {
  const key = makeProviderApiKeySecretKey(provider);
  if (readSecretBackendId(stateRoot) === 'keychain' && !readSecretIndex(stateRoot).includes(key)) {
    return undefined;
  }
  return resolveProviderApiKeyAsync(provider, stateRoot);
}

export function setProviderApiKeySecret(provider: string, apiKey: string, stateRoot: string = getStateRoot()): void {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error('apiKey is required');
  const key = makeProviderApiKeySecretKey(provider);
  createSecretBackend(stateRoot).set(key, normalized);
  addSecretIndexKey(stateRoot, key);
}

export async function setProviderApiKeySecretAsync(provider: string, apiKey: string, stateRoot: string = getStateRoot()): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error('apiKey is required');
  const key = makeProviderApiKeySecretKey(provider);
  await setStoredSecretValue(key, normalized, stateRoot);
  addSecretIndexKey(stateRoot, key);
}

export function deleteProviderApiKeySecret(provider: string, stateRoot: string = getStateRoot()): void {
  const key = makeProviderApiKeySecretKey(provider);
  createSecretBackend(stateRoot).delete(key);
  removeSecretIndexKey(stateRoot, key);
}

export async function deleteProviderApiKeySecretAsync(provider: string, stateRoot: string = getStateRoot()): Promise<void> {
  const key = makeProviderApiKeySecretKey(provider);
  await deleteStoredSecretValue(key, stateRoot);
  removeSecretIndexKey(stateRoot, key);
}

function collectMigratableSecretKeys(stateRoot: string): string[] {
  const extensionKeys = listExtensionSecretRegistrations(stateRoot).map((secret) => makeSecretKey(secret.extensionId, secret.id));
  const fileKeys = Object.keys(readFileSecrets(stateRoot));
  return [...new Set([...readSecretIndex(stateRoot), ...extensionKeys, ...fileKeys])].sort();
}

export interface SecretBackendMigrationResult {
  from: SecretBackendId;
  to: SecretBackendId;
  migrated: number;
  skipped: number;
}

export function migrateSecretBackend(to: SecretBackendId, stateRoot: string = getStateRoot()): SecretBackendMigrationResult {
  const from = readSecretBackendId(stateRoot);
  if (to !== 'keychain' && to !== 'file' && to !== 'env-only') {
    throw new Error(`Unsupported secret backend: ${to}`);
  }
  if (from === to) return { from, to, migrated: 0, skipped: 0 };
  if (to === 'env-only') {
    return { from, to, migrated: 0, skipped: collectMigratableSecretKeys(stateRoot).length };
  }

  const source = createSecretBackendForId(from, stateRoot);
  const target = createSecretBackendForId(to, stateRoot);
  if (source.id === target.id) return { from, to, migrated: 0, skipped: 0 };
  if (!target.writable) {
    throw new Error(`Secret backend "${to}" is read-only.`);
  }

  let migrated = 0;
  let skipped = 0;
  const migratedKeys: string[] = [];
  for (const key of collectMigratableSecretKeys(stateRoot)) {
    const value = source.get(key);
    if (!value) {
      skipped += 1;
      continue;
    }
    target.set(key, value);
    migrated += 1;
    migratedKeys.push(key);
  }

  for (const key of migratedKeys) {
    source.delete(key);
  }
  writeSecretIndex(stateRoot, migratedKeys);
  return { from, to, migrated, skipped };
}

export function expandHomePath(pathValue: string): string {
  if (pathValue === '~') return homedir();
  if (pathValue.startsWith('~/')) return join(homedir(), pathValue.slice(2));
  return pathValue;
}
