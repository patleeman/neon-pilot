import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

type ServerHealth = { reachable: boolean; models?: string[] };
type ProcessState = { serverPid: number | null; serverRunning: boolean; setupPid: number | null; setupRunning: boolean };

type Status = {
  ok: boolean;
  modelId: string;
  baseUrl: string;
  runtimeInstalled: boolean;
  venvReady: boolean;
  server: ServerHealth;
  process: ProcessState;
  log: string;
};

function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'success' | 'warning' | 'accent' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'muted' && 'bg-surface text-secondary',
      )}
    >
      {children}
    </span>
  );
}

export function VideoProbePage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await pa.extension.invoke<Status>('videoProbeStatus', {});
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa]);

  useEffect(() => {
    void fetchStatus();
    pollRef.current = setInterval(() => void fetchStatus(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  async function runAction(label: string, actionId: string) {
    setBusy(label);
    setError(null);
    try {
      const result = await pa.extension.invoke<{ ok: boolean; error?: string; status?: Status }>(actionId, {});
      if (result.status) setStatus(result.status);
      if (!result.ok && result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const setupRunning = status?.process.setupRunning ?? false;
  const serverRunning = status?.process.serverRunning ?? false;
  const serverReachable = status?.server.reachable ?? false;
  const runtimeInstalled = status?.runtimeInstalled ?? false;

  const statusLabel =
    busy ??
    (serverReachable ? 'Running' : serverRunning ? 'Starting' : setupRunning ? 'Installing' : runtimeInstalled ? 'Ready' : 'Not set up');

  const statusDotClass = serverReachable ? 'bg-success' : serverRunning || setupRunning ? 'bg-warning animate-pulse' : 'bg-dim';
  const serverEnabled = serverReachable || serverRunning;

  async function toggleServer() {
    if (serverReachable || serverRunning) {
      await runAction('Stopping…', 'videoProbeStop');
    } else if (runtimeInstalled) {
      await runAction('Starting…', 'videoProbeStart');
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="Video Probe"
          summary="Run the probe_video agent tool against local video files. Uses Nemotron Nano Omni via mlx-vlm for on-device inference on Apple Silicon, or routes to OpenRouter for cloud inference."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {runtimeInstalled ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={serverEnabled}
                  aria-label="Enable local server"
                  disabled={Boolean(busy) || setupRunning}
                  onClick={() => void toggleServer()}
                  className="group inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-1.5 text-[12px] font-medium text-secondary transition-colors hover:bg-surface/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'relative inline-flex h-[18px] w-[32px] shrink-0 rounded-full border p-[1px] transition-all',
                      serverEnabled
                        ? 'border-accent/55 bg-accent/75 shadow-sm'
                        : 'border-border-default bg-surface/40 group-hover:bg-surface/60',
                    )}
                  >
                    <span
                      className={cx(
                        'h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
                        serverEnabled ? 'translate-x-[14px]' : 'translate-x-0',
                      )}
                    />
                  </span>
                  <span>Server</span>
                </button>
              ) : null}
              <div className="inline-flex items-center gap-2 text-sm text-secondary">
                <span className={cx('h-2 w-2 rounded-full', statusDotClass)} />
                <span className="font-medium text-primary">{statusLabel}</span>
              </div>
              <ToolbarButton onClick={() => void fetchStatus()} title="Refresh" aria-label="Refresh">
                ↻
              </ToolbarButton>
            </div>
          }
        />

        {error ? <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        {setupRunning ? (
          <div className="rounded-lg border border-border-subtle bg-surface/25 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 text-secondary">
                <span className="font-medium text-primary">Installing mlx-vlm and downloading model…</span>
                <div className="mt-1 text-xs text-dim">This may take a while — the model is ~18 GB. Check the log below for progress.</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/70" />
            </div>
          </div>
        ) : null}

        {/* Runtime section */}
        <section className="rounded-xl border border-border-subtle bg-surface p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Local Runtime</h2>
              <p className="mt-1 text-sm text-secondary">
                mlx-vlm runs Nemotron Nano Omni on Apple Silicon. Set up once; the agent auto-starts it when needed.
              </p>
            </div>
            {!runtimeInstalled || setupRunning ? (
              <ToolbarButton disabled={Boolean(busy) || setupRunning} onClick={() => void runAction('Installing…', 'videoProbeSetup')}>
                {setupRunning ? 'Installing…' : 'Set Up'}
              </ToolbarButton>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-elevated p-2">
              <div className="text-dim">Runtime</div>
              <div className="mt-1 flex items-center gap-1.5">
                {runtimeInstalled ? <Pill tone="success">Installed</Pill> : <Pill tone="warning">Not installed</Pill>}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-elevated p-2">
              <div className="text-dim">Server</div>
              <div className="mt-1">
                {serverReachable ? (
                  <Pill tone="success">Running</Pill>
                ) : serverRunning ? (
                  <Pill tone="warning">Starting</Pill>
                ) : (
                  <Pill>Stopped</Pill>
                )}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-elevated p-2">
              <div className="text-dim">Endpoint</div>
              <div className="mt-1 truncate font-mono text-primary">{status?.baseUrl ?? '…'}/v1</div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border-subtle bg-elevated p-3">
            <div className="text-xs text-dim">Model</div>
            <div className="mt-1 text-sm font-medium text-primary">{status?.modelId ?? '…'}</div>
          </div>
        </section>

        {/* Log section */}
        <section className="rounded-xl border border-border-subtle bg-surface p-5">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Runtime Logs</h2>
            <p className="mt-1 text-sm text-secondary">Live logs from setup and server. Refreshes automatically.</p>
          </div>
          <pre className="mt-5 max-h-96 overflow-auto rounded-md border border-border-subtle bg-base p-4 text-xs leading-5 text-secondary">
            {status?.log || 'No logs yet.'}
          </pre>
        </section>
      </AppPageLayout>
    </div>
  );
}
