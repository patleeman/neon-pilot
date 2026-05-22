import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWorkbenchBrowserToolHost, setWorkbenchBrowserToolHost, type WorkbenchBrowserToolHost } from './workbenchBrowserToolHost.js';

describe('workbenchBrowserToolHost', () => {
  afterEach(() => {
    setWorkbenchBrowserToolHost(null);
  });

  it('returns null when no browser host is installed', () => {
    setWorkbenchBrowserToolHost(null);

    expect(getWorkbenchBrowserToolHost()).toBeNull();
  });

  it('stores and returns the global workbench browser host', async () => {
    const host: WorkbenchBrowserToolHost = {
      isActive: vi.fn().mockResolvedValue(true),
      listTabs: vi.fn().mockResolvedValue([{ sessionKey: 'tab-1', url: 'https://example.com', title: 'Example' }]),
      snapshot: vi.fn().mockResolvedValue({ snapshot: true }),
      screenshot: vi.fn().mockResolvedValue({ image: true }),
      cdp: vi.fn().mockResolvedValue({ ok: true }),
    };

    setWorkbenchBrowserToolHost(host);

    expect(getWorkbenchBrowserToolHost()).toBe(host);
    await expect(getWorkbenchBrowserToolHost()?.isActive('conversation-1')).resolves.toBe(true);
    await expect(getWorkbenchBrowserToolHost()?.listTabs()).resolves.toEqual([
      { sessionKey: 'tab-1', url: 'https://example.com', title: 'Example' },
    ]);
  });
});
