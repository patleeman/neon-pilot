import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import React from 'react';

import {
  RuntimeFooter,
  RuntimeHeader,
  RuntimePage,
  RuntimeSection,
  RuntimeStrip,
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
      busy ||
      error ||
      status?.setup?.error ||
      status?.server.error ||
      status?.setup?.message ||
      'Choose a model, set it up, then start the runtime.';

    return (
      <RuntimePage>
        <RuntimeHeader
          title="✨ MLX Models"
          summary="Run Hugging Face MLX models locally and test them before using them in chat."
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

        <RuntimeStrip
          status={title}
          tone={statusTone(status, busy)}
          metadata={[`Backend: MLX`, `Loaded: ${loadedModel}`, `Endpoint: ${BASE_URL}`]}
          message={message}
          progress={setupRunning || progress > 0 ? progress : null}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <label className="block space-y-2 text-sm">
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
            <ToolbarButton disabled={Boolean(busy || running || starting || !modelInput.trim())} onClick={() => void this.saveModel()}>
              Save Selection
            </ToolbarButton>
            <ToolbarButton disabled={Boolean(busy || setupRunning || !modelInput.trim())} onClick={() => void this.setupModel()}>
              Setup / Download
            </ToolbarButton>
          </div>
        </RuntimeStrip>

        <RuntimeSection
          title="Test Prompt"
          description="Run a quick smoke test against the local OpenAI-compatible endpoint."
          action={
            <ToolbarButton disabled={Boolean(busy || !running || !prompt.trim())} onClick={() => void this.runPrompt()}>
              {busy === 'Running prompt…' ? 'Running…' : 'Run Prompt'}
            </ToolbarButton>
          }
        >
          <label className="block space-y-2 text-sm">
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
          <TerminalBlock>{output || (running ? 'Prompt output will appear here.' : 'Start the runtime to test prompts.')}</TerminalBlock>
        </RuntimeSection>

        <RuntimeSection title="Search Hugging Face" description="Find a compatible public MLX model and use its model id above.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              name="mlx-model-search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => this.setState({ searchQuery: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void this.searchModels();
              }}
              className="min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:border-accent"
              placeholder="Qwen MLX…"
            />
            <ToolbarButton disabled={searchBusy || !searchQuery.trim()} onClick={() => void this.searchModels()}>
              {searchBusy ? 'Searching…' : 'Search'}
            </ToolbarButton>
          </div>
          <div className="divide-y divide-border-subtle border-y border-border-subtle text-sm">
            {searchResults.length > 0 ? (
              searchResults.map((model) => (
                <div key={model.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <button
                    type="button"
                    disabled={running || starting}
                    onClick={() => this.setState({ modelInput: model.id })}
                    className="min-w-0 truncate text-left font-medium text-primary hover:text-accent focus-visible:text-accent disabled:opacity-60"
                  >
                    {model.id}
                  </button>
                  <span className="text-xs text-secondary">{model.downloads.toLocaleString()} downloads</span>
                  <button
                    type="button"
                    disabled={Boolean(busy || running || starting)}
                    onClick={() => void this.saveModel(model.id)}
                    className="text-sm text-accent hover:text-primary disabled:opacity-60"
                  >
                    Use
                  </button>
                </div>
              ))
            ) : (
              <p className="py-4 text-secondary">Search for models like “Qwen MLX” or “Llama 4bit”.</p>
            )}
          </div>
        </RuntimeSection>

        <RuntimeFooter
          summary={`Runtime: MLX · Selected: ${status?.selectedModelId || modelInput || 'None'} · Logs`}
          open={logsOpen}
          onToggle={() => this.setState((prev) => ({ logsOpen: !prev.logsOpen }))}
        >
          <TerminalBlock compact>{status?.log?.trim() || 'No logs yet.'}</TerminalBlock>
        </RuntimeFooter>
      </RuntimePage>
    );
  }
}

export default QwenMlxPage;
