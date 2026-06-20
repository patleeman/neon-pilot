import {
  api,
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

type PluginEcosystem = 'auto' | 'codex' | 'claude';
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
  ref: string;
  ecosystem: PluginEcosystem;
};

type OperationState = {
  busy: boolean;
  message: string | null;
  error: string | null;
};

const emptyDraft: AddDraft = { sourceKind: 'git', source: '', ref: '', ecosystem: 'auto' };

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

function formatCommit(commit?: string): string {
  return commit ? commit.slice(0, 10) : 'unresolved';
}

function pluginSourceLabel(plugin: AgentPlugin): string {
  if (plugin.source.kind === 'git') return plugin.source.url ?? plugin.source.path;
  return plugin.source.path;
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
    const result = await runOperation('Plugin added. Review the compatibility report before enabling it.', () =>
      invoke<{ plugin: AgentPlugin }>('addPlugin', {
        sourceKind: draft.sourceKind,
        source,
        ref: draft.ref.trim() || undefined,
        ecosystem: draft.ecosystem,
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
    await runOperation(plugin ? `Checked ${plugin.displayName}.` : 'Checked agent plugins.', () =>
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
        <SupportingText>Loading agent plugins...</SupportingText>
      ) : error && !data ? (
        <p className="text-[12px] text-danger">Failed to load agent plugins: {error}</p>
      ) : data ? (
        <>
          <SettingsRow
            title="Plugin storage"
            description={<span className="break-all font-mono text-[11px]">{data.storageRoot}</span>}
            actionsClassName="max-w-none"
          >
            <div className="flex items-center gap-2">
              <ToolbarButton type="button" disabled={loading || operation.busy} onClick={() => void refetch()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton type="button" disabled={operation.busy} onClick={() => void checkUpdates()}>
                Check updates
              </ToolbarButton>
            </div>
          </SettingsRow>

          {operation.error ? <Notice tone="danger">{operation.error}</Notice> : null}
          {operation.message ? <Notice tone="success">{operation.message}</Notice> : null}

          <RailSubsection title="Add plugin">
            <form className="space-y-3" onSubmit={handleAddPlugin}>
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]">
                <Field label="Source">
                  <Select
                    value={draft.sourceKind}
                    onChange={(event) => setDraft({ ...draft, sourceKind: event.target.value as SourceKind })}
                  >
                    <option value="git">Git</option>
                    <option value="local">Local</option>
                  </Select>
                </Field>
                <Field label={draft.sourceKind === 'git' ? 'Git URL' : 'Directory'}>
                  <TextInput
                    value={draft.source}
                    onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                    placeholder={draft.sourceKind === 'git' ? 'https://github.com/owner/plugin' : '/path/to/plugin'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Ecosystem">
                  <Select
                    value={draft.ecosystem}
                    onChange={(event) => setDraft({ ...draft, ecosystem: event.target.value as PluginEcosystem })}
                  >
                    <option value="auto">Auto</option>
                    <option value="codex">Codex</option>
                    <option value="claude">Claude</option>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Field label="Ref">
                  <TextInput
                    value={draft.ref}
                    onChange={(event) => setDraft({ ...draft, ref: event.target.value })}
                    placeholder="Optional branch, tag, or commit"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={draft.sourceKind !== 'git'}
                  />
                </Field>
                <div className="flex items-end">
                  <ToolbarButton type="button" disabled={operation.busy} onClick={() => void chooseLocalDirectory()}>
                    Pick folder
                  </ToolbarButton>
                </div>
                <div className="flex items-end">
                  <ToolbarButton type="submit" disabled={operation.busy || !draft.source.trim()}>
                    {operation.busy ? 'Working...' : 'Add plugin'}
                  </ToolbarButton>
                </div>
              </div>
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
                      className={`w-full rounded-md border px-3 py-2 text-left transition ${
                        selected
                          ? 'border-accent/60 bg-accent/10'
                          : 'border-border-subtle/70 bg-surface-muted/20 hover:border-border-subtle'
                      }`}
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
                No agent plugins installed. Add a Codex or Claude plugin repository to import agent capabilities.
              </SupportingText>
            )}
          </RailSubsection>

          <RailSubsection title={selectedPlugin ? `Plugin details: ${selectedPlugin.displayName}` : 'Plugin details'}>
            {selectedPlugin ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingsRow
                    title="Available to agents"
                    description={
                      selectedPlugin.enabled
                        ? 'Skills and agent instructions from this plugin are available.'
                        : 'Skills and agent instructions are discovered but not available.'
                    }
                  >
                    <Switch checked={selectedPlugin.enabled} onCheckedChange={() => void togglePlugin(selectedPlugin)} />
                  </SettingsRow>
                  <SettingsRow title="Auto update" description="Applies clean Git updates after validation.">
                    <Switch checked={selectedPlugin.autoUpdate} onCheckedChange={() => void toggleAutoUpdate(selectedPlugin)} />
                  </SettingsRow>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ToolbarButton type="button" disabled={operation.busy} onClick={() => void checkUpdates(selectedPlugin)}>
                    Check
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

                <div className="grid gap-2 text-[12px]">
                  <div className="break-all text-secondary">
                    Source: <span className="font-mono text-[11px] text-primary">{pluginSourceLabel(selectedPlugin)}</span>
                  </div>
                  <div className="text-secondary">
                    Current ref:{' '}
                    <span className="font-mono text-[11px] text-primary">{formatCommit(selectedPlugin.source.resolvedCommit)}</span>
                    {selectedPlugin.availableUpdate ? (
                      <>
                        {' -> '}
                        <span className="font-mono text-[11px] text-warning">{formatCommit(selectedPlugin.availableUpdate.commit)}</span>
                      </>
                    ) : null}
                  </div>
                  {selectedPlugin.wrapperExtensionId ? (
                    <div className="break-all text-secondary">
                      Wrapper extension: <span className="font-mono text-[11px] text-primary">{selectedPlugin.wrapperExtensionId}</span>
                    </div>
                  ) : null}
                </div>

                <CapabilityList title="Skills" entries={selectedPlugin.capabilities.skills.map((skill) => `${skill.id} - ${skill.path}`)} />
                <CapabilityList title="MCP declarations" entries={selectedPlugin.capabilities.mcp.map((entry) => entry.path)} />
                <CapabilityList title="Docs" entries={selectedPlugin.capabilities.docs.map((entry) => entry.path)} />
                <CapabilityList
                  title="Indexed hooks"
                  entries={selectedPlugin.capabilities.hooks.map((hook) => `${hook.kind} - ${hook.path}`)}
                />

                <CompatibilityReport plugin={selectedPlugin} />
              </div>
            ) : (
              <SupportingText>Select a plugin to inspect imported capabilities, update state, and compatibility warnings.</SupportingText>
            )}
          </RailSubsection>
        </>
      ) : null}
    </div>
  );
}

function CapabilityList({ title, entries }: { title: string; entries: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-secondary">{title}</div>
      {entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry} className="break-all font-mono text-[11px] text-primary">
              {entry}
            </div>
          ))}
        </div>
      ) : (
        <SupportingText>None detected.</SupportingText>
      )}
    </div>
  );
}

function CompatibilityReport({ plugin }: { plugin: AgentPlugin }) {
  const rows = [
    ['Detected', ecosystemLabel(plugin.compatibility.detectedEcosystem)],
    ['Supported', plugin.compatibility.supported.join(', ') || 'None'],
    ['Ignored', plugin.compatibility.ignored.join(', ') || 'None'],
    ['Warnings', plugin.compatibility.warnings.join(', ') || 'None'],
    ['Blockers', plugin.compatibility.blockers.join(', ') || 'None'],
  ];
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-secondary">Compatibility</div>
      <div className="rounded-md border border-border-subtle/70">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-t border-border-subtle/60 px-3 py-2 first:border-t-0"
          >
            <span className="text-[12px] text-secondary">{label}</span>
            <span className="break-words text-[12px] text-primary">{value}</span>
          </div>
        ))}
      </div>
      {plugin.lastError ? <Notice tone="danger">{plugin.lastError}</Notice> : null}
    </div>
  );
}
