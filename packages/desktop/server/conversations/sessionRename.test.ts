import { describe, expect, it } from 'vitest';

import { buildMissingSessionRenameError, buildReloadSessionAfterRenameError, resolveStoredSessionRename } from './sessionRename';

describe('sessionRename', () => {
  it('normalizes names and builds a session info line', () => {
    const rename = resolveStoredSessionRename('  New title  ');
    expect(rename.normalizedName).toBe('New title');
    expect(rename.sessionInfoLine.endsWith('\n')).toBe(true);
    expect(JSON.parse(rename.sessionInfoLine)).toMatchObject({ type: 'session_info', name: 'New title' });
  });

  it('rejects empty names', () => {
    expect(() => resolveStoredSessionRename('  ')).toThrow('Conversation title must not be empty.');
  });

  it('builds stable rename errors', () => {
    expect(buildMissingSessionRenameError('s1').message).toBe('Conversation s1 not found.');
    expect(buildReloadSessionAfterRenameError('s1').message).toBe('Conversation s1 could not be reloaded after renaming.');
  });
});
