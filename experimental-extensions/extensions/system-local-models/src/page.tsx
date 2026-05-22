import type { ExtensionSurfaceProps, NativeExtensionClient } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
type DownloadedModel = {
  id: string;
  title: string;
  subtitle: string;
  runtime: 'mlx' | 'gguf';
  format: 'MLX' | 'GGUF';
  size?: string;
  path?: string;
  modified?: number;
  selected: boolean;
  loaded: boolean;
};
type SearchModel = {
  id: string;
  title: string;
  downloads: number;
  likes: number;
  tags: string[];
  format: 'mlx' | 'gguf' | 'unknown';
  pipelineTag?: string;
  lastModified?: string;
};
type ModelDetails = {
  id: string;
  downloads: number;
  likes: number;
  tags: string[];
  lastModified?: string;
  files: Array<{ name: string; size?: number }>;
  readme: string;
};

type PageId = 'server' | 'library';

const MLX_BASE_URL = 'http://127.0.0.1:8011/v1';
const MAX_RENDERED_LOG_CHARS = 20_000;

function truncateLogForRender(value: string | undefined | null) {
  if (!value) return '';
  return value.length > MAX_RENDERED_LOG_CHARS
    ? `… truncated to latest ${MAX_RENDERED_LOG_CHARS} chars …\n${value.slice(-MAX_RENDERED_LOG_CHARS)}`
    : value;
}

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

  const refresh = useCallback(async () => {
    const next = (await pa.extension.invoke('localModelsStatus', {})) as Status;
    setStatus(next);
    return next;
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

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024 * 1024) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(bytes / 1024 / 1024)} MB`;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024 / 1024)} GB`;
}

function formatDate(value?: string | number) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function detectFormat(modelId: string, tags: string[] = []): 'mlx' | 'gguf' | 'unknown' {
  const lower = `${modelId} ${tags.join(' ')}`.toLowerCase();
  if (lower.includes('gguf')) return 'gguf';
  if (lower.includes('mlx')) return 'mlx';
  return 'unknown';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-secondary">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full rounded-md border border-border-subtle/60 bg-surface px-2.5 py-1.5 text-sm text-primary outline-none focus-visible:border-accent/80',
        props.className,
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        'w-full rounded-md border border-border-subtle/60 bg-surface px-2.5 py-1.5 text-sm text-primary outline-none focus-visible:border-accent/80',
        props.className,
      )}
    />
  );
}

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

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="13" cy="8" r="1.2" />
    </svg>
  );
}

type RowAction = {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

function RowActionsMenu({ label, disabled, actions }: { label: string; disabled?: boolean; actions: RowAction[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const positionMenu = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open, positionMenu]);

  const menuButtonClass =
    'w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-secondary hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={rootRef} className="relative flex justify-end" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle/70 bg-surface text-secondary hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          className="fixed z-50 w-40 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl"
          role="menu"
          style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cx(menuButtonClass, action.danger && 'text-danger hover:text-danger')}
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LocalModelsPage({ pa }: ExtensionSurfaceProps) {
  const [page, setPage] = useState<PageId>('server');
  const [status, setStatus] = useState<Status | null>(null);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState('0.7');
  const [topP, setTopP] = useState('0.95');
  const [maxTokens, setMaxTokens] = useState('1024');
  const [contextSize, setContextSize] = useState('131072');
  const [gpuLayers, setGpuLayers] = useState('999');
  const [topK, setTopK] = useState('40');
  const [minP, setMinP] = useState('0.05');
  const [repeatPenalty, setRepeatPenalty] = useState('1.1');
  const [seed, setSeed] = useState('-1');
  const [threads, setThreads] = useState('');
  const [batchSize, setBatchSize] = useState('2048');
  const [ubatchSize, setUbatchSize] = useState('512');
  const [parallel, setParallel] = useState('1');
  const [flashAttention, setFlashAttention] = useState(false);
  const [extraArgs, setExtraArgs] = useState('');
  const [mtpEnabled, setMtpEnabled] = useState(false);
  const [mtpDraftTokens, setMtpDraftTokens] = useState('6');
  const [dirty, setDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('qwen mlx');
  const [searchFormat, setSearchFormat] = useState<'all' | 'mlx' | 'gguf'>('all');
  const [searchResults, setSearchResults] = useState<SearchModel[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState<string>('');
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const contextInitKeyRef = useRef('');
  const refreshInFlightRef = useRef(false);

  async function refresh() {
    if (refreshInFlightRef.current) return status;
    refreshInFlightRef.current = true;
    setError(null);
    try {
      const next = await pa.extension.invoke<Status>('localModelsStatus', {});
      setStatus(next);
      setServerEnabled(next.gguf?.enabled !== false);
      setSelectedModelId((current) => current || next.gguf?.selectedModelPath || (next.mlx?.installed ? 'mlx:selected' : ''));
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const downloadedModels = useMemo<DownloadedModel[]>(() => {
    const models: DownloadedModel[] = [];
    if (status?.mlx?.installed) {
      models.push({
        id: 'mlx:selected',
        title: status.mlx.selectedModelId.split('/').pop() || status.mlx.selectedModelId,
        subtitle: status.mlx.selectedModelId,
        runtime: 'mlx',
        format: 'MLX',
        size: status.mlx.downloaded,
        selected: selectedModelId === 'mlx:selected',
        loaded: Boolean(status.mlx.server.reachable),
      });
    }
    for (const model of status?.gguf?.models ?? []) {
      models.push({
        id: model.path,
        title: model.name,
        subtitle: model.path,
        runtime: 'gguf',
        format: 'GGUF',
        size: formatBytes(model.bytes),
        path: model.path,
        modified: model.updatedAt,
        selected: selectedModelId === model.path,
        loaded: Boolean(status.gguf.server.reachable && status.gguf.selectedModelPath === model.path),
      });
    }
    return models;
  }, [selectedModelId, status]);

  const selectedModel = downloadedModels.find((model) => model.id === selectedModelId) ?? downloadedModels[0] ?? null;
  const activeRuntime = selectedModel?.runtime ?? (status?.gguf?.server.reachable ? 'gguf' : 'mlx');
  const running = activeRuntime === 'mlx' ? Boolean(status?.mlx?.server.reachable) : Boolean(status?.gguf?.server.reachable);
  const loading =
    activeRuntime === 'mlx'
      ? Boolean(status?.mlx?.process.managedRunning && !running)
      : Boolean(status?.gguf?.process.managedRunning && !running);
  const setupRunning = Boolean(status?.mlx?.setup);
  const runtimeStatus =
    busy ||
    (!serverEnabled
      ? 'Disabled'
      : running
        ? 'Running'
        : loading
          ? 'Loading'
          : setupRunning
            ? status?.mlx?.setup?.message || 'Downloading'
            : 'Ready');
  useEffect(() => {
    if (!status || !selectedModel) return;
    const contextInitKey = `${activeRuntime}:${selectedModel.id}`;
    if (contextInitKeyRef.current === contextInitKey) return;
    contextInitKeyRef.current = contextInitKey;
    if (activeRuntime === 'gguf') {
      const saved = status.gguf.savedServingSettings as Record<string, unknown> | undefined;
      if (saved && typeof saved === 'object') {
        if (saved.contextSize != null) setContextSize(String(saved.contextSize));
        else if (status.gguf.recommendedContextSize) setContextSize(String(status.gguf.recommendedContextSize));
        if (saved.gpuLayers != null) setGpuLayers(String(saved.gpuLayers));
        if (saved.temperature != null) setTemperature(String(saved.temperature));
        if (saved.topP != null) setTopP(String(saved.topP));
        if (saved.topK != null) setTopK(String(saved.topK));
        if (saved.minP != null) setMinP(String(saved.minP));
        if (saved.repeatPenalty != null) setRepeatPenalty(String(saved.repeatPenalty));
        if (saved.seed != null) setSeed(String(saved.seed));
        if (saved.threads != null) setThreads(String(saved.threads));
        if (saved.batchSize != null) setBatchSize(String(saved.batchSize));
        if (saved.ubatchSize != null) setUbatchSize(String(saved.ubatchSize));
        if (saved.parallel != null) setParallel(String(saved.parallel));
        if (saved.flashAttention != null) setFlashAttention(Boolean(saved.flashAttention));
        if (saved.extraArgs != null) setExtraArgs(String(saved.extraArgs));
        if (saved.specType === 'draft-mtp') setMtpEnabled(true);
        if (saved.specDraftNMax != null) setMtpDraftTokens(String(saved.specDraftNMax));
      } else if (status.gguf.recommendedContextSize) {
        setContextSize(String(status.gguf.recommendedContextSize));
      }
    } else {
      const recommended = status.mlx.recommendedContextSize;
      if (recommended) setContextSize(String(recommended));
    }
  }, [activeRuntime, selectedModel, status]);

  const ggufDownload = status?.gguf?.download?.status === 'running' ? status.gguf.download : null;
  const setupProgress = ggufDownload?.progress ?? status?.mlx?.setup?.progress ?? 0;
  const downloadMessage = ggufDownload
    ? ggufDownload.message
    : setupRunning
      ? status?.mlx?.setup?.message || 'Downloading MLX model…'
      : busy === 'Downloading…'
        ? selectedFile
          ? `Starting ${selectedFile}…`
          : 'Starting download…'
        : null;
  const downloadSubtext = ggufDownload
    ? ggufDownload.totalBytes
      ? `${formatBytes(ggufDownload.downloadedBytes)} of ${formatBytes(ggufDownload.totalBytes)}`
      : `${formatBytes(ggufDownload.downloadedBytes)} downloaded`
    : null;
  const endpoint = activeRuntime === 'mlx' ? MLX_BASE_URL : status?.gguf?.baseUrl || 'http://127.0.0.1:8012/v1';
  const detectedContext = activeRuntime === 'mlx' ? status?.mlx?.detectedContextLength : status?.gguf?.detectedContextLength;
  const recommendedContext = activeRuntime === 'mlx' ? status?.mlx?.recommendedContextSize : status?.gguf?.recommendedContextSize;
  const contextSliderMax = Math.max(detectedContext || 0, 600000);
  const contextSliderValue = Math.min(Math.max(Number(contextSize) || 0, 0), contextSliderMax);
  const selectedSearch = searchResults.find((model) => model.id === selectedSearchId) ?? null;
  const detailsFormat = details ? detectFormat(details.id, details.tags) : (selectedSearch?.format ?? 'unknown');
  const ggufFiles = details?.files.filter((file) => file.name.toLowerCase().endsWith('.gguf')) ?? [];
  const runtimeLog =
    activeRuntime === 'mlx'
      ? truncateLogForRender(status?.mlx?.log) || 'No logs yet.'
      : truncateLogForRender(status?.gguf?.log) || status?.gguf?.version || 'No logs yet.';

  function markDirty(setter: (value: string) => void, value: string) {
    setter(value);
    setDirty(true);
  }

  function markBooleanDirty(setter: (value: boolean) => void, value: boolean) {
    setter(value);
    setDirty(true);
  }

  function ggufSpeculativeSettings() {
    return mtpEnabled ? { specType: 'draft-mtp' as const, specDraftNMax: Number(mtpDraftTokens) || 6 } : { specType: 'none' as const };
  }

  function setContextFromSlider(value: string) {
    const rounded = Math.round((Number(value) || 0) / 1024) * 1024;
    setContextSize(String(Math.min(Math.max(rounded, 0), contextSliderMax)));
    setDirty(true);
  }

  async function saveAndMaybeReload(reload: boolean) {
    if (!selectedModel) return;
    await runAction(reload ? 'Reloading…' : 'Saving…', async () => {
      if (selectedModel.runtime === 'mlx') {
        await pa.extension.invoke('localModelsMlxSetModel', { modelId: selectedModel.subtitle });
        if (reload) {
          if (status?.mlx?.server.reachable) await pa.extension.invoke('localModelsMlxStop', {});
          await pa.extension.invoke('localModelsMlxStart', { maxTokens: Number(maxTokens) });
        }
      } else if (selectedModel.path) {
        await pa.extension.invoke('localModelsGgufSetModel', { modelPath: selectedModel.path });
        await pa.extension.invoke('localModelsGgufSaveSettings', {
          contextSize: Number(contextSize),
          gpuLayers: Number(gpuLayers),
          temperature: Number(temperature),
          topP: Number(topP),
          topK: Number(topK),
          minP: Number(minP),
          repeatPenalty: Number(repeatPenalty),
          seed: Number(seed),
          threads: Number(threads),
          batchSize: Number(batchSize),
          ubatchSize: Number(ubatchSize),
          parallel: Number(parallel),
          flashAttention,
          extraArgs,
          ...ggufSpeculativeSettings(),
        });
        if (reload) {
          if (status?.gguf?.server.reachable) await pa.extension.invoke('localModelsGgufStop', {});
          await pa.extension.invoke('localModelsGgufStart', {
            modelPath: selectedModel.path,
            contextSize: Number(contextSize),
            gpuLayers: Number(gpuLayers),
            temperature: Number(temperature),
            topP: Number(topP),
            topK: Number(topK),
            minP: Number(minP),
            repeatPenalty: Number(repeatPenalty),
            seed: Number(seed),
            threads: Number(threads),
            batchSize: Number(batchSize),
            ubatchSize: Number(ubatchSize),
            parallel: Number(parallel),
            flashAttention,
            extraArgs,
            ...ggufSpeculativeSettings(),
          });
        }
      }
      setDirty(false);
    });
  }

  async function toggleServerEnabled(enabled: boolean) {
    setServerEnabled(enabled);
    try {
      await pa.extension.invoke('localModelsGgufSetServerEnabled', { enabled });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setServerEnabled(!enabled);
    }
  }

  async function stopServer() {
    await runAction('Stopping…', async () => {
      if (activeRuntime === 'mlx') {
        await pa.extension.invoke('localModelsMlxStop', {});
      } else {
        await pa.extension.invoke('localModelsGgufStop', {});
      }
    });
  }

  async function installGgufRuntime(force = false) {
    await runAction(force ? 'Updating llama.cpp…' : 'Installing runtime…', async () => {
      await pa.extension.invoke('localModelsGgufInstallRuntime', { force });
    });
  }

  async function updateMlxRuntime() {
    await runAction('Updating MLX…', async () => {
      await pa.extension.invoke('localModelsMlxUpdateRuntime', {});
    });
  }

  function runtimeBadge(runtime?: RuntimeUpdateStatus) {
    if (!runtime?.installed) return <Pill tone="warning">Not installed</Pill>;
    if (runtime.needsUpdate) return <Pill tone="warning">Update available</Pill>;
    if (runtime.updateCheckError) return <Pill>Check failed</Pill>;
    return <Pill tone="success">Installed</Pill>;
  }

  async function cancelDownload() {
    await runAction('Cancelling…', async () => {
      if (ggufDownload) await pa.extension.invoke('localModelsGgufCancelDownload', {});
      else if (setupRunning) await pa.extension.invoke('localModelsMlxStop', {});
    });
  }

  async function deleteDownloadedModel(model: DownloadedModel) {
    const confirmed = window.confirm(`Delete ${model.title} from local disk? This cannot be undone.`);
    if (!confirmed) return;
    await runAction('Deleting…', async () => {
      if (model.loaded) {
        if (model.runtime === 'mlx') await pa.extension.invoke('localModelsMlxStop', {});
        else await pa.extension.invoke('localModelsGgufStop', {});
      }
      if (model.runtime === 'mlx') await pa.extension.invoke('localModelsMlxDelete', { modelId: model.subtitle });
      else await pa.extension.invoke('localModelsGgufDelete', { modelPath: model.path });
      if (selectedModelId === model.id) setSelectedModelId('');
    });
  }

  async function searchModels() {
    await runAction('Searching…', async () => {
      const result = await pa.extension.invoke<{ models: SearchModel[] }>('localModelsSearch', {
        query: searchQuery,
        format: searchFormat,
        limit: 25,
      });
      setSearchResults(result.models ?? []);
      setSelectedSearchId(result.models?.[0]?.id ?? '');
      setDetails(null);
      setSelectedFile('');
    });
  }

  async function loadDetails(modelId: string) {
    setSelectedSearchId(modelId);
    setSelectedFile('');
    await runAction('Loading details…', async () => {
      const result = await pa.extension.invoke<{ model: ModelDetails }>('localModelsModelDetails', { modelId });
      setDetails(result.model);
      const firstGguf = result.model.files.find((file) => file.name.toLowerCase().endsWith('.gguf'));
      setSelectedFile(firstGguf?.name ?? '');
    });
  }

  async function selectSearchModel(modelId: string) {
    setSelectedSearchId(modelId);
    setSelectedFile('');
    setDetails(null);
    const model = searchResults.find((candidate) => candidate.id === modelId);
    if (model?.format === 'gguf') {
      await loadDetails(modelId);
    }
  }

  async function downloadSelectedModel() {
    const model =
      details ?? (selectedSearch ? { id: selectedSearch.id, tags: selectedSearch.tags, files: [] as Array<{ name: string }> } : null);
    if (!model) return;
    const format = detectFormat(model.id, model.tags);
    if (format === 'gguf') {
      if (!selectedFile) {
        setError('Choose a GGUF file to download.');
        return;
      }
      await runAction('Downloading…', async () => {
        await pa.extension.invoke('localModelsGgufDownload', { repo: model.id, filename: selectedFile });
        setPage('server');
      });
      return;
    }
    if (format !== 'mlx') {
      setError('This model does not advertise MLX or GGUF files. Open Details and choose a compatible file/model.');
      return;
    }
    await downloadMlxModel(model.id);
  }

  async function downloadMlxModel(modelId: string) {
    await runAction('Downloading…', async () => {
      await pa.extension.invoke('localModelsMlxSetup', { modelId });
      setSelectedModelId('mlx:selected');
      setPage('server');
    });
  }

  const libraryRail = (
    <aside className="w-80 shrink-0 border-l border-border-subtle pl-4">
      <div className="sticky top-4 space-y-4">
        <h3 className="font-semibold text-primary">Model Details</h3>
        {selectedSearch ? (
          <div className="space-y-4 text-sm text-secondary">
            <div>
              <div className="font-medium text-primary">{selectedSearch.id}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Pill tone={selectedSearch.format === 'gguf' ? 'accent' : selectedSearch.format === 'mlx' ? 'success' : 'muted'}>
                  {selectedSearch.format.toUpperCase()}
                </Pill>
                <Pill>{selectedSearch.downloads.toLocaleString()} downloads</Pill>
                <Pill>{selectedSearch.likes.toLocaleString()} likes</Pill>
              </div>
            </div>
            <div className="flex gap-2">
              <ToolbarButton
                disabled={Boolean(busy || (selectedSearch.format === 'gguf' && !selectedFile))}
                onClick={() => void downloadSelectedModel()}
              >
                Download
              </ToolbarButton>
              <a href={`https://huggingface.co/${selectedSearch.id}`} target="_blank" rel="noreferrer" className="ui-toolbar-button">
                Hugging Face ↗
              </a>
            </div>
            {details ? (
              <>
                {detailsFormat === 'gguf' ? (
                  <Field label="GGUF file">
                    <Select value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)}>
                      <option value="">Choose a file…</option>
                      {ggufFiles.map((file) => (
                        <option key={file.name} value={file.name}>
                          {file.name} {file.size ? `(${formatBytes(file.size)})` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </>
            ) : (
              <div className="rounded-md border border-border-subtle bg-elevated p-3 text-xs leading-5 text-secondary">
                {selectedSearch.format === 'gguf'
                  ? 'Selecting a GGUF model loads its file list automatically.'
                  : 'MLX models can download directly. Use the Hugging Face link for full model details.'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-secondary">Select a search result to inspect it here.</div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="Local Models"
          summary="Manage downloaded local models separately from the server that runs them. Acquisition over here; serving over there. Sanity restored."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={serverEnabled}
                aria-label="Enable local model server"
                onClick={() => void toggleServerEnabled(!serverEnabled)}
                className="group inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-1.5 text-[12px] font-medium text-secondary transition-colors hover:bg-surface/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
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
              <div className="inline-flex items-center gap-2 text-sm text-secondary">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    !serverEnabled ? 'bg-dim' : running ? 'bg-success' : setupRunning ? 'bg-warning' : 'bg-dim',
                  )}
                />
                <span className="font-medium text-primary">{runtimeStatus}</span>
              </div>
              <ToolbarButton type="button" onClick={() => void refresh()} aria-label="Refresh local models" title="Refresh local models">
                ↻
              </ToolbarButton>
            </div>
          }
        />

        {downloadMessage ? (
          <div className="rounded-lg border border-border-subtle bg-surface/25 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 text-secondary">
                <span className="font-medium text-primary">{downloadMessage}</span>
                {setupProgress ? <span className="ml-2 text-dim">{setupProgress}%</span> : null}
                {downloadSubtext ? <div className="mt-1 text-xs text-dim">{downloadSubtext}</div> : null}
              </div>
              <ToolbarButton disabled={Boolean(busy === 'Cancelling…')} onClick={() => void cancelDownload()}>
                Stop Download
              </ToolbarButton>
            </div>
            {setupRunning || ggufDownload?.progress !== null ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, setupProgress || 2)}%` }} />
              </div>
            ) : (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-accent/70" />
              </div>
            )}
          </div>
        ) : null}

        {error ? <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        <div className="flex flex-wrap items-center gap-1 border-b border-border-subtle/70 pb-5 text-[12px]">
          {[
            ['server', 'Server'],
            ['library', 'Library'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id as PageId)}
              className={cx(
                'rounded-xl px-3 py-2 font-medium transition-colors',
                page === id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:bg-surface/60 hover:text-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-5">
          {page === 'server' ? (
            <>
              <main className="min-w-0 flex-1 space-y-5">
                <section className="rounded-xl border border-border-subtle bg-surface p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Model Settings</h2>
                      <p className="mt-1 text-sm text-secondary">Choose which downloaded model the server should use.</p>
                    </div>
                    <ToolbarButton disabled={Boolean(busy || !selectedModel || !dirty)} onClick={() => void saveAndMaybeReload(false)}>
                      Save
                    </ToolbarButton>
                  </div>

                  {selectedModel ? (
                    <div className="mt-5 grid gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-md border border-border-subtle bg-elevated p-2">
                        <div className="text-dim">Selected</div>
                        <div className="mt-1 truncate text-primary">{selectedModel.title}</div>
                      </div>
                      <div className="rounded-md border border-border-subtle bg-elevated p-2">
                        <div className="text-dim">Format</div>
                        <div className="mt-1 text-primary">{selectedModel.format}</div>
                      </div>
                      <div className="rounded-md border border-border-subtle bg-elevated p-2">
                        <div className="text-dim">Size</div>
                        <div className="mt-1 text-primary">{selectedModel.size || '—'}</div>
                      </div>
                      <div className="rounded-md border border-border-subtle bg-elevated p-2">
                        <div className="text-dim">Loaded</div>
                        <div className="mt-1 text-primary">{selectedModel.loaded ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 text-sm text-secondary">No downloaded model selected.</div>
                  )}

                  <div className="mt-4 overflow-x-auto rounded-lg border border-border-subtle/50 bg-background/15">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface/50 text-xs uppercase tracking-[0.12em] text-dim">
                        <tr>
                          <th className="px-3 py-2 font-medium">Model</th>
                          <th className="px-3 py-2 font-medium">Format</th>
                          <th className="px-3 py-2 font-medium">Size</th>
                          <th className="px-3 py-2 font-medium">State</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downloadedModels.map((model) => (
                          <tr
                            key={model.id}
                            className={cx(
                              'cursor-pointer border-t border-border-subtle hover:bg-surface/50',
                              model.selected && 'bg-accent/10',
                            )}
                            onClick={() => {
                              setSelectedModelId(model.id);
                              setDirty(true);
                            }}
                          >
                            <td className="min-w-0 px-3 py-3">
                              <div className="truncate font-medium text-primary">{model.title}</div>
                              <div className="mt-0.5 truncate text-xs text-secondary">{model.subtitle}</div>
                            </td>
                            <td className="px-3 py-3">
                              <Pill tone={model.runtime === 'mlx' ? 'success' : 'accent'}>{model.format}</Pill>
                            </td>
                            <td className="px-3 py-3 text-secondary">{model.size || '—'}</td>
                            <td className="px-3 py-3">
                              {model.selected ? (
                                <span className="inline-flex items-center gap-1 text-accent">✓ Selected</span>
                              ) : model.loaded ? (
                                <Pill tone="success">Loaded</Pill>
                              ) : (
                                <Pill>Ready</Pill>
                              )}
                            </td>
                            <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                              <div className="flex gap-2">
                                {model.path ? (
                                  <ToolbarButton
                                    onClick={() => void pa.extension.invoke('localModelsGgufReveal', { modelPath: model.path })}
                                  >
                                    Reveal in Finder
                                  </ToolbarButton>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() => void deleteDownloadedModel(model)}
                                  className="rounded-lg border border-danger/50 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!downloadedModels.length ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-10 text-center text-secondary">
                              No downloaded models yet. Go to Library to download one.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-border-subtle bg-surface p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-primary">Serving Settings</h2>
                      <p className="mt-0.5 text-xs text-secondary">Tune runtime parameters, then start or reload the server.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ToolbarButton disabled={Boolean(busy || !selectedModel || !dirty)} onClick={() => void saveAndMaybeReload(false)}>
                        Save
                      </ToolbarButton>
                      <ToolbarButton disabled={Boolean(busy || !selectedModel)} onClick={() => void saveAndMaybeReload(true)}>
                        {running ? 'Save & Reload' : 'Start Server'}
                      </ToolbarButton>
                      <ToolbarButton disabled={Boolean(busy || !running)} onClick={() => void stopServer()}>
                        Stop
                      </ToolbarButton>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Context length">
                      <TextInput value={contextSize} onChange={(event) => markDirty(setContextSize, event.target.value)} />
                      <input
                        type="range"
                        min={0}
                        max={contextSliderMax}
                        step={1024}
                        value={contextSliderValue}
                        onChange={(event) => setContextFromSlider(event.target.value)}
                        className="mt-2 w-full accent-accent"
                        aria-label="Context length slider"
                      />
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-tertiary">
                        <span>0</span>
                        <span>
                          {detectedContext
                            ? `Detected max ${detectedContext.toLocaleString()}; recommended ${recommendedContext?.toLocaleString() ?? '—'}`
                            : `Recommended ${recommendedContext?.toLocaleString() ?? '—'}`}
                        </span>
                        <span>{contextSliderMax.toLocaleString()}</span>
                      </div>
                    </Field>
                    <Field label="GPU layers">
                      <TextInput value={gpuLayers} onChange={(event) => markDirty(setGpuLayers, event.target.value)} />
                    </Field>
                    <Field label="Temperature">
                      <TextInput value={temperature} onChange={(event) => markDirty(setTemperature, event.target.value)} />
                    </Field>
                    <Field label="Top P">
                      <TextInput value={topP} onChange={(event) => markDirty(setTopP, event.target.value)} />
                    </Field>
                    <Field label="Max tokens">
                      <TextInput value={maxTokens} onChange={(event) => markDirty(setMaxTokens, event.target.value)} />
                    </Field>
                    <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                      <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-start gap-3 text-sm text-secondary">
                          <input
                            type="checkbox"
                            checked={mtpEnabled}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markBooleanDirty(setMtpEnabled, event.target.checked)}
                            className="mt-1 accent-accent"
                          />
                          <span>
                            <span className="block font-medium text-primary">Qwen MTP speculative decoding</span>
                            <span className="mt-1 block text-xs text-secondary">
                              Adds llama.cpp <span className="font-mono">--spec-type draft-mtp</span>. Use with MTP GGUF models.
                            </span>
                          </span>
                        </label>
                        <div className="w-full sm:w-36">
                          <div className="mb-1 text-xs text-secondary">Draft tokens</div>
                          <TextInput
                            value={mtpDraftTokens}
                            disabled={activeRuntime !== 'gguf' || !mtpEnabled}
                            onChange={(event) => markDirty(setMtpDraftTokens, event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <details className="sm:col-span-2 lg:col-span-4">
                      <summary className="cursor-pointer rounded-lg bg-surface/45 px-3 py-2 text-sm font-medium text-primary hover:bg-surface/70">
                        Advanced runtime options
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Top K">
                          <TextInput
                            value={topK}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setTopK, event.target.value)}
                          />
                        </Field>
                        <Field label="Min P">
                          <TextInput
                            value={minP}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setMinP, event.target.value)}
                          />
                        </Field>
                        <Field label="Repeat penalty">
                          <TextInput
                            value={repeatPenalty}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setRepeatPenalty, event.target.value)}
                          />
                        </Field>
                        <Field label="Seed">
                          <TextInput
                            value={seed}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setSeed, event.target.value)}
                          />
                        </Field>
                        <Field label="Threads">
                          <TextInput
                            value={threads}
                            disabled={activeRuntime !== 'gguf'}
                            placeholder="auto"
                            onChange={(event) => markDirty(setThreads, event.target.value)}
                          />
                        </Field>
                        <Field label="Batch size">
                          <TextInput
                            value={batchSize}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setBatchSize, event.target.value)}
                          />
                        </Field>
                        <Field label="Micro batch">
                          <TextInput
                            value={ubatchSize}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setUbatchSize, event.target.value)}
                          />
                        </Field>
                        <Field label="Parallel slots">
                          <TextInput
                            value={parallel}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markDirty(setParallel, event.target.value)}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-secondary">
                          <input
                            type="checkbox"
                            checked={flashAttention}
                            disabled={activeRuntime !== 'gguf'}
                            onChange={(event) => markBooleanDirty(setFlashAttention, event.target.checked)}
                            className="accent-accent"
                          />
                          Flash attention
                        </label>
                        <Field label="Extra llama.cpp args">
                          <TextInput
                            value={extraArgs}
                            disabled={activeRuntime !== 'gguf'}
                            placeholder="--cache-type-k q8_0 --cache-type-v q8_0"
                            onChange={(event) => markDirty(setExtraArgs, event.target.value)}
                          />
                        </Field>
                      </div>
                    </details>
                    <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                      <div className="rounded-md border border-border-subtle bg-elevated p-3">
                        <div className="mb-3 text-sm font-medium text-primary">Supported backends</div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle/50 p-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                MLX <span>{runtimeBadge(status?.mlx?.runtime)}</span>
                              </div>
                              <div className="mt-1 text-xs text-secondary">
                                Installed: {status?.mlx?.runtime?.installedVersion ?? '—'} · Latest:{' '}
                                {status?.mlx?.runtime?.latestVersion ?? (status?.mlx?.runtime?.updateCheckError ? 'check failed' : '—')}
                              </div>
                            </div>
                            <ToolbarButton disabled={Boolean(busy)} onClick={() => void updateMlxRuntime()}>
                              {status?.mlx?.runtime?.installed ? 'Update' : 'Install'}
                            </ToolbarButton>
                          </div>
                          <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle/50 p-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                llama.cpp <span>{runtimeBadge(status?.gguf?.runtime)}</span>
                              </div>
                              <div className="mt-1 text-xs text-secondary">
                                Installed: {status?.gguf?.runtime?.installedVersion ?? '—'} · Latest:{' '}
                                {status?.gguf?.runtime?.latestVersion ?? (status?.gguf?.runtime?.updateCheckError ? 'check failed' : '—')}
                              </div>
                            </div>
                            <ToolbarButton
                              disabled={Boolean(busy)}
                              onClick={() => void installGgufRuntime(Boolean(status?.gguf?.runtime?.installed))}
                            >
                              {status?.gguf?.runtime?.installed ? 'Update' : 'Install'}
                            </ToolbarButton>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-secondary">Endpoint</div>
                        <div className="rounded-md border border-border-subtle bg-elevated p-2 font-mono text-xs text-primary">
                          {endpoint}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border-subtle bg-surface p-5">
                  <div>
                    <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Runtime Logs</h2>
                    <p className="mt-1 text-sm text-secondary">Live runtime logs refresh automatically.</p>
                  </div>
                  <pre className="mt-5 max-h-96 overflow-auto rounded-md border border-border-subtle bg-base p-4 text-xs leading-5 text-secondary">
                    {runtimeLog}
                  </pre>
                </section>
              </main>
            </>
          ) : (
            <>
              <main className="min-w-0 flex-1 space-y-5">
                <section className="rounded-xl border border-border-subtle bg-surface p-5">
                  <div>
                    <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Model Library</h2>
                    <p className="mt-1 text-sm text-secondary">
                      Search Hugging Face for MLX or GGUF models, inspect details, and download them locally.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_8rem_auto]">
                      <TextInput
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void searchModels();
                        }}
                        placeholder="Search models by name, author, or family…"
                        className="min-w-0"
                      />
                      <Select value={searchFormat} onChange={(event) => setSearchFormat(event.target.value as 'all' | 'mlx' | 'gguf')}>
                        <option value="all">All</option>
                        <option value="mlx">MLX</option>
                        <option value="gguf">GGUF</option>
                      </Select>
                      <ToolbarButton disabled={Boolean(busy)} onClick={() => void searchModels()}>
                        Search
                      </ToolbarButton>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-lg border border-border-subtle/50 bg-background/15">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="bg-surface/50 text-xs uppercase tracking-[0.12em] text-dim">
                        <tr>
                          <th className="w-[52%] px-3 py-2 font-medium">Model</th>
                          <th className="w-24 px-3 py-2 font-medium">Format</th>
                          <th className="w-28 px-3 py-2 font-medium">Downloads</th>
                          <th className="hidden w-20 px-3 py-2 font-medium 2xl:table-cell">Likes</th>
                          <th className="hidden w-28 px-3 py-2 font-medium 2xl:table-cell">Updated</th>
                          <th className="w-36 px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((model) => (
                          <tr
                            key={model.id}
                            className={cx(
                              'border-t border-border-subtle hover:bg-surface/50',
                              model.id === selectedSearchId && 'bg-accent/10',
                            )}
                            onClick={() => void selectSearchModel(model.id)}
                          >
                            <td className="min-w-0 px-3 py-3">
                              <div className="truncate font-medium text-primary">{model.id}</div>
                              <div className="mt-0.5 truncate text-xs text-secondary">
                                {model.pipelineTag || model.tags.slice(0, 3).join(' · ') || 'model'}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Pill tone={model.format === 'gguf' ? 'accent' : model.format === 'mlx' ? 'success' : 'muted'}>
                                {model.format.toUpperCase()}
                              </Pill>
                            </td>
                            <td className="px-3 py-3 text-secondary">{model.downloads.toLocaleString()}</td>
                            <td className="hidden px-3 py-3 text-secondary 2xl:table-cell">{model.likes.toLocaleString()}</td>
                            <td className="hidden px-3 py-3 text-secondary 2xl:table-cell">{formatDate(model.lastModified)}</td>
                            <td className="px-3 py-3">
                              <RowActionsMenu
                                label={`More actions for ${model.id}`}
                                actions={[
                                  { label: 'Select', onClick: () => void selectSearchModel(model.id) },
                                  {
                                    label: 'Download',
                                    disabled: model.format === 'unknown',
                                    onClick: () => {
                                      void selectSearchModel(model.id).then(() => {
                                        if (model.format === 'mlx') void downloadMlxModel(model.id);
                                      });
                                    },
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        ))}
                        {!searchResults.length ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-12 text-center text-secondary">
                              Search Hugging Face to find MLX and GGUF models.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-border-subtle bg-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-primary">Downloaded Models</h2>
                      <p className="mt-1 text-sm text-secondary">Models already available to the server page.</p>
                    </div>
                    <ToolbarButton onClick={() => void refresh()}>Refresh</ToolbarButton>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-lg border border-border-subtle/50 bg-background/15">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface/50 text-xs uppercase tracking-[0.12em] text-dim">
                        <tr>
                          <th className="px-3 py-2 font-medium">Model</th>
                          <th className="px-3 py-2 font-medium">Format</th>
                          <th className="px-3 py-2 font-medium">Size</th>
                          <th className="px-3 py-2 font-medium">Modified</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downloadedModels.map((model) => (
                          <tr key={model.id} className="border-t border-border-subtle">
                            <td className="min-w-0 px-3 py-3">
                              <div className="truncate font-medium text-primary">{model.title}</div>
                              <div className="mt-0.5 truncate text-xs text-secondary">{model.subtitle}</div>
                            </td>
                            <td className="px-3 py-3">
                              <Pill tone={model.runtime === 'mlx' ? 'success' : 'accent'}>{model.format}</Pill>
                            </td>
                            <td className="px-3 py-3 text-secondary">{model.size || '—'}</td>
                            <td className="px-3 py-3 text-secondary">{formatDate(model.modified)}</td>
                            <td className="px-3 py-3">
                              <RowActionsMenu
                                label={`More actions for ${model.title}`}
                                disabled={Boolean(busy)}
                                actions={[
                                  {
                                    label: 'Use on Server',
                                    onClick: () => {
                                      setSelectedModelId(model.id);
                                      setPage('server');
                                      setDirty(true);
                                    },
                                  },
                                  ...(model.path
                                    ? [
                                        {
                                          label: 'Reveal',
                                          onClick: () => void pa.extension.invoke('localModelsGgufReveal', { modelPath: model.path }),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: 'Delete',
                                    danger: true,
                                    disabled: Boolean(busy),
                                    onClick: () => void deleteDownloadedModel(model),
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        ))}
                        {!downloadedModels.length ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-10 text-center text-secondary">
                              No downloaded models yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </main>
              {libraryRail}
            </>
          )}
        </div>
      </AppPageLayout>
    </div>
  );
}

export default LocalModelsPage;
