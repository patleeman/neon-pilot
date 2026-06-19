import { describe, expect, it } from 'vitest';

import { buildAppSnapshotRefreshPlan, incrementAppEventVersionsForTopics, incrementRunProjectionEventVersions } from './appEventProjection';
import { INITIAL_APP_EVENT_VERSIONS } from './contexts';

describe('app event projection', () => {
  it('refreshes runs and executions together for either run projection topic', () => {
    expect(buildAppSnapshotRefreshPlan(['runs'])).toMatchObject({ runs: true, executions: true });
    expect(buildAppSnapshotRefreshPlan(['executions'])).toMatchObject({ runs: true, executions: true });
  });

  it('maps invalidation topics to the narrow snapshot refresh plan', () => {
    expect(buildAppSnapshotRefreshPlan(['sessions', 'tasks', 'daemon', 'workspace'])).toEqual({
      sessions: true,
      tasks: true,
      runs: false,
      executions: false,
      daemon: true,
    });
  });

  it('increments only tracked invalidation topic versions', () => {
    const next = incrementAppEventVersionsForTopics(INITIAL_APP_EVENT_VERSIONS, ['workspace', 'tasks']);

    expect(next.workspace).toBe(1);
    expect(next.tasks).toBe(1);
    expect(next.sessions).toBe(0);
  });

  it('increments runs and executions for run projection events', () => {
    const next = incrementRunProjectionEventVersions(INITIAL_APP_EVENT_VERSIONS);

    expect(next.runs).toBe(1);
    expect(next.executions).toBe(1);
    expect(next.tasks).toBe(0);
  });
});
