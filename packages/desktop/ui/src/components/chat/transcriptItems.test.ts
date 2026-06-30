import { describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { buildChatRenderItems, buildChatRenderItemsIncremental } from './transcriptItems.js';

describe('chat transcript items', () => {
  it('groups consecutive internal trace blocks into one cluster', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Check the transcript layout' },
      { type: 'thinking', ts: '2026-03-12T18:00:01.000Z', text: 'Plan the work' },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:02.000Z',
        tool: 'bash',
        input: { command: 'pwd' },
        output: '/repo',
        durationMs: 1100,
        status: 'ok',
      },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:03.000Z',
        tool: 'read',
        input: { path: 'ChatView.tsx' },
        output: '...',
        durationMs: 900,
        status: 'ok',
      },
      { type: 'text', ts: '2026-03-12T18:00:04.000Z', text: 'Here is the result.' },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ type: 'message', index: 0 });
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 3,
      summary: {
        stepCount: 3,
        durationMs: 2000,
        hasRunning: false,
        hasError: false,
        categories: [
          { key: 'thinking', kind: 'thinking', label: 'thinking', count: 1 },
          { key: 'tool:bash', kind: 'tool', label: 'bash', tool: 'bash', count: 1 },
          { key: 'tool:read', kind: 'tool', label: 'read', tool: 'read', count: 1 },
        ],
      },
    });
    expect(items[2]).toMatchObject({ type: 'message', index: 4 });
  });

  it('folds context blocks adjacent to internal work into the same cluster without absorbing compaction markers', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Continue' },
      { type: 'context', ts: '2026-03-12T18:00:01.000Z', text: 'Goal continuation', title: 'Goal continuation' },
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'read', input: { path: 'file.ts' }, output: '...', status: 'ok' },
      { type: 'summary', ts: '2026-03-12T18:00:03.000Z', text: 'Overflow recovery compaction', kind: 'compaction' },
      { type: 'text', ts: '2026-03-12T18:00:04.000Z', text: 'Done.' },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(4);
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 2,
      summary: {
        stepCount: 2,
        categories: [
          { key: 'context', kind: 'context', label: 'context', count: 1 },
          { key: 'tool:read', kind: 'tool', label: 'read', tool: 'read', count: 1 },
        ],
      },
    });
    expect(items[2]).toMatchObject({ type: 'message', index: 3, block: { type: 'summary', kind: 'compaction' } });
  });

  it('keeps artifact tool blocks inside internal-work even when extension marks them standalone', () => {
    const standaloneTools = new Set(['artifact']);
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Show me the mockup' },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:01.000Z',
        tool: 'artifact',
        input: { action: 'save' },
        output: 'Saved artifact',
        status: 'ok',
      },
      { type: 'text', ts: '2026-03-12T18:00:02.000Z', text: 'Opened the artifact.' },
    ];

    const items = buildChatRenderItems(messages, standaloneTools);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ type: 'message', index: 0 });
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 1,
      summary: {
        stepCount: 1,
        categories: [{ key: 'tool:artifact', kind: 'tool', label: 'artifact', tool: 'artifact', count: 1 }],
      },
    });
    expect(items[2]).toMatchObject({ type: 'message', index: 2 });
  });

  it('keeps terminal-style bash blocks visible as standalone message items even without extension registration', () => {
    const messages: MessageBlock[] = [
      { type: 'text', ts: '2026-03-12T18:00:00.000Z', text: 'Retry it directly.' },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:01.000Z',
        tool: 'bash',
        input: { command: 'npm run release:publish' },
        output: '/bin/bash: npm: command not found',
        status: 'error',
        details: { displayMode: 'terminal', exitCode: 127 },
      },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.type === 'message')).toBe(true);
  });

  it('keeps ask_user tool blocks inside internal-work even when extension marks them standalone', () => {
    const standaloneTools = new Set(['ask_user']);
    const messages: MessageBlock[] = [
      { type: 'text', ts: '2026-03-12T18:00:00.000Z', text: 'I need one clarification.' },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:01.000Z',
        tool: 'ask_user',
        input: { question: 'Which environment should I use?', options: ['staging', 'prod'] },
        output: 'Asked the user: Which environment should I use?',
        status: 'ok',
      },
    ];

    const items = buildChatRenderItems(messages, standaloneTools);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'message', index: 0 });
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 1,
      summary: {
        stepCount: 1,
        categories: [{ key: 'tool:ask_user', kind: 'tool', label: 'ask_user', tool: 'ask_user', count: 1 }],
      },
    });
  });

  it('replaces the source assistant message with an active Model Arena duel', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
        },
      },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'message', block: { type: 'user', id: 'u1' } });
    expect(items[1]).toMatchObject({
      type: 'context_cluster',
      blocks: [expect.objectContaining({ customType: 'model_arena_duel', id: 'model_arena_duel:duel-1' })],
    });
  });

  it('keeps the source assistant message visible while an active Model Arena duel is missing an answer', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Tell me a funny story' },
      { type: 'text', id: 'assistant-1-x5', ts: '2026-03-12T18:00:01.000Z', text: 'Primary story answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1-x5',
          status: 'running',
          sideA: { role: 'primary', text: 'Primary story answer' },
          sideB: { role: 'challenger', text: '' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1-x5', text: 'Primary story answer' }),
        arenaVariationSet: undefined,
      }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ customType: 'model_arena_duel', id: 'model_arena_duel:duel-1' })],
      }),
    ]);
  });

  it('replaces the nearest matching assistant message for legacy active Model Arena duels', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-legacy',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          status: 'ready',
          sideA: { text: 'Original answer' },
          sideB: { text: 'Waiting for answer...' },
        },
      },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      type: 'context_cluster',
      blocks: [expect.objectContaining({ id: 'model_arena_duel:duel-legacy' })],
    });
  });

  it('keeps active Model Arena duels out of the preceding trace cluster', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'thinking', ts: '2026-03-12T18:00:01.000Z', text: 'Checking queue docs' },
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'read', input: { path: 'queue.md' }, output: '...', status: 'ok' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:03.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:04.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({ type: 'trace_cluster', startIndex: 1, endIndex: 2 }),
      expect.objectContaining({
        type: 'context_cluster',
        startIndex: 4,
        endIndex: 4,
        blocks: [expect.objectContaining({ customType: 'model_arena_duel' })],
      }),
    ]);
  });

  it('shows only the newest active Model Arena duel for the same assistant response', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Older challenger answer' },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:new',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Newer challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('collapses a cancelled Model Arena duel back to the source assistant message', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'cancelled',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1', text: 'Original answer' }),
      }),
    ]);
  });

  it('does not let older active Model Arena duels override a later voted duel', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Older challenger answer' },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Voted challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Voted challenger answer' })],
        }),
      }),
    ]);
  });

  it('does not let older active Model Arena duels override a later cancelled duel', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Older challenger answer' },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:cancelled',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'cancelled',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Cancelled challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1', text: 'Original answer' }),
      }),
    ]);
  });

  it('keeps voted Model Arena variations when a later duplicate duel is cancelled', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Voted challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:cancelled',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'cancelled',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Cancelled challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          duelBlockId: 'model_arena_duel:voted',
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Voted challenger answer' })],
        }),
      }),
    ]);
  });

  it('matches Model Arena source ids across split display block aliases', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1-x20',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Challenger answer' })],
        }),
      }),
    ]);
  });

  it('incrementally restores the assistant row when an active Model Arena duel is cancelled', () => {
    const readyMessages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
        },
      },
    ];
    const cancelledMessages: MessageBlock[] = [
      readyMessages[0]!,
      readyMessages[1]!,
      {
        ...readyMessages[2]!,
        details: {
          ...(readyMessages[2] as Extract<MessageBlock, { type: 'context' }>).details,
          status: 'cancelled',
        },
      },
    ];

    const readyItems = buildChatRenderItems(readyMessages);
    const nextItems = buildChatRenderItemsIncremental({
      messages: cancelledMessages,
      previousMessages: readyMessages,
      previousRenderItems: readyItems,
    });

    expect(nextItems).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'text', id: 'assistant-1' }) }),
    ]);
  });

  it('incrementally restores response variations when an active Model Arena duel is voted', () => {
    const readyMessages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
        },
      },
    ];
    const votedMessages: MessageBlock[] = [
      readyMessages[0]!,
      readyMessages[1]!,
      {
        ...readyMessages[2]!,
        details: {
          ...(readyMessages[2] as Extract<MessageBlock, { type: 'context' }>).details,
          status: 'voted',
          vote: 'b',
          revealed: true,
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
    ];

    const readyItems = buildChatRenderItems(readyMessages);
    const nextItems = buildChatRenderItemsIncremental({
      messages: votedMessages,
      previousMessages: readyMessages,
      previousRenderItems: readyItems,
    });

    expect(nextItems).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Challenger answer' })],
        }),
      }),
    ]);
  });

  it('shows a newer active Model Arena duel after an older voted duel for the same answer', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Old challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:new',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'New challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('keeps voted Model Arena variations when a newer duplicate duel is still missing an answer', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'a',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Voted challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:running',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'running',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: '' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          duelBlockId: 'model_arena_duel:voted',
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Voted challenger answer' })],
        }),
      }),
    ]);
  });

  it('shows a newer active Model Arena duel after an older cancelled duel for the same answer', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:cancelled',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'cancelled',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Cancelled challenger answer' },
        },
      },
      {
        type: 'context',
        id: 'model_arena_duel:new',
        ts: '2026-03-12T18:00:03.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'New challenger answer' },
        },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('collapses legacy automatic voted Model Arena duels that appear before the assistant answer', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      {
        type: 'context',
        id: 'model_arena_duel:auto',
        ts: '2026-03-12T18:00:01.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Automatic challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:02.000Z', text: 'Original answer' },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          variations: [
            expect.objectContaining({ text: 'Original answer' }),
            expect.objectContaining({ text: 'Automatic challenger answer' }),
          ],
        }),
      }),
    ]);
  });

  it('collapses a voted Model Arena duel into assistant response variations', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'u1', ts: '2026-03-12T18:00:00.000Z', text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts: '2026-03-12T18:00:01.000Z', text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts: '2026-03-12T18:00:02.000Z',
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Original answer' },
          sideB: { role: 'challenger', text: 'Challenger answer' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
            a: 'opencode-go/glm-5.2',
            b: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      type: 'message',
      block: { type: 'text', id: 'assistant-1' },
      arenaVariationSet: {
        sourceBlockId: 'assistant-1',
        duelBlockId: 'model_arena_duel:duel-1',
        variations: [
          expect.objectContaining({ label: 'Current model · opencode-go/glm-5.2', text: 'Original answer' }),
          expect.objectContaining({ label: 'Challenger · opencode-go/deepseek-v4-flash', text: 'Challenger answer' }),
        ],
      },
    });
  });

  it('summarizes trace categories, duration, and running/error state inside trace clusters', () => {
    const items = buildChatRenderItems([
      { type: 'thinking', ts: '2026-03-12T18:00:00.000Z', text: 'Thinking…' },
      { type: 'tool_use', ts: '2026-03-12T18:00:01.000Z', tool: 'bash', input: {}, output: '', durationMs: 1400, status: 'ok' },
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'bash', input: {}, output: '', status: 'running' },
      { type: 'error', ts: '2026-03-12T18:00:03.000Z', message: 'boom' },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'trace_cluster',
      summary: {
        stepCount: 4,
        durationMs: 1400,
        hasRunning: true,
        hasError: true,
        categories: [
          { key: 'thinking', kind: 'thinking', label: 'thinking', count: 1 },
          { key: 'tool:bash', kind: 'tool', label: 'bash', tool: 'bash', count: 2 },
          { key: 'error', kind: 'error', label: 'error', count: 1 },
        ],
      },
    });
  });

  it('incrementally appends a user message after a trace cluster without rebuilding the cluster', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Do work' },
      { type: 'thinking', ts: '2026-03-12T18:00:01.000Z', text: 'Thinking…' },
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'bash', input: {}, output: 'ok', status: 'ok' },
    ];
    const previousRenderItems = buildChatRenderItems(messages);
    const nextMessages: MessageBlock[] = [...messages, { type: 'user', ts: '2026-03-12T18:00:03.000Z', text: 'Queued prompt' }];

    const nextRenderItems = buildChatRenderItemsIncremental({
      messages: nextMessages,
      previousMessages: messages,
      previousRenderItems,
    });

    expect(nextRenderItems).toEqual(buildChatRenderItems(nextMessages));
    expect(nextRenderItems[1]).toBe(previousRenderItems[1]);
  });

  it('incrementally rebuilds a pending context cluster when appended trace absorbs it', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Continue' },
      { type: 'context', ts: '2026-03-12T18:00:01.000Z', text: 'Context', title: 'Context' },
    ];
    const previousRenderItems = buildChatRenderItems(messages);
    const nextMessages: MessageBlock[] = [
      ...messages,
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'read', input: {}, output: 'ok', status: 'ok' },
    ];

    const nextRenderItems = buildChatRenderItemsIncremental({
      messages: nextMessages,
      previousMessages: messages,
      previousRenderItems,
    });

    expect(nextRenderItems).toEqual(buildChatRenderItems(nextMessages));
    expect(nextRenderItems[1]).toMatchObject({ type: 'trace_cluster', startIndex: 1, endIndex: 2 });
  });

  it('includes chained execution wrappers in internal-work tool summaries', () => {
    const items = buildChatRenderItems([
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:01.000Z',
        tool: 'bash',
        input: {},
        output: 'ok',
        status: 'ok',
        details: {
          executionWrappers: [
            { id: 'shadowfax', label: 'Shadowfax' },
            { id: 'repo-guard', label: 'Repo Guard' },
          ],
        },
      },
      {
        type: 'tool_use',
        ts: '2026-03-12T18:00:02.000Z',
        tool: 'bash',
        input: {},
        output: 'ok again',
        status: 'ok',
        details: {
          executionWrappers: [
            { id: 'shadowfax', label: 'Shadowfax' },
            { id: 'repo-guard', label: 'Repo Guard' },
          ],
        },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'trace_cluster',
      summary: {
        categories: [
          {
            key: 'tool:bash:wrappers:Shadowfax → Repo Guard',
            kind: 'tool',
            label: 'Shadowfax → Repo Guard · bash',
            tool: 'bash',
            count: 2,
          },
        ],
      },
    });
  });
});
