/**
 * Model Usage & Cost — 2×2 grid section
 */

import type { CacheEfficiencyAggregate, TraceModelUsage, TraceThroughput } from '@neon-pilot/extensions/data';
import {
  DashboardGrid,
  DashboardGridCell,
  MetricTile,
  PanelHeader,
  ProgressRow,
  type ProgressBarTone,
  SectionLabel,
  SurfacePanel,
} from '@neon-pilot/extensions/ui';

export function TracesModelUsage({
  models,
  throughput,
  totalTokens,
  tokensInput,
  tokensOutput,
  tokensCached,
  tokensCachedWrite,
  cacheHitRate,
  cacheEfficiency,
}: {
  models: TraceModelUsage[];
  throughput: TraceThroughput[];
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  tokensCached: number;
  tokensCachedWrite: number;
  cacheHitRate: number;
  cacheEfficiency?: CacheEfficiencyAggregate | null;
}) {
  const maxTokens = Math.max(...models.map((m) => m.tokens), 1);
  const cacheByModel = Object.fromEntries((cacheEfficiency?.byModel ?? []).map((m) => [m.modelId, m.hitRate]));
  const totalThroughputOutputTokens = throughput.reduce((sum, t) => sum + t.tokensOutput, 0);
  const totalThroughputDurationMs = throughput.reduce((sum, t) => sum + t.durationMs, 0);
  const totalThroughputTokensPerSec =
    totalThroughputDurationMs > 0 ? Math.round(totalThroughputOutputTokens / (totalThroughputDurationMs / 1000)) : 0;
  const peakThroughputTokensPerSec = Math.max(...throughput.map((t) => t.peakTokensPerSec), 0);
  const cacheHitRateLabel = formatPercent(cacheHitRate);

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Model Usage" meta="Last 24h" />

      <DashboardGrid columns={2} divide="both">
        {/* Cell 1: Tokens by model */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Tokens by Model
          </SectionLabel>
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-border-subtle pb-3 sm:grid-cols-3">
            <MetricTile value={formatNumber(totalTokens)} label="Total" tone="accent" appearance="plain" align="left" />
            <MetricTile value={formatNumber(tokensInput)} label="Input" appearance="plain" align="left" />
            <MetricTile value={formatNumber(tokensOutput)} label="Output" appearance="plain" align="left" />
            <MetricTile value={formatNumber(tokensCached)} label="Cache Read" tone="success" appearance="plain" align="left" />
            <MetricTile value={formatNumber(tokensCachedWrite)} label="Cache Write" tone="warning" appearance="plain" align="left" />
            <MetricTile value={cacheHitRateLabel} label="Cached Share" tone="accent" appearance="plain" align="left" />
          </div>
          {models.map((m) => {
            const hitRate = cacheByModel[m.modelId];
            return (
              <BarRow
                key={m.modelId}
                label={<span className="model-tag">{m.modelId}</span>}
                value={formatNumber(m.tokens)}
                pct={m.tokens / maxTokens}
                tone="accent"
                badge={hitRate != null ? `${formatPercent(hitRate)} cache` : undefined}
                badgeCls={hitRate != null ? (hitRate > 30 ? 'text-success' : hitRate > 10 ? 'text-warning' : 'text-danger') : undefined}
              />
            );
          })}
        </DashboardGridCell>

        {/* Cell 2: Cost treemap */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Cost Breakdown
          </SectionLabel>
          <div className="space-y-1">
            {models.slice(0, 6).map((m) => (
              <BarRow
                key={m.modelId}
                label={<span className="model-tag">{m.modelId}</span>}
                value={`$${m.cost.toFixed(2)}`}
                pct={m.cost / Math.max(...models.map((model) => model.cost), 0.01)}
                tone="warning"
                badge={`${formatNumber(m.tokens)} tok`}
              />
            ))}
          </div>
        </DashboardGridCell>

        {/* Cell 3: Throughput */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Throughput
          </SectionLabel>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricTile value={`${totalThroughputTokensPerSec}`} label="tok/s avg" tone="accent" appearance="plain" align="left" />
            <MetricTile value={`${peakThroughputTokensPerSec}`} label="tok/s peak" tone="warning" appearance="plain" align="left" />
          </div>
          {throughput.length > 0 ? (
            throughput.map((t) => (
              <BarRow
                key={t.modelId}
                label={<span className="model-tag">{t.modelId}</span>}
                value={`${t.avgTokensPerSec} tok/s avg · ${t.peakTokensPerSec} peak`}
                pct={t.avgTokensPerSec / Math.max(...throughput.map((x) => x.avgTokensPerSec), 1)}
                tone="accent"
              />
            ))
          ) : (
            <div className="text-[12px] text-dim py-4 text-center">No throughput data yet</div>
          )}
        </DashboardGridCell>

        {/* Cell 4: Cache stats */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Prompt Cache
          </SectionLabel>
          <CacheRow
            label="Cached input"
            value={formatNumber(tokensCached)}
            pct={Math.min(tokensCached / Math.max(tokensInput + tokensCached, 1), 1)}
            tone="accent"
          />
          <CacheRow label="Cached share" value={cacheHitRateLabel} pct={cacheHitRate / 100} tone="success" />
          <CacheRow
            label="Total prompt in"
            value={formatNumber(tokensInput + tokensCached)}
            pct={Math.min((tokensInput + tokensCached) / Math.max(totalTokens, 1), 1)}
            tone="success"
          />
          <div className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-dim">
            {cacheHitRate > 0 ? <span className="text-warning">{cacheHitRateLabel}</span> : null} of prompt input read from cache
          </div>
        </DashboardGridCell>
      </DashboardGrid>
    </SurfacePanel>
  );
}

function BarRow({
  label,
  value,
  pct,
  tone,
  badge,
  badgeCls,
}: {
  label: React.ReactNode;
  value: string;
  pct: number;
  tone: ProgressBarTone;
  badge?: string;
  badgeCls?: string;
}) {
  return (
    <ProgressRow
      label={label}
      value={value}
      badge={badge}
      progressValue={pct * 100}
      minPercent={2}
      tone={tone}
      labelWidth="4.75rem"
      valueWidth="3.75rem"
      badgeWidth="3.75rem"
      badgeClassName={badgeCls}
    />
  );
}

function CacheRow({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: ProgressBarTone }) {
  return (
    <ProgressRow
      label={label}
      value={value}
      progressValue={pct * 100}
      minPercent={2}
      tone={tone}
      progressClassName="h-5"
      labelWidth="4.75rem"
      valueWidth="4rem"
    />
  );
}

function formatNumber(n: number): string {
  const value = Math.trunc(Number.isFinite(n) ? n : 0);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function formatPercent(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return `${value.toFixed(2)}%`;
}
