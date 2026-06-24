/**
 * ConversationComposerInputControls — textarea + action bar for conversation input.
 *
 * Wrapped in React.memo so the textarea only re-renders when its own props change,
 * not when the parent ConversationPage re-renders for unrelated reasons.
 * The component manages a localInput copy so keystroke-sensitive state (menus)
 * stays inside this subtree without propagating every change to the parent.
 */
import {
  type ClipboardEventHandler,
  type KeyboardEventHandler,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ComposerDrawingAttachment } from '../../conversation/promptAttachments';
import { setExtensionCommandContext } from '../../extensions/commands';
import { ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import { ComposerInputToolHost } from '../../extensions/ComposerInputToolHost';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import {
  getModelSelectionValue,
  groupModelsByProvider,
  resolveSelectableModel,
  THINKING_LEVEL_OPTIONS,
} from '../../model/modelPreferences';
import type { ModelInfo } from '../../shared/types';
import { ContextMenu } from '../shared/ContextMenu';
import { cx, IconButton, Select, Textarea } from '../ui';
import { COMPOSER_CREATE_DRAWING_COMMAND_EVENT } from './composerInputCommands';
import { COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, COMPOSER_OPEN_SETTINGS_COMMAND_EVENT } from './composerSettingsCommands';
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

const MODEL_PREFERENCES_CONTROL_KEY = 'system-model-picker:model-preferences';
const CORE_COMPOSER_CONTROL_KEYS = new Set(['system-composer-attachments:attach-files']);
const CORE_COMPOSER_INPUT_TOOL_KEYS = new Set(['system-excalidraw-input:excalidraw']);
const CORE_MODEL_PREFERENCE_MENU_WIDTH = 256;
const CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT = 64;

function composerRegistrationKey(registration: { extensionId: string; id: string }): string {
  return `${registration.extensionId}:${registration.id}`;
}

export function setComposerFocusedCommandContext(focused: boolean | null): void {
  setExtensionCommandContext('composer.focused', focused);
}

function modelOptionLabel(model: ModelInfo): string {
  return model.label ?? model.name ?? model.id;
}

function CoreComposerIcon({ path }: { path: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function CoreComposerDotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function CoreAttachControl({ disabled, onOpenFilePicker }: { disabled: boolean; onOpenFilePicker: () => void }) {
  return (
    <IconButton
      shape="circle"
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        if ((event.pointerType && event.pointerType !== 'mouse') || event.button === 0) onOpenFilePicker();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenFilePicker();
        }
      }}
      disabled={disabled}
      title="Attach image or drawing"
      aria-label="Attach image or drawing"
    >
      <CoreComposerIcon path="M12 5v14M5 12h14" />
    </IconButton>
  );
}

function CoreDrawingControl({
  conversationId,
  disabled,
  onUpsertDrawingAttachment,
}: {
  conversationId?: string | null;
  disabled: boolean;
  onUpsertDrawingAttachment: (payload: Omit<ComposerDrawingAttachment, 'localId' | 'dirty'>) => void;
}) {
  const openDrawingModal = useCallback(async () => {
    if (disabled) return;
    const result = await new Promise<unknown>((resolve, reject) => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-extension-modal', {
          detail: {
            extensionId: 'system-excalidraw-input',
            component: 'ExcalidrawEditorModal',
            props: { conversationId, saveLabel: 'Attach to chat' },
            size: 'fullscreen',
            resolve,
            reject,
          },
        }),
      );
    });
    if (result && typeof result === 'object') {
      onUpsertDrawingAttachment(result as Omit<ComposerDrawingAttachment, 'localId' | 'dirty'>);
    }
  }, [conversationId, disabled, onUpsertDrawingAttachment]);

  useEffect(() => {
    const handleCreateDrawingCommand = () => {
      void openDrawingModal();
    };

    window.addEventListener(COMPOSER_CREATE_DRAWING_COMMAND_EVENT, handleCreateDrawingCommand);
    return () => window.removeEventListener(COMPOSER_CREATE_DRAWING_COMMAND_EVENT, handleCreateDrawingCommand);
  }, [openDrawingModal]);

  return (
    <IconButton
      shape="circle"
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        if ((event.pointerType && event.pointerType !== 'mouse') || event.button === 0) void openDrawingModal();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void openDrawingModal();
        }
      }}
      disabled={disabled}
      title="Create drawing"
      aria-label="Create drawing"
    >
      <CoreComposerIcon path="M12 3.75l1.07 3.43a1.5 1.5 0 0 0 .93.94l3.43 1.07-3.43 1.07a1.5 1.5 0 0 0-.93.93L12 15.62l-1.07-3.43a1.5 1.5 0 0 0-.93-.93L6.57 10.19 10 9.12a1.5 1.5 0 0 0 .93-.94L12 3.75Zm6 10.5.54 1.71a.75.75 0 0 0 .47.47l1.71.54-1.71.54a.75.75 0 0 0-.47.47L18 20.69l-.54-1.71a.75.75 0 0 0-.47-.47l-1.71-.54 1.71-.54a.75.75 0 0 0 .47-.47L18 14.25Z" />
    </IconButton>
  );
}

function CoreModelPreferenceControls({
  disabled,
  models,
  currentModel,
  currentThinkingLevel,
  compact,
  onSelectModel,
  onSelectThinkingLevel,
}: {
  disabled: boolean;
  models: ModelInfo[];
  currentModel: string;
  currentThinkingLevel: string;
  compact: boolean;
  onSelectModel: (modelId: string) => void;
  onSelectThinkingLevel: (thinkingLevel: string) => void;
}) {
  const selectedModel = resolveSelectableModel(models, currentModel);
  const modelGroups = groupModelsByProvider(models);
  const selectBaseClassName =
    'h-8 min-w-0 truncate border-transparent bg-transparent px-2 text-xs font-medium text-secondary disabled:opacity-50';
  const modelSelectClassName = cx(selectBaseClassName, compact ? 'max-w-[8.25rem]' : 'max-w-[10rem]');
  const thinkingSelectClassName = cx(selectBaseClassName, compact ? 'max-w-[5.75rem]' : 'max-w-[7rem]');
  return (
    <>
      <Select
        aria-label="Conversation model"
        title="Conversation model"
        className={modelSelectClassName}
        disabled={disabled || models.length === 0}
        value={selectedModel ? getModelSelectionValue(selectedModel, models) : currentModel}
        onChange={(event) => onSelectModel(event.target.value)}
      >
        {models.length === 0 ? <option value="">Select model</option> : null}
        {modelGroups.map(([provider, providerModels]) => (
          <optgroup key={provider} label={provider}>
            {providerModels.map((model) => (
              <option key={`${model.provider}:${model.id}`} value={getModelSelectionValue(model, models)}>
                {modelOptionLabel(model)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Select
        aria-label="Thinking level"
        title="Thinking level"
        className={thinkingSelectClassName}
        disabled={disabled}
        value={currentThinkingLevel}
        onChange={(event) => onSelectThinkingLevel(event.target.value)}
      >
        {THINKING_LEVEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </>
  );
}

function CoreModelPreferenceOverflow({
  disabled,
  models,
  currentModel,
  currentThinkingLevel,
  onSelectModel,
  onSelectThinkingLevel,
}: {
  disabled: boolean;
  models: ModelInfo[];
  currentModel: string;
  currentThinkingLevel: string;
  onSelectModel: (modelId: string) => void;
  onSelectThinkingLevel: (thinkingLevel: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const settingsAvailable = !(disabled && models.length === 0);

  const openMenu = useCallback(() => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      setMenuPosition({ x: 12, y: 12 });
      setOpen(true);
      return;
    }

    setMenuPosition({
      x: bounds.left + bounds.width / 2 - CORE_MODEL_PREFERENCE_MENU_WIDTH / 2,
      y: bounds.top - CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT - 8,
    });
    setOpen(true);
  }, []);

  useEffect(() => {
    setExtensionCommandContext('composer.settingsAvailable', settingsAvailable);
    return () => setExtensionCommandContext('composer.settingsAvailable', null);
  }, [settingsAvailable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setExtensionCommandContext('composer.settingsOpen', true);
    return () => setExtensionCommandContext('composer.settingsOpen', null);
  }, [open]);

  useEffect(() => {
    function handleOpenSettings() {
      if (settingsAvailable) openMenu();
    }

    window.addEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
    return () => window.removeEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
  }, [settingsAvailable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleCloseSettings() {
      setOpen(false);
    }

    window.addEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettings);
    return () => window.removeEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettings);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <IconButton
        ref={buttonRef}
        shape="circle"
        type="button"
        title="More composer settings"
        aria-label="More composer settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!settingsAvailable}
        onPointerDown={(event) => {
          event.preventDefault();
          if (!((event.pointerType && event.pointerType !== 'mouse') || event.button === 0)) return;
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) {
              setOpen(false);
              return;
            }
            openMenu();
          }
        }}
      >
        <CoreComposerDotsIcon />
      </IconButton>
      {open && menuPosition ? (
        <ContextMenu
          aria-label="Composer settings"
          className="z-50 grid gap-2 p-2.5"
          estimatedHeight={CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT}
          ignoreRefs={[buttonRef]}
          minWidth={CORE_MODEL_PREFERENCE_MENU_WIDTH}
          onClose={() => setOpen(false)}
          position={menuPosition}
          role="dialog"
          style={{ width: `min(${CORE_MODEL_PREFERENCE_MENU_WIDTH / 16}rem, calc(100vw - 1rem))` }}
        >
          <CoreModelPreferenceControls
            disabled={disabled}
            models={models}
            currentModel={currentModel}
            currentThinkingLevel={currentThinkingLevel}
            compact={false}
            onSelectModel={onSelectModel}
            onSelectThinkingLevel={onSelectThinkingLevel}
          />
        </ContextMenu>
      ) : null}
    </div>
  );
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
  const { composerControls = [], composerInputTools = [] } = useExtensionRegistry();
  const extensionComposerControls = useMemo(
    () => composerControls.filter((control) => !CORE_COMPOSER_CONTROL_KEYS.has(composerRegistrationKey(control))),
    [composerControls],
  );
  const extensionComposerInputTools = useMemo(
    () => composerInputTools.filter((tool) => !CORE_COMPOSER_INPUT_TOOL_KEYS.has(composerRegistrationKey(tool))),
    [composerInputTools],
  );
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

  useEffect(() => () => setComposerFocusedCommandContext(null), []);

  useEffect(() => {
    setExtensionCommandContext('composer.canCreateDrawing', !composerDisabled);
    return () => setExtensionCommandContext('composer.canCreateDrawing', null);
  }, [composerDisabled]);

  const visibleComposerInputTools = useMemo(
    () =>
      extensionComposerInputTools.filter((tool) => {
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
    [composerHasContent, extensionComposerInputTools, streamIsStreaming],
  );

  const visibleComposerControls = useMemo(
    () =>
      extensionComposerControls.filter((button) => {
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
    [extensionComposerControls, composerHasContent, streamIsStreaming],
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
  const hasExtensionModelPreferencesControl = visiblePreferenceControls.some(
    (control) => composerRegistrationKey(control) === MODEL_PREFERENCES_CONTROL_KEY,
  );
  const shouldKeepControlRowInline = composerShellWidth === null || composerShellWidth >= 420;
  const shouldCollapseCorePreferences = !shouldKeepControlRowInline;
  const shouldRenderCoreModelPreferences = !hasExtensionModelPreferencesControl;

  return (
    <div className="px-3 pt-2.5 pb-2.5">
      {/* ui-pattern-ok raw-control reason="Hidden native file input is required to open the browser file picker and is triggered by shared composer controls." */}
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
          <Textarea
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
              setComposerFocusedCommandContext(true);
              onRememberComposerSelection(event.currentTarget);
            }}
            onBlur={() => {
              setComposerFocusedCommandContext(false);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            disabled={composerDisabled}
            className="w-full resize-none overscroll-contain !border-0 !bg-transparent !p-0 text-sm leading-relaxed text-primary outline-none placeholder:text-dim hover:!bg-transparent focus:!border-0 focus:!bg-transparent disabled:cursor-default disabled:text-dim"
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

        <div
          className={cx(
            'flex min-w-0 flex-wrap items-center gap-1.5 border-t border-dashed border-border-subtle px-1 py-2 pb-0',
            shouldKeepControlRowInline && 'flex-nowrap',
          )}
        >
          <div className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-1.5', shouldKeepControlRowInline && 'flex-nowrap')}>
            <CoreAttachControl disabled={composerDisabled} onOpenFilePicker={onOpenFilePicker} />
            {visibleLeadingControls.map((control) => (
              <ComposerButtonHost
                key={`${control.extensionId}:${control.id}`}
                registration={control}
                controlContext={{ ...composerControlContext, renderMode: 'inline' }}
              />
            ))}
            <CoreDrawingControl
              conversationId={conversationId}
              disabled={composerDisabled}
              onUpsertDrawingAttachment={onUpsertDrawingAttachment}
            />
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
            {shouldRenderCoreModelPreferences ? (
              shouldCollapseCorePreferences ? (
                <CoreModelPreferenceOverflow
                  disabled={composerDisabled}
                  models={models}
                  currentModel={currentModel}
                  currentThinkingLevel={currentThinkingLevel}
                  onSelectModel={onSelectModel}
                  onSelectThinkingLevel={onSelectThinkingLevel}
                />
              ) : (
                <CoreModelPreferenceControls
                  disabled={composerDisabled}
                  models={models}
                  currentModel={currentModel}
                  currentThinkingLevel={currentThinkingLevel}
                  compact={false}
                  onSelectModel={onSelectModel}
                  onSelectThinkingLevel={onSelectThinkingLevel}
                />
              )
            ) : null}
            <ConversationPreferencesRow
              composerControls={visiblePreferenceControls}
              composerControlContext={composerControlContext}
              inlineLimit={getComposerPreferenceInlineLimit(composerShellWidth)}
              respondToSettingsCommands={hasExtensionModelPreferencesControl && shouldCollapseCorePreferences}
            />
          </div>

          <div className="ml-auto shrink-0">
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
    </div>
  );
}, inputControlsPropsAreEqual);
