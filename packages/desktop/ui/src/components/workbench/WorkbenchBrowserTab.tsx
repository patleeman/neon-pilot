import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { api } from '../../client/api';
import {
  DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT,
  type DesktopWorkbenchBrowserCommentTarget,
  type DesktopWorkbenchBrowserState,
  getDesktopBridge,
} from '../../desktop/desktopBridge';
import { EXTENSION_REGISTRY_CHANGED_EVENT } from '../../extensions/extensionRegistryEvents';
import { findMatchingExtensionKeybinding } from '../../extensions/keybindings';
import type { ExtensionKeybindingRegistration } from '../../extensions/types';
import { type BrowserTabItem, type BrowserTabsState, getTabSessionKey } from '../../local/workbenchBrowserTabs';
import { Button, IconButton, Textarea, TextInput, ToolbarButton } from '../ui';

const WORKBENCH_BROWSER_COMMENT_ADDED_EVENT = 'pa:workbench-browser-comment-added';
const WORKBENCH_BROWSER_SHORTCUT_COMMANDS = new Set([
  'browser.newTab',
  'browser.reopenTab',
  'browser.closeTab',
  'browser.focusLocation',
]);

function hasBlockingHtmlModal(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return Boolean(document.querySelector('[aria-modal="true"]'));
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
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const closedRef = useRef(false);
  const tabsStateRef = useRef(tabsState);
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

  const syncBounds = useCallback(() => {
    const host = browserHostRef.current;
    if (!bridge || !host || closedRef.current) {
      return;
    }

    if (hasBlockingHtmlModal()) {
      void bridge
        .setWorkbenchBrowserBounds({ visible: false, sessionKey: browserSessionKey })
        .then((nextState) => {
          if (nextState) {
            if (tabsStateRef.current.activeTabId === activeTab.id) {
              setState(nextState);
            }
            syncUrlDraftFromBrowserState(nextState, activeTab.id);
          }
        })
        .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
      return;
    }

    const rect = host.getBoundingClientRect();
    const visible = rect.width >= 24 && rect.height >= 24;
    void bridge
      .setWorkbenchBrowserBounds({
        visible,
        sessionKey: browserSessionKey,
        ...(visible
          ? {
              bounds: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            }
          : {}),
      })
      .then((nextState) => {
        if (nextState) {
          if (tabsStateRef.current.activeTabId === activeTab.id) {
            setState(nextState);
          }
          syncUrlDraftFromBrowserState(nextState, activeTab.id);
        }
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [bridge, browserSessionKey, syncUrlDraftFromBrowserState]);

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
    syncBounds();
    const observer = typeof ResizeObserver !== 'undefined' && browserHostRef.current ? new ResizeObserver(syncBounds) : null;
    if (browserHostRef.current) {
      observer?.observe(browserHostRef.current);
    }
    window.addEventListener('resize', syncBounds);
    const modalObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(syncBounds) : null;
    modalObserver?.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-modal'],
      childList: true,
      subtree: true,
    });
    const timer = window.setInterval(syncBounds, 1000);

    return () => {
      closedRef.current = true;
      observer?.disconnect();
      modalObserver?.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.clearInterval(timer);
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

  // Surface-scoped keyboard shortcuts from the browser extension manifest.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const match = findMatchingExtensionKeybinding(event, surfaceKeybindings);
      if (!match) return;

      switch (match.command) {
        case 'browser.newTab':
          event.preventDefault();
          onNewTab();
          return;
        case 'browser.reopenTab':
          event.preventDefault();
          onReopenTab();
          return;
        case 'browser.closeTab':
          event.preventDefault();
          onCloseCurrentTab();
          return;
        case 'browser.focusLocation':
          event.preventDefault();
          urlInputRef.current?.focus();
          urlInputRef.current?.select();
          return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewTab, onReopenTab, onCloseCurrentTab, surfaceKeybindings]);

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
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function handleCloseBrowser() {
    closedRef.current = true;
    setStatus('');
    setCommentDraft(null);
    const currentTabs = tabsStateRef.current?.tabs ?? [];
    for (const tab of currentTabs) {
      void bridge
        ?.setWorkbenchBrowserBounds({ visible: false, sessionKey: getTabSessionKey(tab.id), deactivate: true })
        .catch(() => undefined);
    }
    onClose();
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
        <IconButton compact size="sm" aria-label="Close browser" title="Close browser" onClick={handleCloseBrowser}>
          ×
        </IconButton>
      </form>
      <div ref={browserHostRef} className="relative min-h-[220px] flex-1 overflow-hidden bg-base">
        {!bridge ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] leading-5 text-dim">
            Browser embedding is only available in the Electron desktop app.
          </div>
        ) : null}
        {pendingMarkers.map((marker, index) => {
          const hostWidth = browserHostRef.current?.clientWidth ?? 320;
          const hostHeight = browserHostRef.current?.clientHeight ?? 320;
          const x = Math.max(6, Math.min(marker.target.viewportRect.x, hostWidth - 28));
          const y = Math.max(6, Math.min(marker.target.viewportRect.y, hostHeight - 28));
          return (
            <div
              key={marker.id}
              className="pointer-events-none absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border border-accent/70 bg-accent text-[11px] font-semibold text-black shadow-lg"
              style={{ left: x, top: y }}
              title={marker.comment}
              aria-hidden="true"
            >
              {index + 1}
            </div>
          );
        })}
        {commentDraft ? (
          <div
            className="absolute z-20 w-[min(18rem,calc(100%-1rem))] rounded-xl border border-accent/30 bg-surface/95 p-2 shadow-2xl backdrop-blur"
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
              <ToolbarButton className="px-2 py-1 text-[11px]" onClick={() => setCommentDraft(null)}>
                Cancel
              </ToolbarButton>
              <Button variant="action" className="px-2 py-1 text-[11px]" onClick={saveCommentDraft}>
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
