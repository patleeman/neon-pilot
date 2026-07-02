import { type CSSProperties, Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { ExtensionRouteHost } from '../extensions/ExtensionRouteHost';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { useConversations } from '../hooks/useConversations';
import { ConversationPage } from '../pages/ConversationPage';
import type { SessionMeta } from '../shared/types';
import {
  boundsForSnapTarget,
  constrainWindowBounds,
  type DesktopRect,
  resolveSnapTarget,
  type SnapTarget,
  type WindowBounds,
  writeDesktopShellPresentation,
} from '../ui-state/windowedShell';
import { QuietLoadingState } from './ui';

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

const WINDOW_STATE_STORAGE_KEY = 'pa:windowed-shell-windows';
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 260;

const STATIC_LAUNCHER_ITEMS: LauncherItem[] = [
  { id: 'chat', title: 'Chat', route: '/conversations/new', kind: 'chat' },
  { id: 'settings', title: 'Settings', route: '/settings', kind: 'route' },
];

function createId(input: Pick<LauncherItem, 'kind' | 'route' | 'id'>, suffix?: string): string {
  if (input.kind === 'chat') return `chat:${suffix ?? 'draft'}`;
  return `route:${input.id}`;
}

function defaultBounds(index: number, kind: WindowKind): WindowBounds {
  const offset = (index % 7) * 34;
  if (kind === 'chat') {
    return { x: 42 + offset, y: 34 + offset, width: 980, height: 680 };
  }
  return { x: 128 + offset, y: 86 + offset, width: 820, height: 560 };
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
    .flatMap((extension) => extension.contributes?.nav ?? [])
    .filter((item) => {
      if (!item.route || seen.has(item.route)) return false;
      seen.add(item.route);
      return true;
    })
    .map((item) => ({
      id: item.id,
      title: item.label,
      route: item.route,
      kind: 'route' as const,
    }));

  return [STATIC_LAUNCHER_ITEMS[0]!, ...dynamic, STATIC_LAUNCHER_ITEMS[1]!];
}

function desktopRect(element: HTMLElement | null): DesktopRect {
  return { width: element?.clientWidth ?? window.innerWidth, height: element?.clientHeight ?? window.innerHeight };
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

function WindowRouteBody({ route }: { route: string }) {
  return (
    <div className="windowed-shell-route-body">
      <Routes location={routeLocation(route)}>
        <Route
          path="/conversations"
          element={
            <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
              <ConversationPage key="draft" draft />
            </Suspense>
          }
        />
        <Route
          path="/conversations/new"
          element={
            <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
              <ConversationPage key="draft" draft />
            </Suspense>
          }
        />
        <Route
          path="/conversations/:id"
          element={
            <Suspense fallback={<QuietLoadingState label="Loading conversation" />}>
              <ConversationPage />
            </Suspense>
          }
        />
        <Route path="*" element={<ExtensionRouteHost />} />
      </Routes>
    </div>
  );
}

export function WindowedLayout() {
  const extensionRegistry = useExtensionRegistry();
  const conversations = useConversations({ includeArchivedSessions: false });
  const desktopRef = useRef<HTMLElement | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [windows, setWindows] = useState<DesktopWindowModel[]>(() => {
    const stored = readStoredWindows();
    if (stored.length > 0) return stored;
    return [
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: defaultBounds(0, 'chat'),
        minimized: false,
        focused: true,
        archivedOnClose: false,
      },
    ];
  });
  const [, setDrag] = useState<DragState | null>(null);
  const [, setResize] = useState<ResizeState | null>(null);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
  const [restoreBounds, setRestoreBounds] = useState<Record<string, WindowBounds>>({});

  const launcherItems = useMemo(() => buildLauncherItems(extensionRegistry), [extensionRegistry]);
  const chatSessions = useMemo(
    () => [...conversations.pinnedSessions, ...conversations.tabs],
    [conversations.pinnedSessions, conversations.tabs],
  );
  const chatWindows = windows.filter((windowModel) => windowModel.kind === 'chat');
  const visibleWindows = windows.filter((windowModel) => !windowModel.minimized);
  const focusedWindowId = windows.find((windowModel) => windowModel.focused)?.id ?? null;
  const windowsRef = useRef(windows);

  useEffect(() => {
    writeStoredWindows(windows);
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    if (chatSessions.length === 0) return;
    setWindows((current) => {
      const existingIds = new Set(current.map((windowModel) => windowModel.id));
      const additions = chatSessions.flatMap((session, index): DesktopWindowModel[] => {
        const id = createId({ id: 'chat', kind: 'chat', route: `/conversations/${session.id}` }, session.id);
        if (existingIds.has(id)) return [];
        return [
          {
            id,
            kind: 'chat',
            title: conversationWindowTitle(session),
            route: `/conversations/${encodeURIComponent(session.id)}`,
            bounds: defaultBounds(current.length + index, 'chat'),
            minimized: true,
            focused: false,
            archivedOnClose: true,
          },
        ];
      });
      if (additions.length === 0) {
        return current.map((windowModel) => {
          if (windowModel.kind !== 'chat' || !windowModel.id.startsWith('chat:')) return windowModel;
          const sessionId = windowModel.id.slice('chat:'.length);
          const session = chatSessions.find((candidate) => candidate.id === sessionId);
          return session ? { ...windowModel, title: conversationWindowTitle(session) } : windowModel;
        });
      }
      return [...current, ...additions];
    });
  }, [chatSessions]);

  const focusWindow = useCallback((windowId: string) => {
    setWindows((current) => withFocusedWindow(current, windowId));
  }, []);

  const openLauncherItem = useCallback((item: LauncherItem, session?: SessionMeta) => {
    const id = createId(item, session?.id);
    setLauncherOpen(false);
    setChatMenuOpen(false);
    setWindows((current) => {
      const existing = current.find((windowModel) => windowModel.id === id);
      if (existing) return withFocusedWindow(current, id);
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

  const closeWindow = useCallback(
    (windowModel: DesktopWindowModel) => {
      if (windowModel.kind === 'chat' && windowModel.archivedOnClose) {
        const conversationId = windowModel.id.slice('chat:'.length);
        conversations.archiveSession(conversationId);
      }
      setWindows((current) => current.filter((candidate) => candidate.id !== windowModel.id));
    },
    [conversations],
  );

  const minimizeWindow = useCallback((windowId: string) => {
    setWindows((current) =>
      current.map((windowModel) => (windowModel.id === windowId ? { ...windowModel, minimized: true, focused: false } : windowModel)),
    );
  }, []);

  const toggleMaximize = useCallback(
    (windowModel: DesktopWindowModel) => {
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
      if (!isPrimaryNativeMouse(event) || (event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      focusWindow(windowModel.id);
      const dragState: DragState = {
        windowId: windowModel.id,
        startX: event.clientX,
        startY: event.clientY,
        initial: windowModel.bounds,
      };
      setDrag(dragState);

      const pointerInDesktop = (event: MouseEvent) => {
        const rect = desktopRef.current?.getBoundingClientRect();
        return {
          x: event.clientX - (rect?.left ?? 0),
          y: event.clientY - (rect?.top ?? 40),
        };
      };

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
        setWindows((current) =>
          current.map((windowModel) => (windowModel.id === dragState.windowId ? { ...windowModel, bounds } : windowModel)),
        );
      };

      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerEnd);
    },
    [focusWindow],
  );

  const startResize = useCallback(
    (event: MouseEvent, windowModel: DesktopWindowModel, edge: ResizeEdge) => {
      if (!isPrimaryNativeMouse(event)) return;
      event.stopPropagation();
      event.preventDefault();
      focusWindow(windowModel.id);
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
      const windowElement = target.closest<HTMLElement>('.windowed-shell-window');
      const windowId = windowElement?.dataset.windowId;
      const windowModel = windowId ? windowsRef.current.find((candidate) => candidate.id === windowId) : null;
      if (!windowModel) return;

      const resizeHandle = target.closest<HTMLElement>('.windowed-shell-resize-handle');
      const edge = resizeHandle?.dataset.resizeEdge as ResizeEdge | undefined;
      if (edge) {
        startResize(event, windowModel, edge);
        return;
      }

      if (target.closest('.windowed-shell-window-titlebar')) {
        startDrag(event, windowModel);
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    return () => window.removeEventListener('mousedown', handleMouseDown, true);
  }, [startDrag, startResize]);

  const activeChatWindow = chatWindows.find((windowModel) => windowModel.focused) ?? chatWindows[0] ?? null;
  const snapPreview = snapTarget ? boundsForSnapTarget(snapTarget, desktopRect(desktopRef.current)) : null;

  return (
    <div className="windowed-shell h-screen overflow-hidden bg-base text-primary">
      <header className="windowed-shell-topbar">
        <div className="ui-desktop-top-bar__traffic-light-gap" aria-hidden="true" />
        <div
          className="windowed-shell-menu"
          onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setLauncherOpen(false)}
        >
          {/* ui-pattern-ok raw-control reason="Experimental desktop chrome uses native menu buttons so window dragging and task grouping stay independent of shared app command primitives." */}
          <button
            type="button"
            className="windowed-shell-menu-button"
            aria-haspopup="menu"
            aria-expanded={launcherOpen}
            onClick={() => setLauncherOpen((open) => !open)}
          >
            Applications
          </button>
          {launcherOpen ? (
            <div className="windowed-shell-menu-panel" role="menu">
              {launcherItems.map((item) => (
                <Fragment key={item.id}>
                  {/* ui-pattern-ok raw-control reason="Experimental desktop launcher menu uses native menuitem buttons inside delegated window chrome." */}
                  <button type="button" role="menuitem" onClick={() => openLauncherItem(item)}>
                    {item.title}
                  </button>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
        <nav className="windowed-shell-task-strip" aria-label="Open windows">
          <div
            className="windowed-shell-chat-group"
            onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setChatMenuOpen(false)}
          >
            {/* ui-pattern-ok raw-control reason="Experimental desktop task group uses native button chrome to group multiple chat windows." */}
            <button
              type="button"
              className="windowed-shell-task-button"
              data-focused={activeChatWindow?.id === focusedWindowId}
              onClick={() => setChatMenuOpen((open) => !open)}
            >
              Chat {chatWindows.length > 0 ? `(${chatWindows.length})` : ''}
            </button>
            {chatMenuOpen ? (
              <div className="windowed-shell-menu-panel windowed-shell-chat-menu" role="menu">
                {/* ui-pattern-ok raw-control reason="Experimental desktop chat menu uses native menuitem buttons inside delegated window chrome." */}
                <button type="button" role="menuitem" onClick={() => openLauncherItem(STATIC_LAUNCHER_ITEMS[0]!)}>
                  New conversation
                </button>
                {chatSessions.map((session) => (
                  <Fragment key={session.id}>
                    {/* ui-pattern-ok raw-control reason="Experimental desktop chat menu uses native menuitem buttons for per-chat window activation." */}
                    <button type="button" role="menuitem" onClick={() => openLauncherItem(STATIC_LAUNCHER_ITEMS[0]!, session)}>
                      {conversationWindowTitle(session)}
                    </button>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
          {windows
            .filter((windowModel) => windowModel.kind !== 'chat')
            .map((windowModel) => (
              <Fragment key={windowModel.id}>
                {/* ui-pattern-ok raw-control reason="Experimental desktop task strip uses native buttons to restore and focus route windows." */}
                <button
                  type="button"
                  className="windowed-shell-task-button"
                  data-focused={windowModel.focused}
                  data-minimized={windowModel.minimized}
                  onClick={() => focusWindow(windowModel.id)}
                >
                  {windowModel.title}
                </button>
              </Fragment>
            ))}
        </nav>
        {/* ui-pattern-ok raw-control reason="Experimental desktop shell switcher must stay available outside shared route content primitives." */}
        <button
          type="button"
          className="windowed-shell-stable-button"
          onClick={() => {
            writeDesktopShellPresentation('stable');
            window.location.assign('/?shell=stable');
          }}
        >
          Stable shell
        </button>
      </header>
      <main ref={desktopRef} className="windowed-shell-desktop" aria-label="Windowed Neon Pilot desktop">
        {snapPreview ? <div className="windowed-shell-snap-preview" style={boundsStyle(snapPreview)} aria-hidden="true" /> : null}
        {visibleWindows.map((windowModel, index) => (
          <section
            key={windowModel.id}
            className="windowed-shell-window"
            data-window-id={windowModel.id}
            data-focused={windowModel.focused}
            style={{ ...boundsStyle(windowModel.bounds), zIndex: 10 + index }}
            onPointerDown={() => focusWindow(windowModel.id)}
          >
            <header className="windowed-shell-window-titlebar">
              <div className="windowed-shell-window-title" title={windowModel.title}>
                {windowModel.title}
              </div>
              <div className="windowed-shell-window-controls">
                {/* ui-pattern-ok raw-control reason="Experimental desktop titlebar controls use native buttons for compact window chrome semantics." */}
                <button type="button" aria-label={`Minimize ${windowModel.title}`} onClick={() => minimizeWindow(windowModel.id)}>
                  -
                </button>
                {/* ui-pattern-ok raw-control reason="Experimental desktop titlebar controls use native buttons for compact window chrome semantics." */}
                <button
                  type="button"
                  aria-label={restoreBounds[windowModel.id] ? `Restore ${windowModel.title}` : `Maximize ${windowModel.title}`}
                  onClick={() => toggleMaximize(windowModel)}
                >
                  □
                </button>
                {/* ui-pattern-ok raw-control reason="Experimental desktop titlebar controls use native buttons for compact window chrome semantics." */}
                <button type="button" aria-label={`Close ${windowModel.title}`} onClick={() => closeWindow(windowModel)}>
                  ×
                </button>
              </div>
            </header>
            <WindowRouteBody route={windowModel.route} />
            {(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
              <div
                key={edge}
                className={`windowed-shell-resize-handle windowed-shell-resize-${edge}`}
                data-resize-edge={edge}
                aria-hidden="true"
              />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
