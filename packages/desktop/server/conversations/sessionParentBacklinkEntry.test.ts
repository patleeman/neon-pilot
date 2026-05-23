import { describe, expect, it } from 'vitest';

import { buildParentBacklinkContent, resolveParentBacklinkLabel } from './sessionParentBacklinkEntry';

describe('sessionParentBacklinkEntry', () => {
  it('resolves backlink labels from offshoot kind', () => {
    expect(resolveParentBacklinkLabel('subagent')).toBe('Subagent');
    expect(resolveParentBacklinkLabel('branch')).toBe('Branch');
    expect(resolveParentBacklinkLabel('continuation')).toBe('Continuation');
  });

  it('formats backlink content with optional source message', () => {
    expect(buildParentBacklinkContent({ label: 'Branch', parentTitle: 'Parent title', parentId: 'p1' })).toBe(
      'Branch conversation from parent: Parent title\nOpen parent: /conversations/p1',
    );
    expect(buildParentBacklinkContent({ label: 'Branch', parentTitle: 'Parent title', parentId: 'p1', parentMessageId: 'm1' })).toBe(
      'Branch conversation from parent: Parent title\nOpen parent: /conversations/p1\nSource message: m1',
    );
  });
});
