export function mapSnapshotEventToDesktopAppEvent(event: unknown): unknown | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const typedEvent = event as {
    type?: string;
    sessions?: unknown;
    tasks?: unknown;
    result?: unknown;
    state?: unknown;
  };

  switch (typedEvent.type) {
    case 'sessions_snapshot':
      return {
        type: 'sessions',
        sessions: Array.isArray(typedEvent.sessions) ? typedEvent.sessions : [],
      };
    case 'tasks_snapshot':
      return {
        type: 'tasks',
        tasks: Array.isArray(typedEvent.tasks) ? typedEvent.tasks : [],
      };
    case 'runs_snapshot':
      return {
        type: 'runs',
        result: typedEvent.result ?? null,
      };
    case 'daemon_snapshot':
      return {
        type: 'daemon',
        state: typedEvent.state ?? null,
      };
    default:
      return null;
  }
}
