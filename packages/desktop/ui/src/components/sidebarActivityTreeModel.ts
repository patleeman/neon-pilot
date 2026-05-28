import { type ActivityTreeItem, buildActivityTreeItems } from '../activity/activityTree';
import type { ConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import type { SessionMeta } from '../shared/types';
import type { SidebarConversationGroup, SidebarConversationItem, ThreadsFilterMode, ThreadsOrganizeMode } from './sidebarThreadModel';

export function buildActivityTreeGroupId(groupKey: string): string {
  return `group:${groupKey || 'chats'}`;
}

export function buildSidebarActivityTreeItems(input: {
  backgroundWorkKindByConversationId: ReadonlyMap<string, ConversationBackgroundWorkKind | null>;
  groupedConversationRows: readonly SidebarConversationGroup[];
  liveTitles: ReadonlyMap<string, string>;
  pendingExecutionConversationIds: ReadonlySet<string>;
  pinnedConversationIds: readonly string[];
  renderedConversationItems: readonly SidebarConversationItem[];
  runningAutomationConversationIds: ReadonlySet<string>;
  threadsFilterMode: ThreadsFilterMode;
  threadsOrganizeMode: ThreadsOrganizeMode;
}): ActivityTreeItem[] {
  const conversationItemBySessionId = new Map(input.renderedConversationItems.map((item) => [item.session.id, item] as const));
  const pinnedIdSet = new Set(input.pinnedConversationIds);
  const flatItems = buildActivityTreeItems({
    conversations: buildActivityTreeSessions(input.renderedConversationItems, input.liveTitles),
  }).map((item) => {
    const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
    if (!conversationId) return item;

    const metadata = {
      ...item.metadata,
      ...(conversationItemBySessionId.has(conversationId) ? {} : { canArchive: false }),
      ...(pinnedIdSet.has(conversationId) ? { isPinned: true } : {}),
      ...(input.runningAutomationConversationIds.has(conversationId) ? { isRunning: true, hasPendingRuns: false } : {}),
      ...(input.pendingExecutionConversationIds.has(conversationId) && !input.runningAutomationConversationIds.has(conversationId)
        ? { hasPendingRuns: true, backgroundWorkKind: input.backgroundWorkKindByConversationId.get(conversationId) }
        : {}),
    };
    return { ...item, status: metadata.isRunning ? 'running' : item.status, metadata };
  });

  if (input.threadsOrganizeMode !== 'project' || input.groupedConversationRows.length === 0) {
    return flatItems;
  }

  const groupByConversationId = new Map<string, SidebarConversationGroup>();
  for (const group of input.groupedConversationRows) {
    for (const item of group.items) {
      groupByConversationId.set(item.session.id, group);
    }
  }

  const usedGroupKeys = new Set<string>();
  const groupedItems = flatItems.map((item) => {
    const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
    const group = conversationId ? groupByConversationId.get(conversationId) : null;
    if (!group || item.kind !== 'conversation') return item;

    usedGroupKeys.add(group.key);
    if (item.parentId) return item;

    return { ...item, parentId: buildActivityTreeGroupId(group.key) } satisfies ActivityTreeItem;
  });
  const groupItems = input.groupedConversationRows
    .filter((group) => input.threadsFilterMode === 'all' || usedGroupKeys.has(group.key))
    .map(
      (group) =>
        ({
          id: buildActivityTreeGroupId(group.key),
          kind: 'group',
          title: group.label,
          subtitle: group.cwd ?? undefined,
          status: 'idle',
          metadata: { cwd: group.cwd, groupKey: group.key, defaultLabel: group.defaultLabel },
        }) satisfies ActivityTreeItem,
    );

  return [...groupItems, ...groupedItems];
}

function buildActivityTreeSessions(
  renderedConversationItems: readonly SidebarConversationItem[],
  liveTitles: ReadonlyMap<string, string>,
): SessionMeta[] {
  return renderedConversationItems.map(({ session }) => {
    const liveTitle = liveTitles.get(session.id);
    const titledSession = liveTitle && liveTitle !== session.title ? { ...session, title: liveTitle } : session;

    return {
      ...titledSession,
      parentSessionId: undefined,
      parentSessionFile: undefined,
      parentMessageId: undefined,
      offshootKind: titledSession.offshootKind ?? (titledSession.sourceRunId ? 'subagent' : undefined),
    };
  });
}
