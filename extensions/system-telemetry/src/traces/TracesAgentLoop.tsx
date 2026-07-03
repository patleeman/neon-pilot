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
  type ProgressBarTone,
  ProgressRow,
  StatGrid,
  SurfacePanel,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedKeyValueGrid,
  WindowedStateBlock,
} from '@neon-pilot/extensions/ui';
import React from 'react';

export function TracesAgentLoop({ loop, presentation = 'stable' }: { loop: TraceAgentLoop | null; presentation?: 'stable' | 'windowed' }) {
  if (!loop) {
    if (presentation === 'windowed') {
      return <WindowedEmptyState>Loop metrics appear after agent runs complete.</WindowedEmptyState>;
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Agent Loop Health" meta="No data yet" metaClassName="bg-transparent px-0" />
        <PanelMessage align="center" className="p-6">
          Loop metrics appear after agent runs complete.
        </PanelMessage>
      </SurfacePanel>
    );
  }

  if (presentation === 'windowed') {
    return <WindowedAgentLoop loop={loop} />;
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Agent Loop Health" meta="Selected range" />
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
            label="Runs > 20 Turns"
            tone={loop.runsOver20Turns > 0 ? 'warning' : 'muted'}
          />
          <LoopStat value={formatNumber(loop.stuckRuns)} label="Stuck >10 Min" tone={loop.stuckRuns > 0 ? 'danger' : 'muted'} />
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

function WindowedAgentLoop({ loop }: { loop: TraceAgentLoop }) {
  const hasTimingData = loop.durationP99Ms > 0;

  return (
    <div className="wos-agent-loop">
      <WindowedKeyValueGrid
        className="wos-agent-loop__metrics"
        columns={4}
        items={[
          { label: 'Turns / run', value: formatNumber(loop.turnsPerRun) },
          { label: 'Steps / turn', value: formatNumber(loop.stepsPerTurn) },
          { label: 'Tool calls / run', value: formatNumber(loop.toolCallsPerRun) },
          {
            label: 'P95 tool calls',
            value: <WindowedBadge tone={loop.toolCallsP95 > 8 ? 'warning' : 'neutral'}>{formatNumber(loop.toolCallsP95)}</WindowedBadge>,
          },
          {
            label: 'Tool errors',
            value: (
              <WindowedBadge tone={loop.toolErrorRatePct > 0 ? 'danger' : 'positive'}>{formatPercent(loop.toolErrorRatePct)}</WindowedBadge>
            ),
          },
          { label: 'Tokens / run', value: formatTokens(loop.avgTokensPerRun) },
          { label: 'Subagents / run', value: formatNumber(loop.subagentsPerRun) },
          { label: 'Avg duration', value: formatDuration(loop.avgDurationMs) },
        ]}
      />

      <WindowedDataTable
        className="wos-agent-loop__risk-table"
        columns={[{ label: 'Signal' }, { label: 'Value', align: 'right' }, { label: 'State', align: 'right' }]}
        columnTemplate="minmax(12rem, 1fr) minmax(5rem, 0.35fr) minmax(7rem, 0.45fr)"
      >
        <WindowedDataRow
          name="Long runs"
          meta="Runs over 20 turns"
          cells={[
            { value: formatNumber(loop.runsOver20Turns), align: 'right' },
            {
              value: (
                <WindowedBadge tone={loop.runsOver20Turns > 0 ? 'warning' : 'positive'}>
                  {loop.runsOver20Turns > 0 ? 'Watch' : 'Clear'}
                </WindowedBadge>
              ),
              align: 'right',
            },
          ]}
        />
        <WindowedDataRow
          name="Stuck runs"
          meta="Runs idle over 10 minutes"
          cells={[
            { value: formatNumber(loop.stuckRuns), align: 'right' },
            {
              value: (
                <WindowedBadge tone={loop.stuckRuns > 0 ? 'danger' : 'positive'}>
                  {loop.stuckRuns > 0 ? formatPercent(loop.stuckRunPct) : 'Clear'}
                </WindowedBadge>
              ),
              align: 'right',
            },
          ]}
        />
      </WindowedDataTable>

      {hasTimingData ? (
        <div className="wos-agent-loop__durations" aria-label="Run duration distribution">
          <WindowedDurationRow
            label="P50"
            value={formatDuration(loop.durationP50Ms)}
            percent={durationPct(loop.durationP50Ms, loop.durationP99Ms)}
          />
          <WindowedDurationRow
            label="P95"
            value={formatDuration(loop.durationP95Ms)}
            percent={durationPct(loop.durationP95Ms, loop.durationP99Ms)}
          />
          <WindowedDurationRow label="P99" value={formatDuration(loop.durationP99Ms)} percent={100} tone="danger" />
        </div>
      ) : (
        <WindowedStateBlock className="wos-agent-loop__empty-duration">
          Duration percentiles need completed runs with timings.
        </WindowedStateBlock>
      )}
    </div>
  );
}

function WindowedDurationRow({
  label,
  value,
  percent,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  percent: number;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="wos-agent-loop-duration" data-tone={tone}>
      <span className="wos-agent-loop-duration__label">{label}</span>
      <span className="wos-agent-loop-duration__track" aria-hidden="true">
        <span className="wos-agent-loop-duration__bar" style={{ '--wos-agent-loop-duration': `${percent}%` } as React.CSSProperties} />
      </span>
      <span className="wos-agent-loop-duration__value">{value}</span>
    </div>
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
