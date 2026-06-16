import {
  api,
  Field,
  Notice,
  Pill,
  RailSubsection,
  Select,
  SettingsRow,
  SupportingText,
  Textarea,
  TextInput,
  ToolbarButton,
  useApi,
} from '@neon-pilot/extensions/settings';
import React, { type FormEvent, useEffect, useMemo, useState } from 'react';

type McpServerConfig = {
  name: string;
  transport: 'stdio' | 'remote';
  command?: string;
  args: string[];
  cwd?: string;
  url?: string;
  source?: 'config' | 'skill';
  sourcePath?: string;
  skillName?: string;
  skillPath?: string;
  manifestPath?: string;
  hasOAuth?: boolean;
  callbackUrl?: string;
  authorizeResource?: string;
  raw: Record<string, unknown>;
};

type McpSettingsState = {
  configPath: string;
  configExists: boolean;
  searchedPaths: string[];
  explicitConfigJson: string;
  servers: McpServerConfig[];
  bundledSkills: Array<{
    skillName: string;
    skillPath: string;
    manifestPath: string;
    serverNames: string[];
    overriddenServerNames: string[];
  }>;
};

type ExplicitMcpConfig = { mcpServers: Record<string, Record<string, unknown>> };
type ServerDraft = {
  originalName?: string;
  name: string;
  transport: 'stdio' | 'remote';
  command: string;
  args: string;
  cwd: string;
  url: string;
};
type OperationResult = { ok: boolean; message: string; toolCount?: number };

const emptyDraft: ServerDraft = { name: '', transport: 'stdio', command: '', args: '', cwd: '', url: '' };

async function inspectMcpSettings(): Promise<McpSettingsState> {
  const response = await api.invokeExtensionAction('system-mcp', 'inspectSettings', {});
  return response.result as McpSettingsState;
}

async function saveExplicitMcpConfig(config: ExplicitMcpConfig): Promise<McpSettingsState> {
  const response = await api.invokeExtensionAction('system-mcp', 'saveExplicitConfig', { json: JSON.stringify(config, null, 2) });
  return response.result as McpSettingsState;
}

async function runServerAction(action: 'testServer' | 'authServer' | 'logoutServer', server: string): Promise<OperationResult> {
  const response = await api.invokeExtensionAction('system-mcp', action, { server });
  return response.result as OperationResult;
}

function parseExplicitConfig(json: string): ExplicitMcpConfig {
  const parsed = JSON.parse(json) as { mcpServers?: unknown };
  const mcpServers =
    parsed.mcpServers && typeof parsed.mcpServers === 'object' && !Array.isArray(parsed.mcpServers) ? parsed.mcpServers : {};
  return { mcpServers: mcpServers as Record<string, Record<string, unknown>> };
}

function draftFromServer(server: McpServerConfig): ServerDraft {
  return {
    originalName: server.name,
    name: server.name,
    transport: server.transport,
    command: server.command ?? '',
    args: server.args.join('\n'),
    cwd: server.cwd ?? '',
    url: server.url ?? '',
  };
}

function draftFromRawServer(name: string, raw: Record<string, unknown>): ServerDraft {
  const transport = raw.type === 'remote' || (typeof raw.url === 'string' && typeof raw.command !== 'string') ? 'remote' : 'stdio';
  const args = Array.isArray(raw.args) ? raw.args.filter((arg): arg is string => typeof arg === 'string').join('\n') : '';
  return {
    originalName: name,
    name,
    transport,
    command: typeof raw.command === 'string' ? raw.command : '',
    args,
    cwd: typeof raw.cwd === 'string' ? raw.cwd : '',
    url: typeof raw.url === 'string' ? raw.url : '',
  };
}

function configFromDraft(draft: ServerDraft, existing?: Record<string, unknown>): Record<string, unknown> {
  // When editing an existing server, preserve fields the form doesn't
  // expose (env, headers, oauth, etc.) so editing name/command doesn't
  // silently drop advanced config.
  const base = existing ? { ...existing } : {};
  delete base.command;
  delete base.args;
  delete base.cwd;
  delete base.type;
  delete base.url;

  if (draft.transport === 'remote') {
    return { ...base, type: 'remote', url: draft.url.trim() };
  }

  const args = draft.args
    .split('\n')
    .map((arg) => arg.trim())
    .filter(Boolean);
  return {
    ...base,
    command: draft.command.trim(),
    ...(args.length > 0 ? { args } : {}),
    ...(draft.cwd.trim() ? { cwd: draft.cwd.trim() } : {}),
  };
}

function validateDraft(draft: ServerDraft): string | null {
  if (!draft.name.trim()) return 'Server name is required.';
  if (!/^[a-zA-Z0-9._-]+$/.test(draft.name.trim())) return 'Server name can only use letters, numbers, dot, underscore, and dash.';
  if (draft.transport === 'remote' && !draft.url.trim()) return 'Remote URL is required.';
  if (draft.transport === 'stdio' && !draft.command.trim()) return 'Command is required.';
  return null;
}

function formatMcpServerCommand(server: McpServerConfig): string {
  if (server.transport === 'remote') return server.url ?? 'Remote endpoint';
  const commandLine = [server.command, ...server.args].filter((value): value is string => Boolean(value?.trim()));
  return commandLine.length > 0 ? commandLine.join(' ') : 'Local stdio wrapper';
}

export function McpSettingsPanel() {
  const { data: mcpState, loading: mcpLoading, error: mcpError, refetch } = useApi(inspectMcpSettings, 'system-mcp-settings');
  const [explicitConfig, setExplicitConfig] = useState<ExplicitMcpConfig>({ mcpServers: {} });
  const [draft, setDraft] = useState<ServerDraft | null>(null);
  const [saveState, setSaveState] = useState<{ busy: boolean; error: string | null; message: string | null }>({
    busy: false,
    error: null,
    message: null,
  });
  const [operation, setOperation] = useState<Record<string, { busy?: boolean; message?: string; error?: string }>>({});

  useEffect(() => {
    if (mcpState) {
      setExplicitConfig(parseExplicitConfig(mcpState.explicitConfigJson));
      setDraft(null);
      setSaveState({ busy: false, error: null, message: null });
    }
  }, [mcpState?.explicitConfigJson]);

  const visibleExplicitConfig = useMemo(
    () => (mcpState ? parseExplicitConfig(mcpState.explicitConfigJson) : explicitConfig),
    [explicitConfig, mcpState],
  );
  const explicitServers = useMemo(
    () => Object.keys(visibleExplicitConfig.mcpServers).sort((a, b) => a.localeCompare(b)),
    [visibleExplicitConfig],
  );

  async function persist(nextConfig: ExplicitMcpConfig, message: string) {
    setSaveState({ busy: true, error: null, message: null });
    try {
      await saveExplicitMcpConfig(nextConfig);
      await refetch();
      setSaveState({ busy: false, error: null, message });
    } catch (error) {
      setSaveState({ busy: false, error: error instanceof Error ? error.message : String(error), message: null });
    }
  }

  async function handleSubmitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setSaveState({ busy: false, error: validationError, message: null });
      return;
    }

    const name = draft.name.trim();
    const nextServers = { ...explicitConfig.mcpServers };
    if (draft.originalName && draft.originalName !== name) delete nextServers[draft.originalName];
    const existingServer = draft.originalName ? explicitConfig.mcpServers[draft.originalName] : undefined;
    nextServers[name] = configFromDraft(draft, existingServer as Record<string, unknown> | undefined);
    await persist({ mcpServers: nextServers }, `${name} saved.`);
  }

  async function removeServer(name: string) {
    const nextServers = { ...explicitConfig.mcpServers };
    delete nextServers[name];
    await persist({ mcpServers: nextServers }, `${name} removed.`);
  }

  async function toggleServer(name: string) {
    const current = explicitConfig.mcpServers[name];
    if (!current) return;
    const disabled = current.disabled === true || current.enabled === false;
    const nextServers = { ...explicitConfig.mcpServers, [name]: { ...current, disabled: !disabled } };
    delete nextServers[name].enabled;
    await persist({ mcpServers: nextServers }, `${name} ${disabled ? 'enabled' : 'disabled'}.`);
  }

  async function handleServerAction(action: 'testServer' | 'authServer' | 'logoutServer', server: string) {
    setOperation((current) => ({ ...current, [server]: { busy: true } }));
    const result = await runServerAction(action, server).catch((error: unknown) => ({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }));
    setOperation((current) => ({ ...current, [server]: result.ok ? { message: result.message } : { error: result.message } }));
  }

  return (
    <div className="space-y-5">
      {mcpLoading && !mcpState ? (
        <SupportingText>Loading MCP servers…</SupportingText>
      ) : mcpError && !mcpState ? (
        <p className="text-[12px] text-danger">Failed to load MCP servers: {mcpError}</p>
      ) : mcpState ? (
        <div className="space-y-5">
          <SettingsRow
            title="Explicit config"
            description={<span className="break-all font-mono text-[11px]">{mcpState.configPath}</span>}
            actionsClassName="max-w-none"
          >
            <div className="flex items-center gap-2">
              <ToolbarButton type="button" disabled={mcpLoading} onClick={() => void refetch()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton type="button" onClick={() => setDraft({ ...emptyDraft })}>
                Add server
              </ToolbarButton>
            </div>
          </SettingsRow>

          {saveState.error ? <Notice tone="danger">{saveState.error}</Notice> : null}
          {saveState.message ? <Notice tone="success">{saveState.message}</Notice> : null}

          {draft ? (
            <form className="space-y-3 border-t border-border-subtle/60 pt-3" onSubmit={handleSubmitDraft}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoComplete="off" />
                </Field>
                <Field label="Transport">
                  <Select
                    value={draft.transport}
                    onChange={(event) => setDraft({ ...draft, transport: event.target.value as 'stdio' | 'remote' })}
                  >
                    <option value="stdio">Local command</option>
                    <option value="remote">Remote URL</option>
                  </Select>
                </Field>
                {draft.transport === 'remote' ? (
                  <Field label="URL">
                    <TextInput
                      value={draft.url}
                      onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                      placeholder="https://example.com/mcp…"
                      autoComplete="off"
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Command">
                      <TextInput
                        value={draft.command}
                        onChange={(event) => setDraft({ ...draft, command: event.target.value })}
                        placeholder="node, npx, uvx…"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Working directory">
                      <TextInput
                        value={draft.cwd}
                        onChange={(event) => setDraft({ ...draft, cwd: event.target.value })}
                        placeholder="Optional…"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Args, one per line">
                      <Textarea
                        className="min-h-24 font-mono"
                        value={draft.args}
                        onChange={(event) => setDraft({ ...draft, args: event.target.value })}
                      />
                    </Field>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <ToolbarButton type="submit" disabled={saveState.busy || Boolean(validateDraft(draft))}>
                  {saveState.busy ? 'Saving…' : 'Save server'}
                </ToolbarButton>
                <ToolbarButton type="button" onClick={() => setDraft(null)}>
                  Cancel
                </ToolbarButton>
              </div>
            </form>
          ) : null}

          <RailSubsection title="Explicit servers">
            {explicitServers.length > 0 ? (
              explicitServers.map((name) => {
                const server = mcpState.servers.find((entry) => entry.name === name);
                const rawServer = visibleExplicitConfig.mcpServers[name] ?? {};
                const disabled = rawServer.disabled === true || rawServer.enabled === false;
                const status = operation[name];
                return (
                  <div key={name} className="space-y-2 border-t border-border-subtle/60 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-primary">{name}</span>
                      <Pill tone={server?.transport === 'remote' ? 'teal' : 'muted'}>{server?.transport ?? 'config'}</Pill>
                      {disabled ? <Pill tone="muted">disabled</Pill> : null}
                      {server?.hasOAuth ? <Pill tone="accent">oauth</Pill> : null}
                      <span className="ui-supporting-text break-all">
                        {server ? formatMcpServerCommand(server) : disabled ? 'Disabled server' : 'Unparsed server config'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ToolbarButton
                        type="button"
                        onClick={() => setDraft(server ? draftFromServer(server) : draftFromRawServer(name, rawServer))}
                      >
                        Edit
                      </ToolbarButton>
                      <ToolbarButton type="button" onClick={() => void toggleServer(name)} disabled={saveState.busy}>
                        {disabled ? 'Enable' : 'Disable'}
                      </ToolbarButton>
                      <ToolbarButton
                        type="button"
                        onClick={() => void handleServerAction('testServer', name)}
                        disabled={status?.busy || disabled}
                      >
                        Test
                      </ToolbarButton>
                      {server?.hasOAuth ? (
                        <ToolbarButton type="button" onClick={() => void handleServerAction('authServer', name)} disabled={status?.busy}>
                          Auth
                        </ToolbarButton>
                      ) : null}
                      {server?.hasOAuth ? (
                        <ToolbarButton type="button" onClick={() => void handleServerAction('logoutServer', name)} disabled={status?.busy}>
                          Logout
                        </ToolbarButton>
                      ) : null}
                      <ToolbarButton
                        type="button"
                        className="text-danger hover:text-danger"
                        onClick={() => void removeServer(name)}
                        disabled={saveState.busy}
                      >
                        Remove
                      </ToolbarButton>
                    </div>
                    {status?.message ? <Notice tone="success">{status.message}</Notice> : null}
                    {status?.error ? <Notice tone="danger">{status.error}</Notice> : null}
                  </div>
                );
              })
            ) : (
              <SupportingText>No explicit servers. Add one above to create a managed MCP configuration.</SupportingText>
            )}
          </RailSubsection>

          <RailSubsection title="Skill-bundled servers">
            {mcpState.bundledSkills.length > 0 ? (
              mcpState.bundledSkills.map((bundle) => (
                <div key={bundle.manifestPath} className="space-y-1.5 border-t border-border-subtle/60 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-medium text-primary">{bundle.skillName}</span>
                    <span className="ui-supporting-text">
                      {bundle.serverNames.length} server{bundle.serverNames.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <SupportingText className="break-all">
                    <span className="font-mono text-[11px]">{bundle.manifestPath}</span>
                  </SupportingText>
                  <SupportingText className="break-all">
                    <span className="font-mono text-[11px]">{bundle.serverNames.join(', ')}</span>
                  </SupportingText>
                  {bundle.overriddenServerNames.length > 0 ? (
                    <p className="text-[12px] text-secondary">
                      Overridden by explicit config:{' '}
                      <span className="font-mono text-[11px]">{bundle.overriddenServerNames.join(', ')}</span>
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <SupportingText>No skill-local mcp.json wrappers found in the active skill set.</SupportingText>
            )}
          </RailSubsection>
        </div>
      ) : null}
    </div>
  );
}
