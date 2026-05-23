export function buildExtensionPromptContextProviderRegistrations(entry: {
  manifest: {
    id: string;
    packageType?: string;
    contributes?: {
      promptContextProviders?: Array<PromptContextProviderContribution>;
      turnContextProviders?: Array<PromptContextProviderContribution>;
    };
  };
}) {
  return [
    ...(entry.manifest.contributes?.promptContextProviders ?? []),
    ...(entry.manifest.contributes?.turnContextProviders ?? []),
  ].flatMap((provider) => {
    const id = provider.id.trim();
    const handler = provider.handler.trim();
    if (!id || !handler) return [];
    return [
      {
        extensionId: entry.manifest.id,
        id,
        packageType: entry.manifest.packageType ?? 'user',
        handler,
        ...(provider.title ? { title: provider.title } : {}),
        ...('priority' in provider && Number.isInteger(provider.priority) ? { priority: provider.priority as number } : {}),
        ...('scope' in provider && Array.isArray(provider.scope)
          ? {
              scope: provider.scope.filter(
                (scope): scope is 'global' | 'workspace' | 'conversation' =>
                  scope === 'global' || scope === 'workspace' || scope === 'conversation',
              ),
            }
          : {}),
      },
    ];
  });
}

export function sortExtensionPromptContextProviderRegistrations<TProvider extends { priority?: number }>(
  providers: TProvider[],
): TProvider[] {
  return providers.sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
}

type PromptContextProviderContribution = {
  id: string;
  handler: string;
  title?: string;
  priority?: unknown;
  scope?: unknown;
};
