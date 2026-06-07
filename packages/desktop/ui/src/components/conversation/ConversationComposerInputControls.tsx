/**
 * ConversationComposerInputControls — textarea + action bar for conversation input.
 *
 * Wrapped in React.memo so the textarea only re-renders when its own props change,
 * not when the parent ConversationPage re-renders for unrelated reasons.
 * The component manages a localInput copy so keystroke-sensitive state (menus)
 * stays inside this subtree without propagating every change to the parent.
 */
import { type ClipboardEventHandler, type KeyboardEventHandler, memo, type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { ComposerDrawingAttachment } from '../../conversation/promptAttachments';
import { ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import { ComposerInputToolHost } from '../../extensions/ComposerInputToolHost';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import type { ModelInfo } from '../../shared/types';
import { ConversationComposerActions, type ConversationComposerSubmitLabel } from './ConversationComposerActions';
import { ConversationPreferencesRow } from './ConversationPreferencesRow';

function getComposerPreferenceInlineLimit(composerShellWidth: number | null): number {
  const width = composerShellWidth ?? Number.POSITIVE_INFINITY;
  if (width >= 860) return Number.POSITIVE_INFINITY;
  if (width >= 760) return 4;
  if (width >= 660) return 3;
  if (width >= 560) return 2;
  if (width >= 460) return 1;
  return 0;
}

function inputControlsPropsAreEqual(prev: ConversationComposerInputControlsProps, next: ConversationComposerInputControlsProps): boolean {
  // The component manages its own localInput copy. Skip re-render when only
  // the `input` prop changes (the parent re-syncs every keystroke).
  // Compare all other display-affecting props by reference.
  return (
    prev.input === next.input &&
    prev.pendingAskUserQuestion === next.pendingAskUserQuestion &&
    prev.composerDisabled === next.composerDisabled &&
    prev.composerShellWidth === next.composerShellWidth &&
    prev.streamIsStreaming === next.streamIsStreaming &&
    prev.models === next.models &&
    prev.currentModel === next.currentModel &&
    prev.currentThinkingLevel === next.currentThinkingLevel &&
    prev.savingPreference === next.savingPreference &&
    prev.conversationNeedsTakeover === next.conversationNeedsTakeover &&
    prev.composerHasContent === next.composerHasContent &&
    prev.composerShowsQuestionSubmit === next.composerShowsQuestionSubmit &&
    prev.composerQuestionCanSubmit === next.composerQuestionCanSubmit &&
    prev.composerQuestionRemainingCount === next.composerQuestionRemainingCount &&
    prev.composerQuestionSubmitting === next.composerQuestionSubmitting &&
    prev.composerSubmitLabel === next.composerSubmitLabel &&
    prev.composerAltHeld === next.composerAltHeld &&
    prev.composerPlaceholder === next.composerPlaceholder &&
    prev.onFilesSelected === next.onFilesSelected &&
    prev.onInputChange === next.onInputChange &&
    prev.onRememberComposerSelection === next.onRememberComposerSelection &&
    prev.onKeyDown === next.onKeyDown &&
    prev.onPaste === next.onPaste &&
    prev.onOpenFilePicker === next.onOpenFilePicker &&
    prev.onUpsertDrawingAttachment === next.onUpsertDrawingAttachment &&
    prev.onSelectModel === next.onSelectModel &&
    prev.onSelectThinkingLevel === next.onSelectThinkingLevel &&
    prev.onInsertComposerText === next.onInsertComposerText &&
    prev.onAppendComposerText === next.onAppendComposerText &&
    prev.onSubmitComposerQuestion === next.onSubmitComposerQuestion &&
    prev.onSubmitComposerActionForModifiers === next.onSubmitComposerActionForModifiers &&
    prev.onAbortStream === next.onAbortStream &&
    prev.conversationId === next.conversationId
  );
}

interface ConversationComposerInputControlsProps {
  conversationId?: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  pendingAskUserQuestion: boolean;
  composerDisabled: boolean;
  composerShellWidth: number | null;
  streamIsStreaming: boolean;
  models: ModelInfo[];
  currentModel: string;
  currentThinkingLevel: string;
  savingPreference: 'model' | 'thinking' | 'serviceTier' | null;
  conversationNeedsTakeover: boolean;
  composerHasContent: boolean;
  composerShowsQuestionSubmit: boolean;
  composerQuestionCanSubmit: boolean;
  composerQuestionRemainingCount: number;
  composerQuestionSubmitting: boolean;
  composerSubmitLabel: ConversationComposerSubmitLabel;
  composerAltHeld: boolean;
  composerPlaceholder?: string;
  onFilesSelected: (files: File[]) => void;
  onInputChange: (value: string, textarea: HTMLTextAreaElement) => void;
  onRememberComposerSelection: (textarea: HTMLTextAreaElement) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste: ClipboardEventHandler<HTMLTextAreaElement>;
  onOpenFilePicker: () => void;
  onUpsertDrawingAttachment: (payload: Omit<ComposerDrawingAttachment, 'localId' | 'dirty'>) => void;
  onSelectModel: (modelId: string) => void;
  onSelectThinkingLevel: (thinkingLevel: string) => void;
  onInsertComposerText: (text: string) => void;
  onAppendComposerText: (text: string) => void;
  onSubmitComposerQuestion: () => void;
  onSubmitComposerActionForModifiers: (altKeyHeld: boolean) => void;
  onAbortStream: () => void;
}

export const ConversationComposerInputControls = memo(function ConversationComposerInputControls({
  fileInputRef,
  textareaRef,
  input,
  pendingAskUserQuestion,
  composerDisabled,
  composerShellWidth,
  streamIsStreaming,
  models,
  currentModel,
  currentThinkingLevel,
  savingPreference,
  conversationNeedsTakeover,
  composerHasContent,
  composerShowsQuestionSubmit,
  composerQuestionCanSubmit,
  composerQuestionRemainingCount,
  composerQuestionSubmitting,
  composerSubmitLabel,
  composerAltHeld,
  composerPlaceholder,
  onFilesSelected,
  onInputChange,
  onRememberComposerSelection,
  onKeyDown,
  onPaste,
  onOpenFilePicker,
  onUpsertDrawingAttachment,
  onSelectModel,
  onSelectThinkingLevel,
  onInsertComposerText,
  onAppendComposerText,
  onSubmitComposerQuestion,
  onSubmitComposerActionForModifiers,
  onAbortStream,
  conversationId,
}: ConversationComposerInputControlsProps) {
  const { composerControls = [], composerInputTools } = useExtensionRegistry();
  const [localInput, setLocalInputState] = useState(input);
  const previousInputPropRef = useRef(input);
  const localInputRef = useRef(input);
  const setLocalInput = (nextInput: string) => {
    localInputRef.current = nextInput;
    setLocalInputState(nextInput);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const previousScrollTop = textarea.scrollTop;
    const selectionEnd = textarea.selectionEnd ?? textarea.value.length;
    const shouldKeepCaretVisible = document.activeElement === textarea && selectionEnd >= textarea.value.length;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > nextHeight ? 'auto' : 'hidden';
    textarea.scrollTop = shouldKeepCaretVisible ? textarea.scrollHeight : previousScrollTop;
  }, [localInput, textareaRef]);

  // Sync from parent input prop — the parent can push external updates
  // (e.g., pasting text from a command) when the textarea is not focused.
  useEffect(() => {
    if (previousInputPropRef.current === input) {
      return;
    }
    previousInputPropRef.current = input;
    const currentLocalInput = localInputRef.current;
    const focused = textareaRef.current && document.activeElement === textareaRef.current;
    if (focused && input.length > 0 && currentLocalInput.length > input.length && currentLocalInput.startsWith(input)) {
      return;
    }
    setLocalInput(input);
  }, [input, textareaRef]);

  const visibleComposerInputTools = useMemo(
    () =>
      composerInputTools.filter((tool) => {
        const expr = tool.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !composerHasContent) return false;
          if (trimmed === 'streamIsStreaming' && !streamIsStreaming) return false;
          if (trimmed === '!streamIsStreaming' && streamIsStreaming) return false;
        }
        return true;
      }),
    [composerHasContent, composerInputTools, streamIsStreaming],
  );

  const visibleComposerControls = useMemo(
    () =>
      composerControls.filter((button) => {
        const expr = button.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !composerHasContent) return false;
          if (trimmed === 'streamIsStreaming' && !streamIsStreaming) return false;
          if (trimmed === '!streamIsStreaming' && streamIsStreaming) return false;
        }
        return true;
      }),
    [composerControls, composerHasContent, streamIsStreaming],
  );

  const composerControlContext = {
    composerDisabled,
    streamIsStreaming,
    composerHasContent,
    openFilePicker: onOpenFilePicker,
    addFiles: onFilesSelected,
    insertText: onInsertComposerText,
    appendText: onAppendComposerText,
    models,
    currentModel,
    currentThinkingLevel,
    savingPreference,
    selectModel: onSelectModel,
    selectThinkingLevel: onSelectThinkingLevel,
  };

  const visibleLeadingControls = visibleComposerControls.filter((control) => control.slot === 'leading');
  const visiblePreferenceControls = visibleComposerControls.filter((control) => control.slot === 'preferences');

  return (
    <div className="px-3 pt-2.5 pb-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.excalidraw,application/json"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            onFilesSelected(files);
          }
          event.target.value = '';
        }}
      />

      <div className="flex flex-col gap-0">
        <div className="px-1 pt-1">
          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={(event) => {
              const nextValue = event.target.value;
              const target = event.target;
              setLocalInput(nextValue);
              requestAnimationFrame(() => onRememberComposerSelection(target));
              onInputChange(nextValue, target);
            }}
            onSelect={(event) => {
              onRememberComposerSelection(event.currentTarget);
            }}
            onClick={(event) => {
              onRememberComposerSelection(event.currentTarget);
            }}
            onKeyUp={(event) => {
              onRememberComposerSelection(event.currentTarget);
            }}
            onFocus={(event) => {
              onRememberComposerSelection(event.currentTarget);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            disabled={composerDisabled}
            className="w-full resize-none overscroll-contain bg-transparent text-[14px] leading-relaxed text-primary outline-none placeholder:text-dim disabled:cursor-default disabled:text-dim"
            placeholder={
              pendingAskUserQuestion
                ? 'Answer 1-9, or type to skip…'
                : (composerPlaceholder ?? 'Message Neon Pilot…   /  commands · ⇧↵ newline')
            }
            title={
              pendingAskUserQuestion
                ? '1-9 selects the current answer. Tab/Shift+Tab or ←/→ moves between questions. Enter selects or submits. Ctrl+C clears the composer.'
                : 'Ctrl+C clears the composer. Alt+Enter queues a follow up while the conversation is busy. ↑/↓ recalls recent prompts.'
            }
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
                  streamIsStreaming,
                  composerHasContent,
                  addFiles: onFilesSelected,
                  upsertDrawingAttachment: onUpsertDrawingAttachment,
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
            streamIsStreaming={streamIsStreaming}
            conversationNeedsTakeover={conversationNeedsTakeover}
            composerHasContent={composerHasContent}
            composerShowsQuestionSubmit={composerShowsQuestionSubmit}
            composerQuestionCanSubmit={composerQuestionCanSubmit}
            composerQuestionRemainingCount={composerQuestionRemainingCount}
            composerQuestionSubmitting={composerQuestionSubmitting}
            composerSubmitLabel={composerSubmitLabel}
            composerAltHeld={composerAltHeld}
            onInsertComposerText={onInsertComposerText}
            onAppendComposerText={onAppendComposerText}
            onSubmitComposerQuestion={onSubmitComposerQuestion}
            onSubmitComposerActionForModifiers={onSubmitComposerActionForModifiers}
            onAbortStream={onAbortStream}
          />
        </div>
      </div>
    </div>
  );
}, inputControlsPropsAreEqual);
