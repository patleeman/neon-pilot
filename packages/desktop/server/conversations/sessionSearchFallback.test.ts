import { describe, expect, it } from 'vitest';

import { resolveSessionSearchTextResult, shouldUseSessionSearchFallback } from './sessionSearchFallback';

describe('sessionSearchFallback', () => {
  it('uses fallback only when indexed text is null', () => {
    expect(shouldUseSessionSearchFallback(null)).toBe(true);
    expect(shouldUseSessionSearchFallback('')).toBe(false);
    expect(shouldUseSessionSearchFallback('indexed')).toBe(false);
  });

  it('prefers indexed text including empty strings over fallback text', () => {
    expect(resolveSessionSearchTextResult({ indexedText: 'indexed', fallbackText: 'fallback' })).toBe('indexed');
    expect(resolveSessionSearchTextResult({ indexedText: '', fallbackText: 'fallback' })).toBe('');
    expect(resolveSessionSearchTextResult({ indexedText: null, fallbackText: 'fallback' })).toBe('fallback');
    expect(resolveSessionSearchTextResult({ indexedText: null, fallbackText: null })).toBeNull();
  });
});
