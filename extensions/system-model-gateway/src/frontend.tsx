import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Field,
  LoadingState,
  Notice,
  Pill,
  SupportingText,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import './frontend.css';

interface GatewayLogEntry {
  id: string;
  at: string;
  method: string;
  path: string;
  status: number;
  model?: string;
  durationMs: number;
  error?: string;
}

interface GatewayStatus {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  authToken: string;
  models: number;
  defaultModel: string;
  catalogPath?: string;
  codexConfig?: {
    configPath: string;
    installed: boolean;
    managed: boolean;
    hasNeonPilotProvider: boolean;
    activeProvider?: string;
    activeModel?: string;
    activeCatalogPath?: string;
    catalogPath?: string;
    referenceCheck?: {
      ok: boolean;
      codexPath?: string;
      models?: number;
      hasDefaultModel?: boolean;
      hasFakeModel?: boolean;
      sampleModels?: string[];
      error?: string;
    };
  };
  lastError?: string;
  logs: GatewayLogEntry[];
}

const DEFAULT_STATUS: GatewayStatus = {
  running: false,
  host: '127.0.0.1',
  port: 8766,
  baseUrl: 'http://127.0.0.1:8766/v1',
  authToken: '',
  models: 0,
  defaultModel: 'auto',
  logs: [],
};

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ModelGatewaySettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  const [status, setStatus] = useState<GatewayStatus>(DEFAULT_STATUS);
  const [port, setPort] = useState(String(DEFAULT_STATUS.port));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const codexConfig = useMemo(
    () =>
      [
        ...(status.catalogPath ? [`model_catalog_json = "${status.catalogPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`] : []),
        '',
        '[model_providers.neon-pilot]',
        'name = "Neon Pilot AI Gateway"',
        `base_url = "${status.baseUrl}"`,
        'wire_api = "responses"',
        `experimental_bearer_token = "${status.authToken.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`,
      ].join('\n'),
    [status.authToken, status.baseUrl, status.catalogPath],
  );
  const referenceCheck = status.codexConfig?.referenceCheck;

  const load = useCallback(async () => {
    const next = (await pa.extension.invoke('status', {})) as GatewayStatus;
    setStatus({ ...DEFAULT_STATUS, ...next, logs: next.logs ?? [] });
    setPort(String(next.port));
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

  async function savePort() {
    const nextPort = Number(port);
    if (!Number.isSafeInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
      setError('Port must be a number between 1 and 65535.');
      return;
    }

    setBusy('save');
    setError(null);
    setMessage(null);
    try {
      const next = (await pa.extension.invoke('updateSettings', { port: nextPort })) as GatewayStatus;
      setStatus({ ...DEFAULT_STATUS, ...next, logs: next.logs ?? [] });
      setPort(String(next.port));
      setMessage('AI Gateway port saved.');
    } catch (saveError) {
      setError(readError(saveError));
    } finally {
      setBusy(null);
    }
  }

  async function copyConfig() {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(codexConfig);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      setError(readError(copyError));
    }
  }

  async function installCodexConfig() {
    setBusy('installCodexConfig');
    setError(null);
    setMessage(null);
    try {
      const next = (await pa.extension.invoke('installCodexConfig', {})) as GatewayStatus;
      setStatus({ ...DEFAULT_STATUS, ...next, logs: next.logs ?? [] });
      setMessage('Neon Pilot installed in Codex config.');
    } catch (installError) {
      setError(readError(installError));
    } finally {
      setBusy(null);
    }
  }

  async function removeCodexConfig() {
    setBusy('removeCodexConfig');
    setError(null);
    setMessage(null);
    try {
      const next = (await pa.extension.invoke('removeCodexConfig', {})) as GatewayStatus;
      setStatus({ ...DEFAULT_STATUS, ...next, logs: next.logs ?? [] });
      setMessage('Neon Pilot removed from Codex config.');
    } catch (removeError) {
      setError(readError(removeError));
    } finally {
      setBusy(null);
    }
  }

  async function clearLogs() {
    setBusy('clearLogs');
    setError(null);
    try {
      const next = (await pa.extension.invoke('clearLogs', {})) as GatewayStatus;
      setStatus({ ...DEFAULT_STATUS, ...next, logs: next.logs ?? [] });
    } catch (clearError) {
      setError(readError(clearError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
        {loading ? <LoadingState label="Loading AI Gateway settings..." /> : null}

        {!loading ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_8rem_10rem]">
              <div className="min-w-0">
                <div className="ui-card-meta">Endpoint</div>
                <div className="mt-1 truncate font-mono text-[13px] text-primary">{status.baseUrl}</div>
              </div>
              <div>
                <div className="ui-card-meta">Status</div>
                <div className="mt-1">
                  <Pill tone={status.running ? 'success' : 'danger'}>{status.running ? 'Running' : 'Unavailable'}</Pill>
                </div>
              </div>
              <div>
                <div className="ui-card-meta">Models</div>
                <div className="mt-1 text-[13px] text-primary">{status.models}</div>
              </div>
            </div>

            {status.lastError ? <Notice tone="danger">{status.lastError}</Notice> : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            {message ? <Notice tone="success">{message}</Notice> : null}

            <div className="grid gap-3 md:grid-cols-[12rem_auto] md:items-end">
              <Field label="Port" hint="Changing the port restarts the local listener.">
                <TextInput
                  id="settings-model-gateway-port"
                  value={port}
                  inputMode="numeric"
                  onChange={(event) => setPort(event.currentTarget.value)}
                  onBlur={() => {
                    if (port !== String(status.port)) void savePort();
                  }}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <ToolbarButton disabled={busy !== null} onClick={() => void load()}>
                  Refresh
                </ToolbarButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-primary">Codex config</div>
                  <SupportingText>
                    {status.codexConfig?.installed
                      ? `Catalog installed in ${status.codexConfig.configPath}`
                      : `Not installed in ${status.codexConfig?.configPath ?? '~/.codex/config.toml'}`}
                  </SupportingText>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ToolbarButton disabled={busy === 'installCodexConfig'} onClick={() => void installCodexConfig()}>
                    {status.codexConfig?.installed ? 'Reinstall' : 'Install'}
                  </ToolbarButton>
                  <ToolbarButton disabled={busy === 'removeCodexConfig' || !status.codexConfig?.installed} onClick={() => void removeCodexConfig()}>
                    Remove
                  </ToolbarButton>
                  <ToolbarButton onClick={() => void copyConfig()}>{copied ? 'Copied' : 'Copy'}</ToolbarButton>
                </div>
              </div>
              {referenceCheck ? (
                <Notice tone={referenceCheck.ok ? 'success' : 'warning'}>
                  {referenceCheck.ok
                    ? `Codex app-server sees ${referenceCheck.models ?? 0} gateway models without changing the active provider. Current Desktop builds may still hide them in the picker.`
                    : `Codex reference check failed: ${referenceCheck.error ?? 'gateway models were not found in Codex debug models.'}`}
                </Notice>
              ) : status.codexConfig?.installed ? (
                <Notice tone="warning">
                  Catalog installed. Current Codex Desktop builds may still hide custom catalog models in the conversation picker.
                </Notice>
              ) : null}
              <pre className="model-gateway-code">{codexConfig}</pre>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-primary">Recent activity</div>
                  <SupportingText>Latest loopback requests and errors from this app session.</SupportingText>
                </div>
                <ToolbarButton disabled={busy === 'clearLogs' || status.logs.length === 0} onClick={() => void clearLogs()}>
                  Clear logs
                </ToolbarButton>
              </div>
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Time</DataTableHeaderCell>
                    <DataTableHeaderCell>Route</DataTableHeaderCell>
                    <DataTableHeaderCell>Model</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Duration</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {status.logs.length === 0 ? (
                    <DataTableEmptyRow colSpan={5}>No gateway activity yet.</DataTableEmptyRow>
                  ) : (
                    status.logs.slice(0, 12).map((entry) => (
                      <DataTableRow key={entry.id}>
                        <DataTableCell>{formatTime(entry.at)}</DataTableCell>
                        <DataTableCell>
                          <span className="font-mono text-[12px]">
                            {entry.method} {entry.path}
                          </span>
                        </DataTableCell>
                        <DataTableCell>{entry.model || 'auto'}</DataTableCell>
                        <DataTableCell>{entry.error ? `${entry.status} · ${entry.error}` : entry.status}</DataTableCell>
                        <DataTableCell align="right">{entry.durationMs}ms</DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </div>
          </div>
        ) : null}
    </div>
  );
}
