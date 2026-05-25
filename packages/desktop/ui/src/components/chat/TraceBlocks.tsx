import { memo, useEffect, useMemo, useRef, useState } from 'react';

import type { MessageBlock } from '../../shared/types';
import { getStreamingThroughputLabel } from '../../transcript/streamingThroughput';
import { cx, Pill, SurfacePanel } from '../ui';
import { readLinkedRuns } from './linkedRuns.js';
import { ContextShelf } from './MessageBlocks.js';
import { buildReplySelectionScopeProps, type ReplySelectionGestureHandler } from './replySelection.js';
import { buildSummaryPreview } from './summaryPreview.js';
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
import type { TraceClusterSummary, TraceClusterSummaryCategory, TraceConversationBlock } from './transcriptItems.js';

export const ThinkingBlock = memo(function ThinkingBlock({
  block,
  autoOpen,
}: {
  block: Extract<MessageBlock, { type: 'thinking' }>;
  autoOpen: boolean;
}) {
  const [preference, setPreference] = useState<DisclosurePreference>('auto');
  const open = resolveDisclosureOpen(autoOpen, preference);
  const preview = useMemo(() => buildSummaryPreview(block.text, 1), [block.text]);

  return (
    <SurfacePanel muted className="overflow-hidden border-transparent bg-elevated/35 text-[12px] shadow-none">
      <button
        onClick={() => setPreference((current) => toggleDisclosurePreference(autoOpen, current))}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-elevated transition-colors"
      >
        <Pill tone="muted">Thinking</Pill>
        {!open && preview ? <span className="min-w-0 flex-1 truncate text-secondary italic">{preview}</span> : <span className="flex-1" />}
        {autoOpen && <span className="text-[10px] uppercase tracking-[0.14em] text-dim/55">live</span>}
        <span className="text-dim text-[10px]">{open ? 'hide' : 'show'}</span>
      </button>
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
  const clr = {
    running: 'text-steel bg-steel/8 border-steel/20',
    complete: 'text-success bg-success/8 border-success/20',
    failed: 'text-danger bg-danger/8 border-danger/20',
  }[block.status];
  const tone = { running: 'steel', complete: 'success', failed: 'danger' }[block.status] as 'steel' | 'success' | 'danger';
  return (
    <div className={`rounded-lg overflow-hidden text-[12px] ${clr}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <Pill tone={tone} mono>
          subagent
        </Pill>
        <span className="flex-1 truncate opacity-70 font-normal">{block.name}</span>
        <Pill tone={tone}>{block.status}</Pill>
        <span className="shrink-0 ml-1 opacity-50 text-[10px]">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="border-t border-border-subtle/70 px-2.5 py-2 space-y-2 bg-black/5">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-40 mb-1">prompt</p>
            <p className="opacity-70 leading-relaxed">{block.prompt}</p>
          </div>
          {block.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-40 mb-1">result</p>
              <p className="opacity-80 leading-relaxed">{block.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
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
    (block.tool === 'checkpoint' ||
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
          diffDisclosureMode={diffDisclosureMode}
        />
      ))}
    </div>
  );
}

function useGracefulTraceClusterActive(active: boolean): boolean {
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
  }, [active]);

  return stableActive;
}

export function TraceClusterBlock({
  blocks,
  deferredBlockIds = [],
  summary,
  live,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  transcriptDisclosureMode,
  diffDisclosureMode,
  showPinnedToolCalls,
}: {
  blocks: TraceConversationBlock[];
  deferredBlockIds?: string[];
  summary: TraceClusterSummary;
  live: boolean;
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  onOpenFilePath?: (path: string) => void;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onResume?: () => Promise<void> | void;
  resumeBusy?: boolean;
  resumeTitle?: string | null;
  resumeLabel?: string;
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
  const stableActive = useGracefulTraceClusterActive(isActive);
  const throughputLabel = useMemo(() => getStreamingThroughputLabel(blocks, stableActive), [blocks, stableActive]);
  const title = stableActive ? 'Working' : 'Internal work';
  const autoOpen = transcriptDisclosureMode === 'expanded' ? true : shouldAutoOpenTraceCluster(stableActive, false);
  const open = resolveDisclosureOpen(autoOpen, preference);
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
  const hiddenBlockCount = open ? Math.max(0, blocks.length - visibleBlocks.length) : 0;
  const visibleStartIndex = blocks.length - visibleBlocks.length;
  const panelClassName = cx(
    'flex-1 rounded-xl border px-2.5 py-2 text-left transition-colors',
    summary.hasError ? 'border-danger/30 bg-danger/5 hover:bg-danger/10' : 'border-border-subtle bg-elevated/60 hover:bg-elevated',
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
        <button
          type="button"
          onMouseEnter={hydrateDeferredBlocks}
          onFocus={hydrateDeferredBlocks}
          onClick={() => setPreference((current) => toggleDisclosurePreference(autoOpen, current))}
          aria-expanded={open}
          className={panelClassName}
        >
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-medium text-primary">{title}</span>
            <span className="text-secondary">
              · {summary.stepCount} step{summary.stepCount === 1 ? '' : 's'}
            </span>
            <span className="flex-1" />
            {stableActive && <span className="text-[10px] uppercase tracking-[0.14em] text-accent/80">live</span>}
            {throughputLabel && (
              <span
                className="font-mono text-[11px] text-accent/80"
                title="Estimated from streamed output using the same chars/4 token heuristic used elsewhere in Pi."
              >
                {throughputLabel}
              </span>
            )}
            {durationLabel && !isActive && <span className="text-[11px] text-dim">{durationLabel}</span>}
            <span className="text-[10px] text-dim">{open ? 'hide' : 'show'}</span>
          </div>
          {summary.categories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {expandedCategories.map((category) => (
                <Pill key={category.key} tone={traceSummaryTone(category)} mono={category.kind === 'tool'}>
                  {category.label}
                  {category.count > 1 ? ` ×${category.count}` : ''}
                </Pill>
              ))}
              {remainingCategoryCount > 0 && <span className="text-[11px] text-dim">+{remainingCategoryCount} more</span>}
            </div>
          )}
        </button>
        <ResumeConversationAction onResume={onResume} busy={resumeBusy} title={resumeTitle} label={resumeLabel} variant="inline" />
      </div>

      {!open && (
        <PinnedToolBlocks
          blocks={blocks}
          onOpenArtifact={onOpenArtifact}
          activeArtifactId={activeArtifactId}
          onOpenCheckpoint={onOpenCheckpoint}
          activeCheckpointId={activeCheckpointId}
          onOpenBrowser={onOpenBrowser}
          onOpenFilePath={onOpenFilePath}
          showPinnedToolCalls={showPinnedToolCalls}
          diffDisclosureMode={diffDisclosureMode}
        />
      )}

      {open && (
        <div className="ml-2.5 space-y-1.5 border-l border-border-subtle pl-2.5">
          {hiddenBlockCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-elevated/35 px-2.5 py-1.5 text-[11px] text-secondary">
              <span>
                {showAllBlocks
                  ? `Showing all ${blocks.length} steps.`
                  : `${hiddenBlockCount} earlier step${hiddenBlockCount === 1 ? '' : 's'} summarized above.`}
              </span>
              <span className="flex-1" />
              <button type="button" onClick={() => setShowAllBlocks((current) => !current)} className="ui-action-button text-[10px]">
                {showAllBlocks ? `Show latest ${MAX_VISIBLE_TRACE_BLOCKS}` : 'Show all'}
              </button>
            </div>
          )}
          {visibleBlocks.map((block, index) => {
            const blockIndex = open ? visibleStartIndex + index : runningBlockIndex;
            const autoOpen = resolveConversationBlockAutoOpen(block, blockIndex, blocks.length, stableActive, transcriptDisclosureMode);

            switch (block.type) {
              case 'thinking':
                return <ThinkingBlock key={`thinking-${blockIndex}`} block={block} autoOpen={autoOpen} />;
              case 'tool_use':
                return (
                  <ToolBlock
                    key={`tool-${blockIndex}`}
                    block={block}
                    autoOpen={autoOpen}
                    onOpenArtifact={onOpenArtifact}
                    activeArtifactId={activeArtifactId}
                    onOpenCheckpoint={onOpenCheckpoint}
                    activeCheckpointId={activeCheckpointId}
                    onOpenBrowser={onOpenBrowser}
                    onOpenFilePath={onOpenFilePath}
                    onHydrateMessage={onHydrateMessage}
                    hydratingMessageBlockIds={hydratingMessageBlockIds}
                    diffDisclosureMode={diffDisclosureMode}
                  />
                );
              case 'subagent':
                return <SubagentBlock key={`subagent-${blockIndex}`} block={block} />;
              case 'error':
                return <ErrorBlock key={`error-${blockIndex}`} block={block} onOpenFilePath={onOpenFilePath} />;
              case 'context':
              case 'summary':
                return (
                  <ContextShelf
                    key={`context-${blockIndex}`}
                    blocks={[block]}
                    messageIndexOffset={blockIndex}
                    onOpenFilePath={onOpenFilePath}
                    onOpenCheckpoint={onOpenCheckpoint}
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
    'group inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-secondary transition-colors hover:bg-elevated hover:text-primary disabled:cursor-default disabled:text-dim disabled:hover:bg-transparent sm:self-center';

  return (
    <button
      type="button"
      onClick={() => {
        void onResume();
      }}
      disabled={busy}
      title={title ?? 'Resume this conversation'}
      className={variant === 'inline' ? inlineClassName : compactClassName}
    >
      {busy ? 'opening…' : label}
    </button>
  );
}

// ── ErrorBlock ────────────────────────────────────────────────────────────────

export const ErrorBlock = memo(function ErrorBlock({
  block,
  messageIndex,
  onResume,
  resumeBusy,
  resumeTitle,
  resumeLabel,
  onOpenFilePath: _onOpenFilePath,
  onSelectionGesture,
}: {
  block: Extract<MessageBlock, { type: 'error' }>;
  messageIndex?: number;
  onResume?: () => Promise<void> | void;
  resumeBusy?: boolean;
  resumeTitle?: string | null;
  resumeLabel?: string;
  onOpenFilePath?: (path: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
}) {
  const blockId = block.id?.trim() || undefined;
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);

  return (
    <SurfacePanel className="border-danger/30 bg-danger/5 px-3 py-2.5 text-[12px] font-mono">
      <div className="min-w-0 space-y-2">
        <div {...replySelectionScopeProps}>
          {block.tool && <span className="text-danger/70 font-semibold">{block.tool} ·</span>}
          <span className="text-danger/85 leading-relaxed">{block.message}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <ResumeConversationAction onResume={onResume} busy={resumeBusy} title={resumeTitle} label={resumeLabel} variant="inline" />
        </div>
      </div>
    </SurfacePanel>
  );
});

// ── Message actions ───────────────────────────────────────────────────────────
