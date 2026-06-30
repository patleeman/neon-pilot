import type { CSSProperties } from 'react';

import type { MessageBlock } from '../../shared/types';
import type { AskUserQuestionAnswers, AskUserQuestionPresentation } from '../../transcript/askUserQuestions';
import { buildDeferredEntryHydrationId } from '../../transcript/messageBlocks.js';
import type { ChatViewLayout } from './chatViewTypes.js';
import { ImageBlock, type InspectableImage } from './ImageMessageBlocks.js';
import { AssistantMessage, ContextShelf, SummaryMessage, SystemEventMessage, TopologyBlock, UserMessage } from './MessageBlocks.js';
import type { ReplySelectionGestureHandler } from './replySelection.js';
import { ToolBlock } from './ToolBlock.js';
import {
  type ConversationDiffDisclosureMode,
  type ConversationTranscriptDisclosureMode,
  resolveConversationBlockAutoOpen,
} from './toolPresentation.js';
import { ErrorBlock, SubagentBlock, ThinkingBlock, TraceClusterBlock } from './TraceBlocks.js';
import type { ChatRenderItem } from './transcriptItems.js';
import { isTopologyBlock } from './transcriptItems.js';

export function ChatRenderItemView({
  item,
  itemIndex,
  renderItemsLength,
  conversationId,
  messageIndexOffset,
  messages,
  isStreaming,
  contentVisibilityStyle,
  layout,
  onForkMessage,
  onRewindMessage,
  onEditUserMessage,
  onReplyToSelection,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  onSubmitAskUserQuestion,
  askUserQuestionDisplayMode,
  isInlineRunExpanded,
  onToggleInlineRun,
  onInspectImage,
  onSelectionGesture,
  transcriptDisclosureMode,
  diffDisclosureMode,
  showPinnedToolCalls,
}: {
  item: ChatRenderItem;
  itemIndex: number;
  renderItemsLength: number;
  conversationId?: string | null;
  messageIndexOffset: number;
  messages: MessageBlock[];
  isStreaming: boolean;
  contentVisibilityStyle?: CSSProperties;
  layout: ChatViewLayout;
  onForkMessage?: (messageIndex: number) => Promise<void> | void;
  onRewindMessage?: (messageIndex: number) => Promise<void> | void;
  onEditUserMessage?: (messageIndex: number, text: string) => Promise<void> | void;
  onReplyToSelection?: (selection: { text: string; messageIndex: number; blockId?: string }) => Promise<void> | void;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onSubmitAskUserQuestion?: (presentation: AskUserQuestionPresentation, answers: AskUserQuestionAnswers) => Promise<void> | void;
  askUserQuestionDisplayMode: 'inline' | 'composer';
  isInlineRunExpanded: (inlineRunKey: string) => boolean;
  onToggleInlineRun: (inlineRunKey: string) => void;
  onInspectImage: (image: InspectableImage) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
  transcriptDisclosureMode: ConversationTranscriptDisclosureMode;
  diffDisclosureMode: ConversationDiffDisclosureMode;
  showPinnedToolCalls: boolean;
}) {
  const isTailItem = itemIndex === renderItemsLength - 1;

  if (item.type === 'trace_cluster') {
    const live = isStreaming && isTailItem;
    const followedByTranscriptContent = !isTailItem;
    const deferredEntryHydrationId =
      item.blocks.length === 0 && item.deferredEntryIds ? buildDeferredEntryHydrationId(item.deferredEntryIds) : null;

    return (
      <div
        data-trace-cluster-start-index={messageIndexOffset + item.startIndex}
        data-chat-tail={isTailItem ? '1' : undefined}
        style={contentVisibilityStyle}
      >
        {item.blocks.map((_, offset) => {
          const absoluteIndex = messageIndexOffset + item.startIndex + offset;
          return <span key={`anchor-${absoluteIndex}`} id={`msg-${absoluteIndex}`} className="block h-0 overflow-hidden" aria-hidden />;
        })}
        <TraceClusterBlock
          blocks={item.blocks}
          deferredBlockIds={
            item.blocks.length === 0 ? (deferredEntryHydrationId ? [deferredEntryHydrationId] : item.deferredBlockIds) : undefined
          }
          summary={item.summary}
          live={live}
          followedByTranscriptContent={followedByTranscriptContent}
          onOpenArtifact={onOpenArtifact}
          activeArtifactId={activeArtifactId}
          onOpenCheckpoint={onOpenCheckpoint}
          activeCheckpointId={activeCheckpointId}
          onOpenBrowser={onOpenBrowser}
          onOpenFilePath={onOpenFilePath}
          validatedFilePathTargets={validatedFilePathTargets}
          onHydrateMessage={onHydrateMessage}
          hydratingMessageBlockIds={hydratingMessageBlockIds}
          layout={layout}
          transcriptDisclosureMode={transcriptDisclosureMode}
          diffDisclosureMode={diffDisclosureMode}
          showPinnedToolCalls={showPinnedToolCalls}
        />
      </div>
    );
  }

  if (item.type === 'context_cluster') {
    const isTailContextItem = itemIndex === renderItemsLength - 1;
    return (
      <div data-chat-tail={isTailContextItem ? '1' : undefined} style={contentVisibilityStyle}>
        {item.blocks.map((_, offset) => {
          const absoluteIndex = messageIndexOffset + item.startIndex + offset;
          return <span key={`anchor-${absoluteIndex}`} id={`msg-${absoluteIndex}`} className="block h-0 overflow-hidden" aria-hidden />;
        })}
        <ContextShelf
          blocks={item.blocks}
          messageIndexOffset={messageIndexOffset + item.startIndex}
          currentConversationId={conversationId}
          onOpenFilePath={onOpenFilePath}
          validatedFilePathTargets={validatedFilePathTargets}
          onOpenCheckpoint={onOpenCheckpoint}
          onSelectionGesture={onReplyToSelection ? onSelectionGesture : undefined}
        />
      </div>
    );
  }

  const block = item.block;
  const absoluteIndex = messageIndexOffset + item.index;
  const autoOpen = resolveConversationBlockAutoOpen(block, item.index, messages.length, isStreaming, transcriptDisclosureMode);
  const showStreamingCursor = isStreaming && block.type === 'text' && item.index === messages.length - 1;

  const el = (() => {
    switch (block.type) {
      case 'user':
        return (
          <UserMessage
            block={block}
            messageIndex={absoluteIndex}
            onRewindMessage={onRewindMessage}
            onForkMessage={onForkMessage}
            onEditMessage={onEditUserMessage}
            onHydrateMessage={onHydrateMessage}
            hydratingMessageBlockIds={hydratingMessageBlockIds}
            onOpenFilePath={onOpenFilePath}
            validatedFilePathTargets={validatedFilePathTargets}
            onOpenCheckpoint={onOpenCheckpoint}
            onInspectImage={onInspectImage}
            isInlineRunExpanded={isInlineRunExpanded}
            onToggleInlineRun={onToggleInlineRun}
            layout={layout}
          />
        );
      case 'text':
        return (
          <AssistantMessage
            block={block}
            variationSet={item.arenaVariationSet}
            conversationId={conversationId ?? undefined}
            messageIndex={absoluteIndex}
            showCursor={showStreamingCursor}
            onRewindMessage={onRewindMessage}
            onForkMessage={onForkMessage}
            onOpenFilePath={onOpenFilePath}
            validatedFilePathTargets={validatedFilePathTargets}
            onOpenCheckpoint={onOpenCheckpoint}
            onSelectionGesture={onReplyToSelection ? onSelectionGesture : undefined}
            isInlineRunExpanded={isInlineRunExpanded}
            onToggleInlineRun={onToggleInlineRun}
            layout={layout}
          />
        );
      case 'context':
        if (isTopologyBlock(block)) {
          return <TopologyBlock block={block} />;
        }
        return (
          <SystemEventMessage
            block={block}
            messageIndex={absoluteIndex}
            onOpenFilePath={onOpenFilePath}
            validatedFilePathTargets={validatedFilePathTargets}
            onOpenCheckpoint={onOpenCheckpoint}
            onSelectionGesture={onReplyToSelection ? onSelectionGesture : undefined}
            isInlineRunExpanded={isInlineRunExpanded}
            onToggleInlineRun={onToggleInlineRun}
          />
        );
      case 'summary':
        return (
          <SummaryMessage
            block={block}
            messageIndex={absoluteIndex}
            onOpenFilePath={onOpenFilePath}
            validatedFilePathTargets={validatedFilePathTargets}
            onOpenCheckpoint={onOpenCheckpoint}
            onSelectionGesture={onReplyToSelection ? onSelectionGesture : undefined}
          />
        );
      case 'thinking':
        return <ThinkingBlock block={block} autoOpen={autoOpen} />;
      case 'tool_use':
        return (
          <ToolBlock
            block={block}
            autoOpen={autoOpen}
            onOpenArtifact={onOpenArtifact}
            activeArtifactId={activeArtifactId}
            onOpenCheckpoint={onOpenCheckpoint}
            activeCheckpointId={activeCheckpointId}
            onOpenBrowser={onOpenBrowser}
            onOpenFilePath={onOpenFilePath}
            validatedFilePathTargets={validatedFilePathTargets}
            onHydrateMessage={onHydrateMessage}
            hydratingMessageBlockIds={hydratingMessageBlockIds}
            messages={messages}
            messageIndex={item.index}
            onSubmitAskUserQuestion={onSubmitAskUserQuestion}
            askUserQuestionDisplayMode={askUserQuestionDisplayMode}
            diffDisclosureMode={diffDisclosureMode}
          />
        );
      case 'subagent':
        return <SubagentBlock block={block} />;
      case 'image':
        return (
          <ImageBlock
            block={block}
            onHydrateMessage={onHydrateMessage}
            hydratingMessageBlockIds={hydratingMessageBlockIds}
            onInspectImage={onInspectImage}
          />
        );
      case 'error':
        return (
          <ErrorBlock
            block={block}
            messageIndex={absoluteIndex}
            onOpenFilePath={onOpenFilePath}
            onSelectionGesture={onReplyToSelection ? onSelectionGesture : undefined}
          />
        );
      default:
        return null;
    }
  })();

  return el ? (
    <div
      id={`msg-${absoluteIndex}`}
      data-message-index={absoluteIndex}
      data-chat-tail={isTailItem ? '1' : undefined}
      style={contentVisibilityStyle}
    >
      {el}
    </div>
  ) : null;
}
