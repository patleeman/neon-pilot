import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MessageBlock } from '../../shared/types';
import { getStreamingThroughputLabel } from '../../transcript/streamingThroughput';
import { Button, MetaLabel, Notice, Pill, RowButton, SectionLabel, SurfacePanel, TextButton } from '../ui';
import type { ChatViewLayout } from './chatViewTypes.js';
import { readLinkedRuns } from './linkedRuns.js';
import { ContextShelf } from './MessageBlocks.js';
import { buildReplySelectionScopeProps, type ReplySelectionGestureHandler } from './replySelection.js';
import {
  registerSubagentBlockToggleCapability,
  SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT,
  type SubagentBlockCommandDetail,
} from './subagentBlockCommands.js';
import { buildSummaryPreview } from './summaryPreview.js';
import {
  registerThinkingBlockToggleCapability,
  THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT,
  type ThinkingBlockCommandDetail,
} from './thinkingBlockCommands.js';
import { ToolBlock } from './ToolBlock.js';
import {
  type ConversationDiffDisclosureMode,
  type ConversationTranscriptDisclosureMode,
  type DisclosurePreference,
  resolveConversationBlockAutoOpen,
  resolveDisclosureOpen,
  shouldAutoOpenTraceCluster,
  toggleDisclosurePreference,
  toolMeta,
} from './toolPresentation.js';
import {
  registerTraceClusterOverflowToggleCapability,
  registerTraceClusterToggleCapability,
  TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT,
  TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT,
  type TraceClusterCommandDetail,
} from './traceClusterCommands.js';
import type { TraceClusterSummary, TraceClusterSummaryCategory, TraceConversationBlock } from './transcriptItems.js';

export const ThinkingBlock = memo(function ThinkingBlock({
  block,
  autoOpen,
  live,
}: {
  block: Extract<MessageBlock, { type: 'thinking' }>;
  autoOpen: boolean;
  live?: boolean;
}) {
  const [preference, setPreference] = useState<DisclosurePreference>('auto');
  const open = resolveDisclosureOpen(autoOpen, preference);
  const preview = useMemo(() => buildSummaryPreview(block.text, 1), [block.text]);
  const toggleThinkingBlock = useCallback(() => {
    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  }, [autoOpen]);

  useEffect(() => registerThinkingBlockToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstThinkingBlock(event: Event) {
      const detail = (event as CustomEvent<ThinkingBlockCommandDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleThinkingBlock();
    }

    window.addEventListener(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstThinkingBlock);
    return () => window.removeEventListener(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstThinkingBlock);
  }, [toggleThinkingBlock]);

  return (
    <SurfacePanel muted className="overflow-hidden border-transparent bg-elevated/35 text-[12px]">
      <RowButton onClick={toggleThinkingBlock} className="px-2.5 py-2">
        <Pill tone="muted">Thinking</Pill>
        {!open && preview ? <span className="min-w-0 flex-1 truncate text-secondary italic">{preview}</span> : <span className="flex-1" />}
        {live && <MetaLabel tone="muted">live</MetaLabel>}
        <span className="text-dim text-[10px]">{open ? 'hide' : 'show'}</span>
      </RowButton>
      {open && (
        <div className="border-t border-border-subtle/70 px-2.5 pb-2.5 pt-1.5 text-secondary italic leading-relaxed space-y-1">
          {block.text.split('\n').map((l, i) => (
            <p key={i} className="text-[12px]">
              {l || <br />}
            </p>
          ))}
        </div>
      )}
    </SurfacePanel>
  );
});

// ── SubagentBlock ─────────────────────────────────────────────────────────────

export const SubagentBlock = memo(function SubagentBlock({ block }: { block: Extract<MessageBlock, { type: 'subagent' }> }) {
  const [open, setOpen] = useState(false);
  const toggleSubagentBlock = useCallback(() => {
    setOpen((current) => !current);
  }, []);
  const colorClassName = {
    running: 'text-steel',
    complete: 'text-success',
    failed: 'text-danger',
  }[block.status];
  const tone = { running: 'steel', complete: 'success', failed: 'danger' }[block.status] as 'steel' | 'success' | 'danger';

  useEffect(() => registerSubagentBlockToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstSubagentBlock(event: Event) {
      const detail = (event as CustomEvent<SubagentBlockCommandDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleSubagentBlock();
    }

    window.addEventListener(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstSubagentBlock);
    return () => window.removeEventListener(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstSubagentBlock);
  }, [toggleSubagentBlock]);

  return (
    <SurfacePanel muted className={`overflow-hidden text-[12px] ${colorClassName}`}>
      <RowButton onClick={toggleSubagentBlock} className="px-2.5 py-2">
        <Pill tone={tone} mono>
          subagent
        </Pill>
        <span className="flex-1 truncate opacity-70 font-normal">{block.name}</span>
        <Pill tone={tone}>{block.status}</Pill>
        <span className="shrink-0 ml-1 opacity-50 text-[10px]">{open ? 'hide' : 'show'}</span>
      </RowButton>
      {open && (
        <div className="border-t border-border-subtle/70 px-2.5 py-2 space-y-2 bg-black/5">
          <div>
            <SectionLabel tone="muted" className="mb-1 block opacity-70">
              prompt
            </SectionLabel>
            <p className="opacity-70 leading-relaxed">{block.prompt}</p>
          </div>
          {block.summary && (
            <div>
              <SectionLabel tone="muted" className="mb-1 block opacity-70">
                result
              </SectionLabel>
              <p className="opacity-80 leading-relaxed">{block.summary}</p>
            </div>
          )}
        </div>
      )}
    </SurfacePanel>
  );
});

function traceSummaryTone(category: TraceClusterSummaryCategory) {
  switch (category.kind) {
    case 'thinking':
      return 'muted';
    case 'subagent':
      return 'steel';
    case 'error':
      return 'danger';
    case 'context':
      return 'muted';
    case 'tool':
      return toolMeta(category.tool ?? category.label).tone;
  }
}

const MAX_VISIBLE_TRACE_BLOCKS = 5;
const MAX_DEFERRED_TRACE_PREFETCH_BLOCKS = MAX_VISIBLE_TRACE_BLOCKS;
const TRACE_CLUSTER_INACTIVE_GRACE_MS = 900;

function readToolRecordString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isCheckpointSaveBlock(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  return (
    block.tool === 'checkpoint' && (readToolRecordString(block.input, 'action') ?? readToolRecordString(block.details, 'action')) === 'save'
  );
}

function readCheckpointCollapseKey(block: Extract<MessageBlock, { type: 'tool_use' }>): string | null {
  if (!isCheckpointSaveBlock(block)) return null;
  const message = readToolRecordString(block.input, 'message');
  const subject = message?.split(/\r?\n/)[0]?.trim();
  if (subject) return `message:${subject.toLowerCase()}`;

  const commitId =
    readToolRecordString(block.details, 'commitSha') ??
    readToolRecordString(block.details, 'checkpointId') ??
    /^Saved checkpoint\s+([a-f0-9]{7,40})\b/im.exec(block.output ?? '')?.[1];
  if (commitId) return `commit:${commitId.toLowerCase()}`;

  const paths = Array.isArray((block.input as Record<string, unknown> | undefined)?.paths)
    ? ((block.input as Record<string, unknown>).paths as unknown[])
        .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
        .map((path) => path.trim())
        .sort()
        .join('\n')
    : '';
  return paths ? `paths:${paths}` : null;
}

function collapseRepeatedCheckpointBlocks(
  blocks: Extract<MessageBlock, { type: 'tool_use' }>[],
): Extract<MessageBlock, { type: 'tool_use' }>[] {
  const latestByKey = new Map<string, number>();
  blocks.forEach((block, index) => {
    const key = readCheckpointCollapseKey(block);
    if (key) latestByKey.set(key, index);
  });

  return blocks.filter((block, index) => {
    const key = readCheckpointCollapseKey(block);
    return !key || latestByKey.get(key) === index;
  });
}

function hasArtifactPresentation(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  if (block.tool !== 'artifact') return false;
  const action = readToolRecordString(block.input, 'action') ?? readToolRecordString(block.details, 'action');
  const artifactId = readToolRecordString(block.input, 'artifactId') ?? readToolRecordString(block.details, 'artifactId');
  const title = readToolRecordString(block.input, 'title') ?? readToolRecordString(block.details, 'title');
  return action !== 'list' && action !== 'delete' && Boolean(artifactId || title);
}

function hasPinnedToolBlock(block: TraceConversationBlock): block is Extract<MessageBlock, { type: 'tool_use' }> {
  return (
    block.type === 'tool_use' &&
    (isCheckpointSaveBlock(block) ||
      block.tool === 'ask_user' ||
      block.tool === 'image' ||
      block.tool === 'browser_screenshot' ||
      block.tool === 'screenshot' ||
      hasArtifactPresentation(block) ||
      (block.tool === 'subagent' &&
        ((!!block.details &&
          typeof block.details === 'object' &&
          typeof (block.details as Record<string, unknown>).childConversationId === 'string') ||
          readLinkedRuns(block).runs.length > 0)))
  );
}

function PinnedToolBlocks({
  blocks,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  showPinnedToolCalls,
  diffDisclosureMode,
}: {
  blocks: TraceConversationBlock[];
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  showPinnedToolCalls: boolean;
  diffDisclosureMode: ConversationDiffDisclosureMode;
}) {
  if (!showPinnedToolCalls) return null;
  const pinned = collapseRepeatedCheckpointBlocks(blocks.filter(hasPinnedToolBlock));
  if (pinned.length === 0) return null;

  return (
    <div className="ml-2.5 mt-1.5 space-y-1.5 border-l border-border-subtle pl-2.5">
      {pinned.map((block, index) => (
        <ToolBlock
          key={`pinned-tool-${block.id ?? index}`}
          block={block}
          autoOpen={false}
          onOpenArtifact={onOpenArtifact}
          activeArtifactId={activeArtifactId}
          onOpenCheckpoint={onOpenCheckpoint}
          activeCheckpointId={activeCheckpointId}
          onOpenBrowser={onOpenBrowser}
          onOpenFilePath={onOpenFilePath}
          validatedFilePathTargets={validatedFilePathTargets}
          diffDisclosureMode={diffDisclosureMode}
        />
      ))}
    </div>
  );
}

function useGracefulTraceClusterActive(active: boolean, immediateInactive: boolean): boolean {
  const [stableActive, setStableActive] = useState(active);
  const inactiveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (inactiveTimeoutRef.current !== null) {
      window.clearTimeout(inactiveTimeoutRef.current);
      inactiveTimeoutRef.current = null;
    }

    if (active) {
      setStableActive(true);
      return undefined;
    }

    if (immediateInactive) {
      setStableActive(false);
      return undefined;
    }

    inactiveTimeoutRef.current = window.setTimeout(() => {
      setStableActive(false);
      inactiveTimeoutRef.current = null;
    }, TRACE_CLUSTER_INACTIVE_GRACE_MS);

    return () => {
      if (inactiveTimeoutRef.current !== null) {
        window.clearTimeout(inactiveTimeoutRef.current);
        inactiveTimeoutRef.current = null;
      }
    };
  }, [active, immediateInactive]);

  return stableActive;
}

export function TraceClusterBlock({
  blocks,
  deferredBlockIds = [],
  summary,
  live,
  keepOpenUntilFollowed = false,
  followedByTranscriptContent = false,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  validatedFilePathTargets,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  layout = 'default',
  transcriptDisclosureMode,
  diffDisclosureMode,
  showPinnedToolCalls,
}: {
  blocks: TraceConversationBlock[];
  deferredBlockIds?: string[];
  summary: TraceClusterSummary;
  live: boolean;
  keepOpenUntilFollowed?: boolean;
  followedByTranscriptContent?: boolean;
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onResume?: () => Promise<void> | void;
  resumeBusy?: boolean;
  resumeTitle?: string | null;
  resumeLabel?: string;
  layout?: ChatViewLayout;
  transcriptDisclosureMode: ConversationTranscriptDisclosureMode;
  diffDisclosureMode: ConversationDiffDisclosureMode;
  showPinnedToolCalls: boolean;
}) {
  const [preference, setPreference] = useState<DisclosurePreference>('auto');
  const [showAllBlocks, setShowAllBlocks] = useState(false);
  const requestedDeferredBlockIdsRef = useRef<Set<string>>(new Set());
  const expandedCategories = summary.categories.slice(0, 3);
  const remainingCategoryCount = Math.max(0, summary.categories.length - expandedCategories.length);
  const durationLabel = summary.durationMs && summary.durationMs > 0 ? `${(summary.durationMs / 1000).toFixed(1)}s` : null;
  const isActive = live || summary.hasRunning;
  const stableActive = useGracefulTraceClusterActive(isActive, followedByTranscriptContent);
  const throughputLabel = useMemo(() => getStreamingThroughputLabel(blocks, stableActive), [blocks, stableActive]);
  const compact = layout === 'compact';
  const title = stableActive ? 'Working' : 'Internal work';
  const autoOpen = keepOpenUntilFollowed && shouldAutoOpenTraceCluster(stableActive, false);
  const open = resolveDisclosureOpen(autoOpen, preference);
  const toggleTraceCluster = useCallback(() => {
    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  }, [autoOpen]);
  const toggleTraceClusterOverflow = useCallback(() => {
    setShowAllBlocks((current) => !current);
  }, []);
  const hydrateDeferredBlocks = () => {
    if (!onHydrateMessage || deferredBlockIds.length === 0) {
      return;
    }

    const blockIds = deferredBlockIds.slice(-MAX_DEFERRED_TRACE_PREFETCH_BLOCKS);
    for (const blockId of blockIds) {
      if (!hydratingMessageBlockIds?.has(blockId) && !requestedDeferredBlockIdsRef.current.has(blockId)) {
        requestedDeferredBlockIdsRef.current.add(blockId);
        void onHydrateMessage(blockId);
      }
    }
  };
  useEffect(() => {
    if (open) {
      hydrateDeferredBlocks();
    }
  }, [open]);
  useEffect(() => registerTraceClusterToggleCapability(), []);
  useEffect(() => {
    function handleToggleFirstTraceCluster(event: Event) {
      const detail = (event as CustomEvent<TraceClusterCommandDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      toggleTraceCluster();
    }

    window.addEventListener(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstTraceCluster);
    return () => window.removeEventListener(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, handleToggleFirstTraceCluster);
  }, [toggleTraceCluster]);
  const runningBlockIndex = useMemo(
    () => blocks.findIndex((block) => block.type === 'tool_use' && (block.status === 'running' || !!block.running)),
    [blocks],
  );
  const visibleBlocks = useMemo(() => {
    if (!open) {
      return runningBlockIndex >= 0 ? [blocks[runningBlockIndex]] : [];
    }

    if (showAllBlocks || blocks.length <= MAX_VISIBLE_TRACE_BLOCKS) {
      return blocks;
    }

    return blocks.slice(-MAX_VISIBLE_TRACE_BLOCKS);
  }, [blocks, open, runningBlockIndex, showAllBlocks]);
  const overflowBlockCount = Math.max(0, blocks.length - MAX_VISIBLE_TRACE_BLOCKS);
  const canToggleTraceClusterOverflow = open && overflowBlockCount > 0;
  useEffect(() => {
    if (!canToggleTraceClusterOverflow) return undefined;
    return registerTraceClusterOverflowToggleCapability();
  }, [canToggleTraceClusterOverflow]);
  useEffect(() => {
    function handleToggleFirstTraceClusterOverflow(event: Event) {
      const detail = (event as CustomEvent<TraceClusterCommandDetail>).detail;
      if (detail?.handled || !canToggleTraceClusterOverflow) return;
      if (detail) detail.handled = true;
      toggleTraceClusterOverflow();
    }

    window.addEventListener(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, handleToggleFirstTraceClusterOverflow);
    return () => window.removeEventListener(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, handleToggleFirstTraceClusterOverflow);
  }, [canToggleTraceClusterOverflow, toggleTraceClusterOverflow]);
  const visibleStartIndex = blocks.length - visibleBlocks.length;
  return (
    <div className="space-y-1.5">
      <div
        className={
          compact
            ? 'flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-dim/70'
            : 'grid w-full grid-cols-[auto_1fr] items-center gap-2 text-[11px] text-dim/70'
        }
      >
        <RowButton
          compact
          onMouseEnter={hydrateDeferredBlocks}
          onFocus={hydrateDeferredBlocks}
          onClick={toggleTraceCluster}
          aria-expanded={open}
          className={
            compact
              ? 'flex min-w-0 max-w-full flex-1 flex-wrap items-center gap-1.5 bg-transparent p-0 text-dim/70'
              : 'flex min-w-0 max-w-[78vw] items-center gap-1.5 bg-transparent p-0 text-dim/70 sm:max-w-[42rem]'
          }
        >
          <span className="shrink-0 font-medium text-primary">{title}</span>
          <span className="shrink-0 text-secondary">
            · {summary.stepCount} step{summary.stepCount === 1 ? '' : 's'}
          </span>
          {summary.categories.length > 0 && (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {expandedCategories.map((category) => (
                <Pill key={category.key} tone={traceSummaryTone(category)} mono={category.kind === 'tool'}>
                  {category.label}
                  {category.count > 1 ? ` ×${category.count}` : ''}
                </Pill>
              ))}
              {remainingCategoryCount > 0 && <span className="text-dim">+{remainingCategoryCount}</span>}
            </span>
          )}
          <span className="flex-1" />
          {stableActive && <MetaLabel tone="accent">live</MetaLabel>}
          {throughputLabel && (
            <span
              className="font-mono text-accent/80"
              title="Estimated from streamed output using the same chars/4 token heuristic used elsewhere in Pi."
            >
              {throughputLabel}
            </span>
          )}
          {durationLabel && !isActive && <span className="text-dim">{durationLabel}</span>}
          <span className="text-dim">{open ? 'hide' : 'show'}</span>
        </RowButton>
        <span className={compact ? 'h-px min-w-8 flex-1 bg-border-subtle' : 'h-px bg-border-subtle'} aria-hidden="true" />
      </div>
      <ResumeConversationAction onResume={onResume} busy={resumeBusy} title={resumeTitle} label={resumeLabel} variant="inline" />

      {!open && (
        <PinnedToolBlocks
          blocks={blocks}
          onOpenArtifact={onOpenArtifact}
          activeArtifactId={activeArtifactId}
          onOpenCheckpoint={onOpenCheckpoint}
          activeCheckpointId={activeCheckpointId}
          onOpenBrowser={onOpenBrowser}
          onOpenFilePath={onOpenFilePath}
          validatedFilePathTargets={validatedFilePathTargets}
          showPinnedToolCalls={showPinnedToolCalls}
          diffDisclosureMode={diffDisclosureMode}
        />
      )}

      {open && (
        <div className="ml-2.5 space-y-1.5 border-l border-border-subtle pl-2.5">
          {overflowBlockCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-elevated/35 px-2.5 py-1.5 text-[11px] text-secondary">
              <span>
                {showAllBlocks
                  ? `Showing all ${blocks.length} steps.`
                  : `${overflowBlockCount} earlier step${overflowBlockCount === 1 ? '' : 's'} summarized above.`}
              </span>
              <span className="flex-1" />
              <Button variant="action" onClick={toggleTraceClusterOverflow} className="text-[10px]">
                {showAllBlocks ? `Show latest ${MAX_VISIBLE_TRACE_BLOCKS}` : 'Show all'}
              </Button>
            </div>
          )}
          {visibleBlocks.map((block, index) => {
            const blockIndex = open ? visibleStartIndex + index : runningBlockIndex;
            const autoOpen = resolveConversationBlockAutoOpen(block, blockIndex, blocks.length, stableActive, transcriptDisclosureMode);
            const blockLive = stableActive && blockIndex === blocks.length - 1;

            switch (block.type) {
              case 'thinking':
                return <ThinkingBlock key={`thinking-${blockIndex}`} block={block} autoOpen={autoOpen} live={blockLive} />;
              case 'tool_use':
                return (
                  <ToolBlock
                    key={`tool-${blockIndex}`}
                    block={block}
                    autoOpen={autoOpen}
                    live={blockLive}
                    onOpenArtifact={onOpenArtifact}
                    activeArtifactId={activeArtifactId}
                    onOpenCheckpoint={onOpenCheckpoint}
                    activeCheckpointId={activeCheckpointId}
                    onOpenBrowser={onOpenBrowser}
                    onOpenFilePath={onOpenFilePath}
                    validatedFilePathTargets={validatedFilePathTargets}
                    onHydrateMessage={onHydrateMessage}
                    hydratingMessageBlockIds={hydratingMessageBlockIds}
                    diffDisclosureMode={diffDisclosureMode}
                  />
                );
              case 'subagent':
                return <SubagentBlock key={`subagent-${blockIndex}`} block={block} />;
              case 'error':
                return (
                  <ErrorBlock
                    key={`error-${blockIndex}`}
                    block={block}
                    onOpenFilePath={onOpenFilePath}
                    validatedFilePathTargets={validatedFilePathTargets}
                  />
                );
              case 'context':
              case 'summary':
                return (
                  <ContextShelf
                    key={`context-${blockIndex}`}
                    blocks={[block]}
                    messageIndexOffset={blockIndex}
                    onOpenFilePath={onOpenFilePath}
                    onOpenCheckpoint={onOpenCheckpoint}
                    validatedFilePathTargets={validatedFilePathTargets}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
}

// ── ImageBlock ────────────────────────────────────────────────────────────────

function ResumeConversationAction({
  onResume,
  busy = false,
  title,
  label = 'continue',
  variant = 'compact',
}: {
  onResume?: () => Promise<void> | void;
  busy?: boolean;
  title?: string | null;
  label?: string;
  variant?: 'compact' | 'inline';
}) {
  if (!onResume) {
    return null;
  }

  const compactClassName =
    'shrink-0 text-[11px] font-medium text-secondary transition-colors hover:text-primary disabled:cursor-default disabled:text-dim';
  const inlineClassName =
    'group inline-flex shrink-0 items-center gap-1.5 self-start px-2 py-1 text-[11px] font-medium text-secondary disabled:cursor-default disabled:text-dim sm:self-center';

  return (
    <TextButton
      onClick={() => {
        void onResume();
      }}
      disabled={busy}
      title={title ?? 'Resume this conversation'}
      className={variant === 'inline' ? inlineClassName : compactClassName}
    >
      {busy ? 'opening…' : label}
    </TextButton>
  );
}

// ── ErrorBlock ────────────────────────────────────────────────────────────────

function presentTraceErrorMessage(message: string): string {
  const normalized = message.trim();

  if (normalized.toLowerCase() === 'terminated') {
    return 'Stopped before finishing. The agent run was interrupted or cancelled.';
  }

  const extensionModuleLoadFailure = /^Extension "([^"]+)" action "([^"]+)" failed: Cannot find module\b/.exec(normalized);
  if (extensionModuleLoadFailure) {
    return `Extension "${extensionModuleLoadFailure[1]}" action "${extensionModuleLoadFailure[2]}" could not start because a required app module was unavailable. Rebuild or restart Neon Pilot and try again.`;
  }

  if (/^Cannot find module\b/.test(normalized)) {
    return 'A required app module was unavailable. Rebuild or restart Neon Pilot and try again.';
  }

  return message;
}

export const ErrorBlock = memo(function ErrorBlock({
  block,
  messageIndex,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  onOpenFilePath: _onOpenFilePath,
  validatedFilePathTargets: _validatedFilePathTargets,
  onSelectionGesture,
}: {
  block: Extract<MessageBlock, { type: 'error' }>;
  messageIndex?: number;
  onResume?: () => Promise<void> | void;
  resumeBusy?: boolean;
  resumeTitle?: string | null;
  resumeLabel?: string;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onSelectionGesture?: ReplySelectionGestureHandler;
}) {
  const blockId = typeof block.id === 'string' ? block.id.trim() || undefined : undefined;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const message = presentTraceErrorMessage(block.message);

  return (
    <Notice tone="danger" className="text-[12px] font-mono">
      <div className="min-w-0 space-y-2">
        <div {...replySelectionScopeProps}>
          {block.tool && <span className="text-danger/70 font-semibold">{block.tool} ·</span>}
          <span className="text-danger/85 leading-relaxed">{message}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <ResumeConversationAction onResume={onResume} busy={resumeBusy} title={resumeTitle} label={resumeLabel} variant="inline" />
        </div>
      </div>
    </Notice>
  );
});

// ── Message actions ───────────────────────────────────────────────────────────
