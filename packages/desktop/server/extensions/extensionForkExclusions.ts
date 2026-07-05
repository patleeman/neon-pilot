const FORK_EXCLUDED_EXTENSION_IDS = new Set(['system-dynamic-workflows']);

export function isForkExcludedExtensionId(extensionId: string): boolean {
  return FORK_EXCLUDED_EXTENSION_IDS.has(extensionId);
}
