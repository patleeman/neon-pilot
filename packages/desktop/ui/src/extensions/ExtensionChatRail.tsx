import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../client/api';
import { ChatRailComposer } from '../components/chat/ChatRailComposer';
import { ChatView } from '../components/chat/ChatView';
import { CenteredLoadingState } from '../components/ui';
import { useDesktopConversationState } from '../hooks/useDesktopConversationState';
import { getModelSelectionValue } from '../model/modelPreferences';
import type { DesktopConversationState, MessageBlock, ModelInfo, PromptAttachmentRefInput, PromptImageInput } from '../shared/types';

export interface ExtensionChatContextMessage {
  customType: string;
  content: string;
}

export interface ExtensionChatRailProps {
  conversationId: string | null;
  workspaceCwd?: string | null;
  tailBlocks?: number;
  className?: string;
  emptyState?: ReactNode;
  externalDraft?: { id: string; text: string } | null;
  getContextMessages?: (text: string) => ExtensionChatContextMessage[] | Promise<ExtensionChatContextMessage[]>;
  onError?: (message: string) => void;
  onModelChange?: (modelId: string) => void;
  onTurnComplete?: () => void | Promise<void>;
}

function hasTurnResultBlock(blocks: MessageBlock[], submittedBlockCount: number): boolean {
  return blocks.slice(submittedBlockCount).some((block) => {
    if (block.type === 'user' || block.type === 'context' || block.type === 'thinking') return false;
    if (block.type === 'text') return block.text.trim().length > 0 && block.streaming !== true;
    if (block.type === 'tool_use') return block.running !== true && block.status !== 'running';
    return true;
  });
}

/**
 * Extension-facing chat surface backed by the same live conversation runtime as
 * main chat and side chat. Extensions provide a host conversation id; the host
 * owns streaming, model selection, abort, transcript rendering, and composer UX.
 */
export function ExtensionChatRail({
  conversationId,
  workspaceCwd = null,
  tailBlocks = 400,
  className,
  emptyState,
  externalDraft,
  getContextMessages,
  onError,
  onModelChange,
  onTurnComplete,
}: ExtensionChatRailProps) {
  const desktopState = useDesktopConversationState(conversationId, { tailBlocks });
  const [hydratedState, setHydratedState] = useState<DesktopConversationState | null>(null);
  const activeState =
    hydratedState && (!desktopState.state || hydratedState.stream.blocks.length > desktopState.state.stream.blocks.length)
      ? hydratedState
      : desktopState.state;
  const stream = activeState?.stream ?? null;
  const messages: MessageBlock[] = stream?.blocks ?? [];
  const isStreaming = stream?.isStreaming ?? false;
  const isCompacting = stream?.isCompacting ?? false;
  const contextUsage = stream?.contextUsage ?? null;
  const tokens = stream?.tokens ?? null;

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState('');
  const [currentThinkingLevel, setCurrentThinkingLevel] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentConversationIdRef = useRef<string | null>(conversationId);
  const pendingTurnRefreshRef = useRef(false);
  const submittedBlockCountRef = useRef(0);
  const pendingRefreshTimersRef = useRef<number[]>([]);

  useEffect(() => {
    currentConversationIdRef.current = conversationId;
  }, [conversationId, onModelChange]);

  const hydrateConversationState = useCallback(async () => {
    if (!conversationId) {
      setHydratedState(null);
      return null;
    }

    try {
      const nextState = await api.desktopConversationState(conversationId, { tailBlocks });
      if (currentConversationIdRef.current === conversationId) setHydratedState(nextState);
      return nextState;
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [conversationId, onError, tailBlocks]);

  const maybeCompleteTurn = useCallback(
    async (nextState: DesktopConversationState | null) => {
      if (!pendingTurnRefreshRef.current || !nextState || nextState.stream.isStreaming) return;
      if (!hasTurnResultBlock(nextState.stream.blocks, submittedBlockCountRef.current)) return;
      pendingTurnRefreshRef.current = false;
      await onTurnComplete?.();
    },
    [onTurnComplete],
  );

  const refreshConversationState = useCallback(async () => {
    const nextState = await hydrateConversationState();
    await maybeCompleteTurn(nextState);
    return nextState;
  }, [hydrateConversationState, maybeCompleteTurn]);

  const refreshExtensionState = useCallback(async () => {
    await refreshConversationState();
  }, [refreshConversationState]);

  const clearPendingRefreshTimers = useCallback(() => {
    for (const timer of pendingRefreshTimersRef.current) {
      window.clearTimeout(timer);
    }
    pendingRefreshTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!pendingTurnRefreshRef.current || isStreaming || !hasTurnResultBlock(messages, submittedBlockCountRef.current)) return;
    pendingTurnRefreshRef.current = false;
    void onTurnComplete?.();
  }, [isStreaming, messages.length, onTurnComplete]);

  useEffect(() => clearPendingRefreshTimers, [clearPendingRefreshTimers, conversationId]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) {
      setHydratedState(null);
      return;
    }

    api
      .desktopConversationState(conversationId, { tailBlocks })
      .then((nextState) => {
        if (!cancelled) setHydratedState(nextState);
      })
      .catch((error) => {
        if (!cancelled) onError?.(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, onError, tailBlocks]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    api
      .conversationModelPreferences(conversationId)
      .then((preferences) => {
        if (cancelled) return;
        const nextModel = preferences.currentModel ?? '';
        setCurrentModel(nextModel);
        if (nextModel) onModelChange?.(nextModel);
        setCurrentThinkingLevel(preferences.currentThinkingLevel ?? '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    api
      .models(true)
      .then((result) => {
        if (cancelled) return;
        setModels(result.models ?? []);
        if (!currentModel && result.models.length > 0) {
          const nextModel = getModelSelectionValue(result.models[0], result.models);
          setCurrentModel(nextModel);
          onModelChange?.(nextModel);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentModel, onModelChange]);

  const handleFocusComposerRequest = useCallback(() => {
    const textarea = scrollRef.current?.closest('[data-extension-chat-rail]')?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement && textarea !== document.activeElement) {
      textarea.focus();
    }
  }, []);

  const handleSubmit = useCallback(
    async (text: string, behavior?: 'steer' | 'followUp', images?: PromptImageInput[], attachmentRefs?: PromptAttachmentRefInput[]) => {
      if (!conversationId || (!text.trim() && !images?.length && !attachmentRefs?.length)) return;
      try {
        const contextMessages = getContextMessages ? await getContextMessages(text) : undefined;
        pendingTurnRefreshRef.current = true;
        submittedBlockCountRef.current = messages.length;
        await desktopState.send(text, behavior, images, attachmentRefs, contextMessages);
        void refreshExtensionState();
        clearPendingRefreshTimers();
        pendingRefreshTimersRef.current = [1500, 5000, 15_000, 30_000].map((delayMs) =>
          window.setTimeout(() => void refreshExtensionState(), delayMs),
        );
        desktopState.reconnect();
      } catch (error) {
        pendingTurnRefreshRef.current = false;
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        throw error;
      }
    },
    [clearPendingRefreshTimers, conversationId, desktopState, getContextMessages, messages.length, onError, refreshExtensionState],
  );

  const handleAbort = useCallback(async () => {
    try {
      await desktopState.abort();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
    }
  }, [desktopState, onError]);

  const handleModelSelect = useCallback(
    async (modelId: string) => {
      if (!conversationId) return;
      setCurrentModel(modelId);
      onModelChange?.(modelId);
      try {
        await api.updateConversationModelPreferences(conversationId, { model: modelId });
      } catch (error) {
        onError?.(error instanceof Error ? error.message : String(error));
      }
    },
    [conversationId, onError],
  );

  const handleThinkingLevelSelect = useCallback(
    async (thinkingLevel: string) => {
      if (!conversationId) return;
      setCurrentThinkingLevel(thinkingLevel);
      try {
        await api.updateConversationModelPreferences(conversationId, { thinkingLevel });
      } catch (error) {
        onError?.(error instanceof Error ? error.message : String(error));
      }
    },
    [conversationId, onError],
  );

  return (
    <div className={className ?? 'flex h-full min-h-0 flex-col bg-base select-text'} data-extension-chat-rail="1">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {desktopState.loading && !activeState ? (
          <CenteredLoadingState label="Loading messages…" className="h-full" />
        ) : messages.length === 0 && emptyState ? (
          emptyState
        ) : (
          <ChatView
            conversationId={conversationId ?? undefined}
            messages={messages}
            isStreaming={isStreaming}
            isCompacting={isCompacting}
            scrollContainerRef={scrollRef}
            performanceMode="default"
            layout="compact"
            onFocusComposerRequest={handleFocusComposerRequest}
          />
        )}
      </div>
      <div className="shrink-0" aria-label="Extension chat composer">
        <ChatRailComposer
          conversationId={conversationId}
          workspaceCwd={activeState?.sessionDetail?.meta?.cwd ?? workspaceCwd}
          isStreaming={isStreaming}
          models={models}
          currentModel={currentModel}
          currentThinkingLevel={currentThinkingLevel}
          tokens={tokens}
          contextUsage={contextUsage}
          onSubmit={handleSubmit}
          onAbortStream={handleAbort}
          onSelectModel={handleModelSelect}
          onSelectThinkingLevel={handleThinkingLevelSelect}
          externalDraft={externalDraft}
          layout="compact"
        />
      </div>
    </div>
  );
}
