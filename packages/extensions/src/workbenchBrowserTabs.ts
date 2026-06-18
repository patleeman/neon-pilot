export interface BrowserTabItem {
  id: string;
  title: string;
  url: string;
  urlDraft: string;
}

export interface BrowserTabsState {
  version: 1;
  tabs: BrowserTabItem[];
  activeTabId: string;
  closedTabs: BrowserTabItem[];
}
