import { describe, expect, it } from 'vitest';

import { hasValidIsoDateParts, normalizeContent, normalizeTimestamp } from './sessionContent';

describe('sessionContent', () => {
  it('normalizes content arrays and strings', () => {
    const blocks = [{ type: 'text' as const, text: 'hello' }];
    expect(normalizeContent(blocks)).toBe(blocks);
    expect(normalizeContent('hello')).toEqual([{ type: 'text', text: 'hello' }]);
    expect(normalizeContent('')).toEqual([]);
    expect(normalizeContent(null)).toEqual([]);
  });

  it('normalizes timestamps and rejects impossible ISO date parts', () => {
    expect(normalizeTimestamp(' 2026-05-23T12:34:56.789Z ')).toBe('2026-05-23T12:34:56.789Z');
    expect(normalizeTimestamp(Date.UTC(2026, 4, 23))).toBe('2026-05-23T00:00:00.000Z');
    expect(normalizeTimestamp('2026-02-31T00:00:00Z')).toBe('1970-01-01T00:00:00.000Z');
    expect(normalizeTimestamp(undefined)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('validates parsed ISO date parts', () => {
    expect(hasValidIsoDateParts('2026-05-23T00:00:00Z'.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/) as RegExpMatchArray)).toBe(
      true,
    );
    expect(hasValidIsoDateParts('2026-02-31T00:00:00Z'.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/) as RegExpMatchArray)).toBe(
      false,
    );
  });
});
