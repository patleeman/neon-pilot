import { beforeEach, describe, expect, it, vi } from 'vitest';

const inProcess = vi.hoisted(() => ({ getWorkbenchBrowserToolHost: vi.fn() }));

vi.mock('../workbenchBrowserToolHost.js', () => inProcess);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/browser', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('falls back to the in-process workbench browser host outside worker requests', async () => {
    const host = { listTabs: vi.fn() };
    inProcess.getWorkbenchBrowserToolHost.mockReturnValue(host);
    const browser = await import('./browser.js');

    expect(browser.getWorkbenchBrowserToolHost()).toBe(host);
    expect(inProcess.getWorkbenchBrowserToolHost).toHaveBeenCalledOnce();
  });

  it('routes browser host operations through the worker capability bridge when available', async () => {
    const bridge = vi.fn(async (_capability: string, operation: string, input?: unknown) => ({ operation, input }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const browser = await import('./browser.js');
    const host = browser.getWorkbenchBrowserToolHost();

    await expect(host?.isActive('conv-1')).resolves.toEqual({ operation: 'isActive', input: { conversationId: 'conv-1' } });
    await expect(host?.listTabs()).resolves.toEqual({ operation: 'listTabs', input: {} });
    await expect(host?.snapshot('conv-1', 'tab-1')).resolves.toEqual({
      operation: 'snapshot',
      input: { conversationId: 'conv-1', tabId: 'tab-1' },
    });
    await expect(host?.screenshot('conv-1')).resolves.toEqual({ operation: 'screenshot', input: { conversationId: 'conv-1' } });
    await expect(host?.cdp({ tabId: 'tab-1', method: 'Runtime.evaluate' })).resolves.toEqual({
      operation: 'cdp',
      input: { tabId: 'tab-1', method: 'Runtime.evaluate' },
    });

    expect(bridge).toHaveBeenNthCalledWith(1, 'browser', 'isActive', { conversationId: 'conv-1' });
    expect(bridge).toHaveBeenNthCalledWith(2, 'browser', 'listTabs', {});
    expect(bridge).toHaveBeenNthCalledWith(3, 'browser', 'snapshot', { conversationId: 'conv-1', tabId: 'tab-1' });
    expect(bridge).toHaveBeenNthCalledWith(4, 'browser', 'screenshot', { conversationId: 'conv-1' });
    expect(bridge).toHaveBeenNthCalledWith(5, 'browser', 'cdp', { tabId: 'tab-1', method: 'Runtime.evaluate' });
    expect(inProcess.getWorkbenchBrowserToolHost).not.toHaveBeenCalled();
  });
});
