/**
 * Cache Efficiency & System Prompt display
 */

import type { CacheEfficiencyAggregate, SystemPromptAggregate } from '@neon-pilot/extensions/data';
import { DashboardGrid, DashboardGridCell, PanelHeader, SectionLabel, SurfacePanel } from '@neon-pilot/extensions/ui';

export function TracesCacheAndSystemPrompt({
  cacheEfficiency,
  systemPrompt,
}: {
  cacheEfficiency: CacheEfficiencyAggregate | null;
  systemPrompt: SystemPromptAggregate | null;
}) {
  if (!cacheEfficiency && !systemPrompt) return null;

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
                <QuickStat
                  value={`${fmtPercent(cacheEfficiency.requestCacheHitRate)}%`}
                  label="Request Hit Rate"
                  cls={cacheEfficiency.requestCacheHitRate > 50 ? 'text-success' : 'text-warning'}
                />
                <QuickStat
                  value={`${fmtPercent(cacheEfficiency.overallHitRate)}%`}
                  label="Cached Share"
                  cls={cacheEfficiency.overallHitRate > 30 ? 'text-success' : 'text-warning'}
                />
                <QuickStat value={fmt(cacheEfficiency.totalCached)} label="Cache Read" />
                <QuickStat value={`${cacheEfficiency.cachedRequests}/${cacheEfficiency.requests}`} label="Cached Requests" />
              </div>
              {cacheEfficiency.byModel.map((m) => {
                const barCls = m.requestCacheHitRate > 50 ? 'bg-success' : m.requestCacheHitRate > 10 ? 'bg-warning' : 'bg-danger';
                return (
                  <div key={m.modelId} className="grid grid-cols-[100px_minmax(0,1fr)_96px] items-center gap-2 py-1">
                    <span className="text-[11px] text-secondary truncate" title={m.modelId}>
                      {m.modelId}
                    </span>
                    <div className="h-1.5 bg-elevated rounded overflow-hidden">
                      <div className={`h-full rounded ${barCls}`} style={{ width: `${Math.max(m.requestCacheHitRate, 2)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-dim text-right tabular-nums">
                      {fmtPercent(m.requestCacheHitRate)}% req · {fmtPercent(m.hitRate)}% tok
                    </span>
                  </div>
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
                <QuickStat value={fmt(systemPrompt.avgSystemPromptTokens)} label="Avg Size" />
                <QuickStat value={`${fmtPercent(systemPrompt.avgPctOfContextWindow)}%`} label="Avg % Window" />
                <QuickStat value={fmt(systemPrompt.maxSystemPromptTokens)} label="Max Size" />
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

function QuickStat({ value, label, cls = '' }: { value: string; label: string; cls?: string }) {
  return (
    <div className="min-w-0 bg-elevated rounded-lg p-2.5 text-center">
      <div className={`truncate text-[17px] font-semibold font-mono tabular-nums ${cls}`} title={value}>
        {value}
      </div>
      <SectionLabel tone="muted">{label}</SectionLabel>
    </div>
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
