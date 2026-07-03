import './frontend.css';

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
  Notice,
  Pill,
  QuietLoadingState,
  SupportingText,
  TextInput,
  ToolbarButton,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedField,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedStateBlock,
  WindowedTextInput,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
  lastError?: string;
  logs: GatewayLogEntry[];
}

interface GatewayConfigRow {
  label: string;
  value: string;
  secret?: boolean;
}

type ModelGatewaySettingsContext = {
  shellPresentation?: 'stable' | 'windowed';
};

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

function readClipboardCopyError(error: unknown): string {
  const message = readError(error);
  if (/clipboard/i.test(message) || /writeText/i.test(message) || error instanceof DOMException) {
    return 'Could not copy the config. Copy the setup values manually from the rows below.';
  }
  return message;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatGatewayConfigRows(status: GatewayStatus): GatewayConfigRow[] {
  return [
    { label: 'Base URL', value: status.baseUrl },
    { label: 'Auth token', value: status.authToken, secret: true },
    { label: 'Default model', value: status.defaultModel },
    ...(status.catalogPath ? [{ label: 'Model catalog', value: status.catalogPath }] : []),
  ];
}

export function formatGatewayClientConfig(status: GatewayStatus): string {
  return formatGatewayConfigRows(status)
    .map((row) => {
      const key =
        row.label === 'Base URL'
          ? 'base_url'
          : row.label === 'Auth token'
            ? 'auth_token'
            : row.label === 'Default model'
              ? 'default_model'
              : 'model_catalog';
      return `${key}=${JSON.stringify(row.value)}`;
    })
    .join('\n');
}

export function ModelGatewaySettingsPanel({
  pa,
  settingsContext,
}: {
  pa: NativeExtensionClient;
  settingsContext?: ModelGatewaySettingsContext;
}) {
  const [status, setStatus] = useState<GatewayStatus>(DEFAULT_STATUS);
  const [port, setPort] = useState(String(DEFAULT_STATUS.port));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = React.useRef<number | null>(null);

  const gatewayConfigRows = useMemo(() => formatGatewayConfigRows(status), [status]);
  const gatewayConfig = useMemo(() => formatGatewayClientConfig(status), [status]);

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

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, []);

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
      await navigator.clipboard.writeText(gatewayConfig);
      setCopied(true);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimeoutRef.current = null;
      }, 1600);
    } catch (copyError) {
      setError(readClipboardCopyError(copyError));
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

  if (settingsContext?.shellPresentation === 'windowed') {
    return (
      <WindowedPageShell layout="standard" className="model-gateway-page-windowed">
        <WindowedPageMain title="AI Gateway">
          <div className="grid gap-3">
            {loading ? <WindowedStateBlock>Loading AI Gateway settings.</WindowedStateBlock> : null}

            {!loading ? (
              <>
                <WindowedPageSection title="Loopback endpoint" meta={status.running ? 'Running' : 'Unavailable'}>
                  <WindowedKeyValueGrid
                    columns={3}
                    items={[
                      {
                        label: 'Status',
                        value: (
                          <WindowedBadge tone={status.running ? 'positive' : 'danger'}>
                            {status.running ? 'Running' : 'Unavailable'}
                          </WindowedBadge>
                        ),
                      },
                      { label: 'Endpoint', value: status.baseUrl },
                      { label: 'Models', value: String(status.models) },
                      { label: 'Default model', value: status.defaultModel },
                      { label: 'Port', value: String(status.port) },
                      { label: 'Host', value: status.host },
                    ]}
                  />
                </WindowedPageSection>

                {status.lastError ? (
                  <WindowedPageSection>
                    <WindowedStateBlock tone="danger">{status.lastError}</WindowedStateBlock>
                  </WindowedPageSection>
                ) : null}
                {error ? (
                  <WindowedPageSection>
                    <WindowedStateBlock tone="danger">{error}</WindowedStateBlock>
                  </WindowedPageSection>
                ) : null}
                {message ? (
                  <WindowedPageSection>
                    <WindowedStateBlock tone="positive">{message}</WindowedStateBlock>
                  </WindowedPageSection>
                ) : null}

                <WindowedPageSection title="Listener" meta="Local port">
                  <div className="grid gap-3 md:grid-cols-[minmax(14rem,18rem)_auto] md:items-end">
                    <WindowedField label="Port" hint="Changing the port restarts the local listener.">
                      <WindowedTextInput
                        id="settings-model-gateway-port"
                        value={port}
                        inputMode="numeric"
                        onChange={(event) => setPort(event.currentTarget.value)}
                        onBlur={() => {
                          if (port !== String(status.port)) void savePort();
                        }}
                      />
                    </WindowedField>
                    <div className="flex flex-wrap items-center gap-2">
                      <WindowedPageButton disabled={busy !== null} onClick={() => void load()}>
                        Refresh
                      </WindowedPageButton>
                      <WindowedPageButton tone="accent" disabled={busy === 'save'} onClick={() => void savePort()}>
                        {busy === 'save' ? 'Saving' : 'Save port'}
                      </WindowedPageButton>
                    </div>
                  </div>
                </WindowedPageSection>

                <WindowedPageSection title="Codex client setup" meta={copied ? 'Copied' : 'Responses compatible'}>
                  <div className="grid gap-3">
                    <WindowedKeyValueList
                      items={gatewayConfigRows.map((row) => ({
                        label: row.label,
                        value: row.secret && row.value ? '••••••••••••••••' : row.value || 'not set',
                      }))}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <WindowedPageButton onClick={() => void copyConfig()}>{copied ? 'Copied' : 'Copy config'}</WindowedPageButton>
                    </div>
                  </div>
                </WindowedPageSection>

                <WindowedPageSection title="Recent activity" meta={`${status.logs.length} retained`}>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <WindowedPageButton
                        tone="danger"
                        disabled={busy === 'clearLogs' || status.logs.length === 0}
                        onClick={() => void clearLogs()}
                      >
                        Clear logs
                      </WindowedPageButton>
                    </div>
                    {status.logs.length === 0 ? (
                      <WindowedEmptyState>No gateway activity yet.</WindowedEmptyState>
                    ) : (
                      <WindowedDataTable
                        columns={[{ label: 'Route' }, { label: 'Status' }, { label: 'Duration', align: 'right' }]}
                        columnTemplate="minmax(16rem, 1fr) minmax(6.5rem, 0.38fr) minmax(6rem, 0.32fr)"
                      >
                        {status.logs.slice(0, 12).map((entry) => (
                          <WindowedDataRow
                            key={entry.id}
                            name={`${entry.method} ${entry.path}`}
                            meta={`${formatTime(entry.at)} · ${entry.model || 'auto'}`}
                            status={
                              <WindowedBadge tone={entry.error ? 'danger' : entry.status >= 400 ? 'warning' : 'positive'}>
                                {entry.error ? `${entry.status} error` : entry.status}
                              </WindowedBadge>
                            }
                            action={`${entry.durationMs}ms`}
                          />
                        ))}
                      </WindowedDataTable>
                    )}
                  </div>
                </WindowedPageSection>
              </>
            ) : null}
          </div>
        </WindowedPageMain>
      </WindowedPageShell>
    );
  }

  return (
    <div className="space-y-5">
      {loading ? <QuietLoadingState label="Loading AI Gateway settings" className="min-h-12" /> : null}

      {!loading ? (
        <div className="space-y-5">
          <div className="model-gateway-status-grid">
            {[
              ['Status', status.running ? 'Running' : 'Unavailable'],
              ['Endpoint', status.baseUrl],
              ['Models', String(status.models)],
              ['Default model', status.defaultModel],
              ['Port', String(status.port)],
            ].map(([label, value]) => (
              <div key={label} className="model-gateway-status-row">
                <span className="text-dim">{label}</span>
                <span className="min-w-0 truncate text-primary">
                  {label === 'Status' ? <Pill tone={status.running ? 'success' : 'danger'}>{value}</Pill> : value}
                </span>
              </div>
            ))}
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
              <ToolbarButton
                aria-label="Refresh model gateway"
                title="Refresh model gateway"
                disabled={busy !== null}
                onClick={() => void load()}
              >
                <span aria-hidden="true">↻</span>
              </ToolbarButton>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-primary">Codex client setup</div>
                <SupportingText>Copy these values into an OpenAI Responses-compatible client profile.</SupportingText>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton onClick={() => void copyConfig()}>{copied ? 'Copied' : 'Copy Codex config'}</ToolbarButton>
              </div>
            </div>
            <div className="model-gateway-config-rows">
              {gatewayConfigRows.map((row) => (
                <div key={row.label} className="model-gateway-config-row">
                  <span className="text-dim">{row.label}</span>
                  <span className="min-w-0 truncate font-mono text-[12px] text-primary">
                    {row.secret && row.value ? '••••••••••••••••' : row.value || 'not set'}
                  </span>
                </div>
              ))}
            </div>
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
