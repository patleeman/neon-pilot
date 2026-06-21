export interface ThreadGoal {
  objective: string;
  status: 'active' | 'paused' | 'complete';
  tasks: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'done' | 'blocked' }>;
  stopReason: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

export const GOAL_STATE_CUSTOM_TYPE = 'conversation-goal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeGoalStatus(value: unknown): ThreadGoal['status'] {
  if (typeof value === 'string' && ['active', 'paused', 'complete'].includes(value)) {
    return value as ThreadGoal['status'];
  }
  return 'complete';
}

export function normalizeTaskStatus(value: unknown): ThreadGoal['tasks'][number]['status'] {
  if (typeof value === 'string' && ['pending', 'in_progress', 'done', 'blocked'].includes(value)) {
    return value as ThreadGoal['tasks'][number]['status'];
  }
  return 'pending';
}

export function readGoalFromEntries(entries: unknown[]): ThreadGoal | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== GOAL_STATE_CUSTOM_TYPE) {
      continue;
    }
    const data = entry.data;
    if (!isRecord(data) || typeof data.objective !== 'string') {
      continue;
    }
    const status = normalizeGoalStatus(data.status);
    if (!data.objective.trim() || status === 'complete') {
      return null;
    }
    const tasks: ThreadGoal['tasks'] = [];
    if (Array.isArray(data.tasks)) {
      for (const task of data.tasks) {
        if (!isRecord(task) || typeof task.id !== 'string' || typeof task.description !== 'string') {
          continue;
        }
        tasks.push({
          id: task.id,
          description: task.description,
          status: normalizeTaskStatus(task.status),
        });
      }
    }
    return {
      objective: data.objective,
      status,
      tasks,
      stopReason: typeof data.stopReason === 'string' ? data.stopReason : null,
      startedAt: typeof data.startedAt === 'string' ? data.startedAt : typeof data.updatedAt === 'string' ? data.updatedAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }
  return null;
}
