import { readIndexedConversationSearchText } from './conversationSearchIndex.js';
import { listConversationSessionsSnapshot, readConversationSessionMeta } from './conversationService.js';

export function readConversationSessionsCapability(input: { limit?: number; profile?: string } = {}) {
  return listConversationSessionsSnapshot(input);
}

export function readConversationSessionMetaCapability(sessionId: string) {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    return null;
  }

  return readConversationSessionMeta(normalizedSessionId);
}

export function readConversationSessionSearchIndexCapability(input: { sessionIds?: unknown } = {}) {
  const rawSessionIds = Array.isArray(input.sessionIds) ? input.sessionIds : [];
  const sessionIds = rawSessionIds
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (sessionIds.length === 0) {
    return { index: {} as Record<string, string> };
  }

  return { index: readIndexedConversationSearchText(sessionIds) };
}
