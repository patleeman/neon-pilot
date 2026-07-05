import type { Express, Response } from 'express';

import { listConversationSessionsSnapshot } from '../conversations/conversationService.js';
import type { ExecutionKind, ExecutionVisibility } from '../executions/executionService.js';
import { listExecutions } from '../executions/executionService.js';
import { logError } from '../middleware/index.js';

// Public types

export type GlobalActivityKind = 'conversation' | 'execution';
export type GlobalActivityStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export interface GlobalActivityItem {
  id: string;
  kind: GlobalActivityKind;
  title: string;
  subtitle?: string;
  status: GlobalActivityStatus;
  /** True while the row is queued or running. Drives active/done grouping in the UI. */
  active?: boolean;
  /** User-facing source label, e.g. "Background command", "Subagent", "Conversation". */
  source?: string;
  /** Typed execution kind for executions; undefined for conversation rows. */
  executionKind?: ExecutionKind;
  /** Execution visibility channel. */
  visibility?: ExecutionVisibility;
  /** Underlying shell command for background-command executions. */
  command?: string;
  /** Working directory the row is executing in, when known. */
  cwd?: string;
  conversationId?: string;
  conversationTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GlobalActivityResult {
  items: GlobalActivityItem[];
  total: number;
}

// Query helpers

function parsePositiveInteger(value: unknown, defaultVal: number, maxVal: number): number {
  if (typeof value !== 'string') return defaultVal;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return defaultVal;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return defaultVal;
  return Math.min(maxVal, parsed);
}

function parseKindQuery(value: unknown): GlobalActivityKind | 'all' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === 'conversation' || normalized === 'execution' || normalized === 'all' ? normalized : undefined;
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function normalizeExecutionStatus(status: string): GlobalActivityStatus {
  if (status === 'queued' || status === 'waiting') return 'queued';
  if (status === 'running' || status === 'recovering') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled' || status === 'interrupted') return 'cancelled';
  return 'unknown';
}

function isActiveStatus(status: GlobalActivityStatus): boolean {
  return status === 'running' || status === 'queued';
}

/** User-facing label for an execution's worker/app source. */
function executionSourceLabel(kind: ExecutionKind): string {
  switch (kind) {
    case 'background-command':
      return 'Background command';
    case 'subagent':
      return 'Subagent';
    case 'scheduled-task':
      return 'Scheduled task';
    case 'deferred-resume':
      return 'Deferred resume';
    case 'conversation':
      return 'Conversation run';
    case 'unknown':
      return 'Worker';
  }
}

function handleError(res: Response, err: unknown): void {
  logError('request handler error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: String(err) });
}

// Route registration

export function registerGlobalActivityRoutes(router: Pick<Express, 'get'>): void {
  router.get('/api/activity', async (req, res) => {
    try {
      const limit = parsePositiveInteger(req.query.limit, 50, 200);
      const kindFilter = parseKindQuery(req.query.kind);
      const activeFilter = parseBooleanQuery(req.query.active);

      // Collect conversation (session) metadata and build a map for title lookup.
      const sessions = listConversationSessionsSnapshot({ limit: 200 });
      const sessionTitleById = new Map(sessions.map((s) => [s.id, s.title]));

      // Build conversation activity items
      const conversationItems: GlobalActivityItem[] = sessions.map((s) => {
        const status: GlobalActivityStatus = s.isLive || s.isRunning ? 'running' : 'completed';
        return {
          id: `conversation:${s.id}`,
          kind: 'conversation' as const,
          title: s.title,
          subtitle: s.cwdSlug ? `in ${s.cwdSlug}` : undefined,
          status,
          active: isActiveStatus(status),
          source: 'Conversation',
          conversationId: s.id,
          conversationTitle: s.title,
          createdAt: s.timestamp,
          updatedAt: s.lastActivityAt ?? s.timestamp,
        };
      });

      // Collect executions across all conversations
      const { executions } = await listExecutions();

      // Build execution activity items, enriched with worker/app-centric fields.
      const executionItems: GlobalActivityItem[] = executions.map((e) => {
        const status = normalizeExecutionStatus(e.status);
        const subtitle = e.subtitle ?? e.command;
        return {
          id: `execution:${e.id}`,
          kind: 'execution' as const,
          title: e.title,
          subtitle,
          status,
          active: isActiveStatus(status),
          source: executionSourceLabel(e.kind),
          executionKind: e.kind,
          visibility: e.visibility,
          command: e.command,
          cwd: e.cwd,
          conversationId: e.conversationId,
          conversationTitle: e.conversationId ? sessionTitleById.get(e.conversationId) : undefined,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt ?? e.completedAt ?? e.startedAt ?? e.createdAt,
        };
      });

      // Merge
      const rawItems: GlobalActivityItem[] = [...conversationItems, ...executionItems];

      // Apply optional kind filter
      let filtered = rawItems;
      if (kindFilter && kindFilter !== 'all') {
        filtered = filtered.filter((item) => item.kind === kindFilter);
      }

      // Apply optional active filter
      if (activeFilter === true) {
        filtered = filtered.filter((item) => item.status === 'running' || item.status === 'queued');
      } else if (activeFilter === false) {
        filtered = filtered.filter((item) => item.status !== 'running' && item.status !== 'queued');
      }

      // Sort: active (queued/running) rows first, then by updatedAt descending.
      // Active work floats to the top so the page reads as a worker task manager;
      // within each group the most recent updatedAt wins, and the sort is stable
      // for equal timestamps so equal-time rows keep their collection order.
      filtered.sort((a, b) => {
        const aActive = (a.active ?? isActiveStatus(a.status)) ? 1 : 0;
        const bActive = (b.active ?? isActiveStatus(b.status)) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const aTime = a.updatedAt ?? a.createdAt ?? '';
        const bTime = b.updatedAt ?? b.createdAt ?? '';
        return bTime.localeCompare(aTime);
      });

      const total = filtered.length;
      const items = filtered.slice(0, limit);

      res.json({ items, total } satisfies GlobalActivityResult);
    } catch (err) {
      handleError(res, err);
    }
  });
}
