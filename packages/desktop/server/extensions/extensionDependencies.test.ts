import { describe, expect, it } from 'vitest';

import { listMissingRequiredExtensionDependencies, normalizeExtensionDependency } from './extensionDependencies';

describe('extensionDependencies', () => {
  it('normalizes string and object dependency declarations', () => {
    expect(normalizeExtensionDependency('system-browser')).toEqual({ id: 'system-browser', optional: false });
    expect(normalizeExtensionDependency({ id: 'system-diffs', optional: true, version: '^1.0.0' })).toEqual({
      id: 'system-diffs',
      optional: true,
    });
  });

  it('reports only missing required dependencies', () => {
    expect(
      listMissingRequiredExtensionDependencies(
        ['installed-required', 'missing-required', { id: 'missing-optional', optional: true }, { id: 'missing-required-object' }],
        ['installed-required'],
      ),
    ).toEqual([
      'Missing required extension dependency: missing-required',
      'Missing required extension dependency: missing-required-object',
    ]);
  });
});
