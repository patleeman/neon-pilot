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

  it('preserves custom extension context blocks as context clusters', () => {
    const messages: MessageBlock[] = [
      { type: 'text', ts: '2026-03-12T18:00:00.000Z', text: 'Before' },
      {
        type: 'context',
        id: 'custom_status:test',
        ts: '2026-03-12T18:00:01.000Z',
        text: 'Custom status',
        customType: 'custom_status',
        details: { statusId: 'test-status', status: 'ready' },
      },
    ];

    expect(buildChatRenderItems(messages)).toEqual([
      expect.objectContaining({ type: 'message', index: 0 }),
      expect.objectContaining({
        type: 'context_cluster',
        startIndex: 1,
        endIndex: 1,
        blocks: [expect.objectContaining({ customType: 'custom_status', details: { statusId: 'test-status', status: 'ready' } })],
      }),
    ]);
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

  it('incrementally appends a user message after a trace cluster without rebuilding the cluster', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Do work' },
      { type: 'thinking', ts: '2026-03-12T18:00:01.000Z', text: 'Thinking...' },
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
    expect(nextRenderItems[1]).not.toBe(previousRenderItems[1]);
  });

  it('groups tool execution wrapper labels in trace summaries', () => {
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
            key: 'tool:bash:wrappers:Shadowfax \u2192 Repo Guard',
            kind: 'tool',
            label: 'Shadowfax \u2192 Repo Guard · bash',
            tool: 'bash',
            count: 2,
          },
        ],
      },
    });
  });
});
