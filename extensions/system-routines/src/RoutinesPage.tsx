import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  type ActivityTreeItem,
  ActivityTreeView,
  AppPageIntro,
  AppPageLayout,
  Button,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  cx,
  EmptyState,
  ErrorState,
  IconButton,
  MenuItem,
  MenuShell,
  Pill,
  PositionedMenu,
  Select,
  SidebarSection,
  Textarea,
  TextButton,
  TextInput,
  ToolbarButton,
  WindowedBadge,
  WindowedDialog,
  WindowedEmptyState,
  WindowedKeyValueList,
  WindowedList,
  WindowedListItem,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedTimeline,
  WindowedTimelineItem,
} from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Routine, RoutineHookPoint, RoutineOutcome, RoutinePosition, RoutineRunRecord, RoutineType } from './types.js';

interface HookWithSummary extends RoutineHookPoint {
  summary: string;
}

interface StateResult {
  hooks: HookWithSummary[];
  routines: Routine[];
  runs: RoutineRunRecord[];
}

interface SkillItem {
  id: string;
  name: string;
  description?: string;
}

interface ModelItem {
  id: string;
  provider?: string;
  name?: string;
  label?: string;
}

const FALLBACK_SKILLS: SkillItem[] = [
  { id: 'autoreview', name: 'Autoreview', description: 'Review code changes before shipping.' },
  { id: 'second-model-review', name: 'Second model review', description: 'Ask another model to review the change.' },
  { id: 'checkpoint', name: 'Checkpoint', description: 'Create a targeted checkpoint.' },
];

const DEFAULT_OUTCOMES: RoutineOutcome[] = [
  { id: 'path_a', label: 'Path A', target: 'Describe the first path', behavior: 'continue' },
  { id: 'path_b', label: 'Path B', target: 'Describe the second path', behavior: 'continue' },
];

function RoutinesLoadingState() {
  return <div role="status" aria-label="Loading routines" />;
}

function RoutineSidebarIcon({ name }: { name: 'check' | 'plus' }) {
  const paths = {
    check: ['M20 6 9 17l-5-5'],
    plus: ['M12 5v14', 'M5 12h14'],
  } satisfies Record<string, string[]>;
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function replaceLastSkillReference(instruction: string, skillId: string): string {
  const matches = Array.from(instruction.matchAll(/\/skill:([A-Za-z0-9._-]*)/g));
  const match = matches[matches.length - 1];
  if (!match || match.index === undefined) return instruction;
  const before = instruction.slice(0, match.index);
  const after = instruction.slice(match.index + match[0].length);
  return `${before}/skill:${skillId}${after}`;
}

function hookIdFromHash(hash?: string): string | null {
  const raw = (hash ?? '').replace(/^#/, '');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function searchAction(search?: string): string | null {
  const raw = (search ?? '').replace(/^\?/, '');
  if (!raw) return null;
  try {
    return new URLSearchParams(raw).get('action');
  } catch {
    return null;
  }
}

function sanitizeRunStepMessage(message: string): string {
  const trimmed = message.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as unknown;
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const nestedError = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : undefined;
        const providerMessage = typeof nestedError?.message === 'string' ? nestedError.message : undefined;
        const statusCode = typeof record.status_code === 'number' ? record.status_code : undefined;
        if (providerMessage && statusCode) return `Routine model call failed (${statusCode}): ${providerMessage}`;
        if (providerMessage) return `Routine model call failed: ${providerMessage}`;
      }
    } catch {
      // Keep the generic cleanup below for malformed structured errors.
    }
  }
  if (/status_code|headers|x-codex-|usage_limit_reached/i.test(trimmed)) {
    return 'Routine model call failed. Check provider limits or credentials, then try again.';
  }
  return trimmed;
}

async function navigateRoutines(pa: ExtensionSurfaceProps['pa'], hookId: string) {
  const to = `/routines#${encodeURIComponent(hookId)}`;
  const handled = await pa.commands?.execute?.('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: to } }));
  }
}

function nowRoutine(
  hookId: string,
  position: RoutinePosition,
  type: RoutineType,
  parent?: { parentRoutineId: string; parentOutcomeId: string },
): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position,
    ...(parent ?? {}),
    type,
    name: type === 'decision' ? 'New path chooser' : type === 'stop' ? 'Stop event' : 'New prompt',
    instruction: type === 'stop' ? 'Stop this lifecycle event and explain why.' : '',
    enabled: true,
    order: 999,
    failureBehavior: type === 'instruction' ? 'continue' : 'block',
    outcomes: type === 'decision' ? DEFAULT_OUTCOMES : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function checkpointExampleRoutine(hookId = 'checkpoint'): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position: 'before',
    type: 'decision',
    name: 'Review code changes',
    instruction:
      'Use /skill:autoreview to review the current diff. Choose exactly one outcome based on whether checkpointing should continue.',
    enabled: true,
    order: 0,
    failureBehavior: 'block',
    outcomes: [
      { id: 'pass', label: 'Pass', target: 'Continue checkpoint', behavior: 'continue' },
      { id: 'issues_found', label: 'Issues found', target: 'Stop checkpoint and report issues', behavior: 'block' },
      { id: 'needs_validation', label: 'Needs validation', target: 'Warn and continue', behavior: 'warn' },
      { id: 'unclear', label: 'Unclear', target: 'Ask before continuing', behavior: 'ask' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function checkpointHandoffExampleRoutine(hookId = 'checkpoint'): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position: 'after',
    type: 'instruction',
    name: 'Write checkpoint handoff',
    instruction: 'Summarize what changed in this checkpoint, call out unresolved risks, and list the next useful follow-up.',
    enabled: true,
    order: 0,
    failureBehavior: 'warn',
    outcomes: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function riskyBackgroundWorkExampleRoutine(hookId = 'background.command'): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position: 'before',
    type: 'decision',
    name: 'Ask before risky background work',
    instruction:
      'Inspect the background command. If it can delete files, rewrite history, change credentials, or run outside the workspace, ask before continuing.',
    enabled: true,
    order: 0,
    failureBehavior: 'block',
    outcomes: [
      { id: 'safe', label: 'Safe', target: 'Continue background command', behavior: 'continue' },
      { id: 'ask_first', label: 'Ask first', target: 'Ask before running', behavior: 'ask' },
      { id: 'block', label: 'Block', target: 'Stop the command and explain why', behavior: 'block' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function agentStartPathExampleRoutine(hookId = 'agent.before_start'): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position: 'before',
    type: 'decision',
    name: 'Choose a path before agent start',
    instruction:
      'Read the user request and choose the best starting mode: plan first, implement directly, or ask a clarifying question before work begins.',
    enabled: true,
    order: 0,
    failureBehavior: 'warn',
    outcomes: [
      { id: 'plan', label: 'Plan', target: 'Start with a concise implementation plan', behavior: 'warn' },
      { id: 'implement', label: 'Implement', target: 'Proceed with implementation', behavior: 'continue' },
      { id: 'ask', label: 'Ask', target: 'Ask for missing information before starting', behavior: 'ask' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function groupedHooks(hooks: HookWithSummary[]) {
  const groups = new Map<string, HookWithSummary[]>();
  for (const hook of hooks) groups.set(hook.group, [...(groups.get(hook.group) ?? []), hook]);
  return Array.from(groups.entries());
}

function routineLabel(type: RoutineType): string {
  if (type === 'decision') return 'Choose path';
  if (type === 'stop') return 'Stop event';
  return 'Run prompt';
}

function routineFailureLabel(routine: Routine): string {
  if (routine.type === 'stop') return 'stops event';
  if (routine.type === 'decision') return `${routine.outcomes.length} ${routine.outcomes.length === 1 ? 'path' : 'paths'}`;
  if (routine.failureBehavior === 'block') return 'if this fails: stop event';
  if (routine.failureBehavior === 'warn') return 'if this fails: warn';
  return 'if this fails: keep going';
}

function validateRoutineDraft(routine: Routine): string | null {
  if (!routine.hookId.trim() || !routine.name.trim()) return 'Routine name and event are required.';
  if (routine.type !== 'decision') return null;
  if (routine.outcomes.length === 0) return 'Choose-path routines need at least one path.';
  const seen = new Set<string>();
  for (const outcome of routine.outcomes) {
    const id = outcome.id.trim();
    if (!id) return 'Each path needs an enum value.';
    if (seen.has(id)) return `Path enum values must be unique. "${id}" is used more than once.`;
    seen.add(id);
  }
  return null;
}

function ownerLabel(ownerExtensionId?: string): string {
  if (!ownerExtensionId) return 'Built in';
  if (ownerExtensionId === 'core') return 'Built in';
  return ownerExtensionId
    .replace(/^system-/, '')
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function modelLabel(model: ModelItem): string {
  return model.label ?? model.name ?? model.id;
}

function modelSelectionValue(model: ModelItem, models: ModelItem[]): string {
  const duplicateIds = models.filter((candidate) => candidate.id === model.id).length > 1;
  return duplicateIds && model.provider ? `${model.provider}/${model.id}` : model.id;
}

function groupedModels(models: ModelItem[]) {
  const groups = new Map<string, ModelItem[]>();
  for (const model of models) groups.set(model.provider ?? 'Models', [...(groups.get(model.provider ?? 'Models') ?? []), model]);
  return Array.from(groups.entries());
}

function hasModelValue(models: ModelItem[], value?: string): boolean {
  if (!value) return true;
  return models.some(
    (model) =>
      modelSelectionValue(model, models) === value ||
      model.id === value ||
      (model.provider ? `${model.provider}/${model.id}` === value : false),
  );
}

function failureBehaviorDescription(behavior: Routine['failureBehavior']): string {
  if (behavior === 'block') return 'Block stops the event and reports this routine as needing attention.';
  if (behavior === 'warn') return 'Warn records the problem but lets the event continue.';
  return 'Continue lets the event proceed even if this routine fails.';
}

function outcomeBehaviorDescription(behavior: RoutineOutcome['behavior']): string {
  if (behavior === 'block') return 'Stop ends this event on this path.';
  if (behavior === 'warn') return 'Warn marks this path and continues.';
  if (behavior === 'ask') return 'Ask pauses this path so you can decide.';
  if (behavior === 'branch') return 'Run another routine on this path.';
  return 'Continue follows this path.';
}

function outcomeEffect(outcome: RoutineOutcome, branchTargetName: string | null): { symbol: string; label: string; tone: string } {
  if (outcome.behavior === 'branch') {
    return { symbol: '+', label: branchTargetName ? `Run ${branchTargetName}` : 'Run another routine', tone: 'text-accent' };
  }
  if (outcome.behavior === 'block') return { symbol: 'x', label: 'Stop event', tone: 'text-danger' };
  if (outcome.behavior === 'warn') return { symbol: '!', label: 'Warn and continue', tone: 'text-warning' };
  if (outcome.behavior === 'ask') return { symbol: '?', label: 'Ask before continuing', tone: 'text-accent' };
  return { symbol: '->', label: 'Continue event', tone: 'text-success' };
}

function routineTreeStatus(summary: string): ActivityTreeItem['status'] {
  if (/fail|block|warn/i.test(summary)) return 'failed';
  if (summary === 'No routines') return 'idle';
  return 'done';
}

function publishRoutinesState(state: StateResult) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StateResult>('neon-pilot-routines-state', { detail: state }));
}

function summarizeHookForUi(hookId: string, routines: Routine[]): string {
  const enabled = routines.filter((routine) => routine.hookId === hookId && routine.enabled);
  if (enabled.length === 0) return 'No routines';
  return enabled
    .sort((left, right) => left.position.localeCompare(right.position) || left.order - right.order)
    .slice(0, 2)
    .map((routine) => routine.name)
    .join(', ');
}

function withHookSummaries(state: StateResult): StateResult {
  return {
    ...state,
    hooks: state.hooks.map((hook) => ({ ...hook, summary: summarizeHookForUi(hook.id, state.routines) })),
  };
}

function routineTone(routine: Routine): 'neutral' | 'positive' | 'warning' | 'danger' {
  if (!routine.enabled) return 'neutral';
  if (routine.type === 'stop') return 'danger';
  if (routine.type === 'decision') return 'warning';
  return 'positive';
}

function routineStatusLabel(routine: Routine): string {
  if (!routine.enabled) return 'Disabled';
  if (routine.type === 'stop') return 'Stops';
  if (routine.type === 'decision') return `${routine.outcomes.length} ${routine.outcomes.length === 1 ? 'path' : 'paths'}`;
  return routine.failureBehavior === 'block' ? 'Blocks on fail' : routine.failureBehavior === 'warn' ? 'Warns on fail' : 'Continues';
}

function RoutineHookList({
  hooks,
  selectedHookId,
  showAllHooks,
  onSelect,
  onShowAllHooksChange,
}: {
  hooks: HookWithSummary[];
  selectedHookId: string;
  showAllHooks: boolean;
  onSelect: (hookId: string) => void;
  onShowAllHooksChange: (show: boolean) => void;
}) {
  const activeHooks = showAllHooks ? hooks : hooks.filter((hook) => hook.summary !== 'No routines');
  const visibleHooks = activeHooks;

  const treeItems: ActivityTreeItem[] = groupedHooks(visibleHooks).flatMap(([group, groupHooks]) => {
    const groupId = `group:${group}`;
    return [
      {
        id: groupId,
        kind: 'group',
        title: group,
        status: 'idle',
      },
      ...groupHooks.map((hook) => ({
        id: hook.id,
        parentId: groupId,
        kind: 'conversation' as const,
        title: hook.title,
        subtitle: hook.summary,
        status: routineTreeStatus(hook.summary),
        metadata: { owner: ownerLabel(hook.ownerExtensionId) },
      })),
    ];
  });

  return (
    <ActivityTreeView
      items={treeItems}
      activeItemId={selectedHookId}
      ariaLabel="Routines"
      emptyMessage={showAllHooks ? 'No events available.' : 'No routines yet. Add an event to start.'}
      onOpenItem={(item: ActivityTreeItem) => {
        if (item.kind !== 'group') {
          onSelect(item.id);
          if (showAllHooks) onShowAllHooksChange(false);
        }
      }}
    />
  );
}

export function RoutinesSidebar({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [showAllHooks, setShowAllHooks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedHookId = hookIdFromHash(context.hash) ?? '';

  useEffect(() => {
    let disposed = false;
    pa.extension
      .invoke('getState', {})
      .then((result) => {
        if (!disposed) setData(result as StateResult);
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      disposed = true;
    };
  }, [pa]);

  useEffect(() => {
    const onState = (event: Event) => setData((event as CustomEvent<StateResult>).detail);
    window.addEventListener('neon-pilot-routines-state', onState);
    return () => window.removeEventListener('neon-pilot-routines-state', onState);
  }, []);

  if (error) return <div className="p-3 text-[12px] text-danger">{error}</div>;
  if (!data) return <RoutinesLoadingState />;

  return (
    <SidebarSection
      title="Routines"
      actionItems={[
        {
          id: 'add-event',
          label: showAllHooks ? 'Done adding routine event' : 'Add routine event',
          icon: <RoutineSidebarIcon name={showAllHooks ? 'check' : 'plus'} />,
          onClick: () => setShowAllHooks((current) => !current),
        },
      ]}
    >
      <RoutineHookList
        hooks={data.hooks}
        selectedHookId={selectedHookId}
        showAllHooks={showAllHooks}
        onSelect={(hookId) => void navigateRoutines(pa, hookId)}
        onShowAllHooksChange={setShowAllHooks}
      />
    </SidebarSection>
  );
}

function RoutinesRunHistory({ selectedHook, runs }: { selectedHook: HookWithSummary; runs: RoutineRunRecord[] }) {
  if (runs.length === 0) {
    return <div className="py-6 text-[12px] text-secondary">No routine runs yet.</div>;
  }

  return (
    <div className="grid gap-2">
      {runs.map((run) => (
        <div key={run.id} className="ui-flat-panel">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[12px] capitalize text-primary">{run.status}</b>
            <span className="text-[11px] text-secondary">{new Date(run.startedAt).toLocaleString()}</span>
          </div>
          <div className="mt-2 grid gap-1 text-[12px] text-secondary">
            {run.steps.length === 0 ? <div>{selectedHook.title} ran without recorded steps.</div> : null}
            {run.steps.map((step, index) => (
              <div key={`${step.routineId}-${index}`}>
                {step.routineName}: {step.outcome ?? step.status}
                {step.message ? ` — ${sanitizeRunStepMessage(step.message)}` : ''}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoutinesContextRail({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedHookId = hookIdFromHash(context.hash) ?? '';

  const load = useCallback(async () => {
    try {
      const result = (await pa.extension.invoke('getState', {})) as StateResult;
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onState = (event: Event) => setData((event as CustomEvent<StateResult>).detail);
    window.addEventListener('neon-pilot-routines-state', onState);
    return () => window.removeEventListener('neon-pilot-routines-state', onState);
  }, []);

  useEffect(() => {
    const subscription = pa.ui.subscribeInvalidations((event) => {
      if (event.topics.some((topic) => topic === 'routines')) void load();
    });
    return () => subscription.unsubscribe();
  }, [load, pa]);

  if (error) return <div className="p-4 text-[12px] text-danger">{error}</div>;
  if (!data) return <RoutinesLoadingState />;

  const firstActiveHookId = data.routines.find((routine) => routine.enabled)?.hookId;
  const selectedHook = data.hooks.find((hook) => hook.id === selectedHookId) ?? data.hooks.find((hook) => hook.id === firstActiveHookId);
  if (!selectedHook) {
    return (
      <ContextRail>
        <ContextRailHeader eyebrow="Routine context" title="No event selected" subtitle="Add an event to inspect routines and runs." />
        <ContextRailBody>
          <ContextRailSection title="Runs">
            <div className="py-6 text-[12px] text-secondary">Run history appears here after routines execute.</div>
          </ContextRailSection>
        </ContextRailBody>
      </ContextRail>
    );
  }

  const hookRoutines = data.routines.filter((routine) => routine.hookId === selectedHook.id);
  const selectedRuns = data.runs.filter((run) => run.hookId === selectedHook.id).slice(0, 20);
  const beforeCount = hookRoutines.filter((routine) => routine.position === 'before').length;
  const afterCount = hookRoutines.filter((routine) => routine.position === 'after').length;

  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Routine context" title={selectedHook.title} subtitle={ownerLabel(selectedHook.ownerExtensionId)} />
      <ContextRailBody>
        <ContextRailSection title="Timeline">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="ui-flat-panel">
              <div className="text-[18px] font-semibold text-primary">{beforeCount}</div>
              <div className="mt-1 text-secondary">Before</div>
            </div>
            <div className="ui-flat-panel">
              <div className="text-[18px] font-semibold text-primary">{afterCount}</div>
              <div className="mt-1 text-secondary">After</div>
            </div>
          </div>
        </ContextRailSection>
        <ContextRailSection title="Runs">
          <RoutinesRunHistory selectedHook={selectedHook} runs={selectedRuns} />
        </ContextRailSection>
      </ContextRailBody>
    </ContextRail>
  );
}

export function RoutinesPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState(hookIdFromHash(context.hash) ?? '');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Routine | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [openRoutineMenuId, setOpenRoutineMenuId] = useState<string | null>(null);
  const [pendingScrollRoutineId, setPendingScrollRoutineId] = useState<string | null>(null);
  const [unsavedRoutineIds, setUnsavedRoutineIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [windowedRunsOpen, setWindowedRunsOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<RoutinePosition | null>(null);
  const [dragTargetRoutineId, setDragTargetRoutineId] = useState<string | null>(null);
  const [dragTargetRoute, setDragTargetRoute] = useState<{ parentRoutineId: string; parentOutcomeId: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; name: string; type: RoutineType } | null>(null);
  const pointerDragIdRef = useRef<string | null>(null);
  const handledSearchActionRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (options?: { resetSelection?: boolean }) => {
      setError(null);
      try {
        const result = (await pa.extension.invoke('getState', {})) as StateResult;
        setData(result);
        const initialHookId = hookIdFromHash(context.hash) ?? selectedHookId;
        const firstActiveHookId = result.routines.find((routine) => routine.enabled)?.hookId ?? '';
        const nextHookId = result.hooks.some((hook) => hook.id === initialHookId)
          ? initialHookId
          : result.hooks.some((hook) => hook.id === firstActiveHookId)
            ? firstActiveHookId
            : '';
        setSelectedHookId(nextHookId);
        if (options?.resetSelection) {
          setSelectedRoutineId(null);
          setDraft(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [context.hash, pa, selectedHookId],
  );

  useEffect(() => {
    void load({ resetSelection: true });
  }, []);

  useEffect(() => {
    const subscription = pa.ui.subscribeInvalidations((event) => {
      if (event.topics.some((topic) => topic === 'routines')) void load();
    });
    return () => subscription.unsubscribe();
  }, [load, pa]);

  useEffect(() => {
    const nextHookId = hookIdFromHash(context.hash);
    if (!nextHookId || nextHookId === selectedHookId) return;
    const selectedRoutine = selectedRoutineId ? data?.routines.find((routine) => routine.id === selectedRoutineId) : null;
    if (selectedRoutine && unsavedRoutineIds.has(selectedRoutine.id)) {
      void (async () => {
        const confirmed = await pa.ui.confirm({ message: `Discard unsaved routine “${selectedRoutine.name}”?` });
        if (!confirmed) {
          void navigateRoutines(pa, selectedHookId);
          return;
        }
        setData((current) =>
          current ? { ...current, routines: current.routines.filter((routine) => routine.id !== selectedRoutine.id) } : current,
        );
        setUnsavedRoutineIds((current) => {
          const next = new Set(current);
          next.delete(selectedRoutine.id);
          return next;
        });
        setSelectedRoutineId(null);
        setDraft(null);
        setSelectedHookId(nextHookId);
      })();
      return;
    }
    setSelectedHookId(nextHookId);
  }, [context.hash, data?.routines, pa, selectedHookId, selectedRoutineId, unsavedRoutineIds]);

  useEffect(() => {
    const action = searchAction(context.search);
    const actionKey = `${context.search ?? ''}:${context.hash ?? ''}`;
    if (action !== 'new' || handledSearchActionRef.current === actionKey) return;
    handledSearchActionRef.current = actionKey;
    setShowAdd(true);
  }, [context.hash, context.search]);

  useEffect(() => {
    if (!showAdd && !showEvents && !openRoutineMenuId && skillQuery === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-routines-menu]') || target?.closest('[data-routines-skill-menu]')) return;
      setShowAdd(false);
      setShowEvents(false);
      setOpenRoutineMenuId(null);
      setSkillQuery(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowAdd(false);
      setShowEvents(false);
      setOpenRoutineMenuId(null);
      setSkillQuery(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openRoutineMenuId, showAdd, showEvents, skillQuery]);

  useEffect(() => {
    void pa.extension
      .invoke('listSkills', {})
      .then((result) => {
        const listed = Array.isArray((result as { skills?: unknown[] }).skills) ? ((result as { skills: SkillItem[] }).skills ?? []) : [];
        const byId = new Map([...FALLBACK_SKILLS, ...listed].map((skill) => [skill.id, skill]));
        setSkills(Array.from(byId.values()));
      })
      .catch(() => setSkills(FALLBACK_SKILLS));
  }, [pa]);

  useEffect(() => {
    void pa
      .models()
      .then((result) => {
        const listed = Array.isArray(result) ? (result as ModelItem[]) : [];
        setModels(listed.filter((model) => typeof model.id === 'string' && model.id.length > 0));
      })
      .catch(() => setModels([]));
  }, [pa]);

  const selectedHook = selectedHookId ? data?.hooks.find((hook) => hook.id === selectedHookId) : null;
  const hookRoutines = useMemo(
    () => (data?.routines ?? []).filter((routine) => routine.hookId === selectedHookId).sort((left, right) => left.order - right.order),
    [data, selectedHookId],
  );
  const topLevelRoutines = hookRoutines.filter((routine) => !routine.parentRoutineId);
  const beforeRoutines = topLevelRoutines.filter((routine) => routine.position === 'before');
  const afterRoutines = topLevelRoutines.filter((routine) => routine.position === 'after');
  const hasTimelineRoutines = topLevelRoutines.length > 0;
  const savedDraft = draft ? data?.routines.find((routine) => routine.id === draft.id) : null;
  const draftIsDirty = Boolean(draft && (unsavedRoutineIds.has(draft.id) || JSON.stringify(draft) !== JSON.stringify(savedDraft ?? null)));
  const branchRoutineOptions = hookRoutines.filter((routine) => routine.id !== draft?.id);
  const routineNameById = useMemo(() => new Map(hookRoutines.map((routine) => [routine.id, routine.name])), [hookRoutines]);
  useEffect(() => {
    if (!data || !selectedRoutineId) return;
    if (unsavedRoutineIds.has(selectedRoutineId)) return;
    const currentRoutine = data.routines.find((routine) => routine.id === selectedRoutineId && routine.hookId === selectedHookId);
    if (currentRoutine) return;
    setSelectedRoutineId(null);
    setDraft(null);
  }, [data, selectedHookId, selectedRoutineId, unsavedRoutineIds]);

  useEffect(() => {
    if (!pendingScrollRoutineId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-routine-id="${pendingScrollRoutineId}"]`);
      if (target) {
        target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        setPendingScrollRoutineId(null);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingScrollRoutineId, data?.routines, selectedHookId, selectedRoutineId]);

  const selectRoutine = useCallback((routine: Routine) => {
    setSelectedRoutineId(routine.id);
    setDraft({ ...routine, outcomes: routine.outcomes.map((outcome) => ({ ...outcome })) });
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    const validationError = validateRoutineDraft(draft);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const result = (await pa.extension.invoke('saveRoutine', draft)) as StateResult;
      const saved = result.routines.find((routine) => routine.id === draft.id) ?? draft;
      setData(result);
      publishRoutinesState(result);
      setSelectedHookId(saved.hookId);
      setSelectedRoutineId(null);
      setDraft(null);
      setUnsavedRoutineIds((current) => {
        const next = new Set(current);
        next.delete(saved.id);
        return next;
      });
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      pa.ui.toast('Routine saved', 'info');
      if (saved.hookId !== selectedHookId) void navigateRoutines(pa, saved.hookId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draft, pa, selectedHookId]);

  const deleteRoutine = useCallback(
    async (routine: Routine) => {
      const confirmed = await pa.ui.confirm({ message: `Delete “${routine.name}”?` });
      if (!confirmed) return;
      if (unsavedRoutineIds.has(routine.id)) {
        const next = data ? withHookSummaries({ ...data, routines: data.routines.filter((item) => item.id !== routine.id) }) : data;
        setUnsavedRoutineIds((current) => {
          const next = new Set(current);
          next.delete(routine.id);
          return next;
        });
        setSelectedRoutineId(null);
        setDraft(null);
        setOpenRoutineMenuId(null);
        setData(next);
        if (next) publishRoutinesState(next);
        return;
      }
      const result = (await pa.extension.invoke('deleteRoutine', { routineId: routine.id })) as StateResult;
      setData(result);
      publishRoutinesState(result);
      setSelectedRoutineId(null);
      setDraft(null);
      setOpenRoutineMenuId(null);
    },
    [data, pa, selectedHookId, unsavedRoutineIds],
  );

  const addRoutine = useCallback(
    (type: RoutineType, parent?: { parentRoutineId: string; parentOutcomeId: string }, hookOverrideId?: string) => {
      if (!selectedHook && !hookOverrideId) return;
      const hookId = hookOverrideId ?? selectedHook?.id;
      if (!hookId) return;
      const parentRoutine = parent ? hookRoutines.find((routine) => routine.id === parent.parentRoutineId) : null;
      const routine = nowRoutine(hookId, parentRoutine?.position ?? 'before', type, parent);
      setShowAdd(false);
      setActionError(null);
      setSelectedHookId(hookId);
      setSelectedRoutineId(routine.id);
      setPendingScrollRoutineId(routine.id);
      setDraft(routine);
      setUnsavedRoutineIds((current) => new Set(current).add(routine.id));
      const next = data ? withHookSummaries({ ...data, routines: [...data.routines, routine] }) : data;
      setData(next);
      if (next) publishRoutinesState(next);
    },
    [data, hookRoutines, selectedHook],
  );

  const addExampleRoutine = useCallback(
    (preferredHookId: string, createRoutine: (hookId: string) => Routine) => {
      const hookId = data?.hooks.some((hook) => hook.id === preferredHookId) ? preferredHookId : (data?.hooks[0]?.id ?? preferredHookId);
      const routine = createRoutine(hookId);
      setShowAdd(false);
      setShowEvents(false);
      setActionError(null);
      setSelectedHookId(hookId);
      setSelectedRoutineId(routine.id);
      setPendingScrollRoutineId(routine.id);
      setDraft({ ...routine, outcomes: routine.outcomes.map((outcome) => ({ ...outcome })) });
      setUnsavedRoutineIds((current) => new Set(current).add(routine.id));
      const next = data ? withHookSummaries({ ...data, routines: [...data.routines, routine] }) : data;
      setData(next);
      if (next) publishRoutinesState(next);
    },
    [data],
  );

  const addCheckpointExample = useCallback(() => addExampleRoutine('checkpoint', checkpointExampleRoutine), [addExampleRoutine]);

  const moveRoutineById = useCallback(
    async (
      routineId: string,
      position: RoutinePosition,
      targetRoutineId = '',
      parent?: { parentRoutineId: string; parentOutcomeId: string } | null,
    ) => {
      if (!routineId || routineId === targetRoutineId) return;
      if (unsavedRoutineIds.has(routineId)) {
        if (parent?.parentRoutineId === routineId) {
          const message = 'Save the choose-path routine before moving routines into its paths.';
          setActionError(message);
          pa.ui.toast(message, 'error');
        } else {
          const parentRoutine = parent ? data?.routines.find((routine) => routine.id === parent.parentRoutineId) : null;
          const nextPosition = parentRoutine?.position ?? position;
          const targetRoutine = targetRoutineId ? data?.routines.find((routine) => routine.id === targetRoutineId) : null;
          const targetParentRoutineId = parent && parentRoutine ? parent.parentRoutineId : '';
          const targetParentOutcomeId = parent && parentRoutine ? parent.parentOutcomeId : '';
          const targetLaneOrders = (data?.routines ?? [])
            .filter(
              (routine) =>
                routine.id !== routineId &&
                routine.hookId === data?.routines.find((item) => item.id === routineId)?.hookId &&
                routine.position === nextPosition &&
                (routine.parentRoutineId ?? '') === targetParentRoutineId &&
                (routine.parentOutcomeId ?? '') === targetParentOutcomeId,
            )
            .map((routine) => routine.order);
          const nextOrder = targetRoutine ? targetRoutine.order - 0.5 : Math.max(-1, ...targetLaneOrders) + 1;
          const applyMove = (routine: Routine): Routine => {
            const next = { ...routine, position: nextPosition, order: nextOrder, updatedAt: new Date().toISOString() };
            if (parent && parentRoutine)
              return { ...next, parentRoutineId: parent.parentRoutineId, parentOutcomeId: parent.parentOutcomeId };
            delete next.parentRoutineId;
            delete next.parentOutcomeId;
            return next;
          };
          setData((current) =>
            current
              ? { ...current, routines: current.routines.map((routine) => (routine.id === routineId ? applyMove(routine) : routine)) }
              : current,
          );
          if (selectedRoutineId === routineId && draft) setDraft(applyMove(draft));
          setActionError(null);
        }
        setDragId(null);
        setDragOverPosition(null);
        setDragTargetRoutineId(null);
        setDragTargetRoute(null);
        setDragPreview(null);
        return;
      }
      try {
        const result = (await pa.extension.invoke('moveRoutine', {
          routineId,
          position,
          targetRoutineId,
          ...(parent ?? {}),
        })) as StateResult;
        setData(result);
        publishRoutinesState(result);
        const selected = result.routines.find((routine) => routine.id === selectedRoutineId);
        if (selected) setDraft({ ...selected, outcomes: selected.outcomes.map((outcome) => ({ ...outcome })) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        pa.ui.toast(message || 'Routine was not moved', 'error');
      } finally {
        setDragId(null);
        setDragOverPosition(null);
        setDragTargetRoutineId(null);
        setDragTargetRoute(null);
        setDragPreview(null);
      }
    },
    [data?.routines, draft, pa, selectedRoutineId, unsavedRoutineIds],
  );

  const moveRoutine = useCallback(
    async (position: RoutinePosition, targetRoutineId = '') => {
      if (!dragId) return;
      await moveRoutineById(dragId, position, targetRoutineId);
    },
    [dragId, moveRoutineById],
  );

  const startPointerDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, routine: Routine) => {
      event.preventDefault();
      event.stopPropagation();
      pointerDragIdRef.current = routine.id;
      setDragId(routine.id);
      setDragTargetRoutineId(null);
      setDragTargetRoute(null);
      setDragPreview({ x: event.clientX, y: event.clientY, name: routine.name, type: routine.type });

      const onPointerMove = (moveEvent: PointerEvent) => {
        setDragPreview({ x: moveEvent.clientX, y: moveEvent.clientY, name: routine.name, type: routine.type });
        const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
        const targetRoute = element?.closest<HTMLElement>('[data-routine-route]');
        const targetRoutine = element?.closest<HTMLElement>('[data-routine-id]');
        const lane = element?.closest<HTMLElement>('[data-routine-lane]')?.dataset.routineLane as RoutinePosition | undefined;
        setDragTargetRoute(
          targetRoute?.dataset.parentRoutineId && targetRoute.dataset.parentOutcomeId
            ? { parentRoutineId: targetRoute.dataset.parentRoutineId, parentOutcomeId: targetRoute.dataset.parentOutcomeId }
            : null,
        );
        setDragTargetRoutineId(
          targetRoutine?.dataset.routineId && targetRoutine.dataset.routineId !== routine.id ? targetRoutine.dataset.routineId : null,
        );
        if (lane === 'before' || lane === 'after') setDragOverPosition(lane);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const routineIdToMove = pointerDragIdRef.current;
        pointerDragIdRef.current = null;
        const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
        const targetRoute = element?.closest<HTMLElement>('[data-routine-route]');
        const targetRoutine = element?.closest<HTMLElement>('[data-routine-id]');
        const targetLane = element?.closest<HTMLElement>('[data-routine-lane]');
        const routeParent =
          targetRoute?.dataset.parentRoutineId && targetRoute.dataset.parentOutcomeId
            ? { parentRoutineId: targetRoute.dataset.parentRoutineId, parentOutcomeId: targetRoute.dataset.parentOutcomeId }
            : null;
        const position = (targetRoutine?.dataset.routinePosition ?? targetLane?.dataset.routineLane ?? routine.position) as
          | RoutinePosition
          | undefined;
        const targetRoutineId =
          targetRoutine?.dataset.routineId && targetRoutine.dataset.routineId !== routineIdToMove ? targetRoutine.dataset.routineId : '';
        if (routineIdToMove && (position === 'before' || position === 'after')) {
          void moveRoutineById(routineIdToMove, position, targetRoutineId, routeParent);
          return;
        }
        setDragId(null);
        setDragOverPosition(null);
        setDragTargetRoutineId(null);
        setDragTargetRoute(null);
        setDragPreview(null);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [moveRoutineById],
  );

  const onDragStartRoutine = useCallback((event: React.DragEvent<HTMLDivElement>, routineId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', routineId);
    setDragId(routineId);
  }, []);

  const onDragOverLane = useCallback(
    (event: React.DragEvent, position: RoutinePosition) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const target = event.target as HTMLElement | null;
      const targetRoute = target?.closest<HTMLElement>('[data-routine-route]');
      const targetRoutine = target?.closest<HTMLElement>('[data-routine-id]');
      setDragTargetRoute(
        targetRoute?.dataset.parentRoutineId && targetRoute.dataset.parentOutcomeId
          ? { parentRoutineId: targetRoute.dataset.parentRoutineId, parentOutcomeId: targetRoute.dataset.parentOutcomeId }
          : null,
      );
      setDragTargetRoutineId(
        targetRoutine?.dataset.routineId && targetRoutine.dataset.routineId !== dragId ? targetRoutine.dataset.routineId : null,
      );
      setDragOverPosition(position);
    },
    [dragId],
  );

  const onDragEndRoutine = useCallback(() => {
    setDragId(null);
    setDragOverPosition(null);
    setDragTargetRoutineId(null);
    setDragTargetRoute(null);
    setDragPreview(null);
  }, []);

  const onInstructionChange = useCallback((value: string) => {
    setDraft((current) => (current ? { ...current, instruction: value } : current));
    const matches = Array.from(value.matchAll(/\/skill:([A-Za-z0-9._-]*)/g));
    const match = matches[matches.length - 1];
    setSkillQuery(match?.[1] ?? null);
  }, []);

  const skillMatches = useMemo(() => {
    if (skillQuery === null) return [];
    const query = skillQuery.toLowerCase();
    return skills.filter((skill) => `${skill.id} ${skill.name}`.toLowerCase().includes(query)).slice(0, 6);
  }, [skillQuery, skills]);

  const applySkill = useCallback(
    (skill: SkillItem) => {
      if (!draft) return;
      const nextInstruction = replaceLastSkillReference(draft.instruction, skill.id);
      setDraft({ ...draft, instruction: nextInstruction });
      setSkillQuery(null);
    },
    [draft],
  );

  const closeEditor = useCallback(() => {
    setSelectedRoutineId(null);
    setDraft(null);
    setActionError(null);
    setSkillQuery(null);
  }, []);

  if (loading) return <RoutinesLoadingState />;
  if (error) return <ErrorState title="Failed to load routines" message={error} />;
  if (!data) return <ErrorState title="No routine events" message="No lifecycle events are available." />;

  const renderEventMenu = (align: 'left' | 'right' = 'right') => (
    <PositionedMenu
      placement="absolute"
      position={align === 'right' ? { right: 0, top: '2.25rem' } : { left: 0, top: '2.25rem' }}
      className="max-h-[28rem] w-72 overflow-y-auto"
    >
      {groupedHooks(data.hooks).map(([group, hooks]) => (
        <div key={group}>
          <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.12em] text-dim">{group}</div>
          {hooks.map((hook) => (
            <MenuItem
              key={hook.id}
              type="button"
              className="items-start"
              onClick={() => {
                setShowEvents(false);
                setSelectedHookId(hook.id);
                void navigateRoutines(pa, hook.id);
              }}
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-primary">{hook.title}</span>
                <span className="block truncate text-[11px] text-secondary">{hook.description}</span>
              </span>
            </MenuItem>
          ))}
        </div>
      ))}
    </PositionedMenu>
  );

  if (!selectedHook) {
    const exampleRows = [
      {
        title: 'Check before checkpoint',
        body: 'Review changed files before saving a checkpoint, then stop or warn if something looks unfinished.',
        action: () => addExampleRoutine('checkpoint', checkpointExampleRoutine),
        primary: true,
      },
      {
        title: 'Write a checkpoint handoff',
        body: 'After a checkpoint saves, summarize what changed and what still needs attention.',
        action: () => addExampleRoutine('checkpoint', checkpointHandoffExampleRoutine),
        primary: false,
      },
      {
        title: 'Ask before risky background work',
        body: 'Pause background commands that can delete files, rewrite history, or change credentials.',
        action: () => addExampleRoutine('background.command', riskyBackgroundWorkExampleRoutine),
        primary: false,
      },
      {
        title: 'Choose a path before agent start',
        body: 'Route a request through planning, direct implementation, or a clarification before work begins.',
        action: () => addExampleRoutine('agent.before_start', agentStartPathExampleRoutine),
        primary: false,
      },
    ];

    if (context.shellPresentation === 'windowed') {
      return (
        <WindowedPageShell layout="standard" className="routines-page-windowed">
          <WindowedPageMain
            title="How Routines work"
            actions={
              <WindowedPageButton tone="accent" onClick={() => addExampleRoutine('checkpoint', checkpointExampleRoutine)}>
                Create checkpoint routine
              </WindowedPageButton>
            }
          >
            <WindowedPageSection title="Start with an event" meta="3 steps">
              <WindowedTimeline>
                <WindowedTimelineItem title="Pick an event" meta="1">
                  Events are moments Neon Pilot can react to, like Checkpoint or Before agent starts.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Place routines" meta="2">
                  Use Before for setup checks and After for follow-up work once the event finishes.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Review runs" meta="3">
                  Each execution records status, warnings, stops, and branch choices in the inspector.
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>
            <WindowedPageSection title="Events" meta={`${data.hooks.length} available`}>
              <WindowedList>
                {groupedHooks(data.hooks).flatMap(([group, hooks]) => [
                  <div key={`group:${group}`} className="wos-page-eyebrow">
                    {group}
                  </div>,
                  ...hooks.map((hook) => (
                    <WindowedListItem
                      key={hook.id}
                      title={hook.title}
                      meta={ownerLabel(hook.ownerExtensionId)}
                      detail={hook.summary}
                      active={hook.id === selectedHookId}
                      accent="routines"
                      onSelect={() => {
                        setSelectedHookId(hook.id);
                        void navigateRoutines(pa, hook.id);
                      }}
                    />
                  )),
                ])}
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Ready-made routines" meta={`${exampleRows.length} templates`}>
              <WindowedList>
                {exampleRows.map((example) => (
                  <WindowedListItem
                    key={example.title}
                    title={example.title}
                    detail={example.body}
                    accent="routines"
                    status={<WindowedBadge tone={example.primary ? 'positive' : 'neutral'}>Create</WindowedBadge>}
                    onSelect={example.action}
                  />
                ))}
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Status">
              <WindowedKeyValueList
                items={[
                  { label: 'Events', value: data.hooks.length },
                  { label: 'Routines', value: data.routines.length },
                  { label: 'Runs', value: data.runs.length },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      );
    }

    return (
      <div className="h-full min-h-0 overflow-auto bg-app text-[13px] text-primary">
        <AppPageLayout contentClassName="flex min-h-full w-full max-w-none flex-col gap-5">
          <AppPageIntro
            title="Routines"
            summary="Teach Neon Pilot what to do around key moments in your workflow."
            actions={
              <div className="relative" data-routines-menu="true">
                <ToolbarButton type="button" onClick={() => setShowEvents((value) => !value)}>
                  Add event
                </ToolbarButton>
                {showEvents ? renderEventMenu() : null}
              </div>
            }
          />

          <section className="max-w-[54rem] overflow-hidden rounded-md border border-border-subtle bg-surface/30">
            <div className="grid gap-4 border-b border-border-subtle px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">No events added</div>
                <h2 className="m-0 mt-2 text-[18px] font-semibold">How Routines work</h2>
                <p className="m-0 mt-2 max-w-[42rem] text-[13px] leading-5 text-secondary">
                  Routines are prompt blocks that run automatically before or after lifecycle events, such as checkpoint saves, agent
                  starts, or background commands.
                </p>
              </div>
              <Pill tone="accent">First run</Pill>
            </div>

            <div className="grid border-b border-border-subtle md:grid-cols-3">
              {[
                ['1', 'Pick an event', 'Events are moments Neon Pilot can react to, like Checkpoint or Before agent starts.'],
                ['2', 'Place routines', 'Use Before for setup checks and After for follow-up work once the event finishes.'],
                ['3', 'Review runs', 'Each execution records status, warnings, stops, and branch choices in the run inspector.'],
              ].map(([index, title, body], itemIndex) => (
                <div key={title} className={cx('p-4', itemIndex > 0 ? 'border-t border-border-subtle md:border-l md:border-t-0' : '')}>
                  <Pill tone="accent" mono>
                    {index}
                  </Pill>
                  <h3 className="m-0 mt-2 text-[13px] font-semibold">{title}</h3>
                  <p className="m-0 mt-1 text-[12px] leading-5 text-secondary">{body}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 px-4 py-4">
              <div>
                <h3 className="m-0 text-[13px] font-semibold">Try a ready-made routine</h3>
                <p className="m-0 mt-1 text-[12px] text-secondary">Pick an example, then edit its prompts and lanes after it is created.</p>
              </div>
              <div className="overflow-hidden rounded-md border border-border-subtle bg-app/40">
                {exampleRows.map((example, index) => (
                  <div
                    key={example.title}
                    className={cx(
                      'grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
                      index > 0 ? 'border-t border-border-subtle' : '',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-primary">{example.title}</div>
                      <div className="mt-0.5 text-[12px] leading-5 text-secondary">{example.body}</div>
                    </div>
                    <Button
                      type="button"
                      variant={example.primary ? 'action' : 'toolbar'}
                      tone={example.primary ? 'accent' : undefined}
                      onClick={example.action}
                    >
                      Create
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </AppPageLayout>
      </div>
    );
  }

  const renderEditor = (routine: Routine) => {
    if (!draft || draft.id !== routine.id) return null;
    const draftHook = data?.hooks.find((hook) => hook.id === draft.hookId) ?? selectedHook;
    return (
      <div className="border-t border-border-subtle bg-app/35 px-4 py-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4">
          <div className={cx('text-[12px]', draftIsDirty ? 'text-warning' : 'text-success')}>
            {saving ? 'Saving…' : draftIsDirty ? 'Unsaved changes' : lastSavedAt ? `Saved at ${lastSavedAt}` : 'Saved'}
          </div>
          <p className="m-0 mt-1 text-[12px] text-secondary">Edit this routine inline. Save collapses it back into the timeline.</p>
        </div>
        {actionError ? <div className="ui-callout-danger mb-4">{actionError}</div> : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] uppercase tracking-wider text-secondary">Event</span>
              <Select
                name="routine-hook"
                className="w-full"
                value={draft.hookId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setDraft({ ...draft, hookId: event.target.value })}
              >
                {groupedHooks(data?.hooks ?? []).map(([group, hooks]) => (
                  <optgroup key={group} label={group}>
                    {hooks.map((hook) => (
                      <option key={hook.id} value={hook.id}>
                        {hook.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wider text-secondary">Routine type</span>
                <Select
                  name="routine-type"
                  className="w-full"
                  value={draft.type}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft({
                      ...draft,
                      type: event.target.value as RoutineType,
                      outcomes: event.target.value === 'decision' && draft.outcomes.length === 0 ? DEFAULT_OUTCOMES : draft.outcomes,
                    })
                  }
                >
                  <option value="instruction">Run prompt</option>
                  <option value="decision">Choose path</option>
                  <option value="stop">Stop event</option>
                </Select>
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wider text-secondary">Position</span>
                <Select
                  name="routine-position"
                  className="w-full"
                  value={draft.position}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft({ ...draft, position: event.target.value as RoutinePosition })
                  }
                >
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </Select>
              </label>
            </div>
            {draft.type === 'stop' ? (
              <div className="ui-callout-warning">
                Stop event never calls a model. It always blocks this event and uses the instruction below as the explanation.
              </div>
            ) : null}
            <label className="grid gap-1">
              <span className="text-[11px] uppercase tracking-wider text-secondary">Name</span>
              <TextInput
                className="w-full"
                value={draft.name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            {draft.type === 'instruction' ? (
              <label className="grid gap-1">
                <span className="text-[11px] uppercase tracking-wider text-secondary">Pass / fail behavior</span>
                <Select
                  name="routine-failure-behavior"
                  className="w-full"
                  value={draft.failureBehavior}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft({ ...draft, failureBehavior: event.target.value as Routine['failureBehavior'] })
                  }
                >
                  <option value="continue">Continue if this routine fails</option>
                  <option value="warn">Warn and continue if this routine fails</option>
                  <option value="block">Stop this event if the routine fails</option>
                </Select>
                <span className="text-[12px] text-secondary">{failureBehaviorDescription(draft.failureBehavior)}</span>
              </label>
            ) : null}
            <label className="grid gap-1">
              <span className="text-[11px] uppercase tracking-wider text-secondary">Instruction</span>
              <div className="relative">
                <Textarea
                  className="min-h-32 w-full resize-y text-[13px]"
                  value={draft.instruction}
                  onFocus={(event) => onInstructionChange(event.currentTarget.value)}
                  onBlur={() => window.setTimeout(() => setSkillQuery(null), 100)}
                  onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (event.key === 'Escape') setSkillQuery(null);
                  }}
                  onKeyUp={(event) => onInstructionChange(event.currentTarget.value)}
                  onInput={(event) => onInstructionChange(event.currentTarget.value)}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onInstructionChange(event.target.value)}
                />
                {skillMatches.length ? (
                  <MenuShell role="listbox" data-routines-skill-menu="true" className="static mt-1 w-full">
                    {skillMatches.map((skill) => (
                      <MenuItem
                        key={skill.id}
                        type="button"
                        role="option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySkill(skill)}
                      >
                        <span className="min-w-0">
                          <b>/skill:{skill.id}</b>
                          <span className="block truncate text-[11px] text-secondary">{skill.description ?? skill.name}</span>
                        </span>
                      </MenuItem>
                    ))}
                  </MenuShell>
                ) : null}
              </div>
              <span className="text-[12px] text-secondary">
                Type <span className="text-accent">/skill:</span> to reference a skill.
              </span>
            </label>
          </div>
          <div className="grid content-start gap-3">
            {draft.type !== 'stop' ? (
              <div className="ui-flat-panel">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-secondary">Model for this routine</div>
                <label className="mb-2 grid gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-dim">Primary model</span>
                  <Select
                    className="w-full"
                    value={draft.modelRef ?? ''}
                    disabled={models.length === 0}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      setDraft({ ...draft, modelRef: event.target.value || undefined })
                    }
                  >
                    <option value="">Use app default</option>
                    {!hasModelValue(models, draft.modelRef) && draft.modelRef ? (
                      <option value={draft.modelRef}>{draft.modelRef}</option>
                    ) : null}
                    {groupedModels(models).map(([provider, providerModels]) => (
                      <optgroup key={provider} label={provider}>
                        {providerModels.map((model) => (
                          <option key={`${model.provider ?? ''}/${model.id}`} value={modelSelectionValue(model, models)}>
                            {modelLabel(model)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-dim">Backup model</span>
                  <Select
                    className="w-full"
                    value={draft.fallbackModelRef ?? ''}
                    disabled={models.length === 0}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      setDraft({ ...draft, fallbackModelRef: event.target.value || undefined })
                    }
                  >
                    <option value="">No backup model</option>
                    {!hasModelValue(models, draft.fallbackModelRef) && draft.fallbackModelRef ? (
                      <option value={draft.fallbackModelRef}>{draft.fallbackModelRef}</option>
                    ) : null}
                    {groupedModels(models).map(([provider, providerModels]) => (
                      <optgroup key={provider} label={provider}>
                        {providerModels.map((model) => (
                          <option key={`${model.provider ?? ''}/${model.id}`} value={modelSelectionValue(model, models)}>
                            {modelLabel(model)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </label>
                <div className="mt-2 text-[11px] text-secondary">
                  Use the app default unless this routine needs a specific model. Backup retries once if the primary model fails.
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-secondary">Available variables</div>
              {draftHook.variables.map((variable) => (
                <div key={variable.name} className="flex justify-between border-b border-border-subtle py-1 text-[12px]">
                  <span>{`{{${variable.name}}}`}</span>
                  <span className="text-secondary">{variable.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {draft.type === 'decision' ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-secondary">Paths</div>
                <div className="text-[12px] text-secondary">
                  The routine must return one enum value. That value selects the matching path.
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    outcomes: [
                      ...draft.outcomes,
                      { id: 'new_path', label: 'New path', target: 'Describe this path', behavior: 'continue' },
                    ],
                  })
                }
              >
                Add path
              </Button>
            </div>
            <div className="grid gap-2">
              {draft.outcomes.map((outcome, index) => (
                <div key={index} className="ui-flat-panel">
                  <div className="grid gap-2 md:grid-cols-[180px_1fr_220px_auto]">
                    <label className="grid gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-dim">Enum value</span>
                      <TextInput
                        className="w-full font-mono text-[12px]"
                        placeholder="needs_review"
                        value={outcome.id}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setDraft({
                            ...draft,
                            outcomes: draft.outcomes.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, id: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-dim">Path meaning</span>
                      <TextInput
                        className="w-full text-[12px]"
                        placeholder="Path to review"
                        value={outcome.target}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setDraft({
                            ...draft,
                            outcomes: draft.outcomes.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, target: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-dim">Fallback action</span>
                      <Select
                        className="w-full"
                        value={outcome.behavior}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                          const behavior = event.target.value as RoutineOutcome['behavior'];
                          setDraft({
                            ...draft,
                            outcomes: draft.outcomes.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    behavior,
                                    nextRoutineId: behavior === 'branch' ? item.nextRoutineId || branchRoutineOptions[0]?.id : undefined,
                                  }
                                : item,
                            ),
                          });
                        }}
                      >
                        <option value="continue">Continue</option>
                        <option value="warn">Warn and continue</option>
                        <option value="block">Stop if this path has no next step</option>
                        <option value="ask">Ask me</option>
                        <option value="branch">Branch</option>
                      </Select>
                      <span className="text-[11px] text-secondary">{outcomeBehaviorDescription(outcome.behavior)}</span>
                    </label>
                    <div className="flex items-end justify-end">
                      <Button
                        tone="danger"
                        variant="ghost"
                        onClick={() => setDraft({ ...draft, outcomes: draft.outcomes.filter((_, itemIndex) => itemIndex !== index) })}
                      >
                        <span aria-hidden="true">-</span>
                        Remove
                      </Button>
                    </div>
                  </div>
                  {outcome.behavior === 'branch' ? (
                    <label className="ui-flat-panel mt-2 grid gap-1 p-2">
                      <span className="text-[10px] uppercase tracking-wider text-dim">Then run</span>
                      <Select
                        className="w-full"
                        value={outcome.nextRoutineId ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                          setDraft({
                            ...draft,
                            outcomes: draft.outcomes.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, nextRoutineId: event.target.value || undefined } : item,
                            ),
                          })
                        }
                      >
                        <option value="">Choose a routine…</option>
                        {branchRoutineOptions.map((routineOption) => (
                          <option key={routineOption.id} value={routineOption.id}>
                            {routineOption.name} ({routineOption.position})
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}
                  <div
                    data-routine-route="true"
                    data-parent-routine-id={routine.id}
                    data-parent-outcome-id={outcome.id}
                    className={cx(
                      'mt-3 border-l border-border-subtle/70 pl-3 transition-colors',
                      dragTargetRoute?.parentRoutineId === routine.id &&
                        dragTargetRoute.parentOutcomeId === outcome.id &&
                        'ui-drop-surface-active',
                    )}
                    onDragOver={(event) => onDragOverLane(event, routine.position)}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (dragId)
                        void moveRoutineById(dragId, routine.position, '', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-dim">
                      <span>If this returns {outcome.id}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="toolbar"
                          className="h-6 px-2 text-[11px]"
                          title="Add run prompt routine"
                          onClick={(event) => {
                            event.stopPropagation();
                            addRoutine('instruction', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                          }}
                        >
                          <span aria-hidden="true">+</span>
                          Run prompt
                        </Button>
                        <Button
                          variant="toolbar"
                          className="h-6 px-2 text-[11px]"
                          title="Add choose path routine"
                          onClick={(event) => {
                            event.stopPropagation();
                            addRoutine('decision', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                          }}
                        >
                          <span aria-hidden="true">+</span>
                          Choose path
                        </Button>
                      </div>
                    </div>
                    {hookRoutines.filter((child) => child.parentRoutineId === routine.id && child.parentOutcomeId === outcome.id).length ? (
                      <div className="grid gap-2">
                        {hookRoutines
                          .filter((child) => child.parentRoutineId === routine.id && child.parentOutcomeId === outcome.id)
                          .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
                          .map((child, childIndex) => renderBlock(child, childIndex, true))}
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-border-subtle/70 px-3 py-2 text-[11px] text-secondary">
                        Drop a routine here, or add one.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderBlock = (routine: Routine, index = 0, nested = false) => {
    const isUnsaved = unsavedRoutineIds.has(routine.id);
    const isEditing = selectedRoutineId === routine.id && draft?.id === routine.id;
    const stepNumber = index + 1;
    return (
      <div key={routine.id}>
        {dragTargetRoutineId === routine.id ? <div className="ui-drop-indicator" /> : null}
        <div
          data-routine-id={routine.id}
          data-routine-position={routine.position}
          data-routine-type={routine.type}
          draggable
          onDragStart={(event) => onDragStartRoutine(event, routine.id)}
          onDragEnd={onDragEndRoutine}
          onDragOver={(event) => onDragOverLane(event, routine.position)}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void moveRoutine(routine.position, routine.id);
          }}
          className={cx(
            'rounded-md border border-border-subtle/70 bg-transparent transition-colors',
            nested ? 'bg-surface/15' : 'bg-surface/20',
            dragId === routine.id && 'opacity-60',
            (dragTargetRoutineId === routine.id || isEditing) && 'ui-drop-surface-active',
          )}
        >
          <div className="grid grid-cols-[22px_28px_24px_minmax(0,1fr)_auto] gap-2 px-2 py-2">
            <TextButton
              aria-label={`Drag ${routine.name}`}
              title={`Drag ${routine.name}`}
              className="ui-inline-action-link cursor-grab text-dim active:cursor-grabbing"
              onPointerDown={(event) => startPointerDrag(event, routine)}
            >
              ⋮⋮
            </TextButton>
            <div className="relative flex justify-center">
              <span className="pt-1 text-[11px] font-semibold tabular-nums text-secondary">{stepNumber}</span>
            </div>
            <div
              className={cx(
                'grid size-6 place-items-center rounded text-[13px]',
                routine.type === 'decision' ? 'text-purple-300' : routine.type === 'stop' ? 'text-danger' : 'text-accent',
              )}
              aria-hidden="true"
            >
              {routine.type === 'decision' ? '◇' : routine.type === 'stop' ? 'x' : '↳'}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <div className="truncate text-[13px] font-semibold">{routine.name}</div>
                <div className="text-[11px] text-secondary">
                  {routineLabel(routine.type)} · {routineFailureLabel(routine)}
                  {isUnsaved ? <span className="text-warning"> · unsaved</span> : null}
                </div>
              </div>
              <div className="truncate text-[12px] text-secondary">{routine.instruction || 'No instruction yet.'}</div>
              {routine.type !== 'stop' && (routine.modelRef || routine.fallbackModelRef) ? (
                <div className="mt-1 truncate font-mono text-[11px] text-dim">
                  {routine.modelRef || 'app default'}
                  {routine.fallbackModelRef ? ` → ${routine.fallbackModelRef}` : ''}
                </div>
              ) : null}
            </div>
            <div className="relative flex items-start gap-1" data-routines-menu="true">
              <TextButton
                className={cx('ui-inline-action-link', isEditing && 'text-primary')}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isEditing) closeEditor();
                  else selectRoutine(routine);
                }}
              >
                {isEditing ? 'Done' : 'Edit'}
              </TextButton>
              {isEditing ? (
                <Button
                  variant="action"
                  disabled={!draftIsDirty || saving}
                  onClick={(event) => {
                    event.stopPropagation();
                    void save();
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              ) : (
                <IconButton
                  compact
                  aria-label={`Delete ${routine.name}`}
                  title={`Delete ${routine.name}`}
                  className="ui-inline-action-link text-secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteRoutine(routine);
                  }}
                >
                  ×
                </IconButton>
              )}
            </div>
          </div>
          {isEditing ? renderEditor(routine) : null}
          {!isEditing && routine.type === 'decision' && routine.outcomes.length ? (
            <div className="border-t border-border-subtle/70 px-4 py-2 text-[12px]">
              <div className="grid gap-1 border-l border-border-subtle/70 pl-3">
                {routine.outcomes.map((outcome) => {
                  const branchTargetName = outcome.nextRoutineId ? routineNameById.get(outcome.nextRoutineId) : null;
                  const effect = outcomeEffect(outcome, branchTargetName ?? null);
                  const routeChildren = hookRoutines
                    .filter((child) => child.parentRoutineId === routine.id && child.parentOutcomeId === outcome.id)
                    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
                  return (
                    <div
                      key={outcome.id}
                      data-routine-route="true"
                      data-parent-routine-id={routine.id}
                      data-parent-outcome-id={outcome.id}
                      className={cx(
                        'rounded-md px-2 py-1.5 transition-colors',
                        dragTargetRoute?.parentRoutineId === routine.id && dragTargetRoute.parentOutcomeId === outcome.id
                          ? 'ui-drop-surface-active'
                          : 'bg-transparent',
                      )}
                      onDragOver={(event) => onDragOverLane(event, routine.position)}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (dragId)
                          void moveRoutineById(dragId, routine.position, '', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                      }}
                    >
                      <div className="grid grid-cols-[minmax(80px,128px)_minmax(0,1fr)_auto_auto] items-center gap-2">
                        <span className={cx('truncate font-mono font-semibold', effect.tone)}>{outcome.id}</span>
                        <span className="truncate text-secondary">{outcome.target}</span>
                        <span className={cx('font-mono text-[12px]', effect.tone)} title={effect.label} aria-label={effect.label}>
                          {effect.symbol}
                        </span>
                        <span className="text-[11px] text-dim">{effect.label}</span>
                      </div>
                      <div className="ml-3 mt-2 border-l border-border-subtle/70 pl-3">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-dim">
                          <span>If this returns {outcome.id}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="toolbar"
                              className="h-6 px-2 text-[11px]"
                              title="Add run prompt routine"
                              onClick={(event) => {
                                event.stopPropagation();
                                addRoutine('instruction', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                              }}
                            >
                              <span aria-hidden="true">+</span>
                              Run prompt
                            </Button>
                            <Button
                              variant="toolbar"
                              className="h-6 px-2 text-[11px]"
                              title="Add choose path routine"
                              onClick={(event) => {
                                event.stopPropagation();
                                addRoutine('decision', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                              }}
                            >
                              <span aria-hidden="true">+</span>
                              Choose path
                            </Button>
                          </div>
                        </div>
                        {routeChildren.length ? (
                          <div className="grid gap-2">{routeChildren.map((child, childIndex) => renderBlock(child, childIndex, true))}</div>
                        ) : (
                          <div className="rounded border border-dashed border-border-subtle/70 px-3 py-2 text-[11px] text-secondary">
                            Drop a routine here, or add one.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const selectedRoutine = selectedRoutineId ? hookRoutines.find((routine) => routine.id === selectedRoutineId) : null;

  if (context.shellPresentation === 'windowed') {
    const selectedRuns = data.runs.filter((run) => run.hookId === selectedHook.id);
    const renderWindowedRoutine = (routine: Routine, index: number) => {
      const isUnsaved = unsavedRoutineIds.has(routine.id);
      return (
        <WindowedTimelineItem
          key={routine.id}
          title={routine.name}
          meta={`${index + 1} · ${routineLabel(routine.type)}`}
          tone={routineTone(routine)}
        >
          <div className="wos-routine-row" data-routine-id={routine.id}>
            <div className="wos-routine-row__body">
              <div>{routine.instruction || 'No instruction yet.'}</div>
              <div>
                {routineStatusLabel(routine)}
                {isUnsaved ? ' · unsaved' : ''}
                {routine.modelRef ? ` · ${routine.modelRef}` : ''}
              </div>
            </div>
            <div className="wos-routine-row__actions">
              <WindowedPageButton
                onClick={() => {
                  selectRoutine(routine);
                }}
              >
                Open
              </WindowedPageButton>
              <WindowedPageButton onClick={() => void deleteRoutine(routine)}>Delete</WindowedPageButton>
            </div>
          </div>
          {routine.type === 'decision' && routine.outcomes.length ? (
            <WindowedList className="wos-routine-path-list">
              {routine.outcomes.map((outcome) => {
                const branchTargetName = outcome.nextRoutineId ? routineNameById.get(outcome.nextRoutineId) : null;
                const effect = outcomeEffect(outcome, branchTargetName ?? null);
                return (
                  <WindowedListItem
                    key={outcome.id}
                    title={outcome.id}
                    meta={effect.label}
                    detail={outcome.target}
                    accent="routines"
                    status={<WindowedBadge tone={outcome.behavior === 'block' ? 'danger' : 'neutral'}>{outcome.behavior}</WindowedBadge>}
                  />
                );
              })}
            </WindowedList>
          ) : null}
        </WindowedTimelineItem>
      );
    };

    return (
      <div className="h-full overflow-hidden">
        <WindowedPageShell layout="standard" className="routines-page-windowed">
          <WindowedPageMain
            title={selectedHook.title}
            actions={
              <>
                <WindowedPageButton tone="accent" onClick={() => addRoutine('instruction')}>
                  Run prompt
                </WindowedPageButton>
                <WindowedPageButton onClick={() => addRoutine('decision')}>Choose path</WindowedPageButton>
                <WindowedPageButton onClick={() => addRoutine('stop')}>Stop event</WindowedPageButton>
                <WindowedPageButton onClick={() => setWindowedRunsOpen(true)}>Runs</WindowedPageButton>
              </>
            }
          >
            {actionError ? (
              <WindowedPageSection title="Action needed">
                <WindowedEmptyState tone="danger">{actionError}</WindowedEmptyState>
              </WindowedPageSection>
            ) : null}
            <WindowedPageSection title="Events" meta={`${data.hooks.length} available`}>
              <WindowedList>
                {groupedHooks(data.hooks).flatMap(([group, hooks]) => [
                  <div key={`group:${group}`} className="wos-page-eyebrow">
                    {group}
                  </div>,
                  ...hooks.map((hook) => (
                    <WindowedListItem
                      key={hook.id}
                      title={hook.title}
                      meta={ownerLabel(hook.ownerExtensionId)}
                      detail={hook.summary}
                      active={hook.id === selectedHook.id}
                      accent="routines"
                      onSelect={() => {
                        closeEditor();
                        setWindowedRunsOpen(false);
                        setSelectedHookId(hook.id);
                        void navigateRoutines(pa, hook.id);
                      }}
                    />
                  )),
                ])}
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Before" meta={`${beforeRoutines.length} routines`}>
              {beforeRoutines.length ? (
                <WindowedTimeline>{beforeRoutines.map((routine, index) => renderWindowedRoutine(routine, index))}</WindowedTimeline>
              ) : (
                <WindowedEmptyState>No routines before this event.</WindowedEmptyState>
              )}
            </WindowedPageSection>
            <WindowedPageSection title="After" meta={`${afterRoutines.length} routines`}>
              {afterRoutines.length ? (
                <WindowedTimeline>{afterRoutines.map((routine, index) => renderWindowedRoutine(routine, index))}</WindowedTimeline>
              ) : (
                <WindowedEmptyState>No routines after this event.</WindowedEmptyState>
              )}
            </WindowedPageSection>
            <WindowedPageSection title="Status" meta={selectedRoutine?.name ?? selectedHook.title}>
              <WindowedKeyValueList
                items={[
                  { label: 'Owner', value: ownerLabel(selectedHook.ownerExtensionId) },
                  { label: 'Before', value: beforeRoutines.length },
                  { label: 'After', value: afterRoutines.length },
                  { label: 'Runs', value: selectedRuns.length },
                  {
                    label: 'Active',
                    value: selectedRoutine ? (
                      <WindowedBadge tone={routineTone(selectedRoutine)}>{routineStatusLabel(selectedRoutine)}</WindowedBadge>
                    ) : (
                      'Event'
                    ),
                  },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        {selectedRoutine && draft ? (
          <WindowedDialog
            title={selectedRoutine.name}
            meta={draftIsDirty ? 'Unsaved changes' : routineStatusLabel(selectedRoutine)}
            accent="routines"
            onClose={closeEditor}
            actions={
              <>
                <WindowedPageButton tone="accent" onClick={() => void save()}>
                  {saving ? 'Saving...' : 'Save'}
                </WindowedPageButton>
                <WindowedPageButton onClick={() => void deleteRoutine(selectedRoutine)}>Delete</WindowedPageButton>
              </>
            }
          >
            <div className="wos-routine-editor-bridge">{renderEditor(draft)}</div>
          </WindowedDialog>
        ) : null}

        {windowedRunsOpen ? (
          <WindowedDialog
            title="Routine runs"
            meta={`${selectedRuns.length} total`}
            accent="routines"
            onClose={() => setWindowedRunsOpen(false)}
          >
            {selectedRuns.length ? (
              <WindowedTimeline>
                {selectedRuns.slice(0, 12).map((run) => (
                  <WindowedTimelineItem key={run.id} title={run.status} meta={new Date(run.startedAt).toLocaleString()}>
                    {run.steps.length ? `${run.steps.length} recorded steps` : `${selectedHook.title} ran without recorded steps.`}
                  </WindowedTimelineItem>
                ))}
              </WindowedTimeline>
            ) : (
              <WindowedEmptyState>Run history appears here after routines execute.</WindowedEmptyState>
            )}
          </WindowedDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto bg-app text-[13px] text-primary">
      <AppPageLayout contentClassName="flex min-h-full w-full max-w-none flex-col gap-5">
        <AppPageIntro
          title={selectedHook.title}
          summary="Routines run prompts around this lifecycle event. Put setup checks in Before, follow-up work in After, or choose a path when the event needs a decision."
          actions={
            <>
              <div className="relative" data-routines-menu="true">
                <ToolbarButton type="button" onClick={() => setShowAdd((value) => !value)}>
                  Add routine ▾
                </ToolbarButton>
                {showAdd ? (
                  <PositionedMenu placement="absolute" position={{ right: 0, top: '2.25rem' }} className="w-56">
                    <MenuItem type="button" className="items-start" onClick={() => addRoutine('instruction')}>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-primary">Run prompt</span>
                        <span className="block text-[11px] text-secondary">Run one prompt before or after this event.</span>
                      </span>
                    </MenuItem>
                    <MenuItem type="button" className="items-start" onClick={() => addRoutine('decision')}>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-primary">Choose path</span>
                        <span className="block text-[11px] text-secondary">Assess the event and choose a path.</span>
                      </span>
                    </MenuItem>
                    <MenuItem type="button" className="items-start" onClick={() => addRoutine('stop')}>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-primary">Stop event</span>
                        <span className="block text-[11px] text-secondary">Always block this event with a message.</span>
                      </span>
                    </MenuItem>
                  </PositionedMenu>
                ) : null}{' '}
              </div>
            </>
          }
        />

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <div className="grid gap-5">
              <div>
                <h2 className="m-0 text-[18px] font-semibold">When {selectedHook.title} runs</h2>
                <p className="m-0 mt-1 text-[13px] text-secondary">
                  Drag routines to set order. Choose-path routines return one enum value, then run the matching nested path.
                </p>
              </div>
              {!hasTimelineRoutines ? (
                <EmptyState
                  align="start"
                  eyebrow="Editor page"
                  title="No routines on this event"
                  body="Routines let an event run setup work before it starts, follow-up work after it finishes, or branch through a path decision."
                  steps={[
                    'Add a run-prompt routine for direct work.',
                    'Add a choose-path routine when the event needs routing.',
                    'Drag routines between Before and After.',
                  ]}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <ToolbarButton type="button" onClick={() => setShowAdd(true)}>
                        Add routine
                      </ToolbarButton>
                      {selectedHook.id === 'checkpoint' ? (
                        <Button type="button" variant="toolbar" onClick={addCheckpointExample}>
                          Use checkpoint example
                        </Button>
                      ) : null}
                    </div>
                  }
                  className="rounded-md border border-dashed border-border-subtle/70 bg-surface/35 px-4 py-5"
                />
              ) : null}
              <section
                data-routine-lane="before"
                className={cx(
                  'grid gap-2 rounded-md transition-colors',
                  dragOverPosition === 'before' && dragId ? 'ui-drop-surface-active' : '',
                )}
                onDragOver={(event) => onDragOverLane(event, 'before')}
                onDragLeave={() => setDragOverPosition((current) => (current === 'before' ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  void moveRoutine('before');
                }}
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-secondary after:h-px after:flex-1 after:bg-border-subtle after:content-['']">
                  Before
                </div>
                {beforeRoutines.map((routine, index) => renderBlock(routine, index))}
                {beforeRoutines.length === 0 ? <RoutineLaneEmpty position="before" /> : null}
              </section>
              <section
                data-routine-lane="after"
                className={cx(
                  'grid gap-2 rounded-md transition-colors',
                  dragOverPosition === 'after' && dragId ? 'ui-drop-surface-active' : '',
                )}
                onDragOver={(event) => onDragOverLane(event, 'after')}
                onDragLeave={() => setDragOverPosition((current) => (current === 'after' ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  void moveRoutine('after');
                }}
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-secondary after:h-px after:flex-1 after:bg-border-subtle after:content-['']">
                  After
                </div>
                {afterRoutines.map((routine, index) => renderBlock(routine, index))}
                {afterRoutines.length === 0 ? <RoutineLaneEmpty position="after" /> : null}
              </section>
            </div>
          </div>
        </main>
      </AppPageLayout>
      {dragPreview ? (
        <div className="ui-drag-preview" style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}>
          <div className="text-[11px] uppercase tracking-[0.14em] text-accent">Dragging {routineLabel(dragPreview.type)}</div>
          <div className="mt-1 truncate text-[13px] font-semibold text-primary">{dragPreview.name}</div>
          <div className="mt-1 text-[11px] text-secondary">
            {dragTargetRoute
              ? `Drop into ${routineNameById.get(dragTargetRoute.parentRoutineId) ?? 'choose-path routine'} → ${dragTargetRoute.parentOutcomeId}.`
              : dragTargetRoutineId
                ? `Drop to place before ${routineNameById.get(dragTargetRoutineId) ?? 'this routine'}.`
                : dragOverPosition
                  ? `Drop to place at the end of ${dragOverPosition}.`
                  : 'Move over a lane or path to choose where it lands.'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoutineLaneEmpty({ position }: { position: RoutinePosition }) {
  return (
    <div className="rounded-md border border-dashed border-border-subtle/70 bg-surface/25 px-3 py-3 text-[12px] text-secondary">
      No routines {position} this event.
    </div>
  );
}
