import { describe, expect, it } from 'vitest';

import { buildExtensionFailureResponse, shouldQuarantineExtensionFailure } from './extensionFailureResponse';

describe('extensionFailureResponse', () => {
  it('builds failure responses', () => {
    expect(buildExtensionFailureResponse({ quarantined: false, failures: 2 })).toEqual({ quarantined: false, failures: 2 });
  });

  it('quarantines when failure count reaches threshold', () => {
    expect(shouldQuarantineExtensionFailure({ failureCount: 2, threshold: 3 })).toBe(false);
    expect(shouldQuarantineExtensionFailure({ failureCount: 3, threshold: 3 })).toBe(true);
    expect(shouldQuarantineExtensionFailure({ failureCount: 4, threshold: 3 })).toBe(true);
  });
});
