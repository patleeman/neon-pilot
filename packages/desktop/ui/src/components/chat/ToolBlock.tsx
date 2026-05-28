import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAppData } from '../../app/contexts';
import { getRunConnections, isRunActive, type RunPresentationLookups } from '../../automation/runPresentation';
import { NativeExtensionToolBlockHost } from '../../extensions/NativeExtensionToolBlockHost';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import type { DurableRunListResult, MessageBlock } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { transcriptTargetAttributes } from '../../transcript/spotlight';
import { isTerminalBashToolBlock } from '../../transcript/terminalBashBlock';
import { readToolExecutionWrappers } from '../../transcript/toolExecutionWrappers';
import { cx, Pill } from '../ui';
import { type FileChange, FileChangesToolDiff, readFileChangesForToolBlock } from './FileChangesToolDiff.js';
import {
  INLINE_RUN_LOG_TAIL_LINES,
  INLINE_RUN_POLL_INTERVAL_MS,
  shouldPollInlineRunSnapshot,
  usePolledDurableRunSnapshot,
} from './linkedRunPolling.js';
import { buildToolPreview, readLinkedRuns } from './linkedRuns.js';
import { TerminalToolBlock } from './TerminalToolBlock.js';
import {
  type ConversationDiffDisclosureMode,
  type DisclosurePreference,
  isBackgroundShellStart,
  resolveDisclosureOpen,
  stripAnsiForTranscript,
  toggleDisclosurePreference,
  toolMeta,
} from './toolPresentation.js';

const MAX_VISIBLE_LINKED_RUNS = 5;

function BackgroundBashInlineOutput({
  runId,
  command,
  run,
  streaming,
}: {
  runId: string;
  command: string;
  run: DurableRunListResult['runs'][number] | null | undefined;
  streaming: boolean;
}) {
  const pollEnabled = shouldPollInlineRunSnapshot({
    run,
    visible: true,
    open: true,
    streaming,
  });
  const snapshot = usePolledDurableRunSnapshot(pollEnabled ? runId : null, pollEnabled, {
    tail: INLINE_RUN_LOG_TAIL_LINES,
    pollIntervalMs: INLINE_RUN_POLL_INTERVAL_MS,
  });
  const running = isRunActive(snapshot.detail?.run ?? run ?? null) || streaming;
  const log = stripAnsiForTranscript(snapshot.log?.log ?? '');

  return (
    <div
      className="border-t border-border-subtle/70 bg-black/10 px-2.5 py-2"
      tabIndex={-1}
      {...transcriptTargetAttributes({ kind: 'background_run', runId })}
    >
      <span className="sr-only">input</span>
      <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed opacity-80">
        <span className="opacity-60">$ </span>
        {command}
        {log ? `\n${log}` : running || snapshot.loading ? '\nWaiting for output…' : '\n(no output)'}
      </pre>
    </div>
  );
}

function getLinkedRunConversationRoute(
  runId: string,
  runs: DurableRunListResult | null | undefined,
  runLookups: RunPresentationLookups | undefined,
): string | undefined {
  const run = runs?.runs.find((candidate) => candidate.runId === runId);
  if (!run) {
    return undefined;
  }

  return getRunConnections(run, runLookups).find((connection) => connection.label === 'Conversation transcript' && connection.to)?.to;
}

function readToolDetailString(details: unknown, key: string): string | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readToolInputString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readArtifactId(block: Extract<MessageBlock, { type: 'tool_use' }>): string | undefined {
  return (
    readToolInputString(block.input, 'artifactId') ??
    readToolDetailString(block.details, 'artifactId') ??
    (/\bartifact\s+([A-Za-z0-9_.:-]+)\b/i.exec(block.output ?? '')?.[1]?.trim() || undefined)
  );
}

function readArtifactTitle(block: Extract<MessageBlock, { type: 'tool_use' }>): string | undefined {
  return readToolInputString(block.input, 'title') ?? readToolDetailString(block.details, 'title') ?? readArtifactId(block);
}

function isDurableArtifactTool(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  if (block.tool !== 'artifact') return false;
  const action = readToolInputString(block.input, 'action') ?? readToolDetailString(block.details, 'action');
  return action !== 'list' && action !== 'delete' && Boolean(readArtifactTitle(block));
}

function isPinnedVisualTool(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  return block.tool === 'image' || block.tool === 'browser_screenshot' || block.tool === 'screenshot';
}

function isFileChangingTool(block: Extract<MessageBlock, { type: 'tool_use' }>, fileChanges: readonly FileChange[]): boolean {
  return fileChanges.length > 0 || block.tool === 'write' || block.tool === 'edit' || block.tool === 'apply_patch';
}

function isCheckpointFailureOutput(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  if (block.tool !== 'checkpoint') return false;
  const output = stripAnsiForTranscript(block.output ?? '');
  return /\b(refusing to checkpoint|failed to push|rejected|non-fast-forward|error:)\b/i.test(output);
}

export function ToolBlock({
  block,
  autoOpen,
  onOpenArtifact,
  activeArtifactId,
  onOpenCheckpoint,
  activeCheckpointId,
  onOpenBrowser,
  onOpenFilePath: _onOpenFilePath,
  onHydrateMessage,
  hydratingMessageBlockIds,
  messages,
  messageIndex,
  onSubmitAskUserQuestion,
  askUserQuestionDisplayMode = 'inline',
  diffDisclosureMode = 'collapsed',
}: {
  block: Extract<MessageBlock, { type: 'tool_use' }>;
  autoOpen: boolean;
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  onOpenFilePath?: (path: string) => void;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  messages?: MessageBlock[];
  messageIndex?: number;
  onSubmitAskUserQuestion?: (presentation: AskUserQuestionPresentation, answers: AskUserQuestionAnswers) => Promise<void> | void;
  askUserQuestionDisplayMode?: 'inline' | 'composer';
  diffDisclosureMode?: ConversationDiffDisclosureMode;
}) {
  const [preference, setPreference] = useState<DisclosurePreference>('auto');
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [pinnedDiffOpen, setPinnedDiffOpen] = useState(() => diffDisclosureMode === 'expanded');
  useEffect(() => {
    setPinnedDiffOpen(diffDisclosureMode === 'expanded');
  }, [diffDisclosureMode]);
  const backgroundShellStart = isBackgroundShellStart(block);
  const open = resolveDisclosureOpen(autoOpen, preference);
  const terminalBashBlock = isTerminalBashToolBlock(block);
  const extensionRegistry = useExtensionRegistry();
  const { tasks, sessions, runs } = useAppData();
  const runLookups = useMemo<RunPresentationLookups>(() => ({ tasks, sessions }), [tasks, sessions]);
  const extensionRenderer = useMemo(() => {
    if (block.tool === 'bash') {
      return null;
    }

    for (const extension of extensionRegistry.extensions) {
      const renderer = extension.manifest?.contributes?.transcriptRenderers?.find((candidate) => candidate.tool === block.tool);
      if (renderer && extension.enabled) return { extension, renderer };
    }
    return null;
  }, [block.tool, extensionRegistry.extensions]);
  const agentBashTool = block.tool === 'bash' && !backgroundShellStart;
  const meta = backgroundShellStart ? toolMeta('bash') : toolMeta(block.tool);
  const executionWrappers = useMemo(() => readToolExecutionWrappers(block), [block]);
  const linkedRuns = useMemo(() => readLinkedRuns(block), [block]);
  const fileChanges = useMemo(() => readFileChangesForToolBlock(block), [block]);
  const isRunning = block.status === 'running' || !!block.running;
  const isError = block.status === 'error' || !!block.error || isCheckpointFailureOutput(block);

  if (terminalBashBlock) {
    return <TerminalToolBlock block={block} onHydrateMessage={onHydrateMessage} hydratingMessageBlockIds={hydratingMessageBlockIds} />;
  }

  const subagentPrompt = block.tool === 'subagent' ? readToolInputString(block.input, 'prompt') : undefined;
  const subagentTask = block.tool === 'subagent' ? readToolInputString(block.input, 'taskSlug') : undefined;
  const subagentConversationId = block.tool === 'subagent' ? readToolDetailString(block.details, 'childConversationId') : undefined;
  const subagentLinkedConversationRoute =
    block.tool === 'subagent'
      ? linkedRuns.runs
          .map((linkedRun) => getLinkedRunConversationRoute(linkedRun.runId, runs, runLookups))
          .find((route): route is string => Boolean(route))
      : undefined;
  const subagentConversationRoute = subagentConversationId
    ? `/conversations/${encodeURIComponent(subagentConversationId)}`
    : subagentLinkedConversationRoute;
  const subagentTitle = block.tool === 'subagent' ? (readToolDetailString(block.details, 'branchTitle') ?? subagentTask) : undefined;
  const artifactId = block.tool === 'artifact' ? readArtifactId(block) : undefined;
  const artifactTitle = block.tool === 'artifact' ? readArtifactTitle(block) : undefined;
  const pinnedSubagent = block.tool === 'subagent' && Boolean(subagentConversationRoute);
  const checkpointAction =
    block.tool === 'checkpoint' ? (readToolInputString(block.input, 'action') ?? readToolDetailString(block.details, 'action')) : undefined;
  const useExtensionRenderer = extensionRenderer && !(block.tool === 'checkpoint' && checkpointAction === 'list');
  const pinnedCheckpoint = block.tool === 'checkpoint' && checkpointAction === 'save' && !isRunning && !isError;
  const pinnedArtifact = isDurableArtifactTool(block);
  const pinnedVisual = isPinnedVisualTool(block);
  const fileChangingTool = isFileChangingTool(block, fileChanges);
  const pinnedTool = pinnedSubagent || pinnedCheckpoint || pinnedArtifact || pinnedVisual;

  if (useExtensionRenderer && pinnedCheckpoint) {
    return (
      <NativeExtensionToolBlockHost
        extension={useExtensionRenderer.extension}
        renderer={useExtensionRenderer.renderer}
        block={block}
        context={{
          onOpenCheckpoint,
          activeCheckpointId,
          messages,
          messageIndex,
          onHydrateMessage,
          hydratingMessageBlockIds,
        }}
      />
    );
  }

  if (useExtensionRenderer && !pinnedTool) {
    return (
      <>
        <NativeExtensionToolBlockHost
          extension={useExtensionRenderer.extension}
          renderer={useExtensionRenderer.renderer}
          block={block}
          context={{
            onOpenArtifact,
            activeArtifactId,
            onOpenCheckpoint,
            activeCheckpointId,
            onOpenBrowser,
            messages,
            messageIndex,
            onSubmitAskUserQuestion,
            askUserQuestionDisplayMode,
            onHydrateMessage,
            hydratingMessageBlockIds,
          }}
        />
        {fileChanges.length > 0 && !isRunning && !isError ? <FileChangesToolDiff fileChanges={fileChanges} /> : null}
      </>
    );
  }

  // Normalise tool state across streamed and persisted entries.
  const output = stripAnsiForTranscript(block.output ?? '');
  const blockId = block.id?.trim();
  const outputDeferred = Boolean(block.outputDeferred && blockId && onHydrateMessage);
  const hydratingDeferredOutput = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
  const prefetchDeferredOutput = () => {
    if (!outputDeferred || !blockId || hydratingDeferredOutput) {
      return;
    }

    void onHydrateMessage?.(blockId);
  };

  const preview = buildToolPreview(block);
  const visualPreview = readToolInputString(block.input, 'prompt') ?? readToolInputString(block.input, 'tabId') ?? preview;
  const displayPreview =
    block.tool === 'subagent'
      ? (subagentTitle ?? subagentPrompt ?? preview)
      : block.tool === 'artifact'
        ? (artifactTitle ?? preview)
        : pinnedVisual
          ? visualPreview
          : preview;
  const displayedLinkedRuns = linkedRuns.scope === 'listed' ? linkedRuns.runs : [];
  const hiddenRunCount = Math.max(0, displayedLinkedRuns.length - MAX_VISIBLE_LINKED_RUNS);
  const visibleRuns = showAllRuns || hiddenRunCount === 0 ? displayedLinkedRuns : displayedLinkedRuns.slice(0, MAX_VISIBLE_LINKED_RUNS);
  const backgroundRunId = backgroundShellStart ? linkedRuns.runs[0]?.runId : undefined;
  const backgroundRun = backgroundRunId ? runs?.runs.find((candidate) => candidate.runId === backgroundRunId) : null;
  const bashCommand = readToolInputString(block.input, 'command') ?? preview;
  const headerDisclosureLabel = subagentConversationRoute
    ? 'open'
    : fileChangingTool && fileChanges.length > 0 && !isRunning && !isError
      ? pinnedDiffOpen
        ? 'Hide diff'
        : 'View diff'
      : open
        ? 'hide'
        : 'show';
  const toggleHeaderDisclosure = () => {
    if (fileChangingTool && fileChanges.length > 0 && !isRunning && !isError) {
      setPinnedDiffOpen((current) => !current);
      return;
    }

    setPreference((current) => toggleDisclosurePreference(autoOpen, current));
  };

  const headerClassName = cx(
    'w-full flex items-center gap-2 px-2.5 py-2 hover:bg-black/5 transition-colors text-left',
    (subagentConversationRoute || (fileChangingTool && fileChanges.length > 0 && !isRunning && !isError)) && 'cursor-pointer',
  );
  const headerContent = (
    <>
      <Pill tone={isError ? 'danger' : meta.tone} mono className="shrink-0">
        {meta.label}
      </Pill>
      {backgroundShellStart && (
        <Pill tone="accent" mono className="shrink-0">
          background task
        </Pill>
      )}
      {executionWrappers.map((wrapper) => (
        <Pill key={wrapper.id} tone="accent" mono className="shrink-0">
          {wrapper.label ?? wrapper.id}
        </Pill>
      ))}
      <span className={cx('flex-1 opacity-70 font-normal', agentBashTool ? 'whitespace-normal break-words' : 'truncate')}>
        {displayPreview}
      </span>
      {pinnedTool ? <span className="shrink-0 text-[10px] text-dim font-sans">{timeAgo(block.ts)}</span> : null}
      {pinnedArtifact && artifactId && onOpenArtifact ? (
        <button
          type="button"
          className="ui-action-button shrink-0 text-[10px] font-sans"
          onClick={(event) => {
            event.stopPropagation();
            onOpenArtifact(artifactId);
          }}
        >
          View
        </button>
      ) : null}
      {block.durationMs && !isRunning && !pinnedTool && (
        <span className="shrink-0 opacity-40 ml-2">{(block.durationMs / 1000).toFixed(1)}s</span>
      )}
      {isRunning ? (
        <>
          <span className="shrink-0 text-[10px] opacity-60 ml-2">running…</span>
          <span className="shrink-0 opacity-50 text-[10px]">{headerDisclosureLabel}</span>
        </>
      ) : (
        <span className="shrink-0 opacity-50 text-[10px]">{headerDisclosureLabel}</span>
      )}
    </>
  );

  return (
    <div
      className={cx(
        'rounded-lg text-[12px] font-mono overflow-hidden transition-colors',
        meta.color,
        isError && 'border border-danger/40 bg-danger/5 text-danger',
      )}
    >
      {subagentConversationRoute ? (
        <Link
          to={subagentConversationRoute}
          data-background-run-id={backgroundRunId}
          {...(backgroundRunId ? transcriptTargetAttributes({ kind: 'background_run', runId: backgroundRunId }) : {})}
          onMouseEnter={prefetchDeferredOutput}
          onFocus={prefetchDeferredOutput}
          className={headerClassName}
        >
          {headerContent}
        </Link>
      ) : (
        <div
          role="button"
          tabIndex={0}
          data-background-run-id={backgroundRunId}
          {...(backgroundRunId ? transcriptTargetAttributes({ kind: 'background_run', runId: backgroundRunId }) : {})}
          onMouseEnter={prefetchDeferredOutput}
          onFocus={prefetchDeferredOutput}
          onClick={toggleHeaderDisclosure}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleHeaderDisclosure();
            }
          }}
          className={headerClassName}
        >
          {headerContent}
        </div>
      )}

      {displayedLinkedRuns.length > 0 && !pinnedTool && !backgroundShellStart && (
        <div className="border-t border-border-subtle/70 bg-black/5 px-2.5 py-2 text-[11px] font-sans">
          <p className="mb-1.5 uppercase tracking-[0.14em] opacity-40">
            {displayedLinkedRuns.length === 1 ? 'listed execution' : 'listed executions'}
          </p>
          {hiddenRunCount > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-black/5 px-2 py-1.5 text-[10px] text-secondary/80">
              <span>
                {showAllRuns
                  ? `Showing all ${displayedLinkedRuns.length} executions returned by the tool.`
                  : `Showing ${MAX_VISIBLE_LINKED_RUNS} of ${displayedLinkedRuns.length} executions returned by the tool.`}
              </span>
              <span className="flex-1" />
              <button type="button" onClick={() => setShowAllRuns((current) => !current)} className="ui-action-button text-[10px]">
                {showAllRuns ? 'Show fewer' : 'Show all'}
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            {visibleRuns.map((linkedRun) => {
              const conversationRoute = getLinkedRunConversationRoute(linkedRun.runId, runs, runLookups);

              return (
                <div key={linkedRun.runId} className="w-full rounded-md px-2 py-1.5 text-left text-dim">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-4 text-primary">{linkedRun.title}</p>
                      {linkedRun.detail && <p className="mt-1 truncate text-[10px] leading-4 text-secondary/80">{linkedRun.detail}</p>}
                    </div>
                    {conversationRoute ? (
                      <Link
                        to={conversationRoute}
                        className="ui-action-button shrink-0 text-[10px]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open conversation
                      </Link>
                    ) : (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] opacity-45">linked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fileChanges.length > 0 && !isRunning && !isError && (!fileChangingTool || pinnedDiffOpen) ? (
        <FileChangesToolDiff fileChanges={fileChanges} />
      ) : null}

      {open && !pinnedTool && agentBashTool && (
        <div className="border-t border-border-subtle/70 bg-black/10 px-2.5 py-2">
          <span className="sr-only">input</span>
          <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed opacity-80">
            <span className="opacity-60">$ </span>
            {bashCommand}
            {output
              ? `\n${output}`
              : isRunning
                ? '\nWaiting for output…'
                : outputDeferred
                  ? '\nOlder tool output is available on demand.'
                  : ''}
          </pre>
          {outputDeferred && blockId && (
            <button
              type="button"
              onClick={() => {
                void onHydrateMessage?.(blockId);
              }}
              disabled={hydratingDeferredOutput}
              className="ui-action-button mt-2 text-[10px]"
            >
              {hydratingDeferredOutput ? 'Loading full output…' : 'Load full output'}
            </button>
          )}
        </div>
      )}

      {open && !pinnedTool && backgroundShellStart && backgroundRunId && (
        <BackgroundBashInlineOutput runId={backgroundRunId} command={bashCommand} run={backgroundRun} streaming={isRunning} />
      )}

      {open && !pinnedTool && !agentBashTool && !backgroundShellStart && (
        <div className="border-t border-border-subtle/70">
          {(isRunning || output || outputDeferred) && (
            <div className={cx('px-2.5 py-2', isRunning && output && 'max-h-40 overflow-y-auto')}>
              {output ? (
                <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed opacity-75">{output}</pre>
              ) : isRunning ? (
                <p className="text-[11px] italic leading-relaxed opacity-55">Waiting for output…</p>
              ) : outputDeferred ? (
                <p className="text-[11px] italic leading-relaxed opacity-55">Older tool output is available on demand.</p>
              ) : null}
              {outputDeferred && blockId && (
                <button
                  type="button"
                  onClick={() => {
                    void onHydrateMessage?.(blockId);
                  }}
                  disabled={hydratingDeferredOutput}
                  className="ui-action-button mt-2 text-[10px]"
                >
                  {hydratingDeferredOutput ? 'Loading full output…' : 'Load full output'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ThinkingBlock ─────────────────────────────────────────────────────────────
