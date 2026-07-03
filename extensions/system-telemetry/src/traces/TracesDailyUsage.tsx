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
          { label: 'Tokens', align: 'right' },
          { label: 'Cost', align: 'right' },
        ]}
        columnTemplate="minmax(6.5rem, 0.78fr) minmax(4.5rem, 0.34fr) minmax(7rem, 0.56fr) minmax(4.5rem, 0.34fr)"
      >
        {rows.map((row) => {
          const total = row.tokensInput + row.tokensOutput + row.tokensCached + row.tokensCachedWrite;
          return (
            <WindowedDataRow
              key={row.date}
              name={row.date}
              meta={`${row.messages ?? 0} msgs · cache ${cacheMultiplier(row).toFixed(1)}x · write ${formatCompact(row.tokensCachedWrite)}`}
              cells={[
                { value: row.turns ?? 0, align: 'right' },
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
