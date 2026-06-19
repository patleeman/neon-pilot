// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createNativeBrowserClient, createNativeWorkbenchClient } from './nativeClientWorkbench';

const desktopBridgeMock = vi.hoisted(() => ({
  getDesktopBridge: vi.fn(),
}));

vi.mock('../desktop/desktopBridge', () => desktopBridgeMock);

describe('native extension workbench client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes detail state by extension and surface', () => {
    const first = createNativeWorkbenchClient('first');
    const second = createNativeWorkbenchClient('second');

    first.setDetailState('panel', { selected: 'a' });
    second.setDetailState('panel', { selected: 'b' });

    expect(first.getDetailState('panel')).toEqual({ selected: 'a' });
    expect(second.getDetailState('panel')).toEqual({ selected: 'b' });
  });

  it('publishes close-tab events', () => {
    const listener = vi.fn();
    window.addEventListener('pa:workbench-close-tab', listener);

    createNativeWorkbenchClient('demo').closeTab('tab-1');

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { tabId: 'tab-1' } }));
    window.removeEventListener('pa:workbench-close-tab', listener);
  });
});

describe('native extension browser client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes browser operations through desktop bridge session keys', async () => {
    const bridge = {
      navigateWorkbenchBrowser: vi.fn(async (input) => ({ url: input.url, sessionKey: input.sessionKey })),
    };
    desktopBridgeMock.getDesktopBridge.mockReturnValue(bridge);

    await expect(createNativeBrowserClient().open({ url: 'https://example.test', tabId: 'tab-1' })).resolves.toEqual({
      url: 'https://example.test',
      sessionKey: 'workbench-browser:tab-1',
    });
  });

  it('throws a clear error when browser primitives are unavailable', async () => {
    desktopBridgeMock.getDesktopBridge.mockReturnValue(null);

    expect(() => createNativeBrowserClient().reload()).toThrow('Browser primitives are only available');
  });
});
