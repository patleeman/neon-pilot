import { describe, expect, it } from 'vitest';

import { DEFAULT_RUNTIME_SCOPE, getAssemblyRuntimeScope } from './runtimeScope.js';

describe('runtimeScope', () => {
  it('prefers explicit runtime scope, then legacy profile, then shared default', () => {
    expect(DEFAULT_RUNTIME_SCOPE).toBe('shared');
    expect(getAssemblyRuntimeScope({ runtimeScope: 'runtime', profile: 'profile' })).toBe('runtime');
    expect(getAssemblyRuntimeScope({ runtimeScope: '', profile: 'profile' })).toBe('profile');
    expect(getAssemblyRuntimeScope({ runtimeScope: undefined, profile: undefined })).toBe('shared');
  });
});
