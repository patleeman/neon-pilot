import { describe, expect, it } from 'vitest';

import { buildNodeMentionHref } from './nodeMentionRoutes.js';

describe('buildNodeMentionHref', () => {
  it('returns null because node mentions do not currently route directly', () => {
    expect(buildNodeMentionHref({ id: 'node-1', label: 'Node', kind: 'note' } as never, 'main')).toBeNull();
    expect(buildNodeMentionHref({ id: 'node-1', label: 'Node', kind: 'note' } as never, 'compact')).toBeNull();
  });
});
