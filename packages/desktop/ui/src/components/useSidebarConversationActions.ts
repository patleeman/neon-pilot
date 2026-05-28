import { type Dispatch, type SetStateAction, useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import {
  buildConversationSurfacePath,
  resolveConversationAdjacentPath,
  resolveConversationCloseRedirect,
} from '../conversation/conversationRoutes';
import {
  clearDraftConversationAttachments,
  clearDraftConversationComposer,
  clearDraftConversationCwd,
  clearDraftConversationModel,
  clearDraftConversationThinkingLevel,
  DRAFT_CONVERSATION_ID,
  DRAFT_CONVERSATION_ROUTE,
} from '../conversation/draftConversation';
import type { SessionMeta } from '../shared/types';

type CloseSession = (sessionId: string) => void;
type PinSession = (sessionId: string) => void;
type UnpinSession = (sessionId: string, options?: { open?: boolean }) => void;
type ArchiveSession = (sessionId: string) => void;
type RestoreSession = (sessionId: string) => void;
type ShiftSession = (sessionId: string, direction: -1 | 1) => void;
type ReopenMostRecentlyClosedSession = () => string | null;

type UseSidebarConversationActionsInput = {
  activeConversationId: string | null;
  activeConversationSurfaceId: string | null;
  archiveSession: ArchiveSession;
  clearDragState: () => void;
  closeSession: CloseSession;
  draggingSessionId: string | null;
  hotkeyConversationItems: readonly { session: SessionMeta }[];
  locationPathname: string;
  navigate: NavigateFunction;
  pinSession: PinSession;
  pinnedSessions: readonly SessionMeta[];
  reopenMostRecentlyClosedSession: ReopenMostRecentlyClosedSession;
  restoreSession: RestoreSession;
  setDraftCwd: Dispatch<SetStateAction<string>>;
  shiftSession: ShiftSession;
  tabs: readonly SessionMeta[];
  unpinSession: UnpinSession;
  workspaceConversationTabs: readonly SessionMeta[];
};

export function useSidebarConversationActions({
  activeConversationId,
  activeConversationSurfaceId,
  archiveSession,
  clearDragState,
  closeSession,
  draggingSessionId,
  hotkeyConversationItems,
  locationPathname,
  navigate,
  pinSession,
  pinnedSessions,
  reopenMostRecentlyClosedSession,
  restoreSession,
  setDraftCwd,
  shiftSession,
  tabs,
  unpinSession,
  workspaceConversationTabs,
}: UseSidebarConversationActionsInput) {
  const resolveCloseRedirectPath = useCallback(
    (closingId: string) =>
      resolveConversationCloseRedirect({
        orderedIds: workspaceConversationTabs.map((session) => session.id),
        closingId,
      }),
    [workspaceConversationTabs],
  );

  const navigateConversation = useCallback(
    (direction: -1 | 1) => {
      const nextPath = resolveConversationAdjacentPath({
        orderedIds: workspaceConversationTabs.map((session) => session.id),
        activeId: activeConversationSurfaceId,
        direction,
      });

      if (nextPath) {
        navigate(nextPath);
      }
    },
    [activeConversationSurfaceId, navigate, workspaceConversationTabs],
  );

  const jumpToConversation = useCallback(
    (index: number) => {
      if (index < 0 || index >= hotkeyConversationItems.length) {
        return;
      }

      navigate(buildConversationSurfacePath(hotkeyConversationItems[index].session.id));
    },
    [hotkeyConversationItems, navigate],
  );

  const shiftActiveConversation = useCallback(
    (direction: -1 | 1) => {
      if (!activeConversationId) {
        return;
      }

      shiftSession(activeConversationId, direction);
      if (draggingSessionId === activeConversationId) {
        clearDragState();
      }
    },
    [activeConversationId, clearDragState, draggingSessionId, shiftSession],
  );

  const handleReopenClosedConversation = useCallback(() => {
    const sessionId = reopenMostRecentlyClosedSession();
    if (!sessionId) {
      return;
    }

    navigate(buildConversationSurfacePath(sessionId));
  }, [navigate, reopenMostRecentlyClosedSession]);

  const handleCloseDraftTab = useCallback(() => {
    const closeDraft = () => {
      clearDraftConversationAttachments();
      clearDraftConversationComposer();
      clearDraftConversationCwd();
      clearDraftConversationModel();
      clearDraftConversationThinkingLevel();
      setDraftCwd('');
    };

    if (draggingSessionId === DRAFT_CONVERSATION_ID) {
      clearDragState();
    }

    if (locationPathname === DRAFT_CONVERSATION_ROUTE) {
      const nextPath =
        resolveConversationAdjacentPath({
          orderedIds: workspaceConversationTabs.map((session) => session.id),
          activeId: null,
          direction: 1,
        }) ?? DRAFT_CONVERSATION_ROUTE;
      navigate(nextPath);
      window.setTimeout(closeDraft, 0);
      return;
    }

    closeDraft();
  }, [clearDragState, draggingSessionId, locationPathname, navigate, setDraftCwd, workspaceConversationTabs]);

  const handleArchiveConversation = useCallback(
    (sessionId: string) => {
      const archivingActiveConversation = activeConversationId === sessionId;

      if (draggingSessionId === sessionId) {
        clearDragState();
      }

      if (archivingActiveConversation) {
        const redirectPath = resolveCloseRedirectPath(sessionId);
        archiveSession(sessionId);
        navigate(redirectPath);
        return;
      }

      archiveSession(sessionId);
    },
    [activeConversationId, archiveSession, clearDragState, draggingSessionId, navigate, resolveCloseRedirectPath],
  );

  const handleCloseConversation = useCallback(
    (sessionId: string) => {
      const closingActiveConversation = activeConversationId === sessionId;
      const conversationIsOpen = tabs.some((session) => session.id === sessionId);

      if (draggingSessionId === sessionId) {
        clearDragState();
      }

      if (closingActiveConversation) {
        const redirectPath = resolveCloseRedirectPath(sessionId);
        if (conversationIsOpen) {
          closeSession(sessionId);
        } else {
          archiveSession(sessionId);
        }
        navigate(redirectPath);
        return;
      }

      if (conversationIsOpen) {
        closeSession(sessionId);
      } else {
        archiveSession(sessionId);
      }
    },
    [activeConversationId, archiveSession, clearDragState, closeSession, draggingSessionId, navigate, resolveCloseRedirectPath, tabs],
  );

  const handleClosePinnedConversation = useCallback(
    (sessionId: string) => {
      const closingActiveConversation = activeConversationId === sessionId;

      if (draggingSessionId === sessionId) {
        clearDragState();
      }

      if (closingActiveConversation) {
        const redirectPath = resolveCloseRedirectPath(sessionId);
        unpinSession(sessionId, { open: false });
        navigate(redirectPath);
        return;
      }

      unpinSession(sessionId, { open: false });
    },
    [activeConversationId, clearDragState, draggingSessionId, navigate, resolveCloseRedirectPath, unpinSession],
  );

  const handleCloseActiveConversation = useCallback(() => {
    if (locationPathname === DRAFT_CONVERSATION_ROUTE) {
      handleCloseDraftTab();
      return;
    }

    if (!activeConversationId) {
      return;
    }

    if (pinnedSessions.some((session) => session.id === activeConversationId)) {
      handleClosePinnedConversation(activeConversationId);
      return;
    }

    handleCloseConversation(activeConversationId);
  }, [activeConversationId, handleCloseConversation, handleCloseDraftTab, handleClosePinnedConversation, locationPathname, pinnedSessions]);

  const handleUnpinConversation = useCallback(
    (sessionId: string) => {
      unpinSession(sessionId);
      if (draggingSessionId === sessionId) {
        clearDragState();
      }
    },
    [clearDragState, draggingSessionId, unpinSession],
  );

  const handleTogglePinnedActiveConversation = useCallback(() => {
    if (locationPathname === DRAFT_CONVERSATION_ROUTE || !activeConversationId) {
      return;
    }

    if (pinnedSessions.some((session) => session.id === activeConversationId)) {
      handleUnpinConversation(activeConversationId);
      return;
    }

    pinSession(activeConversationId);
    if (draggingSessionId === activeConversationId) {
      clearDragState();
    }
  }, [activeConversationId, clearDragState, draggingSessionId, handleUnpinConversation, locationPathname, pinSession, pinnedSessions]);

  const handleToggleArchivedActiveConversation = useCallback(() => {
    if (locationPathname === DRAFT_CONVERSATION_ROUTE || !activeConversationId) {
      return;
    }

    const activeConversationPinned = pinnedSessions.some((session) => session.id === activeConversationId);
    const activeConversationOpen = tabs.some((session) => session.id === activeConversationId);

    if (draggingSessionId === activeConversationId) {
      clearDragState();
    }

    if (activeConversationPinned || activeConversationOpen) {
      handleArchiveConversation(activeConversationId);
      return;
    }

    restoreSession(activeConversationId);
  }, [
    activeConversationId,
    clearDragState,
    draggingSessionId,
    handleArchiveConversation,
    locationPathname,
    pinnedSessions,
    restoreSession,
    tabs,
  ]);

  return {
    handleArchiveConversation,
    handleCloseActiveConversation,
    handleCloseConversation,
    handleClosePinnedConversation,
    handleReopenClosedConversation,
    handleToggleArchivedActiveConversation,
    handleTogglePinnedActiveConversation,
    handleUnpinConversation,
    jumpToConversation,
    navigateConversation,
    shiftActiveConversation,
  };
}
