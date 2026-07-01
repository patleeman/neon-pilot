import { IconButton, RailSection, ResourceListItem } from '@neon-pilot/extensions/ui';
import {
  type BrowserTabsState,
  createNewTab,
  getAdjacentTabId,
  getDesktopBridge,
  getTabSessionKey,
  readBrowserTabsState,
  WorkbenchBrowserTab,
  writeBrowserTabsState,
} from '@neon-pilot/extensions/workbench-browser';
import { useCallback, useEffect, useState } from 'react';

import { BrowserToolBlock } from './BrowserToolBlock.js';

const BROWSER_TABS_CHANGED_EVENT = 'pa:system-browser-tabs-changed';
const WORKBENCH_OPEN_TOOL_TAB_EVENT = 'pa:workbench-open-tool-tab';

export function BrowserTranscriptRenderer({ block, context }: { block: never; context: { onOpenBrowser?: () => void } }) {
  return <BrowserToolBlock block={block} onOpenBrowser={context.onOpenBrowser} />;
}

let browserTabsSnapshot: BrowserTabsState = readBrowserTabsState();

function publishBrowserTabsState(next: BrowserTabsState) {
  browserTabsSnapshot = next;
  writeBrowserTabsState(next);
  window.dispatchEvent(new CustomEvent(BROWSER_TABS_CHANGED_EVENT, { detail: next }));
}

function useBrowserTabsState(): [
  BrowserTabsState,
  (updater: BrowserTabsState | ((current: BrowserTabsState) => BrowserTabsState)) => void,
] {
  const [tabsState, setTabsState] = useState(browserTabsSnapshot);

  useEffect(() => {
    const handleChange = (event: Event) => {
      setTabsState((event as CustomEvent<BrowserTabsState>).detail ?? browserTabsSnapshot);
    };
    window.addEventListener(BROWSER_TABS_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(BROWSER_TABS_CHANGED_EVENT, handleChange);
  }, []);

  const updateTabsState = useCallback((updater: BrowserTabsState | ((current: BrowserTabsState) => BrowserTabsState)) => {
    const next = typeof updater === 'function' ? updater(browserTabsSnapshot) : updater;
    publishBrowserTabsState(next);
  }, []);

  return [tabsState, updateTabsState];
}

function useBrowserTabActions() {
  const [tabsState, setTabsState] = useBrowserTabsState();

  const switchTab = useCallback(
    (tabId: string) => {
      setTabsState((prev) => ({ ...prev, activeTabId: tabId }));
    },
    [setTabsState],
  );

  const addTab = useCallback(() => {
    const newTab = createNewTab();
    setTabsState((prev) => ({ ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id }));
  }, [setTabsState]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabsState((prev) => {
        const closedTab = prev.tabs.find((tab) => tab.id === tabId) ?? null;
        if (prev.tabs.length <= 1) {
          const newTab = createNewTab();
          return {
            tabs: [newTab],
            activeTabId: newTab.id,
            closedTabs: closedTab ? [closedTab, ...prev.closedTabs].slice(0, 10) : prev.closedTabs,
          };
        }
        const newTabId = getAdjacentTabId(prev, tabId) ?? prev.tabs[0]!.id;
        return {
          ...prev,
          tabs: prev.tabs.filter((tab) => tab.id !== tabId),
          activeTabId: newTabId,
          closedTabs: closedTab ? [closedTab, ...prev.closedTabs].slice(0, 10) : prev.closedTabs,
        };
      });
      void getDesktopBridge()
        ?.setWorkbenchBrowserBounds({ visible: false, sessionKey: getTabSessionKey(tabId), deactivate: true })
        .catch(() => undefined);
    },
    [setTabsState],
  );

  const reopenTab = useCallback(() => {
    setTabsState((prev) => {
      if (prev.closedTabs.length === 0) return prev;
      const [restored, ...remaining] = prev.closedTabs;
      const newTab = { ...restored, id: crypto.randomUUID(), urlDraft: '' };
      return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id, closedTabs: remaining };
    });
  }, [setTabsState]);

  return { tabsState, setTabsState, switchTab, addTab, closeTab, reopenTab };
}

export function BrowserTabsPanel() {
  const { tabsState, switchTab, addTab, closeTab } = useBrowserTabActions();

  return (
    <RailSection title="Browser" bodyClassName="flex flex-col gap-px px-1.5 py-1.5">
      {tabsState.tabs.map((tab) => (
        <ResourceListItem
          key={tab.id}
          label={tab.title}
          selected={tab.id === tabsState.activeTabId}
          onClick={() => switchTab(tab.id)}
          title={tab.title}
          className="group"
        >
          <IconButton
            compact
            className="ml-auto opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              closeTab(tab.id);
            }}
            aria-label={`Close ${tab.title}`}
            title={`Close ${tab.title}`}
          >
            ×
          </IconButton>
        </ResourceListItem>
      ))}
      <ResourceListItem label="New tab" leading="+" onClick={addTab} title="New tab" aria-label="New tab" />
    </RailSection>
  );
}

export function BrowserWorkbenchPanel({ context }: { context?: { instanceId?: string | null } }) {
  const { tabsState, setTabsState, addTab, closeTab, reopenTab } = useBrowserTabActions();
  const workbenchTabId = context?.instanceId ?? null;
  const activeTab = workbenchTabId
    ? (tabsState.tabs.find((tab) => tab.id === workbenchTabId) ?? {
        id: workbenchTabId,
        title: 'New Tab',
        url: 'https://www.google.com/',
        urlDraft: '',
      })
    : (tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId) ?? tabsState.tabs[0] ?? createNewTab());

  useEffect(() => {
    if (!workbenchTabId) return;
    setTabsState((prev) => {
      if (prev.tabs.some((tab) => tab.id === workbenchTabId)) {
        return prev.activeTabId === workbenchTabId ? prev : { ...prev, activeTabId: workbenchTabId };
      }
      return {
        ...prev,
        tabs: [...prev.tabs, { id: workbenchTabId, title: 'New Tab', url: 'https://www.google.com/', urlDraft: '' }],
        activeTabId: workbenchTabId,
      };
    });
  }, [setTabsState, workbenchTabId]);

  const openWorkbenchBrowserTab = useCallback(() => {
    if (!workbenchTabId) {
      addTab();
      return;
    }
    window.dispatchEvent(new CustomEvent(WORKBENCH_OPEN_TOOL_TAB_EVENT, { detail: { tool: 'browser' } }));
  }, [addTab, workbenchTabId]);

  return (
    <WorkbenchBrowserTab
      tabsState={tabsState}
      activeTab={activeTab}
      onSetTabsState={setTabsState}
      onClose={() => undefined}
      onNewTab={openWorkbenchBrowserTab}
      onReopenTab={reopenTab}
      onCloseCurrentTab={() => closeTab(activeTab.id)}
    />
  );
}
