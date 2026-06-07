import { describe, expect, it } from 'vitest';

import { buildExtensionStartupGuardResult, buildExtensionStartupMarker, parseExtensionStartupMarker } from './extensionStartupMarker';

describe('extensionStartupMarker', () => {
  it('builds startup marker JSON with trailing newline', () => {
    expect(buildExtensionStartupMarker('now')).toBe('{\n  "startedAt": "now"\n}\n');
    expect(buildExtensionStartupMarker('now', 'ext')).toBe('{\n  "startedAt": "now",\n  "activeExtensionId": "ext"\n}\n');
  });

  it('parses startup marker suspects defensively', () => {
    expect(parseExtensionStartupMarker('{"startedAt":"now","activeExtensionId":" ext "}')).toEqual({
      startedAt: 'now',
      activeExtensionId: 'ext',
    });
    expect(parseExtensionStartupMarker('not json')).toBeNull();
  });

  it('builds startup guard results', () => {
    expect(buildExtensionStartupGuardResult({ safeMode: true, disabledIds: ['a'] })).toEqual({ safeMode: true, disabledIds: ['a'] });
  });
});
