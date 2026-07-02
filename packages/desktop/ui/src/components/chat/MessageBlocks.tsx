import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../client/api';
import { setExtensionCommandContext } from '../../extensions/commands.js';
import { NativeExtensionTranscriptBlockHost } from '../../extensions/NativeExtensionToolBlockHost.js';
import { createNativeExtensionClient } from '../../extensions/nativePaClient.js';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry.js';
import { parseSkillBlock } from '../../markdown/markdownExtensions';
import type { AssistantMessageVariationSet, LiveSessionToolDefinition, MessageBlock } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { dispatchTranscriptSpotlight, transcriptTargetAttributes } from '../../transcript/spotlight.js';
import { dispatchOpenWorkbenchChat } from '../../workbench/workbenchChatEvents';
import { addNotification } from '../notifications/notificationStore';
import { cx, Disclosure, MessageActionButton, MessageCard, MessageMeta, StatusDot, Textarea, TextButton, Tooltip } from '../ui.js';
import type { ChatViewLayout } from './chatViewTypes.js';
import { ImagePreview, type InspectableImage } from './ImageMessageBlocks.js';
import { InlineTraceRunCard } from './InlineTraceRunCard.js';
import { buildInlineRunExpansionKey } from './linkedRunPolling.js';
import { readMentionedLinkedRunsFromText } from './linkedRuns.js';
import { renderMarkdownText, renderStreamingMarkdownText, renderText, SkillInvocationCard } from './MarkdownMessage.js';
import { MessageActions } from './MessageActions.js';
import { MESSAGE_EDIT_COMMAND_EVENT, type MessageEditCommand } from './messageEditCommands.js';
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
    case 'automation_run':
      return 'Automation run';
    default: {
      const normalized = customType?.replace(/[_-]+/g, ' ').trim();
      if (!normalized) {
        return 'Context added';
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }
}

function modelArenaTranscriptBlockKey(block: Extract<MessageBlock, { type: 'context' }>, fallback: number): string {
  const details =
    block.details && typeof block.details === 'object' && !Array.isArray(block.details) ? (block.details as Record<string, unknown>) : {};
  const duelId = typeof details.duelId === 'string' ? details.duelId.trim() : '';
  const sourceBlockId = typeof details.sourceBlockId === 'string' ? details.sourceBlockId.trim() : '';
  const stableId = duelId || sourceBlockId || block.id || String(fallback);
  return `model-arena:${stableId}`;
}

type ModelArenaDuelBlockData = {
  duelId: string;
  conversationId?: string;
  status: 'running' | 'ready' | 'failed' | 'voted' | 'cancelled';
  taskType?: string;
  sideA?: { text?: string };
  sideB?: { text?: string };
  revealed?: boolean;
  vote?: 'a' | 'b' | 'tie' | 'neither' | null;
  error?: string | null;
  models?: { primary?: string; challenger?: string; a?: string; b?: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readModelArenaDuelBlockData(details: unknown): ModelArenaDuelBlockData | null {
  if (!isRecord(details) || typeof details.duelId !== 'string') return null;
  const status = typeof details.status === 'string' ? details.status : 'running';
  if (!['running', 'ready', 'failed', 'voted', 'cancelled'].includes(status)) return null;
  return details as ModelArenaDuelBlockData;
}

function modelArenaSideText(side?: { text?: string } | null): string {
  return side?.text?.trim() ?? '';
}

function modelArenaHasBothAnswers(duel: Pick<ModelArenaDuelBlockData, 'sideA' | 'sideB'>): boolean {
  return Boolean(modelArenaSideText(duel.sideA) && modelArenaSideText(duel.sideB));
}

function modelArenaPreferredChallengerModel(duel: ModelArenaDuelBlockData, choice: 'a' | 'b' | 'tie' | 'neither'): string | null {
  if (choice !== 'a' && choice !== 'b') return null;
  const challenger = duel.models?.challenger?.trim();
  const primary = duel.models?.primary?.trim();
  const selected = duel.models?.[choice]?.trim();
  if (!challenger || !selected || selected !== challenger || selected === primary) return null;
  return selected;
}

function mergeModelArenaSide(
  current: ModelArenaDuelBlockData['sideA'] | undefined,
  incoming: ModelArenaDuelBlockData['sideA'] | undefined,
): ModelArenaDuelBlockData['sideA'] {
  const currentText = modelArenaSideText(current);
  const incomingText = modelArenaSideText(incoming);
  return {
    ...current,
    ...incoming,
    text: incomingText ? incoming?.text : currentText ? current?.text : incoming?.text,
  };
}

function mergeModelArenaDuelBlockData(
  current: ModelArenaDuelBlockData | null,
  incoming: ModelArenaDuelBlockData | null,
): ModelArenaDuelBlockData | null {
  if (!incoming) return current;
  if (!current || current.duelId !== incoming.duelId) return incoming;
  if ((current.status === 'cancelled' || current.status === 'voted') && incoming.status !== current.status) return current;
  const merged: ModelArenaDuelBlockData = {
    ...current,
    ...incoming,
    sideA: mergeModelArenaSide(current.sideA, incoming.sideA),
    sideB: mergeModelArenaSide(current.sideB, incoming.sideB),
    vote: incoming.vote ?? current.vote,
    error: incoming.error ?? current.error,
    models: incoming.models ?? current.models,
  };
  if (merged.status === 'running' && modelArenaHasBothAnswers(merged)) merged.status = 'ready';
  return merged;
}

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

const AUTO_RESUME_CONTEXT_TYPES = new Set([
  'goal-continuation',
  'background_auto_resume',
  'deferred_auto_resume',
  'after_turn_auto_resume',
]);

const QUIET_LIFECYCLE_CONTEXT_TYPES = new Set([...AUTO_RESUME_CONTEXT_TYPES, 'conversation_workspace_change']);
const contextShelfItemClassName = 'group/item w-full !overflow-visible !rounded-none !border-0 !bg-transparent text-[12px] text-secondary';
const contextShelfSummaryClassName =
  'grid w-full cursor-pointer list-none grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden';
const contextShelfBodyClassName = 'mt-3 max-h-[min(34rem,52vh)] w-full overflow-auto pl-5 pr-2 text-[12px] leading-relaxed text-secondary';
const contextShelfSystemPromptBodyClassName =
  'mt-3 max-h-[min(34rem,52vh)] w-full overflow-auto pl-5 pr-2 text-[12px] leading-relaxed text-secondary/80';

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
      <MessageActionButton
        className="flex w-[78%] items-center gap-2 px-2 py-0.5 text-[11px] text-dim/75 hover:text-secondary"
        data-context-shelf="1"
        data-lifecycle-marker={marker}
        title={tooltip ?? backgroundRun.runId}
        aria-label={`${quietLifecycleText(blocks)}: ${tooltip ?? backgroundRun.runId}`}
        onClick={() => dispatchTranscriptSpotlight({ kind: 'background_run', runId: backgroundRun.runId })}
      >
        {content}
      </MessageActionButton>
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

function automationRunSummary(text: string): { action: string; title: string; tone: 'running' | 'success' | 'danger' | 'muted' } {
  const firstLine =
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? 'Automation run';
  const match = firstLine.match(/^Automation\s+([^:]+):\s*(.*)$/i);
  const action = match?.[1]?.trim().toLowerCase() || 'run';
  const title = match?.[2]?.trim() || firstLine.replace(/^Automation\s+/i, '').trim() || 'Run';
  if (/\bstarted\b/i.test(action)) return { action: 'started', title, tone: 'running' };
  if (/\bcompleted\b/i.test(action)) return { action: 'completed', title, tone: 'success' };
  if (/\bfailed\b|cancelled|could not start/i.test(action)) return { action, title, tone: 'danger' };
  return { action, title, tone: 'muted' };
}

function AutomationRunContextBlock({
  block,
  replySelectionScopeProps,
  onOpenFilePath,
  onOpenCheckpoint,
  validatedFilePathTargets,
}: {
  block: Extract<MessageBlock, { type: 'context' }>;
  replySelectionScopeProps: Record<string, unknown>;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
}) {
  const summary = automationRunSummary(block.text);
  const statusTone =
    summary.tone === 'running' ? 'accent' : summary.tone === 'success' ? 'success' : summary.tone === 'danger' ? 'danger' : 'muted';
  const blockId = optionalTrimmedString(block.id);
  const transcriptTargetAttrs = blockId ? transcriptTargetAttributes({ kind: 'block', blockId }) : {};
  const [openedOnce, setOpenedOnce] = useState(false);

  return (
    <div
      className="group flex w-full flex-col items-end gap-1.5"
      data-context-type="automation_run"
      data-automation-run-block="1"
      {...transcriptTargetAttrs}
      tabIndex={blockId ? -1 : undefined}
    >
      <div className="ml-auto min-w-0 max-w-[86%]">
        {/* ui-pattern-ok raw-details-summary reason="Automation run context must use the user-message lane; shared Disclosure adds the full-width context frame this renderer intentionally avoids." */}
        <details
          className="group/item"
          onToggle={(event) => {
            if (event.currentTarget.open) {
              setOpenedOnce(true);
            }
          }}
        >
          {/* ui-pattern-ok raw-details-summary reason="Native summary lets the user-message card be the disclosure trigger without shared Disclosure frame chrome." */}
          <summary className="block cursor-pointer list-none marker:hidden before:!content-none after:!content-none [&::-webkit-details-marker]:hidden">
            <MessageCard role="user" className="space-y-2">
              <div className="flex min-w-0 items-start gap-2 px-1.5 pb-0.5">
                <StatusDot tone={statusTone} size="xs" className="mt-[0.45rem] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="shrink-0 text-[12px] font-medium text-primary/90">Automation {summary.action}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] leading-relaxed text-primary">{summary.title}</div>
                </div>
                <span className="mt-0.5 shrink-0 text-dim/70 transition-transform group-open/item:rotate-90" aria-hidden="true">
                  ›
                </span>
              </div>
            </MessageCard>
          </summary>
          {openedOnce ? (
            <div {...replySelectionScopeProps} className="mt-1.5 px-2 pb-1 pr-3 text-[12px] leading-relaxed text-secondary">
              {renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
            </div>
          ) : null}
        </details>
        {block.ts ? (
          <div className="flex flex-wrap items-center gap-2 pt-1 pr-1">
            <MessageMeta>{timeAgo(block.ts)}</MessageMeta>
          </div>
        ) : null}
      </div>
    </div>
  );
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

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  return normalized ? Math.ceil(normalized.length / 4) : 0;
}

function formatTokenCount(tokens: number): string {
  return `${tokens.toLocaleString()} token${tokens === 1 ? '' : 's'}`;
}

function formatSystemPromptPreview(toolDefinitionCount: number, tokenCount: number): string {
  const availability =
    toolDefinitionCount > 0
      ? `Runtime instructions and ${toolDefinitionCount} tool definitions available for inspection.`
      : 'Runtime instructions available for inspection.';
  return `${availability} ${formatTokenCount(tokenCount)}`;
}

function LazyDetails({
  className,
  dataAttrs = {},
  summary,
  summaryClassName,
  bodyClassName = '!border-t-0 !p-0',
  children,
}: {
  className: string;
  dataAttrs?: Record<string, string | undefined>;
  summary: ReactNode;
  summaryClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [openedOnce, setOpenedOnce] = useState(false);

  return (
    <Disclosure
      className={className}
      summary={summary}
      summaryClassName={summaryClassName}
      bodyClassName={bodyClassName}
      {...dataAttrs}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setOpenedOnce(true);
        }
      }}
    >
      {openedOnce ? children : null}
    </Disclosure>
  );
}

function ModelArenaDuelContextBlock({ block }: { block: Extract<MessageBlock, { type: 'context' }> }) {
  const data = readModelArenaDuelBlockData(block.details);
  const [local, setLocal] = useState<ModelArenaDuelBlockData | null>(data);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const client = useMemo(() => createNativeExtensionClient('system-model-arena'), []);

  useEffect(() => {
    setLocal((current) => mergeModelArenaDuelBlockData(current, data));
  }, [data]);

  useEffect(() => {
    if (!local || local.status !== 'running' || modelArenaHasBothAnswers(local)) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = (await client.extension.invoke('refreshDuel', { duelId: local.duelId })) as { duel?: ModelArenaDuelBlockData };
        if (!cancelled && result.duel) {
          setLocal((current) => mergeModelArenaDuelBlockData(current, result.duel ?? null));
          setError('');
        }
      } catch (refreshError) {
        if (!cancelled) setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client.extension, local?.duelId, local?.status]);

  if (!local || local.status === 'voted' || local.status === 'cancelled') return null;

  const complete = modelArenaHasBothAnswers(local);
  const ready = complete && (local.status === 'ready' || local.status === 'running');
  const failed = local.status === 'failed' || Boolean(error);
  const visibleError = local.error || error;
  const missingAnswerText = failed ? visibleError || 'Run ended without an answer.' : 'No answer captured.';
  const sideA = modelArenaSideText(local.sideA) || (ready || failed ? missingAnswerText : 'Waiting for answer...');
  const sideB = modelArenaSideText(local.sideB) || (ready || failed ? missingAnswerText : 'Waiting for answer...');

  const vote = async (choice: 'a' | 'b' | 'tie' | 'neither') => {
    if (busy || !ready) return;
    setBusy(choice);
    try {
      const result = (await client.extension.invoke('voteDuel', { duelId: local.duelId, choice })) as { duel?: ModelArenaDuelBlockData };
      if (!result.duel || result.duel.status !== 'voted') {
        throw new Error('Vote was not recorded. The duel is still open.');
      }
      const preferredChallengerModel = modelArenaPreferredChallengerModel(result.duel, choice);
      const conversationId = result.duel.conversationId?.trim() || local.conversationId?.trim();
      if (preferredChallengerModel && conversationId) {
        try {
          await api.updateConversationModelPreferences(conversationId, { model: preferredChallengerModel });
        } catch (preferenceError) {
          addNotification({
            type: 'warning',
            message: 'Model Arena saved your vote, but could not switch the conversation model.',
            details: preferenceError instanceof Error ? preferenceError.message : String(preferenceError),
            source: 'Model Arena',
          });
        }
      }
      setLocal(result.duel);
      setError('');
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : String(voteError));
    } finally {
      setBusy(null);
    }
  };

  const close = async () => {
    if (busy) return;
    setBusy('close');
    try {
      const result = (await client.extension.invoke('cancelDuel', { duelId: local.duelId })) as { duel?: ModelArenaDuelBlockData };
      if (!result.duel || result.duel.status !== 'cancelled') {
        throw new Error('Duel was not closed.');
      }
      setLocal(result.duel);
      setError('');
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="w-full min-w-full py-2 text-[12px]" data-model-arena-duel={local.duelId}>
      <div className="mb-4 text-center">
        <div className="font-medium text-primary">Model Arena duel</div>
        <div className="mt-1 min-h-4 text-[11px] text-dim">{busy === 'close' ? 'Closing...' : busy ? 'Saving...' : null}</div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-0">
        <ModelArenaDuelAnswer
          label="A"
          text={sideA}
          waiting={!modelArenaSideText(local.sideA) && !ready && !failed}
          failed={!modelArenaSideText(local.sideA) && failed}
          disabled={!ready || Boolean(busy)}
          onPrefer={() => void vote('a')}
        />
        <ModelArenaDuelAnswer
          label="B"
          text={sideB}
          waiting={!modelArenaSideText(local.sideB) && !ready && !failed}
          failed={!modelArenaSideText(local.sideB) && failed}
          disabled={!ready || Boolean(busy)}
          onPrefer={() => void vote('b')}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <MessageActionButton className="min-h-8 min-w-16 px-3 py-1.5" disabled={!ready || Boolean(busy)} onClick={() => void vote('tie')}>
          Tie
        </MessageActionButton>
        <MessageActionButton
          className="min-h-8 min-w-16 px-3 py-1.5"
          disabled={!ready || Boolean(busy)}
          onClick={() => void vote('neither')}
        >
          Neither
        </MessageActionButton>
        <MessageActionButton className="min-h-8 min-w-16 px-3 py-1.5" disabled={Boolean(busy)} onClick={() => void close()}>
          Close
        </MessageActionButton>
      </div>
      {visibleError ? <div className="mt-2 text-center text-danger">{visibleError}</div> : null}
    </section>
  );
}

function ModelArenaDuelAnswer({
  label,
  text,
  waiting,
  failed,
  disabled,
  onPrefer,
}: {
  label: string;
  text: string;
  waiting: boolean;
  failed: boolean;
  disabled: boolean;
  onPrefer: () => void;
}) {
  return (
    <article className="flex min-w-0 flex-col md:border-r md:border-border-subtle md:pr-6 md:last:border-r-0 md:last:pl-6 md:last:pr-0">
      <div className="mb-2 text-[11px] font-medium uppercase text-dim">{label}</div>
      <div className="min-h-[10rem] min-w-0 flex-1 overflow-auto text-left text-[13px] leading-relaxed text-primary">
        {waiting ? (
          <div className="text-dim">Waiting for answer...</div>
        ) : failed ? (
          <div className="whitespace-pre-wrap break-words text-danger">{text}</div>
        ) : (
          renderMarkdownText(text)
        )}
      </div>
      <MessageActionButton className="mt-3 min-h-9 w-full justify-center px-3 py-2" disabled={disabled} onClick={onPrefer}>
        Prefer {label}
      </MessageActionButton>
    </article>
  );
}

export const ContextShelf = memo(function ContextShelf({
  blocks,
  messageIndexOffset,
  currentConversationId,
  systemPrompt,
  toolDefinitions = [],
  remoteControlled = false,
  remoteControlStatus,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
}: {
  blocks: Extract<MessageBlock, { type: 'context' | 'summary' }>[];
  messageIndexOffset?: number;
  currentConversationId?: string | null;
  systemPrompt?: string | null;
  toolDefinitions?: LiveSessionToolDefinition[];
  remoteControlled?: boolean;
  remoteControlStatus?: string | null;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
}) {
  const normalizedSystemPrompt = systemPrompt?.trim() ?? '';
  const remoteControlText = remoteControlStatus?.trim() || 'You are remotely controlling this agent.';
  const toolDefinitionsText = formatToolDefinitions(toolDefinitions);
  const hasSystemPrompt = normalizedSystemPrompt.length > 0 || toolDefinitionsText.length > 0;
  const systemPromptTokenCount = estimateTextTokens([normalizedSystemPrompt, toolDefinitionsText].filter(Boolean).join('\n\n'));
  const extensionRegistry = useExtensionRegistry();
  const isWideArenaShelf =
    !hasSystemPrompt &&
    !remoteControlled &&
    blocks.length > 0 &&
    blocks.every((block) => block.type === 'context' && block.customType === 'model_arena_duel');
  const shelfClassName = isWideArenaShelf
    ? 'my-5 relative left-1/2 w-[min(96rem,calc(100vw_-_28rem))] min-w-full max-w-[calc(100vw_-_2rem)] -translate-x-1/2 space-y-1.5 text-dim'
    : 'my-5 w-full max-w-[72rem] space-y-1.5 text-dim';

  if (!hasSystemPrompt && !remoteControlled && blocks.length > 0 && blocks.every(isQuietLifecycleContext)) {
    const marker = blocks.every(isAutoResumeLifecycleContext) ? 'auto-resume' : 'workspace-change';
    return <QuietLifecycleMarker blocks={blocks} marker={marker} />;
  }

  const shouldRenderTopologyBlock = (block: Extract<MessageBlock, { type: 'context' | 'summary' }>): boolean => {
    if (!isTopologyBlock(block)) return false;
    if (block.customType !== 'child_conversation_topology' || !currentConversationId) return true;
    return parseTopologyBlockText(block.text).conversationId !== currentConversationId;
  };
  return (
    <div className={shelfClassName} data-context-shelf="1" data-context-shelf-layout={isWideArenaShelf ? 'wide' : undefined}>
      {hasSystemPrompt ? (
        <LazyDetails
          className={contextShelfItemClassName}
          dataAttrs={{ 'data-context-type': 'system_prompt' }}
          summaryClassName={contextShelfSummaryClassName}
          summary={
            <>
              <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]">
                <span className="text-dim/70 transition-transform group-open/item:rotate-90" aria-hidden="true">
                  ›
                </span>
                <span className="shrink-0 font-medium text-primary/90">System prompt</span>
                <span className="min-w-0 truncate text-dim/90">
                  {formatSystemPromptPreview(toolDefinitions.length, systemPromptTokenCount)}
                </span>
              </span>
              <span className="h-px bg-border-subtle" aria-hidden="true" />
            </>
          }
        >
          <div className={contextShelfSystemPromptBodyClassName}>
            {normalizedSystemPrompt ? <div>{renderText(normalizedSystemPrompt, { validatedFilePathTargets })}</div> : null}
            {toolDefinitionsText ? (
              <div className={normalizedSystemPrompt ? 'mt-4' : undefined}>
                <div className="mb-2 font-medium text-primary">Available tool definitions</div>
                {renderText(toolDefinitionsText, { validatedFilePathTargets })}
              </div>
            ) : null}
          </div>
        </LazyDetails>
      ) : null}
      {remoteControlled ? (
        <Disclosure
          className={contextShelfItemClassName}
          data-context-type="remote_control"
          summaryClassName={contextShelfSummaryClassName}
          bodyClassName="!border-t-0 !p-0"
          summary={
            <>
              <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]">
                <span className="text-dim/70 transition-transform group-open/item:rotate-90" aria-hidden="true">
                  ›
                </span>
                <span className="shrink-0 font-medium text-primary/90">Remote control</span>
                <span className="min-w-0 truncate text-dim/90">{remoteControlText}</span>
              </span>
              <span className="h-px bg-border-subtle" aria-hidden="true" />
            </>
          }
        >
          <div className={contextShelfBodyClassName}>{remoteControlText}</div>
        </Disclosure>
      ) : null}
      {blocks.map((block, index) => {
        const blockId = optionalTrimmedString(block.id);
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

        if (block.type === 'context' && block.customType === 'automation_run') {
          return (
            <AutomationRunContextBlock
              key={block.id ?? index}
              block={block}
              replySelectionScopeProps={replySelectionScopeProps}
              onOpenFilePath={onOpenFilePath}
              onOpenCheckpoint={onOpenCheckpoint}
              validatedFilePathTargets={validatedFilePathTargets}
            />
          );
        }

        if (block.type === 'context' && block.customType === 'model_arena_duel') {
          return (
            <div key={modelArenaTranscriptBlockKey(block, index)} className="my-4 w-full">
              <ModelArenaDuelContextBlock block={block} />
            </div>
          );
        }

        if (block.type === 'context' && block.customType) {
          const renderer = (extensionRegistry.transcriptBlocks ?? []).find((candidate) => candidate.id === block.customType);
          const extension = renderer
            ? (extensionRegistry.extensions ?? []).find((candidate) => candidate.id === renderer.extensionId && candidate.enabled)
            : null;
          if (renderer && extension) {
            return (
              <div
                key={block.customType === 'model_arena_duel' ? modelArenaTranscriptBlockKey(block, index) : (block.id ?? index)}
                className="my-4 w-full"
              >
                <NativeExtensionTranscriptBlockHost
                  extension={extension}
                  renderer={renderer}
                  block={block}
                  context={{ messageIndex: typeof messageIndexOffset === 'number' ? messageIndexOffset + index : undefined }}
                />
              </div>
            );
          }
        }

        return (
          <LazyDetails
            key={block.id ?? index}
            className={contextShelfItemClassName}
            dataAttrs={{
              'data-context-type': block.type === 'context' ? (block.customType ?? 'injected_context') : `summary:${block.kind}`,
              'data-summary-kind': block.type === 'summary' ? block.kind : undefined,
            }}
            summaryClassName={contextShelfSummaryClassName}
            summary={
              <>
                <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]">
                  <span className="text-dim/70 transition-transform group-open/item:rotate-90" aria-hidden="true">
                    ›
                  </span>
                  <span className="shrink-0 font-medium text-primary/90">{contextShelfLabel(block)}</span>
                  <span className="min-w-0 truncate text-dim/90">{contextShelfPreview(block)}</span>
                  {block.ts ? <span className="ui-message-meta shrink-0">{timeAgo(block.ts)}</span> : null}
                </span>
                <span className="h-px bg-border-subtle" aria-hidden="true" />
              </>
            }
          >
            <div {...replySelectionScopeProps} className={contextShelfBodyClassName}>
              {block.type === 'summary' && block.kind === 'compaction' ? (
                <p className="mb-2 text-[12px] leading-relaxed text-secondary">
                  {resolveCompactionSummaryDetail(block.title, block.detail)}
                </p>
              ) : null}
              {renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
            </div>
          </LazyDetails>
        );
      })}
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
  validatedFilePathTargets,
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
  validatedFilePathTargets?: ReadonlySet<string>;
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
  const canSaveEdit = editing && !editSaving && editDraft.trim().length > 0;

  useEffect(() => {
    if (!editing) {
      return;
    }

    setExtensionCommandContext('messageEdit.active', editing);
    setExtensionCommandContext('messageEdit.canSave', canSaveEdit);
    return () => {
      setExtensionCommandContext('messageEdit.active', null);
      setExtensionCommandContext('messageEdit.canSave', null);
    };
  }, [canSaveEdit, editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    function handleMessageEditCommand(event: Event) {
      const command = (event as CustomEvent<MessageEditCommand>).detail;
      if (command === 'save') {
        void saveEdit();
        return;
      }
      if (command === 'cancel') {
        cancelEdit();
      }
    }

    window.addEventListener(MESSAGE_EDIT_COMMAND_EVENT, handleMessageEditCommand);
    return () => window.removeEventListener(MESSAGE_EDIT_COMMAND_EVENT, handleMessageEditCommand);
  }, [cancelEdit, editing, saveEdit]);

  const transcriptTargetAttrs = block.id ? transcriptTargetAttributes({ kind: 'block', blockId: block.id }) : {};

  return (
    <div className="group flex w-full flex-col items-end gap-1.5" {...transcriptTargetAttrs} tabIndex={block.id ? -1 : undefined}>
      <div className={layout === 'compact' ? 'ml-auto min-w-0 max-w-[92%] sm:max-w-[88%]' : 'ml-auto min-w-0 max-w-[86%]'}>
        <MessageCard role="user" className="space-y-2">
          {hasImages && (
            <div className="space-y-2">
              {block.images?.map((image, index) => {
                const blockId = optionalTrimmedString(block.id);
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
              <Textarea
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
                className="min-h-[96px] w-full resize-y leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <MessageActionButton type="button" onClick={cancelEdit} disabled={editSaving}>
                  cancel
                </MessageActionButton>
                <MessageActionButton type="submit" tone="accent" disabled={editSaving || !editDraft.trim()}>
                  {editSaving ? 'rerunning…' : 'rerun'}
                </MessageActionButton>
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
              <SkillInvocationCard
                skillBlock={skillBlock}
                className="ui-skill-invocation-user"
                onOpenFilePath={onOpenFilePath}
                validatedFilePathTargets={validatedFilePathTargets}
              />
              {skillBlock.userMessage &&
                renderMarkdownText(skillBlock.userMessage, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
            </div>
          ) : hasText ? (
            <div className="px-1.5 pb-0.5">
              {renderMarkdownText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
            </div>
          ) : hasImages ? (
            <div className="px-1.5 pb-0.5 text-sm text-secondary">
              {imageCount === 1 ? 'Image attachment' : `${imageCount} image attachments`}
            </div>
          ) : null}
        </MessageCard>
        <div className="flex flex-wrap items-center gap-2 pt-1 pr-1">
          <MessageMeta>{timeAgo(block.ts)}</MessageMeta>
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
  variationSet,
  conversationId,
  messageIndex,
  onForkMessage,
  onRewindMessage,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun,
  layout = 'default',
  showCursor = false,
}: {
  block: Extract<MessageBlock, { type: 'text' }>;
  variationSet?: AssistantMessageVariationSet;
  conversationId?: string;
  messageIndex?: number;
  onForkMessage?: (messageIndex: number) => Promise<void> | void;
  onRewindMessage?: (messageIndex: number) => Promise<void> | void;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
  layout?: ChatViewLayout;
  showCursor?: boolean;
}) {
  const shouldShowCursor = showCursor || !!block.streaming;
  const blockId = optionalTrimmedString(block.id);
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const variations = variationSet?.variations ?? [];
  const selectedVariation = variations[selectedVariationIndex] ?? variations[0];
  const displayText = selectedVariation?.text ?? block.text;
  const hasVariations = variations.length > 1;

  useEffect(() => {
    setSelectedVariationIndex(0);
  }, [variationSet?.duelBlockId]);

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
  const rawRunCallbackRuns = useMemo(() => readRawRunCallbackLinkedRuns(displayText), [displayText]);
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
        <MessageCard {...replySelectionScopeProps} className="space-y-1 text-primary">
          {showRawRunCallbackCard ? (
            <RawRunCallbackCard
              runs={rawRunCallbackRuns}
              messageIndex={messageIndex}
              isInlineRunExpanded={isInlineRunExpanded}
              onToggleInlineRun={onToggleInlineRun}
            />
          ) : renderStreamingPlainText ? (
            renderStreamingMarkdownText(displayText, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
          ) : (
            renderText(displayText, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
          )}
          {shouldShowCursor && (
            <span
              className="inline-block w-[2px] h-[14px] bg-accent ml-0.5 rounded-sm"
              style={{ animation: 'cursorBlink 1s step-end infinite', verticalAlign: 'text-bottom' }}
            />
          )}
        </MessageCard>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <MessageMeta>{timeAgo(block.ts)}</MessageMeta>
          {hasVariations ? (
            <AssistantVariationPager
              current={selectedVariationIndex}
              total={variations.length}
              label={selectedVariation?.label}
              onPrevious={() => setSelectedVariationIndex((current) => (current - 1 + variations.length) % variations.length)}
              onNext={() => setSelectedVariationIndex((current) => (current + 1) % variations.length)}
            />
          ) : null}
          <span className="flex-1" />
          <MessageActions
            blockText={displayText}
            blockId={blockId}
            conversationId={conversationId}
            copyText={displayText}
            onRewind={onRewindMessage && typeof messageIndex === 'number' ? handleRewind : undefined}
            onFork={onForkMessage && typeof messageIndex === 'number' ? handleFork : undefined}
          />
        </div>
      </div>
    </div>
  );
});

function AssistantVariationPager({
  current,
  total,
  label,
  onPrevious,
  onNext,
}: {
  current: number;
  total: number;
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const displayIndex = current + 1;
  const modelLabel = label ? ` · ${label}` : '';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[6px] border border-border-subtle/70 bg-surface/40 px-1.5 py-0.5 text-[11px] text-secondary"
      data-model-arena-variation-pager="1"
    >
      <span className="ui-tooltip-host relative inline-flex">
        <MessageActionButton
          type="button"
          className="ui-message-action-button-icon min-h-6 min-w-6 text-[14px] opacity-90"
          aria-label="Previous model response"
          onClick={onPrevious}
        >
          ←
        </MessageActionButton>
        <Tooltip position="top-right">Previous model response</Tooltip>
      </span>
      <span className="whitespace-nowrap tabular-nums" aria-label={`Model response ${displayIndex} of ${total}${modelLabel}`}>
        Version {displayIndex} of {total}
      </span>
      <span className="ui-tooltip-host relative inline-flex">
        <MessageActionButton
          type="button"
          className="ui-message-action-button-icon min-h-6 min-w-6 text-[14px] opacity-90"
          aria-label="Next model response"
          onClick={onNext}
        >
          →
        </MessageActionButton>
        <Tooltip position="top-right">Next model response</Tooltip>
      </span>
    </span>
  );
}

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
    <Disclosure
      className="group w-full !rounded-none !border-0 !bg-transparent text-dim"
      summaryClassName="grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden"
      bodyClassName="!border-t-0 !p-0"
      summary={
        <>
          <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]">
            <span className="text-dim/70 transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
            <span className="shrink-0 font-medium text-secondary/80">{label}</span>
            <span className="min-w-0 truncate text-dim/80">{preview}</span>
            {ts ? <span className="ui-message-meta shrink-0 opacity-70">{timeAgo(ts)}</span> : null}
          </span>
          <span className="h-px bg-border-subtle" aria-hidden="true" />
        </>
      }
      {...dataAttributes}
    >
      <div className="mx-auto mt-3 w-[78%]">{children}</div>
    </Disclosure>
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
  const tokenCount = estimateTextTokens([normalizedText, toolDefinitionsText].filter(Boolean).join('\n\n'));
  return (
    <SystemEventFrame
      label="System prompt"
      preview={formatSystemPromptPreview(toolDefinitions.length, tokenCount)}
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
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
  isInlineRunExpanded,
  onToggleInlineRun,
}: {
  block: Extract<MessageBlock, { type: 'context' }>;
  messageIndex?: number;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onSelectionGesture?: ReplySelectionGestureHandler;
  isInlineRunExpanded?: (inlineRunKey: string) => boolean;
  onToggleInlineRun?: (inlineRunKey: string) => void;
}) {
  const label = formatSystemEventLabel(block.customType);
  const blockId = optionalTrimmedString(block.id);
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
          renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })
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
  const isChildTopology = block.customType === 'child_conversation_topology';
  const { title, conversationId, kind, sourceMessageId, sourcePreview } = useMemo(() => parseTopologyBlockText(block.text), [block.text]);

  const handleClick = useCallback(() => {
    if (conversationId) {
      dispatchOpenWorkbenchChat({ conversationId, title: title ?? undefined });
    }
  }, [conversationId, title]);

  const label = (() => {
    if (kind === 'rewind') return isChildTopology ? 'Rewound to' : '← Rewound from';
    if (kind === 'duplicate') return isChildTopology ? 'Duplicated to' : '← Duplicated from';
    return isChildTopology ? 'Forked to' : '← Forked from';
  })();

  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] text-dim/70" data-topology-kind={block.customType}>
      <span className="h-px bg-border-subtle" aria-hidden="true" />
      <span className="flex min-w-0 max-w-[78vw] items-center gap-1.5 sm:max-w-[42rem]">
        <span className="shrink-0">{label}</span>
        {conversationId ? (
          <TextButton
            onClick={handleClick}
            className="min-w-0 truncate text-accent/80 hover:text-accent hover:underline focus-visible:outline-none"
            title={sourceMessageId ? `Source: ${sourcePreview ?? sourceMessageId}` : undefined}
          >
            {title}
          </TextButton>
        ) : (
          <span className="min-w-0 truncate">{title}</span>
        )}
      </span>
      <span className="h-px bg-border-subtle" aria-hidden="true" />
    </div>
  );
});

export const SummaryMessage = memo(function SummaryMessage({
  block,
  messageIndex,
  onOpenFilePath,
  validatedFilePathTargets,
  onOpenCheckpoint,
  onSelectionGesture,
}: {
  block: Extract<MessageBlock, { type: 'summary' }>;
  messageIndex?: number;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
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
          label: block.title || 'Reused conversation summaries',
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
  const blockId = optionalTrimmedString(block.id);
  const replySelectionScopeProps = buildReplySelectionScopeProps(messageIndex, blockId, onSelectionGesture);

  if (block.kind === 'compaction') {
    const markerLabel = resolveCompactionMarkerLabel(block.title);
    return (
      <LazyDetails
        className="group my-5 block w-full !overflow-visible !rounded-none !border-0 !bg-transparent text-dim"
        dataAttrs={{ 'data-summary-kind': block.kind, 'data-compaction-marker': '1' }}
        summaryClassName="grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-2 text-[11px] marker:hidden hover:text-secondary before:!content-none after:!content-none [&::-webkit-details-marker]:hidden"
        summary={
          <>
            <span className="flex items-center gap-1.5 text-dim/85">
              <span className="text-dim/70 transition-transform group-open:rotate-90" aria-hidden="true">
                ›
              </span>
              <span aria-hidden="true">▣</span>
              <span>{markerLabel}</span>
            </span>
            <span className="h-px bg-border-subtle" aria-hidden="true" />
          </>
        }
      >
        <div {...replySelectionScopeProps} className="mx-auto mt-3 w-[78%] space-y-3 text-[13px] leading-relaxed text-primary/90">
          <p className="text-[12px] leading-relaxed text-secondary">{summaryPresentation.detail}</p>
          {renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
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
        {renderText(block.text, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}
      </div>
    </SystemEventFrame>
  );
});
