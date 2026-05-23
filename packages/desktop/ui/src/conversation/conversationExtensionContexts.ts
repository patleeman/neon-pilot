export function buildComposerShelfContext(input: { conversationId: string | undefined; isStreaming: boolean; isLive: boolean }): {
  conversationId: string;
  isStreaming: boolean;
  isLive: boolean;
} {
  return {
    conversationId: input.conversationId ?? '',
    isStreaming: input.isStreaming,
    isLive: input.isLive,
  };
}

export function buildNewConversationPanelContext<TSuggestedContext>(input: {
  conversationId: string | undefined;
  suggestedContext: TSuggestedContext;
}): {
  conversationId: string;
  suggestedContext: TSuggestedContext;
} {
  return {
    conversationId: input.conversationId ?? '',
    suggestedContext: input.suggestedContext,
  };
}
