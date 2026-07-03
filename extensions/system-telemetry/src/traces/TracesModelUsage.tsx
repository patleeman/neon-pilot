/**
 * Model Usage & Cost — 2×2 grid section
 */

import type { CacheEfficiencyAggregate, TraceModelUsage, TraceThroughput } from '@neon-pilot/extensions/data';
import {
  DashboardGrid,
  DashboardGridCell,
  MetricTile,
  PanelHeader,
  type ProgressBarTone,
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
  presentation = 'stable',
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
  presentation?: 'stable' | 'windowed';
}) {
  const maxTokens = Math.max(...models.map((m) => m.tokens), 1);
  const cacheByModel = Object.fromEntries((cacheEfficiency?.byModel ?? []).map((m) => [m.modelId, m.hitRate]));
  const totalThroughputOutputTokens = throughput.reduce((sum, t) => sum + t.tokensOutput, 0);
  const totalThroughputDurationMs = throughput.reduce((sum, t) => sum + t.durationMs, 0);
  const totalThroughputTokensPerSec =
    totalThroughputDurationMs > 0 ? Math.round(totalThroughputOutputTokens / (totalThroughputDurationMs / 1000)) : 0;
  const peakThroughputTokensPerSec = Math.max(...throughput.map((t) => t.peakTokensPerSec), 0);
  const cacheHitRateLabel = formatPercent(cacheHitRate);

  if (presentation === 'windowed') {
    if (models.length === 0 && throughput.length === 0) {
      return <WindowedEmptyState>Model usage appears after traced model calls are retained.</WindowedEmptyState>;
    }

    return (
      <div className="wos-model-usage">
        <WindowedKeyValueGrid
          className="wos-model-usage__summary"
          columns={4}
          items={[
            { label: 'Total', value: formatNumber(totalTokens) },
            { label: 'Input', value: formatNumber(tokensInput) },
            { label: 'Output', value: formatNumber(tokensOutput) },
            { label: 'Cached', value: <WindowedBadge tone={cacheHitRate > 0 ? 'positive' : 'neutral'}>{cacheHitRateLabel}</WindowedBadge> },
          ]}
        />
        <div className="wos-model-usage__grid">
          <WindowedDataTable
            className="wos-model-usage__models"
            columns={[{ label: 'Model' }, { label: 'Tokens', align: 'right' }, { label: 'Cache', align: 'right' }]}
            columnTemplate="minmax(12rem, 1fr) minmax(6rem, 0.4fr) minmax(5.5rem, 0.36fr)"
          >
            {models.map((model) => {
              const hitRate = cacheByModel[model.modelId];
              return (
                <WindowedDataRow
                  key={model.modelId}
                  name={model.modelId}
                  meta={`${model.calls} call${model.calls === 1 ? '' : 's'}`}
                  cells={[
                    {
                      value: <WindowedBadge tone={model.tokens > 0 ? 'positive' : 'neutral'}>{formatNumber(model.tokens)}</WindowedBadge>,
                      align: 'right',
                    },
                    { value: hitRate != null ? formatPercent(hitRate) : '-', align: 'right' },
                  ]}
                />
              );
            })}
          </WindowedDataTable>
          <WindowedDataTable
            className="wos-model-usage__costs"
            columns={[{ label: 'Model' }, { label: 'Cost', align: 'right' }, { label: 'Share' }]}
            columnTemplate="minmax(12rem, 1fr) minmax(6rem, 0.44fr) minmax(8rem, 0.72fr)"
          >
            {models.slice(0, 6).map((model) => (
              <WindowedDataRow
                key={model.modelId}
                name={model.modelId}
                meta={`${formatNumber(model.tokens)} tokens`}
                cells={[
                  { value: `$${model.cost.toFixed(2)}`, align: 'right' },
                  {
                    value: (
                      <WindowedBar
                        percent={(model.cost / Math.max(...models.map((m) => m.cost), 0.01)) * 100}
                        label={`${model.modelId} cost share`}
                        tone="warning"
                      />
                    ),
                  },
                ]}
              />
            ))}
          </WindowedDataTable>
          <WindowedDataTable
            className="wos-model-usage__throughput"
            columns={[{ label: 'Model' }, { label: 'Avg', align: 'right' }, { label: 'Peak', align: 'right' }, { label: 'Rate' }]}
            columnTemplate="minmax(12rem, 1fr) minmax(4.5rem, 0.32fr) minmax(4.5rem, 0.32fr) minmax(8rem, 0.72fr)"
          >
            {throughput.length > 0 ? (
              throughput.map((row) => (
                <WindowedDataRow
                  key={row.modelId}
                  name={row.modelId}
                  meta={`${formatNumber(row.tokensOutput)} output tokens`}
                  cells={[
                    { value: `${row.avgTokensPerSec}`, align: 'right' },
                    {
                      value: (
                        <WindowedBadge tone={row.peakTokensPerSec > peakThroughputTokensPerSec * 0.8 ? 'warning' : 'neutral'}>
                          {row.peakTokensPerSec}
                        </WindowedBadge>
                      ),
                      align: 'right',
                    },
                    {
                      value: (
                        <WindowedBar
                          percent={(row.avgTokensPerSec / Math.max(...throughput.map((t) => t.avgTokensPerSec), 1)) * 100}
                          label={`${row.modelId} average throughput`}
                        />
                      ),
                    },
                  ]}
                />
              ))
            ) : (
              <WindowedDataRow
                name="No throughput data"
                meta="Current range"
                cells={[{ value: '0', align: 'right' }, { value: '0', align: 'right' }, { value: 'Waiting' }]}
              />
            )}
          </WindowedDataTable>
        </div>
      </div>
    );
  }

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

function WindowedBar({ percent, label, tone = 'accent' }: { percent: number; label: string; tone?: 'accent' | 'warning' }) {
  return (
    <span className="wos-model-usage-bar" data-tone={tone} aria-label={label}>
      <span style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
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
