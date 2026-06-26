import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../client/api';
import { getDesktopBridge } from '../desktop/desktopBridge';
import { openDesktopRealtimeSocket } from '../desktop/desktopRealtimeConnection';
import type {
  ConversationAggregateDelta,
  ConversationAggregateState,
  ConversationBootstrapState,
  DesktopAppEvent,
  DesktopConversationState,
  DisplayBlock,
  PromptAttachmentRefInput,
  PromptImageInput,
  SseEvent,
  ThreadGoal,
} from '../shared/types';
import { recordRendererTelemetry } from '../telemetry/appTelemetry';
import { detectConversationSurfaceType, getOrCreateConversationSurfaceId } from './sessionStream';

const MAX_DESKTOP_CONVERSATION_STATE_TAIL_BLOCKS = 10000;
const MAX_CACHED_DESKTOP_CONVERSATION_STATES = 8;
const STREAM_CONTROL_FLUSH_INTERVAL_MS = 16;
const STREAM_FRAME_FALLBACK_FLUSH_INTERVAL_MS = 100;
const POST_SEND_REFRESH_DELAYS_MS = [500, 1500, 4000] as const;
const RUNNING_SESSION_RECOVERY_REFRESH_DELAYS_MS = [3000, 8000, 16000, 30000, 60000, 120000, 240000] as const;
const DESKTOP_CONVERSATION_STATE_REFRESH_EVENT = 'neon-pilot:desktop-conversation-state-refresh';
const desktopConversationStateCache = new Map<string, DesktopConversationState>();
const desktopConversationStateInflight = new Map<string, Promise<DesktopConversationState>>();

function desktopConversationStateFromAggregate(aggregate: ConversationAggregateState): DesktopConversationState {
  const state = !('conversation' in aggregate)
    ? (aggregate as unknown as DesktopConversationState)
    : {
        ...aggregate.conversation,
        activity: aggregate.activity,
        revision: aggregate.revision,
      };
  return presentDesktopConversationState(state);
}

interface DesktopConversationStateOptions {
  tailBlocks?: number;
  includeToolBlocks?: boolean;
  version?: number | string;
}

interface UseDesktopConversationStateOptions extends DesktopConversationStateOptions {
  enabled?: boolean;
}

export function clearDesktopConversationStateCacheForTests(): void {
  desktopConversationStateCache.clear();
  desktopConversationStateInflight.clear();
}

function createEmptyDesktopConversationStreamState(): DesktopConversationState['stream'] {
  return {
    blocks: [],
    blockOffset: 0,
    totalBlocks: 0,
    hasSnapshot: false,
    isStreaming: false,
    isCompacting: false,
    error: null,
    title: null,
    tokens: null,
    cost: null,
    contextUsage: null,
    pendingQueue: { steering: [], followUp: [] },
    parallelJobs: [],
    presence: {
      surfaces: [],
      controllerSurfaceId: null,
      controllerSurfaceType: null,
      controllerAcquiredAt: null,
    },
    goalState: null,
    systemPrompt: null,
    toolDefinitions: [],
    cwdChange: null,
  };
}

export function normalizeDesktopConversationStateTailBlocks(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(MAX_DESKTOP_CONVERSATION_STATE_TAIL_BLOCKS, value)
    : undefined;
}

function findLastToolUseIndex(blocks: DisplayBlock[], toolCallId: string): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block?.type === 'tool_use' && block.toolCallId === toolCallId) {
      return index;
    }
  }
  return -1;
}

const EXTENSION_HOST_RPC_FAILURE_PATTERN = /^Extension host RPC request\s+(.+?)\s+failed at\s+https?:\/\/[^/]+\/action:\s+(.+)$/;

function presentToolBlockOutput(input: { output: string; status?: 'running' | 'ok' | 'error' }): {
  output: string;
  status?: 'running' | 'ok' | 'error';
} {
  const extensionHostRpcFailure = EXTENSION_HOST_RPC_FAILURE_PATTERN.exec(input.output.trim());
  const isError = input.status === 'error' || Boolean(extensionHostRpcFailure);
  if (!extensionHostRpcFailure) {
    return { output: input.output, ...(input.status ? { status: input.status } : {}) };
  }

  const message = extensionHostRpcFailure[2]?.trim();
  const output = /^This operation was aborted\.?$/i.test(message ?? '')
    ? 'Stopped before finishing. The tool call was interrupted or cancelled.'
    : message
      ? `Extension action failed: ${message}`
      : 'Extension action failed.';
  return { output, ...(isError ? { status: 'error' as const } : {}) };
}

function presentStreamBlock(block: DisplayBlock): DisplayBlock {
  if (block.type !== 'tool_use') {
    return block;
  }

  const presented = presentToolBlockOutput({ output: block.output ?? '', status: block.status });
  if (presented.output === block.output && presented.status === block.status) {
    return block;
  }

  return {
    ...block,
    ...presented,
  };
}

function presentStreamBlocks(blocks: DisplayBlock[]): DisplayBlock[] {
  return blocks.map(presentStreamBlock);
}

function presentDesktopConversationState(state: DesktopConversationState): DesktopConversationState {
  return {
    ...state,
    sessionDetail: state.sessionDetail
      ? {
          ...state.sessionDetail,
          blocks: presentStreamBlocks(state.sessionDetail.blocks),
        }
      : state.sessionDetail,
    stream: {
      ...state.stream,
      blocks: presentStreamBlocks(state.stream.blocks),
    },
  };
}

function clearDesktopConversationStreamingState(state: DesktopConversationState): DesktopConversationState {
  return {
    ...state,
    liveSession:
      state.liveSession.live === true
        ? {
            ...state.liveSession,
            isStreaming: false,
            hasStaleTurnState: false,
          }
        : state.liveSession,
    stream: {
      ...state.stream,
      isStreaming: false,
      isCompacting: false,
      blocks: state.stream.blocks.map((block) =>
        block.type === 'tool_use' && (block.running === true || block.status === 'running')
          ? {
              ...block,
              running: false,
              status: 'error',
              output: block.output || 'Stopped before finishing. The tool call was interrupted or cancelled.',
            }
          : block,
      ),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeGoalStatus(value: unknown): ThreadGoal['status'] {
  if (typeof value === 'string' && ['active', 'paused', 'complete'].includes(value)) {
    return value as ThreadGoal['status'];
  }
  return 'complete';
}

function readGoalStateFromToolDetails(toolName: string | undefined, details: unknown): ThreadGoal | null | undefined {
  if (toolName !== 'goal' || !isRecord(details) || !isRecord(details.state)) {
    return undefined;
  }
  const state = details.state;
  if (typeof state.objective !== 'string') {
    return undefined;
  }
  const status = normalizeGoalStatus(state.status);
  if (!state.objective.trim() || status === 'complete') {
    return null;
  }
  return {
    objective: state.objective,
    status,
    tasks: [],
    stopReason: typeof state.stopReason === 'string' ? state.stopReason : null,
    startedAt: typeof state.startedAt === 'string' ? state.startedAt : typeof state.updatedAt === 'string' ? state.updatedAt : null,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null,
  };
}

function readPartialToolText(partialResult: unknown): string {
  if (typeof partialResult === 'string') return partialResult;
  if (partialResult && typeof partialResult === 'object' && 'content' in partialResult) {
    const content = (partialResult as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const first = content[0];
      if (first && typeof first === 'object' && typeof (first as { text?: unknown }).text === 'string') {
        return (first as { text: string }).text;
      }
    }
  }
  return '';
}

function queuedPromptPreviewsEqual(
  left: DesktopConversationState['stream']['pendingQueue']['steering'],
  right: DesktopConversationState['stream']['pendingQueue']['steering'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return item.id === other?.id && item.text === other.text && item.imageCount === other.imageCount;
  });
}

function parallelPromptPreviewsEqual(
  left: DesktopConversationState['stream']['parallelJobs'] | undefined,
  right: DesktopConversationState['stream']['parallelJobs'] | undefined,
): boolean {
  if (left === right) return true;
  const leftItems = left ?? [];
  const rightItems = right ?? [];
  if (leftItems.length !== rightItems.length) return false;
  return leftItems.every((item, index) => {
    const other = rightItems[index];
    return (
      item.id === other?.id &&
      item.prompt === other.prompt &&
      item.childConversationId === other.childConversationId &&
      item.status === other.status &&
      item.imageCount === other.imageCount
    );
  });
}

function tokenCountsEqual(
  left: DesktopConversationState['stream']['tokens'],
  right: DesktopConversationState['stream']['tokens'],
): boolean {
  return (
    left === right ||
    (left !== null && right !== null && left.input === right.input && left.output === right.output && left.total === right.total)
  );
}

export function applyDesktopConversationStreamEvent(
  stream: DesktopConversationState['stream'],
  event: SseEvent,
): DesktopConversationState['stream'] {
  switch (event.type) {
    case 'snapshot':
      return {
        ...stream,
        blocks: presentStreamBlocks(event.blocks),
        blockOffset: event.blockOffset,
        totalBlocks: event.totalBlocks,
        hasSnapshot: true,
        isStreaming: event.isStreaming,
        isCompacting: event.isCompacting === true,
        error: null,
        goalState: 'goalState' in event ? (event.goalState ?? null) : stream.goalState,
        systemPrompt: 'systemPrompt' in event ? (event.systemPrompt ?? null) : stream.systemPrompt,
        toolDefinitions: 'toolDefinitions' in event ? (event.toolDefinitions ?? []) : stream.toolDefinitions,
      };
    case 'agent_start':
      if (stream.isStreaming && stream.error === null) {
        return stream;
      }
      return { ...stream, isStreaming: true, error: null };
    case 'agent_end':
    case 'turn_end':
      if (!stream.isStreaming) {
        return stream;
      }
      return { ...stream, isStreaming: false };
    case 'compaction_start':
      if (stream.isCompacting) {
        return stream;
      }
      return { ...stream, isCompacting: true };
    case 'compaction_end':
      return event.errorMessage
        ? {
            ...stream,
            blocks: [
              ...stream.blocks,
              { type: 'error', id: `error-${Date.now()}`, message: event.errorMessage, ts: new Date().toISOString() },
            ],
            isCompacting: false,
            error: event.errorMessage,
          }
        : stream.isCompacting
          ? { ...stream, isCompacting: false }
          : stream;
    case 'cwd_changed':
      if (
        stream.cwdChange?.newConversationId === event.newConversationId &&
        stream.cwdChange.cwd === event.cwd &&
        stream.cwdChange.autoContinued === event.autoContinued
      ) {
        return stream;
      }
      return { ...stream, cwdChange: { newConversationId: event.newConversationId, cwd: event.cwd, autoContinued: event.autoContinued } };
    case 'user_message': {
      const blocks = [...stream.blocks];
      blocks.push(event.block);
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'text_delta': {
      if (!event.delta) {
        return stream;
      }
      const blocks = [...stream.blocks];
      const last = blocks.at(-1);
      if (last?.type === 'text') blocks[blocks.length - 1] = { ...last, text: `${last.text ?? ''}${event.delta}` };
      else blocks.push({ type: 'text', id: `text-${Date.now()}`, text: event.delta, ts: new Date().toISOString() });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'thinking_delta': {
      if (!event.delta) {
        return stream;
      }
      const blocks = [...stream.blocks];
      const last = blocks.at(-1);
      if (last?.type === 'thinking') blocks[blocks.length - 1] = { ...last, text: `${last.text ?? ''}${event.delta}` };
      else blocks.push({ type: 'thinking', id: `thinking-${Date.now()}`, text: event.delta, ts: new Date().toISOString() });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'tool_start': {
      const blocks = [...stream.blocks];
      blocks.push({
        type: 'tool_use',
        id: event.toolCallId,
        toolCallId: event.toolCallId,
        tool: event.toolName,
        input: event.args,
        output: '',
        status: 'running',
        running: true,
        ts: new Date().toISOString(),
      });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'tool_update': {
      const partialText = readPartialToolText(event.partialResult);
      if (!partialText) {
        return stream;
      }
      const index = findLastToolUseIndex(stream.blocks, event.toolCallId);
      if (index >= 0 && stream.blocks[index]?.type === 'tool_use') {
        const blocks = [...stream.blocks];
        const block = blocks[index];
        blocks[index] = {
          ...block,
          ...presentToolBlockOutput({ output: `${block.output ?? ''}${partialText}`, status: block.status }),
        };
        return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
      }
      return stream;
    }
    case 'tool_end': {
      const index = findLastToolUseIndex(stream.blocks, event.toolCallId);
      let blocks = stream.blocks;
      if (index >= 0 && stream.blocks[index]?.type === 'tool_use') {
        blocks = [...stream.blocks];
        const block = blocks[index];
        const presented = presentToolBlockOutput({ output: event.output, status: event.isError ? 'error' : 'ok' });
        blocks[index] = {
          ...block,
          output: presented.output,
          status: presented.status,
          running: false,
          durationMs: event.durationMs,
          details: event.details ?? block.details,
        };
      }
      const goalState = readGoalStateFromToolDetails(event.toolName, event.details);
      if (blocks === stream.blocks && goalState === undefined) {
        return stream;
      }
      return {
        ...stream,
        blocks,
        totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length),
        ...(goalState !== undefined ? { goalState } : {}),
      };
    }
    case 'queue_state':
      if (
        queuedPromptPreviewsEqual(stream.pendingQueue.steering, event.steering) &&
        queuedPromptPreviewsEqual(stream.pendingQueue.followUp, event.followUp)
      ) {
        return stream;
      }
      return { ...stream, pendingQueue: { steering: event.steering, followUp: event.followUp } };
    case 'parallel_state':
      if (parallelPromptPreviewsEqual(stream.parallelJobs, event.jobs)) {
        return stream;
      }
      return { ...stream, parallelJobs: event.jobs };
    case 'presence_state':
      if (stream.presence === event.state) {
        return stream;
      }
      return { ...stream, presence: event.state };
    case 'title_update':
      if (stream.title === event.title) {
        return stream;
      }
      return { ...stream, title: event.title };
    case 'context_usage':
      if (stream.contextUsage === event.usage) {
        return stream;
      }
      return { ...stream, contextUsage: event.usage };
    case 'stats_update':
      if (tokenCountsEqual(stream.tokens, event.tokens) && stream.cost === event.cost) {
        return stream;
      }
      return { ...stream, tokens: event.tokens, cost: event.cost };
    case 'error': {
      const blocks = [...stream.blocks];
      blocks.push({ type: 'error', id: `error-${Date.now()}`, message: event.message, ts: new Date().toISOString() });
      return {
        ...stream,
        blocks,
        isStreaming: false,
        error: event.message,
        totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length),
      };
    }
    default:
      return stream;
  }
}

export function applyDesktopConversationStreamEvents(
  stream: DesktopConversationState['stream'],
  events: readonly SseEvent[],
): DesktopConversationState['stream'] {
  let next = stream;
  for (const event of events) {
    next = applyDesktopConversationStreamEvent(next, event);
  }
  return next;
}

function mergeDesktopConversationState(
  previous: DesktopConversationState | null,
  next: DesktopConversationState,
): DesktopConversationState {
  const previousCwdChange = previous?.conversationId === next.conversationId ? previous.stream.cwdChange : null;
  const previousHasLiveTail =
    previous?.conversationId === next.conversationId &&
    (previous.stream.isStreaming === true || (previous.liveSession.live === true && previous.liveSession.isStreaming === true));
  const nextHasLiveTail = next.stream.isStreaming === true || (next.liveSession.live === true && next.liveSession.isStreaming === true);
  const previousStreamBlockEnd = previous ? previous.stream.blockOffset + previous.stream.blocks.length : 0;
  const nextStreamBlockEnd = next.stream.blockOffset + next.stream.blocks.length;
  const previousOptimisticLive =
    previous?.conversationId === next.conversationId &&
    previous.liveSession.live === true &&
    previous.sessionDetail === null &&
    !previous.stream.hasSnapshot &&
    previous.stream.blocks.length === 0;
  const nextWithPreservedOptimisticLive =
    previousOptimisticLive && next.liveSession.live === false
      ? {
          ...next,
          liveSession: previous.liveSession,
          stream: {
            ...next.stream,
            isStreaming: next.stream.isStreaming || previous.stream.isStreaming,
          },
        }
      : next;
  const nextWithPreservedLiveTail =
    previousHasLiveTail && nextHasLiveTail && previous && previousStreamBlockEnd > nextStreamBlockEnd
      ? {
          ...nextWithPreservedOptimisticLive,
          stream: {
            ...nextWithPreservedOptimisticLive.stream,
            blocks: previous.stream.blocks,
            blockOffset: previous.stream.blockOffset,
            totalBlocks: Math.max(nextWithPreservedOptimisticLive.stream.totalBlocks, previous.stream.totalBlocks, previousStreamBlockEnd),
            hasSnapshot: nextWithPreservedOptimisticLive.stream.hasSnapshot || previous.stream.hasSnapshot,
          },
        }
      : nextWithPreservedOptimisticLive;

  if (!previousCwdChange || nextWithPreservedLiveTail.stream.cwdChange) {
    return nextWithPreservedLiveTail;
  }

  return {
    ...nextWithPreservedLiveTail,
    stream: {
      ...nextWithPreservedLiveTail.stream,
      cwdChange: previousCwdChange,
    },
  };
}

function buildDesktopConversationStateCacheKey(
  conversationId: string,
  tailBlocks: number | undefined,
  includeToolBlocks: boolean | undefined,
  version: number | string | undefined,
): string {
  return `${conversationId}:${tailBlocks ?? 'default'}:${includeToolBlocks === false ? 'conversation' : 'full'}:${version ?? 'current'}`;
}

function isConversationLiveStreaming(state: DesktopConversationState | null, conversationId: string): boolean {
  if (state?.conversationId !== conversationId) {
    return false;
  }
  return state.stream.isStreaming === true || (state.liveSession.live === true && state.liveSession.isStreaming === true);
}

function rememberDesktopConversationState(
  cache: Map<string, DesktopConversationState>,
  key: string,
  nextState: DesktopConversationState,
): void {
  const presentedState = presentDesktopConversationState(nextState);
  cache.delete(key);
  cache.set(key, presentedState);
  while (cache.size > MAX_CACHED_DESKTOP_CONVERSATION_STATES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    cache.delete(oldestKey);
  }
}

export function primeDesktopConversationStateCache(
  conversationId: string,
  bootstrap: ConversationBootstrapState,
  options?: DesktopConversationStateOptions,
): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId || bootstrap.conversationId !== normalizedConversationId) {
    return;
  }

  const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
  const cacheKey = buildDesktopConversationStateCacheKey(
    normalizedConversationId,
    tailBlocks,
    options?.includeToolBlocks,
    options?.version,
  );
  rememberDesktopConversationState(
    desktopConversationStateCache,
    cacheKey,
    createDesktopConversationStateFromBootstrap(normalizedConversationId, bootstrap),
  );
}

export function primeReservedDesktopConversationStateCache(
  input: { conversationId: string; sessionFile: string; cwd: string },
  options?: DesktopConversationStateOptions,
): void {
  const normalizedConversationId = input.conversationId.trim();
  const sessionFile = input.sessionFile.trim();
  if (!normalizedConversationId || !sessionFile) {
    return;
  }

  const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
  const cacheKey = buildDesktopConversationStateCacheKey(
    normalizedConversationId,
    tailBlocks,
    options?.includeToolBlocks,
    options?.version,
  );
  rememberDesktopConversationState(desktopConversationStateCache, cacheKey, {
    conversationId: normalizedConversationId,
    sessionDetail: null,
    liveSession: {
      live: true,
      id: normalizedConversationId,
      cwd: input.cwd,
      sessionFile,
      isStreaming: false,
    },
    stream: createEmptyDesktopConversationStreamState(),
  });
}

function createDesktopConversationStateFromBootstrap(
  conversationId: string,
  bootstrap: ConversationBootstrapState,
): DesktopConversationState {
  const stream = createEmptyDesktopConversationStreamState();
  const sessionDetail = bootstrap.sessionDetail;
  const liveSession = bootstrap.liveSession ?? { live: false as const };
  const seededStream = liveSession.live ? { ...stream, isStreaming: liveSession.isStreaming } : stream;
  return presentDesktopConversationState({
    conversationId,
    sessionDetail,
    liveSession,
    stream: sessionDetail
      ? {
          ...seededStream,
          blocks: sessionDetail.blocks,
          blockOffset: sessionDetail.blockOffset,
          totalBlocks: sessionDetail.totalBlocks,
          contextUsage: sessionDetail.contextUsage,
        }
      : seededStream,
  });
}

function fetchDesktopConversationStateCached(
  conversationId: string,
  options?: DesktopConversationStateOptions,
): Promise<DesktopConversationState> {
  const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
  const cacheKey = buildDesktopConversationStateCacheKey(conversationId, tailBlocks, options?.includeToolBlocks, options?.version);
  const inflight = desktopConversationStateInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = api
    .conversationAggregate(conversationId, {
      ...(tailBlocks !== undefined ? { tailBlocks } : {}),
      ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
    })
    .then((nextAggregate: ConversationAggregateState) => {
      const nextState = desktopConversationStateFromAggregate(nextAggregate);
      const previous = desktopConversationStateCache.get(cacheKey) ?? null;
      const mergedState = mergeDesktopConversationState(previous, nextState);
      rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
      return mergedState;
    })
    .finally(() => {
      desktopConversationStateInflight.delete(cacheKey);
    });

  desktopConversationStateInflight.set(cacheKey, request);
  return request;
}

export function prefetchDesktopConversationState(
  conversationId: string,
  options?: DesktopConversationStateOptions,
): Promise<DesktopConversationState> | null {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    return null;
  }

  return fetchDesktopConversationStateCached(normalizedConversationId, options);
}

export function notifyDesktopConversationStateRefresh(conversationId: string): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId || typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(DESKTOP_CONVERSATION_STATE_REFRESH_EVENT, {
      detail: { conversationId: normalizedConversationId },
    }),
  );
}

export function useDesktopConversationState(conversationId: string | null, options?: UseDesktopConversationStateOptions) {
  const enabled = options?.enabled !== false && Boolean(conversationId);
  const bridge = getDesktopBridge();
  const surfaceId = useMemo(() => getOrCreateConversationSurfaceId(), []);
  const surfaceType = useMemo(() => detectConversationSurfaceType(), []);
  const [mode, setMode] = useState<'local' | 'inactive'>(enabled ? 'local' : 'inactive');
  const [state, setState] = useState<DesktopConversationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectVersion, setConnectVersion] = useState(0);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const pendingStreamEventsRef = useRef<SseEvent[]>([]);
  const pendingStreamFrameRef = useRef<number | null>(null);
  const pendingStreamFlushTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pendingStreamFlushDelayRef = useRef<number | null>(null);
  const reconnectRetryRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const postSendRefreshTimersRef = useRef<Array<ReturnType<typeof window.setTimeout>>>([]);
  const runningSessionRecoveryRefreshTimersRef = useRef<Array<ReturnType<typeof window.setTimeout>>>([]);
  const matchedState = state?.conversationId === conversationId ? state : null;
  const stateRef = useRef<DesktopConversationState | null>(state);
  const activeConversationIdRef = useRef(conversationId);
  stateRef.current = state;
  activeConversationIdRef.current = conversationId;

  const clearPostSendRefreshTimers = useCallback(() => {
    for (const timer of postSendRefreshTimersRef.current) {
      window.clearTimeout(timer);
    }
    postSendRefreshTimersRef.current = [];
  }, []);

  const clearRunningSessionRecoveryRefreshTimers = useCallback(() => {
    for (const timer of runningSessionRecoveryRefreshTimersRef.current) {
      window.clearTimeout(timer);
    }
    runningSessionRecoveryRefreshTimersRef.current = [];
  }, []);

  useEffect(() => clearPostSendRefreshTimers, [clearPostSendRefreshTimers, conversationId]);
  useEffect(() => clearRunningSessionRecoveryRefreshTimers, [clearRunningSessionRecoveryRefreshTimers, conversationId]);

  useEffect(() => {
    if (!enabled) {
      setMode('inactive');
      setState(null);
      setError(null);
      return;
    }

    setMode('local');
  }, [bridge, enabled, connectVersion]);

  useEffect(() => {
    if (mode !== 'local' || !conversationId) {
      return;
    }

    let closed = false;
    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    const requestOptions = {
      ...(tailBlocks !== undefined ? { tailBlocks } : {}),
      ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
      ...(options?.version !== undefined ? { version: options.version } : {}),
    } satisfies DesktopConversationStateOptions;
    const cacheKey = buildDesktopConversationStateCacheKey(
      conversationId,
      tailBlocks,
      requestOptions.includeToolBlocks,
      requestOptions.version,
    );
    const cachedState = desktopConversationStateCache.get(cacheKey) ?? null;
    setState((current) => (current?.conversationId === conversationId ? current : cachedState));
    setError(null);

    void fetchDesktopConversationStateCached(conversationId, requestOptions)
      .then((nextState) => {
        if (!closed) {
          setState((previous) => {
            const mergedState = mergeDesktopConversationState(previous, nextState);
            rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
            return mergedState;
          });
          setError(null);
        }
      })
      .catch((nextError) => {
        if (!closed) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      });

    return () => {
      closed = true;
    };
  }, [
    bridge,
    conversationId,
    mode,
    options?.includeToolBlocks,
    options?.tailBlocks,
    options?.version,
    subscriptionVersion,
    surfaceId,
    surfaceType,
  ]);

  useEffect(() => {
    if (mode !== 'local' || !conversationId) {
      return;
    }

    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    const requestOptions = {
      ...(tailBlocks !== undefined ? { tailBlocks } : {}),
      ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
      ...(options?.version !== undefined ? { version: options.version } : {}),
    } satisfies DesktopConversationStateOptions;
    const cacheKey = buildDesktopConversationStateCacheKey(
      conversationId,
      tailBlocks,
      requestOptions.includeToolBlocks,
      requestOptions.version,
    );
    let closed = false;
    let socket: WebSocket | null = null;
    let subscriptionId: string | null = null;

    const clearPendingStreamFlushTimer = () => {
      if (pendingStreamFlushTimerRef.current === null) {
        return;
      }
      window.clearTimeout(pendingStreamFlushTimerRef.current);
      pendingStreamFlushTimerRef.current = null;
      pendingStreamFlushDelayRef.current = null;
    };

    const clearPendingStreamFrame = () => {
      if (pendingStreamFrameRef.current === null) {
        return;
      }
      window.cancelAnimationFrame(pendingStreamFrameRef.current);
      pendingStreamFrameRef.current = null;
    };

    const clearPendingStreamFlush = () => {
      clearPendingStreamFlushTimer();
      clearPendingStreamFrame();
    };

    const flushPendingStreamEvents = () => {
      clearPendingStreamFlush();
      const events = pendingStreamEventsRef.current;
      pendingStreamEventsRef.current = [];
      if (events.length === 0) {
        return;
      }

      const flushStartedAtMs = performance.now();
      let applied = false;
      let previousBlockCount = 0;
      let nextBlockCount = 0;
      setState((previous) => {
        if (previous?.conversationId !== conversationId) {
          return previous;
        }

        previousBlockCount = previous.stream.blocks.length;
        const stream = applyDesktopConversationStreamEvents(previous.stream, events);
        nextBlockCount = stream.blocks.length;
        applied = true;
        const latestTitleEvent = events.findLast((streamEvent) => streamEvent.type === 'title_update');
        if (stream === previous.stream && latestTitleEvent?.type !== 'title_update') {
          return previous;
        }
        return {
          ...previous,
          stream,
          liveSession: previous.liveSession?.live
            ? {
                ...previous.liveSession,
                ...(latestTitleEvent?.type === 'title_update' ? { title: latestTitleEvent.title } : {}),
                isStreaming: stream.isStreaming,
              }
            : previous.liveSession,
        };
      });
      const durationMs = performance.now() - flushStartedAtMs;
      if (
        applied &&
        (durationMs >= 8 || events.some((streamEvent) => streamEvent.type === 'user_message' || streamEvent.type === 'agent_start'))
      ) {
        const eventCounts = events.reduce<Record<string, number>>((counts, streamEvent) => {
          counts[streamEvent.type] = (counts[streamEvent.type] ?? 0) + 1;
          return counts;
        }, {});
        recordRendererTelemetry({
          category: 'renderer_performance',
          name: 'conversation_stream_flush',
          route: `${window.location.pathname}${window.location.search}`,
          sessionId: conversationId,
          durationMs: Math.round(durationMs),
          count: events.length,
          metadata: { eventCounts, previousBlockCount, nextBlockCount },
        });
      }
      setError(null);
    };

    const schedulePendingStreamEventsTimerFlush = (delayMs: number) => {
      if (pendingStreamFlushTimerRef.current !== null) {
        if ((pendingStreamFlushDelayRef.current ?? Number.POSITIVE_INFINITY) <= delayMs) {
          return;
        }
        window.clearTimeout(pendingStreamFlushTimerRef.current);
      }
      pendingStreamFlushDelayRef.current = delayMs;
      pendingStreamFlushTimerRef.current = window.setTimeout(flushPendingStreamEvents, delayMs);
    };

    const schedulePendingStreamEventsFrameFlush = () => {
      if (pendingStreamFrameRef.current === null) {
        pendingStreamFrameRef.current = window.requestAnimationFrame(flushPendingStreamEvents);
      }
      schedulePendingStreamEventsTimerFlush(STREAM_FRAME_FALLBACK_FLUSH_INTERVAL_MS);
    };

    const shouldFlushStreamEventImmediately = (streamEvent: SseEvent): boolean =>
      streamEvent.type === 'error' ||
      streamEvent.type === 'cwd_changed' ||
      streamEvent.type === 'agent_end' ||
      streamEvent.type === 'turn_end';

    const shouldFlushStreamEventOnFrame = (streamEvent: SseEvent): boolean =>
      streamEvent.type === 'text_delta' || streamEvent.type === 'thinking_delta' || streamEvent.type === 'tool_update';

    const enqueueStreamEvent = (streamEvent: SseEvent) => {
      if (closed) {
        return;
      }
      pendingStreamEventsRef.current.push(streamEvent);
      if (shouldFlushStreamEventImmediately(streamEvent)) {
        flushPendingStreamEvents();
      } else if (shouldFlushStreamEventOnFrame(streamEvent)) {
        schedulePendingStreamEventsFrameFlush();
      } else {
        schedulePendingStreamEventsTimerFlush(STREAM_CONTROL_FLUSH_INTERVAL_MS);
      }
    };

    const applyAggregateActivityDelta = (delta: Extract<ConversationAggregateDelta, { type: 'activity' }>) => {
      setState((previous) =>
        previous?.conversationId === conversationId
          ? {
              ...previous,
              activity: delta.activity,
              revision: delta.revision,
            }
          : previous,
      );
    };

    const applyAggregateSnapshot = (aggregate: ConversationAggregateState) => {
      if (aggregate.conversationId !== conversationId) {
        return;
      }
      const nextState = desktopConversationStateFromAggregate(aggregate);
      setState((previous) => {
        const mergedState = mergeDesktopConversationState(previous, nextState);
        rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
        return mergedState;
      });
      setError(null);
    };

    const handleAggregateDelta = (delta: ConversationAggregateDelta) => {
      if (delta.conversationId !== conversationId) {
        return;
      }
      if (delta.type === 'activity') {
        applyAggregateActivityDelta(delta);
        return;
      }
      for (const streamEvent of delta.events) {
        enqueueStreamEvent(streamEvent);
      }
      if (delta.activity) {
        applyAggregateActivityDelta({
          type: 'activity',
          conversationId: delta.conversationId,
          revision: delta.revision,
          activity: delta.activity,
        });
      }
    };

    const handleRealtimeMessage = (event: MessageEvent) => {
      if (closed) {
        return;
      }
      try {
        const message = JSON.parse(String(event.data)) as
          | { type: 'conversation_snapshot'; id?: string; subscriptionId: string; state: ConversationAggregateState }
          | { type: 'conversation_delta'; subscriptionId: string; delta: ConversationAggregateDelta }
          | { type: 'app_event'; event: DesktopAppEvent }
          | { type: 'error'; id?: string; message: string }
          | { type: string };
        if (message.type === 'conversation_snapshot') {
          subscriptionId = message.subscriptionId;
          applyAggregateSnapshot(message.state);
          return;
        }
        if (message.type === 'conversation_delta' && (!subscriptionId || message.subscriptionId === subscriptionId)) {
          subscriptionId = message.subscriptionId;
          handleAggregateDelta(message.delta);
          return;
        }
        if (message.type === 'app_event' && message.event.type === 'session_file_changed' && message.event.sessionId === conversationId) {
          flushPendingStreamEvents();
          if (isConversationLiveStreaming(stateRef.current, conversationId)) {
            return;
          }
          refreshAuthoritativeState();
          return;
        }
        if (message.type === 'error') {
          setError(message.message);
          return;
        }
      } catch (nextError) {
        recordRendererTelemetry({
          category: 'renderer_error',
          name: 'conversation_realtime_event_parse_failed',
          route: `${window.location.pathname}${window.location.search}`,
          sessionId: conversationId,
          metadata: { message: nextError instanceof Error ? nextError.message : String(nextError) },
        });
      }
    };
    const scheduleReconnectRetry = () => {
      if (reconnectRetryRef.current !== null) {
        return;
      }
      reconnectRetryRef.current = window.setTimeout(() => {
        reconnectRetryRef.current = null;
        setSubscriptionVersion((current) => current + 1);
      }, 2000);
    };

    const refreshAuthoritativeState = () => {
      const aggregateOptions = {
        ...(tailBlocks !== undefined ? { tailBlocks } : {}),
        ...(requestOptions.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
      };
      void api
        .conversationAggregate(conversationId, aggregateOptions)
        .then((nextAggregate) => {
          if (closed) return;
          const nextState = desktopConversationStateFromAggregate(nextAggregate);
          setState((previous) => {
            const mergedState = mergeDesktopConversationState(previous, nextState);
            rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
            return mergedState;
          });
          setError(null);
        })
        .catch((nextError) => {
          if (!closed) {
            setError(nextError instanceof Error ? nextError.message : String(nextError));
          }
        });
    };

    const handleRealtimeError = () => {
      if (closed) {
        return;
      }
      flushPendingStreamEvents();
      refreshAuthoritativeState();
      scheduleReconnectRetry();
    };

    const handleLocalRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: unknown }>).detail;
      if (typeof detail?.conversationId !== 'string' || detail.conversationId !== conversationId) {
        return;
      }
      flushPendingStreamEvents();
      refreshAuthoritativeState();
    };

    window.addEventListener(DESKTOP_CONVERSATION_STATE_REFRESH_EVENT, handleLocalRefresh);

    void openDesktopRealtimeSocket()
      .then((nextSocket) => {
        if (closed) {
          nextSocket.close();
          return;
        }
        socket = nextSocket;
        let subscribeSent = false;
        const sendSubscribe = () => {
          if (closed) return;
          if (subscribeSent) return;
          subscribeSent = true;
          nextSocket.send(
            JSON.stringify({
              type: 'conversation_subscribe',
              id: `conversation:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
              conversationId,
              ...(tailBlocks !== undefined ? { tailBlocks } : {}),
              surfaceId,
              surfaceType,
            }),
          );
        };
        nextSocket.addEventListener('open', sendSubscribe);
        nextSocket.addEventListener('message', handleRealtimeMessage);
        nextSocket.addEventListener('error', handleRealtimeError);
        nextSocket.addEventListener('close', handleRealtimeError);
        if (nextSocket.readyState === WebSocket.OPEN) {
          sendSubscribe();
        }
      })
      .catch((nextError) => {
        if (closed) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
        scheduleReconnectRetry();
      });

    return () => {
      closed = true;
      window.removeEventListener(DESKTOP_CONVERSATION_STATE_REFRESH_EVENT, handleLocalRefresh);
      if (reconnectRetryRef.current !== null) {
        window.clearTimeout(reconnectRetryRef.current);
        reconnectRetryRef.current = null;
      }
      if (subscriptionId && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'unsubscribe', subscriptionId }));
      }
      socket?.close();
      clearPendingStreamFlush();
      pendingStreamEventsRef.current = [];
    };
  }, [
    bridge,
    conversationId,
    mode,
    options?.includeToolBlocks,
    options?.tailBlocks,
    options?.version,
    subscriptionVersion,
    surfaceId,
    surfaceType,
  ]);

  const reconnect = useCallback(() => {
    if (mode === 'local') {
      setSubscriptionVersion((current) => current + 1);
      return;
    }

    setConnectVersion((current) => current + 1);
  }, [mode]);

  const refresh = useCallback(async (): Promise<DesktopConversationState | null> => {
    if (!conversationId || mode !== 'local') {
      return null;
    }

    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    const requestOptions = {
      ...(tailBlocks !== undefined ? { tailBlocks } : {}),
      ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
      ...(options?.version !== undefined ? { version: options.version } : {}),
    } satisfies DesktopConversationStateOptions;
    const nextState = await fetchDesktopConversationStateCached(conversationId, requestOptions);
    let refreshedState: DesktopConversationState | null = null;
    setState((previous) => {
      if (activeConversationIdRef.current !== conversationId || (previous?.conversationId && previous.conversationId !== conversationId)) {
        refreshedState = null;
        return previous;
      }
      const mergedState = mergeDesktopConversationState(previous, nextState);
      const cacheKey = buildDesktopConversationStateCacheKey(
        conversationId,
        tailBlocks,
        requestOptions.includeToolBlocks,
        requestOptions.version,
      );
      rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
      refreshedState = mergedState;
      return mergedState;
    });
    setError(null);
    return refreshedState ?? nextState;
  }, [conversationId, mode, options?.includeToolBlocks, options?.tailBlocks, options?.version]);

  const schedulePostSendRefreshes = useCallback(() => {
    clearPostSendRefreshTimers();
    postSendRefreshTimersRef.current = POST_SEND_REFRESH_DELAYS_MS.map((delayMs) => {
      const timer = window.setTimeout(() => {
        postSendRefreshTimersRef.current = postSendRefreshTimersRef.current.filter((currentTimer) => currentTimer !== timer);
        void refresh().catch((nextError) => {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        });
      }, delayMs);
      return timer;
    });
  }, [clearPostSendRefreshTimers, refresh]);

  useEffect(() => {
    clearRunningSessionRecoveryRefreshTimers();
    if (
      mode !== 'local' ||
      !conversationId ||
      matchedState?.liveSession.live !== true ||
      (matchedState.stream.isStreaming !== true && matchedState.liveSession.isStreaming !== true)
    ) {
      return;
    }

    runningSessionRecoveryRefreshTimersRef.current = RUNNING_SESSION_RECOVERY_REFRESH_DELAYS_MS.map((delayMs) => {
      const timer = window.setTimeout(() => {
        runningSessionRecoveryRefreshTimersRef.current = runningSessionRecoveryRefreshTimersRef.current.filter(
          (currentTimer) => currentTimer !== timer,
        );
        void refresh().catch((nextError) => {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        });
      }, delayMs);
      return timer;
    });

    return clearRunningSessionRecoveryRefreshTimers;
  }, [
    clearRunningSessionRecoveryRefreshTimers,
    conversationId,
    matchedState?.liveSession.isStreaming,
    matchedState?.liveSession.live,
    matchedState?.stream.isStreaming,
    mode,
    refresh,
  ]);

  const send = useCallback(
    async (
      text: string,
      behavior?: 'steer' | 'followUp',
      images?: PromptImageInput[],
      attachmentRefs?: PromptAttachmentRefInput[],
      contextMessages?: Array<{ customType: string; content: string }>,
      relatedConversationIds?: string[],
    ) => {
      if (!conversationId) {
        return;
      }

      const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
      const requestOptions = {
        ...(tailBlocks !== undefined ? { tailBlocks } : {}),
        ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
        ...(options?.version !== undefined ? { version: options.version } : {}),
      } satisfies DesktopConversationStateOptions;
      let stateForSend = matchedState;
      if (!stateForSend) {
        stateForSend = desktopConversationStateFromAggregate(
          await api.conversationAggregate(conversationId, {
            ...(tailBlocks !== undefined ? { tailBlocks } : {}),
            ...(requestOptions.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
          }),
        );
        setState((previous) => {
          if (
            activeConversationIdRef.current !== conversationId ||
            (previous?.conversationId && previous.conversationId !== conversationId)
          ) {
            return previous;
          }
          return mergeDesktopConversationState(previous, stateForSend);
        });
      }

      const result = await api.sendConversationMessage(
        conversationId,
        text,
        behavior,
        images,
        attachmentRefs,
        surfaceId,
        contextMessages,
        relatedConversationIds,
      );
      void refresh().catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      });
      schedulePostSendRefreshes();
      setSubscriptionVersion((current) => current + 1);
      return result;
    },
    [
      conversationId,
      matchedState?.liveSession,
      matchedState?.sessionDetail?.meta?.cwd,
      matchedState?.sessionDetail?.meta?.file,
      options?.includeToolBlocks,
      options?.tailBlocks,
      options?.version,
      refresh,
      schedulePostSendRefreshes,
      surfaceId,
    ],
  );

  const abort = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    await api.abortSession(conversationId, surfaceId);
    setState((previous) => (previous?.conversationId === conversationId ? clearDesktopConversationStreamingState(previous) : previous));
    void refresh().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    });
    setSubscriptionVersion((current) => current + 1);
  }, [conversationId, refresh, surfaceId]);

  const takeover = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    await api.takeoverLiveSession(conversationId, surfaceId);
  }, [conversationId, surfaceId]);

  return {
    mode,
    active: mode === 'local',
    loading: mode === 'local' && matchedState === null,
    state: matchedState,
    error,
    surfaceId,
    reconnect,
    refresh,
    send,
    abort,
    takeover,
  };
}
