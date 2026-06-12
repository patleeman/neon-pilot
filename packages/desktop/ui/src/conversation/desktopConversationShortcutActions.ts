import { DESKTOP_SHORTCUT_EVENT } from '../commands/desktopShortcutEvents';

export const DESKTOP_CONVERSATION_SHORTCUT_EVENT = DESKTOP_SHORTCUT_EVENT;

export type ConversationEditorShortcutAction =
  | 'focus-composer'
  | 'edit-working-directory'
  | 'save-working-directory'
  | 'cancel-working-directory-edit'
  | 'save-conversation-title'
  | 'cancel-conversation-title-edit'
  | 'rename-conversation';

export type SidebarConversationShortcutAction =
  | 'close-conversation'
  | 'reopen-closed-conversation'
  | 'previous-conversation'
  | 'next-conversation'
  | 'toggle-conversation-pin'
  | 'toggle-conversation-archive';

const CONVERSATION_EDITOR_SHORTCUT_ACTIONS = new Set<ConversationEditorShortcutAction>([
  'focus-composer',
  'edit-working-directory',
  'save-working-directory',
  'cancel-working-directory-edit',
  'save-conversation-title',
  'cancel-conversation-title-edit',
  'rename-conversation',
]);

const SIDEBAR_CONVERSATION_SHORTCUT_ACTIONS = new Set<SidebarConversationShortcutAction>([
  'close-conversation',
  'reopen-closed-conversation',
  'previous-conversation',
  'next-conversation',
  'toggle-conversation-pin',
  'toggle-conversation-archive',
]);

export function isConversationEditorShortcutAction(value: unknown): value is ConversationEditorShortcutAction {
  return typeof value === 'string' && CONVERSATION_EDITOR_SHORTCUT_ACTIONS.has(value as ConversationEditorShortcutAction);
}

export function isSidebarConversationShortcutAction(value: unknown): value is SidebarConversationShortcutAction {
  return typeof value === 'string' && SIDEBAR_CONVERSATION_SHORTCUT_ACTIONS.has(value as SidebarConversationShortcutAction);
}

export function conversationEditorShortcutCommandAction(command: unknown): ConversationEditorShortcutAction | null {
  switch (command) {
    case 'composer.focus':
      return 'focus-composer';
    case 'conversation.editCwd':
      return 'edit-working-directory';
    case 'conversation.saveCwd':
      return 'save-working-directory';
    case 'conversation.cancelCwdEdit':
      return 'cancel-working-directory-edit';
    case 'conversation.rename':
      return 'rename-conversation';
    case 'conversation.saveTitle':
      return 'save-conversation-title';
    case 'conversation.cancelTitleEdit':
      return 'cancel-conversation-title-edit';
    default:
      return null;
  }
}

export function sidebarConversationShortcutCommandAction(command: unknown): SidebarConversationShortcutAction | null {
  switch (command) {
    case 'conversation.close':
      return 'close-conversation';
    case 'conversation.reopenClosed':
      return 'reopen-closed-conversation';
    case 'conversation.previous':
      return 'previous-conversation';
    case 'conversation.next':
      return 'next-conversation';
    case 'conversation.togglePinned':
      return 'toggle-conversation-pin';
    case 'conversation.toggleArchived':
      return 'toggle-conversation-archive';
    default:
      return null;
  }
}
