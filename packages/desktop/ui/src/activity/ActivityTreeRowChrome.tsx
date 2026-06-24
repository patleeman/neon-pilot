import type { MouseEvent } from 'react';

import { ConversationStatusText } from '../components/ConversationStatusText';
import { IconButton } from '../components/ui';
import { timeAgoCompact } from '../shared/utils';
import type { ActivityTreeItem } from './activityTree';
import type { ActivityTreeRowModel } from './activityTreeRowModel';
import type { ActivityTreeDropPosition } from './useActivityTreeDrag';

export type ActivityTreeInlineAction = { id: string; title: string; icon?: string };

export function ActivityTreeDropMarker({ position }: { position: ActivityTreeDropPosition | null }) {
  if (!position) return null;
  return (
    <span
      aria-hidden="true"
      className={[
        'pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-sm bg-accent opacity-80',
        position === 'before' ? 'top-0' : 'bottom-0',
      ].join(' ')}
    />
  );
}

export function ActivityTreeLeadingSlot({
  expanded,
  item,
  rowModel,
  onToggleBranch,
  onToggleGroup,
}: {
  expanded: boolean;
  item: ActivityTreeItem;
  rowModel: ActivityTreeRowModel;
  onToggleBranch: (itemId: string) => void;
  onToggleGroup: (item: ActivityTreeItem) => void;
}) {
  if (item.kind === 'group') {
    return (
      <ExpanderButton
        label={`${expanded ? 'Collapse' : 'Expand'} ${item.title}`}
        expanded={expanded}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleGroup(item);
        }}
      />
    );
  }

  if (rowModel.showExpander) {
    return (
      <ExpanderButton
        label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
        title={getExpanderTitle(rowModel.conversationChildCount, expanded)}
        expanded={expanded}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleBranch(item.id);
        }}
      />
    );
  }

  if (rowModel.showConversationStatus) {
    return <ConversationStatusSlot rowModel={rowModel} />;
  }

  return <span className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

export function ActivityTreeTrailingStatus({
  expanded,
  item,
  rowModel,
}: {
  expanded: boolean;
  item: ActivityTreeItem;
  rowModel: ActivityTreeRowModel;
}) {
  if (item.kind === 'conversation' && !expanded && rowModel.conversationChildCount > 0) {
    return (
      <span
        className="ui-sidebar-session-meta shrink-0 whitespace-nowrap"
        title={`${rowModel.conversationChildCount} child branch${rowModel.conversationChildCount === 1 ? '' : 'es'}`}
      >
        {rowModel.conversationChildCount}
      </span>
    );
  }

  if (item.kind === 'conversation' && item.updatedAt) {
    return (
      <span className="ui-sidebar-session-meta ui-sidebar-session-time shrink-0 whitespace-nowrap">{timeAgoCompact(item.updatedAt)}</span>
    );
  }

  if (item.status !== 'idle' && item.kind !== 'conversation') {
    return <span className="ui-card-meta shrink-0">{formatActivityTreeStatus(item.status)}</span>;
  }

  return null;
}

export function ActivityTreeRowActions({
  inlineActions,
  item,
  renderContextMenu,
  rowModel,
  onArchiveItem,
  onCreateChildItem,
  onInlineAction,
  onOpenContextMenu,
}: {
  inlineActions: readonly ActivityTreeInlineAction[];
  item: ActivityTreeItem;
  renderContextMenu: boolean;
  rowModel: ActivityTreeRowModel;
  onArchiveItem?: (item: ActivityTreeItem) => void;
  onCreateChildItem?: (item: ActivityTreeItem) => void;
  onInlineAction?: (actionId: string, item: ActivityTreeItem) => void;
  onOpenContextMenu?: (item: ActivityTreeItem, x: number, y: number) => void;
}) {
  return (
    <>
      {item.kind === 'group' && renderContextMenu ? (
        <IconButton
          tabIndex={-1}
          compact
          className="h-5 w-5 shrink-0"
          aria-label={`Workspace actions for ${item.title}`}
          title={
            typeof item.metadata?.cwd === 'string' ? `Workspace actions for ${item.metadata.cwd}` : `Workspace actions for ${item.title}`
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenContextMenu?.(item, rect.left, rect.bottom + 4);
          }}
        >
          <MoreActionsIcon />
        </IconButton>
      ) : null}
      {rowModel.canCreateChild ? (
        <IconButton
          tabIndex={-1}
          compact
          className="h-5 w-5 shrink-0"
          aria-label={`New conversation in ${item.title}`}
          title={typeof item.metadata?.cwd === 'string' ? `New conversation in ${item.metadata.cwd}` : `New conversation in ${item.title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onCreateChildItem?.(item);
          }}
        >
          <PlusIcon />
        </IconButton>
      ) : null}
      {inlineActions.map((action) => (
        <IconButton
          key={action.id}
          tabIndex={-1}
          compact
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={action.title}
          title={action.title}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onInlineAction?.(action.id, item);
          }}
        >
          {action.icon ?? '•'}
        </IconButton>
      ))}
      {rowModel.canArchive ? (
        <IconButton
          tabIndex={-1}
          compact
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label="Archive conversation"
          title="Archive conversation"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onArchiveItem?.(item);
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </>
  );
}

function MoreActionsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="6" r="1.15" />
      <circle cx="6" cy="6" r="1.15" />
      <circle cx="10" cy="6" r="1.15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ActivityTreePinnedIcon({ pinned }: { pinned: boolean }) {
  if (!pinned) return null;
  return (
    <span className="ui-sidebar-pinned-icon shrink-0" title="Pinned chat" aria-label="Pinned chat">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15.75 3.75 4.5 4.5-3 3v3l-2.25 2.25-7.5-7.5L9.75 6.75h3l3-3ZM9.75 14.25 4.5 19.5" />
      </svg>
    </span>
  );
}

export function ActivityTreeLockIcon({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <span className="shrink-0 text-dim" title="Locked conversation" aria-label="Locked conversation">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7.5 10.5V8.25a4.5 4.5 0 0 1 9 0v2.25M6.75 10.5h10.5A1.5 1.5 0 0 1 18.75 12v6A1.5 1.5 0 0 1 17.25 19.5H6.75A1.5 1.5 0 0 1 5.25 18v-6a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    </span>
  );
}

export function ConversationStatusSlot({ rowModel }: { rowModel: ActivityTreeRowModel }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      <ConversationStatusText
        isRunning={rowModel.conversationIsRunning}
        hasPendingRuns={rowModel.conversationHasPendingRuns}
        backgroundWorkKind={rowModel.conversationBackgroundWorkKind}
        needsAttention={rowModel.conversationNeedsAttention}
      />
    </span>
  );
}

function ExpanderButton({
  expanded,
  label,
  title,
  onClick,
}: {
  expanded: boolean;
  label: string;
  title?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <IconButton
      tabIndex={-1}
      compact
      className="-ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-0 bg-transparent !p-0 text-dim hover:text-primary"
      aria-label={label}
      aria-expanded={expanded}
      title={title}
      onClick={onClick}
    >
      {expanded ? '▾' : '▸'}
    </IconButton>
  );
}

function getExpanderTitle(conversationChildCount: number, expanded: boolean): string {
  if (conversationChildCount > 0) {
    return expanded ? 'Collapse branches' : 'Expand branches';
  }
  return expanded ? 'Collapse children' : 'Expand children';
}

function formatActivityTreeStatus(status: ActivityTreeItem['status']): string {
  switch (status) {
    case 'running':
      return 'run';
    case 'queued':
      return 'wait';
    case 'failed':
      return 'fail';
    case 'done':
      return 'done';
    case 'idle':
    default:
      return 'idle';
  }
}
