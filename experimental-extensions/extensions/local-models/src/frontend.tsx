import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type MlxStatus = {
  selectedModelId: string;
  loadedModelId: string | null;
  installed: boolean;
  downloaded?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  setup: { status: 'running' | 'succeeded' | 'failed'; message: string; progress: number; error: string | null } | null;
  process: { managedRunning: boolean };
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
  log: string;
};

type Status = { mlx: MlxStatus; gguf: GgufStatus };
type SearchResult = { id: string; downloads: number; likes: number; tags: string[] };
type LibraryModel = {
  id: string;
  title: string;
  subtitle: string;
  runtime: 'mlx' | 'gguf';
  installed: boolean;
  size?: string;
  meta?: string;
  path?: string;
};

const MLX_BASE_URL = 'http://127.0.0.1:8011/v1';
const GGUF_PROVIDER_ID = 'llama-cpp-local';
const MLX_PROVIDER_ID = 'mlx-local';

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024 * 1024) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(bytes / 1024 / 1024)} MB`;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024 / 1024)} GB`;
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

function runtimeLabel(runtime: 'mlx' | 'gguf') {
  return runtime === 'mlx' ? 'MLX' : 'GGUF';
}

export function LocalModelsPage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [selectedId, setSelectedId] = useState<string>('mlx-default');
  const [repo, setRepo] = useState('unsloth/Qwen3.6-35B-A3B-MTP-GGUF');
  const [filename, setFilename] = useState('');
  const [mlxModel, setMlxModel] = useState('unsloth/Qwen3.6-35B-UD-MLX-4bit');
  const [searchQuery, setSearchQuery] = useState('Qwen MLX');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [prompt, setPrompt] = useState('Write a tiny TypeScript function that reverses a string.');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const next = await pa.extension.invoke<Status>('localModelsStatus', {});
      setStatus(next);
      if (next.mlx?.selectedModelId) setMlxModel(next.mlx.selectedModelId);
      if (!selectedId) setSelectedId(next.mlx?.selectedModelId ? 'mlx-selected' : next.gguf?.selectedModelPath || 'mlx-default');
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
      setOutput(message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const library = useMemo<LibraryModel[]>(() => {
    const models: LibraryModel[] = [];
    if (status?.mlx?.selectedModelId) {
      models.push({
        id: 'mlx-selected',
        title: status.mlx.selectedModelId.split('/').pop() || status.mlx.selectedModelId,
        subtitle: status.mlx.selectedModelId,
        runtime: 'mlx',
        installed: status.mlx.installed,
        size: status.mlx.downloaded,
        meta: 'Hugging Face MLX',
      });
    }
    for (const model of status?.gguf?.models ?? []) {
      models.push({
        id: model.path,
        title: model.name,
        subtitle: model.path,
        runtime: 'gguf',
        installed: true,
        size: formatBytes(model.bytes),
        meta: 'llama.cpp GGUF',
        path: model.path,
      });
    }
    if (!models.length) {
      models.push({
        id: 'mlx-default',
        title: mlxModel.split('/').pop() || mlxModel,
        subtitle: mlxModel,
        runtime: 'mlx',
        installed: false,
        meta: 'Hugging Face MLX',
      });
    }
    return models;
  }, [mlxModel, status]);

  const selected = library.find((model) => model.id === selectedId) ?? library[0];
  const runtime = selected?.runtime ?? 'mlx';
  const running = runtime === 'mlx' ? Boolean(status?.mlx?.server.reachable) : Boolean(status?.gguf?.server.reachable);
  const starting =
    runtime === 'mlx'
      ? Boolean(status?.mlx?.process.managedRunning && !running)
      : Boolean(status?.gguf?.process.managedRunning && !running);
  const endpoint = runtime === 'mlx' ? MLX_BASE_URL : status?.gguf?.baseUrl || 'http://127.0.0.1:8012/v1';
  const runtimeStatus = busy || (running ? 'Running' : starting ? 'Starting' : selected?.installed ? 'Ready' : 'Not Loaded');

  async function loadSelected() {
    if (!selected) return;
    if (selected.runtime === 'mlx') {
      await runAction('Loading…', async () => {
        await pa.extension.invoke('localModelsMlxSetModel', { modelId: selected.subtitle });
        if (!status?.mlx?.installed) await pa.extension.invoke('localModelsMlxSetup', { modelId: selected.subtitle });
        await pa.extension.invoke('localModelsMlxStart', {});
        await tryRegisterProvider('mlx', selected.subtitle, MLX_BASE_URL);
      });
    } else if (selected.path) {
      await runAction('Loading…', async () => {
        await pa.extension.invoke('localModelsGgufSetModel', { modelPath: selected.path });
        await pa.extension.invoke('localModelsGgufStart', { modelPath: selected.path });
        await tryRegisterProvider('gguf', selected.title, endpoint);
      });
    }
  }

  async function stopRuntime() {
    await runAction('Stopping…', async () => {
      if (runtime === 'mlx') await pa.extension.invoke('localModelsMlxStop', {});
      else await pa.extension.invoke('localModelsGgufStop', {});
    });
  }

  async function searchMlx() {
    await runAction('Searching…', async () => {
      const result = await pa.extension.invoke<{ models?: SearchResult[] }>('localModelsMlxSearch', { query: searchQuery });
      setSearchResults(result.models ?? []);
    });
  }

  async function downloadGguf() {
    await runAction('Downloading…', async () => {
      await pa.extension.invoke('localModelsGgufDownload', { repo, filename });
    });
  }

  async function runPrompt() {
    if (!selected) return;
    await runAction('Running…', async () => {
      setOutput('');
      if (selected.runtime === 'gguf') {
        const result = await pa.extension.invoke<{ output: string }>('localModelsGgufRunPrompt', {
          modelPath: selected.path || status?.gguf?.selectedModelPath,
          prompt,
        });
        setOutput(result.output);
        return;
      }
      const modelId = status?.mlx?.loadedModelId || selected.subtitle;
      const response = await fetch(`${MLX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
        body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }], stream: false }),
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      setOutput(body.choices?.[0]?.message?.content || JSON.stringify(body, null, 2));
    });
  }

  const installedCount = library.filter((model) => model.installed).length;
  const downloadableCount = searchResults.length;

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="Local Models"
          summary="A local model studio for MLX and GGUF runtimes."
          actions={
            <div className="flex items-center gap-2">
              <ToolbarButton className="rounded-lg px-3 py-1.5 text-[12px] text-primary shadow-none" onClick={() => void refresh()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton
                className="rounded-lg px-3 py-1.5 text-[12px] text-primary shadow-none"
                onClick={() => setLogsOpen((open) => !open)}
              >
                View Logs
              </ToolbarButton>
              <ToolbarButton
                className="rounded-lg px-3 py-1.5 text-[12px] text-primary shadow-none"
                disabled={Boolean(busy || !running)}
                onClick={() => void stopRuntime()}
              >
                Stop
              </ToolbarButton>
              <ToolbarButton
                className="rounded-lg px-3 py-1.5 text-[12px] text-primary shadow-none"
                disabled={Boolean(busy || !selected)}
                onClick={() => void loadSelected()}
              >
                {running ? 'Restart' : 'Start'}
              </ToolbarButton>
            </div>
          }
        />

        <PulseRow
          items={[
            {
              label: 'Runtime',
              value: runtimeStatus,
              tone: running ? 'text-success' : busy ? 'text-warning' : 'text-primary',
              trend: runtimeLabel(runtime),
              dot: running || Boolean(busy),
            },
            {
              label: 'Selected Model',
              value: selected?.title || 'None',
              tone: 'text-primary',
              trend: selected?.subtitle || 'No model selected',
            },
            { label: 'Installed', value: String(installedCount), tone: 'text-accent', trend: `${library.length} visible models` },
            {
              label: 'Search Results',
              value: String(downloadableCount),
              tone: 'text-warning',
              trend: searchQuery ? `for “${searchQuery}”` : 'not searched',
            },
            {
              label: 'Endpoint',
              value: endpoint.replace('http://127.0.0.1:', ':'),
              tone: running ? 'text-success' : 'text-dim',
              trend: running ? 'connected' : 'stopped',
            },
          ]}
        />

        <section className="grid gap-6 border-t border-border-subtle pt-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <div className="space-y-4">
            <SectionHeader
              title="Model Library"
              description="Installed local models and Hugging Face search."
              action={
                <button type="button" className="text-xs text-accent hover:text-primary" onClick={() => void searchMlx()}>
                  Search
                </button>
              }
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchMlx();
              }}
              className="w-full rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
              placeholder="Search models…"
            />
            <div className="divide-y divide-border-subtle border-y border-border-subtle">
              {library.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedId(model.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 text-left transition-colors ${
                    model.id === selected?.id ? 'text-primary' : 'text-secondary hover:text-primary'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{model.title}</span>
                    <span className="mt-1 block truncate text-xs text-dim">{model.subtitle}</span>
                    <span className="mt-2 block text-xs text-dim">
                      {model.size || 'Not downloaded'} · {model.meta}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 h-2 w-2 rounded-full ${model.id === selected?.id ? 'bg-accent' : model.installed ? 'bg-success' : 'bg-dim'}`}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t border-border-subtle pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dim">Hugging Face</div>
              {(searchResults.length ? searchResults : []).slice(0, 4).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-left text-sm text-secondary hover:text-primary"
                  onClick={() => {
                    setMlxModel(model.id);
                    setSelectedId('mlx-default');
                  }}
                >
                  <span className="truncate">{model.id}</span>
                  <span className="text-xs text-dim">{model.downloads.toLocaleString()}</span>
                </button>
              ))}
              <button type="button" className="text-sm text-accent hover:text-primary" onClick={() => void searchMlx()}>
                Search more on Hugging Face ↗
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-y border-border-subtle py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dim">Selected Model</div>
                  <h2 className="mt-2 truncate text-[24px] font-semibold leading-tight tracking-[-0.03em] text-primary">
                    {selected?.title || 'No model selected'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-secondary">{selected?.subtitle}</p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-dim">
                    <span>{runtimeLabel(runtime)}</span>
                    <span>{selected?.size || 'Unknown size'}</span>
                    <span>{selected?.installed ? 'Installed' : 'Download needed'}</span>
                  </div>
                </div>
                <ToolbarButton disabled={Boolean(busy || !selected)} onClick={() => void loadSelected()}>
                  Load Model
                </ToolbarButton>
              </div>
            </div>

            <div className="space-y-4 border-t border-border-subtle pt-6">
              <SectionHeader
                title="Prompt Test"
                description="Test your selected local model with a quick prompt."
                action={
                  <ToolbarButton disabled={Boolean(busy || !prompt.trim())} onClick={() => void runPrompt()}>
                    {busy === 'Running…' ? 'Running…' : 'Run Prompt'}
                  </ToolbarButton>
                }
              />
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
              />
              <pre className="min-h-32 whitespace-pre-wrap rounded-lg border border-border-subtle bg-surface/35 p-4 text-sm leading-relaxed text-secondary">
                {output || error || 'Model output will appear here after you run a prompt.'}
              </pre>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-border-subtle pt-6 lg:grid-cols-2">
          <div className="space-y-5">
            <SectionHeader title="Generation Settings" description="Sampling defaults for local prompt tests." />
            <Slider label="Temperature" defaultValue="0.7" max="2" step="0.05" />
            <Slider label="Top P" defaultValue="0.95" max="1" step="0.01" />
            <label className="grid grid-cols-[1fr_7rem] items-center gap-4 text-sm text-secondary">
              Max Tokens
              <input defaultValue="1024" className="rounded-md border border-border bg-surface/70 px-3 py-2 text-primary" />
            </label>
          </div>

          <div className="space-y-5">
            <SectionHeader title="Server & Downloads" description="Endpoint status and GGUF download helper." />
            <div className="grid gap-3 text-sm text-secondary sm:grid-cols-[8rem_minmax(0,1fr)]">
              <span>Endpoint</span>
              <input readOnly value={endpoint} className="rounded-md border border-border bg-surface/70 px-3 py-2 text-primary" />
              <span>Connection</span>
              <span className={running ? 'text-success' : 'text-warning'}>{running ? 'Connected' : 'Stopped'}</span>
              <span>GGUF Repo</span>
              <input
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                className="rounded-md border border-border bg-surface/70 px-3 py-2 text-primary"
              />
              <span>Filename</span>
              <input
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                className="rounded-md border border-border bg-surface/70 px-3 py-2 text-primary"
                placeholder="model.gguf…"
              />
            </div>
            <ToolbarButton disabled={Boolean(busy || !repo || !filename)} onClick={() => void downloadGguf()}>
              Download & Use GGUF
            </ToolbarButton>
          </div>
        </section>

        {logsOpen ? (
          <section className="space-y-4 border-t border-border-subtle pt-6">
            <SectionHeader title="Runtime Logs" description="Latest output from the selected local runtime." />
            <pre className="max-h-56 overflow-auto rounded-lg border border-border-subtle bg-surface/35 p-4 text-xs text-secondary">
              {runtime === 'mlx' ? status?.mlx?.log || 'No logs yet.' : status?.gguf?.log || status?.gguf?.version || 'No logs yet.'}
            </pre>
          </section>
        ) : null}
      </AppPageLayout>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function Slider({ label, defaultValue, max, step }: { label: string; defaultValue: string; max: string; step: string }) {
  return (
    <label className="grid grid-cols-[1fr_12rem_3.5rem] items-center gap-4 text-sm text-secondary">
      <span>{label}</span>
      <input type="range" min="0" max={max} step={step} defaultValue={defaultValue} className="w-full accent-accent" />
      <span className="text-right text-primary">{defaultValue}</span>
    </label>
  );
}

function PulseRow({ items }: { items: Array<{ label: string; value: string; tone: string; trend: string; dot?: boolean }> }) {
  return (
    <section className="grid grid-cols-1 border-y border-border-subtle sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="relative flex min-w-0 flex-col gap-2 border-border-subtle py-4 sm:px-4 sm:[&:not(:first-child)]:border-l max-sm:border-t max-sm:first:border-t-0"
        >
          {item.dot ? <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent animate-pulse" /> : null}
          <span className="text-[10px] uppercase tracking-[0.1em] text-dim">{item.label}</span>
          <span className={`truncate text-[21px] font-semibold leading-none tracking-tight ${item.tone}`}>{item.value}</span>
          <span className="truncate text-[11px] text-dim">{item.trend}</span>
        </div>
      ))}
    </section>
  );
}

export default LocalModelsPage;
