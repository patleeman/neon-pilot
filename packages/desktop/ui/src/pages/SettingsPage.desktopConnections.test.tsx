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
import { listHostCommands, normalizeLegacyCommand } from '../extensions/commands';

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

  it('renders app behavior settings', async () => {
    const { container } = renderPanel();
    await flushAsyncWork();

    expect(container.textContent).toContain('Auto-install updates');
    expect(container.textContent).toContain('Update path');
    expect(container.textContent).toContain('Start on sign in');
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

    const autoInstallSwitch = container.querySelector<HTMLButtonElement>('button[role="switch"][aria-label="Auto-install updates"]');
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

    const startOnSignInSwitch = container.querySelector<HTMLButtonElement>('button[role="switch"][aria-label="Start on sign in"]');
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
    expect(container.textContent).toContain('Toggle right rail');
    expect(container.textContent).not.toContain('Built-in shortcuts');
    expect(container.textContent).not.toContain('Save shortcuts');
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

  it('maps every host-backed desktop shortcut registration through the shared command normalizer', () => {
    const hostCommandIds = new Set(listHostCommands().map((command) => command.id));
    const desktopNativeCommands = new Set(['core.showApp', 'core.quit']);

    for (const registration of CORE_KEYBOARD_SHORTCUT_REGISTRATIONS) {
      if (desktopNativeCommands.has(registration.command)) continue;

      const normalized = normalizeLegacyCommand(registration.command);
      expect(hostCommandIds.has(normalized.command), registration.id).toBe(true);
      expect(
        desktopShortcutIdForHostCommand({
          id: normalized.command,
          extensionId: 'host',
          args: normalized.args,
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

    const clearButton = commandRow?.querySelector<HTMLButtonElement>('button[aria-label="Clear shortcut for Open command palette"]');
    if (!(clearButton instanceof HTMLButtonElement)) {
      throw new Error('Expected command palette shortcut clear button');
    }

    act(() => {
      clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncWork();

    expect(api.updateExtensionKeybinding).toHaveBeenCalledWith(
      'system-conversation-tools',
      'open-command-palette',
      expect.objectContaining({ enabled: false, when: 'workspace.open' }),
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
});
