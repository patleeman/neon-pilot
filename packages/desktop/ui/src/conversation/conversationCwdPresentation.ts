import { truncateConversationCwdFromFront } from './conversationCwdHistory';

export function formatConversationCwdLabel(currentCwd: string | null | undefined): string {
  return currentCwd ? truncateConversationCwdFromFront(currentCwd) : '';
}

export function hasDraftConversationCwd(draftCwdValue: string): boolean {
  return draftCwdValue.length > 0;
}
