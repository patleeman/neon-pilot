import { describe, expect, it } from 'vitest';

import { buildExtensionRegistrationContext } from './extensionRegistrationContext';

describe('extensionRegistrationContext', () => {
  it('builds registration context with default user package type', () => {
    expect(buildExtensionRegistrationContext({ manifest: { id: 'ext' } })).toEqual({ extensionId: 'ext', packageType: 'user' });
  });

  it('preserves explicit package type', () => {
    expect(buildExtensionRegistrationContext({ manifest: { id: 'ext', packageType: 'system' } })).toEqual({
      extensionId: 'ext',
      packageType: 'system',
    });
  });
});
