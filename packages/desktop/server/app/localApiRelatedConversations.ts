interface SessionMetaLike {
  id: string;
  title: string;
  cwd: string;
  timestamp: string;
  lastActivityAt?: string;
  messageCount?: number;
  isLive?: boolean;
  isRunning?: boolean;
}

interface ConversationSummaryLike {
  displaySummary?: string;
  outcome?: string;
  promptSummary?: string;
  searchText?: string;
  keyTerms?: string[];
  filesTouched?: string[];
  status?: string;
}

export interface RelatedConversationSearchResult {
  sessionId: string;
  title: string;
  cwd: string;
  timestamp: string;
  snippet: string;
  matchedTerms: string[];
  score: number;
  sameWorkspace: boolean;
  summary?: ConversationSummaryLike;
  reason?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RELATED_CONVERSATION_LIMIT = 100;
const QUERY_STOPWORDS = new Set([
  'a',
  'about',
  'actually',
  'agent',
  'agents',
  'an',
  'and',
  'app',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'conversation',
  'conversations',
  'does',
  'doing',
  'done',
  'for',
  'from',
  'good',
  'help',
  'how',
  'in',
  'is',
  'it',
  'junk',
  'like',
  'look',
  'looks',
  'new',
  'now',
  'of',
  'okay',
  'on',
  'or',
  'our',
  'please',
  'pro',
  'really',
  'screen',
  'stuff',
  'that',
  'the',
  'thing',
  'things',
  'thread',
  'threads',
  'to',
  'today',
  'used',
  'user',
  'want',
  'wants',
  'what',
  'when',
  'where',
  'why',
  'with',
  'work',
  'working',
  'would',
  'yeah',
]);

function normalizeQueryTokens(query: string): string[] {
  const cleanedTokens = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  return [...new Set(cleanedTokens.filter((token) => token.length > 1 && !QUERY_STOPWORDS.has(token)))].slice(0, 8);
}

function normalizePath(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/[\\/]+$/, '') : '';
}

function normalizeField(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeLimit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(MAX_RELATED_CONVERSATION_LIMIT, value) : fallback;
}

function parseConversationTimestamp(value: string | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
}

function normalizeFuzzyText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fuzzyScore(query: string, candidate: string): number | null {
  const normalizedQuery = normalizeFuzzyText(query);
  const normalizedCandidate = normalizeFuzzyText(candidate);
  if (normalizedQuery.length === 0) return 0;

  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -2;

  for (let candidateIndex = 0; candidateIndex < normalizedCandidate.length; candidateIndex += 1) {
    if (normalizedCandidate[candidateIndex] !== normalizedQuery[queryIndex]) continue;
    if (firstMatchIndex === -1) firstMatchIndex = candidateIndex;
    consecutiveBonus = candidateIndex === lastMatchIndex + 1 ? consecutiveBonus + 3 : 0;
    score += 10 + consecutiveBonus;
    lastMatchIndex = candidateIndex;
    queryIndex += 1;
    if (queryIndex === normalizedQuery.length) break;
  }

  if (queryIndex !== normalizedQuery.length) return null;
  if (firstMatchIndex === 0) score += 12;
  score += Math.max(0, 18 - (normalizedCandidate.length - normalizedQuery.length));
  return score;
}

function scoreField(token: string, value: string | undefined, weight: number): number | null {
  const normalizedValue = normalizeField(value);
  if (!normalizedValue) return null;
  const lowerValue = normalizedValue.toLowerCase();
  const containsIndex = lowerValue.indexOf(token);
  if (containsIndex !== -1)
    return weight + Math.max(0, 36 - containsIndex) + Math.max(0, 18 - Math.max(0, lowerValue.length - token.length));
  const fuzzy = fuzzyScore(token, normalizedValue);
  return fuzzy === null ? null : Math.floor(weight / 3) + fuzzy;
}

function scoreRecency(timestamp: string, nowMs: number): number {
  const parsed = parseConversationTimestamp(timestamp);
  if (!Number.isFinite(parsed)) return 0;
  const ageDays = Math.max(0, (nowMs - parsed) / DAY_MS);
  return Math.max(0, Math.round(42 - ageDays * 5));
}

function buildReason(input: { sameWorkspace: boolean; matchedTerms: string[]; summary?: ConversationSummaryLike }): string {
  const reasons: string[] = [];
  if (input.sameWorkspace) reasons.push('Same workspace');
  if (input.matchedTerms.length > 0) reasons.push(`Matches ${input.matchedTerms.slice(0, 3).join(', ')}`);
  if (input.summary?.filesTouched?.length) reasons.push(`Touched ${input.summary.filesTouched.slice(0, 2).join(', ')}`);
  if (input.summary?.status && input.summary.status !== 'unknown') {
    reasons.push(input.summary.status === 'needs_user' ? 'Needs user' : input.summary.status.replace(/_/g, ' '));
  }
  return reasons.join(' · ');
}

function buildSummarySearchText(session: SessionMetaLike, searchText: string, summary?: ConversationSummaryLike): string {
  if (!summary) return searchText;
  return [
    summary.searchText,
    summary.displaySummary,
    summary.outcome,
    summary.promptSummary,
    summary.keyTerms?.join(' '),
    summary.filesTouched?.join(' '),
    searchText,
    session.title,
  ]
    .filter(Boolean)
    .join('\n');
}

function scorePhrase(query: string, value: string | undefined, weight: number): number {
  const normalizedValue = normalizeField(value);
  const normalizedQuery = normalizeField(query).toLowerCase();
  if (!normalizedValue || !normalizedQuery) return 0;
  const index = normalizedValue.toLowerCase().indexOf(normalizedQuery);
  return index === -1 ? 0 : weight + Math.max(0, 28 - index);
}

function minimumMatchedTokenCount(tokenCount: number): number {
  return tokenCount >= 4 ? 2 : 1;
}

function buildSnippet(searchText: string | undefined, title: string, query: string, maxLength = 140): string {
  const normalizedText = normalizeField(searchText);
  if (!normalizedText) return normalizeField(title);
  const tokens = normalizeQueryTokens(query);
  const lowerText = normalizedText.toLowerCase();
  const matchIndex = tokens.reduce((best, token) => {
    const index = lowerText.indexOf(token);
    return index === -1 ? best : best === -1 || index < best ? index : best;
  }, -1);
  const start = matchIndex === -1 ? 0 : Math.max(0, matchIndex - Math.floor(maxLength / 3));
  if (normalizedText.length <= maxLength) return normalizedText;
  const safeStart = Math.max(0, Math.min(start, Math.max(0, normalizedText.length - maxLength)));
  const safeEnd = Math.min(normalizedText.length, safeStart + maxLength);
  return `${safeStart > 0 ? '…' : ''}${normalizedText.slice(safeStart, safeEnd).trim()}${safeEnd < normalizedText.length ? '…' : ''}`;
}

function listRecentConversationResults(input: {
  sessions: SessionMetaLike[];
  summaries: Record<string, ConversationSummaryLike>;
  workspaceCwd?: string | null;
  limit: number;
}): RelatedConversationSearchResult[] {
  const workspaceCwd = normalizePath(input.workspaceCwd);
  return input.sessions.slice(0, input.limit).map((session, index) => {
    const summary = input.summaries[session.id];
    const sameWorkspace = workspaceCwd.length > 0 && normalizePath(session.cwd) === workspaceCwd;
    const reason = buildReason({ sameWorkspace, matchedTerms: [], summary });
    return {
      sessionId: session.id,
      title: session.title,
      cwd: session.cwd,
      timestamp: session.lastActivityAt ?? session.timestamp,
      snippet: summary?.displaySummary ?? '',
      matchedTerms: [],
      score: input.limit - index + (summary ? 20 : 0),
      sameWorkspace,
      ...(summary ? { summary } : {}),
      ...(reason ? { reason } : {}),
    };
  });
}

function rankRelatedConversationSessions(input: {
  sessions: SessionMetaLike[];
  searchIndex: Record<string, string>;
  summaries: Record<string, ConversationSummaryLike>;
  query: string;
  workspaceCwd?: string | null;
  limit: number;
  nowMs: number;
}): RelatedConversationSearchResult[] {
  const tokens = normalizeQueryTokens(input.query);
  if (tokens.length === 0) return [];
  const workspaceCwd = normalizePath(input.workspaceCwd);

  return input.sessions
    .map((session) => {
      const summary = input.summaries[session.id];
      const searchText = buildSummarySearchText(session, input.searchIndex[session.id] ?? '', summary);
      const fields = [session.title, session.cwd, searchText];
      let totalScore = scorePhrase(input.query, fields[0], 150) + scorePhrase(input.query, fields[2], 120);
      const matchedTerms: string[] = [];

      for (const token of tokens) {
        const scores = [scoreField(token, fields[0], 132), scoreField(token, fields[1], 82), scoreField(token, fields[2], 96)].filter(
          (score): score is number => score !== null,
        );
        if (scores.length === 0) continue;
        totalScore += Math.max(...scores);
        matchedTerms.push(token);
      }
      if (matchedTerms.length < minimumMatchedTokenCount(tokens.length)) return null;

      const timestamp = session.lastActivityAt ?? session.timestamp;
      const sameWorkspace = workspaceCwd.length > 0 && normalizePath(session.cwd) === workspaceCwd;
      totalScore += matchedTerms.length * 24 + (sameWorkspace ? 90 : 0) + (summary ? 45 : 0) + scoreRecency(timestamp, input.nowMs);
      if (summary?.status === 'blocked' || summary?.status === 'needs_user' || summary?.status === 'in_progress') totalScore += 20;
      const reason = buildReason({ sameWorkspace, matchedTerms, summary });

      return {
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
        timestamp,
        snippet: buildSnippet(searchText, session.title, input.query),
        matchedTerms,
        score: totalScore,
        sameWorkspace,
        ...(summary ? { summary } : {}),
        ...(reason ? { reason } : {}),
      } satisfies RelatedConversationSearchResult;
    })
    .filter((result): result is RelatedConversationSearchResult => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.sameWorkspace) - Number(left.sameWorkspace) ||
        right.timestamp.localeCompare(left.timestamp) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, input.limit);
}

function selectVisibleRelatedThreadResults(input: {
  selectedRelatedThreadIds: string[];
  query: string;
  searchResults: RelatedConversationSearchResult[];
  recentResults: RelatedConversationSearchResult[];
  candidateById: Map<string, SessionMetaLike>;
  searchIndex: Record<string, string>;
  summaries: Record<string, ConversationSummaryLike>;
  workspaceCwd?: string | null;
  limit: number;
}): RelatedConversationSearchResult[] {
  const baseResults = input.query.trim().length > 0 ? input.searchResults : input.recentResults;
  const results: RelatedConversationSearchResult[] = [];
  const seen = new Set<string>();
  for (const sessionId of input.selectedRelatedThreadIds) {
    if (seen.has(sessionId)) continue;
    const existing = baseResults.find((result) => result.sessionId === sessionId);
    if (existing) {
      results.push(existing);
      seen.add(sessionId);
      continue;
    }
    const session = input.candidateById.get(sessionId);
    if (!session) continue;
    const summary = input.summaries[sessionId];
    const normalizedSnippet = (input.searchIndex[sessionId] ?? '').replace(/\s+/g, ' ').trim();
    const snippet = normalizedSnippet.length > 140 ? `${normalizedSnippet.slice(0, 139).trimEnd()}…` : normalizedSnippet;
    const sameWorkspace = Boolean(input.workspaceCwd && normalizePath(session.cwd) === normalizePath(input.workspaceCwd));
    results.push({
      sessionId,
      title: session.title,
      cwd: session.cwd,
      timestamp: session.lastActivityAt ?? session.timestamp,
      snippet: summary?.displaySummary ?? snippet,
      matchedTerms: [],
      score: Number.MAX_SAFE_INTEGER - results.length,
      sameWorkspace,
      ...(summary ? { summary, reason: sameWorkspace ? 'Same workspace' : undefined } : {}),
    });
    seen.add(sessionId);
  }

  for (const result of baseResults) {
    if (seen.has(result.sessionId)) continue;
    results.push(result);
    seen.add(result.sessionId);
    if (results.length >= input.limit) break;
  }
  return results.slice(0, input.limit);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function buildRelatedConversationResults(input: unknown): {
  searchResults: RelatedConversationSearchResult[];
  recentResults: RelatedConversationSearchResult[];
  visibleResults: RelatedConversationSearchResult[];
} {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const sessions = Array.isArray(body.sessions) ? (body.sessions as SessionMetaLike[]) : [];
  const searchIndex = body.searchIndex && typeof body.searchIndex === 'object' ? (body.searchIndex as Record<string, string>) : {};
  const summaries = body.summaries && typeof body.summaries === 'object' ? (body.summaries as Record<string, ConversationSummaryLike>) : {};
  const query = typeof body.query === 'string' ? body.query : '';
  const workspaceCwd = typeof body.workspaceCwd === 'string' ? body.workspaceCwd : null;
  const limit = normalizeLimit(body.limit, 9);
  const selectedRelatedThreadIds = readStringArray(body.selectedRelatedThreadIds);
  const nowMs = typeof body.nowMs === 'number' && Number.isSafeInteger(body.nowMs) && body.nowMs >= 0 ? body.nowMs : Date.now();
  const searchResults = rankRelatedConversationSessions({ sessions, searchIndex, summaries, query, workspaceCwd, limit, nowMs });
  const recentResults = listRecentConversationResults({ sessions, summaries, workspaceCwd, limit });
  const visibleResults = selectVisibleRelatedThreadResults({
    selectedRelatedThreadIds,
    query,
    searchResults,
    recentResults,
    candidateById: new Map(sessions.map((session) => [session.id, session])),
    searchIndex,
    summaries,
    workspaceCwd,
    limit,
  });
  return { searchResults, recentResults, visibleResults };
}
