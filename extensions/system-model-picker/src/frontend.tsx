import type { ComposerControlContext } from '@neon-pilot/extensions/composer';
import { cx } from '@neon-pilot/extensions/ui';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const INLINE_TRIGGER_CLASS =
  'h-8 min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 text-[11px] font-medium text-secondary outline-none transition-colors hover:bg-surface/45 hover:text-primary focus-visible:border-border-subtle focus-visible:bg-surface/55 focus-visible:text-primary focus-visible:ring-1 focus-visible:ring-accent/20 disabled:cursor-default disabled:opacity-40';
const MENU_TRIGGER_CLASS =
  'h-9 w-full min-w-0 rounded-lg border border-border-subtle bg-surface/45 px-2.5 text-[12px] font-medium text-primary outline-none transition-colors hover:bg-surface/65 focus-visible:border-accent/50 focus-visible:bg-surface/65 disabled:cursor-default disabled:opacity-40';

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
  settings?: {
    shellCompression?: 'off' | 'rtk';
    contextWindow?: number;
    maxTokens?: number;
    kvDiskSpaceMb?: number;
    directCoreTools?: boolean;
    progressiveSkills?: boolean;
    compactSkillPrompt?: boolean;
    agentsPointers?: boolean;
  };
  runtime?: { installed?: boolean };
  bootstrap?: { running?: boolean; status?: string; progress?: number; message?: string };
  server?: { managedRunning?: boolean; error?: string };
};

function useDs4Health(
  pa: {
    commands?: { execute(command: string, args?: unknown): Promise<boolean> };
    extensions: { callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown> };
  },
  model: Model | null,
) {
  const isDs4 = model?.provider === 'ds4';
  const [status, setStatus] = useState<Ds4Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
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

  const setup = async () => {
    if (!isDs4 || settingUp) return;
    setSettingUp(true);
    try {
      const result = (await pa.extensions.callAction('system-ds4', 'ds4BootstrapRuntime', {})) as { status?: Ds4Status };
      setStatus(result.status ?? null);
      setError('');
      await refresh();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : String(setupError));
      await refresh();
    } finally {
      setSettingUp(false);
    }
  };

  const stop = async () => {
    if (!isDs4 || stopping) return;
    setStopping(true);
    try {
      const result = (await pa.extensions.callAction('system-ds4', 'ds4StopServer', {})) as { status?: Ds4Status };
      setStatus(result.status ?? null);
      setError('');
      await refresh();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
      await refresh();
    } finally {
      setStopping(false);
    }
  };

  const restart = async () => {
    if (!isDs4 || restarting) return;
    setRestarting(true);
    try {
      await pa.extensions.callAction('system-ds4', 'ds4StopServer', {});
      const result = (await pa.extensions.callAction('system-ds4', 'ds4StartServer', {})) as { status?: Ds4Status };
      setStatus(result.status ?? null);
      setError('');
      await refresh();
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : String(restartError));
      await refresh();
    } finally {
      setRestarting(false);
    }
  };

  const openSettings = async () => {
    await pa.commands?.execute('app.navigate', { to: '/settings#settings-ds4' });
  };

  const saveIntervention = async (key: 'directCoreTools' | 'progressiveSkills' | 'compactSkillPrompt' | 'agentsPointers', value: boolean) => {
    if (!isDs4 || savingSetting) return;
    setSavingSetting(key);
    try {
      const current = status?.settings ?? {};
      const result = (await pa.extensions.callAction('system-ds4', 'ds4SaveSettings', {
        shellCompression: current.shellCompression ?? 'rtk',
        contextWindow: current.contextWindow ?? 1000000,
        maxTokens: current.maxTokens ?? 384000,
        kvDiskSpaceMb: current.kvDiskSpaceMb ?? 8192,
        directCoreTools: current.directCoreTools ?? true,
        progressiveSkills: current.progressiveSkills ?? true,
        compactSkillPrompt: current.compactSkillPrompt ?? true,
        agentsPointers: current.agentsPointers ?? true,
        [key]: value,
      })) as { status?: Ds4Status };
      setStatus(result.status ?? null);
      setError('');
      await refresh();
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : String(settingsError));
      await refresh();
    } finally {
      setSavingSetting(null);
    }
  };

  return {
    isDs4,
    status,
    checking,
    starting,
    stopping,
    restarting,
    settingUp,
    savingSetting,
    error,
    refresh,
    start,
    stop,
    restart,
    setup,
    openSettings,
    saveIntervention,
  };
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

function describeDs4Health(health: ReturnType<typeof useDs4Health>, active: boolean) {
  if (!health.isDs4) return null;
  if (active) return { tone: 'active', label: 'DS4 active', title: 'DS4 is handling the current run.', canStart: false };
  if (health.error) return { tone: 'danger', label: 'DS4 error', title: health.error, canStart: true };
  if (health.status?.reachable) return { tone: 'ok', label: 'DS4 alive', title: 'DS4 server is reachable.', canStart: false };
  if (health.status?.bootstrap?.running) return { tone: 'warn', label: 'DS4 setup', title: 'DS4 bootstrap is running.', canStart: false };
  if (health.status?.runtime?.installed === false) {
    return {
      tone: 'muted',
      label: 'DS4 setup needed',
      title: 'DS4 runtime is not installed. Setup clones ds4, builds ds4-server, and downloads the model.',
      canSetup: true,
      canStart: false,
    };
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

function closeOtherComposerMenus(current: HTMLDetailsElement) {
  const root = current.parentElement?.parentElement ?? document;
  for (const details of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-model-picker-menu]'))) {
    if (details !== current) details.removeAttribute('open');
  }
}

function closeAllComposerMenus() {
  for (const details of Array.from(document.querySelectorAll<HTMLDetailsElement>('details[data-model-picker-menu][open]'))) {
    details.removeAttribute('open');
  }
}

function useCloseComposerMenusOnOutsideInteraction() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target.parentElement?.closest('details[data-model-picker-menu]')) return;
      if (target instanceof Element && target.closest('details[data-model-picker-menu]')) return;
      closeAllComposerMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAllComposerMenus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}

function Ds4HealthIndicator({
  health,
  variant,
  active,
}: {
  health: ReturnType<typeof useDs4Health>;
  variant: 'inline' | 'menu';
  active: boolean;
}) {
  const description = describeDs4Health(health, active);
  if (!description) return null;
  const setupProgress =
    health.status?.bootstrap?.running && typeof health.status.bootstrap.progress === 'number'
      ? Math.max(0, Math.min(100, Math.round(health.status.bootstrap.progress)))
      : null;
  const settings = health.status?.settings ?? {};
  const interventionItems: Array<{
    key: 'directCoreTools' | 'progressiveSkills' | 'compactSkillPrompt' | 'agentsPointers';
    label: string;
    description: string;
    checked: boolean;
  }> = [
    {
      key: 'directCoreTools',
      label: 'Core tools only',
      description: 'Expose bash/read/edit directly',
      checked: settings.directCoreTools ?? true,
    },
    {
      key: 'progressiveSkills',
      label: 'Progressive skills',
      description: 'Discover skills through ds4',
      checked: settings.progressiveSkills ?? true,
    },
    {
      key: 'compactSkillPrompt',
      label: 'Compact skill prompt',
      description: 'Skip inline skill bodies',
      checked: settings.compactSkillPrompt ?? true,
    },
    {
      key: 'agentsPointers',
      label: 'AGENTS.md pointers',
      description: 'Use file pointers instead of bodies',
      checked: settings.agentsPointers ?? true,
    },
  ];
  const needsLabel =
    variant === 'menu' || active || description.tone === 'danger' || description.tone === 'warn' || 'canSetup' in description || description.canStart;
  const dotClass =
    description.tone === 'active'
      ? 'bg-accent shadow-[0_0_10px_rgba(96,165,250,0.65)] animate-pulse'
      : description.tone === 'ok'
      ? 'bg-emerald-400'
      : description.tone === 'danger'
        ? 'bg-danger'
        : description.tone === 'warn'
          ? 'bg-amber-400'
          : 'bg-dim';
  const compactStatus = (
    <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
      {setupProgress !== null ? (
        <span className="font-mono text-[10px] leading-none text-amber-300">{setupProgress}%</span>
      ) : (
        <>
          {active ? <span className="absolute h-3 w-3 rounded-full bg-accent/25 animate-ping" /> : null}
          <span className={cx('relative h-1.5 w-1.5 rounded-full', dotClass)} />
        </>
      )}
    </span>
  );
  return (
    <details
      data-model-picker-menu
      className={cx(
        'group relative flex min-w-0 items-center gap-1.5 text-[11px] text-dim',
        variant === 'menu' ? 'mt-1.5 justify-between' : 'max-w-[8.5rem]',
      )}
      title={description.title}
      onToggle={(event) => {
        if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
      }}
    >
      <summary
        className="flex min-w-0 cursor-pointer list-none items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface/55 hover:text-primary [&::-webkit-details-marker]:hidden"
        aria-label={`${description.label} menu`}
      >
        {compactStatus}
        {needsLabel ? <span className="min-w-0 truncate">{setupProgress !== null ? 'DS4 setup' : description.label}</span> : null}
      </summary>
      <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border-subtle bg-base p-1.5 shadow-xl">
        <MenuButton onClick={() => void health.refresh()} disabled={health.checking}>
          {health.checking ? 'Refreshing' : 'Refresh status'}
        </MenuButton>
        {'canSetup' in description && description.canSetup ? (
          <MenuButton onClick={() => void health.setup()} disabled={health.settingUp}>
            {health.settingUp ? 'Setting up' : 'Run setup'}
          </MenuButton>
        ) : null}
        <MenuButton onClick={() => void health.start()} disabled={health.starting || health.status?.reachable === true}>
          {health.starting ? 'Starting' : 'Start server'}
        </MenuButton>
        <MenuButton onClick={() => void health.stop()} disabled={health.stopping || health.status?.server?.managedRunning !== true}>
          {health.stopping ? 'Stopping' : 'Stop server'}
        </MenuButton>
        <MenuButton onClick={() => void health.restart()} disabled={health.restarting || health.status?.runtime?.installed === false}>
          {health.restarting ? 'Restarting' : 'Restart server'}
        </MenuButton>
        <div className="my-1 border-t border-border-subtle" />
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-dim">Interventions</div>
        {interventionItems.map((item) => (
          <MenuCheckbox
            key={item.key}
            checked={item.checked}
            disabled={health.savingSetting !== null}
            label={item.label}
            saving={health.savingSetting === item.key}
            onChange={(checked) => void health.saveIntervention(item.key, checked)}
          />
        ))}
        <div className="my-1 border-t border-border-subtle" />
        <MenuButton onClick={() => void health.openSettings()}>Open DS4 settings</MenuButton>
      </div>
    </details>
  );
}

function MenuButton({
  children,
  checked,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-surface/65 hover:text-primary disabled:cursor-default disabled:opacity-40',
        checked ? 'text-primary' : 'text-secondary',
      )}
      disabled={disabled}
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open');
        onClick();
      }}
    >
      {checked !== undefined ? (
        <span className="flex w-3 shrink-0 justify-center">{checked ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}</span>
      ) : null}
      {children}
    </button>
  );
}

function MenuCheckbox({
  checked,
  disabled,
  label,
  saving,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  saving?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[11px] text-primary hover:bg-surface/65',
        disabled ? 'cursor-default opacity-50' : '',
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="min-w-0 truncate">{saving ? 'Saving...' : label}</span>
      <span className="w-3 shrink-0 text-right text-[12px] leading-none text-accent" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
    </button>
  );
}

function ModelSelect({
  context,
  variant,
}: {
  context: ComposerControlContext;
  variant: 'inline' | 'menu';
}) {
  const selected = resolveModel(context.models, context.currentModel);
  const disabled = context.savingPreference !== null || context.models.length === 0;
  const triggerClass = variant === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[11.5rem] min-w-[8.25rem]');
  return (
    <details
      data-model-picker-menu
      className={variant === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
      onToggle={(event) => {
        if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
      }}
    >
      <summary
        className={cx(
          'flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden',
          triggerClass,
          disabled && 'pointer-events-none opacity-40',
        )}
        aria-label="Conversation model"
        aria-disabled={disabled}
      >
        <span className="min-w-0 truncate">{selected?.name ?? 'Select model'}</span>
        <Chevron className="static shrink-0" />
      </summary>
      <div
        className={cx(
          'absolute bottom-full z-50 mb-2 max-h-80 overflow-auto rounded-lg border border-border-subtle bg-base p-1.5 shadow-xl',
          variant === 'menu' ? 'left-0 w-full min-w-56' : 'left-0 w-64',
        )}
      >
          {groupModels(context.models).map(([provider, providerModels]) => (
            <div key={provider} className="py-1">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dim/70">{provider}</div>
              {providerModels.map((model) => {
                const value = modelSelectionValue(model, context.models);
                const checked = selected?.provider === model.provider && selected.id === model.id;
                return (
                  <MenuButton key={value} onClick={() => context.selectModel(value)} checked={checked}>
                    <span className="min-w-0 truncate">{model.name}</span>
                  </MenuButton>
                );
              })}
            </div>
          ))}
      </div>
    </details>
  );
}

function ThinkingSelect({ context, variant }: { context: ComposerControlContext; variant: 'inline' | 'menu' }) {
  const model = resolveModel(context.models, context.currentModel);
  const options = thinkingOptions(model);
  const selected = options.find((option) => option.value === context.currentThinkingLevel) ?? options[0];
  const disabled = context.savingPreference !== null;
  const triggerClass = variant === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[6.5rem] min-w-[5.75rem]');
  return (
    <details
      data-model-picker-menu
      className={variant === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
      onToggle={(event) => {
        if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
      }}
    >
      <summary
        className={cx(
          'flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden',
          triggerClass,
          disabled && 'pointer-events-none opacity-40',
        )}
        aria-label="Conversation thinking level"
        aria-disabled={disabled}
      >
        <span className="min-w-0 truncate">{selected?.label ?? 'Unset'}</span>
        <Chevron className="static shrink-0" />
      </summary>
      <div
        className={cx(
          'absolute bottom-full z-50 mb-2 rounded-lg border border-border-subtle bg-base p-1.5 shadow-xl',
          variant === 'menu' ? 'left-0 w-full min-w-44' : 'left-0 w-40',
        )}
      >
        {options.map((option) => (
          <MenuButton
            key={option.value || 'unset'}
            onClick={() => context.selectThinkingLevel(option.value)}
            checked={option.value === context.currentThinkingLevel}
          >
            {option.label}
          </MenuButton>
        ))}
      </div>
    </details>
  );
}

function Chevron({ className }: { className?: string }) {
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
      className={cx('pointer-events-none text-dim/70', className ?? 'absolute right-2.5')}
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
  pa: {
    commands?: { execute(command: string, args?: unknown): Promise<boolean> };
    extensions: { callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown> };
  };
  controlContext?: ComposerControlContext;
  buttonContext: ComposerControlContext;
}) {
  const context = controlContext ?? buttonContext;
  useCloseComposerMenusOnOutsideInteraction();
  const variant = context.renderMode;
  const selectedModel = resolveModel(context.models, context.currentModel);
  const ds4Health = useDs4Health(pa, selectedModel);
  if (variant === 'menu') {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dim/70">Model</p>
          <ModelSelect context={context} variant="menu" />
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
      <ModelSelect context={context} variant="inline" />
      <ThinkingSelect context={context} variant="inline" />
      <Ds4HealthIndicator health={ds4Health} variant="inline" active={ds4Health.isDs4 && context.streamIsStreaming} />
    </>
  );
}
