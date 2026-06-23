import {
  api,
  cx,
  Field,
  Notice,
  Pill,
  RailSubsection,
  Select,
  SettingsRow,
  SupportingText,
  Switch,
  TextInput,
  ToolbarButton,
  useApi,
} from '@neon-pilot/extensions/settings';
import React, { type FormEvent, useMemo, useState } from 'react';

type SourceKind = 'git' | 'local';

type AgentPlugin = {
  id: string;
  displayName: string;
  ecosystem: 'codex' | 'claude' | 'unknown';
  enabled: boolean;
  autoUpdate: boolean;
  status: 'added' | 'enabled' | 'disabled' | 'update-available' | 'update-blocked' | 'error';
  source: {
    kind: SourceKind;
    url?: string;
    path: string;
    ref?: string;
    resolvedCommit?: string;
  };
  capabilities: {
    skills: Array<{ id: string; path: string }>;
    mcp: Array<{ path: string }>;
    hooks: Array<{ path: string; kind: string }>;
    docs: Array<{ path: string }>;
  };
  compatibility: {
    detectedEcosystem: 'codex' | 'claude' | 'unknown';
    supported: string[];
    ignored: string[];
    warnings: string[];
    blockers: string[];
  };
  wrapperExtensionId?: string;
  lastCheckedAt?: string;
  availableUpdate?: { commit: string; checkedAt: string };
  lastError?: string;
};

type PluginsState = {
  plugins: AgentPlugin[];
  storageRoot: string;
};

type AddDraft = {
  sourceKind: SourceKind;
  source: string;
};

type OperationState = {
  busy: boolean;
  message: string | null;
  error: string | null;
};

const emptyDraft: AddDraft = { sourceKind: 'git', source: '' };

async function listPlugins(): Promise<PluginsState> {
  const response = await api.invokeExtensionAction('system-agent-plugins', 'listPlugins', {});
  return response.result as PluginsState;
}

async function invoke<T>(action: string, input: unknown): Promise<T> {
  const response = await api.invokeExtensionAction('system-agent-plugins', action, input);
  return response.result as T;
}

function ecosystemLabel(ecosystem: AgentPlugin['ecosystem']): string {
  if (ecosystem === 'codex') return 'Codex';
  if (ecosystem === 'claude') return 'Claude';
  return 'Unknown';
}

function statusTone(status: AgentPlugin['status']): 'accent' | 'muted' | 'warning' | 'danger' | 'teal' {
  if (status === 'enabled') return 'teal';
  if (status === 'update-available') return 'warning';
  if (status === 'update-blocked' || status === 'error') return 'danger';
  if (status === 'added') return 'accent';
  return 'muted';
}

function pluginSourceLabel(plugin: AgentPlugin): string {
  if (plugin.source.kind === 'git') return plugin.source.url ?? plugin.source.path;
  return plugin.source.path;
}

function capabilitySummary(plugin: AgentPlugin): string {
  const parts: string[] = [];
  if (plugin.capabilities.skills.length) {
    parts.push(`${plugin.capabilities.skills.length} skill${plugin.capabilities.skills.length === 1 ? '' : 's'}`);
  }
  if (plugin.capabilities.mcp.length) {
    parts.push(`${plugin.capabilities.mcp.length} MCP server${plugin.capabilities.mcp.length === 1 ? '' : 's'}`);
  }
  if (plugin.capabilities.docs.length) {
    parts.push(`${plugin.capabilities.docs.length} doc${plugin.capabilities.docs.length === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No supported capabilities';
}

export function AgentPluginsSettingsPanel() {
  const { data, loading, error, refetch } = useApi(listPlugins, 'system-agent-plugins');
  const [draft, setDraft] = useState<AddDraft>(emptyDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<OperationState>({ busy: false, message: null, error: null });

  const plugins = data?.plugins ?? [];
  const selectedPlugin = useMemo(() => plugins.find((plugin) => plugin.id === selectedId) ?? plugins[0] ?? null, [plugins, selectedId]);

  async function runOperation<T>(message: string, action: () => Promise<T>) {
    setOperation({ busy: true, message: null, error: null });
    try {
      const result = await action();
      await refetch();
      setOperation({ busy: false, message, error: null });
      return result;
    } catch (err) {
      setOperation({ busy: false, message: null, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  async function handleAddPlugin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = draft.source.trim();
    if (!source) {
      setOperation({ busy: false, message: null, error: 'Plugin source is required.' });
      return;
    }
    const result = await runOperation('Plugin added and enabled.', () =>
      invoke<{ plugin: AgentPlugin }>('addPlugin', {
        sourceKind: draft.sourceKind,
        source,
      }),
    );
    if (result?.plugin) {
      setDraft(emptyDraft);
      setSelectedId(result.plugin.id);
    }
  }

  async function chooseLocalDirectory() {
    setOperation({ busy: true, message: null, error: null });
    try {
      const picked = await api.pickFolder({ prompt: 'Choose plugin directory' });
      setOperation({ busy: false, message: null, error: null });
      if (!picked.cancelled && picked.path) {
        setDraft((current) => ({ ...current, sourceKind: 'local', source: picked.path }));
      }
    } catch (err) {
      setOperation({ busy: false, message: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function togglePlugin(plugin: AgentPlugin) {
    await runOperation(`${plugin.displayName} ${plugin.enabled ? 'disabled' : 'enabled'}.`, () =>
      invoke('setPluginEnabled', { id: plugin.id, enabled: !plugin.enabled }),
    );
  }

  async function toggleAutoUpdate(plugin: AgentPlugin) {
    await runOperation(`${plugin.displayName} auto update ${plugin.autoUpdate ? 'disabled' : 'enabled'}.`, () =>
      invoke('setPluginAutoUpdate', { id: plugin.id, autoUpdate: !plugin.autoUpdate }),
    );
  }

  async function checkUpdates(plugin?: AgentPlugin) {
    await runOperation(plugin ? `Checked ${plugin.displayName}.` : 'Checked all plugins.', () =>
      invoke('checkPluginUpdates', plugin ? { id: plugin.id } : {}),
    );
  }

  async function updateSelectedPlugin(plugin: AgentPlugin) {
    await runOperation(`Updated ${plugin.displayName}.`, () => invoke('updatePlugin', { id: plugin.id }));
  }

  async function removeSelectedPlugin(plugin: AgentPlugin) {
    await runOperation(`Removed ${plugin.displayName}.`, () => invoke('removePlugin', { id: plugin.id }));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      {loading && !data ? (
        <SupportingText>Loading plugins...</SupportingText>
      ) : error && !data ? (
        <p className="text-[12px] text-danger">Failed to load plugins: {error}</p>
      ) : data ? (
        <>
          {operation.error ? <Notice tone="danger">{operation.error}</Notice> : null}
          {operation.message ? <Notice tone="success">{operation.message}</Notice> : null}

          <RailSubsection title="Add a plugin">
            <form className="space-y-3" onSubmit={handleAddPlugin}>
              <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
                <Field label="Source">
                  <Select
                    value={draft.sourceKind}
                    onChange={(event) => setDraft({ ...draft, sourceKind: event.target.value as SourceKind })}
                  >
                    <option value="git">Git URL</option>
                    <option value="local">Local folder</option>
                  </Select>
                </Field>
                <Field label={draft.sourceKind === 'git' ? 'URL' : 'Folder'}>
                  <TextInput
                    value={draft.source}
                    onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                    placeholder={draft.sourceKind === 'git' ? 'https://github.com/owner/plugin' : '/path/to/plugin'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  {draft.sourceKind === 'local' ? (
                    <ToolbarButton type="button" disabled={operation.busy} onClick={() => void chooseLocalDirectory()}>
                      Pick folder
                    </ToolbarButton>
                  ) : null}
                  <ToolbarButton type="submit" disabled={operation.busy || !draft.source.trim()}>
                    {operation.busy ? 'Adding...' : 'Add'}
                  </ToolbarButton>
                </div>
              </div>
              <SupportingText>
                Ecosystem (Codex or Claude) is detected automatically from the plugin files. Plugins are enabled immediately when added.
              </SupportingText>
            </form>
          </RailSubsection>

          <RailSubsection title="Installed plugins">
            {plugins.length > 0 ? (
              <div className="space-y-2">
                {plugins.map((plugin) => {
                  const selected = selectedPlugin?.id === plugin.id;
                  return (
                    <button
                      key={plugin.id}
                      type="button"
                      aria-pressed={selected}
                      className={cx('ui-selectable-card', selected && 'ui-selectable-card-selected')}
                      onClick={() => setSelectedId(plugin.id)}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-primary">{plugin.displayName}</span>
                        <Pill tone={plugin.ecosystem === 'claude' ? 'accent' : plugin.ecosystem === 'codex' ? 'teal' : 'muted'}>
                          {ecosystemLabel(plugin.ecosystem)}
                        </Pill>
                        <Pill tone={statusTone(plugin.status)}>{plugin.status.replace(/-/g, ' ')}</Pill>
                        {plugin.autoUpdate ? <Pill tone="warning">auto update</Pill> : null}
                      </span>
                      <span className="ui-supporting-text mt-1 block break-all">{pluginSourceLabel(plugin)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <SupportingText>
                No plugins installed. Add a Codex or Claude Code plugin repository to give agents its skills and MCP servers.
              </SupportingText>
            )}
          </RailSubsection>

          <RailSubsection title={selectedPlugin ? selectedPlugin.displayName : 'Plugin details'}>
            {selectedPlugin ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingsRow
                    title="Available to agents"
                    description={
                      selectedPlugin.enabled
                        ? 'Skills and instructions from this plugin are available to agents.'
                        : 'Skills and instructions are installed but not available to agents.'
                    }
                  >
                    <Switch checked={selectedPlugin.enabled} onCheckedChange={() => void togglePlugin(selectedPlugin)} />
                  </SettingsRow>
                  <SettingsRow title="Auto update" description="Download and apply Git updates automatically after validation.">
                    <Switch checked={selectedPlugin.autoUpdate} onCheckedChange={() => void toggleAutoUpdate(selectedPlugin)} />
                  </SettingsRow>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ToolbarButton type="button" disabled={operation.busy} onClick={() => void checkUpdates(selectedPlugin)}>
                    Check for updates
                  </ToolbarButton>
                  <ToolbarButton
                    type="button"
                    disabled={operation.busy || selectedPlugin.source.kind !== 'git' || !selectedPlugin.availableUpdate}
                    onClick={() => void updateSelectedPlugin(selectedPlugin)}
                  >
                    Update
                  </ToolbarButton>
                  <ToolbarButton
                    type="button"
                    className="text-danger hover:text-danger"
                    disabled={operation.busy}
                    onClick={() => void removeSelectedPlugin(selectedPlugin)}
                  >
                    Remove
                  </ToolbarButton>
                </div>

                <div className="text-[12px] text-secondary">
                  <span className="break-all">{pluginSourceLabel(selectedPlugin)}</span>
                  {selectedPlugin.source.resolvedCommit ? (
                    <span className="ml-2 font-mono text-[11px] text-muted">@{selectedPlugin.source.resolvedCommit.slice(0, 10)}</span>
                  ) : null}
                  {selectedPlugin.availableUpdate ? (
                    <span className="ml-2 font-mono text-[11px] text-warning">
                      {' -> '}@{selectedPlugin.availableUpdate.commit.slice(0, 10)}
                    </span>
                  ) : null}
                </div>

                <div className="text-[12px] text-secondary">{capabilitySummary(selectedPlugin)}</div>

                {selectedPlugin.compatibility.warnings.length > 0 ? (
                  <Notice tone="warning">{selectedPlugin.compatibility.warnings.join(' ')}</Notice>
                ) : null}
                {selectedPlugin.compatibility.blockers.length > 0 ? (
                  <Notice tone="danger">{selectedPlugin.compatibility.blockers.join(' ')}</Notice>
                ) : null}
                {selectedPlugin.lastError ? <Notice tone="danger">{selectedPlugin.lastError}</Notice> : null}
              </div>
            ) : (
              <SupportingText>Select a plugin to inspect its status and settings.</SupportingText>
            )}
          </RailSubsection>
        </>
      ) : null}
    </div>
  );
}
