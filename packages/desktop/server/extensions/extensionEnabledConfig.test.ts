import { describe, expect, it } from 'vitest';

import { assertCanSetExtensionEnabled, buildExtensionEnabledConfigPatch, LOCKED_EXTENSION_IDS } from './extensionEnabledConfig';

describe('extensionEnabledConfig', () => {
  it('prevents disabling locked extensions', () => {
    expect(LOCKED_EXTENSION_IDS).toContain('system-settings');
    expect(() => assertCanSetExtensionEnabled({ extensionId: 'system-settings', enabled: false })).toThrow(
      'Cannot disable system-settings: this extension is required by the application.',
    );
    expect(() => assertCanSetExtensionEnabled({ extensionId: 'system-settings', enabled: true })).not.toThrow();
  });

  it('enables extensions and clears quarantine state', () => {
    expect(
      buildExtensionEnabledConfigPatch(
        { disabledIds: ['b', 'a'], enabledIds: ['c'], quarantined: { a: { reason: 'bad' }, c: { reason: 'bad' } } },
        { extensionId: 'a', enabled: true },
      ),
    ).toEqual({ disabledIds: ['b'], enabledIds: ['a', 'c'], quarantined: { c: { reason: 'bad' } } });
  });

  it('disables extensions and sorts ids', () => {
    expect(buildExtensionEnabledConfigPatch({ disabledIds: ['z'], enabledIds: ['a', 'b'] }, { extensionId: 'b', enabled: false })).toEqual({
      disabledIds: ['b', 'z'],
      enabledIds: ['a'],
      quarantined: {},
    });
  });
});
