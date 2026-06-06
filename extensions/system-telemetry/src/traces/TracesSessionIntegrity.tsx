/**
 * Session Integrity — prompt cache miss events.
 *
 * Displays a table of session-integrity violations (files modified
 * instead of append-only) along with the old/new file metadata.
 */

import type { AppTelemetryEventRow } from '@neon-pilot/extensions/data';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeaderCell, DataTableRow } from '@neon-pilot/extensions/ui';

interface Props {
  events: AppTelemetryEventRow[];
}

export function TracesSessionIntegrity({ events }: Props) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-primary">Session Integrity</h3>
        <span className="text-[11px] text-dim">{events.length} prompt cache misses</span>
      </div>
      <DataTable className="rounded-lg border border-border-subtle">
        <DataTableHead>
          <DataTableRow className="bg-surface/50 hover:bg-surface/50">
            <DataTableHeaderCell>Time</DataTableHeaderCell>
            <DataTableHeaderCell>Session</DataTableHeaderCell>
            <DataTableHeaderCell>Old Size</DataTableHeaderCell>
            <DataTableHeaderCell>New Size</DataTableHeaderCell>
            <DataTableHeaderCell>Loader</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {events.map((event) => {
            const meta = parseMetadata(event.metadataJson);
            return (
              <DataTableRow key={event.id}>
                <DataTableCell className="whitespace-nowrap text-secondary">{formatTime(event.ts)}</DataTableCell>
                <DataTableCell className="max-w-[180px] truncate text-secondary" title={event.sessionId ?? undefined}>
                  {event.sessionId ?? '—'}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap font-mono text-secondary">{meta.oldSize ?? '?'}</DataTableCell>
                <DataTableCell className="whitespace-nowrap font-mono text-secondary">{meta.newSize ?? '?'}</DataTableCell>
                <DataTableCell className="whitespace-nowrap text-secondary">{meta.cacheLoader ?? '?'}</DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </section>
  );
}

function parseMetadata(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}
