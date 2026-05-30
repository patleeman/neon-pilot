import { type ClipboardEventHandler, type KeyboardEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ComposerDrawingAttachment } from '../../conversation/promptAttachments';
import { ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import { ComposerInputToolHost } from '../../extensions/ComposerInputToolHost';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import type { ModelInfo } from '../../shared/types';
import { ConversationComposerActions } from '../conversation/ConversationComposerActions';
import { ConversationPreferencesRow } from '../conversation/ConversationPreferencesRow';

function getComposerPreferenceInlineLimit(composerShellWidth: number | null): number {
  const width = composerShellWidth ?? Number.POSITIVE_INFINITY;
  if (width >= 860) return Number.POSITIVE_INFINITY;
  if (width >= 760) return 4;
  if (width >= 660) return 3;
  if (width >= 560) return 2;
  if (width >= 460) return 1;
  return 0;
}

function readForkPromptDraft(conversationId: string): string | null {
  try {
    const raw = sessionStorage.getItem(`pa:reload:conversation:${conversationId}:composer`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function clearForkPromptDraft(conversationId: string): void {
  try {
    sessionStorage.removeItem(`pa:reload:conversation:${conversationId}:composer`);
  } catch {
    // Ignore.
  }
}

export function ChatRailComposer({
  conversationId,
  isStreaming,
  models,
  currentModel,
  onSubmit,
  onAbortStream,
  onSelectModel,
}: {
  conversationId: string | null;
  isStreaming: boolean;
  models: ModelInfo[];
  currentModel: string;
  onSubmit: (text: string, behavior?: 'steer' | 'followUp') => void;
  onAbortStream: () => void;
  onSelectModel: (modelId: string) => void;
}) {
  const { composerControls = [], composerInputTools } = useExtensionRegistry();
  const [input, setInput] = useState(() => (conversationId ? (readForkPromptDraft(conversationId) ?? '') : ''));
  const [composerShellWidth, setComposerShellWidth] = useState<number | null>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear fork prompt draft on first render so it doesn't re-fill on remount.
  useEffect(() => {
    if (conversationId) {
      clearForkPromptDraft(conversationId);
    }
  }, [conversationId]);

  // Track composer shell width for responsive preferences layout.
  useEffect(() => {
    const shell = composerShellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setComposerShellWidth(entry.contentRect.width);
    });
    observer.observe(shell);
    setComposerShellWidth(shell.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  // Auto-resize textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // Focus on mount.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const hasContent = input.trim().length > 0;
  const composerDisabled = !hasContent || isStreaming;

  // ── Selection tracking ───────────────────────────────────────────────
  const [selectionState, setSelectionState] = useState({ start: 0, end: 0 });

  const rememberComposerSelection = useCallback((textarea: HTMLTextAreaElement) => {
    setSelectionState({ start: textarea.selectionStart, end: textarea.selectionEnd });
  }, []);

  // ── Text insertion helpers ───────────────────────────────────────────
  const insertTextIntoComposer = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = selectionState.start;
      const end = selectionState.end;
      const before = input.slice(0, start);
      const after = input.slice(end);
      const next = before + text + after;
      setInput(next);
      // Restore cursor position after inserted text.
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [input, selectionState],
  );

  const appendTextToComposer = useCallback((text: string) => {
    setInput((prev) => prev + text);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = ta.value.length;
        ta.setSelectionRange(pos, pos);
      }
    });
  }, []);

  // ── Keyboard handling ────────────────────────────────────────────────
  const [altHeld, setAltHeld] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (event.key === 'Alt') {
        setAltHeld(true);
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (hasContent && !isStreaming) {
          onSubmit(input.trim());
          setInput('');
        }
      }
    },
    [input, isStreaming, hasContent, onSubmit],
  );

  const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Alt') {
      setAltHeld(false);
    }
  }, []);

  // ── Paste handling ───────────────────────────────────────────────────
  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (_event) => {
      // Default paste behavior is fine — the textarea handles it.
      // We just need to re-sync after paste.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          setInput(ta.value);
          rememberComposerSelection(ta);
        }
      });
    },
    [rememberComposerSelection],
  );

  // ── File handling (stub — no file picker in side chat) ───────────────
  const handleFilesSelected = useCallback((_files: File[]) => {
    // File attachments not supported in side chat yet.
  }, []);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUpsertDrawingAttachment = useCallback((_payload: Omit<ComposerDrawingAttachment, 'localId' | 'dirty'>) => {
    // Drawing attachments not supported in side chat yet.
  }, []);

  // ── Submit via action bar ────────────────────────────────────────────
  const handleSubmitForModifiers = useCallback(
    (altKeyHeld: boolean) => {
      if (!hasContent || isStreaming) return;
      onSubmit(input.trim(), altKeyHeld ? 'followUp' : undefined);
      setInput('');
    },
    [input, hasContent, isStreaming, onSubmit],
  );

  // ── Extension visibility filtering ───────────────────────────────────
  const visibleComposerInputTools = useMemo(
    () =>
      composerInputTools.filter((tool) => {
        const expr = tool.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !hasContent) return false;
          if (trimmed === 'streamIsStreaming' && !isStreaming) return false;
          if (trimmed === '!streamIsStreaming' && isStreaming) return false;
        }
        return true;
      }),
    [composerInputTools, hasContent, isStreaming],
  );

  const visibleComposerControls = useMemo(
    () =>
      composerControls.filter((button) => {
        const expr = button.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !hasContent) return false;
          if (trimmed === 'streamIsStreaming' && !isStreaming) return false;
          if (trimmed === '!streamIsStreaming' && isStreaming) return false;
        }
        return true;
      }),
    [composerControls, hasContent, isStreaming],
  );

  const visibleLeadingControls = visibleComposerControls.filter((control) => control.slot === 'leading');
  const visiblePreferenceControls = visibleComposerControls.filter((control) => control.slot === 'preferences');

  const composerControlContext = {
    composerDisabled,
    streamIsStreaming: isStreaming,
    composerHasContent: hasContent,
    openFilePicker: handleOpenFilePicker,
    addFiles: handleFilesSelected,
    insertText: insertTextIntoComposer,
    appendText: appendTextToComposer,
    models,
    currentModel,
    currentThinkingLevel: '',
    savingPreference: null,
    selectModel: onSelectModel,
    selectThinkingLevel: () => {},
  };

  return (
    <div ref={composerShellRef} className="px-3 pt-2.5 pb-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.excalidraw,application/json"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            handleFilesSelected(files);
          }
          event.target.value = '';
        }}
      />

      <div className="flex flex-col gap-0">
        <div className="px-1 pt-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              const nextValue = event.target.value;
              const target = event.target;
              setInput(nextValue);
              requestAnimationFrame(() => rememberComposerSelection(target));
            }}
            onSelect={(event) => {
              rememberComposerSelection(event.currentTarget);
            }}
            onClick={(event) => {
              rememberComposerSelection(event.currentTarget);
            }}
            onKeyUp={handleKeyUp}
            onFocus={(event) => {
              rememberComposerSelection(event.currentTarget);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none overscroll-contain bg-transparent text-[14px] leading-relaxed text-primary outline-none placeholder:text-dim disabled:cursor-default disabled:text-dim"
            placeholder={isStreaming ? 'Waiting for response…' : 'Message Neon Pilot…   /  commands · @ notes · ⇧↵ newline'}
            title="Ctrl+C clears the composer. Alt+Enter queues a follow up while the conversation is busy. ↑/↓ recalls recent prompts."
            style={{ minHeight: '44px', maxHeight: '160px', WebkitOverflowScrolling: 'touch' }}
          />
        </div>

        <div className="flex flex-nowrap items-center gap-1.5 border-t border-dashed border-border-subtle px-1 py-2 pb-0">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5">
            {visibleLeadingControls.map((control) => (
              <ComposerButtonHost
                key={`${control.extensionId}:${control.id}`}
                registration={control}
                buttonContext={{ ...composerControlContext, renderMode: 'inline' }}
              />
            ))}
            {visibleComposerInputTools.map((tool) => (
              <ComposerInputToolHost
                key={`${tool.extensionId}:${tool.id}`}
                registration={tool}
                toolContext={{
                  conversationId,
                  composerDisabled,
                  streamIsStreaming: isStreaming,
                  composerHasContent: hasContent,
                  addFiles: handleFilesSelected,
                  upsertDrawingAttachment: handleUpsertDrawingAttachment,
                }}
              />
            ))}
            <ConversationPreferencesRow
              composerButtons={visiblePreferenceControls}
              composerButtonContext={composerControlContext}
              inlineLimit={getComposerPreferenceInlineLimit(composerShellWidth)}
            />
          </div>

          <ConversationComposerActions
            composerDisabled={composerDisabled}
            streamIsStreaming={isStreaming}
            conversationNeedsTakeover={false}
            composerHasContent={hasContent}
            composerShowsQuestionSubmit={false}
            composerQuestionCanSubmit={false}
            composerQuestionRemainingCount={0}
            composerQuestionSubmitting={false}
            composerSubmitLabel={isStreaming ? 'Steer' : 'Send'}
            composerAltHeld={altHeld}
            onInsertComposerText={insertTextIntoComposer}
            onAppendComposerText={appendTextToComposer}
            onSubmitComposerQuestion={() => {}}
            onSubmitComposerActionForModifiers={handleSubmitForModifiers}
            onAbortStream={onAbortStream}
          />
        </div>
      </div>
    </div>
  );
}
