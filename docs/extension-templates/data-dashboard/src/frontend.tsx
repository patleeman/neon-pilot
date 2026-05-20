import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, IconButton, LoadingState } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

// Mirror the shape returned by src/backend.ts
interface Item {
  id: string;
  name: string;
  status: 'ok' | 'warn' | 'error';
  updatedAt: string;
  detail: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function statusDotClass(status: Item['status']) {
  return status === 'ok' ? 'bg-success border-success' : status === 'warn' ? 'bg-warning border-warning' : 'bg-danger border-danger';
}

function statusLabel(status: Item['status']) {
  return status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
}

function statusTextClass(status: Item['status']) {
  return status === 'ok' ? 'text-success' : status === 'warn' ? 'text-warning' : 'text-danger';
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12.5 7.5a4.5 4.5 0 1 1-1.2-3.1" />
      <path d="M10 2.8h3v3" />
    </svg>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export function DataDashboardPage({ pa }: { pa: NativeExtensionClient }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Replace "myDashboardLoad" with the action id from extension.json.
    const result = (await pa.actions.call('myDashboardLoad', {})) as { items: Item[] };
    setItems(result.items ?? []);
  }, [pa]);

  // Initial load
  useEffect(() => {
    load()
      .catch((err: Error) => {
        setError(err.message);
        pa.ui.notify({ type: 'error', message: `Failed to load: ${err.message}`, source: 'my-data-dashboard' });
      })
      .finally(() => setLoading(false));
  }, [load, pa]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pa.ui.notify({ type: 'error', message: `Refresh failed: ${msg}`, source: 'my-data-dashboard' });
    } finally {
      setRefreshing(false);
    }
  }, [load, pa]);

  // ── render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  // ── main page ──────────────────────────────────────────────────────────────

  const summary = `${items.length} item${items.length === 1 ? '' : 's'}`;

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-8">
        <AppPageIntro
          title="My Dashboard"
          summary={`One sentence describing what this page shows. ${summary}`}
          actions={
            <IconButton title="Refresh" aria-label="Refresh" disabled={refreshing} onClick={() => void refresh()}>
              <RefreshIcon />
            </IconButton>
          }
        />

        {error ? <div className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div> : null}

        {items.length === 0 ? (
          <EmptyState title="No items" body="Nothing to show yet." className="py-10" />
        ) : (
          // ── data table ────────────────────────────────────────────────────
          // Replace columns and row content with your domain data.
          <section className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-[13px]">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[15%]" />
                <col className="w-[45%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 pl-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle/70 transition-colors hover:bg-surface/30">
                    <td className="min-w-0 py-3 pr-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full border', statusDotClass(item.status))} />
                        <span className="truncate text-[14px] font-semibold text-primary">{item.name}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-dim">{item.id}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-middle">
                      <span className={cx('text-[12px]', statusTextClass(item.status))}>{statusLabel(item.status)}</span>
                    </td>
                    <td className="pl-3 py-3 align-middle text-[13px] text-secondary">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </AppPageLayout>
    </div>
  );
}
