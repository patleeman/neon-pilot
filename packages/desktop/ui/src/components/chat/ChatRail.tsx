import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppEvents } from '../../app/contexts.js';
import { api } from '../../client/api.js';
import { dispatchOpenCompanionChat } from '../../companion/companionEvents.js';
import {
  persistForkPromptDraft,
  resolveBranchEntryIdFromSessionDetailResult,
  resolveRewindTargetForMessage,
  resolveRewindTargetFromResolvedEntry,
  resolveSessionEntryIdFromBlockId,
} from '../../conversation/forking.js';
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
export function ChatRail({ conversationId, workspaceCwd: _workspaceCwd }: { conversationId: string; workspaceCwd: string | null }) {
  const desktopState = useDesktopConversationState(conversationId, {
    tailBlocks: 400,
  });
  const { conversationVersions } = useAppEvents();

  const stream = desktopState.state?.stream ?? null;
  const messages: MessageBlock[] = stream?.blocks ?? [];
  const isStreaming = stream?.isStreaming ?? false;
  const isCompacting = stream?.isCompacting ?? false;

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
  }, [conversationVersions[conversationId], desktopState.reconnect]);

  // ── Composer state ────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      try {
        await desktopState.send(text);
      } catch {
        // Composer stays usable on error.
      }
    },
    [desktopState, isStreaming],
  );

  const handleAbort = useCallback(async () => {
    try {
      await desktopState.abort();
    } catch {
      // Ignore abort errors.
    }
  }, [desktopState]);

  const handleRewindMessage = useCallback(
    async (messageIndex: number) => {
      const localMessageIndex = messageIndex - (stream?.blockOffset ?? 0);
      if (localMessageIndex < 0 || localMessageIndex >= messages.length) {
        return;
      }

      try {
        const clickedBlock = messages[localMessageIndex];
        let target: { entryId: string; beforeEntry: boolean; promptDraft: string | null } | null = null;

        if (clickedBlock?.type === 'text' || clickedBlock?.type === 'user') {
          let entryId = resolveSessionEntryIdFromBlockId(clickedBlock.id);
          if (!entryId) {
            const detail = await api.sessionDetail(conversationId, {
              tailBlocks: Math.max(messages.length, 1),
            });
            entryId = resolveBranchEntryIdFromSessionDetailResult(clickedBlock, messageIndex, detail);
          }
          if (entryId) {
            target = resolveRewindTargetFromResolvedEntry(messages, localMessageIndex, entryId);
          }
        }

        if (!target) {
          const entries = await api.forkEntries(conversationId);
          target = resolveRewindTargetForMessage(messages, localMessageIndex, entries);
        }
        if (!target) {
          return;
        }

        const forked = await api.forkSession(
          conversationId,
          target.entryId,
          {
            preserveSource: true,
            beforeEntry: target.beforeEntry,
            branchKind: 'rewind',
          },
          desktopState.surfaceId,
        );
        if (target.promptDraft) {
          persistForkPromptDraft(forked.newSessionId, target.promptDraft);
        }
        dispatchOpenCompanionChat({ conversationId: forked.newSessionId, forceNewTab: true });
      } catch (error) {
        console.error('Side chat rewind failed:', error);
      }
    },
    [conversationId, desktopState.surfaceId, messages, stream?.blockOffset],
  );

  const handleForkMessage = useCallback(
    async (messageIndex: number) => {
      const localMessageIndex = messageIndex - (stream?.blockOffset ?? 0);
      if (localMessageIndex < 0 || localMessageIndex >= messages.length) {
        return;
      }

      const clickedBlock = messages[localMessageIndex];
      if (clickedBlock?.type !== 'text' && clickedBlock?.type !== 'user') {
        await handleRewindMessage(messageIndex);
        return;
      }

      try {
        let entryId = resolveSessionEntryIdFromBlockId(clickedBlock.id);
        if (!entryId) {
          const detail = await api.sessionDetail(conversationId, {
            tailBlocks: Math.max(messages.length, 1),
          });
          entryId = resolveBranchEntryIdFromSessionDetailResult(clickedBlock, messageIndex, detail);
        }
        if (!entryId) {
          return;
        }

        const forked =
          clickedBlock.type === 'user'
            ? await api.forkSession(
                conversationId,
                entryId,
                {
                  preserveSource: true,
                  beforeEntry: true,
                  branchKind: 'fork',
                },
                desktopState.surfaceId,
              )
            : await api.branchSession(conversationId, entryId, desktopState.surfaceId);

        if (clickedBlock.type === 'user') {
          persistForkPromptDraft(forked.newSessionId, clickedBlock.text);
        }
        dispatchOpenCompanionChat({
          conversationId: forked.newSessionId,
          title: clickedBlock.type === 'user' ? `Fork: ${clickedBlock.text.slice(0, 40)}` : undefined,
          forceNewTab: true,
        });
      } catch (error) {
        console.error('Side chat fork failed:', error);
      }
    },
    [conversationId, desktopState.surfaceId, handleRewindMessage, messages, stream?.blockOffset],
  );

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-base select-text">
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ChatView
          conversationId={conversationId}
          messages={messages}
          isStreaming={isStreaming}
          isCompacting={isCompacting}
          scrollContainerRef={scrollRef}
          performanceMode="default"
          onForkMessage={handleForkMessage}
          onRewindMessage={handleRewindMessage}
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
