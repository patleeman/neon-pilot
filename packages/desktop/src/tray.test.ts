import { describe, expect, it } from 'vitest';

import { buildDesktopTrayMenuTemplate } from './tray.js';

// ── tray — menu template builder ──────────────────────────────────────────

describe('buildDesktopTrayMenuTemplate', () => {
  it('shows starting state', () => {
    const items = buildDesktopTrayMenuTemplate({
      startupState: { kind: 'starting' },
      actions: {} as ReturnType<typeof buildDesktopTrayMenuTemplate> extends never
        ? never
        : Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    expect(
      items.some(
        (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) =>
          'label' in item && typeof item.label === 'string' && item.label.includes('Launching'),
      ),
    ).toBe(true);
  });

  it('shows ready state with working menu items', () => {
    const items = buildDesktopTrayMenuTemplate({
      startupState: { kind: 'ready' },
      actions: {
        onNewConversation: () => {},
      } as unknown as Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    expect(
      items.some((item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'New Conversation'),
    ).toBe(true);
  });

  it('shows the full ready-state tray action set', () => {
    const items = buildDesktopTrayMenuTemplate({
      appName: 'Neon Pilot Testing',
      startupState: { kind: 'ready' },
      actions: {} as ReturnType<typeof buildDesktopTrayMenuTemplate> extends never
        ? never
        : Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    const enabledLabels = items
      .filter((item): item is Electron.MenuItemConstructorOptions & { label: string } => typeof item.label === 'string')
      .map((item) => ({ label: item.label, enabled: item.enabled !== false }));

    expect(enabledLabels).toEqual([
      { label: 'Show Neon Pilot Testing', enabled: true },
      { label: 'New Conversation', enabled: true },
      { label: 'Settings…', enabled: true },
      { label: 'Check for Updates…', enabled: true },
      { label: 'Restart Runtime', enabled: true },
      { label: 'Quit Neon Pilot Testing', enabled: true },
    ]);
  });

  it('shows error state with truncated message', () => {
    const items = buildDesktopTrayMenuTemplate({
      startupState: { kind: 'error', message: 'Something went wrong with the backend.' },
      actions: {} as ReturnType<typeof buildDesktopTrayMenuTemplate> extends never
        ? never
        : Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    expect(
      items.some((item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Startup failed'),
    ).toBe(true);
    expect(
      items.some((item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Retry Neon Pilot'),
    ).toBe(true);
    expect(
      items.some((item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Open Desktop Logs'),
    ).toBe(true);
  });

  it('does not include the removed clipboard URL action', () => {
    const items = buildDesktopTrayMenuTemplate({
      startupState: { kind: 'ready' },
      actions: {} as ReturnType<typeof buildDesktopTrayMenuTemplate> extends never
        ? never
        : Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    expect(
      items.some(
        (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Clip URL from Clipboard',
      ),
    ).toBe(false);
  });

  it('includes Settings and Quit', () => {
    const items = buildDesktopTrayMenuTemplate({
      startupState: { kind: 'ready' },
      actions: {
        onSettings: () => {},
        onQuit: () => {},
      } as unknown as Parameters<typeof buildDesktopTrayMenuTemplate>[0]['actions'],
    });

    expect(
      items.some((item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => 'label' in item && item.label === 'Settings…'),
    ).toBe(true);
    expect(
      items.some(
        (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) =>
          ('label' in item && (item as { label?: string }).label === 'Quit Neon Pilot') || item.label === 'Quit Neon Pilot',
      ),
    ).toBe(true);
  });
});
