import { describe, expect, it } from 'vitest';

import { buildTranscriptRenderItemsFromDisplayBlocks, projectConversationOnlySessionDetail } from './conversationTranscriptProjection';
import type { DisplayBlock } from './sessions';

const ts = '2026-05-24T12:00:00.000Z';

describe('conversation transcript projection', () => {
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

  it('projects saved transcript detail without eager internal-work blocks', () => {
    const blocks: DisplayBlock[] = [
      { type: 'user', id: 'u1', ts, text: 'please test this' },
      {
        type: 'tool_use',
        id: 'tool1',
        ts,
        tool: 'read',
        input: { path: 'src/app.ts' },
        output: 'large output',
        toolCallId: 'call-1',
      },
      { type: 'text', id: 'a1', ts, text: 'done' },
    ];

    const detail = projectConversationOnlySessionDetail({
      meta: { id: 'conv-1' },
      blocks,
      blockOffset: 0,
      totalBlocks: blocks.length,
      contextUsage: null,
    } as never);

    expect(detail?.blocks).toEqual([blocks[0], blocks[2]]);
    expect(detail?.renderItems).toEqual([
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ id: 'u1' }) }),
      expect.objectContaining({
        type: 'trace_cluster',
        blocks: [],
        deferredBlockIds: ['tool1'],
        summary: expect.objectContaining({ stepCount: 1 }),
      }),
      expect.objectContaining({ type: 'message', block: expect.objectContaining({ id: 'a1' }) }),
    ]);
  });
});
