import type { MessageBlock } from '../shared/types';

export function resolveComputedMessagesRaw(input: {
  draft: boolean;
  draftPendingPrompt: string;
  isLiveSession: boolean;
  streamHasSnapshot: boolean;
  visibleStreamBlocks: MessageBlock[];
  baseMessages: MessageBlock[];
  pendingInitialPrompt: string | undefined;
  visibleSessionDetailAvailable: boolean;
  mergeHistoricalAndStreamBlocks: (baseMessages: MessageBlock[], visibleStreamBlocks: MessageBlock[]) => MessageBlock[];
  appendPendingInitialPromptBlock: (messages: MessageBlock[] | undefined, prompt: string | undefined) => MessageBlock[] | undefined;
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
