export function isConversationComposerDisabled(input: {
  conversationNeedsTakeover: boolean;
  preparingRelatedThreadContext: boolean;
  wholeLineBashRunning: boolean;
}): boolean {
  return input.conversationNeedsTakeover || input.preparingRelatedThreadContext || input.wholeLineBashRunning;
}

export function shouldClearDraftPendingPrompt(draft: boolean): boolean {
  return !draft;
}

export function shouldClearPendingAssistantStatus(isStreaming: boolean): boolean {
  return isStreaming;
}
