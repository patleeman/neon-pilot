import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, AppPageSection, ErrorState, LoadingState } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

interface ModelInfo {
  id: string;
  name: string;
}

interface StatusResult {
  reachable: boolean;
  baseUrl: string;
  models: ModelInfo[];
  error: string | null;
}

export function LmStudioStatusPage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await pa.extension.invoke('lmStudioStatus')) as StatusResult;
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load LM Studio status');
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = (await pa.extension.invoke('lmStudioRefresh')) as { ok: boolean; models?: ModelInfo[]; error?: string };
      if (result.ok) {
        setStatus((prev) => (prev ? { ...prev, models: result.models ?? prev.models } : prev));
      } else {
        pa.ui.toast(result.error ?? 'Refresh failed', 'error');
      }
      // Reload full status after refresh
      await loadStatus();
    } catch {
      pa.ui.toast('Refresh failed', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [pa, loadStatus]);

  if (loading && !status) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
          <AppPageIntro title="LM Studio" summary="Connect to your local LM Studio instance and use its models." />
          <LoadingState />
        </AppPageLayout>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
          <AppPageIntro
            title="LM Studio"
            summary="Connect to your local LM Studio instance and use its models."
            actions={[{ label: 'Retry', onClick: loadStatus }]}
          />
          <ErrorState message={error} />
        </AppPageLayout>
      </div>
    );
  }

  const infoItems = [];

  if (status) {
    if (status.reachable) {
      infoItems.push(
        <div key="status" className="rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-[13px] font-medium text-primary">Connected</span>
          </div>
          <p className="mt-2 text-[12px] text-secondary">
            Server: <code className="text-[12px] text-accent">{status.baseUrl}</code>
          </p>
          <p className="mt-1 text-[12px] text-secondary">
            {status.models.length} model{status.models.length !== 1 ? 's' : ''} available
          </p>
        </div>,
      );
    } else {
      infoItems.push(
        <div key="status" className="rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-danger" />
            <span className="text-[13px] font-medium text-primary">Disconnected</span>
          </div>
          <p className="mt-2 text-[12px] text-secondary">
            Server: <code className="text-[12px] text-accent">{status.baseUrl}</code>
          </p>
          {status.error && <p className="mt-1 text-[12px] text-danger">Error: {status.error}</p>}
          <p className="mt-3 text-[12px] text-dim">
            Make sure LM Studio is running and the server is enabled (Settings → Local Inference Server).
          </p>
        </div>,
      );
    }

    if (status.models.length > 0) {
      infoItems.push(
        <div key="models" className="space-y-2">
          <h3 className="text-[14px] font-medium text-primary">Discovered Models</h3>
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle bg-surface text-secondary">
                  <th className="px-4 py-2 font-medium">Model ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                </tr>
              </thead>
              <tbody>
                {status.models.map((model, i) => (
                  <tr key={model.id} className={i < status.models.length - 1 ? 'border-b border-border-subtle' : ''}>
                    <td className="px-4 py-2 text-primary font-mono text-[12px]">{model.id}</td>
                    <td className="px-4 py-2 text-secondary">{model.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );
    } else if (status.reachable) {
      infoItems.push(
        <div key="no-models" className="rounded-lg border border-border-subtle bg-surface p-4">
          <p className="text-[13px] text-secondary">LM Studio is reachable but no models are loaded. Load a model in LM Studio first.</p>
        </div>,
      );
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="LM Studio"
          summary="Connect to your local LM Studio instance and use its models in Neon Pilot."
          actions={[{ label: refreshing ? 'Refreshing…' : 'Refresh', onClick: handleRefresh, disabled: refreshing }]}
        />
        <AppPageSection>
          <div className="space-y-6">{infoItems}</div>
        </AppPageSection>
      </AppPageLayout>
    </div>
  );
}
