import { describe, expect, it } from 'vitest';

import { buildExtensionStartupGuardResult, buildExtensionStartupMarker } from './extensionStartupMarker';

describe('extensionStartupMarker', () => {
  it('builds startup marker JSON with trailing newline', () => {
    expect(buildExtensionStartupMarker('now')).toBe('{\n  "startedAt": "now"\n}\n');
  });

  it('builds startup guard results', () => {
    expect(buildExtensionStartupGuardResult({ safeMode: true, disabledIds: ['a'] })).toEqual({ safeMode: true, disabledIds: ['a'] });
  });
});
