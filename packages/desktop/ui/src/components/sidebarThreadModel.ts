import {
  buildConversationGroupLabels,
  getConversationGroupLabel,
  groupConversationItemsByCwd,
} from '../conversation/conversationCwdGroups';
import { isNeutralChatCwdPath } from '../conversation/conversationCwdPresentation';
import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';
import type { ConversationShelf } from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';

export type ThreadsOrganizeMode = 'project' | 'chronological';
export type ThreadsFilterMode = 'all' | 'human' | 'automation';
type ThreadsSortMode = 'created' | 'updated';

export type SidebarConversationItem = {
  session: SessionMeta;
  section: ConversationShelf;
  pinned: boolean;
  originalIndex: number;
};

export type SidebarConversationGroup = {
  key: string;
  cwd: string | null;
  label: string;
  defaultLabel: string;
  items: SidebarConversationItem[];
};

type SidebarThreadModelInput = {
  activeConversationId: string | null;
  automationConversationIds: ReadonlySet<string>;
  conversationGroupLabelOverrides: Record<string, string>;
  filterMode: ThreadsFilterMode;
  openWorkspacePaths: readonly string[];
  organizeMode: ThreadsOrganizeMode;
  pinnedSessions: readonly SessionMeta[];
  pinnedWorkspacePaths: readonly string[];
  savedWorkspacePaths: readonly string[];
  sortMode: ThreadsSortMode;
  visibleConversationTabs: readonly SessionMeta[];
};

export type SidebarThreadModel = {
  filteredConversationItems: SidebarConversationItem[];
  groupedConversationRows: SidebarConversationGroup[];
  orderedConversationItems: SidebarConversationItem[];
  renderedConversationItems: SidebarConversationItem[];
  workspaceOrder: string[];
};

function isSidebarVisibleConversation(session: SessionMeta): boolean {
  return session.offshootKind !== 'subagent' && !session.sourceRunId;
}

function getConversationItemSortTimestamp(session: SessionMeta, sortMode: ThreadsSortMode): number {
  const source = sortMode === 'created' ? session.timestamp : (session.lastActivityAt ?? session.attentionUpdatedAt ?? session.timestamp);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source)) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(source);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === source ? parsed : Number.NEGATIVE_INFINITY;
}

function compareConversationItems(left: SidebarConversationItem, right: SidebarConversationItem, sortMode: ThreadsSortMode): number {
  const timestampDelta =
    getConversationItemSortTimestamp(right.session, sortMode) - getConversationItemSortTimestamp(left.session, sortMode);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return left.originalIndex - right.originalIndex;
}

export function getSessionWorkspaceCwd(session: Pick<SessionMeta, 'cwd' | 'workspaceCwd'>): string | null {
  const workspaceCwd = session.workspaceCwd?.trim();
  if (workspaceCwd && !isNeutralChatCwdPath(workspaceCwd)) {
    return workspaceCwd;
  }

  const cwd = session.cwd?.trim();
  return cwd && !isNeutralChatCwdPath(cwd) ? cwd : null;
}

export function buildSidebarThreadModel(input: SidebarThreadModelInput): SidebarThreadModel {
  const pinnedItems: SidebarConversationItem[] = input.pinnedSessions.map((session, originalIndex) => ({
    session,
    section: 'pinned',
    pinned: true,
    originalIndex,
  }));
  const openItems: SidebarConversationItem[] = input.visibleConversationTabs.map((session, originalIndex) => ({
    session,
    section: 'open',
    pinned: false,
    originalIndex,
  }));

  const orderedConversationItems = [
    ...pinnedItems,
    ...[...openItems].sort((left, right) => compareConversationItems(left, right, input.sortMode)),
  ];

  const filteredConversationItems = orderedConversationItems.filter((item) => {
    if (!isSidebarVisibleConversation(item.session) && item.session.id !== input.activeConversationId) {
      return false;
    }
    const isAutomation = input.automationConversationIds.has(item.session.id);
    if (input.filterMode === 'automation') {
      return isAutomation;
    }
    if (input.filterMode === 'human') {
      return !isAutomation;
    }
    return true;
  });

  const workspaceOrder = normalizeWorkspacePaths([
    ...input.pinnedWorkspacePaths,
    ...input.savedWorkspacePaths,
    ...input.openWorkspacePaths,
  ]);
  const conversationGroupLabels = buildConversationGroupLabels([
    ...workspaceOrder,
    ...filteredConversationItems.map((item) => getSessionWorkspaceCwd(item.session)),
  ]);

  const groupedConversationRows = buildGroupedConversationRows({
    conversationGroupLabels,
    conversationGroupLabelOverrides: input.conversationGroupLabelOverrides,
    filteredConversationItems,
    filterMode: input.filterMode,
    organizeMode: input.organizeMode,
    workspaceOrder,
  });
  const renderedConversationItems =
    input.organizeMode === 'project' ? groupedConversationRows.flatMap((group) => group.items) : filteredConversationItems;

  return {
    filteredConversationItems,
    groupedConversationRows,
    orderedConversationItems,
    renderedConversationItems,
    workspaceOrder,
  };
}

function buildGroupedConversationRows(input: {
  conversationGroupLabels: Map<string, string>;
  conversationGroupLabelOverrides: Record<string, string>;
  filteredConversationItems: readonly SidebarConversationItem[];
  filterMode: ThreadsFilterMode;
  organizeMode: ThreadsOrganizeMode;
  workspaceOrder: readonly string[];
}): SidebarConversationGroup[] {
  if (input.organizeMode !== 'project') {
    return [];
  }

  const groupsByCwdKey = new Map(
    groupConversationItemsByCwd(input.filteredConversationItems, (item) => getSessionWorkspaceCwd(item.session), {
      labelsByCwd: input.conversationGroupLabels,
    }).map((group) => [group.key, group] as const),
  );
  const baseGroups =
    input.filterMode === 'all'
      ? input.workspaceOrder.map(
          (workspacePath) =>
            groupsByCwdKey.get(workspacePath) ?? {
              key: workspacePath,
              cwd: workspacePath,
              label: getConversationGroupLabel(workspacePath, { labelsByCwd: input.conversationGroupLabels }),
              items: [],
            },
        )
      : [];
  const groups = [...baseGroups];
  const seenGroupKeys = new Set(groups.map((group) => group.key));

  for (const group of groupsByCwdKey.values()) {
    if (seenGroupKeys.has(group.key)) {
      continue;
    }

    groups.push(group);
    seenGroupKeys.add(group.key);
  }

  return groups.map((group) => ({
    key: group.key,
    cwd: group.cwd,
    defaultLabel: group.cwd ? group.label : 'Chats',
    label: input.conversationGroupLabelOverrides[group.key]?.trim() || (group.cwd ? group.label : 'Chats'),
    items: group.items,
  }));
}
