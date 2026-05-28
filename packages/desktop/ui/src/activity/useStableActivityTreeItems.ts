import { useRef } from 'react';

import type { ActivityTreeItem } from './activityTree';

export function useStableActivityTreeItems(items: readonly ActivityTreeItem[]): readonly ActivityTreeItem[] {
  const previousItemsRef = useRef<readonly ActivityTreeItem[] | null>(null);
  const previousItems = previousItemsRef.current;
  const stableItems = previousItems ? reuseStableActivityTreeItems(previousItems, items) : items;
  previousItemsRef.current = stableItems;
  return stableItems;
}

export function reuseStableActivityTreeItems(
  previousItems: readonly ActivityTreeItem[],
  nextItems: readonly ActivityTreeItem[],
): readonly ActivityTreeItem[] {
  let reusedAllItems = previousItems.length === nextItems.length;
  const previousItemById = new Map(previousItems.map((item) => [item.id, item] as const));
  const stableItems = nextItems.map((item) => {
    const previousItem = previousItemById.get(item.id);
    if (!previousItem || !activityTreeItemsEqual(previousItem, item)) {
      reusedAllItems = false;
      return item;
    }
    return previousItem;
  });

  if (reusedAllItems && stableItems.every((item, index) => item === previousItems[index])) {
    return previousItems;
  }

  return stableItems;
}

function activityTreeItemsEqual(left: ActivityTreeItem, right: ActivityTreeItem): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.parentId === right.parentId &&
    left.title === right.title &&
    left.subtitle === right.subtitle &&
    left.status === right.status &&
    left.route === right.route &&
    left.accentColor === right.accentColor &&
    left.backgroundColor === right.backgroundColor &&
    left.updatedAt === right.updatedAt &&
    shallowRecordsEqual(left.metadata, right.metadata)
  );
}

function shallowRecordsEqual(left: Record<string, unknown> | undefined, right: Record<string, unknown> | undefined): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;

  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}
