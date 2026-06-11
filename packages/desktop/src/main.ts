import { resolve } from 'node:path';

import { app, clipboard, dialog, Notification, shell } from 'electron';

import { applyDesktopAboutPanelOptions } from './about.js';
import { applyDesktopApplicationIcon } from './app-icon.js';
import { applyDesktopShellAppMode } from './app-mode.js';
import { registerDesktopAppProtocol, warmDesktopShellStaticAssets } from './app-protocol.js';
import { createDesktopCompanionRuntime } from './companion/runtime.js';
import { resolveDesktopRuntimePaths } from './desktop-env.js';
import { closeDesktopMainLog, writeDesktopMainLogLine } from './desktop-main-log.js';
import { HostManager } from './hosts/host-manager.js';
import { registerDesktopIpc } from './ipc.js';
import { type DesktopKeyboardShortcuts, validateDesktopKeyboardShortcuts } from './keyboard-shortcuts.js';
import { resolveDesktopLaunchPresentation } from './launch-mode.js';
import { installDesktopApplicationMenu, setDesktopApplicationMenuKeyboardShortcutsReader } from './menu.js';
import { confirmDesktopQuit } from './quit.js';
import { applyDesktopRuntimeEnvironmentOverrides } from './runtime-env.js';
import { claimDesktopSingleInstance } from './single-instance.js';
import { startDesktopBackendWarmup } from './startup-backend-warmup.js';
import { loadDesktopConfig, readDesktopAppPreferences, updateDesktopAppPreferences } from './state/desktop-config.js';
import { DesktopTrayController } from './tray.js';
import { DesktopUpdateManager } from './updates/update-manager.js';
import { importClipboardUrlToKnowledge } from './url-clipper.js';
import { DesktopWindowController } from './window.js';

let hostManager: HostManager | undefined;
let windowController: DesktopWindowController | undefined;
let trayController: DesktopTrayController | undefined;
let updateManager: DesktopUpdateManager | undefined;
let backendStartupPromise: Promise<boolean> | undefined;

let quitRequestPromise: Promise<void> | null = null;
let quitting = false;

function readStartOnSystemStartFromSystem(): boolean {
  if (!app.isPackaged) {
    return false;
  }

  try {
    return app.getLoginItemSettings().openAtLogin === true;
  } catch {
    return false;
  }
}

function applyStartOnSystemStart(enabled: boolean): boolean {
  if (!app.isPackaged) {
    if (!enabled) {
      return false;
    }

    throw new Error('Start on system start is only available in packaged desktop builds.');
  }

  const current = readStartOnSystemStartFromSystem();
  if (current === enabled) {
    return current;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: enabled,
  });

  return readStartOnSystemStartFromSystem();
}

function buildDesktopAppPreferencesState() {
  const preferences = readDesktopAppPreferences(loadDesktopConfig());
  return {
    available: true as const,
    supportsStartOnSystemStart: app.isPackaged,
    autoInstallUpdates: preferences.autoInstallUpdates,
    updatePath: preferences.updatePath,
    startOnSystemStart: readStartOnSystemStartFromSystem(),
    keyboardShortcuts: preferences.keyboardShortcuts,
    update: updateManager?.getState() ?? {
      supported: app.isPackaged,
      currentVersion: app.getVersion(),
      status: 'idle' as const,
    },
  };
}

async function updateDesktopAppPreferencesState(input: {
  autoInstallUpdates?: boolean;
  updatePath?: 'stable' | 'test';
  startOnSystemStart?: boolean;
  keyboardShortcuts?: Partial<DesktopKeyboardShortcuts>;
}) {
  const nextPreferences = readDesktopAppPreferences(loadDesktopConfig());
  let changed = false;

  if (input.autoInstallUpdates !== undefined) {
    if (typeof input.autoInstallUpdates !== 'boolean') {
      throw new Error('autoInstallUpdates must be a boolean when provided.');
    }

    nextPreferences.autoInstallUpdates = input.autoInstallUpdates;
    changed = true;
  }

  if (input.updatePath !== undefined) {
    if (input.updatePath !== 'stable' && input.updatePath !== 'test') {
      throw new Error('updatePath must be "stable" or "test" when provided.');
    }

    nextPreferences.updatePath = input.updatePath;
    changed = true;
  }

  if (input.startOnSystemStart !== undefined) {
    if (typeof input.startOnSystemStart !== 'boolean') {
      throw new Error('startOnSystemStart must be a boolean when provided.');
    }

    nextPreferences.startOnSystemStart = applyStartOnSystemStart(input.startOnSystemStart);
    changed = true;
  }

  if (input.keyboardShortcuts !== undefined) {
    nextPreferences.keyboardShortcuts = validateDesktopKeyboardShortcuts({
      ...nextPreferences.keyboardShortcuts,
      ...input.keyboardShortcuts,
    });
    changed = true;
  }

  if (!changed) {
    throw new Error('Provide autoInstallUpdates, updatePath, startOnSystemStart, and/or keyboardShortcuts.');
  }

  updateDesktopAppPreferences(nextPreferences);
  updateManager?.preferencesChanged();
  return buildDesktopAppPreferencesState();
}

const desktopLaunchPresentation = resolveDesktopLaunchPresentation(process.env, {
  version: app.getVersion(),
  packaged: app.isPackaged,
  appName: app.getName(),
});
app.setName(desktopLaunchPresentation.appName);
if (desktopLaunchPresentation.mode === 'rc' && !process.env.NEON_PILOT_RUNTIME_CHANNEL && !process.env.NEON_PILOT_DESKTOP_VARIANT) {
  process.env.NEON_PILOT_RUNTIME_CHANNEL = 'rc';
}

const desktopUserDataDir = process.env.NEON_PILOT_DESKTOP_USER_DATA_DIR?.trim();
if (desktopUserDataDir) {
  app.setPath('userData', resolve(desktopUserDataDir));
}

const hasDesktopSingleInstanceLock = claimDesktopSingleInstance(app, () => {
  void openMainRoute(readInitialDesktopRoute());
});

function readInitialDesktopRoute(): string {
  const route = process.env.NEON_PILOT_DESKTOP_INITIAL_ROUTE?.trim();
  if (!route || !route.startsWith('/') || route.startsWith('//')) {
    return '/';
  }

  return route;
}

function renderDesktopErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

function logDesktopMainMessage(level: 'info' | 'error', message: string): void {
  writeDesktopMainLogLine(`[${new Date().toISOString()}] [${level}] ${message}`);
}

function logBootstrapError(error: unknown): void {
  const rendered = error instanceof Error ? (error.stack ?? error.message) : String(error);
  logDesktopMainMessage('error', rendered);
}

function showClipperNotification(input: { title: string; body: string }): void {
  if (Notification.isSupported()) {
    new Notification(input).show();
    return;
  }

  void dialog.showMessageBox({
    type: 'info',
    message: input.title,
    detail: input.body,
  });
}

async function clipUrlFromClipboard(): Promise<void> {
  if (!hostManager) {
    throw new Error('Desktop runtime is not ready.');
  }

  const imported = await importClipboardUrlToKnowledge({
    host: hostManager,
    clipboardText: clipboard.readText('clipboard'),
  });
  const noteId = imported.note?.id ? `Saved to ${imported.note.id}` : 'Saved to Knowledge Inbox.';
  showClipperNotification({
    title: 'URL clipped',
    body: `${imported.title}\n${noteId}`,
  });
}

function clipUrlFromClipboardAndNotify(): void {
  void clipUrlFromClipboard().catch((error) => {
    showClipperNotification({
      title: 'Could not clip URL',
      body: renderDesktopErrorMessage(error),
    });
  });
}

function reportDesktopError(error: unknown): void {
  logBootstrapError(error);

  const message = renderDesktopErrorMessage(error);
  trayController?.setStartupState({ kind: 'error', message });

  try {
    const { desktopLogsDir } = resolveDesktopRuntimePaths();
    void windowController
      ?.openStartupErrorWindow({
        message,
        logsDir: desktopLogsDir,
      })
      .catch((windowError) => {
        logBootstrapError(windowError);
      });
    dialog.showErrorBox(`${app.name} error`, `${message}\n\nSee desktop logs in:\n${desktopLogsDir}`);
  } catch {
    dialog.showErrorBox(`${app.name} error`, message);
  }
}

async function openDesktopLogs(): Promise<void> {
  const { desktopLogsDir } = resolveDesktopRuntimePaths();
  const errorMessage = await shell.openPath(desktopLogsDir);
  if (errorMessage.trim().length > 0) {
    dialog.showErrorBox('Could not open desktop logs', errorMessage);
  }
}

function configureDesktopRuntimeEnvironment(): void {
  // Do not hydrate the shell environment here. That runs an interactive shell
  // synchronously and can burn multiple seconds before the first window exists.
  // Child-process launch paths resolve shell env lazily when they actually need it.
  applyDesktopRuntimeEnvironmentOverrides(process.env, { version: app.getVersion(), packaged: app.isPackaged });

  const runtime = resolveDesktopRuntimePaths();
  process.env.NEON_PILOT_DESKTOP_RUNTIME = '1';
  if (runtime.devRepoRoot) {
    process.env.NEON_PILOT_REPO_ROOT = runtime.devRepoRoot;
  } else {
    delete process.env.NEON_PILOT_REPO_ROOT;
  }
  if (runtime.resourcesRoot) {
    process.env.NEON_PILOT_RESOURCES_ROOT = runtime.resourcesRoot;
  } else {
    delete process.env.NEON_PILOT_RESOURCES_ROOT;
  }
  process.env.NEON_PILOT_APP_ROOT = runtime.appRoot;
  if (runtime.desktopNativeModulesDir) {
    process.env.NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR = runtime.desktopNativeModulesDir;
  }
  process.env.NEON_PILOT_DESKTOP_DAEMON_LOG_FILE = `${runtime.desktopLogsDir}/daemon.log`;
}

async function ensureDesktopBackendAvailable(): Promise<boolean> {
  if (!hostManager) {
    return false;
  }

  if (backendStartupPromise) {
    return backendStartupPromise;
  }

  backendStartupPromise = (async () => {
    try {
      trayController?.setStartupState({ kind: 'starting' });
      await hostManager.ensureActiveHostRunning();
      trayController?.setStartupState({ kind: 'ready' });
      trayController?.refresh();
      return true;
    } catch (error) {
      reportDesktopError(error);
      return false;
    } finally {
      backendStartupPromise = undefined;
    }
  })();

  return backendStartupPromise;
}

async function withDesktopBackend(action: () => Promise<void>): Promise<void> {
  if (!windowController || !hostManager) {
    return;
  }

  if (!(await ensureDesktopBackendAvailable())) {
    return;
  }

  try {
    await action();
    trayController?.setStartupState({ kind: 'ready' });
  } catch (error) {
    reportDesktopError(error);
  }
}

async function openMainRoute(pathname = '/'): Promise<void> {
  if (!windowController) {
    return;
  }

  try {
    await windowController.openMainWindow(pathname);
  } catch (error) {
    reportDesktopError(error);
  }
}

async function openNewWindow(): Promise<void> {
  await withDesktopBackend(async () => {
    await windowController!.openNewWindow();
  });
}

async function openNewConversation(): Promise<void> {
  await withDesktopBackend(async () => {
    const url = await hostManager!.openNewConversation();
    await windowController!.openAbsoluteUrl(url);
  });
}

async function openConversation(conversationId: string): Promise<void> {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    return;
  }

  await openMainRoute(`/conversations/${encodeURIComponent(normalizedConversationId)}`);
}

async function restartActiveHost(): Promise<void> {
  if (!hostManager || !windowController) {
    return;
  }

  trayController?.setStartupState({ kind: 'starting' });

  try {
    backendStartupPromise = undefined;
    await hostManager.restartActiveHost();
    trayController?.setStartupState({ kind: 'ready' });
    trayController?.refresh();
    await windowController.openMainWindow('/');
  } catch (error) {
    reportDesktopError(error);
  }
}

async function checkForDesktopUpdates() {
  try {
    await updateManager?.checkForUpdates({ userInitiated: true });
    return buildDesktopAppPreferencesState();
  } catch (error) {
    reportDesktopError(error);
    return buildDesktopAppPreferencesState();
  }
}

async function handleInstallReadyUpdate() {
  try {
    await updateManager?.installReadyUpdate();
  } catch (error) {
    reportDesktopError(error);
  }
}

function installWorkbenchBrowserToolHost(): void {
  if (!hostManager || !windowController) {
    return;
  }

  const controller = hostManager.getActiveHostController() as {
    setWorkbenchBrowserToolHost?(host: {
      isActive(conversationId: string): Promise<boolean>;
      listTabs(): Promise<Array<{ sessionKey: string; url: string; title: string }>>;
      snapshot(conversationId: string, tabId?: string): Promise<unknown>;
      screenshot(conversationId: string, tabId?: string): Promise<unknown>;
      cdp(input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }): Promise<unknown>;
    }): Promise<void>;
  };

  void controller
    .setWorkbenchBrowserToolHost?.({
      isActive: () => Promise.resolve(windowController!.isWorkbenchBrowserActive()),
      listTabs: () => Promise.resolve(windowController!.listBrowserTabs()),
      snapshot: (_conversationId, tabId) => windowController!.snapshotWorkbenchBrowser(tabId),
      screenshot: (_conversationId, tabId) => windowController!.screenshotWorkbenchBrowser(tabId),
      cdp: (input) =>
        windowController!.cdpWorkbenchBrowser({
          command: input.command,
          continueOnError: input.continueOnError,
          tabId: input.tabId,
        }),
    })
    .catch((error) => logBootstrapError(error));
}

async function bootstrapDesktopApp(): Promise<void> {
  const startupStartedAt = process.hrtime.bigint();
  const logStartupMilestone = (label: string) => {
    const elapsedMs = Number(process.hrtime.bigint() - startupStartedAt) / 1_000_000;
    logDesktopMainMessage('info', `desktop startup ${label} elapsedMs=${elapsedMs.toFixed(1)}`);
  };

  logStartupMilestone('environment-ready');
  hostManager = new HostManager();

  startDesktopBackendWarmup({
    ensureBackend: ensureDesktopBackendAvailable,
    onReady: () => {
      logStartupMilestone('backend-warmed');
      installWorkbenchBrowserToolHost();
    },
    onUnavailable: () => logStartupMilestone('backend-warmup-unavailable'),
    onError: logBootstrapError,
  });

  void import('../server/daemon/companion/runtime.js')
    .then((module) => {
      module.setCompanionRuntimeProvider(() => createDesktopCompanionRuntime(hostManager as HostManager));
    })
    .catch((error) => logBootstrapError(error));
  registerDesktopAppProtocol(hostManager);
  warmDesktopShellStaticAssets();
  windowController = new DesktopWindowController(hostManager);
  logStartupMilestone('protocol-ready');
  updateManager = new DesktopUpdateManager({
    onBeforeQuitForUpdate: async () => {
      await prepareForQuit();
    },
    shouldAutoInstallUpdates: () => readDesktopAppPreferences(loadDesktopConfig()).autoInstallUpdates,
    getUpdatePath: () => readDesktopAppPreferences(loadDesktopConfig()).updatePath,
  });

  try {
    applyStartOnSystemStart(readDesktopAppPreferences(loadDesktopConfig()).startOnSystemStart);
  } catch (error) {
    logBootstrapError(error);
  }

  const shellActions = {
    onOpen: () => {
      void openMainRoute('/');
    },
    onNewWindow: () => {
      void openNewWindow();
    },
    onNewConversation: () => {
      void openNewConversation();
    },
    onClipUrlFromClipboard: () => {
      clipUrlFromClipboardAndNotify();
    },
    onCloseConversation: () => {
      windowController?.sendShortcutToFocusedWindow('close-conversation');
    },
    onReopenClosedConversation: () => {
      windowController?.sendShortcutToFocusedWindow('reopen-closed-conversation');
    },
    onPreviousConversation: () => {
      windowController?.sendShortcutToFocusedWindow('previous-conversation');
    },
    onNextConversation: () => {
      windowController?.sendShortcutToFocusedWindow('next-conversation');
    },
    onToggleConversationPin: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-conversation-pin');
    },
    onToggleConversationArchive: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-conversation-archive');
    },
    onRenameConversation: () => {
      windowController?.sendShortcutToFocusedWindow('rename-conversation');
    },
    onFocusComposer: () => {
      windowController?.sendShortcutToFocusedWindow('focus-composer');
    },
    onEditWorkingDirectory: () => {
      windowController?.sendShortcutToFocusedWindow('edit-working-directory');
    },
    onFindInPage: () => {
      windowController?.sendShortcutToFocusedWindow('find-in-page');
    },
    onToggleSidebar: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-sidebar');
    },
    onToggleRightRail: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-right-rail');
    },
    onShowConversationMode: () => {
      windowController?.sendShortcutToFocusedWindow('show-conversation-mode');
    },
    onShowWorkbenchMode: () => {
      windowController?.sendShortcutToFocusedWindow('show-workbench-mode');
    },
    onNewWorkbenchTab: () => {
      windowController?.sendShortcutToFocusedWindow('new-workbench-tab');
    },
    onCloseWorkbenchTab: () => {
      windowController?.sendShortcutToFocusedWindow('close-workbench-tab');
    },
    onCloseWorkbenchFile: () => {
      windowController?.sendShortcutToFocusedWindow('close-workbench-file');
    },
    onRefreshWorkbenchFile: () => {
      windowController?.sendShortcutToFocusedWindow('refresh-workbench-file');
    },
    onToggleWorkbenchExplorer: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-workbench-explorer');
    },
    onToggleWorkbenchDiff: () => {
      windowController?.sendShortcutToFocusedWindow('toggle-workbench-diff');
    },
    onHideWindow: () => {
      windowController?.hideFocusedWindow();
    },
    onSettings: () => {
      void openMainRoute('/settings');
    },
    onCheckForUpdates: () => {
      void updateManager?.checkForUpdates({ userInitiated: true });
    },
    onRestartRuntime: () => {
      void restartActiveHost();
    },
    onOpenLogs: () => {
      void openDesktopLogs();
    },
    onQuit: () => {
      void requestAppQuit();
    },
  };

  trayController = new DesktopTrayController({
    hostManager,
    onOpen: shellActions.onOpen,
    onOpenConversation: (conversationId) => {
      void openConversation(conversationId);
    },
    onNewConversation: shellActions.onNewConversation,
    onClipUrlFromClipboard: shellActions.onClipUrlFromClipboard,
    onSettings: shellActions.onSettings,
    onCheckForUpdates: shellActions.onCheckForUpdates,
    onRestartRuntime: shellActions.onRestartRuntime,
    onOpenLogs: shellActions.onOpenLogs,
    onQuit: shellActions.onQuit,
  });
  setDesktopApplicationMenuKeyboardShortcutsReader(() => readDesktopAppPreferences(loadDesktopConfig()).keyboardShortcuts);
  installDesktopApplicationMenu(shellActions);

  registerDesktopIpc({
    hostManager,
    windowController,
    onHostStateChanged: () => {
      trayController?.refresh();
    },
    onCheckForUpdates: () => checkForDesktopUpdates(),
    onInstallReadyUpdate: () => handleInstallReadyUpdate(),
    readDesktopAppPreferences: () => buildDesktopAppPreferencesState(),
    updateDesktopAppPreferences: async (input) => {
      const state = await updateDesktopAppPreferencesState(input ?? {});
      installDesktopApplicationMenu(shellActions);
      return state;
    },
  });

  updateManager.start();

  setImmediate(() => {
    try {
      applyDesktopAboutPanelOptions();
    } catch (error) {
      logBootstrapError(error);
    }
  });

  if (hostManager.getConfig().openWindowOnLaunch) {
    await openMainRoute(readInitialDesktopRoute());
    logStartupMilestone('main-window-open-requested');
  }
}

async function prepareForQuit(): Promise<void> {
  if (quitting) {
    return;
  }

  quitting = true;

  windowController?.setQuitting(true);
  updateManager?.dispose();
  trayController?.destroy();
  await windowController?.prepareForQuit();
  await hostManager?.dispose();
  await closeDesktopMainLog();
}

async function shutdownAndQuit(): Promise<void> {
  await prepareForQuit();
  app.quit();
}

async function requestAppQuit(): Promise<void> {
  // Set the promise before any async work so concurrent calls
  // share the same in-flight operation instead of showing two dialogs.
  if (quitRequestPromise) {
    await quitRequestPromise;
    return;
  }

  let resolveSentinel: () => void;
  quitRequestPromise = new Promise<void>((resolve) => {
    resolveSentinel = resolve;
  });

  try {
    const confirmed = await confirmDesktopQuit(dialog, app.name, resolveDesktopRuntimePaths().colorIconFile, {
      keepsExternalDaemonRunning: false,
    });

    if (!confirmed) {
      quitRequestPromise = null;
      return;
    }

    await shutdownAndQuit();
  } finally {
    resolveSentinel!();
    if (!quitting) {
      quitRequestPromise = null;
    }
  }
}

if (hasDesktopSingleInstanceLock) {
  app.on('before-quit', (event) => {
    if (quitting) {
      return;
    }

    event.preventDefault();
    void requestAppQuit();
  });

  app.on('window-all-closed', () => {
    // Keep the tray app alive when the main window is closed.
  });

  app.on('activate', () => {
    void openMainRoute('/');
  });

  app
    .whenReady()
    .then(async () => {
      configureDesktopRuntimeEnvironment();
      applyDesktopApplicationIcon(process.platform, app, resolveDesktopRuntimePaths().colorIconFile);
      applyDesktopShellAppMode(process.platform, app);
      await bootstrapDesktopApp();
    })
    .catch((error) => {
      logBootstrapError(error);
      app.exit(1);
    });
}
