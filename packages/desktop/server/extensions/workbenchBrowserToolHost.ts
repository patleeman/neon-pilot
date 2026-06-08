export interface WorkbenchBrowserToolHost {
  isActive(conversationId: string): Promise<boolean>;
  listTabs(): Promise<Array<{ sessionKey: string; url: string; title: string }>>;
  snapshot(conversationId: string, tabId?: string): Promise<unknown>;
  screenshot(conversationId: string, tabId?: string): Promise<unknown>;
  cdp(input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }): Promise<unknown>;
}

import { createNativeProcessWorkbenchBrowserBridge } from './workbenchBrowserNativeBridge.js';

const WORKBENCH_BROWSER_TOOL_HOST_KEY = Symbol.for('neon-pilot.workbenchBrowserToolHost');
const WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY = Symbol.for('neon-pilot.workbenchBrowserNativeBridgeAttempted');

type WorkbenchBrowserToolHostGlobal = typeof globalThis & {
  [WORKBENCH_BROWSER_TOOL_HOST_KEY]?: WorkbenchBrowserToolHost | null;
  [WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY]?: true;
};

function hostGlobal(): WorkbenchBrowserToolHostGlobal {
  return globalThis as WorkbenchBrowserToolHostGlobal;
}

export function setWorkbenchBrowserToolHost(nextHost: WorkbenchBrowserToolHost | null): void {
  hostGlobal()[WORKBENCH_BROWSER_TOOL_HOST_KEY] = nextHost;
}

export function getWorkbenchBrowserToolHost(): WorkbenchBrowserToolHost | null {
  const existing = hostGlobal()[WORKBENCH_BROWSER_TOOL_HOST_KEY];
  if (existing !== undefined) return existing;

  // Lazily create a native-process bridge when running as a child process
  // (e.g. extension-host-child) that forwards browser operations to the
  // parent process via IPC, matching the pattern in local-backend-child.ts.
  // Only attempt once per process lifecycle.
  if (hostGlobal()[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY]) {
    return null;
  }
  hostGlobal()[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY] = true;

  if (typeof process === 'undefined' || typeof process.send !== 'function') {
    return null;
  }

  // 'process.send' on Node.js child processes (child_process.fork)
  const proc = process as NodeJS.Process & { send?: (message: unknown) => boolean };
  if (typeof proc.send !== 'function') return null;

  const bridge = createNativeProcessWorkbenchBrowserBridge(proc);
  hostGlobal()[WORKBENCH_BROWSER_TOOL_HOST_KEY] = bridge;
  return bridge;
}
