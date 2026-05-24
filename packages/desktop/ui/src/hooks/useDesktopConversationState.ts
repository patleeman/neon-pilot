import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../client/api';
import { getDesktopBridge, readDesktopEnvironment } from '../desktop/desktopBridge';
import { createDesktopAwareEventSource } from '../desktop/desktopEventSource';
import type {
  DesktopConversationState,
  DisplayBlock,
  PromptAttachmentRefInput,
  PromptImageInput,
  SseEvent,
  ThreadGoal,
} from '../shared/types';
import { detectConversationSurfaceType, getOrCreateConversationSurfaceId } from './sessionStream';

const MAX_DESKTOP_CONVERSATION_STATE_TAIL_BLOCKS = 10000;

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

export function applyDesktopConversationStreamEvent(
  stream: DesktopConversationState['stream'],
  event: SseEvent,
): DesktopConversationState['stream'] {
  const blocks = [...stream.blocks];
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
      return { ...stream, isStreaming: true, error: null };
    case 'agent_end':
    case 'turn_end':
      return { ...stream, isStreaming: false };
    case 'compaction_start':
      return { ...stream, isCompacting: true };
    case 'compaction_end':
      return event.errorMessage
        ? {
            ...stream,
            blocks: [...blocks, { type: 'error', id: `error-${Date.now()}`, message: event.errorMessage, ts: new Date().toISOString() }],
            isCompacting: false,
            error: event.errorMessage,
          }
        : { ...stream, isCompacting: false };
    case 'cwd_changed':
      return { ...stream, cwdChange: { newConversationId: event.newConversationId, cwd: event.cwd, autoContinued: event.autoContinued } };
    case 'user_message':
      blocks.push(event.block);
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    case 'text_delta': {
      const last = blocks.at(-1);
      if (last?.type === 'text') blocks[blocks.length - 1] = { ...last, text: `${last.text ?? ''}${event.delta}` };
      else blocks.push({ type: 'text', id: `text-${Date.now()}`, text: event.delta, ts: new Date().toISOString() });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'thinking_delta': {
      const last = blocks.at(-1);
      if (last?.type === 'thinking') blocks[blocks.length - 1] = { ...last, text: `${last.text ?? ''}${event.delta}` };
      else blocks.push({ type: 'thinking', id: `thinking-${Date.now()}`, text: event.delta, ts: new Date().toISOString() });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'tool_start':
      blocks.push({
        type: 'tool_use',
        id: event.toolCallId,
        toolCallId: event.toolCallId,
        tool: event.toolName,
        input: event.args,
        output: '',
        ts: new Date().toISOString(),
      });
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    case 'tool_update': {
      const index = findLastToolUseIndex(blocks, event.toolCallId);
      if (index >= 0 && blocks[index]?.type === 'tool_use') {
        const block = blocks[index];
        blocks[index] = { ...block, output: `${block.output ?? ''}${readPartialToolText(event.partialResult)}` };
      }
      return { ...stream, blocks, totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length) };
    }
    case 'tool_end': {
      const index = findLastToolUseIndex(blocks, event.toolCallId);
      if (index >= 0 && blocks[index]?.type === 'tool_use') {
        const block = blocks[index];
        blocks[index] = { ...block, output: event.output, durationMs: event.durationMs, details: event.details ?? block.details };
      }
      const goalState = readGoalStateFromToolDetails(event.toolName, event.details);
      return {
        ...stream,
        blocks,
        totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length),
        ...(goalState !== undefined ? { goalState } : {}),
      };
    }
    case 'queue_state':
      return { ...stream, pendingQueue: { steering: event.steering, followUp: event.followUp } };
    case 'presence_state':
      return { ...stream, presence: event.state };
    case 'title_update':
      return { ...stream, title: event.title };
    case 'context_usage':
      return { ...stream, contextUsage: event.usage };
    case 'stats_update':
      return { ...stream, tokens: event.tokens, cost: event.cost };
    case 'error':
      blocks.push({ type: 'error', id: `error-${Date.now()}`, message: event.message, ts: new Date().toISOString() });
      return {
        ...stream,
        blocks,
        isStreaming: false,
        error: event.message,
        totalBlocks: Math.max(stream.totalBlocks, stream.blockOffset + blocks.length),
      };
    default:
      return stream;
  }
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

export function useDesktopConversationState(conversationId: string | null, options?: { tailBlocks?: number; enabled?: boolean }) {
  const enabled = options?.enabled !== false && Boolean(conversationId);
  const bridge = getDesktopBridge();
  const surfaceId = useMemo(() => getOrCreateConversationSurfaceId(), []);
  const surfaceType = useMemo(() => detectConversationSurfaceType(), []);
  const [mode, setMode] = useState<'checking' | 'local' | 'inactive'>(enabled && bridge ? 'checking' : 'inactive');
  const [state, setState] = useState<DesktopConversationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectVersion, setConnectVersion] = useState(0);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const matchedState = state?.conversationId === conversationId ? state : null;

  useEffect(() => {
    if (!enabled || !bridge) {
      setMode('inactive');
      setState(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setMode('checking');
    void readDesktopEnvironment()
      .then((environment) => {
        if (cancelled) {
          return;
        }

        setMode(environment?.activeHostKind === 'local' ? 'local' : 'inactive');
      })
      .catch(() => {
        if (!cancelled) {
          setMode('inactive');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, enabled, connectVersion]);

  useEffect(() => {
    if (!bridge || mode !== 'local' || !conversationId) {
      return;
    }

    let closed = false;
    setState((current) => (current?.conversationId === conversationId ? current : null));
    setError(null);

    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    void api
      .desktopConversationState(conversationId, tailBlocks !== undefined ? { tailBlocks } : undefined)
      .then((nextState) => {
        if (!closed) {
          setState((previous) => mergeDesktopConversationState(previous, nextState));
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
  }, [bridge, conversationId, mode, options?.tailBlocks, subscriptionVersion, surfaceId, surfaceType]);

  useEffect(() => {
    if (!bridge || mode !== 'local' || !conversationId || !matchedState?.liveSession.live) {
      return;
    }

    const params = new URLSearchParams();
    const tailBlocks = normalizeDesktopConversationStateTailBlocks(options?.tailBlocks);
    if (tailBlocks !== undefined) params.set('tailBlocks', String(tailBlocks));
    params.set('surfaceId', surfaceId);
    params.set('surfaceType', surfaceType);
    const source = createDesktopAwareEventSource(`/api/live-sessions/${encodeURIComponent(conversationId)}/events?${params.toString()}`);

    source.onmessage = (event) => {
      try {
        const streamEvent = JSON.parse(event.data) as SseEvent;
        setState((previous) => {
          if (previous?.conversationId !== conversationId) {
            return previous;
          }

          const stream = applyDesktopConversationStreamEvent(previous.stream, streamEvent);
          return {
            ...previous,
            stream,
            liveSession: previous.liveSession.live
              ? {
                  ...previous.liveSession,
                  ...(streamEvent.type === 'title_update' ? { title: streamEvent.title } : {}),
                  isStreaming: stream.isStreaming,
                }
              : previous.liveSession,
          };
        });
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    };
    source.onerror = () => setError('Conversation realtime stream failed.');

    return () => source.close();
  }, [bridge, conversationId, matchedState?.liveSession.live, mode, options?.tailBlocks, surfaceId, surfaceType]);

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

      return await api.promptSession(
        conversationId,
        text,
        behavior,
        images,
        attachmentRefs,
        surfaceId,
        contextMessages,
        relatedConversationIds,
      );
    },
    [conversationId, surfaceId],
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
    loading: mode === 'checking' || (mode === 'local' && matchedState === null),
    state: matchedState,
    error,
    surfaceId,
    reconnect,
    send,
    abort,
    takeover,
  };
}
