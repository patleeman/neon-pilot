import { describe, expect, it, vi } from 'vitest';

import type { CommandPaletteItem } from './commandPalette';
import { activateCommandPaletteItem, type CommandPaletteAction } from './commandPaletteActions';

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
  it('ignores disabled items', async () => {
    const ctx = context();

    await activateCommandPaletteItem(item({ kind: 'navigate', to: '/settings' }, { disabled: true }), ctx);

    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.closePalette).not.toHaveBeenCalled();
  });

  it('navigates and closes the palette', async () => {
    const ctx = context();

    await activateCommandPaletteItem(item({ kind: 'navigate', to: '/settings' }), ctx);

    expect(ctx.navigate).toHaveBeenCalledWith('/settings');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('restores archived conversations before navigating', async () => {
    const ctx = context();

    await activateCommandPaletteItem(item({ kind: 'restoreArchivedConversation', conversationId: 'conv 1' }), ctx);

    expect(ctx.openSession).toHaveBeenCalledWith('conv 1');
    expect(ctx.navigate).toHaveBeenCalledWith('/conversations/conv%201');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('builds workbench file open routes', async () => {
    const ctx = context();

    await activateCommandPaletteItem(item({ kind: 'openFile', fileId: 'src/index.ts' }), ctx);

    expect(ctx.navigate).toHaveBeenCalledWith('/conversations/new?artifact=a1&file=src%2Findex.ts#top');
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('executes command items directly', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(undefined);
    const ctx = context({ executeExtensionCommand });

    await activateCommandPaletteItem(item({ kind: 'command', command: 'host.test', args: { ok: true } }), ctx);

    expect(executeExtensionCommand).toHaveBeenCalledWith('host.test', { ok: true });
    expect(ctx.closePalette).toHaveBeenCalledOnce();
  });

  it('executes extension search command actions only when declared in the palette', async () => {
    const executeExtensionCommand = vi.fn().mockResolvedValue(undefined);
    const declared = item({ kind: 'command', command: 'declared.command' }, { id: 'declared' });
    const ctx = context({ commandItems: [declared], executeExtensionCommand });

    await activateCommandPaletteItem(
      item({ kind: 'extensionSearchAction', extensionId: 'ext', action: { kind: 'command', command: 'declared.command', args: { x: 1 } } }),
      ctx,
    );

    expect(executeExtensionCommand).toHaveBeenCalledWith('declared.command', { x: 1 });
    expect(ctx.closePalette).toHaveBeenCalledOnce();
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
