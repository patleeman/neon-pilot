import type { FileTreeContextMenuOpenContext } from '@pierre/trees';
import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActivityTreeItem } from './activityTree';
import { buildActivityTreePathModel } from './activityTreePaths';
import { ActivityTreeRow } from './ActivityTreeRow';

export type ActivityTreeDropPosition = 'before' | 'after';

interface ActivityTreeViewProps {
  items: readonly ActivityTreeItem[];
  activeItemId?: string | null;
  className?: string;
  style?: CSSProperties;
  canDragItem?: (item: ActivityTreeItem) => boolean;
  canDropItem?: (
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: DragEvent<HTMLElement>,
  ) => boolean;
  collapsedGroupItemIds?: ReadonlySet<string>;
  onToggleGroupItem?: (item: ActivityTreeItem) => void;
  inlineActions?: Array<{ id: string; title: string; icon?: string }>;
  onInlineAction?: (actionId: string, item: ActivityTreeItem) => void;
  onArchiveItem?: (item: ActivityTreeItem) => void;
  onCreateChildItem?: (item: ActivityTreeItem) => void;
  onOpenItem?: (item: ActivityTreeItem) => void;
  onDragStartItem?: (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => void;
  onDropItem?: (
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: DragEvent<HTMLElement>,
  ) => void;
  onDragEndItem?: () => void;
  renderContextMenu?: (item: ActivityTreeItem, context: FileTreeContextMenuOpenContext) => ReactNode;
}

interface ActivityTreeContextMenuState {
  item: ActivityTreeItem;
  x: number;
  y: number;
}

const ACTIVITY_TREE_ROOT_INDENT_REM = 0.25;
const ACTIVITY_TREE_CHILD_INDENT_REM = 0.375;

export function getActivityTreeRowPaddingLeftRem(item: ActivityTreeItem, depth: number): number {
  if (item.kind === 'group') {
    return ACTIVITY_TREE_ROOT_INDENT_REM;
  }
  return ACTIVITY_TREE_ROOT_INDENT_REM + Math.max(0, depth) * ACTIVITY_TREE_CHILD_INDENT_REM;
}

export function ActivityTreeView({
  items,
  activeItemId,
  className,
  style,
  canDragItem,
  canDropItem,
  collapsedGroupItemIds,
  onToggleGroupItem,
  inlineActions = [],
  onInlineAction,
  onArchiveItem,
  onCreateChildItem,
  onOpenItem,
  onDragStartItem,
  onDropItem,
  onDragEndItem,
  renderContextMenu,
}: ActivityTreeViewProps) {
  const pathModel = useMemo(() => buildActivityTreePathModel(items), [items]);
  const selectedPath = activeItemId ? pathModel.pathById.get(activeItemId) : undefined;
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);
  const childCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.parentId) continue;
      counts.set(item.parentId, (counts.get(item.parentId) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const conversationChildCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.parentId || item.kind !== 'conversation') continue;
      counts.set(item.parentId, (counts.get(item.parentId) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<ActivityTreeContextMenuState | null>(null);
  const contextMenuRootRef = useRef<HTMLDivElement | null>(null);
  const draggedItemIdRef = useRef<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ itemId: string; position: ActivityTreeDropPosition } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu || typeof document === 'undefined') return;

    const closeIfOutsideMenu = (event: MouseEvent | PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRootRef.current?.contains(target)) return;
      closeContextMenu();
    };

    document.addEventListener('pointerdown', closeIfOutsideMenu, true);
    document.addEventListener('contextmenu', closeIfOutsideMenu, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutsideMenu, true);
      document.removeEventListener('contextmenu', closeIfOutsideMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

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
  const toggleExpanded = useCallback(
    (itemId: string) => {
      const itemPath = pathModel.pathById.get(itemId);
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
    },
    [collapsedBranchIds, expandedIds, pathModel.pathById, selectedPath],
  );

  const ancestorIdsById = useMemo(() => {
    const ancestors = new Map<string, string[]>();
    for (const item of items) {
      const ids: string[] = [];
      const seen = new Set<string>([item.id]);
      let parentId = item.parentId;
      while (parentId) {
        if (seen.has(parentId)) break;
        seen.add(parentId);
        ids.push(parentId);
        parentId = itemById.get(parentId)?.parentId;
      }
      ancestors.set(item.id, ids);
    }
    return ancestors;
  }, [itemById, items]);

  // Auto-expand the full ancestor chain when navigating to a child item (e.g.
  // nested fork/rewind conversations) so the selected thread stays visible and
  // remains visible after moving between related parent/child threads.
  useEffect(() => {
    if (!activeItemId) return;
    const ancestorIds = (ancestorIdsById.get(activeItemId) ?? []).filter((id) => itemById.get(id)?.kind !== 'group');
    if (ancestorIds.length === 0) return;
    setExpandedIds((current) => {
      if (ancestorIds.every((id) => current.has(id))) return current;
      const next = new Set(current);
      for (const id of ancestorIds) next.add(id);
      return next;
    });
  }, [activeItemId, ancestorIdsById, itemById]);

  const visibleEntries = useMemo(
    () =>
      pathModel.entries.filter(({ item, path }) => {
        if (!item.parentId) return true;
        const ancestorIds = ancestorIdsById.get(item.id) ?? [];
        for (const ancestorId of ancestorIds) {
          const ancestor = itemById.get(ancestorId);
          if (!ancestor) return true;
          if (ancestor.kind === 'group') {
            if ((collapsedGroupItemIds ?? collapsedGroupIds).has(ancestor.id)) return false;
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
      }),
    [
      ancestorIdsById,
      collapsedBranchIds,
      collapsedGroupIds,
      collapsedGroupItemIds,
      expandedIds,
      itemById,
      pathModel.entries,
      pathModel.pathById,
      selectedPath,
    ],
  );

  function getDropPosition(event: DragEvent<HTMLElement>): ActivityTreeDropPosition {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  }

  function clearDragState() {
    draggedItemIdRef.current = null;
    setDraggedItemId(null);
    setDropTarget(null);
  }

  if (pathModel.entries.length === 0) {
    return <p className="px-4 py-2 text-[12px] text-dim">No threads yet.</p>;
  }

  return (
    <div className={className} style={style} onClick={contextMenu ? closeContextMenu : undefined}>
      <div role="tree" aria-label="Threads" className="space-y-px px-1 py-0.5">
        {visibleEntries.map(({ item, path }) => {
          const depth = Math.max(0, path.split('/').filter(Boolean).length - 1);
          const active = path === selectedPath;
          const childCount = childCountByParentId.get(item.id) ?? 0;
          const conversationChildCount = conversationChildCountByParentId.get(item.id) ?? 0;
          const expanded =
            item.kind === 'group'
              ? !(collapsedGroupItemIds ?? collapsedGroupIds).has(item.id)
              : !collapsedBranchIds.has(item.id) && (expandedIds.has(item.id) || Boolean(selectedPath?.startsWith(path)));
          const canDrag = Boolean(canDragItem?.(item));
          const rowDropPosition = dropTarget?.itemId === item.id ? dropTarget.position : null;
          const canArchive = item.kind === 'conversation' && onArchiveItem && item.metadata?.canArchive !== false;
          const canCreateChild = item.kind === 'group' && onCreateChildItem;
          return (
            <ActivityTreeRow
              key={item.id}
              active={active}
              canArchive={Boolean(canArchive)}
              canCreateChild={Boolean(canCreateChild)}
              canDrag={canDrag}
              childCount={childCount}
              conversationChildCount={conversationChildCount}
              depth={depth}
              dragged={draggedItemId === item.id}
              expanded={expanded}
              inlineActions={inlineActions}
              item={item}
              renderContextMenu={Boolean(renderContextMenu)}
              rowDropPosition={rowDropPosition}
              onArchiveItem={onArchiveItem}
              onCreateChildItem={onCreateChildItem}
              onDragStart={(draggedItem, event) => {
                draggedItemIdRef.current = draggedItem.id;
                setDraggedItemId(draggedItem.id);
                onDragStartItem?.(draggedItem, event);
              }}
              onDragOver={(targetItem, event) => {
                const currentDraggedItemId = draggedItemIdRef.current ?? draggedItemId;
                const draggedItem = currentDraggedItemId ? itemById.get(currentDraggedItemId) : null;
                if (!draggedItem || draggedItem.id === targetItem.id) {
                  setDropTarget(null);
                  return;
                }

                const position = getDropPosition(event);
                if (!canDropItem?.(draggedItem, targetItem, position, event)) {
                  if (dropTarget?.itemId === targetItem.id) setDropTarget(null);
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget((current) =>
                  current?.itemId === targetItem.id && current.position === position ? current : { itemId: targetItem.id, position },
                );
              }}
              onDrop={(targetItem, event) => {
                const currentDraggedItemId = draggedItemIdRef.current ?? draggedItemId;
                const draggedItem = currentDraggedItemId ? itemById.get(currentDraggedItemId) : null;
                if (!draggedItem) {
                  clearDragState();
                  return;
                }

                const position = getDropPosition(event);
                if (canDropItem?.(draggedItem, targetItem, position, event)) {
                  event.preventDefault();
                  onDropItem?.(draggedItem, targetItem, position, event);
                }
                clearDragState();
              }}
              onDragEnd={() => {
                clearDragState();
                onDragEndItem?.();
              }}
              onInlineAction={onInlineAction}
              onOpenContextMenu={(contextItem, x, y) => setContextMenu({ item: contextItem, x, y })}
              onOpenItem={onOpenItem}
              onToggleBranch={toggleExpanded}
              onToggleGroup={toggleGroupCollapsed}
            />
          );
        })}
      </div>
      {contextMenu && renderContextMenu ? (
        <div
          ref={contextMenuRootRef}
          data-file-tree-context-menu-root="true"
          className="fixed z-[1000]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {renderContextMenu(contextMenu.item, {
            anchorElement: document.body,
            anchorRect: { x: contextMenu.x, y: contextMenu.y, width: 1, height: 1 },
            close: closeContextMenu,
            restoreFocus: () => {},
          } as FileTreeContextMenuOpenContext)}
        </div>
      ) : null}
    </div>
  );
}
