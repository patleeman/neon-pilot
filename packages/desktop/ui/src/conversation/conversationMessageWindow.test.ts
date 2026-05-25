import { describe, expect, it } from 'vitest';

import { pruneComputedMessages, resolveComputedMessagesRaw, resolveTranscriptWindowPercent } from './conversationMessageWindow';

const block = (id: string) => ({ id, type: 'text', text: id }) as never;
const append = (messages: never[] | undefined, prompt: string | undefined) =>
  prompt ? [...(messages ?? []), block(`pending:${prompt}`)] : messages;
const merge = (baseMessages: never[], visibleStreamBlocks: never[]) => [...baseMessages, ...visibleStreamBlocks];

describe('conversationMessageWindow', () => {
  it('resolves draft, live, and static message sources', () => {
    expect(
      resolveComputedMessagesRaw({
        draft: true,
        draftPendingPrompt: 'hello',
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [],
        pendingInitialPrompt: undefined,
        visibleSessionDetailAvailable: false,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['pending:hello']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: '',
        isLiveSession: true,
        streamHasSnapshot: false,
        visibleStreamBlocks: [block('stream')],
        baseMessages: [block('base')],
        pendingInitialPrompt: 'queued',
        visibleSessionDetailAvailable: false,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['base', 'stream', 'pending:queued']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: '',
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [block('base')],
        pendingInitialPrompt: undefined,
        visibleSessionDetailAvailable: true,
        mergeHistoricalAndStreamBlocks: merge,
        appendPendingInitialPromptBlock: append,
      })?.map((message) => message.id),
    ).toEqual(['base']);

    expect(
      resolveComputedMessagesRaw({
        draft: false,
        draftPendingPrompt: '',
        isLiveSession: false,
        streamHasSnapshot: false,
        visibleStreamBlocks: [],
        baseMessages: [],
        pendingInitialPrompt: 'queued',
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
