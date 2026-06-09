import {
  getWorkbenchBrowserToolHost as getInProcessWorkbenchBrowserToolHost,
  type WorkbenchBrowserToolHost,
} from '../workbenchBrowserToolHost.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
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
    cdp: (input) => bridge('browser', 'cdp', input) as ReturnType<WorkbenchBrowserToolHost['cdp']>,
  };
}

export type { WorkbenchBrowserToolHost };

export function getWorkbenchBrowserToolHost(): WorkbenchBrowserToolHost | null {
  const bridge = workerBridge();
  if (bridge) return createWorkerWorkbenchBrowserToolHost(bridge);
  return getInProcessWorkbenchBrowserToolHost();
}
