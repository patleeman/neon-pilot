export function assertConversationBootstrapFound(isMissing: boolean): void {
  if (isMissing) {
    throw new Error('Conversation not found');
  }
}
