import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppEvents } from '../../app/contexts.js';
import { api } from '../../client/api.js';
import { useDesktopConversationState } from '../../hooks/useDesktopConversationState.js';
import type { MessageBlock, ModelInfo } from '../../shared/types.js';
import { ChatRailComposer } from './ChatRailComposer.js';
import { ChatView } from './ChatView.js';

/**
 * Full chat experience rendered inside a right-panel companion tab.
 *
 * Manages its own live session via useDesktopConversationState and
 * renders ChatView + a full composer.
 */
export function ChatRail({ conversationId, workspaceCwd }: { conversationId: string; workspaceCwd: string | null }) {
  const desktopState = useDesktopConversationState(conversationId, {
    tailBlocks: 400,
  });
  const { conversationVersions } = useAppEvents();

  const stream = desktopState.state?.stream ?? null;
  const messages: MessageBlock[] = stream?.blocks ?? [];
  const isStreaming = stream?.isStreaming ?? false;
  const isCompacting = stream?.isCompacting ?? false;
  const title = desktopState.state?.sessionDetail?.meta?.title ?? 'Side Chat';
  const cwd = desktopState.state?.sessionDetail?.meta?.cwd ?? workspaceCwd ?? '';

  // ── Models ────────────────────────────────────────────────────────────
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState('');

  useEffect(() => {
    if (!desktopState.state?.sessionDetail?.meta?.model) return;
    setCurrentModel(desktopState.state.sessionDetail.meta.model);
  }, [desktopState.state?.sessionDetail?.meta?.model]);

  useEffect(() => {
    let cancelled = false;
    api
      .models(true)
      .then((result) => {
        if (cancelled) return;
        setModels(result.models ?? []);
        if (!currentModel && result.models.length > 0) {
          setCurrentModel(result.models[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentModel]);

  // Refresh when conversation metadata version bumps.
  useEffect(() => {
    desktopState.reconnect();
  }, [conversationVersions[conversationId], desktopState]);

  // ── Composer state ────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      try {
        await stream?.send(text);
      } catch {
        // Composer stays usable on error.
      }
    },
    [isStreaming, stream],
  );

  const handleAbort = useCallback(async () => {
    try {
      await stream?.abort();
    } catch {
      // Ignore abort errors.
    }
  }, [stream]);

  const handleModelSelect = useCallback(
    async (modelId: string) => {
      setCurrentModel(modelId);
      try {
        await api.changeConversationModel(conversationId, modelId);
      } catch {
        // Ignore model change errors.
      }
    },
    [conversationId],
  );

  const handleDuplicate = useCallback(async () => {
    try {
      const { newSessionId } = await api.duplicateConversation(conversationId);
      window.dispatchEvent(
        new CustomEvent('pa:companion-chat-open', {
          detail: { conversationId: newSessionId, title: `Duplicate of ${title}` },
        }),
      );
    } catch {
      // Ignore duplicate errors.
    }
  }, [conversationId, title]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-base select-text">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <h2 className="min-w-0 truncate text-[13px] font-medium text-primary">{title}</h2>
        <button
          type="button"
          onClick={handleDuplicate}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-dim transition hover:bg-surface hover:text-secondary"
          title="Duplicate this companion conversation"
          aria-label="Duplicate conversation"
        >
          ⧉
        </button>
        <span className="shrink-0 text-[10px] text-dim font-mono truncate max-w-[120px]" title={cwd}>
          {cwd ? cwd.split('/').pop() : ''}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ChatView
          conversationId={conversationId}
          messages={messages}
          isStreaming={isStreaming}
          isCompacting={isCompacting}
          scrollContainerRef={scrollRef}
          performanceMode="balanced"
        />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border-subtle bg-panel">
        <ChatRailComposer
          conversationId={conversationId}
          isStreaming={isStreaming}
          models={models}
          currentModel={currentModel}
          onSubmit={handleSubmit}
          onAbortStream={handleAbort}
          onSelectModel={handleModelSelect}
        />
      </div>
    </div>
  );
}
