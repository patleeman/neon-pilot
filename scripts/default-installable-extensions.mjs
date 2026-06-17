export const defaultInstallableExtensionIds = ['system-dynamic-workflows'];

export function defaultInstallableBundleFileName(extensionId) {
  return `${extensionId}.neon-extension.zip`;
}

export const defaultInstallableBundleNames = defaultInstallableExtensionIds.map(defaultInstallableBundleFileName);
