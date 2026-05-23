import { describe, expect, it } from 'vitest';

import {
  assertArray,
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation';

describe('extensionManifestValidation', () => {
  it('requires non-empty strings and string arrays', () => {
    expect(requireString('value', 'id')).toBe('value');
    expect(() => requireString('', 'id')).toThrow('Extension manifest id must be a non-empty string.');
    expect(requireStringArray(['a'], 'permissions')).toEqual(['a']);
    expect(() => requireStringArray([''], 'permissions')).toThrow('Extension manifest permissions must be an array of non-empty strings.');
  });

  it('asserts arrays of records', () => {
    expect(assertArray([1], 'items')).toEqual([1]);
    expect(() => assertArray({}, 'items')).toThrow('Extension manifest items must be an array.');
    expect(assertRecordArray([{ id: 'x' }], 'items')).toEqual([{ id: 'x' }]);
    expect(() => assertRecordArray([null], 'items')).toThrow('Extension manifest items[0] must be an object.');
  });

  it('validates optional strings and enum values', () => {
    expect(validateOptionalString(undefined, 'title')).toBeUndefined();
    expect(validateOptionalString('Title', 'title')).toBeUndefined();
    expect(() => validateOptionalString(1, 'title')).toThrow('Extension manifest title must be a string.');
    expect(validateEnum('left', ['left', 'right'], 'placement')).toBeUndefined();
    expect(() => validateEnum('top', ['left', 'right'], 'placement')).toThrow('Extension manifest placement must be one of: left, right.');
  });
});
