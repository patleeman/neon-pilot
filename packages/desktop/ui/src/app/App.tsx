import { Component, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import { api } from '../client/api';
import { recordClientPerfTimingOnce } from '../client/perfDiagnostics';
import { Layout } from '../components/Layout';
import { bumpConversationScopedEventVersions, INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions';
import { resolveConversationIndexRedirect } from '../conversation/conversationRoutes';
import {
  hasDraftConversationAttachments,
  hasDraftConversationContextDocs,
  readDraftConversationComposer,
  readDraftConversationCwd,
} from '../conversation/draftConversation';
import { subscribeDesktopRealtimeAppEvents } from '../desktop/desktopRealtime';
import { ExtensionRouteHost } from '../extensions/ExtensionRouteHost';
import { ExtensionRegistryProvider } from '../extensions/useExtensionRegistry';
import { useConversations } from '../hooks/useConversations';
import { ConversationPage } from '../pages/ConversationPage';
import {
  mergeSessionSnapshotPreservingOrder,
  removeSessionMetaPreservingOrder,
  replaceSessionMetaPreservingOrder,
  updateSessionRunningPreservingOrder,
} from '../session/sessionListState';
import { fetchSessionsSnapshot } from '../session/sessionSnapshot';
import { openConversationTab } from '../session/sessionTabs';
import type { AppEventTopic, DaemonState, DesktopAppEvent, DurableRunListResult, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import { ThemeProvider } from '../ui-state/theme';
import {
  AppDataContext,
  AppEventsContext,
  INITIAL_APP_EVENT_VERSIONS,
  LiveTitlesContext,
  SseConnectionContext,
  SystemStatusContext,
} from './contexts';

const SESSION_META_REFRESH_DELAY_MS = 750;

function areJsonSnapshotsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reuseEqualSnapshot<T>(previous: T | null, next: T): T {
  return previous !== null && areJsonSnapshotsEqual(previous, next) ? previous : next;
}

// ── Top-level error boundary ────────────────────────────────────────────────
// Catches render crashes outside of route content (context providers, hooks, etc.)
// so the user sees a recovery UI instead of a white screen.

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? (error.stack ?? error.message) : String(error ?? ''),
    };
  }

  componentDidCatch(error: unknown, _errorInfo: { componentStack?: string }) {
    window.dispatchEvent(
      new CustomEvent('neon-pilot-notification', {
        detail: {
          message: 'Application crash recovered',
          type: 'error',
          details: error instanceof Error ? (error.stack ?? error.message) : String(error ?? ''),
          source: 'core',
        },
      }),
    );
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    // Reset error state when the route/children change so navigation works
    // after a crash without requiring a full page reload.
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-base px-6">
        <div className="max-w-lg rounded-2xl border border-border-subtle bg-surface px-6 py-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-dim">Something went wrong</p>
          <h1 className="mt-2 text-[22px] font-semibold text-primary">Neon Pilot encountered an error</h1>
          <p className="mt-2 text-[13px] leading-6 text-secondary">
            The application crashed unexpectedly. You can try reloading, or start a new conversation.
          </p>
          {this.state.errorMessage ? (
            <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Error details</p>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-primary">
                {this.state.errorMessage}
              </p>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="ui-action-button" onClick={() => window.location.reload()}>
              Reload application
            </button>
            <a href="/conversations/new" className="ui-action-button">
              New conversation
            </a>
          </div>
        </div>
      </main>
    );
  }
}

function ConversationsRouteRedirect() {
  const { openIds, pinnedIds } = useConversations();
  const hasDraft =
    readDraftConversationComposer().trim().length > 0 ||
    readDraftConversationCwd().trim().length > 0 ||
    hasDraftConversationAttachments() ||
    hasDraftConversationContextDocs();

  const redirectPath = resolveConversationIndexRedirect({
    openIds,
    pinnedIds,
    hasDraft,
  });

  return <Navigate to={redirectPath} replace />;
}

function readConversationNavigationStart(conversationId: string): number | null {
  const candidate = (globalThis as { __NEON_PILOT_LAST_SPA_NAVIGATION__?: { path?: string; startedAtMs?: number } })
    .__NEON_PILOT_LAST_SPA_NAVIGATION__;
  return candidate?.path === `/conversations/${conversationId}` && typeof candidate.startedAtMs === 'number' ? candidate.startedAtMs : null;
}

function suspendRoute(element: React.ReactNode) {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center px-6 text-[12px] text-dim">Loading…</div>}>
      {element}
    </Suspense>
  );
}

function DraftConversationRoute() {
  return suspendRoute(<ConversationPage key="draft" draft />);
}

function SavedConversationRoute() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  if (id) {
    const navigationStartedAtMs = readConversationNavigationStart(id);
    if (navigationStartedAtMs !== null) {
      recordClientPerfTimingOnce(`conversation.routeRender:${id}:${navigationStartedAtMs}`, {
        name: 'conversation.routeRender',
        startedAtMs: navigationStartedAtMs,
        meta: { conversationId: id },
      });
    }
  }
  const surfaceKey =
    location.state &&
    typeof location.state === 'object' &&
    'preserveConversationSurfaceKey' in location.state &&
    location.state.preserveConversationSurfaceKey === 'draft'
      ? 'draft'
      : (id ?? 'conversation');
  return suspendRoute(<ConversationPage key={surfaceKey} />);
}

function isDesktopProtocolShell(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'neon-pilot:';
}

export function App() {
  const [titleMap, setTitleMap] = useState<Map<string, string>>(new Map());
  const [eventVersions, setEventVersions] = useState(INITIAL_APP_EVENT_VERSIONS);
  const [conversationVersions, setConversationVersions] = useState(INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS);
  const [conversationMetadataVersions, setConversationMetadataVersions] = useState(INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'open' | 'reconnecting' | 'offline'>('connecting');

  const projects = null;
  const [sessions, setSessionsState] = useState<SessionMeta[] | null>(null);
  const [tasks, setTasksState] = useState<ScheduledTaskSummary[] | null>(null);
  const [runs, setRunsState] = useState<DurableRunListResult | null>(null);
  const [executions, setExecutionsState] = useState<import('../shared/types').ExecutionListResult | null>(null);
  const [daemon, setDaemonState] = useState<DaemonState | null>(null);
  const openedOnceRef = useRef(false);
  // Session meta requests can resolve out of order during fast run transitions.
  // Track the latest request per session so stale HTTP responses cannot undo the
  // authoritative running state already pushed over the desktop event stream.
  const refreshSessionMetaSeqRef = useRef(new Map<string, number>());
  const refreshSessionMetaTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
    setSessionsState((previous) => mergeSessionSnapshotPreservingOrder(previous, items));
  }, []);

  const applySessionMetaUpdate = useCallback((sessionId: string, nextSession: SessionMeta | null) => {
    setSessionsState((previous) => {
      if (!previous) {
        return previous;
      }

      if (!nextSession) {
        return removeSessionMetaPreservingOrder(previous, sessionId);
      }

      return replaceSessionMetaPreservingOrder(previous, nextSession);
    });
  }, []);

  const bumpConversationVersion = useCallback((sessionId: string) => {
    setConversationVersions((previous) => bumpConversationScopedEventVersions(previous, sessionId));
  }, []);

  const bumpConversationMetadataVersion = useCallback((sessionId: string) => {
    setConversationMetadataVersions((previous) => bumpConversationScopedEventVersions(previous, sessionId));
  }, []);

  const refreshSessionMeta = useCallback(
    (sessionId: string, running?: boolean) => {
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
            applySessionMetaUpdate(sessionId, session && running !== undefined ? { ...session, isRunning: running } : session);
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
    };
  }, []);

  const setTasks = useCallback((items: ScheduledTaskSummary[]) => {
    setTasksState((previous) => reuseEqualSnapshot(previous, items));
  }, []);

  const setRuns = useCallback((result: DurableRunListResult) => {
    setRunsState((previous) => reuseEqualSnapshot(previous, result));
  }, []);

  const setExecutions = useCallback((result: import('../shared/types').ExecutionListResult) => {
    setExecutionsState((previous) => reuseEqualSnapshot(previous, result));
  }, []);

  const setDaemon = useCallback((state: DaemonState) => {
    setDaemonState((previous) => reuseEqualSnapshot(previous, state));
  }, []);

  const refreshInvalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationTopicsRef = useRef(new Set<AppEventTopic>());

  const refreshInvalidatedSnapshots = useCallback(
    (topics: readonly AppEventTopic[]) => {
      for (const topic of topics) {
        pendingInvalidationTopicsRef.current.add(topic);
      }

      if (refreshInvalidationTimerRef.current !== null) {
        return;
      }

      refreshInvalidationTimerRef.current = window.setTimeout(() => {
        refreshInvalidationTimerRef.current = null;
        const pendingTopics = pendingInvalidationTopicsRef.current;
        pendingInvalidationTopicsRef.current = new Set<AppEventTopic>();

        if (pendingTopics.has('sessions')) {
          void fetchSessionsSnapshot()
            .then((items) => {
              setSessions(items);
            })
            .catch(() => undefined);
        }
        if (pendingTopics.has('tasks')) {
          void api
            .tasks()
            .then((items) => {
              setTasks(items);
            })
            .catch(() => undefined);
        }
        if (pendingTopics.has('runs') || pendingTopics.has('executions')) {
          void api
            .runs()
            .then((result) => {
              setRuns(result);
            })
            .catch(() => undefined);
          void api
            .executions()
            .then((result) => {
              setExecutions(result);
            })
            .catch(() => undefined);
        }
        if (pendingTopics.has('daemon')) {
          void api
            .daemon()
            .then((state) => {
              setDaemon(state);
            })
            .catch(() => undefined);
        }
      }, 150);
    },
    [setDaemon, setExecutions, setRuns, setSessions, setTasks],
  );

  const handleDesktopAppEvent = useCallback(
    (payload: DesktopAppEvent) => {
      switch (payload.type) {
        case 'live_title':
          setTitle(payload.sessionId, payload.title);
          return;
        case 'session_meta_changed':
          if (payload.running !== undefined) {
            setSessionsState((previous) =>
              previous ? updateSessionRunningPreservingOrder(previous, payload.sessionId, payload.running) : previous,
            );
          }
          bumpConversationMetadataVersion(payload.sessionId);
          void refreshSessionMeta(payload.sessionId, payload.running);
          return;
        case 'session_file_changed':
          bumpConversationVersion(payload.sessionId);
          return;
        case 'open_session':
          openConversationTab(payload.sessionId);
          return;

        case 'sessions':
          setSessions(payload.sessions);
          return;
        case 'tasks':
          setTasks(payload.tasks);
          return;
        case 'runs':
          setRuns(payload.result);
          void api
            .executions()
            .then((result) => {
              setExecutions(result);
            })
            .catch(() => {
              // Keep the last known projection until the next app event or manual refresh.
            });
          setEventVersions((prev) => ({
            ...prev,
            runs: prev.runs + 1,
            executions: prev.executions + 1,
          }));
          return;
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
        case 'invalidate':
          refreshInvalidatedSnapshots(payload.topics);
          setEventVersions((prev) => {
            const next = { ...prev };
            for (const topic of payload.topics) {
              if (topic in next) {
                const trackedTopic = topic as keyof typeof next;
                next[trackedTopic] += 1;
              }
            }
            return next;
          });
          return;
        default:
          return;
      }
    },
    [
      bumpConversationVersion,
      bumpConversationMetadataVersion,
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
    void fetchSessionsSnapshot()
      .then((items) => {
        setSessions(items);
      })
      .catch(() => {
        // Keep waiting for SSE or a later retry.
      });

    void api
      .tasks()
      .then((items) => {
        setTasks(items);
      })
      .catch(() => {
        // Keep waiting for SSE or a later retry.
      });

    void api
      .runs()
      .then((result) => {
        setRuns(result);
      })
      .catch(() => {
        // Keep waiting for SSE or a later retry.
      });

    void api
      .executions()
      .then((result) => {
        setExecutions(result);
      })
      .catch(() => {
        // Keep waiting for SSE or a later retry.
      });

    void api
      .daemon()
      .then((state) => {
        setDaemon(state);
      })
      .catch(() => {
        // Keep waiting for SSE or a later retry.
      });
  }, [setDaemon, setExecutions, setRuns, setSessions, setTasks]);

  // Track the latest subscription so we don't re-subscribe after a fresh mount.
  const subscriptionGenerationRef = useRef(0);

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
            // Schedule a reconnect if we were previously connected.
            if (openedOnceRef.current) {
              scheduleReconnect(3000);
            }
          },
        });
        if (cancelled || generation !== subscriptionGenerationRef.current) {
          localCleanup();
          return;
        }
        cleanup = localCleanup;
      }, delayMs);
    };

    const bootstrapTimer = window.setTimeout(() => {
      if (!openedOnceRef.current) {
        setSseStatus('offline');
        void bootstrapSnapshots();
      }
    }, 1500);

    const localCleanup = subscribeDesktopRealtimeAppEvents({
      onopen: () => {
        openedOnceRef.current = true;
        window.clearTimeout(bootstrapTimer);
        setSseStatus('open');
      },
      onevent: handleDesktopAppEvent,
      onerror: () => {
        setSseStatus(openedOnceRef.current ? 'reconnecting' : 'connecting');
      },
      onclose: () => {
        setSseStatus('offline');
        // Schedule a reconnect if we were previously connected.
        if (openedOnceRef.current) {
          scheduleReconnect(3000);
        }
      },
    });
    if (cancelled || generation !== subscriptionGenerationRef.current) {
      localCleanup();
    } else {
      cleanup = localCleanup;
    }

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimer);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
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
    if (!isDesktopProtocolShell()) {
      void bootstrapSnapshots();
    }
    const cleanup = subscribe();

    return () => {
      cleanup();
    };
  }, [bootstrapSnapshots, subscribe]);

  const appEventsContextValue = useMemo(
    () => ({ versions: eventVersions, conversationVersions, conversationMetadataVersions }),
    [conversationMetadataVersions, conversationVersions, eventVersions],
  );
  const sseConnectionContextValue = useMemo(() => ({ status: sseStatus }), [sseStatus]);
  const appDataContextValue = useMemo(
    () => ({ projects, sessions, tasks, runs, executions, setProjects, setSessions, setTasks, setRuns, setExecutions }),
    [executions, projects, runs, sessions, setExecutions, setProjects, setRuns, setSessions, setTasks, tasks],
  );
  const systemStatusContextValue = useMemo(() => ({ daemon, setDaemon }), [daemon, setDaemon]);
  const liveTitlesContextValue = useMemo(() => ({ titles: titleMap, setTitle }), [setTitle, titleMap]);

  return (
    <AppErrorBoundary>
      <AppEventsContext.Provider value={appEventsContextValue}>
        <SseConnectionContext.Provider value={sseConnectionContextValue}>
          <AppDataContext.Provider value={appDataContextValue}>
            <SystemStatusContext.Provider value={systemStatusContextValue}>
              <LiveTitlesContext.Provider value={liveTitlesContextValue}>
                <ThemeProvider>
                  <ExtensionRegistryProvider>
                    <BrowserRouter future={{ v7_startTransition: true }}>
                      <Routes>
                        <Route path="/" element={<Layout />}>
                          <Route index element={<Navigate to="/conversations/new" replace />} />
                          <Route path="conversations" element={<ConversationsRouteRedirect />} />
                          <Route path="conversations/new" element={<DraftConversationRoute />} />
                          <Route path="conversations/:id" element={<SavedConversationRoute />} />
                          <Route path="*" element={<ExtensionRouteHost />} />
                        </Route>
                      </Routes>
                    </BrowserRouter>
                  </ExtensionRegistryProvider>
                </ThemeProvider>
              </LiveTitlesContext.Provider>
            </SystemStatusContext.Provider>
          </AppDataContext.Provider>
        </SseConnectionContext.Provider>
      </AppEventsContext.Provider>
    </AppErrorBoundary>
  );
}
