import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalBackendProcesses, type LocalBackendWorkbenchBrowserToolHost } from './local-backend-processes.js';

function createHost(): LocalBackendWorkbenchBrowserToolHost {
  return {
    isActive: vi.fn().mockResolvedValue(true),
    listTabs: vi.fn().mockResolvedValue([{ sessionKey: 'tab-1', url: 'https://example.com/', title: 'Example' }]),
    snapshot: vi.fn().mockResolvedValue({ title: 'Snapshot' }),
    screenshot: vi.fn().mockResolvedValue({ data: 'image' }),
    cdp: vi.fn().mockResolvedValue({ value: 42 }),
  };
}

async function handleNativeRequest(
  backend: LocalBackendProcesses,
  request: { id: string; method: string; args: unknown[] },
): Promise<unknown> {
  const child = { send: vi.fn() };
  await (
    backend as unknown as {
      handleNativeWorkbenchBrowserRequest(
        child: { send: ReturnType<typeof vi.fn> },
        request: { type: 'native-workbench-browser-request'; id: string; method: string; args: unknown[] },
      ): Promise<void>;
    }
  ).handleNativeWorkbenchBrowserRequest(child, {
    type: 'native-workbench-browser-request',
    ...request,
  });
  return child.send.mock.calls.at(-1)?.[0];
}

describe('LocalBackendProcesses', () => {
  const originalStderrWrite = process.stderr.write;

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
  });

  it('starts', async () => {
    const backend = new LocalBackendProcesses();
    expect(backend).toBeDefined();
  });

  it('routes native Workbench Browser requests to the registered host', async () => {
    const backend = new LocalBackendProcesses();
    const host = createHost();
    backend.setWorkbenchBrowserToolHost(host);

    await expect(handleNativeRequest(backend, { id: 'active', method: 'isActive', args: ['conversation-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'active',
      ok: true,
      result: true,
    });
    await expect(handleNativeRequest(backend, { id: 'tabs', method: 'listTabs', args: [] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'tabs',
      ok: true,
      result: [{ sessionKey: 'tab-1', url: 'https://example.com/', title: 'Example' }],
    });
    await expect(handleNativeRequest(backend, { id: 'snapshot', method: 'snapshot', args: ['conversation-1', 'tab-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'snapshot',
      ok: true,
      result: { title: 'Snapshot' },
    });
    await expect(
      handleNativeRequest(backend, { id: 'screenshot', method: 'screenshot', args: ['conversation-1', 'tab-1'] }),
    ).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'screenshot',
      ok: true,
      result: { data: 'image' },
    });
    await expect(
      handleNativeRequest(backend, {
        id: 'cdp',
        method: 'cdp',
        args: [{ conversationId: 'conversation-1', command: { method: 'Runtime.evaluate' }, tabId: 'tab-1' }],
      }),
    ).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'cdp',
      ok: true,
      result: { value: 42 },
    });

    expect(host.isActive).toHaveBeenCalledWith('conversation-1');
    expect(host.listTabs).toHaveBeenCalledTimes(1);
    expect(host.snapshot).toHaveBeenCalledWith('conversation-1', 'tab-1');
    expect(host.screenshot).toHaveBeenCalledWith('conversation-1', 'tab-1');
    expect(host.cdp).toHaveBeenCalledWith({ conversationId: 'conversation-1', command: { method: 'Runtime.evaluate' }, tabId: 'tab-1' });
  });

  it('rejects native Workbench Browser requests when no host is registered', async () => {
    const backend = new LocalBackendProcesses();
    const stderrWrite = vi.fn();
    process.stderr.write = stderrWrite as unknown as typeof process.stderr.write;

    await expect(handleNativeRequest(backend, { id: 'missing', method: 'snapshot', args: ['conversation-1'] })).resolves.toEqual({
      type: 'native-workbench-browser-response',
      id: 'missing',
      ok: false,
      error: 'Workbench Browser native host is unavailable.',
    });
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Workbench Browser native snapshot failed after'));
  });

  it('validates native Workbench Browser request methods before dispatch', () => {
    const backend = new LocalBackendProcesses();
    const isRequest = (
      backend as unknown as {
        isNativeWorkbenchBrowserRequest(value: unknown): boolean;
      }
    ).isNativeWorkbenchBrowserRequest.bind(backend);

    expect(isRequest({ type: 'native-workbench-browser-request', id: 'ok', method: 'cdp', args: [] })).toBe(true);
    expect(isRequest({ type: 'native-workbench-browser-request', id: 'bad', method: 'unknown', args: [] })).toBe(false);
  });
});
