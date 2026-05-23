export function assertConversationFound(found: boolean, message = 'Conversation not found'): void {
  if (!found) {
    throw new Error(message);
  }
}

export function assertSessionFound(found: boolean, message = 'Session not found'): void {
  if (!found) {
    throw new Error(message);
  }
}
