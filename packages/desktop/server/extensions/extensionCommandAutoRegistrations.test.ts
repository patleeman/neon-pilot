import { describe, expect, it } from 'vitest';

import { buildExtensionAutoCommandRegistrations } from './extensionCommandAutoRegistrations';

describe('extensionCommandAutoRegistrations', () => {
  it('builds nav and right-rail auto commands while skipping explicit ids', () => {
    expect(
      buildExtensionAutoCommandRegistrations({
        id: 'ext',
        name: 'Extension',
        packageType: 'system',
        contributes: {
          commands: [{ id: 'open-nav' }],
          nav: [{ id: 'nav', label: 'Nav', route: '/nav', icon: 'spark' }],
          views: [
            { id: 'rail', title: 'Rail', location: 'rightRail', icon: 'panel' },
            { id: 'main', title: 'Main', location: 'main' },
          ],
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'open-rail',
        packageType: 'system',
        title: 'Open Rail panel',
        action: 'rail.open',
        args: { extensionId: 'ext', surfaceId: 'rail' },
        icon: 'panel',
        category: 'Extension',
      },
    ]);
  });

  it('skips auto commands when an explicit command already performs the same action', () => {
    expect(
      buildExtensionAutoCommandRegistrations({
        id: 'system-settings',
        name: 'Settings panels',
        packageType: 'system',
        contributes: {
          commands: [
            {
              id: 'open-settings',
              action: 'app.navigate',
              args: { to: '/settings' },
            },
            {
              id: 'open-browser',
              action: 'rail.open',
              args: { extensionId: 'system-settings', surfaceId: 'settings-rail' },
            },
          ],
          nav: [{ id: 'settings-nav', label: 'Settings', route: '/settings', icon: 'gear' }],
          views: [{ id: 'settings-rail', title: 'Settings', location: 'rightRail', icon: 'panel' }],
        },
      }),
    ).toEqual([]);
  });
});
