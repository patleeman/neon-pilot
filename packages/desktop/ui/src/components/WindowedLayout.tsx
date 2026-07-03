import {
  type AppAccent,
  CANONICAL_WINDOWED_DESKTOP_APPS,
  StartMenu,
  type StartMenuItem,
  Taskbar,
  type TaskbarGroup,
  type TaskbarItem,
  WindowedChatSurface,
  WindowedMenuPanel,
  WindowFrame,
} from '@neon-pilot/windowed-os-ui';
import { type CSSProperties, type ReactNode, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createPath,
  type NavigateOptions,
  Route,
  Routes,
  type To,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';

import { getDesktopBridge } from '../desktop/desktopBridge';
import { ExtensionRouteHost } from '../extensions/ExtensionRouteHost';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { useConversations } from '../hooks/useConversations';
import { getTabSessionKey, readBrowserTabsState } from '../local/workbenchBrowserTabs';
import { ConversationPage } from '../pages/ConversationPage';
import type { SessionMeta } from '../shared/types';
import {
  boundsForRestoredDragStart,
  boundsForSnapTarget,
  constrainWindowBounds,
  type DesktopRect,
  resolveSnapTarget,
  type SnapTarget,
  type WindowBounds,
} from '../ui-state/windowedShell';
import { Layout } from './Layout';
import { QuietLoadingState } from './ui';
import { WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, type WindowedShellBrowserSuspendDetail } from './workbench/workbenchBrowserEvents';

type WindowKind = 'chat' | 'route';

interface DesktopWindowModel {
  id: string;
  kind: WindowKind;
  title: string;
  route: string;
  bounds: WindowBounds;
  minimized: boolean;
  focused: boolean;
  singleton?: boolean;
  archivedOnClose?: boolean;
}

interface LauncherItem {
  id: string;
  title: string;
  route: string;
  kind: WindowKind;
}

type DragState = {
  windowId: string;
  startX: number;
  startY: number;
  initial: WindowBounds;
};

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type ResizeState = DragState & {
  edge: ResizeEdge;
};

type WindowNavigate = (to: To) => void;

const WINDOW_STATE_STORAGE_KEY = 'pa:windowed-os-shell-windows:v1';
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 260;
const WINDOWED_BROWSER_SETTLE_MS = 600;

const STATIC_LAUNCHER_ITEMS: LauncherItem[] = [
  { id: 'chat', title: 'Chat', route: '/conversations/new', kind: 'chat' },
  { id: 'settings', title: 'Settings', route: '/settings', kind: 'route' },
];

const CANONICAL_WINDOWED_APP_BY_TITLE = new Map(CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => [app.title, app]));
const CANONICAL_LAUNCHER_ORDER = CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => app.title);

function createId(input: Pick<LauncherItem, 'kind' | 'route' | 'id'>, suffix?: string): string {
  if (input.kind === 'chat') return `chat:${suffix ?? 'draft'}`;
  return `route:${input.id}`;
}

function defaultBounds(index: number, kind: WindowKind): WindowBounds {
  const offset = (index % 7) * 34;
  if (kind === 'chat') {
    return { x: 42 + offset, y: 34 + offset, width: 1180, height: 760 };
  }
  return { x: 112 + offset, y: 72 + offset, width: 1040, height: 650 };
}

function defaultDraftWindow(): DesktopWindowModel {
  return {
    id: 'chat:draft',
    kind: 'chat',
    title: 'New conversation',
    route: '/conversations/new',
    bounds: defaultBounds(0, 'chat'),
    minimized: false,
    focused: true,
    archivedOnClose: false,
  };
}

function readStoredWindows(): DesktopWindowModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): DesktopWindowModel[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<DesktopWindowModel>;
      if (
        typeof record.id !== 'string' ||
        (record.kind !== 'chat' && record.kind !== 'route') ||
        typeof record.title !== 'string' ||
        typeof record.route !== 'string' ||
        !record.bounds ||
        typeof record.bounds.x !== 'number' ||
        typeof record.bounds.y !== 'number' ||
        typeof record.bounds.width !== 'number' ||
        typeof record.bounds.height !== 'number'
      ) {
        return [];
      }
      return [
        {
          id: record.id,
          kind: record.kind,
          title: record.title,
          route: record.route,
          bounds: record.bounds,
          minimized: record.minimized === true,
          focused: record.focused === true,
          singleton: record.singleton === true,
          archivedOnClose: record.archivedOnClose === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeStoredWindows(windows: DesktopWindowModel[]): void {
  try {
    window.localStorage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(windows));
  } catch {
    // Ignore storage failures; the in-memory desktop still works.
  }
}

function withFocusedWindow(windows: DesktopWindowModel[], windowId: string): DesktopWindowModel[] {
  const selected = windows.find((windowModel) => windowModel.id === windowId);
  if (!selected) return windows;
  return [
    ...windows.filter((windowModel) => windowModel.id !== windowId).map((windowModel) => ({ ...windowModel, focused: false })),
    { ...selected, focused: true, minimized: false },
  ];
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ') || 'Untitled';
}

function conversationWindowTitle(session: SessionMeta): string {
  return normalizeTitle(session.title ?? 'Chat');
}

function buildLauncherItems(extensionRegistry: ReturnType<typeof useExtensionRegistry>): LauncherItem[] {
  const seen = new Set(STATIC_LAUNCHER_ITEMS.map((item) => item.route));
  const dynamic = extensionRegistry.extensions
    .filter((extension) => extension.enabled)
    .flatMap((extension) => {
      const navItems = (extension.contributes?.nav ?? []).flatMap((item): LauncherItem[] => {
        if (!item.route || seen.has(item.route)) return [];
        seen.add(item.route);
        return [
          {
            id: `${extension.id}:${item.id}`,
            title: item.label,
            route: item.route,
            kind: 'route',
          },
        ];
      });

      const mainViewItems = (extension.contributes?.views ?? []).flatMap((view): LauncherItem[] => {
        if (view.location !== 'main' || !view.route || !isTopLevelRoute(view.route) || seen.has(view.route)) return [];
        seen.add(view.route);
        return [
          {
            id: `${extension.id}:${view.id}`,
            title: view.title,
            route: view.route,
            kind: 'route',
          },
        ];
      });

      return [...navItems, ...mainViewItems];
    })
    .sort(compareLauncherItems);

  return [STATIC_LAUNCHER_ITEMS[0]!, ...dynamic, STATIC_LAUNCHER_ITEMS[1]!];
}

function compareLauncherItems(left: LauncherItem, right: LauncherItem): number {
  const leftRank = CANONICAL_LAUNCHER_ORDER.indexOf(left.title);
  const rightRank = CANONICAL_LAUNCHER_ORDER.indexOf(right.title);
  const normalizedLeftRank = leftRank >= 0 ? leftRank : CANONICAL_LAUNCHER_ORDER.length;
  const normalizedRightRank = rightRank >= 0 ? rightRank : CANONICAL_LAUNCHER_ORDER.length;
  return normalizedLeftRank - normalizedRightRank || left.title.localeCompare(right.title);
}

function accentForTitle(title: string): AppAccent {
  const canonicalApp = CANONICAL_WINDOWED_APP_BY_TITLE.get(title);
  if (canonicalApp) return canonicalApp.accent;

  const normalized = title.toLowerCase();
  if (normalized.includes('chat') || normalized.includes('conversation')) return 'chat';
  if (normalized.includes('workflow')) return 'workflows';
  if (normalized.includes('routine')) return 'routines';
  if (normalized.includes('automation')) return 'automations';
  if (normalized.includes('model arena')) return 'model-arena';
  if (normalized.includes('gateway')) return 'gateways';
  if (normalized.includes('skill')) return 'skills';
  if (normalized.includes('extension')) return 'extensions';
  if (normalized.includes('diagnostic')) return 'diagnostics';
  if (normalized.includes('telemetry') || normalized.includes('run')) return 'telemetry';
  return 'settings';
}

function accentForWindow(windowModel: Pick<DesktopWindowModel, 'kind' | 'title'>): AppAccent {
  return windowModel.kind === 'chat' ? 'chat' : accentForTitle(windowModel.title);
}

function desktopRect(element: HTMLElement | null): DesktopRect {
  return { width: element?.clientWidth || window.innerWidth, height: element?.clientHeight || window.innerHeight };
}

function boundsStyle(bounds: WindowBounds): CSSProperties {
  return {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function isPrimaryNativeMouse(event: MouseEvent): boolean {
  return event.button === 0;
}

function suspendWindowedBrowserViews(durationMs = 1500): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<WindowedShellBrowserSuspendDetail>(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, { detail: { durationMs } }),
  );
  const bridge = getDesktopBridge();
  if (!bridge) return;

  const sessionKeys = new Set<string | null>([null]);
  try {
    for (const tab of readBrowserTabsState().tabs) {
      sessionKeys.add(getTabSessionKey(tab.id));
    }
  } catch {
    // The renderer-side browser component still receives the suspend event above.
  }

  for (const sessionKey of sessionKeys) {
    void bridge.setWorkbenchBrowserBounds({ visible: false, sessionKey, deactivate: true }).catch(() => undefined);
  }
}

function useWindowedBrowserSuppression(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;

    suspendWindowedBrowserViews();
    const interval = window.setInterval(() => suspendWindowedBrowserViews(600), 180);
    return () => window.clearInterval(interval);
  }, [active]);
}

function sameBounds(first: WindowBounds, second: WindowBounds): boolean {
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}

function boundsOverlap(first: WindowBounds, second: WindowBounds): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isWindowCoveredByHigherWindow(windowModel: DesktopWindowModel, visibleWindows: DesktopWindowModel[]): boolean {
  const index = visibleWindows.findIndex((candidate) => candidate.id === windowModel.id);
  if (index < 0) {
    return false;
  }

  return visibleWindows.slice(index + 1).some((candidate) => boundsOverlap(windowModel.bounds, candidate.bounds));
}

function hasCoveredChatWindow(visibleWindows: DesktopWindowModel[]): boolean {
  return visibleWindows.some((windowModel) => windowModel.kind === 'chat' && isWindowCoveredByHigherWindow(windowModel, visibleWindows));
}

function hasCompetingWindowedSurface(visibleWindows: DesktopWindowModel[]): boolean {
  return visibleWindows.length > 1;
}

function constrainWindowCollectionBounds<T extends { bounds: WindowBounds }>(windows: T[], desktop: DesktopRect): T[] {
  let changed = false;
  const next = windows.map((windowModel) => {
    const bounds = constrainWindowBounds(windowModel.bounds, desktop);
    if (sameBounds(windowModel.bounds, bounds)) return windowModel;
    changed = true;
    return { ...windowModel, bounds };
  });
  return changed ? next : windows;
}

function constrainRestoreBounds(boundsByWindow: Record<string, WindowBounds>, desktop: DesktopRect): Record<string, WindowBounds> {
  let changed = false;
  const next: Record<string, WindowBounds> = {};
  for (const [windowId, bounds] of Object.entries(boundsByWindow)) {
    const constrained = constrainWindowBounds(bounds, desktop);
    next[windowId] = constrained;
    if (!sameBounds(bounds, constrained)) {
      changed = true;
    }
  }
  return changed ? next : boundsByWindow;
}

function resizeEdgeForPointer(event: MouseEvent, windowElement: HTMLElement): ResizeEdge | null {
  const threshold = 14;
  const rect = windowElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const nearLeft = x <= threshold;
  const nearRight = x >= rect.width - threshold;
  const nearTop = y <= threshold;
  const nearBottom = y >= rect.height - threshold;

  if (nearTop && nearLeft) return 'nw';
  if (nearTop && nearRight) return 'ne';
  if (nearBottom && nearLeft) return 'sw';
  if (nearBottom && nearRight) return 'se';
  if (nearTop) return 'n';
  if (nearRight) return 'e';
  if (nearBottom) return 's';
  if (nearLeft) return 'w';
  return null;
}

function routeLocation(route: string) {
  const url = new URL(route, window.location.origin);
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state: null,
    key: `windowed:${route}`,
  };
}

function routeFromTo(to: To): string {
  return typeof to === 'string' ? to : createPath(to);
}

function routePathname(route: string): string {
  try {
    return new URL(route, window.location.origin).pathname;
  } catch {
    return route.split(/[?#]/, 1)[0] || route;
  }
}

function routeMatchesLauncherItem(route: string, item: LauncherItem): boolean {
  if (item.kind !== 'route') return false;
  const pathname = routePathname(route);
  const itemPathname = routePathname(item.route);
  return pathname === itemPathname || pathname.startsWith(`${itemPathname.replace(/\/$/, '')}/`);
}

function findLauncherItemForRoute(route: string, launcherItems: LauncherItem[]): LauncherItem | null {
  return launcherItems.find((item) => routeMatchesLauncherItem(route, item)) ?? null;
}

function routeWindowMatchesLauncherItem(windowModel: DesktopWindowModel, id: string, item: LauncherItem): boolean {
  return windowModel.kind === 'route' && (windowModel.id === id || routeMatchesLauncherItem(windowModel.route, item));
}

function chatSessionIdForRoute(route: string): string | null {
  const pathname = routePathname(route).replace(/\/+$/, '');
  if (pathname === '/conversations' || pathname === '/conversations/new') return 'draft';
  const match = pathname.match(/^\/conversations\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] ?? '');
  } catch {
    return match[1] ?? null;
  }
}

function isTopLevelRoute(route: string): boolean {
  const pathname = routePathname(route).replace(/\/+$/, '');
  if (!pathname || pathname === '/') return false;
  return pathname.split('/').filter(Boolean).length === 1;
}

function ensureFocusedWindow(windows: DesktopWindowModel[]): DesktopWindowModel[] {
  if (windows.length === 0 || windows.some((windowModel) => windowModel.focused)) return windows;
  let lastVisibleIndex = -1;
  windows.forEach((windowModel, index) => {
    if (!windowModel.minimized) lastVisibleIndex = index;
  });
  const index = lastVisibleIndex >= 0 ? lastVisibleIndex : windows.length - 1;
  return windows.map((windowModel, candidateIndex) => ({ ...windowModel, focused: candidateIndex === index }));
}

function canonicalizeRouteWindows(windows: DesktopWindowModel[], launcherItems: LauncherItem[]): DesktopWindowModel[] {
  let changed = false;
  const next: DesktopWindowModel[] = [];

  for (const windowModel of windows) {
    if (windowModel.kind !== 'route') {
      next.push(windowModel);
      continue;
    }

    const launcherItem = findLauncherItemForRoute(windowModel.route, launcherItems);
    if (!launcherItem) {
      changed = true;
      continue;
    }

    const canonicalId = createId(launcherItem);
    const canonicalWindow: DesktopWindowModel =
      windowModel.id === canonicalId && windowModel.title === launcherItem.title && windowModel.singleton === true
        ? windowModel
        : {
            ...windowModel,
            id: canonicalId,
            title: launcherItem.title,
            singleton: true,
          };
    changed ||= canonicalWindow !== windowModel;

    const existingIndex = next.findIndex((candidate) => candidate.id === canonicalId);
    if (existingIndex >= 0) {
      changed = true;
      const existing = next[existingIndex]!;
      next[existingIndex] = canonicalWindow.focused || !existing.focused ? canonicalWindow : existing;
      continue;
    }

    next.push(canonicalWindow);
  }

  if (!changed) return windows;
  return ensureFocusedWindow(next.length > 0 ? next : [defaultDraftWindow()]);
}

function focusRouteWindowIn(windows: DesktopWindowModel[], route: string, item: LauncherItem): DesktopWindowModel[] {
  const id = createId(item);
  const existing = windows.find((windowModel) => routeWindowMatchesLauncherItem(windowModel, id, item));
  if (existing) {
    return [
      ...windows.filter((windowModel) => windowModel.id !== existing.id).map((windowModel) => ({ ...windowModel, focused: false })),
      { ...existing, id, title: item.title, route, minimized: false, focused: true },
    ];
  }
  const next: DesktopWindowModel = {
    id,
    kind: 'route',
    title: item.title,
    route,
    bounds: defaultBounds(windows.length, 'route'),
    minimized: false,
    focused: true,
    singleton: true,
  };
  return [...windows.map((windowModel) => ({ ...windowModel, focused: false })), next];
}

function focusChatWindowIn(windows: DesktopWindowModel[], route: string, chatSessions: SessionMeta[]): DesktopWindowModel[] {
  const sessionId = chatSessionIdForRoute(route);
  if (!sessionId) return windows;
  const isDraft = sessionId === 'draft';
  const session = isDraft ? null : (chatSessions.find((candidate) => candidate.id === sessionId) ?? null);
  const id = isDraft ? 'chat:draft' : `chat:${sessionId}`;
  const windowRoute = isDraft ? '/conversations/new' : route;
  const existing = windows.find((windowModel) => windowModel.id === id);
  if (existing) {
    const title = session ? conversationWindowTitle(session) : isDraft ? 'New conversation' : existing.title;
    return [
      ...windows.filter((windowModel) => windowModel.id !== id).map((windowModel) => ({ ...windowModel, focused: false })),
      { ...existing, title, route: windowRoute, minimized: false, focused: true },
    ];
  }
  const next: DesktopWindowModel = {
    id,
    kind: 'chat',
    title: session ? conversationWindowTitle(session) : isDraft ? 'New conversation' : 'Chat',
    route: windowRoute,
    bounds: defaultBounds(windows.length, 'chat'),
    minimized: false,
    focused: true,
    archivedOnClose: !isDraft,
  };
  return [...windows.map((windowModel) => ({ ...windowModel, focused: false })), next];
}

function retargetChatWindowIn(
  windows: DesktopWindowModel[],
  windowId: string,
  existing: DesktopWindowModel,
  route: string,
  chatSessions: SessionMeta[],
): DesktopWindowModel[] {
  const sessionId = chatSessionIdForRoute(route);
  if (!sessionId) return windows.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, route } : windowModel));

  const isDraft = sessionId === 'draft';
  const session = isDraft ? null : (chatSessions.find((candidate) => candidate.id === sessionId) ?? null);
  const nextId = isDraft ? 'chat:draft' : `chat:${sessionId}`;
  const nextWindow: DesktopWindowModel = {
    ...existing,
    id: nextId,
    route: isDraft ? '/conversations/new' : route,
    title: session ? conversationWindowTitle(session) : isDraft ? 'New conversation' : existing.title,
    archivedOnClose: !isDraft,
  };

  return windows.flatMap((windowModel) => {
    if (windowModel.id === windowId) return [nextWindow];
    if (windowModel.id === nextId) return [];
    return [windowModel];
  });
}

function reconcileChatWindows(windows: DesktopWindowModel[], chatSessions: SessionMeta[]): DesktopWindowModel[] {
  const sessionsById = new Map(chatSessions.map((session) => [session.id, session] as const));
  let changed = false;

  const next = windows.flatMap((windowModel): DesktopWindowModel[] => {
    if (windowModel.kind !== 'chat' || !windowModel.id.startsWith('chat:')) {
      return [windowModel];
    }

    const sessionId = windowModel.id.slice('chat:'.length);
    if (sessionId === 'draft') {
      const draftWindow =
        windowModel.title === 'New conversation' && windowModel.route === '/conversations/new' && windowModel.archivedOnClose === false
          ? windowModel
          : {
              ...windowModel,
              title: 'New conversation',
              route: '/conversations/new',
              archivedOnClose: false,
            };
      changed ||= draftWindow !== windowModel;
      return [draftWindow];
    }

    const session = sessionsById.get(sessionId);
    if (!session) {
      changed = true;
      return [];
    }

    const title = conversationWindowTitle(session);
    const route = `/conversations/${encodeURIComponent(session.id)}`;
    const reconciledWindow =
      windowModel.title === title && windowModel.route === route && windowModel.archivedOnClose === true
        ? windowModel
        : {
            ...windowModel,
            title,
            route,
            archivedOnClose: true,
          };
    changed ||= reconciledWindow !== windowModel;
    return [reconciledWindow];
  });

  if (!changed) return windows;
  return ensureFocusedWindow(next.length > 0 ? next : [defaultDraftWindow()]);
}

function WindowRouteScope({ children, onNavigate, route }: { children: ReactNode; onNavigate: WindowNavigate; route: string }) {
  const location = useMemo(() => routeLocation(route), [route]);
  const navigator = useMemo(
    () => ({
      createHref: routeFromTo,
      go: () => undefined,
      push: (to: To, _state?: unknown, _options?: NavigateOptions) => onNavigate(to),
      replace: (to: To, _state?: unknown, _options?: NavigateOptions) => onNavigate(to),
    }),
    [onNavigate],
  );
  const navigationContext = useMemo(
    () => ({
      basename: '',
      navigator,
      static: false,
      future: { v7_relativeSplatPath: false },
    }),
    [navigator],
  );
  const locationContext = useMemo(
    () => ({
      location,
      navigationType: 'POP' as const,
    }),
    [location],
  );

  return (
    <NavigationContext.Provider value={navigationContext}>
      <LocationContext.Provider value={locationContext}>{children}</LocationContext.Provider>
    </NavigationContext.Provider>
  );
}

function WindowRouteBody({ onNavigate, route }: { onNavigate: WindowNavigate; route: string }) {
  const isChatRoute = route.startsWith('/conversations');

  if (!isChatRoute) {
    return (
      <div className="wos-window-route-body wos-window-route-body--extension">
        <WindowRouteScope route={route} onNavigate={onNavigate}>
          <Routes>
            <Route path="*" element={<ExtensionRouteHost shellPresentation="windowed" />} />
          </Routes>
        </WindowRouteScope>
      </div>
    );
  }

  return (
    <WindowedChatSurface className="wos-window-route-body wos-window-route-body--chat">
      <WindowRouteScope route={route} onNavigate={onNavigate}>
        <Routes>
          <Route path="/" element={<Layout embeddedWindowChrome forceWorkbench />}>
            <Route
              path="conversations"
              element={
                <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
                  <ConversationPage key="draft" draft />
                </Suspense>
              }
            />
            <Route
              path="conversations/new"
              element={
                <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
                  <ConversationPage key="draft" draft />
                </Suspense>
              }
            />
            <Route
              path="conversations/:id"
              element={
                <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
                  <ConversationPage />
                </Suspense>
              }
            />
            <Route path="*" element={<ExtensionRouteHost shellPresentation="windowed" />} />
          </Route>
        </Routes>
      </WindowRouteScope>
    </WindowedChatSurface>
  );
}

export function WindowedLayout() {
  const extensionRegistry = useExtensionRegistry();
  const conversations = useConversations({ includeArchivedSessions: false });
  const desktopRef = useRef<HTMLElement | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [windows, setWindows] = useState<DesktopWindowModel[]>(() => {
    const stored = readStoredWindows();
    if (stored.length > 0) return stored;
    return [defaultDraftWindow()];
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
  const [browserLayerSettling, setBrowserLayerSettling] = useState(false);
  const [restoreBounds, setRestoreBounds] = useState<Record<string, WindowBounds>>({});

  const launcherItems = useMemo(() => buildLauncherItems(extensionRegistry), [extensionRegistry]);
  const chatSessions = useMemo(
    () => [...conversations.pinnedSessions, ...conversations.tabs],
    [conversations.pinnedSessions, conversations.tabs],
  );
  const chatWindows = windows.filter((windowModel) => windowModel.kind === 'chat');
  const visibleWindows = windows.filter((windowModel) => !windowModel.minimized);
  const focusedWindow = visibleWindows.find((windowModel) => windowModel.focused) ?? null;
  const focusedWindowId = focusedWindow?.id ?? null;
  const visibleWindowSignature = useMemo(
    () =>
      visibleWindows
        .map((windowModel) =>
          [
            windowModel.id,
            windowModel.focused ? 'focused' : 'background',
            windowModel.bounds.x,
            windowModel.bounds.y,
            windowModel.bounds.width,
            windowModel.bounds.height,
          ].join(':'),
        )
        .join('|'),
    [visibleWindows],
  );
  const windowsRef = useRef(windows);

  useEffect(() => {
    suspendWindowedBrowserViews(3000);
  }, []);

  useEffect(() => {
    if (extensionRegistry.loading) return;
    setWindows((current) => {
      return canonicalizeRouteWindows(current, launcherItems);
    });
  }, [extensionRegistry.loading, launcherItems]);

  useEffect(() => {
    writeStoredWindows(windows);
    windowsRef.current = windows;
  }, [windows]);

  const reconcileWindowBounds = useCallback(() => {
    const rect = desktopRect(desktopRef.current);
    setWindows((current) => constrainWindowCollectionBounds(current, rect));
    setRestoreBounds((current) => constrainRestoreBounds(current, rect));
  }, []);

  useEffect(() => {
    reconcileWindowBounds();
    const desktop = desktopRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && desktop ? new ResizeObserver(reconcileWindowBounds) : null;
    if (desktop) {
      observer?.observe(desktop);
    }
    window.addEventListener('resize', reconcileWindowBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reconcileWindowBounds);
    };
  }, [reconcileWindowBounds]);

  useEffect(() => {
    if (!launcherOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (target.closest('.wos-start-menu, .wos-taskbar__start, .wos-taskbar__menu-layer')) return;
      setLauncherOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown, true);
    return () => window.removeEventListener('mousedown', handlePointerDown, true);
  }, [launcherOpen]);

  useEffect(() => {
    if (conversations.loading) return;
    setWindows((current) => reconcileChatWindows(current, chatSessions));
  }, [chatSessions, conversations.loading]);

  const focusWindow = useCallback((windowId: string) => {
    const focusedWindow = windowsRef.current.find((windowModel) => windowModel.focused);
    if (focusedWindow?.id !== windowId) {
      suspendWindowedBrowserViews();
    }
    setWindows((current) => withFocusedWindow(current, windowId));
  }, []);

  const openLauncherItem = useCallback((item: LauncherItem, session?: SessionMeta) => {
    const id = createId(item, session?.id);
    suspendWindowedBrowserViews();
    setLauncherOpen(false);
    setWindows((current) => {
      const existing =
        item.kind === 'route'
          ? current.find((windowModel) => routeWindowMatchesLauncherItem(windowModel, id, item))
          : current.find((windowModel) => windowModel.id === id);
      if (existing) {
        return withFocusedWindow(
          current.map((windowModel) =>
            windowModel.id === existing.id && item.kind === 'route'
              ? { ...windowModel, id, title: item.title, route: item.route }
              : windowModel,
          ),
          id,
        );
      }
      const title = item.kind === 'chat' && session ? conversationWindowTitle(session) : item.title;
      const route = item.kind === 'chat' && session ? `/conversations/${encodeURIComponent(session.id)}` : item.route;
      const next: DesktopWindowModel = {
        id,
        kind: item.kind,
        title,
        route,
        bounds: defaultBounds(current.length, item.kind),
        minimized: false,
        focused: true,
        singleton: item.kind === 'route',
        archivedOnClose: item.kind === 'chat' && Boolean(session?.id),
      };
      return [...current.map((windowModel) => ({ ...windowModel, focused: false })), next];
    });
  }, []);

  const openRouteWindow = useCallback(
    (route: string) => {
      const item = findLauncherItemForRoute(route, launcherItems);
      if (!item) return false;
      suspendWindowedBrowserViews();
      setLauncherOpen(false);
      setWindows((current) => focusRouteWindowIn(current, route, item));
      return true;
    },
    [launcherItems],
  );

  const openChatWindow = useCallback(
    (route: string) => {
      const sessionId = chatSessionIdForRoute(route);
      if (!sessionId) return false;
      suspendWindowedBrowserViews();
      setLauncherOpen(false);
      setWindows((current) => focusChatWindowIn(current, route, chatSessions));
      return true;
    },
    [chatSessions],
  );

  const navigateWindow = useCallback(
    (windowId: string, to: To) => {
      const route = routeFromTo(to);
      setWindows((current) => {
        const existing = current.find((windowModel) => windowModel.id === windowId);
        if (!existing) return current;

        const chatSessionId = chatSessionIdForRoute(route);
        if (chatSessionId && existing.kind !== 'chat') return focusChatWindowIn(current, route, chatSessions);

        const targetLauncherItem = findLauncherItemForRoute(route, launcherItems);
        if (targetLauncherItem) {
          const currentLauncherItem = findLauncherItemForRoute(existing.route, launcherItems);
          if (!currentLauncherItem || currentLauncherItem.id !== targetLauncherItem.id) {
            return focusRouteWindowIn(current, route, targetLauncherItem);
          }
        }

        if (existing.kind !== 'chat') {
          return current.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, route } : windowModel));
        }

        return retargetChatWindowIn(current, windowId, existing, route, chatSessions);
      });
    },
    [chatSessions, launcherItems],
  );

  useEffect(() => {
    const handleDesktopNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ route?: unknown; to?: unknown }>).detail;
      const route = typeof detail?.route === 'string' ? detail.route : typeof detail?.to === 'string' ? detail.to : '';
      if (!route) return;
      openChatWindow(route) || openRouteWindow(route);
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
    };
    window.addEventListener('neon-pilot-desktop-navigate', handleDesktopNavigate, true);
    return () => window.removeEventListener('neon-pilot-desktop-navigate', handleDesktopNavigate, true);
  }, [openChatWindow, openRouteWindow]);

  const closeWindow = useCallback(
    (windowModel: DesktopWindowModel) => {
      suspendWindowedBrowserViews();
      if (windowModel.kind === 'chat' && windowModel.archivedOnClose) {
        const conversationId = windowModel.id.slice('chat:'.length);
        conversations.archiveSession(conversationId);
      }
      setWindows((current) => ensureFocusedWindow(current.filter((candidate) => candidate.id !== windowModel.id)));
    },
    [conversations],
  );

  const minimizeWindow = useCallback((windowId: string) => {
    suspendWindowedBrowserViews();
    setWindows((current) =>
      ensureFocusedWindow(
        current.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, minimized: true, focused: false } : windowModel)),
      ),
    );
  }, []);

  const maximizeWindow = useCallback(
    (windowModel: DesktopWindowModel) => {
      suspendWindowedBrowserViews();
      const rect = desktopRect(desktopRef.current);
      const maximizedBounds = boundsForSnapTarget('maximize', rect);
      const restored = restoreBounds[windowModel.id];

      if (sameBounds(windowModel.bounds, maximizedBounds) && restored) {
        setRestoreBounds((current) => {
          const next = { ...current };
          delete next[windowModel.id];
          return next;
        });
        setWindows((current) =>
          current.map((candidate) => (candidate.id === windowModel.id ? { ...candidate, bounds: restored } : candidate)),
        );
        return;
      }

      setRestoreBounds((current) => ({ ...current, [windowModel.id]: current[windowModel.id] ?? windowModel.bounds }));
      setWindows((current) =>
        current.map((candidate) =>
          candidate.id === windowModel.id ? { ...candidate, bounds: maximizedBounds, minimized: false } : candidate,
        ),
      );
    },
    [restoreBounds],
  );

  const toggleMaximize = useCallback(
    (windowModel: DesktopWindowModel) => {
      suspendWindowedBrowserViews();
      const restored = restoreBounds[windowModel.id];
      if (restored) {
        setRestoreBounds((current) => {
          const next = { ...current };
          delete next[windowModel.id];
          return next;
        });
        setWindows((current) =>
          current.map((candidate) => (candidate.id === windowModel.id ? { ...candidate, bounds: restored } : candidate)),
        );
        return;
      }
      const rect = desktopRect(desktopRef.current);
      setRestoreBounds((current) => ({ ...current, [windowModel.id]: windowModel.bounds }));
      setWindows((current) =>
        current.map((candidate) =>
          candidate.id === windowModel.id ? { ...candidate, bounds: boundsForSnapTarget('maximize', rect) } : candidate,
        ),
      );
    },
    [restoreBounds],
  );

  const startDrag = useCallback(
    (event: MouseEvent, windowModel: DesktopWindowModel) => {
      if (!isPrimaryNativeMouse(event) || event.detail > 1 || (event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      suspendWindowedBrowserViews();
      const pointerInDesktop = (event: MouseEvent) => {
        const rect = desktopRef.current?.getBoundingClientRect();
        return {
          x: event.clientX - (rect?.left ?? 0),
          y: event.clientY - (rect?.top ?? 40),
        };
      };
      const rect = desktopRect(desktopRef.current);
      const restored = restoreBounds[windowModel.id] ?? null;
      const initial = restored
        ? boundsForRestoredDragStart(windowModel.bounds, restored, pointerInDesktop(event), rect)
        : windowModel.bounds;
      focusWindow(windowModel.id);
      if (restored) {
        setRestoreBounds((current) => {
          const next = { ...current };
          delete next[windowModel.id];
          return next;
        });
        setWindows((current) =>
          current.map((candidate) => (candidate.id === windowModel.id ? { ...candidate, bounds: initial } : candidate)),
        );
      }
      const dragState: DragState = {
        windowId: windowModel.id,
        startX: event.clientX,
        startY: event.clientY,
        initial,
      };
      setDrag(dragState);

      const handlePointerMove = (event: MouseEvent) => {
        const rect = desktopRect(desktopRef.current);
        const bounds = constrainWindowBounds(
          {
            ...dragState.initial,
            x: dragState.initial.x + event.clientX - dragState.startX,
            y: dragState.initial.y + event.clientY - dragState.startY,
          },
          rect,
        );
        setSnapTarget(resolveSnapTarget(pointerInDesktop(event), rect));
        setWindows((current) =>
          current.map((windowModel) => (windowModel.id === dragState.windowId ? { ...windowModel, bounds } : windowModel)),
        );
      };

      const handlePointerEnd = (event: MouseEvent) => {
        const rect = desktopRect(desktopRef.current);
        const target = resolveSnapTarget(pointerInDesktop(event), rect);
        setDrag(null);
        setSnapTarget(null);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerEnd);
        if (!target) return;
        const bounds = boundsForSnapTarget(target, rect);
        const releasedBounds = constrainWindowBounds(
          {
            ...dragState.initial,
            x: dragState.initial.x + event.clientX - dragState.startX,
            y: dragState.initial.y + event.clientY - dragState.startY,
          },
          rect,
        );
        setRestoreBounds((current) => ({ ...current, [dragState.windowId]: releasedBounds }));
        setWindows((current) =>
          current.map((windowModel) => (windowModel.id === dragState.windowId ? { ...windowModel, bounds } : windowModel)),
        );
      };

      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerEnd);
    },
    [focusWindow, restoreBounds],
  );

  const startResize = useCallback(
    (event: MouseEvent, windowModel: DesktopWindowModel, edge: ResizeEdge) => {
      if (!isPrimaryNativeMouse(event)) return;
      event.stopPropagation();
      event.preventDefault();
      suspendWindowedBrowserViews();
      focusWindow(windowModel.id);
      setRestoreBounds((current) => {
        if (!current[windowModel.id]) return current;
        const next = { ...current };
        delete next[windowModel.id];
        return next;
      });
      const resizeState: ResizeState = {
        windowId: windowModel.id,
        startX: event.clientX,
        startY: event.clientY,
        initial: windowModel.bounds,
        edge,
      };
      setResize(resizeState);

      const handlePointerMove = (event: MouseEvent) => {
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        const next = { ...resizeState.initial };
        if (resizeState.edge.includes('e')) next.width = Math.max(MIN_WINDOW_WIDTH, resizeState.initial.width + dx);
        if (resizeState.edge.includes('s')) next.height = Math.max(MIN_WINDOW_HEIGHT, resizeState.initial.height + dy);
        if (resizeState.edge.includes('w')) {
          const proposedWidth = Math.max(MIN_WINDOW_WIDTH, resizeState.initial.width - dx);
          next.x = resizeState.initial.x + resizeState.initial.width - proposedWidth;
          next.width = proposedWidth;
        }
        if (resizeState.edge.includes('n')) {
          const proposedHeight = Math.max(MIN_WINDOW_HEIGHT, resizeState.initial.height - dy);
          next.y = resizeState.initial.y + resizeState.initial.height - proposedHeight;
          next.height = proposedHeight;
        }
        setWindows((current) =>
          current.map((windowModel) =>
            windowModel.id === resizeState.windowId
              ? { ...windowModel, bounds: constrainWindowBounds(next, desktopRect(desktopRef.current)) }
              : windowModel,
          ),
        );
      };

      const handlePointerEnd = () => {
        setResize(null);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerEnd);
      };

      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerEnd);
    },
    [focusWindow],
  );

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const windowElement = target.closest<HTMLElement>('.wos-window');
      const windowId = windowElement?.dataset.windowId;
      const windowModel = windowId ? windowsRef.current.find((candidate) => candidate.id === windowId) : null;
      if (!windowModel) return;
      if (target.closest('.wos-window__controls button')) return;

      const resizeHandle = target.closest<HTMLElement>('.wos-resize-handle');
      const edge = (resizeHandle?.dataset.resizeEdge as ResizeEdge | undefined) ?? resizeEdgeForPointer(event, windowElement);
      if (edge) {
        startResize(event, windowModel, edge);
        return;
      }

      if (target.closest('.wos-window__titlebar')) {
        startDrag(event, windowModel);
      }
    };
    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest('button')) return;
      const titlebar = target.closest<HTMLElement>('.wos-window__titlebar');
      const windowElement = target.closest<HTMLElement>('.wos-window');
      const windowId = titlebar && windowElement?.dataset.windowId;
      const windowModel = windowId ? windowsRef.current.find((candidate) => candidate.id === windowId) : null;
      if (!windowModel) return;
      event.preventDefault();
      maximizeWindow(windowModel);
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('dblclick', handleDoubleClick, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('dblclick', handleDoubleClick, true);
    };
  }, [maximizeWindow, startDrag, startResize]);

  useEffect(() => {
    if (!launcherOpen && !drag && !resize && !snapTarget) return;
    suspendWindowedBrowserViews();
  }, [drag, launcherOpen, resize, snapTarget]);

  const browserBlockedByWindowStack = hasCoveredChatWindow(visibleWindows) || hasCompetingWindowedSurface(visibleWindows);

  const nativeBrowserBlocked = Boolean(
    launcherOpen || drag || resize || snapTarget || browserLayerSettling || browserBlockedByWindowStack || focusedWindow?.kind === 'route',
  );

  useWindowedBrowserSuppression(nativeBrowserBlocked);

  useEffect(() => {
    if (!visibleWindowSignature) return;
    setBrowserLayerSettling(true);
    suspendWindowedBrowserViews();
    const settleTimer = window.setTimeout(() => setBrowserLayerSettling(false), WINDOWED_BROWSER_SETTLE_MS);
    return () => window.clearTimeout(settleTimer);
  }, [visibleWindowSignature]);

  const snapPreview = snapTarget ? boundsForSnapTarget(snapTarget, desktopRect(desktopRef.current)) : null;
  const browserBlockingShellInteraction = Boolean(
    launcherOpen || drag || resize || snapPreview || browserLayerSettling || browserBlockedByWindowStack,
  );
  const startMenuItems = launcherItems.map(
    (item): StartMenuItem => ({
      id: item.id,
      title: item.title,
      accent: accentForTitle(item.title),
      onSelect: () => openLauncherItem(item),
    }),
  );
  const routeTaskItems = windows
    .filter((windowModel) => windowModel.kind !== 'chat')
    .map(
      (windowModel): TaskbarItem => ({
        id: windowModel.id,
        title: windowModel.title,
        focused: windowModel.focused,
        minimized: windowModel.minimized,
        accent: accentForTitle(windowModel.title),
        onSelect: () => focusWindow(windowModel.id),
      }),
    );
  const chatTaskItems = chatWindows.map(
    (windowModel): TaskbarItem => ({
      id: windowModel.id,
      title: windowModel.title,
      focused: windowModel.focused,
      minimized: windowModel.minimized,
      accent: 'chat',
      onSelect: () => focusWindow(windowModel.id),
    }),
  );
  const shouldGroupChatTaskItems = chatTaskItems.length > 1;
  const chatTaskGroups: TaskbarGroup[] = shouldGroupChatTaskItems
    ? [
        {
          id: 'chat',
          title: 'Chat',
          focused: chatTaskItems.some((item) => item.focused),
          count: chatTaskItems.length,
          accent: 'chat',
          onSelect: () => {
            const focusedChat = chatTaskItems.find((item) => item.focused);
            (focusedChat ?? chatTaskItems[0])?.onSelect();
          },
          menu: (
            <WindowedMenuPanel
              ariaLabel="Open chat windows"
              items={chatTaskItems.map((item) => ({
                id: item.id,
                label: item.title,
                onSelect: item.onSelect,
              }))}
            />
          ),
        },
      ]
    : [];
  const taskbarItems = shouldGroupChatTaskItems ? routeTaskItems : [...chatTaskItems, ...routeTaskItems];

  return (
    <div
      className="windowed-os-shell h-screen overflow-hidden"
      data-focused-window-id={focusedWindowId ?? undefined}
      data-window-interaction={browserBlockingShellInteraction ? 'true' : undefined}
      data-native-browser-blocked={nativeBrowserBlocked ? 'true' : undefined}
    >
      <StartMenu open={launcherOpen} items={startMenuItems} onClose={() => setLauncherOpen(false)} />
      <main ref={desktopRef} className="wos-desktop" aria-label="Windowed Neon Pilot desktop">
        {snapPreview ? <div className="wos-snap-preview" style={boundsStyle(snapPreview)} aria-hidden="true" /> : null}
        {visibleWindows.map((windowModel, index) => (
          <WindowFrame
            key={windowModel.id}
            windowId={windowModel.id}
            title={windowModel.title}
            accent={accentForWindow(windowModel)}
            focused={windowModel.focused}
            style={{ ...boundsStyle(windowModel.bounds), zIndex: 10 + index }}
            iframeBlocked={nativeBrowserBlocked || isWindowCoveredByHigherWindow(windowModel, visibleWindows)}
            onPointerDown={() => focusWindow(windowModel.id)}
            onMinimize={() => minimizeWindow(windowModel.id)}
            onMaximize={() => toggleMaximize(windowModel)}
            onClose={() => closeWindow(windowModel)}
            restoreLabel={restoreBounds[windowModel.id] ? `Restore ${windowModel.title}` : `Maximize ${windowModel.title}`}
            resizeHandles={(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
              <div key={edge} className={`wos-resize-handle wos-resize-${edge}`} data-resize-edge={edge} aria-hidden="true" />
            ))}
          >
            <WindowRouteBody route={windowModel.route} onNavigate={(to) => navigateWindow(windowModel.id, to)} />
          </WindowFrame>
        ))}
      </main>
      <Taskbar
        startOpen={launcherOpen}
        onToggleStart={() => {
          suspendWindowedBrowserViews();
          setLauncherOpen((open) => !open);
        }}
        onOpenGroupMenu={() => suspendWindowedBrowserViews()}
        groups={chatTaskGroups}
        items={taskbarItems}
      />
    </div>
  );
}
