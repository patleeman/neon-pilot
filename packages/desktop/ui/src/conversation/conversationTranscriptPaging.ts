export const INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS = 120;
export const CONVERSATION_TRANSCRIPT_TAIL_BLOCKS_STEP = 120;
export const CONVERSATION_TRANSCRIPT_JUMP_PADDING_BLOCKS = 40;
export const MAX_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS = 600;

export function resolveNextConversationTranscriptTailBlocks({
  currentTailBlocks,
  requestedTailBlockStep,
  targetMessageIndex,
  totalBlocks,
}: {
  currentTailBlocks: number;
  requestedTailBlockStep: number;
  targetMessageIndex?: number;
  totalBlocks: number;
}): number {
  const normalizedCurrentTailBlocks = Math.max(0, Math.floor(currentTailBlocks));
  const normalizedTotalBlocks = Math.min(MAX_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS, Math.max(0, Math.floor(totalBlocks)));
  const tailBlockStep = Math.max(1, Math.ceil(requestedTailBlockStep));
  const minimumTailBlocks =
    typeof targetMessageIndex === 'number'
      ? Math.max(
          normalizedCurrentTailBlocks + tailBlockStep,
          normalizedTotalBlocks - targetMessageIndex + CONVERSATION_TRANSCRIPT_JUMP_PADDING_BLOCKS,
        )
      : normalizedCurrentTailBlocks + tailBlockStep;

  return Math.min(normalizedTotalBlocks, Math.max(normalizedCurrentTailBlocks, minimumTailBlocks));
}

export function shouldResetConversationTranscriptTailBlocksForLiveTransition({
  conversationId,
  currentTailBlocks,
  initialTailBlocks = INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS,
  isLive,
  previousConversationId,
  previousIsLive,
}: {
  conversationId: string | null | undefined;
  currentTailBlocks: number;
  initialTailBlocks?: number;
  isLive: boolean;
  previousConversationId: string | null | undefined;
  previousIsLive: boolean | null;
}): boolean {
  return Boolean(
    conversationId &&
    previousConversationId === conversationId &&
    previousIsLive === false &&
    isLive &&
    currentTailBlocks > initialTailBlocks,
  );
}

export function hasReachedConversationTranscriptTailLimit({
  hasOlderBlocks,
  loadedBlockCount,
  requestedTailBlocks,
}: {
  hasOlderBlocks: boolean;
  loadedBlockCount: number;
  requestedTailBlocks: number;
}): boolean {
  return (
    hasOlderBlocks &&
    requestedTailBlocks >= MAX_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS &&
    loadedBlockCount >= MAX_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS
  );
}
