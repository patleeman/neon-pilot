import { contextBridge, ipcRenderer } from 'electron';

const CHANNEL_PREFIX = 'neon-pilot-desktop';
const SHORTCUT_CHANNEL = `${CHANNEL_PREFIX}:shortcut`;
const SHORTCUT_EVENT = 'neon-pilot-desktop-shortcut';
const NAVIGATE_CHANNEL = `${CHANNEL_PREFIX}:navigate`;
const NAVIGATE_EVENT = 'neon-pilot-desktop-navigate';
const CONVERSATION_STATE_CHANNEL = `${CHANNEL_PREFIX}:conversation-state`;
const CONVERSATION_STATE_EVENT = 'neon-pilot-desktop-conversation-state';
const WORKBENCH_BROWSER_COMMENT_CHANNEL = `${CHANNEL_PREFIX}:workbench-browser-comment`;
const WORKBENCH_BROWSER_COMMENT_EVENT = 'neon-pilot-desktop-workbench-browser-comment';
const SHOW_WORKBENCH_BROWSER_CHANNEL = `${CHANNEL_PREFIX}:show-workbench-browser`;
const SHOW_WORKBENCH_BROWSER_EVENT = 'neon-pilot-desktop-show-workbench-browser';

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
  getConnections: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:get-connections`),
  getNavigationState: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:get-navigation-state`),
  saveHost: (host: unknown) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:save-host`, host),
  deleteHost: (hostId: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:delete-host`, hostId),
  testSshConnection: (input: { sshTarget: string }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:test-ssh-connection`, input),
  openNewConversation: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-new-conversation`),
  openConversationPopout: (input: { conversationId: string }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:open-conversation-popout`, input),
  showConversationContextMenu: (input: {
    x: number;
    y: number;
    pinAction?: 'pin' | 'unpin' | null;
    canArchive?: boolean;
    canOpenInNewWindow?: boolean;
    canDuplicate?: boolean;
    canAttachToGateway?: boolean;
    canCopyWorkingDirectory?: boolean;
    canCopyId?: boolean;
    canCopyDeeplink?: boolean;
    busyAction?: 'duplicate' | 'summarize' | null;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:show-conversation-context-menu`, input),
  showConversationCwdGroupContextMenu: (input: {
    x: number;
    y: number;
    canOpenInFinder?: boolean;
    canEditName?: boolean;
    canArchiveThreads?: boolean;
    canRemove?: boolean;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:show-conversation-cwd-group-context-menu`, input),
  showKnowledgeEntryContextMenu: (input: {
    x: number;
    y: number;
    canOpenInFinder?: boolean;
    canCreateFile?: boolean;
    canCreateFolder?: boolean;
    canRename?: boolean;
    canMove?: boolean;
    canDelete?: boolean;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:show-knowledge-entry-context-menu`, input),
  showSelectionContextMenu: (input: { x: number; y: number; canReply?: boolean; canCopy?: boolean }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:show-selection-context-menu`, input),
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
  pickFolder: (input?: { cwd?: string | null; prompt?: string | null }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:pick-folder`, input),
  captureScreenshot: () => ipcRenderer.invoke(`${CHANNEL_PREFIX}:capture-screenshot`),
  createLiveSession: (input: {
    cwd?: string;
    workspaceCwd?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    serviceTier?: string | null;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:create-live-session`, input),
  resumeLiveSession: (input: { sessionFile: string; cwd?: string }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:resume-live-session`, input),
  takeOverLiveSession: (input: { conversationId: string; surfaceId: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:take-over-live-session`, input),
  restoreQueuedLiveSessionMessage: (input: { conversationId: string; behavior: 'steer' | 'followUp'; index: number; previewId?: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:restore-queued-live-session-message`, input),
  clearQueuedLiveSessionMessages: (input: { conversationId: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:clear-queued-live-session-messages`, input),
  compactLiveSession: (input: { conversationId: string; customInstructions?: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:compact-live-session`, input),
  exportLiveSession: (input: { conversationId: string; outputPath?: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:export-live-session`, input),
  reloadLiveSession: (conversationId: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:reload-live-session`, conversationId),
  destroyLiveSession: (conversationId: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:destroy-live-session`, conversationId),
  branchLiveSession: (input: { conversationId: string; entryId: string }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:branch-live-session`, input),
  forkLiveSession: (input: { conversationId: string; entryId: string; preserveSource?: boolean; beforeEntry?: boolean }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:fork-live-session`, input),
  submitLiveSessionPrompt: (input: {
    conversationId: string;
    text?: string;
    behavior?: 'steer' | 'followUp';
    images?: Array<{ data: string; mimeType: string; name?: string }>;
    attachmentRefs?: Array<{ attachmentId: string; revision?: number }>;
    contextMessages?: Array<{ customType: string; content: string }>;
    relatedConversationIds?: string[];
    surfaceId?: string;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:submit-live-session-prompt`, input),
  executeLiveSessionBash: (input: { conversationId: string; command: string; excludeFromContext?: boolean }) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:execute-live-session-bash`, input),
  abortLiveSession: (conversationId: string) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:abort-live-session`, conversationId),
  subscribeConversationState: (input: {
    conversationId: string;
    tailBlocks?: number;
    surfaceId?: string;
    surfaceType?: 'desktop_web' | 'mobile_web';
    streamEvents?: boolean;
  }) => ipcRenderer.invoke(`${CHANNEL_PREFIX}:subscribe-conversation-state`, input),
  unsubscribeConversationState: (subscriptionId: string) =>
    ipcRenderer.invoke(`${CHANNEL_PREFIX}:unsubscribe-conversation-state`, subscriptionId),
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
  dispatchDesktopEvent(SHORTCUT_EVENT, { action });
});

ipcRenderer.on(NAVIGATE_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(NAVIGATE_EVENT, payload);
});

ipcRenderer.on(CONVERSATION_STATE_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(CONVERSATION_STATE_EVENT, payload);
});

ipcRenderer.on(WORKBENCH_BROWSER_COMMENT_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(WORKBENCH_BROWSER_COMMENT_EVENT, payload);
});

ipcRenderer.on(SHOW_WORKBENCH_BROWSER_CHANNEL, (_event, payload: unknown) => {
  dispatchDesktopEvent(SHOW_WORKBENCH_BROWSER_EVENT, payload);
});

contextBridge.exposeInMainWorld('neonPilotDesktop', desktopBridge);
