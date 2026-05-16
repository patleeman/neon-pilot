import { type RefObject, useEffect } from 'react';

import { insertFileReplyQuoteIntoComposer } from './conversationReplyQuote';
import type { ComposerController } from './useComposerController';

const WORKSPACE_DRAFT_PROMPT_EVENT = 'pa:workspace-draft-prompt';
const WORKSPACE_REPLY_SELECTION_EVENT = 'pa:workspace-reply-selection';

interface UseWorkspaceComposerEventsOptions {
  input: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  composer: Pick<ComposerController, 'setText'>;
  resetMenus: () => void;
}

export function useWorkspaceComposerEvents({ input, textareaRef, composer, resetMenus }: UseWorkspaceComposerEventsOptions): void {
  useEffect(() => {
    function handleWorkspaceDraftPrompt(event: Event) {
      const prompt = (event as CustomEvent<{ prompt?: unknown }>).detail?.prompt;
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return;
      }

      composer.setText(prompt);
    }

    window.addEventListener(WORKSPACE_DRAFT_PROMPT_EVENT, handleWorkspaceDraftPrompt);
    return () => window.removeEventListener(WORKSPACE_DRAFT_PROMPT_EVENT, handleWorkspaceDraftPrompt);
  }, [composer]);

  useEffect(() => {
    function handleWorkspaceReplySelection(event: Event) {
      const detail = (event as CustomEvent<{ filePath?: unknown; text?: unknown }>).detail;
      if (typeof detail?.filePath !== 'string' || typeof detail?.text !== 'string') {
        return;
      }

      const currentInput = textareaRef.current?.value ?? input;
      const next = insertFileReplyQuoteIntoComposer(currentInput, detail.filePath, detail.text);

      resetMenus();
      composer.setText(next.text, { selection: { start: next.selectionStart, end: next.selectionEnd } });
    }

    window.addEventListener(WORKSPACE_REPLY_SELECTION_EVENT, handleWorkspaceReplySelection);
    return () => window.removeEventListener(WORKSPACE_REPLY_SELECTION_EVENT, handleWorkspaceReplySelection);
  }, [composer, input, resetMenus, textareaRef]);
}
