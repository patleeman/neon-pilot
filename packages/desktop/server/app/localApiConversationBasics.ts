export function readRequiredConversationId(value: string): string {
  const conversationId = value.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }
  return conversationId;
}

export function readRequiredConversationName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new Error('name required');
  }
  return name;
}
