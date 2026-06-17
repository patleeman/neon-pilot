import { type ExtensionPackageType } from './extensionManifest.js';

export function buildNativeExtensionSlashCommandRegistrations(
  extensions: Array<{
    id: string;
    packageType?: ExtensionPackageType;
    contributes?: { slashCommands?: Array<{ name: string; description: string; action: string }> };
  }>,
) {
  return extensions.flatMap((extension) => {
    const slashCommands = Array.isArray(extension.contributes?.slashCommands) ? extension.contributes?.slashCommands : [];
    return slashCommands.flatMap((command) => {
      if (!command || typeof command !== 'object') return [];
      const name = typeof command.name === 'string' ? command.name.trim() : '';
      const description = typeof command.description === 'string' ? command.description : '';
      const action = typeof command.action === 'string' ? command.action.trim() : '';
      if (!name || !action) return [];

      return [
        {
          extensionId: extension.id,
          surfaceId: name,
          packageType: extension.packageType ?? 'user',
          name,
          description,
          action,
        },
      ];
    });
  });
}
