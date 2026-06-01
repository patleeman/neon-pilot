import type { ComposerControlContext } from '@neon-pilot/extensions/composer';
import { cx } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

const SELECT_CLASS =
  'h-8 min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 pr-6 text-[11px] font-medium text-secondary outline-none transition-colors hover:bg-surface/45 hover:text-primary focus-visible:border-border-subtle focus-visible:bg-surface/55 focus-visible:text-primary focus-visible:ring-1 focus-visible:ring-accent/20 disabled:cursor-default disabled:opacity-40';

type Model = ComposerControlContext['models'][number];

function groupModels(models: Model[]): Array<[string, Model[]]> {
  const groups = new Map<string, Model[]>();
  for (const model of models) groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  return [...groups.entries()];
}

function modelIdHasMultipleProviders(models: Model[], modelId: string): boolean {
  return models.filter((model) => model.id === modelId).length > 1;
}

function modelSelectionValue(model: Model, models: Model[]): string {
  return modelIdHasMultipleProviders(models, model.id) ? `${model.provider}/${model.id}` : model.id;
}

function resolveModel(models: Model[], modelRef: string): Model | null {
  const normalized = modelRef.trim();
  if (!normalized) return null;

  const exact = models.find((model) => model.id === normalized);
  if (exact) return exact;

  const slashIndex = normalized.indexOf('/');
  if (slashIndex > 0 && slashIndex < normalized.length - 1) {
    const provider = normalized.slice(0, slashIndex);
    const id = normalized.slice(slashIndex + 1);
    return models.find((model) => model.provider === provider && model.id === id) ?? null;
  }

  return null;
}

type Ds4Status = {
  reachable?: boolean;
  runtime?: { installed?: boolean };
  bootstrap?: { running?: boolean; status?: string };
  server?: { managedRunning?: boolean; error?: string };
};

function useDs4Health(pa: { extensions: { callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown> } }, model: Model | null) {
  const isDs4 = model?.provider === 'ds4';
  const [status, setStatus] = useState<Ds4Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(
    async () => {
      if (!isDs4) return;
      setChecking(true);
      try {
        const next = (await pa.extensions.callAction('system-ds4', 'ds4Status', {})) as Ds4Status;
        setStatus(next);
        setError('');
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      } finally {
        setChecking(false);
      }
    },
    [isDs4, pa],
  );

  useEffect(() => {
    if (!isDs4) {
      setStatus(null);
      setError('');
      return;
    }
    let active = true;
    const tick = async () => {
      if (!active) return;
      await refresh();
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isDs4, refresh]);

  const start = async () => {
    if (!isDs4 || starting) return;
    setStarting(true);
    try {
      const result = (await pa.extensions.callAction('system-ds4', 'ds4StartServer', {})) as { status?: Ds4Status };
      setStatus(result.status ?? null);
      setError('');
      await refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
      await refresh();
    } finally {
      setStarting(false);
    }
  };

  return { isDs4, status, checking, starting, error, refresh, start };
}

function thinkingOptions(model: Model | null): Array<{ value: string; label: string }> {
  const all = [
    { value: '', label: 'Unset' },
    { value: 'off', label: 'Off' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'Extra high' },
  ];
  return model?.reasoning ? all : all.filter((option) => option.value === '' || option.value === 'off');
}

function describeDs4Health(health: ReturnType<typeof useDs4Health>) {
  if (!health.isDs4) return null;
  if (health.error) return { tone: 'danger', label: 'DS4 error', title: health.error, canStart: true };
  if (health.status?.reachable) return { tone: 'ok', label: 'DS4 alive', title: 'DS4 server is reachable.', canStart: false };
  if (health.status?.bootstrap?.running) return { tone: 'warn', label: 'DS4 setup', title: 'DS4 bootstrap is running.', canStart: false };
  if (health.status?.runtime?.installed === false) {
    return { tone: 'muted', label: 'DS4 setup needed', title: 'DS4 runtime is not installed. Run ds4BootstrapRuntime first.', canStart: false };
  }
  if (health.status?.server?.managedRunning) {
    return { tone: 'warn', label: 'DS4 starting', title: 'DS4 server process is running but not reachable yet.', canStart: false };
  }
  return {
    tone: health.checking ? 'muted' : 'warn',
    label: health.checking ? 'DS4 checking' : 'DS4 offline',
    title: 'DS4 server is not reachable.',
    canStart: true,
  };
}

function Ds4HealthIndicator({ health, variant }: { health: ReturnType<typeof useDs4Health>; variant: 'inline' | 'menu' }) {
  const description = describeDs4Health(health);
  if (!description) return null;
  const dotClass =
    description.tone === 'ok'
      ? 'bg-emerald-400'
      : description.tone === 'danger'
        ? 'bg-danger'
        : description.tone === 'warn'
          ? 'bg-amber-400'
          : 'bg-dim';
  return (
    <div
      className={cx(
        'flex min-w-0 items-center gap-1.5 text-[11px] text-dim',
        variant === 'menu' ? 'mt-1.5 justify-between' : 'max-w-[8.5rem]',
      )}
      title={description.title}
    >
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="min-w-0 truncate">{description.label}</span>
      {description.canStart ? (
        <button
          type="button"
          className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-secondary hover:bg-surface/55 hover:text-primary disabled:opacity-50"
          onClick={() => void health.start()}
          disabled={health.starting}
        >
          {health.starting ? 'Starting' : 'Start'}
        </button>
      ) : null}
    </div>
  );
}

function ModelSelect({
  context,
  variant,
  health,
}: {
  context: ComposerControlContext;
  variant: 'inline' | 'menu';
  health: ReturnType<typeof useDs4Health>;
}) {
  const className =
    variant === 'menu'
      ? 'h-9 w-full min-w-0 appearance-none rounded-lg border border-border-subtle bg-surface/45 px-2.5 pr-7 text-[12px] font-medium text-primary outline-none transition-colors hover:bg-surface/65 focus-visible:border-accent/50 focus-visible:bg-surface/65 disabled:cursor-default disabled:opacity-40'
      : cx(SELECT_CLASS, 'max-w-[11.5rem] min-w-[8.25rem] appearance-none');
  return (
    <div className={variant === 'menu' ? 'min-w-0' : 'inline-flex min-w-0 items-center gap-2'}>
      <label className={variant === 'menu' ? 'relative flex min-w-0 items-center' : 'relative inline-flex min-w-0 items-center'}>
        <span className="sr-only">Conversation model</span>
        <select
          value={context.currentModel}
          onChange={(event) => context.selectModel(event.target.value)}
          disabled={context.savingPreference !== null || context.models.length === 0}
          className={className}
          aria-label="Conversation model"
        >
          {groupModels(context.models).map(([provider, providerModels]) => (
            <optgroup key={provider} label={provider}>
              {providerModels.map((model) => {
                const value = modelSelectionValue(model, context.models);
                return (
                  <option key={value} value={value}>
                    {model.name}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
        <Chevron />
      </label>
      <Ds4HealthIndicator health={health} variant={variant} />
    </div>
  );
}

function ThinkingSelect({ context, variant }: { context: ComposerControlContext; variant: 'inline' | 'menu' }) {
  const model = resolveModel(context.models, context.currentModel);
  const className =
    variant === 'menu'
      ? 'h-9 w-full min-w-0 appearance-none rounded-lg border border-border-subtle bg-surface/45 px-2.5 pr-7 text-[12px] font-medium text-primary outline-none transition-colors hover:bg-surface/65 focus-visible:border-accent/50 focus-visible:bg-surface/65 disabled:cursor-default disabled:opacity-40'
      : cx(SELECT_CLASS, 'max-w-[6.5rem] min-w-[5.75rem] appearance-none');
  return (
    <label className={variant === 'menu' ? 'relative flex min-w-0 items-center' : 'relative inline-flex min-w-0 items-center'}>
      <span className="sr-only">Conversation thinking level</span>
      <select
        value={context.currentThinkingLevel}
        onChange={(event) => context.selectThinkingLevel(event.target.value)}
        disabled={context.savingPreference !== null}
        className={className}
        aria-label="Conversation thinking level"
      >
        {thinkingOptions(model).map((option) => (
          <option key={option.value || 'unset'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Chevron />
    </label>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-2.5 text-dim/70"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ModelPreferencesComposerControl({
  pa,
  controlContext,
  buttonContext,
}: {
  pa: { extensions: { callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown> } };
  controlContext?: ComposerControlContext;
  buttonContext: ComposerControlContext;
}) {
  const context = controlContext ?? buttonContext;
  const variant = context.renderMode;
  const selectedModel = resolveModel(context.models, context.currentModel);
  const ds4Health = useDs4Health(pa, selectedModel);
  if (variant === 'menu') {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dim/70">Model</p>
          <ModelSelect context={context} variant="menu" health={ds4Health} />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dim/70">Thinking</p>
          <ThinkingSelect context={context} variant="menu" />
        </div>
      </div>
    );
  }
  return (
    <>
      <ModelSelect context={context} variant="inline" health={ds4Health} />
      <ThinkingSelect context={context} variant="inline" />
    </>
  );
}
