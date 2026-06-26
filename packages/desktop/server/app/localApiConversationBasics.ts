export function readRequiredConversationId(value: string): string {
  const conversationId = value.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }
  return conversationId;
}

export class DesktopConversationTitleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopConversationTitleValidationError';
  }
}

export function readRequiredConversationName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new DesktopConversationTitleValidationError('Conversation title is required.');
  }
  return name;
}
