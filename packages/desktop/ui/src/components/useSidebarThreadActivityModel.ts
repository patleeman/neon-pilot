import { useEffect, useMemo, useState } from 'react';

import { type ActivityTreeItem, buildConversationActivityId } from '../activity/activityTree';
import { applyActivityTreeItemStyleProviders } from '../activity/activityTreeExtensionStyles';
import { selectConversationActiveExecutions, summarizeConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import { DRAFT_CONVERSATION_ID, DRAFT_CONVERSATION_ROUTE } from '../conversation/draftConversation';
import type { ExtensionActivityTreeItemStyleRegistration } from '../extensions/useExtensionRegistry';
import type { ExecutionListResult, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import { buildActivityTreeGroupId, buildSidebarActivityTreeItems } from './sidebarActivityTreeModel';
import {
  buildSidebarThreadModel,
  type SidebarConversationGroup,
  type SidebarConversationItem,
  type ThreadsFilterMode,
  type ThreadsOrganizeMode,
  type ThreadsSortMode,
} from './sidebarThreadModel';

type UseSidebarThreadActivityModelInput = {
  activeConversationId: string | null;
  collapsedConversationGroupKeys: readonly string[];
  collapsedConversationGroupKeySet: ReadonlySet<string>;
  conversationGroupLabelOverrides: Record<string, string>;
  executions: ExecutionListResult | null;
  liveTitles: ReadonlyMap<string, string>;
  locationPathname: string;
  openWorkspacePaths: readonly string[];
  pinnedSessions: readonly SessionMeta[];
  pinnedIds: readonly string[];
  pinnedWorkspacePaths: readonly string[];
  savedWorkspacePaths: readonly string[];
  styleProviders: readonly ExtensionActivityTreeItemStyleRegistration[];
  tasks: readonly ScheduledTaskSummary[] | null;
  threadsFilterMode: ThreadsFilterMode;
  threadsOrganizeMode: ThreadsOrganizeMode;
  threadsSortMode: ThreadsSortMode;
  visibleConversationTabs: readonly SessionMeta[];
};

type ResolveSidebarConversationHotkeyOrderInput<T> = {
  organizeMode: ThreadsOrganizeMode;
  orderedItems: readonly T[];
  groupedRows: ReadonlyArray<{ key: string; items: readonly T[] }>;
  collapsedGroupKeys?: ReadonlySet<string>;
};

function resolveSidebarConversationHotkeyOrder<T>(input: ResolveSidebarConversationHotkeyOrderInput<T>): T[] {
  if (input.organizeMode !== 'project') {
    return [...input.orderedItems];
  }

  return input.groupedRows.flatMap((group) => (input.collapsedGroupKeys?.has(group.key) ? [] : [...group.items]));
}

export function useSidebarThreadActivityModel({
  activeConversationId,
  collapsedConversationGroupKeys,
  collapsedConversationGroupKeySet,
  conversationGroupLabelOverrides,
  executions,
  liveTitles,
  locationPathname,
  openWorkspacePaths,
  pinnedIds,
  pinnedSessions,
  pinnedWorkspacePaths,
  savedWorkspacePaths,
  styleProviders,
  tasks,
  threadsFilterMode,
  threadsOrganizeMode,
  threadsSortMode,
  visibleConversationTabs,
}: UseSidebarThreadActivityModelInput) {
  const threadModel = useMemo(
    () =>
      buildSidebarThreadModel({
        activeConversationId,
        automationConversationIds: new Set((tasks ?? []).flatMap((task) => (task.threadConversationId ? [task.threadConversationId] : []))),
        conversationGroupLabelOverrides,
        filterMode: threadsFilterMode,
        openWorkspacePaths,
        organizeMode: threadsOrganizeMode,
        pinnedSessions,
        pinnedWorkspacePaths,
        savedWorkspacePaths,
        sortMode: threadsSortMode,
        visibleConversationTabs,
      }),
    [
      activeConversationId,
      conversationGroupLabelOverrides,
      openWorkspacePaths,
      pinnedSessions,
      pinnedWorkspacePaths,
      savedWorkspacePaths,
      tasks,
      threadsFilterMode,
      threadsOrganizeMode,
      threadsSortMode,
      visibleConversationTabs,
    ],
  );

  const { filteredConversationItems, groupedConversationRows, renderedConversationItems } = threadModel;

  const activeExecutionsByConversationId = useMemo(() => {
    const next = new Map<string, ReturnType<typeof selectConversationActiveExecutions>>();
    for (const item of renderedConversationItems) {
      const activeExecutions = selectConversationActiveExecutions({
        conversationId: item.session.id,
        executions,
        tasks,
      });
      if (activeExecutions.length > 0) {
        next.set(item.session.id, activeExecutions);
      }
    }
    return next;
  }, [executions, renderedConversationItems, tasks]);

  const pendingExecutionConversationIdSet = useMemo(
    () => new Set(activeExecutionsByConversationId.keys()),
    [activeExecutionsByConversationId],
  );

  const backgroundWorkKindByConversationId = useMemo(
    () =>
      new Map(
        [...activeExecutionsByConversationId.entries()].map(([conversationId, activeExecutions]) => [
          conversationId,
          summarizeConversationBackgroundWorkKind(activeExecutions),
        ]),
      ),
    [activeExecutionsByConversationId],
  );

  const activeConversationSurfaceId = useMemo(() => {
    if (locationPathname === DRAFT_CONVERSATION_ROUTE) {
      return DRAFT_CONVERSATION_ID;
    }

    return activeConversationId;
  }, [activeConversationId, locationPathname]);

  const conversationGroupsByKey = useMemo(
    () => new Map(groupedConversationRows.map((group) => [group.key, group] as const)),
    [groupedConversationRows],
  );

  const conversationItemBySessionId = useMemo(
    () => new Map(renderedConversationItems.map((item) => [item.session.id, item] as const)),
    [renderedConversationItems],
  );

  const runningAutomationConversationIdSet = useMemo(
    () => new Set((tasks ?? []).flatMap((task) => (task.running && task.threadConversationId ? [task.threadConversationId] : []))),
    [tasks],
  );

  const baseActivityTreeItems = useMemo(
    () =>
      buildSidebarActivityTreeItems({
        backgroundWorkKindByConversationId,
        groupedConversationRows,
        liveTitles,
        pendingExecutionConversationIds: pendingExecutionConversationIdSet,
        pinnedConversationIds: pinnedIds,
        renderedConversationItems,
        runningAutomationConversationIds: runningAutomationConversationIdSet,
        threadsFilterMode,
        threadsOrganizeMode,
      }),
    [
      backgroundWorkKindByConversationId,
      groupedConversationRows,
      liveTitles,
      pendingExecutionConversationIdSet,
      pinnedIds,
      renderedConversationItems,
      runningAutomationConversationIdSet,
      threadsFilterMode,
      threadsOrganizeMode,
    ],
  );

  const [styledActivityTreeItems, setStyledActivityTreeItems] = useState<ActivityTreeItem[] | null>(null);

  useEffect(() => {
    if (styleProviders.length === 0 || baseActivityTreeItems.length === 0) {
      setStyledActivityTreeItems(null);
      return;
    }

    setStyledActivityTreeItems(null);
    let cancelled = false;
    void applyActivityTreeItemStyleProviders(baseActivityTreeItems, styleProviders).then((styledItems) => {
      if (!cancelled) {
        setStyledActivityTreeItems(styledItems);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [baseActivityTreeItems, styleProviders]);
  const activityTreeItems = styledActivityTreeItems ?? baseActivityTreeItems;

  const activeActivityTreeItemId = activeConversationId ? buildConversationActivityId(activeConversationId) : null;
  const collapsedActivityTreeGroupItemIds = useMemo(
    () => new Set(collapsedConversationGroupKeys.map((key) => buildActivityTreeGroupId(key))),
    [collapsedConversationGroupKeys],
  );
  const conversationGroupByKey = useMemo(
    () => new Map(groupedConversationRows.map((group) => [group.key, group] as const)),
    [groupedConversationRows],
  );
  const hotkeyConversationItems = useMemo(
    () =>
      resolveSidebarConversationHotkeyOrder({
        organizeMode: threadsOrganizeMode,
        orderedItems: filteredConversationItems,
        groupedRows: groupedConversationRows,
        collapsedGroupKeys: collapsedConversationGroupKeySet,
      }),
    [collapsedConversationGroupKeySet, filteredConversationItems, groupedConversationRows, threadsOrganizeMode],
  );

  return {
    activeActivityTreeItemId,
    activeConversationSurfaceId,
    activityTreeItems,
    collapsedActivityTreeGroupItemIds,
    conversationGroupByKey: conversationGroupByKey as ReadonlyMap<string, SidebarConversationGroup>,
    conversationGroupsByKey: conversationGroupsByKey as ReadonlyMap<string, SidebarConversationGroup>,
    conversationItemBySessionId: conversationItemBySessionId as ReadonlyMap<string, SidebarConversationItem>,
    groupedConversationRows,
    hotkeyConversationItems,
    renderedConversationItems,
  };
}
