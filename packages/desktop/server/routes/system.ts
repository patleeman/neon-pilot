import type { Express, Request, Response } from 'express';

import { readDaemonState } from '../automation/daemon.js';
import { listDurableRuns } from '../automation/durableRuns.js';
import { listConversationSessionsSnapshot } from '../conversations/conversationService.js';
import { logError } from '../middleware/index.js';
import { type AppEventTopic } from '../shared/appEvents.js';
import type { ServerRouteContext } from './context.js';

let getRepoRootFn: () => string = () => {
  throw new Error('getRepoRoot not initialized for system routes');
};

let listTasksForRuntimeScopeFn: () => unknown[] = () => {
  throw new Error('listTasksForRuntimeScope not initialized for system routes');
};

function initializeSystemRoutesContext(
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'listTasksForRuntimeScope'>,
): void {
  void context.getRuntimeScope;
  getRepoRootFn = context.getRepoRoot;
  listTasksForRuntimeScopeFn = context.listTasksForRuntimeScope;
}

export async function buildSnapshotEventsForTopic(topic: AppEventTopic): Promise<unknown[]> {
  switch (topic) {
    case 'sessions':
      return [{ type: 'sessions_snapshot' as const, sessions: listConversationSessionsSnapshot() }];
    case 'tasks':
      return [{ type: 'tasks_snapshot' as const, tasks: listTasksForRuntimeScopeFn() }];
    case 'runs':
      return [{ type: 'runs_snapshot' as const, result: await listDurableRuns() }];
    case 'daemon':
      return [{ type: 'daemon_snapshot' as const, state: await readDaemonState() }];
    default:
      return [];
  }
}

export const INITIAL_APP_EVENT_TOPICS: AppEventTopic[] = ['sessions', 'tasks', 'runs', 'daemon'];

function handleStatus(_req: Request, res: Response): void {
  try {
    res.json({
      repoRoot: getRepoRootFn(),
      appRevision: process.env.NEON_PILOT_APP_REVISION,
    });
  } catch (err) {
    logError('request handler error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: String(err) });
  }
}

export function registerSystemRoutes(
  router: Pick<Express, 'get' | 'post'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'listTasksForRuntimeScope'>,
): void {
  initializeSystemRoutesContext(context);
  router.get('/api/status', handleStatus);
}
