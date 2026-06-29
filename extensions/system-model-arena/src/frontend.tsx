import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  ErrorState,
  SegmentedControl,
  StatusDot,
  Textarea,
  TextInput,
} from '@neon-pilot/extensions/ui';
import React, { useEffect, useMemo, useState } from 'react';

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

function parseModels(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,;]+/)
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

function taskSummary(model: ModelStat): string {
  return Object.entries(model.byTask)
    .sort(([, a], [, b]) => b.votes - a.votes)
    .slice(0, 3)
    .map(([task, stat]) => `${task} ${stat.wins}W/${stat.losses}L/${stat.ties}T`)
    .join(' · ');
}

export function ModelArenaPage({ pa }: ExtensionSurfaceProps) {
  const [state, setState] = useState<ArenaState | null>(null);
  const [modelsText, setModelsText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const next = (await pa.extension.invoke('getArenaState', {})) as ArenaState;
      setState(next);
      setModelsText(next.settings.challengerModels.join('\n'));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const ranked = useMemo(() => Object.values(state?.stats.models ?? {}).sort((a, b) => b.rating - a.rating || b.votes - a.votes), [state]);

  const save = async (patch: Partial<ArenaSettings> = {}) => {
    if (!state || saving) return;
    setSaving(true);
    try {
      const settings = { ...state.settings, ...patch, challengerModels: parseModels(modelsText) };
      const result = (await pa.extension.invoke('saveArenaSettings', settings)) as { settings: ArenaSettings };
      setState({ ...state, settings: result.settings });
      setModelsText(result.settings.challengerModels.join('\n'));
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
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
            <Button variant="secondary" disabled={saving} onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)]">
          <section className="rounded-md border border-border-subtle bg-panel/60">
            <div className="border-b border-border-subtle px-3 py-2 text-[12px] font-medium text-primary">Sampling</div>
            {state ? (
              <div className="divide-y divide-border-subtle text-[12px]">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2">
                  <div>
                    <div className="text-primary">Automatic duels</div>
                    <div className="text-dim">Runs challenger models on sampled eligible prompts.</div>
                  </div>
                  <SegmentedControl
                    ariaLabel="Automatic duels"
                    value={state.settings.automaticDuels ? 'on' : 'off'}
                    options={[
                      { label: 'On', value: 'on' },
                      { label: 'Off', value: 'off' },
                    ]}
                    onChange={(value) => void save({ automaticDuels: value === 'on' })}
                  />
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
                <label className="block px-3 py-2">
                  <span className="mb-1 block text-primary">Challenger models</span>
                  <Textarea
                    className="min-h-28 w-full resize-y font-mono text-[12px]"
                    value={modelsText}
                    onChange={(event) => setModelsText(event.target.value)}
                    onBlur={() => void save()}
                    placeholder="provider/model-id or model-id"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-border-subtle bg-panel/60">
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
                      {taskSummary(model) ? <span className="block truncate text-[11px] text-dim">{taskSummary(model)}</span> : null}
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
}: {
  pa: { extension: { invoke(actionId: string, input?: unknown): Promise<unknown> } };
  block: { details?: unknown };
  renderer?: unknown;
  context?: unknown;
}) {
  const data = isRecord(block.details) ? (block.details as DuelBlockData) : null;
  const [local, setLocal] = useState<DuelBlockData | null>(data);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => setLocal(data), [block.details]);

  if (!local) return null;
  const ready = local.status === 'ready' || local.status === 'voted';
  const failed = local.status === 'failed';
  const sideA = local.sideA?.text?.trim() || (ready || failed ? 'No answer captured.' : 'Waiting for answer...');
  const sideB = local.sideB?.text?.trim() || (ready || failed ? 'No answer captured.' : 'Waiting for answer...');

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

  return (
    <section className="w-full rounded-md border border-border-subtle bg-panel/80 text-[12px]" data-model-arena-duel={local.duelId}>
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
      <div className="grid gap-0 md:grid-cols-2">
        <DuelAnswer label="A" text={sideA} />
        <DuelAnswer label="B" text={sideB} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-3 py-2">
        <Button variant="secondary" disabled={!ready || Boolean(local.vote)} onClick={() => void vote('a')}>
          Prefer A
        </Button>
        <Button variant="secondary" disabled={!ready || Boolean(local.vote)} onClick={() => void vote('b')}>
          Prefer B
        </Button>
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

function DuelAnswer({ label, text }: { label: string; text: string }) {
  return (
    <article className="min-w-0 border-b border-border-subtle p-3 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="mb-2 text-[11px] font-medium uppercase text-dim">{label}</div>
      <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-primary">{text}</div>
    </article>
  );
}
