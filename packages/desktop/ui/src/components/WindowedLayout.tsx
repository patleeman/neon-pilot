import {
  type AppAccent,
  CANONICAL_WINDOWED_APP_SIZES,
  CANONICAL_WINDOWED_DESKTOP_APPS,
  StartMenu,
  type StartMenuItem,
  Taskbar,
  type TaskbarGroup,
  type TaskbarItem,
  WindowedChatSurface,
  WindowedChatToolLauncher,
  type WindowedChatToolLauncherItem,
  WindowedChildWindowEmptyState,
  WindowedMenuPanel,
  WindowedSegmentedControl,
  WindowedStateBlock,
  WindowFrame,
} from '@neon-pilot/windowed-os-ui';
import {
  type ContextType,
  type CSSProperties,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createPath,
  type NavigateOptions,
  NavigationType,
  Route,
  Routes,
  type To,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';

import { getDesktopBridge } from '../desktop/desktopBridge';
import { ExtensionRouteHost } from '../extensions/ExtensionRouteHost';
import { NativeExtensionSurfaceHost } from '../extensions/NativeExtensionSurfaceHost';
import { TopBarElementHost } from '../extensions/TopBarElementHost';
import { type ExtensionSurfaceSummary, type NativeExtensionViewSummary } from '../extensions/types';
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
  readWindowedOsTheme,
  resolveSnapTarget,
  resolveWindowedOsTheme,
  resolveWindowedOsThemePhase,
  resolveWindowedOsThemePhaseInfo,
  type SnapTarget,
  type WindowBounds,
  WINDOWED_OS_THEME_CHANGED_EVENT,
  WINDOWED_OS_THEME_OPTIONS,
  WINDOWED_OS_THEME_STORAGE_KEY,
  type WindowedOsTheme,
  type WindowedOsThemePhase,
  writeWindowedOsTheme,
} from '../ui-state/windowedShell';
import { dispatchWindowedParentWindowLifecycle } from '../windowed/windowedChildWindowEvents';
import { DRAFT_WORKSPACE_PICKER_TOGGLE_COMMAND_EVENT } from './conversation/draftWorkspacePickerCommands';
import { Layout } from './Layout';
import { WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, type WindowedShellBrowserSuspendDetail } from './workbench/workbenchBrowserEvents';

type WindowKind = 'chat' | 'route' | 'terminal' | 'browser' | 'files';
type ChildWindowKind = 'terminal' | 'browser' | 'files';
type LauncherWindowKind = 'chat' | 'route';

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
  workbenchCollapsed?: boolean;
  workspaceCwd?: string | null;
  parentWindowId?: string;
  parentWindowTitle?: string;
  parentMinimized?: boolean;
}

interface WindowedAppRegistration {
  id: string;
  title: string;
  route: string;
  kind: LauncherWindowKind;
  source: 'core' | 'extension';
  sourceExtensionId?: string;
  accent: AppAccent;
  window: {
    allowMultiple: boolean;
    singleton: boolean;
  };
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
type WindowedChatToolbarIconName = 'browser' | 'files' | 'terminal';

const WINDOW_STATE_STORAGE_KEY = 'pa:windowed-os-shell-windows:v1';
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 260;
const WINDOWED_BROWSER_SETTLE_MS = 1200;
const FALLBACK_TASKBAR_HEIGHT = 44;
const DEFAULT_WINDOW_BOTTOM_GUTTER = 56;
const DEFAULT_CHAT_WORKBENCH_COLLAPSED = true;
const WINDOWED_SHELL_ACTIVE_ATTRIBUTE = 'data-neon-pilot-windowed-shell-active';

const CORE_WINDOWED_APPS: WindowedAppRegistration[] = [
  {
    id: 'chat',
    title: 'Chat',
    route: '/conversations/new',
    kind: 'chat',
    source: 'core',
    accent: 'chat',
    window: { allowMultiple: true, singleton: false },
  },
  {
    id: 'settings',
    title: 'Settings',
    route: '/settings',
    kind: 'route',
    source: 'core',
    accent: 'settings',
    window: { allowMultiple: false, singleton: true },
  },
];

const CANONICAL_WINDOWED_APP_BY_TITLE: ReadonlyMap<string, (typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]> = new Map(
  CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => [app.title, app]),
);
const CANONICAL_LAUNCHER_ORDER: readonly string[] = CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => app.title);
const CANONICAL_WINDOWED_APP_ROUTES: Readonly<Record<(typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]['id'], string>> = {
  chat: '/conversations/new',
  automations: '/automations',
  workflows: '/workflows',
  gateways: '/gateways',
  'ai-gateway': '/ai-gateway',
  'model-arena': '/model-arena',
  routines: '/routines',
  extensions: '/extensions',
  skills: '/skills',
  diagnostics: '/telemetry',
  settings: '/settings',
};
const STABLE_SHELL_ONLY_TOP_BAR_ELEMENTS = new Set(['system-onboarding:onboarding-bootstrap']);

function createId(input: Pick<WindowedAppRegistration, 'kind' | 'route' | 'id'>, suffix?: string): string {
  if (input.kind === 'chat') return `chat:${suffix ?? 'draft'}`;
  return `route:${input.id}`;
}

function idealWindowBounds(kind: LauncherWindowKind, title?: string): { width: number; height: number; x: number; y: number } {
  if (kind === 'chat') {
    return { width: 1180, height: 760, x: 42, y: 34 };
  }
  const size = title ? CANONICAL_WINDOWED_APP_SIZES[title] : undefined;
  return { width: size?.width ?? 1040, height: size?.height ?? 650, x: 112, y: 72 };
}

function defaultBounds(index: number, kind: LauncherWindowKind, title?: string): WindowBounds {
  const desktop =
    typeof window === 'undefined'
      ? { width: 1280, height: 800 }
      : { width: window.innerWidth, height: Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - FALLBACK_TASKBAR_HEIGHT) };
  return defaultBoundsForDesktop(index, kind, desktop, title);
}

function defaultBoundsForDesktop(index: number, kind: LauncherWindowKind, desktop: DesktopRect, title?: string): WindowBounds {
  const ideal = idealWindowBounds(kind, title);
  const width = Math.min(ideal.width, Math.max(MIN_WINDOW_WIDTH, desktop.width - 84));
  const height = Math.min(ideal.height, Math.max(MIN_WINDOW_HEIGHT, desktop.height - 76));
  const maxX = Math.max(0, desktop.width - width - 24);
  const maxY = Math.max(0, desktop.height - height - DEFAULT_WINDOW_BOTTOM_GUTTER);
  const cascadeStep = 34;
  const rowStep = 42;
  const rowDrift = 46;
  const availableCascadeSlots = Math.floor(Math.max(0, Math.min(maxX - ideal.x, maxY - ideal.y)) / cascadeStep) + 1;
  const slotsPerRow = Math.max(1, Math.min(6, availableCascadeSlots));
  const column = index % slotsPerRow;
  const row = Math.floor(index / slotsPerRow);
  return {
    x: Math.min(maxX, ideal.x + column * cascadeStep + row * rowDrift),
    y: Math.min(maxY, ideal.y + column * cascadeStep + row * rowStep),
    width,
    height,
  };
}

function nextDefaultBounds(index: number, kind: LauncherWindowKind, desktopElement: HTMLElement | null, title?: string): WindowBounds {
  return defaultBoundsForDesktop(index, kind, desktopRect(desktopElement), title);
}

function childWindowBounds(parentBounds: WindowBounds, desktop: DesktopRect, kind: ChildWindowKind): WindowBounds {
  const ideal =
    kind === 'browser'
      ? { width: 860, height: 580, x: 72, y: 64 }
      : kind === 'files'
        ? { width: 780, height: 540, x: 64, y: 52 }
        : { width: 760, height: 460, x: 54, y: 58 };
  const width = Math.min(ideal.width, Math.max(MIN_WINDOW_WIDTH, desktop.width - 84));
  const height = Math.min(ideal.height, Math.max(MIN_WINDOW_HEIGHT, desktop.height - 76));
  return constrainWindowBounds(
    {
      x: parentBounds.x + ideal.x,
      y: parentBounds.y + ideal.y,
      width,
      height,
    },
    desktop,
  );
}

function fitWindowBoundsToDesktop(bounds: WindowBounds, desktop: DesktopRect): WindowBounds {
  if (sameBounds(bounds, boundsForSnapTarget('maximize', desktop))) return bounds;
  const width = Math.min(bounds.width, Math.max(MIN_WINDOW_WIDTH, desktop.width - 84));
  const height = Math.min(bounds.height, Math.max(MIN_WINDOW_HEIGHT, desktop.height - 76));
  if (width === bounds.width && height === bounds.height) return bounds;
  return { ...bounds, width, height };
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
    workbenchCollapsed: DEFAULT_CHAT_WORKBENCH_COLLAPSED,
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
        (record.kind !== 'chat' &&
          record.kind !== 'route' &&
          record.kind !== 'terminal' &&
          record.kind !== 'browser' &&
          record.kind !== 'files') ||
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
          workbenchCollapsed: record.workbenchCollapsed === true,
          workspaceCwd: typeof record.workspaceCwd === 'string' ? record.workspaceCwd : null,
          parentWindowId: typeof record.parentWindowId === 'string' ? record.parentWindowId : undefined,
          parentWindowTitle: typeof record.parentWindowTitle === 'string' ? record.parentWindowTitle : undefined,
          parentMinimized: record.parentMinimized === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeStoredWindows(windows: DesktopWindowModel[]): void {
  try {
    window.localStorage.setItem(
      WINDOW_STATE_STORAGE_KEY,
      JSON.stringify(
        windows.filter(
          (windowModel) =>
            windowModel.kind === 'chat' ||
            windowModel.kind === 'route' ||
            (isChildWindowKind(windowModel.kind) && typeof windowModel.parentWindowId === 'string'),
        ),
      ),
    );
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

function isChildWindowKind(kind: WindowKind): kind is ChildWindowKind {
  return kind === 'terminal' || kind === 'browser' || kind === 'files';
}

function isChildWindowForParent(windowModel: DesktopWindowModel, parentWindowId: string): boolean {
  return isChildWindowKind(windowModel.kind) && windowModel.parentWindowId === parentWindowId;
}

function restoreChildWindowsForParent(windows: DesktopWindowModel[], parentWindowId: string): DesktopWindowModel[] {
  const children = windows
    .filter((windowModel) => isChildWindowForParent(windowModel, parentWindowId))
    .map((windowModel) => ({
      ...windowModel,
      minimized: windowModel.parentMinimized ? false : windowModel.minimized,
      focused: false,
      parentMinimized: false,
    }));
  if (children.length === 0) return windows;
  return [...windows.filter((windowModel) => !isChildWindowForParent(windowModel, parentWindowId)), ...children];
}

function minimizeChildWindowsForParent(windows: DesktopWindowModel[], parentWindowId: string): DesktopWindowModel[] {
  return windows.map((windowModel) =>
    isChildWindowForParent(windowModel, parentWindowId)
      ? { ...windowModel, minimized: true, focused: false, parentMinimized: !windowModel.minimized }
      : windowModel,
  );
}

function removeChildWindowsForParent(windows: DesktopWindowModel[], parentWindowId: string): DesktopWindowModel[] {
  return windows.filter((windowModel) => !isChildWindowForParent(windowModel, parentWindowId));
}

function retargetChildWindowForParent(windowModel: DesktopWindowModel, nextParent: DesktopWindowModel): DesktopWindowModel {
  const childKind = windowModel.kind;
  return {
    ...windowModel,
    id: `${nextParent.id}:${childKind}`,
    route: nextParent.route,
    workspaceCwd: nextParent.workspaceCwd ?? null,
    parentWindowId: nextParent.id,
    parentWindowTitle: nextParent.title,
  };
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ') || 'Untitled';
}

function conversationWindowTitle(session: SessionMeta): string {
  return normalizeTitle(session.title ?? 'Chat');
}

function conversationWorkspaceCwd(session: SessionMeta | null): string | null {
  return session?.workspaceCwd || session?.cwd || null;
}

function createExtensionWindowedAppRegistration(input: {
  extensionId: string;
  id: string;
  title: string;
  route: string;
}): WindowedAppRegistration {
  return {
    id: `${input.extensionId}:${input.id}`,
    title: input.title,
    route: input.route,
    kind: 'route',
    source: 'extension',
    sourceExtensionId: input.extensionId,
    accent: accentForTitle(input.title),
    window: { allowMultiple: false, singleton: true },
  };
}

function createCoreWindowedAppRegistration(app: (typeof CANONICAL_WINDOWED_DESKTOP_APPS)[number]): WindowedAppRegistration {
  return {
    id: app.id,
    title: app.title,
    route: CANONICAL_WINDOWED_APP_ROUTES[app.id],
    kind: app.id === 'chat' ? 'chat' : 'route',
    source: 'core',
    accent: app.accent,
    window: { allowMultiple: app.id === 'chat', singleton: app.id !== 'chat' },
  };
}

function buildWindowedAppRegistry(extensionRegistry: ReturnType<typeof useExtensionRegistry>): WindowedAppRegistration[] {
  const [chatApp, settingsApp] = CORE_WINDOWED_APPS;
  const seen = new Set(CORE_WINDOWED_APPS.map((item) => item.route));
  const seenTitles = new Set(CORE_WINDOWED_APPS.map((item) => item.title));
  const dynamic = extensionRegistry.extensions
    .filter((extension) => extension.enabled)
    .flatMap((extension) => {
      const navItems = (extension.contributes?.nav ?? []).flatMap((item): WindowedAppRegistration[] => {
        if (!item.route || seen.has(item.route)) return [];
        seen.add(item.route);
        seenTitles.add(item.label);
        return [createExtensionWindowedAppRegistration({ extensionId: extension.id, id: item.id, title: item.label, route: item.route })];
      });

      const mainViewItems = (extension.contributes?.views ?? []).flatMap((view): WindowedAppRegistration[] => {
        if (view.location !== 'main' || !view.route || !isTopLevelRoute(view.route) || seen.has(view.route)) return [];
        seen.add(view.route);
        seenTitles.add(view.title);
        return [createExtensionWindowedAppRegistration({ extensionId: extension.id, id: view.id, title: view.title, route: view.route })];
      });

      return [...navItems, ...mainViewItems];
    })
    .sort(compareWindowedApps);

  const canonicalFallbacks = CANONICAL_WINDOWED_DESKTOP_APPS.flatMap((app): WindowedAppRegistration[] => {
    if (app.id === 'chat' || app.id === 'settings') return [];
    const route = CANONICAL_WINDOWED_APP_ROUTES[app.id];
    if (seen.has(route) || seenTitles.has(app.title)) return [];
    seen.add(route);
    seenTitles.add(app.title);
    return [createCoreWindowedAppRegistration(app)];
  }).sort(compareWindowedApps);

  return [chatApp!, ...[...dynamic, ...canonicalFallbacks].sort(compareWindowedApps), settingsApp!];
}

function compareWindowedApps(left: WindowedAppRegistration, right: WindowedAppRegistration): number {
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
  if (normalized.includes('drawing') || normalized.includes('excalidraw') || normalized.includes('sketch')) return 'drawing';
  if (normalized.includes('skill')) return 'skills';
  if (normalized.includes('extension')) return 'extensions';
  if (normalized.includes('diagnostic')) return 'diagnostics';
  if (normalized.includes('telemetry') || normalized.includes('run')) return 'telemetry';
  return 'settings';
}

function accentForWindow(windowModel: Pick<DesktopWindowModel, 'kind' | 'title' | 'parentWindowId'>): AppAccent {
  if (isChildWindowKind(windowModel.kind) && windowModel.parentWindowId?.startsWith('chat:')) return 'chat';
  return windowModel.kind === 'chat' ? 'chat' : accentForTitle(windowModel.title);
}

function desktopRect(element: HTMLElement | null): DesktopRect {
  return {
    width: element?.clientWidth || window.innerWidth,
    height: element?.clientHeight || Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - FALLBACK_TASKBAR_HEIGHT),
  };
}

function boundsStyle(bounds: WindowBounds): CSSProperties {
  return {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function windowFrameStyle(windowModel: DesktopWindowModel, visibleWindows: DesktopWindowModel[]): CSSProperties {
  const visibleIndex = visibleWindows.findIndex((candidate) => candidate.id === windowModel.id);
  if (windowModel.minimized) {
    return {
      ...boundsStyle(windowModel.bounds),
      display: 'none',
      zIndex: 0,
    };
  }
  return {
    ...boundsStyle(windowModel.bounds),
    zIndex: 10 + Math.max(visibleIndex, 0),
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

  const hiddenRequest = { visible: false, deactivate: true, destroy: true, windowedShellActive: true } as const;

  void bridge.setWorkbenchBrowserBounds(hiddenRequest).catch(() => undefined);
  for (const sessionKey of sessionKeys) {
    void bridge.setWorkbenchBrowserBounds({ ...hiddenRequest, sessionKey }).catch(() => undefined);
  }
}

function dispatchParentLifecycleForWindow(windowModel: DesktopWindowModel, reason: 'closed' | 'minimized' | 'restored'): void {
  if (windowModel.kind !== 'chat') return;
  dispatchWindowedParentWindowLifecycle({
    parentWindowId: windowModel.id,
    parentWindowKind: windowModel.kind,
    parentWindowTitle: windowModel.title,
    reason,
  });
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

function fallbackRestoreBounds(windowModel: DesktopWindowModel, desktop: DesktopRect): WindowBounds {
  const kind: LauncherWindowKind = windowModel.kind === 'chat' ? 'chat' : 'route';
  return defaultBoundsForDesktop(0, kind, desktop, windowModel.title);
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

function hasOverlappingWindowedSurface(visibleWindows: DesktopWindowModel[]): boolean {
  return visibleWindows.some((windowModel) => isWindowCoveredByHigherWindow(windowModel, visibleWindows));
}

function canHostBrowserFrame(windowModel: DesktopWindowModel): boolean {
  return windowModel.kind === 'chat' || windowModel.kind === 'browser';
}

function canFocusedBrowserChildHostNativeFrame(
  focusedWindow: DesktopWindowModel | null | undefined,
  visibleWindows: DesktopWindowModel[],
  desktop: DesktopRect,
): boolean {
  if (!focusedWindow || focusedWindow.kind !== 'browser') return false;
  return !isWindowCoveredByHigherWindow(focusedWindow, visibleWindows) && !isWindowClippedByDesktop(focusedWindow, desktop);
}

function isWindowClippedByDesktop(windowModel: DesktopWindowModel, desktop: DesktopRect): boolean {
  const { bounds } = windowModel;
  return bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > desktop.width || bounds.y + bounds.height > desktop.height;
}

function hasClippedWindow(visibleWindows: DesktopWindowModel[], desktop: DesktopRect): boolean {
  return visibleWindows.some((windowModel) => isWindowClippedByDesktop(windowModel, desktop));
}

function constrainWindowCollectionBounds<T extends { bounds: WindowBounds }>(windows: T[], desktop: DesktopRect): T[] {
  let changed = false;
  const next = windows.map((windowModel) => {
    const bounds = constrainWindowBounds(fitWindowBoundsToDesktop(windowModel.bounds, desktop), desktop);
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
    const constrained = constrainWindowBounds(fitWindowBoundsToDesktop(bounds, desktop), desktop);
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

function routeMatchesWindowedApp(route: string, app: WindowedAppRegistration): boolean {
  if (app.kind !== 'route') return false;
  const pathname = routePathname(route);
  const appPathname = routePathname(app.route);
  return pathname === appPathname || pathname.startsWith(`${appPathname.replace(/\/$/, '')}/`);
}

function findWindowedAppForRoute(route: string, apps: WindowedAppRegistration[]): WindowedAppRegistration | null {
  return apps.find((app) => routeMatchesWindowedApp(route, app)) ?? null;
}

function routeWindowMatchesWindowedApp(windowModel: DesktopWindowModel, id: string, app: WindowedAppRegistration): boolean {
  return windowModel.kind === 'route' && (windowModel.id === id || routeMatchesWindowedApp(windowModel.route, app));
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

function canonicalizeRouteWindows(windows: DesktopWindowModel[], apps: WindowedAppRegistration[]): DesktopWindowModel[] {
  let changed = false;
  const next: DesktopWindowModel[] = [];

  for (const windowModel of windows) {
    if (windowModel.kind !== 'route') {
      next.push(windowModel);
      continue;
    }

    const app = findWindowedAppForRoute(windowModel.route, apps);
    if (!app) {
      changed = true;
      continue;
    }

    const canonicalId = createId(app);
    const canonicalWindow: DesktopWindowModel =
      windowModel.id === canonicalId && windowModel.title === app.title && windowModel.singleton === app.window.singleton
        ? windowModel
        : {
            ...windowModel,
            id: canonicalId,
            title: app.title,
            singleton: app.window.singleton,
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

function focusRouteWindowIn(
  windows: DesktopWindowModel[],
  route: string,
  app: WindowedAppRegistration,
  desktopElement: HTMLElement | null,
): DesktopWindowModel[] {
  const id = createId(app);
  const existing = windows.find((windowModel) => routeWindowMatchesWindowedApp(windowModel, id, app));
  if (existing) {
    return [
      ...windows.filter((windowModel) => windowModel.id !== existing.id).map((windowModel) => ({ ...windowModel, focused: false })),
      { ...existing, id, title: app.title, route, minimized: false, focused: true },
    ];
  }
  const next: DesktopWindowModel = {
    id,
    kind: 'route',
    title: app.title,
    route,
    bounds: nextDefaultBounds(windows.length, 'route', desktopElement, app.title),
    minimized: false,
    focused: true,
    singleton: true,
  };
  return [...windows.map((windowModel) => ({ ...windowModel, focused: false })), next];
}

function focusChatWindowIn(
  windows: DesktopWindowModel[],
  route: string,
  chatSessions: SessionMeta[],
  desktopElement: HTMLElement | null,
): DesktopWindowModel[] {
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
      { ...existing, title, route: windowRoute, workspaceCwd: conversationWorkspaceCwd(session), minimized: false, focused: true },
    ];
  }
  const next: DesktopWindowModel = {
    id,
    kind: 'chat',
    title: session ? conversationWindowTitle(session) : isDraft ? 'New conversation' : 'Chat',
    route: windowRoute,
    bounds: nextDefaultBounds(windows.length, 'chat', desktopElement),
    minimized: false,
    focused: true,
    archivedOnClose: !isDraft,
    workbenchCollapsed: DEFAULT_CHAT_WORKBENCH_COLLAPSED,
    workspaceCwd: conversationWorkspaceCwd(session),
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
    workbenchCollapsed: existing.kind === 'chat' ? existing.workbenchCollapsed : DEFAULT_CHAT_WORKBENCH_COLLAPSED,
    workspaceCwd: conversationWorkspaceCwd(session),
  };

  return windows.flatMap((windowModel) => {
    if (windowModel.id === windowId) return [nextWindow];
    if (windowModel.id === nextId) return [];
    if (isChildWindowForParent(windowModel, nextId)) return [];
    if (isChildWindowForParent(windowModel, windowId)) return [retargetChildWindowForParent(windowModel, nextWindow)];
    return [windowModel];
  });
}

function reconcileChatWindows(windows: DesktopWindowModel[], chatSessions: SessionMeta[]): DesktopWindowModel[] {
  const sessionsById = new Map(chatSessions.map((session) => [session.id, session] as const));
  let changed = false;

  const next = windows.flatMap((windowModel): DesktopWindowModel[] => {
    if (isChildWindowKind(windowModel.kind)) {
      const parent = windowModel.parentWindowId ? windows.find((candidate) => candidate.id === windowModel.parentWindowId) : null;
      if (!parent || parent.kind !== 'chat') {
        changed = true;
        return [];
      }
      const route = parent.route;
      const workspaceCwd = parent.workspaceCwd ?? null;
      const parentWindowTitle = parent.title;
      const reconciledWindow =
        windowModel.route === route &&
        windowModel.workspaceCwd === workspaceCwd &&
        windowModel.parentWindowTitle === parentWindowTitle &&
        windowModel.id === `${parent.id}:${windowModel.kind}`
          ? windowModel
          : {
              ...windowModel,
              id: `${parent.id}:${windowModel.kind}`,
              route,
              workspaceCwd,
              parentWindowTitle,
            };
      changed ||= reconciledWindow !== windowModel;
      return [reconciledWindow];
    }

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
    const workspaceCwd = conversationWorkspaceCwd(session);
    const reconciledWindow =
      windowModel.title === title &&
      windowModel.route === route &&
      windowModel.archivedOnClose === true &&
      windowModel.workspaceCwd === workspaceCwd
        ? windowModel
        : {
            ...windowModel,
            title,
            route,
            archivedOnClose: true,
            workspaceCwd,
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
  const locationContext = useMemo<ContextType<typeof LocationContext>>(
    () => ({
      location,
      navigationType: NavigationType.Pop,
    }),
    [location],
  );

  return (
    <NavigationContext.Provider value={navigationContext}>
      <LocationContext.Provider value={locationContext}>{children}</LocationContext.Provider>
    </NavigationContext.Provider>
  );
}

function WindowedChatTerminalWindowBody({
  cwd,
  parentWindowId,
  parentWindowTitle,
  route,
}: {
  cwd?: string | null;
  parentWindowId: string;
  parentWindowTitle: string;
  route: string;
}) {
  const extensionRegistry = useExtensionRegistry();
  const routeLocationValue = useMemo(() => routeLocation(route), [route]);
  const terminalSurface = useMemo(() => findTerminalSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);

  return (
    <div
      className="wos-chat-terminal-dialog__body"
      data-windowed-subwindow="terminal"
      data-parent-window-attached="chat"
      data-parent-window-id={parentWindowId}
      data-parent-window-title={parentWindowTitle}
    >
      {terminalSurface ? (
        <NativeExtensionSurfaceHost
          surface={terminalSurface}
          pathname={routeLocationValue.pathname}
          search={routeLocationValue.search}
          hash={routeLocationValue.hash}
          shellPresentation="windowed"
          cwd={cwd}
          instanceId={`${parentWindowId}:terminal`}
        />
      ) : (
        <WindowedChildWindowEmptyState title="Terminal unavailable">The Terminal app is not registered.</WindowedChildWindowEmptyState>
      )}
    </div>
  );
}

type WorkbenchToolSurfaceList = readonly ExtensionSurfaceSummary[];

function isNativeToolSurface(surface: ExtensionSurfaceSummary): boolean {
  const record = surface as Record<string, unknown>;
  const component = record.component;
  const hostComponent = component && typeof component === 'object' ? (component as { host?: unknown }).host : undefined;
  return (
    typeof record.extensionId === 'string' &&
    typeof record.id === 'string' &&
    typeof record.location === 'string' &&
    (typeof component === 'string' || typeof hostComponent === 'string')
  );
}

function nativeSurfaceToolSlot(surface: ExtensionSurfaceSummary): string | undefined {
  const record = surface as Record<string, unknown>;
  return typeof record.toolSlot === 'string' ? record.toolSlot : undefined;
}

function findNativeToolSurfaceBySlot(surfaces: WorkbenchToolSurfaceList, slot: string): NativeExtensionViewSummary | null {
  const surface = surfaces.find((candidate) => isNativeToolSurface(candidate) && nativeSurfaceToolSlot(candidate) === slot);
  return surface ? (surface as unknown as NativeExtensionViewSummary) : null;
}

function findTerminalSurface(surfaces: WorkbenchToolSurfaceList): NativeExtensionViewSummary | null {
  return findNativeToolSurfaceBySlot(surfaces, 'terminal');
}

function findFilesSurface(surfaces: WorkbenchToolSurfaceList): NativeExtensionViewSummary | null {
  return findNativeToolSurfaceBySlot(surfaces, 'files');
}

function findBrowserSurface(surfaces: WorkbenchToolSurfaceList): NativeExtensionViewSummary | null {
  const surface = surfaces.find((candidate) => {
    if (!isNativeToolSurface(candidate)) return false;
    const record = candidate as Record<string, unknown>;
    return (
      candidate.extensionId === 'system-browser' && (candidate.id === 'browser-workbench' || record.component === 'BrowserWorkbenchPanel')
    );
  });
  return surface ? (surface as unknown as NativeExtensionViewSummary) : findNativeToolSurfaceBySlot(surfaces, 'browser');
}

function WindowedChatFilesWindowBody({
  cwd,
  parentWindowId,
  parentWindowTitle,
  route,
}: {
  cwd?: string | null;
  parentWindowId: string;
  parentWindowTitle: string;
  route: string;
}) {
  const extensionRegistry = useExtensionRegistry();
  const routeLocationValue = useMemo(() => routeLocation(route), [route]);
  const filesSurface = useMemo(() => findFilesSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);

  return (
    <div
      className="wos-chat-files-dialog__body"
      data-windowed-subwindow="files"
      data-parent-window-attached="chat"
      data-parent-window-id={parentWindowId}
      data-parent-window-title={parentWindowTitle}
    >
      {filesSurface ? (
        <NativeExtensionSurfaceHost
          surface={filesSurface}
          pathname={routeLocationValue.pathname}
          search={routeLocationValue.search}
          hash={routeLocationValue.hash}
          shellPresentation="windowed"
          cwd={cwd}
          instanceId={`${parentWindowId}:files`}
        />
      ) : (
        <WindowedChildWindowEmptyState title="Files unavailable">The Files app is not registered.</WindowedChildWindowEmptyState>
      )}
    </div>
  );
}

function WindowedChatBrowserWindowBody({
  parentWindowId,
  parentWindowTitle,
  route,
}: {
  parentWindowId: string;
  parentWindowTitle: string;
  route: string;
}) {
  const extensionRegistry = useExtensionRegistry();
  const routeLocationValue = useMemo(() => routeLocation(route), [route]);
  const browserSurface = useMemo(() => findBrowserSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);

  return (
    <div
      className="wos-chat-browser-dialog__body"
      data-windowed-subwindow="browser"
      data-parent-window-attached="chat"
      data-parent-window-id={parentWindowId}
      data-parent-window-title={parentWindowTitle}
    >
      {browserSurface ? (
        <NativeExtensionSurfaceHost
          surface={browserSurface}
          pathname={routeLocationValue.pathname}
          search={routeLocationValue.search}
          hash={routeLocationValue.hash}
          shellPresentation="windowed"
          instanceId={`${parentWindowId}:browser`}
        />
      ) : (
        <WindowedChildWindowEmptyState title="Browser unavailable">The Browser app is not registered.</WindowedChildWindowEmptyState>
      )}
    </div>
  );
}

function WindowedChatToolbarIcon({ name }: { name: WindowedChatToolbarIconName }) {
  const paths: Record<WindowedChatToolbarIconName, ReactNode> = {
    browser: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14" />
        <path d="M12 5a10 10 0 0 1 0 14" />
        <path d="M12 5a10 10 0 0 0 0 14" />
      </>
    ),
    files: (
      <>
        <path d="M4 7h6l2 2h8v9H4z" />
        <path d="M4 7v11" />
        <path d="M8 13h8" />
        <path d="M8 16h5" />
      </>
    ),
    terminal: (
      <>
        <path d="m6 8 4 4-4 4" />
        <path d="M12 16h6" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function WindowRouteBody({
  compact = false,
  workspaceCwd,
  onOpenBrowserWindow,
  onOpenFilesWindow,
  onNavigate,
  onOpenTerminalWindow,
  route,
}: {
  compact?: boolean;
  workspaceCwd?: string | null;
  onOpenBrowserWindow: () => void;
  onOpenFilesWindow: () => void;
  onNavigate: WindowNavigate;
  onOpenTerminalWindow: () => void;
  route: string;
}) {
  const isChatRoute = route.startsWith('/conversations');
  const extensionRegistry = useExtensionRegistry();
  const browserSurface = useMemo(() => findBrowserSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);
  const filesSurface = useMemo(() => findFilesSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);
  const terminalSurface = useMemo(() => findTerminalSurface(extensionRegistry.surfaces), [extensionRegistry.surfaces]);
  const browserUnavailable = extensionRegistry.loading || !browserSurface;
  const filesUnavailable = extensionRegistry.loading || !filesSurface;
  const terminalUnavailable = extensionRegistry.loading || !terminalSurface;
  const workspaceStatusDetail = workspaceCwd?.trim() ? workspaceCwd : 'No workspace';
  const handleWorkspaceStatusSelect = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(DRAFT_WORKSPACE_PICKER_TOGGLE_COMMAND_EVENT));
  }, []);
  const toolLauncherItems = useMemo<WindowedChatToolLauncherItem[]>(
    () => [
      {
        id: 'browser',
        label: 'Open Browser window',
        icon: <WindowedChatToolbarIcon name="browser" />,
        disabled: browserUnavailable,
        title: extensionRegistry.loading
          ? 'Loading tools.'
          : browserSurface
            ? 'Open Browser window'
            : 'Enable the Browser app to open a Browser window.',
        onSelect: onOpenBrowserWindow,
      },
      {
        id: 'files',
        label: 'Open Files window',
        icon: <WindowedChatToolbarIcon name="files" />,
        disabled: filesUnavailable,
        title: extensionRegistry.loading
          ? 'Loading tools.'
          : filesSurface
            ? 'Open Files window'
            : 'Enable the Files app to open a Files window.',
        onSelect: onOpenFilesWindow,
      },
      {
        id: 'terminal',
        label: 'Open Terminal window',
        icon: <WindowedChatToolbarIcon name="terminal" />,
        disabled: terminalUnavailable,
        title: extensionRegistry.loading
          ? 'Loading tools.'
          : terminalSurface
            ? 'Open Terminal window'
            : 'Enable the Terminal app to open a Terminal window.',
        onSelect: onOpenTerminalWindow,
      },
    ],
    [
      browserSurface,
      browserUnavailable,
      extensionRegistry.loading,
      filesSurface,
      filesUnavailable,
      onOpenBrowserWindow,
      onOpenFilesWindow,
      onOpenTerminalWindow,
      terminalSurface,
      terminalUnavailable,
    ],
  );

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
    <WindowedChatSurface
      className="wos-window-route-body wos-window-route-body--chat"
      data-compact={compact ? 'true' : undefined}
      data-workbench-collapsed="true"
    >
      <WindowedChatToolLauncher
        items={toolLauncherItems}
        statusLabel="Chat"
        statusDetail={workspaceStatusDetail}
        statusTitle={workspaceCwd?.trim() ? 'Change workspace' : 'Choose workspace'}
        onStatusSelect={handleWorkspaceStatusSelect}
      />
      <WindowRouteScope route={route} onNavigate={onNavigate}>
        <Routes>
          <Route path="/" element={<Layout embeddedWindowChrome forceWorkbench={false} suppressWorkbench />}>
            <Route
              path="conversations"
              element={
                <Suspense fallback={<WindowedRouteLoading label="Loading conversation" />}>
                  <ConversationPage key="draft" draft embeddedWindowChrome />
                </Suspense>
              }
            />
            <Route
              path="conversations/new"
              element={
                <Suspense fallback={<WindowedRouteLoading label="Loading conversation" />}>
                  <ConversationPage key="draft" draft embeddedWindowChrome />
                </Suspense>
              }
            />
            <Route
              path="conversations/:id"
              element={
                <Suspense fallback={<WindowedRouteLoading label="Loading conversation" />}>
                  <ConversationPage embeddedWindowChrome />
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

function WindowedRouteLoading({ label }: { label: string }) {
  return (
    <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label={label}>
      <WindowedStateBlock title={label}>Preparing the window contents.</WindowedStateBlock>
    </div>
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
  const [windowedTheme, setWindowedTheme] = useState<WindowedOsTheme>(() => readWindowedOsTheme());
  const [windowedThemePhase, setWindowedThemePhase] = useState<WindowedOsThemePhase>(() => resolveWindowedOsThemePhase());

  const windowedApps = useMemo(() => buildWindowedAppRegistry(extensionRegistry), [extensionRegistry]);
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
    document.body.setAttribute(WINDOWED_SHELL_ACTIVE_ATTRIBUTE, 'true');
    suspendWindowedBrowserViews(3000);
    return () => {
      document.body.removeAttribute(WINDOWED_SHELL_ACTIVE_ATTRIBUTE);
    };
  }, []);

  useEffect(() => {
    if (windowedTheme !== 'auto') {
      setWindowedThemePhase(resolveWindowedOsThemePhase());
      return undefined;
    }

    let boundaryTimer: number | undefined;
    const refreshThemePhase = () => {
      const phaseInfo = resolveWindowedOsThemePhaseInfo();
      setWindowedThemePhase(phaseInfo.phase);
      if (boundaryTimer !== undefined) {
        window.clearTimeout(boundaryTimer);
      }
      boundaryTimer = window.setTimeout(refreshThemePhase, Math.min(phaseInfo.msUntilNextPhase + 250, 60 * 60 * 1000));
    };
    refreshThemePhase();
    const fallbackTimer = window.setInterval(refreshThemePhase, 5 * 60_000);
    return () => {
      if (boundaryTimer !== undefined) {
        window.clearTimeout(boundaryTimer);
      }
      window.clearInterval(fallbackTimer);
    };
  }, [windowedTheme]);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: WindowedOsTheme }>;
      setWindowedTheme(customEvent.detail?.theme ?? readWindowedOsTheme());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === WINDOWED_OS_THEME_STORAGE_KEY) {
        setWindowedTheme(readWindowedOsTheme());
      }
    };
    window.addEventListener(WINDOWED_OS_THEME_CHANGED_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(WINDOWED_OS_THEME_CHANGED_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (extensionRegistry.loading) return;
    setWindows((current) => {
      return canonicalizeRouteWindows(current, windowedApps);
    });
  }, [extensionRegistry.loading, windowedApps]);

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
    const targetWindow = windowsRef.current.find((windowModel) => windowModel.id === windowId);
    if (focusedWindow?.id !== windowId) {
      suspendWindowedBrowserViews();
    }
    if (targetWindow?.minimized) {
      dispatchParentLifecycleForWindow(targetWindow, 'restored');
    }
    setWindows((current) => {
      const focused = withFocusedWindow(current, windowId);
      return targetWindow?.kind === 'chat' ? restoreChildWindowsForParent(focused, targetWindow.id) : focused;
    });
  }, []);

  const openChildWindow = useCallback((parentWindowId: string, kind: ChildWindowKind) => {
    suspendWindowedBrowserViews();
    setLauncherOpen(false);
    setWindows((current) => {
      const parent = current.find((candidate) => candidate.id === parentWindowId);
      if (!parent) return current;
      if (parent.kind !== 'chat') return current;
      const id = `${parent.id}:${kind}`;
      const existing = current.find((candidate) => candidate.id === id);
      const withCollapsedParent = current.map((windowModel) =>
        windowModel.id === parent.id && windowModel.kind === 'chat' ? { ...windowModel, workbenchCollapsed: true } : windowModel,
      );
      if (existing) {
        return withFocusedWindow(withCollapsedParent, id);
      }
      const next: DesktopWindowModel = {
        id,
        kind,
        title: kind === 'browser' ? 'Browser' : kind === 'files' ? 'Files' : 'Terminal',
        route: parent.route,
        bounds: childWindowBounds(parent.bounds, desktopRect(desktopRef.current), kind),
        minimized: false,
        focused: true,
        workspaceCwd: parent.workspaceCwd ?? null,
        parentWindowId: parent.id,
        parentWindowTitle: parent.title,
      };
      return [...withCollapsedParent.map((windowModel) => ({ ...windowModel, focused: false })), next];
    });
  }, []);

  const openBrowserWindow = useCallback((parentWindowId: string) => openChildWindow(parentWindowId, 'browser'), [openChildWindow]);

  const openFilesWindow = useCallback((parentWindowId: string) => openChildWindow(parentWindowId, 'files'), [openChildWindow]);

  const openTerminalWindow = useCallback(
    (parentWindowId: string) => {
      openChildWindow(parentWindowId, 'terminal');
    },
    [openChildWindow],
  );

  const openWindowedApp = useCallback((app: WindowedAppRegistration, session?: SessionMeta) => {
    const id = createId(app, session?.id);
    const title = app.kind === 'chat' && session ? conversationWindowTitle(session) : app.title;
    const route = app.kind === 'chat' && session ? `/conversations/${encodeURIComponent(session.id)}` : app.route;
    suspendWindowedBrowserViews();
    setLauncherOpen(false);
    setWindows((current) => {
      const existing =
        app.kind === 'route'
          ? current.find((windowModel) => routeWindowMatchesWindowedApp(windowModel, id, app))
          : current.find((windowModel) => windowModel.id === id);
      if (existing) {
        return withFocusedWindow(
          current.map((windowModel) =>
            windowModel.id === existing.id && app.kind === 'route'
              ? { ...windowModel, id, title: app.title, route: app.route }
              : windowModel.id === existing.id && app.kind === 'chat'
                ? { ...windowModel, title, route, workspaceCwd: conversationWorkspaceCwd(session ?? null) }
                : windowModel,
          ),
          id,
        );
      }
      const next: DesktopWindowModel = {
        id,
        kind: app.kind,
        title,
        route,
        bounds: nextDefaultBounds(current.length, app.kind, desktopRef.current, title),
        minimized: false,
        focused: true,
        singleton: app.window.singleton,
        archivedOnClose: app.kind === 'chat' && Boolean(session?.id),
        workbenchCollapsed: app.kind === 'chat' ? DEFAULT_CHAT_WORKBENCH_COLLAPSED : undefined,
        workspaceCwd: app.kind === 'chat' ? conversationWorkspaceCwd(session ?? null) : null,
      };
      return [...current.map((windowModel) => ({ ...windowModel, focused: false })), next];
    });
  }, []);

  const openRouteWindow = useCallback(
    (route: string) => {
      const app = findWindowedAppForRoute(route, windowedApps);
      if (!app) return false;
      suspendWindowedBrowserViews();
      setLauncherOpen(false);
      setWindows((current) => focusRouteWindowIn(current, route, app, desktopRef.current));
      return true;
    },
    [windowedApps],
  );

  const openChatWindow = useCallback(
    (route: string) => {
      const sessionId = chatSessionIdForRoute(route);
      if (!sessionId) return false;
      suspendWindowedBrowserViews();
      setLauncherOpen(false);
      setWindows((current) => focusChatWindowIn(current, route, chatSessions, desktopRef.current));
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
        if (chatSessionId && existing.kind !== 'chat') return focusChatWindowIn(current, route, chatSessions, desktopRef.current);

        const targetApp = findWindowedAppForRoute(route, windowedApps);
        if (targetApp) {
          const currentApp = findWindowedAppForRoute(existing.route, windowedApps);
          if (!currentApp || currentApp.id !== targetApp.id) {
            return focusRouteWindowIn(current, route, targetApp, desktopRef.current);
          }
        }

        if (existing.kind !== 'chat') {
          return current.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, route } : windowModel));
        }

        return retargetChatWindowIn(current, windowId, existing, route, chatSessions);
      });
    },
    [chatSessions, windowedApps],
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

  const closeWindow = useCallback((windowModel: DesktopWindowModel) => {
    suspendWindowedBrowserViews();
    dispatchParentLifecycleForWindow(windowModel, 'closed');
    setRestoreBounds((current) => {
      if (!current[windowModel.id]) return current;
      const next = { ...current };
      delete next[windowModel.id];
      return next;
    });
    setWindows((current) => {
      const withoutClosed = current.filter((candidate) => candidate.id !== windowModel.id);
      const withoutChildren = windowModel.kind === 'chat' ? removeChildWindowsForParent(withoutClosed, windowModel.id) : withoutClosed;
      return ensureFocusedWindow(withoutChildren);
    });
  }, []);

  const minimizeWindow = useCallback((windowId: string) => {
    suspendWindowedBrowserViews();
    const windowModel = windowsRef.current.find((candidate) => candidate.id === windowId);
    if (windowModel) dispatchParentLifecycleForWindow(windowModel, 'minimized');
    setWindows((current) =>
      ensureFocusedWindow(
        minimizeChildWindowsForParent(
          current.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, minimized: true, focused: false } : windowModel)),
          windowModel?.kind === 'chat' ? windowModel.id : '',
        ),
      ),
    );
  }, []);

  const selectTaskbarWindow = useCallback(
    (windowModel: DesktopWindowModel) => {
      if (windowModel.focused && !windowModel.minimized) {
        minimizeWindow(windowModel.id);
        return;
      }
      focusWindow(windowModel.id);
    },
    [focusWindow, minimizeWindow],
  );

  const maximizeWindow = useCallback(
    (windowModel: DesktopWindowModel) => {
      suspendWindowedBrowserViews();
      const rect = desktopRect(desktopRef.current);
      const maximizedBounds = boundsForSnapTarget('maximize', rect);
      const restored = restoreBounds[windowModel.id];

      if (sameBounds(windowModel.bounds, maximizedBounds)) {
        const restoreTarget = restored ?? fallbackRestoreBounds(windowModel, rect);
        setRestoreBounds((current) => {
          const next = { ...current };
          delete next[windowModel.id];
          return next;
        });
        setWindows((current) =>
          current.map((candidate) => (candidate.id === windowModel.id ? { ...candidate, bounds: restoreTarget } : candidate)),
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
      const rect = desktopRect(desktopRef.current);
      const maximizedBounds = boundsForSnapTarget('maximize', rect);
      const restored = restoreBounds[windowModel.id];
      if (restored || sameBounds(windowModel.bounds, maximizedBounds)) {
        const restoreTarget = restored ?? fallbackRestoreBounds(windowModel, rect);
        setRestoreBounds((current) => {
          const next = { ...current };
          delete next[windowModel.id];
          return next;
        });
        setWindows((current) =>
          current.map((candidate) => (candidate.id === windowModel.id ? { ...candidate, bounds: restoreTarget } : candidate)),
        );
        return;
      }
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
        const childWindowIds =
          windowModel.kind === 'chat'
            ? windowsRef.current.filter((candidate) => isChildWindowForParent(candidate, windowModel.id)).map((candidate) => candidate.id)
            : [];
        if (!current[windowModel.id] && !childWindowIds.some((childWindowId) => current[childWindowId])) return current;
        const next = { ...current };
        delete next[windowModel.id];
        for (const childWindowId of childWindowIds) {
          delete next[childWindowId];
        }
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
      if (!windowElement) return;
      const windowId = windowElement.dataset.windowId;
      const windowModel = windowId ? windowsRef.current.find((candidate) => candidate.id === windowId) : null;
      if (!windowModel) return;
      if (target.closest('.wos-window__controls')) return;

      const resizeHandle = target.closest<HTMLElement>('.wos-resize-handle');
      const explicitResizeEdge = resizeHandle?.dataset.resizeEdge as ResizeEdge | undefined;
      if (explicitResizeEdge) {
        startResize(event, windowModel, explicitResizeEdge);
        return;
      }

      if (target.closest('.wos-window__titlebar')) {
        const titlebarEdge = resizeEdgeForPointer(event, windowElement);
        if (titlebarEdge?.includes('n')) {
          startResize(event, windowModel, titlebarEdge);
          return;
        }
        startDrag(event, windowModel);
        return;
      }

      const edge = resizeEdgeForPointer(event, windowElement);
      if (edge) {
        startResize(event, windowModel, edge);
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

  useEffect(() => {
    if (!visibleWindowSignature) return;
    setBrowserLayerSettling(true);
    suspendWindowedBrowserViews();
    const settleTimer = window.setTimeout(() => setBrowserLayerSettling(false), WINDOWED_BROWSER_SETTLE_MS);
    return () => window.clearTimeout(settleTimer);
  }, [visibleWindowSignature]);

  const activeDesktopRect = desktopRect(desktopRef.current);
  const snapPreview = snapTarget ? boundsForSnapTarget(snapTarget, activeDesktopRect) : null;
  const focusedBrowserChildCanHostNativeFrame = canFocusedBrowserChildHostNativeFrame(focusedWindow, visibleWindows, activeDesktopRect);
  const browserBlockedByWindowStack =
    !focusedBrowserChildCanHostNativeFrame &&
    (hasCoveredChatWindow(visibleWindows) ||
      hasOverlappingWindowedSurface(visibleWindows) ||
      hasClippedWindow(visibleWindows, activeDesktopRect));
  const browserBlockingShellInteraction = Boolean(
    launcherOpen || drag || resize || snapPreview || browserLayerSettling || browserBlockedByWindowStack,
  );
  const nativeBrowserBlocked = browserBlockingShellInteraction;
  const rendererFramePaintBlocked = browserBlockingShellInteraction;

  useWindowedBrowserSuppression(nativeBrowserBlocked);
  const startMenuItems = windowedApps.map((app): StartMenuItem => {
    const matchingWindows =
      app.kind === 'chat' ? chatWindows : windows.filter((windowModel) => routeWindowMatchesWindowedApp(windowModel, createId(app), app));
    return {
      id: app.id,
      title: app.title,
      aliases: CANONICAL_WINDOWED_APP_BY_TITLE.get(app.title)?.aliases,
      accent: app.accent,
      count: matchingWindows.length > 1 ? matchingWindows.length : undefined,
      open: matchingWindows.length > 0,
      focused: matchingWindows.some((windowModel) => windowModel.focused && !windowModel.minimized),
      onSelect: () => openWindowedApp(app),
    };
  });
  const routeTaskItems = windows
    .filter((windowModel) => windowModel.kind !== 'chat')
    .map(
      (windowModel): TaskbarItem => ({
        id: windowModel.id,
        title: windowModel.title,
        meta: isChildWindowKind(windowModel.kind) ? windowModel.parentWindowTitle : undefined,
        focused: windowModel.focused,
        minimized: windowModel.minimized,
        accent: accentForWindow(windowModel),
        onSelect: () => selectTaskbarWindow(windowModel),
      }),
    );
  const chatTaskItems = chatWindows.map(
    (windowModel): TaskbarItem => ({
      id: windowModel.id,
      title: windowModel.title,
      focused: windowModel.focused,
      minimized: windowModel.minimized,
      accent: 'chat',
      onSelect: () => selectTaskbarWindow(windowModel),
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
            const focusedIndex = chatTaskItems.findIndex((item) => item.focused);
            const nextIndex = focusedIndex >= 0 ? (focusedIndex + 1) % chatTaskItems.length : 0;
            chatTaskItems[nextIndex]?.onSelect();
          },
          menu: (
            <WindowedMenuPanel
              ariaLabel="Open chat windows"
              items={chatTaskItems.map((item) => ({
                id: item.id,
                label: item.title,
                status: item.minimized ? 'Minimized' : undefined,
                onSelect: () => focusWindow(item.id),
              }))}
            />
          ),
        },
      ]
    : [];
  const taskbarItems = shouldGroupChatTaskItems ? routeTaskItems : [...chatTaskItems, ...routeTaskItems];
  const taskbarTopBarElements = extensionRegistry.topBarElements.filter(
    (element) => !STABLE_SHELL_ONLY_TOP_BAR_ELEMENTS.has(`${element.extensionId}:${element.id}`),
  );
  const themeControl = (
    <WindowedSegmentedControl
      ariaLabel="Windowed OS theme"
      accent="settings"
      className="wos-taskbar-theme-toggle"
      value={windowedTheme}
      options={WINDOWED_OS_THEME_OPTIONS}
      onChange={(value) => {
        const nextTheme: WindowedOsTheme = value === 'dark' || value === 'auto' ? value : 'light';
        setWindowedTheme(nextTheme);
        writeWindowedOsTheme(nextTheme);
      }}
    />
  );
  const taskbarTrailing = (
    <>
      <div className="wos-taskbar__system-controls" aria-label="Taskbar system controls">
        {themeControl}
      </div>
      {taskbarTopBarElements.length > 0 ? (
        <div className="wos-taskbar__extension-actions" aria-label="Taskbar extension actions">
          {taskbarTopBarElements.map((element) => (
            <TopBarElementHost key={`${element.extensionId}:${element.id}`} registration={element} />
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className="windowed-os-shell h-screen overflow-hidden"
      data-wos-theme={resolveWindowedOsTheme(windowedTheme)}
      data-wos-theme-mode={windowedTheme}
      data-wos-theme-phase={windowedThemePhase}
      data-start-menu-open={launcherOpen ? 'true' : undefined}
      data-focused-window-id={focusedWindowId ?? undefined}
      data-window-interaction={browserBlockingShellInteraction ? 'true' : undefined}
      data-native-browser-blocked={nativeBrowserBlocked ? 'true' : undefined}
      data-frame-paint-blocked={rendererFramePaintBlocked ? 'true' : undefined}
    >
      <StartMenu open={launcherOpen} items={startMenuItems} onClose={() => setLauncherOpen(false)} />
      <main
        ref={desktopRef}
        className="wos-desktop"
        aria-label="Windowed Neon Pilot desktop"
        onMouseDown={(event) => {
          if (!launcherOpen || event.target !== event.currentTarget) return;
          setLauncherOpen(false);
        }}
      >
        {snapPreview ? <div className="wos-snap-preview" style={boundsStyle(snapPreview)} aria-hidden="true" /> : null}
        {windows.map((windowModel) => {
          const isTerminalWindow = windowModel.kind === 'terminal';
          const isBrowserWindow = windowModel.kind === 'browser';
          const isFilesWindow = windowModel.kind === 'files';
          const isChildWindow = isChildWindowKind(windowModel.kind);
          return (
            <WindowFrame
              key={windowModel.id}
              windowId={windowModel.id}
              title={windowModel.title}
              accent={accentForWindow(windowModel)}
              parentWindowId={windowModel.parentWindowId}
              parentWindowTitle={windowModel.parentWindowTitle}
              focused={windowModel.focused}
              minimized={windowModel.minimized}
              className={isChildWindow ? `wos-window--child wos-window--${windowModel.kind}` : undefined}
              style={windowFrameStyle(windowModel, visibleWindows)}
              iframeBlocked={
                !windowModel.minimized &&
                canHostBrowserFrame(windowModel) &&
                (rendererFramePaintBlocked || isWindowCoveredByHigherWindow(windowModel, visibleWindows))
              }
              onPointerDown={() => focusWindow(windowModel.id)}
              onMinimize={() => minimizeWindow(windowModel.id)}
              onMaximize={() => toggleMaximize(windowModel)}
              onClose={() => closeWindow(windowModel)}
              restoreLabel={restoreBounds[windowModel.id] ? `Restore ${windowModel.title}` : `Maximize ${windowModel.title}`}
              resizeHandles={(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
                <div key={edge} className={`wos-resize-handle wos-resize-${edge}`} data-resize-edge={edge} aria-hidden="true" />
              ))}
            >
              {isTerminalWindow ? (
                <div className="wos-window-route-body wos-window-route-body--terminal">
                  <WindowedChatTerminalWindowBody
                    cwd={windowModel.workspaceCwd ?? null}
                    parentWindowId={windowModel.parentWindowId ?? ''}
                    parentWindowTitle={windowModel.parentWindowTitle ?? 'Chat'}
                    route={windowModel.route}
                  />
                </div>
              ) : isFilesWindow ? (
                <div className="wos-window-route-body wos-window-route-body--files">
                  <WindowedChatFilesWindowBody
                    cwd={windowModel.workspaceCwd ?? null}
                    parentWindowId={windowModel.parentWindowId ?? ''}
                    parentWindowTitle={windowModel.parentWindowTitle ?? 'Chat'}
                    route={windowModel.route}
                  />
                </div>
              ) : isBrowserWindow ? (
                <div className="wos-window-route-body wos-window-route-body--browser">
                  <WindowedChatBrowserWindowBody
                    parentWindowId={windowModel.parentWindowId ?? ''}
                    parentWindowTitle={windowModel.parentWindowTitle ?? 'Chat'}
                    route={windowModel.route}
                  />
                </div>
              ) : (
                <WindowRouteBody
                  compact={windowModel.kind === 'chat' && windowModel.bounds.width < 720}
                  workspaceCwd={windowModel.kind === 'chat' ? windowModel.workspaceCwd : null}
                  route={windowModel.route}
                  onNavigate={(to) => navigateWindow(windowModel.id, to)}
                  onOpenBrowserWindow={() => openBrowserWindow(windowModel.id)}
                  onOpenFilesWindow={() => openFilesWindow(windowModel.id)}
                  onOpenTerminalWindow={() => openTerminalWindow(windowModel.id)}
                />
              )}
            </WindowFrame>
          );
        })}
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
        trailing={taskbarTrailing}
      />
    </div>
  );
}
