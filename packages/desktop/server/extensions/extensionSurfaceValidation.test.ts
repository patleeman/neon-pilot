import { describe, expect, it } from 'vitest';

import { validateExtensionSurfaceContributions } from './extensionSurfaceValidation';

describe('extensionSurfaceValidation', () => {
  it('validates extension surfaces', () => {
    expect(
      validateExtensionSurfaceContributions([{ id: 'panel', placement: 'right', kind: 'toolPanel', title: 'Panel', action: 'open' }]),
    ).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateExtensionSurfaceContributions([{ placement: 'right', kind: 'toolPanel' }])).toThrow(
      'Extension manifest surfaces[0].id must be a non-empty string.',
    );
    expect(() => validateExtensionSurfaceContributions([{ id: 'panel', placement: 'bad', kind: 'panel' }])).toThrow(
      'Extension manifest surfaces[0].placement must be one of:',
    );
    expect(() => validateExtensionSurfaceContributions([{ id: 'panel', placement: 'right', kind: 'bad' }])).toThrow(
      'Extension manifest surfaces[0].kind must be one of:',
    );
    expect(() => validateExtensionSurfaceContributions([{ id: 'panel', placement: 'right', kind: 'toolPanel', icon: 'bad' }])).toThrow(
      'Extension manifest surfaces[0].icon must be one of:',
    );
  });
});
