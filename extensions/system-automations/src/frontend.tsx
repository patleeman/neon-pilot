import type { NativeExtensionClient } from '@neon-pilot/extensions';
import type { ScheduledTaskSchedulerHealth, ScheduledTaskSummary } from '@neon-pilot/extensions/data';
import { timeAgo } from '@neon-pilot/extensions/data';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  ButtonLink,
  Checkbox,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Field,
  FilterToolbar,
  InlineCode,
  Notice,
  SearchInput,
  Select,
  StatusDot,
  type StatusDotTone,
  SurfacePanel,
  Textarea,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ConversationOption {
  id: string;
  title: string;
  cwd?: string;
}

interface AutomationFormState {
  id: string;
  title: string;
  prompt: string;
  scheduleType: 'cron' | 'at';
  cron: string;
  at: string;
  ownerThreadId: string;
  cwd: string;
  model: string;
  timeoutSeconds: string;
  enabled: boolean;
}

type AutomationsPageContext = { search?: string };

export function shouldOpenNewAutomationFromSearch(search?: string): boolean {
  const raw = search?.trim();
  if (!raw) return false;
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  return params.get('action') === 'new' || params.get('new') === '1';
}

const EMPTY_FORM: AutomationFormState = {
  id: '',
  title: '',
  prompt: '',
  scheduleType: 'cron',
  cron: '0 9 * * *',
  at: '',
  ownerThreadId: '',
  cwd: '',
  model: '',
  timeoutSeconds: '1800',
  enabled: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTasks(input: unknown): ScheduledTaskSummary[] {
  return Array.isArray(input) ? (input as ScheduledTaskSummary[]) : [];
}

function readHealth(input: unknown): ScheduledTaskSchedulerHealth | null {
  return isRecord(input) && typeof input.status === 'string' ? (input as unknown as ScheduledTaskSchedulerHealth) : null;
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

function taskTitle(task: ScheduledTaskSummary): string {
  return task.title?.trim() || task.id;
}

function scheduleText(task: ScheduledTaskSummary): string {
  return task.scheduleType === 'at' ? `Once · ${formatDateTime(task.at)}` : `Recurring · ${task.cron ?? 'invalid schedule'}`;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

function statusText(task: ScheduledTaskSummary): string {
  if (task.running) return 'Running';
  if (!task.enabled) return 'Paused';
  if (task.lastStatus === 'failed') return 'Failed';
  return 'Scheduled';
}

function statusTone(task: ScheduledTaskSummary): StatusDotTone {
  if (task.running) return 'steel';
  if (!task.enabled) return 'muted';
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

function nextRunText(task: ScheduledTaskSummary): string {
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

function sortTasks(tasks: ScheduledTaskSummary[]): ScheduledTaskSummary[] {
  const rank = (task: ScheduledTaskSummary) => (task.running ? 0 : task.lastStatus === 'failed' ? 1 : task.enabled ? 2 : 3);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || taskTitle(a).localeCompare(taskTitle(b)));
}

function formFromTask(task: ScheduledTaskSummary): AutomationFormState {
  return {
    id: task.id,
    title: taskTitle(task),
    prompt: task.prompt ?? '',
    scheduleType: task.scheduleType === 'at' ? 'at' : 'cron',
    cron: task.cron ?? '0 9 * * *',
    at: task.at ?? '',
    ownerThreadId: task.threadConversationId ?? '',
    cwd: task.cwd ?? '',
    model: task.model ?? '',
    timeoutSeconds: String(task.timeoutSeconds ?? 1800),
    enabled: task.enabled,
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
    at: form.scheduleType === 'at' ? form.at.trim() : null,
  };
}

export function AutomationsPage({ pa, context }: { pa: NativeExtensionClient; context?: AutomationsPageContext }) {
  const [tasks, setTasks] = useState<ScheduledTaskSummary[]>([]);
  const [health, setHealth] = useState<ScheduledTaskSchedulerHealth | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(context?.search ?? '');

  const load = useCallback(async () => {
    setError(null);
    try {
      const conversationsApi = (pa as NativeExtensionClient & { conversations?: NativeExtensionClient['conversations'] }).conversations;
      const [taskList, schedulerHealth, conversationList] = await Promise.all([
        pa.automations.list(),
        pa.automations.readSchedulerHealth(),
        conversationsApi?.list ? conversationsApi.list() : Promise.resolve([]),
      ]);
      setTasks(readTasks(taskList));
      setHealth(readHealth(schedulerHealth));
      setConversations(readConversations(conversationList));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (shouldOpenNewAutomationFromSearch(context?.search)) {
      setEditingId(null);
      setForm((current) => ({ ...EMPTY_FORM, ownerThreadId: current.ownerThreadId }));
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
    setEditorOpen(true);
  };

  const openEdit = (task: ScheduledTaskSummary) => {
    setEditingId(task.id);
    setForm(formFromTask(task));
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.prompt.trim() || !form.ownerThreadId.trim()) {
      setError('Add a name, instructions, and an owner thread.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      if (editingId) {
        await pa.automations.update(editingId, buildSaveInput(form));
      } else {
        await pa.automations.create({ ...buildSaveInput(form), id: form.id.trim() || undefined });
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const updateEnabled = async (task: ScheduledTaskSummary, enabled: boolean) => {
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

  const runNow = async (task: ScheduledTaskSummary) => {
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

  const deleteTask = async (task: ScheduledTaskSummary) => {
    if (!window.confirm(`Delete automation “${taskTitle(task)}”?`)) return;
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
    try {
      const picked = await pa.pickFolder({ cwd: form.cwd || null, prompt: 'Choose automation working directory' });
      if (!picked.cancelled && picked.path) setForm((current) => ({ ...current, cwd: picked.path ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppPageLayout contentClassName="flex h-full min-h-0 flex-col gap-5">
      <AppPageIntro
        title="Automations"
        summary={
          <span>
            Scheduler: {health?.status ?? 'unknown'}
            {health?.lastEvaluatedAt ? ` · checked ${timeAgo(health.lastEvaluatedAt)}` : ''}
          </span>
        }
        actions={<Button onClick={openCreate}>New Automation</Button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {editorOpen ? (
        <SurfacePanel>
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
            <div className="min-w-0">
              <h2 className="m-0 text-[13px] font-semibold text-primary">{editingId ? 'Edit Automation' : 'New Automation'}</h2>
              <p className="mt-1 text-[12px] text-secondary">Choose the schedule and the thread where runs will appear.</p>
            </div>
            <ToolbarButton onClick={() => setEditorOpen(false)}>Close</ToolbarButton>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="Name">
              <TextInput
                name="automation-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label="Owner Thread">
              <Select
                name="automation-owner-thread"
                value={form.ownerThreadId}
                onChange={(event) => setForm({ ...form, ownerThreadId: event.target.value })}
              >
                <option value="">Choose a thread…</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Schedule Type">
              <Select
                value={form.scheduleType}
                onChange={(event) => setForm({ ...form, scheduleType: event.target.value === 'at' ? 'at' : 'cron' })}
              >
                <option value="cron">Recurring</option>
                <option value="at">Once</option>
              </Select>
            </Field>
            {form.scheduleType === 'cron' ? (
              <Field label="Cron">
                <TextInput
                  className="font-mono"
                  value={form.cron}
                  onChange={(event) => setForm({ ...form, cron: event.target.value })}
                  autoComplete="off"
                />
              </Field>
            ) : (
              <Field label="Run At">
                <TextInput
                  placeholder="2026-06-23T09:00:00.000Z"
                  value={form.at}
                  onChange={(event) => setForm({ ...form, at: event.target.value })}
                  autoComplete="off"
                />
              </Field>
            )}
            <Field label="Instructions" className="md:col-span-2">
              <Textarea
                name="automation-prompt"
                className="min-h-32"
                value={form.prompt}
                onChange={(event) => setForm({ ...form, prompt: event.target.value })}
              />
            </Field>
            <Field label="Working Directory">
              <div className="flex gap-2">
                <TextInput
                  className="min-w-0 flex-1"
                  value={form.cwd}
                  onChange={(event) => setForm({ ...form, cwd: event.target.value })}
                  autoComplete="off"
                />
                <ToolbarButton onClick={() => void pickCwd()} type="button">
                  Choose…
                </ToolbarButton>
              </div>
            </Field>
            <Field label="Timeout Seconds">
              <TextInput
                inputMode="numeric"
                value={form.timeoutSeconds}
                onChange={(event) => setForm({ ...form, timeoutSeconds: event.target.value })}
                autoComplete="off"
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-primary">
              <Checkbox checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
              Enabled
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
            <ToolbarButton onClick={() => setEditorOpen(false)}>Cancel</ToolbarButton>
            <Button variant="action" disabled={busy === 'save'} onClick={() => void save()}>
              {busy === 'save' ? 'Saving…' : 'Save automation'}
            </Button>
          </div>
        </SurfacePanel>
      ) : null}

      <FilterToolbar
        search={
          <SearchInput
            className="w-full max-w-md"
            placeholder="Search schedules…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actions={<ToolbarButton onClick={() => void load()}>Refresh</ToolbarButton>}
      />

      <div className="min-h-0 overflow-auto">
        <DataTable tableClassName="min-w-[980px]">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Automation</DataTableHeaderCell>
              <DataTableHeaderCell>Schedule</DataTableHeaderCell>
              <DataTableHeaderCell>Next Run</DataTableHeaderCell>
              <DataTableHeaderCell>Last Run</DataTableHeaderCell>
              <DataTableHeaderCell>Owner Thread</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {visibleTasks.length === 0 ? (
              <DataTableEmptyRow colSpan={7}>No automations yet. Create one and bind it to a thread.</DataTableEmptyRow>
            ) : (
              visibleTasks.map((task) => (
                <DataTableRow key={task.id}>
                  <DataTableCell>
                    <span className="inline-flex items-center gap-2">
                      <StatusDot tone={statusTone(task)} />
                      {statusText(task)}
                    </span>
                    {task.lastStatus === 'failed' ? <div className="mt-1 text-xs text-danger">Needs attention</div> : null}
                  </DataTableCell>
                  <DataTableCell>
                    <Button variant="ghost" className="px-0 py-0 font-medium text-primary" onClick={() => openEdit(task)}>
                      {taskTitle(task)}
                    </Button>
                    <div className="mt-1">
                      <InlineCode>@{task.id}</InlineCode>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs">{scheduleText(task)}</DataTableCell>
                  <DataTableCell>{nextRunText(task)}</DataTableCell>
                  <DataTableCell>
                    {task.lastRunAt ? `${timeAgo(task.lastRunAt)} · ${formatDateTime(task.lastRunAt)}` : 'Never'}
                  </DataTableCell>
                  <DataTableCell>
                    {task.threadConversationId ? (
                      <ButtonLink
                        variant="ghost"
                        className="px-0 py-0 text-primary"
                        href={`/conversations/${encodeURIComponent(task.threadConversationId)}`}
                      >
                        {task.threadTitle || task.threadConversationId}
                      </ButtonLink>
                    ) : (
                      <span className="text-danger">Missing owner thread</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <DataTableActionGroup>
                      <ToolbarButton disabled={busy === `run:${task.id}`} onClick={() => void runNow(task)}>
                        Run now
                      </ToolbarButton>
                      <ToolbarButton disabled={busy?.endsWith(`:${task.id}`)} onClick={() => void updateEnabled(task, !task.enabled)}>
                        {task.enabled ? 'Pause' : 'Resume'}
                      </ToolbarButton>
                      <ToolbarButton onClick={() => openEdit(task)}>Edit</ToolbarButton>
                      <ToolbarButton className="text-danger" onClick={() => void deleteTask(task)}>
                        Delete
                      </ToolbarButton>
                    </DataTableActionGroup>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </AppPageLayout>
  );
}
