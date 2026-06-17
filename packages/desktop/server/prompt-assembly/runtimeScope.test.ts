import { describe, expect, it } from 'vitest';

import { DEFAULT_RUNTIME_SCOPE, getAssemblyRuntimeScope } from './runtimeScope.js';

describe('runtimeScope', () => {
  it('prefers explicit runtime scope and otherwise uses the shared default', () => {
    expect(DEFAULT_RUNTIME_SCOPE).toBe('shared');
    expect(getAssemblyRuntimeScope({ runtimeScope: 'runtime' })).toBe('runtime');
    expect(getAssemblyRuntimeScope({ runtimeScope: '' })).toBe('shared');
    expect(getAssemblyRuntimeScope({ runtimeScope: undefined })).toBe('shared');
  });
});
