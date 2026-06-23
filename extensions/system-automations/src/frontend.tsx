import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  BrowsePathButton,
  Button,
  cx,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Disclosure,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
  LoadingState,
  MenuItem,
  MenuSeparator,
  Notice,
  Pill,
  PositionedMenu,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  TextInput,
} from '@neon-pilot/extensions/ui';
import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';

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
  if (task.scheduleType === 'at') return `Once · ${formatDateTime(task.at)}`;
  const cron = task.cron?.trim();
  const preset = CRON_PRESETS.find((item) => item.value === cron);
  return preset ? preset.label : (cron ?? 'Invalid schedule');
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
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pickingCwd, setPickingCwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const titleId = useId();
  const rowMenuBaseId = useId();

  const load = useCallback(async () => {
    setError(null);
    try {
      const conversationsApi = (pa as NativeExtensionClient & { conversations?: NativeExtensionClient['conversations'] }).conversations;
      const modelsFn = (pa as NativeExtensionClient & { models?: () => Promise<unknown> }).models;
      const [taskList, conversationList, modelList] = await Promise.all([
        pa.automations.list(),
        conversationsApi?.list ? conversationsApi.list() : Promise.resolve([]),
        typeof modelsFn === 'function' ? modelsFn() : Promise.resolve([]),
      ]);
      setTasks(readTasks(taskList));
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

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ownerThreadId: conversations[0]?.id ?? '' });
    setFormError(null);
    setMenuTaskId(null);
    setDialogOpen(true);
  }, [conversations]);

  useEffect(() => {
    if (shouldOpenNewAutomationFromSearch(context?.search)) openCreate();
  }, [context?.search, openCreate]);

  const visibleTasks = useMemo(() => sortTasks(tasks), [tasks]);

  const openEdit = useCallback((task: TaskSummary) => {
    setEditingId(task.id);
    setForm(formFromTask(task));
    setFormError(null);
    setMenuTaskId(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = () => {
    if (busy === 'save') return;
    setDialogOpen(false);
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
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  const updateEnabled = async (task: TaskSummary, enabled: boolean) => {
    setBusy(`${enabled ? 'resume' : 'pause'}:${task.id}`);
    setMenuTaskId(null);
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
    setMenuTaskId(null);
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
    setMenuTaskId(null);
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
      <AppPageLayout contentClassName="flex min-h-full flex-col gap-4">
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

        <DataTable
          className="min-h-0 overflow-hidden"
          tableClassName="table-fixed"
          columns={
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
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
                <LoadingState label="Loading automations…" />
              </DataTableEmptyRow>
            ) : null}

            {!loading && visibleTasks.length === 0 ? (
              <DataTableEmptyRow colSpan={7} cellClassName="py-8 text-left">
                No automations yet.
              </DataTableEmptyRow>
            ) : null}

            {visibleTasks.map((task) => (
              <DataTableRow key={task.id}>
                <DataTableCell>
                  <Pill tone={statusPillTone(task)}>{statusLabel(task)}</Pill>
                </DataTableCell>
                <DataTableCell>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left font-medium text-primary hover:text-accent focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      onClick={() => openEdit(task)}
                    >
                      {taskTitle(task)}
                    </button>
                    {task.prompt ? <div className="mt-0.5 truncate text-[12px] text-dim">{task.prompt}</div> : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="truncate text-secondary">
                  <span className={cx(task.scheduleType === 'cron' && 'font-mono text-[12px]')}>{scheduleText(task)}</span>
                </DataTableCell>
                <DataTableCell className="truncate text-secondary">{nextRunText(task)}</DataTableCell>
                <DataTableCell className="truncate text-secondary">{lastRunText(task)}</DataTableCell>
                <DataTableCell className="truncate text-secondary">{task.threadTitle || task.threadConversationId || '—'}</DataTableCell>
                <DataTableCell className="relative">
                  <DataTableActionGroup>
                    <IconButton
                      aria-label={`Actions for ${taskTitle(task)}`}
                      title={`Actions for ${taskTitle(task)}`}
                      aria-haspopup="menu"
                      aria-expanded={menuTaskId === task.id}
                      aria-controls={menuTaskId === task.id ? `${rowMenuBaseId}-${task.id}` : undefined}
                      onClick={() => setMenuTaskId((current) => (current === task.id ? null : task.id))}
                    >
                      <MoreIcon />
                    </IconButton>
                  </DataTableActionGroup>
                  {menuTaskId === task.id ? (
                    <PositionedMenu
                      id={`${rowMenuBaseId}-${task.id}`}
                      aria-label={`Actions for ${taskTitle(task)}`}
                      placement="absolute"
                      position={{ top: 34, right: 8 }}
                      className="z-20 min-w-36"
                    >
                      <MenuItem disabled={busy === `run:${task.id}`} onClick={() => void runNow(task)}>
                        Run now
                      </MenuItem>
                      <MenuItem disabled={busy?.endsWith(`:${task.id}`)} onClick={() => void updateEnabled(task, !task.enabled)}>
                        {task.enabled ? 'Pause' : 'Resume'}
                      </MenuItem>
                      <MenuItem onClick={() => openEdit(task)}>Edit</MenuItem>
                      <MenuSeparator />
                      <MenuItem tone="danger" disabled={busy === `delete:${task.id}`} onClick={() => void deleteTask(task)}>
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

      {dialogOpen ? (
        <Dialog portal onClose={closeDialog} labelledBy={titleId} className="max-w-[42rem]">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitForm}>
            <DialogHeader title={editingTitle} titleId={titleId} />
            <DialogBody className="grid flex-1 gap-4">
              {formError ? <Notice tone="danger">{formError}</Notice> : null}

              <Field label="Name">
                <TextInput
                  name="automation-title"
                  autoFocus
                  autoComplete="off"
                  value={form.title}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: event.target.value })}
                  placeholder="Morning release check…"
                />
              </Field>

              <Field label="Instructions">
                <Textarea
                  name="automation-prompt"
                  className="min-h-28 resize-y text-[13px]"
                  value={form.prompt}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, prompt: event.target.value })}
                  placeholder="Check the release dashboard and summarize blockers…"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
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
                          name="automation-cron"
                          aria-label="Custom cron schedule"
                          autoComplete="off"
                          className="font-mono text-[13px]"
                          value={form.cron}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cron: event.target.value })}
                          placeholder="0 9 * * *…"
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
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, atLocal: event.target.value })}
                    />
                    {form.scheduleType === 'at' && !form.atLocal ? <FieldError>Pick a date and time.</FieldError> : null}
                    <FieldHint>Uses your local timezone.</FieldHint>
                  </div>
                )}
              </div>

              <Field label="Owner thread" hint={ownerConversation?.cwd ? `Working from ${ownerConversation.cwd}` : undefined}>
                <Select
                  name="automation-owner-thread"
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

              <Disclosure summary="Advanced" bodyClassName="grid gap-4 pt-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Model" hint="Uses the app default when empty.">
                    <Select
                      name="automation-model"
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
                      name="automation-timeout-preset"
                      aria-label="Timeout"
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
                          name="automation-timeout"
                          aria-label="Custom timeout in seconds"
                          inputMode="numeric"
                          autoComplete="off"
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
                      name="automation-cwd"
                      aria-label="Working directory"
                      autoComplete="off"
                      className="min-w-0 flex-1 font-mono text-[12px]"
                      value={form.cwd}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cwd: event.target.value })}
                      placeholder="Thread default…"
                    />
                    <BrowsePathButton
                      busy={pickingCwd}
                      title="Choose working directory"
                      ariaLabel="Choose automation working directory"
                      onClick={() => void pickCwd()}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
                  <FieldLabel>Enabled</FieldLabel>
                  <Switch
                    checked={form.enabled}
                    onClick={() => setForm({ ...form, enabled: !form.enabled })}
                    aria-label="Enable automation"
                  />
                </div>
              </Disclosure>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="action" tone="accent" disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving…' : editingId ? 'Save automation' : 'Create automation'}
              </Button>
            </DialogFooter>
          </form>
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

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12.5" cy="8" r="1.15" />
    </svg>
  );
}
