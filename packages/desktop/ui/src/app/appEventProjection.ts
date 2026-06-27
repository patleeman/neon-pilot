import type { AppEventTopic } from '../shared/types';

type AppEventVersions = Record<AppEventTopic, number>;

export interface AppSnapshotRefreshPlan {
  sessions: boolean;
  tasks: boolean;
  runs: boolean;
  executions: boolean;
  daemon: boolean;
}

export function buildAppSnapshotRefreshPlan(topics: Iterable<AppEventTopic>): AppSnapshotRefreshPlan {
  const topicSet = new Set(topics);
  const refreshRunProjection = topicSet.has('runs') || topicSet.has('executions');
  const refreshConversationProjection = topicSet.has('sessions') || topicSet.has('workspace');
  return {
    sessions: refreshConversationProjection,
    tasks: topicSet.has('tasks'),
    runs: refreshRunProjection,
    executions: refreshRunProjection,
    daemon: topicSet.has('daemon'),
  };
}

export function incrementAppEventVersionsForTopics(previous: AppEventVersions, topics: Iterable<AppEventTopic>): AppEventVersions {
  let next: AppEventVersions | null = null;
  for (const topic of topics) {
    if (!(topic in previous)) {
      continue;
    }
    const trackedTopic = topic as keyof AppEventVersions;
    next ??= { ...previous };
    next[trackedTopic] += 1;
  }
  return next ?? previous;
}

export function incrementRunProjectionEventVersions(previous: AppEventVersions): AppEventVersions {
  return {
    ...previous,
    runs: previous.runs + 1,
    executions: previous.executions + 1,
  };
}
