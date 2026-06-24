const STORAGE_KEY = 'pa:workbench-browser-tabs';
const DEFAULT_URL = 'https://www.google.com/';
export const BROWSER_TABS_CHANGED_EVENT = 'pa:system-browser-tabs-changed';
const STORAGE_GUARD_FLAG = '__neonPilotWorkbenchBrowserTabsStorageGuard';

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

function generateId(): string {
  return crypto.randomUUID();
}

function createDefaultState(): BrowserTabsState {
  const id = generateId();
  return {
    version: 1,
    tabs: [{ id, title: 'New Tab', url: DEFAULT_URL, urlDraft: '' }],
    activeTabId: id,
    closedTabs: [],
  };
}

function normalizeTab(raw: unknown): BrowserTabItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const tab = raw as Record<string, unknown>;
  if (!tab.id) return null;
  return {
    id: String(tab.id ?? ''),
    title: String(tab.title ?? 'New Tab'),
    url: String(tab.url ?? DEFAULT_URL),
    urlDraft: String(tab.urlDraft ?? ''),
  };
}

function validateState(raw: unknown): BrowserTabsState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const state = raw as Record<string, unknown>;
  if (state.version !== 1) {
    return null;
  }

  if (!Array.isArray(state.tabs) || state.tabs.length === 0) {
    return null;
  }

  if (typeof state.activeTabId !== 'string') {
    return null;
  }

  const hasActive = state.tabs.some((t: unknown) => {
    if (!t || typeof t !== 'object') {
      return false;
    }

    const tab = t as Record<string, unknown>;
    return tab.id === state.activeTabId;
  });

  if (!hasActive) {
    return null;
  }

  const closedTabs = Array.isArray(state.closedTabs)
    ? state.closedTabs
        .map((t: unknown) => normalizeTab(t))
        .filter((t): t is BrowserTabItem => t !== null)
        .slice(0, 10)
    : [];

  return {
    version: 1,
    tabs: state.tabs.map((t: unknown) => normalizeTab(t)).filter((t): t is BrowserTabItem => t !== null),
    activeTabId: String(state.activeTabId),
    closedTabs,
  };
}

function normalizeRawState(raw: unknown): BrowserTabsState | null {
  const validated = validateState(raw);
  if (validated) {
    return validated;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const state = raw as Record<string, unknown>;
  const tabs = Array.isArray(state.tabs)
    ? state.tabs.map((t: unknown) => normalizeTab(t)).filter((t): t is BrowserTabItem => t !== null)
    : [];
  if (tabs.length === 0 || typeof state.activeTabId !== 'string' || !tabs.some((tab) => tab.id === state.activeTabId)) {
    return null;
  }
  const closedTabs = Array.isArray(state.closedTabs)
    ? state.closedTabs
        .map((t: unknown) => normalizeTab(t))
        .filter((t): t is BrowserTabItem => t !== null)
        .slice(0, 10)
    : [];
  return {
    version: 1,
    tabs,
    activeTabId: state.activeTabId,
    closedTabs,
  };
}

function reconcileBrowserTabsStateForWrite(
  next: BrowserTabsState,
  current: BrowserTabsState | null,
): { state: BrowserTabsState; reconciled: boolean } {
  const normalized = normalizeRawState(next) ?? next;
  if (!current) {
    return { state: normalized, reconciled: false };
  }

  const nextTabIds = new Set(normalized.tabs.map((tab) => tab.id));
  const nextClosedTabIds = new Set(normalized.closedTabs.map((tab) => tab.id));
  const preservedTabs = current.tabs.filter((tab) => !nextTabIds.has(tab.id) && !nextClosedTabIds.has(tab.id));
  if (preservedTabs.length === 0) {
    return { state: normalized, reconciled: false };
  }

  const tabs = [...normalized.tabs, ...preservedTabs];
  const activeTabId =
    current.activeTabId && !nextTabIds.has(current.activeTabId) && !nextClosedTabIds.has(current.activeTabId)
      ? current.activeTabId
      : normalized.activeTabId;
  return {
    state: {
      ...normalized,
      tabs,
      activeTabId: tabs.some((tab) => tab.id === activeTabId) ? activeTabId : tabs[0]!.id,
    },
    reconciled: true,
  };
}

function readStoredBrowserTabsState(storage: Storage): BrowserTabsState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? validateState(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function dispatchReconciledBrowserTabsState(state: BrowserTabsState): void {
  if (typeof window === 'undefined') return;
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(BROWSER_TABS_CHANGED_EVENT, { detail: state }));
  });
}

function installBrowserTabsStorageGuard(): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return;
  const storagePrototype = Storage.prototype as Storage & { [STORAGE_GUARD_FLAG]?: true };
  if (storagePrototype[STORAGE_GUARD_FLAG]) return;
  const originalSetItem = Storage.prototype.setItem;
  storagePrototype[STORAGE_GUARD_FLAG] = true;
  Storage.prototype.setItem = function guardedSetItem(key: string, value: string) {
    if (key !== STORAGE_KEY) {
      return originalSetItem.call(this, key, value);
    }

    try {
      const next = normalizeRawState(JSON.parse(String(value)) as unknown);
      if (!next) {
        return originalSetItem.call(this, key, value);
      }
      const reconciled = reconcileBrowserTabsStateForWrite(next, readStoredBrowserTabsState(this));
      if (reconciled.reconciled) {
        dispatchReconciledBrowserTabsState(reconciled.state);
      }
      return originalSetItem.call(this, key, JSON.stringify(reconciled.state));
    } catch {
      return originalSetItem.call(this, key, value);
    }
  };
}

installBrowserTabsStorageGuard();

export function readBrowserTabsState(): BrowserTabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const validated = validateState(parsed);
      if (validated) {
        return validated;
      }
    }
  } catch {
    // ignore
  }

  return createDefaultState();
}

export function writeBrowserTabsState(state: BrowserTabsState): void {
  try {
    const reconciled = reconcileBrowserTabsStateForWrite(state, readStoredBrowserTabsState(localStorage));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reconciled.state));
    if (reconciled.reconciled) {
      dispatchReconciledBrowserTabsState(reconciled.state);
    }
  } catch {
    // ignore
  }
}

export function createNewTab(): BrowserTabItem {
  return {
    id: generateId(),
    title: 'New Tab',
    url: DEFAULT_URL,
    urlDraft: '',
  };
}

export function getTabSessionKey(tabId: string): string {
  return `@global:tab-${tabId}`;
}

export function getAdjacentTabId(state: BrowserTabsState, closedTabId: string): string | null {
  const index = state.tabs.findIndex((t) => t.id === closedTabId);
  if (index < 0) {
    return null;
  }

  if (index > 0) {
    return state.tabs[index - 1]!.id;
  }

  if (state.tabs.length > 1) {
    return state.tabs[1]!.id;
  }

  return null;
}

export function applyBrowserTabsCommand(state: BrowserTabsState, command: 'newTab' | 'reopenTab' | 'closeTab'): BrowserTabsState | null {
  switch (command) {
    case 'newTab': {
      const tab = createNewTab();
      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }
    case 'reopenTab': {
      const [tab, ...closedTabs] = state.closedTabs;
      if (!tab) return null;
      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        closedTabs,
      };
    }
    case 'closeTab': {
      const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
      if (!activeTab) return null;
      const remainingTabs = state.tabs.filter((tab) => tab.id !== activeTab.id);
      const tabs = remainingTabs.length > 0 ? remainingTabs : [createNewTab()];
      return {
        ...state,
        tabs,
        activeTabId: getAdjacentTabId(state, activeTab.id) ?? tabs[0]!.id,
        closedTabs: [activeTab, ...state.closedTabs].slice(0, 10),
      };
    }
  }
}

export function executeBrowserTabsCommand(command: 'newTab' | 'reopenTab' | 'closeTab'): boolean {
  const nextState = applyBrowserTabsCommand(readBrowserTabsState(), command);
  if (!nextState) return false;
  writeBrowserTabsState(nextState);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROWSER_TABS_CHANGED_EVENT, { detail: nextState }));
  }
  return true;
}
