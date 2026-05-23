export function buildExtensionRuntimeProviderRegistrations(entry: {
  manifest: {
    id: string;
    packageType?: string;
    contributes?: {
      runtimeProviders?: Array<{
        id: string;
        handler: string;
        title: string;
        description?: string;
      }>;
    };
  };
}) {
  return (entry.manifest.contributes?.runtimeProviders ?? []).flatMap((provider) => {
    const id = provider.id.trim();
    const handler = provider.handler.trim();
    const title = provider.title.trim();
    if (!id || !handler || !title) return [];
    return [
      {
        extensionId: entry.manifest.id,
        id,
        packageType: entry.manifest.packageType ?? 'user',
        handler,
        title,
        ...(provider.description ? { description: provider.description } : {}),
      },
    ];
  });
}
