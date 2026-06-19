/**
 * Arc-style tab model:
 *   - pinnedIds               (backend workspace state) = conversations always visible above open tabs
 *   - openIds                 (backend workspace state) = active workspace tabs below the pinned shelf
 *   - archivedConversationIds (backend workspace state) = conversations explicitly archived out of live/review focus
 *   - archivedSessions        = all other sessions, restored on demand
 *
 * Restoring an archived conversation calls restoreSession() → removes archived state → tab appears.
 * Archive actions call archiveSession() → remove from pinned/open workspace → move into the archive.
 * Pinning removes a conversation from openIds and keeps it in the pinned shelf instead.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { LiveTitlesContext, useSseConnection } from '../app/contexts';
import { api } from '../client/api';
import { NEW_CONVERSATION_TITLE, normalizeConversationTitle } from '../conversation/conversationTitle';
import {
  applyRemoteConversationLayout,
  closeConversationTab,
  CONVERSATION_LAYOUT_CHANGED_EVENT,
  type ConversationLayout,
  type ConversationShelf,
  isWithinLocalWriteGrace,
  moveConversationTab,
  type OpenConversationDropPosition,
  openConversationTab,
  pinConversationTab,
  readArchivedSessionIds,
  readConversationLayout,
  readPinnedSessionIds,
  reopenMostRecentlyArchivedConversation,
  setConversationArchivedState,
  setConversationLockedState,
  shiftConversationTab,
  unpinConversationTab,
} from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';
import { sessionStore, useAllSessions, useAllTasks, useSessionsReady } from '../store';

const CONVERSATION_LAYOUT_BOOTSTRAP_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];

function compareSessionsByRecentActivity(left: SessionMeta, right: SessionMeta): number {
  return (right.lastActivityAt ?? right.timestamp).localeCompare(left.lastActivityAt ?? left.timestamp);
}

function applyLayoutState(
  layout: ConversationLayout,
  setters: {
    setOpenIds: (ids: string[]) => void;
    setPinnedIds: (ids: string[]) => void;
    setArchivedConversationIds: (ids: string[]) => void;
    setLockedConversationIds: (ids: string[]) => void;
    setActiveId: (id: string | null) => void;
  },
) {
  setters.setOpenIds(layout.sessionIds);
  setters.setPinnedIds(layout.pinnedSessionIds);
  setters.setArchivedConversationIds(layout.archivedSessionIds);
  setters.setLockedConversationIds(layout.lockedConversationIds);
  setters.setActiveId(layout.activeSessionId);
}

function buildPlaceholderSessionMeta(id: string, title?: string): SessionMeta {
  return {
    id,
    file: '',
    timestamp: new Date(0).toISOString(),
    cwd: '',
    cwdSlug: '',
    model: '',
    title: title ?? 'Connecting…',
    messageCount: 0,
    isRunning: false,
  };
}

function applySidebarConversationSnapshot(
  snapshot: Awaited<ReturnType<typeof api.sidebarConversations>>,
  setters: {
    setOpenIds: (ids: string[]) => void;
    setPinnedIds: (ids: string[]) => void;
    setArchivedConversationIds: (ids: string[]) => void;
    setLockedConversationIds: (ids: string[]) => void;
    setActiveId: (id: string | null) => void;
  },
): SessionMeta[] {
  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : null;
  if (sessions) {
    sessionStore.replaceAll(sessions);
    sessionStore.markReady?.();
  }
  const nextLayout = applyRemoteConversationLayout({
    sessionIds: snapshot.sessionIds,
    pinnedSessionIds: snapshot.pinnedSessionIds,
    archivedSessionIds: snapshot.archivedSessionIds,
    lockedConversationIds: snapshot.lockedConversationIds,
    activeSessionId: snapshot.activeConversationId,
    workspacePaths: snapshot.workspacePaths,
    remoteControlledConversationIds: snapshot.remoteControlledConversationIds,
    conversationWorkspaceRevision: snapshot.conversationWorkspaceRevision,
    conversationWorkspaceUpdatedAt: snapshot.conversationWorkspaceUpdatedAt,
    conversationWorkspaceMigratedAt: snapshot.conversationWorkspaceMigratedAt,
  });
  applyLayoutState(nextLayout, setters);
  return sessions ?? [];
}

export function useConversations(options: { includeArchivedSessions?: boolean } = {}) {
  const initialLayout = useMemo(() => readConversationLayout(), []);
  const [openIds, setOpenIds] = useState(() => initialLayout.sessionIds);
  const [pinnedIds, setPinnedIds] = useState(() => initialLayout.pinnedSessionIds);
  const [archivedConversationIds, setArchivedConversationIds] = useState(() => initialLayout.archivedSessionIds);
  const [lockedConversationIds, setLockedConversationIds] = useState(() => initialLayout.lockedConversationIds);
  const [activeId, setActiveId] = useState(() => initialLayout.activeSessionId);
  const [layoutHydrating, setLayoutHydrating] = useState(
    () =>
      typeof window !== 'undefined' &&
      initialLayout.sessionIds.length === 0 &&
      initialLayout.pinnedSessionIds.length === 0 &&
      initialLayout.archivedSessionIds.length === 0,
  );
  const { titles: liveTitles } = useContext(LiveTitlesContext);
  const sessions = useAllSessions();
  const sessionsReady = useSessionsReady();
  const tasks = useAllTasks();
  const { status: sseStatus } = useSseConnection();
  const seenRunningAutomationIdsRef = useRef<Set<string>>(new Set());
  const missingSessionMetaInflightRef = useRef<Set<string>>(new Set());
  const latestRefetchRequestIdRef = useRef(0);

  const automationThreadTitleBySessionId = useMemo(
    () =>
      new Map(
        (tasks ?? []).flatMap((task) =>
          task.running && task.threadConversationId
            ? [[task.threadConversationId, task.threadTitle ?? task.title ?? `Automation: ${task.id}`] as const]
            : [],
        ),
      ),
    [tasks],
  );

  useEffect(() => {
    function handleConversationLayoutChanged() {
      const layout = readConversationLayout();
      applyLayoutState(layout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
    }

    window.addEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
    return () => window.removeEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof window.setTimeout> | null = null;

    function syncLayout(attempt = 0): void {
      void api
        .sidebarConversations()
        .then((snapshot) => {
          if (cancelled) {
            return;
          }

          if (isWithinLocalWriteGrace()) {
            if (Array.isArray(snapshot.sessions)) {
              sessionStore.replaceAll(snapshot.sessions);
              sessionStore.markReady?.();
            }
            applyLayoutState(readConversationLayout(), {
              setOpenIds,
              setPinnedIds,
              setArchivedConversationIds,
              setLockedConversationIds,
              setActiveId,
            });
            setLayoutHydrating(false);
            return;
          }

          applySidebarConversationSnapshot(snapshot, {
            setOpenIds,
            setPinnedIds,
            setArchivedConversationIds,
            setLockedConversationIds,
            setActiveId,
          });
          setLayoutHydrating(false);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          const retryDelay =
            CONVERSATION_LAYOUT_BOOTSTRAP_RETRY_DELAYS_MS[Math.min(attempt, CONVERSATION_LAYOUT_BOOTSTRAP_RETRY_DELAYS_MS.length - 1)] ??
            8_000;
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            syncLayout(attempt + 1);
          }, retryDelay);
        });
    }

    syncLayout();

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  const refetch = useCallback(async () => {
    const requestId = latestRefetchRequestIdRef.current + 1;
    latestRefetchRequestIdRef.current = requestId;
    const snapshot = await api.sidebarConversations();
    if (latestRefetchRequestIdRef.current !== requestId) {
      return Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
    }
    return applySidebarConversationSnapshot(snapshot, {
      setOpenIds,
      setPinnedIds,
      setArchivedConversationIds,
      setLockedConversationIds,
      setActiveId,
    });
  }, []);

  useEffect(() => {
    if (tasks === null) {
      return;
    }

    const nextRunningAutomationIds = new Set(tasks.filter((task) => task.running).map((task) => task.id));
    const newlyRunningThreadIds = new Set(
      tasks.flatMap((task) =>
        task.running && task.threadConversationId && !seenRunningAutomationIdsRef.current.has(task.id) ? [task.threadConversationId] : [],
      ),
    );

    if (newlyRunningThreadIds.size > 0) {
      for (const threadId of newlyRunningThreadIds) {
        openConversationTab(threadId, { active: false });
      }
      applyLayoutState(readConversationLayout(), {
        setOpenIds,
        setPinnedIds,
        setArchivedConversationIds,
        setLockedConversationIds,
        setActiveId,
      });
    }

    seenRunningAutomationIdsRef.current = nextRunningAutomationIds;
  }, [tasks]);

  const openSession = useCallback((id: string) => {
    setOpenIds(openConversationTab(id));
    setPinnedIds(readPinnedSessionIds());
    setArchivedConversationIds(readArchivedSessionIds());
  }, []);

  const closeSession = useCallback((id: string) => {
    setOpenIds(closeConversationTab(id));
    setPinnedIds(readPinnedSessionIds());
    setArchivedConversationIds(readArchivedSessionIds());
  }, []);

  const pinSession = useCallback((id: string) => {
    const nextLayout = pinConversationTab(id);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const unpinSession = useCallback((id: string, options: { open?: boolean } = {}) => {
    const nextLayout = unpinConversationTab(id, options);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const archiveSession = useCallback((id: string) => {
    const nextLayout = setConversationArchivedState(id, true);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const restoreSession = useCallback((id: string) => {
    const nextLayout = setConversationArchivedState(id, false);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const setSessionLocked = useCallback((id: string, locked: boolean) => {
    const nextLayout = setConversationLockedState(id, locked);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const reopenMostRecentlyClosedSession = useCallback(() => {
    const { reopenedSessionId, layout } = reopenMostRecentlyArchivedConversation();
    applyLayoutState(layout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
    return reopenedSessionId;
  }, []);

  const moveSession = useCallback(
    (sessionId: string, targetSection: ConversationShelf, targetSessionId?: string | null, position?: OpenConversationDropPosition) => {
      const nextLayout = moveConversationTab(sessionId, targetSection, targetSessionId, position);
      applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
    },
    [],
  );

  const shiftSession = useCallback((sessionId: string, direction: -1 | 1) => {
    const nextLayout = shiftConversationTab(sessionId, direction);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setLockedConversationIds, setActiveId });
  }, []);

  const openIdSet = useMemo(() => new Set(openIds), [openIds]);
  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const titledSessionSource = useMemo(() => {
    const allSessions = sessions ?? [];
    if (options.includeArchivedSessions !== false) {
      return allSessions;
    }

    return allSessions.filter((session) => openIdSet.has(session.id) || pinnedIdSet.has(session.id));
  }, [openIdSet, options.includeArchivedSessions, pinnedIdSet, sessions]);
  const withTitles = useMemo(
    () =>
      titledSessionSource.map((session) => {
        const liveTitle = normalizeConversationTitle(liveTitles.get(session.id));
        const sessionTitle = normalizeConversationTitle(session.title) ?? NEW_CONVERSATION_TITLE;
        const title = liveTitle ?? sessionTitle;

        return title === session.title ? session : { ...session, title };
      }),
    [liveTitles, titledSessionSource],
  );
  const sessionsById = useMemo(
    () => new Map(withTitles.map((session) => [session.id, session] satisfies [string, SessionMeta])),
    [withTitles],
  );

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      return;
    }

    const missingIds = [...pinnedIds, ...openIds].filter(
      (id) =>
        !sessionsById.has(id) &&
        !liveTitles.has(id) &&
        !automationThreadTitleBySessionId.has(id) &&
        !missingSessionMetaInflightRef.current.has(id),
    );
    if (missingIds.length === 0) {
      return;
    }

    for (const id of missingIds) {
      missingSessionMetaInflightRef.current.add(id);
      void api
        .sessionMeta(id)
        .then((session) => {
          // Individual row metadata is not a full sessions snapshot. Merge it
          // only while the row is still absent so late responses cannot
          // overwrite a full snapshot that arrived in the meantime.
          if (!sessionStore.get(session.id)) {
            sessionStore.upsert(session);
            sessionStore.markReady?.();
          }
        })
        .catch(() => {
          // Keep the placeholder until the full sessions snapshot or layout sync
          // confirms whether the tab is stale.
        })
        .finally(() => {
          missingSessionMetaInflightRef.current.delete(id);
        });
    }
  }, [automationThreadTitleBySessionId, liveTitles, openIds, pinnedIds, sessionsById, sessionsReady]);

  const pinnedSessions = useMemo(
    () =>
      pinnedIds.map((id) => {
        const session = sessionsById.get(id);
        if (session) {
          return session;
        }

        return buildPlaceholderSessionMeta(
          id,
          normalizeConversationTitle(liveTitles.get(id)) ?? automationThreadTitleBySessionId.get(id) ?? 'Connecting…',
        );
      }),
    [automationThreadTitleBySessionId, liveTitles, pinnedIds, sessionsById],
  );
  const tabs = useMemo(
    () =>
      openIds.map((id) => {
        const session = sessionsById.get(id);
        if (session) {
          return session;
        }

        return buildPlaceholderSessionMeta(
          id,
          normalizeConversationTitle(liveTitles.get(id)) ?? automationThreadTitleBySessionId.get(id) ?? 'Connecting…',
        );
      }),
    [automationThreadTitleBySessionId, liveTitles, openIds, sessionsById],
  );
  const archivedSessions = useMemo(
    () =>
      options.includeArchivedSessions === false
        ? []
        : withTitles.filter((session) => !openIdSet.has(session.id) && !pinnedIdSet.has(session.id)).sort(compareSessionsByRecentActivity),
    [openIdSet, options.includeArchivedSessions, pinnedIdSet, withTitles],
  );
  const loading = layoutHydrating || !sessionsReady || sseStatus === 'connecting' || sseStatus === 'reconnecting';

  return {
    pinnedIds,
    openIds,
    archivedConversationIds,
    lockedConversationIds,
    activeId,
    pinnedSessions,
    tabs,
    archivedSessions,
    openSession,
    closeSession,
    pinSession,
    unpinSession,
    archiveSession,
    restoreSession,
    setSessionLocked,
    reopenMostRecentlyClosedSession,
    moveSession,
    shiftSession,
    loading,
    layoutHydrating,
    refetch,
  };
}
