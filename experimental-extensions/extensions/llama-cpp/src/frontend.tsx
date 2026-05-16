import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import type React from 'react';
import { useEffect, useState } from 'react';

type RuntimeStatus = {
  available: boolean;
  cliPath: string;
  modelCacheRoot: string;
  message?: string;
  version?: string;
};

type DownloadResult = {
  modelPath: string;
  bytes: number;
  cached: boolean;
};

function TerminalBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="min-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle bg-[#0f131c] p-4 text-xs leading-relaxed text-secondary">
      {children}
    </pre>
  );
}

function bytesLabel(bytes: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024 / 1024);
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

  async function refreshStatus() {
    setError(null);
    try {
      const nextStatus = await pa.extension.invoke<RuntimeStatus>('runtimeStatus', {});
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function downloadModel() {
    setBusy('Downloading…');
    setError(null);
    setOutput('Downloading model. This can take a while for large GGUF files.');
    try {
      const result = await pa.extension.invoke<DownloadResult>('downloadModel', { repo, filename });
      setModelPath(result.modelPath);
      setOutput(`${result.cached ? 'Using cached model' : 'Downloaded model'}: ${result.modelPath}\nSize: ${bytesLabel(result.bytes)} GB`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setOutput(message);
    } finally {
      setBusy(null);
    }
  }

  async function runPrompt() {
    setBusy('Running…');
    setError(null);
    setOutput('');
    try {
      const result = await pa.extension.invoke<{ output: string }>('runPrompt', { modelPath, prompt, gpuLayers: 999, contextSize: 8192 });
      setOutput(result.output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setOutput(message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const available = Boolean(status?.available);
  const ready = available && Boolean(modelPath);
  const statusLabel = available ? (modelPath ? 'Ready' : 'Runtime Ready') : 'Needs Setup';
  const statusColor = available ? 'bg-success' : 'bg-warning';
  const statusMessage =
    error || status?.message || (available ? 'Metal-enabled llama.cpp runtime found.' : 'Bundled llama-cli is missing.');

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[76rem]" contentClassName="space-y-5">
        <header className="border-b border-border-subtle pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-primary">✨ llama.cpp</h1>
              <p className="mt-1 text-sm text-secondary">
                Download GGUF models and run one-shot local prompts through bundled Metal llama.cpp.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ToolbarButton disabled={Boolean(busy)} onClick={() => void refreshStatus()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton disabled={Boolean(busy || !repo.trim() || !filename.trim())} onClick={() => void downloadModel()}>
                Download & Use
              </ToolbarButton>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary">
            <span className="font-medium text-primary">
              <span className={`mr-2 inline-block h-2 w-2 rounded-full ${statusColor}`} />
              {busy || statusLabel}
            </span>
            <span>Backend: llama.cpp</span>
            <span className="min-w-0 truncate">Model: {modelPath || 'None selected'}</span>
            <span>Cache: {status?.modelCacheRoot ?? 'Checking…'}</span>
          </div>
          <div className="mt-3 text-sm text-secondary" aria-live="polite">
            {statusMessage}
          </div>
        </header>

        <section className="grid min-h-[34rem] overflow-hidden rounded-xl border border-border-subtle bg-surface/40 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
          <aside className="border-b border-border-subtle p-4 lg:border-b-0 lg:border-r">
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

            <h3 className="text-sm font-semibold text-primary">Runtime</h3>
            <div className="mt-3 space-y-2 text-sm text-secondary">
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className="text-primary">{available ? 'Available' : 'Missing'}</span>
              </div>
              <div>
                <div className="text-secondary">Binary</div>
                <code className="mt-1 block break-all text-xs text-dim">{status?.cliPath ?? 'Checking…'}</code>
              </div>
              {status?.message ? <p className="border-l-2 border-warning pl-3 text-warning">{status.message}</p> : null}
            </div>
          </aside>

          <main className="flex min-w-0 flex-col p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-lg font-semibold text-primary">Test Prompt</h2>
                <p className="text-sm text-secondary">Run a smoke test against the selected GGUF model.</p>
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
                {output || (ready ? 'Prompt output will appear here.' : 'Download or choose a GGUF model to test prompts.')}
              </TerminalBlock>
            </div>
          </main>
        </section>

        <footer className="rounded-lg border border-border-subtle bg-surface/30 text-sm text-secondary">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:text-primary"
            onClick={() => setLogsOpen((open) => !open)}
            aria-expanded={logsOpen}
          >
            <span>Runtime: llama.cpp · Cache: {status?.modelCacheRoot ?? 'Checking…'} · Details</span>
            <span>{logsOpen ? 'Hide' : 'Show'}</span>
          </button>
          {logsOpen ? (
            <div className="border-t border-border-subtle p-4">
              <TerminalBlock>{status?.version || status?.message || 'No runtime details yet.'}</TerminalBlock>
            </div>
          ) : null}
        </footer>
      </AppPageLayout>
    </div>
  );
}
