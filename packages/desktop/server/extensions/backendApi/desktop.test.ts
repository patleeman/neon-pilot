import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callServerModuleExport } = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport,
}));

import { captureDesktopScreenshot, controlDesktop, readDesktopState } from './desktop.js';

describe('backendApi/desktop', () => {
  beforeEach(() => {
    callServerModuleExport.mockReset();
  });

  it('forwards desktop state reads through the server module resolver', async () => {
    const state = {
      windows: [],
      focusedWindowId: null,
      theme: null,
      publishedAt: null,
      revision: null,
      publisherId: null,
    };
    callServerModuleExport.mockResolvedValue(state);

    await expect(readDesktopState()).resolves.toEqual(state);
    expect(callServerModuleExport).toHaveBeenCalledWith('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
  });

  it('forwards desktop control commands through the server module resolver', async () => {
    const result = {
      ok: true,
      commandId: 'desktop-control-1',
      action: 'focus',
      status: 'completed',
    };
    callServerModuleExport.mockResolvedValue(result);

    await expect(controlDesktop({ action: 'focus', windowId: 'chat:draft' })).resolves.toEqual(result);
    expect(callServerModuleExport).toHaveBeenCalledWith('../../desktop/desktopControl.js', 'issueDesktopControlCommand', {
      action: 'focus',
      windowId: 'chat:draft',
    });
  });

  it('forwards desktop screenshot requests through the server module resolver', async () => {
    const result = {
      ok: true,
      requestId: 'desktop-screenshot-1',
      status: 'completed',
      image: { mimeType: 'image/png', data: 'cG5n', width: 320, height: 200, capturedAt: '2026-07-05T00:00:00.000Z' },
    };
    callServerModuleExport.mockResolvedValue(result);

    await expect(captureDesktopScreenshot({ windowId: 'chat:draft' })).resolves.toEqual(result);
    expect(callServerModuleExport).toHaveBeenCalledWith('../../desktop/desktopScreenshot.js', 'issueDesktopScreenshotRequest', {
      windowId: 'chat:draft',
    });
  });
});
