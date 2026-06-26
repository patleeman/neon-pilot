import { contextBridge, ipcRenderer, webUtils } from 'electron';

const CHANNEL_PREFIX = 'neon-pilot-desktop';
const SHORTCUT_CHANNEL = `${CHANNEL_PREFIX}:shortcut`;
const SHORTCUT_EVENT = 'neon-pilot-desktop-shortcut';
const NAVIGATE_CHANNEL = `${CHANNEL_PREFIX}:navigate`;
const NAVIGATE_EVENT = 'neon-pilot-desktop-navigate';
const WORKBENCH_BROWSER_COMMENT_CHANNEL = `${CHANNEL_PREFIX}:workbench-browser-comment`;
const WORKBENCH_BROWSER_COMMENT_EVENT = 'neon-pilot-desktop-workbench-browser-comment';
const SHOW_WORKBENCH_BROWSER_CHANNEL = `${CHANNEL_PREFIX}:show-workbench-browser`;
const SHOW_WORKBENCH_BROWSER_EVENT = 'neon-pilot-desktop-show-workbench-browser';

interface DesktopShortcutPayload {
  action?: unknown;
  command?: string;
  args?: Record<string, unknown>;
}

function normalizeDesktopShortcutPayload(input: unknown): DesktopShortcutPayload {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const candidate = input as { action?: unknown; command?: unknown; args?: unknown };
    const command = typeof candidate.command === 'string' ? candidate.command.trim() : '';
    const args = candidate.args && typeof candidate.args === 'object' && !Array.isArray(candidate.args) ? candidate.args : undefined;
    if (command) {
      return { action: candidate.action, command, ...(args ? { args: args as Record<string, unknown> } : {}) };
    }
  }

  return { action: input, ...resolveDesktopShortcutCommand(input) };
}

function resolveDesktopShortcutCommand(action: unknown): { command: string; args?: Record<string, unknown> } | undefined {
  switch (action) {
    case 'close-conversation':
      return { command: 'conversation.close' };
    case 'reopen-closed-conversation':
      return { command: 'conversation.reopenClosed' };
    case 'previous-conversation':
      return { command: 'conversation.previous' };
    case 'next-conversation':
      return { command: 'conversation.next' };
    case 'toggle-conversation-pin':
      return { command: 'conversation.togglePinned' };
    case 'toggle-conversation-archive':
      return { command: 'conversation.toggleArchived' };
    case 'rename-conversation':
      return { command: 'conversation.rename' };
    case 'focus-composer':
      return { command: 'composer.focus' };
    case 'edit-working-directory':
      return { command: 'conversation.editCwd' };
    case 'find-in-page':
      return { command: 'page.find' };
    case 'toggle-sidebar':
      return { command: 'layout.toggleSidebar' };
    case 'toggle-right-rail':
      return { command: 'layout.toggleRightRail' };
    case 'toggle-layout-mode':
      return { command: 'layout.toggle' };
    case 'show-conversation-mode':
      return { command: 'layout.set', args: { mode: 'compact' } };
    case 'show-workbench-mode':
      return { command: 'layout.set', args: { mode: 'workbench' } };
    case 'new-workbench-tab':
      return { command: 'workbench.newTab' };
    case 'close-workbench-tab':
      return { command: 'workbench.closeActiveTab' };
    case 'close-workbench-file':
      return { command: 'workbench.closeActiveFile' };
    case 'refresh-workbench-file':
      return { command: 'workbench.refreshActiveFile' };
    case 'toggle-workbench-explorer':
      return { command: 'workbench.toggleExplorer' };
    case 'toggle-workbench-diff':
      return { command: 'workbench.toggleDiff' };
    default:
      return undefined;
  }
}

const domGlobals = globalThis as typeof globalThis & {
  document?: {
    documentElement?: {
      dataset: Record<string, string>;
    };
    body?: {
      setAttribute(name: string, value: string): void;
    };
  };
  dispatchEvent?: (event: { type: string }) => boolean;
  CustomEvent?: new <T>(type: string, init?: { detail?: T }) => { type: string; detail?: T };
};

const desktopBridge = {
  getEnvironment: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:get-environment`),
  getNavigationState: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:get-navigation-state`),
  openNewConversation: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-new-conversation`),
  openConversationPopout: (input: { conversationId: string }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-conversation-popout`, input),
  openPath: (targetPath: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-path`, targetPath),
  openExternalUrl: (targetUrl: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-external-url`, targetUrl),
  writeClipboardText: (text: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:write-clipboard-text`, text),
  readDesktopAppPreferences: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:read-desktop-app-preferences`),
  updateDesktopAppPreferences: (input: {
    autoInstallUpdates?: boolean;
    updatePath?: 'stable' | 'test';
    startOnSystemStart?: boolean;
    keyboardShortcuts?: Record<string, string>;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:update-desktop-app-preferences`, input),
  checkForUpdates: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:check-for-updates`),
  installReadyUpdate: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:install-ready-update`),
  pickFolder: (input?: { cwd?: string | null; prompt?: string | null }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:pick-folder`, input),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  captureScreenshot: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:capture-screenshot`),
  goBack: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:go-back`),
  goForward: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:go-forward`),
  setWorkbenchBrowserBounds: (input: {
    visible: boolean;
    sessionKey?: string | null;
    bounds?: { x: number; y: number; width: number; height: number };
    deactivate?: boolean;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-set-bounds`, input),
  getWorkbenchBrowserState: (input?: { sessionKey?: string | null }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-state`, input),
  navigateWorkbenchBrowser: (input: { url: string; sessionKey?: string | null }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-navigate`, input),
  goBackWorkbenchBrowser: (input?: { sessionKey?: string | null }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-back`, input),
  goForwardWorkbenchBrowser: (input?: { sessionKey?: string | null }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-forward`, input),
  reloadWorkbenchBrowser: (input?: { sessionKey?: string | null }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-reload`, input),
  stopWorkbenchBrowser: (input?: { sessionKey?: string | null }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-stop`, input),
  snapshotWorkbenchBrowser: (input?: { sessionKey?: string | null }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:workbench-browser-snapshot`, input),
};

if (domGlobals.document?.documentElement) {
  domGlobals.document.documentElement.dataset.neonPilotDesktop = '1';
}

if (domGlobals.document?.body) {
  domGlobals.document.body.setAttribute('data-neon-pilot-desktop', '1');
}

function dispatchDesktopEvent<T>(type: string, detail: T): void {
  if (!domGlobals.dispatchEvent || typeof domGlobals.CustomEvent !== 'function') {
    return;
  }

  domGlobals.dispatchEvent(new domGlobals.CustomEvent(type, { detail }));
}

ipcRenderer.on(SHORTCUT_CHANNEL, (_event, action: unknown) => {
  dispatchDesktopEvent(SHORTCUT_EVENT, normalizeDesktopShortcutPayload(action));
});

ipcRenderer.on(NAVIGATE_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(NAVIGATE_EVENT, payload);
});

ipcRenderer.on(WORKBENCH_BROWSER_COMMENT_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(WORKBENCH_BROWSER_COMMENT_EVENT, payload);
});

ipcRenderer.on(SHOW_WORKBENCH_BROWSER_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(SHOW_WORKBENCH_BROWSER_EVENT, payload);
});

contextBridge.exposeInMainWorld('neonPilotDesktop', desktopBridge);
