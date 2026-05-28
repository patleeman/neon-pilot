import type { ActivityTreePathModel } from './activityTreePaths';

export function buildVisibleActivityTreeEntries({
  collapsedBranchIds,
  collapsedGroupIds,
  expandedIds,
  pathModel,
  selectedPath,
}: {
  collapsedBranchIds: ReadonlySet<string>;
  collapsedGroupIds: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
  pathModel: ActivityTreePathModel;
  selectedPath: string | undefined;
}): ActivityTreePathModel['entries'] {
  return pathModel.entries.filter(({ item, path }) => {
    if (!item.parentId) return true;
    const ancestorIds = pathModel.ancestorIdsById.get(item.id) ?? [];
    for (const ancestorId of ancestorIds) {
      const ancestor = pathModel.itemById.get(ancestorId);
      if (!ancestor) return true;
      if (ancestor.kind === 'group') {
        if (collapsedGroupIds.has(ancestor.id)) return false;
        continue;
      }
      const ancestorPath = pathModel.pathById.get(ancestor.id);
      if (collapsedBranchIds.has(ancestor.id)) {
        return false;
      }
      if (expandedIds.has(ancestor.id) || path === selectedPath || Boolean(ancestorPath && selectedPath?.startsWith(ancestorPath))) {
        continue;
      }
      return false;
    }
    return true;
  });
}
