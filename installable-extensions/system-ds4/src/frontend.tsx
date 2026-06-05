import { useCallback, useEffect, useState } from 'react';

type ExtensionClient = {
  extension: {
    invoke(actionId: string, input?: unknown): Promise<unknown>;
  };
  ui?: {
    notify?(options: { message: string; type?: 'info' | 'warning' | 'error'; details?: string; source?: string }): void;
    confirm?(options: { title?: string; message: string }): Promise<boolean>;
  };
};

type Ds4Status = {
  reachable?: boolean;
  baseUrl?: string;
  models?: string[];
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
    modelSlots?: Ds4ModelSlot[];
  };
  runtime?: {
    managedRoot?: string;
    repoInstalled?: boolean;
    serverInstalled?: boolean;
    modelInstalled?: boolean;
    installed?: boolean;
    modelPath?: string;
    serverPath?: string;
    modelBytes?: number | null;
    modelSlot?: Ds4ModelSlot;
    modelSlots?: Array<Ds4ModelSlot & { installed?: boolean }>;
    modelLink?: string;
    tools?: Record<string, boolean>;
    cliAvailable?: boolean;
    cliPath?: string;
    rtk?: {
      installed?: boolean;
      valid?: boolean;
      path?: string;
      version?: string;
      gainPreview?: string;
      error?: string;
    };
  };
  bootstrap?: {
    running?: boolean;
    status?: string;
    phase?: string;
    progress?: number;
    message?: string;
    updatedAt?: string;
    steps?: Array<{ id: string; title: string; progress: number }>;
    log?: string;
  };
  server?: { managedRunning?: boolean; managedPid?: number | null; error?: string; log?: string };
};

type Ds4ModelSlot = {
  id: string;
  enabled: boolean;
  modelId: string;
  name: string;
  filename: string;
  downloadVariant?: string;
  downloadUrl?: string;
  sizeLabel?: string;
};

const DEFAULT_MODEL_SLOTS: Ds4ModelSlot[] = [
  {
    id: 'default',
    enabled: true,
    modelId: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    filename: 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf',
    downloadVariant: 'q2-imatrix',
    sizeLabel: '~81 GB',
  },
  {
    id: 'spark-mini-q2-reap',
    enabled: false,
    modelId: 'deepseek-v4-flash-spark-mini-q2-reap',
    name: 'DeepSeek V4 Flash Spark Mini Q2 REAP',
    filename: 'DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf',
    downloadUrl: 'https://huggingface.co/0xSero/DeepSeek-V4-Flash-162B-GGUF/resolve/main/DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf',
    sizeLabel: '~49 GiB',
  },
];

const BUTTON_CLASS =
  'rounded-md border border-border-subtle bg-surface/35 px-2.5 py-1.5 text-[12px] font-medium text-secondary hover:bg-surface/65 hover:text-primary disabled:cursor-default disabled:opacity-50';

function statusLabel(status: Ds4Status | null): { text: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } {
  if (!status) return { text: 'Checking', tone: 'muted' };
  if (status.reachable) return { text: 'Alive', tone: 'ok' };
  if (status.bootstrap?.running) return { text: 'Setting up', tone: 'warn' };
  if (status.runtime?.installed === false) return { text: 'Setup needed', tone: 'muted' };
  if (status.server?.managedRunning) return { text: 'Starting', tone: 'warn' };
  if (status.server?.error) return { text: 'Error', tone: 'danger' };
  return { text: 'Offline', tone: 'warn' };
}

function dotClass(tone: ReturnType<typeof statusLabel>['tone']) {
  if (tone === 'ok') return 'bg-emerald-400';
  if (tone === 'danger') return 'bg-danger';
  if (tone === 'warn') return 'bg-amber-400';
  return 'bg-dim';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'Missing';
  const gib = bytes / 1024 / 1024 / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function setupProgress(status: Ds4Status | null): number {
  if (!status) return 0;
  if (status.runtime?.installed) return 100;
  if (typeof status.bootstrap?.progress === 'number') return Math.max(0, Math.min(100, status.bootstrap.progress));
  if (status.runtime?.modelInstalled) return 90;
  if (status.runtime?.serverInstalled) return 45;
  if (status.runtime?.repoInstalled) return 22;
  return 0;
}

function stepState(step: { id: string; progress: number }, status: Ds4Status | null): 'done' | 'active' | 'pending' | 'failed' {
  const phase = status?.bootstrap?.phase;
  const progress = setupProgress(status);
  if (status?.bootstrap?.status === 'failed' && phase === step.id) return 'failed';
  if (phase === step.id && status?.bootstrap?.running) return 'active';
  if (progress >= step.progress || status?.runtime?.installed) return 'done';
  return 'pending';
}

export function Ds4RuntimeSettings({ pa }: { pa: ExtensionClient }) {
  const [status, setStatus] = useState<Ds4Status | null>(null);
  const [busy, setBusy] = useState<
    'setup' | 'repair' | 'start' | 'stop' | 'restart' | 'refresh' | 'settings' | 'install-rtk' | 'reveal-root' | 'reveal-model' | 'clear-kv' | 'copy' | null
  >(null);
  const [error, setError] = useState('');
  const [advancedDraft, setAdvancedDraft] = useState({
    contextWindow: '1000000',
    maxTokens: '384000',
    kvDiskSpaceMb: '8192',
    directCoreTools: true,
    progressiveSkills: true,
    compactSkillPrompt: true,
    agentsPointers: true,
    activeModelSlotId: 'default',
    modelSlots: DEFAULT_MODEL_SLOTS,
  });
  const label = statusLabel(status);

  const refresh = useCallback(async () => {
    setBusy((current) => current ?? 'refresh');
    try {
      const next = (await pa.extension.invoke('ds4Status', {})) as Ds4Status;
      setStatus(next);
      setError('');
    } catch (refreshError) {
      setError(errorText(refreshError));
    } finally {
      setBusy((current) => (current === 'refresh' ? null : current));
    }
  }, [pa]);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (active) await refresh();
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!status?.settings) return;
    setAdvancedDraft({
      contextWindow: String(status.settings.contextWindow ?? 1000000),
      maxTokens: String(status.settings.maxTokens ?? 384000),
      kvDiskSpaceMb: String(status.settings.kvDiskSpaceMb ?? 8192),
      directCoreTools: status.settings.directCoreTools ?? true,
      progressiveSkills: status.settings.progressiveSkills ?? true,
      compactSkillPrompt: status.settings.compactSkillPrompt ?? true,
      agentsPointers: status.settings.agentsPointers ?? true,
      activeModelSlotId: status.settings.activeModelSlotId ?? 'default',
      modelSlots: status.settings.modelSlots?.length ? status.settings.modelSlots : DEFAULT_MODEL_SLOTS,
    });
  }, [
    status?.settings?.contextWindow,
    status?.settings?.maxTokens,
    status?.settings?.kvDiskSpaceMb,
    status?.settings?.directCoreTools,
    status?.settings?.progressiveSkills,
    status?.settings?.compactSkillPrompt,
    status?.settings?.agentsPointers,
    status?.settings?.activeModelSlotId,
    status?.settings?.modelSlots,
  ]);

  const run = async (action: 'setup' | 'repair' | 'start' | 'stop' | 'restart', slotId?: string) => {
    const actionId =
      action === 'setup' || action === 'repair'
        ? 'ds4BootstrapRuntime'
        : action === 'start'
          ? 'ds4StartServer'
          : action === 'stop'
            ? 'ds4StopServer'
            : null;
    setBusy(action);
    try {
      let result: { status?: Ds4Status } | undefined;
      if (action === 'restart') {
        await pa.extension.invoke('ds4StopServer', {});
        result = (await pa.extension.invoke('ds4StartServer', {})) as { status?: Ds4Status };
      } else {
        result = (await pa.extension.invoke(actionId!, {
          ...(action === 'repair' ? { force: true } : {}),
          ...(slotId ? { slotId, activeModelSlotId: slotId, modelSlots: advancedDraft.modelSlots } : {}),
        })) as { status?: Ds4Status };
      }
      if (result.status) setStatus(result.status);
      setError('');
      pa.ui?.notify?.({
        message:
          action === 'setup'
            ? 'DS4 setup started.'
            : action === 'repair'
              ? 'DS4 repair started.'
              : action === 'start'
                ? 'DS4 server started.'
                : action === 'restart'
                  ? 'DS4 server restarted.'
                  : 'DS4 server stopped.',
        type: 'info',
        source: 'DS4',
      });
      await refresh();
    } catch (actionError) {
      const message = errorText(actionError);
      setError(message);
      pa.ui?.notify?.({ message: 'DS4 action failed.', details: message, type: 'error', source: 'DS4' });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const runMaintenance = async (action: 'reveal-root' | 'reveal-model' | 'clear-kv' | 'copy') => {
    if (action === 'clear-kv') {
      const confirmed =
        (await pa.ui?.confirm?.({
          title: 'Clear DS4 KV cache?',
          message: 'This deletes the local DS4 KV cache. The model and ds4 checkout stay installed.',
        })) ?? false;
      if (!confirmed) return;
    }
    setBusy(action);
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(JSON.stringify(status ?? (await pa.extension.invoke('ds4Status', {})), null, 2));
        pa.ui?.notify?.({ message: 'DS4 diagnostics copied.', type: 'info', source: 'DS4' });
      } else {
        const actionId =
          action === 'reveal-root' ? 'ds4RevealRuntimeFolder' : action === 'reveal-model' ? 'ds4RevealModelFile' : 'ds4ClearKvCache';
        const result = (await pa.extension.invoke(actionId, {})) as { status?: Ds4Status };
        if (result.status) setStatus(result.status);
        pa.ui?.notify?.({
          message:
            action === 'reveal-root'
              ? 'DS4 runtime folder opened.'
              : action === 'reveal-model'
                ? 'DS4 model location opened.'
                : 'DS4 KV cache cleared.',
          type: 'info',
          source: 'DS4',
        });
      }
      setError('');
      await refresh();
    } catch (maintenanceError) {
      const message = errorText(maintenanceError);
      setError(message);
      pa.ui?.notify?.({ message: 'DS4 maintenance action failed.', details: message, type: 'error', source: 'DS4' });
    } finally {
      setBusy(null);
    }
  };

  const saveShellCompression = async (shellCompression: 'off' | 'rtk') => {
    setBusy('settings');
    try {
      const result = (await pa.extension.invoke('ds4SaveSettings', { shellCompression })) as { status?: Ds4Status };
      if (result.status) setStatus(result.status);
      setError('');
      pa.ui?.notify?.({
        message: shellCompression === 'rtk' ? 'DS4 will prefer RTK compact shell output.' : 'DS4 shell output compression disabled.',
        type: 'info',
        source: 'DS4',
      });
      await refresh();
    } catch (settingsError) {
      const message = errorText(settingsError);
      setError(message);
      pa.ui?.notify?.({ message: 'DS4 settings update failed.', details: message, type: 'error', source: 'DS4' });
    } finally {
      setBusy(null);
    }
  };

  const saveAdvancedSettings = async () => {
    const contextWindow = Number(advancedDraft.contextWindow);
    const maxTokens = Number(advancedDraft.maxTokens);
    const kvDiskSpaceMb = Number(advancedDraft.kvDiskSpaceMb);
    if (![contextWindow, maxTokens, kvDiskSpaceMb].every((value) => Number.isFinite(value) && value > 0)) {
      pa.ui?.notify?.({ message: 'DS4 advanced settings must be positive numbers.', type: 'warning', source: 'DS4' });
      return;
    }
    setBusy('settings');
    try {
      const result = (await pa.extension.invoke('ds4SaveSettings', {
        contextWindow,
        maxTokens,
        kvDiskSpaceMb,
        directCoreTools: advancedDraft.directCoreTools,
        progressiveSkills: advancedDraft.progressiveSkills,
        compactSkillPrompt: advancedDraft.compactSkillPrompt,
        agentsPointers: advancedDraft.agentsPointers,
        activeModelSlotId: advancedDraft.activeModelSlotId,
        modelSlots: advancedDraft.modelSlots,
      })) as { status?: Ds4Status };
      if (result.status) setStatus(result.status);
      setError('');
      pa.ui?.notify?.({
        message: 'DS4 advanced settings saved.',
        details: 'Restart DS4 for server context and KV cache changes to take effect.',
        type: 'info',
        source: 'DS4',
      });
      await refresh();
    } catch (settingsError) {
      const message = errorText(settingsError);
      setError(message);
      pa.ui?.notify?.({ message: 'DS4 settings update failed.', details: message, type: 'error', source: 'DS4' });
    } finally {
      setBusy(null);
    }
  };

  const installRtk = async () => {
    setBusy('install-rtk');
    try {
      const result = (await pa.extension.invoke('ds4InstallRtk', {})) as { status?: Ds4Status };
      if (result.status) setStatus(result.status);
      setError('');
      pa.ui?.notify?.({ message: 'RTK installed and verified.', type: 'info', source: 'DS4' });
      await refresh();
    } catch (installError) {
      const message = errorText(installError);
      setError(message);
      pa.ui?.notify?.({ message: 'RTK install failed.', details: message, type: 'error', source: 'DS4' });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const runtimeInstalled = status?.runtime?.installed === true;
  const bootstrapRunning = status?.bootstrap?.running === true;
  const progress = setupProgress(status);
  const tools = status?.runtime?.tools ?? {};
  const rtk = status?.runtime?.rtk;
  const shellCompression = status?.settings?.shellCompression ?? 'rtk';
  const localToolsReady = ['git', 'make', 'cc', 'curl'].every((tool) => tools[tool]);
  const optimizations = [
    { label: 'Runtime installed', ready: runtimeInstalled },
    { label: 'Server alive', ready: status?.reachable === true },
    { label: 'Local build tools', ready: localToolsReady },
    { label: 'DS4 CLI available', ready: status?.runtime?.cliAvailable === true },
    { label: 'RTK installed', ready: rtk?.valid === true },
    { label: 'RTK compression enabled', ready: shellCompression === 'rtk' && rtk?.valid === true },
  ];
  const steps =
    status?.bootstrap?.steps ?? [
      { id: 'tools', title: 'Check tools', progress: 8 },
      { id: 'source', title: 'Download source', progress: 22 },
      { id: 'build', title: 'Build ds4-server', progress: 42 },
      { id: 'model', title: 'Download model', progress: 82 },
      { id: 'verify', title: 'Verify install', progress: 95 },
      { id: 'done', title: 'Ready', progress: 100 },
    ];
  const activeSlot = advancedDraft.modelSlots.find((slot) => slot.id === advancedDraft.activeModelSlotId) ?? advancedDraft.modelSlots[0];
  const updateModelSlot = (index: number, patch: Partial<Ds4ModelSlot>) => {
    setAdvancedDraft((draft) => ({
      ...draft,
      modelSlots: draft.modelSlots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)),
    }));
  };
  const addModelSlot = () => {
    setAdvancedDraft((draft) => {
      const nextIndex = draft.modelSlots.length + 1;
      const id = `custom-${nextIndex}`;
      return {
        ...draft,
        modelSlots: [
          ...draft.modelSlots,
          {
            id,
            enabled: false,
            modelId: `deepseek-v4-flash-custom-${nextIndex}`,
            name: `DeepSeek V4 Flash Custom ${nextIndex}`,
            filename: `deepseek-v4-flash-custom-${nextIndex}.gguf`,
            downloadUrl: '',
            sizeLabel: '',
          },
        ].slice(0, 6),
      };
    });
  };

  return (
    <div className="space-y-4 text-[13px] text-secondary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <span className={`h-2 w-2 rounded-full ${dotClass(label.tone)}`} />
            <span className="font-medium">DS4 runtime</span>
            <span className="text-secondary">{label.text}</span>
          </div>
          <p className="mt-1 text-[12px] text-dim">{status?.baseUrl ?? 'http://127.0.0.1:8000/v1'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON_CLASS} onClick={() => void refresh()} disabled={busy !== null}>
            Refresh
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void run('setup')} disabled={busy !== null || bootstrapRunning}>
            {busy === 'setup' ? 'Setting up' : runtimeInstalled ? 'Re-run setup' : 'Setup'}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void run('start')} disabled={busy !== null || !runtimeInstalled}>
            {busy === 'start' ? 'Starting' : 'Start'}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void run('stop')} disabled={busy !== null || !status?.server?.managedRunning}>
            {busy === 'stop' ? 'Stopping' : 'Stop'}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void run('restart')} disabled={busy !== null || !runtimeInstalled}>
            {busy === 'restart' ? 'Restarting' : 'Restart'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-[12px] text-danger">{error}</div> : null}

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Optimizations</p>
            <p className="mt-1 text-primary">
              {optimizations.every((item) => item.ready) ? 'All DS4 optimizations ready' : 'Some DS4 optimizations need attention'}
            </p>
          </div>
          <span className="text-[12px] text-dim">
            {optimizations.filter((item) => item.ready).length}/{optimizations.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {optimizations.map((item) => (
            <ReadyItem key={item.label} label={item.label} ready={item.ready} />
          ))}
        </div>
      </div>

      <details className="rounded-md border border-border-subtle bg-surface/40 p-3" open={!runtimeInstalled || bootstrapRunning}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Setup progress</p>
              <p className="mt-1 text-primary">{status?.bootstrap?.message ?? (runtimeInstalled ? 'DS4 runtime ready' : 'Waiting to start setup')}</p>
            </div>
            <span className="font-mono text-[12px] text-dim">{Math.round(progress)}%</span>
          </div>
        </summary>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-base">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {steps.map((step) => (
            <Step key={step.id} title={step.title} state={stepState(step, status)} />
          ))}
        </div>
      </details>

      <div className="grid gap-2 md:grid-cols-2">
        <Info label="Repository" value={status?.runtime?.repoInstalled ? 'Installed' : 'Missing'} />
        <Info label="Server binary" value={status?.runtime?.serverInstalled ? 'Installed' : 'Missing'} />
        <Info label="Model file" value={`${activeSlot?.name ?? 'Selected model'}: ${status?.runtime?.modelInstalled ? formatBytes(status.runtime.modelBytes) : 'Missing'}`} />
        <Info label="Server process" value={status?.server?.managedRunning ? `Running${status.server.managedPid ? ` (${status.server.managedPid})` : ''}` : 'Stopped'} />
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Local tools</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {['git', 'make', 'cc', 'curl'].map((tool) => (
            <span
              key={tool}
              className={`rounded border px-2 py-1 text-[12px] ${
                tools[tool] ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              }`}
            >
              {tool}: {tools[tool] ? 'ready' : 'missing'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-dim">On macOS, Command Line Tools provide git, make, cc, and curl. Run xcode-select --install if any are missing.</p>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Shell output compression</p>
            <p className="mt-2 text-primary">RTK {rtk?.valid ? 'ready' : rtk?.installed ? 'installed but not verified' : 'not installed'}</p>
            <p className="mt-1 text-[12px] text-dim">
              {rtk?.valid
                ? `${rtk.version ?? 'rtk'}${rtk.path ? ` at ${rtk.path}` : ''}`
                : rtk?.error
                  ? rtk.error
                  : 'Install rtk-ai/rtk to let DS4 use compact command output through bash.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!rtk?.valid ? (
              <button type="button" className={BUTTON_CLASS} onClick={() => void installRtk()} disabled={busy !== null}>
                {busy === 'install-rtk' ? 'Installing' : 'Install RTK'}
              </button>
            ) : null}
            <div className="flex rounded-md border border-border-subtle bg-base/50 p-0.5">
              <button
                type="button"
                className={`rounded px-2.5 py-1.5 text-[12px] ${shellCompression === 'off' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary'}`}
                onClick={() => void saveShellCompression('off')}
                disabled={busy !== null}
              >
                Off
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1.5 text-[12px] ${shellCompression === 'rtk' ? 'bg-surface text-primary' : 'text-secondary hover:text-primary'}`}
                onClick={() => void saveShellCompression('rtk')}
                disabled={busy !== null || !rtk?.valid}
              >
                RTK
              </button>
            </div>
          </div>
        </div>
        {shellCompression === 'rtk' && rtk?.valid ? (
          <p className="mt-3 text-[12px] text-dim">Eligible DS4 bash commands are compacted automatically. Run ds4 compression off to disable it from a DS4 shell.</p>
        ) : null}
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Setup</p>
        <p className="mt-2">
          Setup clones antirez/ds4, builds ds4-server, and downloads the selected GGUF into extension-owned app storage.
          If the selected model file is already present, setup skips the download and can finish offline.
        </p>
        {status?.runtime?.managedRoot ? <p className="mt-2 break-all font-mono text-[11px] text-dim">{status.runtime.managedRoot}</p> : null}
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Model slots</p>
            <p className="mt-2 text-[12px] text-dim">Enable slots to expose several DS4 models. The active slot controls setup and the managed server GGUF.</p>
          </div>
          <button type="button" className={BUTTON_CLASS} onClick={addModelSlot} disabled={busy !== null || advancedDraft.modelSlots.length >= 6}>
            Add slot
          </button>
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Active runtime slot</span>
          <select
            value={advancedDraft.activeModelSlotId}
            onChange={(event) => setAdvancedDraft((draft) => ({ ...draft, activeModelSlotId: event.currentTarget.value }))}
            className="mt-2 w-full rounded-md border border-border-subtle bg-base px-2.5 py-2 text-[12px] text-primary outline-none focus:border-accent/60"
          >
            {advancedDraft.modelSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.name || slot.id}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 space-y-3">
          {advancedDraft.modelSlots.map((slot, index) => (
            <div key={`${slot.id}-${index}`} className="rounded-md border border-border-subtle bg-base/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[12px] text-primary">
                  <input type="checkbox" checked={slot.enabled} onChange={(event) => updateModelSlot(index, { enabled: event.currentTarget.checked })} className="h-4 w-4 accent-accent" />
                  Expose in picker
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" className={BUTTON_CLASS} onClick={() => void run('setup', slot.id)} disabled={busy !== null || bootstrapRunning}>
                    Setup this slot
                  </button>
                  <span className="font-mono text-[11px] text-dim">{slot.id}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextSetting label="Model id" value={slot.modelId} onChange={(modelId) => updateModelSlot(index, { modelId })} />
                <TextSetting label="Display name" value={slot.name} onChange={(name) => updateModelSlot(index, { name })} />
                <TextSetting label="GGUF filename" value={slot.filename} onChange={(filename) => updateModelSlot(index, { filename })} />
                <TextSetting label="Size label" value={slot.sizeLabel ?? ''} onChange={(sizeLabel) => updateModelSlot(index, { sizeLabel })} />
                <TextSetting label="DS4 download variant" value={slot.downloadVariant ?? ''} onChange={(downloadVariant) => updateModelSlot(index, { downloadVariant })} />
                <TextSetting label="Direct download URL" value={slot.downloadUrl ?? ''} onChange={(downloadUrl) => updateModelSlot(index, { downloadUrl })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Maintenance</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={BUTTON_CLASS} onClick={() => void runMaintenance('copy')} disabled={busy !== null}>
            {busy === 'copy' ? 'Copying' : 'Copy diagnostics'}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void runMaintenance('reveal-root')} disabled={busy !== null}>
            Reveal runtime folder
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void runMaintenance('reveal-model')} disabled={busy !== null}>
            Open model file location
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void run('repair')} disabled={busy !== null || bootstrapRunning}>
            {busy === 'repair' ? 'Repairing' : 'Reinstall / repair runtime'}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void runMaintenance('clear-kv')} disabled={busy !== null}>
            {busy === 'clear-kv' ? 'Clearing' : 'Clear KV cache'}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Advanced config</p>
            <p className="mt-2 text-[12px] text-dim">Tune DS4 model metadata and managed server launch flags. Restart DS4 after changing server settings.</p>
          </div>
          <button type="button" className={BUTTON_CLASS} onClick={() => void saveAdvancedSettings()} disabled={busy !== null}>
            {busy === 'settings' ? 'Saving' : 'Save advanced'}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <NumberSetting
            label="Context window"
            value={advancedDraft.contextWindow}
            min={4096}
            max={1000000}
            step={1024}
            onChange={(contextWindow) => setAdvancedDraft((draft) => ({ ...draft, contextWindow }))}
          />
          <NumberSetting
            label="Max response tokens"
            value={advancedDraft.maxTokens}
            min={1024}
            max={1000000}
            step={1024}
            onChange={(maxTokens) => setAdvancedDraft((draft) => ({ ...draft, maxTokens }))}
          />
          <NumberSetting
            label="KV disk cache MB"
            value={advancedDraft.kvDiskSpaceMb}
            min={1024}
            max={1048576}
            step={1024}
            onChange={(kvDiskSpaceMb) => setAdvancedDraft((draft) => ({ ...draft, kvDiskSpaceMb }))}
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <ToggleSetting
            label="Direct core tools only"
            description="Expose only bash, read, and edit directly; use the DS4 CLI for withheld tools."
            checked={advancedDraft.directCoreTools}
            onChange={(directCoreTools) => setAdvancedDraft((draft) => ({ ...draft, directCoreTools }))}
          />
          <ToggleSetting
            label="Progressive skills"
            description="Keep skills out of the initial prompt and discover them through ds4 skills."
            checked={advancedDraft.progressiveSkills}
            onChange={(progressiveSkills) => setAdvancedDraft((draft) => ({ ...draft, progressiveSkills }))}
          />
          <ToggleSetting
            label="Compact skill prompt"
            description="Keep only the DS4 skill path in prompt assembly and remove inline skill bodies."
            checked={advancedDraft.compactSkillPrompt}
            onChange={(compactSkillPrompt) => setAdvancedDraft((draft) => ({ ...draft, compactSkillPrompt }))}
          />
          <ToggleSetting
            label="AGENTS.md pointers"
            description="Replace injected AGENTS.md bodies with brief file pointers."
            checked={advancedDraft.agentsPointers}
            onChange={(agentsPointers) => setAdvancedDraft((draft) => ({ ...draft, agentsPointers }))}
          />
        </div>
      </div>

      {status?.bootstrap?.log ? <Log title="Bootstrap log" text={status.bootstrap.log} /> : null}
      {status?.server?.log ? <Log title="Server log" text={status.server.log} /> : null}
    </div>
  );
}

function Step({ title, state }: { title: string; state: 'done' | 'active' | 'pending' | 'failed' }) {
  const tone =
    state === 'done'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
      : state === 'active'
        ? 'border-accent/40 bg-accent/10 text-primary'
        : state === 'failed'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : 'border-border-subtle bg-base/40 text-dim';
  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${tone}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0 truncate text-[12px]">{title}</span>
    </div>
  );
}

function ReadyItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
        ready ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0 truncate text-[12px]">{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className="mt-1 text-primary">{value}</p>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-md border border-border-subtle bg-base/30 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-2 w-full rounded-md border border-border-subtle bg-base px-2.5 py-2 font-mono text-[12px] text-primary outline-none focus:border-accent/60"
      />
    </label>
  );
}

function TextSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-2 w-full rounded-md border border-border-subtle bg-base px-2.5 py-2 font-mono text-[12px] text-primary outline-none focus:border-accent/60"
      />
    </label>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle bg-base/30 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="mt-1 h-4 w-4 accent-accent" />
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-primary">{label}</span>
        <span className="mt-1 block text-[12px] text-dim">{description}</span>
      </span>
    </label>
  );
}

function Log({ title, text }: { title: string; text: string }) {
  return (
    <details className="rounded-md border border-border-subtle bg-surface/30 p-3">
      <summary className="cursor-pointer text-[12px] font-medium text-primary">{title}</summary>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-secondary">{text}</pre>
    </details>
  );
}
