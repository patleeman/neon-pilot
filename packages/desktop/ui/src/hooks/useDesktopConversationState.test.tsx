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
import { primeConversationBootstrapCache } from './useConversationBootstrap.js';
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
  return new Promise((resolve) => queueMicrotask(resolve));
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
    expect(desktopConversationState).toHaveBeenCalledWith('conv-created', { tailBlocks: 20 });
  });

  it('seeds saved desktop conversations from the bootstrap cache while refreshing desktop state', async () => {
    const desktopConversationState = vi.spyOn(api, 'desktopConversationState').mockReturnValue(new Promise(() => undefined));

    primeConversationBootstrapCache(
      'conv-cached',
      {
        conversationId: 'conv-cached',
        sessionDetail: {
          meta: {
            id: 'conv-cached',
            file: '/repo/cached.jsonl',
            timestamp: '2026-05-30T00:00:00.000Z',
            cwd: '/repo',
            cwdSlug: 'repo',
            model: 'gpt',
            title: 'Cached Conversation',
            messageCount: 2,
          },
          blocks: [{ type: 'text', id: 'text-1', text: 'Cached reply', ts: '2026-05-30T00:00:00.000Z' }],
          blockOffset: 0,
          totalBlocks: 1,
          contextUsage: null,
        },
        liveSession: { live: false },
      },
      { tailBlocks: 20, includeToolBlocks: false },
      '1',
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
      root.render(<HookProbe conversationId="conv-cached" tailBlocks={20} includeToolBlocks={false} />);
      await flushPromises();
    });

    expect(latestState?.loading).toBe(false);
    expect(latestState?.state?.sessionDetail?.blocks).toEqual([expect.objectContaining({ text: 'Cached reply' })]);
    expect(latestState?.state?.stream.blocks).toEqual([expect.objectContaining({ text: 'Cached reply' })]);
    expect(desktopConversationState).toHaveBeenCalledWith('conv-cached', { tailBlocks: 20, includeToolBlocks: false });
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
    } satisfies Awaited<ReturnType<typeof api.desktopConversationState>>;
    vi.spyOn(api, 'desktopConversationState')
      .mockResolvedValueOnce(savedConversationState)
      .mockResolvedValue({
        ...savedConversationState,
        liveSession: { live: true, id: 'conv-saved', cwd: '/repo', sessionFile: '/repo/saved.jsonl', isStreaming: false },
      });
    const resumeSession = vi.spyOn(api, 'resumeSession').mockResolvedValue({ id: 'conv-saved' });
    const promptSession = vi.spyOn(api, 'promptSession').mockResolvedValue({
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

    expect(resumeSession).toHaveBeenCalledWith('/repo/saved.jsonl', '/repo');
    expect(promptSession).toHaveBeenCalledWith(
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
    expect(eventSources).toHaveLength(1);
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
    } satisfies Awaited<ReturnType<typeof api.desktopConversationState>>;
    let resolveInitialState: (state: Awaited<ReturnType<typeof api.desktopConversationState>>) => void = () => {};
    const initialStateRequest = new Promise<Awaited<ReturnType<typeof api.desktopConversationState>>>((resolve) => {
      resolveInitialState = resolve;
    });
    vi.spyOn(api, 'desktopConversationState').mockReturnValueOnce(initialStateRequest).mockResolvedValue(savedConversationState);
    const resumeSession = vi.spyOn(api, 'resumeSession').mockResolvedValue({ id: 'conv-fast' });
    const promptSession = vi.spyOn(api, 'promptSession').mockResolvedValue({
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

    expect(resumeSession).toHaveBeenCalledWith('/repo/fast.jsonl', '/repo');
    expect(promptSession).toHaveBeenCalledWith(
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

  it('uses a primed reserved conversation as live state while refreshing desktop state and subscribing', async () => {
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
    expect(desktopConversationState).toHaveBeenCalledWith('conv-reserved', { tailBlocks: 20 });
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

  it('preserves active streaming state and schedules reconnection when the SSE connection errors', async () => {
    vi.useFakeTimers();
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

  it('clears active streaming state when an SSE error refresh shows the live session is gone', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(api, 'desktopConversationState')
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

    expect(api.desktopConversationState).toHaveBeenCalledTimes(2);
    expect(latestState?.state?.stream.isStreaming).toBe(false);
    expect(latestState?.state?.liveSession).toEqual(expect.objectContaining({ live: false, isStreaming: false }));
    expect(latestState?.error).toBeNull();

    vi.useRealTimers();
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
