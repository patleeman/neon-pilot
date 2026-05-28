import type { NativeExtensionClient } from '@neon-pilot/extensions';
import type { ScheduledTaskSchedulerHealth, ScheduledTaskSummary } from '@neon-pilot/extensions/data';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageToc,
  cx,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ConversationOption {
  id: string;
  title: string;
  cwd?: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

interface AutomationFormState {
  title: string;
  prompt: string;
  scheduleType: 'cron' | 'at';
  cron: string;
  scheduleBuilder: EasySchedule;
  at: string;
  cwd: string;
  targetType: 'background-agent' | 'conversation';
  threadMode: 'dedicated' | 'existing' | 'none';
  threadConversationId: string;
  model: string;
  thinkingLevel: string;
  timeoutSeconds: string;
  catchUpWindowSeconds: string;
  policies: AutomationPolicy[];
  enabled: boolean;
}

type EasyCadence = 'hourly' | 'interval' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

interface EasySchedule {
  cadence: EasyCadence;
  minute: number;
  hour: number;
  intervalHours: number;
  weekdays: number[];
  dayOfMonth: number;
}

type AutomationPolicy =
  | { kind: 'catch_up'; enabled?: boolean; windowSeconds: number; mode?: 'latest' }
  | { kind: 'overlap'; enabled?: boolean; behavior: 'skip' }
  | { kind: 'once_per_period'; enabled?: boolean; count: number; period: 'day' | 'week' | 'month'; timezone?: string }
  | {
      kind: 'flexible_timing';
      enabled?: boolean;
      startTime?: string;
      endTime?: string;
      placement?: 'automatic' | 'earliest' | 'randomized';
    };

type AutomationTaskForEditor = ScheduledTaskSummary & {
  threadMode?: 'dedicated' | 'existing' | 'none';
  timeoutSeconds?: number;
  policies?: AutomationPolicy[];
};

type AutomationFilter = 'all' | 'current' | 'past-due' | 'failed' | 'disabled';
type EditorSectionId = 'automation-general' | 'automation-schedule' | 'automation-policies' | 'automation-delivery' | 'automation-runtime';

const EDITOR_TOC_ITEMS: Array<{ id: EditorSectionId; label: string; summary: string }> = [
  { id: 'automation-general', label: 'General', summary: 'Name and instruction' },
  { id: 'automation-schedule', label: 'Schedule', summary: 'When it runs' },
  { id: 'automation-policies', label: 'Policies', summary: 'Attached rules' },
  { id: 'automation-delivery', label: 'Delivery', summary: 'Where results go' },
  { id: 'automation-runtime', label: 'Runtime', summary: 'Model, cwd, and timeout' },
];

const THINKING_LEVEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
];

const DEFAULT_TIMEOUT_SECONDS = '1800';
const DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS = '900';

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const CRON_PRESETS = [
  { label: 'Every 15 minutes', summary: 'Good for short polling', cron: '*/15 * * * *', preview: 'Runs every 15 minutes.' },
  { label: 'Hourly', summary: 'On the hour', cron: '0 * * * *', preview: 'Runs every hour on the hour.' },
  { label: 'Every 2 hours', summary: 'Light recurring check', cron: '0 */2 * * *', preview: 'Runs every 2 hours.' },
  { label: 'Every 4 hours', summary: 'A few times per day', cron: '0 */4 * * *', preview: 'Runs every 4 hours.' },
  { label: 'Daily morning', summary: '8:00 AM every day', cron: '0 8 * * *', preview: 'Runs every day at 8:00 AM.' },
  { label: 'Daily noon', summary: '12:00 PM every day', cron: '0 12 * * *', preview: 'Runs every day at 12:00 PM.' },
  { label: 'Daily evening', summary: '5:00 PM every day', cron: '0 17 * * *', preview: 'Runs every day at 5:00 PM.' },
  { label: 'Workday start', summary: '9:00 AM weekdays', cron: '0 9 * * 1-5', preview: 'Runs every weekday at 9:00 AM.' },
  { label: 'Workday end', summary: '5:00 PM weekdays', cron: '0 17 * * 1-5', preview: 'Runs every weekday at 5:00 PM.' },
  { label: 'Monday morning', summary: '9:00 AM Mondays', cron: '0 9 * * 1', preview: 'Runs every Monday at 9:00 AM.' },
  { label: 'Friday wrap-up', summary: '4:00 PM Fridays', cron: '0 16 * * 5', preview: 'Runs every Friday at 4:00 PM.' },
  {
    label: 'Monthly kickoff',
    summary: '9:00 AM on the 1st',
    cron: '0 9 1 * *',
    preview: 'Runs at 9:00 AM on the first day of each month.',
  },
];

const FILTER_LABELS: Record<AutomationFilter, string> = {
  all: 'All',
  current: 'Current',
  'past-due': 'Past due',
  failed: 'Failed',
  disabled: 'Disabled',
};

const MAX_RENDERED_LOG_CHARS = 20_000;

function truncateLogForRender(value: string | undefined | null): string {
  if (!value) return 'No log yet.';
  return value.length > MAX_RENDERED_LOG_CHARS
    ? `… truncated to latest ${MAX_RENDERED_LOG_CHARS} chars …\n${value.slice(-MAX_RENDERED_LOG_CHARS)}`
    : value;
}

const emptyForm: AutomationFormState = {
  title: '',
  prompt: '',
  scheduleType: 'cron',
  cron: '0 9 * * 1-5',
  scheduleBuilder: {
    cadence: 'weekdays',
    minute: 0,
    hour: 9,
    intervalHours: 4,
    weekdays: [1, 2, 3, 4, 5],
    dayOfMonth: 1,
  },
  at: '',
  cwd: '',
  targetType: 'background-agent',
  threadMode: 'dedicated',
  threadConversationId: '',
  model: '',
  thinkingLevel: '',
  timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  catchUpWindowSeconds: DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS,
  policies: [
    { kind: 'catch_up', enabled: true, windowSeconds: Number(DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS), mode: 'latest' },
    { kind: 'overlap', enabled: true, behavior: 'skip' },
  ],
  enabled: true,
};

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeWeekdays(values: number[]): number[] {
  const normalized = values.map((value) => (value === 7 ? 0 : value)).filter((value) => value >= 0 && value <= 6);
  return [...new Set(normalized)].sort((left, right) => left - right);
}

function serializeWeekdays(values: number[]): string {
  const weekdays = normalizeWeekdays(values);
  if (weekdays.length === 5 && weekdays.every((value, index) => value === index + 1)) return '1-5';
  return weekdays.length > 0 ? weekdays.join(',') : '1';
}

function parseWeekdayField(value: string): number[] | null {
  const weekdays: number[] = [];
  for (const segment of value.split(',')) {
    const trimmed = segment.trim();
    const range = trimmed.match(/^(\d)-(\d)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start) return null;
      for (let day = start; day <= end; day += 1) weekdays.push(day);
      continue;
    }
    if (!/^\d$/.test(trimmed)) return null;
    weekdays.push(Number(trimmed));
  }
  return normalizeWeekdays(weekdays);
}

function buildCronFromEasySchedule(schedule: EasySchedule): string {
  const minute = clampInteger(schedule.minute, 0, 59);
  const hour = clampInteger(schedule.hour, 0, 23);
  const intervalHours = clampInteger(schedule.intervalHours, 1, 23);
  const dayOfMonth = clampInteger(schedule.dayOfMonth, 1, 31);
  switch (schedule.cadence) {
    case 'hourly':
      return `${minute} * * * *`;
    case 'interval':
      return `${minute} */${intervalHours} * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekdays':
      return `${minute} ${hour} * * 1-5`;
    case 'weekly':
      return `${minute} ${hour} * * ${serializeWeekdays(schedule.weekdays)}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

function easyScheduleFromCron(cron: string): EasySchedule | null {
  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = cron.trim().split(/\s+/);
  if (!minuteField || !hourField || !dayOfMonthField || !monthField || !dayOfWeekField) return null;
  const minute = Number(minuteField);
  if (!Number.isSafeInteger(minute) || minute < 0 || minute > 59 || monthField !== '*') return null;

  if (dayOfMonthField === '*' && dayOfWeekField === '*') {
    if (hourField === '*') return { ...emptyForm.scheduleBuilder, cadence: 'hourly', minute };
    const interval = hourField.match(/^\*\/(\d+)$/);
    if (interval)
      return { ...emptyForm.scheduleBuilder, cadence: 'interval', minute, intervalHours: clampInteger(Number(interval[1]), 1, 23) };
    const hour = Number(hourField);
    return Number.isSafeInteger(hour) && hour >= 0 && hour <= 23 ? { ...emptyForm.scheduleBuilder, cadence: 'daily', minute, hour } : null;
  }

  const hour = Number(hourField);
  if (!Number.isSafeInteger(hour) || hour < 0 || hour > 23) return null;
  if (dayOfMonthField === '*') {
    if (dayOfWeekField === '1-5') return { ...emptyForm.scheduleBuilder, cadence: 'weekdays', minute, hour, weekdays: [1, 2, 3, 4, 5] };
    const weekdays = parseWeekdayField(dayOfWeekField);
    return weekdays ? { ...emptyForm.scheduleBuilder, cadence: 'weekly', minute, hour, weekdays } : null;
  }

  if (dayOfWeekField === '*') {
    const dayOfMonth = Number(dayOfMonthField);
    return Number.isSafeInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31
      ? { ...emptyForm.scheduleBuilder, cadence: 'monthly', minute, hour, dayOfMonth }
      : null;
  }

  return null;
}

function formatTimeValue(schedule: EasySchedule): string {
  return `${pad2(clampInteger(schedule.hour, 0, 23))}:${pad2(clampInteger(schedule.minute, 0, 59))}`;
}

function parseTimeValue(value: string): Pick<EasySchedule, 'hour' | 'minute'> | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: clampInteger(Number(match[1]), 0, 23), minute: clampInteger(Number(match[2]), 0, 59) };
}

function formatClock(schedule: Pick<EasySchedule, 'hour' | 'minute'>): string {
  const hour = clampInteger(schedule.hour, 0, 23);
  const minute = clampInteger(schedule.minute, 0, 59);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${pad2(minute)} ${suffix}`;
}

function scheduleBuilderPreview(schedule: EasySchedule): string {
  switch (schedule.cadence) {
    case 'hourly':
      return schedule.minute === 0 ? 'Runs every hour on the hour.' : `Runs every hour at :${pad2(clampInteger(schedule.minute, 0, 59))}.`;
    case 'interval':
      return `Runs every ${clampInteger(schedule.intervalHours, 1, 23)} hours.`;
    case 'daily':
      return `Runs every day at ${formatClock(schedule)}.`;
    case 'weekdays':
      return `Runs every weekday at ${formatClock(schedule)}.`;
    case 'weekly': {
      const days = normalizeWeekdays(schedule.weekdays)
        .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label)
        .filter(Boolean)
        .join(', ');
      return `Runs every ${days || 'Mon'} at ${formatClock(schedule)}.`;
    }
    case 'monthly':
      return `Runs monthly on day ${clampInteger(schedule.dayOfMonth, 1, 31)} at ${formatClock(schedule)}.`;
  }
}

function taskName(task: Pick<ScheduledTaskSummary, 'id' | 'title'>) {
  return (task.title || '').trim() || task.id;
}

function isFailedTask(task: ScheduledTaskSummary) {
  return task.lastStatus === 'failed' || task.lastStatus === 'failure';
}

function taskRank(task: ScheduledTaskSummary) {
  if (task.running) return 0;
  if (isFailedTask(task)) return 1;
  if (task.enabled) return 2;
  return 3;
}

function sortTasks(tasks: ScheduledTaskSummary[]) {
  return [...tasks].sort(
    (a, b) =>
      taskRank(a) - taskRank(b) ||
      String(b.lastRunAt || '').localeCompare(String(a.lastRunAt || '')) ||
      taskName(a).localeCompare(taskName(b)),
  );
}

function sortPastDueTasks(tasks: ScheduledTaskSummary[]) {
  return [...tasks].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || taskName(a).localeCompare(taskName(b)));
}

function readConversationOptions(input: unknown): ConversationOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      if (!id) return null;
      const rawTitle = typeof record.title === 'string' ? record.title.trim() : '';
      const cwd = typeof record.cwd === 'string' ? record.cwd : undefined;
      return { id, title: rawTitle || id, cwd } satisfies ConversationOption;
    })
    .filter((item): item is ConversationOption => Boolean(item))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function readModelOptions(input: unknown): ModelOption[] {
  const models =
    input && typeof input === 'object' && Array.isArray((input as { models?: unknown }).models)
      ? (input as { models: unknown[] }).models
      : [];
  return models
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      if (!id) return null;
      const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : id;
      const provider = typeof record.provider === 'string' ? record.provider : undefined;
      return { id, name, provider } satisfies ModelOption;
    })
    .filter((item): item is ModelOption => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function readPickedFolderPath(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (record.cancelled === true) return null;
  const path = typeof record.path === 'string' ? record.path.trim() : '';
  return path || null;
}

function oneTimeTaskAtMs(task: Pick<ScheduledTaskSummary, 'at'>) {
  const scheduledAt = task.at?.trim();
  if (!scheduledAt) return null;
  const atMs = Date.parse(scheduledAt);
  return Number.isFinite(atMs) ? atMs : null;
}

function isPastDueOneTimeTask(task: ScheduledTaskSummary, nowMs = Date.now()) {
  if (task.enabled === false || task.running || task.lastRunAt) return false;
  const atMs = oneTimeTaskAtMs(task);
  return atMs !== null && atMs <= nowMs;
}

function statusText(task: ScheduledTaskSummary, nowMs = Date.now()) {
  if (task.running) return 'Running';
  if (isPastDueOneTimeTask(task, nowMs)) return 'Past due';
  if (!task.enabled) return 'Disabled';
  if (isFailedTask(task)) return 'Needs attention';
  if (task.lastStatus === 'success') return 'Active';
  return task.cron || task.at ? 'Active' : 'Manual';
}

function statusClass(task: ScheduledTaskSummary, nowMs = Date.now()) {
  if (task.running) return 'bg-accent border-accent';
  if (isPastDueOneTimeTask(task, nowMs)) return 'bg-warning border-warning';
  if (!task.enabled) return 'opacity-40';
  if (isFailedTask(task)) return 'bg-danger border-danger';
  if (task.lastStatus === 'success') return 'bg-success border-success';
  return 'border-secondary';
}

function statusTextClass(task: ScheduledTaskSummary, nowMs = Date.now()) {
  if (task.running) return 'text-accent';
  if (isPastDueOneTimeTask(task, nowMs)) return 'text-warning';
  if (!task.enabled) return 'text-dim';
  if (isFailedTask(task)) return 'text-danger';
  return 'text-success';
}

function scheduleText(task: ScheduledTaskSummary) {
  if (task.cron) return `Cron ${task.cron}`;
  if (task.at) return `Once ${task.at}`;
  return 'Manual';
}

function taskScopeText(task: ScheduledTaskSummary) {
  return task.cwd?.split('/').filter(Boolean).at(-1) ?? task.threadTitle ?? task.threadConversationId ?? '';
}

function taskScheduleSummary(task: ScheduledTaskSummary) {
  const preset = CRON_PRESETS.find((candidate) => candidate.cron === task.cron);
  if (preset) return preset.label;
  if (task.cron === '0 2 * * *') return 'Daily at 02:00';
  if (task.cron === '0 * * * *') return 'Hourly';
  if (task.cron?.startsWith('0 */')) {
    const hours = task.cron.match(/^0 \*\/(\d+) \* \* \*$/)?.[1];
    if (hours) return `Every ${hours} hours`;
  }
  return scheduleText(task);
}

function taskLastRunText(task: ScheduledTaskSummary, nowMs = Date.now()) {
  if (isPastDueOneTimeTask(task, nowMs)) return 'Scheduled time passed';
  return task.lastRunAt ? `Last run ${timeAgo(task.lastRunAt)}` : 'Not run yet';
}

function taskTargetLabel(task: ScheduledTaskSummary) {
  return task.targetType === 'conversation' ? 'Thread' : 'Job';
}

function taskSearchText(task: ScheduledTaskSummary) {
  return [
    task.id,
    task.title,
    task.prompt,
    task.cron,
    task.at,
    task.cwd,
    task.threadConversationId,
    task.threadTitle,
    task.targetType,
    taskScheduleSummary(task),
    taskLastRunText(task),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesAutomationFilter(task: ScheduledTaskSummary, filter: AutomationFilter, nowMs: number) {
  switch (filter) {
    case 'all':
      return true;
    case 'current':
      return !isPastDueOneTimeTask(task, nowMs);
    case 'past-due':
      return isPastDueOneTimeTask(task, nowMs);
    case 'failed':
      return isFailedTask(task);
    case 'disabled':
      return task.enabled === false;
    default:
      return true;
  }
}

function numberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function readAutomationPolicies(input: unknown, catchUpWindowSeconds: string): AutomationPolicy[] {
  if (Array.isArray(input)) {
    return input
      .map((policy): AutomationPolicy | null => {
        if (!policy || typeof policy !== 'object') return null;
        const record = policy as Record<string, unknown>;
        if (record.kind === 'catch_up') {
          const windowSeconds =
            typeof record.windowSeconds === 'number' && Number.isFinite(record.windowSeconds) ? record.windowSeconds : 900;
          return { kind: 'catch_up', enabled: record.enabled !== false, windowSeconds, mode: 'latest' };
        }
        if (record.kind === 'overlap') {
          return { kind: 'overlap', enabled: record.enabled !== false, behavior: 'skip' };
        }
        if (record.kind === 'once_per_period') {
          return {
            kind: 'once_per_period',
            enabled: record.enabled !== false,
            count: typeof record.count === 'number' ? record.count : 1,
            period: record.period === 'week' || record.period === 'month' ? record.period : 'day',
            timezone: typeof record.timezone === 'string' ? record.timezone : 'local',
          };
        }
        if (record.kind === 'flexible_timing') {
          return {
            kind: 'flexible_timing',
            enabled: record.enabled !== false,
            startTime: typeof record.startTime === 'string' ? record.startTime : '09:00',
            endTime: typeof record.endTime === 'string' ? record.endTime : '18:00',
            placement: record.placement === 'earliest' || record.placement === 'randomized' ? record.placement : 'automatic',
          };
        }
        return null;
      })
      .filter((policy): policy is AutomationPolicy => Boolean(policy));
  }
  return [
    { kind: 'catch_up', enabled: true, windowSeconds: Number(catchUpWindowSeconds) || 900, mode: 'latest' },
    { kind: 'overlap', enabled: true, behavior: 'skip' },
  ];
}

function syncLegacyCatchUpPolicy(policies: AutomationPolicy[], catchUpWindowSeconds: string): AutomationPolicy[] {
  const seconds = Number(catchUpWindowSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return policies.filter((policy) => policy.kind !== 'catch_up');
  const next = policies.filter((policy) => policy.kind !== 'catch_up');
  next.push({ kind: 'catch_up', enabled: true, windowSeconds: Math.floor(seconds), mode: 'latest' });
  return next;
}

function normalizeThreadModeForTarget(targetType: 'background-agent' | 'conversation', threadMode: 'dedicated' | 'existing' | 'none') {
  return targetType === 'conversation' && threadMode === 'none' ? 'dedicated' : threadMode;
}

function formFromTask(task: AutomationTaskForEditor): AutomationFormState {
  const targetType = task.targetType === 'conversation' ? 'conversation' : 'background-agent';
  const threadMode = normalizeThreadModeForTarget(targetType, task.threadMode ?? 'dedicated');
  const cron = task.cron || (task.at ? '' : '0 9 * * 1-5');
  return {
    title: task.title || '',
    prompt: task.prompt || '',
    scheduleType: task.at ? 'at' : 'cron',
    cron,
    scheduleBuilder: easyScheduleFromCron(cron) ?? emptyForm.scheduleBuilder,
    at: task.at || '',
    cwd: task.cwd || '',
    targetType,
    threadMode,
    threadConversationId: task.threadConversationId || '',
    model: task.model || '',
    thinkingLevel: task.thinkingLevel || '',
    timeoutSeconds: task.timeoutSeconds ? String(task.timeoutSeconds) : '',
    catchUpWindowSeconds: task.catchUpWindowSeconds ? String(task.catchUpWindowSeconds) : '',
    policies: readAutomationPolicies(
      task.policies,
      task.catchUpWindowSeconds ? String(task.catchUpWindowSeconds) : DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS,
    ),
    enabled: task.enabled !== false,
  };
}

function readFormInput(form: AutomationFormState) {
  const threadMode = normalizeThreadModeForTarget(form.targetType, form.threadMode);
  const cron = form.scheduleType === 'cron' ? form.cron.trim() || buildCronFromEasySchedule(form.scheduleBuilder) : null;
  return {
    title: form.title.trim(),
    enabled: form.enabled,
    prompt: form.prompt.trim(),
    cron,
    at: form.scheduleType === 'at' ? form.at.trim() : null,
    cwd: form.cwd.trim() || null,
    targetType: form.targetType,
    threadMode,
    threadConversationId: form.threadConversationId.trim() || null,
    model: form.model.trim() || null,
    thinkingLevel: form.thinkingLevel.trim() || null,
    timeoutSeconds: numberOrNull(form.timeoutSeconds),
    catchUpWindowSeconds: numberOrNull(form.catchUpWindowSeconds),
    policies: syncLegacyCatchUpPolicy(form.policies, form.catchUpWindowSeconds),
  };
}

function schedulerHealthLabel(health: ScheduledTaskSchedulerHealth | null) {
  if (!health?.lastEvaluatedAt) {
    return 'Scheduler has not checked automations yet.';
  }
  return health.status === 'stale'
    ? `Scheduler stale. Last checked ${timeAgo(health.lastEvaluatedAt)}.`
    : `Scheduler healthy. Last checked ${timeAgo(health.lastEvaluatedAt)}.`;
}

function SchedulerHealthDot({ health }: { health: ScheduledTaskSchedulerHealth | null }) {
  const label = schedulerHealthLabel(health);
  const statusClass = health?.status === 'stale' ? 'bg-warning' : health?.status === 'healthy' ? 'bg-success' : 'bg-dim';
  return (
    <span
      tabIndex={0}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary outline-none transition-colors hover:bg-elevated focus:bg-elevated"
    >
      <span className={cx('h-2.5 w-2.5 rounded-full', statusClass)} />
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-[12px] text-secondary">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-dim">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-5 text-dim">{hint}</span> : null}
    </label>
  );
}

function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: EditorSectionId;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-8 gap-5 border-t border-border-subtle/70 py-6 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <h3 className="text-[18px] font-semibold leading-tight text-primary">{title}</h3>
        <p className="text-[12px] leading-5 text-secondary">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function fieldClass() {
  return 'w-full border-0 border-b border-border-subtle/80 bg-transparent px-1 py-1.5 text-[13px] text-primary shadow-none outline-none transition-colors placeholder:text-dim hover:border-border-default focus:border-accent';
}

function schedulePreview(form: AutomationFormState) {
  if (form.scheduleType === 'at') {
    return form.at.trim() ? `Runs once at ${form.at.trim()}.` : 'Runs once at the selected time.';
  }
  const cron = form.cron.trim();
  const preset = CRON_PRESETS.find((candidate) => candidate.cron === cron);
  if (preset) return preset.preview;
  const builder = easyScheduleFromCron(cron);
  if (builder) return scheduleBuilderPreview(builder);
  return cron ? 'Uses a custom saved schedule.' : 'Choose a recurring schedule.';
}

function buildCreateWithChatPrompt(form: AutomationFormState) {
  const input = readFormInput(form);
  const lines = [
    'Use the scheduled-tasks skill to create this automation with the scheduled_task tool. Validate the schedule and ask me only if required information is missing.',
    '',
    `Title: ${input.title || '<fill in a concise title>'}`,
    `Prompt: ${input.prompt || '<describe what should run>'}`,
    input.cron ? `Schedule: recurring cron ${input.cron}` : `Schedule: once at ${input.at || '<choose a time>'}`,
    `Target: ${input.targetType}`,
    `Thread mode: ${input.threadMode}`,
    input.threadConversationId ? `Existing thread id: ${input.threadConversationId}` : null,
    input.cwd ? `Working directory: ${input.cwd}` : null,
    input.model ? `Model: ${input.model}` : null,
    input.thinkingLevel ? `Thinking level: ${input.thinkingLevel}` : null,
    input.timeoutSeconds ? `Timeout seconds: ${input.timeoutSeconds}` : null,
    input.catchUpWindowSeconds && input.cron ? `Catch-up window seconds: ${input.catchUpWindowSeconds}` : null,
    input.policies.length > 0 ? `Policies: ${JSON.stringify(input.policies)}` : null,
    `Enabled: ${input.enabled ? 'true' : 'false'}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="13" cy="8" r="1.2" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 4h6v6" />
      <path d="M12 4 5 11" />
      <path d="M3.5 6.5v6h6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3.5 11.8 4 9.5 10.8 2.7a1.4 1.4 0 0 1 2 2L6 11.5l-2.5.3Z" />
      <path d="M9.6 4 12 6.4" />
      <path d="M3 13h10" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M5 3.2v9.6L12.6 8 5 3.2Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12.5 7.5a4.5 4.5 0 1 1-1.2-3.1" />
      <path d="M10 2.8h3v3" />
    </svg>
  );
}

function TaskActionsMenu({
  task,
  busy,
  logOpen,
  onToggleLog,
  onDelete,
}: {
  task: ScheduledTaskSummary;
  busy: boolean;
  logOpen: boolean;
  onToggleLog: () => void;
  onDelete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const positionMenu = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleReposition() {
      positionMenu();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, positionMenu]);

  const menuButtonClass =
    'w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-secondary hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={rootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <IconButton
        compact
        disabled={busy}
        title={`More actions for ${taskName(task)}`}
        aria-label={`More actions for ${taskName(task)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreIcon />
      </IconButton>
      {open ? (
        <div
          className="fixed z-50 w-40 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl"
          role="menu"
          style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
        >
          <button
            type="button"
            className={menuButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onToggleLog();
            }}
          >
            {logOpen ? 'Hide log' : 'Show log'}
          </button>
          <button
            type="button"
            className={cx(menuButtonClass, 'text-danger hover:text-danger')}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AutomationTable({
  tasks,
  logById,
  busy,
  nowMs,
  onRunTask,
  onOpenEditor,
  onToggleLog,
  onDeleteTask,
}: {
  tasks: ScheduledTaskSummary[];
  logById: Record<string, string>;
  busy: string | null;
  nowMs: number;
  onRunTask: (taskId: string) => void;
  onOpenEditor: (task: ScheduledTaskSummary) => void;
  onToggleLog: (taskId: string) => void;
  onDeleteTask: (task: ScheduledTaskSummary) => void;
}) {
  return (
    <section className="min-w-0 overflow-x-auto overflow-y-visible">
      <table className="w-full min-w-[54rem] table-fixed border-collapse text-left text-[13px]">
        <colgroup>
          <col className="w-[46%]" />
          <col className="w-[22%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="py-2 px-3 font-semibold">Schedule</th>
            <th className="py-2 px-3 font-semibold">Status</th>
            <th className="py-2 pl-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const scope = taskScopeText(task);
            const taskBusy = busy === `run:${task.id}` || busy === `delete:${task.id}`;
            return (
              <Fragment key={task.id}>
                <tr className="group border-t border-border-subtle/70 transition-colors hover:bg-surface/30">
                  <td className="min-w-0 py-3 pr-4 align-middle">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full border', statusClass(task, nowMs))} />
                        <div className="truncate text-[14px] font-semibold text-primary">{taskName(task)}</div>
                      </div>
                      <div className="mt-0.5 max-w-[44rem] whitespace-normal break-words text-[12px] leading-5 text-secondary">
                        {task.prompt || 'No prompt summary.'}
                      </div>
                      <div className="mt-1 text-[11px] text-dim">
                        {task.id} · {taskTargetLabel(task)}
                        {scope ? ` · ${scope}` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="text-[13px] text-primary">{taskScheduleSummary(task)}</div>
                    <div className="mt-0.5 break-all font-mono text-[11px] text-dim">{task.cron ?? task.at ?? 'Manual'}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-middle">
                    <div className={cx('text-[12px]', statusTextClass(task, nowMs))}>{statusText(task, nowMs)}</div>
                    <div className="mt-0.5 text-[12px] text-secondary">{taskLastRunText(task, nowMs)}</div>
                  </td>
                  <td className="py-3 pl-3 align-middle">
                    <div className="flex items-center justify-end gap-1.5">
                      {taskBusy ? <span className="text-[11px] text-dim">Working…</span> : null}
                      {task.threadConversationId ? (
                        <a
                          className="ui-icon-button ui-icon-button-compact"
                          href={`/conversations/${encodeURIComponent(task.threadConversationId)}`}
                          title={`Open thread for ${taskName(task)}`}
                          aria-label={`Open thread for ${taskName(task)}`}
                        >
                          <OpenIcon />
                        </a>
                      ) : null}
                      <IconButton
                        compact
                        disabled={taskBusy}
                        title={`Run ${taskName(task)} now`}
                        aria-label={`Run ${taskName(task)} now`}
                        onClick={() => onRunTask(task.id)}
                      >
                        <RunIcon />
                      </IconButton>
                      <IconButton
                        compact
                        disabled={taskBusy}
                        title={`Edit ${taskName(task)}`}
                        aria-label={`Edit ${taskName(task)}`}
                        onClick={() => onOpenEditor(task)}
                      >
                        <EditIcon />
                      </IconButton>
                      <TaskActionsMenu
                        task={task}
                        busy={taskBusy}
                        logOpen={Boolean(logById[task.id])}
                        onToggleLog={() => onToggleLog(task.id)}
                        onDelete={() => onDeleteTask(task)}
                      />
                    </div>
                  </td>
                </tr>
                {logById[task.id] ? (
                  <tr className="border-t border-border-subtle/40 bg-surface/20">
                    <td colSpan={4} className="px-4 py-3">
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-l-2 border-border-subtle pl-3 text-[12px] leading-5 text-secondary">
                        {logById[task.id]}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function SectionHeader({ title, count, tone = 'default' }: { title: string; count: string; tone?: 'default' | 'warning' }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-[18px] font-semibold tracking-tight text-primary">{title}</h2>
      <span className={cx('text-[12px]', tone === 'warning' ? 'text-warning' : 'text-dim')}>{count}</span>
    </div>
  );
}

function PolicyRuleRow({
  policy,
  index,
  onChange,
  onRemove,
}: {
  policy: AutomationPolicy;
  index: number;
  onChange: (index: number, patch: Partial<AutomationPolicy>) => void;
  onRemove: (index: number) => void;
}) {
  const inlineField =
    'h-7 border-0 border-b border-accent/25 bg-transparent px-1 text-[13px] text-primary outline-none hover:border-accent/60 focus:border-accent';
  return (
    <div className="group flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 text-[13px] text-secondary hover:border-border-subtle/70 hover:bg-surface/25">
      <span className="w-5 text-center text-dim">⋮⋮</span>
      {policy.kind === 'once_per_period' ? (
        <>
          <span className="font-medium text-primary">Run at most</span>
          <input
            className={cx(inlineField, 'w-12 text-center')}
            type="number"
            min="1"
            value={policy.count}
            onChange={(event) => onChange(index, { count: Number.parseInt(event.target.value || '1', 10) || 1 })}
          />
          <span>time per</span>
          <select
            className={inlineField}
            value={policy.period}
            onChange={(event) => onChange(index, { period: event.target.value as 'day' | 'week' | 'month' })}
          >
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </>
      ) : policy.kind === 'flexible_timing' ? (
        <>
          <span className="font-medium text-primary">Run anytime between</span>
          <input
            className={cx(inlineField, 'w-20')}
            type="time"
            value={policy.startTime ?? '09:00'}
            onChange={(event) => onChange(index, { startTime: event.target.value })}
          />
          <span>and</span>
          <input
            className={cx(inlineField, 'w-20')}
            type="time"
            value={policy.endTime ?? '18:00'}
            onChange={(event) => onChange(index, { endTime: event.target.value })}
          />
        </>
      ) : policy.kind === 'catch_up' ? (
        <>
          <span className="font-medium text-primary">Catch up missed runs for</span>
          <input
            className={cx(inlineField, 'w-16 text-center')}
            type="number"
            min="1"
            value={policy.windowSeconds}
            onChange={(event) => onChange(index, { windowSeconds: Number.parseInt(event.target.value || '1', 10) || 1 })}
          />
          <span>seconds</span>
        </>
      ) : (
        <>
          <span className="font-medium text-primary">If a run is already active</span>
          <select className={inlineField} value={policy.behavior} onChange={() => onChange(index, { behavior: 'skip' })}>
            <option value="skip">skip the new run</option>
          </select>
        </>
      )}
      <button
        type="button"
        className="ml-auto h-7 w-7 rounded-md text-dim opacity-0 transition-opacity hover:bg-elevated hover:text-primary group-hover:opacity-100"
        aria-label="Remove policy"
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </div>
  );
}

export function AutomationsPage({ pa }: { pa: NativeExtensionClient }) {
  const [tasks, setTasks] = useState<ScheduledTaskSummary[]>([]);
  const [health, setHealth] = useState<ScheduledTaskSchedulerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<AutomationFormState>(emptyForm);
  const [logById, setLogById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<AutomationFilter>('all');
  const [query, setQuery] = useState('');
  const [activeEditorSection, setActiveEditorSection] = useState<EditorSectionId>('automation-general');
  const [conversationOptions, setConversationOptions] = useState<ConversationOption[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);

  const load = useCallback(async () => {
    setError(null);
    const extensionClient = pa as NativeExtensionClient & {
      conversations?: { list(): Promise<unknown> };
      models?: () => Promise<unknown>;
    };
    const [nextTasks, nextHealth, nextConversations, nextModels] = await Promise.all([
      pa.automations.list(),
      pa.automations.readSchedulerHealth(),
      extensionClient.conversations?.list?.() ?? Promise.resolve([]),
      extensionClient.models?.() ?? Promise.resolve({ models: [] }),
    ]);
    setTasks(sortTasks(Array.isArray(nextTasks) ? nextTasks : []));
    setHealth(nextHealth as ScheduledTaskSchedulerHealth);
    setConversationOptions(readConversationOptions(nextConversations));
    setModelOptions(readModelOptions(nextModels));
    setLoading(false);
  }, [pa]);

  useEffect(() => {
    void load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
      pa.ui.notify({ type: 'error', message: `Failed to load automations: ${err.message}`, source: 'system-automations' });
    });
  }, [load, pa]);

  const reload = useCallback(async () => {
    setBusy('reload');
    setNotice(null);
    try {
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pa.ui.notify({ type: 'error', message: `Failed to reload automations: ${msg}`, source: 'system-automations' });
    } finally {
      setBusy(null);
    }
  }, [load, pa]);

  const openEditor = useCallback((task?: ScheduledTaskSummary) => {
    setEditingId(task?.id ?? null);
    setEditorOpen(true);
    setForm(task ? formFromTask(task) : { ...emptyForm });
    setNotice(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingId(null);
    setEditorOpen(false);
    setForm(emptyForm);
  }, []);

  const createWithChat = useCallback(async () => {
    const prompt = buildCreateWithChatPrompt(form);
    const opened = await pa.commands.execute('conversation.newAndFocus', {
      initialComposerText: prompt,
      cwd: form.cwd.trim() || undefined,
    });
    if (opened) {
      closeEditor();
      return;
    }
    pa.ui.notify({ type: 'error', message: 'Could not open chat for automation creation.', source: 'system-automations' });
  }, [closeEditor, form, pa]);

  const save = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy('save');
      try {
        if (editingId) {
          await pa.automations.update(editingId, readFormInput(form));
          setNotice('Automation updated.');
        } else {
          await pa.automations.create(readFormInput(form));
          setNotice('Automation created.');
        }
        closeEditor();
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to save automation: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [closeEditor, editingId, form, load, pa],
  );

  const runTask = useCallback(
    async (taskId: string) => {
      setBusy(`run:${taskId}`);
      try {
        await pa.automations.run(taskId);
        setNotice('Automation run started.');
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to run automation: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [load, pa],
  );

  const pickCwd = useCallback(async () => {
    try {
      const result = await (
        pa as NativeExtensionClient & { pickFolder?: (input?: { cwd?: string | null; prompt?: string | null }) => Promise<unknown> }
      ).pickFolder?.({
        cwd: form.cwd || null,
        prompt: 'Choose automation working directory',
      });
      const path = readPickedFolderPath(result);
      if (path) {
        setForm((current) => ({ ...current, cwd: path }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pa.ui.notify({ type: 'error', message: `Could not choose working directory: ${msg}`, source: 'system-automations' });
    }
  }, [form.cwd, pa]);

  const updateScheduleBuilder = useCallback((patch: Partial<EasySchedule>) => {
    setForm((current) => {
      const scheduleBuilder = { ...current.scheduleBuilder, ...patch };
      return {
        ...current,
        scheduleBuilder,
        cron: buildCronFromEasySchedule(scheduleBuilder),
      };
    });
  }, []);

  const toggleScheduleWeekday = useCallback((day: number) => {
    setForm((current) => {
      const weekdays = current.scheduleBuilder.weekdays.includes(day)
        ? current.scheduleBuilder.weekdays.length > 1
          ? current.scheduleBuilder.weekdays.filter((entry) => entry !== day)
          : current.scheduleBuilder.weekdays
        : [...current.scheduleBuilder.weekdays, day].sort((left, right) => left - right);
      const scheduleBuilder = { ...current.scheduleBuilder, weekdays };
      return {
        ...current,
        scheduleBuilder,
        cron: buildCronFromEasySchedule(scheduleBuilder),
      };
    });
  }, []);

  const updatePolicy = useCallback((index: number, patch: Partial<AutomationPolicy>) => {
    setForm((current) => ({
      ...current,
      policies: current.policies.map((policy, policyIndex) =>
        policyIndex === index ? ({ ...policy, ...patch } as AutomationPolicy) : policy,
      ),
    }));
  }, []);

  const removePolicy = useCallback((index: number) => {
    setForm((current) => ({ ...current, policies: current.policies.filter((_, policyIndex) => policyIndex !== index) }));
  }, []);

  const addPolicy = useCallback((kind: AutomationPolicy['kind']) => {
    setForm((current) => {
      const policy: AutomationPolicy =
        kind === 'once_per_period'
          ? { kind, enabled: true, count: 1, period: 'day', timezone: 'local' }
          : kind === 'flexible_timing'
            ? { kind, enabled: true, startTime: '09:00', endTime: '18:00', placement: 'automatic' }
            : kind === 'catch_up'
              ? { kind, enabled: true, windowSeconds: Number(current.catchUpWindowSeconds) || 900, mode: 'latest' }
              : { kind, enabled: true, behavior: 'skip' };
      return { ...current, policies: [...current.policies, policy] };
    });
  }, []);

  const deleteTask = useCallback(
    async (task: Pick<ScheduledTaskSummary, 'id' | 'title'>) => {
      const confirmed = await pa.ui.confirm({
        title: 'Delete automation',
        message: `Delete ${taskName(task)}? This cannot be undone.`,
      });
      if (!confirmed) return;

      setBusy(`delete:${task.id}`);
      try {
        await pa.automations.delete(task.id);
        setNotice('Automation deleted.');
        if (editingId === task.id) {
          closeEditor();
        }
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to delete automation: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [closeEditor, editingId, load, pa],
  );

  const toggleLog = useCallback(
    async (taskId: string) => {
      if (logById[taskId]) {
        setLogById((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        return;
      }
      setLogById((prev) => ({ ...prev, [taskId]: 'Loading log…' }));
      try {
        const result = (await pa.automations.readLog(taskId)) as { log?: string };
        setLogById((prev) => ({ ...prev, [taskId]: truncateLogForRender(result.log) }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLogById((prev) => ({
          ...prev,
          [taskId]: message.includes('No log available') ? 'No log yet.' : `Could not read log: ${message}`,
        }));
      }
    },
    [logById, pa],
  );

  const enabledCount = useMemo(() => tasks.filter((task) => task.enabled !== false).length, [tasks]);
  const enabledLabel = useMemo(() => (enabledCount === 1 ? '1 enabled' : `${enabledCount} enabled`), [enabledCount]);
  const countLabel = useMemo(() => (tasks.length === 1 ? '1 automation' : `${tasks.length} automations`), [tasks.length]);
  const nowMs = Date.now();
  const allPastDueTasks = useMemo(() => sortPastDueTasks(tasks.filter((task) => isPastDueOneTimeTask(task, nowMs))), [tasks, nowMs]);
  const pastDueLabel = allPastDueTasks.length === 1 ? '1 past due' : `${allPastDueTasks.length} past due`;

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!matchesAutomationFilter(task, filter, nowMs)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return taskSearchText(task).includes(normalizedQuery);
    });
  }, [filter, nowMs, query, tasks]);

  const visibleCurrentTasks = useMemo(() => filteredTasks.filter((task) => !isPastDueOneTimeTask(task, nowMs)), [filteredTasks, nowMs]);
  const visiblePastDueTasks = useMemo(
    () => sortPastDueTasks(filteredTasks.filter((task) => isPastDueOneTimeTask(task, nowMs))),
    [filteredTasks, nowMs],
  );
  const shouldSplitSections = filter === 'all';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <LoadingState label="Loading automations…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        {!editorOpen && (
          <>
            <AppPageIntro
              title="Automations"
              summary={
                <>
                  Scheduled prompts and background jobs that run without babysitting. {enabledLabel} · {countLabel}
                  {allPastDueTasks.length > 0 ? ` · ${pastDueLabel}` : ''}
                </>
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <ToolbarButton onClick={() => openEditor()}>New automation</ToolbarButton>
                  <IconButton title="Reload automations" aria-label="Reload automations" onClick={() => void reload()}>
                    <RefreshIcon />
                  </IconButton>
                  <SchedulerHealthDot health={health} />
                </div>
              }
            />

            {notice ? <div className="rounded-lg bg-surface/35 px-3 py-2 text-[13px] text-secondary">{notice}</div> : null}
          </>
        )}

        {editorOpen && (
          <form
            onSubmit={(event) => {
              if (editingId) {
                void save(event);
                return;
              }
              event.preventDefault();
              void createWithChat();
            }}
          >
            <AppPageLayout
              shellClassName="max-w-[72rem]"
              contentClassName="space-y-0"
              aside={
                <AppPageToc
                  items={EDITOR_TOC_ITEMS}
                  activeId={activeEditorSection}
                  onNavigate={(sectionId) => {
                    setActiveEditorSection(sectionId);
                    document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                />
              }
            >
              <div className="flex items-start justify-between gap-4 pb-10">
                <div className="min-w-0">
                  <button type="button" className="text-[13px] text-secondary hover:text-primary" onClick={closeEditor}>
                    ← Automations
                  </button>
                  <h2 className="mt-6 text-[32px] font-semibold leading-[1.05] tracking-[-0.025em] text-primary">
                    {editingId ? 'Edit automation' : 'New automation'}
                  </h2>
                  <p className="mt-2 text-[13px] text-secondary">
                    Define what the agent should do, when it should run, and where results should appear.
                  </p>
                </div>
                {editingId ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <ToolbarButton type="submit" disabled={busy === 'save'}>
                      {busy === 'save' ? 'Saving…' : 'Save changes'}
                    </ToolbarButton>
                  </div>
                ) : (
                  <ToolbarButton type="button" onClick={() => void createWithChat()}>
                    Create with chat
                  </ToolbarButton>
                )}
              </div>

              <FormSection
                id="automation-general"
                title="General"
                description="Name the automation and give the agent its recurring instruction."
              >
                <div className="grid gap-4">
                  <Field label="Name">
                    <input
                      className={fieldClass()}
                      required
                      autoComplete="off"
                      name="automation-title"
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                    />
                  </Field>
                  <Field label="Instruction" hint="This prompt is sent each time the automation runs.">
                    <textarea
                      className={fieldClass()}
                      required
                      name="automation-prompt"
                      rows={7}
                      value={form.prompt}
                      onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-[13px] text-secondary">
                    <input
                      className="h-4 w-4 rounded border-border-default bg-base text-accent focus:outline-none"
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
              </FormSection>

              <FormSection
                id="automation-schedule"
                title="Schedule"
                description="Choose a human-readable schedule. The app handles the scheduler syntax."
              >
                <div className="grid gap-4">
                  <div className="inline-flex w-fit rounded-md border border-border-subtle bg-elevated p-1">
                    <button
                      type="button"
                      className={cx(
                        'rounded-md px-3 py-1.5 text-[12px]',
                        form.scheduleType === 'cron'
                          ? 'bg-accent/10 text-accent ring-1 ring-accent/25'
                          : 'text-secondary hover:text-primary',
                      )}
                      onClick={() => {
                        const scheduleBuilder = form.cron
                          ? (easyScheduleFromCron(form.cron) ?? form.scheduleBuilder)
                          : form.scheduleBuilder;
                        setForm({
                          ...form,
                          scheduleType: 'cron',
                          scheduleBuilder,
                          cron: form.cron || buildCronFromEasySchedule(scheduleBuilder),
                        });
                      }}
                    >
                      Recurring
                    </button>
                    <button
                      type="button"
                      className={cx(
                        'rounded-md px-3 py-1.5 text-[12px]',
                        form.scheduleType === 'at' ? 'bg-accent/10 text-accent ring-1 ring-accent/25' : 'text-secondary hover:text-primary',
                      )}
                      onClick={() => setForm({ ...form, scheduleType: 'at' })}
                    >
                      Once
                    </button>
                  </div>

                  {form.scheduleType === 'cron' ? (
                    <div className="grid gap-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <Field label="Schedule">
                          <select
                            className={fieldClass()}
                            name="automation-recurring-cadence"
                            value={form.scheduleBuilder.cadence}
                            onChange={(event) => updateScheduleBuilder({ cadence: event.target.value as EasyCadence })}
                          >
                            <option value="hourly">Hourly</option>
                            <option value="interval">Every few hours</option>
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekly">Specific weekdays</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </Field>

                        {form.scheduleBuilder.cadence === 'hourly' || form.scheduleBuilder.cadence === 'interval' ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {form.scheduleBuilder.cadence === 'interval' ? (
                              <Field label="Every">
                                <input
                                  className={fieldClass()}
                                  type="number"
                                  min="1"
                                  max="23"
                                  inputMode="numeric"
                                  name="automation-recurring-interval"
                                  value={form.scheduleBuilder.intervalHours}
                                  onChange={(event) =>
                                    updateScheduleBuilder({ intervalHours: Number.parseInt(event.target.value || '1', 10) || 1 })
                                  }
                                />
                              </Field>
                            ) : null}
                            <Field label="Minute">
                              <input
                                className={fieldClass()}
                                type="number"
                                min="0"
                                max="59"
                                inputMode="numeric"
                                name="automation-recurring-minute"
                                value={form.scheduleBuilder.minute}
                                onChange={(event) => updateScheduleBuilder({ minute: Number.parseInt(event.target.value || '0', 10) || 0 })}
                              />
                            </Field>
                          </div>
                        ) : (
                          <Field label="Time">
                            <input
                              className={fieldClass()}
                              type="time"
                              name="automation-recurring-time"
                              value={formatTimeValue(form.scheduleBuilder)}
                              onChange={(event) => {
                                const parsed = parseTimeValue(event.target.value);
                                if (parsed) updateScheduleBuilder(parsed);
                              }}
                            />
                          </Field>
                        )}

                        {form.scheduleBuilder.cadence === 'weekly' ? (
                          <div className="flex flex-wrap gap-2 md:col-span-2">
                            {WEEKDAY_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={cx(
                                  'rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                                  form.scheduleBuilder.weekdays.includes(option.value)
                                    ? 'border-accent/45 bg-accent/10 text-primary'
                                    : 'border-border-subtle/70 bg-transparent text-secondary hover:text-primary',
                                )}
                                aria-pressed={form.scheduleBuilder.weekdays.includes(option.value)}
                                onClick={() => toggleScheduleWeekday(option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {form.scheduleBuilder.cadence === 'monthly' ? (
                          <Field label="Day of month">
                            <input
                              className={fieldClass()}
                              type="number"
                              min="1"
                              max="31"
                              inputMode="numeric"
                              name="automation-recurring-day-of-month"
                              value={form.scheduleBuilder.dayOfMonth}
                              onChange={(event) =>
                                updateScheduleBuilder({ dayOfMonth: Number.parseInt(event.target.value || '1', 10) || 1 })
                              }
                            />
                          </Field>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {form.cron && !CRON_PRESETS.some((preset) => preset.cron === form.cron) && !easyScheduleFromCron(form.cron) ? (
                          <button
                            type="button"
                            className="rounded-md border border-accent/45 bg-accent/10 px-3 py-3 text-left text-accent transition-colors"
                            onClick={() => setForm({ ...form, cron: form.cron })}
                          >
                            <span className="block text-[13px] font-semibold">Custom saved schedule</span>
                            <span className="mt-0.5 block text-[11px] text-dim">Keep this existing schedule</span>
                          </button>
                        ) : null}
                        {CRON_PRESETS.map((preset) => (
                          <button
                            key={preset.cron}
                            type="button"
                            className={cx(
                              'rounded-md border px-3 py-3 text-left transition-colors',
                              form.cron === preset.cron
                                ? 'border-accent/45 bg-accent/10 text-primary shadow-[0_0_0_1px_rgb(var(--color-accent)/0.18)]'
                                : 'border-border-subtle/70 bg-transparent text-secondary hover:border-border-default hover:bg-surface/20 hover:text-primary',
                            )}
                            onClick={() =>
                              setForm({
                                ...form,
                                cron: preset.cron,
                                scheduleBuilder: easyScheduleFromCron(preset.cron) ?? form.scheduleBuilder,
                              })
                            }
                          >
                            <span className="block text-[13px] font-semibold">{preset.label}</span>
                            <span className="mt-0.5 block text-[11px] text-dim">{preset.summary}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Field label="Run at" hint="ISO timestamp or natural phrase, depending on backend support.">
                      <input
                        className={fieldClass()}
                        autoComplete="off"
                        name="automation-at"
                        placeholder="tomorrow 8pm"
                        value={form.at}
                        onChange={(event) => setForm({ ...form, at: event.target.value })}
                      />
                    </Field>
                  )}

                  <div className="flex items-center gap-2 border-t border-border-subtle/70 pt-3 text-[13px] leading-6 text-secondary">
                    <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--color-accent)/0.7)]" />
                    <span className="font-medium text-primary">{schedulePreview(form)}</span>
                  </div>
                </div>
              </FormSection>

              <FormSection
                id="automation-policies"
                title="Policies"
                description="Attach first-party rules that decide what happens to each eligible run."
              >
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    {form.policies.map((policy, index) => (
                      <PolicyRuleRow
                        key={`${policy.kind}:${index}`}
                        policy={policy}
                        index={index}
                        onChange={updatePolicy}
                        onRemove={removePolicy}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ToolbarButton type="button" onClick={() => addPolicy('once_per_period')}>
                      + Once per period
                    </ToolbarButton>
                    <ToolbarButton type="button" onClick={() => addPolicy('catch_up')}>
                      + Catch up
                    </ToolbarButton>
                    <ToolbarButton type="button" onClick={() => addPolicy('overlap')}>
                      + Overlap
                    </ToolbarButton>
                  </div>
                </div>
              </FormSection>

              <FormSection id="automation-delivery" title="Delivery" description="Choose how visible the run should be when it completes.">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Results">
                      <select
                        className={fieldClass()}
                        name="automation-target"
                        value={form.targetType}
                        onChange={(event) => {
                          const targetType = event.target.value as 'background-agent' | 'conversation';
                          setForm({ ...form, targetType, threadMode: normalizeThreadModeForTarget(targetType, form.threadMode) });
                        }}
                      >
                        <option value="background-agent">Background job</option>
                        <option value="conversation">Conversation</option>
                      </select>
                    </Field>
                    <Field label="Thread mode">
                      <select
                        className={fieldClass()}
                        name="automation-thread-mode"
                        value={form.threadMode}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            threadMode: normalizeThreadModeForTarget(
                              form.targetType,
                              event.target.value as 'dedicated' | 'existing' | 'none',
                            ),
                          })
                        }
                      >
                        <option value="dedicated">Dedicated thread</option>
                        <option value="existing">Existing thread</option>
                        {form.targetType === 'background-agent' ? <option value="none">No thread</option> : null}
                      </select>
                    </Field>
                  </div>
                  {form.threadMode === 'existing' ? (
                    <Field
                      label="Thread"
                      hint={
                        conversationOptions.length === 0
                          ? 'No saved threads found yet.'
                          : 'Choose the conversation that should receive automation results.'
                      }
                    >
                      <select
                        className={fieldClass()}
                        name="automation-thread-conversation-id"
                        required
                        value={form.threadConversationId}
                        onChange={(event) => setForm({ ...form, threadConversationId: event.target.value })}
                      >
                        <option value="">Choose thread</option>
                        {form.threadConversationId && !conversationOptions.some((option) => option.id === form.threadConversationId) ? (
                          <option value={form.threadConversationId}>Current saved thread</option>
                        ) : null}
                        {conversationOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.cwd ? `${option.title} · ${option.cwd}` : option.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <div className="border-t border-border-subtle/70 pt-3 text-[12px] text-secondary">
                    <div className="flex justify-between gap-4 border-b border-border-subtle/70 pb-2">
                      <span className="text-dim">Run target</span>
                      <span className="text-primary">{form.targetType === 'conversation' ? 'Conversation' : 'Background agent'}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-2">
                      <span className="text-dim">Thread binding</span>
                      <span className="text-primary">
                        {form.threadMode === 'dedicated' ? 'Dedicated thread' : form.threadMode === 'existing' ? 'Existing thread' : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection
                id="automation-runtime"
                title="Runtime"
                description="Defaults are usually right. Change these only when the automation needs a specific workspace or model."
              >
                <div className="grid gap-4">
                  <Field label="Working directory" hint="Leave blank to use the current runtime cwd.">
                    <div className="flex gap-2">
                      <input
                        className={fieldClass()}
                        autoComplete="off"
                        name="automation-cwd"
                        placeholder="~/workingdir/repo"
                        value={form.cwd}
                        onChange={(event) => setForm({ ...form, cwd: event.target.value })}
                      />
                      <ToolbarButton type="button" className="shrink-0" onClick={() => void pickCwd()}>
                        Choose…
                      </ToolbarButton>
                    </div>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Model">
                      <select
                        className={fieldClass()}
                        name="automation-model"
                        value={form.model}
                        onChange={(event) => setForm({ ...form, model: event.target.value })}
                      >
                        <option value="">Default model</option>
                        {form.model && !modelOptions.some((option) => option.id === form.model) ? (
                          <option value={form.model}>Current saved model</option>
                        ) : null}
                        {modelOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.provider ? `${option.name} · ${option.provider}` : option.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Thinking level">
                      <select
                        className={fieldClass()}
                        name="automation-thinking-level"
                        value={form.thinkingLevel}
                        onChange={(event) => setForm({ ...form, thinkingLevel: event.target.value })}
                      >
                        {THINKING_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value || 'default'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Timeout seconds">
                      <input
                        className={fieldClass()}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        name="automation-timeout-seconds"
                        placeholder="Default"
                        value={form.timeoutSeconds}
                        onChange={(event) => setForm({ ...form, timeoutSeconds: event.target.value })}
                      />
                    </Field>
                  </div>
                  {form.scheduleType === 'cron' ? (
                    <Field label="Catch-up window seconds" hint="How long a missed run remains eligible after wake.">
                      <input
                        className={fieldClass()}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        name="automation-catch-up-window-seconds"
                        placeholder="Default"
                        value={form.catchUpWindowSeconds}
                        onChange={(event) => setForm({ ...form, catchUpWindowSeconds: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </div>
              </FormSection>

              <div className="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-5">
                <div>
                  {editingId ? (
                    <ToolbarButton
                      type="button"
                      disabled={busy === `delete:${editingId}`}
                      onClick={() => void deleteTask({ id: editingId, title: form.title })}
                    >
                      Delete
                    </ToolbarButton>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingId ? (
                    <ToolbarButton type="submit" disabled={busy === 'save'}>
                      {busy === 'save' ? 'Saving…' : 'Save changes'}
                    </ToolbarButton>
                  ) : (
                    <ToolbarButton type="button" onClick={() => void createWithChat()}>
                      Create with chat
                    </ToolbarButton>
                  )}
                </div>
              </div>
            </AppPageLayout>
          </form>
        )}

        {!editorOpen && (
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <EmptyState
                title="No automations yet"
                body="Create one to run scheduled or conversation-bound agent work."
                className="py-10"
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1 rounded-xl bg-surface/40 p-1">
                    {(Object.keys(FILTER_LABELS) as AutomationFilter[]).map((nextFilter) => (
                      <button
                        key={nextFilter}
                        type="button"
                        className={cx(
                          'rounded-lg px-3 py-1.5 text-[12px] transition-colors',
                          filter === nextFilter ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
                        )}
                        onClick={() => setFilter(nextFilter)}
                      >
                        {FILTER_LABELS[nextFilter]}
                      </button>
                    ))}
                  </div>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search automations…"
                    className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
                  />
                </div>

                {filteredTasks.length === 0 ? (
                  <EmptyState title="No matching automations" body="Adjust the filter or search query." />
                ) : shouldSplitSections ? (
                  <div className="space-y-6">
                    {visibleCurrentTasks.length > 0 ? (
                      <AutomationTable
                        tasks={visibleCurrentTasks}
                        logById={logById}
                        busy={busy}
                        nowMs={nowMs}
                        onRunTask={(taskId) => void runTask(taskId)}
                        onOpenEditor={openEditor}
                        onToggleLog={(taskId) => void toggleLog(taskId)}
                        onDeleteTask={(task) => void deleteTask(task)}
                      />
                    ) : (
                      <div className="py-2 text-[13px] text-secondary">No current automations.</div>
                    )}

                    {visiblePastDueTasks.length > 0 ? (
                      <section className="space-y-3 border-t border-border-subtle/70 pt-4">
                        <SectionHeader title="Past due" count={`${visiblePastDueTasks.length} shown`} tone="warning" />
                        <AutomationTable
                          tasks={visiblePastDueTasks}
                          logById={logById}
                          busy={busy}
                          nowMs={nowMs}
                          onRunTask={(taskId) => void runTask(taskId)}
                          onOpenEditor={openEditor}
                          onToggleLog={(taskId) => void toggleLog(taskId)}
                          onDeleteTask={(task) => void deleteTask(task)}
                        />
                      </section>
                    ) : null}
                  </div>
                ) : (
                  <AutomationTable
                    tasks={filter === 'past-due' ? visiblePastDueTasks : filteredTasks}
                    logById={logById}
                    busy={busy}
                    nowMs={nowMs}
                    onRunTask={(taskId) => void runTask(taskId)}
                    onOpenEditor={openEditor}
                    onToggleLog={(taskId) => void toggleLog(taskId)}
                    onDeleteTask={(task) => void deleteTask(task)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </AppPageLayout>
    </div>
  );
}
