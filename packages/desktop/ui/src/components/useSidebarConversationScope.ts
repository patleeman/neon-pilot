import { useMemo } from 'react';

import { readConversationIdFromPathname } from '../conversation/conversationRoutes';
import { DRAFT_CONVERSATION_ROUTE } from '../conversation/draftConversation';
import { isPendingConversationShellId } from '../conversation/pendingConversationShell';
import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';
import type { SessionMeta } from '../shared/types';
import { useConversationRuntime } from '../store';
import { getSessionWorkspaceCwd } from './sidebarThreadModel';

type UseSidebarConversationScopeInput = {
  draftCwd: string;
  liveTitles: ReadonlyMap<string, string>;
  locationPathname: string;
  pinnedSessions: readonly SessionMeta[];
  sessions: readonly SessionMeta[] | null;
  tabs: readonly SessionMeta[];
};

function getLocalSessionWorkspacePath(session: Pick<SessionMeta, 'cwd' | 'workspaceCwd'>): string {
  return getSessionWorkspaceCwd(session) ?? '';
}

export function useSidebarConversationScope({
  draftCwd,
  liveTitles,
  locationPathname,
  pinnedSessions,
  sessions,
  tabs,
}: UseSidebarConversationScopeInput) {
  const activeConversationId = useMemo(() => {
    const conversationId = readConversationIdFromPathname(locationPathname);
    return isPendingConversationShellId(conversationId) ? null : conversationId;
  }, [locationPathname]);
  const activeRuntime = useConversationRuntime(activeConversationId);

  const activeSession = useMemo(() => {
    if (!activeConversationId) return null;
    const session = (sessions ?? []).find((candidate) => candidate.id === activeConversationId);
    const isRunning = activeRuntime?.running ?? session?.isRunning ?? false;
    if (session) return session.isRunning === isRunning ? session : { ...session, isRunning };

    return {
      id: activeConversationId,
      file: '',
      timestamp: new Date().toISOString(),
      cwd: draftCwd,
      cwdSlug: '',
      model: '',
      title: liveTitles.get(activeConversationId) ?? 'Connecting…',
      messageCount: 0,
      isRunning,
      isLive: true,
    } satisfies SessionMeta;
  }, [activeConversationId, activeRuntime?.running, liveTitles, sessions]);

  const visibleConversationTabs = useMemo(() => {
    if (!activeSession) return tabs;
    const alreadyVisible =
      pinnedSessions.some((session) => session.id === activeSession.id) || tabs.some((session) => session.id === activeSession.id);
    return alreadyVisible ? tabs : [activeSession, ...tabs];
  }, [activeSession, pinnedSessions, tabs]);

  const workspaceConversationTabs = useMemo(
    () => [...pinnedSessions, ...visibleConversationTabs],
    [pinnedSessions, visibleConversationTabs],
  );

  const pinnedWorkspacePaths = useMemo(
    () => normalizeWorkspacePaths(pinnedSessions.map((session) => getLocalSessionWorkspacePath(session))),
    [pinnedSessions],
  );

  const openWorkspacePaths = useMemo(
    () =>
      normalizeWorkspacePaths([
        draftCwd,
        ...pinnedSessions.map((session) => getLocalSessionWorkspacePath(session)),
        ...visibleConversationTabs.map((session) => getLocalSessionWorkspacePath(session)),
      ]),
    [draftCwd, pinnedSessions, visibleConversationTabs],
  );

  return {
    activeConversationId,
    chatButtonActive: locationPathname === DRAFT_CONVERSATION_ROUTE,
    openWorkspacePaths,
    pinnedWorkspacePaths,
    visibleConversationTabs,
    workspaceConversationTabs,
  };
}
