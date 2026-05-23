import { describe, expect, it } from 'vitest';

import { buildExtensionInstallRoutes } from './extensionInstallRoutes';

describe('extensionInstallRoutes', () => {
  it('builds page surface and main view routes only', () => {
    expect(
      buildExtensionInstallRoutes({
        surfaces: [
          { kind: 'page', route: '/page', id: 'surface-page' },
          { kind: 'toolPanel', route: '/tool', id: 'surface-tool' },
          { kind: 'page', id: 'surface-no-route' },
        ],
        views: [
          { location: 'main', route: '/view', id: 'view-main' },
          { location: 'sidebar', route: '/sidebar', id: 'view-sidebar' },
          { location: 'main', id: 'view-no-route' },
        ],
      }),
    ).toEqual([
      { route: '/page', surfaceId: 'surface-page' },
      { route: '/view', surfaceId: 'view-main' },
    ]);
  });
});
