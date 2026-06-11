export function shouldLoadConversationRun(input: {
  conversationRunId: string | null;
  knownRunIds?: ReadonlySet<string> | null;
  draft: boolean;
  isLiveSession: boolean;
  stoppedMidTurn: boolean;
  stoppedWithError: boolean;
}): boolean {
  return (
    Boolean(input.conversationRunId) &&
    (input.knownRunIds ? input.knownRunIds.has(input.conversationRunId as string) : true) &&
    !input.draft &&
    !input.isLiveSession &&
    (input.stoppedMidTurn || input.stoppedWithError)
  );
}
