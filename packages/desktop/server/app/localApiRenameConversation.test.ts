import { describe, expect, it } from 'vitest';

import { buildRenameDesktopConversationResult, resolveRenamedStoredConversationTitle } from './localApiRenameConversation';

describe('localApiRenameConversation', () => {
  it('builds the rename response', () => {
    expect(buildRenameDesktopConversationResult({ title: 'Next title' })).toEqual({ ok: true, title: 'Next title' });
  });

  it('prefers trimmed renamed stored title and falls back to requested title', () => {
    expect(resolveRenamedStoredConversationTitle({ renamedTitle: ' Stored ', fallbackTitle: 'Requested' })).toBe('Stored');
    expect(resolveRenamedStoredConversationTitle({ renamedTitle: '  ', fallbackTitle: 'Requested' })).toBe('Requested');
    expect(resolveRenamedStoredConversationTitle({ renamedTitle: null, fallbackTitle: 'Requested' })).toBe('Requested');
  });
});
