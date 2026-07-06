import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callServerModuleExport } = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport,
}));

import { captureDesktopScreenshot, controlDesktop, readDesktopState, readDesktopUserActionEvents } from './desktop.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

const extensionBackendApiGlobal = globalThis as typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

describe('backendApi/desktop', () => {
  beforeEach(() => {
    callServerModuleExport.mockReset();
    delete extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('requires an active extension capability bridge before desktop user-action event reads', async () => {
    await expect(readDesktopUserActionEvents({ lastEventId: 'prev-1' })).rejects.toThrow(
      'Desktop control requires an active extension host capability bridge.',
    );
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('forwards desktop user-action event reads through the active extension capability bridge', async () => {
    const events = [
      {
        id: 'desktop-user-action-test-1',
        source: 'user' as const,
        action: 'focus',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
    ];
    const bridge = vi.fn().mockResolvedValue(events);
    extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(readDesktopUserActionEvents({ lastEventId: 'prev-1' })).resolves.toEqual(events);
    expect(bridge).toHaveBeenCalledWith('desktop', 'events', {
      lastEventId: 'prev-1',
    });
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('requires an active extension capability bridge before desktop state reads', async () => {
    await expect(readDesktopState()).rejects.toThrow('Desktop control requires an active extension host capability bridge.');
    expect(callServerModuleExport).not.toHaveBeenCalled();
  });

  it('forwards desktop state reads through the active extension capability bridge', async () => {
    const state = {
      windows: [],
      focusedWindowId: null,
      theme: null,
      publishedAt: null,
      revision: null,
      publisherId: null,
    };
    const bridge = vi.fn().mockResolvedValue(state);
    extensionBackendApiGlobal[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(readDesktopState()).resolves.toEqual(state);
    expect(bridge).toHaveBeenCalledWith('desktop', 'state');
    expect(callServerModuleExport).not.toHaveBeenCalled();
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
