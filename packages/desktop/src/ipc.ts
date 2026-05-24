import { clipboard, ipcMain, shell, type WebContents } from 'electron';

import type { HostManager } from './hosts/host-manager.js';
import { captureDesktopScreenshot } from './screenshot.js';
import type { DesktopWindowController } from './window.js';

const CHANNEL_PREFIX = 'neon-pilot-desktop';
const CONVERSATION_STATE_CHANNEL = `${CHANNEL_PREFIX}:conversation-state`;

export function registerDesktopIpc(options: {
  hostManager: HostManager;
  windowController: DesktopWindowController;
  onHostStateChanged?: () => void;
  onCheckForUpdates?: () => Promise<unknown> | unknown;
  readDesktopAppPreferences?: () => Promise<unknown> | unknown;
  updateDesktopAppPreferences?: (input: {
    autoInstallUpdates?: boolean;
    updatePath?: 'stable' | 'test';
    startOnSystemStart?: boolean;
    keyboardShortcuts?: Record<string, string>;
  }) => Promise<unknown> | unknown;
}): void {
  const conversationStateSubscriptions = new Map<string, () => void>();

  const sendBufferedSubscriptionEvent = <T>(input: {
    sender: WebContents;
    channel: string;
    subscriptionId: string;
    subscribe: (emit: (event: T) => void) => Promise<() => void>;
    store: Map<string, () => void>;
  }): Promise<void> =>
    (async () => {
      const pendingEvents: T[] = [];
      let deliveryEnabled = false;
      let active = true;
      let flushScheduled = false;

      const flushPendingEvents = () => {
        flushScheduled = false;
        if (!active || input.sender.isDestroyed()) {
          pendingEvents.length = 0;
          return;
        }

        const events = pendingEvents.splice(0);
        for (const pendingEvent of events) {
          input.sender.send(input.channel, {
            subscriptionId: input.subscriptionId,
            event: pendingEvent,
          });
        }
      };

      const scheduleFlush = () => {
        if (!deliveryEnabled || flushScheduled) {
          return;
        }

        flushScheduled = true;
        setImmediate(flushPendingEvents);
      };

      const deliver = (nextEvent: T) => {
        if (!active || input.sender.isDestroyed()) {
          return;
        }

        pendingEvents.push(nextEvent);
        scheduleFlush();
      };

      const unsubscribe = await input.subscribe(deliver);

      // If the sender was destroyed during subscribe, clean up immediately.
      if (input.sender.isDestroyed()) {
        unsubscribe();
        return;
      }

      const cleanup = () => {
        if (!active) {
          return;
        }

        active = false;
        unsubscribe();
        input.store.delete(input.subscriptionId);
        pendingEvents.length = 0;
      };

      input.store.set(input.subscriptionId, cleanup);
      input.sender.once('destroyed', cleanup);
      deliveryEnabled = true;
      scheduleFlush();
    })();

  ipcMain.handle(`${CHANNEL_PREFIX}:get-environment`, async (event) => {
    const hostId = options.windowController.getHostIdForWebContentsId(event.sender.id) ?? options.hostManager.getActiveHostId();
    return options.hostManager.getDesktopEnvironmentForHost(hostId);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:get-navigation-state`, async (event) => {
    return options.windowController.getNavigationStateForWebContents(event.sender.id);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:open-new-conversation`, async (event) => {
    const url = await options.hostManager.openNewConversation();
    await options.windowController.openAbsoluteUrlInWindow(event.sender.id, url);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:open-conversation-popout`, async (event, input) => {
    const conversationId = typeof input?.conversationId === 'string' ? input.conversationId.trim() : '';
    if (!conversationId) {
      throw new Error('conversationId is required.');
    }

    await options.windowController.openConversationPopoutWindow({
      hostId: options.windowController.getHostIdForWebContentsId(event.sender.id),
      conversationId,
    });
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:open-path`, async (_event, targetPath: unknown) => {
    const normalizedPath = typeof targetPath === 'string' ? targetPath.trim() : '';
    if (!normalizedPath) {
      return { path: '', opened: false, error: 'Path is required.' };
    }

    const error = await shell.openPath(normalizedPath);
    return {
      path: normalizedPath,
      opened: error.length === 0,
      ...(error ? { error } : {}),
    };
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:open-external-url`, async (_event, targetUrl: unknown) => {
    const normalizedUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';
    if (!normalizedUrl) {
      return { url: '', opened: false, error: 'URL is required.' };
    }

    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { url: normalizedUrl, opened: false, error: 'Only http and https URLs can be opened.' };
      }
    } catch {
      return { url: normalizedUrl, opened: false, error: 'Invalid URL.' };
    }

    try {
      await shell.openExternal(normalizedUrl);
      return { url: normalizedUrl, opened: true };
    } catch (error) {
      return { url: normalizedUrl, opened: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:write-clipboard-text`, async (_event, text: unknown) => {
    if (typeof text !== 'string') {
      return { ok: false, error: 'Clipboard text must be a string.' };
    }

    try {
      clipboard.writeText(text, 'clipboard');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:read-desktop-app-preferences`, async () => {
    if (!options.readDesktopAppPreferences) {
      throw new Error('Desktop app preferences are unavailable.');
    }

    return options.readDesktopAppPreferences();
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:update-desktop-app-preferences`, async (_event, input) => {
    if (!options.updateDesktopAppPreferences) {
      throw new Error('Desktop app preferences are unavailable.');
    }

    return options.updateDesktopAppPreferences(input ?? {});
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:check-for-updates`, async () => {
    if (!options.onCheckForUpdates) {
      throw new Error('Desktop update checks are unavailable.');
    }

    return options.onCheckForUpdates();
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:pick-folder`, async (event, input?: { cwd?: string | null; prompt?: string | null }) => {
    const hostId = options.windowController.getHostIdForWebContentsId(event.sender.id) ?? options.hostManager.getActiveHostId();
    const controller = options.hostManager.getHostController(hostId);
    if (!controller.pickFolder) {
      throw new Error('Dedicated desktop folder picking is only available for the local host.');
    }

    return controller.pickFolder(input);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:capture-screenshot`, async () => captureDesktopScreenshot());

  ipcMain.handle(`${CHANNEL_PREFIX}:subscribe-conversation-state`, async (event, input) => {
    const hostId = options.windowController.getHostIdForWebContentsId(event.sender.id) ?? options.hostManager.getActiveHostId();
    const controller = options.hostManager.getHostController(hostId);
    if (!controller.subscribeConversationState) {
      throw new Error('Dedicated desktop conversation state is only available for the local host.');
    }

    const subscriptionId = `${event.sender.id}:conversation:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    await sendBufferedSubscriptionEvent({
      sender: event.sender,
      channel: CONVERSATION_STATE_CHANNEL,
      subscriptionId,
      store: conversationStateSubscriptions,
      subscribe: (emit) => controller.subscribeConversationState!(input, emit),
    });
    return { subscriptionId };
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:unsubscribe-conversation-state`, async (_event, subscriptionId: string) => {
    conversationStateSubscriptions.get(subscriptionId)?.();
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:go-back`, async (event) => {
    return options.windowController.goBackForWebContents(event.sender.id);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:go-forward`, async (event) => {
    return options.windowController.goForwardForWebContents(event.sender.id);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-set-bounds`, async (event, input) => {
    return options.windowController.setWorkbenchBrowserBoundsForWebContents(event.sender.id, input ?? {});
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-state`, async (event, input) => {
    return options.windowController.getWorkbenchBrowserStateForWebContents(event.sender.id, input?.sessionKey);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-navigate`, async (event, input) => {
    return options.windowController.navigateWorkbenchBrowserForWebContents(event.sender.id, input ?? {});
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-back`, async (event, input) => {
    return options.windowController.goBackWorkbenchBrowserForWebContents(event.sender.id, input?.sessionKey);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-forward`, async (event, input) => {
    return options.windowController.goForwardWorkbenchBrowserForWebContents(event.sender.id, input?.sessionKey);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-reload`, async (event, input) => {
    return options.windowController.reloadWorkbenchBrowserForWebContents(event.sender.id, input?.sessionKey);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-stop`, async (event, input) => {
    return options.windowController.stopWorkbenchBrowserForWebContents(event.sender.id, input?.sessionKey);
  });

  ipcMain.handle(`${CHANNEL_PREFIX}:workbench-browser-snapshot`, async (event, input) => {
    return options.windowController.snapshotWorkbenchBrowserForWebContents(event.sender.id, input?.sessionKey);
  });
}
