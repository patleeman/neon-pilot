import { type MutableRefObject, type RefObject, useCallback } from 'react';

import { insertTextAtComposerSelection } from './conversationComposerEditing';

export interface ComposerControllerSelection {
  start: number;
  end: number;
}

export interface UseComposerControllerOptions {
  inputRef: MutableRefObject<string>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  selectionRef: MutableRefObject<ComposerControllerSelection>;
  setInput: (value: string) => void;
  scheduleResize: () => void;
  onTextInserted?: () => void;
}

export interface ComposerController {
  rememberSelection: (element?: HTMLTextAreaElement | null) => void;
  moveCaretToEnd: () => void;
  insertText: (text: string) => void;
}

export function useComposerController({
  inputRef,
  textareaRef,
  selectionRef,
  setInput,
  scheduleResize,
  onTextInserted,
}: UseComposerControllerOptions): ComposerController {
  const rememberSelection = useCallback(
    (element?: HTMLTextAreaElement | null) => {
      const target = element ?? textareaRef.current;
      if (!target) {
        return;
      }

      selectionRef.current = {
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      };
    },
    [selectionRef, textareaRef],
  );

  const moveCaretToEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }

      const end = el.value.length;
      el.focus();
      el.setSelectionRange(end, end);
      selectionRef.current = { start: end, end };
    });
  }, [selectionRef, textareaRef]);

  const insertText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      const selection = el
        ? {
            start: el.selectionStart ?? selectionRef.current.start,
            end: el.selectionEnd ?? selectionRef.current.end,
          }
        : selectionRef.current;
      const insertion = insertTextAtComposerSelection({
        currentInput: el?.value ?? inputRef.current,
        selection,
        text,
      });
      if (!insertion) {
        return;
      }

      setInput(insertion.nextInput);
      onTextInserted?.();
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) {
          return;
        }
        el.focus();
        el.setSelectionRange(insertion.nextCaret, insertion.nextCaret);
        selectionRef.current = { start: insertion.nextCaret, end: insertion.nextCaret };
        scheduleResize();
      });
    },
    [inputRef, onTextInserted, scheduleResize, selectionRef, setInput, textareaRef],
  );

  return { rememberSelection, moveCaretToEnd, insertText };
}
