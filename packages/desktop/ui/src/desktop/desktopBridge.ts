import type { DesktopAppPreferencesState, DesktopEnvironmentState, DesktopNavigationState, FolderPickerResult } from '../shared/types';

export const DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT = 'neon-pilot-desktop-workbench-browser-comment';
export const DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT = 'neon-pilot-desktop-show-workbench-browser';

interface DesktopScreenshotCaptureResult {
  cancelled: boolean;
  image?: {
    name?: string;
    mimeType: string;
    data: string;
  };
}

interface DesktopWorkbenchBrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopWorkbenchBrowserState {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  active?: boolean;
  browserRevision?: number;
  lastSnapshotRevision?: number;
  changedSinceLastSnapshot?: boolean;
  lastChangeReason?: string;
  lastChangedAt?: string;
}

interface DesktopWorkbenchBrowserSnapshot extends DesktopWorkbenchBrowserState {
  text: string;
}

export interface DesktopWorkbenchBrowserCommentTarget {
  url: string;
  title: string;
  selector?: string;
  xpath?: string;
  role?: string;
  accessibleName?: string;
  testId?: string;
  textSnippet?: string;
  surroundingText?: string;
  elementHtmlPreview?: string;
  pageTextQuote?: string;
  viewportRect: { x: number; y: number; width: number; height: number };
  scroll: { x: number; y: number };
  devicePixelRatio: number;
}

export interface NeonPilotDesktopBridge {
  getEnvironment(): Promise<DesktopEnvironmentState>;
  getNavigationState(): Promise<DesktopNavigationState>;
  openNewConversation(): Promise<void>;
  openConversationPopout(input: { conversationId: string }): Promise<void>;
  openPath(targetPath: string): Promise<{ path: string; opened: boolean; error?: string }>;
  openExternalUrl(targetUrl: string): Promise<{ url: string; opened: boolean; error?: string }>;
  writeClipboardText(text: string): Promise<{ ok: true } | { ok: false; error?: string }>;
  readDesktopAppPreferences(): Promise<DesktopAppPreferencesState>;
  updateDesktopAppPreferences(input: {
    autoInstallUpdates?: boolean;
    updatePath?: 'stable' | 'test';
    startOnSystemStart?: boolean;
    keyboardShortcuts?: Record<string, string>;
  }): Promise<DesktopAppPreferencesState>;
  checkForUpdates(): Promise<DesktopAppPreferencesState>;
  pickFolder(input?: { cwd?: string | null; prompt?: string | null }): Promise<FolderPickerResult>;
  // Native OS screenshot picker. Kept on IPC because Electron owns the UI;
  // main process rejects oversized image payloads before base64 transfer.
  captureScreenshot(): Promise<DesktopScreenshotCaptureResult>;
  goBack(): Promise<DesktopNavigationState>;
  goForward(): Promise<DesktopNavigationState>;
  setWorkbenchBrowserBounds(input: {
    visible: boolean;
    sessionKey?: string | null;
    bounds?: DesktopWorkbenchBrowserBounds;
    deactivate?: boolean;
  }): Promise<DesktopWorkbenchBrowserState | null>;
  getWorkbenchBrowserState(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState | null>;
  navigateWorkbenchBrowser(input: { url: string; sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState>;
  goBackWorkbenchBrowser(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState>;
  goForwardWorkbenchBrowser(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState>;
  reloadWorkbenchBrowser(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState>;
  stopWorkbenchBrowser(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserState>;
  snapshotWorkbenchBrowser(input?: { sessionKey?: string | null }): Promise<DesktopWorkbenchBrowserSnapshot>;
}

let tauriDesktopBridge: NeonPilotDesktopBridge | null = null;

function getTauriInvoke(): (<T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>) | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__TAURI_INTERNALS__?.invoke ?? null;
}

function unsupportedWorkbenchBrowser(method: string): never {
  throw new Error(`Workbench Browser native embedding is not available in the Tauri shell yet: ${method}.`);
}

function readBrowserNavigationState(): DesktopNavigationState {
  return {
    canGoBack: typeof window !== 'undefined' ? window.history.length > 1 : false,
    canGoForward: false,
  };
}

function createTauriDesktopBridge(): NeonPilotDesktopBridge | null {
  const invoke = getTauriInvoke();
  if (!invoke) {
    return null;
  }

  tauriDesktopBridge ??= {
    getEnvironment: () => invoke<DesktopEnvironmentState>('get_environment'),
    getNavigationState: () => invoke<DesktopNavigationState>('get_navigation_state').catch(() => readBrowserNavigationState()),
    openNewConversation: async () => {
      window.location.assign('/conversations/new?desktop-shell=1');
    },
    openConversationPopout: async ({ conversationId }) => {
      window.location.assign(`/conversations/${encodeURIComponent(conversationId)}?desktop-shell=1`);
    },
    openPath: (targetPath) => invoke('open_path', { targetPath }),
    openExternalUrl: (targetUrl) => invoke('open_external_url', { targetUrl }),
    writeClipboardText: (text) => invoke('write_clipboard_text', { text }),
    readDesktopAppPreferences: () => invoke<DesktopAppPreferencesState>('read_desktop_app_preferences'),
    updateDesktopAppPreferences: (input) => invoke<DesktopAppPreferencesState>('update_desktop_app_preferences', { input }),
    checkForUpdates: () => invoke<DesktopAppPreferencesState>('check_for_updates'),
    pickFolder: (input) => invoke<FolderPickerResult>('pick_folder', { input }),
    captureScreenshot: async () => ({ cancelled: true }),
    goBack: async () => {
      window.history.back();
      return readBrowserNavigationState();
    },
    goForward: async () => {
      window.history.forward();
      return readBrowserNavigationState();
    },
    setWorkbenchBrowserBounds: async () => null,
    getWorkbenchBrowserState: async () => null,
    navigateWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('navigate'),
    goBackWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('goBack'),
    goForwardWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('goForward'),
    reloadWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('reload'),
    stopWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('stop'),
    snapshotWorkbenchBrowser: async () => unsupportedWorkbenchBrowser('snapshot'),
  };
  return tauriDesktopBridge;
}

export function getDesktopBridge(): NeonPilotDesktopBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const bridge = window.neonPilotDesktop ?? createTauriDesktopBridge();
  if (bridge && typeof document !== 'undefined' && document.documentElement.dataset.neonPilotDesktop !== '1') {
    document.documentElement.dataset.neonPilotDesktop = '1';
  }
  return bridge;
}

export function isDesktopShell(): boolean {
  if (getDesktopBridge() !== null) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('desktop-shell') === '1') {
      return true;
    }

    try {
      if (window.sessionStorage.getItem('__pa_desktop_shell__') === '1') {
        return true;
      }
    } catch {
      // Ignore storage failures.
    }
  }

  if (typeof document !== 'undefined' && document.documentElement.dataset.neonPilotDesktop === '1') {
    return true;
  }

  if (typeof navigator === 'undefined') {
    return false;
  }

  return /Electron/i.test(navigator.userAgent);
}

// App-owned context menus stay in-app on both web and desktop. The native
// Electron menu path caused hangs and split the UX between surfaces.
export function shouldUseNativeAppContextMenus(): boolean {
  return false;
}

// Desktop environment reads cross the Electron bridge and can trigger daemon
// status checks. Cache the in-flight result so route changes do not keep poking
// the desktop runtime while the user clicks around the app.
let desktopEnvironmentPromise: Promise<DesktopEnvironmentState | null> | null = null;
let desktopEnvironmentBridge: NeonPilotDesktopBridge | null = null;

export async function readDesktopEnvironment(): Promise<DesktopEnvironmentState | null> {
  const bridge = getDesktopBridge();
  if (!bridge) {
    desktopEnvironmentBridge = null;
    desktopEnvironmentPromise = null;
    return null;
  }

  if (desktopEnvironmentBridge === bridge && desktopEnvironmentPromise) {
    return desktopEnvironmentPromise;
  }

  desktopEnvironmentBridge = bridge;
  const request = bridge.getEnvironment().catch((error) => {
    if (desktopEnvironmentPromise === request) {
      desktopEnvironmentPromise = null;
      desktopEnvironmentBridge = null;
    }
    throw error;
  });
  desktopEnvironmentPromise = request;
  return request;
}
