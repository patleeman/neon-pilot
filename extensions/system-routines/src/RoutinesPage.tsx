import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { Button, cx, ErrorState, LoadingState, SearchInput, Select, Textarea, TextInput, ToolbarButton } from '@neon-pilot/extensions/ui';
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

const FALLBACK_SKILLS: SkillItem[] = [
  { id: 'autoreview', name: 'Autoreview', description: 'Review code changes before shipping.' },
  { id: 'second-model-review', name: 'Second model review', description: 'Ask another model to review the change.' },
  { id: 'checkpoint', name: 'Checkpoint', description: 'Create a targeted checkpoint.' },
];

const DEFAULT_OUTCOMES: RoutineOutcome[] = [
  { id: 'pass', label: 'Pass', target: 'Continue', behavior: 'continue' },
  { id: 'fail', label: 'Fail', target: 'Block', behavior: 'block' },
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

function nowRoutine(hookId: string, position: RoutinePosition, type: RoutineType): Routine {
  const timestamp = new Date().toISOString();
  return {
    id: `routine-${Date.now().toString(36)}`,
    hookId,
    position,
    type,
    name: type === 'decision' ? 'New decision' : type === 'stop' ? 'Stop event' : 'New instruction',
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
  if (type === 'decision') return 'Decision routine';
  if (type === 'stop') return 'Stop routine';
  return 'Instruction routine';
}

function statusDot(summary: string) {
  if (summary === 'No routines') return 'bg-[#35445b]';
  if (/fail|block|warn/i.test(summary)) return 'bg-warning';
  return 'bg-success';
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
  const visibleHooks = normalizedQuery
    ? hooks.filter((hook) => `${hook.title} ${hook.description} ${hook.group}`.toLowerCase().includes(normalizedQuery))
    : hooks;

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="px-4 pb-2 pt-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-dim">Routines</div>
      </div>
      <div className="px-2 pb-2">
        <SearchInput
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
          placeholder="Search events…"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groupedHooks(visibleHooks).map(([group, groupHooks]) => (
          <div key={group} className="py-2">
            <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-dim">{group}</div>
            {groupHooks.map((hook) => (
              <button
                key={hook.id}
                type="button"
                onClick={() => onSelect(hook.id)}
                className={cx(
                  'grid w-full grid-cols-[8px_1fr] gap-2 rounded-md px-2 py-2 text-left text-[13px] text-secondary hover:bg-surface/60 hover:text-primary',
                  hook.id === selectedHookId && 'bg-surface-2 text-primary',
                )}
              >
                <span className={cx('mt-1.5 h-2 w-2 rounded-full', statusDot(hook.summary))} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{hook.title}</span>
                  <span className="block truncate text-[11px] text-dim">{hook.summary}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
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
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<RoutinePosition | null>(null);
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
      const firstRoutine = result.routines.find((routine) => routine.hookId === nextHookId) ?? null;
      setSelectedHookId(nextHookId);
      setSelectedRoutineId(firstRoutine?.id ?? null);
      setDraft(firstRoutine ? { ...firstRoutine, outcomes: firstRoutine.outcomes.map((outcome) => ({ ...outcome })) } : null);
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

  const selectedHook = data?.hooks.find((hook) => hook.id === selectedHookId) ?? data?.hooks[0];
  const hookRoutines = useMemo(
    () => (data?.routines ?? []).filter((routine) => routine.hookId === selectedHookId).sort((left, right) => left.order - right.order),
    [data, selectedHookId],
  );
  const beforeRoutines = hookRoutines.filter((routine) => routine.position === 'before');
  const afterRoutines = hookRoutines.filter((routine) => routine.position === 'after');
  const selectedRuns = (data?.runs ?? []).filter((run) => run.hookId === selectedHookId).slice(0, 20);

  useEffect(() => {
    if (!data) return;
    const currentRoutine = data.routines.find((routine) => routine.id === selectedRoutineId && routine.hookId === selectedHookId);
    if (currentRoutine) return;
    const next = data.routines.find((routine) => routine.hookId === selectedHookId) ?? null;
    setSelectedRoutineId(next?.id ?? null);
    setDraft(next ? { ...next, outcomes: next.outcomes.map((outcome) => ({ ...outcome })) } : null);
  }, [data, selectedHookId, selectedRoutineId]);

  const selectRoutine = useCallback((routine: Routine) => {
    setSelectedRoutineId(routine.id);
    setDraft({ ...routine, outcomes: routine.outcomes.map((outcome) => ({ ...outcome })) });
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    const result = (await pa.extension.invoke('saveRoutine', draft)) as StateResult;
    setData(result);
    setSelectedRoutineId(draft.id);
    pa.ui.toast('Routine saved', 'info');
  }, [draft, pa]);

  const remove = useCallback(async () => {
    if (!draft) return;
    const confirmed = await pa.ui.confirm({ message: `Delete “${draft.name}”?` });
    if (!confirmed) return;
    const result = (await pa.extension.invoke('deleteRoutine', { routineId: draft.id })) as StateResult;
    setData(result);
    const next = result.routines.find((routine) => routine.hookId === selectedHookId) ?? null;
    setSelectedRoutineId(next?.id ?? null);
    setDraft(next);
  }, [draft, pa, selectedHookId]);

  const addRoutine = useCallback(
    (type: RoutineType) => {
      if (!selectedHook) return;
      const routine = nowRoutine(selectedHook.id, 'before', type);
      setShowAdd(false);
      setSelectedRoutineId(routine.id);
      setDraft(routine);
      setData((current) => (current ? { ...current, routines: [...current.routines, routine] } : current));
    },
    [selectedHook],
  );

  const moveRoutineById = useCallback(
    async (routineId: string, position: RoutinePosition, targetRoutineId = '') => {
      if (!routineId || routineId === targetRoutineId) return;
      const result = (await pa.extension.invoke('moveRoutine', { routineId, position, targetRoutineId })) as StateResult;
      setData(result);
      const selected = result.routines.find((routine) => routine.id === selectedRoutineId);
      if (selected) setDraft({ ...selected, outcomes: selected.outcomes.map((outcome) => ({ ...outcome })) });
      setDragId(null);
      setDragOverPosition(null);
    },
    [pa, selectedRoutineId],
  );

  const moveRoutine = useCallback(
    async (position: RoutinePosition, targetRoutineId = '') => {
      if (!dragId) return;
      await moveRoutineById(dragId, position, targetRoutineId);
    },
    [dragId, moveRoutineById],
  );

  const startPointerDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, routineId: string) => {
      event.preventDefault();
      event.stopPropagation();
      pointerDragIdRef.current = routineId;
      setDragId(routineId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
        const lane = element?.closest<HTMLElement>('[data-routine-lane]')?.dataset.routineLane as RoutinePosition | undefined;
        if (lane === 'before' || lane === 'after') setDragOverPosition(lane);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const routineIdToMove = pointerDragIdRef.current;
        pointerDragIdRef.current = null;
        const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
        const targetRoutine = element?.closest<HTMLElement>('[data-routine-id]');
        const targetLane = element?.closest<HTMLElement>('[data-routine-lane]');
        const position = (targetRoutine?.dataset.routinePosition ?? targetLane?.dataset.routineLane) as RoutinePosition | undefined;
        if (routineIdToMove && (position === 'before' || position === 'after')) {
          void moveRoutineById(routineIdToMove, position, targetRoutine?.dataset.routineId ?? '');
          return;
        }
        setDragId(null);
        setDragOverPosition(null);
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

  const onDragOverLane = useCallback((event: React.DragEvent, position: RoutinePosition) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverPosition(position);
  }, []);

  const onDragEndRoutine = useCallback(() => {
    setDragId(null);
    setDragOverPosition(null);
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

  if (loading) return <LoadingState label="Loading routines…" />;
  if (error) return <ErrorState title="Failed to load routines" message={error} />;
  if (!data || !selectedHook) return <ErrorState title="No routine hooks" message="No lifecycle hooks are available." />;

  const renderBlock = (routine: Routine) => (
    <div
      key={routine.id}
      data-routine-id={routine.id}
      data-routine-position={routine.position}
      draggable
      onDragStart={(event) => onDragStartRoutine(event, routine.id)}
      onDragEnd={onDragEndRoutine}
      onDragOver={(event) => onDragOverLane(event, routine.position)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void moveRoutine(routine.position, routine.id);
      }}
      onClick={() => selectRoutine(routine)}
      className={cx(
        'overflow-hidden rounded-md border bg-surface-2 text-left transition-colors',
        dragId === routine.id && 'opacity-60',
        selectedRoutineId === routine.id ? 'border-accent/70 bg-accent/10' : 'border-border-subtle',
      )}
    >
      <div className="grid grid-cols-[22px_1fr_auto] gap-2 px-2 py-2">
        <button
          type="button"
          aria-label={`Drag ${routine.name}`}
          className="cursor-grab text-dim active:cursor-grabbing"
          onPointerDown={(event) => startPointerDrag(event, routine.id)}
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
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold">{routine.name}</div>
          <div className="truncate text-[12px] text-secondary">{routine.instruction || 'No instruction yet.'}</div>
        </div>
        <button type="button" className="text-secondary">
          …
        </button>
      </div>
      {routine.type === 'decision' && routine.outcomes.length ? (
        <div className="grid gap-1 border-t border-border-subtle px-9 py-2 text-[12px]">
          {routine.outcomes.map((outcome) => (
            <div key={outcome.id} className="grid grid-cols-[128px_1fr] gap-2">
              <span
                className={cx(
                  'font-mono font-semibold',
                  outcome.behavior === 'block'
                    ? 'text-danger'
                    : outcome.behavior === 'warn'
                      ? 'text-warning'
                      : outcome.behavior === 'ask'
                        ? 'text-accent'
                        : 'text-success',
                )}
              >
                {outcome.id}
              </span>
              <span className="text-secondary">{outcome.target}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-app text-[13px] text-primary">
      <div className="flex h-[88px] shrink-0 items-center gap-2 border-b border-border-subtle/70 px-9">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{selectedHook.title}</div>
          <div className="mt-0.5 max-w-xl truncate text-[12px] text-secondary">{selectedHook.description}</div>
        </div>
        <div className="flex-1" />
        <ToolbarButton type="button" onClick={() => setShowRuns((value) => !value)}>
          {showRuns ? 'Timeline' : 'Runs'}
        </ToolbarButton>
        <div className="relative">
          <ToolbarButton type="button" onClick={() => setShowAdd((value) => !value)}>
            Add routine ▾
          </ToolbarButton>
          {showAdd ? (
            <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-xl">
              <button className="block w-full border-b border-border-subtle px-3 py-2 text-left" onClick={() => addRoutine('instruction')}>
                <span className="block text-[13px] font-medium text-primary">Instruction</span>
                <span className="block text-[11px] text-secondary">Run a prompt and continue.</span>
              </button>
              <button className="block w-full border-b border-border-subtle px-3 py-2 text-left" onClick={() => addRoutine('decision')}>
                <span className="block text-[13px] font-medium text-primary">Decision</span>
                <span className="block text-[11px] text-secondary">Choose one named outcome.</span>
              </button>
              <button className="block w-full px-3 py-2 text-left" onClick={() => addRoutine('stop')}>
                <span className="block text-[13px] font-medium text-primary">Stop</span>
                <span className="block text-[11px] text-secondary">Block the lifecycle event.</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(560px,1fr)_352px] overflow-hidden">
        <main className="min-w-0 overflow-hidden">
          <div className="h-full overflow-auto px-9 py-7">
            {showRuns ? (
              <div className="grid min-h-full max-w-3xl gap-2">
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
              <div className="grid max-w-5xl gap-5">
                <div>
                  <h2 className="m-0 text-[18px] font-semibold">{selectedHook.title} timeline</h2>
                  <p className="m-0 mt-1 text-[13px] text-secondary">
                    Drag routines within Before or After. Decision routines choose a named outcome and follow that branch.
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

        <aside className="min-w-0 overflow-hidden border-l border-border-subtle bg-transparent">
          {draft ? (
            <>
              <div className="px-4 pb-3 pt-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-dim">Routine</div>
                <h2 className="m-0 mt-2 text-[16px] font-semibold">{draft.name}</h2>
                <p className="m-0 mt-1 text-[12px] text-secondary">
                  {routineLabel(draft.type)} · {draft.position === 'before' ? 'Before' : 'After'} {selectedHook.title.toLowerCase()}
                </p>
              </div>
              <div className="h-[calc(100%-8.5rem)] overflow-auto px-4 pb-4">
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Routine type</label>
                <Select
                  name="routine-type"
                  className="mb-3 w-full"
                  value={draft.type}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft({
                      ...draft,
                      type: event.target.value as RoutineType,
                      outcomes: event.target.value === 'decision' && draft.outcomes.length === 0 ? DEFAULT_OUTCOMES : draft.outcomes,
                    })
                  }
                >
                  <option value="instruction">Instruction: run and continue</option>
                  <option value="decision">Decision: choose one outcome</option>
                  <option value="stop">Stop: block lifecycle event</option>
                </Select>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Position</label>
                <Select
                  name="routine-position"
                  className="mb-3 w-full"
                  value={draft.position}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft({ ...draft, position: event.target.value as RoutinePosition })
                  }
                >
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </Select>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Name</label>
                <TextInput
                  className="mb-3 w-full"
                  value={draft.name}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: event.target.value })}
                />
                {draft.type === 'instruction' ? (
                  <>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Pass / fail behavior</label>
                    <Select
                      name="routine-failure-behavior"
                      className="mb-3 w-full"
                      value={draft.failureBehavior}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        setDraft({ ...draft, failureBehavior: event.target.value as Routine['failureBehavior'] })
                      }
                    >
                      <option value="continue">Continue either way</option>
                      <option value="warn">Warn if this routine fails</option>
                      <option value="block">Block if this routine fails</option>
                    </Select>
                  </>
                ) : null}
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Instruction</label>
                <div className="relative">
                  <Textarea
                    className="min-h-40 w-full resize-y text-[13px]"
                    value={draft.instruction}
                    onFocus={(event) => onInstructionChange(event.currentTarget.value)}
                    onKeyUp={(event) => onInstructionChange(event.currentTarget.value)}
                    onInput={(event) => onInstructionChange(event.currentTarget.value)}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onInstructionChange(event.target.value)}
                  />
                  {skillMatches.length ? (
                    <div className="mt-1 overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-xl">
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
                <div className="mb-3 mt-1 text-[12px] text-secondary">
                  Type <span className="text-accent">/skill:</span> to reference a skill.
                </div>
                {draft.type === 'decision' ? (
                  <>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Outcomes</label>
                    <div className="mb-3 overflow-hidden rounded-md border border-border-subtle">
                      {draft.outcomes.map((outcome, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[118px_minmax(0,1fr)] gap-2 border-b border-border-subtle p-2 last:border-b-0"
                        >
                          <input
                            className="min-w-0 bg-transparent font-mono text-[11px] text-primary outline-none"
                            value={outcome.id}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                outcomes: draft.outcomes.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, id: event.target.value } : item,
                                ),
                              })
                            }
                          />
                          <input
                            className="min-w-0 bg-transparent text-secondary outline-none"
                            value={outcome.target}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                outcomes: draft.outcomes.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, target: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          outcomes: [
                            ...draft.outcomes,
                            { id: 'new_outcome', label: 'New outcome', target: 'Continue', behavior: 'continue' },
                          ],
                        })
                      }
                    >
                      Add outcome
                    </Button>
                    <div className="mb-3 mt-1 text-[12px] text-secondary">Decision output is constrained to these enum values.</div>
                  </>
                ) : null}
                <label className="mb-1 mt-3 block text-[11px] uppercase tracking-wider text-secondary">Available variables</label>
                {selectedHook.variables.map((variable) => (
                  <div key={variable.name} className="flex justify-between border-b border-border-subtle py-1 text-[12px]">
                    <span>{`{{${variable.name}}}`}</span>
                    <span className="text-secondary">{variable.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-border-subtle p-3">
                <Button variant="ghost" onClick={() => void remove()}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => void save()}>
                  Save
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 text-secondary">Select a routine to edit it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
