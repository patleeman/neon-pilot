// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api.js';
import {
  applyDesktopConversationStreamEvent,
  applyDesktopConversationStreamEvents,
  clearDesktopConversationStateCacheForTests,
  normalizeDesktopConversationStateTailBlocks,
  prefetchDesktopConversationState,
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
}: {
  conversationId?: string;
  tailBlocks?: number;
  includeToolBlocks?: boolean;
}) {
  latestState = useDesktopConversationState(conversationId, { tailBlocks, includeToolBlocks });
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

    const prefetch = prefetchDesktopConversationState('conv-prefetch', { tailBlocks: 20, includeToolBlocks: false });
    const root = createRoot(document.createElement('div'));
    mountedRoots.push(root);

    await act(async () => {
      root.render(<HookProbe conversationId="conv-prefetch" tailBlocks={20} includeToolBlocks={false} />);
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
