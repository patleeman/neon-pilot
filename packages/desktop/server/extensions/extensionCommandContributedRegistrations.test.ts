import { describe, expect, it } from 'vitest';

import { buildExtensionContributedCommandRegistrations } from './extensionCommandContributedRegistrations';

describe('extensionCommandContributedRegistrations', () => {
  it('builds contributed command registrations with optional fields', () => {
    expect(
      buildExtensionContributedCommandRegistrations({
        id: 'ext',
        packageType: 'system',
        contributes: {
          commands: [
            {
              id: 'cmd',
              title: 'Command',
              action: 'do.thing',
              args: { ok: true },
              argsSchema: { type: 'object' },
              icon: 'zap',
              category: 'Tools',
              description: 'Does thing',
              enablement: 'when',
            },
          ],
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'cmd',
        packageType: 'system',
        title: 'Command',
        action: 'do.thing',
        args: { ok: true },
        argsSchema: { type: 'object' },
        icon: 'zap',
        category: 'Tools',
        description: 'Does thing',
        enablement: 'when',
      },
    ]);
  });

  it('defaults package type and omits absent optional fields', () => {
    expect(
      buildExtensionContributedCommandRegistrations({
        id: 'ext',
        contributes: { commands: [{ id: 'cmd', title: 'Command', action: 'do.thing' }] },
      }),
    ).toEqual([{ extensionId: 'ext', surfaceId: 'cmd', packageType: 'user', title: 'Command', action: 'do.thing' }]);
  });
});
