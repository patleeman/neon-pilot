/**
 * Suggested Context Pointer Usage
 *
 * Shows how often agents actually call conversation_inspect on the
 * suggested related-conversation pointers vs. ignoring them.
 */

import type { ContextPointerUsageResult } from '@neon-pilot/extensions/data';
import {
  DashboardGrid,
  MetricTile,
  PanelHeader,
  ProgressRow,
  SectionLabel,
  SurfacePanel,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedKeyValueGrid,
} from '@neon-pilot/extensions/ui';
import React from 'react';

export function TracesContextPointers({
  data,
  presentation = 'stable',
}: {
  data: ContextPointerUsageResult | null;
  presentation?: 'stable' | 'windowed';
}) {
  if (!data || data.summary.totalSuggested === 0) {
    if (presentation === 'windowed') {
      return <WindowedEmptyState>Suggested context usage appears after related-conversation pointers are offered.</WindowedEmptyState>;
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Suggested Context Usage" meta="No data yet" metaClassName="bg-transparent px-0" />
        <div className="p-6 text-center text-[12px] text-dim">Tracks how often agents inspect suggested related-conversation pointers.</div>
      </SurfacePanel>
    );
  }

  const { summary, daily } = data;
  const usageRateTone = summary.usageRate >= 50 ? 'success' : summary.usageRate >= 20 ? 'warning' : 'danger';

  if (presentation === 'windowed') {
    return <WindowedContextPointers data={data} />;
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Suggested Context Usage" meta={`${summary.usageRate}% of sessions used suggestions`} />

      <DashboardGrid columns={4} divide="x" className="border-b border-border-subtle">
        <MetricTile
          value={`${summary.usageRate}%`}
          label="Usage Rate"
          tone={usageRateTone}
          detail="sessions that inspected a pointer"
          size="lg"
          appearance="plain"
          className="px-4 py-3"
        />
        <MetricTile
          value={String(summary.totalInspects)}
          label="Pointer Inspects"
          tone="accent"
          detail={`of ${summary.totalAnyInspects} total inspect calls`}
          size="lg"
          appearance="plain"
          className="px-4 py-3"
        />
        <MetricTile
          value={String(summary.totalSuggested)}
          label="Turns w/ Pointers"
          detail={`${summary.sessionsWithSuggested} sessions`}
          size="lg"
          appearance="plain"
          className="px-4 py-3"
        />
        <MetricTile
          value={String(summary.avgPointersPerTurn)}
          label="Avg Pointers / Turn"
          tone="muted"
          detail="suggested per prompt"
          size="lg"
          appearance="plain"
          className="px-4 py-3"
        />
      </DashboardGrid>

      {daily.length > 1 && (
        <div className="p-4">
          <SectionLabel tone="muted" className="mb-3 block">
            Daily — Suggested vs Inspected
          </SectionLabel>
          <DailyBars daily={daily} />
        </div>
      )}
    </SurfacePanel>
  );
}

function WindowedContextPointers({ data }: { data: ContextPointerUsageResult }) {
  const { summary, daily } = data;

  return (
    <div className="wos-context-pointers">
      <WindowedKeyValueGrid
        className="wos-context-pointers__summary"
        columns={4}
        items={[
          {
            label: 'Usage',
            value: <WindowedBadge tone={windowedUsageTone(summary.usageRate)}>{formatPercent(summary.usageRate)}</WindowedBadge>,
          },
          { label: 'Inspects', value: summary.totalInspects },
          { label: 'Suggested', value: summary.totalSuggested },
          { label: 'Avg / Turn', value: summary.avgPointersPerTurn },
        ]}
      />
      <WindowedDataTable
        className="wos-context-pointers__daily"
        columns={[{ label: 'Date' }, { label: 'Suggested', align: 'right' }, { label: 'Inspected', align: 'right' }, { label: 'Use' }]}
        columnTemplate="minmax(6rem, 0.55fr) minmax(5.5rem, 0.38fr) minmax(5.5rem, 0.38fr) minmax(10rem, 1fr)"
      >
        {daily.slice(-10).map((row) => {
          const pct = row.suggested > 0 ? (row.inspected / row.suggested) * 100 : 0;
          return (
            <WindowedDataRow
              key={row.date}
              name={row.date}
              meta={`${row.inspected}/${row.suggested} inspected`}
              cells={[
                { value: row.suggested, align: 'right' },
                { value: row.inspected, align: 'right' },
                { value: <WindowedPointerBar percent={pct} label={`${row.date} suggested context usage`} /> },
              ]}
            />
          );
        })}
      </WindowedDataTable>
    </div>
  );
}

function WindowedPointerBar({ percent, label }: { percent: number; label: string }) {
  return (
    <span className="wos-context-pointers-bar" aria-label={label}>
      <span style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
  );
}

function windowedUsageTone(rate: number): 'positive' | 'warning' | 'danger' {
  if (rate >= 50) return 'positive';
  if (rate >= 20) return 'warning';
  return 'danger';
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function DailyBars({ daily }: { daily: { date: string; suggested: number; inspected: number }[] }) {
  return (
    <div className="space-y-1.5">
      {daily.map((d) => {
        const label = d.date.slice(5); // MM-DD
        return (
          <ProgressRow
            key={d.date}
            label={label}
            value={`${d.inspected}/${d.suggested}`}
            progressValue={d.inspected}
            max={Math.max(d.suggested, 1)}
            minPercent={2}
            labelWidth="3rem"
            valueWidth="4rem"
            tone="accent"
            progressLabel={`${d.date} inspected pointers`}
            title={`${d.date}: ${d.suggested} suggested, ${d.inspected} inspected`}
          />
        );
      })}
    </div>
  );
}
