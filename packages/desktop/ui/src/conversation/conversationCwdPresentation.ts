import { truncateConversationCwdFromFront } from './conversationCwdHistory';

export function isNeutralChatCwdPath(currentCwd: string | null | undefined): boolean {
  const normalized = currentCwd?.replace(/\\/g, '/').replace(/\/+$/, '') ?? '';
  return normalized.endsWith('/chat-workspaces') || normalized.includes('/chat-workspaces/');
}

export function formatConversationCwdLabel(currentCwd: string | null | undefined): string {
  if (isNeutralChatCwdPath(currentCwd)) {
    return 'Chat';
  }

  return currentCwd ? truncateConversationCwdFromFront(currentCwd) : '';
}

export function hasDraftConversationCwd(draftCwdValue: string): boolean {
  return draftCwdValue.length > 0;
}
