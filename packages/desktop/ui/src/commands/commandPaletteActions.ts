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

export function executePaletteCommand(command: string, args: unknown): Promise<boolean> {
  if (typeof window === 'undefined') {
    return api.executeExtensionCommand(command, args).then(() => true);
  }

  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent('neon-pilot-extension-command-execute', { detail: { command, args, resolve } }));
  });
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
): Promise<boolean> {
  if (!isDeclaredPaletteCommand(commandItems, command)) {
    throw new Error(`Command is not available in the palette: ${command}`);
  }
  const handled = await executeExtensionCommand(command, args ?? {});
  return handled !== false;
}

export async function activateCommandPaletteItem(
  item: CommandPaletteItem<CommandPaletteAction>,
  context: ActivateCommandPaletteItemContext,
): Promise<boolean> {
  if (item.disabled) {
    return false;
  }

  const executeExtensionCommand = context.executeExtensionCommand ?? api.executeExtensionCommand;
  const readLayoutMode = context.readLayoutMode ?? readAppLayoutMode;

  switch (item.action.kind) {
    case 'navigate':
      context.navigate(item.action.to);
      context.closePalette();
      return true;
    case 'restoreArchivedConversation':
      context.openSession(item.action.conversationId);
      context.navigate(`/conversations/${encodeURIComponent(item.action.conversationId)}`);
      context.closePalette();
      return true;
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
      return true;
    case 'command':
      if ((await executeExtensionCommand(item.action.command, item.action.args ?? {})) !== false) {
        context.closePalette();
        return true;
      }
      return false;
    case 'extensionSearchAction': {
      const searchAction = item.action.action;
      let handled = true;
      if (searchAction && typeof searchAction === 'object' && 'kind' in searchAction) {
        const typedAction = searchAction as { kind?: unknown; to?: unknown; command?: unknown; args?: unknown };
        if (typedAction.kind === 'navigate' && typeof typedAction.to === 'string') {
          context.navigate(typedAction.to);
        } else if (typedAction.kind === 'command' && typeof typedAction.command === 'string') {
          handled = await executeDeclaredPaletteCommand(context.commandItems, typedAction.command, typedAction.args ?? {}, executeExtensionCommand);
        }
      } else if (searchAction && typeof searchAction === 'object' && 'command' in searchAction) {
        handled = await executeDeclaredPaletteCommand(
          context.commandItems,
          String((searchAction as { command: unknown }).command),
          (searchAction as { args?: unknown }).args ?? {},
          executeExtensionCommand,
        );
      }
      if (handled) context.closePalette();
      return handled;
    }
    default:
      return false;
  }
}
