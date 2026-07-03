/**
 * Cache Efficiency & System Prompt display
 */

import type { CacheEfficiencyAggregate, SystemPromptAggregate } from '@neon-pilot/extensions/data';
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

export function TracesCacheAndSystemPrompt({
  cacheEfficiency,
  systemPrompt,
  presentation = 'stable',
}: {
  cacheEfficiency: CacheEfficiencyAggregate | null;
  systemPrompt: SystemPromptAggregate | null;
  presentation?: 'stable' | 'windowed';
}) {
  if (!cacheEfficiency && !systemPrompt) {
    if (presentation === 'windowed') {
      return <WindowedEmptyState>Cache and system prompt metrics appear after traced model calls are retained.</WindowedEmptyState>;
    }

    return null;
  }

  if (presentation === 'windowed') {
    return <WindowedCacheAndSystemPrompt cacheEfficiency={cacheEfficiency} systemPrompt={systemPrompt} />;
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Cache Efficiency & System Prompt" />
      <DashboardGrid columns={2} divide="x">
        {/* Cache */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Prompt Cache
          </SectionLabel>
          {cacheEfficiency && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
                <MetricTile
                  value={`${fmtPercent(cacheEfficiency.requestCacheHitRate)}%`}
                  label="Request Hit Rate"
                  tone={cacheEfficiency.requestCacheHitRate > 50 ? 'success' : 'warning'}
                  valueClassName="tabular-nums"
                />
                <MetricTile
                  value={`${fmtPercent(cacheEfficiency.overallHitRate)}%`}
                  label="Cached Share"
                  tone={cacheEfficiency.overallHitRate > 30 ? 'success' : 'warning'}
                  valueClassName="tabular-nums"
                />
                <MetricTile value={fmt(cacheEfficiency.totalCached)} label="Cache Read" valueClassName="tabular-nums" />
                <MetricTile
                  value={`${cacheEfficiency.cachedRequests}/${cacheEfficiency.requests}`}
                  label="Cached Requests"
                  valueClassName="tabular-nums"
                />
              </div>
              {cacheEfficiency.byModel.map((m) => {
                const tone: ProgressBarTone = m.requestCacheHitRate > 50 ? 'success' : m.requestCacheHitRate > 10 ? 'warning' : 'danger';
                return (
                  <ProgressRow
                    key={m.modelId}
                    label={m.modelId}
                    value={`${fmtPercent(m.requestCacheHitRate)}% req · ${fmtPercent(m.hitRate)}% tok`}
                    progressValue={m.requestCacheHitRate}
                    minPercent={2}
                    tone={tone}
                    labelWidth="6.25rem"
                    valueWidth="6rem"
                    valueClassName="text-dim tabular-nums"
                    title={m.modelId}
                  />
                );
              })}
              <div className="text-[11px] text-dim pt-2 mt-2 border-t border-border-subtle">
                Request hit rate counts requests with any cache read. Cached share is provider-reported cached token volume.
              </div>
            </>
          )}
        </DashboardGridCell>
        {/* System Prompt */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            System Prompt
          </SectionLabel>
          {systemPrompt && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MetricTile value={fmt(systemPrompt.avgSystemPromptTokens)} label="Avg Size" valueClassName="tabular-nums" />
                <MetricTile
                  value={`${fmtPercent(systemPrompt.avgPctOfContextWindow)}%`}
                  label="Avg % Window"
                  valueClassName="tabular-nums"
                />
                <MetricTile value={fmt(systemPrompt.maxSystemPromptTokens)} label="Max Size" valueClassName="tabular-nums" />
              </div>
              {systemPrompt.byModel.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {systemPrompt.byModel.map((m) => (
                    <div key={m.modelId} className="grid grid-cols-[minmax(0,1fr)_64px_56px_54px] items-center gap-2 text-[11px]">
                      <span className="text-secondary truncate" title={m.modelId}>
                        {m.modelId}
                      </span>
                      <span className="font-mono text-primary text-right">{fmt(m.avgSystemPromptTokens)}</span>
                      <span className="font-mono text-dim text-right tabular-nums">{fmtPercent(m.avgPctOfContextWindow)}%</span>
                      <span className="font-mono text-dim text-right">/{fmt(m.contextWindow)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-dim pt-2 border-t border-border-subtle">
                Sampled from {systemPrompt.samples} session{systemPrompt.samples !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </DashboardGridCell>
      </DashboardGrid>
    </SurfacePanel>
  );
}

function WindowedCacheAndSystemPrompt({
  cacheEfficiency,
  systemPrompt,
}: {
  cacheEfficiency: CacheEfficiencyAggregate | null;
  systemPrompt: SystemPromptAggregate | null;
}) {
  return (
    <div className="wos-cache-system">
      <WindowedKeyValueGrid
        className="wos-cache-system__summary"
        columns={4}
        items={[
          {
            label: 'Req Hit',
            value: cacheEfficiency ? (
              <WindowedBadge tone={cacheEfficiency.requestCacheHitRate > 50 ? 'positive' : 'warning'}>
                {fmtPercent(cacheEfficiency.requestCacheHitRate)}%
              </WindowedBadge>
            ) : (
              '-'
            ),
          },
          {
            label: 'Cached',
            value: cacheEfficiency ? (
              <WindowedBadge tone={cacheEfficiency.overallHitRate > 30 ? 'positive' : 'warning'}>
                {fmtPercent(cacheEfficiency.overallHitRate)}%
              </WindowedBadge>
            ) : (
              '-'
            ),
          },
          { label: 'Read', value: cacheEfficiency ? fmt(cacheEfficiency.totalCached) : '-' },
          { label: 'Avg Prompt', value: systemPrompt ? fmt(systemPrompt.avgSystemPromptTokens) : '-' },
        ]}
      />
      <div className="wos-cache-system__grid">
        <WindowedDataTable
          className="wos-cache-system__cache"
          columns={[{ label: 'Model' }, { label: 'Requests', align: 'right' }, { label: 'Tokens', align: 'right' }, { label: 'Read' }]}
          columnTemplate="minmax(12rem, 1fr) minmax(5.5rem, 0.36fr) minmax(5rem, 0.34fr) minmax(8rem, 0.72fr)"
        >
          {cacheEfficiency && cacheEfficiency.byModel.length > 0 ? (
            cacheEfficiency.byModel.map((model) => (
              <WindowedDataRow
                key={model.modelId}
                name={model.modelId}
                meta={`${model.cachedRequests}/${model.requests} cached requests`}
                cells={[
                  {
                    value: (
                      <WindowedBadge
                        tone={model.requestCacheHitRate > 50 ? 'positive' : model.requestCacheHitRate > 10 ? 'warning' : 'danger'}
                      >
                        {fmtPercent(model.requestCacheHitRate)}%
                      </WindowedBadge>
                    ),
                    align: 'right',
                  },
                  { value: `${fmtPercent(model.hitRate)}%`, align: 'right' },
                  { value: <WindowedCacheBar percent={model.requestCacheHitRate} label={`${model.modelId} request cache hit rate`} /> },
                ]}
              />
            ))
          ) : (
            <WindowedDataRow
              name="No cache rows"
              meta="Current range"
              cells={[{ value: '-', align: 'right' }, { value: '-', align: 'right' }, { value: 'Waiting' }]}
            />
          )}
        </WindowedDataTable>
        <WindowedDataTable
          className="wos-cache-system__prompts"
          columns={[{ label: 'Model' }, { label: 'Avg', align: 'right' }, { label: 'Window', align: 'right' }, { label: 'Share' }]}
          columnTemplate="minmax(12rem, 1fr) minmax(5rem, 0.34fr) minmax(5.5rem, 0.36fr) minmax(8rem, 0.72fr)"
        >
          {systemPrompt && systemPrompt.byModel.length > 0 ? (
            systemPrompt.byModel.map((model) => (
              <WindowedDataRow
                key={model.modelId}
                name={model.modelId}
                meta={`${systemPrompt.samples} sampled session${systemPrompt.samples === 1 ? '' : 's'}`}
                cells={[
                  { value: fmt(model.avgSystemPromptTokens), align: 'right' },
                  { value: `/${fmt(model.contextWindow)}`, align: 'right' },
                  {
                    value: (
                      <WindowedCacheBar
                        percent={model.avgPctOfContextWindow}
                        label={`${model.modelId} average system prompt context share`}
                        tone="prompt"
                      />
                    ),
                  },
                ]}
              />
            ))
          ) : (
            <WindowedDataRow
              name="No prompt rows"
              meta="Current range"
              cells={[{ value: '-', align: 'right' }, { value: '-', align: 'right' }, { value: 'Waiting' }]}
            />
          )}
        </WindowedDataTable>
      </div>
    </div>
  );
}

function WindowedCacheBar({ percent, label, tone = 'cache' }: { percent: number; label: string; tone?: 'cache' | 'prompt' }) {
  return (
    <span className="wos-cache-system-bar" data-tone={tone} aria-label={label}>
      <span style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
  );
}

function fmtPercent(n: number): string {
  return n
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
