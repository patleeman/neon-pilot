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
  runtime?: {
    managedRoot?: string;
    repoInstalled?: boolean;
    serverInstalled?: boolean;
    modelInstalled?: boolean;
    installed?: boolean;
    modelPath?: string;
    serverPath?: string;
    modelBytes?: number | null;
    tools?: Record<string, boolean>;
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
  const [busy, setBusy] = useState<'setup' | 'repair' | 'start' | 'stop' | 'restart' | 'refresh' | 'reveal-root' | 'reveal-model' | 'clear-kv' | 'copy' | null>(null);
  const [error, setError] = useState('');
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

  const run = async (action: 'setup' | 'repair' | 'start' | 'stop' | 'restart') => {
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
        result = (await pa.extension.invoke(actionId!, action === 'repair' ? { force: true } : {})) as { status?: Ds4Status };
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

  const runtimeInstalled = status?.runtime?.installed === true;
  const bootstrapRunning = status?.bootstrap?.running === true;
  const progress = setupProgress(status);
  const tools = status?.runtime?.tools ?? {};
  const steps =
    status?.bootstrap?.steps ?? [
      { id: 'tools', title: 'Check tools', progress: 8 },
      { id: 'source', title: 'Download source', progress: 22 },
      { id: 'build', title: 'Build ds4-server', progress: 42 },
      { id: 'model', title: 'Download model', progress: 82 },
      { id: 'verify', title: 'Verify install', progress: 95 },
      { id: 'done', title: 'Ready', progress: 100 },
    ];

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

      <div className="rounded-md border border-border-subtle bg-surface/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Setup progress</p>
            <p className="mt-1 text-primary">{status?.bootstrap?.message ?? (runtimeInstalled ? 'DS4 runtime ready' : 'Waiting to start setup')}</p>
          </div>
          <span className="font-mono text-[12px] text-dim">{Math.round(progress)}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-base">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {steps.map((step) => (
            <Step key={step.id} title={step.title} state={stepState(step, status)} />
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Info label="Repository" value={status?.runtime?.repoInstalled ? 'Installed' : 'Missing'} />
        <Info label="Server binary" value={status?.runtime?.serverInstalled ? 'Installed' : 'Missing'} />
        <Info label="Model file" value={status?.runtime?.modelInstalled ? formatBytes(status.runtime.modelBytes) : 'Missing'} />
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

      <div className="rounded-md border border-border-subtle bg-surface/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Setup</p>
        <p className="mt-2">
          Setup clones antirez/ds4, builds ds4-server, and downloads the recommended DeepSeek V4 Flash GGUF into extension-owned app storage.
          The model download is about 81 GB and can take a while. If the model file is already present, setup skips the download and can finish offline.
        </p>
        {status?.runtime?.managedRoot ? <p className="mt-2 break-all font-mono text-[11px] text-dim">{status.runtime.managedRoot}</p> : null}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className="mt-1 text-primary">{value}</p>
    </div>
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
