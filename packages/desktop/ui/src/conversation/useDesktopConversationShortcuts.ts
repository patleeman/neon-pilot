import { type RefObject, useEffect } from 'react';

import {
  conversationEditorShortcutCommandAction,
  DESKTOP_CONVERSATION_SHORTCUT_EVENT,
  isConversationEditorShortcutAction,
} from './desktopConversationShortcutActions';

interface UseDesktopConversationShortcutsOptions {
  draft: boolean;
  draftCwdPickBusy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  beginTitleEdit: () => void;
  saveTitleEdit: () => Promise<void> | void;
  cancelTitleEdit: () => void;
  beginConversationCwdEdit: () => void;
  saveConversationCwdEdit: () => Promise<void> | void;
  cancelConversationCwdEdit: () => void;
  pickDraftConversationCwd: () => Promise<void> | void;
}

export function useDesktopConversationShortcuts({
  draft,
  draftCwdPickBusy,
  textareaRef,
  beginTitleEdit,
  saveTitleEdit,
  cancelTitleEdit,
  beginConversationCwdEdit,
  saveConversationCwdEdit,
  cancelConversationCwdEdit,
  pickDraftConversationCwd,
}: UseDesktopConversationShortcutsOptions): void {
  useEffect(() => {
    function handleDesktopShortcut(event: Event) {
      if (document.querySelector('.ui-overlay-backdrop') !== null) {
        return;
      }

      const detail = (event as CustomEvent<{ action?: unknown; command?: unknown }>).detail;
      const action = isConversationEditorShortcutAction(detail?.action)
        ? detail.action
        : conversationEditorShortcutCommandAction(detail?.command);
      if (!action) {
        return;
      }

      if (action === 'focus-composer') {
        const composer = textareaRef.current;
        if (!composer) {
          return;
        }

        composer.focus();
        const end = composer.value.length;
        composer.selectionStart = end;
        composer.selectionEnd = end;
        return;
      }

      if (action === 'rename-conversation') {
        beginTitleEdit();
        return;
      }

      if (action === 'save-conversation-title') {
        void saveTitleEdit();
        return;
      }

      if (action === 'cancel-conversation-title-edit') {
        cancelTitleEdit();
        return;
      }

      if (action === 'save-working-directory') {
        void saveConversationCwdEdit();
        return;
      }

      if (action === 'cancel-working-directory-edit') {
        cancelConversationCwdEdit();
        return;
      }

      if (draft) {
        if (draftCwdPickBusy) {
          return;
        }

        void pickDraftConversationCwd();
        return;
      }

      beginConversationCwdEdit();
    }

    window.addEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
    return () => window.removeEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
  }, [
    beginConversationCwdEdit,
    beginTitleEdit,
    cancelTitleEdit,
    cancelConversationCwdEdit,
    draft,
    draftCwdPickBusy,
    pickDraftConversationCwd,
    saveConversationCwdEdit,
    saveTitleEdit,
    textareaRef,
  ]);
}
