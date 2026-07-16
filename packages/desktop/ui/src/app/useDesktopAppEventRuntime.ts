import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../client/api';
import { bumpConversationScopedEventVersions, INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions';
import { subscribeDesktopRealtimeAppEvents } from '../desktop/desktopRealtime';
import { fetchSessionsSnapshot } from '../session/sessionSnapshot';
import { applyRemoteConversationLayout, forgetConversationTab, openConversationTab } from '../session/sessionTabs';
import type {
  AppInvalidationTopic,
  DaemonState,
  DesktopAppEvent,
  DurableRunListResult,
  ScheduledTaskSummary,
  SessionMeta,
} from '../shared/types';
import { conversationRuntimeStore, executionStore, runStore, sessionStore, taskStore, titleStore } from '../store';
import { buildAppSnapshotRefreshPlan, incrementAppEventVersionsForTopics, incrementRunProjectionEventVersions } from './appEventProjection';
import { INITIAL_APP_EVENT_VERSIONS } from './contexts';

const SESSION_META_REFRESH_DELAY_MS = 750;
const SESSIONS_SNAPSHOT_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];
const APP_SNAPSHOT_RECONCILE_INTERVAL_MS = 5_000;

type SnapshotRequestKey = 'sessions' | 'tasks' | 'runs' | 'executions' | 'daemon';
type SseStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

function areJsonSnapshotsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reuseEqualSnapshot<T>(previous: T | null, next: T): T {
  return previous !== null && areJsonSnapshotsEqual(previous, next) ? previous : next;
}

export function useDesktopAppEventRuntime() {
  const [titleMap, setTitleMap] = useState<Map<string, string>>(new Map());
  const [eventVersions, setEventVersions] = useState(INITIAL_APP_EVENT_VERSIONS);
  const [conversationVersions, setConversationVersions] = useState(INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS);
  const [conversationMetadataVersions, setConversationMetadataVersions] = useState(INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS);
  const [sseStatus, setSseStatus] = useState<SseStatus>('connecting');
  const [daemon, setDaemonState] = useState<DaemonState | null>(null);

  const openedOnceRef = useRef(false);
  const snapshotRequestLifecycleRef = useRef({
    disposed: false,
    seqByKey: new Map<SnapshotRequestKey, number>(),
  });
  const refreshSessionMetaSeqRef = useRef(new Map<string, number>());
  const refreshSessionMetaTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sessionsSnapshotRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInvalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationTopicsRef = useRef(new Set<AppInvalidationTopic>());
  const subscriptionGenerationRef = useRef(0);

  const setTitle = useCallback((id: string, title: string) => {
    setTitleMap((prev) => {
      if (prev.get(id) === title) return prev;
      const next = new Map(prev);
      next.set(id, title);
      return next;
    });
  }, []);

  const setProjects = useCallback(() => {}, []);

  const setSessions = useCallback((items: SessionMeta[]) => {
    sessionStore.replaceAll(items);
    sessionStore.markReady?.();
  }, []);

  const applySessionMetaUpdate = useCallback((sessionId: string, nextSession: SessionMeta | null) => {
    if (!nextSession) {
      conversationRuntimeStore.clear(sessionId);
      sessionStore.remove(sessionId);
      forgetConversationTab(sessionId);
      return;
    }
    sessionStore.upsert(nextSession);
    conversationRuntimeStore.reconcileIdleFromSessionMeta(nextSession);
  }, []);

  const bumpConversationVersion = useCallback((sessionId: string) => {
    setConversationVersions((previous) => bumpConversationScopedEventVersions(previous, sessionId));
  }, []);

  const bumpConversationMetadataVersion = useCallback((sessionId: string) => {
    setConversationMetadataVersions((previous) => bumpConversationScopedEventVersions(previous, sessionId));
  }, []);

  const refreshSessionMeta = useCallback(
    (sessionId: string) => {
      const nextSeq = (refreshSessionMetaSeqRef.current.get(sessionId) ?? 0) + 1;
      refreshSessionMetaSeqRef.current.set(sessionId, nextSeq);

      const existingTimer = refreshSessionMetaTimersRef.current.get(sessionId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        refreshSessionMetaTimersRef.current.delete(sessionId);
        void api
          .sessionMeta(sessionId)
          .then((session) => {
            if (refreshSessionMetaSeqRef.current.get(sessionId) !== nextSeq) {
              return;
            }
            applySessionMetaUpdate(sessionId, session);
          })
          .catch((error) => {
            if (refreshSessionMetaSeqRef.current.get(sessionId) !== nextSeq) {
              return;
            }
            const message = error instanceof Error ? error.message : String(error);
            if (/not found/i.test(message)) {
              applySessionMetaUpdate(sessionId, null);
            }
          });
      }, SESSION_META_REFRESH_DELAY_MS);
      refreshSessionMetaTimersRef.current.set(sessionId, timer);
    },
    [applySessionMetaUpdate],
  );

  useEffect(() => {
    return () => {
      for (const timer of refreshSessionMetaTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      refreshSessionMetaTimersRef.current.clear();
      if (sessionsSnapshotRetryTimerRef.current !== null) {
        window.clearTimeout(sessionsSnapshotRetryTimerRef.current);
        sessionsSnapshotRetryTimerRef.current = null;
      }
    };
  }, []);

  const setTasks = useCallback((items: ScheduledTaskSummary[]) => {
    taskStore.replaceAll(items);
  }, []);

  const setRuns = useCallback((result: DurableRunListResult) => {
    runStore.replaceAll(result.runs ?? []);
  }, []);

  const setExecutions = useCallback((result: import('../shared/types').ExecutionListResult) => {
    executionStore.replaceAll(result.executions ?? []);
  }, []);

  const setDaemon = useCallback((state: DaemonState) => {
    setDaemonState((previous) => reuseEqualSnapshot(previous, state));
  }, []);

  useEffect(() => {
    snapshotRequestLifecycleRef.current.disposed = false;
    return () => {
      snapshotRequestLifecycleRef.current.disposed = true;
    };
  }, []);

  const beginSnapshotRequest = useCallback((key: SnapshotRequestKey) => {
    const nextSeq = (snapshotRequestLifecycleRef.current.seqByKey.get(key) ?? 0) + 1;
    snapshotRequestLifecycleRef.current.seqByKey.set(key, nextSeq);
    return nextSeq;
  }, []);

  const isLatestSnapshotRequest = useCallback((key: SnapshotRequestKey, seq: number) => {
    return !snapshotRequestLifecycleRef.current.disposed && snapshotRequestLifecycleRef.current.seqByKey.get(key) === seq;
  }, []);

  const loadSessionsSnapshot = useCallback(
    (retryAttempt = 0) => {
      if (sessionsSnapshotRetryTimerRef.current !== null) {
        window.clearTimeout(sessionsSnapshotRetryTimerRef.current);
        sessionsSnapshotRetryTimerRef.current = null;
      }
      const requestSeq = beginSnapshotRequest('sessions');
      void api
        .sidebarConversations()
        .then((items) => {
          if (!isLatestSnapshotRequest('sessions', requestSeq)) return;
          applyRemoteConversationLayout({
            sessionIds: items.sessionIds,
            pinnedSessionIds: items.pinnedSessionIds,
            archivedSessionIds: items.archivedSessionIds,
            lockedConversationIds: items.lockedConversationIds,
            conversationPlacements: items.conversationPlacements,
            activeSessionId: items.activeConversationId,
            workspacePaths: items.workspacePaths,
            remoteControlledConversationIds: items.remoteControlledConversationIds,
            conversationWorkspaceRevision: items.conversationWorkspaceRevision,
            conversationWorkspaceUpdatedAt: items.conversationWorkspaceUpdatedAt,
            conversationWorkspaceMigratedAt: items.conversationWorkspaceMigratedAt,
          });
          setSessions(items.sessions);
        })
        .catch(() => {
          if (!isLatestSnapshotRequest('sessions', requestSeq)) return;
          void fetchSessionsSnapshot()
            .then((items) => {
              if (isLatestSnapshotRequest('sessions', requestSeq)) setSessions(items);
            })
            .catch(() => {
              if (!isLatestSnapshotRequest('sessions', requestSeq)) return;
              const retryDelay =
                SESSIONS_SNAPSHOT_RETRY_DELAYS_MS[Math.min(retryAttempt, SESSIONS_SNAPSHOT_RETRY_DELAYS_MS.length - 1)] ?? 8_000;
              sessionsSnapshotRetryTimerRef.current = window.setTimeout(() => {
                sessionsSnapshotRetryTimerRef.current = null;
                loadSessionsSnapshot(retryAttempt + 1);
              }, retryDelay);
            });
        });
    },
    [beginSnapshotRequest, isLatestSnapshotRequest, setSessions],
  );

  const loadTasksSnapshot = useCallback(() => {
    const requestSeq = beginSnapshotRequest('tasks');
    void api
      .tasks()
      .then((items) => {
        if (isLatestSnapshotRequest('tasks', requestSeq)) setTasks(items);
      })
      .catch(() => {});
  }, [beginSnapshotRequest, isLatestSnapshotRequest, setTasks]);

  const loadRunsSnapshot = useCallback(() => {
    const requestSeq = beginSnapshotRequest('runs');
    void api
      .runs()
      .then((result) => {
        if (isLatestSnapshotRequest('runs', requestSeq)) setRuns(result);
      })
      .catch(() => {});
  }, [beginSnapshotRequest, isLatestSnapshotRequest, setRuns]);

  const loadExecutionsSnapshot = useCallback(() => {
    const requestSeq = beginSnapshotRequest('executions');
    void api
      .executions()
      .then((result) => {
        if (isLatestSnapshotRequest('executions', requestSeq)) setExecutions(result);
      })
      .catch(() => {});
  }, [beginSnapshotRequest, isLatestSnapshotRequest, setExecutions]);

  const loadDaemonSnapshot = useCallback(() => {
    const requestSeq = beginSnapshotRequest('daemon');
    void api
      .daemon()
      .then((state) => {
        if (isLatestSnapshotRequest('daemon', requestSeq)) setDaemon(state);
      })
      .catch(() => {});
  }, [beginSnapshotRequest, isLatestSnapshotRequest, setDaemon]);

  const refreshInvalidatedSnapshots = useCallback(
    (topics: readonly AppInvalidationTopic[]) => {
      for (const topic of topics) {
        pendingInvalidationTopicsRef.current.add(topic);
      }
      if (refreshInvalidationTimerRef.current !== null) return;

      refreshInvalidationTimerRef.current = window.setTimeout(() => {
        refreshInvalidationTimerRef.current = null;
        const pendingTopics = pendingInvalidationTopicsRef.current;
        pendingInvalidationTopicsRef.current = new Set<AppInvalidationTopic>();
        const plan = buildAppSnapshotRefreshPlan(pendingTopics);

        if (plan.sessions) loadSessionsSnapshot();
        if (plan.tasks) loadTasksSnapshot();
        if (plan.runs) loadRunsSnapshot();
        if (plan.executions) loadExecutionsSnapshot();
        if (plan.daemon) loadDaemonSnapshot();
      }, 150);
    },
    [loadDaemonSnapshot, loadExecutionsSnapshot, loadRunsSnapshot, loadSessionsSnapshot, loadTasksSnapshot],
  );

  const handleDesktopAppEvent = useCallback(
    (payload: DesktopAppEvent) => {
      switch (payload.type) {
        case 'live_title':
          setTitle(payload.sessionId, payload.title);
          titleStore.set(payload.sessionId, payload.title);
          return;
        case 'conversation_state_changed':
          conversationRuntimeStore.apply(payload.conversation);
          return;
        case 'session_meta_changed':
          bumpConversationMetadataVersion(payload.sessionId);
          void refreshSessionMeta(payload.sessionId);
          return;
        case 'session_file_changed':
          bumpConversationVersion(payload.sessionId);
          return;
        case 'conversation_workspace_changed':
          applyRemoteConversationLayout({
            sessionIds: payload.sessionIds,
            pinnedSessionIds: payload.pinnedSessionIds,
            archivedSessionIds: payload.archivedSessionIds,
            conversationPlacements: payload.conversationPlacements,
            activeSessionId: payload.activeConversationId,
            workspacePaths: payload.workspacePaths,
            remoteControlledConversationIds: payload.remoteControlledConversationIds,
            conversationWorkspaceRevision: payload.conversationWorkspaceRevision,
            conversationWorkspaceUpdatedAt: payload.conversationWorkspaceUpdatedAt,
            conversationWorkspaceMigratedAt: payload.conversationWorkspaceMigratedAt,
          });
          return;
        case 'open_session':
          openConversationTab(payload.sessionId);
          return;
        case 'sessions_snapshot':
        case 'sessions':
          setSessions(payload.sessions);
          return;
        case 'tasks_snapshot':
        case 'tasks':
          setTasks(payload.tasks);
          taskStore.replaceAll(payload.tasks);
          return;
        case 'runs_snapshot':
        case 'runs':
          setRuns(payload.result);
          runStore.replaceAll(payload.result.runs ?? []);
          void api
            .executions()
            .then((result) => {
              setExecutions(result);
            })
            .catch(() => {});
          setEventVersions(incrementRunProjectionEventVersions);
          return;
        case 'daemon_snapshot':
        case 'daemon':
          setDaemon(payload.state);
          return;
        case 'notification':
          window.dispatchEvent(
            new CustomEvent('neon-pilot-notification', {
              detail: {
                message: payload.message,
                type: (payload as { severity?: string }).severity ?? 'info',
                details: payload.details,
                source: payload.extensionId,
              },
            }),
          );
          return;
        case 'extension_command':
          window.dispatchEvent(
            new CustomEvent('neon-pilot-extension-command-execute', {
              detail: {
                command: payload.command,
                args: payload.args,
                sourceExtensionId: payload.sourceExtensionId,
                requestId: payload.requestId,
              },
            }),
          );
          return;
        case 'extension_ui_confirm':
          window.dispatchEvent(new CustomEvent('neon-pilot-extension-ui-confirm', { detail: payload }));
          return;
        case 'invalidate':
          refreshInvalidatedSnapshots(payload.topics);
          setEventVersions((prev) => incrementAppEventVersionsForTopics(prev, payload.topics));
          window.dispatchEvent(new CustomEvent('neon-pilot-app-invalidate', { detail: { topics: payload.topics } }));
          return;
        default:
          return;
      }
    },
    [
      bumpConversationMetadataVersion,
      bumpConversationVersion,
      refreshInvalidatedSnapshots,
      refreshSessionMeta,
      setDaemon,
      setExecutions,
      setRuns,
      setSessions,
      setTasks,
      setTitle,
    ],
  );

  const bootstrapSnapshots = useCallback(() => {
    loadSessionsSnapshot();
    loadTasksSnapshot();
    loadRunsSnapshot();
    loadExecutionsSnapshot();
    loadDaemonSnapshot();
  }, [loadDaemonSnapshot, loadExecutionsSnapshot, loadRunsSnapshot, loadSessionsSnapshot, loadTasksSnapshot]);

  const subscribe = useCallback(() => {
    const generation = ++subscriptionGenerationRef.current;
    let cancelled = false;
    let cleanup = () => {};
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = (delayMs: number) => {
      if (cancelled) return;
      reconnectTimer = window.setTimeout(() => {
        if (cancelled) return;
        cleanup();
        const localCleanup = subscribeDesktopRealtimeAppEvents({
          onopen: () => {
            openedOnceRef.current = true;
            setSseStatus('open');
          },
          onevent: handleDesktopAppEvent,
          onerror: () => {
            setSseStatus(openedOnceRef.current ? 'reconnecting' : 'connecting');
          },
          onclose: () => {
            setSseStatus('offline');
            if (openedOnceRef.current) scheduleReconnect(3000);
          },
        });
        if (cancelled || generation !== subscriptionGenerationRef.current) {
          localCleanup();
          return;
        }
        cleanup = localCleanup;
      }, delayMs);
    };

    bootstrapSnapshots();

    const localCleanup = subscribeDesktopRealtimeAppEvents({
      onopen: () => {
        openedOnceRef.current = true;
        setSseStatus('open');
      },
      onevent: handleDesktopAppEvent,
      onerror: () => {
        setSseStatus(openedOnceRef.current ? 'reconnecting' : 'connecting');
      },
      onclose: () => {
        setSseStatus('offline');
        if (openedOnceRef.current) scheduleReconnect(3000);
      },
    });
    if (cancelled || generation !== subscriptionGenerationRef.current) {
      localCleanup();
    } else {
      cleanup = localCleanup;
    }

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (refreshInvalidationTimerRef.current !== null) {
        window.clearTimeout(refreshInvalidationTimerRef.current);
        refreshInvalidationTimerRef.current = null;
      }
      pendingInvalidationTopicsRef.current.clear();
      cleanup();
      setSseStatus('offline');
    };
  }, [bootstrapSnapshots, handleDesktopAppEvent]);

  useEffect(() => {
    const cleanup = subscribe();
    return () => {
      cleanup();
    };
  }, [subscribe]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadSessionsSnapshot();
      loadTasksSnapshot();
      loadRunsSnapshot();
      loadDaemonSnapshot();
    }, APP_SNAPSHOT_RECONCILE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadDaemonSnapshot, loadRunsSnapshot, loadSessionsSnapshot, loadTasksSnapshot]);

  return {
    conversationMetadataVersions,
    conversationVersions,
    daemon,
    eventVersions,
    projects: null,
    setDaemon,
    setProjects,
    setTitle,
    sseStatus,
    titleMap,
  };
}
