import { describe, expect, it } from 'vitest';

import {
  CONVERSATION_TRANSCRIPT_JUMP_PADDING_BLOCKS,
  CONVERSATION_TRANSCRIPT_TAIL_BLOCKS_STEP,
  resolveNextConversationTranscriptTailBlocks,
  shouldResetConversationTranscriptTailBlocksForLiveTransition,
} from './conversationTranscriptPaging';

describe('resolveNextConversationTranscriptTailBlocks', () => {
  it('uses the requested page size for normal older-transcript paging', () => {
    expect(
      resolveNextConversationTranscriptTailBlocks({
        currentTailBlocks: 24,
        requestedTailBlockStep: 500,
        totalBlocks: 5000,
      }),
    ).toBe(524);
  });

  it('keeps the fixed default step when no larger page size is requested', () => {
    expect(
      resolveNextConversationTranscriptTailBlocks({
        currentTailBlocks: 24,
        requestedTailBlockStep: CONVERSATION_TRANSCRIPT_TAIL_BLOCKS_STEP,
        totalBlocks: 5000,
      }),
    ).toBe(144);
  });

  it('loads enough history to include a requested target message plus padding', () => {
    expect(
      resolveNextConversationTranscriptTailBlocks({
        currentTailBlocks: 24,
        requestedTailBlockStep: CONVERSATION_TRANSCRIPT_TAIL_BLOCKS_STEP,
        targetMessageIndex: 120,
        totalBlocks: 500,
      }),
    ).toBe(500 - 120 + CONVERSATION_TRANSCRIPT_JUMP_PADDING_BLOCKS);
  });

  it('clamps to the total transcript size', () => {
    expect(
      resolveNextConversationTranscriptTailBlocks({
        currentTailBlocks: 900,
        requestedTailBlockStep: 500,
        totalBlocks: 1000,
      }),
    ).toBe(1000);
  });
});

describe('shouldResetConversationTranscriptTailBlocksForLiveTransition', () => {
  it('resets an expanded historical window when the same conversation becomes live', () => {
    expect(
      shouldResetConversationTranscriptTailBlocksForLiveTransition({
        conversationId: 'conv',
        currentTailBlocks: 524,
        isLive: true,
        previousConversationId: 'conv',
        previousIsLive: false,
      }),
    ).toBe(true);
  });

  it('does not reset on route changes because route changes already reset the window', () => {
    expect(
      shouldResetConversationTranscriptTailBlocksForLiveTransition({
        conversationId: 'next',
        currentTailBlocks: 524,
        isLive: true,
        previousConversationId: 'previous',
        previousIsLive: false,
      }),
    ).toBe(false);
  });

  it('does not reset an already-small transcript window', () => {
    expect(
      shouldResetConversationTranscriptTailBlocksForLiveTransition({
        conversationId: 'conv',
        currentTailBlocks: 24,
        isLive: true,
        previousConversationId: 'conv',
        previousIsLive: false,
      }),
    ).toBe(false);
  });
});
