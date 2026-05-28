import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActivityTreeItem } from './activityTree';
import type { ActivityTreePathModel } from './activityTreePaths';
import { buildVisibleActivityTreeEntries } from './activityTreeVisibility';

interface UseActivityTreeExpansionOptions {
  activeItemId?: string | null;
  collapsedGroupItemIds?: ReadonlySet<string>;
  onToggleGroupItem?: (item: ActivityTreeItem) => void;
  pathModel: ActivityTreePathModel;
  selectedPath: string | undefined;
}

export function useActivityTreeExpansion({
  activeItemId,
  collapsedGroupItemIds,
  onToggleGroupItem,
  pathModel,
  selectedPath,
}: UseActivityTreeExpansionOptions) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Set<string>>(() => new Set());
  const effectiveCollapsedGroupIds = collapsedGroupItemIds ?? collapsedGroupIds;
  const branchExpansionStateRef = useRef({
    collapsedBranchIds,
    expandedIds,
    pathById: pathModel.pathById,
    selectedPath,
  });
  branchExpansionStateRef.current = {
    collapsedBranchIds,
    expandedIds,
    pathById: pathModel.pathById,
    selectedPath,
  };

  const toggleGroupCollapsed = useCallback(
    (item: ActivityTreeItem) => {
      if (collapsedGroupItemIds && onToggleGroupItem) {
        onToggleGroupItem(item);
        return;
      }

      setCollapsedGroupIds((current) => {
        const next = new Set(current);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    },
    [collapsedGroupItemIds, onToggleGroupItem],
  );

  const toggleBranchExpanded = useCallback((itemId: string) => {
    const { collapsedBranchIds, expandedIds, pathById, selectedPath } = branchExpansionStateRef.current;
    const itemPath = pathById.get(itemId);
    const isSelectedAncestor = Boolean(itemPath && selectedPath?.startsWith(itemPath));
    const isExpanded = !collapsedBranchIds.has(itemId) && (expandedIds.has(itemId) || isSelectedAncestor);

    setCollapsedBranchIds((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
    setExpandedIds((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeItemId) return;
    const ancestorIds = (pathModel.ancestorIdsById.get(activeItemId) ?? []).filter((id) => pathModel.itemById.get(id)?.kind !== 'group');
    if (ancestorIds.length === 0) return;
    setExpandedIds((current) => {
      if (ancestorIds.every((id) => current.has(id))) return current;
      const next = new Set(current);
      for (const id of ancestorIds) next.add(id);
      return next;
    });
  }, [activeItemId, pathModel.ancestorIdsById, pathModel.itemById]);

  const visibleEntries = useMemo(
    () =>
      buildVisibleActivityTreeEntries({
        collapsedBranchIds,
        collapsedGroupIds: effectiveCollapsedGroupIds,
        expandedIds,
        pathModel,
        selectedPath,
      }),
    [collapsedBranchIds, effectiveCollapsedGroupIds, expandedIds, pathModel, selectedPath],
  );

  const isItemExpanded = useCallback(
    (item: ActivityTreeItem, path: string) => {
      if (item.kind === 'group') {
        return !effectiveCollapsedGroupIds.has(item.id);
      }
      return !collapsedBranchIds.has(item.id) && (expandedIds.has(item.id) || Boolean(selectedPath?.startsWith(path)));
    },
    [collapsedBranchIds, effectiveCollapsedGroupIds, expandedIds, selectedPath],
  );

  return {
    isItemExpanded,
    toggleBranchExpanded,
    toggleGroupCollapsed,
    visibleEntries,
  };
}
