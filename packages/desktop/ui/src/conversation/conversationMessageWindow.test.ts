import { describe, expect, it } from 'vitest';

import type { PendingConversationPrompt } from '../pending/pendingConversationPrompt';
import {
  countVisibleAgentTurns,
  pruneComputedMessages,
  resolveComputedMessagesRaw,
  resolveTranscriptWindowPercent,
  shouldShowEarlierTranscriptBoundary,
} from './conversationMessageWindow';

const block = (id: string) => ({ id, type: 'text', text: id }) as never;
const prompt = (text: string): PendingConversationPrompt => ({ text, images: [], attachmentRefs: [] });
const append = (messages: never[] | undefined, pendingPrompt: PendingConversationPrompt | null) =>
  pendingPrompt ? [...(messages ?? []), block(`pending:${pendingPrompt.text}`)] : messages;
const merge = (baseMessages: never[], visibleStreamBlocks: never[]) => [...baseMessages, ...visibleStreamBlocks];

describe('conversationMessageWindow', () => {
  it('resolves draft, live, and static message sources', () => {
    expect(
      resolveComputedMessagesRaw({
        draft: true,
        draftPendingPrompt: prompt('hello'),
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [],
        pendingInitialPrompt: null,
        visibleSessionDetailAvailable: false,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['pending:hello']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: null,
        isLiveSession: true,
        streamHasSnapshot: false,
        visibleStreamBlocks: [block('stream')],
        baseMessages: [block('base')],
        pendingInitialPrompt: prompt('queued'),
        visibleSessionDetailAvailable: false,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['base', 'stream', 'pending:queued']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: null,
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [block('base')],
        pendingInitialPrompt: null,
        visibleSessionDetailAvailable: true,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['base']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: null,
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [],
        pendingInitialPrompt: prompt('queued'),
        visibleSessionDetailAvailable: false,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['pending:queued']);
  });

  it('prunes old messages above the render window', () => {
    const messages = [block('1'), block('2'), block('3'), block('4')];
    expect(
      pruneComputedMessages({
        messages,
        historicalBlockOffset: 10,
        historicalTotalBlocks: 4,
        historicalTailBlocks: 2,
        maxRenderedBlocks: 3,
      }),
    ).toEqual({ computedMessages: messages.slice(1), computedHistoricalBlockOffset: 11, computedHistoricalTotalBlocks: 4 });
  });

  it('counts visible agent turns from assistant text and summary blocks', () => {
    expect(
      countVisibleAgentTurns([
        { type: 'user', ts: '2026-05-29T00:00:00.000Z', text: 'Request' },
        { type: 'thinking', ts: '2026-05-29T00:00:01.000Z', text: 'Working' },
        { type: 'tool_use', ts: '2026-05-29T00:00:02.000Z', tool: 'bash', input: {}, output: 'ok' },
        { type: 'text', ts: '2026-05-29T00:00:03.000Z', text: 'Reply' },
        {
          type: 'summary',
          ts: '2026-05-29T00:00:04.000Z',
          kind: 'compaction',
          title: 'Summary',
          text: 'Older reply summary',
        },
      ]),
    ).toBe(2);
  });

  it('gates the earlier transcript boundary by visible agent turns', () => {
    expect(
      shouldShowEarlierTranscriptBoundary({
        hasOlderBlocks: true,
        visibleMessages: [
          { type: 'user', ts: '2026-05-29T00:00:00.000Z', text: 'Small conversation' },
          { type: 'thinking', ts: '2026-05-29T00:00:01.000Z', text: 'Lots of internal work' },
          { type: 'tool_use', ts: '2026-05-29T00:00:02.000Z', tool: 'bash', input: {}, output: 'ok' },
          { type: 'text', ts: '2026-05-29T00:00:03.000Z', text: 'Only one agent reply' },
        ],
      }),
    ).toBe(false);

    expect(
      shouldShowEarlierTranscriptBoundary({
        hasOlderBlocks: true,
        visibleMessages: [
          { type: 'text', ts: '2026-05-29T00:00:00.000Z', text: 'Reply 1' },
          { type: 'text', ts: '2026-05-29T00:00:01.000Z', text: 'Reply 2' },
          { type: 'text', ts: '2026-05-29T00:00:02.000Z', text: 'Reply 3' },
        ],
      }),
    ).toBe(true);
  });

  it('reports tail-anchored transcript windows as ending at the latest content', () => {
    expect(
      resolveTranscriptWindowPercent({
        blockOffset: 75,
        visibleBlockCount: 25,
        totalBlocks: 100,
        anchoredToTail: true,
      }),
    ).toEqual({ startPercent: 75, endPercent: 100 });

    expect(
      resolveTranscriptWindowPercent({
        blockOffset: 54,
        visibleBlockCount: 4,
        totalBlocks: 60,
        anchoredToTail: false,
      }),
    ).toEqual({ startPercent: 90, endPercent: 97 });

    expect(
      resolveTranscriptWindowPercent({
        blockOffset: 54,
        visibleBlockCount: 4,
        totalBlocks: 60,
        anchoredToTail: true,
      }),
    ).toEqual({ startPercent: 90, endPercent: 100 });
  });

  it('does not round a hidden earlier transcript window to 100-100%', () => {
    expect(
      resolveTranscriptWindowPercent({
        blockOffset: 999,
        visibleBlockCount: 1,
        totalBlocks: 1000,
        anchoredToTail: true,
      }),
    ).toEqual({ startPercent: 99, endPercent: 100 });
  });
});
