import { type ExtensionPackageType } from './extensionManifest.js';

export function buildExtensionAutoCommandRegistrations(extension: {
  id: string;
  name: string;
  packageType?: ExtensionPackageType;
  contributes?: {
    commands?: Array<{ id: string; action?: string; args?: unknown }>;
    nav?: Array<{ id: string; label: string; route: string; icon?: string }>;
    views?: Array<{ id: string; title: string; location?: string; icon?: string }>;
  };
}) {
  const explicitCommandIds = new Set((extension.contributes?.commands ?? []).map((command) => command.id));
  const explicitCommandSignatures = new Set(
    (extension.contributes?.commands ?? [])
      .filter((command): command is { id: string; action: string; args?: unknown } => typeof command.action === 'string')
      .map((command) => commandSignature(command.action, command.args)),
  );
  const autoCommands = [
    ...(extension.contributes?.nav ?? []).map((nav) => ({
      extensionId: extension.id,
      surfaceId: `open-${nav.id}`,
      packageType: extension.packageType ?? 'user',
      title: `Open ${nav.label}`,
      action: 'app.navigate',
      args: { to: nav.route },
      ...(nav.icon ? { icon: nav.icon } : {}),
      category: extension.name,
    })),
    ...(extension.contributes?.views ?? [])
      .filter((view) => view.location === 'rightRail')
      .map((view) => ({
        extensionId: extension.id,
        surfaceId: `open-${view.id}`,
        packageType: extension.packageType ?? 'user',
        title: `Open ${view.title} panel`,
        action: 'rail.open',
        args: { extensionId: extension.id, surfaceId: view.id },
        ...(view.icon ? { icon: view.icon } : {}),
        category: extension.name,
      })),
  ];
  return autoCommands.filter(
    (command) =>
      !explicitCommandIds.has(command.surfaceId) && !explicitCommandSignatures.has(commandSignature(command.action, command.args)),
  );
}

function commandSignature(action: string, args: unknown): string {
  return `${action}:${stableCommandArgsString(args)}`;
}

function stableCommandArgsString(value: unknown): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(stableCommandArgsString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableCommandArgsString(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
