import {
  getAutomationDbPath,
  getStoredAutomation,
  listStoredAutomations,
  loadAutomationRuntimeStateMap,
  loadDaemonConfig,
  type StoredAutomation,
} from '@neon-pilot/daemon';

export interface TaskRuntimeEntry {
  id?: string;
  filePath: string;
  scheduleType?: string;
  running?: boolean;
  lastStatus?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastScheduledMinute?: string;
  lastAttemptCount?: number;
  lastLogPath?: string;
}

export interface ScheduledTaskFileMetadata {
  id: string;
  title: string;
  enabled: boolean;
  scheduleType: StoredAutomation['schedule']['type'];
  targetType: 'background-agent' | 'conversation';
  cron?: string;
  at?: string;
  model?: string;
  thinkingLevel?: string;
  profile?: string;
  cwd?: string;
  timeoutSeconds?: number;
  catchUpWindowSeconds?: number;
  prompt: string;
  promptBody: string;
}

export interface ScheduledTaskParseError {
  filePath: string;
  error: string;
}

export interface LoadedScheduledTasksForProfile {
  taskDir: string;
  tasks: StoredAutomation[];
  parseErrors: ScheduledTaskParseError[];
  runtimeState: Record<string, TaskRuntimeEntry>;
  runtimeEntries: TaskRuntimeEntry[];
}

function toRuntimeEntries(): { runtimeState: Record<string, TaskRuntimeEntry>; runtimeEntries: TaskRuntimeEntry[] } {
  const runtimeState = loadAutomationRuntimeStateMap({ dbPath: getAutomationDbPath() });
  const entries = Object.values(runtimeState).map((record) => ({
    id: record.id,
    filePath: record.filePath,
    scheduleType: record.scheduleType,
    running: record.running,
    lastStatus: record.lastStatus,
    lastRunAt: record.lastRunAt,
    lastSuccessAt: record.lastSuccessAt,
    lastScheduledMinute: record.lastScheduledMinute,
    lastAttemptCount: record.lastAttemptCount,
    lastLogPath: record.lastLogPath,
  }));

  return {
    runtimeState: Object.fromEntries(entries.flatMap((entry) => (entry.id ? [[entry.id, entry] as const] : []))),
    runtimeEntries: entries,
  };
}

function hydrateMetadata(task: StoredAutomation): ScheduledTaskFileMetadata {
  return {
    id: task.id,
    title: task.title,
    enabled: task.enabled,
    scheduleType: task.schedule.type,
    targetType: task.targetType,
    cron: task.schedule.type === 'cron' ? task.schedule.expression : undefined,
    at: task.schedule.type === 'at' ? task.schedule.at : undefined,
    model: task.modelRef,
    thinkingLevel: task.thinkingLevel,
    profile: task.profile,
    cwd: task.cwd,
    timeoutSeconds: task.timeoutSeconds,
    catchUpWindowSeconds: task.catchUpWindowSeconds,
    prompt: task.prompt.split('\n')[0]?.slice(0, 120) ?? '',
    promptBody: task.prompt,
  };
}

export function getScheduledTaskStateFilePath(): string {
  return getAutomationDbPath();
}

export function taskDirForProfile(_profile: string): string {
  return loadDaemonConfig().modules.tasks.taskDir;
}

export function loadScheduledTaskRuntimeState(): Record<string, TaskRuntimeEntry> {
  return toRuntimeEntries().runtimeState;
}

export function loadScheduledTasksForProfile(profile: string): LoadedScheduledTasksForProfile {
  const taskDir = taskDirForProfile(profile);
  const tasks = listStoredAutomations({ dbPath: getAutomationDbPath() });
  const { runtimeState, runtimeEntries } = toRuntimeEntries();

  return {
    taskDir,
    tasks,
    parseErrors: [],
    runtimeState,
    runtimeEntries,
  };
}

export function resolveScheduledTaskForProfile(
  profile: string,
  taskId: string,
): {
  taskDir: string;
  task: StoredAutomation;
  runtime?: TaskRuntimeEntry;
} {
  const loaded = loadScheduledTasksForProfile(profile);
  const task = getStoredAutomation(taskId, { dbPath: getAutomationDbPath() });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return {
    taskDir: loaded.taskDir,
    task,
    runtime: loaded.runtimeState[task.id],
  };
}

export function toScheduledTaskMetadata(task: StoredAutomation): ScheduledTaskFileMetadata {
  return hydrateMetadata(task);
}
