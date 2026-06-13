import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  Button,
  ErrorState,
  LoadingState,
  Pill,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import './frontend.css';

interface GatewayStatus {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  models: number;
  defaultModel: string;
  lastError?: string;
}

const DEFAULT_STATUS: GatewayStatus = {
  running: false,
  host: '127.0.0.1',
  port: 8766,
  baseUrl: 'http://127.0.0.1:8766/v1',
  models: 0,
  defaultModel: 'auto',
};

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ModelGatewayPage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<GatewayStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [port, setPort] = useState(String(DEFAULT_STATUS.port));
  const [defaultModel, setDefaultModel] = useState(DEFAULT_STATUS.defaultModel);
  const [copied, setCopied] = useState(false);
  const codexConfig = useMemo(
    () =>
      [
        'model_provider = "neon-pilot"',
        `model = "${defaultModel || 'auto'}"`,
        '',
        '[model_providers.neon-pilot]',
        'name = "Neon Pilot Model Gateway"',
        `base_url = "${status.baseUrl}"`,
        'wire_api = "responses"',
        'experimental_bearer_token = "dummy"',
      ].join('\n'),
    [defaultModel, status.baseUrl],
  );

  const refresh = useCallback(async () => {
    const next = (await pa.extension.invoke('status', {})) as GatewayStatus;
    setStatus(next);
    setPort(String(next.port));
    setDefaultModel(next.defaultModel);
  }, [pa]);

  useEffect(() => {
    let cancelled = false;
    void refresh()
      .catch((err) => {
        if (!cancelled) setError(readError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function runAction(action: 'start' | 'stop' | 'smoke') {
    setBusy(action);
    setError('');
    try {
      if (action === 'start') {
        const next = (await pa.extension.invoke('start', {
          port: Number(port),
          defaultModel,
        })) as GatewayStatus;
        setStatus(next);
      } else if (action === 'stop') {
        setStatus((await pa.extension.invoke('stop', {})) as GatewayStatus);
      } else {
        const result = (await pa.extension.invoke('smoke', {})) as { ok?: boolean; status?: GatewayStatus };
        if (result.status) setStatus(result.status);
        pa.ui.notify({
          type: result.ok ? 'success' : 'error',
          source: 'system-model-gateway',
          message: result.ok ? 'Model Gateway smoke passed' : 'Model Gateway smoke failed',
        });
      }
    } catch (err) {
      setError(readError(err));
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
    } catch (err) {
      setError(readError(err));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading Model Gateway..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="Model Gateway"
          eyebrow="External agents"
          summary="OpenAI Responses-compatible loopback endpoint backed by Neon Pilot model providers."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarButton disabled={busy !== null} onClick={() => void refresh()}>
                Refresh
              </ToolbarButton>
              <ToolbarButton disabled={busy !== null} onClick={() => void runAction('smoke')}>
                Smoke
              </ToolbarButton>
              {status.running ? (
                <Button variant="danger" disabled={busy !== null} onClick={() => void runAction('stop')}>
                  Stop
                </Button>
              ) : (
                <Button variant="action" disabled={busy !== null} onClick={() => void runAction('start')}>
                  Start
                </Button>
              )}
            </div>
          }
        />

        {error ? <ErrorState title="Gateway action failed" body={error} /> : null}

        <AppPageSection
          title="Runtime"
          layout="stacked"
          meta={<Pill tone={status.running ? 'success' : 'neutral'}>{status.running ? 'Running' : 'Stopped'}</Pill>}
          bodyClassName="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(12rem,1fr)]">
            <div className="min-w-0">
              <div className="text-xs text-secondary">Endpoint</div>
              <div className="mt-1 truncate font-mono text-sm text-primary">{status.baseUrl}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">Models</div>
              <div className="mt-1 text-sm text-primary">{status.models}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-secondary">Default model</div>
              <div className="mt-1 truncate font-mono text-sm text-primary">{status.defaultModel}</div>
            </div>
          </div>
          {status.lastError ? <p className="text-sm text-danger">{status.lastError}</p> : null}
        </AppPageSection>

        <AppPageSection title="Settings" layout="stacked">
          <div className="grid max-w-3xl gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
            <label className="block">
              <span className="text-xs text-secondary">Port</span>
              <TextInput value={port} onChange={(event) => setPort(event.currentTarget.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-secondary">Default model</span>
              <TextInput value={defaultModel} onChange={(event) => setDefaultModel(event.currentTarget.value)} />
            </label>
          </div>
        </AppPageSection>

        <AppPageSection
          title="Codex CLI Test Config"
          layout="stacked"
          actions={
            <ToolbarButton onClick={() => void copyConfig()}>
              {copied ? 'Copied' : 'Copy'}
            </ToolbarButton>
          }
        >
          <pre className="model-gateway-code">{codexConfig}</pre>
        </AppPageSection>
      </AppPageLayout>
    </div>
  );
}
