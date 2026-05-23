export function buildExtensionAutoCommandRegistrations(extension: {
  id: string;
  name: string;
  packageType?: string;
  contributes?: {
    commands?: Array<{ id: string }>;
    nav?: Array<{ id: string; label: string; route: string; icon?: string }>;
    views?: Array<{ id: string; title: string; location?: string; icon?: string }>;
  };
}) {
  const explicitCommandIds = new Set((extension.contributes?.commands ?? []).map((command) => command.id));
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
        title: `Open ${view.title}`,
        action: 'rail.open',
        args: { extensionId: extension.id, surfaceId: view.id },
        ...(view.icon ? { icon: view.icon } : {}),
        category: extension.name,
      })),
  ];
  return autoCommands.filter((command) => !explicitCommandIds.has(command.surfaceId));
}
