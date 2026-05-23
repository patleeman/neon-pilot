import { describe, expect, it } from 'vitest';

import { buildSessionInfoRecord, buildUserMessageTitle, normalizeSessionName } from './sessionNaming';

describe('sessionNaming', () => {
  it('normalizes non-empty string names and rejects non-strings or blank names', () => {
    expect(normalizeSessionName('  My\n Session\tName  ')).toBe('My Session Name');
    expect(normalizeSessionName('   ')).toBeNull();
    expect(normalizeSessionName(123)).toBeNull();
  });

  it('builds deterministic session info records when timestamp is supplied', () => {
    expect(buildSessionInfoRecord('Name', '2026-05-23T00:00:00.000Z')).toBe(
      JSON.stringify({ type: 'session_info', timestamp: '2026-05-23T00:00:00.000Z', name: 'Name' }),
    );
  });

  it('builds user message fallback titles from text or image counts', () => {
    expect(buildUserMessageTitle({ text: 'hello\nworld', imageCount: 0 })).toBe('hello world');
    expect(buildUserMessageTitle({ text: 'x'.repeat(100), imageCount: 0 })).toHaveLength(80);
    expect(buildUserMessageTitle({ text: '', imageCount: 1 })).toBe('(image attachment)');
    expect(buildUserMessageTitle({ text: '', imageCount: 2 })).toBe('(2 image attachments)');
    expect(buildUserMessageTitle({ text: '', imageCount: 0 })).toBeNull();
  });
});
