import type { DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { ActivityTreeItem } from './activityTree';
import type { ActivityTreePathModel } from './activityTreePaths';

export type ActivityTreeDropPosition = 'before' | 'after';

type ActivityTreeDropTarget = { itemId: string; position: ActivityTreeDropPosition };

type UseActivityTreeDragInput = {
  canDropItem?: (
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: DragEvent<HTMLElement>,
  ) => boolean;
  onDragEndItem?: () => void;
  onDragStartItem?: (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => void;
  onDropItem?: (
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: DragEvent<HTMLElement>,
  ) => void;
  pathModel: ActivityTreePathModel;
};

export function getActivityTreeDropPosition(event: DragEvent<HTMLElement>): ActivityTreeDropPosition {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

export function useActivityTreeDrag({ canDropItem, onDragEndItem, onDragStartItem, onDropItem, pathModel }: UseActivityTreeDragInput) {
  const canDropItemRef = useRef(canDropItem);
  const onDragEndItemRef = useRef(onDragEndItem);
  const onDragStartItemRef = useRef(onDragStartItem);
  const onDropItemRef = useRef(onDropItem);
  const draggedItemIdRef = useRef<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ActivityTreeDropTarget | null>(null);
  canDropItemRef.current = canDropItem;
  onDragEndItemRef.current = onDragEndItem;
  onDragStartItemRef.current = onDragStartItem;
  onDropItemRef.current = onDropItem;

  const clearDragState = useCallback(() => {
    draggedItemIdRef.current = null;
    setDraggedItemId(null);
    setDropTarget(null);
  }, []);

  const getDraggedItem = useCallback(() => {
    const currentDraggedItemId = draggedItemIdRef.current;
    return currentDraggedItemId ? (pathModel.itemById.get(currentDraggedItemId) ?? null) : null;
  }, [pathModel.itemById]);

  const getRowDropPosition = useCallback(
    (itemId: string): ActivityTreeDropPosition | null => (dropTarget?.itemId === itemId ? dropTarget.position : null),
    [dropTarget],
  );

  const handleDragStart = useCallback((item: ActivityTreeItem, event: DragEvent<HTMLElement>) => {
    draggedItemIdRef.current = item.id;
    setDraggedItemId(item.id);
    onDragStartItemRef.current?.(item, event);
  }, []);

  const handleDragOver = useCallback(
    (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => {
      const draggedItem = getDraggedItem();
      if (!draggedItem || draggedItem.id === item.id) {
        setDropTarget(null);
        return;
      }

      const position = getActivityTreeDropPosition(event);
      if (!canDropItemRef.current?.(draggedItem, item, position, event)) {
        setDropTarget((current) => (current?.itemId === item.id ? null : current));
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTarget((current) => (current?.itemId === item.id && current.position === position ? current : { itemId: item.id, position }));
    },
    [getDraggedItem],
  );

  const handleDrop = useCallback(
    (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => {
      const draggedItem = getDraggedItem();
      if (!draggedItem) {
        clearDragState();
        return;
      }

      const position = getActivityTreeDropPosition(event);
      if (canDropItemRef.current?.(draggedItem, item, position, event)) {
        event.preventDefault();
        onDropItemRef.current?.(draggedItem, item, position, event);
      }
      clearDragState();
    },
    [clearDragState, getDraggedItem],
  );

  const handleDragEnd = useCallback(() => {
    clearDragState();
    onDragEndItemRef.current?.();
  }, [clearDragState]);

  return {
    draggedItemId,
    getRowDropPosition,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleDrop,
  };
}
