import { type ExtensionPackageType } from './extensionManifest.js';

export function buildLegacyExtensionSlashCommandRegistrations(
  surfaces: Array<{
    kind: string;
    extensionId: string;
    id: string;
    packageType: ExtensionPackageType;
    name?: string;
    description?: string;
    action?: string;
  }>,
) {
  return surfaces.flatMap((surface) =>
    surface.kind === 'slashCommand' && surface.name && surface.action
      ? [
          {
            extensionId: surface.extensionId,
            surfaceId: surface.id,
            packageType: surface.packageType,
            name: surface.name,
            description: surface.description ?? '',
            action: surface.action,
          },
        ]
      : [],
  );
}

export function buildNativeExtensionSlashCommandRegistrations(
  extensions: Array<{
    id: string;
    packageType?: ExtensionPackageType;
    contributes?: { slashCommands?: Array<{ name: string; description: string; action: string }> };
  }>,
) {
  return extensions.flatMap((extension) =>
    (extension.contributes?.slashCommands ?? []).map((command) => ({
      extensionId: extension.id,
      surfaceId: command.name,
      packageType: extension.packageType ?? 'user',
      name: command.name,
      description: command.description,
      action: command.action,
    })),
  );
}
