import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import React from 'react';

import {
  RuntimeFooter,
  RuntimeHeader,
  RuntimePage,
  RuntimeWorkspace,
  TerminalBlock,
  ToolbarButton,
} from '../../../shared/localRuntimeWorkspace';

const PROVIDER_ID = 'mlx-local';
const BASE_URL = 'http://127.0.0.1:8011/v1';

type Status = {
  selectedModelId: string;
  loadedModelId: string | null;
  installed: boolean;
  downloaded?: string;
  server: { reachable: boolean; models: string[]; error?: string };
  setup: { status: 'running' | 'succeeded' | 'failed'; message: string; progress: number; error: string | null } | null;
  process: { managedRunning: boolean };
  log: string;
};

type SearchResult = { id: string; downloads: number; likes: number; tags: string[] };

type PageState = {
  status: Status | null;
  busy: string | null;
  error: string | null;
  modelInput: string;
  prompt: string;
  output: string;
  searchQuery: string;
  searchResults: SearchResult[];
  searchBusy: boolean;
  logsOpen: boolean;
};

function asStatus(value: unknown): Status | null {
  return value && typeof value === 'object' ? (value as Status) : null;
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function registerModelProvider(modelId: string) {
  await postJson('/api/model-providers/providers', {
    provider: PROVIDER_ID,
    api: 'openai-completions',
    baseUrl: BASE_URL,
    apiKey: 'local',
    authHeader: false,
    compat: { stream: true },
  });
  await postJson(`/api/model-providers/providers/${encodeURIComponent(PROVIDER_ID)}/models`, {
    modelId,
    name: modelId.split('/').pop() || modelId,
    api: 'openai-completions',
    baseUrl: BASE_URL,
    reasoning: true,
    input: ['text'],
    contextWindow: 131072,
  });
}

async function tryRegisterModelProvider(modelId: string) {
  try {
    await registerModelProvider(modelId);
  } catch {
    // The local API may be unavailable in extension preview/testing contexts.
    // Saving the selected model should still succeed; setup/start will use extension storage.
  }
}

function statusTone(status: Status | null, busy: string | null) {
  if (busy || status?.setup?.status === 'running') return 'warning';
  if (status?.server.reachable) return 'running';
  if (status?.installed) return 'ready';
  return 'muted';
}

export class QwenMlxPage extends React.Component<ExtensionSurfaceProps, PageState> {
  state: PageState = {
    status: null,
    busy: null,
    error: null,
    modelInput: '',
    prompt: 'Write a tiny TypeScript function that reverses a string.',
    output: '',
    searchQuery: '',
    searchResults: [],
    searchBusy: false,
    logsOpen: false,
  };
  private timer: number | null = null;

  componentDidMount() {
    void this.refresh(true);
    this.timer = window.setInterval(() => void this.refresh(), 5000);
  }

  componentWillUnmount() {
    if (this.timer !== null) window.clearInterval(this.timer);
  }

  private refresh = async (syncInput = false) => {
    try {
      const status = asStatus(await this.props.pa.extension.invoke('mlxStatus', {}));
      this.setState((prev) => ({
        status,
        error: null,
        modelInput: syncInput && status ? status.selectedModelId : prev.modelInput || status?.selectedModelId || '',
      }));
    } catch (err) {
      this.setState({ error: err instanceof Error ? err.message : String(err) });
    }
  };

  private run = async (label: string, action: () => Promise<void>) => {
    this.setState({ busy: label, error: null });
    try {
      await action();
      await this.refresh();
      const modelId = this.state.status?.selectedModelId || this.state.modelInput.trim();
      if (modelId) await tryRegisterModelProvider(modelId);
    } catch (err) {
      this.setState({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      this.setState({ busy: null });
    }
  };

  private toggleServer = async () => {
    const { status } = this.state;
    const shouldStop = status?.server.reachable || status?.process.managedRunning;
    await this.run(shouldStop ? 'Stopping…' : 'Starting…', async () => {
      await this.props.pa.extension.invoke(shouldStop ? 'mlxStop' : 'mlxStart', {});
    });
  };

  private saveModel = async (modelId = this.state.modelInput) => {
    await this.run('Saving…', async () => {
      await this.props.pa.extension.invoke('mlxSetModel', { modelId: modelId.trim() });
    });
  };

  private setupModel = async () => {
    await this.run('Downloading…', async () => {
      await this.props.pa.extension.invoke('mlxSetup', { modelId: this.state.modelInput.trim() });
    });
  };

  private searchModels = async () => {
    const query = this.state.searchQuery.trim();
    if (!query) return;
    this.setState({ searchBusy: true, error: null });
    try {
      const response = (await this.props.pa.extension.invoke('mlxSearchModels', { query })) as { models?: SearchResult[] };
      this.setState({ searchResults: response.models ?? [] });
    } catch (err) {
      this.setState({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      this.setState({ searchBusy: false });
    }
  };

  private runPrompt = async () => {
    const model = this.state.status?.loadedModelId || this.state.modelInput.trim();
    this.setState({ busy: 'Running prompt…', output: '', error: null });
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: this.state.prompt }], stream: false }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      this.setState({ output: result.choices?.[0]?.message?.content || JSON.stringify(result, null, 2) });
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : String(err),
        output: 'Prompt failed. Check that the runtime is enabled.',
      });
    } finally {
      this.setState({ busy: null });
    }
  };

  render() {
    const { status, busy, error, modelInput, prompt, output, searchQuery, searchResults, searchBusy, logsOpen } = this.state;
    const running = Boolean(status?.server.reachable);
    const starting = Boolean(status?.process.managedRunning && !running);
    const setupRunning = status?.setup?.status === 'running';
    const ready = Boolean(status?.installed);
    const progress = Math.max(0, Math.min(100, Math.round(status?.setup?.progress ?? (ready ? 100 : 0))));
    const loadedModel = status?.loadedModelId || 'None';
    const title = running ? 'Running' : starting ? 'Starting' : setupRunning ? 'Downloading' : ready ? 'Ready' : 'Needs setup';
    const message =
      busy || error || status?.setup?.error || status?.server.error || status?.setup?.message || 'Local MLX runtime workspace';

    return (
      <RuntimePage>
        <RuntimeHeader
          title="✨ MLX Models"
          summary="Run Hugging Face MLX models locally and test them before using them in chat."
          status={title}
          tone={statusTone(status, busy)}
          metadata={['Backend: MLX', `Loaded: ${loadedModel}`, `Endpoint: ${BASE_URL}`]}
          message={message}
          progress={setupRunning || progress > 0 ? progress : null}
          actions={
            <>
              <ToolbarButton disabled={Boolean(busy)} onClick={() => void this.refresh()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton disabled={Boolean(busy || setupRunning || !ready)} onClick={() => void this.toggleServer()}>
                {running || starting ? 'Stop Runtime' : 'Start Runtime'}
              </ToolbarButton>
            </>
          }
        />

        <RuntimeWorkspace
          left={
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary">Models</h2>
                <ToolbarButton disabled={Boolean(busy || setupRunning || !modelInput.trim())} onClick={() => void this.setupModel()}>
                  Setup / Download
                </ToolbarButton>
              </div>

              <label className="mt-4 block space-y-2 text-sm">
                <span className="text-secondary">Selected Model</span>
                <input
                  name="mlx-model-id"
                  autoComplete="off"
                  value={modelInput}
                  disabled={running || starting || Boolean(busy)}
                  onChange={(event) => this.setState({ modelInput: event.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent disabled:opacity-60"
                  placeholder="org/model-name-MLX…"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <ToolbarButton disabled={Boolean(busy || running || starting || !modelInput.trim())} onClick={() => void this.saveModel()}>
                  Save Selection
                </ToolbarButton>
              </div>

              <div className="my-5 border-t border-border-subtle" />

              <div className="space-y-3">
                <label className="block space-y-2 text-sm">
                  <span className="text-secondary">Search Hugging Face</span>
                  <div className="flex gap-2">
                    <input
                      name="mlx-model-search"
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(event) => this.setState({ searchQuery: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void this.searchModels();
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
                      placeholder="Qwen MLX…"
                    />
                    <ToolbarButton disabled={searchBusy || !searchQuery.trim()} onClick={() => void this.searchModels()}>
                      {searchBusy ? 'Searching…' : 'Search'}
                    </ToolbarButton>
                  </div>
                </label>

                <div className="divide-y divide-border-subtle border-y border-border-subtle text-sm">
                  {searchResults.length > 0 ? (
                    searchResults.map((model) => (
                      <div key={model.id} className="py-3">
                        <button
                          type="button"
                          disabled={running || starting}
                          onClick={() => this.setState({ modelInput: model.id })}
                          className="block max-w-full truncate text-left font-medium text-primary hover:text-accent focus-visible:text-accent disabled:opacity-60"
                        >
                          {model.id}
                        </button>
                        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-secondary">
                          <span>{model.downloads.toLocaleString()} downloads</span>
                          <button
                            type="button"
                            disabled={Boolean(busy || running || starting)}
                            onClick={() => void this.saveModel(model.id)}
                            className="text-accent hover:text-primary disabled:opacity-60"
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-secondary">Search for models like “Qwen MLX” or “Llama 4bit”.</p>
                  )}
                </div>
              </div>
            </>
          }
          right={
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Test Prompt</h2>
                  <p className="text-sm text-secondary">Run a quick smoke test against the local OpenAI-compatible endpoint.</p>
                </div>
                <ToolbarButton disabled={Boolean(busy || !running || !prompt.trim())} onClick={() => void this.runPrompt()}>
                  {busy === 'Running prompt…' ? 'Running…' : 'Run Prompt'}
                </ToolbarButton>
              </div>
              <label className="mt-4 block space-y-2 text-sm">
                <span className="text-secondary">Prompt</span>
                <textarea
                  name="mlx-test-prompt"
                  autoComplete="off"
                  value={prompt}
                  onChange={(event) => this.setState({ prompt: event.target.value })}
                  className="min-h-28 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-primary outline-none focus-visible:border-accent"
                  placeholder="Ask the local model something…"
                />
              </label>
              <div className="mt-4 min-h-0 flex-1">
                <TerminalBlock>
                  {output || (running ? 'Prompt output will appear here.' : 'Start the runtime to test prompts.')}
                </TerminalBlock>
              </div>
            </>
          }
        />

        <RuntimeFooter
          summary={`Runtime: MLX · Selected: ${status?.selectedModelId || modelInput || 'None'} · Logs`}
          open={logsOpen}
          onToggle={() => this.setState((prev) => ({ logsOpen: !prev.logsOpen }))}
        >
          <TerminalBlock>{status?.log?.trim() || 'No logs yet.'}</TerminalBlock>
        </RuntimeFooter>
      </RuntimePage>
    );
  }
}

export default QwenMlxPage;
