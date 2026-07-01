import { describe, expect, it } from 'vitest';

import { HOST_VIEW_COMPONENT_DEFINITIONS } from './extensionManifest';
import { validateThemeTokens, validateViewComponent } from './extensionManifestViewValidation';

describe('extensionManifestViewValidation', () => {
  it('validates theme token objects', () => {
    expect(validateThemeTokens({ '--color-test': '187 154 247' }, 'contributes.themeTokens')).toBeUndefined();
    expect(() => validateThemeTokens(null, 'theme')).toThrow('Extension manifest theme must be an object.');
    expect(() => validateThemeTokens({ color: '187 154 247' }, 'theme')).toThrow(
      'Extension manifest theme.color must be a --color-* CSS variable.',
    );
    expect(() => validateThemeTokens({ '--color-test': 'rgb(1,2,3)' }, 'theme')).toThrow(
      'Extension manifest theme.--color-test must be an RGB triplet string like "187 154 247".',
    );
  });

  it('validates component exports and host component objects', () => {
    expect(validateViewComponent('Panel', 'component')).toBeUndefined();
    expect(() => validateViewComponent('', 'component')).toThrow(
      'Extension manifest component must be a component export string or host component object.',
    );
    expect(() => validateViewComponent({ host: 'not-real' }, 'component')).toThrow('Extension manifest component.host must be one of:');
  });

  it('keeps host component locations aligned with extension view locations', () => {
    const extensionViewLocations = new Set(['main', 'sidebar', 'rightRail', 'workbench']);
    const catalogLocations = HOST_VIEW_COMPONENT_DEFINITIONS.flatMap((definition) => definition.locations);

    expect(catalogLocations.length).toBeGreaterThan(0);
    for (const location of catalogLocations) {
      expect(extensionViewLocations.has(location), `${location} should be a valid extension view location`).toBe(true);
    }
  });
});
