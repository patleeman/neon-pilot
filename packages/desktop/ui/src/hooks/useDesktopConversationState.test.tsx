// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const eventSources = vi.hoisted(() => [] as FakeEventSource[]);

class FakeEventSource {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 1;
  closed = false;

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  send(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

vi.mock('../desktop/desktopEventSource', () => ({
  createDesktopAwareEventSource: vi.fn(() => {
    const source = new FakeEventSource();
    eventSources.push(source);
    return source;
  }),
}));

import { api } from '../client/api.js';
import {
  applyDesktopConversationStreamEvent,
  applyDesktopConversationStreamEvents,
  clearDesktopConversationStateCacheForTests,
  normalizeDesktopConversationStateTailBlocks,
  prefetchDesktopConversationState,
  primeDesktopConversationStateCache,
  primeReservedDesktopConversationStateCache,
  useDesktopConversationState,
} from './useDesktopConversationState.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];
let latestReconnect: (() => void) | null = null;
let latestState: ReturnType<typeof useDesktopConversationState> | null = null;

function HookProbe({ conversationId = 'conv-1', tailBlocks = 20 }: { conversationId?: string; tailBlocks?: number }) {
  latestState = useDesktopConversationState(conversationId, { tailBlocks });
  latestReconnect = latestState.reconnect;
  return null;
}

function flushPromises() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
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
      details: { state: { objective: '', status: 'complete', stopReason: 'goal achieved', updatedAt: '2026-05-24T00:00:01.000Z' } },
    });

    expect(next.goalState).toBeNull();
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
    const queueUpdated = applyDesktopConversationStreamEvent(stream, { type: 'queue_state', steering: ['note'], followUp: [] });
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
    expect(statsUpdated.blocks).toBe(blocks);
    expect(repeatedAgentStart).toBe(stream);
    expect(idleToolEnd).toBe(stream);
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
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'neonPilotDesktop');
  });

  it('treats an empty desktop conversation response as loaded state', async () => {
    vi.spyOn(api, 'desktopConversationState').mockResolvedValue({
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
  });

  it('reuses an in-flight desktop conversation prefetch when the page opens', async () => {
    let resolveRequest: (state: Awaited<ReturnType<typeof api.desktopConversationState>>) => void = () => {};
    const request = new Promise<Awaited<ReturnType<typeof api.desktopConversationState>>>((resolve) => {
      resolveRequest = resolve;
    });
    const desktopConversationState = vi.spyOn(api, 'desktopConversationState').mockReturnValue(request);

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
    expect(desktopConversationState).toHaveBeenCalledTimes(1);

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

  it('uses a primed create bootstrap as the initial desktop conversation state', async () => {
    const desktopConversationState = vi.spyOn(api, 'desktopConversationState').mockReturnValue(new Promise(() => undefined));

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
    expect(desktopConversationState).not.toHaveBeenCalled();
  });

  it('uses a primed reserved conversation as live state without fetching before subscription', async () => {
    const desktopConversationState = vi.spyOn(api, 'desktopConversationState').mockReturnValue(new Promise(() => undefined));

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
    expect(desktopConversationState).not.toHaveBeenCalled();
    expect(eventSources).toHaveLength(1);
  });

  it('flushes text deltas on the next animation frame', async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'desktopConversationState').mockResolvedValue({
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

  it('preserves state identity when a flushed stream event is a no-op', async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'desktopConversationState').mockResolvedValue({
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

  it('refetches conversation state when reconnect is requested after a same-conversation cwd change', async () => {
    const desktopConversationState = vi.spyOn(api, 'desktopConversationState').mockResolvedValue({
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

    const initialFetchCount = desktopConversationState.mock.calls.length;
    expect(initialFetchCount).toBeGreaterThan(0);
    expect(desktopConversationState).toHaveBeenLastCalledWith('conv-1', { tailBlocks: 20 });

    await act(async () => {
      latestReconnect?.();
      await flushPromises();
      await flushPromises();
    });

    expect(desktopConversationState).toHaveBeenCalledTimes(initialFetchCount + 1);
  });

  it('keeps same-conversation state visible while refetching', async () => {
    let resolveSecondFetch: ((value: Awaited<ReturnType<typeof api.desktopConversationState>>) => void) | null = null;
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
    vi.spyOn(api, 'desktopConversationState')
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
    let resolveThirdFetch: ((value: Awaited<ReturnType<typeof api.desktopConversationState>>) => void) | null = null;
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
    vi.spyOn(api, 'desktopConversationState')
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
