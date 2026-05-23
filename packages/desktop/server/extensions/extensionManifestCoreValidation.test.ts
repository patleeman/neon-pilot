import { describe, expect, it } from 'vitest';

import {
  assertExtensionManifestRecord,
  validateExtensionManifestBasics,
  validateExtensionManifestDependencies,
  validateExtensionManifestFrontend,
} from './extensionManifestCoreValidation';

describe('extensionManifestCoreValidation', () => {
  it('validates manifest basics, dependencies, and frontend', () => {
    const manifest: unknown = { schemaVersion: 2, id: 'ext', name: 'Extension', defaultEnabled: true };
    expect(() => assertExtensionManifestRecord(manifest)).not.toThrow();
    expect(validateExtensionManifestBasics(manifest as Record<string, unknown>)).toBeUndefined();
    expect(validateExtensionManifestDependencies(['dep', { id: 'optional', optional: true, version: '^1' }])).toBeUndefined();
    expect(validateExtensionManifestFrontend({ entry: './frontend.js', styles: ['./style.css'] })).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => assertExtensionManifestRecord(null)).toThrow('Extension manifest must be an object.');
    expect(() => validateExtensionManifestBasics({ schemaVersion: 3, id: 'ext', name: 'Extension' })).toThrow(
      'Extension manifest schemaVersion must be 1 or 2.',
    );
    expect(() => validateExtensionManifestBasics({ schemaVersion: 2, id: 'ext', name: 'Extension', defaultEnabled: 'yes' })).toThrow(
      'Extension manifest defaultEnabled must be a boolean.',
    );
    expect(() => validateExtensionManifestDependencies([1])).toThrow('Extension manifest dependsOn[0] must be a string or object.');
    expect(() => validateExtensionManifestDependencies([{ id: 'dep', optional: 'yes' }])).toThrow(
      'Extension manifest dependsOn[0].optional must be a boolean.',
    );
    expect(() => validateExtensionManifestFrontend({ styles: ['./style.css'] })).toThrow(
      'Extension manifest frontend.entry must be a non-empty string.',
    );
  });
});
