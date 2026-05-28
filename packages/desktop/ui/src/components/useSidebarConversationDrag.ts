import { type DragEvent, useCallback, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { ActivityTreeItem } from '../activity/activityTree';
import type { ActivityTreeDropPosition } from '../activity/ActivityTreeView';
import { api } from '../client/api';
import { buildConversationSurfacePath } from '../conversation/conversationRoutes';
import { DRAFT_CONVERSATION_ID } from '../conversation/draftConversation';
import { type ConversationShelf, readConversationLayout, replaceConversationLayout } from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';
import { getSessionWorkspaceCwd, type SidebarConversationGroup, type SidebarConversationItem } from './sidebarThreadModel';

type UseSidebarConversationDragInput = {
  activeConversationSurfaceId: string | null;
  archivedConversationIds: readonly string[];
  conversationGroupsByKey: ReadonlyMap<string, SidebarConversationGroup>;
  conversationItemBySessionId: ReadonlyMap<string, SidebarConversationItem>;
  conversationSurfaceId: string;
  navigate: NavigateFunction;
  openIds: readonly string[];
  pinnedIds: readonly string[];
  pinnedSessions: readonly SessionMeta[];
  refetch: () => Promise<void>;
  showNotice: (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;
  tabs: readonly SessionMeta[];
};

function getActivityTreeConversationId(item: ActivityTreeItem): string | null {
  const conversationId = item.metadata?.conversationId;
  return typeof conversationId === 'string' && conversationId.trim() ? conversationId : null;
}

export function getActivityTreeGroupKey(item: ActivityTreeItem): string | null {
  const groupKey = item.metadata?.groupKey;
  return typeof groupKey === 'string' && groupKey.trim() ? groupKey : null;
}

export function useSidebarConversationDrag({
  activeConversationSurfaceId,
  archivedConversationIds,
  conversationGroupsByKey,
  conversationItemBySessionId,
  conversationSurfaceId,
  navigate,
  openIds,
  pinnedIds,
  pinnedSessions,
  refetch,
  showNotice,
  tabs,
}: UseSidebarConversationDragInput) {
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);

  const clearDragState = useCallback(() => {
    setDraggingSessionId(null);
  }, []);

  const canDropConversationOnGroup = useCallback(
    (draggedSessionId: string, targetGroupKey: string): boolean => {
      const targetGroup = conversationGroupsByKey.get(targetGroupKey);
      if (!targetGroup) {
        return false;
      }

      const draggedSession = [...pinnedSessions, ...tabs].find((session) => session.id === draggedSessionId);
      if (!draggedSession) {
        return false;
      }

      return getSessionWorkspaceCwd(draggedSession) !== (targetGroup.cwd ?? null);
    },
    [conversationGroupsByKey, pinnedSessions, tabs],
  );

  const handleTabDragStart = useCallback((section: ConversationShelf, sessionId: string, event: DragEvent<HTMLElement>) => {
    setDraggingSessionId(sessionId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-neon-pilot-conversation', sessionId);
    event.dataTransfer.setData('application/x-neon-pilot-conversation-section', section);
    event.dataTransfer.setData('text/plain', sessionId);
  }, []);

  const handleConversationCwdDrop = useCallback(
    async (targetGroupKey: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();

      const draggedConversationId =
        draggingSessionId ||
        event.dataTransfer.getData('application/x-neon-pilot-conversation') ||
        event.dataTransfer.getData('text/plain');
      const targetGroup = conversationGroupsByKey.get(targetGroupKey);
      if (!draggedConversationId || !targetGroup || !canDropConversationOnGroup(draggedConversationId, targetGroupKey)) {
        clearDragState();
        return;
      }

      clearDragState();
      try {
        const result = await api.changeConversationCwd(
          draggedConversationId,
          targetGroup.cwd,
          conversationSurfaceId,
          targetGroup.cwd === null ? null : undefined,
        );
        if (result.changed && result.id !== draggedConversationId) {
          const nextActiveSessionId =
            activeConversationSurfaceId === draggedConversationId ? result.id : readConversationLayout().activeSessionId;
          replaceConversationLayout({
            sessionIds: openIds.map((id) => (id === draggedConversationId ? result.id : id)),
            pinnedSessionIds: pinnedIds.map((id) => (id === draggedConversationId ? result.id : id)),
            archivedSessionIds: archivedConversationIds,
            activeSessionId: nextActiveSessionId,
          });

          if (activeConversationSurfaceId === draggedConversationId) {
            navigate(buildConversationSurfacePath(result.id));
          }
        }
        await refetch();
        showNotice(
          'accent',
          result.changed === false ? `Conversation is already in ${targetGroup.label}.` : `Moved conversation to ${targetGroup.label}.`,
        );
      } catch (error) {
        showNotice('danger', `Move failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
      }
    },
    [
      activeConversationSurfaceId,
      archivedConversationIds,
      canDropConversationOnGroup,
      clearDragState,
      conversationGroupsByKey,
      conversationSurfaceId,
      draggingSessionId,
      navigate,
      openIds,
      pinnedIds,
      refetch,
      showNotice,
    ],
  );

  const getActivityTreeConversationSection = useCallback(
    (conversationId: string): ConversationShelf | null => conversationItemBySessionId.get(conversationId)?.section ?? null,
    [conversationItemBySessionId],
  );

  const canDragActivityTreeItem = useCallback((item: ActivityTreeItem): boolean => {
    if (item.kind === 'group') {
      return false;
    }

    if (item.kind !== 'conversation') {
      return false;
    }

    const conversationId = getActivityTreeConversationId(item);
    return Boolean(conversationId && conversationId !== DRAFT_CONVERSATION_ID);
  }, []);

  const canDropActivityTreeItem = useCallback(
    (draggedItem: ActivityTreeItem, targetItem: ActivityTreeItem, _position: ActivityTreeDropPosition): boolean => {
      const draggedConversationId = getActivityTreeConversationId(draggedItem);
      if (!draggedConversationId || targetItem.kind !== 'group') {
        return false;
      }

      const targetGroupKey = getActivityTreeGroupKey(targetItem);
      return Boolean(targetGroupKey && canDropConversationOnGroup(draggedConversationId, targetGroupKey));
    },
    [canDropConversationOnGroup],
  );

  const handleActivityTreeDragStart = useCallback(
    (item: ActivityTreeItem, event: DragEvent<HTMLElement>) => {
      const conversationId = getActivityTreeConversationId(item);
      if (conversationId) {
        const section = getActivityTreeConversationSection(conversationId);
        if (section) {
          handleTabDragStart(section, conversationId, event);
        }
        return;
      }

      clearDragState();
    },
    [clearDragState, getActivityTreeConversationSection, handleTabDragStart],
  );

  const handleActivityTreeDrop = useCallback(
    (draggedItem: ActivityTreeItem, targetItem: ActivityTreeItem, _position: ActivityTreeDropPosition, event: DragEvent<HTMLElement>) => {
      const draggedConversationId = getActivityTreeConversationId(draggedItem);
      if (draggedConversationId) {
        const targetGroupKey = getActivityTreeGroupKey(targetItem);
        if (targetGroupKey) {
          void handleConversationCwdDrop(targetGroupKey, event);
          return;
        }

        clearDragState();
        return;
      }

      clearDragState();
    },
    [clearDragState, handleConversationCwdDrop],
  );

  return {
    canDragActivityTreeItem,
    canDropActivityTreeItem,
    clearDragState,
    draggingSessionId,
    getActivityTreeGroupKey,
    handleActivityTreeDragStart,
    handleActivityTreeDrop,
  };
}
