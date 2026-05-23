export function buildExtensionInstallRoutes(input: {
  surfaces?: Array<{ kind?: string; route?: string; id: string }>;
  views?: Array<{ location?: string; route?: string; id: string }>;
}): Array<{ route: string; surfaceId: string }> {
  return [
    ...(input.surfaces ?? []).flatMap((surface) =>
      surface.kind === 'page' && typeof surface.route === 'string' ? [{ route: surface.route, surfaceId: surface.id }] : [],
    ),
    ...(input.views ?? []).flatMap((view) =>
      view.location === 'main' && typeof view.route === 'string' ? [{ route: view.route, surfaceId: view.id }] : [],
    ),
  ];
}
