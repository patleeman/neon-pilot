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
        meta: 'MLX · 4-bit',
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
        meta: 'GGUF · llama.cpp',
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
        meta: 'MLX · Hugging Face',
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

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[88rem]" contentClassName="space-y-6">
        <AppPageIntro
          title="Local Models"
          summary="A local model studio for MLX and GGUF runtimes."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-secondary">
                <span className={`h-2 w-2 rounded-full ${running ? 'bg-success' : 'bg-warning'}`} /> Runtime:{' '}
                <span className="font-medium text-primary">{runtimeStatus}</span>
              </div>
              <ToolbarButton onClick={() => setLogsOpen((open) => !open)}>View Logs</ToolbarButton>
              <ToolbarButton disabled={Boolean(busy || !running)} onClick={() => void stopRuntime()}>
                Stop Runtime
              </ToolbarButton>
              <ToolbarButton disabled={Boolean(busy || !selected)} onClick={() => void loadSelected()}>
                {running ? 'Restart Runtime' : 'Start Runtime'}
              </ToolbarButton>
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 gap-6 border-t border-border-subtle pt-6 xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          <aside className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Model Library</h2>
              <button
                type="button"
                className="text-secondary hover:text-primary"
                onClick={() => void refresh()}
                aria-label="Refresh model library"
              >
                ↻
              </button>
            </div>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchMlx();
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
              placeholder="Search models…"
            />
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border-subtle text-sm">
              <button type="button" className="bg-accent/15 px-3 py-2 text-primary">
                Installed
              </button>
              <button type="button" className="px-3 py-2 text-secondary" onClick={() => void searchMlx()}>
                Hugging Face
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Installed Models</div>
              {library.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedId(model.id)}
                  className={`w-full border-t border-border-subtle py-3 text-left transition-colors ${model.id === selected?.id ? 'text-primary' : 'text-secondary hover:text-primary'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-primary">{model.title}</div>
                      <div className="mt-1 truncate text-xs text-secondary">{model.subtitle}</div>
                      <div className="mt-2 text-xs text-dim">
                        {model.size || 'Not downloaded'} · {model.meta}
                      </div>
                    </div>
                    {model.installed ? <span className="text-[11px] text-success">Active</span> : null}
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">Hugging Face Search</div>
                <button type="button" className="text-xs text-accent" onClick={() => void searchMlx()}>
                  Search
                </button>
              </div>
              {(searchResults.length ? searchResults : []).slice(0, 4).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="block w-full border-t border-border-subtle py-2 text-left text-secondary hover:text-primary"
                  onClick={() => {
                    setMlxModel(model.id);
                    setSelectedId('mlx-default');
                  }}
                >
                  <div className="truncate text-sm font-medium text-primary">{model.id}</div>
                  <div className="mt-1 text-xs text-secondary">{model.downloads.toLocaleString()} downloads</div>
                </button>
              ))}
              <button type="button" className="text-sm text-accent hover:text-primary" onClick={() => void searchMlx()}>
                Search more on Hugging Face ↗
              </button>
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="border-y border-border-subtle py-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-secondary">Selected Model</div>
                  <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-primary">
                    {selected?.title || 'No model selected'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-secondary">{selected?.subtitle}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-secondary">
                    <span className="rounded-full border border-border-subtle bg-surface/60 px-2 py-1">{runtime.toUpperCase()}</span>
                    <span className="rounded-full border border-border-subtle bg-surface/60 px-2 py-1">
                      {selected?.size || 'Unknown size'}
                    </span>
                    <span className="rounded-full border border-border-subtle bg-surface/60 px-2 py-1">
                      {selected?.installed ? 'Installed' : 'Download needed'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ToolbarButton disabled={Boolean(busy || !selected)} onClick={() => void loadSelected()}>
                    Load Model
                  </ToolbarButton>
                  <ToolbarButton
                    disabled={Boolean(busy || runtime !== 'gguf' || !selected?.path)}
                    onClick={() => selected?.path && void pa.extension.invoke('localModelsGgufReveal', { modelPath: selected.path })}
                  >
                    Reveal
                  </ToolbarButton>
                </div>
              </div>
            </section>

            <section className="border-t border-border-subtle pt-5">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Prompt Test</h2>
                  <p className="text-sm text-secondary">Test your model with a quick prompt.</p>
                </div>
                <ToolbarButton disabled={Boolean(busy || !prompt.trim())} onClick={() => void runPrompt()}>
                  {busy === 'Running…' ? 'Running…' : 'Run Prompt'}
                </ToolbarButton>
              </div>
              <div className="mt-4">
                <div className="mb-2 inline-flex rounded-md bg-accent/25 px-2 py-1 text-xs font-medium text-primary">You</div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                />
              </div>
              <div className="mt-4 rounded-lg border border-border-subtle bg-surface/35 p-4">
                <div className="mb-3 inline-flex rounded-md bg-accent/25 px-2 py-1 text-xs font-medium text-primary">Model</div>
                <pre className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                  {output || error || 'Model output will appear here after you run a prompt.'}
                </pre>
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="border-t border-border-subtle pt-4">
              <h2 className="font-semibold text-primary">Generation Settings</h2>
              <div className="mt-4 space-y-4 text-sm text-secondary">
                <label className="block space-y-2">
                  Temperature <input type="range" min="0" max="2" step="0.05" defaultValue="0.7" className="w-full accent-accent" />
                </label>
                <label className="block space-y-2">
                  Top P <input type="range" min="0" max="1" step="0.01" defaultValue="0.95" className="w-full accent-accent" />
                </label>
                <label className="block space-y-2">
                  Max Tokens{' '}
                  <input defaultValue="1024" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary" />
                </label>
              </div>
            </section>
            <section className="border-t border-border-subtle pt-4">
              <h2 className="font-semibold text-primary">Server Configuration</h2>
              <div className="mt-4 space-y-3 text-sm text-secondary">
                <label className="block space-y-2">
                  Endpoint{' '}
                  <input readOnly value={endpoint} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary" />
                </label>
                <div className="flex items-center justify-between">
                  <span>Connection</span>
                  <span className={running ? 'text-success' : 'text-warning'}>{running ? 'Connected' : 'Stopped'}</span>
                </div>
                <ToolbarButton onClick={() => void refresh()}>Test</ToolbarButton>
              </div>
            </section>
            <section className="border-t border-border-subtle pt-4">
              <h2 className="font-semibold text-primary">Add GGUF Model</h2>
              <div className="mt-4 space-y-3">
                <input
                  value={repo}
                  onChange={(event) => setRepo(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
                  placeholder="Hugging Face repo…"
                />
                <input
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
                  placeholder="model.gguf…"
                />
                <ToolbarButton disabled={Boolean(busy || !repo || !filename)} onClick={() => void downloadGguf()}>
                  Download & Use
                </ToolbarButton>
              </div>
            </section>
          </aside>
        </div>

        {logsOpen ? (
          <pre className="max-h-56 overflow-auto rounded-lg border border-border-subtle bg-surface/35 p-4 text-xs text-secondary">
            {runtime === 'mlx' ? status?.mlx?.log || 'No logs yet.' : status?.gguf?.log || status?.gguf?.version || 'No logs yet.'}
          </pre>
        ) : null}
      </AppPageLayout>
    </div>
  );
}

export default LocalModelsPage;
