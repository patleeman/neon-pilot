import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [temperature, setTemperature] = useState('0.7');
  const [topP, setTopP] = useState('0.95');
  const [maxTokens, setMaxTokens] = useState('1024');
  const [contextSize, setContextSize] = useState('8192');
  const [gpuLayers, setGpuLayers] = useState('999');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function useHuggingFaceSlug() {
    const slug = mlxModel.trim();
    if (!slug) return;
    if (slug.toLowerCase().includes('gguf')) {
      setRepo(slug);
      setRuntimeFromSelection('gguf');
      return;
    }
    await runAction('Selecting…', async () => {
      await pa.extension.invoke('localModelsMlxSetModel', { modelId: slug });
      setSelectedId('mlx-selected');
    });
  }

  function setRuntimeFromSelection(nextRuntime: 'mlx' | 'gguf') {
    const match = library.find((model) => model.runtime === nextRuntime);
    if (match) setSelectedId(match.id);
  }

  async function downloadGguf() {
    await runAction('Downloading…', async () => {
      await pa.extension.invoke('localModelsGgufDownload', { repo, filename });
      setRuntimeFromSelection('gguf');
    });
  }

  async function selectLocalGguf(file: File | null | undefined) {
    const modelPath = (file as (File & { path?: string }) | null | undefined)?.path;
    if (!modelPath) {
      setError('Could not read the selected file path. Pick a local .gguf file from the desktop app.');
      return;
    }
    await runAction('Selecting…', async () => {
      await pa.extension.invoke('localModelsGgufSetModel', { modelPath });
      setSelectedId(modelPath);
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
          contextSize: Number(contextSize),
          gpuLayers: Number(gpuLayers),
        });
        setOutput(result.output);
        return;
      }
      const modelId = status?.mlx?.loadedModelId || selected.subtitle;
      const response = await fetch(`${MLX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
        body: JSON.stringify({
          model: modelId,
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

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[88rem]" contentClassName="space-y-6">
        <AppPageIntro
          title="Local Models"
          summary="Find a model, turn it on, then chat with it. The runtime is picked from the model you choose."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-secondary">
                <span className={`h-2 w-2 rounded-full ${running ? 'bg-success' : 'bg-warning'}`} />
                <span className="font-medium text-primary">{runtimeStatus}</span>
              </div>
              <ToolbarButton disabled={Boolean(busy || !running)} onClick={() => void stopRuntime()}>
                Stop
              </ToolbarButton>
              <ToolbarButton disabled={Boolean(busy || !selected)} onClick={() => void loadSelected()}>
                {running ? 'Restart' : 'Start'}
              </ToolbarButton>
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
          <aside className="space-y-5 rounded-xl border border-border-subtle/70 bg-surface/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary">Find or Set a Model</h2>
                <p className="mt-1 text-sm text-secondary">Search Hugging Face, paste a slug, or select a local GGUF.</p>
              </div>
              <button
                type="button"
                className="text-secondary hover:text-primary"
                onClick={() => void refresh()}
                aria-label="Refresh models"
              >
                ↻
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dim">Hugging Face search</label>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void searchMlx();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                  placeholder="Search models…"
                />
                <ToolbarButton disabled={Boolean(busy)} onClick={() => void searchMlx()}>
                  Search
                </ToolbarButton>
              </div>
              <div className="space-y-1">
                {searchResults.slice(0, 4).map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left text-sm text-secondary hover:bg-surface/60 hover:text-primary"
                    onClick={() => {
                      setMlxModel(model.id);
                      setSelectedId('mlx-selected');
                    }}
                  >
                    <div className="truncate font-medium text-primary">{model.id}</div>
                    <div className="mt-1 text-xs text-dim">{model.downloads.toLocaleString()} downloads</div>
                  </button>
                ))}
                {!searchResults.length ? <div className="text-sm text-dim">Search to pull model slugs from Hugging Face.</div> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dim">Use a Hugging Face slug</label>
              <input
                value={mlxModel}
                onChange={(event) => setMlxModel(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                placeholder="org/model-name"
              />
              <div className="flex gap-2">
                <ToolbarButton disabled={Boolean(busy || !mlxModel.trim())} onClick={() => void useHuggingFaceSlug()}>
                  Use Slug
                </ToolbarButton>
                <ToolbarButton disabled={Boolean(busy || !repo || !filename)} onClick={() => void downloadGguf()}>
                  Download GGUF
                </ToolbarButton>
              </div>
              <input
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                placeholder="GGUF repo, e.g. unsloth/...-GGUF"
              />
              <input
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                placeholder="GGUF filename, e.g. model-q4_k_m.gguf"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dim">Local GGUF</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gguf"
                className="hidden"
                onChange={(event) => void selectLocalGguf(event.currentTarget.files?.[0])}
              />
              <ToolbarButton onClick={() => fileInputRef.current?.click()}>Select GGUF File…</ToolbarButton>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-dim">Available models</div>
              {library.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedId(model.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    model.id === selected?.id ? 'bg-accent/15 text-primary' : 'text-secondary hover:bg-surface/60 hover:text-primary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-primary">{model.title}</div>
                      <div className="mt-1 truncate text-xs text-secondary">{model.subtitle}</div>
                      <div className="mt-1 text-xs text-dim">
                        {model.size || 'Not downloaded'} · {model.meta}
                      </div>
                    </div>
                    {model.installed ? <span className="text-[11px] text-success">Ready</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            <section className="rounded-xl border border-border-subtle/70 bg-surface/25 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-secondary">Current Model</div>
                  <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-primary">
                    {selected?.title || 'No model selected'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-secondary">{selected?.subtitle}</p>
                  <div className="mt-4 grid gap-3 text-sm text-secondary sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-dim">Status</div>
                      <div className={running ? 'mt-1 font-medium text-success' : 'mt-1 font-medium text-warning'}>{runtimeStatus}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-dim">Endpoint</div>
                      <div className="mt-1 truncate font-mono text-xs text-primary">{endpoint}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.12em] text-dim">Source</div>
                      <div className="mt-1 text-primary">{selected?.meta || 'Auto detected'}</div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ToolbarButton disabled={Boolean(busy || !selected)} onClick={() => void loadSelected()}>
                    {running ? 'Restart' : 'Start'}
                  </ToolbarButton>
                  <ToolbarButton disabled={Boolean(busy || !running)} onClick={() => void stopRuntime()}>
                    Stop
                  </ToolbarButton>
                  <ToolbarButton
                    disabled={Boolean(busy || runtime !== 'gguf' || !selected?.path)}
                    onClick={() => selected?.path && void pa.extension.invoke('localModelsGgufReveal', { modelPath: selected.path })}
                  >
                    Reveal
                  </ToolbarButton>
                </div>
              </div>
              {error ? (
                <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
              ) : null}
            </section>

            <section className="rounded-xl border border-border-subtle/70 bg-surface/25 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Prompt Test</h2>
                  <p className="text-sm text-secondary">A tiny chat loop for smoke-testing the selected model.</p>
                </div>
                <ToolbarButton disabled={Boolean(busy || !prompt.trim())} onClick={() => void runPrompt()}>
                  {busy === 'Running…' ? 'Running…' : 'Send'}
                </ToolbarButton>
              </div>
              <div className="mt-4 min-h-80 space-y-4 rounded-xl bg-background/35 p-4">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent/20 px-4 py-3 text-sm text-primary">{prompt}</div>
                </div>
                <div className="flex justify-start">
                  <pre className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border-subtle bg-surface/70 px-4 py-3 text-sm leading-relaxed text-secondary">
                    {output || error || 'Start the runtime, send a prompt, and the model response will appear here.'}
                  </pre>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void runPrompt();
                  }}
                  className="min-h-20 flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                  placeholder="Message your local model…"
                />
              </div>
            </section>

            <section className="rounded-xl border border-border-subtle/70 bg-surface/25 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Logs</h2>
                  <p className="text-sm text-secondary">Runtime output and setup messages.</p>
                </div>
                <ToolbarButton onClick={() => setLogsOpen((open) => !open)}>{logsOpen ? 'Hide Logs' : 'Show Logs'}</ToolbarButton>
              </div>
              {logsOpen ? (
                <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-background/45 p-4 text-xs text-secondary">
                  {runtime === 'mlx' ? status?.mlx?.log || 'No logs yet.' : status?.gguf?.log || status?.gguf?.version || 'No logs yet.'}
                </pre>
              ) : null}
            </section>
          </main>

          <aside className="space-y-5 rounded-xl border border-border-subtle/70 bg-surface/25 p-4">
            <section>
              <h2 className="font-semibold text-primary">Settings & Configuration</h2>
              <p className="mt-1 text-sm text-secondary">Defaults used when starting and testing local models.</p>
            </section>

            <section className="space-y-4">
              <label className="block space-y-2 text-sm text-secondary">
                <span className="flex items-center justify-between gap-3">
                  Temperature
                  <input
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                    className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-primary"
                  />
                </span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  className="w-full accent-accent"
                />
              </label>
              <label className="block space-y-2 text-sm text-secondary">
                <span className="flex items-center justify-between gap-3">
                  Top P
                  <input
                    value={topP}
                    onChange={(event) => setTopP(event.target.value)}
                    className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-primary"
                  />
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={topP}
                  onChange={(event) => setTopP(event.target.value)}
                  className="w-full accent-accent"
                />
              </label>
              <label className="block space-y-2 text-sm text-secondary">
                Max Tokens
                <input
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary"
                />
              </label>
            </section>

            <section className="space-y-3 pt-2">
              <h3 className="font-semibold text-primary">Server</h3>
              <label className="block space-y-2 text-sm text-secondary">
                Endpoint
                <input readOnly value={endpoint} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary" />
              </label>
              <label className="block space-y-2 text-sm text-secondary">
                Context Size
                <input
                  value={contextSize}
                  onChange={(event) => setContextSize(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary"
                />
              </label>
              <label className="block space-y-2 text-sm text-secondary">
                GPU Layers
                <input
                  value={gpuLayers}
                  onChange={(event) => setGpuLayers(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-primary"
                />
              </label>
              <div className="flex items-center justify-between text-sm text-secondary">
                <span>Connection</span>
                <span className={running ? 'text-success' : 'text-warning'}>{running ? 'Connected' : 'Stopped'}</span>
              </div>
              <ToolbarButton onClick={() => void refresh()}>Refresh Status</ToolbarButton>
            </section>
          </aside>
        </div>
      </AppPageLayout>
    </div>
  );
}

export default LocalModelsPage;
