import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommandPaletteItem } from './commandPalette';
import { activateCommandPaletteItem, type CommandPaletteAction, executePaletteCommand } from './commandPaletteActions';

afterEach(() => {
  vi.unstubAllGlobals();
});

function installLocalStorageShim() {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => Array.from(items.keys())[index] ?? null,
    removeItem: (key: string) => items.delete(key),
    setItem: (key: string, value: string) => items.set(key, String(value)),
    get length() {
      return items.size;
    },
  });
}

function item(
  action: CommandPaletteAction,
  overrides: Partial<CommandPaletteItem<CommandPaletteAction>> = {},
): CommandPaletteItem<CommandPaletteAction> {
  return {
    id: 'item-1',
    section: 'commands',
    title: 'Item',
    action,
    ...overrides,
  };
}

function context(
  overrides: Partial<Parameters<typeof activateCommandPaletteItem>[1]> = {},
): Parameters<typeof activateCommandPaletteItem>[1] {
  return {
    commandItems: [],
    location: { pathname: '/conversations/new', search: '?artifact=a1', hash: '#top' },
    navigate: vi.fn(),
    openSession: vi.fn(),
    closePalette: vi.fn(),
    executeExtensionCommand: vi.fn().mockResolvedValue(undefined),
    readLayoutMode: () => 'workbench',
    ...overrides,
  };
}

describe('activateCommandPaletteItem', () => {
  it('dispatches palette commands through the renderer host command bridge', async () => {
    vi.stubGlobal('window', new EventTarget());
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<{ command?: string; args?: unknown; resolve?: (handled: boolean) => void }>).detail;
      detail.resolve?.(detail.command === 'layout.toggleSidebar');
    });
    window.addEventListener('neon-pilot-extension-command-execute', listener);

    await expect(executePaletteCommand('layout.toggleSidebar', { source: 'palette' })).resolves.toBe(true);

    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail).toMatchObject({ command: 'layout.toggleSidebar', args: { source: 'palette' } });
    window.removeEventListener('neon-pilot-extension-command-execute', listener);
  });

  it('executes browser tab commands through shared browser tab state', async () => {
    installLocalStorageShim();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce('tab-1').mockReturnValueOnce('tab-2'),
    });

    await expect(executePaletteCommand('browser.newTab', {})).resolves.toBe(true);

    const state = JSON.parse(localStorage.getItem('pa:workbench-browser-tabs') ?? 'null') as {
      tabs?: Array<{ id?: string }>;
      activeTabId?: string;
    } | null;
    expect(state?.tabs).toEqual([expect.objectContaining({ id: 'tab-1' }), expect.objectContaining({ id: 'tab-2' })]);
    expect(state?.activeTabId).toBe('tab-2');
  });

  it('ignores disabled items', async () => {
    const ctx = context();

    await expect(activateCommandPaletteItem(item({ kind: 'navigate', to: '/settings' }, { disabled: true }), ctx)).resolves.toBe(false);

    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.closePalette).not.toHaveBeenCalled();
  });

  it('navigates and closes the palette', async () => {
    const ctx = context();

    await expect(activateCommandPaletteItem(item({ kind: 'navigate', to: '/settings' }), ctx)).resolves.toBe(true);

    expect(ctx.navigate).toHaveBeenCalledWith('/settings');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('restores archived conversations before navigating', async () => {
    const ctx = context();

    await expect(activateCommandPaletteItem(item({ kind: 'restoreArchivedConversation', conversationId: 'conv 1' }), ctx)).resolves.toBe(
      true,
    );

    expect(ctx.openSession).toHaveBeenCalledWith('conv 1');
    expect(ctx.navigate).toHaveBeenCalledWith('/conversations/conv%201');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('builds workbench file open routes', async () => {
    const ctx = context();

    await expect(activateCommandPaletteItem(item({ kind: 'openFile', fileId: 'src/index.ts' }), ctx)).resolves.toBe(true);

    expect(ctx.navigate).toHaveBeenCalledWith('/conversations/new?artifact=a1&file=src%2Findex.ts#top');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('executes command items directly', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(undefined);
    const ctx = context({ executeExtensionCommand });

    await expect(activateCommandPaletteItem(item({ kind: 'command', command: 'host.test', args: { ok: true } }), ctx)).resolves.toBe(true);

    expect(executeExtensionCommand).toHaveBeenCalledWith('host.test', { ok: true });
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('keeps the palette open when a command item is not handled', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(false);
    const ctx = context({ executeExtensionCommand });

    await expect(activateCommandPaletteItem(item({ kind: 'command', command: 'host.test', args: { ok: true } }), ctx)).resolves.toBe(false);

    expect(executeExtensionCommand).toHaveBeenCalledWith('host.test', { ok: true });
    expect(ctx.closePalette).not.toHaveBeenCalled();
  });

  it('executes extension search command actions only when declared in the palette', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(undefined);
    const declared = item({ kind: 'command', command: 'declared.command' }, { id: 'declared' });
    const ctx = context({ commandItems: [declared], executeExtensionCommand });

    await expect(
      activateCommandPaletteItem(
        item({
          kind: 'extensionSearchAction',
          extensionId: 'ext',
          action: { kind: 'command', command: 'declared.command', args: { x: 1 } },
        }),
        ctx,
      ),
    ).resolves.toBe(true);

    expect(executeExtensionCommand).toHaveBeenCalledWith('declared.command', { x: 1 });
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('keeps the palette open when a declared extension search command is not handled', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(false);
    const declared = item({ kind: 'command', command: 'declared.command' }, { id: 'declared' });
    const ctx = context({ commandItems: [declared], executeExtensionCommand });

    await expect(
      activateCommandPaletteItem(
        item({
          kind: 'extensionSearchAction',
          extensionId: 'ext',
          action: { kind: 'command', command: 'declared.command', args: { x: 1 } },
        }),
        ctx,
      ),
    ).resolves.toBe(false);

    expect(executeExtensionCommand).toHaveBeenCalledWith('declared.command', { x: 1 });
    expect(ctx.closePalette).not.toHaveBeenCalled();
  });

  it('rejects undeclared extension search command actions', async () => {
    const ctx = context({ commandItems: [] });

    await expect(
      activateCommandPaletteItem(
        item({ kind: 'extensionSearchAction', extensionId: 'ext', action: { kind: 'command', command: 'missing.command' } }),
        ctx,
      ),
    ).rejects.toThrow('Command is not available in the palette: missing.command');
    expect(ctx.closePalette).not.toHaveBeenCalled();
  });
});
