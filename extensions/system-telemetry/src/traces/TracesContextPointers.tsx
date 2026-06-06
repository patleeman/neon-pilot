/**
 * Suggested Context Pointer Usage
 *
 * Shows how often agents actually call conversation_inspect on the
 * suggested related-conversation pointers vs. ignoring them.
 */

import type { ContextPointerUsageResult } from '@neon-pilot/extensions/data';
import { DashboardGrid, PanelHeader, SectionLabel, SurfacePanel } from '@neon-pilot/extensions/ui';

export function TracesContextPointers({ data }: { data: ContextPointerUsageResult | null }) {
  if (!data || data.summary.totalSuggested === 0) {
    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="🔍 Suggested Context Usage" meta="No data yet" metaClassName="bg-transparent px-0" />
        <div className="p-6 text-center text-[12px] text-dim">Tracks how often agents inspect suggested related-conversation pointers.</div>
      </SurfacePanel>
    );
  }

  const { summary, daily } = data;
  const usageRateColor = summary.usageRate >= 50 ? 'text-success' : summary.usageRate >= 20 ? 'text-warning' : 'text-danger';

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="🔍 Suggested Context Usage" meta={`${summary.usageRate}% of sessions used suggestions`} />

      <DashboardGrid columns={4} divide="x" className="border-b border-border-subtle">
        <Stat value={`${summary.usageRate}%`} label="Usage Rate" cls={usageRateColor} sub="sessions that inspected a pointer" />
        <Stat
          value={String(summary.totalInspects)}
          label="Pointer Inspects"
          cls="text-accent"
          sub={`of ${summary.totalAnyInspects} total inspect calls`}
        />
        <Stat
          value={String(summary.totalSuggested)}
          label="Turns w/ Pointers"
          cls="text-primary"
          sub={`${summary.sessionsWithSuggested} sessions`}
        />
        <Stat value={String(summary.avgPointersPerTurn)} label="Avg Pointers / Turn" cls="text-dim" sub="suggested per prompt" />
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

function Stat({ value, label, cls, sub }: { value: string; label: string; cls: string; sub?: string }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5">
      <SectionLabel tone="muted">{label}</SectionLabel>
      <div className={`text-[22px] font-semibold leading-none ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function DailyBars({ daily }: { daily: { date: string; suggested: number; inspected: number }[] }) {
  const maxSuggested = Math.max(...daily.map((d) => d.suggested), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 64 }}>
      {daily.map((d) => {
        const sugH = Math.round((d.suggested / maxSuggested) * 56);
        const inpH = d.suggested > 0 ? Math.round((d.inspected / d.suggested) * sugH) : 0;
        const label = d.date.slice(5); // MM-DD
        return (
          <div
            key={d.date}
            className="flex flex-col items-center gap-0.5 flex-1"
            title={`${d.date}: ${d.suggested} suggested, ${d.inspected} inspected`}
          >
            <div className="w-full relative flex flex-col justify-end" style={{ height: 56 }}>
              {/* suggested bar (background) */}
              <div className="w-full rounded-sm bg-elevated" style={{ height: Math.max(sugH, 2) }} />
              {/* inspected bar (overlay, positioned at bottom of suggested bar) */}
              {inpH > 0 && <div className="w-full rounded-sm bg-accent absolute bottom-0" style={{ height: inpH }} />}
            </div>
            <div className="text-[8px] text-dim leading-none">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
