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

  it('folds context blocks adjacent to internal work into the same cluster', () => {
    const messages: MessageBlock[] = [
      { type: 'user', ts: '2026-03-12T18:00:00.000Z', text: 'Continue' },
      { type: 'context', ts: '2026-03-12T18:00:01.000Z', text: 'Goal continuation', title: 'Goal continuation' },
      { type: 'tool_use', ts: '2026-03-12T18:00:02.000Z', tool: 'read', input: { path: 'file.ts' }, output: '...', status: 'ok' },
      { type: 'summary', ts: '2026-03-12T18:00:03.000Z', text: 'Overflow recovery compaction', kind: 'compaction' },
      { type: 'text', ts: '2026-03-12T18:00:04.000Z', text: 'Done.' },
    ];

    const items = buildChatRenderItems(messages);

    expect(items).toHaveLength(3);
    expect(items[1]).toMatchObject({
      type: 'trace_cluster',
      startIndex: 1,
      endIndex: 3,
      summary: {
        stepCount: 3,
        categories: [
          { key: 'context', kind: 'context', label: 'context', count: 2 },
          { key: 'tool:read', kind: 'tool', label: 'read', tool: 'read', count: 1 },
        ],
      },
    });
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
