export function formatRelatedThreadsSummaryText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }

  const firstConversationIndex = normalized.search(/^Conversation\s+\d+\s+—\s+/m);
  const displayText = firstConversationIndex >= 0 ? normalized.slice(firstConversationIndex).trim() : normalized;

  return displayText
    .replace(/^Conversation\s+(\d+)\s+—\s+(.+)$/gm, '### Conversation $1 — $2')
    .replace(/^Workspace:\s*(.+)$/gm, '- Workspace: `$1`')
    .replace(/^Created:\s*(.+)$/gm, '- Created: $1');
}

export function resolveRelatedThreadsSummaryDetail(text: string): string {
  const conversationCount = (text.match(/^#{0,3}\s*Conversation\s+\d+\s+—\s+/gm) ?? []).length;
  if (conversationCount <= 0) {
    return 'Selected conversations were summarized and injected before this prompt so this thread could start with reused context.';
  }

  return `${conversationCount} selected conversation${conversationCount === 1 ? '' : 's'} ${
    conversationCount === 1 ? 'was' : 'were'
  } summarized and injected before this prompt so this thread could start with reused context.`;
}

export function formatRelatedConversationPointersText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function resolveRelatedConversationPointersDetail(text: string): string {
  const pointerCount = (text.match(/^\d+\.\s+/gm) ?? []).length;
  if (pointerCount <= 0) {
    return 'Related conversation pointers were offered before this prompt. Inspect a conversation before relying on its details.';
  }

  return `${pointerCount} related conversation pointer${pointerCount === 1 ? '' : 's'} ${
    pointerCount === 1 ? 'was' : 'were'
  } offered before this prompt. Inspect a conversation before relying on its details.`;
}
