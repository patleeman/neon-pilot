import { describe, expect, it, vi } from 'vitest';

const { mockIpcHandle } = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
  shell: {
    openPath: vi.fn(),
    openExternal: vi.fn(),
    trashItem: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
    getName: vi.fn().mockReturnValue('Neon Pilot'),
    name: 'Neon Pilot',
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  session: {
    fromPartition: vi.fn().mockReturnValue({
      protocol: { handle: vi.fn() },
      setProxy: vi.fn(),
    }),
  },
  screen: {
    getAllDisplays: vi.fn().mockReturnValue([]),
  },
}));

import { registerDesktopIpc } from './ipc.js';

function createMockController() {
  return {
    dispatchApiRequest: vi.fn(),
    subscribeApiStream: vi.fn(),
    readLiveSession: vi.fn(),
    readScheduledTasks: vi.fn(),
    createLiveSession: vi.fn(),
    resumeLiveSession: vi.fn(),
    takeOverLiveSession: vi.fn(),
    compactLiveSession: vi.fn(),
    exportLiveSession: vi.fn(),
    reloadLiveSession: vi.fn(),
    destroyLiveSession: vi.fn(),
    branchLiveSession: vi.fn(),
    forkLiveSession: vi.fn(),
    abortLiveSession: vi.fn(),
    renameConversation: vi.fn(),
    resumeConversation: vi.fn(),
    markConversationAttention: vi.fn(),
    markDurableRunAttention: vi.fn(),
    openNewConversation: vi.fn(),
    readConversationArtifacts: vi.fn(),
    readConversationCheckpoints: vi.fn(),
    readConversationAttachments: vi.fn(),
    readConversationAttachment: vi.fn(),
    createConversationAttachment: vi.fn(),
    updateConversationAttachment: vi.fn(),
    readConversationAttachmentAsset: vi.fn(),
    readConversationDeferredResumes: vi.fn(),
    scheduleConversationDeferredResume: vi.fn(),
    cancelConversationDeferredResume: vi.fn(),
    fireConversationDeferredResume: vi.fn(),
    readConversationModelPreferences: vi.fn(),
    updateConversationModelPreferences: vi.fn(),
  };
}

describe('registerDesktopIpc', () => {
  it('registers all IPC handlers without throwing', () => {
    expect(() => {
      registerDesktopIpc({
        hostManager: {
          getActiveHostId: () => 'local',
          getActiveHostController: () => createMockController(),
          getHostController: () => createMockController(),
          getHostRecord: (id: string) => ({ id: id ?? 'local', kind: 'local' }),
          getHostBaseUrl: vi.fn().mockResolvedValue('neon-pilot://app/'),
          openNewConversation: vi.fn().mockResolvedValue('/conversations/new'),
          openNewConversationInHost: vi.fn(),
        } as never,
        windowController: {
          sendShortcutToFocusedWindow: vi.fn(),
          setWorkbenchBrowserBoundsForWebContents: vi.fn(),
          getWorkbenchBrowserStateForWebContents: vi.fn(),
          navigateWorkbenchBrowserForWebContents: vi.fn(),
          goBackWorkbenchBrowserForWebContents: vi.fn(),
          goForwardWorkbenchBrowserForWebContents: vi.fn(),
          reloadWorkbenchBrowserForWebContents: vi.fn(),
          stopWorkbenchBrowserForWebContents: vi.fn(),
          snapshotWorkbenchBrowserForWebContents: vi.fn(),
          screenshotWorkbenchBrowserForWebContents: vi.fn(),
          getNavigationStateForWebContents: vi.fn(),
          goBackForWebContents: vi.fn(),
          goForwardForWebContents: vi.fn(),
          handleRendererProcessGone: vi.fn(),
          openConversationPopoutWindow: vi.fn().mockResolvedValue(undefined),
          openMainWindow: vi.fn().mockResolvedValue(undefined),
          openNewWindow: vi.fn().mockResolvedValue(undefined),
          openAbsoluteUrl: vi.fn().mockResolvedValue(undefined),
          getMainWindowRoute: vi.fn().mockReturnValue('/'),
          openHostAbsoluteUrl: vi.fn().mockResolvedValue(undefined),
          snapshotWorkbenchBrowser: vi.fn(),
        } as never,
      });
    }).not.toThrow();
  });

  it('registers the desktop-shell IPC handlers', () => {
    expect(mockIpcHandle.mock.calls.length).toBeGreaterThanOrEqual(20);
  });

  it('registers a conversation lifecycle handler', () => {
    const calls = mockIpcHandle.mock.calls;
    const conversationHandler = calls.find(
      (call: unknown[]) => (call[0] as string).includes('conversation') || (call[0] as string).includes('live-session'),
    );
    expect(conversationHandler).toBeDefined();
  });

  it('registers settings-related handlers', () => {
    const calls = mockIpcHandle.mock.calls;
    const hasSettingsHandler = calls.some(
      (call: unknown[]) => (call[0] as string).includes('preferences') || (call[0] as string).includes('default-cwd'),
    );
    expect(hasSettingsHandler).toBe(true);
  });

  it('registers workbench browser handlers', () => {
    const calls = mockIpcHandle.mock.calls;
    const hasBrowserHandler = calls.some((call: unknown[]) => (call[0] as string).includes('workbench-browser'));
    expect(hasBrowserHandler).toBe(true);
  });

  it('routes BrowserView windowed desktop screenshots through the window controller', async () => {
    mockIpcHandle.mockClear();
    const windowController = {
      sendShortcutToFocusedWindow: vi.fn(),
      setWorkbenchBrowserBoundsForWebContents: vi.fn(),
      getWorkbenchBrowserStateForWebContents: vi.fn(),
      navigateWorkbenchBrowserForWebContents: vi.fn(),
      goBackWorkbenchBrowserForWebContents: vi.fn(),
      goForwardWorkbenchBrowserForWebContents: vi.fn(),
      reloadWorkbenchBrowserForWebContents: vi.fn(),
      stopWorkbenchBrowserForWebContents: vi.fn(),
      snapshotWorkbenchBrowserForWebContents: vi.fn(),
      screenshotWorkbenchBrowserForWebContents: vi.fn().mockResolvedValue({
        mimeType: 'image/png',
        dataBase64: Buffer.from('browser-png').toString('base64'),
        viewport: { width: 1280, height: 720 },
        capturedAt: '2026-07-06T00:00:00.000Z',
      }),
      getNavigationStateForWebContents: vi.fn(),
      goBackForWebContents: vi.fn(),
      goForwardForWebContents: vi.fn(),
      handleRendererProcessGone: vi.fn(),
      openConversationPopoutWindow: vi.fn().mockResolvedValue(undefined),
      openMainWindow: vi.fn().mockResolvedValue(undefined),
      openNewWindow: vi.fn().mockResolvedValue(undefined),
      openAbsoluteUrl: vi.fn().mockResolvedValue(undefined),
      getHostIdForWebContentsId: vi.fn().mockReturnValue('local'),
      getMainWindowRoute: vi.fn().mockReturnValue('/'),
      openHostAbsoluteUrl: vi.fn().mockResolvedValue(undefined),
      snapshotWorkbenchBrowser: vi.fn(),
    };
    registerDesktopIpc({
      hostManager: {
        getActiveHostId: () => 'local',
        getActiveHostController: () => createMockController(),
        getHostController: () => createMockController(),
        getHostRecord: (id: string) => ({ id: id ?? 'local', kind: 'local' }),
        getHostBaseUrl: vi.fn().mockResolvedValue('neon-pilot://app/'),
        openNewConversation: vi.fn().mockResolvedValue('/conversations/new'),
        openNewConversationInHost: vi.fn(),
      } as never,
      windowController: windowController as never,
    });

    const handler = mockIpcHandle.mock.calls.find(([channel]) => channel === 'neon-pilot-desktop:capture-windowed-desktop-screenshot')?.[1];
    await expect(
      handler({ sender: { id: 42 } }, { windowId: 'chat:draft:browser', browserSessionKey: '@global:tab-chat:draft:browser' }),
    ).resolves.toMatchObject({
      image: {
        mimeType: 'image/png',
        data: Buffer.from('browser-png').toString('base64'),
        width: 1280,
        height: 720,
        windowId: 'chat:draft:browser',
      },
    });
    expect(windowController.screenshotWorkbenchBrowserForWebContents).toHaveBeenCalledWith(42, '@global:tab-chat:draft:browser');
  });

  it('delegates folder picking to the host controller for the sender window', async () => {
    mockIpcHandle.mockClear();
    const pickFolder = vi.fn().mockReturnValue({ path: '/workspace/selected', cancelled: false });
    const getHostController = vi.fn(() => ({ pickFolder }));
    const getHostIdForWebContentsId = vi.fn(() => 'secondary-host');

    registerDesktopIpc({
      hostManager: {
        getActiveHostId: () => 'local',
        getHostController,
      } as never,
      windowController: {
        getHostIdForWebContentsId,
      } as never,
    });

    const pickFolderCall = mockIpcHandle.mock.calls.find(([channel]) => channel === 'neon-pilot-desktop:pick-folder');
    expect(pickFolderCall).toBeDefined();

    const result = await pickFolderCall?.[1]({ sender: { id: 42 } }, { cwd: '/workspace', prompt: 'Choose project' });

    expect(getHostIdForWebContentsId).toHaveBeenCalledWith(42);
    expect(getHostController).toHaveBeenCalledWith('secondary-host');
    expect(pickFolder).toHaveBeenCalledWith({ cwd: '/workspace', prompt: 'Choose project' });
    expect(result).toEqual({ path: '/workspace/selected', cancelled: false });
  });
});
