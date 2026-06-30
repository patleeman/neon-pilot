import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ALL_COMMAND_PALETTE_SCOPE } from '../commands/commandPalette';
import { COMMAND_PALETTE_STATE_EVENT, type CommandPaletteStateDetail, OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents';
import { getDesktopBridge, isDesktopShell } from '../desktop/desktopBridge';
import { setExtensionCommandContext } from '../extensions/commands';
import { TopBarElementHost } from '../extensions/TopBarElementHost';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import type { DesktopAppPreferencesState, DesktopEnvironmentState, DesktopNavigationState } from '../shared/types';
import { cx, Keycap, Pill, SearchInput, ToolbarButton } from './ui';

function LeftSidebarToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="1.5" y="2" width="11" height="10" rx="1.8" />
      <path d="M4.75 2v10" />
      {open ? <path d="M6 7h2.5" /> : <path d="M7.9 5.4 6.2 7l1.7 1.6" />}
    </svg>
  );
}

function RightRailToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="1.5" y="2" width="11" height="10" rx="1.8" />
      <path d="M9.25 2v10" />
      {open ? <path d="M8 7H5.5" /> : <path d="M6.1 5.4 7.8 7l-1.7 1.6" />}
    </svg>
  );
}

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
  sidebarOpen,
  onToggleSidebar,
  sidebarToggleLabel,
  showRailToggle,
  railOpen,
  onToggleRail,
  trailingExtra,
}: {
  environment: DesktopEnvironmentState | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  sidebarToggleLabel?: { open: string; closed: string };
  showRailToggle: boolean;
  railOpen: boolean;
  onToggleRail: () => void;
  trailingExtra?: React.ReactNode;
}) {
  const location = useLocation();
  const effectiveSidebarToggleLabel = sidebarToggleLabel ?? { open: 'Hide sidebar', closed: 'Show sidebar' };
  const { topBarElements } = useExtensionRegistry();
  const searchShellRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const browserNavigationSyncTimerRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  function openPaletteFromSearch(query = searchQuery) {
    const rect = searchShellRef.current?.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, {
        detail: {
          query,
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
      if (!open) {
        setSearchQuery('');
      }
    }

    window.addEventListener(COMMAND_PALETTE_STATE_EVENT, handlePaletteState);
    return () => window.removeEventListener(COMMAND_PALETTE_STATE_EVENT, handlePaletteState);
  }, []);

  useEffect(() => {
    function handlePaletteShortcut(event: Event) {
      const detail = (event as CustomEvent<{ anchorRect?: unknown; query?: string }>).detail;
      if (detail?.anchorRect) return;
      event.stopImmediatePropagation();
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      window.requestAnimationFrame(() => openPaletteFromSearch(detail?.query ?? searchQuery));
    }

    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handlePaletteShortcut, true);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handlePaletteShortcut, true);
  }, [searchQuery]);

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
            className="ui-desktop-top-bar__icon-button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? effectiveSidebarToggleLabel.open : effectiveSidebarToggleLabel.closed}
            title={sidebarOpen ? effectiveSidebarToggleLabel.open : effectiveSidebarToggleLabel.closed}
          >
            <LeftSidebarToggleIcon open={sidebarOpen} />
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
      <div className="ui-desktop-top-bar__center flex items-center justify-center gap-2" style={dragStyle}>
        <div
          ref={searchShellRef}
          className={cx('ui-command-search-trigger ui-desktop-top-bar__search', paletteOpen && 'pointer-events-none opacity-0')}
          style={noDragStyle}
        >
          <span aria-hidden="true">⌕</span>
          <SearchInput
            ref={searchInputRef}
            value={searchQuery}
            onFocus={() => openPaletteFromSearch()}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              openPaletteFromSearch(event.target.value);
            }}
            placeholder="Search threads, models, settings…"
            aria-label="Search threads, models, settings"
            className="ui-desktop-top-bar__search-input h-6 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 font-mono text-[11px] tracking-normal text-secondary placeholder:text-dim"
          />
          <Keycap className="ui-desktop-top-bar__search-keycap">⌘K</Keycap>
        </div>
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
        <ToolbarButton
          className="ui-desktop-top-bar__icon-button"
          onClick={onToggleRail}
          disabled={!showRailToggle}
          aria-label={showRailToggle ? (railOpen ? 'Hide workbench' : 'Show workbench') : 'Workbench unavailable'}
          title={showRailToggle ? (railOpen ? 'Hide workbench' : 'Show workbench') : 'Workbench unavailable'}
        >
          <RightRailToggleIcon open={showRailToggle ? railOpen : false} />
        </ToolbarButton>
      </div>
    </div>
  );
}
