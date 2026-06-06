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
      <PanelHeader title="Model Usage & Cost" meta="Last 24h" />

      <DashboardGrid columns={2}>
        {/* Cell 1: Tokens by model */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Tokens by Model
          </SectionLabel>
          <div className="flex gap-4 flex-wrap pb-3 mb-3 border-b border-border-subtle">
            <MetricTile value={formatNumber(totalTokens)} label="Total" tone="accent" size="lg" appearance="plain" />
            <MetricTile value={formatNumber(tokensInput)} label="Input" size="lg" appearance="plain" />
            <MetricTile value={formatNumber(tokensOutput)} label="Output" size="lg" appearance="plain" />
            <MetricTile value={formatNumber(tokensCached)} label="Cache Read" tone="success" size="lg" appearance="plain" />
            <MetricTile value={formatNumber(tokensCachedWrite)} label="Cache Write" tone="warning" size="lg" appearance="plain" />
            <MetricTile value={cacheHitRateLabel} label="Cached Share" tone="accent" size="lg" appearance="plain" />
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
          <div className="flex flex-wrap gap-1 mb-3">
            {(() => {
              const top = models.slice(0, 4);
              const totalCost = top.reduce((s, m) => s + m.cost, 0);
              const colors = [
                'from-[#6c8aff] to-[#4a6ae0]',
                'from-[#ff9f0a] to-[#e08500]',
                'from-[#4cd964] to-[#2db84d]',
                'from-[#ff6b6b] to-[#e04a4a]',
              ];
              return top.map((m, i) => {
                const flexSize = totalCost > 0 ? Math.max((m.cost / totalCost) * 4, 0.3) : 1;
                return (
                  <div
                    key={m.modelId}
                    className={`bg-gradient-to-br ${colors[i % colors.length]} rounded-lg p-2.5 min-h-[50px] flex flex-col justify-end`}
                    style={{ flex: flexSize }}
                  >
                    <div className="text-[11px] font-semibold text-white/90">{m.modelId}</div>
                    <div className="text-[10px] font-mono text-white/70">${m.cost.toFixed(2)}</div>
                    <div className="text-[9px] text-white/50">{formatNumber(m.tokens)} tok</div>
                  </div>
                );
              });
            })()}
          </div>
        </DashboardGridCell>

        {/* Cell 3: Throughput */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Throughput
          </SectionLabel>
          <div className="flex gap-2 mb-3">
            <MetricTile className="flex-1" value={`${totalThroughputTokensPerSec}`} label="tok/s avg" tone="accent" />
            <MetricTile className="flex-1" value={`${peakThroughputTokensPerSec}`} label="tok/s peak" tone="warning" />
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
          <div className="mt-2 pt-2 border-t border-border-subtle text-[11px] text-dim">
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
