import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import type { ApplicationViewState, ApplicationWorkspaceState } from '../applications/applicationWorkspace';
import { ALL_COMMAND_PALETTE_SCOPE } from '../commands/commandPalette';
import { COMMAND_PALETTE_STATE_EVENT, type CommandPaletteStateDetail, OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents';
import { getDesktopBridge, isDesktopShell } from '../desktop/desktopBridge';
import { setExtensionCommandContext } from '../extensions/commands';
import type { ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { TopBarElementHost } from '../extensions/TopBarElementHost';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import type { DesktopAppPreferencesState, DesktopEnvironmentState, DesktopNavigationState } from '../shared/types';
import { ApplicationTaskbar } from './ApplicationTaskbar';
import { Keycap, Pill, ToolbarButton } from './ui';

function UpdateReadyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M7 1.8v7" />
      <path d="M4.2 6.2 7 9l2.8-2.8" />
      <path d="M2.2 11.7h9.6" />
    </svg>
  );
}

const MAX_BROWSER_NAVIGATION_INDEX = 10_000;
export const APP_NAVIGATION_COMMAND_EVENT = 'neon-pilot-app-navigation-command';

function isSafeNavigationIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_BROWSER_NAVIGATION_INDEX;
}

function readPersistedNavigationIndex(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const normalized = value.trim();
  const parsed = /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : Number.NaN;
  return isSafeNavigationIndex(parsed) ? parsed : fallback;
}

export function readBrowserNavigationState(): DesktopNavigationState {
  if (typeof window === 'undefined') {
    return { canGoBack: false, canGoForward: false };
  }

  const rawIndex = (window.history.state as { idx?: unknown } | null | undefined)?.idx;
  const currentIndex = typeof rawIndex === 'number' && isSafeNavigationIndex(rawIndex) ? rawIndex : 0;
  let maxIndex = currentIndex;

  try {
    const stored = readPersistedNavigationIndex(window.sessionStorage.getItem('__pa_nav_max_idx__'), currentIndex);
    if (Number.isSafeInteger(stored) && stored >= 0) {
      maxIndex = Math.max(currentIndex, stored);
    }
    window.sessionStorage.setItem('__pa_nav_max_idx__', String(maxIndex));
  } catch {
    maxIndex = currentIndex;
  }

  return {
    canGoBack: currentIndex > 0,
    canGoForward: currentIndex < maxIndex,
  };
}

export function DesktopTopBar({
  environment,
  applications,
  applicationWorkspace,
  activeApplicationId,
  onActivateApplication,
  onActivateApplicationView,
  onToggleApplicationPinned,
  onCloseApplicationView,
  trailingExtra,
}: {
  environment: DesktopEnvironmentState | null;
  applications: readonly ApplicationRegistration[];
  applicationWorkspace: ApplicationWorkspaceState;
  activeApplicationId: string | null;
  onActivateApplication: (application: ApplicationRegistration) => void;
  onActivateApplicationView: (view: ApplicationViewState) => void;
  onToggleApplicationPinned: (applicationId: string) => void;
  onCloseApplicationView: (viewId: string) => void;
  trailingExtra?: React.ReactNode;
}) {
  const location = useLocation();
  const { topBarElements } = useExtensionRegistry();
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const browserNavigationSyncTimerRef = useRef<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navigation, setNavigation] = useState<DesktopNavigationState>({
    canGoBack: false,
    canGoForward: false,
  });
  const [appPreferences, setAppPreferences] = useState<DesktopAppPreferencesState | null>(null);
  const bridge = getDesktopBridge();

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setNavigation(readBrowserNavigationState());
      return;
    }

    let cancelled = false;
    bridge
      .getNavigationState()
      .then((state) => {
        if (!cancelled) {
          setNavigation(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNavigation({ canGoBack: false, canGoForward: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.key, location.pathname, location.search]);

  useEffect(() => {
    if (!bridge?.readDesktopAppPreferences) return;

    let cancelled = false;
    let timeout: number | null = null;

    const refresh = () => {
      void bridge
        .readDesktopAppPreferences()
        .then((state) => {
          if (!cancelled) setAppPreferences(state);
        })
        .catch(() => {
          if (!cancelled) setAppPreferences(null);
        })
        .finally(() => {
          if (!cancelled) timeout = window.setTimeout(refresh, 30_000);
        });
    };

    refresh();

    return () => {
      cancelled = true;
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [bridge]);

  const desktopShell = isDesktopShell();
  const showDesktopChrome = bridge !== null || environment !== null || desktopShell;

  useEffect(
    () => () => {
      if (browserNavigationSyncTimerRef.current !== null) {
        window.clearTimeout(browserNavigationSyncTimerRef.current);
        browserNavigationSyncTimerRef.current = null;
      }
    },
    [],
  );

  function scheduleBrowserNavigationSync() {
    if (browserNavigationSyncTimerRef.current !== null) {
      window.clearTimeout(browserNavigationSyncTimerRef.current);
    }
    browserNavigationSyncTimerRef.current = window.setTimeout(() => {
      browserNavigationSyncTimerRef.current = null;
      setNavigation(readBrowserNavigationState());
    }, 120);
  }

  async function handleBack() {
    if (!bridge) {
      window.history.back();
      scheduleBrowserNavigationSync();
      return;
    }

    const state = await bridge.goBack();
    setNavigation(state);
  }

  async function handleForward() {
    if (!bridge) {
      window.history.forward();
      scheduleBrowserNavigationSync();
      return;
    }

    const state = await bridge.goForward();
    setNavigation(state);
  }

  useEffect(() => {
    setExtensionCommandContext('app.canGoBack', navigation.canGoBack);
    setExtensionCommandContext('app.canGoForward', navigation.canGoForward);
    return () => {
      setExtensionCommandContext('app.canGoBack', null);
      setExtensionCommandContext('app.canGoForward', null);
    };
  }, [navigation.canGoBack, navigation.canGoForward]);

  useEffect(() => {
    function handleNavigationCommand(event: Event) {
      const direction = (event as CustomEvent<{ direction?: unknown }>).detail?.direction;
      if (direction === 'back') {
        if (navigation.canGoBack) void handleBack();
        return;
      }
      if (direction === 'forward' && navigation.canGoForward) {
        void handleForward();
      }
    }

    window.addEventListener(APP_NAVIGATION_COMMAND_EVENT, handleNavigationCommand);
    return () => window.removeEventListener(APP_NAVIGATION_COMMAND_EVENT, handleNavigationCommand);
  }, [navigation.canGoBack, navigation.canGoForward, bridge]);

  async function handleUpdateClick() {
    if (!bridge?.installReadyUpdate) return;
    const state = await bridge.installReadyUpdate();
    setAppPreferences(state);
  }

  function openLauncher() {
    const rect = launcherRef.current?.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, {
        detail: {
          scope: ALL_COMMAND_PALETTE_SCOPE,
          anchorRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined,
        },
      }),
    );
  }

  useEffect(() => {
    function handlePaletteState(event: Event) {
      const detail = (event as CustomEvent<CommandPaletteStateDetail>).detail;
      const open = Boolean(detail?.open);
      setPaletteOpen(open);
    }

    window.addEventListener(COMMAND_PALETTE_STATE_EVENT, handlePaletteState);
    return () => window.removeEventListener(COMMAND_PALETTE_STATE_EVENT, handlePaletteState);
  }, []);

  useEffect(() => {
    function handlePaletteShortcut(event: Event) {
      const detail = (event as CustomEvent<{ anchorRect?: unknown; query?: string; scope?: unknown }>).detail;
      if (detail?.anchorRect) return;
      event.stopImmediatePropagation();
      window.requestAnimationFrame(openLauncher);
    }

    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handlePaletteShortcut, true);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handlePaletteShortcut, true);
  }, []);

  if (!showDesktopChrome) {
    return null;
  }

  const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;
  const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
  const environmentBadgeLabel =
    environment?.launchMode === 'rc' ? 'RC' : environment?.launchMode === 'dev' || environment?.launchMode === 'testing' ? 'Testing' : null;
  const environmentBadgeTitle = environment?.launchMode === 'rc' ? 'Release candidate build' : 'Testing build';
  const readyUpdateVersion = appPreferences?.update.status === 'ready' ? appPreferences.update.downloadedVersion : undefined;

  return (
    <div className="ui-desktop-top-bar" style={dragStyle}>
      <div className="ui-desktop-top-bar__leading">
        <div className="ui-desktop-top-bar__traffic-light-gap" aria-hidden="true" style={dragStyle} />
        <div className="ui-desktop-top-bar__controls" style={noDragStyle}>
          <ToolbarButton
            ref={launcherRef}
            className="ui-desktop-top-bar__launcher"
            onClick={openLauncher}
            aria-label="Open Neon Pilot"
            aria-expanded={paletteOpen}
          >
            <span>NeonPilot</span>
            <Keycap>⌘K</Keycap>
          </ToolbarButton>
          <ToolbarButton
            className="ui-desktop-top-bar__icon-button"
            onClick={() => {
              void handleBack();
            }}
            disabled={!navigation.canGoBack}
            aria-label="Go back"
            title="Go back"
          >
            ←
          </ToolbarButton>
          <ToolbarButton
            className="ui-desktop-top-bar__icon-button"
            onClick={() => {
              void handleForward();
            }}
            disabled={!navigation.canGoForward}
            aria-label="Go forward"
            title="Go forward"
          >
            →
          </ToolbarButton>
        </div>
        {environmentBadgeLabel ? (
          <Pill tone="muted" className="ui-desktop-top-bar__mode-badge" title={environmentBadgeTitle}>
            {environmentBadgeLabel}
          </Pill>
        ) : null}
      </div>
      <div className="ui-desktop-top-bar__center" style={noDragStyle}>
        <ApplicationTaskbar
          applications={applications}
          workspace={applicationWorkspace}
          activeApplicationId={activeApplicationId}
          onActivate={onActivateApplication}
          onActivateView={onActivateApplicationView}
          onTogglePinned={onToggleApplicationPinned}
          onCloseView={onCloseApplicationView}
        />
      </div>
      <div className="ui-desktop-top-bar__trailing" style={noDragStyle}>
        {topBarElements.map((element) => (
          <TopBarElementHost key={`${element.extensionId}:${element.id}`} registration={element} />
        ))}
        {readyUpdateVersion ? (
          <ToolbarButton
            className="ui-desktop-top-bar__update-button"
            onClick={() => {
              void handleUpdateClick();
            }}
            aria-label={`Restart to update to Neon Pilot ${readyUpdateVersion}`}
            title={`Restart to update to Neon Pilot ${readyUpdateVersion}`}
          >
            <UpdateReadyIcon />
            <span>Update</span>
          </ToolbarButton>
        ) : null}
        {trailingExtra}
      </div>
    </div>
  );
}
