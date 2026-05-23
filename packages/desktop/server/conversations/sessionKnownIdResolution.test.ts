import { describe, expect, it } from 'vitest';

import { resolveKnownSessionId, resolveKnownSessionIdFromCache } from './sessionKnownIdResolution';

describe('sessionKnownIdResolution', () => {
  it('normalizes cached session ids', () => {
    expect(resolveKnownSessionIdFromCache(' session ')).toBe('session');
    expect(resolveKnownSessionIdFromCache('  ')).toBeNull();
    expect(resolveKnownSessionIdFromCache(null)).toBeNull();
  });

  it('prefers cached ids before checking file-backed sources', () => {
    expect(
      resolveKnownSessionId({ cachedSessionId: ' cached ', fileExists: false, recordSessionId: 'record', metaSessionId: 'meta' }),
    ).toBe('cached');
  });

  it('returns null when the file is missing and no cache id exists', () => {
    expect(resolveKnownSessionId({ fileExists: false, recordSessionId: 'record', metaSessionId: 'meta' })).toBeNull();
  });

  it('prefers record ids over meta ids for existing files', () => {
    expect(resolveKnownSessionId({ fileExists: true, recordSessionId: 'record', metaSessionId: 'meta' })).toBe('record');
    expect(resolveKnownSessionId({ fileExists: true, recordSessionId: null, metaSessionId: 'meta' })).toBe('meta');
  });
});
