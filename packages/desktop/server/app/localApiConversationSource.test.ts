import { describe, expect, it } from 'vitest';

import { buildDesktopConversationSource, normalizeResolvedSessionFile } from './localApiConversationSource';

describe('localApiConversationSource', () => {
  it('normalizes resolved session files', () => {
    expect(normalizeResolvedSessionFile(' /tmp/session.jsonl ')).toBe('/tmp/session.jsonl');
    expect(normalizeResolvedSessionFile('  ')).toBeNull();
    expect(normalizeResolvedSessionFile(undefined)).toBeNull();
  });

  it('builds conversation source values', () => {
    expect(buildDesktopConversationSource({ sessionFile: '/tmp/session.jsonl', cwd: '/repo', live: true })).toEqual({
      sessionFile: '/tmp/session.jsonl',
      cwd: '/repo',
      live: true,
    });
  });
});
