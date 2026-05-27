import { memo, type ReactNode, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parseSkillBlock } from '../../markdown/markdownExtensions';
import type { LiveSessionToolDefinition, MessageBlock } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { dispatchTranscriptSpotlight, transcriptTargetAttributes } from '../../transcript/spotlight.js';
import { cx } from '../ui.js';
import type { ChatViewLayout } from './chatViewTypes.js';
import { ImagePreview, type InspectableImage } from './ImageMessageBlocks.js';
import { InlineTraceRunCard } from './InlineTraceRunCard.js';
import { buildInlineRunExpansionKey } from './linkedRunPolling.js';
import { readMentionedLinkedRunsFromText } from './linkedRuns.js';
import { renderMarkdownText, renderStreamingMarkdownText, renderText, SkillInvocationCard } from './MarkdownMessage.js';
import { MessageActions } from './MessageActions.js';
import { buildReplySelectionScopeProps, type ReplySelectionGestureHandler } from './replySelection.js';
import { isTopologyBlock } from './transcriptItems.js';

function formatSystemEventLabel(customType?: string): string {
  switch (customType) {
    case 'goal-continuation':
      return 'Goal auto-resume';
    case 'system_prompt':
      return 'System prompt';
    case 'referenced_context':
      return 'Context added';
    case 'background_auto_resume':
      return 'Auto-resume';
    case 'deferred_auto_resume':
      return 'Scheduled wakeup';
    case 'after_turn_auto_resume':
      return 'After-turn wakeup';
    case 'remote_control':
      return 'Remote control';
    case 'browser-comments':
      return 'Browser comments';
    case 'conversation_workspace_change':
      return 'Workspace changed';
    case 'child_conversation_topology':
      return 'Branch';
    case 'parent_conversation_backlink':
      return 'Branched from';
    case 'parallel_result':
      return 'Parallel response imported';
    case 'conversation_automation_review':
    case 'conversation_automation_item':
    case 'conversation_automation_post_turn_review':
      return 'Automation event';
    default: {
      const normalized = customType?.replace(/[_-]+/g, ' ').trim();
      if (!normalized) {
        return 'Context added';
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }
}

const AUTO_RESUME_CONTEXT_TYPES = new Set([
  'goal-continuation',
  'background_auto_resume',
  'deferred_auto_resume',
  'after_turn_auto_resume',
]);

const QUIET_LIFECYCLE_CONTEXT_TYPES = new Set([...AUTO_RESUME_CONTEXT_TYPES, 'conversation_workspace_change']);

function isAutoResumeLifecycleContext(block: Extract<MessageBlock, { type: 'context' | 'summary' }>): boolean {
  return block.type === 'context' && AUTO_RESUME_CONTEXT_TYPES.has(block.customType ?? '');
}

function isQuietLifecycleContext(block: Extract<MessageBlock, { type: 'context' | 'summary' }>): boolean {
  return block.type === 'context' && QUIET_LIFECYCLE_CONTEXT_TYPES.has(block.customType ?? '');
}

function autoResumeLifecycleText(blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[]): string {
  const goalCount = blocks.filter((block) => block.type === 'context' && block.customType === 'goal-continuation').length;
  const backgroundCount = blocks.filter((block) => block.type === 'context' && block.customType === 'background_auto_resume').length;
  const deferredCount = blocks.filter((block) => block.type === 'context' && block.customType === 'deferred_auto_resume').length;
  const afterTurnCount = blocks.filter((block) => block.type === 'context' && block.customType === 'after_turn_auto_resume').length;

  const total = goalCount + backgroundCount + deferredCount + afterTurnCount;

  if (total > 1) {
    if (goalCount > 0 && backgroundCount === 0 && deferredCount === 0 && afterTurnCount === 0) {
      return `Goal resumed automatically · ${total} times`;
    }
    return `Resumed automatically · ${total} events`;
  }

  if (goalCount === 1) return 'Goal resumed automatically';
  if (backgroundCount === 1) return 'Background task completed · resumed automatically';
  if (deferredCount === 1) return 'Scheduled wakeup fired';
  if (afterTurnCount === 1) return 'After-turn wakeup fired';
  return 'Resumed automatically';
}

function quietLifecycleText(blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[]): string {
  const workspaceCount = blocks.filter((block) => block.type === 'context' && block.customType === 'conversation_workspace_change').length;
  if (workspaceCount > 0 && workspaceCount === blocks.length) {
    return workspaceCount === 1 ? 'Workspace changed' : `Workspace changed · ${workspaceCount} times`;
  }
  return autoResumeLifecycleText(blocks);
}

function quietLifecycleTooltip(blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[]): string | undefined {
  if (!blocks.every((block) => block.type === 'context' && block.customType === 'conversation_workspace_change')) {
    return undefined;
  }

  const details = blocks
    .map((block) => (block.type === 'context' ? block.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n');
  return details || undefined;
}

function QuietLifecycleMarker({ blocks, marker }: { blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[]; marker: string }) {
  const lastTs = blocks[blocks.length - 1]?.ts;
  const tooltip = quietLifecycleTooltip(blocks);
  const backgroundRun = blocks
    .filter((block) => block.type === 'context' && block.customType === 'background_auto_resume')
    .flatMap((block) => readMentionedLinkedRunsFromText(block.text))
    .at(0);
  const content = (
    <>
      <span aria-hidden="true">↻</span>
      <span className="min-w-0 truncate">{quietLifecycleText(blocks)}</span>
      {lastTs ? <span className="ui-message-meta shrink-0 opacity-60">{timeAgo(lastTs)}</span> : null}
    </>
  );

  if (backgroundRun) {
    return (
      <button
        type="button"
        className="flex w-[78%] items-center gap-2 px-2 py-0.5 text-left text-[11px] text-dim/75 transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/25 focus-visible:ring-offset-1 focus-visible:ring-offset-base"
        data-context-shelf="1"
        data-lifecycle-marker={marker}
        title={tooltip ?? backgroundRun.runId}
        aria-label={`${quietLifecycleText(blocks)}: ${tooltip ?? backgroundRun.runId}`}
        onClick={() => dispatchTranscriptSpotlight({ kind: 'background_run', runId: backgroundRun.runId })}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className="flex w-[78%] items-center gap-2 px-2 py-0.5 text-[11px] text-dim/75"
      data-context-shelf="1"
      data-lifecycle-marker={marker}
      title={tooltip}
      aria-label={tooltip ? `${quietLifecycleText(blocks)}: ${tooltip}` : quietLifecycleText(blocks)}
    >
      {content}
    </div>
  );
}

function summarizeSystemEventText(text: string): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!normalized) {
    return 'Details available';
  }

  return normalized.length > 140 ? `${normalized.slice(0, 137).trimEnd()}…` : normalized;
}

function contextShelfLabel(block: Extract<MessageBlock, { type: 'context' | 'summary' }>): string {
  if (block.type === 'summary') {
    switch (block.kind) {
      case 'compaction':
        return resolveCompactionSummaryLabel(block.title);
      case 'related':
        return block.title || 'Related conversations';
      default:
        return block.title || 'Branch summary';
    }
  }
  return formatSystemEventLabel(block.customType);
}

function contextShelfPreview(block: Extract<MessageBlock, { type: 'context' | 'summary' }>): string {
  if (block.type === 'summary') {
    if (block.kind === 'compaction') {
      return resolveCompactionSummaryDetail(block.title, block.detail);
    }
    return block.detail?.trim() || summarizeSystemEventText(block.text);
  }
  return summarizeSystemEventText(block.text);
}

function normalizeContextChipLabel(label: string): string {
  switch (label) {
    case 'System prompt':
      return 'system prompt';
    case 'Remote control':
      return 'remote control';
    case 'Related conversation pointers':
    case 'Reused thread summaries':
      return 'related conversations';
    case 'Context added':
      return 'context';
    case 'Auto-resume':
      return 'auto-resume';
    default:
      return label.toLowerCase();
  }
}

function LazyDetails({
  className,
  dataAttrs = {},
  summary,
  children,
}: {
  className: string;
  dataAttrs?: Record<string, string | undefined>;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [openedOnce, setOpenedOnce] = useState(false);

  return (
    <details
      className={className}
      {...dataAttrs}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setOpenedOnce(true);
        }
      }}
    >
      {summary}
      {openedOnce ? children : null}
    </details>
  );
}

export const ContextShelf = memo(function ContextShelf({
  blocks,
  messageIndexOffset,
  currentConversationId,
  systemPrompt,
  toolDefinitions = [],
  remoteControlled = false,
  onOpenFilePath,
  onOpenCheckpoint,
  onSelectionGesture,
}: {
  blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[];
  messageIndexOffset?: number;
  currentConversationId?: string | null;
  systemPrompt?: string | null;
  toolDefinitions?: LiveSessionToolDefinition[];
  remoteControlled?: boolean;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
}) {
  const normalizedSystemPrompt = systemPrompt?.trim() ?? '';
  const hasSystemPrompt = normalizedSystemPrompt.length > 0 || toolDefinitions.length > 0;
  const counts = new Map<string, number>();
  if (hasSystemPrompt) {
    counts.set('System prompt', 1);
  }
  if (remoteControlled) {
    counts.set('Remote control', 1);
  }
  const nonTopologyBlocks = blocks.filter((b) => !isTopologyBlock(b));
  for (const block of nonTopologyBlocks) {
    const label = contextShelfLabel(block);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const preview = [...counts.entries()]
    .map(([label, count]) => {
      const normalizedLabel = normalizeContextChipLabel(label);
      return count > 1 ? `${normalizedLabel} ×${count}` : normalizedLabel;
    })
    .join(' · ');
  const totalItemCount = nonTopologyBlocks.length + (hasSystemPrompt ? 1 : 0) + (remoteControlled ? 1 : 0);

  if (!hasSystemPrompt && !remoteControlled && blocks.length > 0 && blocks.every(isQuietLifecycleContext)) {
    const marker = blocks.every(isAutoResumeLifecycleContext) ? 'auto-resume' : 'workspace-change';
    return <QuietLifecycleMarker blocks={blocks} marker={marker} />;
  }

  const shouldRenderTopologyBlock = (block: Extract<MessageBlock, { type: 'context' | 'summary' }>): boolean => {
    if (!isTopologyBlock(block)) return false;
    if (block.customType !== 'child_conversation_topology' || !currentConversationId) return true;
    return parseTopologyBlockText(block.text).conversationId !== currentConversationId;
  };
  const topologyBlocks = blocks.filter((b) => {
    if (!isTopologyBlock(b)) return false;
    return shouldRenderTopologyBlock(b);
  });

  return (
    <div data-context-shelf-wrapper="1">
      {topologyBlocks.map((block) => (
        <div key={block.id ?? `topology-${block.ts}`} className="w-[78%] px-2 py-0.5">
          <TopologyBlock block={block as Extract<MessageBlock, { type: 'context' }>} />
        </div>
      ))}
      <details className="group my-5 block w-full text-dim" data-context-shelf="1">
        <summary className="grid w-full cursor-pointer grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary [&::-webkit-details-marker]:hidden">
          <span className="h-px bg-border-subtle" aria-hidden="true" />
          <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 text-dim/85 sm:max-w-[42rem]">
            <span className="text-dim/70 transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
            <span aria-hidden="true">▣</span>
            <span className="shrink-0">Context</span>
            <span className="shrink-0">
              · {totalItemCount} item{totalItemCount === 1 ? '' : 's'}
            </span>
            {preview ? <span className="min-w-0 truncate text-dim/70">· {preview}</span> : null}
            <span className="shrink-0 text-dim/55">· click to expand</span>
            {blocks[blocks.length - 1]?.ts ? (
              <span className="ui-message-meta shrink-0 opacity-70">{timeAgo(blocks[blocks.length - 1].ts)}</span>
            ) : null}
          </span>
          <span className="h-px bg-border-subtle" aria-hidden="true" />
        </summary>
        <div className="mx-auto mt-3 w-[78%] space-y-1.5">
          {hasSystemPrompt ? (
            <LazyDetails
              className="rounded-md px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-surface/15 open:bg-surface/20"
              dataAttrs={{ 'data-context-type': 'system_prompt' }}
              summary={
                <summary className="flex cursor-pointer list-none items-center gap-2 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="min-w-36 shrink-0 font-medium text-primary/80">System prompt</span>
                  <span className="min-w-0 flex-1 truncate text-dim/90">
                    {toolDefinitions.length > 0
                      ? `Runtime instructions and ${toolDefinitions.length} tool definitions available for inspection.`
                      : 'Runtime instructions available for inspection.'}
                  </span>
                </summary>
              }
            >
              <div className="space-y-4 pt-2 pl-2 text-[12px] leading-relaxed text-primary/90">
                {normalizedSystemPrompt ? <div>{renderText(normalizedSystemPrompt)}</div> : null}
                {toolDefinitions.length > 0 ? (
                  <div>
                    <div className="mb-2 font-medium text-primary">Available tool definitions</div>
                    {renderText(formatToolDefinitions(toolDefinitions))}
                  </div>
                ) : null}
              </div>
            </LazyDetails>
          ) : null}
          {remoteControlled ? (
            <details
              className="rounded-md px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-surface/15 open:bg-surface/20"
              data-context-type="remote_control"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="min-w-36 shrink-0 font-medium text-primary/80">Remote control</span>
                <span className="min-w-0 flex-1 truncate text-dim/90">Controlled remotely from Kitty Litter.</span>
              </summary>
              <div className="pt-2 pl-2 text-[12px] leading-relaxed text-primary/90">Controlled remotely from Kitty Litter.</div>
            </details>
          ) : null}
          {blocks.map((block, index) => {
            const blockId = block.id?.trim() || undefined;
            const replySelectionScopeProps = buildReplySelectionScopeProps(
              typeof messageIndexOffset === 'number' ? messageIndexOffset + index : undefined,
              blockId,
              onSelectionGesture,
            );

            // Topology blocks (parent backlinks, child tombstones) have navigable links;
            // render them inline with proper navigation instead of as collapsed details.
            if (isTopologyBlock(block)) {
              if (!shouldRenderTopologyBlock(block)) return null;
              return (
                <div key={block.id ?? index} className="px-2 py-0.5">
                  <TopologyBlock block={block} />
                </div>
              );
            }

            return (
              <LazyDetails
                key={block.id ?? index}
                className="rounded-md px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-surface/15 open:bg-surface/20"
                dataAttrs={{
                  'data-context-type': block.type === 'context' ? (block.customType ?? 'injected_context') : `summary:${block.kind}`,
                  'data-summary-kind': block.type === 'summary' ? block.kind : undefined,
                }}
                summary={
                  <summary className="flex cursor-pointer list-none items-center gap-2 marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="min-w-36 shrink-0 font-medium text-primary/80">{contextShelfLabel(block)}</span>
                    <span className="min-w-0 flex-1 truncate text-dim/90">{contextShelfPreview(block)}</span>
                    {block.ts ? <span className="ui-message-meta shrink-0">{timeAgo(block.ts)}</span> : null}
                  </summary>
                }
              >
                <div {...replySelectionScopeProps} className="pt-2 pl-2 text-[12px] leading-relaxed text-primary/90">
                  {block.type === 'summary' && block.kind === 'compaction' ? (
                    <p className="mb-2 text-[12px] leading-relaxed text-secondary">
                      {resolveCompactionSummaryDetail(block.title, block.detail)}
                    </p>
                  ) : null}
                  {renderText(block.text, { onOpenFilePath, onOpenCheckpoint })}
                </div>
              </LazyDetails>
            );
          })}
        </div>
      </details>
    </div>
  );
});

// ── UserMessage ───────────────────────────────────────────────────────────────

export const UserMessage = memo(function UserMessage({
  block,
  messageIndex,
  onRewindMessage,
  onForkMessage,
  onEditMessage,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onOpenFilePath,
  onOpenCheckpoint,
  onInspectImage,
  isInlineRunExpanded,
  onToggleInlineRun,
  layout = 'default',
}: {
  block: Extract<MessageBlock, { type: 'user' }>;
  messageIndex?: number;
  onRewindMessage?: (messageIndex: number) => Promise<void> | void;
  onForkMessage?: (messageIndex: number) => Promise<void> | void;
  onEditMessage?: (messageIndex: number, text: string) => Promise<void> | void;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onInspectImage?: (image: InspectableImage) => void;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
  layout?: ChatViewLayout;
}) {
  const hasText = block.text.trim().length > 0;
  const imageCount = block.images?.length ?? 0;
  const hasImages = imageCount > 0;
  const skillBlock = hasText ? parseSkillBlock(block.text) : null;
  const handleRewind = useCallback(() => {
    if (typeof messageIndex !== 'number') {
      return;
    }

    return onRewindMessage?.(messageIndex);
  }, [messageIndex, onRewindMessage]);
  const handleFork = useCallback(() => {
    if (typeof messageIndex !== 'number') {
      return;
    }

    return onForkMessage?.(messageIndex);
  }, [messageIndex, onForkMessage]);
  const canAddressMessage = typeof messageIndex === 'number';
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(block.text);
  const [editSaving, setEditSaving] = useState(false);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;
  const beginEdit = useCallback(() => {
    setEditDraft(block.text);
    setEditing(true);
  }, [block.text]);
  const cancelEdit = useCallback(() => {
    setEditDraft(block.text);
    setEditing(false);
  }, [block.text]);
  const saveEdit = useCallback(async () => {
    if (!onEditMessage || typeof messageIndex !== 'number' || editSaving) {
      return;
    }

    const nextText = editDraft.trim();
    if (!nextText) {
      return;
    }

    setEditSaving(true);
    try {
      await onEditMessage(messageIndex, nextText);
    } finally {
      setEditSaving(false);
    }
  }, [editDraft, editSaving, messageIndex, onEditMessage]);

  const transcriptTargetAttrs = block.id ? transcriptTargetAttributes({ kind: 'block', blockId: block.id }) : {};

  return (
    <div className="group flex w-full flex-col items-end gap-1.5" {...transcriptTargetAttrs} tabIndex={block.id ? -1 : undefined}>
      <div className={layout === 'compact' ? 'ml-auto min-w-0 max-w-[92%] sm:max-w-[88%]' : 'ml-auto min-w-0 max-w-[86%]'}>
        <div className="ui-message-card-user space-y-2">
          {hasImages && (
            <div className="space-y-2">
              {block.images?.map((image, index) => {
                const blockId = block.id?.trim();
                const loading = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
                const canHydrate = Boolean(image.deferred && blockId && onHydrateMessage);

                return (
                  <ImagePreview
                    key={`${image.caption ?? image.alt}-${index}`}
                    alt={image.alt}
                    src={image.src}
                    caption={image.caption}
                    width={image.width}
                    height={image.height}
                    maxHeight={280}
                    deferred={image.deferred}
                    loading={loading}
                    onLoad={canHydrate ? () => onHydrateMessage?.(blockId as string) : undefined}
                    onInspect={onInspectImage}
                  />
                );
              })}
            </div>
          )}
          {editing ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEdit();
              }}
            >
              <textarea
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                disabled={editSaving}
                autoFocus
                className="min-h-[96px] w-full resize-y rounded-xl border border-border-subtle bg-base/60 px-3 py-2 text-sm leading-relaxed text-primary outline-none focus:border-accent/50"
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="ui-message-action-button" onClick={cancelEdit} disabled={editSaving}>
                  cancel
                </button>
                <button type="submit" className="ui-message-action-button text-accent" disabled={editSaving || !editDraft.trim()}>
                  {editSaving ? 'rerunning…' : 'rerun'}
                </button>
              </div>
            </form>
          ) : showRawRunCallbackCard ? (
            <div className="px-1.5 pb-0.5">
              <RawRunCallbackCard
                runs={rawRunCallbackRuns}
                messageIndex={messageIndex}
                isInlineRunExpanded={isInlineRunExpanded}
                onToggleInlineRun={onToggleInlineRun}
              />
            </div>
          ) : skillBlock ? (
            <div className="space-y-2 px-1.5 pb-0.5">
              <SkillInvocationCard skillBlock={skillBlock} className="ui-skill-invocation-user" onOpenFilePath={onOpenFilePath} />
              {skillBlock.userMessage && renderMarkdownText(skillBlock.userMessage, { onOpenFilePath, onOpenCheckpoint })}
            </div>
          ) : hasText ? (
            <div className="px-1.5 pb-0.5">{renderMarkdownText(block.text, { onOpenFilePath, onOpenCheckpoint })}</div>
          ) : hasImages ? (
            <div className="px-1.5 pb-0.5 text-sm text-secondary">
              {imageCount === 1 ? 'Image attachment' : `${imageCount} image attachments`}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 pr-1">
          <p className="ui-message-meta">{timeAgo(block.ts)}</p>
          <span className="flex-1" />
          <MessageActions
            isUser
            blockText={block.text}
            blockId={block.id}
            copyText={block.text}
            onRewind={!editing && onRewindMessage && canAddressMessage ? handleRewind : undefined}
            onFork={!editing && onForkMessage && canAddressMessage ? handleFork : undefined}
            onEdit={!editing && onEditMessage && canAddressMessage ? beginEdit : undefined}
          />
        </div>
      </div>
    </div>
  );
});

// ── AssistantMessage ──────────────────────────────────────────────────────────

export const AssistantMessage = memo(function AssistantMessage({
  block,
  messageIndex,
  onForkMessage,
  onRewindMessage,
  onOpenFilePath,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun,
  layout = 'default',
  showCursor = false,
}: {
  block: Extract<MessageBlock, { type: 'text' }>;
  messageIndex?: number;
  onForkMessage?: (messageIndex: number) => Promise<void> | void;
  onRewindMessage?: (messageIndex: number) => Promise<void> | void;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
  layout?: ChatViewLayout;
  showCursor?: boolean;
}) {
  const shouldShowCursor = showCursor || !!block.streaming;
  const blockId = block.id?.trim() || undefined;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const handleRewind = useCallback(() => {
    if (typeof messageIndex !== 'number') {
      return;
    }

    return onRewindMessage?.(messageIndex);
  }, [messageIndex, onRewindMessage]);
  const handleFork = useCallback(() => {
    if (typeof messageIndex !== 'number') {
      return;
    }

    return onForkMessage?.(messageIndex);
  }, [messageIndex, onForkMessage]);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;
  const renderStreamingPlainText = shouldShowCursor && !showRawRunCallbackCard;

  const transcriptTargetAttrs = blockId ? transcriptTargetAttributes({ kind: 'block', blockId }) : {};

  return (
    <div
      className={cx('group flex items-start', layout === 'compact' ? 'gap-2.5 pr-3 sm:pr-6' : 'gap-3 pr-8 sm:pr-14')}
      {...transcriptTargetAttrs}
      tabIndex={blockId ? -1 : undefined}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div {...replySelectionScopeProps} className="ui-message-card-assistant space-y-1 text-primary">
          {showRawRunCallbackCard ? (
            <RawRunCallbackCard
              runs={rawRunCallbackRuns}
              messageIndex={messageIndex}
              isInlineRunExpanded={isInlineRunExpanded}
              onToggleInlineRun={onToggleInlineRun}
            />
          ) : renderStreamingPlainText ? (
            renderStreamingMarkdownText(block.text, { onOpenFilePath, onOpenCheckpoint })
          ) : (
            renderText(block.text, { onOpenFilePath, onOpenCheckpoint })
          )}
          {shouldShowCursor && (
            <span
              className="inline-block w-[2px] h-[14px] bg-accent ml-0.5 rounded-sm"
              style={{ animation: 'cursorBlink 1s step-end infinite', verticalAlign: 'text-bottom' }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <p className="ui-message-meta">{timeAgo(block.ts)}</p>
          <span className="flex-1" />
          <MessageActions
            blockText={block.text}
            blockId={blockId}
            copyText={block.text}
            onRewind={onRewindMessage && typeof messageIndex === 'number' ? handleRewind : undefined}
            onFork={onForkMessage && typeof messageIndex === 'number' ? handleFork : undefined}
          />
        </div>
      </div>
    </div>
  );
});

function readRawRunCallbackLinkedRuns(text: string) {
  if (!looksLikeRawRunCallback(text)) {
    return [];
  }

  const mentionedRuns = readMentionedLinkedRunsFromText(text);
  if (mentionedRuns.length > 0) {
    return mentionedRuns;
  }

  const directRunId = text.match(/\b(?:Durable run|Background task)\s+([^\s]+)\s+has finished\./)?.[1]?.trim();
  return directRunId ? readMentionedLinkedRunsFromText(`runId=${directRunId}`) : [];
}

function looksLikeRawRunCallback(text: string): boolean {
  return (
    /\b(?:Durable run|Background task)\s+\S+\s+has finished\./.test(text.trim()) &&
    /\btaskSlug=/.test(text) &&
    /\bstatus=/.test(text) &&
    /\blog=/.test(text) &&
    /Recent log tail:/.test(text)
  );
}

function RawRunCallbackCard({
  runs,
  messageIndex,
  isInlineRunExpanded,
  onToggleInlineRun,
}: {
  runs: ReturnType<typeof readMentionedLinkedRunsFromText>;
  messageIndex?: number;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-secondary">
        <span className="font-medium text-primary">Background work finished.</span>
        <span>Open the run card for logs and metadata.</span>
      </div>
      <div className="space-y-1.5">
        {runs.map((run) => {
          const inlineRunKey = buildInlineRunExpansionKey(messageIndex ?? 0, run.runId);
          return (
            <InlineTraceRunCard
              key={run.runId}
              run={run}
              expanded={isInlineRunExpanded?.(inlineRunKey) ?? false}
              onToggle={() => onToggleInlineRun?.(inlineRunKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SystemEventFrame({
  label,
  preview,
  ts,
  dataAttributes,
  children,
}: {
  label: string;
  preview: string;
  ts?: string;
  dataAttributes: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-lg border border-transparent px-2 py-1 text-dim transition-colors hover:border-border-subtle/40 hover:bg-surface/15 open:border-border-subtle/50 open:bg-surface/20"
      {...dataAttributes}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] marker:hidden hover:text-secondary [&::-webkit-details-marker]:hidden">
        <span className="text-dim/70 transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        <span className="shrink-0 font-medium text-secondary/80">{label}</span>
        <span className="min-w-0 flex-1 truncate text-dim/80">{preview}</span>
        {ts ? <span className="ui-message-meta shrink-0 opacity-70">{timeAgo(ts)}</span> : null}
      </summary>
      {children}
    </details>
  );
}

function formatToolDefinitions(tools: LiveSessionToolDefinition[]): string {
  if (tools.length === 0) {
    return '';
  }

  return tools
    .map((tool) => {
      const parameters = JSON.stringify(tool.parameters, null, 2);
      return [`### ${tool.name}`, tool.description.trim(), '```json', parameters, '```'].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

export const SystemPromptMessage = memo(function SystemPromptMessage({
  text,
  toolDefinitions = [],
}: {
  text: string;
  toolDefinitions?: LiveSessionToolDefinition[];
}) {
  const normalizedText = text.trim();
  const toolDefinitionsText = formatToolDefinitions(toolDefinitions);
  if (!normalizedText && !toolDefinitionsText) {
    return null;
  }
  return (
    <SystemEventFrame
      label="System prompt"
      preview={
        toolDefinitions.length > 0
          ? `Runtime instructions and ${toolDefinitions.length} tool definitions available for inspection.`
          : 'Runtime instructions available for inspection.'
      }
      dataAttributes={{ 'data-context-type': 'system_prompt' }}
    >
      <div className="space-y-4 pt-2 pl-5 text-[13px] leading-relaxed text-primary/90">
        {normalizedText ? <div>{renderText(normalizedText)}</div> : null}
        {toolDefinitionsText ? (
          <div>
            <div className="mb-2 font-medium text-primary">Available tool definitions</div>
            {renderText(toolDefinitionsText)}
          </div>
        ) : null}
      </div>
    </SystemEventFrame>
  );
});

export const SystemEventMessage = memo(function SystemEventMessage({
  block,
  messageIndex,
  onOpenFilePath,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun,
}: {
  block: Extract<MessageBlock, { type: 'context' }>;
  messageIndex?: number;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
}) {
  const label = formatSystemEventLabel(block.customType);
  const blockId = block.id?.trim() || undefined;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(block.text), [block.text]);
  const showRawRunCallbackCard = rawRunCallbackRuns.length > 0;

  const preview = summarizeSystemEventText(block.text);

  return (
    <SystemEventFrame
      label={label}
      preview={preview}
      ts={block.ts}
      dataAttributes={{ 'data-context-type': block.customType ?? 'injected_context' }}
    >
      <div {...replySelectionScopeProps} className="pt-2 pl-5 text-[13px] leading-relaxed text-primary/90">
        {showRawRunCallbackCard ? (
          <RawRunCallbackCard
            runs={rawRunCallbackRuns}
            messageIndex={messageIndex}
            isInlineRunExpanded={isInlineRunExpanded}
            onToggleInlineRun={onToggleInlineRun}
          />
        ) : (
          renderText(block.text, { onOpenFilePath, onOpenCheckpoint })
        )}
      </div>
    </SystemEventFrame>
  );
});

export function resolveCompactionSummaryLabel(title: string | undefined): string {
  const normalized = title?.trim();
  if (!normalized || normalized === 'Compaction summary') {
    return 'Context compacted';
  }

  return normalized;
}

function resolveCompactionMarkerLabel(title: string | undefined): string {
  return title?.trim() === 'Manual compaction' ? 'Context manually compacted' : 'Context automatically compacted';
}

export function resolveCompactionSummaryDetail(title: string | undefined, extraDetail?: string): string {
  const baseDetail = (() => {
    switch (title?.trim()) {
      case 'Manual compaction':
        return 'You explicitly summarized older turns to shrink the active context window.';
      case 'Proactive compaction':
        return 'Older turns were summarized because the context window was getting full. The conversation is ready for the next turn.';
      case 'Overflow recovery compaction':
        return 'Older turns were summarized after a context overflow so the interrupted turn could retry automatically.';
      default:
        return 'Older turns were summarized to keep the active context window focused.';
    }
  })();

  const normalizedExtraDetail = extraDetail?.trim();
  return normalizedExtraDetail ? `${baseDetail} ${normalizedExtraDetail}` : baseDetail;
}

function parseTopologyBlockKind(firstLine: string): string {
  // "Fork conversation created: ..." → "Fork"
  // "Rewind conversation from parent: ..." → "Rewind"
  const match = firstLine.match(/^(\w+)\s+conversation\s/);
  return match?.[1]?.toLowerCase() ?? 'fork';
}

function parseTopologyBlockText(text: string): {
  title: string;
  conversationId: string | null;
  kind: string;
  sourceMessageId: string | null;
  sourcePreview: string | null;
} {
  const lines = text.split('\n');
  const firstLine = lines[0] ?? '';
  // "Fork conversation created: <title>" → extract title after the colon
  const titleMatch = firstLine.match(/^[^:]+:\s*(.+)$/);
  const title = titleMatch?.[1]?.trim() || firstLine.trim();

  const openLine = lines.find((l) => l.startsWith('Open: /conversations/') || l.startsWith('Open parent: /conversations/'));
  const sourceLine = lines.find((l) => l.startsWith('Source message: '));
  const sourcePreviewLine = lines.find((l) => l.startsWith('Source preview: '));
  const conversationId = openLine?.replace(/^Open(?: parent)?: \/conversations\//, '').trim() || null;
  const sourceMessageId = sourceLine?.replace(/^Source message:\s*/, '').trim() || null;
  const sourcePreview = sourcePreviewLine?.replace(/^Source preview:\s*/, '').trim() || null;
  return { title, conversationId, kind: parseTopologyBlockKind(firstLine), sourceMessageId, sourcePreview };
}

export const TopologyBlock = memo(function TopologyBlock({ block }: { block: Extract<MessageBlock, { type: 'context' }> }) {
  const navigate = useNavigate();
  const isChildTopology = block.customType === 'child_conversation_topology';
  const { title, conversationId, kind, sourceMessageId, sourcePreview } = useMemo(() => parseTopologyBlockText(block.text), [block.text]);

  const handleClick = useCallback(() => {
    if (conversationId) {
      navigate(`/conversations/${encodeURIComponent(conversationId)}`);
    }
  }, [conversationId, navigate]);

  const label = (() => {
    if (kind === 'rewind') return isChildTopology ? 'Rewound to' : '← Rewound from';
    if (kind === 'duplicate') return isChildTopology ? 'Duplicated to' : '← Duplicated from';
    return isChildTopology ? 'Forked to' : '← Forked from';
  })();

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-dim/70" data-topology-kind={block.customType}>
      <span className="shrink-0">{label}</span>
      {conversationId ? (
        <button
          type="button"
          onClick={handleClick}
          className="truncate text-accent/80 hover:text-accent hover:underline focus-visible:outline-none"
          title={sourceMessageId ? `Source: ${sourcePreview ?? sourceMessageId}` : undefined}
        >
          {title}
        </button>
      ) : (
        <span className="truncate">{title}</span>
      )}
    </div>
  );
});

export const SummaryMessage = memo(function SummaryMessage({
  block,
  messageIndex,
  onOpenFilePath,
  onOpenCheckpoint,
  onSelectionGesture,
}: {
  block: Extract<MessageBlock, { type: 'summary' }>;
  messageIndex?: number;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
}) {
  const summaryPresentation = (() => {
    switch (block.kind) {
      case 'compaction':
        return {
          label: resolveCompactionSummaryLabel(block.title),
          detail: resolveCompactionSummaryDetail(block.title, block.detail),
        };
      case 'related':
        return {
          label: block.title || 'Reused thread summaries',
          detail:
            block.detail?.trim() ||
            'Selected conversations were summarized and injected before this prompt so this thread could start with reused context.',
        };
      default:
        return {
          label: block.title || 'Branch summary',
          detail: block.detail?.trim() || 'Context from another branch was summarized while preserving the current path.',
        };
    }
  })();
  const blockId = block.id?.trim() || undefined;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);

  if (block.kind === 'compaction') {
    const markerLabel = resolveCompactionMarkerLabel(block.title);
    return (
      <LazyDetails
        className="group my-5 block w-full text-dim"
        dataAttrs={{ 'data-summary-kind': block.kind, 'data-compaction-marker': '1' }}
        summary={
          <summary className="grid w-full cursor-pointer grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary [&::-webkit-details-marker]:hidden">
            <span className="h-px bg-border-subtle" aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-dim/85">
              <span className="text-dim/70 transition-transform group-open:rotate-90" aria-hidden="true">
                ›
              </span>
              <span aria-hidden="true">▣</span>
              <span>{markerLabel}</span>
            </span>
            <span className="h-px bg-border-subtle" aria-hidden="true" />
          </summary>
        }
      >
        <div {...replySelectionScopeProps} className="mx-auto mt-3 w-[78%] space-y-3 text-[13px] leading-relaxed text-primary/90">
          <p className="text-[12px] leading-relaxed text-secondary">{summaryPresentation.detail}</p>
          {renderText(block.text, { onOpenFilePath, onOpenCheckpoint })}
        </div>
      </LazyDetails>
    );
  }

  return (
    <SystemEventFrame
      label={summaryPresentation.label}
      preview={summaryPresentation.detail}
      ts={block.ts}
      dataAttributes={{ 'data-summary-kind': block.kind }}
    >
      <div {...replySelectionScopeProps} className="space-y-3 pt-2 pl-5 text-[13px] leading-relaxed text-primary/90">
        {block.kind === 'compaction' ? <p className="text-[12px] leading-relaxed text-secondary">{summaryPresentation.detail}</p> : null}
        {renderText(block.text, { onOpenFilePath, onOpenCheckpoint })}
      </div>
    </SystemEventFrame>
  );
});
