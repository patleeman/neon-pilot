import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  type ActivityTreeItem,
  ActivityTreeView,
  AppPageIntro,
  AppPageLayout,
  Button,
  cx,
  ErrorState,
  LoadingState,
  SearchInput,
  SectionLabel,
  Select,
  Textarea,
  TextInput,
  ToolbarButton,
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
    name: type === 'decision' ? 'New judge' : type === 'stop' ? 'Stop event' : 'New instruction',
    instruction: type === 'stop' ? 'Stop this lifecycle event and explain why.' : '',
    enabled: true,
    order: 999,
    failureBehavior: type === 'instruction' ? 'continue' : 'block',
    outcomes: type === 'decision' ? DEFAULT_OUTCOMES : [],
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
  if (type === 'decision') return 'Judge routine';
  if (type === 'stop') return 'Manual stop';
  return 'Instruction routine';
}

function ownerLabel(ownerExtensionId: string): string {
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

function routineTreeStatus(summary: string): ActivityTreeItem['status'] {
  if (/fail|block|warn/i.test(summary)) return 'failed';
  if (summary === 'No routines') return 'idle';
  return 'done';
}

function RoutineHookList({
  hooks,
  selectedHookId,
  query,
  onQueryChange,
  onSelect,
}: {
  hooks: HookWithSummary[];
  selectedHookId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (hookId: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const activeHooks = hooks.filter((hook) => hook.summary !== 'No routines');
  const visibleHooks = normalizedQuery
    ? activeHooks.filter((hook) =>
        `${hook.title} ${hook.description} ${hook.group} ${ownerLabel(hook.ownerExtensionId)}`.toLowerCase().includes(normalizedQuery),
      )
    : activeHooks;

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
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="px-4 pb-0.5 pt-1">
        <SectionLabel className="block">Routines</SectionLabel>
      </div>
      <div className="px-2 pb-1.5 pt-1">
        <SearchInput
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
          placeholder="Search routines…"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3">
        <ActivityTreeView
          items={treeItems}
          activeItemId={selectedHookId}
          ariaLabel="Routines"
          emptyMessage={normalizedQuery ? 'No active routine hooks match.' : 'No routines yet. Use Add routine to choose a hook.'}
          onOpenItem={(item: ActivityTreeItem) => {
            if (item.kind !== 'group') onSelect(item.id);
          }}
        />
      </div>
    </div>
  );
}

export function RoutinesSidebar({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selectedHookId = hookIdFromHash(context.hash) ?? 'checkpoint';

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

  if (error) return <div className="p-3 text-[12px] text-danger">{error}</div>;
  if (!data) return <LoadingState label="Loading routines…" />;

  return (
    <RoutineHookList
      hooks={data.hooks}
      selectedHookId={selectedHookId}
      query={query}
      onQueryChange={setQuery}
      onSelect={(hookId) => void navigateRoutines(pa, hookId)}
    />
  );
}

export function RoutinesPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState(hookIdFromHash(context.hash) ?? 'checkpoint');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Routine | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [openRoutineMenuId, setOpenRoutineMenuId] = useState<string | null>(null);
  const [unsavedRoutineIds, setUnsavedRoutineIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<RoutinePosition | null>(null);
  const [dragTargetRoutineId, setDragTargetRoutineId] = useState<string | null>(null);
  const [dragTargetRoute, setDragTargetRoute] = useState<{ parentRoutineId: string; parentOutcomeId: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; name: string; type: RoutineType } | null>(null);
  const pointerDragIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = (await pa.extension.invoke('getState', {})) as StateResult;
      setData(result);
      const initialHookId = hookIdFromHash(context.hash) ?? selectedHookId;
      const nextHookId = result.hooks.some((hook) => hook.id === initialHookId) ? initialHookId : (result.hooks[0]?.id ?? 'checkpoint');
      setSelectedHookId(nextHookId);
      setSelectedRoutineId(null);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [context.hash, pa, selectedHookId]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const nextHookId = hookIdFromHash(context.hash);
    if (nextHookId) setSelectedHookId(nextHookId);
  }, [context.hash]);

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

  const selectedHook = data?.hooks.find((hook) => hook.id === selectedHookId) ?? data?.hooks[0];
  const hookRoutines = useMemo(
    () => (data?.routines ?? []).filter((routine) => routine.hookId === selectedHookId).sort((left, right) => left.order - right.order),
    [data, selectedHookId],
  );
  const topLevelRoutines = hookRoutines.filter((routine) => !routine.parentRoutineId);
  const beforeRoutines = topLevelRoutines.filter((routine) => routine.position === 'before');
  const afterRoutines = topLevelRoutines.filter((routine) => routine.position === 'after');
  const selectedRuns = (data?.runs ?? []).filter((run) => run.hookId === selectedHookId).slice(0, 20);
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

  const selectRoutine = useCallback((routine: Routine) => {
    setSelectedRoutineId(routine.id);
    setDraft({ ...routine, outcomes: routine.outcomes.map((outcome) => ({ ...outcome })) });
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = (await pa.extension.invoke('saveRoutine', draft)) as StateResult;
      const saved = result.routines.find((routine) => routine.id === draft.id) ?? draft;
      setData(result);
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
        setData((current) => (current ? { ...current, routines: current.routines.filter((item) => item.id !== routine.id) } : current));
        setUnsavedRoutineIds((current) => {
          const next = new Set(current);
          next.delete(routine.id);
          return next;
        });
        setSelectedRoutineId(null);
        setDraft(null);
        setOpenRoutineMenuId(null);
        return;
      }
      const result = (await pa.extension.invoke('deleteRoutine', { routineId: routine.id })) as StateResult;
      setData(result);
      setSelectedRoutineId(null);
      setDraft(null);
      setOpenRoutineMenuId(null);
    },
    [data?.routines, pa, selectedHookId, unsavedRoutineIds],
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
      setDraft(routine);
      setUnsavedRoutineIds((current) => new Set(current).add(routine.id));
      setData((current) => (current ? { ...current, routines: [...current.routines, routine] } : current));
      if (hookId !== selectedHookId) void navigateRoutines(pa, hookId);
    },
    [hookRoutines, pa, selectedHook, selectedHookId],
  );

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
          const message = 'Save the judge before moving routines into its routes.';
          setActionError(message);
          pa.ui.toast(message, 'error');
        } else {
          const parentRoutine = parent ? data?.routines.find((routine) => routine.id === parent.parentRoutineId) : null;
          const nextPosition = parentRoutine?.position ?? position;
          const applyMove = (routine: Routine): Routine => {
            const next = { ...routine, position: nextPosition, updatedAt: new Date().toISOString() };
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

  if (loading) return <LoadingState label="Loading routines…" />;
  if (error) return <ErrorState title="Failed to load routines" message={error} />;
  if (!data || !selectedHook) return <ErrorState title="No routine hooks" message="No lifecycle hooks are available." />;

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
        {actionError ? (
          <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-2 text-[12px] text-danger">{actionError}</div>
        ) : null}
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
                  <option value="instruction">Instruction: run a prompt</option>
                  <option value="decision">Judge: choose a route</option>
                  <option value="stop">Manual stop: always block</option>
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
              <div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-[12px] text-secondary">
                Manual stop never calls a model. It always blocks this event and uses the instruction below as the explanation.
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
                  onKeyUp={(event) => onInstructionChange(event.currentTarget.value)}
                  onInput={(event) => onInstructionChange(event.currentTarget.value)}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onInstructionChange(event.target.value)}
                />
                {skillMatches.length ? (
                  <div className="mt-1 overflow-hidden rounded-md border border-border-subtle bg-[#10141d] shadow-2xl">
                    {skillMatches.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        className="block w-full border-b border-border-subtle px-2 py-1.5 text-left last:border-b-0 hover:bg-surface-2"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySkill(skill)}
                      >
                        <b>/skill:{skill.id}</b>
                        <span className="block truncate text-[11px] text-secondary">{skill.description ?? skill.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="text-[12px] text-secondary">
                Type <span className="text-accent">/skill:</span> to reference a skill.
              </span>
            </label>
          </div>
          <div className="grid content-start gap-3">
            {draft.type !== 'stop' ? (
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3">
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
                <div className="text-[11px] uppercase tracking-wider text-secondary">Routes</div>
                <div className="text-[12px] text-secondary">
                  The judge must return one enum value. That value selects the matching nested route.
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
                Add route
              </Button>
            </div>
            <div className="grid gap-2">
              {draft.outcomes.map((outcome, index) => (
                <div key={index} className="rounded-md border border-border-subtle bg-surface-2 p-3">
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
                      <span className="text-[10px] uppercase tracking-wider text-dim">Route meaning</span>
                      <TextInput
                        className="w-full text-[12px]"
                        placeholder="Route to review"
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
                        <option value="block">Stop if this route has no next step</option>
                        <option value="ask">Ask me</option>
                        <option value="branch">Branch</option>
                      </Select>
                      <span className="text-[11px] text-secondary">{outcomeBehaviorDescription(outcome.behavior)}</span>
                    </label>
                    <div className="flex items-end justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => setDraft({ ...draft, outcomes: draft.outcomes.filter((_, itemIndex) => itemIndex !== index) })}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {outcome.behavior === 'branch' ? (
                    <label className="mt-2 grid gap-1 rounded-md border border-border-subtle bg-app/40 p-2">
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
                      dragTargetRoute?.parentRoutineId === routine.id && dragTargetRoute.parentOutcomeId === outcome.id
                        ? 'bg-accent/10 outline outline-1 outline-accent/40'
                        : '',
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
                      <span>If judge returns {outcome.id}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-accent hover:bg-surface-3"
                          onClick={(event) => {
                            event.stopPropagation();
                            addRoutine('instruction', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                          }}
                        >
                          Add instruction
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-accent hover:bg-surface-3"
                          onClick={(event) => {
                            event.stopPropagation();
                            addRoutine('decision', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                          }}
                        >
                          Add judge
                        </button>
                      </div>
                    </div>
                    {hookRoutines.filter((child) => child.parentRoutineId === routine.id && child.parentOutcomeId === outcome.id).length ? (
                      <div className="grid gap-2">
                        {hookRoutines
                          .filter((child) => child.parentRoutineId === routine.id && child.parentOutcomeId === outcome.id)
                          .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
                          .map(renderBlock)}
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

  const renderBlock = (routine: Routine) => {
    const isUnsaved = unsavedRoutineIds.has(routine.id);
    const isEditing = selectedRoutineId === routine.id && draft?.id === routine.id;
    return (
      <div key={routine.id}>
        {dragTargetRoutineId === routine.id ? (
          <div className="mb-2 h-1 rounded-full bg-accent shadow-[0_0_18px_rgba(80,160,255,0.45)]" />
        ) : null}
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
            'relative overflow-visible rounded-md border bg-surface-2 text-left transition-colors',
            dragId === routine.id && 'scale-[0.99] border-accent/60 bg-accent/10 opacity-45 ring-1 ring-accent/40',
            dragTargetRoutineId === routine.id && 'border-accent/70',
            isEditing ? 'border-accent/70 bg-accent/10' : 'border-border-subtle',
          )}
        >
          <div className="grid grid-cols-[22px_1fr_auto] gap-2 px-2 py-2">
            <button
              type="button"
              aria-label={`Drag ${routine.name}`}
              className="cursor-grab rounded px-1 text-dim hover:bg-surface-3 hover:text-primary active:cursor-grabbing"
              onPointerDown={(event) => startPointerDrag(event, routine)}
            >
              ⋮⋮
            </button>
            <div className="min-w-0">
              <div className="flex gap-2 text-[11px] text-secondary">
                <span className={routine.type === 'decision' ? 'text-purple-300' : routine.type === 'stop' ? 'text-danger' : 'text-accent'}>
                  {routineLabel(routine.type)}
                </span>
                {routine.type === 'instruction' ? (
                  <span>
                    {routine.failureBehavior === 'block'
                      ? 'blocks on fail'
                      : routine.failureBehavior === 'warn'
                        ? 'warns on fail'
                        : 'continues'}
                  </span>
                ) : null}
                {isUnsaved ? <span className="text-warning">unsaved</span> : null}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold">{routine.name}</div>
              <div className="truncate text-[12px] text-secondary">{routine.instruction || 'No instruction yet.'}</div>
              {routine.type !== 'stop' && (routine.modelRef || routine.fallbackModelRef) ? (
                <div className="mt-1 truncate font-mono text-[11px] text-dim">
                  {routine.modelRef || 'app default'}
                  {routine.fallbackModelRef ? ` → ${routine.fallbackModelRef}` : ''}
                </div>
              ) : null}
            </div>
            <div className="relative flex items-start gap-1">
              <button
                type="button"
                className={cx('rounded px-2 py-1 text-[12px] hover:bg-surface-3', isEditing ? 'bg-surface-3 text-primary' : 'text-accent')}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isEditing) closeEditor();
                  else selectRoutine(routine);
                }}
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  disabled={!draftIsDirty || saving}
                  className="rounded bg-accent px-2 py-1 text-[12px] text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-dim"
                  onClick={(event) => {
                    event.stopPropagation();
                    void save();
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label={`More actions for ${routine.name}`}
                    aria-expanded={openRoutineMenuId === routine.id}
                    className="rounded px-2 py-1 text-xl leading-none text-secondary hover:bg-surface-3 hover:text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenRoutineMenuId((current) => (current === routine.id ? null : routine.id));
                    }}
                  >
                    …
                  </button>
                  {openRoutineMenuId === routine.id ? (
                    <div
                      className="absolute right-0 top-8 z-20 min-w-40 overflow-hidden rounded-md border border-border-subtle bg-[#10141d] py-1 text-[12px] shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-primary hover:bg-surface-3"
                        onClick={() => {
                          setOpenRoutineMenuId(null);
                          void moveRoutineById(routine.id, routine.position === 'before' ? 'after' : 'before');
                        }}
                      >
                        Move to {routine.position === 'before' ? 'After' : 'Before'}
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-danger hover:bg-surface-3"
                        onClick={() => void deleteRoutine(routine)}
                      >
                        Delete routine
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {isEditing ? renderEditor(routine) : null}
          {!isEditing && routine.type === 'decision' && routine.outcomes.length ? (
            <div className="border-t border-border-subtle px-4 py-2 text-[12px]">
              <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-dim">Routes</div>
              <div className="grid gap-2 border-l border-border-subtle pl-3">
                {routine.outcomes.map((outcome) => {
                  const branchTargetName = outcome.nextRoutineId ? routineNameById.get(outcome.nextRoutineId) : null;
                  const reaction =
                    outcome.behavior === 'branch'
                      ? branchTargetName
                        ? `Route continues to ${branchTargetName}`
                        : 'Route can continue to another routine'
                      : outcome.behavior === 'block'
                        ? 'Route stops here'
                        : outcome.behavior === 'warn'
                          ? 'Route warns and continues'
                          : outcome.behavior === 'ask'
                            ? 'Route asks you first'
                            : 'Route continues';
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
                          ? 'bg-accent/10 outline outline-1 outline-accent/40'
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
                      <div className="grid grid-cols-[128px_1fr_auto] items-start gap-2">
                        <span
                          className={cx(
                            'font-mono font-semibold',
                            outcome.behavior === 'block'
                              ? 'text-danger'
                              : outcome.behavior === 'warn'
                                ? 'text-warning'
                                : outcome.behavior === 'ask' || outcome.behavior === 'branch'
                                  ? 'text-accent'
                                  : 'text-success',
                          )}
                        >
                          {outcome.id}
                        </span>
                        <span className="text-secondary">{outcome.target}</span>
                        <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-dim">
                          {reaction}
                        </span>
                      </div>
                      <div className="ml-3 mt-2 border-l border-border-subtle/70 pl-3">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-dim">
                          <span>If judge returns {outcome.id}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-accent hover:bg-surface-3"
                              onClick={(event) => {
                                event.stopPropagation();
                                addRoutine('instruction', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                              }}
                            >
                              Add instruction
                            </button>
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-accent hover:bg-surface-3"
                              onClick={(event) => {
                                event.stopPropagation();
                                addRoutine('decision', { parentRoutineId: routine.id, parentOutcomeId: outcome.id });
                              }}
                            >
                              Add judge
                            </button>
                          </div>
                        </div>
                        {routeChildren.length ? (
                          <div className="grid gap-2">{routeChildren.map(renderBlock)}</div>
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

  return (
    <div className="h-full min-h-0 overflow-auto bg-app text-[13px] text-primary">
      <AppPageLayout contentClassName="flex min-h-full w-full max-w-none flex-col gap-5">
        <AppPageIntro
          title={selectedHook.title}
          actions={
            <>
              <ToolbarButton type="button" onClick={() => setShowRuns((value) => !value)}>
                {showRuns ? 'Timeline' : 'Runs'}
              </ToolbarButton>
              <div className="relative">
                <ToolbarButton type="button" onClick={() => setShowAdd((value) => !value)}>
                  Add routine ▾
                </ToolbarButton>
                {showAdd ? (
                  <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-md border border-border-subtle bg-[#10141d] shadow-2xl">
                    <button
                      className="block w-full border-b border-border-subtle px-3 py-2 text-left hover:bg-surface-3"
                      onClick={() => addRoutine('instruction')}
                    >
                      <span className="block text-[13px] font-medium text-primary">Instruction</span>
                      <span className="block text-[11px] text-secondary">Run an agent invocation.</span>
                    </button>
                    <button
                      className="block w-full border-b border-border-subtle px-3 py-2 text-left hover:bg-surface-3"
                      onClick={() => addRoutine('decision')}
                    >
                      <span className="block text-[13px] font-medium text-primary">Judge</span>
                      <span className="block text-[11px] text-secondary">Assess the event and choose a path.</span>
                    </button>
                    <button className="block w-full px-3 py-2 text-left hover:bg-surface-3" onClick={() => addRoutine('stop')}>
                      <span className="block text-[13px] font-medium text-primary">Manual stop</span>
                      <span className="block text-[11px] text-secondary">Advanced: always block this event.</span>
                    </button>
                  </div>
                ) : null}{' '}
              </div>
            </>
          }
        />

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            {showRuns ? (
              <div className="grid min-h-full gap-2">
                {selectedRuns.length === 0 ? (
                  <div className="grid min-h-[24rem] place-items-center text-center">
                    <div>
                      <div className="text-[14px] font-medium text-primary">No routine runs yet.</div>
                      <div className="mt-2 max-w-sm text-[12px] text-secondary">
                        Runs appear here after a lifecycle event executes routines for {selectedHook.title.toLowerCase()}.
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedRuns.map((run) => (
                  <div key={run.id} className="rounded-md border border-border-subtle bg-surface-2 p-3">
                    <div className="flex gap-2">
                      <b>{run.status}</b>
                      <span className="text-secondary">{new Date(run.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[12px] text-secondary">
                      {run.steps.map((step, index) => (
                        <div key={`${step.routineId}-${index}`}>
                          {step.routineName}: {step.outcome ?? step.status} {step.message ? `— ${step.message}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-5">
                <div>
                  <h2 className="m-0 text-[18px] font-semibold">{selectedHook.title} timeline</h2>
                  <p className="m-0 mt-1 text-[13px] text-secondary">
                    Drag routines within Before or After. Judge routines assess a prompt, output one enum, then run the matching nested
                    route.
                  </p>
                </div>
                <section
                  data-routine-lane="before"
                  className={cx(
                    'grid gap-2 rounded-md transition-colors',
                    dragOverPosition === 'before' && dragId ? 'bg-accent/5 outline outline-1 outline-accent/30' : '',
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
                  {beforeRoutines.map(renderBlock)}
                  {beforeRoutines.length === 0 ? (
                    <div className="py-6 text-[12px] text-secondary">No routines before this event.</div>
                  ) : null}
                </section>
                <section
                  data-routine-lane="after"
                  className={cx(
                    'grid gap-2 rounded-md transition-colors',
                    dragOverPosition === 'after' && dragId ? 'bg-accent/5 outline outline-1 outline-accent/30' : '',
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
                  {afterRoutines.map(renderBlock)}
                  {afterRoutines.length === 0 ? <div className="py-6 text-[12px] text-secondary">No routines after this event.</div> : null}
                </section>
              </div>
            )}
          </div>
        </main>
      </AppPageLayout>
      {dragPreview ? (
        <div
          className="pointer-events-none fixed z-50 w-72 rounded-md border border-accent/70 bg-[#10141d]/95 px-3 py-2 text-left shadow-2xl ring-1 ring-accent/30"
          style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-accent">Dragging {routineLabel(dragPreview.type)}</div>
          <div className="mt-1 truncate text-[13px] font-semibold text-primary">{dragPreview.name}</div>
          <div className="mt-1 text-[11px] text-secondary">
            {dragTargetRoute
              ? `Drop into ${routineNameById.get(dragTargetRoute.parentRoutineId) ?? 'judge'} → ${dragTargetRoute.parentOutcomeId}.`
              : dragTargetRoutineId
                ? `Drop to place before ${routineNameById.get(dragTargetRoutineId) ?? 'this routine'}.`
                : dragOverPosition
                  ? `Drop to place at the end of ${dragOverPosition}.`
                  : 'Move over a lane or judge route to choose where it lands.'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
