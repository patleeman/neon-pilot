import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { buildActivityTreeRowModel } from './activityTreeRowModel';

function item(overrides: Partial<ActivityTreeItem> & Pick<ActivityTreeItem, 'id' | 'title'>): ActivityTreeItem {
  return {
    kind: overrides.kind ?? 'conversation',
    status: overrides.status ?? 'idle',
    ...overrides,
  };
}

describe('buildActivityTreeRowModel', () => {
  it('derives conversation row metadata once for rendering', () => {
    const model = buildActivityTreeRowModel({
      childCount: 2,
      conversationChildCount: 1,
      depth: 1,
      hasArchiveAction: true,
      hasCreateChildAction: true,
      item: item({
        id: 'conversation:test',
        title: 'Test thread',
        metadata: {
          backgroundWorkKind: 'command',
          conversationId: 'test',
          hasPendingRuns: true,
          isPinned: true,
          tooltip: 'Custom tooltip',
        },
      }),
    });

    expect(model).toEqual(
      expect.objectContaining({
        canArchive: true,
        canCreateChild: false,
        conversationBackgroundWorkKind: 'command',
        conversationChildCount: 1,
        conversationHasPendingRuns: true,
        conversationIsPinned: true,
        dataSidebarSessionId: 'test',
        rowPaddingLeftRem: 0.625,
        showConversationStatus: true,
        showExpander: true,
        title: 'Custom tooltip',
      }),
    );
  });

  it('derives group row affordances', () => {
    const model = buildActivityTreeRowModel({
      childCount: 1,
      conversationChildCount: 1,
      depth: 0,
      hasArchiveAction: true,
      hasCreateChildAction: true,
      item: item({
        id: 'group:/work/app',
        kind: 'group',
        title: 'app',
        metadata: { groupKey: '/work/app' },
      }),
    });

    expect(model).toEqual(
      expect.objectContaining({
        canArchive: false,
        canCreateChild: true,
        dataSidebarGroupKey: '/work/app',
        rowPaddingLeftRem: 0.25,
        showExpander: false,
      }),
    );
  });
});
