import { type DesktopWorkbenchBrowserState, getDesktopBridge } from '../desktop/desktopBridge';

function browserSessionKey(tabId?: string | null): string | null {
  return tabId ? `workbench-browser:${tabId}` : null;
}

function requireDesktopBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error('Browser primitives are only available in the Electron desktop app.');
  return bridge;
}

const detailStateByExtensionSurface = new Map<string, unknown>();

function detailStateKey(extensionId: string, surfaceId: string): string {
  return `${extensionId}:${surfaceId}`;
}

export function createNativeWorkbenchClient(extensionId: string) {
  return {
    getDetailState<T = unknown>(surfaceId: string): T | null {
      return (detailStateByExtensionSurface.get(detailStateKey(extensionId, surfaceId)) as T | undefined) ?? null;
    },
    setDetailState(surfaceId: string, state: unknown): void {
      detailStateByExtensionSurface.set(detailStateKey(extensionId, surfaceId), state);
      window.dispatchEvent(new CustomEvent('neon-pilot-extension-workbench-detail-state', { detail: { extensionId, surfaceId, state } }));
    },
    closeTab(tabId?: string | null): void {
      window.dispatchEvent(new CustomEvent('pa:workbench-close-tab', { detail: { tabId } }));
    },
  };
}

export function createNativeBrowserClient() {
  return {
    isAvailable(): boolean {
      return getDesktopBridge() !== null;
    },
    getState(input?: { tabId?: string | null }): Promise<DesktopWorkbenchBrowserState | null> {
      return requireDesktopBridge().getWorkbenchBrowserState({ sessionKey: browserSessionKey(input?.tabId) });
    },
    open(input: { url: string; tabId?: string | null }): Promise<DesktopWorkbenchBrowserState> {
      return requireDesktopBridge().navigateWorkbenchBrowser({ url: input.url, sessionKey: browserSessionKey(input.tabId) });
    },
    goBack(input?: { tabId?: string | null }): Promise<DesktopWorkbenchBrowserState> {
      return requireDesktopBridge().goBackWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    goForward(input?: { tabId?: string | null }): Promise<DesktopWorkbenchBrowserState> {
      return requireDesktopBridge().goForwardWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    reload(input?: { tabId?: string | null }): Promise<DesktopWorkbenchBrowserState> {
      return requireDesktopBridge().reloadWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    stop(input?: { tabId?: string | null }): Promise<DesktopWorkbenchBrowserState> {
      return requireDesktopBridge().stopWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
    snapshot(input?: { tabId?: string | null }): Promise<unknown> {
      return requireDesktopBridge().snapshotWorkbenchBrowser({ sessionKey: browserSessionKey(input?.tabId) });
    },
  };
}
