import { truncateConversationCwdFromFront } from './conversationCwdHistory';

export function formatWorkspacePathName(workspacePath: string | null | undefined): string {
  const normalizedPath = workspacePath?.replace(/\/+$/, '') ?? '';
  if (!normalizedPath) return '';
  const segments = normalizedPath.split('/').filter(Boolean);
  return segments.at(-1) ?? normalizedPath;
}

export function formatWorkspacePathParentName(workspacePath: string | null | undefined): string {
  const normalizedPath = workspacePath?.replace(/\/+$/, '') ?? '';
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length <= 1) return '';
  return segments.at(-2) ?? '';
}

export function isNeutralChatCwdPath(currentCwd: string | null | undefined): boolean {
  const normalized = currentCwd?.replace(/\\/g, '/').replace(/\/+$/, '') ?? '';
  return normalized.endsWith('/chat-workspaces') || normalized.includes('/chat-workspaces/');
}

export function formatConversationCwdLabel(currentCwd: string | null | undefined): string {
  return currentCwd ? formatWorkspacePathName(currentCwd) || truncateConversationCwdFromFront(currentCwd) : '';
}

export function hasDraftConversationCwd(draftCwdValue: string): boolean {
  return draftCwdValue.length > 0;
}
