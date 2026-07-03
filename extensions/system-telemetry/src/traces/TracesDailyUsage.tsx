import type { TraceTokenDaily } from '@neon-pilot/extensions/data';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  PanelHeader,
  PanelMessage,
  SurfacePanel,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
} from '@neon-pilot/extensions/ui';
import React from 'react';

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function cacheMultiplier(row: TraceTokenDaily): number {
  const fresh = row.tokensInput + row.tokensOutput + row.tokensCachedWrite;
  return fresh > 0 ? row.tokensCached / fresh : 0;
}

export function TracesDailyUsage({ data, presentation = 'stable' }: { data: TraceTokenDaily[]; presentation?: 'stable' | 'windowed' }) {
  const rows = [...data].sort((a, b) => b.cost - a.cost || b.date.localeCompare(a.date)).slice(0, 12);

  if (rows.length === 0) {
    if (presentation === 'windowed') {
      return <WindowedEmptyState>No daily usage data yet.</WindowedEmptyState>;
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelMessage align="center" className="p-6">
          No daily usage data yet.
        </PanelMessage>
      </SurfacePanel>
    );
  }

  if (presentation === 'windowed') {
    return (
      <WindowedDataTable
        columns={[
          { label: 'Date' },
          { label: 'Turns', align: 'right' },
          { label: 'Msgs', align: 'right' },
          { label: 'Input', align: 'right' },
          { label: 'Output', align: 'right' },
          { label: 'Cache R', align: 'right' },
          { label: 'Cache W', align: 'right' },
          { label: 'Cache x', align: 'right' },
          { label: 'Total', align: 'right' },
          { label: 'Cost', align: 'right' },
        ]}
        columnTemplate="minmax(7rem, 0.9fr) repeat(8, minmax(4.6rem, 0.46fr)) minmax(5rem, 0.5fr)"
      >
        {rows.map((row) => {
          const total = row.tokensInput + row.tokensOutput + row.tokensCached + row.tokensCachedWrite;
          return (
            <WindowedDataRow
              key={row.date}
              name={row.date}
              cells={[
                { value: row.turns ?? 0, align: 'right' },
                { value: row.messages ?? 0, align: 'right' },
                { value: formatCompact(row.tokensInput), align: 'right' },
                { value: formatCompact(row.tokensOutput), align: 'right' },
                { value: formatCompact(row.tokensCached), align: 'right' },
                { value: formatCompact(row.tokensCachedWrite), align: 'right' },
                { value: `${cacheMultiplier(row).toFixed(1)}x`, align: 'right' },
                { value: formatCompact(total), align: 'right' },
                { value: formatCost(row.cost), align: 'right' },
              ]}
            />
          );
        })}
      </WindowedDataTable>
    );
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Daily Usage" meta="Cost sorted" />
      <div className="overflow-x-auto">
        <DataTable className="min-w-full font-mono tabular-nums">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Date</DataTableHeaderCell>
              <DataTableHeaderCell>Turn</DataTableHeaderCell>
              <DataTableHeaderCell>Msgs</DataTableHeaderCell>
              <DataTableHeaderCell>Input</DataTableHeaderCell>
              <DataTableHeaderCell>Output</DataTableHeaderCell>
              <DataTableHeaderCell>Cache R</DataTableHeaderCell>
              <DataTableHeaderCell>Cache W</DataTableHeaderCell>
              <DataTableHeaderCell>Cache×</DataTableHeaderCell>
              <DataTableHeaderCell>Total</DataTableHeaderCell>
              <DataTableHeaderCell>Cost</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const total = row.tokensInput + row.tokensOutput + row.tokensCached + row.tokensCachedWrite;
              return (
                <DataTableRow key={row.date}>
                  <DataTableCell className="whitespace-nowrap font-semibold">{row.date}</DataTableCell>
                  <DataTableCell>{row.turns ?? 0}</DataTableCell>
                  <DataTableCell>{row.messages ?? 0}</DataTableCell>
                  <DataTableCell className="text-success">{formatCompact(row.tokensInput)}</DataTableCell>
                  <DataTableCell className="text-danger">{formatCompact(row.tokensOutput)}</DataTableCell>
                  <DataTableCell className="text-accent">{formatCompact(row.tokensCached)}</DataTableCell>
                  <DataTableCell className="text-warning">{formatCompact(row.tokensCachedWrite)}</DataTableCell>
                  <DataTableCell className="text-accent">{cacheMultiplier(row).toFixed(1)}x</DataTableCell>
                  <DataTableCell>{formatCompact(total)}</DataTableCell>
                  <DataTableCell className="text-success">{formatCost(row.cost)}</DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </div>
    </SurfacePanel>
  );
}
