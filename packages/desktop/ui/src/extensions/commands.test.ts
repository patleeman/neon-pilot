import { describe, expect, it, vi } from 'vitest';

import { HOST_COMMAND_IDS } from '../../../server/extensions/hostCommands';
import {
  canExecuteExtensionCommand,
  createHostCommands,
  evaluateCommandEnablement,
  executeExtensionCommand,
  listHostCommands,
  normalizeLegacyCommand,
} from './commands';

describe('extension commands', () => {
  it('keeps the renderer host command catalog aligned with the server allowlist', () => {
    expect(listHostCommands().map((command) => command.id).sort()).toEqual([...HOST_COMMAND_IDS].sort());
  });

  it('normalizes legacy host command strings', () => {
    expect(normalizeLegacyCommand('navigate:/settings')).toEqual({ command: 'app.navigate', args: { to: '/settings' } });
    expect(normalizeLegacyCommand('commandPalette:threads')).toEqual({ command: 'palette.open', args: { scope: 'threads' } });
    expect(normalizeLegacyCommand('layout:workbench')).toEqual({ command: 'layout.set', args: { mode: 'workbench' } });
    expect(normalizeLegacyCommand('core.settings')).toEqual({ command: 'app.navigate', args: { to: '/settings' } });
    expect(normalizeLegacyCommand('core.toggleSidebar')).toEqual({ command: 'layout.toggleSidebar' });
    expect(normalizeLegacyCommand('core.findOnPage')).toEqual({ command: 'page.find' });
    expect(normalizeLegacyCommand('core.closeTab')).toEqual({ command: 'conversation.close' });
    expect(normalizeLegacyCommand('core.archiveRestoreConversation')).toEqual({ command: 'conversation.toggleArchived' });
    expect(normalizeLegacyCommand('core.renameConversation')).toEqual({ command: 'conversation.rename' });
    expect(normalizeLegacyCommand('rightRail:system-browser/browser-tabs')).toEqual({
      command: 'rail.open',
      args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
    });
  });

  it('evaluates the intentionally tiny enablement language', () => {
    const context = { 'speechmic.connected': true, 'layout.mode': 'workbench', 'conversation.isStreaming': false };
    expect(evaluateCommandEnablement('speechmic.connected', context)).toBe(true);
    expect(evaluateCommandEnablement('!conversation.isStreaming', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode == workbench', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode != compact', context)).toBe(true);
    expect(evaluateCommandEnablement('missing.context', context)).toBe(false);
  });

  it('includes hardware-friendly composer and dictation commands', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['composer.submit', 'dictation.toggle']));

    const submitComposer = vi.fn(() => true);
    const toggleDictation = vi.fn(() => true);
    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      submitComposer,
      toggleDictation,
    });

    await expect(Promise.resolve(commands.find((command) => command.id === 'composer.submit')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'dictation.toggle')?.execute(undefined))).resolves.toBe(true);
    expect(submitComposer).toHaveBeenCalledTimes(1);
    expect(toggleDictation).toHaveBeenCalledTimes(1);
  });

  it('includes command-backed app chrome actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['layout.toggle', 'layout.toggleSidebar', 'layout.toggleRightRail', 'page.find']),
    );

    const toggleLayout = vi.fn(() => true);
    const toggleSidebar = vi.fn(() => true);
    const toggleRightRail = vi.fn(() => true);
    const findOnPage = vi.fn(() => true);

    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleLayout,
      toggleSidebar,
      toggleRightRail,
      findOnPage,
    });

    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggle')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggleSidebar')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggleRightRail')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'page.find')?.execute(undefined))).resolves.toBe(true);

    expect(toggleLayout).toHaveBeenCalledTimes(1);
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(toggleRightRail).toHaveBeenCalledTimes(1);
    expect(findOnPage).toHaveBeenCalledTimes(1);
  });

  it('does not report unwired focus commands as handled', async () => {
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
    };

    await expect(executeExtensionCommand('composer.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('sidebar.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.next', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.previous', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('selection.activate', undefined, options)).resolves.toBe(false);
  });

  it('reports optional host commands as disabled when their handlers are missing', () => {
    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
    });
    const commandById = new Map(commands.map((command) => [command.id, command]));

    for (const commandId of [
      'layout.toggle',
      'layout.toggleSidebar',
      'layout.toggleRightRail',
      'page.find',
      'conversation.next',
      'conversation.previous',
      'conversation.close',
      'conversation.reopenClosed',
      'conversation.togglePinned',
      'conversation.toggleArchived',
      'conversation.rename',
      'conversation.editCwd',
      'composer.focus',
      'composer.submit',
      'composer.clear',
      'conversation.pageUp',
      'conversation.pageDown',
      'workbench.newTab',
      'workbench.closeActiveTab',
      'workbench.closeActiveFile',
      'workbench.refreshActiveFile',
      'workbench.toggleExplorer',
      'workbench.toggleDiff',
      'conversation.newAndFocus',
      'model.cycle',
      'thinking.cycle',
      'dictation.toggle',
      'sidebar.focus',
      'focus.next',
      'focus.previous',
      'selection.activate',
    ]) {
      const command = commandById.get(commandId);
      expect(command?.canExecute?.(undefined, {}), commandId).toBe(false);
    }
  });

  it('checks command availability before global keybindings suppress input', () => {
    const extensionCommands = [
      {
        extensionId: 'system-test',
        surfaceId: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        action: 'layout.toggleSidebar',
      },
      {
        extensionId: 'system-test',
        surfaceId: 'run-action',
        title: 'Run Action',
        action: 'runAction',
        enablement: 'workspace.open',
      },
    ];
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      extensionCommands,
      context: { 'workspace.open': true },
    };

    expect(canExecuteExtensionCommand('layout.toggleSidebar', undefined, baseOptions)).toBe(false);
    expect(canExecuteExtensionCommand('system-test.toggle-sidebar', undefined, baseOptions)).toBe(false);
    expect(canExecuteExtensionCommand('system-test.run-action', undefined, baseOptions)).toBe(false);

    expect(
      canExecuteExtensionCommand('system-test.toggle-sidebar', undefined, {
        ...baseOptions,
        toggleSidebar: vi.fn(() => true),
      }),
    ).toBe(true);
    expect(
      canExecuteExtensionCommand('system-test.run-action', undefined, {
        ...baseOptions,
        invokeExtensionCommand: vi.fn(),
      }),
    ).toBe(true);
  });

  it('does not report extension commands as handled without an invoker', async () => {
    const extensionCommands = [
      {
        extensionId: 'system-test',
        surfaceId: 'run-action',
        title: 'Run Action',
        action: 'runAction',
      },
    ];
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      extensionCommands,
    };

    await expect(executeExtensionCommand('system-test.run-action', undefined, options)).resolves.toBe(false);
  });

  it('executes core shortcut aliases through host commands', async () => {
    const navigate = vi.fn();
    const toggleSidebar = vi.fn(() => true);
    const findOnPage = vi.fn(() => true);
    const options = {
      navigate,
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleSidebar,
      findOnPage,
    };

    await expect(executeExtensionCommand('core.settings', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('core.toggleSidebar', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('core.findOnPage', undefined, options)).resolves.toBe(true);

    expect(navigate).toHaveBeenCalledWith('/settings');
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(findOnPage).toHaveBeenCalledTimes(1);
  });

  it('includes command-backed conversation lifecycle actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'conversation.close',
        'conversation.reopenClosed',
        'conversation.togglePinned',
        'conversation.toggleArchived',
        'conversation.rename',
        'conversation.editCwd',
      ]),
    );

    const closeConversation = vi.fn(() => true);
    const reopenClosedConversation = vi.fn(() => true);
    const toggleConversationPin = vi.fn(() => true);
    const toggleConversationArchive = vi.fn(() => true);
    const renameConversation = vi.fn(() => true);
    const editConversationCwd = vi.fn(() => true);

    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      closeConversation,
      reopenClosedConversation,
      toggleConversationPin,
      toggleConversationArchive,
      renameConversation,
      editConversationCwd,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.reopenClosed', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.togglePinned', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.toggleArchived', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.rename', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.editCwd', undefined, options)).resolves.toBe(true);

    expect(closeConversation).toHaveBeenCalledTimes(1);
    expect(reopenClosedConversation).toHaveBeenCalledTimes(1);
    expect(toggleConversationPin).toHaveBeenCalledTimes(1);
    expect(toggleConversationArchive).toHaveBeenCalledTimes(1);
    expect(renameConversation).toHaveBeenCalledTimes(1);
    expect(editConversationCwd).toHaveBeenCalledTimes(1);
  });

  it('blocks active-conversation commands when no conversation is active', async () => {
    const closeConversation = vi.fn(() => true);
    const toggleConversationPin = vi.fn(() => true);
    const editConversationCwd = vi.fn(() => true);
    const pageConversation = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: null,
      closeConversation,
      toggleConversationPin,
      editConversationCwd,
      pageConversation,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.togglePinned', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.editCwd', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.pageUp', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.pageDown', undefined, options)).resolves.toBe(false);
    expect(closeConversation).not.toHaveBeenCalled();
    expect(toggleConversationPin).not.toHaveBeenCalled();
    expect(editConversationCwd).not.toHaveBeenCalled();
    expect(pageConversation).not.toHaveBeenCalled();
  });

  it('uses command context for active-conversation enablement', async () => {
    const closeConversation = vi.fn(() => true);
    const pageConversation = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      context: { 'conversation.hasActive': true },
      closeConversation,
      pageConversation,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.pageDown', undefined, options)).resolves.toBe(true);
    expect(closeConversation).toHaveBeenCalledTimes(1);
    expect(pageConversation).toHaveBeenCalledWith('down');
  });

  it('includes command-backed workbench actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'workbench.newTab',
        'workbench.closeActiveTab',
        'workbench.closeActiveFile',
        'workbench.refreshActiveFile',
        'workbench.toggleExplorer',
        'workbench.toggleDiff',
      ]),
    );

    const newWorkbenchTab = vi.fn(() => true);
    const closeActiveWorkbenchTab = vi.fn(() => true);
    const closeActiveWorkbenchFile = vi.fn(() => true);
    const refreshActiveWorkbenchFile = vi.fn(() => true);
    const toggleWorkbenchExplorer = vi.fn(() => true);
    const toggleWorkbenchDiff = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      newWorkbenchTab,
      closeActiveWorkbenchTab,
      closeActiveWorkbenchFile,
      refreshActiveWorkbenchFile,
      toggleWorkbenchExplorer,
      toggleWorkbenchDiff,
    };

    await expect(executeExtensionCommand('workbench.newTab', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.closeActiveTab', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.closeActiveFile', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.refreshActiveFile', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.toggleExplorer', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.toggleDiff', undefined, options)).resolves.toBe(true);

    expect(newWorkbenchTab).toHaveBeenCalledTimes(1);
    expect(closeActiveWorkbenchTab).toHaveBeenCalledTimes(1);
    expect(closeActiveWorkbenchFile).toHaveBeenCalledTimes(1);
    expect(refreshActiveWorkbenchFile).toHaveBeenCalledTimes(1);
    expect(toggleWorkbenchExplorer).toHaveBeenCalledTimes(1);
    expect(toggleWorkbenchDiff).toHaveBeenCalledTimes(1);
  });
});
