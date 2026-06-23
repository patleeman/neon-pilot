import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  BrowsePathButton,
  Button,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
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

  return (
    <div className="h-full overflow-y-auto bg-base">
      <AppPageLayout contentClassName="space-y-6">
        <AppPageIntro
          eyebrow="Automations"
          title="Schedules"
          summary="Every automation belongs to a thread. When it fires, the owner thread reopens in the sidebar and the run is written into the transcript."
          actions={
            <div className="flex items-center gap-2">
              <IconButton aria-label="Refresh schedules" title="Refresh schedules" onClick={() => void load()}>
                <RefreshIcon />
              </IconButton>
              <Button variant="action" tone="accent" onClick={openCreate}>
                New automation
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-2 text-[12px] text-secondary">
          <span>
            Scheduler: {health?.status ?? 'unknown'}
            {health?.lastEvaluatedAt ? ` · checked ${timeAgo(health.lastEvaluatedAt)}` : ''}
          </span>
        </div>

        {error ? (
          <Notice tone="danger" title="Something went wrong">
            {error}
          </Notice>
        ) : null}

        <AppPageSection
          title="Schedules"
          description="Automations run on the schedule you set and post their results into the owner thread."
          actions={
            <SearchInput
              className="w-64"
              placeholder="Search schedules…"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            />
          }
        >
          {loading && tasks.length === 0 ? (
            <LoadingState label="Loading schedules…" className="py-10" />
          ) : visibleTasks.length === 0 ? (
            <EmptyState
              title={search.trim() ? 'No schedules match your search.' : 'No automations yet.'}
              body={search.trim() ? 'Try a different search term.' : 'Create one and bind it to a thread.'}
              action={
                search.trim() ? null : (
                  <Button variant="action" tone="accent" onClick={openCreate}>
                    New automation
                  </Button>
                )
              }
              className="py-10"
            />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Automation</DataTableHeaderCell>
                  <DataTableHeaderCell>Schedule</DataTableHeaderCell>
                  <DataTableHeaderCell>Next run</DataTableHeaderCell>
                  <DataTableHeaderCell>Last run</DataTableHeaderCell>
                  <DataTableHeaderCell>Owner thread</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {visibleTasks.map((task) => (
                  <DataTableRow key={task.id}>
                    <DataTableCell>
                      <div className="flex flex-col gap-1">
                        <Pill tone={statusPillTone(task)}>{statusLabel(task)}</Pill>
                        {task.lastStatus === 'failed' ? <span className="text-[11px] text-danger">Needs attention</span> : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <button className="text-left font-medium text-primary hover:underline" onClick={() => openEdit(task)}>
                        {taskTitle(task)}
                      </button>
                      <div className="mt-0.5 font-mono text-[11px] text-dim">@{task.id}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="font-mono text-[12px] text-secondary">{scheduleText(task)}</span>
                    </DataTableCell>
                    <DataTableCell className="text-secondary">{nextRunText(task)}</DataTableCell>
                    <DataTableCell className="text-secondary">
                      {task.lastRunAt ? `${timeAgo(task.lastRunAt)} · ${formatDateTime(task.lastRunAt)}` : 'Never'}
                    </DataTableCell>
                    <DataTableCell>
                      {task.threadConversationId ? (
                        <button
                          className="text-primary hover:underline"
                          onClick={() => {
                            window.location.href = `/conversations/${encodeURIComponent(task.threadConversationId ?? '')}`;
                          }}
                        >
                          {task.threadTitle || task.threadConversationId}
                        </button>
                      ) : (
                        <span className="text-danger">Missing owner thread</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <DataTableActionGroup>
                        <Button disabled={busy === `run:${task.id}`} onClick={() => void runNow(task)}>
                          Run
                        </Button>
                        <Button disabled={busy?.endsWith(`:${task.id}`)} onClick={() => void updateEnabled(task, !task.enabled)}>
                          {task.enabled ? 'Pause' : 'Resume'}
                        </Button>
                        <Button onClick={() => openEdit(task)}>Edit</Button>
                        <Button tone="danger" onClick={() => void deleteTask(task)}>
                          Delete
                        </Button>
                      </DataTableActionGroup>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </AppPageSection>
      </AppPageLayout>

      {editorOpen ? (
        <Dialog onClose={closeEditor} className="max-w-2xl">
          <DialogHeader title={editingTitle} description="Choose the schedule and the thread where runs will appear." />
          <DialogBody className="space-y-4">
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
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, timeoutSeconds: event.target.value })}
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

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <SectionLabel>Enabled</SectionLabel>
                <SupportingText className="mt-0.5">Paused automations keep their schedule but won't run.</SupportingText>
              </div>
              <Switch checked={form.enabled} onClick={() => setForm({ ...form, enabled: !form.enabled })} aria-label="Enable automation" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button variant="action" tone="accent" disabled={busy === 'save'} onClick={() => void save()}>
              {busy === 'save' ? 'Saving…' : 'Save automation'}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
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
