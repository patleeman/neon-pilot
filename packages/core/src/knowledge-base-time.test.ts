import { describe, expect, it } from 'vitest';

import { parseKnowledgeBaseTimestampMs, toKnowledgeBaseIsoTimestamp } from './knowledge-base-time';

describe('knowledge-base-time', () => {
  it('formats numbers and dates as ISO timestamps', () => {
    expect(toKnowledgeBaseIsoTimestamp(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(toKnowledgeBaseIsoTimestamp(new Date('2026-05-23T12:00:00.000Z'))).toBe('2026-05-23T12:00:00.000Z');
  });

  it('parses valid timestamps and rejects missing or invalid values', () => {
    expect(parseKnowledgeBaseTimestampMs('1970-01-01T00:00:00.000Z')).toBe(0);
    expect(parseKnowledgeBaseTimestampMs(undefined)).toBeNull();
    expect(parseKnowledgeBaseTimestampMs('not-a-date')).toBeNull();
  });
});
