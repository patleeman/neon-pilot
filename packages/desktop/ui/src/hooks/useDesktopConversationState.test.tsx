// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const eventSources = vi.hoisted(() => [] as FakeRealtimeSocket[]);

class FakeRealtimeSocket extends EventTarget {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeRealtimeSocket.OPEN;
  closed = false;
  sent: string[] = [];
  conversationId = 'conv-1';

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, listener, options);
    if (!listener) return;
    const callback =
      typeof listener === 'function'
        ? listener
        : (event: Event) => {
            listener.handleEvent(event);
          };
    if (type === 'message') {
      this.onmessage = callback as (event: MessageEvent<string>) => void;
    }
    if (type === 'error') {
      this.onerror = callback as (event: Event) => void;
    }
    if (type === 'open') {
      this.onopen = callback as (event: Event) => void;
    }
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeRealtimeSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  send(data: unknown): void {
    if (typeof data === 'string') {
      this.sent.push(data);
      try {
        const message = JSON.parse(data) as { type?: string; conversationId?: string };
        if (message.type === 'conversation_subscribe' && message.conversationId) {
          this.conversationId = message.conversationId;
        }
      } catch {
        // Ignore test helper parse failures.
      }
      return;
    }
    this.receive({
      type: 'conversation_delta',
      subscriptionId: 'sub-test',
      delta: {
        type: 'stream_events',
        conversationId: this.conversationId,
        revision: 1,
        events: [data],
      },
    });
  }

  receive(data: unknown): void {
    const event = new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) });
    this.dispatchEvent(event);
  }

  fail(): void {
    const event = new Event('error');
    this.dispatchEvent(event);
  }
}

vi.mock('../desktop/desktopRealtimeConnection', () => ({
  openDesktopRealtimeSocket: vi.fn(async () => {
    const source = new FakeRealtimeSocket();
    eventSources.push(source);
    void Promise.resolve()
      .then(() => Promise.resolve())
      .then(() => {
        source.dispatchEvent(new Event('open'));
      });
    return source;
  }),
}));

import { api } from '../client/api.js';
import { conversationActivityStatusStore, sessionStore } from '../store';
import {
  applyDesktopConversationStreamEvent,
  applyDesktopConversationStreamEvents,
  clearDesktopConversationStateCacheForTests,
  normalizeDesktopConversationStateTailBlocks,
  notifyDesktopConversationStateRefresh,
  prefetchDesktopConversationState,
  primeDesktopConversationStateCache,
  primeReservedDesktopConversationStateCache,
  useDesktopConversationState,
} from './useDesktopConversationState.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];
let latestReconnect: (() => void) | null = null;
let latestState: ReturnType<typeof useDesktopConversationState> | null = null;

function HookProbe({
  conversationId = 'conv-1',
  tailBlocks = 20,
  includeToolBlocks,
  version,
}: {
  conversationId?: string;
  tailBlocks?: number;
  includeToolBlocks?: boolean;
  version?: number | string;
}) {
  latestState = useDesktopConversationState(conversationId, { tailBlocks, includeToolBlocks, version });
  latestReconnect = latestState.reconnect;
  return null;
}

function flushPromises() {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function aggregateState(
  conversationId: string,
  blocks: Awaited<ReturnType<typeof api.conversationAggregate>>['stream']['blocks'] = [],
): Awaited<ReturnType<typeof api.conversationAggregate>> {
  return {
    conversationId,
    sessionDetail: null,
    bootstrap: null,
    liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
    stream: {
      blocks,
      blockOffset: 0,
      totalBlocks: blocks.length,
      hasSnapshot: true,
      isStreaming: false,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    },
  };
}

describe('normalizeDesktopConversationStateTailBlocks', () => {
  it('drops unsafe desktop conversation tail block limits', () => {
    expect(normalizeDesktopConversationStateTailBlocks(20)).toBe(20);
    expect(normalizeDesktopConversationStateTailBlocks(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined();
  });

  it('caps expensive desktop conversation tail block limits', () => {
    expect(normalizeDesktopConversationStateTailBlocks(50000)).toBe(10000);
  });
});

describe('applyDesktopConversationStreamEvent', () => {
  it('marks live tool blocks as running until tool end', () => {
    const stream = {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const running = applyDesktopConversationStreamEvent(stream, {
      type: 'tool_start',
      toolCallId: 'tool-1',
      toolName: 'bash',
      args: { command: 'pnpm test' },
    });

    expect(running.blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        toolCallId: 'tool-1',
        tool: 'bash',
        status: 'running',
        running: true,
      }),
    ]);

    const completed = applyDesktopConversationStreamEvent(running, {
      type: 'tool_end',
      toolCallId: 'tool-1',
      toolName: 'bash',
      isError: false,
      durationMs: 12,
      output: 'done',
    });

    expect(completed.blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        toolCallId: 'tool-1',
        status: 'ok',
        running: false,
        output: 'done',
      }),
    ]);
  });

  it('clears active goal state when the goal tool completes', () => {
    const stream = {
      blocks: [
        {
          type: 'tool_use' as const,
          id: 'goal-1',
          toolCallId: 'goal-1',
          tool: 'goal',
          input: {},
          output: '',
          ts: '2026-05-24T00:00:00.000Z',
        },
      ],
      blockOffset: 0,
      totalBlocks: 1,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: {
        objective: 'Ship it',
        status: 'active' as const,
        tasks: [],
        stopReason: null,
        startedAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const next = applyDesktopConversationStreamEvent(stream, {
      type: 'tool_end',
      toolCallId: 'goal-1',
      toolName: 'goal',
      isError: false,
      durationMs: 0,
      output: 'Goal complete!',
      details: {
        state: {
          objective: '',
          status: 'complete',
          stopReason: 'goal achieved',
          startedAt: null,
          updatedAt: '2026-05-24T00:00:01.000Z',
        },
      },
    });

    expect(next.goalState).toBeNull();
  });

  it('hides extension-host abort internals from snapshot and tool-end output', () => {
    const rawOutput =
      'Extension host RPC request action:system-runs/bash failed at http://127.0.0.1:55183/action: This operation was aborted';
    const stream = {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: false,
      isStreaming: false,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const snapshot = applyDesktopConversationStreamEvent(stream, {
      type: 'snapshot',
      blocks: [
        {
          type: 'tool_use',
          id: 'tool-1',
          toolCallId: 'tool-1',
          tool: 'bash',
          input: {},
          output: rawOutput,
          ts: '2026-05-24T00:00:00.000Z',
        },
      ],
      blockOffset: 0,
      totalBlocks: 1,
      isStreaming: true,
      goalState: null,
    });

    expect(snapshot.blocks[0]).toEqual(
      expect.objectContaining({
        type: 'tool_use',
        status: 'error',
        output: 'Stopped before finishing. The tool call was interrupted or cancelled.',
      }),
    );

    const ended = applyDesktopConversationStreamEvent(snapshot, {
      type: 'tool_end',
      toolCallId: 'tool-1',
      toolName: 'bash',
      isError: false,
      durationMs: 12,
      output: rawOutput,
    });

    expect(ended.blocks[0]).toEqual(
      expect.objectContaining({
        type: 'tool_use',
        status: 'error',
        output: 'Stopped before finishing. The tool call was interrupted or cancelled.',
      }),
    );
  });

  it('preserves transcript block identity for control-only events', () => {
    const blocks = [
      {
        type: 'text' as const,
        id: 'text-1',
        text: 'already rendered',
        ts: '2026-05-24T00:00:00.000Z',
      },
    ];
    const stream = {
      blocks,
      blockOffset: 0,
      totalBlocks: 1,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const emptyQueueUpdated = applyDesktopConversationStreamEvent(stream, { type: 'queue_state', steering: [], followUp: [] });
    const queueUpdated = applyDesktopConversationStreamEvent(stream, {
      type: 'queue_state',
      steering: [{ id: 'note', text: 'note', imageCount: 0 }],
      followUp: [],
    });
    const parallelUpdated = applyDesktopConversationStreamEvent(stream, {
      type: 'parallel_state',
      jobs: [
        {
          id: 'parallel-1',
          prompt: 'Check docs',
          childConversationId: 'child-1',
          status: 'running',
          imageCount: 0,
        },
      ],
    });
    const statsUpdated = applyDesktopConversationStreamEvent(stream, { type: 'stats_update', tokens: 10, cost: 0.01 });
    const repeatedAgentStart = applyDesktopConversationStreamEvent(stream, { type: 'agent_start' });
    const idleToolEnd = applyDesktopConversationStreamEvent(stream, {
      type: 'tool_end',
      toolCallId: 'missing-tool',
      toolName: 'bash',
      isError: false,
      durationMs: 0,
      output: '',
    });

    expect(emptyQueueUpdated).toBe(stream);
    expect(queueUpdated.blocks).toBe(blocks);
    expect(parallelUpdated.blocks).toBe(blocks);
    expect(parallelUpdated.parallelJobs).toEqual([
      expect.objectContaining({ id: 'parallel-1', status: 'running', childConversationId: 'child-1' }),
    ]);
    expect(statsUpdated.blocks).toBe(blocks);
    expect(repeatedAgentStart).toBe(stream);
    expect(idleToolEnd).toBe(stream);
  });

  it('preserves stream identity for repeated parallel state events', () => {
    const stream = {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [
        {
          id: 'parallel-1',
          prompt: 'Check docs',
          childConversationId: 'child-1',
          status: 'running' as const,
          imageCount: 0,
        },
      ],
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    expect(
      applyDesktopConversationStreamEvent(stream, {
        type: 'parallel_state',
        jobs: [
          {
            id: 'parallel-1',
            prompt: 'Check docs',
            childConversationId: 'child-1',
            status: 'running',
            imageCount: 0,
          },
        ],
      }),
    ).toBe(stream);
  });

  it('ignores empty streamed transcript deltas', () => {
    const stream = {
      blocks: [
        {
          type: 'tool_use' as const,
          id: 'tool-1',
          toolCallId: 'tool-1',
          tool: 'bash',
          input: {},
          output: 'existing',
          status: 'running' as const,
          running: true,
          ts: '2026-05-24T00:00:00.000Z',
        },
      ],
      blockOffset: 0,
      totalBlocks: 1,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    expect(applyDesktopConversationStreamEvent(stream, { type: 'text_delta', delta: '' })).toBe(stream);
    expect(applyDesktopConversationStreamEvent(stream, { type: 'thinking_delta', delta: '' })).toBe(stream);
    expect(applyDesktopConversationStreamEvent(stream, { type: 'tool_update', toolCallId: 'tool-1', partialResult: '' })).toBe(stream);
    expect(
      applyDesktopConversationStreamEvent(stream, {
        type: 'tool_update',
        toolCallId: 'tool-1',
        partialResult: { content: [{ text: '' }] },
      }),
    ).toBe(stream);
  });

  it('preserves compacting state from snapshot events', () => {
    const stream = {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: true,
      isStreaming: false,
      isCompacting: true,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const next = applyDesktopConversationStreamEvent(stream, {
      type: 'snapshot',
      blocks: [{ type: 'text', id: 'text-1', text: 'Compaction snapshot', ts: '2026-05-24T00:00:00.000Z' }],
      blockOffset: 0,
      totalBlocks: 1,
      isStreaming: false,
      isCompacting: true,
      goalState: null,
    });

    expect(next.isCompacting).toBe(true);
  });

  it('appends an error block for failed compaction events', () => {
    const stream = {
      blocks: [{ type: 'text' as const, id: 'text-1', text: 'Existing text', ts: '2026-05-24T00:00:00.000Z' }],
      blockOffset: 0,
      totalBlocks: 1,
      hasSnapshot: true,
      isStreaming: false,
      isCompacting: true,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const next = applyDesktopConversationStreamEvent(stream, {
      type: 'compaction_end',
      mode: 'auto',
      reason: 'overflow',
      aborted: false,
      willRetry: false,
      errorMessage: 'Overflow compaction failed',
    });

    expect(next.isCompacting).toBe(false);
    expect(next.error).toBe('Overflow compaction failed');
    expect(next.blocks).toEqual([
      { type: 'text', id: 'text-1', text: 'Existing text', ts: '2026-05-24T00:00:00.000Z' },
      expect.objectContaining({
        type: 'error',
        message: 'Overflow compaction failed',
        ts: expect.any(String),
      }),
    ]);
  });
});

describe('applyDesktopConversationStreamEvents', () => {
  it('coalesces stream deltas into one updated block', () => {
    const stream = {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      hasSnapshot: true,
      isStreaming: true,
      isCompacting: false,
      error: null,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      pendingQueue: { steering: [], followUp: [] },
      presence: null,
      contextUsage: null,
      tokens: null,
      cost: null,
      cwdChange: null,
      title: null,
    };

    const next = applyDesktopConversationStreamEvents(stream, [
      { type: 'text_delta', delta: 'Hel' },
      { type: 'text_delta', delta: 'lo' },
    ]);

    expect(next.blocks).toEqual([expect.objectContaining({ type: 'text', text: 'Hello' })]);
    expect(next.totalBlocks).toBe(1);
  });
});

describe('useDesktopConversationState', () => {
  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => root.unmount());
    }
    eventSources.splice(0);
    latestReconnect = null;
    latestState = null;
    clearDesktopConversationStateCacheForTests();
    sessionStore.reset?.();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'neonPilotDesktop');
  });

  it('treats an empty desktop conversation response as loaded state', async () => {
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-empty',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-empty" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.mode).toBe('local');
    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.conversationId).toBe('conv-empty');
    expect(latestState?.state?.stream.blocks).toEqual([]);
    expect(eventSources[0]?.sent.map((entry) => JSON.parse(entry)).filter((entry) => entry.type === 'conversation_subscribe')).toHaveLength(
      1,
    );
    expect(JSON.parse(eventSources[0]?.sent[0] ?? '{}')).toMatchObject({ type: 'conversation_subscribe', conversationId: 'conv-empty' });
  });

  it('reuses an in-flight desktop conversation prefetch when the page opens', async () => {
    let resolveRequest: (state: Awaited<ReturnType<typeof api.conversationAggregate>>) => void = () => {};
    const request = new Promise<Awaited<ReturnType<typeof api.conversationAggregate>>>((resolve) => {
      resolveRequest = resolve;
    });
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockReturnValue(request);

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const prefetch = prefetchDesktopConversationState('conv-prefetch', { tailBlocks: 20 });
    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-prefetch" tailBlocks={20} />);
      await flushPromises();
    });

    expect(prefetch).not.toBeNull();
    expect(conversationAggregate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        conversationId: 'conv-prefetch',
        sessionDetail: null,
        liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
        stream: {
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          hasSnapshot: true,
          isStreaming: false,
          isCompacting: false,
          error: null,
          goalState: null,
          systemPrompt: null,
          toolDefinitions: [],
          pendingQueue: { steering: [], followUp: [] },
          presence: null,
          contextUsage: null,
          tokens: null,
          cost: null,
          cwdChange: null,
          title: null,
        },
      });
      await prefetch;
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.conversationId).toBe('conv-prefetch');
  });

  it('hides extension-host abort internals from aggregate snapshot state', async () => {
    const rawOutput =
      'Extension host RPC request action:system-runs/bash failed at http://127.0.0.1:55183/action: This operation was aborted';
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue(
      aggregateState('conv-raw-snapshot', [
        {
          type: 'tool_use',
          id: 'tool-1',
          toolCallId: 'tool-1',
          tool: 'bash',
          input: {},
          output: rawOutput,
          ts: '2026-05-26T00:00:00.000Z',
        },
      ]),
    );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-raw-snapshot" />);
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks[0]).toEqual(
      expect.objectContaining({
        type: 'tool_use',
        status: 'error',
        output: 'Stopped before finishing. The tool call was interrupted or cancelled.',
      }),
    );
  });

  it('uses a primed create bootstrap as the initial desktop conversation state', async () => {
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockReturnValue(new Promise(() => undefined));

    primeDesktopConversationStateCache(
      'conv-created',
      {
        conversationId: 'conv-created',
        sessionDetail: {
          meta: {
            id: 'conv-created',
            file: '/repo/session.jsonl',
            timestamp: '2026-05-26T00:00:00.000Z',
            cwd: '/repo',
            cwdSlug: 'repo',
            model: 'gpt',
            title: 'New Conversation',
            messageCount: 0,
          },
          blocks: [],
          blockOffset: 0,
          totalBlocks: 0,
          contextUsage: null,
        },
        liveSession: { live: true, id: 'conv-created', cwd: '/repo', sessionFile: '/repo/session.jsonl', isStreaming: false },
      },
      { tailBlocks: 20 },
    );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-created" tailBlocks={20} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.sessionDetail?.meta.id).toBe('conv-created');
    expect(conversationAggregate).toHaveBeenCalledWith('conv-created', { tailBlocks: 20 });
  });

  it('does not expose primed desktop conversation state from an older file version', async () => {
    primeDesktopConversationStateCache(
      'conv-versioned',
      {
        conversationId: 'conv-versioned',
        sessionDetail: null,
        liveSession: { live: false },
      },
      { tailBlocks: 20, includeToolBlocks: false, version: 1 },
    );
    let resolveFreshState: (state: Awaited<ReturnType<typeof api.conversationAggregate>>) => void = () => {};
    const freshStateRequest = new Promise<Awaited<ReturnType<typeof api.conversationAggregate>>>((resolve) => {
      resolveFreshState = resolve;
    });
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockReturnValue(freshStateRequest);

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-versioned" includeToolBlocks={false} version={2} />);
      await flushPromises();
    });

    expect(latestState?.state).toBeNull();

    await act(async () => {
      resolveFreshState(aggregateState('conv-versioned', [{ type: 'text', id: 'fresh', text: 'Fresh', ts: '2026-05-24T00:00:00.000Z' }]));
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledWith('conv-versioned', { tailBlocks: 20, includeToolBlocks: false });
    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['fresh']);
  });

  it('seeds stream running state from live bootstrap metadata before the stream snapshot arrives', async () => {
    vi.spyOn(api, 'conversationAggregate').mockReturnValue(new Promise(() => undefined));

    primeDesktopConversationStateCache(
      'conv-running-bootstrap',
      {
        conversationId: 'conv-running-bootstrap',
        sessionDetail: {
          meta: {
            id: 'conv-running-bootstrap',
            file: '/repo/session.jsonl',
            timestamp: '2026-06-15T00:00:00.000Z',
            cwd: '/repo',
            cwdSlug: 'repo',
            model: 'gpt',
            title: 'Running Conversation',
            messageCount: 1,
          },
          blocks: [{ type: 'user', id: 'user-1', text: 'Keep going', ts: '2026-06-15T00:00:00.000Z' }],
          blockOffset: 0,
          totalBlocks: 1,
          contextUsage: null,
        },
        liveSession: {
          live: true,
          id: 'conv-running-bootstrap',
          cwd: '/repo',
          sessionFile: '/repo/session.jsonl',
          isStreaming: true,
        },
      },
      { tailBlocks: 20 },
    );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-running-bootstrap" tailBlocks={20} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ live: true, isStreaming: true }));
    expect(latestState?.state?.stream.isStreaming).toBe(true);
  });

  it('does not let active desktop stream state author global conversation presence', async () => {
    const liveState = {
      conversationId: 'conv-sidebar-running',
      sessionDetail: null,
      liveSession: { live: true, id: 'conv-sidebar-running', cwd: '/repo', sessionFile: '/repo/session.jsonl', isStreaming: true },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue(liveState);
    sessionStore.upsert({
      id: 'conv-sidebar-running',
      title: 'Sidebar row',
      cwd: '/repo',
      timestamp: '2026-06-15T00:00:00.000Z',
      isRunning: false,
    });
    sessionStore.markReady?.();

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-sidebar-running" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);
    expect(conversationActivityStatusStore.get('conv-sidebar-running')).toBe('idle');
    expect(sessionStore.get('conv-sidebar-running')?.isRunning).toBe(false);
  });

  it('flushes terminal stream events immediately so the composer cannot stay stuck in stop mode', async () => {
    const liveState = {
      conversationId: 'conv-terminal',
      sessionDetail: null,
      liveSession: { live: true, id: 'conv-terminal', cwd: '/repo', sessionFile: '/repo/session.jsonl', isStreaming: true },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Done.', ts: '2026-06-15T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue(liveState);

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-terminal" />);
      await flushPromises();
      await flushPromises();
    });

    const source = eventSources.at(-1);
    expect(source).toBeTruthy();
    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      source?.send({ type: 'agent_end' });
    });

    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ isStreaming: false }));
  });

  it('waits for aggregate state instead of seeding saved conversations from the bootstrap cache', async () => {
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockReturnValue(new Promise(() => undefined));

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-cached" tailBlocks={20} includeToolBlocks={false} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(true);
    expect(latestState?.state).toBeNull();
    expect(conversationAggregate).toHaveBeenCalledWith('conv-cached', { tailBlocks: 20, includeToolBlocks: false });
  });

  it('resumes a persisted desktop conversation before sending a prompt', async () => {
    const savedConversationState = {
      conversationId: 'conv-saved',
      sessionDetail: {
        meta: {
          id: 'conv-saved',
          file: '/repo/saved.jsonl',
          timestamp: '2026-05-30T00:00:00.000Z',
          cwd: '/repo',
          cwdSlug: 'repo',
          model: 'gpt',
          title: 'Saved Conversation',
          messageCount: 1,
        },
        blocks: [{ type: 'text', id: 'text-1', text: 'Saved reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        contextUsage: null,
      },
      liveSession: { live: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Saved reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    vi.spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(savedConversationState)
      .mockResolvedValue({
        ...savedConversationState,
        liveSession: { live: true, id: 'conv-saved', cwd: '/repo', sessionFile: '/repo/saved.jsonl', isStreaming: false },
      });
    const sendConversationMessage = vi.spyOn(api, 'sendConversationMessage').mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-saved" />);
      await flushPromises();
      await flushPromises();
    });

    await act(async () => {
      await latestState?.send('continue', 'followUp');
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    expect(sendConversationMessage).toHaveBeenCalledWith(
      'conv-saved',
      'continue',
      'followUp',
      undefined,
      undefined,
      expect.any(String),
      undefined,
      undefined,
    );
    expect(latestState?.state?.liveSession).toEqual(
      expect.objectContaining({ live: true, id: 'conv-saved', sessionFile: '/repo/saved.jsonl' }),
    );
    expect(eventSources.length).toBeGreaterThanOrEqual(1);
  });

  it('refreshes again after accepted sends so delayed transcript writes render', async () => {
    vi.useFakeTimers();
    const initialState = aggregateState('conv-delayed', []);
    const refreshedState = aggregateState('conv-delayed', [
      { type: 'user', id: 'user-1', text: 'Run this shell command: echo row94', ts: '2026-05-30T00:00:01.000Z' },
    ]);
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(initialState)
      .mockResolvedValueOnce(initialState)
      .mockResolvedValueOnce(initialState)
      .mockResolvedValue(refreshedState);
    vi.spyOn(api, 'sendConversationMessage').mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-delayed" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toEqual([]);

    await act(async () => {
      await latestState?.send('Run this shell command: echo row94');
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(4);
    expect(latestState?.state?.stream.blocks).toEqual([expect.objectContaining({ text: 'Run this shell command: echo row94' })]);
  });

  it('refreshes a mounted running session when terminal stream events are missed', async () => {
    vi.useFakeTimers();
    const runningState = {
      ...aggregateState('conv-running-recovery', [{ type: 'user', id: 'user-1', text: 'Run sleep', ts: '2026-05-30T00:00:01.000Z' }]),
      liveSession: {
        live: true,
        id: 'conv-running-recovery',
        cwd: '/repo',
        sessionFile: '/repo/session.jsonl',
        isStreaming: true,
      },
      stream: {
        ...aggregateState('conv-running-recovery', [{ type: 'user', id: 'user-1', text: 'Run sleep', ts: '2026-05-30T00:00:01.000Z' }])
          .stream,
        isStreaming: true,
      },
    } as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const completedState = {
      ...aggregateState('conv-running-recovery', [
        { type: 'user', id: 'user-1', text: 'Run sleep', ts: '2026-05-30T00:00:01.000Z' },
        { type: 'text', id: 'text-1', text: 'Done', ts: '2026-05-30T00:00:15.000Z' },
      ]),
      liveSession: {
        live: true,
        id: 'conv-running-recovery',
        cwd: '/repo',
        sessionFile: '/repo/session.jsonl',
        isStreaming: false,
      },
    } as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValue(completedState);

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-running-recovery" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushPromises();
      await flushPromises();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushPromises();
      await flushPromises();
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(4);
    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ isStreaming: false }));
    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['user-1', 'text-1']);
  });

  it('keeps checking long-running sessions after early recovery refreshes pass', async () => {
    vi.useFakeTimers();
    const runningState = {
      ...aggregateState('conv-long-running-recovery', [
        { type: 'user', id: 'user-1', text: 'Run long sleep', ts: '2026-05-30T00:00:01.000Z' },
      ]),
      liveSession: {
        live: true,
        id: 'conv-long-running-recovery',
        cwd: '/repo',
        sessionFile: '/repo/session.jsonl',
        isStreaming: true,
      },
      stream: {
        ...aggregateState('conv-long-running-recovery', [
          { type: 'user', id: 'user-1', text: 'Run long sleep', ts: '2026-05-30T00:00:01.000Z' },
        ]).stream,
        isStreaming: true,
      },
    } as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const completedState = {
      ...aggregateState('conv-long-running-recovery', [
        { type: 'user', id: 'user-1', text: 'Run long sleep', ts: '2026-05-30T00:00:01.000Z' },
        { type: 'text', id: 'text-1', text: 'Late done', ts: '2026-05-30T00:01:00.000Z' },
      ]),
      liveSession: {
        live: true,
        id: 'conv-long-running-recovery',
        cwd: '/repo',
        sessionFile: '/repo/session.jsonl',
        isStreaming: false,
      },
    } as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValueOnce(runningState)
      .mockResolvedValue(completedState);

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-long-running-recovery" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);

    for (const delayMs of [3000, 5000, 8000, 14000]) {
      await act(async () => {
        vi.advanceTimersByTime(delayMs);
        await flushPromises();
        await flushPromises();
      });
    }

    expect(conversationAggregate).toHaveBeenCalledTimes(5);
    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(6);
    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ isStreaming: false }));
    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['user-1', 'text-1']);
  });

  it('clears streaming state after abort even when the follow-up refresh is delayed', async () => {
    const runningConversationState = {
      conversationId: 'conv-abort-delayed-refresh',
      sessionDetail: null,
      bootstrap: null,
      liveSession: {
        live: true,
        id: 'conv-abort-delayed-refresh',
        cwd: '/repo',
        sessionFile: '/repo/abort-delayed-refresh.jsonl',
        isStreaming: true,
        hasStaleTurnState: false,
      },
      stream: {
        blocks: [
          {
            type: 'tool_use',
            id: 'tool-1',
            toolCallId: 'tool-1',
            tool: 'bash',
            input: { command: 'sleep 60' },
            output: '',
            status: 'running',
            running: true,
            ts: '2026-06-24T00:00:00.000Z',
          },
        ],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const delayedRefresh = new Promise<Awaited<ReturnType<typeof api.conversationAggregate>>>(() => {});
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(runningConversationState)
      .mockReturnValueOnce(delayedRefresh);
    const abortSession = vi.spyOn(api, 'abortSession').mockResolvedValue({ ok: true });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-abort-delayed-refresh" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      await latestState?.abort();
      await flushPromises();
    });

    expect(abortSession).toHaveBeenCalledWith('conv-abort-delayed-refresh', expect.any(String));
    expect(conversationAggregate).toHaveBeenCalledTimes(2);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ isStreaming: false }));
    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.stream.blocks[0]).toEqual(
      expect.objectContaining({
        running: false,
        status: 'error',
        output: 'Stopped before finishing. The tool call was interrupted or cancelled.',
      }),
    );
  });

  it('refreshes desktop conversation state after aborting a live session', async () => {
    const runningConversationState = {
      conversationId: 'conv-abort',
      sessionDetail: null,
      bootstrap: null,
      liveSession: {
        live: true,
        id: 'conv-abort',
        cwd: '/repo',
        sessionFile: '/repo/abort.jsonl',
        isStreaming: true,
        hasStaleTurnState: false,
      },
      stream: {
        blocks: [
          {
            type: 'tool_use',
            id: 'tool-1',
            toolCallId: 'tool-1',
            tool: 'probe_image',
            input: {},
            output: '',
            status: 'running',
            running: true,
            ts: '2026-06-24T00:00:00.000Z',
          },
        ],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const stoppedConversationState = {
      ...runningConversationState,
      liveSession: {
        ...runningConversationState.liveSession,
        isStreaming: false,
      },
      stream: {
        ...runningConversationState.stream,
        isStreaming: false,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(runningConversationState)
      .mockResolvedValue(stoppedConversationState);
    const abortSession = vi.spyOn(api, 'abortSession').mockResolvedValue({ ok: true });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-abort" />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      await latestState?.abort();
      await flushPromises();
      await flushPromises();
    });

    expect(abortSession).toHaveBeenCalledWith('conv-abort', expect.any(String));
    expect(conversationAggregate).toHaveBeenCalledWith('conv-abort', { tailBlocks: 20 });
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ live: true, isStreaming: false }));
    expect(latestState?.state?.stream.isStreaming).toBe(false);
  });

  it('fetches and resumes persisted conversation state when sending before hydration finishes', async () => {
    const savedConversationState = {
      conversationId: 'conv-fast',
      sessionDetail: {
        meta: {
          id: 'conv-fast',
          file: '/repo/fast.jsonl',
          timestamp: '2026-05-30T00:00:00.000Z',
          cwd: '/repo',
          cwdSlug: 'repo',
          model: 'gpt',
          title: 'Fast Conversation',
          messageCount: 1,
        },
        blocks: [{ type: 'text', id: 'text-1', text: 'Saved reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        contextUsage: null,
      },
      liveSession: { live: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Saved reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    let resolveInitialState: (state: Awaited<ReturnType<typeof api.conversationAggregate>>) => void = () => {};
    const initialStateRequest = new Promise<Awaited<ReturnType<typeof api.conversationAggregate>>>((resolve) => {
      resolveInitialState = resolve;
    });
    vi.spyOn(api, 'conversationAggregate').mockReturnValueOnce(initialStateRequest).mockResolvedValue(savedConversationState);
    const sendConversationMessage = vi.spyOn(api, 'sendConversationMessage').mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-fast" />);
      await flushPromises();
    });

    await act(async () => {
      await latestState?.send('send immediately');
      resolveInitialState(savedConversationState);
      await flushPromises();
    });

    expect(sendConversationMessage).toHaveBeenCalledWith(
      'conv-fast',
      'send immediately',
      undefined,
      undefined,
      undefined,
      expect.any(String),
      undefined,
      undefined,
    );
  });

  it('does not apply stale pre-send state after switching conversations', async () => {
    const convOneState = {
      conversationId: 'conv-1',
      sessionDetail: {
        meta: {
          id: 'conv-1',
          file: '/repo/conv-1.jsonl',
          timestamp: '2026-05-30T00:00:00.000Z',
          cwd: '/repo',
          cwdSlug: 'repo',
          model: 'gpt',
          title: 'First Conversation',
          messageCount: 1,
        },
        blocks: [{ type: 'text', id: 'text-1', text: 'First reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        contextUsage: null,
      },
      liveSession: { live: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'First reply', ts: '2026-05-30T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    const convTwoState = {
      ...convOneState,
      conversationId: 'conv-2',
      sessionDetail: {
        ...convOneState.sessionDetail,
        meta: { ...convOneState.sessionDetail.meta, id: 'conv-2', file: '/repo/conv-2.jsonl', title: 'Second Conversation' },
      },
      stream: {
        ...convOneState.stream,
        blocks: [{ type: 'text' as const, id: 'text-2', text: 'Second reply', ts: '2026-05-30T00:00:01.000Z' }],
      },
    } as unknown as Awaited<ReturnType<typeof api.conversationAggregate>>;
    let resolveSendState: (state: Awaited<ReturnType<typeof api.conversationAggregate>>) => void = () => {};
    const sendStateRequest = new Promise<Awaited<ReturnType<typeof api.conversationAggregate>>>((resolve) => {
      resolveSendState = resolve;
    });
    vi.spyOn(api, 'conversationAggregate')
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockReturnValueOnce(sendStateRequest)
      .mockResolvedValueOnce(convTwoState)
      .mockResolvedValue({
        ...convOneState,
        liveSession: { live: true, id: 'conv-1', cwd: '/repo', sessionFile: '/repo/conv-1.jsonl', isStreaming: false },
      });
    const sendConversationMessage = vi.spyOn(api, 'sendConversationMessage').mockResolvedValue({
      ok: true,
      accepted: true,
      delivery: 'started',
      referencedTaskIds: [],
      referencedMemoryDocIds: [],
      referencedKnowledgeFileIds: [],
      referencedAttachmentIds: [],
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-1" />);
      await flushPromises();
    });

    const sendPromise = latestState?.send('send while switching');

    await act(async () => {
      root.render(<HookProbe conversationId="conv-2" />);
      await flushPromises();
      await flushPromises();
    });
    expect(latestState?.state?.conversationId).toBe('conv-2');

    await act(async () => {
      resolveSendState(convOneState);
      await sendPromise;
      await flushPromises();
      await flushPromises();
    });

    expect(sendConversationMessage).toHaveBeenCalledWith(
      'conv-1',
      'send while switching',
      undefined,
      undefined,
      undefined,
      expect.any(String),
      undefined,
      undefined,
    );
    expect(latestState?.state?.conversationId).not.toBe('conv-1');
    expect(latestState?.state?.stream.blocks[0]).not.toEqual(expect.objectContaining({ text: 'First reply' }));
  });

  it('uses a primed reserved conversation as live state while refreshing desktop state and subscribing', async () => {
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockReturnValue(new Promise(() => undefined));

    primeReservedDesktopConversationStateCache(
      {
        conversationId: 'conv-reserved',
        sessionFile: '/repo/reserved.jsonl',
        cwd: '/repo',
      },
      { tailBlocks: 20 },
    );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-reserved" tailBlocks={20} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.conversationId).toBe('conv-reserved');
    expect(latestState?.state?.sessionDetail).toBeNull();
    expect(latestState?.state?.liveSession).toEqual(
      expect.objectContaining({
        live: true,
        id: 'conv-reserved',
        cwd: '/repo',
        sessionFile: '/repo/reserved.jsonl',
      }),
    );
    expect(conversationAggregate).toHaveBeenCalledWith('conv-reserved', { tailBlocks: 20 });
    expect(eventSources).toHaveLength(1);
  });

  it('does not let a stale non-live refresh make a reserved new conversation resume before sending', async () => {
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-reserved',
      sessionDetail: {
        meta: {
          id: 'conv-reserved',
          file: '/repo/reserved.jsonl',
          timestamp: '2026-05-24T00:00:00.000Z',
          cwd: '/repo',
          cwdSlug: 'repo',
          model: 'gpt-5',
          title: 'New Conversation',
          messageCount: 1,
          isRunning: false,
        },
        blocks: [{ type: 'user', id: 'user-1', text: 'Hi there', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        contextUsage: null,
      },
      bootstrap: null,
      liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: false,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });
    const resumeSession = vi.spyOn(api, 'resumeSession').mockResolvedValue({ id: 'conv-reserved' });
    const sendConversationMessage = vi.spyOn(api, 'sendConversationMessage').mockResolvedValue({ ok: true });

    primeReservedDesktopConversationStateCache(
      {
        conversationId: 'conv-reserved',
        sessionFile: '/repo/reserved.jsonl',
        cwd: '/repo',
      },
      { tailBlocks: 20 },
    );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-reserved" tailBlocks={20} />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.sessionDetail?.blocks).toEqual([expect.objectContaining({ type: 'user', text: 'Hi there' })]);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ live: true, id: 'conv-reserved' }));

    await act(async () => {
      await latestState?.send('Follow up');
      await flushPromises();
    });

    expect(resumeSession).not.toHaveBeenCalled();
    expect(sendConversationMessage).toHaveBeenCalledWith(
      'conv-reserved',
      'Follow up',
      undefined,
      undefined,
      undefined,
      expect.any(String),
      undefined,
      undefined,
    );
  });

  it('flushes text deltas on the next animation frame', async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(eventSources).toHaveLength(1);

    act(() => {
      eventSources[0]?.send({ type: 'text_delta', delta: 'Hel' });
      eventSources[0]?.send({ type: 'text_delta', delta: 'lo' });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(latestState?.state?.stream.blocks).toEqual([]);

    await act(async () => {
      frameCallbacks[0]?.(performance.now());
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toEqual([expect.objectContaining({ type: 'text', text: 'Hello' })]);
  });

  it('flushes stream deltas on a fallback timer when animation frames stall', async () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    act(() => {
      eventSources[0]?.send({ type: 'text_delta', delta: 'Fallback ' });
      eventSources[0]?.send({ type: 'tool_update', toolCallId: 'missing-tool', partialResult: 'ignored' });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frameCallbacks).toHaveLength(1);
    expect(latestState?.state?.stream.blocks).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(99);
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toEqual([expect.objectContaining({ type: 'text', text: 'Fallback ' })]);
  });

  it('preserves state identity when a flushed stream event is a no-op', async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Loaded transcript', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    const previousState = latestState?.state;
    expect(previousState?.stream.blocks).toHaveLength(1);

    act(() => {
      eventSources[0]?.send({ type: 'tool_update', toolCallId: 'missing-tool', partialResult: 'ignored' });
    });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    await act(async () => {
      frameCallbacks[0]?.(performance.now());
      await flushPromises();
    });

    expect(latestState?.state).toBe(previousState);
  });

  it('keeps live state healthy when a malformed SSE frame arrives', async () => {
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Loaded transcript', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    const previousState = latestState?.state;
    act(() => {
      eventSources[0]?.onmessage?.(new MessageEvent('message', { data: '{' }));
    });

    expect(latestState?.error).toBeNull();
    expect(latestState?.state).toBe(previousState);
    expect(latestState?.state?.stream.isStreaming).toBe(true);
  });

  it('refetches conversation state when reconnect is requested after a same-conversation cwd change', async () => {
    const conversationAggregate = vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
      stream: {
        blocks: [],
        blockOffset: 0,
        totalBlocks: 0,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    const initialFetchCount = conversationAggregate.mock.calls.length;
    expect(initialFetchCount).toBeGreaterThan(0);
    expect(conversationAggregate).toHaveBeenLastCalledWith('conv-1', { tailBlocks: 20 });

    await act(async () => {
      latestReconnect?.();
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(initialFetchCount + 1);
  });

  it('refreshes conversation state when the realtime app stream reports a session file change', async () => {
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(aggregateState('conv-1', [{ type: 'text', id: 'before', text: 'Before', ts: '2026-05-24T00:00:00.000Z' }]))
      .mockResolvedValueOnce(aggregateState('conv-1', [{ type: 'text', id: 'after', text: 'After', ts: '2026-05-24T00:00:01.000Z' }]));

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['before']);

    await act(async () => {
      eventSources[0]?.receive({ type: 'app_event', event: { type: 'session_file_changed', sessionId: 'conv-1' } });
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(2);
    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['after']);
  });

  it('refreshes conversation state when the renderer requests a local conversation refresh', async () => {
    const conversationAggregate = vi
      .spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(aggregateState('conv-1', [{ type: 'text', id: 'before', text: 'Before', ts: '2026-05-24T00:00:00.000Z' }]))
      .mockResolvedValueOnce(aggregateState('conv-1', [{ type: 'text', id: 'after', text: 'After', ts: '2026-05-24T00:00:01.000Z' }]));

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['before']);

    await act(async () => {
      notifyDesktopConversationStateRefresh('conv-1');
      await flushPromises();
      await flushPromises();
    });

    expect(conversationAggregate).toHaveBeenCalledTimes(2);
    expect(latestState?.state?.stream.blocks.map((block) => block.id)).toEqual(['after']);
  });

  it('preserves active streaming state and schedules reconnection when the SSE connection errors', async () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Initial', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(eventSources).toHaveLength(1);
    expect(latestState?.state?.stream.blocks).toHaveLength(1);
    expect(latestState?.state?.stream.isStreaming).toBe(true);

    // Simulate streaming events arriving just before an SSE error
    act(() => {
      eventSources[0]?.send({ type: 'tool_start', toolCallId: 'tool-1', toolName: 'bash', args: { command: 'pnpm test' } });
      eventSources[0]?.send({ type: 'text_delta', delta: 'Building...' });
    });

    // Simulate the SSE error. The transport failed, but the agent run may
    // still be active; only authoritative stream events should mark it idle.
    const blockIdsBeforeError = latestState?.state?.stream.blocks.map((b: { id: string }) => b.id);
    const previousEventSourceCount = eventSources.length;
    act(() => {
      eventSources[0]?.onerror?.(new Event('error'));
    });

    expect(latestState?.state?.stream.isStreaming).toBe(true);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ isStreaming: true }));
    expect(latestState?.error).toBeNull();
    // The blocks from the last flush should still be in the state
    expect(latestState?.state?.stream.blocks.slice(0, blockIdsBeforeError?.length).map((b: { id: string }) => b.id)).toEqual(
      blockIdsBeforeError,
    );
    expect(latestState?.state?.stream.blocks).toHaveLength(3);

    // After the reconnection delay, the SSE effect should re-establish the subscription
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushPromises();
    });

    // A new EventSource was created
    expect(eventSources.length).toBeGreaterThan(previousEventSourceCount);
    expect(latestState?.error).toBeNull();

    vi.useRealTimers();
  });

  it('ignores late SSE callbacks after the hook unmounts', async () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate').mockResolvedValue({
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text', id: 'text-1', text: 'Initial', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: true,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(eventSources).toHaveLength(1);

    act(() => {
      root.unmount();
    });

    expect(eventSources[0]?.closed).toBe(true);

    act(() => {
      eventSources[0]?.send({ type: 'text_delta', delta: 'Ignored after unmount' });
      eventSources[0]?.onerror?.(new Event('error'));
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushPromises();
    });

    expect(eventSources).toHaveLength(1);
    expect(frameCallbacks).toHaveLength(0);

    vi.useRealTimers();
  });

  it('clears active streaming state when an SSE error refresh shows the live session is gone', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        sessionDetail: null,
        bootstrap: null,
        liveSession: { live: true, title: null, isStreaming: true, hasStaleTurnState: false },
        stream: {
          blocks: [{ type: 'text', id: 'text-1', text: 'Initial', ts: '2026-05-24T00:00:00.000Z' }],
          blockOffset: 0,
          totalBlocks: 1,
          hasSnapshot: true,
          isStreaming: true,
          isCompacting: false,
          error: null,
          goalState: null,
          systemPrompt: null,
          toolDefinitions: [],
          pendingQueue: { steering: [], followUp: [] },
          presence: null,
          contextUsage: null,
          tokens: null,
          cost: null,
          cwdChange: null,
          title: null,
        },
      })
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        sessionDetail: null,
        bootstrap: null,
        liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
        stream: {
          blocks: [{ type: 'text', id: 'text-1', text: 'Initial', ts: '2026-05-24T00:00:00.000Z' }],
          blockOffset: 0,
          totalBlocks: 1,
          hasSnapshot: true,
          isStreaming: false,
          isCompacting: false,
          error: null,
          goalState: null,
          systemPrompt: null,
          toolDefinitions: [],
          pendingQueue: { steering: [], followUp: [] },
          presence: null,
          contextUsage: null,
          tokens: null,
          cost: null,
          cwdChange: null,
          title: null,
        },
      });

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe />);
      await flushPromises();
      await flushPromises();
    });

    expect(eventSources).toHaveLength(1);
    expect(latestState?.state?.stream.isStreaming).toBe(true);

    await act(async () => {
      eventSources[0]?.onerror?.(new Event('error'));
      await flushPromises();
      await flushPromises();
    });

    expect(api.conversationAggregate).toHaveBeenCalledTimes(2);
    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ live: false, isStreaming: false }));
    expect(latestState?.error).toBeNull();

    vi.useRealTimers();
  });

  it('keeps same-conversation state visible while refetching', async () => {
    let resolveSecondFetch: ((value: Awaited<ReturnType<typeof api.conversationAggregate>>) => void) | null = null;
    const initialState = {
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text' as const, id: 'block-1', text: 'Loaded transcript', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    };
    vi.spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(initialState)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondFetch = resolve;
          }),
      );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe tailBlocks={20} />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.stream.blocks).toHaveLength(1);

    await act(async () => {
      root.render(<HookProbe tailBlocks={40} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.stream.blocks).toHaveLength(1);

    await act(async () => {
      resolveSecondFetch?.({
        ...initialState,
        stream: {
          ...initialState.stream,
          blocks: [...initialState.stream.blocks, { type: 'text', id: 'block-2', text: 'More', ts: '2026-05-24T00:00:01.000Z' }],
        },
      });
      await flushPromises();
    });

    expect(latestState?.state?.stream.blocks).toHaveLength(2);
  });

  it('shows cached conversation state immediately when switching back to a recent thread', async () => {
    let resolveThirdFetch: ((value: Awaited<ReturnType<typeof api.conversationAggregate>>) => void) | null = null;
    const convOneState = {
      conversationId: 'conv-1',
      sessionDetail: null,
      bootstrap: null,
      liveSession: { live: false, title: null, isStreaming: false, hasStaleTurnState: false },
      stream: {
        blocks: [{ type: 'text' as const, id: 'block-1', text: 'Cached transcript', ts: '2026-05-24T00:00:00.000Z' }],
        blockOffset: 0,
        totalBlocks: 1,
        hasSnapshot: true,
        isStreaming: false,
        isCompacting: false,
        error: null,
        goalState: null,
        systemPrompt: null,
        toolDefinitions: [],
        pendingQueue: { steering: [], followUp: [] },
        presence: null,
        contextUsage: null,
        tokens: null,
        cost: null,
        cwdChange: null,
        title: null,
      },
    };
    const convTwoState = {
      ...convOneState,
      conversationId: 'conv-2',
      stream: {
        ...convOneState.stream,
        blocks: [{ type: 'text' as const, id: 'block-2', text: 'Second transcript', ts: '2026-05-24T00:00:01.000Z' }],
      },
    };
    vi.spyOn(api, 'conversationAggregate')
      .mockResolvedValueOnce(convOneState)
      .mockResolvedValueOnce(convTwoState)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveThirdFetch = resolve;
          }),
      );

    Object.defineProperty(window, 'neonPilotDesktop', {
      configurable: true,
      value: {
        getEnvironment: vi.fn().mockResolvedValue({ activeHostKind: 'local' }),
      },
    });

    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-1" tailBlocks={20} />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.conversationId).toBe('conv-1');
    expect(latestState?.state?.stream.blocks[0]).toEqual(expect.objectContaining({ text: 'Cached transcript' }));

    await act(async () => {
      root.render(<HookProbe conversationId="conv-2" tailBlocks={20} />);
      await flushPromises();
      await flushPromises();
    });

    expect(latestState?.state?.conversationId).toBe('conv-2');

    await act(async () => {
      root.render(<HookProbe conversationId="conv-1" tailBlocks={20} />);
      await flushPromises();
    });

    expect(latestState?.state?.conversationId).toBe('conv-1');
    expect(latestState?.state?.stream.blocks[0]).toEqual(expect.objectContaining({ text: 'Cached transcript' }));

    await act(async () => {
      resolveThirdFetch?.(convOneState);
      await flushPromises();
    });
  });
});
