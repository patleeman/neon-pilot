import type { NativeExtensionClient } from '@neon-pilot/extensions';
import type { ScheduledTaskSchedulerHealth, ScheduledTaskSummary } from '@neon-pilot/extensions/data';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageLayout,
  AppPageToc,
  Button,
  cx,
  ErrorState,
  Field,
  IconButton,
  KeyValueTable,
  LoadingState,
  Notice,
  SearchInput,
  SegmentedControl,
  Select,
  SettingsSection,
  StatusDot,
  type StatusDotTone,
  Switch,
  Textarea,
  TextButton,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  | { kind: 'once_per_period'; enabled?: boolean; count: number; period: 'day' | 'week' | 'month'; timezone?: string };

type AutomationTaskForEditor = ScheduledTaskSummary & {
  threadMode?: 'dedicated' | 'existing' | 'none';
  timeoutSeconds?: number;
  policies?: AutomationPolicy[];
};

type EditorSectionId = 'automation-general' | 'automation-schedule' | 'automation-policies' | 'automation-delivery' | 'automation-runtime';
type AutomationsPageContext = { search?: string };
type ActivityStatusFilter = 'all' | 'done' | 'waiting' | 'failed' | 'off';
type ActivitySort = 'newest' | 'oldest' | 'event' | 'from' | 'used-by' | 'status';
type ActivityTone = 'success' | 'accent' | 'warning' | 'danger' | 'muted';
type ReactionKind = 'agent' | 'thread' | 'script' | 'event';

export interface AutomationActivityEvent {
  id: string;
  taskId?: string;
  replayMode: 'event-bus' | 'task-run';
  eventName: string;
  source: string;
  title: string;
  relativeTime: string;
  absoluteTime?: string;
  status: string;
  tone: ActivityTone;
  matches: number;
  reactionKind: ReactionKind;
  displayName: string;
  fromName: string;
  fromKind: string;
  fromConversationId?: string;
  fromSubscriptionId?: string;
  usedByNames: string[];
  usedByKinds: string[];
  primaryUsedByName: string;
  primaryUsedByKind: string;
  primaryUsedBySubscriptionId?: string;
  technicalName: string;
  payload?: Record<string, unknown>;
  reactionStatus: string;
  reactionMeta: string;
  matchingSubscriptionIds: string[];
}

interface EventBusReactionSummary {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  actionType: ReactionKind | 'run_task' | 'start_agent' | 'start_thread' | 'run_script' | 'publish_event';
  status: string;
  output?: Record<string, unknown>;
  error?: string;
}

interface EventBusEventSummary {
  id: string;
  type: string;
  source: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  recordedAt?: string;
  replayOfEventId?: string;
  reactions?: EventBusReactionSummary[];
}

type EventBusActionSummary =
  | { type: 'run_task'; taskId: string }
  | { type: 'start_agent'; prompt: string; cwd?: string; model?: string }
  | { type: 'start_thread'; prompt: string; conversationId?: string; cwd?: string; model?: string }
  | { type: 'run_script'; command: string; cwd?: string }
  | { type: 'publish_event'; eventType: string; payload?: Record<string, unknown>; recorded?: boolean };

interface EventBusSubscriptionSummary {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  action: EventBusActionSummary;
  maxReactionsPerMinute?: number;
  updatedAt?: string;
}

interface ActivityActorLookup {
  conversations: Map<string, ConversationOption>;
  subscriptions: Map<string, EventBusSubscriptionSummary>;
}

const EDITOR_TOC_ITEMS: Array<{ id: EditorSectionId; label: string; summary: string }> = [
  { id: 'automation-general', label: 'General', summary: 'Name and instruction' },
  { id: 'automation-schedule', label: 'Schedule', summary: 'When it runs' },
  { id: 'automation-policies', label: 'Run rules', summary: 'Missed and overlapping runs' },
  { id: 'automation-delivery', label: 'Delivery', summary: 'Where results go' },
  { id: 'automation-runtime', label: 'Execution defaults', summary: 'Model, folder, and timeout' },
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

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'cron', label: 'Recurring' },
  { value: 'at', label: 'Once' },
] as const;

const ACTIVITY_STATUS_FILTER_LABELS: Record<ActivityStatusFilter, string> = {
  all: 'All',
  done: 'Done',
  waiting: 'Waiting',
  failed: 'Failed',
  off: 'Off',
};

const ACTIVITY_SORT_LABELS: Record<ActivitySort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  event: 'Event A-Z',
  from: 'Emitter A-Z',
  'used-by': 'Used by A-Z',
  status: 'Status',
};

const ACTIVITY_AUTO_REFRESH_MS = 2_500;

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

export function shouldOpenNewAutomationFromSearch(search: string | undefined): boolean {
  const params = new URLSearchParams(search?.startsWith('?') ? search.slice(1) : search);
  return params.get('action') === 'new' || params.get('new') === '1';
}

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

function toneDotClass(tone: ActivityTone) {
  switch (tone) {
    case 'success':
      return 'border-success bg-success shadow-[0_0_10px_rgb(var(--color-success)/0.38)]';
    case 'accent':
      return 'border-accent bg-accent shadow-[0_0_10px_rgb(var(--color-accent)/0.42)]';
    case 'warning':
      return 'border-warning bg-warning shadow-[0_0_10px_rgb(var(--color-warning)/0.35)]';
    case 'danger':
      return 'border-danger bg-danger shadow-[0_0_10px_rgb(var(--color-danger)/0.36)]';
    case 'muted':
      return 'border-border-default bg-surface';
  }
}

function toneTextClass(tone: ActivityTone) {
  switch (tone) {
    case 'success':
      return 'text-success';
    case 'accent':
      return 'text-accent';
    case 'warning':
      return 'text-warning';
    case 'danger':
      return 'text-danger';
    case 'muted':
      return 'text-dim';
  }
}

function statusTone(status: string, fallback: ActivityTone): ActivityTone {
  if (status === 'Done') return 'success';
  if (status === 'Failed') return 'danger';
  if (status === 'Waiting') return 'warning';
  if (status === 'Unused' || status === 'Off') return 'muted';
  return fallback;
}

function humanizeToken(value: string) {
  const cleaned = value
    .replace(/^subscription:/, '')
    .replace(/^(demo|event|agent|script|thread|schedule|webhook|cli|system)[._:-]/, '')
    .replace(/[_:.-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
  return cleaned || value;
}

function humanizeEventName(type: string) {
  const parts = type.split(/[.:_-]+/).filter(Boolean);
  const meaningful = parts.length > 1 ? parts.slice(1) : parts;
  return humanizeToken(meaningful.join(' '));
}

function humanizeActorName(value: string) {
  if (!value) return '-';
  if (value === 'scheduler') return 'Schedule';
  if (/\s/.test(value.trim())) return value.trim();
  if (value.startsWith('subscription:')) return humanizeToken(value.slice('subscription:'.length).replace(/^sub[-_]/u, ''));
  return humanizeToken(value);
}

function normalizedActorId(value: string) {
  return value.replace(/^(subscription|script|agent|thread|conversation|session):/, '').trim();
}

function stringMetadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function resolveActivityActor(source: string, metadata: Record<string, unknown> | undefined, lookup: ActivityActorLookup) {
  const normalizedSource = normalizedActorId(source);
  const conversationId =
    stringMetadataValue(metadata, ['conversationId', 'threadConversationId', 'sessionId', 'threadId']) ??
    (source.startsWith('thread:') || source.startsWith('conversation:') || source.startsWith('session:')
      ? normalizedSource
      : lookup.conversations.has(normalizedSource)
        ? normalizedSource
        : undefined);
  const subscriptionId =
    stringMetadataValue(metadata, ['subscriptionId', 'handlerId']) ??
    (source.startsWith('subscription:') ? normalizedSource : lookup.subscriptions.has(normalizedSource) ? normalizedSource : undefined);
  if (conversationId) {
    return {
      name: lookup.conversations.get(conversationId)?.title ?? humanizeActorName(conversationId),
      kind: 'Session',
      conversationId,
      subscriptionId: undefined,
    };
  }
  if (subscriptionId) {
    return {
      name: lookup.subscriptions.get(subscriptionId)?.name ?? humanizeActorName(subscriptionId),
      kind: 'Automation',
      conversationId: undefined,
      subscriptionId,
    };
  }
  return {
    name: humanizeActorName(source),
    kind: actorKindFromSource(source),
    conversationId: undefined,
    subscriptionId: undefined,
  };
}

function actorKindFromSource(value: string) {
  if (!value) return 'Unknown';
  if (value === 'scheduler') return 'Schedule';
  if (value.startsWith('subscription:')) return 'Automation';
  if (value.startsWith('script:')) return 'Script';
  if (value.startsWith('agent:')) return 'Agent';
  if (value.startsWith('thread:')) return 'Thread';
  if (value.startsWith('tool:')) return 'Tool';
  if (value.startsWith('webhook:')) return 'Webhook';
  if (value.startsWith('cli:')) return 'CLI';
  if (value.startsWith('system:')) return 'System';
  return 'Source';
}

function actorKindFromAction(actionType: EventBusReactionSummary['actionType']) {
  if (actionType === 'start_agent') return 'Agent';
  if (actionType === 'start_thread') return 'Thread';
  if (actionType === 'run_script') return 'Script';
  if (actionType === 'run_task') return 'Scheduled task';
  if (actionType === 'publish_event') return 'Automation';
  return 'Automation';
}

function statusFilterMatches(event: AutomationActivityEvent, filter: ActivityStatusFilter) {
  switch (filter) {
    case 'all':
      return true;
    case 'done':
      return event.status === 'Done';
    case 'waiting':
      return event.status === 'Waiting';
    case 'failed':
      return event.status === 'Failed';
    case 'off':
      return event.status === 'Off';
  }
}

function optionValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function compareActivityEvents(left: AutomationActivityEvent, right: AutomationActivityEvent, sort: ActivitySort) {
  if (sort === 'oldest') return Date.parse(left.absoluteTime ?? '') - Date.parse(right.absoluteTime ?? '');
  if (sort === 'event') return left.displayName.localeCompare(right.displayName);
  if (sort === 'from') return left.fromName.localeCompare(right.fromName);
  if (sort === 'used-by') return left.primaryUsedByName.localeCompare(right.primaryUsedByName);
  if (sort === 'status') return left.status.localeCompare(right.status);
  return Date.parse(right.absoluteTime ?? '') - Date.parse(left.absoluteTime ?? '');
}

function activitySearchText(event: AutomationActivityEvent) {
  return [
    event.id,
    event.taskId,
    event.eventName,
    event.source,
    event.title,
    event.status,
    event.displayName,
    event.fromName,
    event.primaryUsedByName,
    ...event.usedByNames,
    event.reactionStatus,
    event.reactionMeta,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function describeEventBusAction(action: EventBusActionSummary, conversations: Map<string, ConversationOption>) {
  if (action.type === 'run_task') return `Run scheduled publisher ${action.taskId}`;
  if (action.type === 'start_agent') return 'Start agent';
  if (action.type === 'start_thread') {
    return action.conversationId
      ? `Open session ${conversations.get(action.conversationId)?.title ?? action.conversationId}`
      : 'Start session';
  }
  if (action.type === 'run_script') return `Run script ${action.command}`;
  return `Publish ${humanizeEventName(action.eventType)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEventBusEvents(input: unknown): EventBusEventSummary[] {
  const details = isRecord(input) && isRecord(input.details) ? input.details : undefined;
  const events =
    isRecord(input) && Array.isArray(input.events) ? input.events : details && Array.isArray(details.events) ? details.events : [];
  return events
    .map((event): EventBusEventSummary | null => {
      if (!isRecord(event) || typeof event.id !== 'string' || typeof event.type !== 'string' || typeof event.source !== 'string') {
        return null;
      }
      const reactions = Array.isArray(event.reactions)
        ? event.reactions
            .map((reaction): EventBusReactionSummary | null => {
              if (!isRecord(reaction) || typeof reaction.id !== 'string') return null;
              return {
                id: reaction.id,
                subscriptionId: typeof reaction.subscriptionId === 'string' ? reaction.subscriptionId : '',
                subscriptionName: typeof reaction.subscriptionName === 'string' ? reaction.subscriptionName : 'Reaction',
                actionType:
                  typeof reaction.actionType === 'string' ? (reaction.actionType as EventBusReactionSummary['actionType']) : 'event',
                status: typeof reaction.status === 'string' ? reaction.status : 'pending',
                output: isRecord(reaction.output) ? reaction.output : undefined,
                error: typeof reaction.error === 'string' ? reaction.error : undefined,
              };
            })
            .filter((reaction): reaction is EventBusReactionSummary => Boolean(reaction))
        : [];
      return {
        id: event.id,
        type: event.type,
        source: event.source,
        payload: isRecord(event.payload) ? event.payload : {},
        metadata: isRecord(event.metadata) ? event.metadata : {},
        occurredAt: typeof event.occurredAt === 'string' ? event.occurredAt : new Date().toISOString(),
        recordedAt: typeof event.recordedAt === 'string' ? event.recordedAt : undefined,
        replayOfEventId: typeof event.replayOfEventId === 'string' ? event.replayOfEventId : undefined,
        reactions,
      };
    })
    .filter((event): event is EventBusEventSummary => Boolean(event));
}

function normalizeEventBusAction(input: unknown): EventBusActionSummary | null {
  if (!isRecord(input) || typeof input.type !== 'string') return null;
  if (input.type === 'run_task' && typeof input.taskId === 'string') return { type: 'run_task', taskId: input.taskId };
  if (input.type === 'start_agent' && typeof input.prompt === 'string') {
    return {
      type: 'start_agent',
      prompt: input.prompt,
      ...(typeof input.cwd === 'string' ? { cwd: input.cwd } : {}),
      ...(typeof input.model === 'string' ? { model: input.model } : {}),
    };
  }
  if (input.type === 'start_thread' && typeof input.prompt === 'string') {
    return {
      type: 'start_thread',
      prompt: input.prompt,
      ...(typeof input.conversationId === 'string' ? { conversationId: input.conversationId } : {}),
      ...(typeof input.cwd === 'string' ? { cwd: input.cwd } : {}),
      ...(typeof input.model === 'string' ? { model: input.model } : {}),
    };
  }
  if (input.type === 'run_script' && typeof input.command === 'string') {
    return { type: 'run_script', command: input.command, ...(typeof input.cwd === 'string' ? { cwd: input.cwd } : {}) };
  }
  if (input.type === 'publish_event' && typeof input.eventType === 'string') {
    return {
      type: 'publish_event',
      eventType: input.eventType,
      payload: isRecord(input.payload) ? input.payload : undefined,
      ...(typeof input.recorded === 'boolean' ? { recorded: input.recorded } : {}),
    };
  }
  return null;
}

function readEventBusSubscriptions(input: unknown): EventBusSubscriptionSummary[] {
  const details = isRecord(input) && isRecord(input.details) ? input.details : undefined;
  const subscriptions =
    isRecord(input) && Array.isArray(input.subscriptions)
      ? input.subscriptions
      : details && Array.isArray(details.subscriptions)
        ? details.subscriptions
        : [];
  return subscriptions
    .map((subscription): EventBusSubscriptionSummary | null => {
      if (!isRecord(subscription) || typeof subscription.id !== 'string') return null;
      const action = normalizeEventBusAction(subscription.action);
      if (!action) return null;
      return {
        id: subscription.id,
        name: typeof subscription.name === 'string' ? subscription.name : subscription.id,
        pattern: typeof subscription.pattern === 'string' ? subscription.pattern : '*',
        enabled: subscription.enabled !== false,
        action,
        maxReactionsPerMinute: typeof subscription.maxReactionsPerMinute === 'number' ? subscription.maxReactionsPerMinute : undefined,
        updatedAt: typeof subscription.updatedAt === 'string' ? subscription.updatedAt : undefined,
      };
    })
    .filter((subscription): subscription is EventBusSubscriptionSummary => Boolean(subscription));
}

function reactionKindFromAction(actionType: EventBusReactionSummary['actionType']): ReactionKind {
  if (actionType === 'start_thread') return 'thread';
  if (actionType === 'run_script') return 'script';
  if (actionType === 'publish_event') return 'event';
  return 'agent';
}

function toneFromReactionStatus(status: string): ActivityTone {
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
  return 'success';
}

function buildEventBusActivityEvents(events: EventBusEventSummary[], lookup: ActivityActorLookup): AutomationActivityEvent[] {
  return events.map((event) => {
    const firstReaction = event.reactions?.[0];
    const reactions = event.reactions ?? [];
    const tone = firstReaction ? toneFromReactionStatus(firstReaction.status) : 'muted';
    const reactionKind = firstReaction ? reactionKindFromAction(firstReaction.actionType) : 'event';
    const relativeTime = timeAgo(event.occurredAt);
    const reactionStatus = firstReaction
      ? firstReaction.status === 'completed'
        ? 'Completed'
        : firstReaction.status === 'failed'
          ? 'Failed'
          : 'Pending'
      : 'Unused';
    const matchingSubscriptionIds = reactions.map((reaction) => reaction.subscriptionId).filter(Boolean);
    const usedByNames = reactions.map((reaction) => humanizeActorName(reaction.subscriptionName)).filter(Boolean);
    const usedByKinds = reactions.map((reaction) => actorKindFromAction(reaction.actionType)).filter(Boolean);
    const primaryUsedBySubscriptionId = matchingSubscriptionIds[0];
    const sourceActor = resolveActivityActor(event.source, event.metadata, lookup);
    const primaryUsedByName =
      usedByNames.length === 0 ? '-' : usedByNames.length === 1 ? usedByNames[0] : `${usedByNames[0]} +${usedByNames.length - 1}`;
    const primaryUsedByKind =
      usedByKinds.length === 0 ? 'Unused' : usedByKinds.length === 1 ? usedByKinds[0] : `${usedByKinds[0]} +${usedByKinds.length - 1}`;
    const failed = reactions.some((reaction) => reaction.status === 'failed');
    const pending = reactions.some((reaction) => reaction.status === 'pending');
    return {
      id: event.id,
      taskId: typeof event.metadata?.taskId === 'string' ? event.metadata.taskId : undefined,
      replayMode: 'event-bus',
      eventName: event.type,
      source: event.source,
      title: event.type,
      relativeTime,
      absoluteTime: event.occurredAt,
      status: reactions.length === 0 ? 'Unused' : failed ? 'Failed' : pending ? 'Waiting' : 'Done',
      tone: failed ? 'danger' : pending ? 'warning' : tone,
      matches: reactions.length,
      reactionKind,
      displayName: humanizeEventName(event.type),
      fromName: sourceActor.name,
      fromKind: sourceActor.kind,
      fromConversationId: sourceActor.conversationId,
      fromSubscriptionId: sourceActor.subscriptionId,
      usedByNames,
      usedByKinds,
      primaryUsedByName,
      primaryUsedByKind,
      primaryUsedBySubscriptionId,
      technicalName: event.type,
      payload: event.payload,
      reactionStatus,
      reactionMeta: firstReaction?.actionType ?? 'Event recorded',
      matchingSubscriptionIds,
    };
  });
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
        return null;
      })
      .filter((policy): policy is AutomationPolicy => Boolean(policy));
  }
  return [
    { kind: 'catch_up', enabled: true, windowSeconds: Number(catchUpWindowSeconds) || 900, mode: 'latest' },
    { kind: 'overlap', enabled: true, behavior: 'skip' },
  ];
}

function catchUpWindowFromPolicies(policies: AutomationPolicy[]) {
  const catchUpPolicy = policies.find((policy) => policy.kind === 'catch_up' && policy.enabled !== false);
  return catchUpPolicy?.kind === 'catch_up' ? catchUpPolicy.windowSeconds : null;
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
    catchUpWindowSeconds:
      form.scheduleType === 'cron' ? (catchUpWindowFromPolicies(form.policies) ?? numberOrNull(form.catchUpWindowSeconds)) : null,
    policies: form.scheduleType === 'cron' ? form.policies : form.policies.filter((policy) => policy.kind !== 'catch_up'),
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
  const tone: StatusDotTone = health?.status === 'stale' ? 'warning' : health?.status === 'healthy' ? 'success' : 'muted';
  return (
    <span
      tabIndex={0}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary outline-none transition-colors hover:bg-elevated focus:bg-elevated"
    >
      <StatusDot tone={tone} size="md" />
    </span>
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
  children: ReactNode;
}) {
  return (
    <SettingsSection id={id} title={title} description={description} className="scroll-mt-8 xl:grid-cols-[11rem_minmax(0,1fr)]">
      {children}
    </SettingsSection>
  );
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
    "Read the built-in scheduled-tasks skill, then let's chat about the automation I want to create. Help me shape the schedule, run rules, delivery, and execution defaults. Do not create the automation until I confirm the final version.",
    '',
    'Starter draft from the automation form:',
    `- Title: ${input.title || '<help me choose a concise title>'}`,
    `- Prompt: ${input.prompt || '<help me write what should run>'}`,
    input.cron ? `- Schedule: recurring cron ${input.cron}` : `- Schedule: once at ${input.at || '<help me choose a time>'}`,
    `- Target: ${input.targetType}`,
    `- Result conversation: ${input.threadMode}`,
    input.threadConversationId ? `- Existing conversation id: ${input.threadConversationId}` : null,
    input.cwd ? `- Working directory: ${input.cwd}` : null,
    input.model ? `- Model: ${input.model}` : null,
    input.thinkingLevel ? `- Thinking level: ${input.thinkingLevel}` : null,
    input.timeoutSeconds ? `- Timeout seconds: ${input.timeoutSeconds}` : null,
    input.catchUpWindowSeconds && input.cron ? `- Catch-up policy window seconds: ${input.catchUpWindowSeconds}` : null,
    input.policies.length > 0 ? `- Run rules: ${JSON.stringify(input.policies)}` : null,
    `- Enabled: ${input.enabled ? 'true' : 'false'}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12.5 7.5a4.5 4.5 0 1 1-1.2-3.1" />
      <path d="M10 2.8h3v3" />
    </svg>
  );
}

function ActivityTimeline({
  events,
  selectedId,
  onSelect,
  onOpenEditor,
  onOpenConversation,
  onInspectHandler,
}: {
  events: AutomationActivityEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
  onOpenEditor: (taskId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onInspectHandler: (eventId: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[26rem] items-center justify-center border-t border-border-subtle/70 px-6 text-center">
        <div className="max-w-sm">
          <div className="text-[14px] font-medium text-primary">No events match this view.</div>
          <div className="mt-1 text-[12px] leading-5 text-secondary">
            Change the filters or wait for agents, scripts, schedules, or tools to create events.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-automation-activity-scroll="true" className="h-full min-h-0 overflow-auto">
      <div className="min-w-[58rem]">
        <div className="sticky top-0 z-20 grid h-8 grid-cols-[5.5rem_minmax(13rem,1.4fr)_minmax(10rem,0.95fr)_minmax(11rem,1fr)_6rem] items-center border-b border-border-subtle/70 bg-background/95 px-3 text-[11px] font-medium uppercase text-dim">
          <div>Time</div>
          <div>Event</div>
          <div>Emitted by</div>
          <div>Used by</div>
          <div>Status</div>
        </div>
        {events.map((event) => {
          const selected = event.id === selectedId;
          const exactTime = event.absoluteTime ? new Date(event.absoluteTime).toLocaleString() : 'Pending';
          const displayTone = statusTone(event.status, event.tone);
          return (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              className={cx(
                'grid min-h-10 w-full grid-cols-[5.5rem_minmax(13rem,1.4fr)_minmax(10rem,0.95fr)_minmax(11rem,1fr)_6rem] items-center gap-3 border-b border-border-subtle/55 px-3 py-1.5 text-left text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60',
                selected ? 'bg-accent/10 shadow-[inset_2px_0_0_rgb(var(--color-accent))]' : 'hover:bg-surface/25',
              )}
              onClick={() => onSelect(event.id)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                  keyEvent.preventDefault();
                  onSelect(event.id);
                }
              }}
              onDoubleClick={() => {
                if (event.taskId) onOpenEditor(event.taskId);
              }}
            >
              <div className="truncate whitespace-nowrap font-mono text-[11px] text-secondary" title={exactTime}>
                {event.relativeTime}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-primary">{event.displayName}</div>
                <div className="truncate font-mono text-[10px] text-dim">{event.technicalName}</div>
              </div>
              <div className="min-w-0">
                {event.fromConversationId || event.fromSubscriptionId ? (
                  <button
                    type="button"
                    className="block max-w-full truncate text-left text-[12px] text-secondary underline-offset-2 hover:text-primary hover:underline"
                    title={event.fromConversationId ? 'Open session' : 'Inspect automation'}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      if (event.fromConversationId) {
                        onOpenConversation(event.fromConversationId);
                        return;
                      }
                      onInspectHandler(event.id);
                    }}
                  >
                    {event.fromName}
                  </button>
                ) : (
                  <div className="truncate text-[12px] text-secondary">{event.fromName}</div>
                )}
                <div className="truncate text-[10px] uppercase tracking-wide text-dim">{event.fromKind}</div>
              </div>
              <div className="min-w-0">
                {event.primaryUsedBySubscriptionId ? (
                  <button
                    type="button"
                    className="block max-w-full truncate text-left text-[12px] text-secondary underline-offset-2 hover:text-primary hover:underline"
                    title="Inspect automation"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onInspectHandler(event.id);
                    }}
                  >
                    {event.primaryUsedByName}
                  </button>
                ) : (
                  <div className={cx('truncate text-[12px]', event.primaryUsedByName === '-' ? 'text-dim' : 'text-secondary')}>
                    {event.primaryUsedByName}
                  </div>
                )}
                <div className="truncate text-[10px] uppercase tracking-wide text-dim">{event.primaryUsedByKind}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className={cx('h-2 w-2 rounded-full border', toneDotClass(displayTone))} />
                <span className={toneTextClass(displayTone)}>{event.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityInspector({
  event,
  busy,
  subscriptions,
  conversations,
  onReemit,
  onCreateReaction,
  onToggleSubscription,
  onPausePublisher,
  onOpenThread,
  onOpenConversation,
}: {
  event: AutomationActivityEvent | null;
  busy: string | null;
  subscriptions: EventBusSubscriptionSummary[];
  conversations: Map<string, ConversationOption>;
  onReemit: (event: AutomationActivityEvent) => void;
  onCreateReaction: (taskId: string) => void;
  onToggleSubscription: (subscription: EventBusSubscriptionSummary) => void;
  onPausePublisher: (taskId: string) => void;
  onOpenThread: (taskId: string) => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const matchingSubscriptions = event
    ? subscriptions.filter((subscription) => event.matchingSubscriptionIds.includes(subscription.id))
    : [];
  const primarySubscription = matchingSubscriptions[0];
  const sourceSubscription = event?.fromSubscriptionId
    ? subscriptions.find((subscription) => subscription.id === event.fromSubscriptionId)
    : undefined;

  if (!event) {
    return (
      <aside className="flex h-full min-h-0 w-[20rem] shrink-0 flex-col border-l border-border-subtle/70 bg-background/55 px-4 py-4">
        <div className="text-[11px] uppercase text-dim">Event</div>
        <h2 className="mt-2 text-[16px] font-semibold leading-tight text-primary">No event selected</h2>
        <p className="mt-2 text-[12px] leading-5 text-secondary">Select a row to inspect what emitted it and what used it.</p>
      </aside>
    );
  }

  const replayBusyKey = event.replayMode === 'event-bus' ? `replay:${event.id}` : event.taskId ? `run:${event.taskId}` : null;
  const actionBusy = busy === replayBusyKey || (event.taskId ? busy === `pause:${event.taskId}` : false);
  const displayTone = statusTone(event.status, event.tone);
  return (
    <aside className="flex h-full min-h-0 w-[20rem] shrink-0 flex-col border-l border-border-subtle/70 bg-background/55">
      <div className="border-b border-border-subtle/70 px-4 py-4">
        <div className="text-[11px] uppercase text-dim">Event</div>
        <h2 className="mt-1 break-words text-[18px] font-semibold leading-tight text-primary">{event.displayName}</h2>
        <div className="mt-1 truncate font-mono text-[11px] text-dim">{event.technicalName}</div>
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span className={cx('h-2.5 w-2.5 rounded-full border', toneDotClass(displayTone))} />
          <span className={toneTextClass(displayTone)}>{event.status}</span>
          <span className="text-dim">·</span>
          <span className="text-secondary">{event.relativeTime}</span>
        </div>
        <div className="mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-[12px]">
          <span className="text-dim">Emitted by</span>
          <span className="min-w-0">
            {event.fromConversationId ? (
              <button
                type="button"
                className="block break-words text-left text-secondary underline-offset-2 hover:text-primary hover:underline"
                onClick={() => onOpenConversation(event.fromConversationId as string)}
              >
                {event.fromName}
              </button>
            ) : (
              <span className="block break-words text-secondary">{event.fromName}</span>
            )}
            <span className="block text-[10px] uppercase tracking-wide text-dim">{event.fromKind}</span>
          </span>
          <span className="text-dim">Used by</span>
          <span className="min-w-0">
            <span className="block break-words text-secondary">{event.primaryUsedByName}</span>
            <span className="block text-[10px] uppercase tracking-wide text-dim">{event.primaryUsedByKind}</span>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="text-[11px] font-medium uppercase text-dim">Details</div>
        <div className="mt-3 grid gap-1.5 text-[12px]">
          {Object.entries(event.payload ?? {})
            .slice(0, 8)
            .map(([key, value]) => (
              <div key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <span className="truncate text-dim">{humanizeToken(key)}</span>
                <span className="truncate font-mono text-secondary">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
              </div>
            ))}
          {Object.keys(event.payload ?? {}).length === 0 ? <div className="text-[12px] text-secondary">No details.</div> : null}
        </div>
        {sourceSubscription || primarySubscription ? (
          <div className="mt-5 grid gap-4 border-t border-border-subtle/70 pt-4">
            {sourceSubscription ? (
              <div>
                <div className="text-[11px] font-medium uppercase text-dim">Emitter</div>
                <div className="mt-2 grid gap-1.5 text-[12px]">
                  <div className="font-medium text-primary">{sourceSubscription.name}</div>
                  <div className="text-secondary">{describeEventBusAction(sourceSubscription.action, conversations)}</div>
                  <div className="font-mono text-[11px] text-dim">{sourceSubscription.pattern}</div>
                </div>
              </div>
            ) : null}
            {primarySubscription ? (
              <div>
                <div className="text-[11px] font-medium uppercase text-dim">Automation</div>
                <div className="mt-2 grid gap-1.5 text-[12px]">
                  <div className="font-medium text-primary">{primarySubscription.name}</div>
                  <div className="text-secondary">{describeEventBusAction(primarySubscription.action, conversations)}</div>
                  <div className="font-mono text-[11px] text-dim">{primarySubscription.pattern}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border-subtle/70 px-4 py-3">
        <div className="grid gap-2">
          <ToolbarButton disabled={actionBusy || event.status === 'Disabled'} onClick={() => onReemit(event)}>
            {busy === replayBusyKey ? (event.replayMode === 'event-bus' ? 'Running…' : 'Starting…') : 'Run again'}
          </ToolbarButton>
          {primarySubscription ? (
            <ToolbarButton disabled={actionBusy} onClick={() => onToggleSubscription(primarySubscription)}>
              {busy === `subscription:${primarySubscription.id}`
                ? 'Updating…'
                : `Turn ${primarySubscription.enabled ? 'off' : 'on'} ${event.primaryUsedByName}`}
            </ToolbarButton>
          ) : null}
          {event.taskId ? <ToolbarButton onClick={() => onCreateReaction(event.taskId)}>Edit Scheduled Publisher</ToolbarButton> : null}
          {event.reactionKind === 'thread' && event.taskId ? (
            <ToolbarButton onClick={() => onOpenThread(event.taskId)}>Open Thread</ToolbarButton>
          ) : null}
          {event.taskId ? (
            <ToolbarButton disabled={actionBusy || event.status === 'Disabled'} onClick={() => onPausePublisher(event.taskId as string)}>
              {busy === `pause:${event.taskId}` ? 'Pausing…' : 'Pause Publisher'}
            </ToolbarButton>
          ) : null}
        </div>
      </div>
    </aside>
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
      <IconButton
        compact
        className="ml-auto opacity-0 group-hover:opacity-100"
        aria-label="Remove run rule"
        onClick={() => onRemove(index)}
      >
        ×
      </IconButton>
    </div>
  );
}

export function AutomationsPage({ pa, context }: { pa: NativeExtensionClient; context?: AutomationsPageContext }) {
  const openNewFromRoute = shouldOpenNewAutomationFromSearch(context?.search);
  const [tasks, setTasks] = useState<ScheduledTaskSummary[]>([]);
  const [eventBusEvents, setEventBusEvents] = useState<EventBusEventSummary[]>([]);
  const [eventBusSubscriptions, setEventBusSubscriptions] = useState<EventBusSubscriptionSummary[]>([]);
  const [health, setHealth] = useState<ScheduledTaskSchedulerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(openNewFromRoute);
  const [form, setForm] = useState<AutomationFormState>(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>('all');
  const [fromFilter, setFromFilter] = useState('all');
  const [usedByFilter, setUsedByFilter] = useState('all');
  const [activitySort, setActivitySort] = useState<ActivitySort>('newest');
  const [query, setQuery] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activeEditorSection, setActiveEditorSection] = useState<EditorSectionId>('automation-general');
  const [conversationOptions, setConversationOptions] = useState<ConversationOption[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const createWithChatInFlightRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const backgroundReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
    setError(null);
    const extensionClient = pa as NativeExtensionClient & {
      conversations?: { list(): Promise<unknown> };
      models?: () => Promise<unknown>;
    };
    let nextTasks: unknown;
    let nextHealth: unknown;
    let nextEventBusEvents: unknown;
    let nextEventBusSubscriptions: unknown;
    let nextConversations: unknown;
    let nextModels: unknown;
    try {
      [nextTasks, nextHealth, nextEventBusEvents, nextEventBusSubscriptions, nextConversations, nextModels] = await Promise.all([
        pa.automations.list(),
        pa.automations.readSchedulerHealth(),
        pa.extension.invoke('eventBus', { action: 'list', limit: 100 }),
        pa.extension.invoke('eventBus', { action: 'list_subscriptions' }),
        extensionClient.conversations?.list?.() ?? Promise.resolve([]),
        extensionClient.models?.() ?? Promise.resolve({ models: [] }),
      ]);
    } catch (error) {
      if (loadSequence !== loadSequenceRef.current) return;
      throw error;
    }
    if (loadSequence !== loadSequenceRef.current) return;
    setTasks(sortTasks(Array.isArray(nextTasks) ? nextTasks : []));
    setEventBusEvents(readEventBusEvents(nextEventBusEvents));
    setEventBusSubscriptions(readEventBusSubscriptions(nextEventBusSubscriptions));
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

  useEffect(() => {
    const subscription = pa.ui.subscribeInvalidations?.(({ topics }) => {
      if (!topics.some((topic) => topic === 'automation' || topic === 'events' || topic === 'tasks' || topic === 'runs')) return;
      if (backgroundReloadTimerRef.current) clearTimeout(backgroundReloadTimerRef.current);
      backgroundReloadTimerRef.current = setTimeout(() => {
        backgroundReloadTimerRef.current = null;
        void load().catch((err: Error) => {
          setError(err.message);
          pa.ui.notify({ type: 'error', message: `Failed to refresh automations: ${err.message}`, source: 'system-automations' });
        });
      }, 100);
    });
    return () => {
      subscription?.unsubscribe();
      if (backgroundReloadTimerRef.current) {
        clearTimeout(backgroundReloadTimerRef.current);
        backgroundReloadTimerRef.current = null;
      }
    };
  }, [load, pa]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load().catch((err: Error) => {
        setError(err.message);
      });
    }, ACTIVITY_AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

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
    if (createWithChatInFlightRef.current) return;
    createWithChatInFlightRef.current = true;
    setBusy('create-chat');
    try {
      const prompt = buildCreateWithChatPrompt(form);
      const opened = await pa.commands.execute('conversation.newAndFocus', {
        initialPromptText: prompt,
        cwd: form.cwd.trim() || undefined,
      });
      if (opened) {
        closeEditor();
        return;
      }
      pa.ui.notify({ type: 'error', message: 'Could not open chat for automation creation.', source: 'system-automations' });
    } finally {
      createWithChatInFlightRef.current = false;
      setBusy(null);
    }
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

  const reemitActivityEvent = useCallback(
    async (event: AutomationActivityEvent) => {
      if (event.replayMode === 'task-run') {
        if (!event.taskId) return;
        setBusy(`run:${event.taskId}`);
        try {
          await pa.automations.run(event.taskId);
          setNotice('Publisher started.');
          await load();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          pa.ui.notify({ type: 'error', message: `Failed to start publisher: ${msg}`, source: 'system-automations' });
        } finally {
          setBusy(null);
        }
        return;
      }

      setBusy(`replay:${event.id}`);
      try {
        await pa.extension.invoke('eventBus', { action: 'replay', eventId: event.id });
        setNotice('Event re-emitted.');
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to re-emit event: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [load, pa],
  );

  const pausePublisher = useCallback(
    async (taskId: string) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task) return;
      setBusy(`pause:${taskId}`);
      try {
        await pa.automations.update(taskId, { ...task, enabled: false });
        setNotice('Publisher paused.');
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to pause publisher: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [load, pa, tasks],
  );

  const toggleSubscription = useCallback(
    async (subscription: EventBusSubscriptionSummary) => {
      setBusy(`subscription:${subscription.id}`);
      try {
        await pa.extension.invoke('eventBus', {
          action: 'save_subscription',
          subscriptionId: subscription.id,
          name: subscription.name,
          pattern: subscription.pattern,
          enabled: !subscription.enabled,
          maxReactionsPerMinute: subscription.maxReactionsPerMinute,
          subscriptionAction: subscription.action,
        });
        setNotice(!subscription.enabled ? `${subscription.name} turned on.` : `${subscription.name} turned off.`);
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pa.ui.notify({ type: 'error', message: `Failed to update automation: ${msg}`, source: 'system-automations' });
      } finally {
        setBusy(null);
      }
    },
    [load, pa],
  );

  const openThreadForTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task?.threadConversationId) return;
      window.location.href = `/conversations/${encodeURIComponent(task.threadConversationId)}`;
    },
    [tasks],
  );

  const openConversation = useCallback((conversationId: string) => {
    window.location.href = `/conversations/${encodeURIComponent(conversationId)}`;
  }, []);

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

  const enabledCount = useMemo(() => tasks.filter((task) => task.enabled !== false).length, [tasks]);
  const enabledLabel = useMemo(() => (enabledCount === 1 ? '1 enabled' : `${enabledCount} enabled`), [enabledCount]);
  const countLabel = useMemo(
    () =>
      `${tasks.length === 1 ? '1 scheduled publisher' : `${tasks.length} scheduled publishers`} · ${
        eventBusSubscriptions.length === 1 ? '1 event rule' : `${eventBusSubscriptions.length} event rules`
      }`,
    [eventBusSubscriptions.length, tasks.length],
  );
  const nowMs = Date.now();
  const allPastDueTasks = useMemo(() => sortPastDueTasks(tasks.filter((task) => isPastDueOneTimeTask(task, nowMs))), [tasks, nowMs]);
  const pastDueLabel = allPastDueTasks.length === 1 ? '1 past due' : `${allPastDueTasks.length} past due`;

  const conversationLookup = useMemo(
    () => new Map(conversationOptions.map((conversation) => [conversation.id, conversation])),
    [conversationOptions],
  );
  const subscriptionLookup = useMemo(
    () => new Map(eventBusSubscriptions.map((subscription) => [subscription.id, subscription])),
    [eventBusSubscriptions],
  );
  const activityEvents = useMemo(
    () => buildEventBusActivityEvents(eventBusEvents, { conversations: conversationLookup, subscriptions: subscriptionLookup }),
    [conversationLookup, eventBusEvents, subscriptionLookup],
  );
  const fromFilterOptions = useMemo(() => optionValues(activityEvents.map((event) => event.fromName)), [activityEvents]);
  const usedByFilterOptions = useMemo(
    () => optionValues(activityEvents.flatMap((event) => (event.usedByNames.length > 0 ? event.usedByNames : ['-']))),
    [activityEvents],
  );
  const filteredActivityEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activityEvents
      .filter((event) => {
        if (!statusFilterMatches(event, statusFilter)) return false;
        if (fromFilter !== 'all' && event.fromName !== fromFilter) return false;
        if (
          usedByFilter !== 'all' &&
          !event.usedByNames.includes(usedByFilter) &&
          !(usedByFilter === '-' && event.usedByNames.length === 0)
        ) {
          return false;
        }
        return normalizedQuery ? activitySearchText(event).includes(normalizedQuery) : true;
      })
      .sort((left, right) => compareActivityEvents(left, right, activitySort));
  }, [activityEvents, activitySort, fromFilter, query, statusFilter, usedByFilter]);
  const selectedActivity =
    filteredActivityEvents.find((event) => event.id === selectedActivityId) ?? filteredActivityEvents[0] ?? activityEvents[0] ?? null;

  useEffect(() => {
    if (!selectedActivity && selectedActivityId !== null) {
      setSelectedActivityId(null);
      return;
    }
    if (selectedActivity && selectedActivity.id !== selectedActivityId) {
      setSelectedActivityId(selectedActivity.id);
    }
  }, [selectedActivity, selectedActivityId]);

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
    <div className="h-full min-h-0 overflow-hidden">
      <AppPageLayout
        shellClassName={editorOpen ? 'max-w-[72rem]' : 'h-full max-w-none'}
        contentClassName={editorOpen ? 'space-y-10' : 'flex h-full min-h-0 flex-col overflow-hidden space-y-0'}
      >
        {!editorOpen && (
          <>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle/70 px-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-semibold text-primary">Automations</h1>
                  <div className="mt-0.5 truncate text-[12px] text-secondary">
                    {enabledLabel} · {countLabel}
                    {allPastDueTasks.length > 0 ? ` · ${pastDueLabel}` : ''}
                  </div>
                </div>
                <SchedulerHealthDot health={health} />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <Select
                  name="automation-status-filter"
                  aria-label="Filter by status"
                  className="h-8 w-28 bg-surface/40 text-[13px]"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ActivityStatusFilter)}
                >
                  {(Object.keys(ACTIVITY_STATUS_FILTER_LABELS) as ActivityStatusFilter[]).map((value) => (
                    <option key={value} value={value}>
                      {ACTIVITY_STATUS_FILTER_LABELS[value]}
                    </option>
                  ))}
                </Select>
                <Select
                  name="automation-from-filter"
                  aria-label="Filter by emitter"
                  className="h-8 w-32 bg-surface/40 text-[13px]"
                  value={fromFilter}
                  onChange={(event) => setFromFilter(event.target.value)}
                >
                  <option value="all">Emitter: All</option>
                  {fromFilterOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Select
                  name="automation-used-by-filter"
                  aria-label="Filter by automation"
                  className="h-8 w-36 bg-surface/40 text-[13px]"
                  value={usedByFilter}
                  onChange={(event) => setUsedByFilter(event.target.value)}
                >
                  <option value="all">Used by: All</option>
                  {usedByFilterOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <SearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search events…"
                  className="w-48 bg-surface/40 text-[13px]"
                />
                <Select
                  name="automation-sort"
                  aria-label="Sort events"
                  className="h-8 w-32 bg-surface/40 text-[13px]"
                  value={activitySort}
                  onChange={(event) => setActivitySort(event.target.value as ActivitySort)}
                >
                  {(Object.keys(ACTIVITY_SORT_LABELS) as ActivitySort[]).map((value) => (
                    <option key={value} value={value}>
                      {ACTIVITY_SORT_LABELS[value]}
                    </option>
                  ))}
                </Select>
                <IconButton title="Reload automations" aria-label="Reload automations" onClick={() => void reload()}>
                  <RefreshIcon />
                </IconButton>
              </div>
            </div>
            {notice ? <Notice>{notice}</Notice> : null}
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
              gridClassName="!grid-cols-[minmax(0,1fr)] xl:!grid-cols-[minmax(0,1fr)_14rem]"
              asideClassName="hidden xl:block"
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
              <div className="flex flex-col items-start justify-between gap-4 pb-10 sm:flex-row">
                <div className="min-w-0">
                  <TextButton className="text-[13px]" onClick={closeEditor}>
                    ← Live events
                  </TextButton>
                  <h2 className="mt-6 text-[30px] font-semibold leading-[1.06] tracking-normal text-primary">
                    {editingId ? 'Edit scheduled publisher' : 'New scheduled publisher'}
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
                  <ToolbarButton
                    type="button"
                    className="self-start"
                    disabled={busy === 'create-chat'}
                    onClick={() => void createWithChat()}
                  >
                    {busy === 'create-chat' ? 'Opening chat…' : 'Create with chat'}
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
                    <TextInput
                      required
                      autoComplete="off"
                      name="automation-title"
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                    />
                  </Field>
                  <Field label="Instruction" hint="This prompt is sent each time the automation runs.">
                    <Textarea
                      required
                      name="automation-prompt"
                      rows={7}
                      value={form.prompt}
                      onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                    />
                  </Field>
                  <Switch checked={form.enabled} label="Enabled" onClick={() => setForm({ ...form, enabled: !form.enabled })} />
                </div>
              </FormSection>

              <FormSection
                id="automation-schedule"
                title="Schedule"
                description="Choose a human-readable schedule. The app handles the scheduler syntax."
              >
                <div className="grid gap-4">
                  <SegmentedControl
                    value={form.scheduleType}
                    options={SCHEDULE_TYPE_OPTIONS}
                    ariaLabel="Automation schedule type"
                    onChange={(nextScheduleType) => {
                      if (nextScheduleType === 'cron') {
                        const scheduleBuilder = form.cron
                          ? (easyScheduleFromCron(form.cron) ?? form.scheduleBuilder)
                          : form.scheduleBuilder;
                        setForm({
                          ...form,
                          scheduleType: 'cron',
                          scheduleBuilder,
                          cron: form.cron || buildCronFromEasySchedule(scheduleBuilder),
                        });
                        return;
                      }
                      setForm({ ...form, scheduleType: nextScheduleType });
                    }}
                  />

                  {form.scheduleType === 'cron' ? (
                    <div className="grid gap-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <Field label="Schedule">
                          <Select
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
                          </Select>
                        </Field>

                        {form.scheduleBuilder.cadence === 'hourly' || form.scheduleBuilder.cadence === 'interval' ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {form.scheduleBuilder.cadence === 'interval' ? (
                              <Field label="Every">
                                <TextInput
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
                              <TextInput
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
                            <TextInput
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
                              <Button
                                key={option.value}
                                variant="ghost"
                                className={cx(
                                  'px-2.5 py-1.5 text-[12px]',
                                  form.scheduleBuilder.weekdays.includes(option.value)
                                    ? 'border-accent/45 bg-accent/10 text-primary'
                                    : 'border-border-subtle/70 bg-transparent',
                                )}
                                aria-pressed={form.scheduleBuilder.weekdays.includes(option.value)}
                                onClick={() => toggleScheduleWeekday(option.value)}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        ) : null}

                        {form.scheduleBuilder.cadence === 'monthly' ? (
                          <Field label="Day of month">
                            <TextInput
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
                          <Button
                            variant="ghost"
                            className="rounded-md border border-accent/45 bg-accent/10 px-3 py-3 text-left text-accent transition-colors"
                            onClick={() => setForm({ ...form, cron: form.cron })}
                          >
                            <span className="block text-[13px] font-semibold">Custom saved schedule</span>
                            <span className="mt-0.5 block text-[11px] text-dim">Keep this existing schedule</span>
                          </Button>
                        ) : null}
                        {CRON_PRESETS.map((preset) => (
                          <Button
                            key={preset.cron}
                            variant="ghost"
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
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Field label="Run at" hint="Enter a date/time, like tomorrow 8pm or 2026-06-22 09:00.">
                      <TextInput
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
                title="Run rules"
                description="Choose what happens when a schedule is missed or another run is already active."
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
                      + Limit frequency
                    </ToolbarButton>
                    <ToolbarButton type="button" onClick={() => addPolicy('catch_up')}>
                      + Missed schedules
                    </ToolbarButton>
                    <ToolbarButton type="button" onClick={() => addPolicy('overlap')}>
                      + Already running
                    </ToolbarButton>
                  </div>
                </div>
              </FormSection>

              <FormSection id="automation-delivery" title="Delivery" description="Choose how visible the run should be when it completes.">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Results">
                      <Select
                        name="automation-target"
                        value={form.targetType}
                        onChange={(event) => {
                          const targetType = event.target.value as 'background-agent' | 'conversation';
                          setForm({ ...form, targetType, threadMode: normalizeThreadModeForTarget(targetType, form.threadMode) });
                        }}
                      >
                        <option value="background-agent">Background job</option>
                        <option value="conversation">Conversation</option>
                      </Select>
                    </Field>
                    <Field label="Result conversation">
                      <Select
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
                        <option value="dedicated">New conversation</option>
                        <option value="existing">Existing conversation</option>
                        {form.targetType === 'background-agent' ? <option value="none">Do not post to chat</option> : null}
                      </Select>
                    </Field>
                  </div>
                  {form.threadMode === 'existing' ? (
                    <Field
                      label="Thread"
                      hint={
                        conversationOptions.length === 0
                          ? 'No saved conversations found yet.'
                          : 'Choose the conversation that should receive automation results.'
                      }
                    >
                      <Select
                        name="automation-thread-conversation-id"
                        required
                        value={form.threadConversationId}
                        onChange={(event) => setForm({ ...form, threadConversationId: event.target.value })}
                      >
                        <option value="">Choose conversation</option>
                        {form.threadConversationId && !conversationOptions.some((option) => option.id === form.threadConversationId) ? (
                          <option value={form.threadConversationId}>Selected saved conversation</option>
                        ) : null}
                        {conversationOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.cwd ? `${option.title} · ${option.cwd}` : option.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  <KeyValueTable
                    className="border-t border-border-subtle/70 pt-3"
                    items={[
                      {
                        label: 'Result type',
                        value: form.targetType === 'conversation' ? 'Conversation' : 'Background agent',
                      },
                      {
                        label: 'Chat posting',
                        value:
                          form.threadMode === 'dedicated'
                            ? 'New conversation'
                            : form.threadMode === 'existing'
                              ? 'Existing conversation'
                              : 'None',
                      },
                    ]}
                  />
                </div>
              </FormSection>

              <FormSection
                id="automation-runtime"
                title="Execution defaults"
                description="Defaults are usually right. Change these only when the automation needs a specific workspace or model."
              >
                <div className="grid gap-4">
                  <Field label="Working directory" hint="Leave blank to use this conversation’s working directory.">
                    <div className="flex gap-2">
                      <TextInput
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
                      <Select
                        name="automation-model"
                        value={form.model}
                        onChange={(event) => setForm({ ...form, model: event.target.value })}
                      >
                        <option value="">Default model</option>
                        {form.model && !modelOptions.some((option) => option.id === form.model) ? (
                          <option value={form.model}>Selected saved model</option>
                        ) : null}
                        {modelOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.provider ? `${option.name} · ${option.provider}` : option.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Thinking level">
                      <Select
                        name="automation-thinking-level"
                        value={form.thinkingLevel}
                        onChange={(event) => setForm({ ...form, thinkingLevel: event.target.value })}
                      >
                        {THINKING_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value || 'default'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Timeout seconds">
                      <TextInput
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
                    <ToolbarButton type="button" disabled={busy === 'create-chat'} onClick={() => void createWithChat()}>
                      {busy === 'create-chat' ? 'Opening chat…' : 'Create with chat'}
                    </ToolbarButton>
                  )}
                </div>
              </div>
            </AppPageLayout>
          </form>
        )}

        {!editorOpen && (
          <div data-automation-activity-shell="true" className="flex min-h-0 flex-1 overflow-hidden">
            <main data-automation-activity-main="true" className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <ActivityTimeline
                events={filteredActivityEvents}
                selectedId={selectedActivity?.id ?? null}
                onSelect={setSelectedActivityId}
                onOpenEditor={(taskId) => {
                  const task = tasks.find((candidate) => candidate.id === taskId);
                  if (task) openEditor(task);
                }}
                onOpenConversation={openConversation}
                onInspectHandler={setSelectedActivityId}
              />
            </main>
            <ActivityInspector
              event={selectedActivity}
              busy={busy}
              subscriptions={eventBusSubscriptions}
              conversations={conversationLookup}
              onReemit={(event) => void reemitActivityEvent(event)}
              onCreateReaction={(taskId) => {
                const task = tasks.find((candidate) => candidate.id === taskId);
                openEditor(task);
              }}
              onToggleSubscription={(subscription) => void toggleSubscription(subscription)}
              onPausePublisher={(taskId) => void pausePublisher(taskId)}
              onOpenThread={openThreadForTask}
              onOpenConversation={openConversation}
            />
          </div>
        )}
      </AppPageLayout>
    </div>
  );
}
