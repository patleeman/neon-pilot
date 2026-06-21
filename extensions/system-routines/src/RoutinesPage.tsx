import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { Button, cx, ErrorState, LoadingState } from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

export function RoutinesPage({ pa }: ExtensionSurfaceProps) {
  const [data, setData] = useState<StateResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState('checkpoint');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Routine | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = (await pa.extension.invoke('getState', {})) as StateResult;
      setData(result);
      setSelectedHookId((current) => (result.hooks.some((hook) => hook.id === current) ? current : (result.hooks[0]?.id ?? 'checkpoint')));
      if (!selectedRoutineId) {
        const firstRoutine = result.routines.find((routine) => routine.hookId === selectedHookId) ?? result.routines[0];
        setSelectedRoutineId(firstRoutine?.id ?? null);
        setDraft(firstRoutine ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pa, selectedHookId, selectedRoutineId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const reorder = useCallback(
    async (targetId: string) => {
      if (!dragId || dragId === targetId) return;
      const current = hookRoutines;
      const moving = current.find((routine) => routine.id === dragId);
      const target = current.find((routine) => routine.id === targetId);
      if (!moving || !target || moving.position !== target.position) return;
      const lane = current.filter((routine) => routine.position === moving.position);
      const without = lane.filter((routine) => routine.id !== dragId);
      const targetIndex = without.findIndex((routine) => routine.id === targetId);
      without.splice(targetIndex, 0, moving);
      const result = (await pa.extension.invoke('reorderRoutines', { routineIds: without.map((routine) => routine.id) })) as StateResult;
      setData(result);
      setDragId(null);
    },
    [dragId, hookRoutines, pa],
  );

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
      const nextInstruction = draft.instruction.replace(/\/skill:[A-Za-z0-9._-]*$/, `/skill:${skill.id}`);
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
      draggable
      onDragStart={() => setDragId(routine.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => void reorder(routine.id)}
      onClick={() => selectRoutine(routine)}
      className={cx(
        'overflow-hidden rounded-md border bg-surface-2 text-left',
        selectedRoutineId === routine.id ? 'border-accent/70 bg-accent/10' : 'border-border-subtle',
      )}
    >
      <div className="grid grid-cols-[22px_1fr_auto] gap-2 px-2 py-2">
        <div className="cursor-grab text-dim">⋮⋮</div>
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
    <div className="grid h-full grid-cols-[248px_minmax(560px,1fr)_330px] bg-app text-primary">
      <aside className="min-w-0 border-r border-border-subtle bg-surface-1">
        <div className="flex h-12 items-center border-b border-border-subtle px-4">
          <h1 className="text-[14px] font-semibold">Routines</h1>
        </div>
        <div className="m-2 rounded-md border border-border-subtle bg-surface-0 px-2 py-1.5 text-secondary">Search lifecycle events…</div>
        {groupedHooks(data.hooks).map(([group, hooks]) => (
          <div key={group} className="px-2 py-2">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-dim">{group}</div>
            {hooks.map((hook) => (
              <button
                key={hook.id}
                type="button"
                onClick={() => {
                  setSelectedHookId(hook.id);
                  const next = data.routines.find((routine) => routine.hookId === hook.id) ?? null;
                  setSelectedRoutineId(next?.id ?? null);
                  setDraft(next);
                }}
                className={cx(
                  'grid w-full grid-cols-[8px_1fr] gap-2 rounded-md px-2 py-2 text-left text-secondary',
                  hook.id === selectedHookId && 'bg-surface-3 text-primary',
                )}
              >
                <span className={cx('mt-1.5 h-2 w-2 rounded-full', statusDot(hook.summary))} />
                <span className="min-w-0">
                  <span className="block truncate">{hook.title}</span>
                  <span className="block truncate text-[11px] text-dim">{hook.summary}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="min-w-0">
        <div className="flex h-12 items-center gap-2 border-b border-border-subtle px-4">
          <div>
            <div className="font-semibold">{selectedHook.title}</div>
            <div className="text-[12px] text-secondary">{selectedHook.description}</div>
          </div>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => setShowRuns((value) => !value)}>
            {showRuns ? 'Timeline' : 'Runs'}
          </Button>
          <div className="relative">
            <Button variant="primary" onClick={() => setShowAdd((value) => !value)}>
              Add routine ▾
            </Button>
            {showAdd ? (
              <div className="absolute right-0 top-9 z-10 w-56 overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-xl">
                <button
                  className="block w-full border-b border-border-subtle px-3 py-2 text-left"
                  onClick={() => addRoutine('instruction')}
                >
                  <b>Instruction</b>
                  <span className="block text-[11px] text-secondary">Run a prompt and continue, warn, or block.</span>
                </button>
                <button className="block w-full border-b border-border-subtle px-3 py-2 text-left" onClick={() => addRoutine('decision')}>
                  <b>Decision</b>
                  <span className="block text-[11px] text-secondary">Run a prompt that chooses one outcome.</span>
                </button>
                <button className="block w-full px-3 py-2 text-left" onClick={() => addRoutine('stop')}>
                  <b>Stop</b>
                  <span className="block text-[11px] text-secondary">Block the lifecycle event with a message.</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="overflow-auto p-5">
          {showRuns ? (
            <div className="grid max-w-3xl gap-2">
              {selectedRuns.length === 0 ? <div className="text-secondary">No routine runs yet.</div> : null}
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
            <div className="grid max-w-4xl gap-5">
              <div className="flex gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-md border border-border-subtle text-accent">⎇</div>
                <div>
                  <h2 className="m-0 text-[17px] font-semibold">{selectedHook.title} timeline</h2>
                  <p className="m-0 text-secondary">
                    Drag routines within Before or After. Decision routines choose a named outcome and follow that branch.
                  </p>
                </div>
              </div>
              <section className="grid gap-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-secondary after:h-px after:flex-1 after:bg-border-subtle after:content-['']">
                  Before
                </div>
                {beforeRoutines.map(renderBlock)}
              </section>
              <section className="grid gap-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-secondary after:h-px after:flex-1 after:bg-border-subtle after:content-['']">
                  After
                </div>
                {afterRoutines.map(renderBlock)}
              </section>
            </div>
          )}
        </div>
      </main>

      <aside className="min-w-0 border-l border-border-subtle bg-surface-1">
        {draft ? (
          <>
            <div className="border-b border-border-subtle p-4">
              <h2 className="m-0 text-[14px] font-semibold">{draft.name}</h2>
              <p className="m-0 text-[12px] text-secondary">
                {routineLabel(draft.type)} · {draft.position === 'before' ? 'Before' : 'After'} {selectedHook.title.toLowerCase()}
              </p>
            </div>
            <div className="overflow-auto p-4">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Routine type</label>
              <select
                className="mb-3 w-full rounded-md border border-border-subtle bg-surface-0 p-2"
                value={draft.type}
                onChange={(event) =>
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
              </select>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Position</label>
              <select
                className="mb-3 w-full rounded-md border border-border-subtle bg-surface-0 p-2"
                value={draft.position}
                onChange={(event) => setDraft({ ...draft, position: event.target.value as RoutinePosition })}
              >
                <option value="before">Before</option>
                <option value="after">After</option>
              </select>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Name</label>
              <input
                className="mb-3 w-full rounded-md border border-border-subtle bg-surface-0 p-2"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
              {draft.type === 'instruction' ? (
                <>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Pass / fail behavior</label>
                  <select
                    className="mb-3 w-full rounded-md border border-border-subtle bg-surface-0 p-2"
                    value={draft.failureBehavior}
                    onChange={(event) => setDraft({ ...draft, failureBehavior: event.target.value as Routine['failureBehavior'] })}
                  >
                    <option value="continue">Continue either way</option>
                    <option value="warn">Warn if this routine fails</option>
                    <option value="block">Block if this routine fails</option>
                  </select>
                </>
              ) : null}
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-secondary">Instruction</label>
              <div className="relative">
                <textarea
                  className="min-h-40 w-full resize-y rounded-md border border-border-subtle bg-surface-0 p-2 font-mono text-[12px]"
                  value={draft.instruction}
                  onFocus={(event) => onInstructionChange(event.currentTarget.value)}
                  onKeyUp={(event) => onInstructionChange(event.currentTarget.value)}
                  onInput={(event) => onInstructionChange(event.currentTarget.value)}
                  onChange={(event) => onInstructionChange(event.target.value)}
                />
                {skillMatches.length ? (
                  <div className="absolute left-2 top-20 z-10 w-64 overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-xl">
                    {skillMatches.map((skill) => (
                      <button
                        key={skill.id}
                        className="block w-full border-b border-border-subtle px-2 py-1.5 text-left"
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
                      <div key={index} className="grid grid-cols-[110px_1fr] gap-2 border-b border-border-subtle p-2 last:border-b-0">
                        <input
                          className="bg-transparent font-mono text-[11px]"
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
                          className="bg-transparent text-secondary"
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
  );
}
