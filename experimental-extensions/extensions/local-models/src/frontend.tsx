import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, cx, ToolbarButton } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type MlxStatus = {
  selectedModelId: string;
  loadedModelId: string | null;
  installed: boolean;
  downloaded?: string;
  baseUrl?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  setup: { status: 'running' | 'succeeded' | 'failed'; message: string; progress: number; error: string | null } | null;
  process: { managedRunning: boolean; setupRunning?: boolean };
  log: string;
};

type GgufModel = { path: string; name: string; bytes: number; updatedAt: number };
type GgufStatus = {
  available: boolean;
  serverAvailable: boolean;
  selectedModelPath: string;
  baseUrl: string;
  message?: string;
  version?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  process: { managedRunning: boolean; managedPid: number | null };
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
type LogTab = 'chat' | 'logs';

const MLX_BASE_URL = 'http://127.0.0.1:8011/v1';
const GGUF_PROVIDER_ID = 'llama-cpp-local';
const MLX_PROVIDER_ID = 'mlx-local';

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

function readableReadme(raw: string) {
  return raw
    .replace(/^---[\s\S]*?---/, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function tryRegisterProvider(runtime: 'mlx' | 'gguf', modelId: string, baseUrl: string) {
  const provider = runtime === 'mlx' ? MLX_PROVIDER_ID : GGUF_PROVIDER_ID;
  try {
    await postJson('/api/model-providers/providers', {
      provider,
      api: 'openai-completions',
      baseUrl,
      apiKey: 'local',
      authHeader: false,
      compat: { stream: true },
    });
    await postJson(`/api/model-providers/providers/${encodeURIComponent(provider)}/models`, {
      modelId,
      name: modelId.split('/').pop() || modelId,
      api: 'openai-completions',
      baseUrl,
      reasoning: true,
      input: ['text'],
      contextWindow: runtime === 'mlx' ? 131072 : 8192,
    });
  } catch {
    // Preview/testing contexts may not expose provider APIs.
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full rounded-lg border border-border-subtle/60 bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent/80',
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
        'w-full rounded-lg border border-border-subtle/60 bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent/80',
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

export function LocalModelsPage({ pa }: ExtensionSurfaceProps) {
  const [page, setPage] = useState<PageId>('server');
  const [status, setStatus] = useState<Status | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState('0.7');
  const [topP, setTopP] = useState('0.95');
  const [maxTokens, setMaxTokens] = useState('1024');
  const [contextSize, setContextSize] = useState('8192');
  const [gpuLayers, setGpuLayers] = useState('999');
  const [dirty, setDirty] = useState(false);
  const [logTab, setLogTab] = useState<LogTab>('chat');
  const [prompt, setPrompt] = useState('Write a tiny TypeScript function that reverses a string.');
  const [output, setOutput] = useState('');
  const [searchQuery, setSearchQuery] = useState('qwen mlx');
  const [searchFormat, setSearchFormat] = useState<'all' | 'mlx' | 'gguf'>('all');
  const [searchResults, setSearchResults] = useState<SearchModel[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState<string>('');
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState('');

  async function refresh() {
    setError(null);
    try {
      const next = await pa.extension.invoke<Status>('localModelsStatus', {});
      setStatus(next);
      setSelectedModelId((current) => current || next.gguf?.selectedModelPath || (next.mlx?.installed ? 'mlx:selected' : ''));
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
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
      if (label === 'Running…') setOutput(message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
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
    busy || (running ? 'Running' : loading ? 'Loading' : setupRunning ? status?.mlx?.setup?.message || 'Downloading' : 'Ready');
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
  const selectedSearch = searchResults.find((model) => model.id === selectedSearchId) ?? null;
  const detailsFormat = details ? detectFormat(details.id, details.tags) : (selectedSearch?.format ?? 'unknown');
  const ggufFiles = details?.files.filter((file) => file.name.toLowerCase().endsWith('.gguf')) ?? [];

  function markDirty(setter: (value: string) => void, value: string) {
    setter(value);
    setDirty(true);
  }

  async function saveAndMaybeReload(reload: boolean) {
    if (!selectedModel) return;
    await runAction(reload ? 'Reloading…' : 'Saving…', async () => {
      if (selectedModel.runtime === 'mlx') {
        await pa.extension.invoke('localModelsMlxSetModel', { modelId: selectedModel.subtitle });
        if (reload) {
          if (status?.mlx?.server.reachable) await pa.extension.invoke('localModelsMlxStop', {});
          await pa.extension.invoke('localModelsMlxStart', {});
          await tryRegisterProvider('mlx', selectedModel.subtitle, MLX_BASE_URL);
        }
      } else if (selectedModel.path) {
        await pa.extension.invoke('localModelsGgufSetModel', { modelPath: selectedModel.path });
        if (reload) {
          if (status?.gguf?.server.reachable) await pa.extension.invoke('localModelsGgufStop', {});
          await pa.extension.invoke('localModelsGgufStart', {
            modelPath: selectedModel.path,
            contextSize: Number(contextSize),
            gpuLayers: Number(gpuLayers),
          });
          await tryRegisterProvider('gguf', selectedModel.title, status?.gguf?.baseUrl || endpoint);
        }
      }
      setDirty(false);
    });
  }

  async function stopServer() {
    await runAction('Stopping…', async () => {
      if (activeRuntime === 'mlx') await pa.extension.invoke('localModelsMlxStop', {});
      else await pa.extension.invoke('localModelsGgufStop', {});
    });
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

  async function runPrompt() {
    if (!selectedModel) return;
    await runAction('Running…', async () => {
      setOutput('');
      if (selectedModel.runtime === 'gguf') {
        const result = await pa.extension.invoke<{ output: string }>('localModelsGgufRunPrompt', {
          modelPath: selectedModel.path,
          prompt,
          contextSize: Number(contextSize),
          gpuLayers: Number(gpuLayers),
        });
        setOutput(result.output);
        return;
      }
      const response = await fetch(`${MLX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
        body: JSON.stringify({
          model: status?.mlx?.loadedModelId || selectedModel.subtitle,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: Number(temperature),
          top_p: Number(topP),
          max_tokens: Number(maxTokens),
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      setOutput(body.choices?.[0]?.message?.content || JSON.stringify(body, null, 2));
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

  const serverRail = (
    <aside className="w-72 shrink-0 border-l border-border-subtle pl-4">
      <div className="sticky top-4 space-y-5">
        <section className="space-y-3">
          <h3 className="font-semibold text-primary">Selected Model</h3>
          {selectedModel ? (
            <div className="space-y-3 text-sm text-secondary">
              <div>
                <div className="font-medium text-primary">{selectedModel.title}</div>
                <div className="mt-1 break-all text-xs text-dim">{selectedModel.subtitle}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface/50 p-2">
                  <div className="text-dim">Format</div>
                  <div className="mt-1 text-primary">{selectedModel.format}</div>
                </div>
                <div className="rounded-lg bg-surface/50 p-2">
                  <div className="text-dim">Size</div>
                  <div className="mt-1 text-primary">{selectedModel.size || '—'}</div>
                </div>
                <div className="rounded-lg bg-surface/50 p-2">
                  <div className="text-dim">Server</div>
                  <div className={cx('mt-1', running ? 'text-success' : 'text-warning')}>{running ? 'Running' : 'Stopped'}</div>
                </div>
                <div className="rounded-lg bg-surface/50 p-2">
                  <div className="text-dim">Loaded</div>
                  <div className="mt-1 text-primary">{selectedModel.loaded ? 'Yes' : 'No'}</div>
                </div>
              </div>
              {selectedModel.path ? (
                <ToolbarButton onClick={() => void pa.extension.invoke('localModelsGgufReveal', { modelPath: selectedModel.path })}>
                  Reveal in Finder
                </ToolbarButton>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-secondary">No downloaded model selected.</div>
          )}
        </section>
        <section className="space-y-2 text-sm text-secondary">
          <h3 className="font-semibold text-primary">Endpoint</h3>
          <div className="rounded-lg bg-surface/50 p-2 font-mono text-xs text-primary">{endpoint}</div>
        </section>
      </div>
    </aside>
  );

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
              <ToolbarButton onClick={() => void loadDetails(selectedSearch.id)}>Refresh Details</ToolbarButton>
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
                <div className="max-h-[34rem] overflow-auto rounded-lg bg-surface/45 p-4 text-[13px] leading-6 text-secondary">
                  <pre className="whitespace-pre-wrap font-sans">
                    {details.readme ? readableReadme(details.readme).slice(0, 6000) : 'No README preview available.'}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-surface/45 p-3 text-xs leading-5 text-secondary">
                {selectedSearch.format === 'gguf'
                  ? 'Loading details finds the downloadable GGUF files.'
                  : 'README preview loads on demand; MLX models can download directly.'}
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
      <AppPageLayout shellClassName="max-w-[112rem]" contentClassName="space-y-6">
        <AppPageIntro
          title="Local Models"
          summary="Manage downloaded local models separately from the server that runs them. Acquisition over here; serving over there. Sanity restored."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 text-sm text-secondary">
                <span className={cx('h-2 w-2 rounded-full', running ? 'bg-success' : setupRunning ? 'bg-warning' : 'bg-dim')} />
                <span className="font-medium text-primary">{runtimeStatus}</span>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="text-secondary hover:text-primary"
                aria-label="Refresh local models"
                title="Refresh"
              >
                ↻
              </button>
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

        <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
          {[
            ['server', 'Server'],
            ['library', 'Library'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id as PageId)}
              className={cx(
                'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                page === id ? 'bg-accent/15 text-primary' : 'text-secondary hover:bg-surface/70 hover:text-primary',
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
                <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-primary">Server</h2>
                      <p className="mt-1 text-sm text-secondary">Select a downloaded model, tune serving settings, then save and reload.</p>
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

                  <div className="mt-5 space-y-5">
                    <div className="space-y-3 lg:col-span-2">
                      <h3 className="font-semibold text-primary">Downloaded Models</h3>
                      <div className="overflow-x-auto rounded-lg border border-border-subtle/50 bg-background/15">
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
                                  {model.loaded ? (
                                    <Pill tone="success">Loaded</Pill>
                                  ) : model.selected ? (
                                    <Pill tone="warning">Selected</Pill>
                                  ) : (
                                    <Pill>Ready</Pill>
                                  )}
                                </td>
                                <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                                  <ToolbarButton disabled={Boolean(busy)} onClick={() => void deleteDownloadedModel(model)}>
                                    Delete
                                  </ToolbarButton>
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
                    </div>

                    <div className="space-y-4 lg:col-span-2">
                      <h3 className="font-semibold text-primary">Serving Settings</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Context length">
                          <TextInput value={contextSize} onChange={(event) => markDirty(setContextSize, event.target.value)} />
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
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-primary">Testing & Logs</h2>
                      <p className="mt-1 text-sm text-secondary">Smoke-test the server with a chat prompt, or inspect runtime logs.</p>
                    </div>
                    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border-subtle/50 text-sm">
                      <button
                        type="button"
                        className={cx('px-3 py-2', logTab === 'chat' ? 'bg-accent/15 text-primary' : 'text-secondary')}
                        onClick={() => setLogTab('chat')}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        className={cx('px-3 py-2', logTab === 'logs' ? 'bg-accent/15 text-primary' : 'text-secondary')}
                        onClick={() => setLogTab('logs')}
                      >
                        Logs
                      </button>
                    </div>
                  </div>

                  {logTab === 'chat' ? (
                    <div className="mt-5 space-y-3">
                      <div className="min-h-52 rounded-lg bg-background/20 p-4">
                        {output ? (
                          <pre className="whitespace-pre-wrap text-sm leading-6 text-primary">{output}</pre>
                        ) : (
                          <div className="text-sm text-secondary">Start or reload the server, then send a prompt.</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <textarea
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          className="min-h-20 flex-1 resize-y rounded-xl border border-border-subtle/60 bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent/80"
                        />
                        <ToolbarButton disabled={Boolean(busy || !prompt.trim() || !selectedModel)} onClick={() => void runPrompt()}>
                          Send
                        </ToolbarButton>
                      </div>
                    </div>
                  ) : (
                    <pre className="mt-5 max-h-96 overflow-auto rounded-lg bg-background/25 p-4 text-xs leading-5 text-secondary">
                      {activeRuntime === 'mlx'
                        ? status?.mlx?.log || 'No logs yet.'
                        : status?.gguf?.log || status?.gguf?.version || 'No logs yet.'}
                    </pre>
                  )}
                </section>
              </main>
              {serverRail}
            </>
          ) : (
            <>
              <main className="min-w-0 flex-1 space-y-5">
                <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Model Library</h2>
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
                              <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                                <ToolbarButton onClick={() => void selectSearchModel(model.id)}>Select</ToolbarButton>
                                <ToolbarButton
                                  disabled={model.format === 'unknown'}
                                  onClick={() => {
                                    void selectSearchModel(model.id).then(() => {
                                      if (model.format === 'mlx') void downloadMlxModel(model.id);
                                    });
                                  }}
                                >
                                  Download
                                </ToolbarButton>
                              </div>
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

                <section className="rounded-xl border border-border-subtle bg-surface/25 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-primary">Downloaded Models</h2>
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
                              <div className="flex gap-2">
                                <ToolbarButton
                                  onClick={() => {
                                    setSelectedModelId(model.id);
                                    setPage('server');
                                    setDirty(true);
                                  }}
                                >
                                  Use on Server
                                </ToolbarButton>
                                {model.path ? (
                                  <ToolbarButton
                                    onClick={() => void pa.extension.invoke('localModelsGgufReveal', { modelPath: model.path })}
                                  >
                                    Reveal
                                  </ToolbarButton>
                                ) : null}
                                <ToolbarButton disabled={Boolean(busy)} onClick={() => void deleteDownloadedModel(model)}>
                                  Delete
                                </ToolbarButton>
                              </div>
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
