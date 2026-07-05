// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CommandsSettingsSection,
  DesktopConnectionsSettingsPanel,
  DesktopKeyboardShortcutsSettingsSection,
  desktopShortcutIdForHostCommand,
} from '../../../../../extensions/system-settings/src/SettingsPage';
import { CORE_KEYBOARD_SHORTCUT_REGISTRATIONS, DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS } from '../../../src/keyboard-shortcuts';
import { api } from '../client/api';
import type { NeonPilotDesktopBridge } from '../desktop/desktopBridge';
import { listHostCommands } from '../extensions/commands';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const DEFAULT_KEYBOARD_SHORTCUTS = DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS;

const mountedRoots: Root[] = [];
const mocks = vi.hoisted(() => ({
  getEnvironment: vi.fn(),
  readDesktopAppPreferences: vi.fn(),
  updateDesktopAppPreferences: vi.fn(),
}));

function installDesktopBridge() {
  window.neonPilotDesktop = {
    getEnvironment: mocks.getEnvironment,
    readDesktopAppPreferences: mocks.readDesktopAppPreferences,
    updateDesktopAppPreferences: mocks.updateDesktopAppPreferences,
  } as unknown as NeonPilotDesktopBridge;
  document.documentElement.dataset.neonPilotDesktop = '1';
}

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DesktopConnectionsSettingsPanel />);
  });

  mountedRoots.push(root);
  return { container };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('DesktopConnectionsSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDesktopBridge();
    mocks.readDesktopAppPreferences.mockResolvedValue({
      available: true,
      supportsStartOnSystemStart: true,
      autoInstallUpdates: true,
      updatePath: 'test',
      startOnSystemStart: false,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
      update: {
        supported: true,
        status: 'idle',
        currentVersion: '0.3.7',
      },
    });
    mocks.updateDesktopAppPreferences.mockResolvedValue({
      available: true,
      supportsStartOnSystemStart: true,
      autoInstallUpdates: true,
      updatePath: 'test',
      startOnSystemStart: false,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
      update: {
        supported: true,
        status: 'idle',
        currentVersion: '0.3.7',
      },
    });
    vi.spyOn(api, 'invokeExtensionAction').mockResolvedValue({
      ok: true,
      result: {
        target: '/Users/patrick/.local/state/neon-pilot-testing/bin/neon-pilot',
        binDir: '/Users/patrick/.local/state/neon-pilot-testing/bin',
        linkPath: '/Users/patrick/.local/bin/neon-pilot',
        globallyInstalled: false,
        linkExists: false,
        linkConflict: false,
      },
    });
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
    document.documentElement.dataset.neonPilotDesktop = '';
    delete window.neonPilotDesktop;
    vi.restoreAllMocks();
  });

  it('renders app behavior settings', async () => {
    const { container } = renderPanel();
    await flushAsyncWork();

    expect(container.textContent).toContain('Install updates automatically');
    expect(container.textContent).toContain('Update channel');
    expect(container.textContent).toContain('Launch Neon Pilot when you sign in');
  });

  it('persists app behavior changes through the desktop bridge', async () => {
    mocks.readDesktopAppPreferences
      .mockResolvedValueOnce({
        available: true,
        supportsStartOnSystemStart: true,
        autoInstallUpdates: true,
        updatePath: 'test',
        startOnSystemStart: false,
        keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
        update: {
          supported: true,
          status: 'idle',
          currentVersion: '0.3.7',
        },
      })
      .mockResolvedValueOnce({
        available: true,
        supportsStartOnSystemStart: true,
        autoInstallUpdates: false,
        updatePath: 'test',
        startOnSystemStart: false,
        keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
        update: {
          supported: true,
          status: 'idle',
          currentVersion: '0.3.7',
        },
      })
      .mockResolvedValueOnce({
        available: true,
        supportsStartOnSystemStart: true,
        autoInstallUpdates: false,
        updatePath: 'stable',
        startOnSystemStart: false,
        keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
        update: {
          supported: true,
          status: 'idle',
          currentVersion: '0.3.7',
        },
      })
      .mockResolvedValue({
        available: true,
        supportsStartOnSystemStart: true,
        autoInstallUpdates: false,
        updatePath: 'stable',
        startOnSystemStart: true,
        keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
        update: {
          supported: true,
          status: 'idle',
          currentVersion: '0.3.7',
        },
      });

    const { container } = renderPanel();
    await flushAsyncWork();

    const autoInstallSwitch = container.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="Install updates automatically"]',
    );
    if (!(autoInstallSwitch instanceof HTMLButtonElement)) {
      throw new Error('Expected auto-install switch');
    }
    act(() => {
      autoInstallSwitch.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    const updatePathSelect = container.querySelector<HTMLSelectElement>('#desktop-update-path');
    if (!(updatePathSelect instanceof HTMLSelectElement)) {
      throw new Error('Expected update path select');
    }
    act(() => {
      updatePathSelect.value = 'stable';
      updatePathSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushAsyncWork();

    const startOnSignInSwitch = container.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="Launch Neon Pilot when you sign in"]',
    );
    if (!(startOnSignInSwitch instanceof HTMLButtonElement)) {
      throw new Error('Expected start-on-sign-in switch');
    }
    act(() => {
      startOnSignInSwitch.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    expect(mocks.updateDesktopAppPreferences).toHaveBeenCalledWith({ autoInstallUpdates: false });
    expect(mocks.updateDesktopAppPreferences).toHaveBeenCalledWith({ updatePath: 'stable' });
    expect(mocks.updateDesktopAppPreferences).toHaveBeenCalledWith({ startOnSystemStart: true });
    expect(mocks.readDesktopAppPreferences).toHaveBeenCalledTimes(4);
  });

  it('shows occupied CLI links without offering an unsafe install action', async () => {
    vi.spyOn(api, 'invokeExtensionAction').mockResolvedValue({
      ok: true,
      result: {
        target: '/Users/patrick/.local/state/neon-pilot-testing/bin/neon-pilot',
        binDir: '/Users/patrick/.local/state/neon-pilot-testing/bin',
        linkPath: '/Users/patrick/.local/bin/neon-pilot',
        globallyInstalled: false,
        linkExists: true,
        linkConflict: true,
        linkTarget: '/Users/patrick/.local/state/neon-pilot/bin/neon-pilot',
      },
    });

    const { container } = renderPanel();
    await flushAsyncWork();

    expect(container.textContent).toContain('Used by another install');
    expect(container.textContent).toContain('The shell command is already linked to another Neon Pilot install.');
    expect(container.textContent).toContain('/Users/patrick/.local/state/neon-pilot/bin/neon-pilot');
    expect(container.querySelector('button[aria-label="Install Neon Pilot CLI"]')).toBeNull();
  });
});

describe('DesktopKeyboardShortcutsSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDesktopBridge();
    mocks.readDesktopAppPreferences.mockResolvedValue({
      available: true,
      supportsStartOnSystemStart: true,
      autoInstallUpdates: true,
      updatePath: 'test',
      startOnSystemStart: false,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
      update: {
        supported: true,
        status: 'idle',
        currentVersion: '0.3.7',
      },
    });
    mocks.updateDesktopAppPreferences.mockImplementation(async (patch) => ({
      available: true,
      supportsStartOnSystemStart: true,
      autoInstallUpdates: true,
      updatePath: 'test',
      startOnSystemStart: false,
      keyboardShortcuts: {
        ...DEFAULT_KEYBOARD_SHORTCUTS,
        conversationMode: 'F4',
        ...patch.keyboardShortcuts,
      },
      update: {
        supported: true,
        status: 'idle',
        currentVersion: '0.3.7',
      },
    }));
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
    document.documentElement.dataset.neonPilotDesktop = '';
    delete window.neonPilotDesktop;
  });

  it('renders extension shortcut ownership without internal extension IDs', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-browser',
        surfaceId: 'open-browser',
        packageType: 'system',
        title: 'Open browser',
        keys: ['mod+shift+b'],
        command: 'rail.open',
        args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
        scope: 'global',
        defaultKeys: ['mod+shift+b'],
        enabled: true,
      },
    ]);
    vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();

    const row = Array.from(container.querySelectorAll('.settings-page-control-row')).find((candidate) =>
      candidate.textContent?.includes('Open browser'),
    );
    expect(row?.textContent).toContain('Built-in app · Global shortcut');
    expect(row?.textContent).not.toContain('system-browser');
    expect(row?.textContent).not.toContain('browser-tabs');
  });

  it('captures arbitrary shortcut chords and auto-saves every desktop shortcut', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector('#settings-keyboard-conversationMode');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected conversation mode shortcut capture button');
    }

    act(() => {
      shortcutButton.focus();
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'k',
          code: 'KeyK',
          metaKey: true,
          altKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(mocks.updateDesktopAppPreferences).toHaveBeenCalledWith({
      keyboardShortcuts: expect.objectContaining({ conversationMode: 'CommandOrControl+Alt+K' }),
    });
    expect(container.textContent).toContain('Show Neon Pilot');
    expect(container.textContent).toContain('Find on page');
    expect(container.textContent).toContain('New workbench tab');
    expect(container.textContent).toContain('⌘/Ctrl + T');
    expect(container.textContent).toContain('Close workbench file');
    expect(container.textContent).toContain('⌘/Ctrl + Alt + W');
    expect(container.textContent).toContain('Refresh workbench file');
    expect(container.textContent).toContain('F5');
    expect(container.textContent).toContain('Toggle workbench explorer');
    expect(container.textContent).toContain('⌘/Ctrl + B');
    expect(container.textContent).toContain('Toggle workbench diff');
    expect(container.textContent).toContain('⌘/Ctrl + Shift + D');
    expect(container.textContent).toContain('Toggle right sidebar');
    expect(container.textContent).not.toContain('Built-in shortcuts');
    expect(container.textContent).not.toContain('Save shortcuts');
  });

  it('rejects duplicate shortcut edits before writing desktop preferences', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();
    mocks.updateDesktopAppPreferences.mockClear();

    const shortcutButton = container.querySelector('#settings-keyboard-conversationMode');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected conversation mode shortcut capture button');
    }

    act(() => {
      shortcutButton.focus();
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'n',
          code: 'KeyN',
          metaKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('Duplicate shortcut: CommandOrControl+N is already assigned.');
    expect(mocks.updateDesktopAppPreferences).not.toHaveBeenCalled();
  });

  it('rejects desktop shortcut edits that conflict with extension keybindings before writing preferences', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-browser',
        surfaceId: 'open-browser',
        packageType: 'system',
        title: 'Open browser',
        keys: ['mod+shift+b'],
        command: 'rail.open',
        args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
        scope: 'global',
        defaultKeys: ['mod+shift+b'],
        enabled: true,
      },
    ]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();
    mocks.updateDesktopAppPreferences.mockClear();

    const shortcutButton = container.querySelector('#settings-keyboard-conversationMode');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected conversation mode shortcut capture button');
    }

    act(() => {
      shortcutButton.focus();
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'b',
          code: 'KeyB',
          metaKey: true,
          shiftKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('Duplicate shortcut: CommandOrControl+Shift+B is already assigned.');
    expect(container.textContent).toContain('Open browser already uses it.');
    expect(container.textContent).toContain('⌘/Ctrl + Shift + b is assigned to both Conversation mode and Open browser.');
    expect(mocks.updateDesktopAppPreferences).not.toHaveBeenCalled();
  });

  it('rejects extension shortcut edits that conflict with desktop shortcuts before writing keybindings', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-browser',
        surfaceId: 'open-browser',
        packageType: 'system',
        title: 'Open browser',
        keys: ['mod+shift+b'],
        command: 'rail.open',
        args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
        scope: 'global',
        defaultKeys: ['mod+shift+b'],
        enabled: true,
      },
    ]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector('#settings-keyboard-system-browser\\:open-browser');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open browser shortcut capture button');
    }

    act(() => {
      shortcutButton.focus();
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'n',
          code: 'KeyN',
          metaKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('Duplicate shortcut: CommandOrControl+N is already assigned.');
    expect(container.textContent).toContain('New conversation already uses it.');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('detects shortcut conflicts even when modifiers are declared in a different order', async () => {
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-test',
        surfaceId: 'close-file',
        packageType: 'system',
        title: 'Close file from extension',
        keys: ['Alt+Mod+W'],
        command: 'test.closeFile',
        scope: 'global',
        defaultKeys: ['Alt+Mod+W'],
        enabled: true,
      },
    ]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('Close workbench file');
    expect(container.textContent).toContain('Close file from extension');
    expect(container.textContent).toContain('Alt + ⌘/Ctrl + W is assigned to both Close workbench file and Close file from extension.');
  });

  it('detects shortcut conflicts when arrows use alternate names', async () => {
    mocks.readDesktopAppPreferences.mockResolvedValue({
      available: true,
      supportsStartOnSystemStart: true,
      autoInstallUpdates: true,
      updatePath: 'test',
      startOnSystemStart: false,
      keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS, conversationMode: 'Alt+Left' },
      update: {
        supported: true,
        status: 'idle',
        currentVersion: '0.3.7',
      },
    });
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-test',
        surfaceId: 'go-back',
        packageType: 'system',
        title: 'Go back from extension',
        keys: ['Alt+ArrowLeft'],
        command: 'test.goBack',
        scope: 'global',
        defaultKeys: ['Alt+ArrowLeft'],
        enabled: true,
      },
    ]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<DesktopKeyboardShortcutsSettingsSection />);
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('Conversation mode');
    expect(container.textContent).toContain('Go back from extension');
    expect(container.textContent).toContain('Alt + ArrowLeft is assigned to both Conversation mode and Go back from extension.');
  });
});

describe('CommandsSettingsSection', () => {
  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('maps every host-backed desktop shortcut registration without legacy command aliases', () => {
    const hostCommandIds = new Set(listHostCommands().map((command) => command.id));
    const desktopNativeCommands = new Set(['core.showApp', 'core.quit']);

    for (const registration of CORE_KEYBOARD_SHORTCUT_REGISTRATIONS) {
      if (desktopNativeCommands.has(registration.command)) continue;

      expect(hostCommandIds.has(registration.command), registration.id).toBe(true);
      expect(
        desktopShortcutIdForHostCommand({
          id: registration.command,
          extensionId: 'host',
          args: registration.args,
        }),
        registration.id,
      ).toBe(registration.id);
    }
  });

  it('matches command shortcuts by action args when actions are shared', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-conversation-tools',
        id: 'open-thread-palette',
        title: 'Open thread palette',
        action: 'palette.open',
        args: { scope: 'threads' },
      },
      {
        extensionId: 'system-conversation-tools',
        id: 'open-command-palette',
        title: 'Open command palette',
        action: 'palette.open',
        args: { scope: 'commands' },
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-conversation-tools',
        surfaceId: 'open-thread-palette',
        title: 'Open thread palette',
        keys: ['mod+p'],
        command: 'palette.open',
        args: { scope: 'threads' },
        scope: 'global',
        defaultKeys: ['mod+p'],
        enabled: true,
      },
      {
        extensionId: 'system-conversation-tools',
        surfaceId: 'open-command-palette',
        title: 'Open command palette',
        keys: ['mod+shift+p'],
        command: 'palette.open',
        args: { scope: 'commands' },
        when: 'workspace.open',
        scope: 'global',
        defaultKeys: ['mod+shift+p'],
        enabled: true,
      },
    ]);
    vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const rows = Array.from(container.querySelectorAll('.settings-page-control-row'));
    const threadRow = rows.find((row) => row.textContent?.includes('Open thread palette'));
    const commandRow = rows.find((row) => row.textContent?.includes('Open command palette'));
    expect(threadRow).toBeDefined();
    expect(commandRow).toBeDefined();
    expect(threadRow?.textContent).toContain('⌘/Ctrl + p');
    expect(threadRow?.textContent).not.toContain('⌘/Ctrl + Shift + p');
    expect(commandRow?.textContent).toContain('⌘/Ctrl + Shift + p');
    expect(commandRow?.textContent).not.toContain('mod + k');

    const disableButton = commandRow?.querySelector<HTMLButtonElement>('button[aria-label="Disable shortcut for Open command palette"]');
    if (!(disableButton instanceof HTMLButtonElement)) {
      throw new Error('Expected command palette shortcut disable button');
    }

    act(() => {
      disableButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    expect(api.updateExtensionKeybinding).toHaveBeenCalledWith('system-conversation-tools', 'open-command-palette', { enabled: false });
  });

  it('does not render internal command IDs in command shortcut descriptions', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-settings',
        id: 'open-settings',
        title: 'Open Settings',
        action: 'open-settings',
        category: 'Settings',
        packageType: 'system',
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-settings',
        surfaceId: 'open-settings',
        title: 'Open Settings',
        keys: ['mod+,'],
        command: 'system-settings.open-settings',
        scope: 'global',
        defaultKeys: ['mod+,'],
        enabled: true,
      },
    ]);
    vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const rows = Array.from(container.querySelectorAll('.settings-page-control-row'));
    const toggleSidebarRow = rows.find((row) => row.textContent?.includes('Toggle Left Sidebar'));
    const openSettingsRow = rows.find((row) => row.textContent?.includes('Open Settings'));

    expect(toggleSidebarRow?.textContent).toContain('App · Built-in');
    expect(toggleSidebarRow?.textContent).not.toContain('layout.toggleSidebar');
    expect(openSettingsRow?.textContent).toContain('Settings · Built-in app');
    expect(openSettingsRow?.textContent).not.toContain('system-settings.open-settings');
  });

  it('cancels capture mode on Escape without saving', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-settings',
        id: 'open-settings',
        title: 'Open Settings',
        action: 'settings.open',
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-settings',
        surfaceId: 'open-settings',
        title: 'Open Settings',
        keys: ['mod+,'],
        command: 'settings.open',
        scope: 'global',
        defaultKeys: ['mod+,'],
        enabled: true,
      },
    ]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const rows = Array.from(container.querySelectorAll('.settings-page-control-row'));
    const openSettingsRow = rows.find((row) => row.textContent?.includes('Open Settings'));
    const shortcutButton = openSettingsRow?.querySelector<HTMLButtonElement>('button.ui-shortcut-capture');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Settings shortcut capture button in extension row');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(shortcutButton.textContent).toContain('Press shortcut...');
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
          code: 'Escape',
        }),
      );
    });
    await flushAsyncWork();

    expect(shortcutButton.textContent).toContain('⌘/Ctrl + ,');
    expect(shortcutButton.textContent).not.toContain('Press shortcut...');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('cancels capture mode when clicking outside', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-settings',
        id: 'open-settings',
        title: 'Open Settings',
        action: 'settings.open',
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-settings',
        surfaceId: 'open-settings',
        title: 'Open Settings',
        keys: ['mod+shift+s'],
        command: 'settings.open',
        scope: 'global',
        defaultKeys: ['mod+shift+s'],
        enabled: true,
      },
    ]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(container);
    document.body.appendChild(outsideButton);

    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <div>
          <CommandsSettingsSection />
        </div>,
      );
    });
    await flushAsyncWork();

    const rows = Array.from(container.querySelectorAll('.settings-page-control-row'));
    const openSettingsRow = rows.find((row) => row.textContent?.includes('Open Settings'));
    const shortcutButton = openSettingsRow?.querySelector<HTMLButtonElement>('button.ui-shortcut-capture');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Settings shortcut capture button in extension row');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(shortcutButton.textContent).toContain('Press shortcut...');
    await flushAsyncWork();

    act(() => {
      outsideButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    expect(shortcutButton.textContent).toContain('⌘/Ctrl + Shift + s');
    expect(shortcutButton.textContent).not.toContain('Press shortcut...');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects conflicting command shortcut edits before writing extension keybindings', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-browser',
        id: 'open-browser',
        title: 'Open browser',
        action: 'rail.open',
        args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
      },
      {
        extensionId: 'system-settings',
        id: 'open-settings',
        title: 'Open Settings',
        action: 'settings.open',
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-browser',
        surfaceId: 'open-browser',
        title: 'Open browser',
        keys: ['mod+shift+b'],
        command: 'rail.open',
        args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
        scope: 'global',
        defaultKeys: ['mod+shift+b'],
        enabled: true,
      },
    ]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector<HTMLButtonElement>(
      '#settings-command-keybinding-system-settings\\:command\\:system-settings\\.open-settings',
    );
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Settings shortcut capture button');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'b',
          code: 'KeyB',
          metaKey: true,
          shiftKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain('⌘/Ctrl + Shift + B is already assigned to Open browser.');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(shortcutButton.textContent).toContain('Click to record shortcut');
  });

  it('restores the visible shortcut when a declared command shortcut save fails', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-notes',
        id: 'notes.open',
        title: 'Open Notes',
        action: 'rail.open',
        args: { extensionId: 'system-notes', surfaceId: 'notes' },
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-notes',
        surfaceId: 'notes.open',
        title: 'Open Notes',
        keys: ['mod+shift+n'],
        command: 'rail.open',
        args: { extensionId: 'system-notes', surfaceId: 'notes' },
        scope: 'global',
        defaultKeys: ['mod+shift+n'],
        enabled: true,
      },
    ]);
    vi.spyOn(api, 'updateExtensionKeybinding').mockRejectedValue(new Error('Cannot create keybinding for unknown command: rail.open'));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector<HTMLButtonElement>('#settings-command-keybinding-system-notes\\:notes\\.open');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Notes shortcut capture button');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'n',
          code: 'KeyN',
          metaKey: true,
          altKey: true,
          shiftKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(api.updateExtensionKeybinding).toHaveBeenCalledWith('system-notes', 'notes.open', {
      keys: ['CommandOrControl+Alt+Shift+N'],
      enabled: true,
    });
    expect(shortcutButton.textContent).toContain('⌘/Ctrl + Shift + n');
    expect(shortcutButton.textContent).not.toContain('⌘/Ctrl + Alt + Shift + N');
    expect(container.textContent).toContain('Could not save shortcut because its command is no longer available.');
  });

  it('sanitizes internal command shortcut save failures', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-notes',
        id: 'notes.open',
        title: 'Open Notes',
        action: 'rail.open',
        args: { extensionId: 'system-notes', surfaceId: 'notes' },
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([
      {
        extensionId: 'system-notes',
        surfaceId: 'notes.open',
        title: 'Open Notes',
        keys: ['mod+shift+n'],
        command: 'rail.open',
        args: { extensionId: 'system-notes', surfaceId: 'notes' },
        scope: 'global',
        defaultKeys: ['mod+shift+n'],
        enabled: true,
      },
    ]);
    vi.spyOn(api, 'updateExtensionKeybinding').mockRejectedValue(
      new Error(
        'Local API route did not complete for PATCH /api/extensions/keybindings/system-notes/notes.open at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/app/localApi.js:132:20)',
      ),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector<HTMLButtonElement>('#settings-command-keybinding-system-notes\\:notes\\.open');
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Notes shortcut capture button');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'n',
          code: 'KeyN',
          metaKey: true,
          altKey: true,
          shiftKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(shortcutButton.textContent).toContain('⌘/Ctrl + Shift + n');
    expect(container.textContent).toContain('Could not save shortcut. Reload apps and try again.');
    expect(container.textContent).not.toContain('/api/extensions/keybindings');
    expect(container.textContent).not.toContain('localApi.js');
    expect(container.textContent).not.toContain('file://');
    expect(container.textContent).not.toContain('Module.ep');
  });

  it('saves non-conflicting command shortcut edits', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-settings',
        id: 'open-settings',
        title: 'Open Settings',
        action: 'settings.open',
      },
    ]);
    vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    const shortcutButton = container.querySelector<HTMLButtonElement>(
      '#settings-command-keybinding-system-settings\\:command\\:system-settings\\.open-settings',
    );
    if (!(shortcutButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Open Settings shortcut capture button');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    act(() => {
      shortcutButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'y',
          code: 'KeyY',
          metaKey: true,
          altKey: true,
          shiftKey: true,
        }),
      );
    });
    await flushAsyncWork();

    expect(updateSpy).toHaveBeenCalledWith(
      'system-settings',
      'command:system-settings.open-settings',
      expect.objectContaining({
        keys: ['CommandOrControl+Alt+Shift+Y'],
        enabled: true,
        title: 'Open Settings',
        command: 'system-settings.open-settings',
      }),
    );
  });

  it('keeps host commands out of the editable command shortcut catalog', async () => {
    installDesktopBridge();
    mocks.readDesktopAppPreferences.mockResolvedValue({
      available: true,
      startOnSystemStart: false,
      supportsStartOnSystemStart: true,
      keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS, focusComposer: 'CommandOrControl+Alt+L' },
    });
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    const keybindingsSpy = vi.spyOn(api, 'extensionKeybindings').mockResolvedValue([]);
    const updateSpy = vi.spyOn(api, 'updateExtensionKeybinding').mockResolvedValue({ ok: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<CommandsSettingsSection />);
    });
    await flushAsyncWork();

    expect(keybindingsSpy).toHaveBeenCalled();
    const rows = Array.from(container.querySelectorAll('.settings-page-control-row'));
    const focusComposerRow = rows.find((row) => row.textContent?.includes('Focus composer'));
    expect(focusComposerRow).toBeUndefined();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('ignores stale overlapping command shortcut loads', async () => {
    const staleCommands = deferred<Awaited<ReturnType<typeof api.extensionCommands>>>();
    const freshCommands = deferred<Awaited<ReturnType<typeof api.extensionCommands>>>();
    const staleKeybindings = deferred<Awaited<ReturnType<typeof api.extensionKeybindings>>>();
    const freshKeybindings = deferred<Awaited<ReturnType<typeof api.extensionKeybindings>>>();

    vi.spyOn(api, 'extensionCommands').mockReturnValueOnce(staleCommands.promise).mockReturnValueOnce(freshCommands.promise);
    vi.spyOn(api, 'extensionKeybindings').mockReturnValueOnce(staleKeybindings.promise).mockReturnValueOnce(freshKeybindings.promise);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <React.StrictMode>
          <CommandsSettingsSection />
        </React.StrictMode>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(api.extensionCommands).toHaveBeenCalledTimes(2);

    await act(async () => {
      freshCommands.resolve([
        {
          extensionId: 'system-fresh',
          id: 'fresh-command',
          title: 'Fresh command',
          action: 'fresh.run',
        },
      ]);
      freshKeybindings.resolve([
        {
          extensionId: 'system-fresh',
          surfaceId: 'fresh-command',
          title: 'Fresh command',
          keys: ['mod+f'],
          command: 'fresh.run',
          scope: 'global',
          enabled: true,
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Fresh command');
    expect(container.textContent).toContain('⌘/Ctrl + f');

    await act(async () => {
      staleCommands.resolve([
        {
          extensionId: 'system-stale',
          id: 'stale-command',
          title: 'Stale command',
          action: 'stale.run',
        },
      ]);
      staleKeybindings.resolve([
        {
          extensionId: 'system-stale',
          surfaceId: 'stale-command',
          title: 'Stale command',
          keys: ['mod+s'],
          command: 'stale.run',
          scope: 'global',
          enabled: true,
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Fresh command');
    expect(container.textContent).not.toContain('Stale command');
  });
});
