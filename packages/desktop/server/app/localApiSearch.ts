import type { DesktopLocalApiDispatchResult } from './localApi.js';

export interface SearchableConversationSession {
  id: string;
  file: string;
  title: string;
  cwd?: string;
  timestamp: string;
  lastActivityAt?: string;
  isLive?: boolean;
  isRunning?: boolean;
}

export function normalizeFastConversationSearchTerms(query: unknown): string[] | null {
  if (typeof query !== 'string' || query.trim().length === 0) {
    return null;
  }
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function normalizeFastConversationSearchLimit(limit: unknown): number {
  return Math.min(100, Math.max(1, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 80));
}

export function buildFastConversationContentSearchResponse(input: {
  body?: unknown;
  sessions: SearchableConversationSession[];
  readSearchText: (session: SearchableConversationSession) => string | null;
}): DesktopLocalApiDispatchResult | null {
  const body = input.body && typeof input.body === 'object' ? (input.body as { query?: unknown; limit?: unknown }) : {};
  const terms = normalizeFastConversationSearchTerms(body.query);
  if (!terms) return null;

  const limit = normalizeFastConversationSearchLimit(body.limit);
  const matches = [];
  for (const session of input.sessions) {
    if (matches.length >= limit) break;
    const text = input.readSearchText(session);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (!terms.every((term) => lower.includes(term))) continue;
    const normalized = text.replace(/\s+/g, ' ').trim();
    matches.push({
      conversationId: session.id,
      title: session.title,
      cwd: session.cwd,
      lastActivityAt: session.lastActivityAt ?? session.timestamp,
      isLive: session.isLive === true,
      isRunning: session.isRunning === true,
      blockId: 'search-index',
      blockType: 'text',
      blockIndex: 0,
      snippet: normalized.slice(0, 220),
    });
  }

  const payload = JSON.stringify({
    query: terms.join(' '),
    mode: 'allTerms',
    scope: 'all',
    totalMatching: matches.length,
    returnedCount: matches.length,
    matches,
  });
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(payload),
  };
}
