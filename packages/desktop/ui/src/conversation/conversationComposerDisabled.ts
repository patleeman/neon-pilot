export function isConversationComposerDisabled(input: {
  conversationNeedsTakeover: boolean;
  preparingRelatedThreadContext: boolean;
  wholeLineBashRunning: boolean;
  hasAvailableModel?: boolean;
}): boolean {
  return input.conversationNeedsTakeover || input.preparingRelatedThreadContext || input.hasAvailableModel === false;
}

export function shouldClearDraftPendingPrompt(draft: boolean): boolean {
  return !draft;
}

export function shouldClearPendingAssistantStatus(isStreaming: boolean): boolean {
  return isStreaming;
}
