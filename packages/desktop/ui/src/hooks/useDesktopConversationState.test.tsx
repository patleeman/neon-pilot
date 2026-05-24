// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api.js';
import {
  applyDesktopConversationStreamEvent,
  normalizeDesktopConversationStateTailBlocks,
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

describe('useDesktopConversationState', () => {
  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => root.unmount());
    }
    latestReconnect = null;
    latestState = null;
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'neonPilotDesktop');
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
});
