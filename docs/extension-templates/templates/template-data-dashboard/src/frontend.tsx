import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Notice,
  StatusDot,
} from '@neon-pilot/extensions/ui';
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

function statusLabel(status: Item['status']) {
  return status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
}

function statusTone(status: Item['status']) {
  return status === 'ok' ? 'success' : status === 'warn' ? 'warning' : 'danger';
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
    // Replace "templateDashboardLoad" with the action id from extension.json.
    const result = (await pa.extension.invoke('templateDashboardLoad', {})) as { items: Item[] };
    setItems(result.items ?? []);
  }, [pa]);

  // Initial load
  useEffect(() => {
    load()
      .catch((err: Error) => {
        setError(err.message);
        pa.ui.notify({ type: 'error', message: `Failed to load: ${err.message}`, source: 'template-data-dashboard' });
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
      pa.ui.notify({ type: 'error', message: `Refresh failed: ${msg}`, source: 'template-data-dashboard' });
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

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {items.length === 0 ? (
          <EmptyState title="No items" body="Nothing to show yet." className="py-10" />
        ) : (
          // ── data table ────────────────────────────────────────────────────
          // Replace columns and row content with your domain data.
          <DataTable
            columns={
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[15%]" />
                <col className="w-[45%]" />
              </colgroup>
            }
            tableClassName="min-w-[40rem] table-fixed"
          >
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell className="pr-4">Name</DataTableHeaderCell>
                <DataTableHeaderCell className="px-3">Status</DataTableHeaderCell>
                <DataTableHeaderCell className="pl-3">Detail</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={statusTone(item.status)} />
                      <span className="truncate text-[14px] font-semibold text-primary">{item.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-dim">{item.id}</div>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap px-3">{statusLabel(item.status)}</DataTableCell>
                  <DataTableCell className="pl-3 text-[13px] text-secondary">{item.detail}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </AppPageLayout>
    </div>
  );
}
