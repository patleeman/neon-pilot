export function findConversationSessionById<TSession extends { id: string }>(
  sessions: TSession[] | undefined,
  conversationId: string | undefined,
): TSession | null {
  return conversationId ? (sessions?.find((session) => session.id === conversationId) ?? null) : null;
}
