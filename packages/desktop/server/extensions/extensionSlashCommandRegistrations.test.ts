import { describe, expect, it } from 'vitest';

import {
  buildLegacyExtensionSlashCommandRegistrations,
  buildNativeExtensionSlashCommandRegistrations,
} from './extensionSlashCommandRegistrations';

describe('extensionSlashCommandRegistrations', () => {
  it('builds legacy slash command registrations from slash command surfaces only', () => {
    expect(
      buildLegacyExtensionSlashCommandRegistrations([
        {
          kind: 'slashCommand',
          extensionId: 'ext',
          id: 'ask',
          packageType: 'system',
          name: 'ask',
          description: 'Ask',
          action: 'ask.run',
        },
        { kind: 'command', extensionId: 'ext', id: 'cmd', packageType: 'system' },
      ]),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'ask',
        packageType: 'system',
        name: 'ask',
        description: 'Ask',
        action: 'ask.run',
      },
    ]);
  });

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
});
