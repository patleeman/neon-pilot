import { api, SettingsRow, useApi } from '@neon-pilot/extensions/settings';
import {
  Field,
  Notice,
  Pill,
  RailSubsection,
  RowButton,
  Select,
  SupportingText,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

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
  args: string[];
  cwd: string;
  url: string;
};
type OperationResult = { ok: boolean; message: string; toolCount?: number };

const emptyDraft: ServerDraft = { name: '', transport: 'stdio', command: '', args: [''], cwd: '', url: '' };

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
    args: server.args.length > 0 ? server.args : [''],
    cwd: server.cwd ?? '',
    url: server.url ?? '',
  };
}

function draftFromRawServer(name: string, raw: Record<string, unknown>): ServerDraft {
  const transport = raw.type === 'remote' || (typeof raw.url === 'string' && typeof raw.command !== 'string') ? 'remote' : 'stdio';
  const args = Array.isArray(raw.args) ? raw.args.filter((arg): arg is string => typeof arg === 'string') : [];
  return {
    originalName: name,
    name,
    transport,
    command: typeof raw.command === 'string' ? raw.command : '',
    args: args.length > 0 ? args : [''],
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

  const args = draft.args.map((arg) => arg.trim()).filter(Boolean);
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

function updateDraftArg(draft: ServerDraft, index: number, value: string): ServerDraft {
  return { ...draft, args: draft.args.map((arg, argIndex) => (argIndex === index ? value : arg)) };
}

function removeDraftArg(draft: ServerDraft, index: number): ServerDraft {
  const args = draft.args.filter((_, argIndex) => argIndex !== index);
  return { ...draft, args: args.length > 0 ? args : [''] };
}

function moveDraftArg(draft: ServerDraft, index: number, direction: -1 | 1): ServerDraft {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= draft.args.length) return draft;
  const args = [...draft.args];
  const [arg] = args.splice(index, 1);
  args.splice(targetIndex, 0, arg);
  return { ...draft, args };
}

export function McpSettingsPanel() {
  const { data: mcpState, loading: mcpLoading, error: mcpError, refetch } = useApi(inspectMcpSettings, 'system-mcp-settings');
  const [explicitConfig, setExplicitConfig] = useState<ExplicitMcpConfig>({ mcpServers: {} });
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServerDraft | null>(null);
  const [saveState, setSaveState] = useState<{ busy: boolean; error: string | null; message: string | null }>({
    busy: false,
    error: null,
    message: null,
  });
  const [operation, setOperation] = useState<Record<string, { busy?: boolean; message?: string; error?: string }>>({});
  const savedDraftRef = useRef<string | null>(null);
  const autosaveRequestIdRef = useRef(0);

  useEffect(() => {
    if (mcpState) {
      const nextConfig = parseExplicitConfig(mcpState.explicitConfigJson);
      const nextServerNames = Object.keys(nextConfig.mcpServers).sort((a, b) => a.localeCompare(b));
      const nextSelectedName =
        selectedServerName && nextServerNames.includes(selectedServerName) ? selectedServerName : (nextServerNames[0] ?? null);
      setExplicitConfig(nextConfig);
      setSelectedServerName(nextSelectedName);
      const nextDraft = nextSelectedName ? draftFromRawServer(nextSelectedName, nextConfig.mcpServers[nextSelectedName] ?? {}) : null;
      setDraft(nextDraft);
      savedDraftRef.current = nextDraft ? JSON.stringify(nextDraft) : null;
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
  const selectedRawServer = selectedServerName ? (visibleExplicitConfig.mcpServers[selectedServerName] ?? null) : null;
  const selectedEffectiveServer = selectedServerName
    ? (mcpState?.servers.find((entry) => entry.name === selectedServerName) ?? null)
    : null;
  const selectedDisabled = Boolean(selectedRawServer && (selectedRawServer.disabled === true || selectedRawServer.enabled === false));
  const selectedStatus = selectedServerName ? operation[selectedServerName] : undefined;

  async function persist(nextConfig: ExplicitMcpConfig, message: string) {
    setSaveState({ busy: true, error: null, message: null });
    try {
      await saveExplicitMcpConfig(nextConfig);
      setExplicitConfig(nextConfig);
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
    setSelectedServerName(name);
    await persist({ mcpServers: nextServers }, `${name} saved.`);
  }

  useEffect(() => {
    if (!draft?.originalName || saveState.busy) return undefined;
    const validationError = validateDraft(draft);
    if (validationError) return undefined;
    const serialized = JSON.stringify(draft);
    if (serialized === savedDraftRef.current) return undefined;

    setSaveState({ busy: false, error: null, message: 'Unsaved changes' });
    const timeout = window.setTimeout(() => {
      const requestId = (autosaveRequestIdRef.current += 1);
      const name = draft.name.trim();
      const nextServers = { ...explicitConfig.mcpServers };
      if (draft.originalName && draft.originalName !== name) delete nextServers[draft.originalName];
      const existingServer = draft.originalName ? explicitConfig.mcpServers[draft.originalName] : undefined;
      nextServers[name] = configFromDraft(draft, existingServer as Record<string, unknown> | undefined);
      setSaveState({ busy: true, error: null, message: null });
      void saveExplicitMcpConfig({ mcpServers: nextServers })
        .then(async () => {
          if (autosaveRequestIdRef.current !== requestId) return;
          savedDraftRef.current = JSON.stringify({ ...draft, originalName: name, name });
          setExplicitConfig({ mcpServers: nextServers });
          setSelectedServerName(name);
          setDraft((current) => (current ? { ...current, originalName: name, name } : current));
          await refetch();
          setSaveState({ busy: false, error: null, message: `${name} saved.` });
        })
        .catch((error: unknown) => {
          if (autosaveRequestIdRef.current !== requestId) return;
          setSaveState({ busy: false, error: error instanceof Error ? error.message : String(error), message: null });
        });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [draft, explicitConfig.mcpServers, refetch, saveState.busy]);

  async function removeServer(name: string) {
    const nextServers = { ...explicitConfig.mcpServers };
    delete nextServers[name];
    const nextServerNames = Object.keys(nextServers).sort((a, b) => a.localeCompare(b));
    const nextSelectedName = nextServerNames[0] ?? null;
    setSelectedServerName(nextSelectedName);
    setDraft(nextSelectedName ? draftFromRawServer(nextSelectedName, nextServers[nextSelectedName] ?? {}) : null);
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

  function selectServer(name: string, rawServer: Record<string, unknown>, server?: McpServerConfig) {
    setSelectedServerName(name);
    setDraft(server ? draftFromServer(server) : draftFromRawServer(name, rawServer));
    savedDraftRef.current = JSON.stringify(server ? draftFromServer(server) : draftFromRawServer(name, rawServer));
    setSaveState({ busy: false, error: null, message: null });
  }

  function startNewServerDraft() {
    setSelectedServerName(null);
    setDraft({ ...emptyDraft });
    savedDraftRef.current = null;
    setSaveState({ busy: false, error: null, message: null });
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
              <ToolbarButton
                aria-label="Refresh MCP servers"
                title="Refresh MCP servers"
                disabled={mcpLoading}
                onClick={() => void refetch()}
              >
                <span aria-hidden="true">↻</span>
              </ToolbarButton>
              <ToolbarButton type="button" onClick={startNewServerDraft}>
                Add server
              </ToolbarButton>
            </div>
          </SettingsRow>

          {saveState.error ? <Notice tone="danger">{saveState.error}</Notice> : null}
          {saveState.message ? <Notice tone="success">{saveState.message}</Notice> : null}

          <RailSubsection title="Explicit servers">
            {explicitServers.length > 0 ? (
              explicitServers.map((name) => {
                const server = mcpState.servers.find((entry) => entry.name === name);
                const rawServer = visibleExplicitConfig.mcpServers[name] ?? {};
                const disabled = rawServer.disabled === true || rawServer.enabled === false;
                const selected = selectedServerName === name;
                return (
                  <div key={name} className="space-y-2 border-t border-border-subtle/60 pt-3 first:border-t-0 first:pt-0">
                    <RowButton
                      type="button"
                      aria-pressed={selected}
                      selected={selected}
                      className="block px-3 py-2"
                      onClick={() => selectServer(name, rawServer, server)}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] text-primary">{name}</span>
                        <Pill tone={server?.transport === 'remote' ? 'teal' : 'muted'}>{server?.transport ?? 'config'}</Pill>
                        {disabled ? <Pill tone="muted">disabled</Pill> : null}
                        {server?.hasOAuth ? <Pill tone="accent">oauth</Pill> : null}
                      </span>
                      <span className="ui-supporting-text mt-1 block break-all">
                        {server ? formatMcpServerCommand(server) : disabled ? 'Disabled server' : 'Unparsed server config'}
                      </span>
                    </RowButton>
                  </div>
                );
              })
            ) : (
              <SupportingText>No explicit servers. Add one to create a managed MCP configuration.</SupportingText>
            )}
          </RailSubsection>

          <RailSubsection title={draft?.originalName ? `Server details: ${draft.originalName}` : 'Server details'}>
            {draft ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  if (draft.originalName) {
                    event.preventDefault();
                    return;
                  }
                  void handleSubmitDraft(event);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <TextInput
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      autoComplete="off"
                    />
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
                      <div className="space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12px] font-medium text-secondary">Arguments</span>
                          <ToolbarButton type="button" onClick={() => setDraft({ ...draft, args: [...draft.args, ''] })}>
                            Add argument
                          </ToolbarButton>
                        </div>
                        <div className="space-y-1.5">
                          {draft.args.map((arg, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="w-6 shrink-0 text-right font-mono text-[11px] text-tertiary">{index + 1}</span>
                              <TextInput
                                className="font-mono"
                                aria-label={`Argument ${index + 1}`}
                                value={arg}
                                onChange={(event) => setDraft(updateDraftArg(draft, index, event.target.value))}
                                placeholder={index === 0 ? '--flag or value' : undefined}
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <ToolbarButton type="button" onClick={() => setDraft(moveDraftArg(draft, index, -1))} disabled={index === 0}>
                                Up
                              </ToolbarButton>
                              <ToolbarButton
                                type="button"
                                onClick={() => setDraft(moveDraftArg(draft, index, 1))}
                                disabled={index === draft.args.length - 1}
                              >
                                Down
                              </ToolbarButton>
                              <ToolbarButton type="button" onClick={() => setDraft(removeDraftArg(draft, index))}>
                                <span aria-hidden="true">-</span>
                                Remove
                              </ToolbarButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!draft.originalName ? (
                    <ToolbarButton type="submit" disabled={saveState.busy || Boolean(validateDraft(draft))}>
                      {saveState.busy ? 'Adding…' : 'Add server'}
                    </ToolbarButton>
                  ) : null}
                  {draft.originalName ? (
                    <>
                      <ToolbarButton type="button" onClick={() => void toggleServer(draft.originalName!)} disabled={saveState.busy}>
                        {selectedDisabled ? 'Enable' : 'Disable'}
                      </ToolbarButton>
                      <ToolbarButton
                        type="button"
                        onClick={() => void handleServerAction('testServer', draft.originalName!)}
                        disabled={selectedStatus?.busy || selectedDisabled}
                      >
                        Test
                      </ToolbarButton>
                      {selectedEffectiveServer?.hasOAuth ? (
                        <ToolbarButton
                          type="button"
                          onClick={() => void handleServerAction('authServer', draft.originalName!)}
                          disabled={selectedStatus?.busy}
                        >
                          Auth
                        </ToolbarButton>
                      ) : null}
                      {selectedEffectiveServer?.hasOAuth ? (
                        <ToolbarButton
                          type="button"
                          onClick={() => void handleServerAction('logoutServer', draft.originalName!)}
                          disabled={selectedStatus?.busy}
                        >
                          Logout
                        </ToolbarButton>
                      ) : null}
                      <ToolbarButton
                        type="button"
                        className="text-danger hover:text-danger"
                        onClick={() => void removeServer(draft.originalName!)}
                        disabled={saveState.busy}
                      >
                        <span aria-hidden="true">-</span>
                        Remove
                      </ToolbarButton>
                    </>
                  ) : (
                    <ToolbarButton
                      type="button"
                      onClick={() =>
                        setDraft(selectedServerName && selectedRawServer ? draftFromRawServer(selectedServerName, selectedRawServer) : null)
                      }
                    >
                      Cancel
                    </ToolbarButton>
                  )}
                </div>
                {selectedStatus?.message ? <Notice tone="success">{selectedStatus.message}</Notice> : null}
                {selectedStatus?.error ? <Notice tone="danger">{selectedStatus.error}</Notice> : null}
              </form>
            ) : (
              <SupportingText>Select a server or add one to edit managed MCP configuration.</SupportingText>
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
