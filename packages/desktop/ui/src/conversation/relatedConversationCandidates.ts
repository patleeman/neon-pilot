import type { SessionMeta } from '../shared/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_WINDOW_DAYS = 7;
const MAX_RECENT_WINDOW_DAYS = 365;
const DEFAULT_CANDIDATE_LIMIT = 48;
const MAX_RELATED_CONVERSATION_LIMIT = 100;

function normalizePath(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/[\\/]+$/, '') : '';
}

function normalizePositiveIntegerLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(MAX_RELATED_CONVERSATION_LIMIT, value) : fallback;
}

function normalizeRecentWindowDays(value: number | null | undefined): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(MAX_RECENT_WINDOW_DAYS, value)
    : DEFAULT_RECENT_WINDOW_DAYS;
}

function normalizeNowMs(value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : Date.now();
}

function parseConversationTimestamp(value: string | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return Number.NaN;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
}

function isClosedConversation(session: SessionMeta): boolean {
  return session.isLive !== true && session.isRunning !== true;
}

function compareRecentConversationCandidates(left: SessionMeta, right: SessionMeta, workspaceCwd: string): number {
  const leftWorkspace = workspaceCwd.length > 0 && normalizePath(left.cwd) === workspaceCwd;
  const rightWorkspace = workspaceCwd.length > 0 && normalizePath(right.cwd) === workspaceCwd;
  if (leftWorkspace !== rightWorkspace) {
    return leftWorkspace ? -1 : 1;
  }

  const leftTimestamp = parseConversationTimestamp(left.lastActivityAt ?? left.timestamp);
  const rightTimestamp = parseConversationTimestamp(right.lastActivityAt ?? right.timestamp);
  if (Number.isFinite(leftTimestamp) || Number.isFinite(rightTimestamp)) {
    if (!Number.isFinite(leftTimestamp)) {
      return 1;
    }
    if (!Number.isFinite(rightTimestamp)) {
      return -1;
    }
    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }
  }

  return left.title.localeCompare(right.title);
}

function selectRecentConversationCandidates(
  sessions: SessionMeta[] | null | undefined,
  options: {
    workspaceCwd?: string | null;
    nowMs?: number;
    recentWindowDays?: number | null;
    limit?: number;
    closedOnly?: boolean;
  } = {},
): SessionMeta[] {
  const nowMs = normalizeNowMs(options.nowMs);
  const recentWindowDays = normalizeRecentWindowDays(options.recentWindowDays);
  const recentWindowMs = recentWindowDays === null ? null : recentWindowDays * DAY_MS;
  const workspaceCwd = normalizePath(options.workspaceCwd);

  return [...(sessions ?? [])]
    .filter((session) => session.messageCount > 0)
    .filter((session) => !options.closedOnly || isClosedConversation(session))
    .filter((session) => workspaceCwd.length === 0 || normalizePath(session.cwd) === workspaceCwd)
    .filter((session) => {
      if (recentWindowMs === null) {
        return true;
      }

      const timestamp = parseConversationTimestamp(session.lastActivityAt ?? session.timestamp);
      return Number.isFinite(timestamp) && nowMs - timestamp <= recentWindowMs;
    })
    .sort((left, right) => compareRecentConversationCandidates(left, right, workspaceCwd))
    .slice(0, normalizePositiveIntegerLimit(options.limit, DEFAULT_CANDIDATE_LIMIT));
}

export function selectDraftRelatedThreadCandidates(input: {
  draft: boolean;
  sessions: SessionMeta[] | undefined;
  workspaceCwd: string | null;
  recentWindowDays: number;
  limit: number;
}): SessionMeta[] {
  return input.draft
    ? selectRecentConversationCandidates(input.sessions, {
        workspaceCwd: input.workspaceCwd,
        recentWindowDays: input.recentWindowDays,
        limit: input.limit,
        closedOnly: true,
      })
    : [];
}
