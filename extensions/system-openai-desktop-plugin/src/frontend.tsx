import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { LoadingState, Notice, Pill, SettingsPanel, SettingsRow, SupportingText, ToolbarButton } from '@neon-pilot/extensions/settings';
import React, { useCallback, useEffect, useState } from 'react';

interface PluginStatus {
  installed: boolean;
  pluginInstalled: boolean;
  marketplaceEntryInstalled: boolean;
  marketplaceName: string;
  marketplaceRoot: string;
  marketplacePath: string;
  pluginPath: string;
  installedVersion?: string | null;
  codex?: {
    checked?: boolean;
    marketplaceRegistered?: boolean;
    pluginInstalled?: boolean;
    pluginEnabled?: boolean;
    mcp?: {
      checked?: boolean;
      serverName?: string;
      registered?: boolean;
      tools?: string[];
      detail?: string;
    };
  };
}

const EMPTY_STATUS: PluginStatus = {
  installed: false,
  pluginInstalled: false,
  marketplaceEntryInstalled: false,
  marketplaceName: 'neon-pilot-local',
  marketplaceRoot: '',
  marketplacePath: '',
  pluginPath: '',
  installedVersion: null,
  codex: { checked: false },
};

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergeStatus(value: unknown): PluginStatus {
  return { ...EMPTY_STATUS, ...(value && typeof value === 'object' ? (value as Partial<PluginStatus>) : {}) };
}

export function hasInstallArtifacts(status: PluginStatus): boolean {
  return (
    status.pluginInstalled ||
    status.marketplaceEntryInstalled ||
    status.codex?.pluginInstalled === true ||
    status.codex?.marketplaceRegistered === true ||
    status.codex?.mcp?.registered === true
  );
}

export function OpenAiDesktopPluginSettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  const [status, setStatus] = useState<PluginStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await pa.extension.invoke('status', {});
    setStatus(mergeStatus(next));
  }, [pa]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((loadError) => {
        if (!cancelled) setError(readError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function run(action: 'installPlugin' | 'removePlugin', input: Record<string, unknown>, success: string) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      await pa.extension.invoke(action, input);
      await load();
      setMessage(success);
    } catch (actionError) {
      setError(readError(actionError));
    } finally {
      setBusy(null);
    }
  }

  const codexInstalled = status.codex?.checked
    ? status.codex.pluginInstalled === true && status.codex.pluginEnabled === true
    : status.installed;
  const installed = status.installed && codexInstalled;
  const mcpRegistered = status.codex?.mcp?.registered === true;
  const mcpTools = status.codex?.mcp?.tools ?? [];
  const hasInstalledArtifacts = hasInstallArtifacts(status);

  return (
    <>
      {loading ? <LoadingState label="Loading OpenAI Desktop plugin status..." /> : null}
      {!loading ? (
        <>
          <SettingsPanel title="Status">
            <SettingsRow title="Plugin">
              <Pill tone={installed ? 'success' : 'neutral'}>{installed ? 'Installed' : 'Not installed'}</Pill>
            </SettingsRow>
            <SettingsRow title="Codex plugin">
              <Pill tone={codexInstalled ? 'success' : 'neutral'}>{codexInstalled ? 'Enabled' : 'Not enabled'}</Pill>
            </SettingsRow>
            <SettingsRow title="MCP server">
              <Pill tone={mcpRegistered ? 'success' : 'neutral'}>{mcpRegistered ? 'Registered' : 'Not registered'}</Pill>
            </SettingsRow>
          </SettingsPanel>

          {error ? <Notice tone="danger">{error}</Notice> : null}
          {message ? <Notice tone="success">{message}</Notice> : null}

          <SettingsPanel title="Actions">
            <SettingsRow title="Install" description="Install or refresh the Codex plugin and MCP server registration.">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ToolbarButton
                  disabled={busy !== null || installed}
                  onClick={() => void run('installPlugin', {}, 'Neon Pilot plugin installed in Codex.')}
                >
                  Install
                </ToolbarButton>
                <ToolbarButton
                  disabled={busy !== null}
                  onClick={() => void run('installPlugin', { force: true }, 'Neon Pilot plugin reinstalled in Codex.')}
                >
                  Reinstall
                </ToolbarButton>
                <ToolbarButton
                  disabled={busy !== null || !hasInstalledArtifacts}
                  onClick={() => void run('removePlugin', {}, 'Neon Pilot plugin removed from Codex.')}
                >
                  Remove
                </ToolbarButton>
                <ToolbarButton disabled={busy !== null} onClick={() => void load()}>
                  Refresh
                </ToolbarButton>
              </div>
            </SettingsRow>
          </SettingsPanel>

          <SettingsPanel title="Files">
            <SettingsRow title="Version" description={status.installedVersion ?? '0.1.1'} />
            <SettingsRow title="Marketplace" description={status.marketplaceRoot || 'Not created yet'} />
            <SettingsRow title="Plugin source" description={status.pluginPath || 'Not created yet'} />
            <SettingsRow title="Marketplace manifest" description={status.marketplacePath || 'Not created yet'} />
          </SettingsPanel>

          <SettingsPanel title="MCP tools">
            <SettingsRow title="Exposed tools" description={mcpTools.length > 0 ? mcpTools.join(', ') : 'No tools reported yet.'} />
          </SettingsPanel>

          <SupportingText>
            Install writes a local Codex marketplace, registers it with `codex plugin marketplace add`, and installs
            `neon-pilot@neon-pilot-local`. It also registers a Desktop-visible `neon-pilot` MCP entry with `codex mcp add`. Reinstall
            refreshes the generated plugin files before asking Codex to install the plugin again.
          </SupportingText>
        </>
      ) : null}
    </>
  );
}
