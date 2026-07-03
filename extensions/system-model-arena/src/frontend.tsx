import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  IconButton,
  QuietLoadingState,
  Select,
  StatusDot,
  Switch,
  TextInput,
  WindowedBadge,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedField,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSelect,
  WindowedTextInput,
  WindowedToggle,
} from '@neon-pilot/extensions/ui';
import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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
  authConfigured?: boolean;
};

type ProviderModelGroup = {
  provider: string;
  models: ArenaModel[];
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
  conversationId?: string;
  sourceBlockId?: string | null;
  status: 'running' | 'ready' | 'failed' | 'voted' | 'cancelled';
  taskType: string;
  sideA: { role?: 'primary' | 'challenger'; text?: string };
  sideB: { role?: 'primary' | 'challenger'; text?: string };
  revealed?: boolean;
  vote?: 'a' | 'b' | 'tie' | 'neither' | null;
  error?: string | null;
  models?: { primary: string; challenger: string; a: string; b: string } | null;
};

function sideText(side?: { text?: string } | null): string {
  return side?.text?.trim() ?? '';
}

function hasBothAnswers(duel: Pick<DuelBlockData, 'sideA' | 'sideB'>): boolean {
  return Boolean(sideText(duel.sideA) && sideText(duel.sideB));
}

function requestConversationRefresh(conversationId: string | undefined) {
  const normalizedConversationId = conversationId?.trim();
  if (!normalizedConversationId || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('neon-pilot:desktop-conversation-state-refresh', {
      detail: { conversationId: normalizedConversationId },
    }),
  );
}

function mergeDuelSide(current: DuelBlockData['sideA'] | undefined, incoming: DuelBlockData['sideA'] | undefined): DuelBlockData['sideA'] {
  const currentText = sideText(current);
  const incomingText = sideText(incoming);
  return {
    ...current,
    ...incoming,
    text: incomingText ? incoming?.text : currentText ? current?.text : incoming?.text,
  };
}

function mergeDuelBlockData(current: DuelBlockData | null, incoming: DuelBlockData | null): DuelBlockData | null {
  if (!incoming) return current;
  if (!current || current.duelId !== incoming.duelId) return incoming;
  if ((current.status === 'cancelled' || current.status === 'voted') && incoming.status !== current.status) return current;

  const merged: DuelBlockData = {
    ...current,
    ...incoming,
    sourceBlockId: incoming.sourceBlockId ?? current.sourceBlockId,
    sideA: mergeDuelSide(current.sideA, incoming.sideA),
    sideB: mergeDuelSide(current.sideB, incoming.sideB),
    revealed: incoming.revealed || current.revealed,
    vote: incoming.vote ?? current.vote,
    error: incoming.error ?? current.error,
    models: incoming.models ?? current.models,
  };

  if (merged.status === 'running' && hasBothAnswers(merged)) {
    merged.status = 'ready';
  }
  if (current.status === 'failed' && incoming.status === 'running' && !hasBothAnswers(incoming)) {
    merged.status = 'failed';
  }
  return merged;
}

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

function providerLabel(provider: string): string {
  return provider.trim() || 'Unknown provider';
}

function modelOptionLabel(model: ArenaModel): string {
  return model.name || model.id;
}

function modelLabel(model: ArenaModel): string {
  return `${modelOptionLabel(model)} · ${providerLabel(model.provider)}`;
}

function groupModelsByProvider(models: ArenaModel[]): ProviderModelGroup[] {
  const groups = new Map<string, ArenaModel[]>();
  for (const model of models) {
    const provider = providerLabel(model.provider);
    groups.set(provider, [...(groups.get(provider) ?? []), model]);
  }

  return [...groups.entries()]
    .map(([provider, groupModels]) => ({
      provider,
      models: [...groupModels].sort((a, b) => modelOptionLabel(a).localeCompare(modelOptionLabel(b))),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
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

function publishModelArenaState(state: ArenaState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ArenaState>('neon-pilot-model-arena-state', { detail: state }));
}

export function ModelArenaPage({ pa, context }: ExtensionSurfaceProps) {
  const [state, setState] = useState<ArenaState | null>(null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const next = (await pa.extension.invoke('getArenaState', {})) as ArenaState;
      setState(next);
      publishModelArenaState(next);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onState = (event: Event) => setState((event as CustomEvent<ArenaState>).detail);
    window.addEventListener('neon-pilot-model-arena-state', onState);
    return () => window.removeEventListener('neon-pilot-model-arena-state', onState);
  }, []);

  const tasks = useMemo(() => uniqueTasks(state?.stats), [state?.stats]);
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

  if (context?.shellPresentation === 'windowed') {
    return (
      <ModelArenaWindowedPage
        pa={pa}
        state={state}
        taskFilter={taskFilter}
        tasks={tasks}
        ranked={ranked}
        error={error}
        onTaskFilterChange={setTaskFilter}
        onStateChange={(next) => {
          setState(next);
          publishModelArenaState(next);
        }}
        onErrorChange={setError}
        onRefresh={refresh}
      />
    );
  }

  if (error && !state) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout contentClassName="space-y-4">
          <AppPageIntro title="Model Arena" />
          <ErrorState message={error} />
        </AppPageLayout>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-4">
        <AppPageIntro
          title="Model Arena"
          actions={
            <IconButton compact aria-label="Refresh Model Arena" title="Refresh Model Arena" onClick={() => void refresh()}>
              <span aria-hidden="true">↻</span>
            </IconButton>
          }
        />

        <section className="space-y-3">
          <DataTableToolbar
            summary={
              state
                ? `${state.duels.length} recent duels · ${ranked.reduce((sum, model) => sum + model.votes, 0) / 2} votes · sample ${percent(
                    state.settings.sampleRate,
                  )}`
                : 'Loading arena rankings'
            }
            filters={
              <Select aria-label="Task type" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
                <option value="all">All task types</option>
                {tasks.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </Select>
            }
          />
          <DataTable
            aria-label="Model Arena rankings"
            columns={
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
            }
          >
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Model</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Rating</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Votes</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Wins</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Losses</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Confidence</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {!state ? (
                <DataTableEmptyRow colSpan={6} cellClassName="py-8">
                  <QuietLoadingState label="Loading Model Arena rankings" />
                </DataTableEmptyRow>
              ) : ranked.length === 0 ? (
                <DataTableEmptyRow colSpan={6} cellClassName="py-10 text-left">
                  <EmptyState
                    title="Compare models during real conversations"
                    body="Model Arena samples normal prompts, runs challenger models in parallel, and records blind votes after you choose the better answer."
                    steps={[
                      'Add at least one challenger model in Model Arena settings.',
                      'Keep automatic duels on so eligible prompts can create comparisons.',
                      'Vote on the inline duel to build local preference stats.',
                    ]}
                    align="start"
                    className="max-w-[34rem]"
                  />
                </DataTableEmptyRow>
              ) : (
                ranked.map((model) => (
                  <DataTableRow key={model.modelRef}>
                    <DataTableCell className="min-w-0 py-2 pr-4">
                      <div className="truncate font-mono text-[12px] text-primary">{model.modelRef}</div>
                      {model.summary ? <div className="truncate text-[11px] text-dim">{model.summary}</div> : null}
                    </DataTableCell>
                    <DataTableCell className="py-2 text-right tabular-nums">{model.rating}</DataTableCell>
                    <DataTableCell className="py-2 text-right tabular-nums">{model.votes}</DataTableCell>
                    <DataTableCell className="py-2 text-right tabular-nums">{model.wins}</DataTableCell>
                    <DataTableCell className="py-2 text-right tabular-nums">{model.losses}</DataTableCell>
                    <DataTableCell className="py-2 text-right text-[11px] text-dim">{confidenceLabel(model.votes)}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </section>

        {error ? <ErrorState message={error} /> : null}
      </AppPageLayout>
    </div>
  );
}

function ModelArenaWindowedPage({
  pa,
  state,
  taskFilter,
  tasks,
  ranked,
  error,
  onTaskFilterChange,
  onStateChange,
  onErrorChange,
  onRefresh,
}: {
  pa: ExtensionSurfaceProps['pa'];
  state: ArenaState | null;
  taskFilter: string;
  tasks: string[];
  ranked: RankedModelRow[];
  error: string;
  onTaskFilterChange: (task: string) => void;
  onStateChange: (state: ArenaState) => void;
  onErrorChange: (error: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [selectedModelRef, setSelectedModelRef] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) return;
    setSelectedModelRef((current) => firstAvailableModelRef(state.models, state.settings.challengerModels, current));
  }, [state]);

  const selectableModels = useMemo(
    () => (state?.models ?? []).filter((model) => !state?.settings.challengerModels.includes(modelRef(model))),
    [state?.models, state?.settings.challengerModels],
  );
  const selectableModelGroups = useMemo(() => groupModelsByProvider(selectableModels), [selectableModels]);
  const selectedModels = useMemo(() => {
    const byRef = new Map((state?.models ?? []).map((model) => [modelRef(model), model]));
    return (state?.settings.challengerModels ?? []).map((ref) => ({ ref, model: byRef.get(ref) }));
  }, [state?.models, state?.settings.challengerModels]);

  const save = async (patch: Partial<ArenaSettings> = {}) => {
    if (!state || saving) return;
    setSaving(true);
    try {
      const settings = { ...state.settings, ...patch };
      const result = (await pa.extension.invoke('saveArenaSettings', settings)) as { settings: ArenaSettings };
      const next = { ...state, settings: result.settings };
      onStateChange(next);
      setSelectedModelRef((current) => firstAvailableModelRef(state.models, result.settings.challengerModels, current));
      onErrorChange('');
    } catch (saveError) {
      onErrorChange(saveError instanceof Error ? saveError.message : String(saveError));
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

  const topModel = ranked[0] ?? null;
  const activeTaskLabel = taskFilter === 'all' ? 'All tasks' : taskFilter;
  const totalVotes = ranked.reduce((sum, model) => sum + model.votes, 0) / 2;
  const arenaReady = Boolean(state?.settings.automaticDuels && state.settings.challengerModels.length > 0);

  return (
    <div className="h-full overflow-hidden">
      <WindowedPageShell layout="standard" className="model-arena-page-windowed">
        <WindowedPageMain
          title="Model Arena"
          actions={
            <>
              <WindowedSelect
                aria-label="Task type"
                value={taskFilter}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onTaskFilterChange(event.target.value)}
              >
                <option value="all">All task types</option>
                {tasks.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </WindowedSelect>
              <WindowedBadge tone={arenaReady ? 'positive' : 'warning'}>{arenaReady ? 'Running' : 'Needs setup'}</WindowedBadge>
              <WindowedPageButton disabled={saving} onClick={() => void onRefresh()}>
                Refresh
              </WindowedPageButton>
            </>
          }
        >
          {error ? (
            <WindowedPageSection title="Action needed">
              <WindowedEmptyState tone="danger">{error}</WindowedEmptyState>
            </WindowedPageSection>
          ) : null}

          <WindowedPageSection title="Overview" meta={activeTaskLabel}>
            <WindowedKeyValueGrid
              columns={4}
              items={[
                { label: 'Recent duels', value: state ? String(state.duels.length) : '...' },
                { label: 'Votes', value: state ? String(totalVotes) : '...' },
                { label: 'Sample rate', value: state ? percent(state.settings.sampleRate) : '...' },
                { label: 'Challengers', value: state ? String(state.settings.challengerModels.length) : '...' },
              ]}
            />
          </WindowedPageSection>

          {state ? (
            <>
              <WindowedPageSection title="Status" meta={state.settings.automaticDuels ? 'Automatic duels on' : 'Automatic duels off'}>
                <div className="wos-arena-status-row">
                  <span>
                    {arenaReady
                      ? 'Comparing challenger runs against conversation models.'
                      : state.settings.challengerModels.length === 0
                        ? 'Add a challenger before automatic duels can run.'
                        : 'Arena sampling is paused.'}
                  </span>
                  <WindowedToggle
                    checked={state.settings.automaticDuels}
                    disabled={saving}
                    accent="gateways"
                    label={state.settings.automaticDuels ? 'Disable Model Arena' : 'Enable Model Arena'}
                    onChange={(checked) => void save({ automaticDuels: checked })}
                  />
                </div>
              </WindowedPageSection>

              <WindowedPageSection title="Challengers" meta={`${selectedModels.length} selected`}>
                <div className="wos-arena-add-row">
                  <WindowedField label="Model" span="full">
                    <WindowedSelect
                      aria-label="Challenger model"
                      value={selectedModelRef}
                      disabled={selectableModels.length === 0 || saving}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedModelRef(event.target.value)}
                    >
                      {selectableModels.length === 0 ? (
                        <option value="">{state.models.length === 0 ? 'No runnable models available' : 'No more models available'}</option>
                      ) : null}
                      {selectableModelGroups.map((group) => (
                        <optgroup key={group.provider} label={group.provider}>
                          {group.models.map((model) => (
                            <option key={modelRef(model)} value={modelRef(model)}>
                              {modelOptionLabel(model)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </WindowedSelect>
                  </WindowedField>
                  <WindowedPageButton tone="accent" disabled={!selectedModelRef || saving} onClick={() => void addModel()}>
                    Add
                  </WindowedPageButton>
                </div>
                {selectedModels.length === 0 ? (
                  <WindowedEmptyState>No challenger models selected.</WindowedEmptyState>
                ) : (
                  <div className="wos-arena-challenger-list">
                    {selectedModels.map(({ ref, model }) => (
                      <div key={ref} className="wos-arena-challenger">
                        <div>
                          <strong>{model ? modelLabel(model) : ref}</strong>
                          <span>{ref}</span>
                        </div>
                        <WindowedPageButton disabled={saving} onClick={() => void removeModel(ref)}>
                          Remove
                        </WindowedPageButton>
                      </div>
                    ))}
                  </div>
                )}
              </WindowedPageSection>

              <WindowedPageSection title="Sampling">
                <div className="wos-arena-settings-grid">
                  <WindowedField label="Initial rate">
                    <WindowedTextInput
                      aria-label="Initial rate"
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(state.settings.sampleRate * 100)}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        onStateChange({ ...state, settings: { ...state.settings, sampleRate: Number(event.target.value) / 100 } })
                      }
                      onBlur={() => void save()}
                    />
                  </WindowedField>
                  <WindowedField label="Later rate">
                    <WindowedTextInput
                      aria-label="Later rate"
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(state.settings.rampedSampleRate * 100)}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        onStateChange({ ...state, settings: { ...state.settings, rampedSampleRate: Number(event.target.value) / 100 } })
                      }
                      onBlur={() => void save()}
                    />
                  </WindowedField>
                  <WindowedField label="Ramp after">
                    <WindowedTextInput
                      aria-label="Ramp after"
                      type="number"
                      min={0}
                      max={5000}
                      value={state.settings.rampDownAfterVotes}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        onStateChange({ ...state, settings: { ...state.settings, rampDownAfterVotes: Number(event.target.value) } })
                      }
                      onBlur={() => void save()}
                    />
                  </WindowedField>
                  <WindowedField label="Minimum prompt">
                    <WindowedTextInput
                      aria-label="Minimum prompt"
                      type="number"
                      min={0}
                      max={2000}
                      value={state.settings.minPromptChars}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        onStateChange({ ...state, settings: { ...state.settings, minPromptChars: Number(event.target.value) } })
                      }
                      onBlur={() => void save()}
                    />
                  </WindowedField>
                </div>
              </WindowedPageSection>

              <WindowedPageSection title="Leader">
                <WindowedKeyValueList
                  items={
                    topModel
                      ? [
                          { label: 'Model', value: topModel.modelRef },
                          { label: 'Rating', value: topModel.rating },
                          { label: 'Record', value: `${topModel.wins}W/${topModel.losses}L/${topModel.ties}T` },
                          { label: 'Confidence', value: confidenceLabel(topModel.votes) },
                        ]
                      : [{ label: 'Model', value: 'No votes yet' }]
                  }
                />
              </WindowedPageSection>
            </>
          ) : (
            <WindowedPageSection title="Loading">
              <WindowedEmptyState>Reading arena setup.</WindowedEmptyState>
            </WindowedPageSection>
          )}

          <WindowedPageSection title="Rankings" meta={state ? `${ranked.length} models` : 'Loading'}>
            {!state ? <WindowedEmptyState>Loading Model Arena rankings.</WindowedEmptyState> : null}
            {state && ranked.length === 0 ? (
              <WindowedEmptyState>Add challenger models and vote on duels to build rankings.</WindowedEmptyState>
            ) : null}
            {ranked.length > 0 ? (
              <WindowedDataTable
                className="wos-arena-ranking-table"
                columns={[
                  { label: 'Model' },
                  { label: 'Rating', align: 'right' },
                  { label: 'Votes', align: 'right' },
                  { label: 'Confidence', align: 'right' },
                ]}
              >
                {ranked.map((model) => (
                  <div key={model.modelRef} className="wos-arena-ranking-row">
                    <div className="wos-arena-ranking-row__model">
                      <span>{model.modelRef}</span>
                      {model.summary ? <small>{model.summary}</small> : null}
                    </div>
                    <span className="wos-arena-ranking-row__metric">{model.rating}</span>
                    <span className="wos-arena-ranking-row__metric">{model.votes}</span>
                    <span className="wos-arena-ranking-row__confidence">{confidenceLabel(model.votes)}</span>
                  </div>
                ))}
              </WindowedDataTable>
            ) : null}
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowedPageShell>
    </div>
  );
}

export function ModelArenaContextRail({ pa }: ExtensionSurfaceProps) {
  const [state, setState] = useState<ArenaState | null>(null);
  const [selectedModelRef, setSelectedModelRef] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const next = (await pa.extension.invoke('getArenaState', {})) as ArenaState;
      setState(next);
      setSelectedModelRef((current) => firstAvailableModelRef(next.models, next.settings.challengerModels, current));
      publishModelArenaState(next);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onState = (event: Event) => {
      const next = (event as CustomEvent<ArenaState>).detail;
      setState(next);
      setSelectedModelRef((current) => firstAvailableModelRef(next.models, next.settings.challengerModels, current));
    };
    window.addEventListener('neon-pilot-model-arena-state', onState);
    return () => window.removeEventListener('neon-pilot-model-arena-state', onState);
  }, []);

  const selectableModels = useMemo(
    () => (state?.models ?? []).filter((model) => !state?.settings.challengerModels.includes(modelRef(model))),
    [state?.models, state?.settings.challengerModels],
  );
  const selectableModelGroups = useMemo(() => groupModelsByProvider(selectableModels), [selectableModels]);
  const selectedModels = useMemo(() => {
    const byRef = new Map((state?.models ?? []).map((model) => [modelRef(model), model]));
    return (state?.settings.challengerModels ?? []).map((ref) => ({ ref, model: byRef.get(ref) }));
  }, [state?.models, state?.settings.challengerModels]);

  const save = async (patch: Partial<ArenaSettings> = {}) => {
    if (!state || saving) return;
    setSaving(true);
    try {
      const settings = { ...state.settings, ...patch };
      const result = (await pa.extension.invoke('saveArenaSettings', settings)) as { settings: ArenaSettings };
      const next = { ...state, settings: result.settings };
      setState(next);
      setSelectedModelRef((current) => firstAvailableModelRef(state.models, result.settings.challengerModels, current));
      publishModelArenaState(next);
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

  if (error && !state)
    return (
      <div className="p-4">
        <ErrorState message={error} />
      </div>
    );

  return (
    <ContextRail>
      <ContextRailHeader
        eyebrow="Arena setup"
        title="Model Arena"
        subtitle={state?.settings.automaticDuels ? 'Automatic duels on' : 'Automatic duels off'}
        actions={
          state ? (
            <Switch
              checked={state.settings.automaticDuels}
              disabled={saving}
              aria-label={state.settings.automaticDuels ? 'Disable Model Arena' : 'Enable Model Arena'}
              label={state.settings.automaticDuels ? 'On' : 'Off'}
              onClick={() => void save({ automaticDuels: !state.settings.automaticDuels })}
            />
          ) : null
        }
      />
      <ContextRailBody>
        {state ? (
          <>
            <ContextRailSection title="Status">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-[12px] leading-5 text-secondary">
                <div className="min-w-0">
                  {state.settings.automaticDuels && state.settings.challengerModels.length > 0
                    ? 'Comparing challenger runs against each conversation model.'
                    : state.settings.challengerModels.length === 0
                      ? 'Add challenger models before automatic duels can run.'
                      : 'Arena is paused.'}
                </div>
                <StatusDot tone={state.settings.automaticDuels && state.settings.challengerModels.length > 0 ? 'success' : 'warning'} />
              </div>
            </ContextRailSection>

            <ContextRailSection title="Challengers">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Select
                  aria-label="Challenger model"
                  value={selectedModelRef}
                  onChange={(event) => setSelectedModelRef(event.target.value)}
                  disabled={selectableModels.length === 0 || saving}
                >
                  {selectableModels.length === 0 ? (
                    <option value="">{state.models.length === 0 ? 'No runnable models available' : 'No more models available'}</option>
                  ) : null}
                  {selectableModelGroups.map((group) => (
                    <optgroup key={group.provider} label={group.provider}>
                      {group.models.map((model) => (
                        <option key={modelRef(model)} value={modelRef(model)}>
                          {modelOptionLabel(model)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <IconButton
                  aria-label="Add challenger model"
                  title="Add challenger model"
                  disabled={!selectedModelRef || saving}
                  onClick={() => void addModel()}
                >
                  <span aria-hidden="true">+</span>
                </IconButton>
              </div>
              {selectedModels.length === 0 ? (
                <EmptyState
                  title={state.models.length === 0 ? 'No runnable models' : 'No challengers selected'}
                  body={
                    state.models.length === 0
                      ? 'Add a model provider in Settings, then refresh this rail.'
                      : 'Choose a challenger model so the arena can compare conversation answers.'
                  }
                  steps={
                    state.models.length === 0
                      ? ['Open Settings.', 'Add or verify a provider key.', 'Refresh Model Arena.']
                      : ['Choose a model.', 'Add it as a challenger.']
                  }
                  align="start"
                />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {selectedModels.map(({ ref, model }) => (
                    <div key={ref} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-primary">{model ? modelLabel(model) : ref}</div>
                        <div className="truncate font-mono text-[11px] text-dim">{ref}</div>
                      </div>
                      <Button variant="ghost" tone="danger" disabled={saving} onClick={() => void removeModel(ref)}>
                        <span aria-hidden="true">-</span>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ContextRailSection>

            <ContextRailSection title="Sampling">
              <label className="grid grid-cols-[1fr_5rem] items-center gap-3">
                <span className="text-[12px] text-primary">Initial rate</span>
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
              <label className="grid grid-cols-[1fr_5rem] items-center gap-3">
                <span className="text-[12px] text-primary">Later rate</span>
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
              <label className="grid grid-cols-[1fr_5rem] items-center gap-3">
                <span className="text-[12px] text-primary">Ramp after</span>
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
              <label className="grid grid-cols-[1fr_5rem] items-center gap-3">
                <span className="text-[12px] text-primary">Minimum prompt</span>
                <TextInput
                  className="text-right"
                  type="number"
                  min={0}
                  max={2000}
                  value={state.settings.minPromptChars}
                  onChange={(event) => setState({ ...state, settings: { ...state.settings, minPromptChars: Number(event.target.value) } })}
                  onBlur={() => void save()}
                />
              </label>
            </ContextRailSection>
          </>
        ) : null}
        {error ? (
          <div className="mt-4">
            <ErrorState message={error} />
          </div>
        ) : null}
      </ContextRailBody>
    </ContextRail>
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
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocal((current) => {
      return mergeDuelBlockData(current, data);
    });
  }, [data]);

  if (!local) return null;
  const canonicalStatus = data?.duelId === local.duelId ? data.status : local.status;
  const collapsed =
    (local.status === 'voted' || local.status === 'cancelled') && (canonicalStatus === 'voted' || canonicalStatus === 'cancelled');
  const complete = hasBothAnswers(local);
  const ready = complete && (local.status === 'ready' || local.status === 'voted' || local.status === 'running');
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
      if (!result.duel || result.duel.status !== 'voted') {
        throw new Error('Vote was not recorded. The duel is still open.');
      }
      setLocal(result.duel);
      requestConversationRefresh(result.duel.conversationId || local.conversationId);
      setError('');
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : String(voteError));
    } finally {
      setVoting(null);
    }
  };

  const cancel = async () => {
    if (cancelling || local.status === 'voted' || local.status === 'cancelled') return;
    setCancelling(true);
    try {
      const result = (await pa.extension.invoke('cancelDuel', { duelId: local.duelId })) as { duel?: DuelBlockData };
      if (!result.duel || result.duel.status !== 'cancelled') {
        throw new Error('Duel was not closed.');
      }
      setLocal(result.duel);
      requestConversationRefresh(result.duel.conversationId || local.conversationId);
      setError('');
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!local || local.status !== 'running' || hasBothAnswers(local)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = (await pa.extension.invoke('refreshDuel', { duelId: local.duelId })) as { duel?: DuelBlockData };
        if (!cancelled && result.duel) {
          setLocal((current) => mergeDuelBlockData(current, result.duel ?? null));
          requestConversationRefresh(result.duel.conversationId || local.conversationId);
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

  if (collapsed) {
    return null;
  }

  return (
    <section className="w-full min-w-full py-2 text-[12px]" data-model-arena-duel={local.duelId}>
      <div className="mb-4 text-center">
        <div className="font-medium text-primary">Model Arena duel</div>
        <div className="mt-1 min-h-4 text-[11px] text-dim">
          {local.vote ? <span>Vote recorded: {local.vote}</span> : null}
          {voting ? <span>Saving...</span> : null}
          {cancelling ? <span>Closing...</span> : null}
          {local.revealed && local.models ? (
            <span className="font-mono">
              {local.vote || voting || cancelling ? ' · ' : ''}
              A: {local.models.a} · B: {local.models.b}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-0">
        <DuelAnswer
          label="A"
          text={sideA}
          waiting={!local.sideA?.text?.trim() && !ready && !failed}
          failed={!local.sideA?.text?.trim() && failed}
          renderMarkdown={context?.renderMarkdown}
          disabled={!ready || Boolean(local.vote)}
          onPrefer={() => void vote('a')}
        />
        <DuelAnswer
          label="B"
          text={sideB}
          waiting={!local.sideB?.text?.trim() && !ready && !failed}
          failed={!local.sideB?.text?.trim() && failed}
          renderMarkdown={context?.renderMarkdown}
          disabled={!ready || Boolean(local.vote)}
          onPrefer={() => void vote('b')}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <ArenaActionButton
          className="min-h-8 min-w-16 px-3 py-1.5"
          disabled={!ready || Boolean(local.vote)}
          onClick={() => void vote('tie')}
        >
          Tie
        </ArenaActionButton>
        <ArenaActionButton
          className="min-h-8 min-w-16 px-3 py-1.5"
          disabled={!ready || Boolean(local.vote)}
          onClick={() => void vote('neither')}
        >
          Neither
        </ArenaActionButton>
        <ArenaActionButton
          className="min-h-8 min-w-16 px-3 py-1.5"
          disabled={cancelling || Boolean(local.vote)}
          onClick={() => void cancel()}
        >
          {cancelling ? 'Closing...' : 'Close'}
        </ArenaActionButton>
      </div>
      <div className="mt-2 min-h-4 text-center">
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
  disabled,
  onPrefer,
  renderMarkdown,
}: {
  label: string;
  text: string;
  waiting: boolean;
  failed: boolean;
  disabled: boolean;
  onPrefer: () => void;
  renderMarkdown?: (markdown: string) => ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col md:border-r md:border-border-subtle md:pr-6 md:last:border-r-0 md:last:pl-6 md:last:pr-0">
      <div className="mb-2 text-[11px] font-medium uppercase text-dim">{label}</div>
      <div className="min-h-[10rem] min-w-0 flex-1 overflow-auto text-left text-[13px] leading-relaxed text-primary">
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
      <ArenaActionButton className="mt-3 min-h-9 w-full justify-center px-3 py-2" disabled={disabled} onClick={onPrefer}>
        Prefer {label}
      </ArenaActionButton>
    </article>
  );
}

function ArenaActionButton({
  children,
  className = '',
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const onClickRef = useRef(onClick);
  const disabledRef = useRef(disabled);
  const lastNativeActivationRef = useRef(0);

  useEffect(() => {
    onClickRef.current = onClick;
    disabledRef.current = disabled;
  }, [disabled, onClick]);

  const activate = () => {
    if (!disabled) onClick?.();
  };

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;

    const activateNative = () => {
      if (disabledRef.current) return;
      lastNativeActivationRef.current = Date.now();
      onClickRef.current?.();
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      activateNative();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activateNative();
    };

    button.addEventListener('pointerup', handlePointerUp);
    button.addEventListener('keydown', handleKeyDown);
    return () => {
      button.removeEventListener('pointerup', handlePointerUp);
      button.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="action"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (Date.now() - lastNativeActivationRef.current < 500) {
          return;
        }
        activate();
      }}
    >
      {children}
    </Button>
  );
}
