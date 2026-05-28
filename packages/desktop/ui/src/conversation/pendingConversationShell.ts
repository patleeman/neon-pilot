export const PENDING_CONVERSATION_SHELL_PREFIX = 'pending-';

export function isPendingConversationShellId(conversationId: string | null | undefined): boolean {
  return typeof conversationId === 'string' && conversationId.startsWith(PENDING_CONVERSATION_SHELL_PREFIX);
}
