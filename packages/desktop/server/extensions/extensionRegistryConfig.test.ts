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
            when: ' workspace.open ',
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
        buildErrors: {
          broken: 'esbuild failed',
          ignored: '',
          ignoredNonString: 12,
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
          when: 'workspace.open',
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
      revokedPermissions: {},
      buildErrors: {
        broken: 'esbuild failed',
      },
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
      revokedPermissions: {},
      buildErrors: {},
    });
  });

  describe('revokedPermissions normalization', () => {
    it('normalizes valid revoked permission entries', () => {
      const result = normalizeExtensionRegistryConfig({
        revokedPermissions: {
          'ext-a': ['agent:run', 'storage:read'],
          'ext-b': ['shell:execute'],
        },
      });
      expect(result.revokedPermissions).toEqual({
        'ext-a': ['agent:run', 'storage:read'],
        'ext-b': ['shell:execute'],
      });
    });

    it('drops unknown permission values from revoked lists', () => {
      const result = normalizeExtensionRegistryConfig({
        revokedPermissions: {
          ext: ['agent:run', 'unknown:perm', 'storage:read', 'also:bad'],
        },
      });
      expect(result.revokedPermissions).toEqual({
        ext: ['agent:run', 'storage:read'],
      });
    });

    it('removes extension entries whose revoked list is entirely unknown permissions', () => {
      const result = normalizeExtensionRegistryConfig({
        revokedPermissions: {
          'ext-a': ['unknown:one', 'unknown:two'],
          'ext-b': ['agent:run'],
        },
      });
      expect(result.revokedPermissions).toEqual({
        'ext-b': ['agent:run'],
      });
    });

    it('removes non-string values from revoked arrays', () => {
      const result = normalizeExtensionRegistryConfig({
        revokedPermissions: {
          ext: ['agent:run', 123 as unknown as string, null as unknown as string, 'storage:write'],
        },
      });
      expect(result.revokedPermissions).toEqual({
        ext: ['agent:run', 'storage:write'],
      });
    });

    it('handles revokedPermissions that is not a record gracefully', () => {
      const result = normalizeExtensionRegistryConfig({
        revokedPermissions: 'not-a-record',
      });
      expect(result.revokedPermissions).toEqual({});

      const result2 = normalizeExtensionRegistryConfig({
        revokedPermissions: null,
      });
      expect(result2.revokedPermissions).toEqual({});
    });
  });
});
