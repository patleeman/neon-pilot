import type { ExtensionSurfaceProps, NativeExtensionClient } from '@neon-pilot/extensions';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  BrowsePathButton,
  Button,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  cx,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableToolbar,
  Dialog,
  DialogBody,
  DialogHeader,
  Disclosure,
  EmptyState,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
  KeyValueItem,
  KeyValueList,
  MenuItem,
  MenuSeparator,
  Notice,
  PanelMessage,
  Pill,
  PositionedMenu,
  QuietLoadingState,
  SegmentedControl,
  Select,
  Textarea,
  TextButton,
  TextInput,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedEmptyState,
  WindowedKeyValueGrid,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedStateBlock,
} from '@neon-pilot/extensions/ui';
import { type CSSProperties, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

interface TaskSummary {
  id: string;
  title?: string;
  enabled?: boolean;
  running?: boolean;
  lastStatus?: string;
  scheduleType?: 'cron' | 'at';
  cron?: string;
  at?: string;
  prompt?: string;
  threadConversationId?: string;
  threadTitle?: string;
  cwd?: string;
  model?: string;
  timeoutSeconds?: number;
  lastRunAt?: string;
}

interface ConversationOption {
  id: string;
  title: string;
  cwd?: string;
}

interface ModelOption {
  id: string;
  provider?: string;
  name?: string;
  label?: string;
}

const AUTOMATIONS_RECONCILE_INTERVAL_MS = 5_000;
const RUNNING_AUTOMATIONS_REFRESH_INTERVAL_MS = 2_500;

interface AutomationFormState {
  id: string;
  title: string;
  prompt: string;
  scheduleType: 'cron' | 'at';
  cron: string;
  atLocal: string;
  ownerThreadId: string;
  cwd: string;
  model: string;
  timeoutSeconds: string;
  enabled: boolean;
}

type AutomationsPageContext = Partial<Pick<ExtensionSurfaceProps['context'], 'search' | 'shellPresentation'>>;
type RowMenuState = {
  taskId: string;
  position: Pick<CSSProperties, 'top' | 'right' | 'bottom'>;
};
type AutomationSelectionData =
  | {
      kind: 'automation' | 'edit';
      task: TaskSummary;
    }
  | {
      kind: 'new';
    };

const ROW_ACTION_MENU_GAP = 4;
const ROW_ACTION_MENU_MARGIN = 8;
const ROW_ACTION_MENU_MIN_WIDTH = 144;
const ROW_ACTION_MENU_ESTIMATED_HEIGHT = 168;
const MAX_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;

const CRON_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0 9 * * *', label: 'Every day at 9:00 AM' },
  { value: '0 12 * * *', label: 'Every day at 12:00 PM' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 9 * * 1', label: 'Every Monday at 9:00 AM' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
  { value: '0 9 1 * *', label: 'First of the month at 9:00 AM' },
];

export function automationRowActionMenuPosition(
  anchorRect: Pick<DOMRect, 'top' | 'right' | 'bottom'>,
  viewport: { width: number; height: number },
): Pick<CSSProperties, 'top' | 'right' | 'bottom'> {
  const maxRight = Math.max(ROW_ACTION_MENU_MARGIN, viewport.width - ROW_ACTION_MENU_MARGIN - ROW_ACTION_MENU_MIN_WIDTH);
  const right = Math.min(Math.max(ROW_ACTION_MENU_MARGIN, viewport.width - anchorRect.right), maxRight);
  const availableBelow = viewport.height - anchorRect.bottom - ROW_ACTION_MENU_GAP - ROW_ACTION_MENU_MARGIN;
  const availableAbove = anchorRect.top - ROW_ACTION_MENU_GAP - ROW_ACTION_MENU_MARGIN;
  if (availableBelow < ROW_ACTION_MENU_ESTIMATED_HEIGHT && availableAbove > availableBelow) {
    return {
      right,
      bottom: Math.max(ROW_ACTION_MENU_MARGIN, viewport.height - anchorRect.top + ROW_ACTION_MENU_GAP),
    };
  }
  return {
    right,
    top: Math.max(ROW_ACTION_MENU_MARGIN, anchorRect.bottom + ROW_ACTION_MENU_GAP),
  };
}

const TIMEOUT_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
];

const CUSTOM_VALUE = '__custom';

const EMPTY_FORM: AutomationFormState = {
  id: '',
  title: '',
  prompt: '',
  scheduleType: 'cron',
  cron: '0 9 * * *',
  atLocal: '',
  ownerThreadId: '',
  cwd: '',
  model: '',
  timeoutSeconds: '1800',
  enabled: true,
};

export function shouldOpenNewAutomationFromSearch(search?: string): boolean {
  const raw = search?.trim();
  if (!raw) return false;
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  return params.get('action') === 'new' || params.get('new') === '1';
}

export function ownerThreadHint(conversation?: Pick<ConversationOption, 'cwd'>): string | undefined {
  return conversation?.cwd ? 'Uses the owner thread working directory.' : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTasks(input: unknown): TaskSummary[] {
  return Array.isArray(input) ? (input as TaskSummary[]) : [];
}

function readConversations(input: unknown): ConversationOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) return null;
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : id;
      const cwd = typeof item.cwd === 'string' && item.cwd.trim() ? item.cwd.trim() : undefined;
      return { id, title, cwd } satisfies ConversationOption;
    })
    .filter((item): item is ConversationOption => Boolean(item))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function readModels(input: unknown): ModelOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) return null;
      return {
        id,
        provider: typeof item.provider === 'string' ? item.provider : undefined,
        name: typeof item.name === 'string' ? item.name : undefined,
        label: typeof item.label === 'string' ? item.label : undefined,
      } satisfies ModelOption;
    })
    .filter((item): item is ModelOption => Boolean(item));
}

function taskTitle(task: TaskSummary): string {
  return task.title?.trim() || task.id;
}

function automationResourceId(taskId: string): string {
  return `automation:${taskId}`;
}

function automationSelectionPayload(data: AutomationSelectionData | null) {
  if (!data) return null;
  if (data.kind === 'new') {
    return {
      kind: 'resource',
      resource: {
        type: 'automation',
        id: 'automation:new',
        label: 'New automation',
        source: 'system-automations',
        data,
      },
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    kind: 'resource',
    resource: {
      type: 'automation',
      id: automationResourceId(data.task.id),
      label: taskTitle(data.task),
      source: 'system-automations',
      data,
    },
    updatedAt: new Date().toISOString(),
  };
}

function isAutomationSelection(value: unknown): value is { resource: { type: 'automation'; id: string; data?: AutomationSelectionData } } {
  if (!value || typeof value !== 'object') return false;
  const resource = (value as { resource?: unknown }).resource;
  if (!resource || typeof resource !== 'object') return false;
  const typed = resource as { type?: unknown; id?: unknown; data?: unknown };
  return typed.type === 'automation' && typeof typed.id === 'string';
}

function isAutomationSelectionData(value: unknown): value is AutomationSelectionData {
  if (!value || typeof value !== 'object') return false;
  const typed = value as { kind?: unknown; task?: unknown };
  if (typed.kind === 'new') return true;
  return (
    (typed.kind === 'automation' || typed.kind === 'edit') &&
    Boolean(typed.task && typeof typed.task === 'object' && typeof (typed.task as { id?: unknown }).id === 'string')
  );
}

function scheduleText(task: TaskSummary): string {
  if (task.scheduleType === 'at') return `Once · ${formatDateTime(task.at)}`;
  const cron = task.cron?.trim();
  const preset = CRON_PRESETS.find((item) => item.value === cron);
  return preset ? preset.label : (cron ?? 'Invalid schedule');
}

function windowedAutomationMeta(task: TaskSummary): string {
  const owner = task.threadTitle || task.threadConversationId || 'No owner thread';
  const pieces = [scheduleText(task), `Next ${nextRunText(task)}`, owner];
  const prompt = task.prompt?.trim();
  if (prompt) pieces.push(prompt);
  return pieces.join(' · ');
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

function statusLabel(task: TaskSummary): string {
  if (task.running) return 'Running';
  if (!task.enabled) return 'Paused';
  if (task.lastStatus === 'failed') return 'Failed';
  return 'On';
}

function statusPillTone(task: TaskSummary): 'accent' | 'steel' | 'danger' | 'success' {
  if (task.running) return 'accent';
  if (!task.enabled) return 'steel';
  if (task.lastStatus === 'failed') return 'danger';
  return 'success';
}

function windowedStatusTone(task: TaskSummary): 'neutral' | 'positive' | 'warning' | 'danger' {
  if (task.running) return 'warning';
  if (!task.enabled) return 'neutral';
  if (task.lastStatus === 'failed') return 'danger';
  return 'positive';
}

function parseCronPart(part: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  for (const raw of part.split(',')) {
    const item = raw.trim();
    if (!item) return null;
    const [rangePart, stepPart] = item.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isSafeInteger(step) || step < 1) return null;
    let start = min;
    let end = max;
    if (rangePart !== '*') {
      const [left, right] = rangePart.split('-');
      start = Number(left);
      end = right === undefined ? start : Number(right);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < min || end > max || start > end) return null;
    for (let value = start; value <= end; value += step) out.add(value);
  }
  return out;
}

function setContainsRange(values: Set<number>, min: number, max: number): boolean {
  for (let value = min; value <= max; value += 1) {
    if (!values.has(value)) return false;
  }
  return true;
}

export function cronMatches(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const minute = parseCronPart(parts[0] ?? '', 0, 59);
  const hour = parseCronPart(parts[1] ?? '', 0, 23);
  const dayOfMonth = parseCronPart(parts[2] ?? '', 1, 31);
  const month = parseCronPart(parts[3] ?? '', 1, 12);
  const dayOfWeek = parseCronPart(parts[4] ?? '', 0, 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;
  const dow = date.getDay();
  const dayOfMonthWildcard = setContainsRange(dayOfMonth, 1, 31);
  const dayOfWeekWildcard = setContainsRange(dayOfWeek, 0, 6);
  const dayOfMonthMatch = dayOfMonth.has(date.getDate());
  const dayOfWeekMatch = dayOfWeek.has(dow) || (dow === 0 && dayOfWeek.has(7));
  const dayMatches =
    dayOfMonthWildcard && dayOfWeekWildcard
      ? true
      : dayOfMonthWildcard
        ? dayOfWeekMatch
        : dayOfWeekWildcard
          ? dayOfMonthMatch
          : dayOfMonthMatch || dayOfWeekMatch;

  return minute.has(date.getMinutes()) && hour.has(date.getHours()) && month.has(date.getMonth() + 1) && dayMatches;
}

function nextRunText(task: TaskSummary): string {
  if (!task.enabled) return 'Paused';
  if (task.running) return 'Now';
  if (task.scheduleType === 'at') {
    if (!task.at) return '—';
    const ms = Date.parse(task.at);
    if (!Number.isFinite(ms)) return task.at;
    if (ms <= Date.now()) return task.lastRunAt ? 'Completed' : 'Due now';
    return formatDateTime(task.at);
  }
  const cron = task.cron?.trim();
  if (!cron) return '—';
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  for (let i = 0; i < 366 * 24 * 60; i += 1) {
    cursor.setMinutes(cursor.getMinutes() + 1);
    if (cronMatches(cron, cursor)) return formatDateTime(cursor.toISOString());
  }
  return 'Unable to calculate';
}

function lastRunText(task: TaskSummary): string {
  return task.lastRunAt ? timeAgo(task.lastRunAt) : 'Never';
}

function sortTasks(tasks: TaskSummary[]): TaskSummary[] {
  const rank = (task: TaskSummary) => (task.running ? 0 : task.lastStatus === 'failed' ? 1 : task.enabled ? 2 : 3);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || taskTitle(a).localeCompare(taskTitle(b)));
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function cronSelectValue(cron: string): string {
  return CRON_PRESETS.some((preset) => preset.value === cron) ? cron : CUSTOM_VALUE;
}

function timeoutSelectValue(timeoutSeconds: string): string {
  const numeric = Number(timeoutSeconds);
  return TIMEOUT_PRESETS.some((preset) => preset.value === numeric) ? timeoutSeconds : CUSTOM_VALUE;
}

function parseTimeoutSeconds(raw: string): number | undefined {
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMEOUT_SECONDS ? value : undefined;
}

function formFromTask(task: TaskSummary): AutomationFormState {
  return {
    id: task.id,
    title: taskTitle(task),
    prompt: task.prompt ?? '',
    scheduleType: task.scheduleType === 'at' ? 'at' : 'cron',
    cron: task.cron || '0 9 * * *',
    atLocal: isoToLocalInput(task.at),
    ownerThreadId: task.threadConversationId ?? '',
    cwd: task.cwd ?? '',
    model: task.model ?? '',
    timeoutSeconds: String(task.timeoutSeconds ?? 1800),
    enabled: task.enabled ?? true,
  };
}

function buildSaveInput(form: AutomationFormState): Record<string, unknown> {
  const timeoutSeconds = parseTimeoutSeconds(form.timeoutSeconds);
  return {
    title: form.title.trim(),
    prompt: form.prompt.trim(),
    enabled: form.enabled,
    targetType: 'conversation',
    threadMode: 'existing',
    threadConversationId: form.ownerThreadId,
    cwd: form.cwd.trim() || undefined,
    model: form.model.trim() || undefined,
    timeoutSeconds,
    cron: form.scheduleType === 'cron' ? form.cron.trim() : null,
    at: form.scheduleType === 'at' ? localInputToIso(form.atLocal) : null,
  };
}

function groupedModels(models: ModelOption[]): Array<[string, ModelOption[]]> {
  const groups = new Map<string, ModelOption[]>();
  for (const model of models) groups.set(model.provider ?? 'Models', [...(groups.get(model.provider ?? 'Models') ?? []), model]);
  return Array.from(groups.entries());
}

function modelLabel(model: ModelOption): string {
  return model.label ?? model.name ?? model.id;
}

export function AutomationsPage({ pa, context }: { pa: NativeExtensionClient; context?: AutomationsPageContext }) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [activeAutomation, setActiveAutomation] = useState<AutomationSelectionData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rowMenuBaseId = useId();
  const loadRequestIdRef = useRef(0);
  const handledRouteSearchRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setError(null);
    try {
      const taskList = await pa.automations.list();
      if (loadRequestIdRef.current !== requestId) return;
      setTasks(readTasks(taskList));
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscribe = (
      pa as NativeExtensionClient & {
        ui?: NativeExtensionClient['ui'] & {
          subscribeInvalidations?: (handler: (event: { topics: string[] }) => void) => { unsubscribe: () => void };
        };
      }
    ).ui?.subscribeInvalidations;
    if (!subscribe) return;
    const subscription = subscribe((event) => {
      if (event.topics?.some((topic) => topic === 'automation' || topic === 'automations' || topic === 'tasks')) void load();
    });
    return () => subscription.unsubscribe();
  }, [load, pa]);

  useEffect(() => {
    if (!tasks.some((task) => task.running)) return;
    const timer = window.setInterval(() => {
      void load();
    }, RUNNING_AUTOMATIONS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load, tasks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, AUTOMATIONS_RECONCILE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const closeOnOutsideEvent = (event: Event) => {
      const target = event.target;
      const menuRoot = target instanceof Element ? target.closest('[data-automation-row-menu]') : null;
      if (menuRoot?.getAttribute('data-automation-row-menu') === rowMenu.taskId) return;
      close();
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', closeOnOutsideEvent, true);
    document.addEventListener('click', closeOnOutsideEvent, true);
    document.addEventListener('keydown', closeOnKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideEvent, true);
      document.removeEventListener('click', closeOnOutsideEvent, true);
      document.removeEventListener('keydown', closeOnKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [rowMenu]);

  const openCreate = useCallback(() => {
    setRowMenu(null);
    setActiveAutomation({ kind: 'new' });
  }, []);

  useEffect(() => {
    const search = context?.search ?? '';
    if (!shouldOpenNewAutomationFromSearch(search)) {
      handledRouteSearchRef.current = null;
      return;
    }
    if (handledRouteSearchRef.current === search) return;
    handledRouteSearchRef.current = search;
    openCreate();
  }, [context?.search, openCreate]);

  const visibleTasks = useMemo(() => sortTasks(tasks), [tasks]);

  const selectTask = useCallback((task: TaskSummary, mode: 'automation' | 'edit' = 'automation') => {
    setRowMenu(null);
    setActiveAutomation({ kind: mode, task });
  }, []);

  const updateEnabled = async (task: TaskSummary, enabled: boolean) => {
    setBusy(`${enabled ? 'resume' : 'pause'}:${task.id}`);
    setRowMenu(null);
    try {
      await pa.automations.update(task.id, { enabled, threadConversationId: task.threadConversationId, targetType: 'conversation' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (task: TaskSummary) => {
    if (task.running) {
      return;
    }
    setBusy(`run:${task.id}`);
    setRowMenu(null);
    try {
      await pa.automations.run(task.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteTask = async (task: TaskSummary) => {
    setRowMenu(null);
    const confirmed = await pa.ui.confirm({
      title: 'Delete automation',
      message: `Delete automation "${taskTitle(task)}"? This cannot be undone.`,
    });
    if (!confirmed) return;
    setBusy(`delete:${task.id}`);
    try {
      await pa.automations.delete(task.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const openOwnerThread = async (task: TaskSummary) => {
    const conversationId = task.threadConversationId?.trim();
    if (!conversationId) return;
    setRowMenu(null);
    try {
      const opened = await pa.commands.execute('conversation.open', { conversationId });
      if (!opened) {
        const navigated = await pa.commands.execute('app.navigate', { to: `/conversations/${encodeURIComponent(conversationId)}` });
        if (!navigated) pa.ui.toast('Could not open the owner thread.', 'warning');
      }
    } catch (err) {
      pa.ui.toast(err instanceof Error ? err.message : 'Could not open the owner thread.', 'warning');
    }
  };

  const activeAutomationTitle = activeAutomation
    ? activeAutomation.kind === 'new'
      ? 'New automation'
      : activeAutomation.kind === 'edit'
        ? 'Edit automation'
        : 'Automation details'
    : '';
  const activeAutomationMeta =
    activeAutomation?.kind && activeAutomation.kind !== 'new'
      ? `${statusLabel(activeAutomation.task)} · ${scheduleText(activeAutomation.task)}`
      : activeAutomation?.kind === 'new'
        ? 'Configure schedule and owner'
        : undefined;
  const dialogPa = activeAutomation
    ? ({
        ...pa,
        selection: {
          ...pa.selection,
          get: () => automationSelectionPayload(activeAutomation),
          set: (nextSelection: unknown) => {
            if (!isAutomationSelection(nextSelection)) {
              setActiveAutomation(null);
              return;
            }
            const data = nextSelection.resource.data;
            setActiveAutomation(isAutomationSelectionData(data) ? data : null);
          },
          subscribe: () => ({ unsubscribe: () => undefined }),
        },
        automations: {
          ...pa.automations,
          create: async (...args: Parameters<NativeExtensionClient['automations']['create']>) => {
            const result = await pa.automations.create(...args);
            await load();
            return result;
          },
          update: async (...args: Parameters<NativeExtensionClient['automations']['update']>) => {
            const result = await pa.automations.update(...args);
            await load();
            return result;
          },
          delete: async (...args: Parameters<NativeExtensionClient['automations']['delete']>) => {
            const result = await pa.automations.delete(...args);
            await load();
            return result;
          },
          run: async (...args: Parameters<NativeExtensionClient['automations']['run']>) => {
            const result = await pa.automations.run(...args);
            await load();
            return result;
          },
        },
      } as NativeExtensionClient)
    : null;

  if (context?.shellPresentation === 'windowed') {
    const runningCount = visibleTasks.filter((task) => task.running).length;
    const failedCount = visibleTasks.filter((task) => task.lastStatus === 'failed').length;
    const pausedCount = visibleTasks.filter((task) => !task.enabled).length;

    return (
      <div className="h-full overflow-hidden">
        <WindowedPageShell layout="standard" className="automations-page-windowed">
          <WindowedPageMain
            title="Automations"
            actions={
              <>
                <WindowedPageButton disabled={loading} onClick={() => void load()}>
                  Refresh
                </WindowedPageButton>
                <WindowedPageButton tone="accent" onClick={openCreate}>
                  New automation
                </WindowedPageButton>
              </>
            }
          >
            {error ? (
              <WindowedPageSection title="Action needed">
                <WindowedStateBlock tone="danger">{error}</WindowedStateBlock>
              </WindowedPageSection>
            ) : null}

            <WindowedPageSection title="Overview" meta={`${visibleTasks.length} total`}>
              <WindowedKeyValueGrid
                items={[
                  { label: 'Running', value: String(runningCount) },
                  { label: 'Failed', value: String(failedCount) },
                  { label: 'Paused', value: String(pausedCount) },
                  { label: 'Enabled', value: String(visibleTasks.filter((task) => task.enabled ?? true).length) },
                ]}
                columns={4}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Task queue">
              {loading && visibleTasks.length === 0 ? <WindowedStateBlock>Loading automations.</WindowedStateBlock> : null}
              {!error && !loading && visibleTasks.length === 0 ? (
                <WindowedEmptyState>Schedule prompts into owner threads for recurring reports, checks, and reminders.</WindowedEmptyState>
              ) : null}
              {visibleTasks.length > 0 ? (
                <WindowedDataTable
                  className="wos-automation-queue"
                  columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}
                >
                  {visibleTasks.map((task) => {
                    const title = taskTitle(task);
                    const runLabel = `Run ${title}`;
                    const toggleLabel = task.enabled ? `Pause ${title}` : `Resume ${title}`;
                    const editLabel = `Edit ${title}`;
                    return (
                      <WindowedDataRow
                        key={task.id}
                        className="wos-automation-queue-row"
                        name={title}
                        meta={windowedAutomationMeta(task)}
                        status={<WindowedBadge tone={windowedStatusTone(task)}>{statusLabel(task)}</WindowedBadge>}
                        action={
                          <span className="wos-automation-row__actions">
                            <WindowedPageButton
                              aria-label={`Open details for ${title}`}
                              title={`Open details for ${title}`}
                              onClick={() => selectTask(task)}
                            >
                              Details
                            </WindowedPageButton>
                            <WindowedPageButton
                              disabled={!task.threadConversationId}
                              aria-label={`Open owner thread for ${title}: ${task.threadTitle || task.threadConversationId || 'None'}`}
                              title={`Open owner thread for ${title}`}
                              onClick={() => void openOwnerThread(task)}
                            >
                              Owner
                            </WindowedPageButton>
                            <WindowedPageButton
                              disabled={task.running || busy === `run:${task.id}`}
                              aria-label={runLabel}
                              title={runLabel}
                              onClick={() => void runNow(task)}
                            >
                              Run
                            </WindowedPageButton>
                            <WindowedPageButton
                              disabled={Boolean(busy?.endsWith(`:${task.id}`))}
                              aria-label={toggleLabel}
                              title={toggleLabel}
                              onClick={() => void updateEnabled(task, !task.enabled)}
                            >
                              {task.enabled ? 'Pause' : 'Resume'}
                            </WindowedPageButton>
                            <WindowedPageButton aria-label={editLabel} title={editLabel} onClick={() => selectTask(task, 'edit')}>
                              Edit
                            </WindowedPageButton>
                          </span>
                        }
                      />
                    );
                  })}
                </WindowedDataTable>
              ) : null}
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        {activeAutomation && dialogPa ? (
          <WindowedDialog
            title={activeAutomationTitle}
            meta={activeAutomationMeta}
            accent="automations"
            onClose={() => setActiveAutomation(null)}
          >
            <AutomationDialogPanel
              key={`${activeAutomation.kind}:${activeAutomation.kind === 'new' ? 'new' : activeAutomation.task.id}`}
              pa={dialogPa}
            />
          </WindowedDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-base">
      <AppPageLayout contentClassName="flex min-h-full flex-col gap-4">
        <AppPageIntro title="Automations" />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <DataTableToolbar
          summary={`${visibleTasks.length} automation${visibleTasks.length === 1 ? '' : 's'}`}
          actions={
            <>
              <IconButton compact aria-label="Refresh automations" title="Refresh automations" onClick={() => void load()}>
                <RefreshIcon />
              </IconButton>
              <Button variant="action" tone="accent" onClick={openCreate}>
                <span aria-hidden="true">+</span>
                New automation
              </Button>
            </>
          }
        />

        <DataTable
          className="min-h-0 overflow-hidden"
          tableClassName="table-fixed"
          columns={
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
          }
        >
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Automation</DataTableHeaderCell>
              <DataTableHeaderCell>Schedule</DataTableHeaderCell>
              <DataTableHeaderCell>Next run</DataTableHeaderCell>
              <DataTableHeaderCell>Last run</DataTableHeaderCell>
              <DataTableHeaderCell>Owner thread</DataTableHeaderCell>
              <DataTableHeaderCell aria-label="Actions" />
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading && tasks.length === 0 ? (
              <DataTableEmptyRow colSpan={7} cellClassName="py-8 text-left">
                <QuietLoadingState label="Loading automations" className="min-h-8" />
              </DataTableEmptyRow>
            ) : null}

            {!loading && visibleTasks.length === 0 ? (
              <DataTableEmptyRow colSpan={7} cellClassName="py-10 text-left">
                <EmptyState
                  title="Schedule work into a conversation"
                  body="Automations run prompts on a one-time or recurring schedule, then write the result back to an owner thread."
                  steps={[
                    'Pick an owner thread so every run is auditable.',
                    'Choose a schedule such as daily, weekdays, or one-time follow-up.',
                    'Use it for project check-ins, release watches, reminders, or recurring reports.',
                  ]}
                  action={
                    <Button variant="action" tone="accent" onClick={openCreate}>
                      <span aria-hidden="true">+</span>
                      New automation
                    </Button>
                  }
                  align="start"
                  className="max-w-[34rem]"
                />
              </DataTableEmptyRow>
            ) : null}

            {visibleTasks.map((task) => (
              <DataTableRow key={task.id}>
                <DataTableCell>
                  <Pill tone={statusPillTone(task)}>{statusLabel(task)}</Pill>
                </DataTableCell>
                <DataTableCell>
                  <div className="min-w-0">
                    <Button
                      variant="ghost"
                      className="max-w-full justify-start truncate px-0 py-0 text-left font-medium text-primary"
                      onClick={() => selectTask(task)}
                    >
                      {taskTitle(task)}
                    </Button>
                    {task.prompt ? <div className="mt-0.5 truncate text-[12px] text-dim">{task.prompt}</div> : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="truncate text-secondary">
                  <span className={cx(task.scheduleType === 'cron' && 'font-mono text-[12px]')}>{scheduleText(task)}</span>
                </DataTableCell>
                <DataTableCell className="truncate text-secondary">{nextRunText(task)}</DataTableCell>
                <DataTableCell className="truncate text-secondary">{lastRunText(task)}</DataTableCell>
                <DataTableCell className="min-w-0 text-secondary">
                  {task.threadConversationId ? (
                    <TextButton
                      aria-label={`Open owner thread for ${taskTitle(task)}: ${task.threadTitle || task.threadConversationId}`}
                      title={`Open ${task.threadTitle || task.threadConversationId}`}
                      tone="accent"
                      className="w-full max-w-full justify-start truncate px-0 py-0 text-left text-[13px]"
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => void openOwnerThread(task)}
                    >
                      {task.threadTitle || task.threadConversationId}
                    </TextButton>
                  ) : (
                    '—'
                  )}
                </DataTableCell>
                <DataTableCell className="relative" data-automation-row-menu={task.id}>
                  <DataTableActionGroup>
                    <IconButton
                      aria-label={`Actions for ${taskTitle(task)}`}
                      title={`Actions for ${taskTitle(task)}`}
                      aria-haspopup="menu"
                      aria-expanded={rowMenu?.taskId === task.id}
                      aria-controls={rowMenu?.taskId === task.id ? `${rowMenuBaseId}-${task.id}` : undefined}
                      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setRowMenu((current) =>
                          current?.taskId === task.id
                            ? null
                            : {
                                taskId: task.id,
                                position: automationRowActionMenuPosition(rect, {
                                  width: window.innerWidth,
                                  height: window.innerHeight,
                                }),
                              },
                        );
                      }}
                    >
                      <MoreIcon />
                    </IconButton>
                  </DataTableActionGroup>
                  {rowMenu?.taskId === task.id ? (
                    <PositionedMenu
                      id={`${rowMenuBaseId}-${task.id}`}
                      aria-label={`Actions for ${taskTitle(task)}`}
                      data-automation-row-menu={task.id}
                      position={rowMenu.position}
                      className="z-50 min-w-36"
                    >
                      <MenuItem disabled={task.running || busy === `run:${task.id}`} onClick={() => void runNow(task)}>
                        Run now
                      </MenuItem>
                      <MenuItem disabled={busy?.endsWith(`:${task.id}`)} onClick={() => void updateEnabled(task, !task.enabled)}>
                        {task.enabled ? 'Pause' : 'Resume'}
                      </MenuItem>
                      <MenuItem onClick={() => selectTask(task)}>Details</MenuItem>
                      <MenuItem onClick={() => selectTask(task, 'edit')}>Edit</MenuItem>
                      <MenuSeparator />
                      <MenuItem tone="danger" disabled={task.running || busy === `delete:${task.id}`} onClick={() => void deleteTask(task)}>
                        Delete
                      </MenuItem>
                    </PositionedMenu>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </AppPageLayout>

      {activeAutomation && dialogPa ? (
        <Dialog className="max-w-3xl" labelledBy="automation-dialog-title" onClose={() => setActiveAutomation(null)}>
          <DialogHeader title={activeAutomationTitle} titleId="automation-dialog-title" />
          <DialogBody className="max-h-[min(78vh,52rem)] overflow-auto">
            <AutomationDialogPanel
              key={`${activeAutomation.kind}:${activeAutomation.kind === 'new' ? 'new' : activeAutomation.task.id}`}
              pa={dialogPa}
            />
          </DialogBody>
        </Dialog>
      ) : null}
    </div>
  );
}

export function AutomationDialogPanel({ pa }: { pa: NativeExtensionClient }) {
  const [selection, setSelection] = useState<AutomationSelectionData | null>(() => {
    const current = pa.selection.get();
    return isAutomationSelection(current) && isAutomationSelectionData(current.resource.data) ? current.resource.data : null;
  });
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickingCwd, setPickingCwd] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const nextTasks = readTasks(await pa.automations.list());
      setTasks(nextTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadReferenceData = useCallback(async () => {
    try {
      const conversationsApi = (pa as NativeExtensionClient & { conversations?: NativeExtensionClient['conversations'] }).conversations;
      const modelsFn = (pa as NativeExtensionClient & { models?: () => Promise<unknown> }).models;
      const [conversationList, modelList] = await Promise.all([
        conversationsApi?.list ? conversationsApi.list() : Promise.resolve([]),
        typeof modelsFn === 'function' ? modelsFn() : Promise.resolve([]),
      ]);
      setConversations(readConversations(conversationList));
      setModels(readModels(modelList));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }, [pa]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    const subscription = pa.selection.subscribe((nextSelection) => {
      if (!isAutomationSelection(nextSelection)) {
        setSelection(null);
        return;
      }
      const data = nextSelection.resource.data;
      setSelection(isAutomationSelectionData(data) ? data : null);
    });
    return () => subscription.unsubscribe();
  }, [pa]);

  useEffect(() => {
    setFormError(null);
    if (!selection) {
      setForm(EMPTY_FORM);
      return;
    }
    if (selection.kind === 'new') {
      setForm((current) => {
        const hasDraft =
          current.id.trim() ||
          current.title.trim() ||
          current.prompt.trim() ||
          current.cwd.trim() ||
          current.model.trim() ||
          current.atLocal.trim() ||
          current.cron !== EMPTY_FORM.cron ||
          current.timeoutSeconds !== EMPTY_FORM.timeoutSeconds;
        if (hasDraft) return { ...current, ownerThreadId: current.ownerThreadId || conversations[0]?.id || '' };
        return { ...EMPTY_FORM, ownerThreadId: conversations[0]?.id ?? '' };
      });
      return;
    }
    if (selection.kind === 'edit') {
      setForm(formFromTask(selection.task));
    }
  }, [conversations, selection]);

  useEffect(() => {
    const subscribe = (
      pa as NativeExtensionClient & {
        ui?: NativeExtensionClient['ui'] & {
          subscribeInvalidations?: (handler: (event: { topics: string[] }) => void) => { unsubscribe: () => void };
        };
      }
    ).ui?.subscribeInvalidations;
    if (!subscribe) return;
    const subscription = subscribe((event) => {
      if (event.topics?.some((topic) => topic === 'automation' || topic === 'automations' || topic === 'tasks')) void load();
    });
    return () => subscription.unsubscribe();
  }, [load, pa]);

  const task = selection && selection.kind !== 'new' ? (tasks.find((item) => item.id === selection.task.id) ?? selection.task) : null;
  const editingTask = selection?.kind === 'edit' ? task : null;
  const editorOpen = selection?.kind === 'new' || selection?.kind === 'edit';
  const ownerConversation = conversations.find((conversation) => conversation.id === form.ownerThreadId);
  const scheduleTypeOptions: Array<{ value: 'cron' | 'at'; label: string }> = [
    { value: 'cron', label: 'Recurring' },
    { value: 'at', label: 'Once' },
  ];
  const cronValue = cronSelectValue(form.cron);
  const timeoutValue = timeoutSelectValue(form.timeoutSeconds);
  const panelTitle = editorOpen ? (editingTask ? 'Edit automation' : 'New automation') : 'Automation details';

  const clearSelection = useCallback(() => {
    pa.selection.set(null);
    setSelection(null);
  }, [pa]);

  const selectDetails = useCallback(
    (nextTask: TaskSummary) => {
      const nextSelection: AutomationSelectionData = { kind: 'automation', task: nextTask };
      setSelection(nextSelection);
      pa.selection.set({
        kind: 'resource',
        resource: {
          type: 'automation',
          id: automationResourceId(nextTask.id),
          label: taskTitle(nextTask),
          source: 'system-automations',
          data: nextSelection,
        },
      });
    },
    [pa],
  );

  const cancelEditor = useCallback(() => {
    if (editingTask) {
      selectDetails(editingTask);
      return;
    }
    clearSelection();
  }, [clearSelection, editingTask, selectDetails]);

  const saveForm = useCallback(async () => {
    if (!form.title.trim() || !form.prompt.trim() || !form.ownerThreadId.trim()) {
      setFormError('Add a name, instructions, and an owner thread.');
      return;
    }
    if (form.scheduleType === 'at' && !form.atLocal.trim()) {
      setFormError('Choose when this one-time automation should run.');
      return;
    }
    if (form.scheduleType === 'cron' && !form.cron.trim()) {
      setFormError('Choose a recurring schedule.');
      return;
    }
    if (!parseTimeoutSeconds(form.timeoutSeconds)) {
      setFormError('Enter a whole-number timeout from 1 second to 7 days.');
      return;
    }
    setBusy('save');
    setFormError(null);
    try {
      if (editingTask) {
        await pa.automations.update(editingTask.id, buildSaveInput(form));
        selectDetails({
          ...editingTask,
          title: form.title.trim(),
          prompt: form.prompt.trim(),
          enabled: form.enabled,
          threadConversationId: form.ownerThreadId,
          cwd: form.cwd.trim() || undefined,
          model: form.model.trim() || undefined,
          timeoutSeconds: parseTimeoutSeconds(form.timeoutSeconds),
          scheduleType: form.scheduleType,
          cron: form.scheduleType === 'cron' ? form.cron.trim() : undefined,
          at: form.scheduleType === 'at' ? (localInputToIso(form.atLocal) ?? undefined) : undefined,
        });
      } else {
        await pa.automations.create({ ...buildSaveInput(form), id: form.id.trim() || undefined });
        clearSelection();
      }
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [clearSelection, editingTask, form, load, pa, selectDetails]);

  const pickCwd = useCallback(async () => {
    setPickingCwd(true);
    try {
      const picked = await pa.pickFolder({ cwd: form.cwd || null, prompt: 'Choose automation working directory' });
      if (!picked.cancelled && picked.path) setForm((current) => ({ ...current, cwd: picked.path ?? '' }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingCwd(false);
    }
  }, [form.cwd, pa]);

  const runNow = useCallback(async () => {
    if (!task || task.running) return;
    setBusy(`run:${task.id}`);
    setError(null);
    try {
      await pa.automations.run(task.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [load, pa, task]);

  const updateEnabled = useCallback(async () => {
    if (!task) return;
    const enabled = !(task.enabled ?? true);
    setBusy(`${enabled ? 'resume' : 'pause'}:${task.id}`);
    setError(null);
    try {
      await pa.automations.update(task.id, { enabled, threadConversationId: task.threadConversationId, targetType: 'conversation' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [load, pa, task]);

  const deleteTask = useCallback(async () => {
    if (!task) return;
    const confirmed = await pa.ui.confirm({
      title: 'Delete automation',
      message: `Delete automation "${taskTitle(task)}"? This cannot be undone.`,
    });
    if (!confirmed) return;
    setBusy(`delete:${task.id}`);
    setError(null);
    try {
      await pa.automations.delete(task.id);
      clearSelection();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [clearSelection, load, pa, task]);

  const openOwnerThread = useCallback(async () => {
    const conversationId = task?.threadConversationId?.trim();
    if (!conversationId) return;
    try {
      const opened = await pa.commands.execute('conversation.open', { conversationId });
      if (!opened) {
        const navigated = await pa.commands.execute('app.navigate', { to: `/conversations/${encodeURIComponent(conversationId)}` });
        if (!navigated) pa.ui.toast('Could not open the owner thread.', 'warning');
      }
    } catch (err) {
      pa.ui.toast(err instanceof Error ? err.message : 'Could not open the owner thread.', 'warning');
    }
  }, [pa, task]);

  const detailTitle = editorOpen ? panelTitle : task ? taskTitle(task) : panelTitle;
  const detailSubtitle = editorOpen
    ? 'Configure schedule and owner'
    : task
      ? `${statusLabel(task)} · ${scheduleText(task)}`
      : 'Select a row to inspect details';

  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Automation context" title={detailTitle} subtitle={detailSubtitle} />
      <ContextRailBody>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {editorOpen ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveForm();
            }}
          >
            {formError ? <Notice tone="danger">{formError}</Notice> : null}

            <Field label="Name">
              <TextInput
                name="automation-title"
                autoFocus
                autoComplete="off"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Morning release check..."
              />
            </Field>

            <Field label="Instructions">
              <Textarea
                name="automation-prompt"
                className="min-h-28 resize-y text-[13px]"
                value={form.prompt}
                onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                placeholder="Check the release dashboard and summarize blockers..."
              />
            </Field>

            <div className="ui-field">
              <FieldLabel>Schedule</FieldLabel>
              <SegmentedControl
                ariaLabel="Schedule type"
                value={form.scheduleType}
                options={scheduleTypeOptions}
                onChange={(next: 'cron' | 'at') => setForm({ ...form, scheduleType: next })}
              />
            </div>

            {form.scheduleType === 'cron' ? (
              <div className="ui-field">
                <FieldLabel>Repeat</FieldLabel>
                <Select
                  name="automation-cron-preset"
                  aria-label="Repeat schedule"
                  value={cronValue}
                  onChange={(event) => {
                    const next = event.target.value;
                    setForm((current) => ({ ...current, cron: next === CUSTOM_VALUE ? '' : next }));
                  }}
                >
                  {CRON_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE}>Custom cron...</option>
                </Select>
                {cronValue === CUSTOM_VALUE ? (
                  <div className="mt-2">
                    <TextInput
                      name="automation-cron"
                      aria-label="Custom cron schedule"
                      autoComplete="off"
                      className="font-mono text-[13px]"
                      value={form.cron}
                      onChange={(event) => setForm({ ...form, cron: event.target.value })}
                      placeholder="0 9 * * *..."
                    />
                    <FieldHint>Five-field cron.</FieldHint>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="ui-field">
                <FieldLabel>Run at</FieldLabel>
                <TextInput
                  type="datetime-local"
                  name="automation-run-at"
                  aria-label="Run at"
                  value={form.atLocal}
                  onChange={(event) => setForm({ ...form, atLocal: event.target.value })}
                />
                {form.scheduleType === 'at' && !form.atLocal ? <FieldError>Pick a date and time.</FieldError> : null}
                <FieldHint>Uses your local timezone.</FieldHint>
              </div>
            )}

            <Field label="Owner thread" hint={ownerThreadHint(ownerConversation)}>
              <Select
                name="automation-owner-thread"
                value={form.ownerThreadId}
                onChange={(event) => setForm({ ...form, ownerThreadId: event.target.value })}
              >
                <option value="">Choose a thread...</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Disclosure summary="Advanced" bodyClassName="grid gap-4 pt-3">
              <Field label="Model" hint="Uses the app default when empty.">
                <Select name="automation-model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}>
                  <option value="">Use app default</option>
                  {groupedModels(models).map(([provider, providerModels]) => (
                    <optgroup key={provider} label={provider}>
                      {providerModels.map((model) => (
                        <option key={`${provider}/${model.id}`} value={model.id}>
                          {modelLabel(model)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>

              <Field label="Timeout">
                <Select
                  name="automation-timeout-preset"
                  aria-label="Timeout"
                  value={timeoutValue}
                  onChange={(event) => {
                    const next = event.target.value;
                    setForm((current) => ({ ...current, timeoutSeconds: next === CUSTOM_VALUE ? '' : next }));
                  }}
                >
                  {TIMEOUT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE}>Custom...</option>
                </Select>
                {timeoutValue === CUSTOM_VALUE ? (
                  <div className="mt-2">
                    <TextInput
                      name="automation-timeout"
                      aria-label="Custom timeout in seconds"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.timeoutSeconds}
                      onChange={(event) => setForm({ ...form, timeoutSeconds: event.target.value })}
                    />
                    {!parseTimeoutSeconds(form.timeoutSeconds) ? (
                      <FieldError>Enter a whole number from 1 to 604800 seconds.</FieldError>
                    ) : null}
                    <FieldHint>Seconds before the run is stopped.</FieldHint>
                  </div>
                ) : null}
              </Field>

              <div className="ui-field">
                <FieldLabel>Working directory</FieldLabel>
                <div className="flex gap-2">
                  <TextInput
                    name="automation-cwd"
                    aria-label="Working directory"
                    autoComplete="off"
                    className="min-w-0 flex-1 font-mono text-[12px]"
                    value={form.cwd}
                    onChange={(event) => setForm({ ...form, cwd: event.target.value })}
                    placeholder="Thread default..."
                  />
                  <BrowsePathButton
                    busy={pickingCwd}
                    title="Choose working directory"
                    ariaLabel="Choose automation working directory"
                    onClick={() => void pickCwd()}
                  />
                </div>
              </div>
            </Disclosure>

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
              <Button variant="ghost" type="button" onClick={cancelEditor}>
                Cancel
              </Button>
              <Button type="submit" variant="action" tone="accent" disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving...' : editingTask ? 'Save automation' : 'Create automation'}
              </Button>
            </div>
          </form>
        ) : null}
        {!editorOpen && loading && !task ? <QuietLoadingState label="Loading automations" className="min-h-12" /> : null}
        {!editorOpen && !loading && !task ? (
          <EmptyState
            eyebrow="Context rail"
            title="No automation selected"
            body="Select an automation to inspect schedule, owner, and run controls without leaving the table."
            steps={[
              'Pick a row in the automations table.',
              'Review schedule and owner details here.',
              'Run, pause, or edit from this rail.',
            ]}
            align="start"
          />
        ) : null}
        {!editorOpen && task ? (
          <div className="space-y-5">
            {task.prompt ? <p className="text-[12px] leading-5 text-secondary">{task.prompt}</p> : null}

            <ContextRailSection
              title="Actions"
              actions={<Pill tone={statusPillTone(task)}>{statusLabel(task)}</Pill>}
              bodyClassName="flex flex-wrap gap-2"
            >
              <Button variant="toolbar" disabled={task.running || busy === `run:${task.id}`} onClick={() => void runNow()}>
                Run now
              </Button>
              <Button variant="toolbar" disabled={Boolean(busy?.endsWith(`:${task.id}`))} onClick={() => void updateEnabled()}>
                {(task.enabled ?? true) ? 'Pause' : 'Resume'}
              </Button>
              <Button
                variant="toolbar"
                tone="danger"
                disabled={task.running || busy === `delete:${task.id}`}
                onClick={() => void deleteTask()}
              >
                Delete
              </Button>
            </ContextRailSection>

            <ContextRailSection title="Schedule">
              <KeyValueList>
                <KeyValueItem label="Next run" value={nextRunText(task)} />
                <KeyValueItem label="Last run" value={lastRunText(task)} />
                <KeyValueItem label="Type" value={task.scheduleType === 'at' ? 'Once' : 'Recurring'} />
                {task.cron ? <KeyValueItem label="Cron" value={<span className="font-mono">{task.cron}</span>} /> : null}
                {task.at ? <KeyValueItem label="Run at" value={task.at} /> : null}
              </KeyValueList>
            </ContextRailSection>

            <ContextRailSection title="Owner">
              {task.threadConversationId ? (
                <TextButton className="max-w-full text-left" tone="accent" onClick={() => void openOwnerThread()}>
                  {task.threadTitle || task.threadConversationId}
                </TextButton>
              ) : (
                <PanelMessage className="py-1">No owner thread.</PanelMessage>
              )}
              <KeyValueList>
                {task.cwd ? <KeyValueItem label="Directory" value={<span className="font-mono">{task.cwd}</span>} /> : null}
                {task.model ? <KeyValueItem label="Model" value={<span className="font-mono">{task.model}</span>} /> : null}
                {task.timeoutSeconds ? <KeyValueItem label="Timeout" value={`${task.timeoutSeconds}s`} /> : null}
              </KeyValueList>
            </ContextRailSection>
          </div>
        ) : null}
      </ContextRailBody>
    </ContextRail>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 7a5 5 0 0 0-8.5-3.2L3 5.3" />
      <path d="M3 2.8v2.5h2.5" />
      <path d="M3 9a5 5 0 0 0 8.5 3.2L13 10.7" />
      <path d="M13 13.2v-2.5h-2.5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12.5" cy="8" r="1.15" />
    </svg>
  );
}
