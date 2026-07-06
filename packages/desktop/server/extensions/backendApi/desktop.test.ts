import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callServerModuleExport } = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport,
}));

import { captureDesktopScreenshot, controlDesktop, readDesktopState } from './desktop.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

const extensionBackendApiGlobal = globalThis as typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

describe('backendApi/desktop', () => {
  beforeEach(() => {
    callServerModuleExport.mockReset();
    delete extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE];
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

  it('requires an active extension capability bridge before desktop control commands', async () => {
    await expect(controlDesktop({ action: 'focus', windowId: 'chat:draft' })).rejects.toThrow(
      'Desktop control requires an active extension host capability bridge.',
    );
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('forwards desktop control commands through the active extension capability bridge', async () => {
    const result = {
      ok: true,
      commandId: 'desktop-control-1',
      action: 'focus',
      status: 'completed',
    };
    const bridge = vi.fn().mockResolvedValue(result);
    extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(controlDesktop({ action: 'focus', windowId: 'chat:draft' })).resolves.toEqual(result);
    expect(bridge).toHaveBeenCalledWith('desktop', 'control', {
      action: 'focus',
      windowId: 'chat:draft',
    });
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('requires an active extension capability bridge before desktop screenshot requests', async () => {
    await expect(captureDesktopScreenshot({ windowId: 'chat:draft' })).rejects.toThrow(
      'Desktop control requires an active extension host capability bridge.',
    );
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('forwards desktop screenshot requests through the active extension capability bridge', async () => {
    const result = {
      ok: true,
      requestId: 'desktop-screenshot-1',
      status: 'completed',
      image: { mimeType: 'image/png', data: 'cG5n', width: 320, height: 200, capturedAt: '2026-07-05T00:00:00.000Z' },
    };
    const bridge = vi.fn().mockResolvedValue(result);
    extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(captureDesktopScreenshot({ windowId: 'chat:draft' })).resolves.toEqual(result);
    expect(bridge).toHaveBeenCalledWith('desktop', 'screenshot', { windowId: 'chat:draft' });
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });
});
