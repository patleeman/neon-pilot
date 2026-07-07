import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type DesktopRootLayout, getStateRoot } from '@neon-pilot/core';

import { type ExtensionSettingsRegistration, listExtensionSettingsRegistrations } from '../extensions/extensionRegistry.js';
import { migrateSecretBackend, type SecretBackendId } from '../secrets/secretStore.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface SettingsStore {
  /** Returns the merged view: overrides on top of schema defaults. */
  read(): Record<string, unknown>;
  /** Returns only the persisted overrides (no defaults). */
  readOverrides(): Record<string, unknown>;
  /** Updates one or more keys. */
  update(overrides: Record<string, unknown>): Record<string, unknown>;
  reset(keys: string[]): Record<string, unknown>;
  /** Returns the active schema: all registered extension settings merged. */
  readSchema(): ExtensionSettingsRegistration[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function getSettingsFilePath(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'settings.json');
}

function readRawOverrides(stateRoot: string): Record<string, unknown> {
  const filePath = getSettingsFilePath(stateRoot);
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore corrupted settings.
  }
  return {};
}

function writeOverrides(overrides: Record<string, unknown>, stateRoot: string): void {
  const dir = join(stateRoot);
  mkdirSync(dir, { recursive: true });
  const filePath = getSettingsFilePath(stateRoot);
  writeFileSync(filePath, `${JSON.stringify(overrides, null, 2)}\n`, { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function mergeDefaults(overrides: Record<string, unknown>, schema: ExtensionSettingsRegistration[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Apply defaults first
  for (const setting of schema) {
    if (setting.default !== undefined) {
      result[setting.key] = setting.default;
    }
  }
  // Override with stored values
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value;
  }
  return result;
}

function migrateLegacyNestedValuesOverrides(
  overrides: Record<string, unknown>,
  schema: ExtensionSettingsRegistration[],
): { overrides: Record<string, unknown>; changed: boolean } {
  const values = overrides.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { overrides, changed: false };
  }

  const schemaKeys = new Set(schema.map((setting) => setting.key));
  const migratedEntries = Object.entries(values as Record<string, unknown>).filter(([key]) => schemaKeys.has(key));
  if (migratedEntries.length === 0) {
    return { overrides, changed: false };
  }

  const migrated = { ...overrides };
  for (const [key, value] of migratedEntries) {
    migrated[key] = value;
  }
  delete migrated.values;
  return { overrides: migrated, changed: true };
}

function readMigratedOverrides(stateRoot: string, schema: ExtensionSettingsRegistration[]): Record<string, unknown> {
  const rawOverrides = readRawOverrides(stateRoot);
  const migration = migrateLegacyNestedValuesOverrides(rawOverrides, schema);
  if (migration.changed) {
    writeOverrides(migration.overrides, stateRoot);
  }
  return migration.overrides;
}

function isSecretBackendId(value: unknown): value is SecretBackendId {
  return value === 'keychain' || value === 'file' || value === 'env-only';
}

// ── Layout-aware resolution ────────────────────────────────────────────

export function resolveSettingsRoot(root?: string | DesktopRootLayout): string {
  if (root && typeof root === 'object' && 'systemConfig' in root) {
    return root.systemConfig;
  }
  return root ?? getStateRoot();
}

function resolveExtensionSettingsScope(root?: string | DesktopRootLayout): { stateRoot: string; layout?: DesktopRootLayout } {
  if (root && typeof root === 'object') {
    return { stateRoot: root.systemState, layout: root };
  }
  return { stateRoot: root ?? getStateRoot() };
}

// ── Factory ────────────────────────────────────────────────────────────

/**
 * Create a settings store.
 *
 * @param root - Either a `DesktopRootLayout` (settings go under `systemConfig`,
 *   extension registry reads use `systemState`), a legacy `stateRoot` string,
 *   or `undefined` to use the default `getStateRoot()`.
 */
export function createSettingsStore(root?: string | DesktopRootLayout): SettingsStore {
  const settingsRoot = resolveSettingsRoot(root);
  const extensionSettingsScope = resolveExtensionSettingsScope(root);
  const readSettingsSchema = () => listExtensionSettingsRegistrations(extensionSettingsScope.stateRoot, extensionSettingsScope.layout);
  return {
    read(): Record<string, unknown> {
      const schema = readSettingsSchema();
      const overrides = readMigratedOverrides(settingsRoot, schema);
      return mergeDefaults(overrides, schema);
    },

    readOverrides(): Record<string, unknown> {
      return readMigratedOverrides(settingsRoot, readSettingsSchema());
    },

    update(updates: Record<string, unknown>): Record<string, unknown> {
      const schema = readSettingsSchema();
      const overrides = readMigratedOverrides(settingsRoot, schema);
      const schemaByKey = new Map(schema.map((s) => [s.key, s]));

      if (Object.prototype.hasOwnProperty.call(updates, 'secrets.provider')) {
        const nextBackend = updates['secrets.provider'];
        if (!isSecretBackendId(nextBackend)) {
          throw new Error(`Invalid value for setting "secrets.provider": ${JSON.stringify(nextBackend)}`);
        }
        migrateSecretBackend(nextBackend, root);
      }

      for (const [key, value] of Object.entries(updates)) {
        const setting = schemaByKey.get(key);
        if (setting && setting.type === 'boolean') {
          overrides[key] = Boolean(value);
        } else if (setting && setting.type === 'number') {
          const num = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(num)) {
            throw new Error(`Invalid value for numeric setting "${key}": ${JSON.stringify(value)}`);
          }
          overrides[key] = num;
        } else {
          overrides[key] = value;
        }
      }

      writeOverrides(overrides, settingsRoot);
      return mergeDefaults(overrides, schema);
    },

    reset(keys: string[]): Record<string, unknown> {
      const schema = readSettingsSchema();
      const overrides = readMigratedOverrides(settingsRoot, schema);
      for (const key of keys.map((entry) => entry.trim()).filter(Boolean)) {
        delete overrides[key];
      }
      writeOverrides(overrides, settingsRoot);
      return mergeDefaults(overrides, schema);
    },

    readSchema(): ExtensionSettingsRegistration[] {
      return readSettingsSchema();
    },
  };
}
