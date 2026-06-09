import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../client/api';
import { getDesktopBridge } from '../desktop/desktopBridge';
import { createDesktopAwareEventSource } from '../desktop/desktopEventSource';
import type {
  ConversationBootstrapState,
  DesktopConversationState,
  DisplayBlock,
  PromptAttachmentRefInput,
  PromptImageInput,
  SseEvent,
  ThreadGoal,
} from '../shared/types';
import { recordRendererTelemetry } from '../telemetry/appTelemetry';
import { detectConversationSurfaceType, getOrCreateConversationSurfaceId } from './sessionStream';
import { readCachedConversationBootstrap, readCachedOrPersistedConversationBootstrap } from './useConversationBootstrap';

const MAX_DESKTOP_CONVERSATION_STATE_TAIL_BLOCKS = 10000;
const MAX_CACHED_DESKTOP_CONVERSATION_STATES = 8;
const STREAM_CONTROL_FLUSH_INTERVAL_MS = 16;
const desktopConversationStateCache = new Map<string, DesktopConversationState>();
const desktopConversationStateInflight = new Map<string, Promise<DesktopConversationState>>();

interface DesktopConversationStateOptions {
  tailBlocks?: number;
  includeToolBlocks?: boolean;
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
        blocks: event.blocks,
        blockOffset: event.blockOffset,
        totalBlocks: event.totalBlocks,
        hasSnapshot: true,
        isStreaming: event.isStreaming,
        isCompacting: false,
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
      const blocks = [...stream.blocks];
      const last = blocks.at(-1);
      if (last?.type === 'text') blocks[blocks.length - 1] = { ...last, text: `${last.text ?? ''}${event.delta}` };
      else blocks.push({ type: 'text', id: `text-${Date.now()}`, text: event.delta, ts: new Date().toISOString() });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'thinking_delta': {
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
      const index = findLastToolUseIndex(stream.blocks, event.toolCallId);
      if (index >= 0 && stream.blocks[index]?.type === 'tool_use') {
        const blocks = [...stream.blocks];
        const block = blocks[index];
        blocks[index] = { ...block, output: `${block.output ?? ''}${readPartialToolText(event.partialResult)}` };
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
        blocks[index] = {
          ...block,
          output: event.output,
          status: event.isError ? 'error' : 'ok',
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

  if (!previousCwdChange || next.stream.cwdChange) {
    return next;
  }

  return {
    ...next,
    stream: {
      ...next.stream,
      cwdChange: previousCwdChange,
    },
  };
}

function buildDesktopConversationStateCacheKey(
  conversationId: string,
  tailBlocks: number | undefined,
  includeToolBlocks: boolean | undefined,
): string {
  return `${conversationId}:${tailBlocks ?? 'default'}:${includeToolBlocks === false ? 'conversation' : 'full'}`;
}

function rememberDesktopConversationState(
  cache: Map<string, DesktopConversationState>,
  key: string,
  nextState: DesktopConversationState,
): void {
  cache.delete(key);
  cache.set(key, nextState);
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
  const cacheKey = buildDesktopConversationStateCacheKey(normalizedConversationId, tailBlocks, options?.includeToolBlocks);
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
  const cacheKey = buildDesktopConversationStateCacheKey(normalizedConversationId, tailBlocks, options?.includeToolBlocks);
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
  return {
    conversationId,
    sessionDetail,
    liveSession,
    stream: sessionDetail
      ? {
          ...stream,
          blocks: sessionDetail.blocks,
          blockOffset: sessionDetail.blockOffset,
          totalBlocks: sessionDetail.totalBlocks,
          contextUsage: sessionDetail.contextUsage,
        }
      : stream,
  };
}

function fetchDesktopConversationStateCached(
  conversationId: string,
  options?: DesktopConversationStateOptions,
): Promise<DesktopConversationState> {
  const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
  const cacheKey = buildDesktopConversationStateCacheKey(conversationId, tailBlocks, options?.includeToolBlocks);
  const inflight = desktopConversationStateInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = api
    .desktopConversationState(conversationId, {
      ...(tailBlocks !== undefined ? { tailBlocks } : {}),
      ...(options?.includeToolBlocks === false ? { includeToolBlocks: false } : {}),
    })
    .then((nextState: DesktopConversationState) => {
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
  const matchedState = state?.conversationId === conversationId ? state : null;

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
    } satisfies DesktopConversationStateOptions;
    const cacheKey = buildDesktopConversationStateCacheKey(conversationId, tailBlocks, requestOptions.includeToolBlocks);
    const cachedState = desktopConversationStateCache.get(cacheKey) ?? null;
    const cachedBootstrap = cachedState ? null : readCachedConversationBootstrap(conversationId, requestOptions);
    const bootstrapState = cachedBootstrap ? createDesktopConversationStateFromBootstrap(conversationId, cachedBootstrap) : null;
    if (bootstrapState) {
      rememberDesktopConversationState(desktopConversationStateCache, cacheKey, bootstrapState);
    }
    setState((current) => (current?.conversationId === conversationId ? current : (cachedState ?? bootstrapState)));
    setError(null);

    if (!cachedState && !bootstrapState) {
      void readCachedOrPersistedConversationBootstrap(conversationId, requestOptions)
        .then((persistedBootstrap) => {
          if (closed || !persistedBootstrap) {
            return;
          }

          const persistedState = createDesktopConversationStateFromBootstrap(conversationId, persistedBootstrap);
          rememberDesktopConversationState(desktopConversationStateCache, cacheKey, persistedState);
          setState((current) => (current?.conversationId === conversationId ? current : persistedState));
        })
        .catch(() => {
          // Ignore persisted bootstrap misses; the authoritative desktop state request owns freshness.
        });
    }

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
  }, [bridge, conversationId, mode, options?.includeToolBlocks, options?.tailBlocks, subscriptionVersion, surfaceId, surfaceType]);

  useEffect(() => {
    if (mode !== 'local' || !conversationId || !matchedState?.liveSession?.live) {
      return;
    }

    const params = new URLSearchParams();
    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    if (tailBlocks !== undefined) params.set('tailBlocks', String(tailBlocks));
    params.set('surfaceId', surfaceId);
    params.set('surfaceType', surfaceType);
    const source = createDesktopAwareEventSource(`/api/live-sessions/${encodeURIComponent(conversationId)}/events?${params.toString()}`);

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
      if (pendingStreamFrameRef.current !== null || pendingStreamFlushTimerRef.current !== null) {
        return;
      }
      pendingStreamFrameRef.current = window.requestAnimationFrame(flushPendingStreamEvents);
    };

    const shouldFlushStreamEventImmediately = (streamEvent: SseEvent): boolean =>
      streamEvent.type === 'error' || streamEvent.type === 'cwd_changed';

    const shouldFlushStreamEventOnFrame = (streamEvent: SseEvent): boolean =>
      streamEvent.type === 'text_delta' || streamEvent.type === 'thinking_delta' || streamEvent.type === 'tool_update';

    source.onmessage = (event) => {
      try {
        const streamEvent = JSON.parse(event.data) as SseEvent;
        pendingStreamEventsRef.current.push(streamEvent);
        if (shouldFlushStreamEventImmediately(streamEvent)) {
          flushPendingStreamEvents();
        } else if (shouldFlushStreamEventOnFrame(streamEvent)) {
          schedulePendingStreamEventsFrameFlush();
        } else {
          schedulePendingStreamEventsTimerFlush(STREAM_CONTROL_FLUSH_INTERVAL_MS);
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
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

    source.onerror = () => {
      flushPendingStreamEvents();
      setError('Conversation realtime stream failed.');
      setState((previous) => {
        if (previous?.conversationId !== conversationId || !previous.stream.isStreaming) {
          return previous;
        }
        const stream = { ...previous.stream, isStreaming: false };
        return {
          ...previous,
          stream,
          liveSession: previous.liveSession?.live
            ? { ...previous.liveSession, isStreaming: false }
            : (previous.liveSession ?? { live: false }),
        };
      });
      scheduleReconnectRetry();
    };

    return () => {
      if (reconnectRetryRef.current !== null) {
        window.clearTimeout(reconnectRetryRef.current);
        reconnectRetryRef.current = null;
      }
      source.close();
      clearPendingStreamFlush();
      pendingStreamEventsRef.current = [];
    };
  }, [bridge, conversationId, matchedState?.liveSession?.live, mode, options?.tailBlocks, subscriptionVersion, surfaceId, surfaceType]);

  const reconnect = useCallback(() => {
    if (mode === 'local') {
      setSubscriptionVersion((current) => current + 1);
      return;
    }

    setConnectVersion((current) => current + 1);
  }, [mode]);

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
      } satisfies DesktopConversationStateOptions;
      let stateForSend = matchedState;
      if (!stateForSend) {
        stateForSend = await api.desktopConversationState(conversationId, requestOptions);
        setState((previous) => mergeDesktopConversationState(previous, stateForSend));
      }

      let targetConversationId = conversationId;
      const liveState = stateForSend?.liveSession;
      if (!liveState?.live) {
        const sessionFile = stateForSend?.sessionDetail?.meta?.file?.trim();
        if (sessionFile) {
          const resumed = await api.resumeSession(sessionFile, stateForSend?.sessionDetail?.meta?.cwd);
          targetConversationId = resumed.id || conversationId;
          if (targetConversationId === conversationId) {
            setState((previous) => {
              if (previous?.conversationId !== conversationId) return previous;
              return {
                ...previous,
                liveSession: {
                  live: true,
                  id: conversationId,
                  cwd: previous.sessionDetail?.meta?.cwd ?? '',
                  sessionFile,
                  isStreaming: previous.stream.isStreaming,
                },
              };
            });
            void api.desktopConversationState(conversationId, requestOptions).then((nextState) => {
              setState((previous) => {
                const mergedState = mergeDesktopConversationState(previous, nextState);
                const cacheKey = buildDesktopConversationStateCacheKey(conversationId, tailBlocks, requestOptions.includeToolBlocks);
                rememberDesktopConversationState(desktopConversationStateCache, cacheKey, mergedState);
                return mergedState;
              });
            });
            setSubscriptionVersion((current) => current + 1);
          }
        }
      }

      return await api.promptSession(
        targetConversationId,
        text,
        behavior,
        images,
        attachmentRefs,
        surfaceId,
        contextMessages,
        relatedConversationIds,
      );
    },
    [
      conversationId,
      matchedState?.liveSession,
      matchedState?.sessionDetail?.meta?.cwd,
      matchedState?.sessionDetail?.meta?.file,
      options?.includeToolBlocks,
      options?.tailBlocks,
      surfaceId,
    ],
  );

  const abort = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    await api.abortSession(conversationId, surfaceId);
  }, [conversationId, surfaceId]);

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
    send,
    abort,
    takeover,
  };
}
