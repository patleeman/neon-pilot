import { type ExtensionPackageType } from './extensionManifest.js';

export function buildExtensionContributedCommandRegistrations(extension: {
  id: string;
  packageType?: ExtensionPackageType;
  contributes?: {
    commands?: Array<{
      id: string;
      title: string;
      action: string;
      args?: unknown;
      argsSchema?: unknown;
      icon?: string;
      category?: string;
      description?: string;
      enablement?: string;
    }>;
  };
}) {
  return (extension.contributes?.commands ?? []).flatMap((command) => {
    const id = command.id.trim();
    const title = command.title.trim();
    const action = command.action.trim();
    if (!id || !title || !action) return [];
    return [
      {
        extensionId: extension.id,
        surfaceId: id,
        packageType: extension.packageType ?? 'user',
        title,
        action,
        ...(command.args !== undefined ? { args: command.args } : {}),
        ...(command.argsSchema !== undefined ? { argsSchema: command.argsSchema } : {}),
        ...(command.icon?.trim() ? { icon: command.icon.trim() } : {}),
        ...(command.category?.trim() ? { category: command.category.trim() } : {}),
        ...(command.description?.trim() ? { description: command.description.trim() } : {}),
        ...(command.enablement?.trim() ? { enablement: command.enablement.trim() } : {}),
      },
    ];
  });
}
