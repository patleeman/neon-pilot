import { Component, type ReactNode, useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Button, ButtonLink, Notice, SectionLabel, SurfacePanel } from '../components/ui';
import { WindowedLayout } from '../components/WindowedLayout';
import { ExtensionRegistryProvider } from '../extensions/useExtensionRegistry';
import { ThemeProvider } from '../ui-state/theme';
import { AppDataContext, AppEventsContext, LiveTitlesContext, SseConnectionContext, SystemStatusContext } from './contexts';
import { useDesktopAppEventRuntime } from './useDesktopAppEventRuntime';

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
        <SurfacePanel className="max-w-lg px-6 py-6">
          <SectionLabel tone="muted">Something went wrong</SectionLabel>
          <h1 className="mt-2 text-[22px] font-semibold text-primary">Neon Pilot encountered an error</h1>
          <p className="mt-2 text-[13px] leading-6 text-secondary">
            The application crashed unexpectedly. You can try reloading, or start a new conversation.
          </p>
          {this.state.errorMessage ? (
            <Notice tone="warning" className="mt-4">
              <SectionLabel tone="muted">Error details</SectionLabel>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-primary">
                {this.state.errorMessage}
              </p>
            </Notice>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="action" onClick={() => window.location.reload()}>
              Reload application
            </Button>
            <ButtonLink href="/conversations/new" variant="action">
              New conversation
            </ButtonLink>
          </div>
        </SurfacePanel>
      </main>
    );
  }
}

export function App() {
  const {
    conversationMetadataVersions,
    conversationVersions,
    daemon,
    eventVersions,
    projects,
    setDaemon,
    setProjects,
    setTitle,
    sseStatus,
    titleMap,
  } = useDesktopAppEventRuntime();

  const appEventsContextValue = useMemo(
    () => ({ versions: eventVersions, conversationVersions, conversationMetadataVersions }),
    [conversationMetadataVersions, conversationVersions, eventVersions],
  );
  const sseConnectionContextValue = useMemo(() => ({ status: sseStatus }), [sseStatus]);
  const appDataContextValue = useMemo(() => ({ projects, setProjects }), [projects, setProjects]);
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
                        <Route path="/*" element={<WindowedLayout />} />
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
