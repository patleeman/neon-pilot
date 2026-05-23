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
  return (extension.contributes?.commands ?? []).map((command) => ({
    extensionId: extension.id,
    surfaceId: command.id,
    packageType: extension.packageType ?? 'user',
    title: command.title,
    action: command.action,
    ...(command.args !== undefined ? { args: command.args } : {}),
    ...(command.argsSchema !== undefined ? { argsSchema: command.argsSchema } : {}),
    ...(command.icon ? { icon: command.icon } : {}),
    ...(command.category ? { category: command.category } : {}),
    ...(command.description ? { description: command.description } : {}),
    ...(command.enablement ? { enablement: command.enablement } : {}),
  }));
}
