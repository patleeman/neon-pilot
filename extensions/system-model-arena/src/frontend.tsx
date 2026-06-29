import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, Button, ErrorState, Select, StatusDot, Switch, TextInput } from '@neon-pilot/extensions/ui';
import React, { type ReactNode, useEffect, useMemo, useState } from 'react';

type ArenaSettings = {
  automaticDuels: boolean;
  sampleRate: number;
  rampDownAfterVotes: number;
  rampedSampleRate: number;
  challengerModels: string[];
  minPromptChars: number;
};

type ModelStat = {
  modelRef: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  neither: number;
  votes: number;
  byTask: Record<string, { wins: number; losses: number; ties: number; neither: number; votes: number }>;
};

type ArenaState = {
  settings: ArenaSettings;
  stats: { models: Record<string, ModelStat> };
  duels: Array<Record<string, unknown>>;
  models: ArenaModel[];
};

type ArenaModel = {
  id: string;
  name: string;
  provider: string;
  input?: string[];
};

type RankedModelRow = {
  modelRef: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  neither: number;
  votes: number;
  summary: string;
};

type DuelBlockData = {
  duelId: string;
  status: 'running' | 'ready' | 'failed' | 'voted';
  taskType: string;
  sideA: { text?: string };
  sideB: { text?: string };
  revealed?: boolean;
  vote?: 'a' | 'b' | 'tie' | 'neither' | null;
  error?: string | null;
  models?: { primary: string; challenger: string; a: string; b: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeModels(models: string[]): string[] {
  const seen = new Set<string>();
  return models
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 50);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function confidenceLabel(votes: number): string {
  if (votes >= 30) return 'Usable';
  if (votes >= 10) return 'Building';
  return 'Low';
}

function taskSummary(model: ModelStat, selectedTask: string): string {
  if (selectedTask !== 'all') {
    const stat = model.byTask[selectedTask];
    return stat ? `${selectedTask} ${stat.wins}W/${stat.losses}L/${stat.ties}T` : '';
  }
  return Object.entries(model.byTask)
    .sort(([, a], [, b]) => b.votes - a.votes)
    .slice(0, 3)
    .map(([task, stat]) => `${task} ${stat.wins}W/${stat.losses}L/${stat.ties}T`)
    .join(' · ');
}

function modelRef(model: ArenaModel): string {
  return `${model.provider}/${model.id}`;
}

function modelLabel(model: ArenaModel): string {
  return `${model.name || model.id} · ${model.provider}`;
}

function firstAvailableModelRef(models: ArenaModel[], challengerModels: string[], current = ''): string {
  const available = models.map(modelRef).filter((ref) => !challengerModels.includes(ref));
  return current && available.includes(current) ? current : (available[0] ?? '');
}

function uniqueTasks(stats: ArenaState['stats'] | undefined): string[] {
  const tasks = new Set<string>();
  for (const model of Object.values(stats?.models ?? {})) {
    for (const task of Object.keys(model.byTask ?? {})) {
      tasks.add(task);
    }
  }
  return [...tasks].sort((a, b) => a.localeCompare(b));
}

export function ModelArenaPage({ pa }: ExtensionSurfaceProps) {
  const [state, setState] = useState<ArenaState | null>(null);
  const [selectedModelRef, setSelectedModelRef] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const next = (await pa.extension.invoke('getArenaState', {})) as ArenaState;
      setState(next);
      setSelectedModelRef((current) => firstAvailableModelRef(next.models, next.settings.challengerModels, current));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const tasks = useMemo(() => uniqueTasks(state?.stats), [state?.stats]);
  const selectableModels = useMemo(
    () => (state?.models ?? []).filter((model) => !state?.settings.challengerModels.includes(modelRef(model))),
    [state?.models, state?.settings.challengerModels],
  );
  const selectedModels = useMemo(() => {
    const byRef = new Map((state?.models ?? []).map((model) => [modelRef(model), model]));
    return (state?.settings.challengerModels ?? []).map((ref) => ({ ref, model: byRef.get(ref) }));
  }, [state?.models, state?.settings.challengerModels]);
  const ranked = useMemo<RankedModelRow[]>(() => {
    return Object.values(state?.stats.models ?? {})
      .map((model) => {
        if (taskFilter === 'all') {
          return { ...model, summary: taskSummary(model, taskFilter) };
        }
        const task = model.byTask[taskFilter];
        return {
          modelRef: model.modelRef,
          rating: model.rating,
          wins: task?.wins ?? 0,
          losses: task?.losses ?? 0,
          ties: task?.ties ?? 0,
          neither: task?.neither ?? 0,
          votes: task?.votes ?? 0,
          summary: taskSummary(model, taskFilter),
        };
      })
      .filter((model) => taskFilter === 'all' || model.votes > 0)
      .sort((a, b) => b.rating - a.rating || b.votes - a.votes);
  }, [state?.stats.models, taskFilter]);

  const save = async (patch: Partial<ArenaSettings> = {}) => {
    if (!state || saving) return;
    setSaving(true);
    try {
      const settings = { ...state.settings, ...patch };
      const result = (await pa.extension.invoke('saveArenaSettings', settings)) as { settings: ArenaSettings };
      setState({ ...state, settings: result.settings });
      setSelectedModelRef((current) => firstAvailableModelRef(state.models, result.settings.challengerModels, current));
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  const addModel = async () => {
    if (!state || !selectedModelRef) return;
    await save({ challengerModels: normalizeModels([...state.settings.challengerModels, selectedModelRef]) });
  };

  const removeModel = async (ref: string) => {
    if (!state) return;
    await save({ challengerModels: state.settings.challengerModels.filter((model) => model !== ref) });
  };

  if (error && !state) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-4">
        <AppPageIntro
          title="Model Arena"
          actions={
            <div className="flex items-center gap-2">
              {state ? (
                <Switch
                  checked={state.settings.automaticDuels}
                  disabled={saving}
                  aria-label={state.settings.automaticDuels ? 'Disable Model Arena' : 'Enable Model Arena'}
                  label={state.settings.automaticDuels ? 'On' : 'Off'}
                  onClick={() => void save({ automaticDuels: !state.settings.automaticDuels })}
                />
              ) : null}
              <Button variant="secondary" disabled={saving} onClick={() => void refresh()}>
                Refresh
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)]">
          <section className="rounded-md border border-border-subtle bg-panel/60">
            <div className="border-b border-border-subtle px-3 py-2 text-[12px] font-medium text-primary">Setup</div>
            {state ? (
              <div className="divide-y divide-border-subtle text-[12px]">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2">
                  <div>
                    <div className="text-primary">Status</div>
                    <div className="text-dim">
                      {state.settings.automaticDuels && state.settings.challengerModels.length > 0
                        ? 'Arena is comparing challenger runs against each conversation’s selected model.'
                        : state.settings.challengerModels.length === 0
                          ? 'Add challenger models to compare against the model selected in each conversation.'
                          : 'Arena is paused.'}
                    </div>
                  </div>
                  <StatusDot tone={state.settings.automaticDuels && state.settings.challengerModels.length > 0 ? 'success' : 'warning'} />
                </div>
                <div className="space-y-2 px-3 py-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <Select
                      aria-label="Challenger model"
                      value={selectedModelRef}
                      onChange={(event) => setSelectedModelRef(event.target.value)}
                      disabled={selectableModels.length === 0 || saving}
                    >
                      {selectableModels.length === 0 ? <option value="">No more models available</option> : null}
                      {selectableModels.map((model) => (
                        <option key={modelRef(model)} value={modelRef(model)}>
                          {modelLabel(model)}
                        </option>
                      ))}
                    </Select>
                    <Button variant="secondary" disabled={!selectedModelRef || saving} onClick={() => void addModel()}>
                      Add
                    </Button>
                  </div>
                  <div className="divide-y divide-border-subtle rounded-md border border-border-subtle">
                    {selectedModels.length === 0 ? (
                      <div className="px-3 py-3 text-dim">
                        No challenger models selected. Challengers run against the active conversation model.
                      </div>
                    ) : (
                      selectedModels.map(({ ref, model }) => (
                        <div key={ref} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-primary">{model ? modelLabel(model) : ref}</div>
                            <div className="truncate font-mono text-[11px] text-dim">{ref}</div>
                          </div>
                          <Button variant="ghost" disabled={saving} onClick={() => void removeModel(ref)}>
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <label className="grid grid-cols-[1fr_5rem] items-center gap-3 px-3 py-2">
                  <span>
                    <span className="block text-primary">Initial sample rate</span>
                    <span className="text-dim">Used until enough votes accumulate.</span>
                  </span>
                  <TextInput
                    className="text-right"
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(state.settings.sampleRate * 100)}
                    onChange={(event) =>
                      setState({ ...state, settings: { ...state.settings, sampleRate: Number(event.target.value) / 100 } })
                    }
                    onBlur={() => void save()}
                  />
                </label>
                <label className="grid grid-cols-[1fr_5rem] items-center gap-3 px-3 py-2">
                  <span>
                    <span className="block text-primary">Later sample rate</span>
                    <span className="text-dim">Applied after the ramp-down threshold.</span>
                  </span>
                  <TextInput
                    className="text-right"
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(state.settings.rampedSampleRate * 100)}
                    onChange={(event) =>
                      setState({ ...state, settings: { ...state.settings, rampedSampleRate: Number(event.target.value) / 100 } })
                    }
                    onBlur={() => void save()}
                  />
                </label>
                <label className="grid grid-cols-[1fr_5rem] items-center gap-3 px-3 py-2">
                  <span>
                    <span className="block text-primary">Ramp down after</span>
                    <span className="text-dim">Votes to collect before using the later sample rate.</span>
                  </span>
                  <TextInput
                    className="text-right"
                    type="number"
                    min={0}
                    max={5000}
                    value={state.settings.rampDownAfterVotes}
                    onChange={(event) =>
                      setState({ ...state, settings: { ...state.settings, rampDownAfterVotes: Number(event.target.value) } })
                    }
                    onBlur={() => void save()}
                  />
                </label>
                <label className="grid grid-cols-[1fr_5rem] items-center gap-3 px-3 py-2">
                  <span>
                    <span className="block text-primary">Minimum prompt length</span>
                    <span className="text-dim">Shorter prompts are skipped.</span>
                  </span>
                  <TextInput
                    className="text-right"
                    type="number"
                    min={0}
                    max={2000}
                    value={state.settings.minPromptChars}
                    onChange={(event) =>
                      setState({ ...state, settings: { ...state.settings, minPromptChars: Number(event.target.value) } })
                    }
                    onBlur={() => void save()}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-border-subtle bg-panel/60">
            <div className="grid grid-cols-[1fr_12rem] items-center gap-3 border-b border-border-subtle px-3 py-2">
              <div className="text-[12px] font-medium text-primary">Preferences</div>
              <Select aria-label="Task type" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
                <option value="all">All task types</option>
                {tasks.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_5rem_6rem] border-b border-border-subtle px-3 py-2 text-[11px] font-medium uppercase text-dim">
              <span>Model</span>
              <span className="text-right">Rating</span>
              <span className="text-right">Votes</span>
              <span className="text-right">Wins</span>
              <span className="text-right">Losses</span>
              <span className="text-right">Confidence</span>
            </div>
            <div className="divide-y divide-border-subtle text-[12px]">
              {ranked.length === 0 ? (
                <div className="px-3 py-8 text-center text-dim">No votes recorded yet.</div>
              ) : (
                ranked.map((model) => (
                  <div key={model.modelRef} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_5rem_6rem] items-center px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-primary">{model.modelRef}</span>
                      {model.summary ? <span className="block truncate text-[11px] text-dim">{model.summary}</span> : null}
                    </span>
                    <span className="text-right tabular-nums">{model.rating}</span>
                    <span className="text-right tabular-nums">{model.votes}</span>
                    <span className="text-right tabular-nums">{model.wins}</span>
                    <span className="text-right tabular-nums">{model.losses}</span>
                    <span className="text-right text-[11px] text-dim">{confidenceLabel(model.votes)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {state ? (
          <div className="text-[11px] text-dim">
            {state.duels.length} recent duels · {ranked.reduce((sum, model) => sum + model.votes, 0) / 2} votes · sample{' '}
            {percent(state.settings.sampleRate)}
          </div>
        ) : null}
        {error ? <ErrorState message={error} /> : null}
      </AppPageLayout>
    </div>
  );
}

export function ModelArenaDuelBlock({
  pa,
  block,
  context,
}: {
  pa: { extension: { invoke(actionId: string, input?: unknown): Promise<unknown> } };
  block: { details?: unknown };
  renderer?: unknown;
  context?: { renderMarkdown?: (markdown: string) => ReactNode };
}) {
  const data = isRecord(block.details) ? (block.details as DuelBlockData) : null;
  const [local, setLocal] = useState<DuelBlockData | null>(data);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => setLocal(data), [block.details]);

  if (!local) return null;
  const ready = local.status === 'ready' || local.status === 'voted';
  const visibleError = local.error || error;
  const failed = local.status === 'failed' || Boolean(error);
  const missingAnswerText = failed ? visibleError || 'Run ended without an answer.' : 'No answer captured.';
  const sideA = local.sideA?.text?.trim() || (ready || failed ? missingAnswerText : 'Waiting for answer...');
  const sideB = local.sideB?.text?.trim() || (ready || failed ? missingAnswerText : 'Waiting for answer...');

  const vote = async (choice: 'a' | 'b' | 'tie' | 'neither') => {
    if (voting || !ready) return;
    setVoting(choice);
    try {
      const result = (await pa.extension.invoke('voteDuel', { duelId: local.duelId, choice })) as { duel?: DuelBlockData };
      setLocal(result.duel ?? { ...local, status: 'voted', vote: choice, revealed: true });
      setError('');
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : String(voteError));
    } finally {
      setVoting(null);
    }
  };

  useEffect(() => {
    if (!local || local.status !== 'running') return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = (await pa.extension.invoke('refreshDuel', { duelId: local.duelId })) as { duel?: DuelBlockData };
        if (!cancelled && result.duel) {
          setLocal(result.duel);
          setError('');
        }
      } catch (refreshError) {
        if (!cancelled) setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [local?.duelId, local?.status, pa.extension]);

  return (
    <section
      className="w-full min-w-full rounded-md border border-border-subtle bg-panel/80 text-[12px]"
      data-model-arena-duel={local.duelId}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot tone={ready ? 'success' : local.status === 'failed' ? 'danger' : 'warning'} />
          <span className="font-medium text-primary">Blind model duel</span>
          <span className="text-dim">{local.taskType}</span>
        </div>
        {local.revealed && local.models ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-dim">
            A: {local.models.a} · B: {local.models.b}
          </span>
        ) : null}
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DuelAnswer
          label="A"
          text={sideA}
          waiting={!local.sideA?.text?.trim() && !ready && !failed}
          failed={!local.sideA?.text?.trim() && failed}
          renderMarkdown={context?.renderMarkdown}
          action={
            <Button
              variant="secondary"
              disabled={!ready || Boolean(local.vote)}
              onClick={() => void vote('a')}
              className="w-full justify-center"
            >
              Prefer A
            </Button>
          }
        />
        <DuelAnswer
          label="B"
          text={sideB}
          waiting={!local.sideB?.text?.trim() && !ready && !failed}
          failed={!local.sideB?.text?.trim() && failed}
          renderMarkdown={context?.renderMarkdown}
          action={
            <Button
              variant="secondary"
              disabled={!ready || Boolean(local.vote)}
              onClick={() => void vote('b')}
              className="w-full justify-center"
            >
              Prefer B
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border-subtle px-3 py-2">
        <Button variant="ghost" disabled={!ready || Boolean(local.vote)} onClick={() => void vote('tie')}>
          Tie
        </Button>
        <Button variant="ghost" disabled={!ready || Boolean(local.vote)} onClick={() => void vote('neither')}>
          Neither
        </Button>
        {local.vote ? <span className="text-dim">Vote recorded: {local.vote}</span> : null}
        {voting ? <span className="text-dim">Saving...</span> : null}
        {failed && local.error ? <span className="text-danger">{local.error}</span> : null}
        {error ? <span className="text-danger">{error}</span> : null}
      </div>
    </section>
  );
}

function DuelAnswer({
  label,
  text,
  waiting,
  failed,
  action,
  renderMarkdown,
}: {
  label: string;
  text: string;
  waiting: boolean;
  failed: boolean;
  action: ReactNode;
  renderMarkdown?: (markdown: string) => ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col border-b border-border-subtle md:border-b-0 md:border-r md:last:border-r-0">
      <div className="border-b border-border-subtle px-3 py-2 text-[11px] font-medium uppercase text-dim">{label}</div>
      <div className="min-h-[18rem] min-w-0 flex-1 overflow-auto px-3 py-3 text-[13px] leading-relaxed text-primary">
        {waiting ? (
          <div className="text-dim">Waiting for answer...</div>
        ) : failed ? (
          <div className="whitespace-pre-wrap break-words text-danger">{text}</div>
        ) : renderMarkdown ? (
          renderMarkdown(text)
        ) : (
          <div className="whitespace-pre-wrap break-words">{text}</div>
        )}
      </div>
      <div className="border-t border-border-subtle px-3 py-2">{action}</div>
    </article>
  );
}
