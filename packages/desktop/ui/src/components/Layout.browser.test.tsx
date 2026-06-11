// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { type BrowserTabItem, type BrowserTabsState, readBrowserTabsState } from '../local/workbenchBrowserTabs';
import { WorkbenchBrowserTab } from './workbench/WorkbenchBrowserTab';

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
});
