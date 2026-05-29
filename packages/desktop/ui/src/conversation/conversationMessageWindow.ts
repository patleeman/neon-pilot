import type { PendingConversationPrompt } from '../pending/pendingConversationPrompt';
import type { MessageBlock } from '../shared/types';

const MIN_VISIBLE_AGENT_TURNS_FOR_EARLIER_TRANSCRIPT_BOUNDARY = 3;

export function resolveComputedMessagesRaw(input: {
  draft: boolean;
  draftPendingPrompt: PendingConversationPrompt | null;
  isLiveSession: boolean;
  streamHasSnapshot: boolean;
  visibleStreamBlocks: MessageBlock[];
  baseMessages: MessageBlock[];
  pendingInitialPrompt: PendingConversationPrompt | null;
  visibleSessionDetailAvailable: boolean;
  mergeHistoricalAndStreamBlocks: (baseMessages: MessageBlock[], visibleStreamBlocks: MessageBlock[]) => MessageBlock[];
  appendPendingInitialPromptBlock: (
    messages: MessageBlock[] | undefined,
    prompt: PendingConversationPrompt | null,
  ) => MessageBlock[] | undefined;
}): MessageBlock[] | undefined {
  if (input.draft) {
    return input.appendPendingInitialPromptBlock(undefined, input.draftPendingPrompt);
  }

  if (input.isLiveSession) {
    const liveMessages = input.streamHasSnapshot
      ? input.visibleStreamBlocks
      : input.baseMessages.length > 0 || input.visibleStreamBlocks.length > 0
        ? input.mergeHistoricalAndStreamBlocks(input.baseMessages, input.visibleStreamBlocks)
        : undefined;
    return input.appendPendingInitialPromptBlock(liveMessages, input.pendingInitialPrompt);
  }

  if (input.pendingInitialPrompt) {
    return input.appendPendingInitialPromptBlock(
      input.visibleSessionDetailAvailable ? input.baseMessages : undefined,
      input.pendingInitialPrompt,
    );
  }

  return input.visibleSessionDetailAvailable ? input.baseMessages : undefined;
}

export function countVisibleAgentTurns(messages: MessageBlock[] | undefined): number {
  return (
    messages?.reduce((count, message) => {
      if (message.type !== 'text' && message.type !== 'summary') {
        return count;
      }

      return message.text.trim().length > 0 ? count + 1 : count;
    }, 0) ?? 0
  );
}

export function shouldShowEarlierTranscriptBoundary(input: {
  hasOlderBlocks: boolean;
  visibleMessages: MessageBlock[] | undefined;
  minVisibleAgentTurns?: number;
}): boolean {
  if (!input.hasOlderBlocks) {
    return false;
  }

  const minVisibleAgentTurns =
    typeof input.minVisibleAgentTurns === 'number' && Number.isSafeInteger(input.minVisibleAgentTurns) && input.minVisibleAgentTurns > 0
      ? input.minVisibleAgentTurns
      : MIN_VISIBLE_AGENT_TURNS_FOR_EARLIER_TRANSCRIPT_BOUNDARY;

  return countVisibleAgentTurns(input.visibleMessages) >= minVisibleAgentTurns;
}

export function pruneComputedMessages(input: {
  messages: MessageBlock[] | undefined;
  historicalBlockOffset: number;
  historicalTotalBlocks: number;
  historicalTailBlocks: number;
  maxRenderedBlocks: number;
}): {
  computedMessages: MessageBlock[] | undefined;
  computedHistoricalBlockOffset: number;
  computedHistoricalTotalBlocks: number;
} {
  const maxRenderedBlocks = Math.max(input.maxRenderedBlocks, Math.min(input.historicalTailBlocks, input.historicalTotalBlocks));
  if (!input.messages || input.messages.length <= maxRenderedBlocks) {
    return {
      computedMessages: input.messages,
      computedHistoricalBlockOffset: input.historicalBlockOffset,
      computedHistoricalTotalBlocks: input.historicalTotalBlocks,
    };
  }

  const excess = input.messages.length - maxRenderedBlocks;
  return {
    computedMessages: input.messages.slice(excess),
    computedHistoricalBlockOffset: input.historicalBlockOffset + excess,
    computedHistoricalTotalBlocks: input.historicalTotalBlocks,
  };
}

export function resolveTranscriptWindowPercent(input: {
  blockOffset: number;
  visibleBlockCount: number;
  totalBlocks: number;
  anchoredToTail: boolean;
}): {
  startPercent: number;
  endPercent: number;
} {
  if (input.totalBlocks <= 0) {
    return { startPercent: 0, endPercent: 100 };
  }

  const clampedOffset = Math.min(Math.max(0, input.blockOffset), input.totalBlocks);
  const clampedVisibleBlockCount = Math.max(0, input.visibleBlockCount);
  const roundedStartPercent = Math.min(100, Math.max(0, Math.ceil((clampedOffset / input.totalBlocks) * 100)));
  const startPercent = clampedOffset > 0 && clampedOffset < input.totalBlocks && roundedStartPercent === 100 ? 99 : roundedStartPercent;
  if (input.anchoredToTail) {
    return { startPercent, endPercent: 100 };
  }

  return {
    startPercent,
    endPercent: Math.min(100, Math.max(startPercent, Math.ceil(((clampedOffset + clampedVisibleBlockCount) / input.totalBlocks) * 100))),
  };
}
