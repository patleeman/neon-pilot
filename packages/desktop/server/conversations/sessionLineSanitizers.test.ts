import { describe, expect, it } from 'vitest';

import { sanitizeSessionLineForSearch, sanitizeSessionLineForSummary } from './sessionLineSanitizers';

describe('sessionLineSanitizers', () => {
  it('redacts heavyweight summary fields while preserving presence', () => {
    expect(sanitizeSessionLineForSummary('{"content":"hello","data":"base64","text":"","other":"ok"}')).toBe(
      '{"content":"x","data":"","text":"","other":"ok"}',
    );
  });

  it('redacts search-only heavyweight fields', () => {
    expect(sanitizeSessionLineForSearch('{"data":"base64","thinking":"chain","text":"keep"}')).toBe(
      '{"data":"","thinking":"","text":"keep"}',
    );
  });
});
