import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { api } from '../../client/api';
import {
  DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT,
  type DesktopWorkbenchBrowserCommentTarget,
  type DesktopWorkbenchBrowserState,
  getDesktopBridge,
} from '../../desktop/desktopBridge';
import { setExtensionCommandContext } from '../../extensions/commands';
import { EXTENSION_REGISTRY_CHANGED_EVENT } from '../../extensions/extensionRegistryEvents';
import { findMatchingExtensionKeybinding } from '../../extensions/keybindings';
import type { ExtensionKeybindingRegistration } from '../../extensions/types';
import { type BrowserTabItem, type BrowserTabsState, getTabSessionKey } from '../../local/workbenchBrowserTabs';
import { Button, IconButton, Textarea, TextInput, ToolbarButton } from '../ui';
import { WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, type WindowedShellBrowserSuspendDetail } from './workbenchBrowserEvents';

const WORKBENCH_BROWSER_COMMENT_ADDED_EVENT = 'pa:workbench-browser-comment-added';
export const WORKBENCH_BROWSER_COMMAND_EVENT = 'neon-pilot-workbench-browser-command';
const WORKBENCH_BROWSER_SHORTCUT_COMMANDS = new Set(['browser.newTab', 'browser.reopenTab', 'browser.closeTab', 'browser.focusLocation']);
const WINDOWED_SHELL_BROWSER_SUSPEND_MS = 1500;
const BROWSER_BOUNDS_SYNC_INTERVAL_MS = 1000;
const WINDOWED_BROWSER_BOUNDS_SYNC_INTERVAL_MS = 160;
const TRANSIENT_RENDERER_BLOCKER_SELECTOR = [
  '[aria-modal="true"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '.ui-overlay-backdrop',
  '.ui-dialog-shell',
  '.ui-menu-shell',
  '.ui-context-menu-shell',
  '.ui-positioned-menu',
  '.ui-command-palette-shell',
  '.ui-setup-readiness-popover',
  '.ui-workbench-drop-badge',
  '.ui-workbench-drop-popover',
  '.ui-composer-drop-overlay',
  '.ui-notification-toaster',
  '.ui-page-search-popover',
  '.wos-start-menu',
  '.wos-taskbar__menu-layer',
  '.wos-snap-preview',
  '.wos-dialog-layer',
].join(', ');
const RENDERER_CHROME_BLOCKER_SELECTOR = [TRANSIENT_RENDERER_BLOCKER_SELECTOR, '.wos-taskbar'].join(', ');
const WINDOWED_SHELL_LAYER_SELECTOR = [
  '.wos-start-menu',
  '.wos-taskbar',
  '.wos-taskbar__menu-layer',
  '.wos-snap-preview',
  '.wos-dialog-layer',
].join(', ');

function hasBlockingRendererOverlay(host: HTMLElement | null): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const overlays = Array.from(document.querySelectorAll<HTMLElement>(TRANSIENT_RENDERER_BLOCKER_SELECTOR));

  return overlays.some((element) => {
    if (!isConnectedVisibleElement(element)) {
      return false;
    }
    if (host && element.contains(host)) {
      return false;
    }
    return true;
  });
}

function hasWindowedShellOverlay(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return Boolean(
    document.querySelector(
      `.windowed-os-shell[data-window-interaction="true"], .windowed-os-shell[data-native-browser-blocked="true"], ${TRANSIENT_RENDERER_BLOCKER_SELECTOR}`,
    ),
  );
}

function isConnectedVisibleElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.isConnected && isVisibleStyle(element);
}

function isInsideUnfocusedWindow(host: HTMLElement | null): boolean {
  const windowElement = host?.closest<HTMLElement>('.wos-window');
  return windowElement?.dataset.focused === 'false';
}

function isInsideIframeBlockedWindow(host: HTMLElement | null): boolean {
  const windowElement = host?.closest<HTMLElement>('.wos-window');
  return windowElement?.dataset.iframeBlocked === 'true';
}

function isOutsideFocusedWindowedShellWindow(host: HTMLElement | null): boolean {
  const ownWindow = host?.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest<HTMLElement>('.windowed-os-shell');
  const focusedWindowId = shell?.dataset.focusedWindowId;
  if (!ownWindow || !focusedWindowId) {
    return false;
  }
  return ownWindow.dataset.windowId !== focusedWindowId;
}

function isInsideBackgroundWindowedWindow(host: HTMLElement | null): boolean {
  const ownWindow = host?.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest('.windowed-os-shell');
  if (!host || !ownWindow || !shell) {
    return false;
  }

  const windows = Array.from(shell.querySelectorAll<HTMLElement>('.wos-window')).filter(isVisibleStyle);
  if (windows.length <= 1) {
    return false;
  }

  const focusedWindow = windows.find((candidate) => candidate.dataset.focused === 'true');
  if (focusedWindow) {
    return focusedWindow !== ownWindow;
  }

  const topWindow = windows.reduce((top, candidate) => (windowLayer(candidate) >= windowLayer(top) ? candidate : top), windows[0]!);
  return topWindow !== ownWindow;
}

function hasSiblingWindowedShellWindow(host: HTMLElement | null): boolean {
  const ownWindow = host?.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest('.windowed-os-shell');
  if (!host || !ownWindow || !shell) {
    return false;
  }

  return Array.from(shell.querySelectorAll<HTMLElement>('.wos-window')).some(
    (candidate) => candidate !== ownWindow && isVisibleStyle(candidate),
  );
}

function isBelowTopWindowedShellWindow(host: HTMLElement | null): boolean {
  const ownWindow = host?.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest<HTMLElement>('.windowed-os-shell');
  if (!host || !ownWindow || !shell) {
    return false;
  }

  const windows = Array.from(shell.querySelectorAll<HTMLElement>('.wos-window')).filter(isVisibleStyle);
  if (windows.length <= 1) {
    return false;
  }

  const topLayer = Math.max(...windows.map(windowLayer));
  return windowLayer(ownWindow) < topLayer;
}

function rectsOverlap(first: DOMRect, second: DOMRect): boolean {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}

function isVisibleStyle(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') !== 0;
}

function windowLayer(windowElement: HTMLElement): number {
  const zIndex = Number.parseInt(window.getComputedStyle(windowElement).zIndex, 10);
  return Number.isFinite(zIndex) ? zIndex : 0;
}

function isCoveredByWindowedWindow(host: HTMLElement | null): boolean {
  const ownWindow = host?.closest<HTMLElement>('.wos-window');
  if (!host || !ownWindow) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  const windows = Array.from(document.querySelectorAll<HTMLElement>('.windowed-os-shell .wos-window'));

  return windows.some((candidate) => {
    if (!isVisibleStyle(candidate)) return false;
    if (candidate === ownWindow) return false;
    return rectsOverlap(hostRect, candidate.getBoundingClientRect());
  });
}

function isCoveredByWindowedChrome(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 1 || hostRect.height < 1) {
    return false;
  }

  const chrome = Array.from(document.querySelectorAll(RENDERER_CHROME_BLOCKER_SELECTOR)).filter(isConnectedVisibleElement);

  return chrome.some((element) => {
    if (host.contains(element) || element.contains(host)) {
      return false;
    }
    return rectsOverlap(hostRect, element.getBoundingClientRect());
  });
}

function isCoveredByWindowedShellLayer(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected) {
    return false;
  }

  const ownWindow = host.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest<HTMLElement>('.windowed-os-shell');
  if (!ownWindow || !shell) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 1 || hostRect.height < 1) {
    return false;
  }

  const explicitLayers = Array.from(shell.querySelectorAll<HTMLElement>(WINDOWED_SHELL_LAYER_SELECTOR));
  const unknownFloatingLayers = Array.from(shell.children).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches('.wos-desktop')) return false;
    if (element.matches(WINDOWED_SHELL_LAYER_SELECTOR)) return false;
    if (element.closest('.wos-window')) return false;
    const style = window.getComputedStyle(element);
    const zIndex = Number.parseInt(style.zIndex, 10);
    return ['absolute', 'fixed', 'sticky'].includes(style.position) && Number.isFinite(zIndex) && zIndex > windowLayer(ownWindow);
  });

  return [...explicitLayers, ...unknownFloatingLayers].some((element) => {
    if (!isConnectedVisibleElement(element)) {
      return false;
    }
    if (host.contains(element) || element.contains(host)) {
      return false;
    }
    return rectsOverlap(hostRect, element.getBoundingClientRect());
  });
}

function isCoveredByPositionedRendererLayer(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 1 || hostRect.height < 1) {
    return false;
  }

  const ownWindow = host.closest<HTMLElement>('.wos-window');
  const candidates = Array.from(document.body.querySelectorAll<HTMLElement>('*'));

  return candidates.some((element) => {
    if (element === host || host.contains(element) || element.contains(host)) {
      return false;
    }
    if (ownWindow && ownWindow.contains(element)) {
      return false;
    }
    if (!isConnectedVisibleElement(element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.pointerEvents === 'none') {
      return false;
    }

    const zIndex = Number.parseInt(style.zIndex, 10);
    const isStackedOverlay =
      ['absolute', 'fixed', 'sticky'].includes(style.position) && Number.isFinite(zIndex) && zIndex > windowLayer(ownWindow ?? host);
    const isNativeTopLayer = element.matches('[aria-modal="true"], [role="dialog"]');
    if (!isStackedOverlay && !isNativeTopLayer) {
      return false;
    }

    return rectsOverlap(hostRect, element.getBoundingClientRect());
  });
}

function isCoveredByWindowDescendantLayer(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected) {
    return false;
  }

  const ownWindow = host.closest<HTMLElement>('.wos-window');
  if (!ownWindow) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 1 || hostRect.height < 1) {
    return false;
  }

  return Array.from(ownWindow.querySelectorAll<HTMLElement>('*')).some((element) => {
    if (element === host || host.contains(element) || element.contains(host)) {
      return false;
    }
    if (!isConnectedVisibleElement(element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.pointerEvents === 'none') {
      return false;
    }

    const zIndex = Number.parseInt(style.zIndex, 10);
    const isLayeredElement =
      ['absolute', 'fixed', 'sticky'].includes(style.position) ||
      Number.isFinite(zIndex) ||
      element.matches('[aria-modal="true"], [role="dialog"]');
    if (!isLayeredElement) {
      return false;
    }

    return rectsOverlap(hostRect, element.getBoundingClientRect());
  });
}

function isCoveredByWindowedIframeShield(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected) {
    return false;
  }

  const ownWindow = host.closest<HTMLElement>('.wos-window');
  if (!ownWindow) {
    return false;
  }

  const hostRect = host.getBoundingClientRect();
  if (hostRect.width < 1 || hostRect.height < 1) {
    return false;
  }

  return Array.from(document.querySelectorAll<HTMLElement>('.windowed-os-shell .wos-window__iframe-shield')).some((shield) => {
    if (!isConnectedVisibleElement(shield)) {
      return false;
    }
    if (ownWindow.contains(shield) && !ownWindow.dataset.iframeBlocked) {
      return false;
    }
    return rectsOverlap(hostRect, shield.getBoundingClientRect());
  });
}

function elementAtPoint(x: number, y: number): Element | null {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return null;
  }
  return document.elementFromPoint(x, y);
}

interface BrowserClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectFromBounds(rect: DOMRect | BrowserClipRect): BrowserClipRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function intersectBrowserClip(first: BrowserClipRect, second: BrowserClipRect): BrowserClipRect | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { left, top, right, bottom };
}

function visibleBrowserBoundsForHost(host: HTMLElement): { x: number; y: number; width: number; height: number } | null {
  const hostRect = rectFromBounds(host.getBoundingClientRect());
  if (hostRect.right - hostRect.left < 1 || hostRect.bottom - hostRect.top < 1) {
    return null;
  }

  const clipRects: BrowserClipRect[] = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }, hostRect];
  const windowBody = host.closest<HTMLElement>('.wos-window__body');
  if (windowBody) {
    clipRects.push(rectFromBounds(windowBody.getBoundingClientRect()));
  }
  const desktop = host.closest<HTMLElement>('.wos-desktop');
  if (desktop) {
    clipRects.push(rectFromBounds(desktop.getBoundingClientRect()));
  }
  const windowFrame = host.closest<HTMLElement>('.wos-window');
  if (windowFrame) {
    clipRects.push(rectFromBounds(windowFrame.getBoundingClientRect()));
  }

  let clipped = clipRects[0]!;
  for (const rect of clipRects.slice(1)) {
    const next = intersectBrowserClip(clipped, rect);
    if (!next) {
      return null;
    }
    clipped = next;
  }

  const x = Math.round(clipped.left);
  const y = Math.round(clipped.top);
  const width = Math.round(clipped.right) - x;
  const height = Math.round(clipped.bottom) - y;
  if (width < 24 || height < 24) {
    return null;
  }
  return { x, y, width, height };
}

function isHostOwnedRendererElement(host: HTMLElement, element: Element | null): boolean {
  if (!element) {
    return false;
  }
  if (element === host || host.contains(element)) {
    return true;
  }
  const hostBody = host.closest<HTMLElement>('.wos-window__body');
  return Boolean(hostBody && element === hostBody);
}

function isTopmostRendererOwnerAtHostPoints(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected || typeof document.elementFromPoint !== 'function') {
    return true;
  }

  const bounds = visibleBrowserBoundsForHost(host);
  if (!bounds) {
    return false;
  }

  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const insetX = Math.min(10, Math.max(1, bounds.width / 4));
  const insetY = Math.min(10, Math.max(1, bounds.height / 4));
  const points = [
    [left + bounds.width / 2, top + bounds.height / 2],
    [left + insetX, top + insetY],
    [right - insetX, top + insetY],
    [left + insetX, bottom - insetY],
    [right - insetX, bottom - insetY],
  ];

  for (const [x, y] of points) {
    const topElement = elementAtPoint(x, y);
    if (!topElement) {
      continue;
    }
    if (!isHostOwnedRendererElement(host, topElement)) {
      return false;
    }
  }
  return true;
}

function isCoveredByRendererLayer(host: HTMLElement | null): boolean {
  if (!host || !host.isConnected || typeof document.elementFromPoint !== 'function') {
    return false;
  }

  const ownWindow = host.closest<HTMLElement>('.wos-window');
  const shell = ownWindow?.closest<HTMLElement>('.windowed-os-shell') ?? null;
  const rect = host.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return false;
  }

  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  if (right <= left || bottom <= top) {
    return false;
  }

  const points = [
    [left + (right - left) / 2, top + (bottom - top) / 2],
    [left + Math.min(8, (right - left) / 3), top + Math.min(8, (bottom - top) / 3)],
    [right - Math.min(8, (right - left) / 3), top + Math.min(8, (bottom - top) / 3)],
    [left + Math.min(8, (right - left) / 3), bottom - Math.min(8, (bottom - top) / 3)],
    [right - Math.min(8, (right - left) / 3), bottom - Math.min(8, (bottom - top) / 3)],
    [left + (right - left) / 2, top + Math.min(8, (bottom - top) / 3)],
    [left + (right - left) / 2, bottom - Math.min(8, (bottom - top) / 3)],
    [left + Math.min(8, (right - left) / 3), top + (bottom - top) / 2],
    [right - Math.min(8, (right - left) / 3), top + (bottom - top) / 2],
  ];

  return points.some(([x, y]) => {
    const topElement = elementAtPoint(x, y);
    if (!topElement) {
      return false;
    }
    if (host.contains(topElement)) {
      return false;
    }
    const blocker = topElement.closest<HTMLElement>(
      [
        '.wos-window',
        '.wos-start-menu',
        '.wos-taskbar',
        '.wos-taskbar__menu-layer',
        '.wos-snap-preview',
        '.wos-dialog-layer',
        '.ui-overlay-backdrop',
        '.ui-dialog-shell',
        '.ui-menu-shell',
        '.ui-context-menu-shell',
        '.ui-positioned-menu',
        '.ui-setup-readiness-popover',
        '.ui-workbench-drop-badge',
        '.ui-workbench-drop-popover',
        '.ui-composer-drop-overlay',
        '[aria-modal="true"]',
        '[role="dialog"]',
        '[role="menu"]',
        '[role="listbox"]',
      ].join(', '),
    );
    if (blocker && isVisibleStyle(blocker)) {
      return true;
    }
    if (!shell || !(topElement instanceof HTMLElement)) {
      return false;
    }
    const topShell = topElement.closest<HTMLElement>('.windowed-os-shell');
    return topShell === shell && isVisibleStyle(topElement);
  });
}

function shouldSuspendForWindowedShellEvent(host: HTMLElement | null, event: Event): boolean {
  if (!host?.closest('.windowed-os-shell')) {
    return false;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) {
    return false;
  }
  if (host.contains(target)) {
    return false;
  }
  return Boolean(
    target.closest(
      [
        '.windowed-os-shell',
        '.wos-window',
        '.wos-start-menu',
        '.wos-taskbar',
        '.wos-taskbar__menu-layer',
        '.wos-dialog-layer',
        '.wos-snap-preview',
        '.ui-dialog-shell',
        '.ui-menu-shell',
        '.ui-context-menu-shell',
        '.ui-positioned-menu',
        '.ui-setup-readiness-popover',
        '.ui-workbench-drop-badge',
        '.ui-workbench-drop-popover',
        '.ui-composer-drop-overlay',
        '[role="dialog"]',
        '[role="menu"]',
        '[role="listbox"]',
      ].join(', '),
    ),
  );
}

function isInsideWindowedShell(host: HTMLElement | null): boolean {
  return Boolean(host?.closest('.windowed-os-shell'));
}

export function formatWorkbenchBrowserError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  const remoteMatch = firstLine.match(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?(.*)$/i);
  const message = (remoteMatch?.[1] ?? firstLine).replace(/^Error:\s*/i, '').trim();

  if (/ERR_ABORTED/i.test(message) || /\(-3\)\s+loading/i.test(message)) {
    return 'Loading stopped.';
  }
  if (/ERR_[A-Z_]+/i.test(message) || /\(-\d+\)\s+loading/i.test(message)) {
    return 'Page failed to load. Check the address or connection and try again.';
  }
  if (
    !message ||
    raw.includes('\n') ||
    /Local API route did not complete/i.test(raw) ||
    /\/api\//i.test(raw) ||
    /file:\/\//i.test(raw) ||
    /localApi\.js/i.test(raw) ||
    /\bModule\.[A-Za-z_$][\w$]*/.test(raw) ||
    /packages\/desktop\//i.test(raw) ||
    /\s+at\s+\S+/i.test(raw)
  ) {
    return 'Browser action failed. Check the address and try again.';
  }
  if (/only supports http\(s\) URLs/i.test(message)) {
    return 'Enter a web address that starts with http:// or https://.';
  }
  if (/valid http\(s\) URL/i.test(message)) {
    return 'Enter a valid web address.';
  }
  return message;
}

export function WorkbenchBrowserTab({
  tabsState,
  activeTab,
  onSetTabsState,
  onClose,
  onNewTab,
  onReopenTab,
  onCloseCurrentTab,
}: {
  tabsState: BrowserTabsState;
  activeTab: BrowserTabItem;
  onSetTabsState: React.Dispatch<React.SetStateAction<BrowserTabsState>>;
  onClose: () => void;
  onNewTab: () => void;
  onReopenTab: () => void;
  onCloseCurrentTab: () => void;
}) {
  const browserHostRef = useRef<HTMLDivElement | null>(null);
  const [hostedByWindowedShell, setHostedByWindowedShell] = useState(false);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const closedRef = useRef(false);
  const tabsStateRef = useRef(tabsState);
  const lastBoundsRequestRef = useRef('');
  const windowedShellSuspendUntilRef = useRef(0);
  const hiddenReassertTimersRef = useRef<number[]>([]);
  const [state, setState] = useState<DesktopWorkbenchBrowserState | null>(null);
  const [status, setStatus] = useState('');
  const [surfaceKeybindings, setSurfaceKeybindings] = useState<ExtensionKeybindingRegistration[]>([]);
  const [commentDraft, setCommentDraft] = useState<null | { target: DesktopWorkbenchBrowserCommentTarget; text: string }>(null);
  const [pendingMarkers, setPendingMarkers] = useState<
    Array<{ id: string; target: DesktopWorkbenchBrowserCommentTarget; comment: string }>
  >([]);
  const bridge = getDesktopBridge();

  // Keep ref in sync for cleanup
  useEffect(() => {
    tabsStateRef.current = tabsState;
  }, [tabsState]);

  const browserSessionKey = getTabSessionKey(activeTab.id);
  const previousBrowserSessionKeyRef = useRef(browserSessionKey);
  const [urlDraft, setUrlDraft] = useState(() => activeTab.urlDraft || activeTab.url);
  const urlDraftRef = useRef(urlDraft);

  // Track URL per tab to avoid unnecessary updates
  const tabUrlMapRef = useRef<Record<string, string>>({});

  // When active tab changes, restore its URL draft
  useEffect(() => {
    const draft = activeTab.urlDraft || activeTab.url;
    urlDraftRef.current = draft;
    setUrlDraft(draft);
  }, [activeTab.id]);

  // Navigate each tab once on first activation to restore its saved URL.
  // Subsequent tab switches only show/hide views via syncBounds — no reload.
  const [navigatedTabs, setNavigatedTabs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!bridge || !activeTab.url || navigatedTabs.has(activeTab.id)) {
      return;
    }

    setNavigatedTabs((prev) => new Set(prev).add(activeTab.id));

    void bridge
      .navigateWorkbenchBrowser({ url: activeTab.url, sessionKey: browserSessionKey })
      .then((nextState) => {
        if (nextState) {
          if (tabsStateRef.current.activeTabId === activeTab.id) {
            setState(nextState);
          }
        }
      })
      .catch(() => undefined);
  }, [activeTab.id]);

  // Update tab URL/title from browser state changes
  useEffect(() => {
    if (!state || !state.url) {
      return;
    }

    const tabId = activeTab.id;
    const lastUrl = tabUrlMapRef.current[tabId];
    if (state.url !== lastUrl) {
      tabUrlMapRef.current[tabId] = state.url;
      onSetTabsState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, url: state.url, title: state.title || t.title } : t)),
      }));
    }
  }, [state?.url, state?.title, activeTab.id]);

  const syncUrlDraftFromBrowserState = useCallback((nextState: DesktopWorkbenchBrowserState, tabId: string) => {
    if (document.activeElement === urlInputRef.current) {
      return;
    }

    const newUrl = nextState.url === 'about:blank' ? '' : nextState.url;
    urlDraftRef.current = newUrl;
    setUrlDraft(newUrl);
    onSetTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, url: nextState.url, urlDraft: newUrl, title: nextState.title || t.title } : t)),
    }));
  }, []);

  const hideBrowserView = useCallback(
    (options?: { force?: boolean }) => {
      if (!bridge || closedRef.current) {
        return;
      }

      const hideAllOwnerViews = options?.force && Boolean(browserHostRef.current?.closest('.windowed-os-shell'));
      const ownerSessionKeys = hideAllOwnerViews
        ? Array.from(new Set([null, browserSessionKey, ...tabsStateRef.current.tabs.map((tab) => getTabSessionKey(tab.id))]))
        : [];
      const requestKey = `${browserSessionKey}:hidden`;
      if (!options?.force && lastBoundsRequestRef.current === requestKey) {
        return;
      }
      lastBoundsRequestRef.current = requestKey;
      void bridge
        .setWorkbenchBrowserBounds({ visible: false, sessionKey: browserSessionKey, ...(options?.force ? { deactivate: true } : {}) })
        .then((nextState) => {
          if (nextState) {
            if (tabsStateRef.current.activeTabId === activeTab.id) {
              setState(nextState);
            }
            syncUrlDraftFromBrowserState(nextState, activeTab.id);
          }
        })
        .catch((error) => setStatus(formatWorkbenchBrowserError(error)));

      for (const sessionKey of ownerSessionKeys) {
        if (sessionKey === browserSessionKey) {
          continue;
        }
        void bridge.setWorkbenchBrowserBounds({ visible: false, sessionKey, deactivate: true }).catch((error) => {
          setStatus(formatWorkbenchBrowserError(error));
        });
      }

      if (options?.force) {
        for (const delay of [80, 240, 600, 1200]) {
          const timer = window.setTimeout(() => {
            hiddenReassertTimersRef.current = hiddenReassertTimersRef.current.filter((candidate) => candidate !== timer);
            if (closedRef.current) {
              return;
            }
            void bridge.setWorkbenchBrowserBounds({ visible: false, sessionKey: browserSessionKey, deactivate: true }).catch((error) => {
              setStatus(formatWorkbenchBrowserError(error));
            });
            for (const sessionKey of ownerSessionKeys) {
              if (sessionKey === browserSessionKey) {
                continue;
              }
              void bridge.setWorkbenchBrowserBounds({ visible: false, sessionKey, deactivate: true }).catch((error) => {
                setStatus(formatWorkbenchBrowserError(error));
              });
            }
          }, delay);
          hiddenReassertTimersRef.current.push(timer);
        }
      }
    },
    [activeTab.id, bridge, browserSessionKey, syncUrlDraftFromBrowserState],
  );

  const syncBounds = useCallback(() => {
    const host = browserHostRef.current;
    if (!bridge || !host || closedRef.current) {
      return;
    }

    if (isInsideWindowedShell(host)) {
      hideBrowserView({ force: true });
      return;
    }

    const blocked =
      Date.now() < windowedShellSuspendUntilRef.current ||
      hasBlockingRendererOverlay(host) ||
      hasWindowedShellOverlay() ||
      isInsideUnfocusedWindow(host) ||
      isInsideIframeBlockedWindow(host) ||
      isOutsideFocusedWindowedShellWindow(host) ||
      isInsideBackgroundWindowedWindow(host) ||
      hasSiblingWindowedShellWindow(host) ||
      isBelowTopWindowedShellWindow(host) ||
      isCoveredByWindowedWindow(host) ||
      isCoveredByWindowedChrome(host) ||
      isCoveredByWindowedShellLayer(host) ||
      isCoveredByWindowedIframeShield(host) ||
      !isTopmostRendererOwnerAtHostPoints(host) ||
      isCoveredByPositionedRendererLayer(host) ||
      isCoveredByWindowDescendantLayer(host) ||
      isCoveredByRendererLayer(host);

    if (blocked) {
      hideBrowserView({ force: true });
      return;
    }

    const bounds = visibleBrowserBoundsForHost(host);
    const visible = Boolean(bounds);
    const requestKey = bounds
      ? `${browserSessionKey}:visible:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
      : `${browserSessionKey}:hidden`;
    if (lastBoundsRequestRef.current === requestKey) {
      return;
    }
    lastBoundsRequestRef.current = requestKey;
    void bridge
      .setWorkbenchBrowserBounds({
        visible,
        sessionKey: browserSessionKey,
        ...(bounds ? { bounds } : {}),
      })
      .then((nextState) => {
        if (nextState) {
          if (tabsStateRef.current.activeTabId === activeTab.id) {
            setState(nextState);
          }
          syncUrlDraftFromBrowserState(nextState, activeTab.id);
        }
      })
      .catch((error) => setStatus(formatWorkbenchBrowserError(error)));
  }, [bridge, browserSessionKey, hideBrowserView, syncUrlDraftFromBrowserState]);

  useEffect(() => {
    const handleSuspend = (event: Event) => {
      const detail = (event as CustomEvent<WindowedShellBrowserSuspendDetail>).detail;
      const durationMs =
        typeof detail?.durationMs === 'number' && Number.isFinite(detail.durationMs)
          ? Math.max(WINDOWED_SHELL_BROWSER_SUSPEND_MS, detail.durationMs)
          : WINDOWED_SHELL_BROWSER_SUSPEND_MS;
      windowedShellSuspendUntilRef.current = Math.max(windowedShellSuspendUntilRef.current, Date.now() + durationMs);
      hideBrowserView({ force: true });
    };
    window.addEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, handleSuspend, true);
    return () => window.removeEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, handleSuspend, true);
  }, [hideBrowserView]);

  useEffect(() => {
    const handleWindowedShellEvent = (event: Event) => {
      if (!shouldSuspendForWindowedShellEvent(browserHostRef.current, event)) {
        return;
      }
      windowedShellSuspendUntilRef.current = Math.max(windowedShellSuspendUntilRef.current, Date.now() + WINDOWED_SHELL_BROWSER_SUSPEND_MS);
      hideBrowserView({ force: true });
    };

    window.addEventListener('pointerdown', handleWindowedShellEvent, true);
    window.addEventListener('mousedown', handleWindowedShellEvent, true);
    window.addEventListener('focusin', handleWindowedShellEvent, true);
    return () => {
      window.removeEventListener('pointerdown', handleWindowedShellEvent, true);
      window.removeEventListener('mousedown', handleWindowedShellEvent, true);
      window.removeEventListener('focusin', handleWindowedShellEvent, true);
    };
  }, [hideBrowserView]);

  useEffect(() => {
    const previousSessionKey = previousBrowserSessionKeyRef.current;
    previousBrowserSessionKeyRef.current = browserSessionKey;
    if (!bridge || previousSessionKey === browserSessionKey) {
      return;
    }
    void bridge.setWorkbenchBrowserBounds({ visible: false, sessionKey: previousSessionKey, deactivate: true }).catch(() => undefined);
  }, [bridge, browserSessionKey]);

  useLayoutEffect(() => {
    closedRef.current = false;
    setHostedByWindowedShell(Boolean(browserHostRef.current?.closest('.windowed-os-shell')));
    syncBounds();
    const observer = typeof ResizeObserver !== 'undefined' && browserHostRef.current ? new ResizeObserver(syncBounds) : null;
    if (browserHostRef.current) {
      observer?.observe(browserHostRef.current);
    }
    window.addEventListener('resize', syncBounds);
    window.addEventListener('mousemove', syncBounds, true);
    window.addEventListener('mousedown', syncBounds, true);
    window.addEventListener('mouseup', syncBounds, true);
    window.addEventListener('pointerdown', syncBounds, true);
    window.addEventListener('pointerup', syncBounds, true);
    const modalObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(syncBounds) : null;
    modalObserver?.observe(document.body, {
      attributes: true,
      attributeFilter: [
        'aria-modal',
        'class',
        'data-focused',
        'data-focused-window-id',
        'data-frame-paint-blocked',
        'data-iframe-blocked',
        'data-native-browser-blocked',
        'data-window-interaction',
        'style',
      ],
      childList: true,
      subtree: true,
    });
    const syncInterval = browserHostRef.current?.closest('.windowed-os-shell')
      ? WINDOWED_BROWSER_BOUNDS_SYNC_INTERVAL_MS
      : BROWSER_BOUNDS_SYNC_INTERVAL_MS;
    const timer = window.setInterval(syncBounds, syncInterval);

    return () => {
      closedRef.current = true;
      observer?.disconnect();
      modalObserver?.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('mousemove', syncBounds, true);
      window.removeEventListener('mousedown', syncBounds, true);
      window.removeEventListener('mouseup', syncBounds, true);
      window.removeEventListener('pointerdown', syncBounds, true);
      window.removeEventListener('pointerup', syncBounds, true);
      window.clearInterval(timer);
      for (const reassertTimer of hiddenReassertTimersRef.current) {
        window.clearTimeout(reassertTimer);
      }
      hiddenReassertTimersRef.current = [];
      // Deactivate all tabs on unmount
      const currentTabs = tabsStateRef.current?.tabs ?? [];
      for (const tab of currentTabs) {
        void bridge
          ?.setWorkbenchBrowserBounds({ visible: false, sessionKey: getTabSessionKey(tab.id), deactivate: true })
          .catch(() => undefined);
      }
    };
  }, [bridge, browserSessionKey, syncBounds]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .extensionKeybindings()
        .then((keybindings) => {
          if (!cancelled) {
            setSurfaceKeybindings(
              keybindings.filter(
                (keybinding) =>
                  keybinding.enabled && keybinding.scope === 'surface' && WORKBENCH_BROWSER_SHORTCUT_COMMANDS.has(keybinding.command),
              ),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setSurfaceKeybindings([]);
        });
    };
    load();
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    };
  }, []);

  const executeBrowserTabCommand = useCallback(
    (command: unknown): boolean => {
      switch (command) {
        case 'browser.newTab':
        case 'newTab':
          onNewTab();
          return true;
        case 'browser.reopenTab':
        case 'reopenTab':
          onReopenTab();
          return true;
        case 'browser.closeTab':
        case 'closeTab':
          onCloseCurrentTab();
          return true;
        case 'browser.focusLocation':
        case 'focusLocation':
          urlInputRef.current?.focus();
          urlInputRef.current?.select();
          return true;
        default:
          return false;
      }
    },
    [onCloseCurrentTab, onNewTab, onReopenTab],
  );

  // Surface-scoped keyboard shortcuts from the browser extension manifest.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const match = findMatchingExtensionKeybinding(event, surfaceKeybindings);
      if (!match) return;
      if (!executeBrowserTabCommand(match.command)) return;
      event.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeBrowserTabCommand, surfaceKeybindings]);

  useEffect(() => {
    setExtensionCommandContext('browser.active', true);
    setExtensionCommandContext('browser.canGoBack', Boolean(state?.canGoBack));
    setExtensionCommandContext('browser.canGoForward', Boolean(state?.canGoForward));
    setExtensionCommandContext('browser.loading', Boolean(state?.loading));
    return () => {
      setExtensionCommandContext('browser.active', null);
      setExtensionCommandContext('browser.canGoBack', null);
      setExtensionCommandContext('browser.canGoForward', null);
      setExtensionCommandContext('browser.loading', null);
    };
  }, [state?.canGoBack, state?.canGoForward, state?.loading]);

  useEffect(() => {
    function handleBrowserCommand(event: Event) {
      const command = (event as CustomEvent<{ command?: unknown }>).detail?.command;
      if (executeBrowserTabCommand(command)) {
        return;
      }
      if (command === 'close') {
        onClose();
        return;
      }
      if (!bridge) return;
      if (command === 'goBack' && state?.canGoBack) {
        void runBrowserCommand(() => bridge.goBackWorkbenchBrowser({ sessionKey: browserSessionKey }));
        return;
      }
      if (command === 'goForward' && state?.canGoForward) {
        void runBrowserCommand(() => bridge.goForwardWorkbenchBrowser({ sessionKey: browserSessionKey }));
        return;
      }
      if (command === 'reloadOrStop') {
        void runBrowserCommand(() =>
          state?.loading
            ? bridge.stopWorkbenchBrowser({ sessionKey: browserSessionKey })
            : bridge.reloadWorkbenchBrowser({ sessionKey: browserSessionKey }),
        );
      }
    }

    window.addEventListener(WORKBENCH_BROWSER_COMMAND_EVENT, handleBrowserCommand);
    return () => window.removeEventListener(WORKBENCH_BROWSER_COMMAND_EVENT, handleBrowserCommand);
  }, [bridge, browserSessionKey, executeBrowserTabCommand, onClose, state?.canGoBack, state?.canGoForward, state?.loading]);

  useEffect(() => {
    function handleBrowserCommentTarget(event: Event) {
      const target = (event as CustomEvent<DesktopWorkbenchBrowserCommentTarget>).detail;
      if (!target || typeof target.url !== 'string') {
        return;
      }
      setCommentDraft({ target, text: '' });
    }

    window.addEventListener(DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT, handleBrowserCommentTarget);
    return () => window.removeEventListener(DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT, handleBrowserCommentTarget);
  }, []);

  async function runBrowserCommand(command: () => Promise<DesktopWorkbenchBrowserState | null | undefined>) {
    const commandTabId = activeTab.id;
    if (!bridge) {
      setStatus('Workbench browser is only available in the Electron desktop app.');
      return;
    }
    try {
      setStatus('Working…');
      const nextState = await command();
      if (nextState) {
        if (tabsStateRef.current.activeTabId === commandTabId) {
          setState(nextState);
        }
        const newUrl = nextState.url === 'about:blank' ? '' : nextState.url;
        urlDraftRef.current = newUrl;
        setUrlDraft(newUrl);
        onSetTabsState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((t) =>
            t.id === commandTabId ? { ...t, url: nextState.url, urlDraft: newUrl, title: nextState.title || t.title } : t,
          ),
        }));
      }
      setStatus('');
      syncBounds();
    } catch (error) {
      setStatus(formatWorkbenchBrowserError(error));
    }
  }

  function handleCloseCurrentBrowserTab() {
    setStatus('');
    setCommentDraft(null);
    onCloseCurrentTab();
  }

  const handleUrlInputChange = useCallback((value: string) => {
    urlDraftRef.current = value;
    setUrlDraft(value);
    onSetTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === activeTab.id ? { ...t, urlDraft: value } : t)),
    }));
  }, []);

  function saveCommentDraft() {
    const text = commentDraft?.text.trim();
    if (!commentDraft || !text) {
      setCommentDraft(null);
      return;
    }

    const id = `browser-comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.dispatchEvent(
      new CustomEvent(WORKBENCH_BROWSER_COMMENT_ADDED_EVENT, {
        detail: {
          id,
          createdAt: new Date().toISOString(),
          target: commentDraft.target,
          comment: text,
        },
      }),
    );
    setPendingMarkers((current) => [...current, { id, target: commentDraft.target, comment: text }]);
    setCommentDraft(null);
    setStatus('Browser comment added to composer.');
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <form
        className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runBrowserCommand(() => bridge!.navigateWorkbenchBrowser({ url: urlDraft, sessionKey: browserSessionKey }));
        }}
      >
        <IconButton
          compact
          size="sm"
          disabled={!state?.canGoBack}
          aria-label="Go back"
          title="Go back"
          onClick={() => void runBrowserCommand(() => bridge!.goBackWorkbenchBrowser({ sessionKey: browserSessionKey }))}
        >
          ←
        </IconButton>
        <IconButton
          compact
          size="sm"
          disabled={!state?.canGoForward}
          aria-label="Go forward"
          title="Go forward"
          onClick={() => void runBrowserCommand(() => bridge!.goForwardWorkbenchBrowser({ sessionKey: browserSessionKey }))}
        >
          →
        </IconButton>
        <IconButton
          compact
          size="sm"
          aria-label={state?.loading ? 'Stop loading' : 'Reload'}
          title={state?.loading ? 'Stop loading' : 'Reload'}
          onClick={() =>
            void runBrowserCommand(() =>
              state?.loading
                ? bridge!.stopWorkbenchBrowser({ sessionKey: browserSessionKey })
                : bridge!.reloadWorkbenchBrowser({ sessionKey: browserSessionKey }),
            )
          }
        >
          {state?.loading ? '×' : '↻'}
        </IconButton>
        <TextInput
          ref={urlInputRef}
          className="min-w-0 flex-1"
          value={urlDraft}
          onChange={(event) => handleUrlInputChange(event.target.value)}
          placeholder="https://example.com"
        />
        <IconButton compact size="sm" aria-label="Close browser tab" title="Close browser tab" onClick={handleCloseCurrentBrowserTab}>
          ×
        </IconButton>
      </form>
      <div
        ref={browserHostRef}
        className={`relative min-h-[220px] flex-1 overflow-hidden bg-base${hostedByWindowedShell ? ' ui-windowed-browser-host' : ''}`}
        data-windowed-browser-host={hostedByWindowedShell ? 'true' : undefined}
      >
        {!bridge ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] leading-5 text-dim">
            Browser embedding is only available in the Electron desktop app.
          </div>
        ) : null}
        {hostedByWindowedShell ? (
          <div className="ui-windowed-browser-host__blocker" role="status">
            Browser preview is paused in desktop mode while the window system is active.
          </div>
        ) : null}
        {pendingMarkers.map((marker, index) => {
          const hostWidth = browserHostRef.current?.clientWidth ?? 320;
          const hostHeight = browserHostRef.current?.clientHeight ?? 320;
          const x = Math.max(6, Math.min(marker.target.viewportRect.x, hostWidth - 28));
          const y = Math.max(6, Math.min(marker.target.viewportRect.y, hostHeight - 28));
          return (
            <div key={marker.id} className="ui-workbench-drop-badge" style={{ left: x, top: y }} title={marker.comment} aria-hidden="true">
              {index + 1}
            </div>
          );
        })}
        {commentDraft ? (
          <div
            className="ui-workbench-drop-popover"
            style={{
              left: Math.max(8, Math.min(commentDraft.target.viewportRect.x, (browserHostRef.current?.clientWidth ?? 320) - 296)),
              top: Math.max(
                8,
                Math.min(
                  commentDraft.target.viewportRect.y + Math.min(commentDraft.target.viewportRect.height, 28),
                  (browserHostRef.current?.clientHeight ?? 320) - 156,
                ),
              ),
            }}
          >
            <p className="truncate text-[11px] font-medium text-primary">
              Comment on {commentDraft.target.role ?? 'element'}
              {commentDraft.target.accessibleName ? `: ${commentDraft.target.accessibleName}` : ''}
            </p>
            <Textarea
              className="mt-2 min-h-[72px] resize-none bg-base px-2 py-1.5 text-[12px] leading-5"
              value={commentDraft.text}
              onChange={(event) => setCommentDraft((current) => (current ? { ...current, text: event.target.value } : null))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setCommentDraft(null);
                }
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  saveCommentDraft();
                }
              }}
              autoFocus
              placeholder="What should the agent know about this?"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <ToolbarButton onClick={() => setCommentDraft(null)}>Cancel</ToolbarButton>
              <Button variant="action" onClick={saveCommentDraft}>
                <span aria-hidden="true">+</span>
                Add comment
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {status ? <div className="shrink-0 border-t border-border-subtle px-3 py-1.5 text-[11px] text-dim">{status}</div> : null}
    </div>
  );
}
