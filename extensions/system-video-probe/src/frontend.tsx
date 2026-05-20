import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

type ServerHealth = { reachable: boolean; models?: string[] };
type ProcessState = { serverPid: number | null; serverRunning: boolean; setupPid: number | null; setupRunning: boolean };

type Status = {
  ok: boolean;
  modelId: string;
  baseUrl: string;
  runtimeInstalled: boolean;
  venvReady: boolean;
  server: ServerHealth;
  process: ProcessState;
  log: string;
};

export function VideoProbePage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = (await pa.extension.invoke('videoProbeStatus', {})) as Status;
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa]);

  useEffect(() => {
    void fetchStatus();
    pollRef.current = setInterval(() => void fetchStatus(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  async function invoke(actionId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = (await pa.extension.invoke(actionId, {})) as { ok: boolean; error?: string; status?: Status };
      if (result.status) setStatus(result.status);
      if (!result.ok && result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const setupRunning = status?.process.setupRunning ?? false;
  const serverRunning = status?.process.serverRunning ?? false;
  const serverReachable = status?.server.reachable ?? false;
  const runtimeInstalled = status?.runtimeInstalled ?? false;

  return (
    <AppPageLayout title="Video Probe" description="Analyze video files with a video-capable model.">
      <AppPageIntro
        title="Video Probe"
        description="Enables the probe_video agent tool. Uses mlx-vlm to run Nemotron Nano Omni locally on Apple Silicon, or routes to OpenRouter for cloud inference. Configure the backend in Settings → Video Probe."
      />

      {error && <div style={{ color: 'var(--color-error)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Status row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, fontSize: 13 }}>
        <div>
          <strong>Runtime:</strong> {!status ? '…' : runtimeInstalled ? '✅ mlx-vlm installed' : '❌ Not installed'}
        </div>
        <div>
          <strong>Model:</strong> {status?.modelId ?? '…'}
        </div>
        <div>
          <strong>Server:</strong>{' '}
          {!status
            ? '…'
            : serverReachable
              ? `✅ Running (${status.server.models?.[0] ?? 'ready'})`
              : serverRunning
                ? '⏳ Starting…'
                : '⏹ Stopped'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {!runtimeInstalled || setupRunning ? (
          <ToolbarButton onClick={() => void invoke('videoProbeSetup')} disabled={busy || setupRunning}>
            {setupRunning ? 'Setting up…' : 'Set Up (install + download model)'}
          </ToolbarButton>
        ) : null}

        {runtimeInstalled && !serverReachable && !serverRunning && (
          <ToolbarButton onClick={() => void invoke('videoProbeStart')} disabled={busy}>
            Start Server
          </ToolbarButton>
        )}

        {(serverRunning || serverReachable) && (
          <ToolbarButton onClick={() => void invoke('videoProbeStop')} disabled={busy}>
            Stop Server
          </ToolbarButton>
        )}

        <ToolbarButton onClick={() => void fetchStatus()} disabled={busy}>
          Refresh
        </ToolbarButton>
      </div>

      {/* Log */}
      {status?.log && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, opacity: 0.6 }}>LOG</div>
          <pre
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              background: 'var(--color-bg-subtle)',
              padding: 12,
              borderRadius: 6,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {status.log}
          </pre>
        </div>
      )}
    </AppPageLayout>
  );
}
