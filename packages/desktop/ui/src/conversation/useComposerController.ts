import { type MutableRefObject, type RefObject, useCallback, useMemo } from 'react';

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

export interface ComposerTextUpdateOptions {
  selection?: ComposerControllerSelection;
  focus?: boolean;
}

export interface ComposerController {
  rememberSelection: (element?: HTMLTextAreaElement | null) => void;
  moveCaretToEnd: () => void;
  setText: (text: string, options?: ComposerTextUpdateOptions) => void;
  clear: () => void;
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

  const setText = useCallback(
    (text: string, options: ComposerTextUpdateOptions = {}) => {
      setInput(text);
      onTextInserted?.();

      const nextSelection = options.selection;
      if (nextSelection) {
        selectionRef.current = nextSelection;
      }

      if (options.focus === false && !nextSelection) {
        scheduleResize();
        return;
      }

      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) {
          return;
        }

        if (options.focus !== false) {
          el.focus();
        }
        if (nextSelection) {
          el.setSelectionRange(nextSelection.start, nextSelection.end);
        }
        scheduleResize();
      });
    },
    [onTextInserted, scheduleResize, selectionRef, setInput, textareaRef],
  );

  const clear = useCallback(() => setText('', { focus: false }), [setText]);

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

      setText(insertion.nextInput, { selection: { start: insertion.nextCaret, end: insertion.nextCaret } });
    },
    [inputRef, selectionRef, setText, textareaRef],
  );

  return useMemo(
    () => ({ rememberSelection, moveCaretToEnd, setText, clear, insertText }),
    [clear, insertText, moveCaretToEnd, rememberSelection, setText],
  );
}
