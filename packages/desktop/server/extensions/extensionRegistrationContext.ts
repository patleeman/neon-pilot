import { type ExtensionPackageType } from './extensionManifest.js';

export interface ExtensionRegistrationContextLike {
  extensionId: string;
  packageType: ExtensionPackageType;
}

export function buildExtensionRegistrationContext(input: {
  manifest: { id: string; packageType?: ExtensionPackageType };
}): ExtensionRegistrationContextLike {
  return {
    extensionId: input.manifest.id,
    packageType: input.manifest.packageType ?? 'user',
  };
}
