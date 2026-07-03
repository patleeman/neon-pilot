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
  WindowedDataRow,
  WindowedDataTable,
} from '@neon-pilot/extensions/ui';
import React from 'react';

interface Props {
  events: AppTelemetryEventRow[];
  presentation?: 'stable' | 'windowed';
}

export function TracesSessionIntegrity({ events, presentation = 'stable' }: Props) {
  if (events.length === 0) {
    return null;
  }

  if (presentation === 'windowed') {
    return (
      <WindowedDataTable
        columns={[
          { label: 'Time' },
          { label: 'Session' },
          { label: 'Old', align: 'right' },
          { label: 'New', align: 'right' },
          { label: 'Loader' },
        ]}
        columnTemplate="minmax(5.8rem, 0.46fr) minmax(10rem, 1fr) minmax(4.5rem, 0.36fr) minmax(4.5rem, 0.36fr) minmax(6rem, 0.5fr)"
      >
        {events.map((event) => {
          const meta = parseMetadata(event.metadataJson);
          return (
            <WindowedDataRow
              key={event.id}
              name={formatTime(event.ts)}
              cells={[
                { value: event.sessionId ?? '-' },
                { value: meta.oldSize ?? '?', align: 'right' },
                { value: meta.newSize ?? '?', align: 'right' },
                { value: meta.cacheLoader ?? '?' },
              ]}
            />
          );
        })}
      </WindowedDataTable>
    );
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
