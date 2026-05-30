export const LOCKED_EXTENSION_IDS = [
  'system-extension-manager',
  'system-prompt-assembly',
  'system-runs',
  'system-settings',
  'system-terminal',
];

export function assertCanSetExtensionEnabled(input: {
  extensionId: string;
  enabled: boolean;
  lockedExtensionIds?: readonly string[];
}): void {
  const lockedExtensionIds = input.lockedExtensionIds ?? LOCKED_EXTENSION_IDS;
  if (!input.enabled && lockedExtensionIds.includes(input.extensionId)) {
    throw new Error(`Cannot disable ${input.extensionId}: this extension is required by the application.`);
  }
}

export function buildExtensionEnabledConfigPatch<
  TConfig extends { disabledIds?: string[]; enabledIds?: string[]; quarantined?: Record<string, unknown> },
>(
  config: TConfig,
  input: { extensionId: string; enabled: boolean },
): TConfig & { disabledIds: string[]; enabledIds: string[]; quarantined: Record<string, unknown> } {
  const disabledIds = new Set(config.disabledIds ?? []);
  const enabledIds = new Set(config.enabledIds ?? []);
  const quarantined = { ...(config.quarantined ?? {}) };
  if (input.enabled) {
    disabledIds.delete(input.extensionId);
    enabledIds.add(input.extensionId);
    delete quarantined[input.extensionId];
  } else {
    disabledIds.add(input.extensionId);
    enabledIds.delete(input.extensionId);
  }

  return {
    ...config,
    disabledIds: [...disabledIds].sort((left, right) => left.localeCompare(right)),
    enabledIds: [...enabledIds].sort((left, right) => left.localeCompare(right)),
    quarantined,
  };
}
