const pendingSessionReadyByConversationId = new Map<string, Promise<void>>();

export function registerPendingSideChatSession(conversationId: string, readyPromise: Promise<unknown>): void {
  const trackedPromise = readyPromise
    .then(() => undefined)
    .finally(() => {
      if (pendingSessionReadyByConversationId.get(conversationId) === trackedPromise) {
        pendingSessionReadyByConversationId.delete(conversationId);
      }
    });
  pendingSessionReadyByConversationId.set(conversationId, trackedPromise);
}

export async function awaitPendingSideChatSession(conversationId: string): Promise<void> {
  await pendingSessionReadyByConversationId.get(conversationId);
}

export function clearPendingSideChatSessionsForTest(): void {
  pendingSessionReadyByConversationId.clear();
}
