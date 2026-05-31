export const EXTENSION_REGISTRY_CHANGED_EVENT = 'neon-pilot-extension-registry-changed';

let extensionRegistryRevision = Date.now();

export function getExtensionRegistryRevision(): number {
  return extensionRegistryRevision;
}

export function notifyExtensionRegistryChanged(): void {
  extensionRegistryRevision += 1;
  window.dispatchEvent(new CustomEvent(EXTENSION_REGISTRY_CHANGED_EVENT, { detail: { revision: extensionRegistryRevision } }));
}
