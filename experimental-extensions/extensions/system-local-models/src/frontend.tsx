import type { ExtensionSurfaceProps, NativeExtensionClient } from '@neon-pilot/extensions';
import { cx } from '@neon-pilot/extensions/ui';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

const LocalModelsPageImpl = lazy(() => import('./page').then((module) => ({ default: module.LocalModelsPage })));

type RuntimeUpdateStatus = {
  name: string;
  installed: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  updateCheckError?: string | null;
  needsUpdate: boolean;
};

type MlxStatus = {
  selectedModelId: string;
  loadedModelId: string | null;
  installed: boolean;
  downloaded?: string;
  baseUrl?: string;
  detectedContextLength?: number | null;
  recommendedContextSize?: number;
  server: { reachable: boolean; models: string[]; error?: string };
  setup: { status: 'running' | 'succeeded' | 'failed'; message: string; progress: number; error: string | null } | null;
  process: { managedRunning: boolean; setupRunning?: boolean };
  runtime?: RuntimeUpdateStatus;
  log: string;
};

type GgufModel = { path: string; name: string; bytes: number; updatedAt: number };
type GgufStatus = {
  available: boolean;
  serverAvailable: boolean;
  cliAvailable: boolean;
  selectedModelPath: string;
  detectedContextLength?: number | null;
  recommendedContextSize?: number;
  baseUrl: string;
  message?: string;
  version?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  process: { managedRunning: boolean; managedPid: number | null };
  runtime?: RuntimeUpdateStatus;
  models: GgufModel[];
  download: {
    id: string;
    repo: string;
    filename: string;
    downloadedBytes: number;
    totalBytes: number | null;
    progress: number | null;
    status: 'running' | 'succeeded' | 'failed' | 'cancelled';
    message: string;
    error: string | null;
  } | null;
  log: string;
  enabled: boolean;
};

type Status = { mlx: MlxStatus; gguf: GgufStatus };

function LocalModelsIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cx('h-4 w-4 transition-all', active && 'drop-shadow-[0_0_7px_rgba(59,130,246,0.95)]')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5h14v9H5z" />
      <path d="M8 10h.01" />
      <path d="M11 10h.01" />
      <path d="M14 10h.01" />
      <path d="M8 14h8" />
      <path d="M9 4v3.5" />
      <path d="M15 4v3.5" />
      <path d="M9 16.5V20" />
      <path d="M15 16.5V20" />
    </svg>
  );
}

export function LocalModelsToggle({ pa }: { pa: NativeExtensionClient }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return null;
    refreshInFlightRef.current = true;
    try {
      const next = (await pa.extension.invoke('localModelsStatus', {})) as Status;
      setStatus(next);
      return next;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [pa]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const running = Boolean(status?.mlx?.server.reachable || status?.gguf?.server.reachable);
  const starting = Boolean(status?.mlx?.process.managedRunning || status?.gguf?.process.managedRunning) && !running;
  const label = running ? 'Local models are on' : starting ? 'Local models are loading' : 'Local models are off';

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const result = (await pa.extension.invoke('localModelsToggleServer', {})) as { status?: Status };
      if (result.status) setStatus(result.status);
      else await refresh();
    } catch (error) {
      pa.ui.notify({
        type: 'error',
        source: 'system-local-models',
        message: 'Local models toggle failed',
        details: error instanceof Error ? error.message : String(error),
      });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={cx(
        'ui-toolbar-button ui-desktop-top-bar__icon-button group relative transition-colors',
        running ? 'text-accent' : starting ? 'text-warning' : 'text-secondary',
      )}
      aria-label={running ? 'Stop local models' : 'Start local models'}
      aria-pressed={running}
      title={`${label} — click to ${running ? 'stop' : 'start'}`}
      disabled={busy}
      onClick={() => void toggle()}
    >
      <LocalModelsIcon active={running} />
      <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden whitespace-nowrap rounded-md bg-elevated px-2 py-1 text-xs font-medium text-primary shadow-lg ring-1 ring-border group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}

export function LocalModelsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-secondary">Loading local models…</div>}>
      <LocalModelsPageImpl {...props} />
    </Suspense>
  );
}
