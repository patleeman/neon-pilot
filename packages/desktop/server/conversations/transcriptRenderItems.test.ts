import { describe, expect, it } from 'vitest';

import type { DisplayBlock } from './sessions';
import { buildTranscriptRenderItemsFromDisplayBlocks } from './transcriptRenderItems';

const ts = '2026-05-24T12:00:00.000Z';

describe('transcript render items', () => {
  it('builds render-ready transcript items outside the renderer', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'hello' },
      { type: 'context', id: 'c1', ts, text: 'repo context' },
      { type: 'thinking', id: 't1', ts, text: 'thinking' },
      {
        type: 'tool_use',
        id: 'tool1',
        ts,
        tool: 'bash',
        input: { command: 'pnpm test' },
        output: 'ok',
        durationMs: 12,
        toolCallId: 'call-1',
      },
      { type: 'text', id: 'a1', ts, text: 'done' },
    ];

    const items = buildTranscriptRenderItemsFromDisplayBlocks(blocks);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ type: 'message', index: 0, block: { type: 'user', id: 'u1' } });
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 3,
      summary: {
        stepCount: 3,
        hasRunning: false,
        hasError: false,
        durationMs: 12,
      },
    });
    expect(items[2]).toMatchObject({ type: 'message', index: 4, block: { type: 'text', id: 'a1' } });
  });

  it('preserves extension transcript block details in context clusters', () => {
    const blocks: DisplayBlock[] = [
      {
        type: 'context',
        id: 'model_arena_duel:test',
        ts,
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: { duelId: 'test-duel', status: 'ready' },
      },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [
          expect.objectContaining({
            type: 'context',
            customType: 'model_arena_duel',
            details: { duelId: 'test-duel', status: 'ready' },
          }),
        ],
      }),
    ]);
  });

  it('replaces source assistant messages with active Model Arena duels in precomputed render items', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ customType: 'model_arena_duel', id: 'model_arena_duel:duel-1' })],
      }),
    ]);
  });

  it('keeps source assistant messages while active Model Arena duels are missing an answer', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Tell me a funny story' },
      { type: 'text', id: 'assistant-1-x5', ts, text: 'Primary story answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('replaces nearest matching assistant messages for legacy active Model Arena duels', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-legacy',
        ts,
        text: 'Model Arena duel',
        customType: 'model_arena_duel',
        details: {
          status: 'ready',
          sideA: { text: 'Original answer' },
          sideB: { text: 'Waiting for answer...' },
        },
      },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:duel-legacy' })],
      }),
    ]);
  });

  it('keeps active Model Arena duels out of the preceding precomputed trace cluster', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'thinking', id: 't1', ts, text: 'Checking queue docs' },
      { type: 'tool_use', id: 'tool-1', ts, tool: 'read', input: { path: 'queue.md' }, output: '...', status: 'ok' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('precomputes only the newest active Model Arena duel for the same assistant response', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('precomputes cancelled Model Arena duels as the source assistant message only', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1', text: 'Original answer' }),
      }),
    ]);
  });

  it('precomputes Model Arena source ids across split display block aliases', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('precomputes later voted Model Arena duels over older active duplicates', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('precomputes later cancelled Model Arena duels over older active duplicates', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:old',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1', text: 'Original answer' }),
      }),
    ]);
  });

  it('keeps precomputed voted Model Arena variations when a later duplicate duel is cancelled', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('precomputes newer active Model Arena duels after older voted duplicates', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('keeps precomputed voted Model Arena variations when a newer duplicate duel is still missing an answer', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:voted',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('precomputes newer active Model Arena duels after older cancelled duplicates', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:cancelled',
        ts,
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
        ts,
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

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'context_cluster',
        blocks: [expect.objectContaining({ id: 'model_arena_duel:new' })],
      }),
    ]);
  });

  it('precomputes legacy automatic voted Model Arena duels that appear before the assistant answer', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      {
        type: 'context',
        id: 'model_arena_duel:auto',
        ts,
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
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
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

  it('collapses voted Model Arena duels into precomputed assistant variations', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'Explain queues' },
      { type: 'text', id: 'assistant-1', ts, text: 'Original answer' },
      {
        type: 'context',
        id: 'model_arena_duel:duel-1',
        ts,
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
          },
        },
      },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ type: 'user', id: 'u1' }) }),
      expect.objectContaining({
        type: 'message',
        block: expect.objectContaining({ type: 'text', id: 'assistant-1' }),
        arenaVariationSet: expect.objectContaining({
          sourceBlockId: 'assistant-1',
          variations: [expect.objectContaining({ text: 'Original answer' }), expect.objectContaining({ text: 'Challenger answer' })],
        }),
      }),
    ]);
  });

  it('keeps terminal bash blocks as visible messages instead of trace clusters', () => {
    const blocks: DisplayBlock[] = [
      {
        type: 'tool_use',
        id: 'terminal-bash',
        ts,
        tool: 'bash',
        input: { command: 'echo hi', displayMode: 'terminal' },
        output: 'hi',
        toolCallId: 'call-1',
      },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      {
        type: 'message',
        index: 0,
        block: expect.objectContaining({ type: 'tool_use', id: 'terminal-bash', _toolCallId: 'call-1' }),
      },
    ]);
  });

  it('matches client trace summaries for wrapped tool calls', () => {
    const blocks: DisplayBlock[] = [
      {
        type: 'tool_use',
        id: 'tool1',
        ts,
        tool: 'bash',
        input: {
          command: 'pnpm test',
          executionWrappers: [
            { id: 'agent', label: 'agent' },
            { id: 'sandbox', label: 'sandbox' },
          ],
        },
        output: 'ok',
        durationMs: 12,
        toolCallId: 'call-1',
      },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({
        type: 'trace_cluster',
        summary: expect.objectContaining({
          categories: [
            expect.objectContaining({
              key: 'tool:bash:wrappers:agent → sandbox',
              label: 'agent → sandbox · bash',
              tool: 'bash',
            }),
          ],
        }),
      }),
    ]);
  });

  it('keeps compaction summaries as visible transcript markers', () => {
    const blocks: DisplayBlock[] = [
      { type: 'text', id: 'a1', ts, text: 'before' },
      {
        type: 'summary',
        id: 'compact-1',
        ts,
        kind: 'compaction',
        title: 'Proactive compaction',
        text: '## Goal\nKeep the useful context.',
      },
      { type: 'text', id: 'a2', ts, text: 'after' },
    ];

    expect(buildTranscriptRenderItemsFromDisplayBlocks(blocks)).toEqual([
      expect.objectContaining({ type: 'message', index: 0, block: expect.objectContaining({ id: 'a1' }) }),
      expect.objectContaining({ type: 'message', index: 1, block: expect.objectContaining({ type: 'summary', id: 'compact-1' }) }),
      expect.objectContaining({ type: 'message', index: 2, block: expect.objectContaining({ id: 'a2' }) }),
    ]);
  });

  it('keeps persisted image blocks and user attachment images visible in saved-route render items', () => {
    const blocks: DisplayBlock[] = [
      {
        type: 'user',
        id: 'u-image',
        ts,
        text: 'Inspect this screenshot',
        images: [
          {
            alt: 'Attached image: screenshot.png',
            src: 'data:image/png;base64,c2NyZWVuc2hvdA==',
            mimeType: 'image/png',
            caption: 'screenshot.png',
          },
        ],
      },
      {
        type: 'image',
        id: 'assistant-image',
        ts,
        alt: 'Latest desktop build',
        src: 'data:image/png;base64,YnVpbGQ=',
        mimeType: 'image/png',
        width: 640,
        height: 360,
        caption: 'Latest desktop build',
      },
      {
        type: 'summary',
        id: 'compact-1',
        ts,
        kind: 'compaction',
        title: 'Overflow recovery compaction',
        text: '## Goal\nKeep image context after reload.',
      },
    ];

    const items = buildTranscriptRenderItemsFromDisplayBlocks(blocks);

    expect(items).toEqual([
      expect.objectContaining({
        type: 'message',
        index: 0,
        block: expect.objectContaining({
          type: 'user',
          id: 'u-image',
          images: [
            expect.objectContaining({
              alt: 'Attached image: screenshot.png',
              src: 'data:image/png;base64,c2NyZWVuc2hvdA==',
              mimeType: 'image/png',
            }),
          ],
        }),
      }),
      expect.objectContaining({
        type: 'message',
        index: 1,
        block: expect.objectContaining({
          type: 'image',
          id: 'assistant-image',
          src: 'data:image/png;base64,YnVpbGQ=',
          caption: 'Latest desktop build',
        }),
      }),
      expect.objectContaining({
        type: 'message',
        index: 2,
        block: expect.objectContaining({ type: 'summary', kind: 'compaction', id: 'compact-1' }),
      }),
    ]);
  });
});
