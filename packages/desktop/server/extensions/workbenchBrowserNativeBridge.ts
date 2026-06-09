/**
 * Native-process workbench browser bridge.
 *
 * Creates a WorkbenchBrowserToolHost proxy that sends native-workbench-browser-request
 * messages to the parent process via IPC (process.send). This allows child processes
 * such as the extension host to access browser operations without the global symbol
 * being set directly.
 */
import type { WorkbenchBrowserToolHost } from './workbenchBrowserToolHost.js';

const NATIVE_REQUEST_TIMEOUT_MS = 30_000;

interface NativeWorkbenchBrowserRequest {
  type: 'native-workbench-browser-request';
  id: string;
  method: string;
  args: unknown[];
}

interface NativeWorkbenchBrowserResponse {
  type: 'native-workbench-browser-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function createNativeProcessWorkbenchBrowserBridge(proc: {
  send?: (message: unknown) => boolean;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
}): WorkbenchBrowserToolHost {
  const pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
  >();
  let nextRequestId = 0;

  proc.on?.('message', (message: unknown) => {
    if (message && typeof message === 'object' && (message as Record<string, unknown>).type === 'native-workbench-browser-response') {
      const response = message as NativeWorkbenchBrowserResponse;
      const pending = pendingRequests.get(response.id);
      if (!pending) return;
      pendingRequests.delete(response.id);
      clearTimeout(pending.timeout);
      if (response.ok) {
        pending.resolve(response.result);
      } else {
        pending.reject(new Error(response.error ?? 'Workbench Browser native bridge failed.'));
      }
    }
  });

  function sendRequest(method: string, args: unknown[]): Promise<unknown> {
    const id = String(++nextRequestId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Workbench Browser native bridge timed out for ${method}.`));
      }, NATIVE_REQUEST_TIMEOUT_MS);
      timeout.unref?.();

      pendingRequests.set(id, { resolve, reject, timeout });

      const request: NativeWorkbenchBrowserRequest = {
        type: 'native-workbench-browser-request',
        id,
        method,
        args,
      };

      try {
        const sent = proc.send?.(request) ?? false;
        if (!sent) {
          pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(new Error('Workbench Browser native bridge send failed: parent process unavailable.'));
        }
      } catch (error) {
        pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return {
    isActive: (conversationId: string) => sendRequest('isActive', [conversationId]) as Promise<boolean>,
    listTabs: () => sendRequest('listTabs', []) as Promise<Array<{ sessionKey: string; url: string; title: string }>>,
    snapshot: (conversationId: string, tabId?: string) => sendRequest('snapshot', [conversationId, tabId]) as Promise<unknown>,
    screenshot: (conversationId: string, tabId?: string) => sendRequest('screenshot', [conversationId, tabId]) as Promise<unknown>,
    cdp: (input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }) =>
      sendRequest('cdp', [input]) as Promise<unknown>,
  };
}
