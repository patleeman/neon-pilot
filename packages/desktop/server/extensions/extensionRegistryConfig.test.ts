import { describe, expect, it } from 'vitest';

import { normalizeExtensionRegistryConfig, serializeExtensionRegistryConfig } from './extensionRegistryConfig';

describe('extensionRegistryConfig', () => {
  it('normalizes registry config arrays, command keybindings, and quarantine entries', () => {
    expect(
      normalizeExtensionRegistryConfig({
        disabledIds: ['a', 1, 'b'],
        enabledIds: ['c', null],
        disabledKeybindings: ['kb', false],
        keybindingOverrides: { one: ['mod+k', 1], ignored: 'bad' },
        commandKeybindings: {
          good: {
            extensionId: 'ext',
            surfaceId: 'surface',
            title: 'Title',
            command: 'run',
            args: { ok: true },
            scope: 'surface',
            defaultKeys: ['mod+r', 3],
            packageType: 'system',
          },
          missing: { extensionId: 'ext' },
        },
        quarantined: {
          ext: { reason: 'boom', at: '2026-05-23T00:00:00.000Z', failures: 2 },
          fallbackFailures: { reason: 'warn', at: '2026-05-23T00:00:00.000Z', failures: 'bad' },
          ignored: { reason: 'missing at' },
        },
      }),
    ).toEqual({
      disabledIds: ['a', 'b'],
      enabledIds: ['c'],
      disabledKeybindings: ['kb'],
      keybindingOverrides: { one: ['mod+k'] },
      commandKeybindings: {
        good: {
          extensionId: 'ext',
          surfaceId: 'surface',
          title: 'Title',
          command: 'run',
          args: { ok: true },
          scope: 'surface',
          defaultKeys: ['mod+r'],
          packageType: 'system',
        },
      },
      quarantined: {
        ext: { reason: 'boom', at: '2026-05-23T00:00:00.000Z', failures: 2 },
        fallbackFailures: { reason: 'warn', at: '2026-05-23T00:00:00.000Z', failures: 0 },
      },
      removedDefaultInstalledIds: [],
    });
  });

  it('returns an empty config for non-object values', () => {
    expect(normalizeExtensionRegistryConfig(null)).toEqual({});
    expect(normalizeExtensionRegistryConfig([])).toEqual({});
  });

  it('serializes config with stable empty defaults', () => {
    expect(JSON.parse(serializeExtensionRegistryConfig({ disabledIds: ['ext'] }))).toEqual({
      disabledIds: ['ext'],
      enabledIds: [],
      disabledKeybindings: [],
      keybindingOverrides: {},
      commandKeybindings: {},
      quarantined: {},
      removedDefaultInstalledIds: [],
    });
  });
});
