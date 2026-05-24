export function buildExtensionAssemblyProviderRegistrations(entry: {
  manifest: {
    id: string;
    packageType?: string;
    contributes?: Partial<Record<AssemblyProviderField, AssemblyProviderContribution[]>>;
  };
}) {
  const fields = [
    ['skillProviders', 'skills'],
    ['toolProviders', 'tools'],
    ['promptTemplateProviders', 'promptTemplates'],
    ['instructionProviders', 'instructions'],
  ] as const;
  return fields.flatMap(([field, kind]) =>
    (entry.manifest.contributes?.[field] ?? []).flatMap((provider) => {
      const id = provider.id.trim();
      const handler = provider.handler.trim();
      if (!id || !handler) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          handler,
          kind,
          ...(provider.title ? { title: provider.title } : {}),
          ...(Number.isInteger(provider.priority) ? { priority: provider.priority as number } : {}),
        },
      ];
    }),
  );
}

export function sortExtensionAssemblyProviderRegistrations<TProvider extends { priority?: number; id: string }>(
  providers: TProvider[],
): TProvider[] {
  return providers.sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id));
}

type AssemblyProviderField = 'skillProviders' | 'toolProviders' | 'promptTemplateProviders' | 'instructionProviders';

type AssemblyProviderContribution = {
  id: string;
  handler: string;
  title?: string;
  priority?: unknown;
};
