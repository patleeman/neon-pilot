import { describe, expect, it } from 'vitest';

import { buildTranscriptRenderItemsFromDisplayBlocks } from './transcriptRenderItems';
import type { DisplayBlock } from './sessions';

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
});
