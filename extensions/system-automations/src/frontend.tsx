import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  BrowsePathButton,
  Button,
  cx,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
  KeyValueItem,
  KeyValueList,
  LoadingState,
  Notice,
  Pill,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  Select,
  SupportingText,
  Switch,
  Textarea,
  TextInput,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

interface SchedulerHealth {
  status?: string;
  lastEvaluatedAt?: string;
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

type AutomationsPageContext = { search?: string };

const CRON_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0 9 * * *', label: 'Every day at 9:00 AM' },
  { value: '0 12 * * *', label: 'Every day at 12:00 PM' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 9 * * 1', label: 'Every Monday at 9:00 AM' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
  { value: '0 9 1 * *', label: 'First of the month at 9:00 AM' },
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTasks(input: unknown): TaskSummary[] {
  return Array.isArray(input) ? (input as TaskSummary[]) : [];
}

function readHealth(input: unknown): SchedulerHealth | null {
  return isRecord(input) && typeof input.status === 'string' ? (input as unknown as SchedulerHealth) : null;
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

function scheduleText(task: TaskSummary): string {
  return task.scheduleType === 'at' ? `Once · ${formatDateTime(task.at)}` : `Recurring · ${task.cron ?? 'invalid schedule'}`;
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
  return 'Scheduled';
}

function statusPillTone(task: TaskSummary): 'accent' | 'steel' | 'danger' | 'success' {
  if (task.running) return 'accent';
  if (!task.enabled) return 'steel';
  if (task.lastStatus === 'failed') return 'danger';
  return 'success';
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

function cronMatches(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const minute = parseCronPart(parts[0] ?? '', 0, 59);
  const hour = parseCronPart(parts[1] ?? '', 0, 23);
  const dayOfMonth = parseCronPart(parts[2] ?? '', 1, 31);
  const month = parseCronPart(parts[3] ?? '', 1, 12);
  const dayOfWeek = parseCronPart(parts[4] ?? '', 0, 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;
  const dow = date.getDay();
  return (
    minute.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    dayOfMonth.has(date.getDate()) &&
    month.has(date.getMonth() + 1) &&
    (dayOfWeek.has(dow) || (dow === 0 && dayOfWeek.has(7)))
  );
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
  return {
    title: form.title.trim(),
    prompt: form.prompt.trim(),
    enabled: form.enabled,
    targetType: 'conversation',
    threadMode: 'existing',
    threadConversationId: form.ownerThreadId,
    cwd: form.cwd.trim() || undefined,
    model: form.model.trim() || undefined,
    timeoutSeconds: Number(form.timeoutSeconds) || undefined,
    cron: form.scheduleType === 'cron' ? form.cron.trim() : null,
    at: form.scheduleType === 'at' ? localInputToIso(form.atLocal) : null,
  };
}

function formSchedulePreview(form: AutomationFormState): string {
  if (form.scheduleType === 'at') {
    const iso = localInputToIso(form.atLocal);
    return iso ? `Once · ${formatDateTime(iso)}` : 'Once · not scheduled';
  }
  const preset = CRON_PRESETS.find((item) => item.value === form.cron);
  return preset ? `Recurring · ${preset.label}` : `Recurring · ${form.cron || 'custom cron'}`;
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
  const [health, setHealth] = useState<SchedulerHealth | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pickingCwd, setPickingCwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(context?.search ?? '');

  const load = useCallback(async () => {
    setError(null);
    try {
      const conversationsApi = (pa as NativeExtensionClient & { conversations?: NativeExtensionClient['conversations'] }).conversations;
      const modelsFn = (pa as NativeExtensionClient & { models?: () => Promise<unknown> }).models;
      const [taskList, schedulerHealth, conversationList, modelList] = await Promise.all([
        pa.automations.list(),
        pa.automations.readSchedulerHealth(),
        conversationsApi?.list ? conversationsApi.list() : Promise.resolve([]),
        typeof modelsFn === 'function' ? modelsFn() : Promise.resolve([]),
      ]);
      setTasks(readTasks(taskList));
      setHealth(readHealth(schedulerHealth));
      setConversations(readConversations(conversationList));
      setModels(readModels(modelList));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
    if (shouldOpenNewAutomationFromSearch(context?.search)) {
      setEditingId(null);
      setForm((current) => ({ ...EMPTY_FORM, ownerThreadId: current.ownerThreadId }));
      setFormError(null);
      setEditorOpen(true);
    }
  }, [context?.search]);

  useEffect(() => {
    if (loading || tasks.length > 0 || editingId || form.ownerThreadId || !conversations[0]?.id) return;
    setForm((current) => ({ ...current, ownerThreadId: conversations[0]?.id ?? '' }));
  }, [conversations, editingId, form.ownerThreadId, loading, tasks.length]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = sortTasks(tasks);
    if (!query) return sorted;
    return sorted.filter((task) =>
      [task.id, taskTitle(task), task.threadTitle, task.threadConversationId, task.cron, task.at].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [search, tasks]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ownerThreadId: conversations[0]?.id ?? '' });
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (task: TaskSummary) => {
    setEditingId(task.id);
    setForm(formFromTask(task));
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setFormError(null);
  };

  const save = async () => {
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
    setBusy('save');
    setFormError(null);
    try {
      if (editingId) {
        await pa.automations.update(editingId, buildSaveInput(form));
      } else {
        await pa.automations.create({ ...buildSaveInput(form), id: form.id.trim() || undefined });
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const updateEnabled = async (task: TaskSummary, enabled: boolean) => {
    setBusy(`${enabled ? 'resume' : 'pause'}:${task.id}`);
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
    setBusy(`run:${task.id}`);
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
    const confirmed = await pa.ui.confirm({
      title: 'Delete automation',
      message: `Delete automation “${taskTitle(task)}”? This cannot be undone.`,
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

  const pickCwd = async () => {
    setPickingCwd(true);
    try {
      const picked = await pa.pickFolder({ cwd: form.cwd || null, prompt: 'Choose automation working directory' });
      if (!picked.cancelled && picked.path) setForm((current) => ({ ...current, cwd: picked.path ?? '' }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingCwd(false);
    }
  };

  const ownerConversation = conversations.find((conversation) => conversation.id === form.ownerThreadId);
  const scheduleTypeOptions: Array<{ value: 'cron' | 'at'; label: string }> = [
    { value: 'cron', label: 'Recurring' },
    { value: 'at', label: 'Once' },
  ];
  const cronValue = cronSelectValue(form.cron);
  const timeoutValue = timeoutSelectValue(form.timeoutSeconds);
  const editingTitle = editingId ? 'Edit automation' : 'New automation';
  const showEditor = editorOpen || (!loading && tasks.length === 0);
  const selectedTask = editingId ? tasks.find((task) => task.id === editingId) : null;

  return (
    <div className="h-full overflow-y-auto bg-base">
      <AppPageLayout contentClassName="flex min-h-full flex-col gap-5">
        <AppPageIntro
          title="Automations"
          actions={
            <div className="flex items-center gap-2">
              <IconButton aria-label="Refresh automations" title="Refresh automations" onClick={() => void load()}>
                <RefreshIcon />
              </IconButton>
              <Button variant="action" tone="accent" onClick={openCreate}>
                New automation
              </Button>
            </div>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="grid min-h-[calc(100vh-11rem)] gap-5 lg:grid-cols-[25rem_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col border-t border-border-subtle pt-3">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <SectionLabel>Schedules</SectionLabel>
              <div className="flex items-center gap-2 text-[11px] text-dim">
                {loading ? <span>Refreshing…</span> : null}
                <span>
                  Scheduler: {health?.status ?? 'unknown'}
                  {health?.lastEvaluatedAt ? ` · ${timeAgo(health.lastEvaluatedAt)}` : ''}
                </span>
              </div>
            </div>

            <SearchInput
              className="mt-3 w-full"
              placeholder="Search automations…"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            />

            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.25rem] border-y border-border-subtle py-1.5 text-[11px] uppercase tracking-[0.08em] text-dim">
                <span>State</span>
                <span>Name</span>
                <span className="text-right">Next</span>
              </div>

              {loading && tasks.length === 0 ? (
                <LoadingState label="Loading automations…" className="border-b border-border-subtle py-3" />
              ) : null}

              {!loading && visibleTasks.length === 0 ? (
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.25rem] border-b border-border-subtle py-2 text-[12px]">
                  <span className="text-dim">Empty</span>
                  <span className="truncate text-secondary">{search.trim() ? 'No matches' : 'No automations yet'}</span>
                  <span className="text-right text-dim">0</span>
                </div>
              ) : null}

              {visibleTasks.map((task) => {
                const selected = editingId === task.id;
                return (
                  <div key={task.id} className={cx('border-b border-border-subtle px-0 py-2 text-[12px]', selected && 'bg-accent/10')}>
                    <button
                      type="button"
                      className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_5.25rem] items-start gap-2 text-left"
                      onClick={() => openEdit(task)}
                    >
                      <span>
                        <Pill tone={statusPillTone(task)}>{statusLabel(task)}</Pill>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-primary">{taskTitle(task)}</span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-dim">{scheduleText(task)}</span>
                        {task.threadTitle || task.threadConversationId ? (
                          <span className="mt-0.5 block truncate text-[11px] text-secondary">
                            {task.threadTitle || task.threadConversationId}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block truncate text-[11px] text-dim">
                          Last: {task.lastRunAt ? `${timeAgo(task.lastRunAt)} · ${formatDateTime(task.lastRunAt)}` : 'Never'}
                        </span>
                      </span>
                      <span className="truncate text-right text-[11px] text-secondary">{nextRunText(task)}</span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1 pl-[5.5rem]" onClick={(event) => event.stopPropagation()}>
                      <Button className="px-2 py-0.5 text-[11px]" disabled={busy === `run:${task.id}`} onClick={() => void runNow(task)}>
                        Run
                      </Button>
                      <Button
                        className="px-2 py-0.5 text-[11px]"
                        disabled={busy?.endsWith(`:${task.id}`)}
                        onClick={() => void updateEnabled(task, !task.enabled)}
                      >
                        {task.enabled ? 'Pause' : 'Resume'}
                      </Button>
                      <Button className="px-2 py-0.5 text-[11px]" onClick={() => openEdit(task)}>
                        Edit
                      </Button>
                      <Button className="px-2 py-0.5 text-[11px]" tone="danger" onClick={() => void deleteTask(task)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex min-w-0 flex-col border-t border-border-subtle pt-3">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold text-primary">
                  {showEditor ? editingTitle : selectedTask ? taskTitle(selectedTask) : 'Automation details'}
                </h2>
                <p className="mt-0.5 text-[12px] text-dim">
                  {showEditor ? 'Edit the schedule, prompt, and run context inline.' : 'Select an automation to edit its schedule.'}
                </p>
              </div>
              {showEditor ? (
                <div className="flex items-center gap-2">
                  {tasks.length > 0 ? (
                    <Button variant="ghost" onClick={closeEditor}>
                      Close
                    </Button>
                  ) : null}
                  <Button variant="action" tone="accent" disabled={busy === 'save'} onClick={() => void save()}>
                    {busy === 'save' ? 'Saving…' : 'Save automation'}
                  </Button>
                </div>
              ) : null}
            </div>

            {showEditor ? (
              <div className="mt-4 grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0 space-y-4">
                  {formError ? <Notice tone="danger">{formError}</Notice> : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name">
                      <TextInput
                        name="automation-title"
                        autoFocus
                        value={form.title}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: event.target.value })}
                        placeholder="Morning release check"
                      />
                    </Field>
                    <Field label="Owner thread" hint={ownerConversation?.cwd ? `Working from ${ownerConversation.cwd}` : undefined}>
                      <Select
                        name="automation-owner-thread"
                        className="w-full"
                        value={form.ownerThreadId}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, ownerThreadId: event.target.value })}
                      >
                        <option value="">Choose a thread…</option>
                        {conversations.map((conversation) => (
                          <option key={conversation.id} value={conversation.id}>
                            {conversation.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="ui-field">
                      <FieldLabel>Schedule</FieldLabel>
                      <SegmentedControl
                        ariaLabel="Schedule type"
                        value={form.scheduleType}
                        options={scheduleTypeOptions}
                        onChange={(next: 'cron' | 'at') => setForm({ ...form, scheduleType: next })}
                      />
                      <FieldHint>
                        {form.scheduleType === 'cron' ? 'Runs on a repeating cron schedule.' : 'Runs once at the date and time you choose.'}
                      </FieldHint>
                    </div>

                    {form.scheduleType === 'cron' ? (
                      <div className="ui-field">
                        <FieldLabel>Repeat</FieldLabel>
                        <Select
                          className="w-full"
                          value={cronValue}
                          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                            const next = event.target.value;
                            setForm((current) => ({ ...current, cron: next === CUSTOM_VALUE ? current.cron : next }));
                          }}
                        >
                          {CRON_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                          <option value={CUSTOM_VALUE}>Custom cron…</option>
                        </Select>
                        {cronValue === CUSTOM_VALUE ? (
                          <div className="mt-2">
                            <TextInput
                              className="w-full font-mono text-[13px]"
                              value={form.cron}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cron: event.target.value })}
                              placeholder="0 9 * * *"
                            />
                            <FieldHint>Five-field cron: minute hour day-of-month month day-of-week.</FieldHint>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="ui-field">
                        <FieldLabel>Run at</FieldLabel>
                        <TextInput
                          type="datetime-local"
                          className="w-full"
                          value={form.atLocal}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, atLocal: event.target.value })}
                        />
                        {form.scheduleType === 'at' && !form.atLocal ? <FieldError>Pick a date and time.</FieldError> : null}
                        <FieldHint>Times are in your local timezone.</FieldHint>
                      </div>
                    )}
                  </div>

                  <Field label="Instructions" hint="The prompt sent to the agent each time this automation fires.">
                    <Textarea
                      name="automation-prompt"
                      className="min-h-32 w-full resize-y text-[13px]"
                      value={form.prompt}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, prompt: event.target.value })}
                      placeholder="Check the release dashboard and post a summary of anything new."
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Model" hint="Leave on the app default unless this automation needs a specific model.">
                      <Select
                        className="w-full"
                        value={form.model}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, model: event.target.value })}
                      >
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

                    <div className="ui-field">
                      <FieldLabel>Timeout</FieldLabel>
                      <Select
                        className="w-full"
                        value={timeoutValue}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                          const next = event.target.value;
                          setForm((current) => ({ ...current, timeoutSeconds: next === CUSTOM_VALUE ? current.timeoutSeconds : next }));
                        }}
                      >
                        {TIMEOUT_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                        <option value={CUSTOM_VALUE}>Custom…</option>
                      </Select>
                      {timeoutValue === CUSTOM_VALUE ? (
                        <div className="mt-2">
                          <TextInput
                            inputMode="numeric"
                            className="w-full"
                            value={form.timeoutSeconds}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                              setForm({ ...form, timeoutSeconds: event.target.value })
                            }
                          />
                          <FieldHint>Seconds before the run is stopped.</FieldHint>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="ui-field">
                    <FieldLabel>Working directory</FieldLabel>
                    <div className="flex gap-2">
                      <TextInput
                        className="min-w-0 flex-1 font-mono text-[12px]"
                        value={form.cwd}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cwd: event.target.value })}
                        placeholder="Defaults to the owner thread's working directory"
                      />
                      <BrowsePathButton
                        busy={pickingCwd}
                        title="Choose working directory"
                        ariaLabel="Choose automation working directory"
                        onClick={() => void pickCwd()}
                      />
                    </div>
                    <FieldHint>Overrides the owner thread's working directory for this automation's runs.</FieldHint>
                  </div>
                </div>

                <aside className="min-w-0 border-t border-border-subtle pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                  <SectionLabel>Run preview</SectionLabel>
                  <KeyValueList className="mt-3">
                    <KeyValueItem label="State" value={form.enabled ? 'Enabled' : 'Paused'} />
                    <KeyValueItem label="Schedule" value={formSchedulePreview(form)} />
                    <KeyValueItem label="Owner" value={(ownerConversation?.title ?? form.ownerThreadId) || 'Not selected'} />
                    <KeyValueItem label="Timeout" value={`${Number(form.timeoutSeconds) || 0}s`} />
                    <KeyValueItem label="Working dir" value={form.cwd || ownerConversation?.cwd || 'Thread default'} />
                  </KeyValueList>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
                    <div className="min-w-0">
                      <SectionLabel>Enabled</SectionLabel>
                      <SupportingText className="mt-0.5">Paused automations keep their schedule but won't run.</SupportingText>
                    </div>
                    <Switch
                      checked={form.enabled}
                      onClick={() => setForm({ ...form, enabled: !form.enabled })}
                      aria-label="Enable automation"
                    />
                  </div>
                </aside>
              </div>
            ) : (
              <div className="mt-3 grid max-w-xl gap-0 text-[12px]">
                {[
                  ['Status', 'No automation selected'],
                  ['Next run', 'Select a row to inspect or edit'],
                  ['Owner thread', '—'],
                  ['Last run', '—'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-border-subtle py-2">
                    <span className="text-dim">{label}</span>
                    <span className="truncate text-secondary">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </AppPageLayout>
    </div>
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
