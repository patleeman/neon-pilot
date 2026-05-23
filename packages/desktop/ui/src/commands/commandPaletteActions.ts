import type { NavigateFunction } from 'react-router-dom';

import { api } from '../client/api';
import type { ExtensionSurfaceSummary } from '../extensions/types';
import { readAppLayoutMode } from '../ui-state/appLayoutMode';
import type { CommandPaletteItem } from './commandPalette';
import { buildCommandPaletteFileOpenRoute } from './commandPaletteNavigation';

export type CommandPaletteAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'restoreArchivedConversation'; conversationId: string }
  | { kind: 'openFile'; fileId: string; extensionSurfaces?: ExtensionSurfaceSummary[] }
  | { kind: 'command'; command: string; args?: unknown }
  | { kind: 'extensionSearchAction'; extensionId: string; action: unknown };

export interface ActivateCommandPaletteItemContext {
  commandItems: Array<CommandPaletteItem<CommandPaletteAction>>;
  location: { pathname: string; search: string; hash: string };
  navigate: NavigateFunction;
  openSession: (conversationId: string) => void;
  closePalette: () => void;
  executeExtensionCommand?: (command: string, args: unknown) => Promise<unknown>;
  readLayoutMode?: () => ReturnType<typeof readAppLayoutMode>;
}

function isDeclaredPaletteCommand(commandItems: Array<CommandPaletteItem<CommandPaletteAction>>, command: string): boolean {
  return commandItems.some(
    (candidate) => candidate.action.kind === 'command' && candidate.action.command === command && !candidate.disabled,
  );
}

async function executeDeclaredPaletteCommand(
  commandItems: Array<CommandPaletteItem<CommandPaletteAction>>,
  command: string,
  args: unknown,
  executeExtensionCommand: (command: string, args: unknown) => Promise<unknown>,
): Promise<void> {
  if (!isDeclaredPaletteCommand(commandItems, command)) {
    throw new Error(`Command is not available in the palette: ${command}`);
  }
  await executeExtensionCommand(command, args ?? {});
}

export async function activateCommandPaletteItem(
  item: CommandPaletteItem<CommandPaletteAction>,
  context: ActivateCommandPaletteItemContext,
): Promise<void> {
  if (item.disabled) {
    return;
  }

  const executeExtensionCommand = context.executeExtensionCommand ?? api.executeExtensionCommand;
  const readLayoutMode = context.readLayoutMode ?? readAppLayoutMode;

  switch (item.action.kind) {
    case 'navigate':
      context.navigate(item.action.to);
      context.closePalette();
      return;
    case 'restoreArchivedConversation':
      context.openSession(item.action.conversationId);
      context.navigate(`/conversations/${encodeURIComponent(item.action.conversationId)}`);
      context.closePalette();
      return;
    case 'openFile':
      context.navigate(
        buildCommandPaletteFileOpenRoute({
          pathname: context.location.pathname,
          search: context.location.search,
          hash: context.location.hash,
          layoutMode: readLayoutMode(),
          fileId: item.action.fileId,
          extensionSurfaces: item.action.extensionSurfaces,
        }),
      );
      context.closePalette();
      return;
    case 'command':
      await executeExtensionCommand(item.action.command, item.action.args ?? {});
      context.closePalette();
      return;
    case 'extensionSearchAction': {
      const searchAction = item.action.action;
      if (searchAction && typeof searchAction === 'object' && 'kind' in searchAction) {
        const typedAction = searchAction as { kind?: unknown; to?: unknown; command?: unknown; args?: unknown };
        if (typedAction.kind === 'navigate' && typeof typedAction.to === 'string') {
          context.navigate(typedAction.to);
        } else if (typedAction.kind === 'command' && typeof typedAction.command === 'string') {
          await executeDeclaredPaletteCommand(context.commandItems, typedAction.command, typedAction.args ?? {}, executeExtensionCommand);
        }
      } else if (searchAction && typeof searchAction === 'object' && 'command' in searchAction) {
        await executeDeclaredPaletteCommand(
          context.commandItems,
          String((searchAction as { command: unknown }).command),
          (searchAction as { args?: unknown }).args ?? {},
          executeExtensionCommand,
        );
      }
      context.closePalette();
      return;
    }
    default:
      return;
  }
}
