export type RoutinePosition = 'before' | 'after';
export type RoutineType = 'instruction' | 'decision' | 'stop';
export type RoutineFailureBehavior = 'continue' | 'warn' | 'block';
export type RoutineOutcomeBehavior = 'continue' | 'warn' | 'block' | 'ask' | 'branch';

export interface RoutineHookPoint {
  id: string;
  title: string;
  group: string;
  description: string;
  ownerExtensionId: string;
  variables: Array<{ name: string; label: string }>;
}

export interface RoutineOutcome {
  id: string;
  label: string;
  target: string;
  behavior: RoutineOutcomeBehavior;
  nextRoutineId?: string;
}

export interface Routine {
  id: string;
  hookId: string;
  position: RoutinePosition;
  parentRoutineId?: string;
  parentOutcomeId?: string;
  type: RoutineType;
  name: string;
  instruction: string;
  enabled: boolean;
  order: number;
  failureBehavior: RoutineFailureBehavior;
  modelRef?: string;
  fallbackModelRef?: string;
  outcomes: RoutineOutcome[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutineRunStep {
  routineId: string;
  routineName: string;
  status: 'passed' | 'warned' | 'blocked' | 'failed' | 'skipped';
  outcome?: string;
  text?: string;
  message?: string;
  skillRefs: string[];
  model?: string;
  provider?: string;
  fallbackUsed?: boolean;
}

export interface RoutineRunRecord {
  id: string;
  hookId: string;
  position: RoutinePosition;
  status: 'passed' | 'warned' | 'blocked' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  context: Record<string, unknown>;
  steps: RoutineRunStep[];
}

export interface RoutinesState {
  version: 1;
  hookPoints: RoutineHookPoint[];
  routines: Routine[];
  runs: RoutineRunRecord[];
}
