import { describe, expect, it } from 'vitest';

import { applyExtensionKeybindingConfigPatch } from './extensionKeybindingConfig';

describe('extensionKeybindingConfig', () => {
  it('adds command keybindings, trims override keys, and enables a keybinding', () => {
    expect(
      applyExtensionKeybindingConfigPatch(
        { disabledKeybindings: ['ext:command:open'] },
        {
          extensionId: 'ext',
          keybindingId: 'command:open',
          title: 'Open',
          command: 'ext.open',
          args: { target: 'palette' },
          when: 'composer.focused',
          scope: 'surface',
          packageType: 'system',
          keys: [' mod+k ', '', 'mod+p'],
          enabled: true,
        },
      ),
    ).toEqual({
      disabledKeybindings: [],
      keybindingOverrides: { 'ext:command:open': ['mod+k', 'mod+p'] },
      commandKeybindings: {
        'ext:command:open': {
          extensionId: 'ext',
          surfaceId: 'command:open',
          title: 'Open',
          command: 'ext.open',
          args: { target: 'palette' },
          when: 'composer.focused',
          scope: 'surface',
          packageType: 'system',
          defaultKeys: [],
        },
      },
    });
  });

  it('resets existing overrides and custom command keybindings before applying disable state', () => {
    expect(
      applyExtensionKeybindingConfigPatch(
        {
          disabledKeybindings: ['b:key'],
          keybindingOverrides: { 'ext:key': ['old'], keep: ['mod+x'] },
          commandKeybindings: {
            'ext:key': { extensionId: 'ext', surfaceId: 'key', title: 'Old', command: 'ext.old', scope: 'global', defaultKeys: [] },
          },
        },
        { extensionId: 'ext', keybindingId: 'key', reset: true, enabled: false },
      ),
    ).toEqual({
      disabledKeybindings: ['b:key', 'ext:key'],
      keybindingOverrides: { keep: ['mod+x'] },
      commandKeybindings: {},
    });
  });
});
