/**
 * Suggested Context Pointer Usage
 *
 * Shows how often agents actually call conversation_inspect on the
 * suggested related-conversation pointers vs. ignoring them.
 */

import type { ContextPointerUsageResult } from '@neon-pilot/extensions/data';
import { DashboardGrid, MetricTile, PanelHeader, ProgressRow, SectionLabel, SurfacePanel } from '@neon-pilot/extensions/ui';

export function TracesContextPointers({ data }: { data: ContextPointerUsageResult | null }) {
  if (!data || data.summary.totalSuggested === 0) {
    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Suggested Context Usage" meta="No data yet" metaClassName="bg-transparent px-0" />
        <div className="p-6 text-center text-[12px] text-dim">Tracks how often agents inspect suggested related-conversation pointers.</div>
      </SurfacePanel>
    );
  }

  const { summary, daily } = data;
  const usageRateTone = summary.usageRate >= 50 ? 'success' : summary.usageRate >= 20 ? 'warning' : 'danger';

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
