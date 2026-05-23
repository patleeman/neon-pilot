export interface ExtensionRegistrationContextLike {
  extensionId: string;
  packageType: string;
}

export function buildExtensionRegistrationContext(input: {
  manifest: { id: string; packageType?: string };
}): ExtensionRegistrationContextLike {
  return {
    extensionId: input.manifest.id,
    packageType: input.manifest.packageType ?? 'user',
  };
}
