import { type ClipboardEventHandler, type KeyboardEventHandler, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildSlashMenuItems, type SlashMenuItem } from '../../commands/slashMenu';
import { type MentionItem } from '../../conversation/conversationMentions';
import { parseConversationSlashCommand } from '../../conversation/conversationSlashCommand';
import {
  buildComposerFilePreparationNotices,
  buildPromptImages,
  type ComposerDrawingAttachment,
  type ComposerImageAttachment,
  drawingAttachmentToPromptImage,
  drawingAttachmentToPromptRef,
  prepareComposerFiles,
  removeComposerDrawingAttachmentByLocalId,
  removeComposerImageFileAtIndex,
} from '../../conversation/promptAttachments';
import { useComposerController } from '../../conversation/useComposerController';
import { useConversationComposerMenus, type UseConversationComposerMenusState } from '../../conversation/useConversationComposerMenus';
import { useComposerModifierKeys } from '../../conversation/useConversationKeyboardState';
import type { ModelInfo, PromptAttachmentRefInput, PromptImageInput, SessionContextUsage } from '../../shared/types';
import { ConversationComposer } from '../conversation/ConversationComposer';
import { ChatBubbleIcon } from '../conversation/ConversationComposerChrome';
import { ConversationComposerInputControls } from '../conversation/ConversationComposerInputControls';
import { MentionMenu, ModelPicker, SlashMenu } from '../conversation/ConversationComposerMenus';
import { addNotification } from '../notifications/notificationStore';
import { ComposerAttachmentShelf } from './ComposerAttachmentShelf';

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
  workspaceCwd: _workspaceCwd,
  isStreaming,
  models,
  currentModel,
  tokens,
  contextUsage,
  onSubmit,
  onAbortStream,
  onSelectModel,
  composerMeta,
}: {
  conversationId: string | null;
  workspaceCwd: string | null;
  isStreaming: boolean;
  models: ModelInfo[];
  currentModel: string;
  tokens: { input: number; output: number; total: number; cacheRead: number; cacheWrite: number } | null;
  contextUsage: SessionContextUsage | null;
  onSubmit: (
    text: string,
    behavior?: 'steer' | 'followUp',
    images?: PromptImageInput[],
    attachmentRefs?: PromptAttachmentRefInput[],
  ) => void;
  onAbortStream: () => void;
  onSelectModel: (modelId: string) => void;
  composerMeta?: ReactNode;
}) {
  const [input, setInput] = useState(() => (conversationId ? (readForkPromptDraft(conversationId) ?? '') : ''));
  const [attachments, setAttachments] = useState<ComposerImageAttachment[]>([]);
  const [drawingAttachments, setDrawingAttachments] = useState<ComposerDrawingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [composerShellWidth, setComposerShellWidth] = useState<number | null>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const composerMenuStateRef = useRef<Pick<UseConversationComposerMenusState, 'resetMenus'> | null>(null);
  const latestInputRef = useRef(input);
  const { composerAltHeld } = useComposerModifierKeys();

  useEffect(() => {
    if (conversationId) {
      clearForkPromptDraft(conversationId);
    }
  }, [conversationId]);

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

  useEffect(() => {
    latestInputRef.current = input;
  }, [input]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const slashItems = useMemo(() => buildSlashMenuItems(input, [], []), [input]);
  const mentionItems = useMemo<MentionItem[]>(() => [], []);

  const composerController = useComposerController({
    inputRef: latestInputRef,
    textareaRef,
    selectionRef: composerSelectionRef,
    setInput,
    scheduleResize: () => {},
    onTextInserted: () => {
      composerMenuStateRef.current?.resetMenus();
    },
  });
  const {
    rememberSelection: rememberComposerSelection,
    insertText: insertTextIntoComposer,
    appendText: appendTextToComposer,
  } = composerController;

  const handleRailSlashCommandSubmit = useCallback(async (slashInput: string): Promise<boolean> => {
    const parsed = parseConversationSlashCommand(slashInput);
    if (!parsed) {
      return false;
    }

    addNotification({
      type: 'warning',
      message: parsed.kind === 'invalid' ? parsed.message : 'Slash commands are available in main conversation only.',
    });
    return true;
  }, []);

  const handleRailSlashMenuSelect = useCallback(
    async (item: SlashMenuItem) => {
      const parsed = parseConversationSlashCommand(item.displayCmd.trim());
      if (parsed?.kind === 'command') {
        addNotification({ type: 'warning', message: 'Slash commands are available in main conversation only.' });
        return;
      }

      composerController.setText(item.insertText);
    },
    [composerController],
  );

  const handleRailMentionSelect = useCallback(
    async (id: string, currentInput: string) => {
      composerController.setText(currentInput.replace(/@[-\w./-]*$/, `${id} `));
    },
    [composerController],
  );

  const composerMenus = useConversationComposerMenus({
    input,
    slashItems,
    mentionItems,
    models,
    onSlashCommandCommit: handleRailSlashCommandSubmit,
    onSlashMenuSelect: handleRailSlashMenuSelect,
    onMentionSelect: handleRailMentionSelect,
    onModelSelect: (selectedModelId) => onSelectModel(selectedModelId),
    onClearComposer: composerController.clear,
  });

  const {
    showModelPicker,
    showSlash,
    showMention,
    slashIdx,
    mentionIdx,
    modelIdx,
    modelItems,
    modelQuery,
    mentionQuery,
    handleMenuKeyDown: handleComposerMenuKeyDown,
    resetMenus,
  } = composerMenus;

  composerMenuStateRef.current = composerMenus;

  const hasContent = input.trim().length > 0 || attachments.length > 0 || drawingAttachments.length > 0;
  const composerDisabled = false;

  const buildSubmitPayload = useCallback(() => {
    const promptImages = [...buildPromptImages(attachments), ...drawingAttachments.map(drawingAttachmentToPromptImage)];
    const attachmentRefs = drawingAttachments
      .map(drawingAttachmentToPromptRef)
      .filter((ref): ref is PromptAttachmentRefInput => ref !== null);
    return { promptImages, attachmentRefs };
  }, [attachments, drawingAttachments]);

  const clearComposerAfterSubmit = useCallback(() => {
    setInput('');
    setAttachments([]);
    setDrawingAttachments([]);
  }, []);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    async (event) => {
      if (await handleComposerMenuKeyDown(event)) {
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (hasContent) {
          const { promptImages, attachmentRefs } = buildSubmitPayload();
          onSubmit(input.trim(), isStreaming ? 'steer' : undefined, promptImages, attachmentRefs);
          clearComposerAfterSubmit();
        }
      }
    },
    [buildSubmitPayload, clearComposerAfterSubmit, handleComposerMenuKeyDown, hasContent, input, isStreaming, onSubmit],
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (_event) => {
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

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const prepared = await prepareComposerFiles(files);
    if (prepared.imageAttachments.length > 0) {
      setAttachments((current) => [...current, ...prepared.imageAttachments]);
    }
    if (prepared.drawingAttachments.length > 0) {
      setDrawingAttachments((current) => [...current, ...prepared.drawingAttachments]);
    }
    for (const notice of buildComposerFilePreparationNotices(prepared)) {
      addNotification({ type: notice.tone === 'danger' ? 'error' : 'info', message: notice.text });
    }
  }, []);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUpsertDrawingAttachment = useCallback((payload: Omit<ComposerDrawingAttachment, 'localId' | 'dirty'>) => {
    const localId = `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDrawingAttachments((current) => [...current, { ...payload, localId, dirty: true }]);
  }, []);

  const handleSubmitForModifiers = useCallback(
    (altKeyHeld: boolean) => {
      if (!hasContent) return;
      const { promptImages, attachmentRefs } = buildSubmitPayload();
      onSubmit(
        input.trim(),
        isStreaming ? (altKeyHeld ? 'followUp' : 'steer') : altKeyHeld ? 'followUp' : undefined,
        promptImages,
        attachmentRefs,
      );
      clearComposerAfterSubmit();
    },
    [buildSubmitPayload, clearComposerAfterSubmit, hasContent, input, isStreaming, onSubmit],
  );

  // Side chat shares the parent conversation's CWD — never show CWD picker.
  const composerMetaFallback = (
    <div className="conversation-composer-meta mt-1.5 flex min-h-4 flex-row items-center justify-between gap-2 overflow-visible px-3 text-[10.5px] font-mono text-dim/80 tracking-[0.02em]">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <ChatBubbleIcon className="shrink-0 text-dim/70" />
        <span className="min-w-0">Chat</span>
      </div>
      {tokens && (
        <span className="shrink-0 text-dim/60" title={`${tokens.total?.toLocaleString() ?? '?'} tokens used`}>
          {tokens.total?.toLocaleString() ?? ''}
        </span>
      )}
      {contextUsage?.percent != null && (
        <span className="shrink-0 text-dim/60" title={`${Math.round(contextUsage.percent * 100)}% of context window used`}>
          {Math.round(contextUsage.percent * 100)}%
        </span>
      )}
    </div>
  );

  const shelves =
    attachments.length > 0 || drawingAttachments.length > 0 ? (
      <div className="max-h-[min(34vh,20rem)] overflow-y-auto overscroll-contain border-b border-border-subtle/60">
        <ComposerAttachmentShelf
          attachments={attachments}
          drawingAttachments={drawingAttachments}
          onRemoveAttachment={(index) => setAttachments((current) => removeComposerImageFileAtIndex(current, index))}
          onEditDrawing={() => {}}
          onRemoveDrawingAttachment={(localId) =>
            setDrawingAttachments((current) => removeComposerDrawingAttachmentByLocalId(current, localId))
          }
        />
      </div>
    ) : null;

  return (
    <ConversationComposer
      layoutMode="main"
      className={`bg-gradient-to-t from-base via-base to-transparent px-8 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-colors sm:px-10 ${dragOver ? 'bg-accent/5' : ''}`}
      dragOver={dragOver}
      streamIsStreaming={isStreaming}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragOver(false);
      }}
      onDrop={(event) => {
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length === 0) return;
        event.preventDefault();
        setDragOver(false);
        void handleFilesSelected(files);
      }}
      shellRef={composerShellRef}
      dragOverlay={
        dragOver ? (
          <div className="px-4 py-3 text-center text-[12px] text-accent border-b border-accent/20">📎 Drop files to attach</div>
        ) : null
      }
      hasInteractiveOverlay={showModelPicker || showSlash || showMention}
      menus={
        <>
          {showSlash ? (
            <SlashMenu
              items={slashItems}
              idx={slashIdx}
              onSelect={(item) => {
                void handleRailSlashMenuSelect(item);
              }}
            />
          ) : null}
          {showMention ? (
            <MentionMenu
              items={mentionItems}
              query={mentionQuery}
              idx={mentionIdx}
              onSelect={(id) => {
                void handleRailMentionSelect(id, input);
              }}
            />
          ) : null}
          {showModelPicker ? (
            <ModelPicker
              models={modelItems}
              currentModel={currentModel}
              query={modelQuery}
              idx={modelIdx}
              onSelect={(modelId) => {
                onSelectModel(modelId);
                composerController.clear();
              }}
              onClose={() => {
                composerController.clear();
              }}
            />
          ) : null}
        </>
      }
      composerMeta={composerMeta ?? composerMetaFallback}
      shelves={shelves}
      inputControls={
        <ConversationComposerInputControls
          conversationId={conversationId}
          fileInputRef={fileInputRef}
          textareaRef={textareaRef}
          input={input}
          pendingAskUserQuestion={false}
          composerDisabled={composerDisabled}
          composerShellWidth={composerShellWidth}
          streamIsStreaming={isStreaming}
          models={models}
          currentModel={currentModel}
          currentThinkingLevel=""
          savingPreference={null}
          conversationNeedsTakeover={false}
          composerHasContent={hasContent}
          composerShowsQuestionSubmit={false}
          composerQuestionCanSubmit={false}
          composerQuestionRemainingCount={0}
          composerQuestionSubmitting={false}
          composerSubmitLabel={isStreaming ? 'Steer' : 'Send'}
          composerAltHeld={composerAltHeld}
          onFilesSelected={(files) => {
            void handleFilesSelected(files);
          }}
          onInputChange={(value, textarea) => {
            setInput(value);
            rememberComposerSelection(textarea);
            resetMenus();
          }}
          onRememberComposerSelection={rememberComposerSelection}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onOpenFilePicker={handleOpenFilePicker}
          onUpsertDrawingAttachment={handleUpsertDrawingAttachment}
          onSelectModel={onSelectModel}
          onSelectThinkingLevel={() => {}}
          onInsertComposerText={insertTextIntoComposer}
          onAppendComposerText={appendTextToComposer}
          onSubmitComposerQuestion={() => {}}
          onSubmitComposerActionForModifiers={handleSubmitForModifiers}
          onAbortStream={onAbortStream}
        />
      }
    />
  );
}
