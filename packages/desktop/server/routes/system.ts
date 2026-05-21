import type { Express } from 'express';

import { readDaemonState } from '../automation/daemon.js';
import { listDurableRuns } from '../automation/durableRuns.js';
import { listConversationSessionsSnapshot } from '../conversations/conversationService.js';
import { type AppEventTopic } from '../shared/appEvents.js';
import type { ServerRouteContext } from './context.js';

let listTasksForRuntimeScopeFn: () => unknown[] = () => {
  throw new Error('listTasksForRuntimeScope not initialized for system routes');
};

function initializeSystemRoutesContext(
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'listTasksForRuntimeScope'>,
): void {
  void context.getRuntimeScope;
  void context.getRepoRoot;
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

export function registerSystemRoutes(
  router: Pick<Express, 'get' | 'post'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'listTasksForRuntimeScope'>,
): void {
  void router;
  initializeSystemRoutesContext(context);
}
