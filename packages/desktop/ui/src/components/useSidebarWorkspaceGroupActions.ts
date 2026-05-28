import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { api } from '../client/api';
import { normalizeConversationGroupCwd } from '../conversation/conversationCwdGroups';
import { buildConversationSurfacePath } from '../conversation/conversationRoutes';
import { clearDraftConversationCwd, DRAFT_CONVERSATION_ROUTE, readDraftConversationCwd } from '../conversation/draftConversation';
import { getDesktopBridge } from '../desktop/desktopBridge';
import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';
import { replaceConversationLayout } from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';
import { sameStringLists } from './useSavedWorkspacePaths';

type RenameConversationGroupPrompt = {
  groupKey: string;
  defaultLabel: string;
  currentLabel: string;
};

type UseSidebarWorkspaceGroupActionsInput = {
  activeConversationSurfaceId: string | null;
  archivedConversationIds: readonly string[];
  clearConversationGroupCollapsedState: (groupKey: string) => void;
  draftCwd: string;
  handleNewConversation: (cwd?: string | null) => void;
  navigate: NavigateFunction;
  openIds: readonly string[];
  persistSavedWorkspacePaths: (paths: readonly string[]) => void;
  pinnedIds: readonly string[];
  savedWorkspacePaths: readonly string[];
  setWorkspaceQuickSelectOpen: Dispatch<SetStateAction<boolean>>;
  showNotice: (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;
  updateConversationGroupLabelOverride: (groupKey: string, label: string | null) => void;
  workspaceConversationTabs: readonly SessionMeta[];
};

export function useSidebarWorkspaceGroupActions({
  activeConversationSurfaceId,
  archivedConversationIds,
  clearConversationGroupCollapsedState,
  draftCwd,
  handleNewConversation,
  navigate,
  openIds,
  persistSavedWorkspacePaths,
  pinnedIds,
  savedWorkspacePaths,
  setWorkspaceQuickSelectOpen,
  showNotice,
  updateConversationGroupLabelOverride,
  workspaceConversationTabs,
}: UseSidebarWorkspaceGroupActionsInput) {
  const [addWorkspaceBusy, setAddWorkspaceBusy] = useState(false);
  const [renameConversationGroupPrompt, setRenameConversationGroupPrompt] = useState<RenameConversationGroupPrompt | null>(null);

  const handleAddWorkspace = useCallback(() => {
    setWorkspaceQuickSelectOpen(true);
  }, [setWorkspaceQuickSelectOpen]);

  const handleSelectSavedWorkspace = useCallback(
    (workspacePath: string) => {
      setWorkspaceQuickSelectOpen(false);
      handleNewConversation(workspacePath);
    },
    [handleNewConversation, setWorkspaceQuickSelectOpen],
  );

  const handleChooseNewWorkspaceFolder = useCallback(async () => {
    if (addWorkspaceBusy) {
      return;
    }

    setAddWorkspaceBusy(true);
    try {
      const result = await api.pickFolder({
        cwd: draftCwd.trim() || undefined,
        prompt: 'Choose a workspace folder',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      const nextWorkspacePaths = normalizeWorkspacePaths([...savedWorkspacePaths, result.path]);
      persistSavedWorkspacePaths(nextWorkspacePaths);
      void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
      setWorkspaceQuickSelectOpen(false);
      handleNewConversation(result.path);
    } catch (error) {
      showNotice('danger', `Add workspace failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
    } finally {
      setAddWorkspaceBusy(false);
    }
  }, [
    addWorkspaceBusy,
    draftCwd,
    handleNewConversation,
    persistSavedWorkspacePaths,
    savedWorkspacePaths,
    setWorkspaceQuickSelectOpen,
    showNotice,
  ]);

  const resolveConversationGroupRedirectPath = useCallback(
    (closingIds: readonly string[]) => {
      const closingIdSet = new Set(closingIds.map((value) => value.trim()).filter(Boolean));
      const orderedIds = workspaceConversationTabs.map((session) => session.id);
      const remainingIds = orderedIds.filter((id) => !closingIdSet.has(id));
      if (remainingIds.length === 0) {
        return DRAFT_CONVERSATION_ROUTE;
      }

      const activeIndex = activeConversationSurfaceId ? orderedIds.findIndex((id) => id === activeConversationSurfaceId) : -1;
      const nextIndex = activeIndex >= 0 ? Math.min(activeIndex, remainingIds.length - 1) : remainingIds.length - 1;
      return buildConversationSurfacePath(remainingIds[nextIndex]);
    },
    [activeConversationSurfaceId, workspaceConversationTabs],
  );

  const archiveConversationGroupSessions = useCallback(
    (sessionIds: readonly string[]) => {
      const normalizedSessionIds = sessionIds.map((value) => value.trim()).filter(Boolean);
      if (normalizedSessionIds.length === 0) {
        return 0;
      }

      const sessionIdSet = new Set(normalizedSessionIds);
      if (activeConversationSurfaceId && sessionIdSet.has(activeConversationSurfaceId)) {
        navigate(resolveConversationGroupRedirectPath(normalizedSessionIds));
      }

      replaceConversationLayout({
        sessionIds: openIds.filter((id) => !sessionIdSet.has(id)),
        pinnedSessionIds: pinnedIds.filter((id) => !sessionIdSet.has(id)),
        archivedSessionIds: [...new Set([...archivedConversationIds, ...normalizedSessionIds])],
      });

      return normalizedSessionIds.length;
    },
    [activeConversationSurfaceId, archivedConversationIds, navigate, openIds, pinnedIds, resolveConversationGroupRedirectPath],
  );

  const handleOpenConversationGroupInFinder = useCallback(
    async (cwd: string | null, label: string) => {
      const normalizedCwd = normalizeConversationGroupCwd(cwd);
      if (!normalizedCwd) {
        showNotice('danger', `No working directory is saved for ${label}.`, 4000);
        return;
      }

      const desktopBridge = getDesktopBridge();
      if (!desktopBridge?.openPath) {
        showNotice('danger', 'Open in Finder is only available in the desktop app.', 4000);
        return;
      }

      const result = await desktopBridge.openPath(normalizedCwd);
      if (!result.opened) {
        showNotice('danger', result.error ? `Could not open ${label}: ${result.error}` : `Could not open ${label}.`, 4000);
      }
    },
    [showNotice],
  );

  const handleRenameConversationGroup = useCallback((groupKey: string, defaultLabel: string, currentLabel: string) => {
    setRenameConversationGroupPrompt({ groupKey, defaultLabel, currentLabel });
  }, []);

  const submitRenameConversationGroup = useCallback(
    (nextLabel: string) => {
      const prompt = renameConversationGroupPrompt;
      if (!prompt) return;
      setRenameConversationGroupPrompt(null);

      const normalizedLabel = nextLabel.trim();
      updateConversationGroupLabelOverride(
        prompt.groupKey,
        normalizedLabel && normalizedLabel !== prompt.defaultLabel ? normalizedLabel : null,
      );

      if (normalizedLabel && normalizedLabel !== prompt.defaultLabel) {
        showNotice('accent', `Workspace renamed to ${normalizedLabel}.`);
        return;
      }

      showNotice('accent', `Workspace name reset to ${prompt.defaultLabel}.`);
    },
    [renameConversationGroupPrompt, showNotice, updateConversationGroupLabelOverride],
  );

  const handleArchiveConversationGroup = useCallback(
    (label: string, sessionIds: readonly string[]) => {
      const archivedCount = archiveConversationGroupSessions(sessionIds);
      if (archivedCount === 0) {
        showNotice('danger', `No threads to archive in ${label}.`, 4000);
        return;
      }

      showNotice('accent', archivedCount === 1 ? `Archived 1 thread from ${label}.` : `Archived ${archivedCount} threads from ${label}.`);
    },
    [archiveConversationGroupSessions, showNotice],
  );

  const handleRemoveConversationGroup = useCallback(
    (groupKey: string, label: string, cwd: string | null, sessionIds: readonly string[], includesDraft: boolean) => {
      const removedCount = archiveConversationGroupSessions(sessionIds);
      updateConversationGroupLabelOverride(groupKey, null);
      clearConversationGroupCollapsedState(groupKey);

      const normalizedCwd = normalizeConversationGroupCwd(cwd);
      if (includesDraft && normalizedCwd && normalizeConversationGroupCwd(readDraftConversationCwd()) === normalizedCwd) {
        clearDraftConversationCwd();
      }

      if (normalizedCwd) {
        const nextWorkspacePaths = savedWorkspacePaths.filter((workspacePath) => workspacePath !== normalizedCwd);
        if (!sameStringLists(savedWorkspacePaths, nextWorkspacePaths)) {
          persistSavedWorkspacePaths(nextWorkspacePaths);
          void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
            // Ignore best-effort sync failures.
          });
        }
      }

      if (removedCount === 0 && !includesDraft && !normalizedCwd) {
        showNotice('danger', `No threads to remove in ${label}.`, 4000);
        return;
      }

      showNotice('accent', `Removed ${label} from Threads.`);
    },
    [
      archiveConversationGroupSessions,
      clearConversationGroupCollapsedState,
      persistSavedWorkspacePaths,
      savedWorkspacePaths,
      showNotice,
      updateConversationGroupLabelOverride,
    ],
  );

  return {
    addWorkspaceBusy,
    handleAddWorkspace,
    handleArchiveConversationGroup,
    handleChooseNewWorkspaceFolder,
    handleOpenConversationGroupInFinder,
    handleRemoveConversationGroup,
    handleRenameConversationGroup,
    handleSelectSavedWorkspace,
    renameConversationGroupPrompt,
    setRenameConversationGroupPrompt,
    submitRenameConversationGroup,
  };
}
