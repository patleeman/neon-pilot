import type { ExtensionPackageType } from './extensionManifest.js';

export interface ExtensionRegistryConfig {
  disabledIds?: string[];
  enabledIds?: string[];
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
      scope?: 'global' | 'surface';
      defaultKeys?: string[];
    }
  >;
  quarantined?: Record<string, { reason: string; at: string; failures: number }>;
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

  return { disabledIds, enabledIds, disabledKeybindings, keybindingOverrides, commandKeybindings, quarantined };
}

export function serializeExtensionRegistryConfig(config: ExtensionRegistryConfig): string {
  return `${JSON.stringify(
    {
      disabledIds: config.disabledIds ?? [],
      enabledIds: config.enabledIds ?? [],
      disabledKeybindings: config.disabledKeybindings ?? [],
      keybindingOverrides: config.keybindingOverrides ?? {},
      commandKeybindings: config.commandKeybindings ?? {},
      quarantined: config.quarantined ?? {},
    },
    null,
    2,
  )}\n`;
}
