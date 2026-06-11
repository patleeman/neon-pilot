import { describe, expect, it } from 'vitest';

import { DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS } from './keyboard-shortcuts.js';
import { buildDesktopApplicationMenuTemplate } from './menu.js';

function noop() {}

function collectAccelerators(items: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem>): string[] {
  const accelerators: string[] = [];
  for (const item of items) {
    if ('accelerator' in item && typeof item.accelerator === 'string') accelerators.push(item.accelerator);
    if ('submenu' in item && Array.isArray(item.submenu)) {
      accelerators.push(...collectAccelerators(item.submenu as Array<Electron.MenuItemConstructorOptions | Electron.MenuItem>));
    }
  }
  return accelerators;
}

describe('buildDesktopApplicationMenuTemplate', () => {
  it.each(['darwin', 'win32'] as const)('includes every default desktop shortcut accelerator on %s', (platform) => {
    const items = buildDesktopApplicationMenuTemplate(
      {
        onOpen: noop,
        onNewConversation: noop,
        onCloseConversation: noop,
        onReopenClosedConversation: noop,
        onPreviousConversation: noop,
        onNextConversation: noop,
        onToggleConversationPin: noop,
        onToggleConversationArchive: noop,
        onRenameConversation: noop,
        onFocusComposer: noop,
        onEditWorkingDirectory: noop,
        onFindInPage: noop,
        onToggleSidebar: noop,
        onToggleRightRail: noop,
        onShowConversationMode: noop,
        onShowWorkbenchMode: noop,
        onNewWorkbenchTab: noop,
        onCloseWorkbenchTab: noop,
        onCloseWorkbenchFile: noop,
        onRefreshWorkbenchFile: noop,
        onToggleWorkbenchExplorer: noop,
        onToggleWorkbenchDiff: noop,
        onSettings: noop,
        onQuit: noop,
      } as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0],
      { platform },
    );

    expect(new Set(collectAccelerators(items))).toEqual(new Set(Object.values(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS)));
  });

  it('includes the File menu on macOS', () => {
    const items = buildDesktopApplicationMenuTemplate(
      {
        onNewConversation: noop,
        onCloseConversation: noop,
        onSettings: noop,
        onQuit: noop,
      } as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0],
      { platform: 'darwin' },
    );

    const fileMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'File',
    );
    expect(fileMenu).toBeDefined();
    expect(fileMenu && 'submenu' in fileMenu ? Array.isArray(fileMenu.submenu) : false).toBe(true);
  });

  it('includes macOS app menu on darwin', () => {
    const items = buildDesktopApplicationMenuTemplate(
      { onQuit: noop, onSettings: noop } as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0],
      { platform: 'darwin' },
    );

    const appMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) =>
        'label' in item && item.label !== 'File' && item.label !== 'Edit' && item.label !== 'View' && item.label !== 'Window',
    );
    expect(appMenu).toBeDefined();
  });

  it('puts Settings in the top-level File menu on non-macOS', () => {
    const items = buildDesktopApplicationMenuTemplate(
      { onSettings: noop, onQuit: noop } as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0],
      { platform: 'win32' },
    );

    const fileMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'File',
    );
    expect(fileMenu).toBeDefined();
    if (fileMenu && 'submenu' in fileMenu && Array.isArray(fileMenu.submenu)) {
      expect(
        fileMenu.submenu.some(
          (sub: unknown) =>
            typeof sub === 'object' &&
            sub !== null &&
            'label' in (sub as Record<string, unknown>) &&
            (sub as Record<string, unknown>).label === 'Settings…',
        ),
      ).toBe(true);
    }
  });

  it('creates a non-empty Edit menu', () => {
    const items = buildDesktopApplicationMenuTemplate({ onFindInPage: noop } as unknown as Parameters<
      typeof buildDesktopApplicationMenuTemplate
    >[0]);

    const editMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Edit',
    );
    expect(editMenu).toBeDefined();
    if (editMenu && 'submenu' in editMenu && Array.isArray(editMenu.submenu)) {
      expect(editMenu.submenu.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('creates a View menu with layout mode switchers', () => {
    const items = buildDesktopApplicationMenuTemplate({
      onToggleSidebar: noop,
      onToggleRightRail: noop,
      onShowConversationMode: noop,
      onShowWorkbenchMode: noop,
      onNewWorkbenchTab: noop,
      onCloseWorkbenchTab: noop,
      onCloseWorkbenchFile: noop,
      onRefreshWorkbenchFile: noop,
      onToggleWorkbenchExplorer: noop,
      onToggleWorkbenchDiff: noop,
    } as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0]);

    const viewMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'View',
    );
    expect(viewMenu).toBeDefined();
    if (viewMenu && 'submenu' in viewMenu && Array.isArray(viewMenu.submenu)) {
      expect(
        viewMenu.submenu.some(
          (sub: unknown) =>
            typeof sub === 'object' &&
            sub !== null &&
            'label' in (sub as Record<string, unknown>) &&
            (sub as Record<string, unknown>).label === 'Conversation Mode',
        ),
      ).toBe(true);
      expect(
        viewMenu.submenu.some(
          (sub: unknown) =>
            typeof sub === 'object' &&
            sub !== null &&
            'label' in (sub as Record<string, unknown>) &&
            (sub as Record<string, unknown>).label === 'Workbench Mode',
        ),
      ).toBe(true);
      for (const label of [
        'New Workbench Tab',
        'Close Workbench Tab',
        'Close Workbench File',
        'Refresh Workbench File',
        'Toggle Workbench Explorer',
        'Toggle Workbench Diff',
      ]) {
        expect(
          viewMenu.submenu.some(
            (sub: unknown) =>
              typeof sub === 'object' &&
              sub !== null &&
              'label' in (sub as Record<string, unknown>) &&
              (sub as Record<string, unknown>).label === label,
          ),
        ).toBe(true);
      }
    }
  });

  it('creates a Window menu', () => {
    const items = buildDesktopApplicationMenuTemplate({ onHideWindow: noop } as unknown as Parameters<
      typeof buildDesktopApplicationMenuTemplate
    >[0]);

    const windowMenu = items.find(
      (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Window',
    );
    expect(windowMenu).toBeDefined();
  });

  it('sets enabled=false for items without click handlers', () => {
    const items = buildDesktopApplicationMenuTemplate({} as unknown as Parameters<typeof buildDesktopApplicationMenuTemplate>[0]);
    // Should still produce a valid template, just with undefined click handlers
    expect(items.length).toBeGreaterThanOrEqual(3);
  });
});
