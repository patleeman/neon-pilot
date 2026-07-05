import { describe, expect, it } from 'vitest';

import { getExtensionCompatibilityError, satisfiesVersionRange } from './extensionCompatibility.js';

describe('extension compatibility', () => {
  it('enforces bounded Neon Pilot compatibility ranges', () => {
    expect(satisfiesVersionRange('0.10.9', '>=0.10.0 <0.11.0')).toBe(true);
    expect(satisfiesVersionRange('0.11.0', '>=0.10.0 <0.11.0')).toBe(false);
    expect(satisfiesVersionRange('0.11.7', '>=0.10.0 <0.11.0')).toBe(false);
  });

  it('allows forward-open ranges used by extensions that span releases', () => {
    expect(satisfiesVersionRange('0.11.7', '>=0.10.0')).toBe(true);
    expect(satisfiesVersionRange('0.11.7', '*')).toBe(true);
    expect(satisfiesVersionRange('0.11.7', 'x')).toBe(true);
  });

  it('compares prerelease versions according to semver ordering', () => {
    expect(satisfiesVersionRange('0.11.0-rc.1', '>=0.11.0-rc.1 <0.11.0')).toBe(true);
    expect(satisfiesVersionRange('0.11.0-rc.1', '>=0.11.0')).toBe(false);
    expect(satisfiesVersionRange('0.11.0', '>=0.11.0-rc.1')).toBe(true);
  });

  it('returns null for malformed versions or unsupported ranges instead of failing closed', () => {
    expect(satisfiesVersionRange('testing', '>=0.10.0')).toBe(null);
    expect(satisfiesVersionRange('0.11.7', '^0.11.0')).toBe(null);
    expect(satisfiesVersionRange('0.11.7', '>=0.10')).toBe(null);
  });

  it('formats app package compatibility errors with the effective app version', () => {
    expect(
      getExtensionCompatibilityError(
        { id: 'system-writing-studio', name: 'Writing Studio', compatibility: { neonPilot: '>=0.10.0 <0.11.0' } },
        '0.11.7',
      ),
    ).toBe('App package "Writing Studio" requires Neon Pilot >=0.10.0 <0.11.0, but this app is 0.11.7.');
    expect(
      getExtensionCompatibilityError(
        { id: 'system-writing-studio', name: 'Writing Studio', compatibility: { neonPilot: '>=0.10.0' } },
        '0.11.7',
      ),
    ).toBeNull();
  });
});
