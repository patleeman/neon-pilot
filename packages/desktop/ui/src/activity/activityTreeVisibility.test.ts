import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { buildActivityTreePathModel } from './activityTreePaths';
import { buildVisibleActivityTreeEntries } from './activityTreeVisibility';

function item(overrides: Partial<ActivityTreeItem> & Pick<ActivityTreeItem, 'id' | 'title'>): ActivityTreeItem {
  return {
    kind: overrides.kind ?? 'conversation',
    status: overrides.status ?? 'idle',
    ...overrides,
  };
}

function visibleTitles(items: ActivityTreeItem[], options: Partial<Parameters<typeof buildVisibleActivityTreeEntries>[0]> = {}): string[] {
  const pathModel = buildActivityTreePathModel(items);
  return buildVisibleActivityTreeEntries({
    collapsedBranchIds: new Set(),
    collapsedGroupIds: new Set(),
    expandedIds: new Set(),
    pathModel,
    selectedPath: undefined,
    ...options,
  }).map((entry) => entry.item.title);
}

describe('buildVisibleActivityTreeEntries', () => {
  it('hides conversation children until their parent branch is expanded', () => {
    const parent = item({ id: 'conversation:parent', title: 'Parent' });
    const child = item({ id: 'conversation:child', parentId: parent.id, title: 'Child' });
    const pathModel = buildActivityTreePathModel([parent, child]);

    expect(
      visibleTitles([parent, child], {
        pathModel,
      }),
    ).toEqual(['Parent']);
    expect(
      visibleTitles([parent, child], {
        expandedIds: new Set([parent.id]),
        pathModel,
      }),
    ).toEqual(['Parent', 'Child']);
  });

  it('keeps the selected descendant visible through its ancestor chain', () => {
    const root = item({ id: 'conversation:root', title: 'Root' });
    const parent = item({ id: 'conversation:parent', parentId: root.id, title: 'Parent' });
    const child = item({ id: 'conversation:child', parentId: parent.id, title: 'Child' });
    const pathModel = buildActivityTreePathModel([root, parent, child]);

    expect(
      visibleTitles([root, parent, child], {
        pathModel,
        selectedPath: pathModel.pathById.get(child.id),
      }),
    ).toEqual(['Root', 'Parent', 'Child']);
  });

  it('hides descendants under collapsed workspace groups', () => {
    const group = item({ id: 'group:project', kind: 'group', title: 'Project' });
    const child = item({ id: 'conversation:child', parentId: group.id, title: 'Child' });

    expect(
      visibleTitles([group, child], {
        collapsedGroupIds: new Set([group.id]),
      }),
    ).toEqual(['Project']);
  });
});
