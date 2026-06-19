const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');
const WORKBENCH_BROWSER_TOOL_HOST_KEY = Symbol.for('neon-pilot.workbenchBrowserToolHost');
const WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY = Symbol.for('neon-pilot.workbenchBrowserNativeBridgeAttempted');
const NATIVE_REQUEST_TIMEOUT_MS = 30_000;

export interface WorkbenchBrowserToolHost {
  isActive(conversationId: string): Promise<boolean>;
  listTabs(): Promise<Array<{ sessionKey: string; url: string; title: string }>>;
  snapshot(conversationId: string, tabId?: string): Promise<unknown>;
  screenshot(conversationId: string, tabId?: string): Promise<unknown>;
  cdp(input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }): Promise<unknown>;
}

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
  [WORKBENCH_BROWSER_TOOL_HOST_KEY]?: WorkbenchBrowserToolHost | null;
  [WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY]?: true;
};

interface NativeWorkbenchBrowserResponse {
  type: 'native-workbench-browser-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface NativeWorkbenchBrowserProcess {
  send?: (message: unknown) => boolean;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

function inProcessWorkbenchBrowserToolHost(): WorkbenchBrowserToolHost | null {
  const hostGlobal = globalThis as ExtensionBackendApiGlobal;
  const existing = hostGlobal[WORKBENCH_BROWSER_TOOL_HOST_KEY];
  if (existing !== undefined) return existing;

  const nativeBridge = createNativeProcessWorkbenchBrowserBridge();
  hostGlobal[WORKBENCH_BROWSER_TOOL_HOST_KEY] = nativeBridge;
  return nativeBridge;
}

function createNativeProcessWorkbenchBrowserBridge(): WorkbenchBrowserToolHost | null {
  const hostGlobal = globalThis as ExtensionBackendApiGlobal;
  if (hostGlobal[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY]) return null;
  hostGlobal[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY] = true;

  if (typeof process === 'undefined' || typeof process.send !== 'function') return null;

  const proc = process as NodeJS.Process & NativeWorkbenchBrowserProcess;
  if (typeof proc.send !== 'function') return null;

  const pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
  >();
  let nextRequestId = 0;

  proc.on?.('message', (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    if ((message as Record<string, unknown>).type !== 'native-workbench-browser-response') return;
    const response = message as NativeWorkbenchBrowserResponse;
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.error ?? 'Workbench Browser native bridge failed.'));
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

      try {
        const sent =
          proc.send?.({
            type: 'native-workbench-browser-request',
            id,
            method,
            args,
          }) ?? false;
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
    cdp: (input: Parameters<WorkbenchBrowserToolHost['cdp']>[0]) => sendRequest('cdp', [input]) as Promise<unknown>,
  };
}

function createWorkerWorkbenchBrowserToolHost(
  bridge: NonNullable<ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE]>,
): WorkbenchBrowserToolHost {
  return {
    isActive: (conversationId: string) => bridge('browser', 'isActive', { conversationId }) as Promise<boolean>,
    listTabs: () => bridge('browser', 'listTabs', {}) as ReturnType<WorkbenchBrowserToolHost['listTabs']>,
    snapshot: (conversationId: string, tabId?: string) =>
      bridge('browser', 'snapshot', { conversationId, ...(tabId ? { tabId } : {}) }) as ReturnType<WorkbenchBrowserToolHost['snapshot']>,
    screenshot: (conversationId: string, tabId?: string) =>
      bridge('browser', 'screenshot', { conversationId, ...(tabId ? { tabId } : {}) }) as ReturnType<
        WorkbenchBrowserToolHost['screenshot']
      >,
    cdp: (input: Parameters<WorkbenchBrowserToolHost['cdp']>[0]) =>
      bridge('browser', 'cdp', input) as ReturnType<WorkbenchBrowserToolHost['cdp']>,
  };
}

export function getWorkbenchBrowserToolHost(): WorkbenchBrowserToolHost | null {
  const bridge = workerBridge();
  if (bridge) return createWorkerWorkbenchBrowserToolHost(bridge);
  return inProcessWorkbenchBrowserToolHost();
}
