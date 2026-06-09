import type { ConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import type { ActivityTreeItem } from './activityTree';

const ACTIVITY_TREE_ROOT_INDENT_REM = 0.25;
const ACTIVITY_TREE_CHILD_INDENT_REM = 0.375;

function getActivityTreeRowPaddingLeftRem(item: ActivityTreeItem, depth: number): number {
  if (item.kind === 'group') {
    return ACTIVITY_TREE_ROOT_INDENT_REM;
  }
  return ACTIVITY_TREE_ROOT_INDENT_REM + Math.max(0, depth) * ACTIVITY_TREE_CHILD_INDENT_REM;
}

export type ActivityTreeRowModel = {
  canArchive: boolean;
  canCreateChild: boolean;
  conversationBackgroundWorkKind: ConversationBackgroundWorkKind | null;
  conversationChildCount: number;
  conversationHasPendingRuns: boolean;
  conversationIsPinned: boolean;
  conversationIsRunning: boolean;
  conversationNeedsAttention: boolean;
  dataSidebarGroupKey: string | undefined;
  dataSidebarSessionId: string | undefined;
  rowPaddingLeftRem: number;
  showConversationStatus: boolean;
  showExpander: boolean;
  title: string | undefined;
};

export function buildActivityTreeRowModel({
  childCount,
  conversationChildCount,
  depth,
  hasArchiveAction,
  hasCreateChildAction,
  item,
}: {
  childCount: number;
  conversationChildCount: number;
  depth: number;
  hasArchiveAction: boolean;
  hasCreateChildAction: boolean;
  item: ActivityTreeItem;
}): ActivityTreeRowModel {
  const conversationIsRunning = item.kind === 'conversation' && item.metadata?.isRunning === true;
  const conversationNeedsAttention = item.kind === 'conversation' && item.metadata?.needsAttention === true;
  const conversationHasPendingRuns = item.kind === 'conversation' && item.metadata?.hasPendingRuns === true;
  const conversationBackgroundWorkKind =
    item.kind === 'conversation' && typeof item.metadata?.backgroundWorkKind === 'string'
      ? (item.metadata.backgroundWorkKind as ConversationBackgroundWorkKind)
      : null;
  const conversationIsPinned = item.kind === 'conversation' && item.metadata?.isPinned === true;

  return {
    canArchive: item.kind === 'conversation' && hasArchiveAction && item.metadata?.canArchive !== false,
    canCreateChild: item.kind === 'group' && hasCreateChildAction,
    conversationBackgroundWorkKind,
    conversationChildCount,
    conversationHasPendingRuns,
    conversationIsPinned,
    conversationIsRunning,
    conversationNeedsAttention,
    dataSidebarGroupKey: typeof item.metadata?.groupKey === 'string' ? item.metadata.groupKey : undefined,
    dataSidebarSessionId: typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : undefined,
    rowPaddingLeftRem: getActivityTreeRowPaddingLeftRem(item, depth),
    showConversationStatus: conversationIsRunning || conversationHasPendingRuns || conversationNeedsAttention,
    showExpander: childCount > 0 && item.kind !== 'group',
    title: typeof item.metadata?.tooltip === 'string' ? item.metadata.tooltip : item.subtitle,
  };
}
