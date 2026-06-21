import {
  buildCronFromEasyTaskSchedule,
  createCronEditorState,
  type CronEditorState,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../automation/taskSchedule';
import { buildConversationGroupLabels, normalizeConversationGroupCwd } from '../conversation/conversationCwdGroups';
import type { ProjectRecord, ScheduledTaskDetail, SessionMeta } from '../shared/types';

const MAX_SCHEDULED_TASK_DURATION_SECONDS = 7 * 24 * 60 * 60;
const MAX_CATCH_UP_WINDOW_MINUTES = MAX_SCHEDULED_TASK_DURATION_SECONDS / 60;
const DEFAULT_CATCH_UP_WINDOW_MINUTES = 15;

export interface TaskFormState {
  title: string;
  targetType: 'background-agent' | 'conversation';
  scheduleMode: 'cron' | 'at';
  cronEditor: CronEditorState;
  atValue: string;
  runIn: 'local' | 'worktree';
  projectPath: string;
  threadMode: 'dedicated' | 'existing' | 'none';
  threadConversationId: string;
  model: string;
  thinkingLevel: string;
  catchUpWindowMinutes: string;
  prompt: string;
}

export function shouldShowTaskModelControls(state: Pick<TaskFormState, 'targetType'>): boolean {
  return state.targetType === 'background-agent' || state.targetType === 'conversation';
}

export function createDefaultTaskFormState(): TaskFormState {
  return {
    title: '',
    targetType: 'background-agent',
    scheduleMode: 'cron',
    cronEditor: createCronEditorState('0 9 * * 1-5'),
    atValue: '',
    runIn: 'local',
    projectPath: '',
    threadMode: 'dedicated',
    threadConversationId: '',
    model: '',
    thinkingLevel: '',
    catchUpWindowMinutes: String(DEFAULT_CATCH_UP_WINDOW_MINUTES),
    prompt: '',
  };
}

export function createTaskFormState(task: ScheduledTaskDetail): TaskFormState {
  return {
    title: task.title ?? task.id,
    targetType: task.targetType === 'conversation' ? 'conversation' : 'background-agent',
    scheduleMode: task.at ? 'at' : 'cron',
    cronEditor: createCronEditorState(task.cron),
    atValue: toDateTimeLocalValue(task.at),
    runIn: task.cwd ? 'worktree' : 'local',
    projectPath: task.cwd ?? '',
    threadMode: task.threadMode,
    threadConversationId: task.threadConversationId ?? '',
    model: task.model ?? '',
    thinkingLevel: task.thinkingLevel ?? '',
    catchUpWindowMinutes: task.catchUpWindowSeconds ? String(Math.max(1, Math.ceil(task.catchUpWindowSeconds / 60))) : '',
    prompt: task.prompt,
  };
}

function resolveCronExpression(state: TaskFormState): string {
  return state.cronEditor.mode === 'builder' ? buildCronFromEasyTaskSchedule(state.cronEditor.builder) : state.cronEditor.rawCron.trim();
}

export function parseCatchUpWindowMinutes(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_CATCH_UP_WINDOW_MINUTES ? parsed : Number.NaN;
}

export function formatCatchUpWindowLabel(seconds: number | undefined): string {
  if (!Number.isSafeInteger(seconds) || !seconds || seconds <= 0 || seconds > MAX_SCHEDULED_TASK_DURATION_SECONDS) {
    return 'Disabled';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function validateTaskForm(state: TaskFormState, _mode: 'create' | 'edit'): string | null {
  if (!state.title.trim()) {
    return 'Title is required.';
  }

  if (!state.prompt.trim()) {
    return 'Prompt is required.';
  }

  if (state.scheduleMode === 'cron') {
    if (!resolveCronExpression(state)) {
      return 'Cron is required.';
    }

    const catchUpWindowMinutes = parseCatchUpWindowMinutes(state.catchUpWindowMinutes);
    if (Number.isNaN(catchUpWindowMinutes)) {
      return 'Catch-up window must be a positive number of minutes.';
    }
  } else if (!state.atValue.trim() || !fromDateTimeLocalValue(state.atValue)) {
    return 'Choose when this one-time task should run.';
  }

  if (state.threadMode === 'existing' && !state.threadConversationId.trim()) {
    return 'Choose an existing conversation.';
  }

  if (state.targetType === 'conversation' && state.threadMode === 'none') {
    return 'Conversation automations need a conversation.';
  }

  return null;
}

export function createTaskMutationPayload(state: TaskFormState) {
  const catchUpWindowMinutes = state.scheduleMode === 'cron' ? parseCatchUpWindowMinutes(state.catchUpWindowMinutes) : undefined;

  return {
    title: state.title.trim(),
    cron: state.scheduleMode === 'cron' ? resolveCronExpression(state) : null,
    at: state.scheduleMode === 'at' ? fromDateTimeLocalValue(state.atValue) : null,
    model: state.model.trim() || null,
    thinkingLevel: state.thinkingLevel.trim() || null,
    cwd: state.runIn === 'worktree' ? state.projectPath.trim() || null : null,
    catchUpWindowSeconds:
      typeof catchUpWindowMinutes === 'number' && !Number.isNaN(catchUpWindowMinutes) ? catchUpWindowMinutes * 60 : null,
    prompt: state.prompt,
    targetType: state.targetType,
    threadMode: state.threadMode,
    threadConversationId: state.threadMode === 'existing' ? state.threadConversationId.trim() || null : null,
  };
}

function summarizePathLabel(path: string): string {
  const normalized = normalizeConversationGroupCwd(path);
  if (!normalized) {
    return 'Select project';
  }

  if (normalized === '/' || /^[A-Za-z]:\/$/.test(normalized)) {
    return normalized;
  }

  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

function isFilesystemRootPath(path: string): boolean {
  const normalized = normalizeConversationGroupCwd(path);
  return normalized === '/' || /^[A-Za-z]:\/$/.test(normalized);
}

export function buildTaskProjectOptions(input: {
  projectPath?: string;
  defaultCwd?: string | null;
  savedWorkspacePaths?: string[] | null;
  sessions?: SessionMeta[] | null;
  projects?: ProjectRecord[] | null;
}): Array<{ label: string; path: string }> {
  const seen = new Set<string>();
  const orderedPaths: string[] = [];
  const projectTitlesByPath = new Map<string, string>();

  function addPath(candidate: string | null | undefined, options?: { title?: string; allowRoot?: boolean }) {
    const normalized = normalizeConversationGroupCwd(candidate);
    if (!normalized) return;
    if (!options?.allowRoot && isFilesystemRootPath(normalized)) return;
    const title = options?.title?.trim();
    if (title && !projectTitlesByPath.has(normalized)) {
      projectTitlesByPath.set(normalized, title);
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    orderedPaths.push(normalized);
  }

  addPath(input.projectPath, { allowRoot: true });
  addPath(input.defaultCwd);

  for (const savedPath of input.savedWorkspacePaths ?? []) {
    addPath(savedPath);
  }
  for (const session of input.sessions ?? []) {
    addPath(session.cwd);
  }
  for (const project of input.projects ?? []) {
    addPath(project.repoRoot, { title: project.title });
  }

  const labelsByPath = buildConversationGroupLabels(orderedPaths);

  return orderedPaths.map((path) => ({
    label: projectTitlesByPath.get(path) ?? labelsByPath.get(path) ?? summarizePathLabel(path),
    path,
  }));
}

export function buildTaskExistingThreadOptions(input: {
  sessions?: SessionMeta[] | null;
  effectiveThreadCwd?: string | null;
}): Array<{ id: string; label: string; cwd?: string }> {
  const effectiveThreadCwd = normalizeConversationGroupCwd(input.effectiveThreadCwd);
  const entries = (input.sessions ?? [])
    .filter((session) => {
      const sessionCwd = normalizeConversationGroupCwd(session.cwd);
      return !effectiveThreadCwd || !sessionCwd || sessionCwd === effectiveThreadCwd;
    })
    .map((session) => ({
      id: session.id,
      label: session.title,
      cwd: session.cwd,
    }));

  return entries.sort((left, right) => left.label.localeCompare(right.label));
}

export function shouldClearMissingExistingThreadSelection(input: {
  threadMode: TaskFormState['threadMode'];
  threadConversationId: string;
  existingThreadOptions: Array<{ id: string }>;
  sessionsLoaded: boolean;
}): boolean {
  if (!input.sessionsLoaded || input.threadMode !== 'existing' || !input.threadConversationId.trim()) {
    return false;
  }
  return !input.existingThreadOptions.some((option) => option.id === input.threadConversationId);
}
