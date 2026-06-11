import { type RefObject, useEffect } from 'react';

const DESKTOP_CONVERSATION_SHORTCUT_EVENT = 'neon-pilot-desktop-shortcut';

type DesktopConversationShortcutAction =
  | 'focus-composer'
  | 'edit-working-directory'
  | 'save-working-directory'
  | 'cancel-working-directory-edit'
  | 'rename-conversation';

function isDesktopConversationShortcutAction(value: unknown): value is DesktopConversationShortcutAction {
  return (
    value === 'focus-composer' ||
    value === 'edit-working-directory' ||
    value === 'save-working-directory' ||
    value === 'cancel-working-directory-edit' ||
    value === 'rename-conversation'
  );
}

function desktopConversationShortcutCommandAction(command: unknown): DesktopConversationShortcutAction | null {
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
    default:
      return null;
  }
}

interface UseDesktopConversationShortcutsOptions {
  draft: boolean;
  draftCwdPickBusy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  beginTitleEdit: () => void;
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
      const action = isDesktopConversationShortcutAction(detail?.action)
        ? detail.action
        : desktopConversationShortcutCommandAction(detail?.command);
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
    cancelConversationCwdEdit,
    draft,
    draftCwdPickBusy,
    pickDraftConversationCwd,
    saveConversationCwdEdit,
    textareaRef,
  ]);
}
