import { describe, expect, it } from 'vitest';

import {
  buildBrowserChangedContextMessage,
  buildBrowserCommentContextMessages,
  buildBrowserCommentsStorageKey,
  formatBrowserCommentTargetLabel,
  mergeContextMessages,
  normalizePendingBrowserComments,
} from './browserContextMessages';

const target = {
  url: 'https://example.com',
  title: 'Example',
  role: 'button',
  accessibleName: 'Submit',
  selector: '#submit',
  viewportRect: { x: 1, y: 2, width: 3, height: 4 },
};

describe('browserContextMessages', () => {
  it('normalizes and formats pending browser comments', () => {
    expect(formatBrowserCommentTargetLabel(target)).toBe('button: Submit');
    const comments = normalizePendingBrowserComments([
      { id: '1', createdAt: 'now', target, comment: 'Looks wrong' },
      { id: 'bad', createdAt: 'now', comment: 'missing target' },
    ]);
    expect(comments).toHaveLength(1);
    expect(buildBrowserCommentContextMessages(comments)?.[0]?.content).toContain('User comment: Looks wrong');
  });

  it('builds changed-browser context only when state changed', () => {
    expect(buildBrowserChangedContextMessage(null)).toBeNull();
    expect(buildBrowserChangedContextMessage({ changedSinceLastSnapshot: false } as never)).toBeNull();
    const message = buildBrowserChangedContextMessage({
      changedSinceLastSnapshot: true,
      url: 'https://example.com',
      title: 'Example',
      loading: false,
      browserRevision: 5,
      lastSnapshotRevision: 4,
      lastChangeReason: 'navigation',
      lastChangedAt: 'now',
    } as never);
    expect(message?.customType).toBe('browser-changed-since-snapshot');
    expect(message?.content).toContain('Current URL: https://example.com');
  });

  it('merges optional context groups and builds storage keys', () => {
    expect(mergeContextMessages(undefined, [])).toBeUndefined();
    expect(mergeContextMessages([{ customType: 'a', content: 'b' }])).toEqual([{ customType: 'a', content: 'b' }]);
    expect(buildBrowserCommentsStorageKey(true, undefined)).toBe('pa:reload:draft-conversation:browser-comments');
    expect(buildBrowserCommentsStorageKey(false, 'abc')).toBe('pa:reload:conversation:abc:browser-comments');
    expect(buildBrowserCommentsStorageKey(false, undefined)).toBeNull();
  });
});
