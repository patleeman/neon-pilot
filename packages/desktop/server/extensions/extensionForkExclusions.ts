const FORK_EXCLUDED_EXTENSION_IDS = new Set<string>();

export function isForkExcludedExtensionId(extensionId: string): boolean {
  return FORK_EXCLUDED_EXTENSION_IDS.has(extensionId);
}
