import { describe, expect, it } from 'vitest';

import { buildDeclaredExtensionKeybindingRegistrations } from './extensionKeybindingDeclaredRegistrations';

describe('extensionKeybindingDeclaredRegistrations', () => {
  it('trims values, applies overrides, and reports disabled state', () => {
    expect(
      buildDeclaredExtensionKeybindingRegistrations({
        extension: {
          id: 'ext',
          packageType: 'system',
          contributes: {
            keybindings: [
              {
                id: ' run ',
                title: ' Run ',
                command: ' cmd.run ',
                keys: [' Ctrl+R ', ' '],
                args: { ok: true },
                when: 'editor',
                scope: 'conversation',
              },
            ],
          },
        },
        disabledKeybindings: new Set(['ext:run']),
        keybindingOverrides: { 'ext:run': ['Cmd+R'] },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'run',
        packageType: 'system',
        title: 'Run',
        keys: ['Cmd+R'],
        command: 'cmd.run',
        args: { ok: true },
        when: 'editor',
        scope: 'conversation',
        defaultKeys: ['Ctrl+R'],
        enabled: false,
      },
    ]);
  });

  it('drops incomplete keybindings and defaults package type and scope', () => {
    expect(
      buildDeclaredExtensionKeybindingRegistrations({
        extension: {
          id: 'ext',
          contributes: {
            keybindings: [
              { id: ' ', title: 'No id', command: 'cmd', keys: ['A'] },
              { id: 'missing-title', title: ' ', command: 'cmd', keys: ['A'] },
              { id: 'missing-command', title: 'Title', command: ' ', keys: ['A'] },
              { id: 'missing-keys', title: 'Title', command: 'cmd', keys: [' '] },
              { id: 'ok', title: 'Ok', command: 'cmd.ok', keys: ['K'] },
            ],
          },
        },
        disabledKeybindings: new Set(),
        keybindingOverrides: {},
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        surfaceId: 'ok',
        packageType: 'user',
        title: 'Ok',
        keys: ['K'],
        command: 'cmd.ok',
        scope: 'global',
        defaultKeys: ['K'],
        enabled: true,
      },
    ]);
  });
});
