export interface ExtensionDependencyContribution {
  id: string;
  optional?: boolean;
  version?: string;
}

export interface NormalizedExtensionDependency {
  id: string;
  optional: boolean;
}

export function normalizeExtensionDependency(dependency: string | ExtensionDependencyContribution): NormalizedExtensionDependency {
  return typeof dependency === 'string'
    ? { id: dependency, optional: false }
    : { id: dependency.id, optional: Boolean(dependency.optional) };
}

export function listMissingRequiredExtensionDependencies(
  dependencies: Array<string | ExtensionDependencyContribution>,
  installedIds: Iterable<string>,
): string[] {
  const installed = new Set(installedIds);
  return dependencies
    .map(normalizeExtensionDependency)
    .filter((dependency) => !dependency.optional && !installed.has(dependency.id))
    .map((dependency) => `Missing required extension dependency: ${dependency.id}`);
}
