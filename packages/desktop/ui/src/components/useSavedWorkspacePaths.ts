import { useCallback, useEffect, useState } from 'react';

import { api } from '../client/api';
import { normalizeWorkspacePaths, readStoredWorkspacePaths, writeStoredWorkspacePaths } from '../local/savedWorkspacePaths';
import { fetchRemoteConversationLayout } from '../session/sessionTabs';

const SAVED_WORKSPACE_PATHS_INITIAL_REMOTE_LOAD_DELAY_MS = 6_000;

export function useSavedWorkspacePaths({
  draftCwd,
  openConversationCount,
  openWorkspacePaths,
  pinnedConversationCount,
  sessionsReady,
  workspacePickerOpen,
}: {
  draftCwd: string;
  openConversationCount: number;
  openWorkspacePaths: readonly string[];
  pinnedConversationCount: number;
  sessionsReady: boolean;
  workspacePickerOpen: boolean;
}) {
  const [savedWorkspacePaths, setSavedWorkspacePaths] = useState(() => readStoredWorkspacePaths());
  const [savedWorkspacePathsLoaded, setSavedWorkspacePathsLoaded] = useState(false);
  const [bootstrapHasOpenConversations, setBootstrapHasOpenConversations] = useState(false);
  const [workspaceSyncReady, setWorkspaceSyncReady] = useState(false);

  const persistSavedWorkspacePaths = useCallback((workspacePaths: readonly string[]) => {
    const normalized = normalizeWorkspacePaths(workspacePaths);
    writeStoredWorkspacePaths(normalized);
    setSavedWorkspacePaths(normalized);
    return normalized;
  }, []);

  const loadSavedWorkspacePaths = useCallback(async () => {
    try {
      const { sessionIds, pinnedSessionIds, workspacePaths } = await fetchRemoteConversationLayout({
        reason: 'useSavedWorkspacePaths.load',
      });
      persistSavedWorkspacePaths(workspacePaths);
      setBootstrapHasOpenConversations(sessionIds.length > 0 || pinnedSessionIds.length > 0);
    } finally {
      setSavedWorkspacePathsLoaded(true);
    }
  }, [persistSavedWorkspacePaths]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSavedWorkspacePaths().catch(() => {
        setSavedWorkspacePathsLoaded(true);
        setBootstrapHasOpenConversations(false);
      });
    }, SAVED_WORKSPACE_PATHS_INITIAL_REMOTE_LOAD_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [loadSavedWorkspacePaths]);

  useEffect(() => {
    if (!workspacePickerOpen) {
      return;
    }

    void loadSavedWorkspacePaths().catch(() => {
      // Ignore refresh failures and keep the last saved list.
    });
  }, [loadSavedWorkspacePaths, workspacePickerOpen]);

  useEffect(() => {
    if (workspaceSyncReady || !savedWorkspacePathsLoaded || !sessionsReady) {
      return;
    }

    const hasLocalWorkspaceState = draftCwd.trim().length > 0 || pinnedConversationCount > 0 || openConversationCount > 0;
    if (hasLocalWorkspaceState || !bootstrapHasOpenConversations) {
      setWorkspaceSyncReady(true);
    }
  }, [
    bootstrapHasOpenConversations,
    draftCwd,
    openConversationCount,
    pinnedConversationCount,
    savedWorkspacePathsLoaded,
    sessionsReady,
    workspaceSyncReady,
  ]);

  useEffect(() => {
    if (!workspaceSyncReady || !sessionsReady) {
      return;
    }

    const nextWorkspacePaths = normalizeWorkspacePaths([...savedWorkspacePaths, ...openWorkspacePaths]);
    if (sameStringLists(savedWorkspacePaths, nextWorkspacePaths)) {
      return;
    }

    persistSavedWorkspacePaths(nextWorkspacePaths);
    void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
      // Ignore best-effort sync failures.
    });
  }, [openWorkspacePaths, persistSavedWorkspacePaths, savedWorkspacePaths, sessionsReady, workspaceSyncReady]);

  return {
    persistSavedWorkspacePaths,
    savedWorkspacePaths,
  };
}

function sameStringLists(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
