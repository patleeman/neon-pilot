import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, AppPageSection, Button, ErrorState, LoadingState, Pill, TextInput } from '@neon-pilot/extensions/ui';
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading Model Gateway..." />
      </div>
    );
  }

  return (
    <AppPageLayout>
      <AppPageIntro
        title="Model Gateway"
        eyebrow="External agents"
        description="Run an OpenAI Responses-compatible loopback endpoint backed by Neon Pilot model providers."
      />

      {error ? <ErrorState title="Gateway action failed" body={error} /> : null}

      <AppPageSection
        title="Runtime"
        actions={
          <div className="flex items-center gap-2">
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
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="text-xs text-secondary">Status</div>
            <div className="mt-1">
              <Pill tone={status.running ? 'success' : 'neutral'}>{status.running ? 'Running' : 'Stopped'}</Pill>
            </div>
          </div>
          <div>
            <div className="text-xs text-secondary">Endpoint</div>
            <div className="mt-1 font-mono text-sm text-primary">{status.baseUrl}</div>
          </div>
          <div>
            <div className="text-xs text-secondary">Models</div>
            <div className="mt-1 text-sm text-primary">{status.models}</div>
          </div>
          <div>
            <div className="text-xs text-secondary">Default model</div>
            <div className="mt-1 font-mono text-sm text-primary">{status.defaultModel}</div>
          </div>
        </div>
        {status.lastError ? <p className="mt-3 text-sm text-danger">{status.lastError}</p> : null}
      </AppPageSection>

      <AppPageSection title="Settings">
        <div className="grid gap-4 md:grid-cols-2">
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

      <AppPageSection title="Codex CLI Test Config">
        <pre className="overflow-auto rounded border border-subtle bg-panel p-3 text-xs text-primary">{codexConfig}</pre>
      </AppPageSection>
    </AppPageLayout>
  );
}
