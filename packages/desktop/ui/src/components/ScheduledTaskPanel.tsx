import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isScheduledTaskDetail } from '../automation/scheduledTaskDetail';
import {
  type CronEditorState,
  type EasyTaskCadence,
  type EasyTaskSchedule,
  formatTaskSchedule,
  formatTimeInputValue,
  parseTimeInputValue,
  WEEKDAY_OPTIONS,
} from '../automation/taskSchedule';
import { api } from '../client/api';
import { normalizeConversationGroupCwd } from '../conversation/conversationCwdGroups';
import { useApi } from '../hooks/useApi';
import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';
import { getModelSelectionValue, THINKING_LEVEL_OPTIONS } from '../model/modelPreferences';
import type { ModelInfo, ScheduledTaskDetail } from '../shared/types';
import { timeAgo } from '../shared/utils';
import { taskStore, useAllSessions, useSessionsReady } from '../store';
import { MentionTextarea } from './MentionTextarea';
import { addNotification } from './notifications/notificationStore';
import { ScheduledTaskLogSection } from './ScheduledTaskLogSection';
import {
  buildTaskExistingThreadOptions,
  buildTaskProjectOptions,
  createDefaultTaskFormState,
  createTaskFormState,
  createTaskMutationPayload,
  formatCatchUpWindowLabel,
  shouldClearMissingExistingThreadSelection,
  shouldShowTaskModelControls,
  type TaskFormState,
  validateTaskForm,
} from './scheduledTaskPanelModel';
import { ScheduledTaskPromptText } from './ScheduledTaskPromptText';
import {
  CardMeta,
  CardTitle,
  CheckButton,
  cx,
  ErrorState,
  InlineSelect,
  InlineTextInput,
  LoadingState,
  MenuShell,
  RailSubsection,
  SectionLabel,
  Switch,
  TextButton,
  TextInput,
  ToolbarButton,
} from './ui';

const TITLE_INPUT_CLASS =
  'w-full min-w-0 !border-0 !bg-transparent !p-0 !text-[16px] !font-medium text-primary outline-none placeholder:text-dim/75 hover:!bg-transparent focus:!border-0 focus:!bg-transparent';
const PROMPT_INPUT_CLASS =
  'min-h-0 flex-1 w-full resize-none overflow-y-auto bg-transparent px-1 pb-3 pt-2 text-sm leading-6 text-primary placeholder:text-dim/75 outline-none';
const FIELD_HELP_CLASS = 'ui-card-meta leading-relaxed';
export function taskStatusMeta(task: ScheduledTaskDetail): { text: string; cls: string } {
  if (task.running) return { text: 'running', cls: 'text-accent' };
  if (task.lastStatus === 'success') return { text: 'success', cls: 'text-success' };
  if (task.lastStatus === 'failed' || task.lastStatus === 'failure') return { text: 'failed', cls: 'text-danger' };
  return { text: 'never run', cls: 'text-dim' };
}

function formatScheduledTaskActivity(entry: NonNullable<ScheduledTaskDetail['activity']>[number]): string {
  if (entry.kind === 'run-failed') {
    return `run failed before execution · ${entry.message}`;
  }

  const scheduledAt = entry.count === 1 ? entry.firstScheduledAt : `${entry.firstScheduledAt} → ${entry.lastScheduledAt}`;
  const outcome = entry.outcome === 'catch-up-started' ? 'caught up' : 'skipped';
  return `${outcome} ${entry.count} scheduled ${entry.count === 1 ? 'run' : 'runs'} · ${scheduledAt}`;
}

async function refreshTaskSnapshot() {
  const tasks = await api.tasks();
  taskStore.replaceAll(tasks);
  return tasks;
}

function CronBuilderEditor({ value, onChange }: { value: CronEditorState; onChange: (next: CronEditorState) => void }) {
  function updateBuilder(patch: Partial<EasyTaskSchedule>) {
    onChange({
      ...value,
      builder: {
        ...value.builder,
        ...patch,
      },
    });
  }

  function handleTimeChange(nextValue: string) {
    const parsed = parseTimeInputValue(nextValue);
    if (!parsed) {
      return;
    }

    updateBuilder(parsed);
  }

  function toggleWeekday(day: number) {
    const current = value.builder.weekdays;
    const next = current.includes(day)
      ? current.length > 1
        ? current.filter((entry) => entry !== day)
        : current
      : [...current, day].sort((left, right) => left - right);
    updateBuilder({ weekdays: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {value.mode === 'builder' ? (
          <>
            <InlineSelect
              value={value.builder.cadence}
              onChange={(event) => updateBuilder({ cadence: event.target.value as EasyTaskCadence })}
              className="min-w-[10rem]"
              name="cronCadence"
              aria-label="Recurring schedule pattern"
            >
              <option value="hourly">Every hour</option>
              <option value="interval">Every few hours</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Specific weekdays</option>
              <option value="monthly">Day of month</option>
            </InlineSelect>

            {value.builder.cadence === 'hourly' && (
              <InlineTextInput
                type="number"
                min={0}
                max={59}
                value={value.builder.minute}
                onChange={(event) => updateBuilder({ minute: Number.parseInt(event.target.value || '0', 10) || 0 })}
                className="w-[5rem]"
                name="cronMinute"
                inputMode="numeric"
                aria-label="Minute past the hour"
              />
            )}

            {value.builder.cadence === 'interval' && (
              <>
                <InlineTextInput
                  type="number"
                  min={1}
                  max={23}
                  value={value.builder.intervalHours}
                  onChange={(event) => updateBuilder({ intervalHours: Number.parseInt(event.target.value || '1', 10) || 1 })}
                  className="w-[5rem]"
                  name="cronIntervalHours"
                  inputMode="numeric"
                  aria-label="Every N hours"
                />
                <InlineTextInput
                  type="number"
                  min={0}
                  max={59}
                  value={value.builder.minute}
                  onChange={(event) => updateBuilder({ minute: Number.parseInt(event.target.value || '0', 10) || 0 })}
                  className="w-[5rem]"
                  name="cronIntervalMinute"
                  inputMode="numeric"
                  aria-label="Minute past the hour"
                />
              </>
            )}

            {(value.builder.cadence === 'daily' ||
              value.builder.cadence === 'weekdays' ||
              value.builder.cadence === 'weekly' ||
              value.builder.cadence === 'monthly') && (
              <InlineTextInput
                type="time"
                value={formatTimeInputValue(value.builder.hour, value.builder.minute)}
                onChange={(event) => handleTimeChange(event.target.value)}
                className="w-[8.5rem]"
                name="cronTime"
                aria-label="Recurring schedule time"
              />
            )}

            {value.builder.cadence === 'monthly' && (
              <InlineTextInput
                type="number"
                min={1}
                max={31}
                value={value.builder.dayOfMonth}
                onChange={(event) => updateBuilder({ dayOfMonth: Number.parseInt(event.target.value || '1', 10) || 1 })}
                className="w-[5rem]"
                name="cronDayOfMonth"
                inputMode="numeric"
                aria-label="Day of month"
              />
            )}
          </>
        ) : (
          <InlineTextInput
            value={value.rawCron}
            onChange={(event) => onChange({ ...value, rawCron: event.target.value })}
            className="w-full max-w-[18rem] font-mono"
            placeholder="0 9 * * 1-5"
            name="cron"
            aria-label="Cron expression"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </div>

      {!value.supported && value.mode === 'raw' && (
        <p className={FIELD_HELP_CLASS}>
          This cron pattern is outside the simple editor. Switch back to Simple schedule in the menu if you want the builder.
        </p>
      )}

      {value.mode === 'builder' && value.builder.cadence === 'weekly' && (
        <div className="flex flex-wrap items-center gap-2">
          {WEEKDAY_OPTIONS.map((option) => (
            <CheckButton
              key={option.value}
              checked={value.builder.weekdays.includes(option.value)}
              onClick={() => toggleWeekday(option.value)}
              className="min-w-9 px-2.5 py-1.5"
            >
              {option.shortLabel}
            </CheckButton>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTargetTypeLabel(targetType: TaskFormState['targetType'] | string | undefined): string {
  return targetType === 'conversation' ? 'Conversation' : 'Background job';
}

function formatThreadModeLabel(mode: TaskFormState['threadMode']): string {
  switch (mode) {
    case 'existing':
      return 'Existing conversation';
    case 'none':
      return 'Do not post to chat';
    case 'dedicated':
    default:
      return 'New conversation';
  }
}

function InlineSwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      label={label}
      className={cx('h-8 shrink-0 px-1.5 font-medium', checked && 'text-primary')}
    />
  );
}

function TaskAdvancedMenu({
  value,
  modelOptions,
  existingThreadOptions,
  onChange,
}: {
  value: TaskFormState;
  modelOptions: ModelInfo[];
  existingThreadOptions: Array<{ id: string; label: string; cwd?: string }>;
  onChange: (patch: Partial<TaskFormState>) => void;
}) {
  return (
    <MenuShell role="group" className="absolute right-0 top-full z-20 mt-2 w-[20rem] p-3">
      <div className="space-y-3">
        <SectionLabel tone="muted" className="block">
          More options
        </SectionLabel>

        <div className="space-y-1.5">
          <SectionLabel tone="muted">Target</SectionLabel>
          <InlineSelect
            value={value.targetType}
            onChange={(event) =>
              onChange({
                targetType: event.target.value as TaskFormState['targetType'],
                ...(event.target.value === 'conversation' && value.threadMode === 'none' ? { threadMode: 'dedicated' as const } : {}),
              })
            }
            className="w-full"
            name="targetType"
            aria-label="Automation target"
          >
            <option value="background-agent">Background job</option>
            <option value="conversation">Conversation</option>
          </InlineSelect>
        </div>

        {value.scheduleMode === 'cron' && (
          <>
            <div className="space-y-1.5">
              <SectionLabel tone="muted">Schedule editor</SectionLabel>
              <InlineSelect
                value={value.cronEditor.mode}
                onChange={(event) => onChange({ cronEditor: { ...value.cronEditor, mode: event.target.value as CronEditorState['mode'] } })}
                className="w-full"
                name="cronEditorMode"
                aria-label="Schedule editor mode"
              >
                <option value="builder">Simple schedule</option>
                <option value="raw">Custom cron expression</option>
              </InlineSelect>
            </div>

            <div className="space-y-1.5">
              <SectionLabel tone="muted">Catch-up window</SectionLabel>
              <InlineTextInput
                type="number"
                min={1}
                step={1}
                value={value.catchUpWindowMinutes}
                onChange={(event) => onChange({ catchUpWindowMinutes: event.target.value })}
                className="w-full"
                name="catchUpWindowMinutes"
                inputMode="numeric"
                aria-label="Run if missed within minutes"
                placeholder="Disabled"
              />
              <p className={FIELD_HELP_CLASS}>
                Run once after wake if the latest missed slot was within this many minutes. Leave blank to skip missed runs.
              </p>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <SectionLabel tone="muted">Result conversation</SectionLabel>
          <InlineSelect
            value={value.threadMode}
            onChange={(event) =>
              onChange({
                threadMode: event.target.value as TaskFormState['threadMode'],
                ...(event.target.value !== 'existing' ? { threadConversationId: '' } : {}),
              })
            }
            className="w-full"
            name="threadMode"
            aria-label="Automation result conversation"
          >
            <option value="dedicated">New conversation</option>
            <option value="existing">Existing conversation</option>
            {value.targetType !== 'conversation' && <option value="none">Do not post to chat</option>}
          </InlineSelect>
          {value.threadMode === 'existing' && (
            <InlineSelect
              value={value.threadConversationId}
              onChange={(event) => onChange({ threadConversationId: event.target.value })}
              className="w-full"
              name="threadConversationId"
              aria-label="Existing automation conversation"
            >
              <option value="">Choose conversation</option>
              {existingThreadOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </InlineSelect>
          )}
          {value.threadMode === 'existing' && existingThreadOptions.length === 0 && (
            <p className={FIELD_HELP_CLASS}>No saved conversations match this working directory yet.</p>
          )}
        </div>

        {shouldShowTaskModelControls(value) && (
          <>
            <div className="space-y-1.5">
              <SectionLabel tone="muted">Model</SectionLabel>
              <InlineSelect
                value={value.model}
                onChange={(event) => onChange({ model: event.target.value })}
                className="w-full"
                name="model"
                aria-label="Automation model"
              >
                <option value="">Default</option>
                {modelOptions.map((model) => (
                  <option key={getModelSelectionValue(model, modelOptions)} value={getModelSelectionValue(model, modelOptions)}>
                    {getModelSelectionValue(model, modelOptions)}
                  </option>
                ))}
              </InlineSelect>
            </div>

            <div className="space-y-1.5">
              <SectionLabel tone="muted">Reasoning</SectionLabel>
              <InlineSelect
                value={value.thinkingLevel}
                onChange={(event) => onChange({ thinkingLevel: event.target.value })}
                className="w-full"
                name="thinkingLevel"
                aria-label="Automation reasoning level"
              >
                {THINKING_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value || 'unset'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </InlineSelect>
            </div>
          </>
        )}
      </div>
    </MenuShell>
  );
}

function TaskEditorForm({
  mode,
  value,
  saving,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  value: TaskFormState;
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<TaskFormState>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { projects } = useAppData();
  const sessions = useAllSessions();
  const sessionsReady = useSessionsReady();
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: cwdState } = useApi(async () => api.defaultCwd(), 'task-editor-default-cwd');
  const { data: modelState } = useApi(async () => api.models(), 'task-editor-models');
  const { data: savedWorkspacePaths } = useApi(
    async () => normalizeWorkspacePaths(await api.savedWorkspacePaths()),
    'task-editor-saved-workspaces',
  );

  useEffect(() => {
    const defaultPath = normalizeConversationGroupCwd(cwdState?.effectiveCwd);
    if (value.runIn === 'worktree' && !value.projectPath.trim() && defaultPath && !isFilesystemRootPath(defaultPath)) {
      onChange({ projectPath: defaultPath });
    }
  }, [cwdState?.effectiveCwd, onChange, value.projectPath, value.runIn]);

  useEffect(() => {
    if (error) {
      setSubmitAttempted(true);
    }
  }, [error]);

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (moreMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setMoreMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  const projectOptions = useMemo(
    () =>
      buildTaskProjectOptions({
        projectPath: value.projectPath,
        defaultCwd: cwdState?.effectiveCwd,
        savedWorkspacePaths,
        sessions,
        projects,
      }),
    [cwdState?.effectiveCwd, projects, savedWorkspacePaths, sessions, value.projectPath],
  );

  const effectiveThreadCwd =
    value.runIn === 'worktree' ? normalizeConversationGroupCwd(value.projectPath) : normalizeConversationGroupCwd(cwdState?.effectiveCwd);
  const existingThreadOptions = useMemo(
    () =>
      buildTaskExistingThreadOptions({
        sessions,
        effectiveThreadCwd,
      }),
    [effectiveThreadCwd, sessions],
  );
  const selectedExistingThread = existingThreadOptions.find((option) => option.id === value.threadConversationId);
  const thinkingLabel = THINKING_LEVEL_OPTIONS.find((option) => option.value === value.thinkingLevel)?.label ?? value.thinkingLevel;
  const advancedSummaryParts = [
    formatTargetTypeLabel(value.targetType),
    value.scheduleMode === 'cron' && value.catchUpWindowMinutes.trim() ? `catch up ${value.catchUpWindowMinutes.trim()}m` : null,
    value.threadMode === 'existing'
      ? (selectedExistingThread?.label ?? 'Existing conversation')
      : value.threadMode === 'none'
        ? 'Do not post to chat'
        : null,
    value.model.trim() ? (value.model.trim().split('/').pop() ?? value.model.trim()) : null,
    value.thinkingLevel.trim() ? thinkingLabel : null,
  ].filter((entry): entry is string => Boolean(entry));
  const advancedSummary = advancedSummaryParts.length > 0 ? advancedSummaryParts.join(' · ') : null;
  const visibleError = error ?? (submitAttempted ? validationError : null);

  useEffect(() => {
    if (
      shouldClearMissingExistingThreadSelection({
        threadMode: value.threadMode,
        threadConversationId: value.threadConversationId,
        existingThreadOptions,
        sessionsLoaded: sessionsReady,
      })
    ) {
      onChange({ threadConversationId: '' });
    }
  }, [existingThreadOptions, onChange, sessions, value.threadConversationId, value.threadMode]);

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitAttempted(true);
        if (validationError) {
          return;
        }
        onSubmit();
      }}
    >
      <div className="min-h-0 flex-1 px-6 pb-2 pt-5">
        <div className="mx-auto flex h-full min-h-0 max-w-4xl flex-col">
          <div className="flex items-start justify-between gap-3 px-1">
            <TextInput
              value={value.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className={TITLE_INPUT_CLASS}
              placeholder="Automation title"
              name="title"
              aria-label="Automation title"
              autoComplete="off"
              autoFocus
            />
            <div ref={moreMenuRef} className="relative flex shrink-0 items-center gap-2">
              {advancedSummary && (
                <CardMeta as="span" className="max-w-[16rem] truncate">
                  {advancedSummary}
                </CardMeta>
              )}
              <ToolbarButton
                type="button"
                onClick={() => setMoreMenuOpen((current) => !current)}
                className={cx('h-8 px-2', moreMenuOpen && 'bg-surface/55 text-primary')}
                aria-label="More automation options"
                aria-expanded={moreMenuOpen}
                aria-haspopup="dialog"
              >
                ⋯
              </ToolbarButton>
              {moreMenuOpen && (
                <TaskAdvancedMenu
                  value={value}
                  modelOptions={modelState?.models ?? []}
                  existingThreadOptions={existingThreadOptions}
                  onChange={onChange}
                />
              )}
            </div>
          </div>

          <MentionTextarea
            value={value.prompt}
            onValueChange={(prompt) => onChange({ prompt })}
            containerClassName="flex min-h-0 flex-1"
            className={PROMPT_INPUT_CLASS}
            placeholder="Add prompt…"
            name="prompt"
            aria-label="Prompt"
          />
        </div>
      </div>

      <div className="px-6 pb-4 pt-2">
        <div className="mx-auto max-w-4xl space-y-2">
          {visibleError ? (
            <CardMeta className="text-danger" aria-live="polite">
              {visibleError}
            </CardMeta>
          ) : null}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-4 xl:pr-4">
              <div className="flex min-w-0 flex-wrap items-center gap-3 lg:flex-nowrap">
                <InlineSwitch
                  checked={value.scheduleMode === 'at'}
                  label="One time"
                  onCheckedChange={(checked) => onChange({ scheduleMode: checked ? 'at' : 'cron' })}
                />
                {value.scheduleMode === 'cron' ? (
                  <div className="min-w-0 lg:flex-none">
                    <CronBuilderEditor value={value.cronEditor} onChange={(cronEditor) => onChange({ cronEditor })} />
                  </div>
                ) : (
                  <InlineTextInput
                    type="datetime-local"
                    value={value.atValue}
                    onChange={(event) => onChange({ atValue: event.target.value })}
                    className="w-full max-w-[18rem]"
                    name="runAt"
                    aria-label="Run at"
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-3 lg:flex-nowrap">
                <InlineSwitch
                  checked={value.runIn === 'worktree'}
                  label="Worktree"
                  onCheckedChange={(checked) =>
                    onChange({
                      runIn: checked ? 'worktree' : 'local',
                      ...(checked ? {} : { projectPath: '' }),
                    })
                  }
                />
                {value.runIn === 'worktree' ? (
                  <InlineSelect
                    value={value.projectPath.trim()}
                    onChange={(event) => onChange({ projectPath: event.target.value, runIn: 'worktree' })}
                    className="w-full min-w-[12rem] max-w-[20rem]"
                    name="projectPath"
                    aria-label="Automation project"
                  >
                    <option value="">Select project</option>
                    {projectOptions.map((entry) => (
                      <option key={entry.path} value={entry.path}>
                        {entry.label}
                      </option>
                    ))}
                  </InlineSelect>
                ) : (
                  <CardMeta as="span">Chat</CardMeta>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 xl:self-end">
              <TextButton type="button" onClick={onCancel}>
                Cancel
              </TextButton>
              <ToolbarButton type="submit" disabled={saving}>
                {saving ? (mode === 'create' ? 'Creating…' : 'Saving…') : mode === 'create' ? 'Create' : 'Save'}
              </ToolbarButton>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export function ScheduledTaskCreatePanel({ onCancel }: { onCancel?: () => void } = {}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TaskFormState>(() => createDefaultTaskFormState());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleCreate() {
    const validationError = validateTaskForm(draft, 'create');
    if (validationError) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const response = await api.createTask(createTaskMutationPayload(draft));
      await refreshTaskSnapshot();
      navigate(`/automations/${encodeURIComponent(response.task.id)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSaveError(msg);
      addNotification({ type: 'error', message: `Failed to save task: ${msg}`, source: 'core' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TaskEditorForm
      mode="create"
      value={draft}
      saving={saving}
      error={saveError}
      onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      onCancel={onCancel ?? (() => navigate('/automations'))}
      onSubmit={() => {
        void handleCreate();
      }}
    />
  );
}

export function ScheduledTaskPanel({
  id,
  initialMode = 'view',
  onClose,
}: {
  id: string;
  initialMode?: 'view' | 'edit';
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const {
    data: task,
    loading,
    error,
    refetch,
  } = useApi(async () => {
    const detail = await api.taskDetail(id);
    if (!isScheduledTaskDetail(detail)) {
      throw new Error('Task details are unavailable.');
    }
    return detail;
  }, id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  }, [id]);

  useEffect(() => {
    if (initialMode !== 'edit' || !task || editing || draft) {
      return;
    }

    setDraft(createTaskFormState(task));
    setSaveError(null);
    setEditing(true);
  }, [draft, editing, initialMode, task]);

  if (loading && !task) {
    return <LoadingState label="Loading task…" className="px-4 py-4" />;
  }

  if (error && !task) {
    return <ErrorState message={error} className="px-4 py-4" />;
  }

  if (!task) {
    return (
      <CardMeta as="div" className="px-4 py-4">
        Task not found.
      </CardMeta>
    );
  }

  async function handleSave() {
    if (!draft || validateTaskForm(draft, 'edit')) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await api.saveTask(id, createTaskMutationPayload(draft));
      await Promise.all([refetch({ resetLoading: false }), refreshTaskSnapshot()]);
      setEditing(false);
      setDraft(null);
      onClose?.();
    } catch (nextError) {
      const msg = nextError instanceof Error ? nextError.message : String(nextError);
      setSaveError(msg);
      addNotification({ type: 'error', message: `Failed to save task: ${msg}`, source: 'core' });
    } finally {
      setSaving(false);
    }
  }

  if (editing && draft) {
    return (
      <TaskEditorForm
        mode="edit"
        value={draft}
        saving={saving}
        error={saveError}
        onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
        onCancel={() => {
          setEditing(false);
          setDraft(null);
          setSaveError(null);
          if (initialMode === 'edit') {
            onClose?.();
          }
        }}
        onSubmit={() => {
          void handleSave();
        }}
      />
    );
  }

  const taskDetail = task;
  const status = taskStatusMeta(taskDetail);

  return (
    <div className="space-y-4 px-4 py-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <CardTitle className="break-all">{taskDetail.title ?? taskDetail.id}</CardTitle>
          <CardMeta>
            <span className={status.cls}>{status.text}</span>
            {taskDetail.lastRunAt && (
              <>
                <span className="opacity-40 mx-1.5">·</span>last run {timeAgo(taskDetail.lastRunAt)}
              </>
            )}
            {!taskDetail.enabled && (
              <>
                <span className="opacity-40 mx-1.5">·</span>disabled
              </>
            )}
          </CardMeta>
          <CardMeta>{taskDetail.id}</CardMeta>
        </div>
        <ToolbarButton
          onClick={() => {
            setDraft(createTaskFormState(taskDetail));
            setSaveError(null);
            setEditing(true);
          }}
        >
          Edit
        </ToolbarButton>
      </div>

      <RailSubsection title="Details" bodyClassName="ui-detail-list">
        <div className="ui-detail-row">
          <span className="ui-detail-label">schedule</span>
          <div className="min-w-0">
            <p className="ui-detail-value">{formatTaskSchedule(taskDetail)}</p>
            <CardMeta className="mt-0.5 font-mono break-all">{taskDetail.cron ?? taskDetail.at}</CardMeta>
          </div>
        </div>
        {taskDetail.model && (
          <div className="ui-detail-row">
            <span className="ui-detail-label">model</span>
            <p className="ui-detail-value break-all">{taskDetail.model}</p>
          </div>
        )}
        {taskDetail.cwd && (
          <div className="ui-detail-row">
            <span className="ui-detail-label">Working directory</span>
            <p className="ui-detail-value break-all">{taskDetail.cwd}</p>
          </div>
        )}
        <div className="ui-detail-row">
          <span className="ui-detail-label">Conversation</span>
          <div className="min-w-0">
            <p className="ui-detail-value">{formatThreadModeLabel(taskDetail.threadMode)}</p>
            {taskDetail.threadTitle && <CardMeta className="mt-0.5 break-all">{taskDetail.threadTitle}</CardMeta>}
            {taskDetail.threadConversationId && (
              <TextButton
                type="button"
                onClick={() => navigate(`/conversations/${encodeURIComponent(taskDetail.threadConversationId)}`)}
                tone="accent"
                className="mt-1"
              >
                Open thread →
              </TextButton>
            )}
          </div>
        </div>
        {taskDetail.scheduleType === 'cron' && (
          <div className="ui-detail-row">
            <span className="ui-detail-label">catch-up</span>
            <p className="ui-detail-value">{formatCatchUpWindowLabel(taskDetail.catchUpWindowSeconds)}</p>
          </div>
        )}
        {taskDetail.timeoutSeconds !== undefined && (
          <div className="ui-detail-row">
            <span className="ui-detail-label">timeout</span>
            <p className="ui-detail-value">{taskDetail.timeoutSeconds}s</p>
          </div>
        )}
        {taskDetail.schedulerLastEvaluatedAt && (
          <div className="ui-detail-row">
            <span className="ui-detail-label">scheduler</span>
            <p className="ui-detail-value">checked {timeAgo(taskDetail.schedulerLastEvaluatedAt)}</p>
          </div>
        )}
      </RailSubsection>

      {taskDetail.activity && taskDetail.activity.length > 0 && (
        <RailSubsection title="Recent scheduler activity">
          <div className="space-y-2">
            {taskDetail.activity.slice(0, 5).map((entry) => (
              <div key={entry.id} className="leading-relaxed">
                <p className={entry.kind === 'run-failed' || entry.outcome === 'skipped' ? 'text-danger' : 'text-secondary'}>
                  {formatScheduledTaskActivity(entry)}
                </p>
                <CardMeta>recorded {timeAgo(entry.createdAt)}</CardMeta>
              </div>
            ))}
          </div>
        </RailSubsection>
      )}

      <RailSubsection title="Prompt">
        <ScheduledTaskPromptText value={taskDetail.prompt} />
      </RailSubsection>

      <ScheduledTaskLogSection taskId={id} />
    </div>
  );
}
