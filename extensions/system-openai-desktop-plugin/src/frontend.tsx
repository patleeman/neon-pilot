import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { LoadingState, Notice, Pill, SettingsSection, SupportingText, ToolbarButton } from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useState } from 'react';

import './frontend.css';

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

  const codexInstalled = status.codex?.checked ? status.codex.pluginInstalled === true && status.codex.pluginEnabled === true : status.installed;
  const installed = status.installed && codexInstalled;
  const mcpRegistered = status.codex?.mcp?.registered === true;
  const mcpTools = status.codex?.mcp?.tools ?? [];

  return (
    <div className="openai-desktop-plugin-settings">
      <SettingsSection title="OpenAI Desktop Plugin" description="Install the focused Neon Pilot plugin for Codex and OpenAI Desktop.">
        {loading ? <LoadingState label="Loading OpenAI Desktop plugin status..." /> : null}
        {!loading ? (
          <div className="space-y-5">
            <div className="openai-desktop-plugin-status-grid">
              <div>
                <div className="ui-card-meta">Plugin</div>
                <div className="mt-1">
                  <Pill tone={installed ? 'success' : 'neutral'}>{installed ? 'Installed' : 'Not installed'}</Pill>
                </div>
              </div>
              <div>
                <div className="ui-card-meta">Codex plugin</div>
                <div className="mt-1">
                  <Pill tone={codexInstalled ? 'success' : 'neutral'}>{codexInstalled ? 'Enabled' : 'Not enabled'}</Pill>
                </div>
              </div>
              <div>
                <div className="ui-card-meta">MCP server</div>
                <div className="mt-1">
                  <Pill tone={mcpRegistered ? 'success' : 'neutral'}>{mcpRegistered ? 'Registered' : 'Not registered'}</Pill>
                </div>
              </div>
            </div>

            {error ? <Notice tone="danger">{error}</Notice> : null}
            {message ? <Notice tone="success">{message}</Notice> : null}

            <div className="flex flex-wrap items-center gap-2">
              <ToolbarButton disabled={busy !== null || installed} onClick={() => void run('installPlugin', {}, 'Neon Pilot plugin installed in Codex.')}>
                Install
              </ToolbarButton>
              <ToolbarButton
                disabled={busy !== null}
                onClick={() => void run('installPlugin', { force: true }, 'Neon Pilot plugin reinstalled in Codex.')}
              >
                Reinstall
              </ToolbarButton>
              <ToolbarButton disabled={busy !== null || !status.installed} onClick={() => void run('removePlugin', {}, 'Neon Pilot plugin removed from Codex.')}>
                Remove
              </ToolbarButton>
              <ToolbarButton disabled={busy !== null} onClick={() => void load()}>
                Refresh
              </ToolbarButton>
            </div>

            <div className="openai-desktop-plugin-paths">
              <div>
                <div className="ui-card-meta">Version</div>
                <div className="openai-desktop-plugin-path">{status.installedVersion ?? '0.1.0'}</div>
              </div>
              <div>
                <div className="ui-card-meta">Marketplace</div>
                <div className="openai-desktop-plugin-path">{status.marketplaceRoot || 'Not created yet'}</div>
              </div>
              <div>
                <div className="ui-card-meta">Plugin source</div>
                <div className="openai-desktop-plugin-path">{status.pluginPath || 'Not created yet'}</div>
              </div>
              <div>
                <div className="ui-card-meta">Marketplace manifest</div>
                <div className="openai-desktop-plugin-path">{status.marketplacePath || 'Not created yet'}</div>
              </div>
            </div>

            <div className="openai-desktop-plugin-tools">
              <div className="ui-card-meta">MCP tools exposed in Codex</div>
              <div className="openai-desktop-plugin-tool-list">
                {mcpTools.length > 0 ? mcpTools.map((tool) => <code key={tool}>{tool}</code>) : <span>No tools reported yet.</span>}
              </div>
            </div>

            <SupportingText>
              Install writes a local Codex marketplace, registers it with `codex plugin marketplace add`, and installs `neon-pilot@neon-pilot-local`.
              Reinstall refreshes the generated plugin files before asking Codex to install the plugin again.
            </SupportingText>
          </div>
        ) : null}
      </SettingsSection>
    </div>
  );
}
