// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { type BrowserTabItem, type BrowserTabsState, readBrowserTabsState } from '../local/workbenchBrowserTabs';
import { formatWorkbenchBrowserError, WORKBENCH_BROWSER_COMMAND_EVENT, WorkbenchBrowserTab } from './workbench/WorkbenchBrowserTab';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('WorkbenchBrowserTab', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    delete window.neonPilotDesktop;
    vi.restoreAllMocks();
  });

  it('formats native navigation failures without leaking Electron IPC details', () => {
    expect(
      formatWorkbenchBrowserError(
        new Error(
          "Error invoking remote method 'neon-pilot-desktop:workbench-browser-navigate': Error: Workbench browser only supports http(s) URLs.",
        ),
      ),
    ).toBe('Enter a web address that starts with http:// or https://.');
  });

  it('formats stopped native navigations without leaking Chromium abort details', () => {
    expect(
      formatWorkbenchBrowserError(
        new Error(
          "Error invoking remote method 'neon-pilot-desktop:workbench-browser-navigate': Error: ERR_ABORTED (-3) loading 'http://127.0.0.1:18442/slow'",
        ),
      ),
    ).toBe('Loading stopped.');
  });

  it('formats failed native page loads without leaking Chromium network details', () => {
    expect(
      formatWorkbenchBrowserError(
        new Error(
          "Error invoking remote method 'neon-pilot-desktop:workbench-browser-navigate': Error: ERR_CONNECTION_REFUSED (-102) loading 'http://127.0.0.1:18443/'",
        ),
      ),
    ).toBe('Page failed to load. Check the address or connection and try again.');
  });

  it('formats local API browser failures without leaking route or file details', () => {
    const message = formatWorkbenchBrowserError(
      new Error(
        "Error invoking remote method 'neon-pilot-desktop:workbench-browser-reload': Error: Local API route did not complete for POST /api/workbench/browser/reload",
      ),
    );

    expect(message).toBe('Browser action failed. Check the address and try again.');
    expect(message).not.toContain('Local API route did not complete');
    expect(message).not.toContain('/api/workbench/browser');
  });

  it('formats browser action stack failures without leaking local file paths', () => {
    const message = formatWorkbenchBrowserError(
      new Error(
        "Error invoking remote method 'neon-pilot-desktop:workbench-browser-stop': Error: browser stop failed at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)",
      ),
    );

    expect(message).toBe('Browser action failed. Check the address and try again.');
    expect(message).not.toContain('file://');
    expect(message).not.toContain('localApi.js');
    expect(message).not.toContain('Module.ep');
    expect(message).not.toContain('packages/desktop');
  });

  it('closes the active browser tab from the browser toolbar', async () => {
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    const onClose = vi.fn();
    const onCloseCurrentTab = vi.fn();
    window.neonPilotDesktop = {
      setWorkbenchBrowserBounds: vi.fn(async () => null),
      navigateWorkbenchBrowser: vi.fn(async () => null),
    } as unknown as typeof window.neonPilotDesktop;

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={onClose}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={onCloseCurrentTab}
        />,
      );
    });
    await flushAsyncWork();

    const closeBrowserTabButton = container.querySelector<HTMLButtonElement>('[aria-label="Close browser tab"]');
    expect(closeBrowserTabButton).not.toBeNull();
    act(() => {
      closeBrowserTabButton?.click();
    });

    expect(onCloseCurrentTab).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses a global session key independent of conversation', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => ({
      url: 'https://example.com/',
      title: 'Example',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      browserRevision: 1,
      snapshotRevision: 0,
      changedSinceSnapshot: true,
    }));
    const navigateWorkbenchBrowser = vi.fn(async (input: { url: string; sessionKey?: string | null }) => ({
      url: input.url,
      title: 'Loaded',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      browserRevision: 1,
      snapshotRevision: 0,
      changedSinceSnapshot: true,
    }));
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((t) => t.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;

    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    const container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 640, height: 480, right: 660, bottom: 510, x: 20, y: 30, toJSON: () => ({}) }),
    });

    root = createRoot(container);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    // All bridge calls should use '@global:tab-' session keys
    for (const [args] of setWorkbenchBrowserBounds.mock.calls) {
      if (args?.sessionKey !== undefined) {
        expect(args.sessionKey).toMatch(/^@global:tab-/);
      }
    }
    for (const [args] of navigateWorkbenchBrowser.mock.calls) {
      if (args?.sessionKey !== undefined) {
        expect(args.sessionKey).toMatch(/^@global:tab-/);
      }
    }
  });

  it('hides the native browser view when its windowed shell window is not focused', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 640, height: 480, right: 660, bottom: 510, x: 20, y: 30, toJSON: () => ({}) }),
    });

    const container = document.createElement('div');
    container.innerHTML = '<section class="wos-window" data-focused="false"><div id="browser-root"></div></section>';
    document.body.appendChild(container);
    const browserRoot = container.querySelector('#browser-root')!;
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('hides the native browser view while windowed shell overlays are open', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 640, height: 480, right: 660, bottom: 510, x: 20, y: 30, toJSON: () => ({}) }),
    });

    const container = document.createElement('div');
    container.innerHTML =
      '<div class="windowed-os-shell"><div class="wos-start-menu" role="dialog"></div><section class="wos-window" data-focused="true"><div id="browser-root"></div></section></div>';
    document.body.appendChild(container);
    const browserRoot = container.querySelector('#browser-root')!;
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('hides the native browser view during active windowed desktop interactions', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 640, height: 480, right: 660, bottom: 510, x: 20, y: 30, toJSON: () => ({}) }),
    });

    const container = document.createElement('div');
    container.innerHTML =
      '<div class="windowed-os-shell" data-window-interaction="true"><section class="wos-window" data-focused="true"><div id="browser-root"></div></section></div>';
    document.body.appendChild(container);
    const browserRoot = container.querySelector('#browser-root')!;
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('hides the native browser view when a higher window overlaps its host', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.classList.contains('wos-window') && this.dataset.windowId === 'cover') {
          return { left: 160, top: 140, width: 360, height: 300, right: 520, bottom: 440, x: 160, y: 140, toJSON: () => ({}) };
        }
        if (this.classList.contains('wos-window')) {
          return { left: 20, top: 30, width: 760, height: 560, right: 780, bottom: 590, x: 20, y: 30, toJSON: () => ({}) };
        }
        if (this.closest('#browser-root')) {
          return { left: 36, top: 92, width: 728, height: 470, right: 764, bottom: 562, x: 36, y: 92, toJSON: () => ({}) };
        }
        return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
      },
    });

    const container = document.createElement('div');
    container.innerHTML =
      '<div class="windowed-os-shell"><section class="wos-window" data-window-id="browser" data-focused="true" style="z-index: 10"><div id="browser-root"></div></section><section class="wos-window" data-window-id="cover" data-focused="false" style="z-index: 12"></section></div>';
    document.body.appendChild(container);
    const browserRoot = container.querySelector('#browser-root')!;
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('hides the native browser view when renderer chrome covers its host', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.closest('#browser-root')) {
          return { left: 36, top: 92, width: 728, height: 470, right: 764, bottom: 562, x: 36, y: 92, toJSON: () => ({}) };
        }
        return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
      },
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

    const container = document.createElement('div');
    container.innerHTML =
      '<div class="windowed-os-shell"><section class="wos-window" data-window-id="browser" data-focused="true" style="z-index: 10"><div id="browser-root"></div></section><footer class="wos-taskbar"></footer></div>';
    document.body.appendChild(container);
    const taskbar = container.querySelector('.wos-taskbar')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => taskbar) });
    const browserRoot = container.querySelector('#browser-root')!;
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('hides the native browser view when windowed taskbar geometry overlaps its host', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.classList.contains('wos-taskbar')) {
          return { left: 0, top: 720, width: 1024, height: 48, right: 1024, bottom: 768, x: 0, y: 720, toJSON: () => ({}) };
        }
        if (this.closest('#browser-root')) {
          return { left: 36, top: 92, width: 728, height: 650, right: 764, bottom: 742, x: 36, y: 92, toJSON: () => ({}) };
        }
        return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
      },
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

    const container = document.createElement('div');
    container.innerHTML =
      '<div class="windowed-os-shell"><section class="wos-window" data-window-id="browser" data-focused="true" style="z-index: 10"><div id="browser-root"></div></section><footer class="wos-taskbar"></footer></div>';
    document.body.appendChild(container);
    const browserRoot = container.querySelector('#browser-root')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => browserRoot) });
    root = createRoot(browserRoot);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('applies delayed browser state updates to the tab that requested them', async () => {
    let resolveFirstBounds: ((value: unknown) => void) | null = null;
    const setWorkbenchBrowserBounds = vi.fn((input: { sessionKey?: string | null }) => {
      if (input.sessionKey === '@global:tab-first' && !resolveFirstBounds) {
        return new Promise((resolve) => {
          resolveFirstBounds = resolve;
        });
      }
      return Promise.resolve(null);
    });
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds, navigateWorkbenchBrowser } as unknown as typeof window.neonPilotDesktop;

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 640, height: 480, right: 660, bottom: 510, x: 20, y: 30, toJSON: () => ({}) }),
    });

    const firstTab: BrowserTabItem = { id: 'first', url: 'https://first.example/', urlDraft: 'https://first.example/', title: 'First' };
    const secondTab: BrowserTabItem = {
      id: 'second',
      url: 'https://second.example/',
      urlDraft: 'https://second.example/',
      title: 'Second',
    };
    let browserTabsState: BrowserTabsState = { tabs: [firstTab, secondTab], activeTabId: 'first', closedTabs: [] };
    const onSetTabsState = vi.fn((updater: React.SetStateAction<BrowserTabsState>) => {
      browserTabsState = typeof updater === 'function' ? updater(browserTabsState) : updater;
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    function render(activeTab: BrowserTabItem) {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeTab}
          onSetTabsState={onSetTabsState}
          onClose={() => undefined}
          onNewTab={vi.fn()}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    }

    act(() => render(firstTab));
    await act(async () => {
      await Promise.resolve();
    });

    browserTabsState = { ...browserTabsState, activeTabId: 'second' };
    act(() => render(secondTab));
    await act(async () => {
      resolveFirstBounds?.({
        url: 'https://first.example/updated',
        title: 'First updated',
        loading: false,
        canGoBack: false,
        canGoForward: false,
        browserRevision: 2,
        snapshotRevision: 0,
        changedSinceSnapshot: true,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(browserTabsState.tabs.find((tab) => tab.id === 'first')).toMatchObject({
      url: 'https://first.example/updated',
      title: 'First updated',
    });
    expect(browserTabsState.tabs.find((tab) => tab.id === 'second')).toMatchObject({
      url: 'https://second.example/',
      title: 'Second',
    });
  });

  it('ignores surface shortcuts another handler already consumed', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-browser',
        surfaceId: 'new-browser-tab',
        packageType: 'system',
        title: 'New browser tab',
        keys: ['mod+t'],
        command: 'browser.newTab',
        scope: 'surface',
        defaultKeys: ['mod+t'],
        enabled: true,
      },
    ]);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    const onNewTab = vi.fn();
    window.neonPilotDesktop = {
      setWorkbenchBrowserBounds: vi.fn(async () => null),
      navigateWorkbenchBrowser: vi.fn(async () => null),
    } as unknown as typeof window.neonPilotDesktop;

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={onNewTab}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    const event = new KeyboardEvent('keydown', { key: 't', metaKey: true, cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(onNewTab).not.toHaveBeenCalled();
  });

  it('ignores unrelated surface shortcuts that collide with browser shortcuts', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-other',
        surfaceId: 'foreign-new-tab',
        packageType: 'system',
        title: 'Foreign new tab',
        keys: ['mod+t'],
        command: 'other.newTab',
        scope: 'surface',
        defaultKeys: ['mod+t'],
        enabled: true,
      },
      {
        extensionId: 'system-browser',
        surfaceId: 'new-browser-tab',
        packageType: 'system',
        title: 'New browser tab',
        keys: ['mod+t'],
        command: 'browser.newTab',
        scope: 'surface',
        defaultKeys: ['mod+t'],
        enabled: true,
      },
    ]);
    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;
    const onNewTab = vi.fn();
    window.neonPilotDesktop = {
      setWorkbenchBrowserBounds: vi.fn(async () => null),
      navigateWorkbenchBrowser: vi.fn(async () => null),
    } as unknown as typeof window.neonPilotDesktop;

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={() => undefined}
          onNewTab={onNewTab}
          onReopenTab={vi.fn()}
          onCloseCurrentTab={vi.fn()}
        />,
      );
    });
    await flushAsyncWork();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true }));

    expect(onNewTab).toHaveBeenCalledOnce();
  });

  it('handles shared browser toolbar commands for the active tab', async () => {
    const setWorkbenchBrowserBounds = vi.fn(async () => ({
      url: 'https://example.com/',
      title: 'Example',
      loading: false,
      canGoBack: true,
      canGoForward: true,
      browserRevision: 1,
      snapshotRevision: 0,
      changedSinceSnapshot: true,
    }));
    const navigateWorkbenchBrowser = vi.fn(async () => null);
    const goBackWorkbenchBrowser = vi.fn(async () => ({
      url: 'https://previous.example/',
      title: 'Previous',
      loading: false,
      canGoBack: false,
      canGoForward: true,
      browserRevision: 2,
      snapshotRevision: 0,
      changedSinceSnapshot: true,
    }));
    const reloadWorkbenchBrowser = vi.fn(async () => ({
      url: 'https://example.com/',
      title: 'Example',
      loading: false,
      canGoBack: true,
      canGoForward: true,
      browserRevision: 3,
      snapshotRevision: 0,
      changedSinceSnapshot: true,
    }));
    window.neonPilotDesktop = {
      setWorkbenchBrowserBounds,
      navigateWorkbenchBrowser,
      goBackWorkbenchBrowser,
      goForwardWorkbenchBrowser: vi.fn(async () => null),
      reloadWorkbenchBrowser,
      stopWorkbenchBrowser: vi.fn(async () => null),
    } as unknown as typeof window.neonPilotDesktop;

    const browserTabsState: BrowserTabsState = readBrowserTabsState();
    const activeBrowserTab: BrowserTabItem =
      browserTabsState.tabs.find((tab) => tab.id === browserTabsState.activeTabId) ?? browserTabsState.tabs[0]!;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const onClose = vi.fn();
    const onNewTab = vi.fn();
    const onReopenTab = vi.fn();
    const onCloseCurrentTab = vi.fn();
    root = createRoot(container);
    act(() => {
      root?.render(
        <WorkbenchBrowserTab
          tabsState={browserTabsState}
          activeTab={activeBrowserTab}
          onSetTabsState={vi.fn()}
          onClose={onClose}
          onNewTab={onNewTab}
          onReopenTab={onReopenTab}
          onCloseCurrentTab={onCloseCurrentTab}
        />,
      );
    });
    await flushAsyncWork();

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'newTab' } }));
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'reopenTab' } }));
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'closeTab' } }));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'focusLocation' } }));
    });
    expect(document.activeElement).toBe(container.querySelector('input'));

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'goBack' } }));
    });
    await flushAsyncWork();

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'reloadOrStop' } }));
    });
    await flushAsyncWork();

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_BROWSER_COMMAND_EVENT, { detail: { command: 'close' } }));
    });
    await flushAsyncWork();

    expect(goBackWorkbenchBrowser).toHaveBeenCalledWith(expect.objectContaining({ sessionKey: expect.stringMatching(/^@global:tab-/) }));
    expect(reloadWorkbenchBrowser).toHaveBeenCalledWith(expect.objectContaining({ sessionKey: expect.stringMatching(/^@global:tab-/) }));
    expect(onNewTab).toHaveBeenCalledTimes(1);
    expect(onReopenTab).toHaveBeenCalledTimes(1);
    expect(onCloseCurrentTab).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
