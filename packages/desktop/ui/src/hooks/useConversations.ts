/**
 * Arc-style tab model:
 *   - pinnedIds               (localStorage + settings) = conversations always visible above open tabs
 *   - openIds                 (localStorage + settings) = active workspace tabs below the pinned shelf
 *   - archivedConversationIds (localStorage + settings) = conversations explicitly archived out of live/review focus
 *   - archivedSessions        = all other sessions, restored on demand
 *
 * Restoring an archived conversation calls restoreSession() → removes archived state → tab appears.
 * Archive actions call archiveSession() → remove from pinned/open workspace → move into the archive.
 * Pinning removes a conversation from openIds and keeps it in the pinned shelf instead.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { LiveTitlesContext, useAppData, useSseConnection } from '../app/contexts';
import { api } from '../client/api';
import { NEW_CONVERSATION_TITLE, normalizeConversationTitle } from '../conversation/conversationTitle';
import { fetchSessionsSnapshot } from '../session/sessionSnapshot';
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
  replaceConversationLayout,
  setConversationArchivedState,
  shiftConversationTab,
  unpinConversationTab,
} from '../session/sessionTabs';
import type { SessionMeta } from '../shared/types';

function compareSessionsByRecentActivity(left: SessionMeta, right: SessionMeta): number {
  return (right.lastActivityAt ?? right.timestamp).localeCompare(left.lastActivityAt ?? left.timestamp);
}

function applyLayoutState(
  layout: ConversationLayout,
  setters: {
    setOpenIds: (ids: string[]) => void;
    setPinnedIds: (ids: string[]) => void;
    setArchivedConversationIds: (ids: string[]) => void;
    setActiveId: (id: string | null) => void;
  },
) {
  setters.setOpenIds(layout.sessionIds);
  setters.setPinnedIds(layout.pinnedSessionIds);
  setters.setArchivedConversationIds(layout.archivedSessionIds);
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

function mergeRemoteConversationLayoutWithProtectedLocalIds(
  remote: ConversationLayout,
  current: ConversationLayout,
  protectedSessionIds: ReadonlySet<string>,
): ConversationLayout {
  const appendProtectedIds = (remoteIds: string[], currentIds: string[]) => {
    const nextIds = [...remoteIds];
    const nextIdSet = new Set(nextIds);
    for (const id of currentIds) {
      if (protectedSessionIds.has(id) && !nextIdSet.has(id)) {
        nextIds.push(id);
        nextIdSet.add(id);
      }
    }
    return nextIds;
  };

  return {
    ...remote,
    sessionIds: appendProtectedIds(remote.sessionIds, current.sessionIds),
    pinnedSessionIds: appendProtectedIds(remote.pinnedSessionIds, current.pinnedSessionIds),
  };
}

export function useConversations(options: { includeArchivedSessions?: boolean } = {}) {
  const initialLayout = useMemo(() => readConversationLayout(), []);
  const [openIds, setOpenIds] = useState(() => initialLayout.sessionIds);
  const [pinnedIds, setPinnedIds] = useState(() => initialLayout.pinnedSessionIds);
  const [archivedConversationIds, setArchivedConversationIds] = useState(() => initialLayout.archivedSessionIds);
  const [activeId, setActiveId] = useState(() => initialLayout.activeSessionId);
  const [layoutHydrating, setLayoutHydrating] = useState(
    () =>
      initialLayout.sessionIds.length === 0 && initialLayout.pinnedSessionIds.length === 0 && initialLayout.archivedSessionIds.length === 0,
  );
  const { titles: liveTitles } = useContext(LiveTitlesContext);
  const { sessions, tasks, setSessions } = useAppData();
  const { status: sseStatus } = useSseConnection();
  const seenRunningAutomationIdsRef = useRef<Set<string>>(new Set());
  const missingSessionMetaInflightRef = useRef<Set<string>>(new Set());
  const sessionsPopulatedRef = useRef(false);
  const hasSyncedRemoteLayoutAfterSessionChangeRef = useRef(false);

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
      applyLayoutState(layout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
    }

    window.addEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
    return () => window.removeEventListener(CONVERSATION_LAYOUT_CHANGED_EVENT, handleConversationLayoutChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const localLayout = readConversationLayout();

    if (localLayout.sessionIds.length > 0 || localLayout.pinnedSessionIds.length > 0 || localLayout.archivedSessionIds.length > 0) {
      setLayoutHydrating(false);
      return;
    }

    void api
      .openConversationTabs()
      .then(({ sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId }) => {
        if (cancelled) {
          return;
        }

        if (sessionIds.length === 0 && pinnedSessionIds.length === 0 && archivedSessionIds.length === 0) {
          setLayoutHydrating(false);
          return;
        }

        const currentLayout = readConversationLayout();
        if (
          currentLayout.sessionIds.length > 0 ||
          currentLayout.pinnedSessionIds.length > 0 ||
          currentLayout.archivedSessionIds.length > 0
        ) {
          setLayoutHydrating(false);
          return;
        }

        const nextLayout = applyRemoteConversationLayout({
          sessionIds,
          pinnedSessionIds,
          archivedSessionIds,
          activeSessionId: activeConversationId,
        });
        applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
        setLayoutHydrating(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutHydrating(false);
        }
        // Ignore bootstrap failures and keep the browser-local fallback.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(async () => {
    const next = await fetchSessionsSnapshot();
    setSessions(next);
    return next;
  }, [setSessions]);

  useEffect(() => {
    if (!hasSyncedRemoteLayoutAfterSessionChangeRef.current) {
      hasSyncedRemoteLayoutAfterSessionChangeRef.current = true;
      return;
    }

    let cancelled = false;

    void api
      .openConversationTabs()
      .then(({ sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId }) => {
        if (cancelled) {
          return;
        }
        // Skip if we wrote locally within the grace window — the server may not
        // have persisted our change yet and would overwrite it.
        if (isWithinLocalWriteGrace()) {
          return;
        }
        const currentLayout = readConversationLayout();
        if (
          currentLayout.sessionIds.join('\0') === sessionIds.join('\0') &&
          currentLayout.pinnedSessionIds.join('\0') === pinnedSessionIds.join('\0') &&
          currentLayout.archivedSessionIds.join('\0') === archivedSessionIds.join('\0') &&
          currentLayout.activeSessionId === activeConversationId
        ) {
          return;
        }

        const currentWorkspaceIds = new Set([...currentLayout.sessionIds, ...currentLayout.pinnedSessionIds]);
        const protectedSessionIds = new Set([
          ...liveTitles.keys(),
          ...automationThreadTitleBySessionId.keys(),
          ...(sessions ?? []).filter((session) => currentWorkspaceIds.has(session.id)).map((session) => session.id),
        ]);

        // During bootstrap (individual session meta fetches in progress), protect
        // all locally-open conversations from being overwritten by the remote layout.
        // Individual metas arrive one-at-a-time and would not cover the full set of
        // open IDs, so only the inflight guard keeps them from being pruned.
        if (missingSessionMetaInflightRef.current.size > 0) {
          for (const id of currentWorkspaceIds) {
            protectedSessionIds.add(id);
          }
        }
        const remoteLayout = mergeRemoteConversationLayoutWithProtectedLocalIds(
          { sessionIds, pinnedSessionIds, archivedSessionIds, activeSessionId: activeConversationId },
          currentLayout,
          protectedSessionIds,
        );

        const nextLayout = applyRemoteConversationLayout({
          sessionIds: remoteLayout.sessionIds,
          pinnedSessionIds: remoteLayout.pinnedSessionIds,
          archivedSessionIds: remoteLayout.archivedSessionIds,
          activeSessionId: remoteLayout.activeSessionId,
        });
        applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
      })
      .catch(() => {
        // Ignore workspace sync failures and keep the browser-local fallback.
      });

    return () => {
      cancelled = true;
    };
  }, [automationThreadTitleBySessionId, liveTitles, sessions]);

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
      const currentLayout = readConversationLayout();
      const nextSessionIds = [...currentLayout.sessionIds];
      let changed = false;

      for (const threadId of newlyRunningThreadIds) {
        if (currentLayout.pinnedSessionIds.includes(threadId) || nextSessionIds.includes(threadId)) {
          continue;
        }

        nextSessionIds.push(threadId);
        changed = true;
      }

      if (changed) {
        const nextLayout = replaceConversationLayout({
          sessionIds: nextSessionIds,
          pinnedSessionIds: currentLayout.pinnedSessionIds,
          archivedSessionIds: currentLayout.archivedSessionIds,
          activeSessionId: currentLayout.activeSessionId,
        });
        applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
      }
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
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
  }, []);

  const unpinSession = useCallback((id: string, options: { open?: boolean } = {}) => {
    const nextLayout = unpinConversationTab(id, options);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
  }, []);

  const archiveSession = useCallback((id: string) => {
    const nextLayout = setConversationArchivedState(id, true);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
  }, []);

  const restoreSession = useCallback((id: string) => {
    const nextLayout = setConversationArchivedState(id, false);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
  }, []);

  const reopenMostRecentlyClosedSession = useCallback(() => {
    const { reopenedSessionId, layout } = reopenMostRecentlyArchivedConversation();
    applyLayoutState(layout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
    return reopenedSessionId;
  }, []);

  const moveSession = useCallback(
    (sessionId: string, targetSection: ConversationShelf, targetSessionId?: string | null, position?: OpenConversationDropPosition) => {
      const nextLayout = moveConversationTab(sessionId, targetSection, targetSessionId, position);
      applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
    },
    [],
  );

  const shiftSession = useCallback((sessionId: string, direction: -1 | 1) => {
    const nextLayout = shiftConversationTab(sessionId, direction);
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
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
      sessionsPopulatedRef.current = true;
      return;
    }

    sessionsPopulatedRef.current = false;

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
          // Only apply individual session metas if the full sessions list hasn't
          // been populated yet (via SSE snapshot or bootstrap). Otherwise, the
          // merged snapshot would be overwritten by this single-session update.
          if (!sessionsPopulatedRef.current) {
            setSessions([session]);
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
  }, [automationThreadTitleBySessionId, liveTitles, openIds, pinnedIds, sessions, sessionsById, setSessions]);

  useEffect(() => {
    if (sessions === null) {
      return;
    }

    const knownSessionIds = new Set([
      ...sessions.map((session) => session.id),
      ...liveTitles.keys(),
      ...automationThreadTitleBySessionId.keys(),
      ...missingSessionMetaInflightRef.current,
    ]);

    if (sessions.length === 0 || (missingSessionMetaInflightRef.current.size > 0 && sessions.length < openIds.length)) {
      for (const id of [...openIds, ...pinnedIds, ...(activeId ? [activeId] : [])]) {
        knownSessionIds.add(id);
      }
    }

    // During the local-write grace window, protect locally-open conversations from
    // being pruned. Fork/branch/cwd-change flows can add a replacement session id
    // synchronously before the server sessions list catches up.
    if (isWithinLocalWriteGrace()) {
      for (const id of [...openIds, ...pinnedIds, ...(activeId ? [activeId] : [])]) {
        knownSessionIds.add(id);
      }
    }

    const nextOpenIds = openIds.filter((id) => knownSessionIds.has(id));
    const nextPinnedIds = pinnedIds.filter((id) => knownSessionIds.has(id));
    const nextArchivedConversationIds = archivedConversationIds.filter((id) => knownSessionIds.has(id));

    if (
      nextOpenIds.length === openIds.length &&
      nextPinnedIds.length === pinnedIds.length &&
      nextArchivedConversationIds.length === archivedConversationIds.length
    ) {
      return;
    }

    const nextLayout = replaceConversationLayout({
      sessionIds: nextOpenIds,
      pinnedSessionIds: nextPinnedIds,
      archivedSessionIds: nextArchivedConversationIds,
      activeSessionId: activeId && knownSessionIds.has(activeId) ? activeId : null,
    });
    applyLayoutState(nextLayout, { setOpenIds, setPinnedIds, setArchivedConversationIds, setActiveId });
  }, [activeId, archivedConversationIds, automationThreadTitleBySessionId, liveTitles, openIds, pinnedIds, sessions]);
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
  const loading = sessions === null && (sseStatus === 'connecting' || sseStatus === 'reconnecting');

  return {
    pinnedIds,
    openIds,
    archivedConversationIds,
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
    reopenMostRecentlyClosedSession,
    moveSession,
    shiftSession,
    loading,
    layoutHydrating,
    refetch,
  };
}
