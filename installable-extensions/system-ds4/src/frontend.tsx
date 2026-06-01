import { useCallback, useEffect, useState } from 'react';

type ExtensionClient = {
  extension: {
    invoke(actionId: string, input?: unknown): Promise<unknown>;
  };
  ui?: {
    notify?(options: { message: string; type?: 'info' | 'warning' | 'error'; details?: string; source?: string }): void;
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
  };
  bootstrap?: { running?: boolean; status?: string; log?: string };
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

export function Ds4RuntimeSettings({ pa }: { pa: ExtensionClient }) {
  const [status, setStatus] = useState<Ds4Status | null>(null);
  const [busy, setBusy] = useState<'setup' | 'start' | 'stop' | 'refresh' | null>(null);
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

  const run = async (action: 'setup' | 'start' | 'stop') => {
    const actionId = action === 'setup' ? 'ds4BootstrapRuntime' : action === 'start' ? 'ds4StartServer' : 'ds4StopServer';
    setBusy(action);
    try {
      const result = (await pa.extension.invoke(actionId, {})) as { status?: Ds4Status };
      if (result.status) setStatus(result.status);
      setError('');
      pa.ui?.notify?.({
        message: action === 'setup' ? 'DS4 setup started.' : action === 'start' ? 'DS4 server started.' : 'DS4 server stopped.',
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

  const runtimeInstalled = status?.runtime?.installed === true;
  const bootstrapRunning = status?.bootstrap?.running === true;

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
        </div>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-[12px] text-danger">{error}</div> : null}

      <div className="grid gap-2 md:grid-cols-2">
        <Info label="Repository" value={status?.runtime?.repoInstalled ? 'Installed' : 'Missing'} />
        <Info label="Server binary" value={status?.runtime?.serverInstalled ? 'Installed' : 'Missing'} />
        <Info label="Model file" value={status?.runtime?.modelInstalled ? 'Installed' : 'Missing'} />
        <Info label="Server process" value={status?.server?.managedRunning ? `Running${status.server.managedPid ? ` (${status.server.managedPid})` : ''}` : 'Stopped'} />
      </div>

      <div className="rounded-md border border-border-subtle bg-surface/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Setup</p>
        <p className="mt-2">
          Setup clones antirez/ds4, builds ds4-server, and downloads the recommended DeepSeek V4 Flash GGUF into extension-owned app storage.
          The model download is about 81 GB and can take a while.
        </p>
        {status?.runtime?.managedRoot ? <p className="mt-2 break-all font-mono text-[11px] text-dim">{status.runtime.managedRoot}</p> : null}
      </div>

      {status?.bootstrap?.log ? <Log title="Bootstrap log" text={status.bootstrap.log} /> : null}
      {status?.server?.log ? <Log title="Server log" text={status.server.log} /> : null}
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
