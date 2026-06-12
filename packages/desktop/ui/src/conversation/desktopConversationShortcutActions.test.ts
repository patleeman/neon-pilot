import { describe, expect, it } from 'vitest';

import {
  conversationEditorShortcutCommandAction,
  DESKTOP_CONVERSATION_SHORTCUT_EVENT,
  isConversationEditorShortcutAction,
  isSidebarConversationShortcutAction,
  sidebarConversationShortcutCommandAction,
} from './desktopConversationShortcutActions';

describe('desktop conversation shortcut actions', () => {
  it('keeps the desktop shortcut event name shared', () => {
    expect(DESKTOP_CONVERSATION_SHORTCUT_EVENT).toBe('neon-pilot-desktop-shortcut');
  });

  it('maps editor host commands to desktop shortcut actions', () => {
    expect(conversationEditorShortcutCommandAction('composer.focus')).toBe('focus-composer');
    expect(conversationEditorShortcutCommandAction('conversation.editCwd')).toBe('edit-working-directory');
    expect(conversationEditorShortcutCommandAction('conversation.saveCwd')).toBe('save-working-directory');
    expect(conversationEditorShortcutCommandAction('conversation.cancelCwdEdit')).toBe('cancel-working-directory-edit');
    expect(conversationEditorShortcutCommandAction('conversation.rename')).toBe('rename-conversation');
    expect(conversationEditorShortcutCommandAction('conversation.saveTitle')).toBe('save-conversation-title');
    expect(conversationEditorShortcutCommandAction('conversation.cancelTitleEdit')).toBe('cancel-conversation-title-edit');
    expect(conversationEditorShortcutCommandAction('conversation.close')).toBeNull();
  });

  it('maps sidebar host commands to desktop shortcut actions', () => {
    expect(sidebarConversationShortcutCommandAction('conversation.close')).toBe('close-conversation');
    expect(sidebarConversationShortcutCommandAction('conversation.reopenClosed')).toBe('reopen-closed-conversation');
    expect(sidebarConversationShortcutCommandAction('conversation.previous')).toBe('previous-conversation');
    expect(sidebarConversationShortcutCommandAction('conversation.next')).toBe('next-conversation');
    expect(sidebarConversationShortcutCommandAction('conversation.togglePinned')).toBe('toggle-conversation-pin');
    expect(sidebarConversationShortcutCommandAction('conversation.toggleLocked')).toBe('toggle-conversation-lock');
    expect(sidebarConversationShortcutCommandAction('conversation.toggleArchived')).toBe('toggle-conversation-archive');
    expect(sidebarConversationShortcutCommandAction('conversation.rename')).toBeNull();
  });

  it('recognizes only actions owned by each conversation surface', () => {
    expect(isConversationEditorShortcutAction('focus-composer')).toBe(true);
    expect(isConversationEditorShortcutAction('close-conversation')).toBe(false);
    expect(isConversationEditorShortcutAction(null)).toBe(false);

    expect(isSidebarConversationShortcutAction('close-conversation')).toBe(true);
    expect(isSidebarConversationShortcutAction('focus-composer')).toBe(false);
    expect(isSidebarConversationShortcutAction(null)).toBe(false);
  });
});
