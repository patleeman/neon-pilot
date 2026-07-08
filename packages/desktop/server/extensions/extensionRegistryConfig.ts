import type { ExtensionPackageType } from './extensionManifest.js';
import { EXTENSION_PERMISSIONS } from './extensionManifest.js';

const KNOWN_EXTENSION_PERMISSIONS = new Set<string>(EXTENSION_PERMISSIONS);

export interface ExtensionRegistryConfig {
  disabledIds?: string[];
  enabledIds?: string[];
  removedDefaultInstalledIds?: string[];
  disabledKeybindings?: string[];
  keybindingOverrides?: Record<string, string[]>;
  commandKeybindings?: Record<
    string,
    {
      extensionId: string;
      surfaceId: string;
      packageType?: ExtensionPackageType;
      title: string;
      command: string;
      args?: unknown;
      when?: string;
      scope?: 'global' | 'surface';
      defaultKeys?: string[];
    }
  >;
  quarantined?: Record<string, { reason: string; at: string; failures: number }>;
  revokedPermissions?: Record<string, string[]>;
  buildErrors?: Record<string, string>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeExtensionRegistryConfig(value: unknown): ExtensionRegistryConfig {
  if (!isRecord(value)) {
    return {};
  }

  const disabledIds = Array.isArray(value.disabledIds) ? value.disabledIds.filter((id): id is string => typeof id === 'string') : [];
  const enabledIds = Array.isArray(value.enabledIds) ? value.enabledIds.filter((id): id is string => typeof id === 'string') : [];
  const removedDefaultInstalledIds = Array.isArray(value.removedDefaultInstalledIds)
    ? value.removedDefaultInstalledIds.filter((id): id is string => typeof id === 'string')
    : [];
  const disabledKeybindings = Array.isArray(value.disabledKeybindings)
    ? value.disabledKeybindings.filter((id): id is string => typeof id === 'string')
    : [];
  const keybindingOverrides = isRecord(value.keybindingOverrides)
    ? Object.fromEntries(
        Object.entries(value.keybindingOverrides).flatMap(([id, keys]) =>
          Array.isArray(keys) ? [[id, keys.filter((key): key is string => typeof key === 'string')]] : [],
        ),
      )
    : {};
  const commandKeybindings = isRecord(value.commandKeybindings)
    ? Object.fromEntries(
        Object.entries(value.commandKeybindings).flatMap(([id, commandValue]) => {
          if (!isRecord(commandValue)) return [];
          if (typeof commandValue.extensionId !== 'string' || typeof commandValue.surfaceId !== 'string') return [];
          if (typeof commandValue.title !== 'string' || typeof commandValue.command !== 'string') return [];
          const scope = commandValue.scope === 'surface' ? 'surface' : 'global';
          const defaultKeys = Array.isArray(commandValue.defaultKeys)
            ? commandValue.defaultKeys.filter((key): key is string => typeof key === 'string')
            : [];
          const packageType = commandValue.packageType === 'system' ? 'system' : commandValue.packageType === 'user' ? 'user' : undefined;
          const entry: NonNullable<ExtensionRegistryConfig['commandKeybindings']>[string] = {
            extensionId: commandValue.extensionId,
            surfaceId: commandValue.surfaceId,
            title: commandValue.title,
            command: commandValue.command,
            ...(commandValue.args !== undefined ? { args: commandValue.args } : {}),
            ...(typeof commandValue.when === 'string' && commandValue.when.trim() ? { when: commandValue.when.trim() } : {}),
            scope,
            defaultKeys,
            ...(packageType ? { packageType } : {}),
          };
          return [[id, entry]];
        }),
      )
    : {};
  const quarantined = isRecord(value.quarantined)
    ? Object.fromEntries(
        Object.entries(value.quarantined).flatMap(([id, quarantineValue]) => {
          if (!isRecord(quarantineValue) || typeof quarantineValue.reason !== 'string' || typeof quarantineValue.at !== 'string') return [];
          return [
            [
              id,
              {
                reason: quarantineValue.reason,
                at: quarantineValue.at,
                failures: typeof quarantineValue.failures === 'number' ? quarantineValue.failures : 0,
              },
            ],
          ];
        }),
      )
    : {};

  const revokedPermissions = isRecord(value.revokedPermissions)
    ? Object.fromEntries(
        Object.entries(value.revokedPermissions).flatMap(([extId, perms]) => {
          if (typeof extId !== 'string' || !Array.isArray(perms)) return [];
          const filtered = perms.filter((p): p is string => typeof p === 'string' && KNOWN_EXTENSION_PERMISSIONS.has(p));
          return filtered.length > 0 ? [[extId, filtered]] : [];
        }),
      )
    : {};

  const buildErrors = isRecord(value.buildErrors)
    ? Object.fromEntries(
        Object.entries(value.buildErrors).flatMap(([extId, error]) =>
          typeof extId === 'string' && typeof error === 'string' && error.trim().length > 0 ? [[extId, error]] : [],
        ),
      )
    : {};

  return {
    disabledIds,
    enabledIds,
    removedDefaultInstalledIds,
    disabledKeybindings,
    keybindingOverrides,
    commandKeybindings,
    quarantined,
    revokedPermissions,
    buildErrors,
  };
}

export function serializeExtensionRegistryConfig(config: ExtensionRegistryConfig): string {
  return `${JSON.stringify(
    {
      disabledIds: config.disabledIds ?? [],
      enabledIds: config.enabledIds ?? [],
      removedDefaultInstalledIds: config.removedDefaultInstalledIds ?? [],
      disabledKeybindings: config.disabledKeybindings ?? [],
      keybindingOverrides: config.keybindingOverrides ?? {},
      commandKeybindings: config.commandKeybindings ?? {},
      quarantined: config.quarantined ?? {},
      revokedPermissions: config.revokedPermissions ?? {},
      buildErrors: config.buildErrors ?? {},
    },
    null,
    2,
  )}\n`;
}
