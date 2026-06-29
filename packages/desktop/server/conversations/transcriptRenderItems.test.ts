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
