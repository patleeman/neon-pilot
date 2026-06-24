// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_TABS_CHANGED_EVENT, type BrowserTabsState, readBrowserTabsState, writeBrowserTabsState } from './workbenchBrowserTabs';

function tab(id: string, url = `https://${id}.example/`) {
  return {
    id,
    title: id,
    url,
    urlDraft: url,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('workbench browser tabs state', () => {
  it('preserves tabs added by host commands when an extension republishes a stale snapshot', async () => {
    const first = tab('first');
    const second = tab('second');
    const current: BrowserTabsState = {
      version: 1,
      tabs: [first, second],
      activeTabId: 'second',
      closedTabs: [],
    };
    window.localStorage.setItem('pa:workbench-browser-tabs', JSON.stringify(current));
    const correctedEvents: BrowserTabsState[] = [];
    window.addEventListener(BROWSER_TABS_CHANGED_EVENT, (event) => {
      correctedEvents.push((event as CustomEvent<BrowserTabsState>).detail);
    });

    writeBrowserTabsState({
      version: 1,
      tabs: [{ ...first, title: 'First updated' }],
      activeTabId: 'first',
      closedTabs: [],
    });
    await Promise.resolve();

    const state = readBrowserTabsState();
    expect(state.tabs).toEqual([expect.objectContaining({ id: 'first', title: 'First updated' }), second]);
    expect(state.activeTabId).toBe('second');
    expect(correctedEvents).toEqual([expect.objectContaining({ activeTabId: 'second', tabs: expect.arrayContaining([second]) })]);
  });

  it('guards raw localStorage writes from older bundled browser extensions', async () => {
    const first = tab('first');
    const second = tab('second');
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        tabs: [first, second],
        activeTabId: 'second',
        closedTabs: [],
      } satisfies BrowserTabsState),
    );

    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        tabs: [{ ...first, title: 'First updated' }],
        activeTabId: 'first',
        closedTabs: [],
      } satisfies BrowserTabsState),
    );
    await Promise.resolve();

    expect(readBrowserTabsState()).toEqual({
      version: 1,
      tabs: [{ ...first, title: 'First updated' }, second],
      activeTabId: 'second',
      closedTabs: [],
    });
  });

  it('does not preserve a missing tab when the next state explicitly closes it', () => {
    const first = tab('first');
    const second = tab('second');
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        tabs: [first, second],
        activeTabId: 'second',
        closedTabs: [],
      } satisfies BrowserTabsState),
    );

    writeBrowserTabsState({
      version: 1,
      tabs: [first],
      activeTabId: 'first',
      closedTabs: [second],
    });

    expect(readBrowserTabsState()).toEqual({
      version: 1,
      tabs: [first],
      activeTabId: 'first',
      closedTabs: [second],
    });
  });

  it('normalizes older extension writes that omit the version field', () => {
    const first = tab('first');

    writeBrowserTabsState({
      tabs: [first],
      activeTabId: 'first',
      closedTabs: [],
    } as BrowserTabsState);

    expect(readBrowserTabsState()).toEqual({
      version: 1,
      tabs: [first],
      activeTabId: 'first',
      closedTabs: [],
    });
  });
});
