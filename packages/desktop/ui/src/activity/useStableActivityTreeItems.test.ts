import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { reuseStableActivityTreeItems } from './useStableActivityTreeItems';

function item(overrides: Partial<ActivityTreeItem> & Pick<ActivityTreeItem, 'id'>): ActivityTreeItem {
  return {
    id: overrides.id,
    kind: overrides.kind ?? 'conversation',
    status: overrides.status ?? 'idle',
    title: overrides.title ?? overrides.id,
    ...overrides,
  };
}

describe('reuseStableActivityTreeItems', () => {
  it('reuses the previous array and items when semantic fields are unchanged', () => {
    const previous = [item({ id: 'conversation:one', metadata: { conversationId: 'one', hasPendingRuns: false } })];
    const next = [item({ id: 'conversation:one', metadata: { conversationId: 'one', hasPendingRuns: false } })];

    const stable = reuseStableActivityTreeItems(previous, next);

    expect(stable).toBe(previous);
    expect(stable[0]).toBe(previous[0]);
  });

  it('keeps unchanged items stable while accepting changed items', () => {
    const previous = [
      item({ id: 'conversation:one', metadata: { conversationId: 'one' } }),
      item({ id: 'conversation:two', title: 'Old title', metadata: { conversationId: 'two' } }),
    ];
    const next = [
      item({ id: 'conversation:one', metadata: { conversationId: 'one' } }),
      item({ id: 'conversation:two', title: 'New title', metadata: { conversationId: 'two' } }),
    ];

    const stable = reuseStableActivityTreeItems(previous, next);

    expect(stable).not.toBe(previous);
    expect(stable[0]).toBe(previous[0]);
    expect(stable[1]).toBe(next[1]);
  });

  it('preserves next ordering while reusing matching item identities', () => {
    const one = item({ id: 'conversation:one' });
    const two = item({ id: 'conversation:two' });

    const stable = reuseStableActivityTreeItems([one, two], [item({ id: 'conversation:two' }), item({ id: 'conversation:one' })]);

    expect(stable).toEqual([two, one]);
    expect(stable).not.toBe([one, two]);
  });
});
