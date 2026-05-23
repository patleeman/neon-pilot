import type { ExtensionPackageType } from './extensionManifest.js';
import type { ExtensionRegistryConfig } from './extensionRegistryConfig.js';

export interface ExtensionKeybindingConfigPatchInput {
  extensionId: string;
  keybindingId: string;
  title?: string;
  command?: string;
  args?: unknown;
  scope?: 'global' | 'surface';
  packageType?: ExtensionPackageType;
  keys?: string[];
  enabled?: boolean;
  reset?: boolean;
}

export function applyExtensionKeybindingConfigPatch(
  config: ExtensionRegistryConfig,
  input: ExtensionKeybindingConfigPatchInput,
): ExtensionRegistryConfig {
  const key = `${input.extensionId}:${input.keybindingId}`;
  const disabledKeybindings = new Set(config.disabledKeybindings ?? []);
  const keybindingOverrides = { ...(config.keybindingOverrides ?? {}) };
  const commandKeybindings = { ...(config.commandKeybindings ?? {}) };

  if (input.reset) {
    delete keybindingOverrides[key];
    delete commandKeybindings[key];
    disabledKeybindings.delete(key);
  }

  if (input.command && input.title) {
    commandKeybindings[key] = {
      extensionId: input.extensionId,
      surfaceId: input.keybindingId,
      title: input.title,
      command: input.command,
      ...(input.args !== undefined ? { args: input.args } : {}),
      scope: input.scope ?? 'global',
      ...(input.packageType ? { packageType: input.packageType } : {}),
      defaultKeys: [],
    };
  }

  if (input.keys) {
    const keys = input.keys.map((candidate) => candidate.trim()).filter(Boolean);
    if (keys.length > 0) {
      keybindingOverrides[key] = keys;
    }
  }

  if (input.enabled !== undefined) {
    if (input.enabled) {
      disabledKeybindings.delete(key);
    } else {
      disabledKeybindings.add(key);
    }
  }

  return {
    ...config,
    disabledKeybindings: [...disabledKeybindings].sort((left, right) => left.localeCompare(right)),
    keybindingOverrides,
    commandKeybindings,
  };
}
