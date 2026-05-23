import { describe, expect, it } from 'vitest';

import { findExtensionCommandRegistration, isExtensionCommandRegistrationMatch } from './extensionCommandLookup';

describe('extensionCommandLookup', () => {
  const commands = [
    { extensionId: 'ext', surfaceId: 'cmd' },
    { extensionId: 'other', surfaceId: 'cmd' },
  ];

  it('matches fully-qualified command ids and surface ids', () => {
    expect(isExtensionCommandRegistrationMatch(commands[0], 'ext.cmd')).toBe(true);
    expect(isExtensionCommandRegistrationMatch(commands[0], 'cmd')).toBe(true);
    expect(isExtensionCommandRegistrationMatch(commands[0], 'other.cmd')).toBe(false);
  });

  it('finds the first matching command registration', () => {
    expect(findExtensionCommandRegistration(commands, 'ext.cmd')).toBe(commands[0]);
    expect(findExtensionCommandRegistration(commands, 'cmd')).toBe(commands[0]);
    expect(findExtensionCommandRegistration(commands, 'missing')).toBeUndefined();
  });
});
