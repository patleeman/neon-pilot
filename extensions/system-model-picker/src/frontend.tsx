import type { ComposerControlContext } from '@neon-pilot/extensions/composer';
import { cx, MenuGroupLabel, MenuItem, MenuSeparator, PositionedMenu, SectionLabel, StatusDot } from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useState } from 'react';

const INLINE_TRIGGER_CLASS = 'ui-menu-trigger-inline truncate disabled:cursor-default disabled:opacity-40';
const MENU_TRIGGER_CLASS = 'ui-menu-trigger-block truncate disabled:cursor-default disabled:opacity-40';
export const MODEL_PICKER_MENU_STYLE = {
  maxHeight: 'min(20rem, calc(100vh - 7rem))',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} as const;

type Model = ComposerControlContext['models'][number];

function groupModels(models: Model[]): Array<[string, Model[]]> {
  const groups = new Map<string, Model[]>();
  for (const model of models) groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  return [...groups.entries()];
}

const MODEL_PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'azure-openai-responses': 'Azure OpenAI Responses',
  'github-copilot': 'GitHub Copilot',
  google: 'Google Gemini',
  huggingface: 'Hugging Face',
  'kimi-coding': 'Kimi Coding',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax China',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI Codex',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Gateway',
  openrouter: 'OpenRouter',
  'vercel-ai-gateway': 'Vercel AI Gateway',
  xai: 'xAI',
  zai: 'ZAI',
};

function formatModelProviderLabel(providerId: string): string {
  const normalized = providerId.trim();
  if (!normalized) return 'Provider';
  return (
    MODEL_PROVIDER_DISPLAY_NAMES[normalized] ??
    normalized
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
      .join(' ')
  );
}

function formatModelProviderGroupLabel(providerId: string, providerIds: readonly string[]): string {
  const label = formatModelProviderLabel(providerId);
  const duplicateLabel = providerIds.some(
    (candidate) => candidate !== providerId && formatModelProviderLabel(candidate).toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  return duplicateLabel ? `${label} (${providerId})` : label;
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

export function formatModelTriggerLabel(input: { models: Model[]; currentModel: string }): string {
  const selected = resolveModel(input.models, input.currentModel);
  return selected?.name ?? (input.currentModel.trim() || 'Select model');
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
    activeModelSlotId?: string;
    modelSlots?: Array<{ id: string; modelId: string; name?: string; enabled?: boolean }>;
  };
  runtime?: { installed?: boolean; modelSlots?: Array<{ id: string; modelId: string; name?: string; installed?: boolean }> };
  bootstrap?: { running?: boolean; status?: string; progress?: number; message?: string };
  server?: { managedRunning?: boolean; error?: string; slotId?: string; modelId?: string };
};

type Ds4QuickSettingKey = 'shellCompression' | 'directCoreTools' | 'progressiveSkills' | 'compactSkillPrompt' | 'agentsPointers';

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
  const selectedModelId = model?.id ?? '';
  const selectedSlot =
    status?.runtime?.modelSlots?.find((slot) => slot.modelId === selectedModelId || slot.id === selectedModelId) ??
    status?.settings?.modelSlots?.find((slot) => slot.modelId === selectedModelId || slot.id === selectedModelId);
  const selectedSlotId = selectedSlot?.id;
  const selectedModelInstalled = Boolean(
    selectedSlot && ('installed' in selectedSlot ? selectedSlot.installed : status?.runtime?.installed),
  );
  const selectedModelRunning = Boolean(status?.reachable && selectedModelId && status.server?.modelId === selectedModelId);
  const selectedModelMismatch = Boolean(
    isDs4 && status?.reachable && selectedModelId && status.server?.modelId && status.server.modelId !== selectedModelId,
  );

  const refresh = useCallback(async () => {
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
  }, [isDs4, pa]);

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
      const result = (await pa.extensions.callAction('system-ds4', 'ds4StartServer', { provider: 'ds4', model: selectedModelId })) as {
        status?: Ds4Status;
      };
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
      const result = (await pa.extensions.callAction('system-ds4', 'ds4BootstrapRuntime', { provider: 'ds4', model: selectedModelId })) as {
        status?: Ds4Status;
      };
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
      const result = (await pa.extensions.callAction('system-ds4', 'ds4StartServer', { provider: 'ds4', model: selectedModelId })) as {
        status?: Ds4Status;
      };
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

  const saveIntervention = async (key: Ds4QuickSettingKey, value: boolean) => {
    if (!isDs4 || savingSetting) return;
    setSavingSetting(key);
    try {
      const current = status?.settings ?? {};
      const interventionPatch = key === 'shellCompression' ? { shellCompression: value ? 'rtk' : 'off' } : { [key]: value };
      const result = (await pa.extensions.callAction('system-ds4', 'ds4SaveSettings', {
        shellCompression: current.shellCompression ?? 'rtk',
        contextWindow: current.contextWindow ?? 1000000,
        maxTokens: current.maxTokens ?? 384000,
        kvDiskSpaceMb: current.kvDiskSpaceMb ?? 8192,
        directCoreTools: current.directCoreTools ?? true,
        progressiveSkills: current.progressiveSkills ?? true,
        compactSkillPrompt: current.compactSkillPrompt ?? true,
        agentsPointers: current.agentsPointers ?? true,
        ...interventionPatch,
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
    selectedModelId,
    selectedSlot,
    selectedSlotId,
    selectedModelInstalled,
    selectedModelRunning,
    selectedModelMismatch,
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

function formatServiceTierLabel(value: string): string {
  switch (value) {
    case 'auto':
      return 'Automatic';
    case 'default':
      return 'Default';
    case 'flex':
      return 'Flex';
    case 'priority':
      return 'Priority';
    case 'scale':
      return 'Scale';
    default:
      return value
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
        .join(' ');
  }
}

function describeDs4Health(health: ReturnType<typeof useDs4Health>, active: boolean) {
  if (!health.isDs4) return null;
  if (active) return { tone: 'active', label: 'DS4 active', title: 'DS4 is handling the current run.', canStart: false };
  if (health.error) return { tone: 'danger', label: 'DS4 error', title: health.error, canStart: true };
  if (health.selectedModelMismatch) {
    return {
      tone: 'warn',
      label: 'DS4 wrong model',
      title: `DS4 is reachable, but it is running ${health.status?.server?.modelId ?? 'another model'} instead of ${health.selectedModelId}.`,
      canStart: true,
      startLabel: 'Switch to selected model',
    };
  }
  if (health.status?.reachable && health.selectedModelRunning)
    return { tone: 'ok', label: 'DS4 alive', title: 'DS4 server is reachable for the selected model.', canStart: false };
  if (health.status?.reachable) return { tone: 'ok', label: 'DS4 alive', title: 'DS4 server is reachable.', canStart: false };
  if (health.status?.bootstrap?.running) return { tone: 'warn', label: 'DS4 setup', title: 'DS4 bootstrap is running.', canStart: false };
  if (health.status?.runtime?.installed === false) {
    return {
      tone: 'muted',
      label: 'DS4 setup needed',
      title: 'DS4 is not installed. Setup will install DS4, build the server, and download the selected model.',
      canSetup: true,
      canStart: false,
    };
  }
  if (health.selectedSlot && !health.selectedModelInstalled) {
    return {
      tone: 'muted',
      label: 'DS4 setup needed',
      title: `The selected DS4 model (${health.selectedSlot.name ?? health.selectedModelId}) is not installed.`,
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
    key: Ds4QuickSettingKey;
    label: string;
    checked: boolean;
  }> = [
    {
      key: 'shellCompression',
      label: 'Output compression',
      checked: (settings.shellCompression ?? 'rtk') === 'rtk',
    },
    {
      key: 'directCoreTools',
      label: 'Core tools only',
      checked: settings.directCoreTools ?? true,
    },
    {
      key: 'progressiveSkills',
      label: 'Progressive skills',
      checked: settings.progressiveSkills ?? true,
    },
    {
      key: 'compactSkillPrompt',
      label: 'Compact skill prompt',
      checked: settings.compactSkillPrompt ?? true,
    },
    {
      key: 'agentsPointers',
      label: 'AGENTS.md pointers',
      checked: settings.agentsPointers ?? true,
    },
  ];
  const needsLabel =
    variant === 'menu' ||
    active ||
    description.tone === 'danger' ||
    description.tone === 'warn' ||
    'canSetup' in description ||
    description.canStart;
  const dotTone =
    description.tone === 'active'
      ? 'success'
      : description.tone === 'ok'
        ? 'success'
        : description.tone === 'danger'
          ? 'danger'
          : description.tone === 'warn'
            ? 'warning'
            : 'muted';
  const compactStatus = (
    <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
      {setupProgress !== null ? (
        <span className="font-mono text-[10px] leading-none text-amber-300">{setupProgress}%</span>
      ) : (
        <>
          {active ? <span className="ui-status-dot-active-ping" /> : null}
          <StatusDot tone={dotTone} size="xs" className="relative" />
        </>
      )}
    </span>
  );
  return (
    <>
      {/* ui-pattern-ok raw-details-summary reason="details keeps composer popover open state anchored to its trigger" */}
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
        {/* ui-pattern-ok raw-details-summary reason="summary is the native trigger for this anchored composer popover" */}
        <summary
          className="ui-menu-trigger-inline flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden"
          aria-label={`${description.label} menu`}
        >
          {compactStatus}
          {needsLabel ? <span className="min-w-0 truncate">{setupProgress !== null ? 'DS4 setup' : description.label}</span> : null}
        </summary>
        <PositionedMenu placement="absolute" position={{ right: 0, bottom: '100%' }} className="mb-2 w-64 bg-base p-1.5">
          <MenuButton onClick={() => void health.refresh()} disabled={health.checking}>
            {health.checking ? 'Refreshing' : 'Refresh status'}
          </MenuButton>
          {'canSetup' in description && description.canSetup ? (
            <MenuButton onClick={() => void health.setup()} disabled={health.settingUp}>
              {health.settingUp ? 'Setting up' : 'Run setup'}
            </MenuButton>
          ) : null}
          <MenuButton
            onClick={() => void health.start()}
            disabled={health.starting || (health.status?.reachable === true && !health.selectedModelMismatch)}
          >
            {health.starting ? 'Starting' : 'startLabel' in description ? description.startLabel : 'Start server'}
          </MenuButton>
          <MenuButton onClick={() => void health.stop()} disabled={health.stopping || health.status?.server?.managedRunning !== true}>
            {health.stopping ? 'Stopping' : 'Stop server'}
          </MenuButton>
          <MenuButton onClick={() => void health.restart()} disabled={health.restarting || health.status?.runtime?.installed === false}>
            {health.restarting ? 'Restarting' : 'Restart server'}
          </MenuButton>
          <MenuSeparator />
          <MenuGroupLabel>Interventions</MenuGroupLabel>
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
          <MenuSeparator />
          <MenuButton onClick={() => void health.openSettings()}>Open DS4 settings</MenuButton>
        </PositionedMenu>
      </details>
    </>
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
    <MenuItem
      className={cx(
        'gap-2 px-2 py-1.5 text-[11px] disabled:cursor-default disabled:opacity-40',
        checked ? 'text-primary' : 'text-secondary',
      )}
      closeOnPointerDown={false}
      disabled={disabled}
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open');
        onClick();
      }}
    >
      {checked !== undefined ? (
        <span className="flex w-3 shrink-0 justify-center">{checked ? <span className="ui-radio-dot" /> : null}</span>
      ) : null}
      {children}
    </MenuItem>
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
    <MenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cx('justify-between gap-3 px-2 py-1.5 text-[11px] text-primary', disabled ? 'cursor-default opacity-50' : '')}
      closeOnPointerDown={false}
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
    </MenuItem>
  );
}

function ModelSelect({ context, variant }: { context: ComposerControlContext; variant: 'inline' | 'menu' }) {
  const selectedModel = resolveModel(context.models, context.currentModel);
  const selectedLabel = formatModelTriggerLabel({ models: context.models, currentModel: context.currentModel });
  const disabled = context.savingPreference !== null || context.models.length === 0;
  const triggerClass = variant === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[11.5rem] min-w-[8.25rem]');
  return (
    <>
      {/* ui-pattern-ok raw-details-summary reason="details keeps model menu open state anchored to the composer trigger" */}
      <details
        data-model-picker-menu
        className={variant === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
        onToggle={(event) => {
          if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
        }}
      >
        {/* ui-pattern-ok raw-details-summary reason="summary is the native trigger for this anchored model menu" */}
        <summary
          className={cx(
            'flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden',
            triggerClass,
            disabled && 'pointer-events-none opacity-40',
          )}
          aria-label="Conversation model"
          aria-disabled={disabled}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <Chevron className="static shrink-0" />
        </summary>
        <PositionedMenu
          placement="absolute"
          position={{ left: 0, bottom: '100%' }}
          className={cx('mb-2 bg-base p-1.5', variant === 'menu' ? 'left-0 w-full min-w-56' : 'left-0 w-64')}
          style={MODEL_PICKER_MENU_STYLE}
        >
          {groupModels(context.models).map(([provider, providerModels], _index, groups) => (
            <div key={provider} className="py-1">
              <MenuGroupLabel className="pb-1">
                {formatModelProviderGroupLabel(
                  provider,
                  groups.map(([groupProvider]) => groupProvider),
                )}
              </MenuGroupLabel>
              {providerModels.map((model) => {
                const value = modelSelectionValue(model, context.models);
                const checked = selectedModel?.provider === model.provider && selectedModel.id === model.id;
                return (
                  <MenuButton key={value} onClick={() => context.selectModel(value)} checked={checked}>
                    <span className="min-w-0 truncate">{model.name}</span>
                  </MenuButton>
                );
              })}
            </div>
          ))}
        </PositionedMenu>
      </details>
    </>
  );
}

function ThinkingSelect({ context, variant }: { context: ComposerControlContext; variant: 'inline' | 'menu' }) {
  const model = resolveModel(context.models, context.currentModel);
  const options = thinkingOptions(model);
  const selected = options.find((option) => option.value === context.currentThinkingLevel) ?? options[0];
  const disabled = context.savingPreference !== null;
  const triggerClass = variant === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[6.5rem] min-w-[5.75rem]');
  return (
    <>
      {/* ui-pattern-ok raw-details-summary reason="details keeps thinking menu open state anchored to the composer trigger" */}
      <details
        data-model-picker-menu
        className={variant === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
        onToggle={(event) => {
          if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
        }}
      >
        {/* ui-pattern-ok raw-details-summary reason="summary is the native trigger for this anchored thinking menu" */}
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
        <PositionedMenu
          placement="absolute"
          position={{ left: 0, bottom: '100%' }}
          className={cx('mb-2 bg-base p-1.5', variant === 'menu' ? 'w-full min-w-44' : 'w-40')}
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
        </PositionedMenu>
      </details>
    </>
  );
}

function ServiceTierSelect({ context, variant }: { context: ComposerControlContext; variant: 'inline' | 'menu' }) {
  const model = resolveModel(context.models, context.currentModel);
  const serviceTiers = model?.supportedServiceTiers ?? [];
  if (serviceTiers.length === 0) {
    return null;
  }

  const selectedLabel = context.currentServiceTier ? formatServiceTierLabel(context.currentServiceTier) : 'Use model default';
  const disabled = context.savingPreference !== null;
  const triggerClass = variant === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[6.5rem] min-w-[5.75rem]');
  return (
    <>
      {/* ui-pattern-ok raw-details-summary reason="details keeps service tier menu open state anchored to the composer trigger" */}
      <details
        data-model-picker-menu
        className={variant === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
        onToggle={(event) => {
          if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
        }}
      >
        {/* ui-pattern-ok raw-details-summary reason="summary is the native trigger for this anchored service tier menu" */}
        <summary
          className={cx(
            'flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden',
            triggerClass,
            disabled && 'pointer-events-none opacity-40',
          )}
          aria-label="Conversation service tier"
          aria-disabled={disabled}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <Chevron className="static shrink-0" />
        </summary>
        <PositionedMenu
          placement="absolute"
          position={{ left: 0, bottom: '100%' }}
          className={cx('mb-2 bg-base p-1.5', variant === 'menu' ? 'w-full min-w-44' : 'w-40')}
        >
          <MenuButton onClick={() => context.selectServiceTier('')} checked={!context.currentServiceTier}>
            Use model default
          </MenuButton>
          {serviceTiers.map((tier) => (
            <MenuButton key={tier} onClick={() => context.selectServiceTier(tier)} checked={tier === context.currentServiceTier}>
              {formatServiceTierLabel(tier)}
            </MenuButton>
          ))}
        </PositionedMenu>
      </details>
    </>
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
}: {
  pa: {
    commands?: { execute(command: string, args?: unknown): Promise<boolean> };
    extensions: { callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown> };
  };
  controlContext: ComposerControlContext;
}) {
  const context = controlContext;
  useCloseComposerMenusOnOutsideInteraction();
  const variant = context.renderMode;
  const selectedModel = resolveModel(context.models, context.currentModel);
  const ds4Health = useDs4Health(pa, selectedModel);
  if (variant === 'menu') {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <SectionLabel tone="muted" className="mb-1 block">
            Model
          </SectionLabel>
          <ModelSelect context={context} variant="menu" />
        </div>
        <div>
          <SectionLabel tone="muted" className="mb-1 block">
            Thinking
          </SectionLabel>
          <ThinkingSelect context={context} variant="menu" />
        </div>
        <div>
          <SectionLabel tone="muted" className="mb-1 block">
            Service tier
          </SectionLabel>
          <ServiceTierSelect context={context} variant="menu" />
        </div>
        <Ds4HealthIndicator health={ds4Health} variant="menu" active={ds4Health.isDs4 && context.streamIsStreaming} />
      </div>
    );
  }
  return (
    <>
      <ModelSelect context={context} variant="inline" />
      <ThinkingSelect context={context} variant="inline" />
      <ServiceTierSelect context={context} variant="inline" />
      <Ds4HealthIndicator health={ds4Health} variant="inline" active={ds4Health.isDs4 && context.streamIsStreaming} />
    </>
  );
}
