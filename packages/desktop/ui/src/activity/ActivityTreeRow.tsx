import { type DragEvent, memo, useMemo } from 'react';

import { recordActivityTreeRowRender } from '../client/perfDiagnostics';
import type { ActivityTreeItem } from './activityTree';
import {
  ActivityTreeDropMarker,
  type ActivityTreeInlineAction,
  ActivityTreeLeadingSlot,
  ActivityTreePinnedIcon,
  ActivityTreeRowActions,
  ActivityTreeTrailingStatus,
  ConversationStatusSlot,
} from './ActivityTreeRowChrome';
import { buildActivityTreeRowModel } from './activityTreeRowModel';
import { sanitizeCssColor } from './cssColors';
import type { ActivityTreeDropPosition } from './useActivityTreeDrag';

export type ActivityTreeRowProps = {
  active: boolean;
  canArchive: boolean;
  canCreateChild: boolean;
  canDrag: boolean;
  childCount: number;
  conversationChildCount: number;
  depth: number;
  dragged: boolean;
  expanded: boolean;
  inlineActions: readonly ActivityTreeInlineAction[];
  item: ActivityTreeItem;
  onArchiveItem?: (item: ActivityTreeItem) => void;
  onCreateChildItem?: (item: ActivityTreeItem) => void;
  onDragEnd: () => void;
  onDragOver: (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => void;
  onDragStart: (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => void;
  onDrop: (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => void;
  onInlineAction?: (actionId: string, item: ActivityTreeItem) => void;
  onOpenContextMenu?: (item: ActivityTreeItem, x: number, y: number) => void;
  onOpenItem?: (item: ActivityTreeItem) => void;
  onToggleBranch: (itemId: string) => void;
  onToggleGroup: (item: ActivityTreeItem) => void;
  renderContextMenu: boolean;
  rowDropPosition: ActivityTreeDropPosition | null;
};

export const ActivityTreeRow = memo(function ActivityTreeRow({
  active,
  canArchive,
  canCreateChild,
  canDrag,
  childCount,
  conversationChildCount,
  depth,
  dragged,
  expanded,
  inlineActions,
  item,
  onArchiveItem,
  onCreateChildItem,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onInlineAction,
  onOpenContextMenu,
  onOpenItem,
  onToggleBranch,
  onToggleGroup,
  renderContextMenu,
  rowDropPosition,
}: ActivityTreeRowProps) {
  recordActivityTreeRowRender(item.id);
  const rowModel = useMemo(
    () =>
      buildActivityTreeRowModel({
        childCount,
        conversationChildCount,
        depth,
        hasArchiveAction: canArchive,
        hasCreateChildAction: canCreateChild,
        item,
      }),
    [canArchive, canCreateChild, childCount, conversationChildCount, depth, item],
  );
  const rowStyle = useMemo(() => {
    const accentColor = sanitizeCssColor(item.accentColor);
    const backgroundColor = sanitizeCssColor(item.backgroundColor);
    return {
      paddingLeft: `${rowModel.rowPaddingLeftRem}rem`,
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(accentColor ? { boxShadow: `inset 2px 0 0 ${accentColor}` } : {}),
    };
  }, [item.accentColor, item.backgroundColor, rowModel.rowPaddingLeftRem]);

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={active ? 'true' : 'false'}
      draggable={canDrag}
      onDragStart={canDrag ? (event) => onDragStart(item, event) : undefined}
      onDragOver={(event) => onDragOver(item, event)}
      onDrop={(event) => onDrop(item, event)}
      onDragEnd={onDragEnd}
      className={[
        'ui-sidebar-session-row group relative flex w-full items-center gap-1 select-none text-left',
        item.kind === 'group' && 'font-semibold',
        active && 'ui-sidebar-session-row-active',
        canDrag && (dragged ? 'cursor-grabbing opacity-60' : 'cursor-grab'),
      ]
        .filter(Boolean)
        .join(' ')}
      style={rowStyle}
      data-sidebar-session-id={rowModel.dataSidebarSessionId}
      data-sidebar-group-key={rowModel.dataSidebarGroupKey}
      title={canDrag ? 'Drag to move conversation' : rowModel.title}
      aria-expanded={item.kind === 'group' ? expanded : undefined}
      onClick={() => {
        if (item.kind === 'group') {
          onToggleGroup(item);
          return;
        }
        onOpenItem?.(item);
      }}
      onContextMenu={(event) => {
        if (!renderContextMenu) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu?.(item, event.clientX, event.clientY);
      }}
    >
      <ActivityTreeDropMarker position={rowDropPosition} />
      <ActivityTreeLeadingSlot
        expanded={expanded}
        item={item}
        rowModel={rowModel}
        onToggleBranch={onToggleBranch}
        onToggleGroup={onToggleGroup}
      />
      {rowModel.showConversationStatus && rowModel.showExpander ? <ConversationStatusSlot rowModel={rowModel} /> : null}
      <ActivityTreePinnedIcon pinned={rowModel.conversationIsPinned} />
      <span className="min-w-0 flex-1 truncate text-[12px] leading-[1.15] text-primary">{item.title}</span>
      <ActivityTreeTrailingStatus expanded={expanded} item={item} rowModel={rowModel} />
      <ActivityTreeRowActions
        inlineActions={inlineActions}
        item={item}
        renderContextMenu={renderContextMenu}
        rowModel={rowModel}
        onArchiveItem={onArchiveItem}
        onCreateChildItem={onCreateChildItem}
        onInlineAction={onInlineAction}
        onOpenContextMenu={onOpenContextMenu}
      />
    </button>
  );
});
