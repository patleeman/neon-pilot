import type { StoredKnowledgeBaseState } from './knowledge-base-state.js';

export type GitCommandRunner = (cwd: string, args: string[]) => void;

export function tryRunKnowledgeBaseGitCommand(runGit: GitCommandRunner, cwd: string, args: string[]): boolean {
  try {
    runGit(cwd, args);
    return true;
  } catch {
    return false;
  }
}

export function runKnowledgeBaseRepositoryMaintenance(runGit: GitCommandRunner, root: string, task: 'auto' | 'gc'): boolean {
  if (task === 'gc') {
    if (tryRunKnowledgeBaseGitCommand(runGit, root, ['maintenance', 'run', '--task=gc', '--quiet'])) {
      return true;
    }

    return tryRunKnowledgeBaseGitCommand(runGit, root, ['gc', '--quiet']);
  }

  if (tryRunKnowledgeBaseGitCommand(runGit, root, ['maintenance', 'run', '--auto', '--quiet'])) {
    return true;
  }

  return tryRunKnowledgeBaseGitCommand(runGit, root, ['gc', '--auto', '--quiet']);
}

export function planKnowledgeBaseRepositoryMaintenance(input: {
  storedState: StoredKnowledgeBaseState | null;
  timestamp: string;
  nowMs: number;
  parseTimestampMs: (value: string | null | undefined) => number | null;
  autoMaintenanceIntervalMs: number;
  fullMaintenanceIntervalMs: number;
}): { task: 'auto' | 'gc' | null; previousState: Pick<StoredKnowledgeBaseState, 'lastMaintenanceAt' | 'lastFullMaintenanceAt'> } {
  const lastMaintenanceAtMs = input.parseTimestampMs(input.storedState?.lastMaintenanceAt);
  const lastFullMaintenanceAtMs = input.parseTimestampMs(input.storedState?.lastFullMaintenanceAt);
  const previousState = {
    ...(input.storedState?.lastMaintenanceAt ? { lastMaintenanceAt: input.storedState.lastMaintenanceAt } : {}),
    ...(input.storedState?.lastFullMaintenanceAt ? { lastFullMaintenanceAt: input.storedState.lastFullMaintenanceAt } : {}),
  };

  if (lastFullMaintenanceAtMs !== null && input.nowMs - lastFullMaintenanceAtMs >= input.fullMaintenanceIntervalMs) {
    return { task: 'gc', previousState };
  }

  if (lastMaintenanceAtMs === null || input.nowMs - lastMaintenanceAtMs >= input.autoMaintenanceIntervalMs) {
    return { task: 'auto', previousState };
  }

  return { task: null, previousState };
}

export function buildKnowledgeBaseMaintenanceState(input: {
  task: 'auto' | 'gc';
  timestamp: string;
  storedState: StoredKnowledgeBaseState | null;
}): Pick<StoredKnowledgeBaseState, 'lastMaintenanceAt' | 'lastFullMaintenanceAt'> {
  if (input.task === 'gc') {
    return {
      lastMaintenanceAt: input.timestamp,
      lastFullMaintenanceAt: input.timestamp,
    };
  }

  return {
    lastMaintenanceAt: input.timestamp,
    ...(input.storedState?.lastFullMaintenanceAt ? { lastFullMaintenanceAt: input.storedState.lastFullMaintenanceAt } : {}),
  };
}
