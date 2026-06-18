import type { ExtensionDesktopBridge } from './desktopBridge.js';
import type { BrowserTabItem, BrowserTabsState } from './workbenchBrowserTabs.js';

export type HostComponent = (...args: never[]) => unknown;
export type { BrowserTabItem, BrowserTabsState };

export declare const WorkbenchBrowserTab: HostComponent;
export declare function cx(...values: Array<unknown>): string;
export declare function getDesktopBridge(...args: never[]): ExtensionDesktopBridge | null;
export declare function createNewTab(): BrowserTabItem;
export declare function getAdjacentTabId(state: BrowserTabsState, closedTabId: string): string | null;
export declare function getTabSessionKey(tabId: string): string;
export declare function readBrowserTabsState(): BrowserTabsState;
export declare function writeBrowserTabsState(state: BrowserTabsState): void;
