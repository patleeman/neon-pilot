/**
 * Agent Loop Health & Run Waterfall
 */

import type { TraceAgentLoop } from '@neon-pilot/extensions/data';
import {
  CardMeta,
  CompactCard,
  MetricTile,
  type MetricTone,
  PanelHeader,
  PanelMessage,
  ProgressRow,
  type ProgressBarTone,
  StatGrid,
  SurfacePanel,
} from '@neon-pilot/extensions/ui';

export function TracesAgentLoop({ loop }: { loop: TraceAgentLoop | null }) {
  if (!loop) {
    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="🔄 Agent Loop Health" meta="No data yet" metaClassName="bg-transparent px-0" />
        <PanelMessage align="center" className="p-6">
          Loop metrics appear after agent runs complete.
        </PanelMessage>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="🔄 Agent Loop Health" meta="Selected range" />
      <div className="p-4">
        {/* Loop stats grid */}
        <StatGrid className="mb-4 !grid-cols-2 gap-2.5 lg:!grid-cols-4">
          <LoopStat value={formatNumber(loop.turnsPerRun)} label="Avg Turns / Run" tone="accent" />
          <LoopStat value={formatNumber(loop.stepsPerTurn)} label="Avg Steps / Turn" tone="accent" />
          <LoopStat value={formatNumber(loop.toolCallsPerRun)} label="Tool Calls / Run" tone="accent" />
          <LoopStat value={formatNumber(loop.toolCallsP95)} label="P95 Tool Calls" tone="warning" />
          <LoopStat
            value={formatPercent(loop.toolErrorRatePct)}
            label="Tool Error Rate"
            tone={loop.toolErrorRatePct > 0 ? 'danger' : 'muted'}
          />
          <LoopStat value={formatTokens(loop.avgTokensPerRun)} label="Avg Tokens / Run" />
          <LoopStat value={formatNumber(loop.subagentsPerRun)} label="Subagents / Run" tone="accent" />
          <LoopStat value={formatDuration(loop.avgDurationMs)} label="Avg Run Duration" tone="success" />
          <LoopStat
            value={formatNumber(loop.runsOver20Turns)}
            label="Runs &gt; 20 Turns"
            tone={loop.runsOver20Turns > 0 ? 'warning' : 'muted'}
          />
          <LoopStat value={formatNumber(loop.stuckRuns)} label="Stuck Runs (&gt;10m)" tone={loop.stuckRuns > 0 ? 'danger' : 'muted'} />
          <LoopStat value={formatPercent(loop.stuckRunPct)} label="Stuck Run Rate" tone={loop.stuckRunPct > 0 ? 'danger' : 'muted'} />
        </StatGrid>

        <div className="pt-3 border-t border-border-subtle">
          <div className="text-[11px] font-medium mb-3">Run Duration Distribution</div>
          {loop.durationP99Ms > 0 ? (
            <>
              <DurBar
                label="P50"
                pct={durationPct(loop.durationP50Ms, loop.durationP99Ms)}
                val={formatDuration(loop.durationP50Ms)}
                tone="accent"
              />
              <DurBar
                label="P95"
                pct={durationPct(loop.durationP95Ms, loop.durationP99Ms)}
                val={formatDuration(loop.durationP95Ms)}
                tone="warning"
              />
              <DurBar label="P99" pct={100} val={formatDuration(loop.durationP99Ms)} tone="danger" />
            </>
          ) : (
            <CompactCard tone="elevated" className="py-4 text-center">
              <CardMeta>Duration percentiles need completed runs with timings.</CardMeta>
            </CompactCard>
          )}
        </div>
      </div>
    </SurfacePanel>
  );
}

function LoopStat({ value, label, tone = 'default' }: { value: string; label: string; tone?: MetricTone }) {
  return <MetricTile label={label} value={value} size="lg" tone={tone} />;
}

function DurBar({ label, pct, val, tone }: { label: string; pct: number; val: string; tone: ProgressBarTone }) {
  return <ProgressRow label={label} value={val} progressValue={pct} minPercent={4} tone={tone} labelWidth="3.75rem" valueWidth="3.5rem" />;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0';
  return formatRounded(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0%';
  return `${formatRounded(value, { maxFractionDigits: 1 })}%`;
}

function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${formatRounded(value / 1_000_000, { maxFractionDigits: 1 })}M`;
  if (value >= 1_000) return `${formatRounded(value / 1_000, { maxFractionDigits: 1 })}K`;
  return formatRounded(value);
}

function formatRounded(value: number, options: { maxFractionDigits?: number } = {}): string {
  const maxFractionDigits = options.maxFractionDigits ?? (Math.abs(value) < 10 ? 2 : 1);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : maxFractionDigits,
  }).format(value);
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function durationPct(ms: number, maxMs: number): number {
  if (maxMs <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((ms / maxMs) * 100)));
}
