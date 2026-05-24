import { describe, expect, it } from 'vitest';

import { buildCustomExtensionKeybindingRegistrations } from './extensionKeybindingCustomRegistrations';

describe('extensionKeybindingCustomRegistrations', () => {
  it('builds custom keybindings while skipping declared keys', () => {
    expect(
      buildCustomExtensionKeybindingRegistrations({
        commandKeybindings: {
          'ext:declared': { extensionId: 'ext', surfaceId: 'declared', title: 'Declared', command: 'cmd.declared', defaultKeys: ['A'] },
          'ext:custom': {
            extensionId: 'ext',
            surfaceId: 'custom',
            packageType: 'system',
            title: 'Custom',
            command: 'cmd.custom',
            args: { ok: true },
            scope: 'conversation',
            defaultKeys: ['B'],
          },
        },
        declaredKeys: new Set(['ext:declared']),
        disabledKeybindings: new Set(['ext:custom']),
        keybindingOverrides: { 'ext:custom': ['Cmd+B'] },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'custom',
        packageType: 'system',
        title: 'Custom',
        keys: ['Cmd+B'],
        command: 'cmd.custom',
        args: { ok: true },
        scope: 'global',
        defaultKeys: ['B'],
        enabled: false,
      },
    ]);
  });

  it('defaults host package type to system and other package types to user', () => {
    expect(
      buildCustomExtensionKeybindingRegistrations({
        commandKeybindings: {
          'host:one': { extensionId: 'host', surfaceId: 'one', title: 'Host', command: 'host.one' },
          'ext:two': { extensionId: 'ext', surfaceId: 'two', title: 'Ext', command: 'ext.two' },
        },
        declaredKeys: new Set(),
        disabledKeybindings: new Set(),
        keybindingOverrides: {},
      }),
    ).toEqual([
      {
        extensionId: 'host',
        surfaceId: 'one',
        packageType: 'system',
        title: 'Host',
        keys: [],
        command: 'host.one',
        scope: 'global',
        defaultKeys: [],
        enabled: true,
      },
      {
        extensionId: 'ext',
        surfaceId: 'two',
        packageType: 'user',
        title: 'Ext',
        keys: [],
        command: 'ext.two',
        scope: 'global',
        defaultKeys: [],
        enabled: true,
      },
    ]);
  });
});
