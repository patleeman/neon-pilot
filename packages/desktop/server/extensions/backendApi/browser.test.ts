import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');
const WORKBENCH_BROWSER_TOOL_HOST_KEY = Symbol.for('neon-pilot.workbenchBrowserToolHost');
const WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY = Symbol.for('neon-pilot.workbenchBrowserNativeBridgeAttempted');

describe('backendApi/browser', () => {
  const originalProcessSend = process.send;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.send = originalProcessSend;
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
    delete (globalThis as Record<symbol, unknown>)[WORKBENCH_BROWSER_TOOL_HOST_KEY];
    delete (globalThis as Record<symbol, unknown>)[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY];
  });

  it('falls back to the installed in-process workbench browser host outside worker requests', async () => {
    const host = { listTabs: vi.fn() };
    (globalThis as Record<symbol, unknown>)[WORKBENCH_BROWSER_TOOL_HOST_KEY] = host;
    const browser = await import('./browser.js');

    expect(browser.getWorkbenchBrowserToolHost()).toBe(host);
  });

  it('returns null outside worker requests when no in-process host is installed', async () => {
    process.send = undefined;
    const browser = await import('./browser.js');

    expect(browser.getWorkbenchBrowserToolHost()).toBeNull();
  });

  it('falls back to a native child-process bridge when process IPC is available', async () => {
    const send = vi.fn((message: unknown) => {
      queueMicrotask(() => {
        process.emit('message', {
          type: 'native-workbench-browser-response',
          id: (message as { id: string }).id,
          ok: true,
          result: [{ sessionKey: 'tab-1', url: 'https://example.com', title: 'Example' }],
        });
      });
      return true;
    });
    process.send = send;
    const browser = await import('./browser.js');
    const host = browser.getWorkbenchBrowserToolHost();

    await expect(host?.listTabs()).resolves.toEqual([{ sessionKey: 'tab-1', url: 'https://example.com', title: 'Example' }]);
    expect(send).toHaveBeenCalledWith({ type: 'native-workbench-browser-request', id: '1', method: 'listTabs', args: [] });
  });

  it('routes browser host operations through the worker capability bridge when available', async () => {
    const bridge = vi.fn(async (_capability: string, operation: string, input?: unknown) => ({ operation, input }));
    const host = { listTabs: vi.fn() };
    (globalThis as Record<symbol, unknown>)[WORKBENCH_BROWSER_TOOL_HOST_KEY] = host;
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const browser = await import('./browser.js');
    const browserHost = browser.getWorkbenchBrowserToolHost();

    await expect(browserHost?.isActive('conv-1')).resolves.toEqual({ operation: 'isActive', input: { conversationId: 'conv-1' } });
    await expect(browserHost?.listTabs()).resolves.toEqual({ operation: 'listTabs', input: {} });
    await expect(browserHost?.snapshot('conv-1', 'tab-1')).resolves.toEqual({
      operation: 'snapshot',
      input: { conversationId: 'conv-1', tabId: 'tab-1' },
    });
    await expect(browserHost?.screenshot('conv-1')).resolves.toEqual({ operation: 'screenshot', input: { conversationId: 'conv-1' } });
    await expect(browserHost?.cdp({ tabId: 'tab-1', command: { method: 'Runtime.evaluate' } })).resolves.toEqual({
      operation: 'cdp',
      input: { tabId: 'tab-1', command: { method: 'Runtime.evaluate' } },
    });

    expect(bridge).toHaveBeenNthCalledWith(1, 'browser', 'isActive', { conversationId: 'conv-1' });
    expect(bridge).toHaveBeenNthCalledWith(2, 'browser', 'listTabs', {});
    expect(bridge).toHaveBeenNthCalledWith(3, 'browser', 'snapshot', { conversationId: 'conv-1', tabId: 'tab-1' });
    expect(bridge).toHaveBeenNthCalledWith(4, 'browser', 'screenshot', { conversationId: 'conv-1' });
    expect(bridge).toHaveBeenNthCalledWith(5, 'browser', 'cdp', { tabId: 'tab-1', command: { method: 'Runtime.evaluate' } });
    expect(host.listTabs).not.toHaveBeenCalled();
  });
});
