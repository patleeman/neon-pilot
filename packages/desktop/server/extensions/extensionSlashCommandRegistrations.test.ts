import { describe, expect, it } from 'vitest';

import { buildNativeExtensionSlashCommandRegistrations } from './extensionSlashCommandRegistrations';

describe('extensionSlashCommandRegistrations', () => {
  it('builds native slash command registrations and defaults package type', () => {
    expect(
      buildNativeExtensionSlashCommandRegistrations([
        {
          id: 'ext',
          contributes: { slashCommands: [{ name: 'ask', description: 'Ask', action: 'ask.run' }] },
        },
      ]),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'ask',
        packageType: 'user',
        name: 'ask',
        description: 'Ask',
        action: 'ask.run',
      },
    ]);
  });

  it('skips malformed native slash command contributions', () => {
    expect(
      buildNativeExtensionSlashCommandRegistrations([
        {
          id: 'ext',
          contributes: {
            // @ts-expect-error testing runtime robustness
            slashCommands: null,
          },
        },
        {
          id: 'ext-2',
          contributes: {
            // @ts-expect-error testing runtime robustness
            slashCommands: [{ name: '   valid ', action: ' run ', description: 'works' }, null, { name: 'bad', action: '' }],
          },
        },
      ]),
    ).toEqual([
      {
        extensionId: 'ext-2',
        surfaceId: 'valid',
        packageType: 'user',
        name: 'valid',
        description: 'works',
        action: 'run',
      },
    ]);
  });
});
