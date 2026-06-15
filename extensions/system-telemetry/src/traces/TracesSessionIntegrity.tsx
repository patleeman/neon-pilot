/**
 * Session Integrity — prompt cache miss events.
 *
 * Displays a table of session-integrity violations (files modified
 * instead of append-only) along with the old/new file metadata.
 */

import type { AppTelemetryEventRow } from '@neon-pilot/extensions/data';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  PanelHeader,
  SurfacePanel,
} from '@neon-pilot/extensions/ui';

interface Props {
  events: AppTelemetryEventRow[];
}

export function TracesSessionIntegrity({ events }: Props) {
  if (events.length === 0) {
    return null;
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Session Integrity" meta={`${events.length} prompt cache misses`} />
      <DataTable>
        <DataTableHead>
          <DataTableRow>
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
    </SurfacePanel>
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
