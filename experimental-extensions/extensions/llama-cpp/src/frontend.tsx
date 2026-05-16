import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { useEffect, useState } from 'react';

import {
  RuntimeFooter,
  RuntimeHeader,
  RuntimePage,
  RuntimeWorkspace,
  TerminalBlock,
  ToolbarButton,
} from '../../../shared/localRuntimeWorkspace';

type CachedModel = { path: string; name: string; bytes: number; updatedAt: number };

type RuntimeStatus = {
  available: boolean;
  serverAvailable: boolean;
  cliAvailable: boolean;
  cliPath: string;
  serverPath: string;
  modelCacheRoot: string;
  selectedModelPath: string;
  baseUrl: string;
  message?: string;
  version?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  process: { managedRunning: boolean; managedPid: number | null };
  models: CachedModel[];
  log: string;
};

type DownloadResult = { modelPath: string; bytes: number; cached: boolean; status?: RuntimeStatus };

const PROVIDER_ID = 'llama-cpp-local';

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function tryRegisterModelProvider(status: RuntimeStatus | null, modelPath: string) {
  if (!status?.baseUrl || !modelPath) return;
  const modelName = modelPath.split('/').pop() || 'llama.cpp local';
  try {
    await postJson('/api/model-providers/providers', {
      provider: PROVIDER_ID,
      api: 'openai-completions',
      baseUrl: status.baseUrl,
      apiKey: 'local',
      authHeader: false,
      compat: { stream: true },
    });
    await postJson(`/api/model-providers/providers/${encodeURIComponent(PROVIDER_ID)}/models`, {
      modelId: modelName,
      name: modelName,
      api: 'openai-completions',
      baseUrl: status.baseUrl,
      reasoning: true,
      input: ['text'],
      contextWindow: 8192,
    });
  } catch {
    // Extension preview/test contexts may not expose the provider API. Runtime control should still work.
  }
}

function bytesLabel(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024 * 1024) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(bytes / 1024 / 1024)} MB`;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024 / 1024)} GB`;
}

function dateLabel(value: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function LlamaCppPage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [repo, setRepo] = useState('unsloth/Qwen3.6-35B-A3B-MTP-GGUF');
  const [filename, setFilename] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [prompt, setPrompt] = useState('Write a short hello world in Rust.');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  async function refreshStatus(syncModel = false) {
    setError(null);
    try {
      const nextStatus = await pa.extension.invoke<RuntimeStatus>('runtimeStatus', {});
      setStatus(nextStatus);
      if (syncModel || !modelPath) setModelPath(nextStatus.selectedModelPath || '');
      return nextStatus;
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setOutput(message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadModel() {
    await runAction('Downloading…', async () => {
      setOutput('Downloading model. This can take a while for large GGUF files.');
      const result = await pa.extension.invoke<DownloadResult>('downloadModel', { repo, filename });
      setModelPath(result.modelPath);
      setOutput(`${result.cached ? 'Using cached model' : 'Downloaded model'}: ${result.modelPath}\nSize: ${bytesLabel(result.bytes)}`);
      setStatus(result.status ?? (await refreshStatus()) ?? status);
    });
  }

  async function useModel(nextModelPath: string) {
    await runAction('Selecting…', async () => {
      await pa.extension.invoke('setModel', { modelPath: nextModelPath });
      setModelPath(nextModelPath);
      await refreshStatus();
    });
  }

  async function revealModel(nextModelPath: string) {
    await runAction('Revealing…', async () => {
      await pa.extension.invoke('revealModel', { modelPath: nextModelPath });
    });
  }

  async function toggleServer() {
    const shouldStop = Boolean(status?.server.reachable || status?.process.managedRunning);
    await runAction(shouldStop ? 'Stopping…' : 'Starting…', async () => {
      const nextStatus = await pa.extension.invoke<{ status?: RuntimeStatus }>(shouldStop ? 'stopServer' : 'startServer', { modelPath });
      const refreshed = nextStatus.status ?? (await refreshStatus()) ?? status;
      setStatus(refreshed);
      if (!shouldStop) await tryRegisterModelProvider(refreshed, modelPath || refreshed?.selectedModelPath || '');
    });
  }

  async function runPrompt() {
    await runAction('Running…', async () => {
      setOutput('');
      const result = await pa.extension.invoke<{ output: string; source: string }>('runPrompt', {
        modelPath,
        prompt,
        gpuLayers: 999,
        contextSize: 8192,
      });
      setOutput(result.output || `No output from ${result.source}.`);
    });
  }

  useEffect(() => {
    void refreshStatus(true);
  }, []);

  const running = Boolean(status?.server.reachable);
  const starting = Boolean(status?.process.managedRunning && !running);
  const ready = Boolean(status?.available && modelPath);
  const statusLabel = busy || (running ? 'Running' : starting ? 'Starting' : status?.available ? 'Runtime Ready' : 'Needs Setup');
  const tone = busy ? 'warning' : running ? 'running' : status?.available ? 'ready' : 'warning';
  const statusMessage =
    error ||
    status?.message ||
    (status?.serverAvailable
      ? 'Persistent llama-server is available. Start the runtime to expose this model in the picker.'
      : 'llama-server is not bundled yet; one-shot prompts can still use llama-cli if available.');

  return (
    <RuntimePage>
      <RuntimeHeader
        title="✨ llama.cpp"
        summary="Download GGUF models, run a persistent local server, and smoke-test prompts before using them in chat."
        status={statusLabel}
        tone={tone}
        metadata={[
          'Backend: llama.cpp',
          `Endpoint: ${status?.baseUrl ?? 'Checking…'}`,
          `Model: ${modelPath ? modelPath.split('/').pop() : 'None selected'}`,
        ]}
        message={statusMessage}
        actions={
          <>
            <ToolbarButton disabled={Boolean(busy)} onClick={() => void refreshStatus()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton disabled={Boolean(busy || !status?.serverAvailable || !modelPath)} onClick={() => void toggleServer()}>
              {running || starting ? 'Stop Runtime' : 'Start Runtime'}
            </ToolbarButton>
          </>
        }
      />

      <RuntimeWorkspace
        left={
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary">Model</h2>
              <ToolbarButton disabled={Boolean(busy || !repo.trim() || !filename.trim())} onClick={() => void downloadModel()}>
                Download
              </ToolbarButton>
            </div>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-secondary">Repository</span>
              <input
                name="llama-repository"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                value={repo}
                placeholder="unsloth/Qwen3.6-35B-A3B-MTP-GGUF…"
                onChange={(event) => setRepo(event.target.value)}
              />
            </label>
            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-secondary">GGUF Filename</span>
              <input
                name="llama-gguf-filename"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                value={filename}
                placeholder="model-q4_k_m.gguf…"
                onChange={(event) => setFilename(event.target.value)}
              />
            </label>

            <div className="my-5 border-t border-border-subtle" />

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-primary">Cached Models</h3>
              <span className="text-xs text-secondary">{status?.models.length ?? 0}</span>
            </div>
            <div className="mt-3 divide-y divide-border-subtle border-y border-border-subtle text-sm">
              {status?.models.length ? (
                status.models.map((model) => (
                  <div key={model.path} className="py-3">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left font-medium text-primary hover:text-accent focus-visible:text-accent"
                      onClick={() => void useModel(model.path)}
                    >
                      {model.name}
                    </button>
                    <div className="mt-1 text-xs text-secondary">
                      {bytesLabel(model.bytes)} · {dateLabel(model.updatedAt)}
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      <button type="button" className="text-accent hover:text-primary" onClick={() => void useModel(model.path)}>
                        Use
                      </button>
                      <button type="button" className="text-secondary hover:text-primary" onClick={() => void revealModel(model.path)}>
                        Reveal in Finder
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-3 text-secondary">No cached GGUF models yet. Download one above or paste a local path on the right.</p>
              )}
            </div>
          </>
        }
        right={
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-lg font-semibold text-primary">Test Prompt</h2>
                <p className="text-sm text-secondary">
                  {running
                    ? 'Using the local OpenAI-compatible llama-server endpoint.'
                    : 'Start the runtime for server mode, or run a one-shot llama-cli prompt.'}
                </p>
              </div>
              <ToolbarButton disabled={Boolean(busy || !ready || !prompt.trim())} onClick={() => void runPrompt()}>
                {busy === 'Running…' ? 'Running…' : 'Run Prompt'}
              </ToolbarButton>
            </div>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-secondary">GGUF Model Path</span>
              <input
                name="llama-model-path"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                value={modelPath}
                placeholder="/path/to/model.gguf…"
                onChange={(event) => setModelPath(event.target.value)}
              />
            </label>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-secondary">Prompt</span>
              <textarea
                name="llama-test-prompt"
                autoComplete="off"
                className="min-h-28 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-primary outline-none focus-visible:border-accent"
                value={prompt}
                placeholder="Ask the local model something…"
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>

            <div className="mt-4 min-h-0 flex-1">
              <TerminalBlock>
                {output || (ready ? 'Prompt output will appear here.' : 'Download, select, or paste a GGUF model path to test prompts.')}
              </TerminalBlock>
            </div>
          </>
        }
      />

      <RuntimeFooter
        summary={`Runtime: llama.cpp · Cache: ${status?.modelCacheRoot ?? 'Checking…'} · Details`}
        open={logsOpen}
        onToggle={() => setLogsOpen((open) => !open)}
      >
        <TerminalBlock>{status?.log?.trim() || status?.version || status?.message || 'No runtime details yet.'}</TerminalBlock>
      </RuntimeFooter>
    </RuntimePage>
  );
}
