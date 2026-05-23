export function normalizeRequiredLiveConversationId(conversationId: string, errorMessage: string): string {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    throw new Error(errorMessage);
  }
  return normalizedConversationId;
}

export function assertLiveConversationExists(input: { conversationId: string; isLive: boolean }, errorMessage: string): void {
  if (!input.conversationId || !input.isLive) {
    throw new Error(errorMessage);
  }
}

export function buildDesktopLiveSessionResponse<TEntry extends object>(entry: TEntry): { live: true } & TEntry {
  return { live: true, ...entry };
}
