import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, Button, ErrorState, LoadingState, Pill, TextInput } from '@neon-pilot/extensions/ui';
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
    <AppPageLayout>
      <div className="model-gateway-page">
        <div className="model-gateway-header">
          <AppPageIntro
            title="Model Gateway"
            eyebrow="External agents"
            description="OpenAI Responses-compatible loopback endpoint backed by Neon Pilot model providers."
          />
          <div className="model-gateway-actions">
            <Button variant="secondary" disabled={busy !== null} onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => void runAction('smoke')}>
              Smoke
            </Button>
            {status.running ? (
              <Button variant="danger" disabled={busy !== null} onClick={() => void runAction('stop')}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" disabled={busy !== null} onClick={() => void runAction('start')}>
                Start
              </Button>
            )}
          </div>
        </div>

        {error ? <ErrorState title="Gateway action failed" body={error} /> : null}

        <section className="model-gateway-panel" aria-labelledby="model-gateway-runtime-title">
          <div className="model-gateway-section-heading">
            <h2 id="model-gateway-runtime-title">Runtime</h2>
            <Pill tone={status.running ? 'success' : 'neutral'}>{status.running ? 'Running' : 'Stopped'}</Pill>
          </div>
          <div className="model-gateway-metrics">
            <div className="model-gateway-metric model-gateway-metric-wide">
              <span>Endpoint</span>
              <code>{status.baseUrl}</code>
            </div>
            <div className="model-gateway-metric">
              <span>Models</span>
              <strong>{status.models}</strong>
            </div>
            <div className="model-gateway-metric">
              <span>Default model</span>
              <code>{status.defaultModel}</code>
            </div>
          </div>
          {status.lastError ? <p className="model-gateway-error">{status.lastError}</p> : null}
        </section>

        <section className="model-gateway-panel" aria-labelledby="model-gateway-settings-title">
          <div className="model-gateway-section-heading">
            <h2 id="model-gateway-settings-title">Settings</h2>
          </div>
          <div className="model-gateway-form-grid">
            <label className="model-gateway-field">
              <span>Port</span>
              <TextInput value={port} onChange={(event) => setPort(event.currentTarget.value)} />
            </label>
            <label className="model-gateway-field">
              <span>Default model</span>
              <TextInput value={defaultModel} onChange={(event) => setDefaultModel(event.currentTarget.value)} />
            </label>
          </div>
        </section>

        <section className="model-gateway-panel" aria-labelledby="model-gateway-config-title">
          <div className="model-gateway-section-heading">
            <h2 id="model-gateway-config-title">Codex CLI Test Config</h2>
            <Button variant="secondary" onClick={() => void copyConfig()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="model-gateway-code">{codexConfig}</pre>
        </section>
      </div>
    </AppPageLayout>
  );
}
