/**
 * Token Activity Heatmap — GitHub-style contribution grid
 */

import type { TraceTokenDaily } from '@neon-pilot/extensions/data';
import { PanelHeader, PanelMessage, SurfacePanel, WindowedChartPanel, WindowedStateBlock } from '@neon-pilot/extensions/ui';
import React from 'react';

export function TracesHeatmap({ data, presentation = 'stable' }: { data: TraceTokenDaily[]; presentation?: 'stable' | 'windowed' }) {
  if (!data || data.length === 0) {
    if (presentation === 'windowed') {
      return <WindowedStateBlock className="wos-heatmap-empty">Data accumulates after sessions produce tokens.</WindowedStateBlock>;
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Token Activity — All Retained History" meta="No data yet" metaClassName="bg-transparent px-0" />
        <PanelMessage align="center" className="p-6">
          Data accumulates after sessions produce tokens.
        </PanelMessage>
      </SurfacePanel>
    );
  }

  const values = data.map(tokenTotal);
  const max = Math.max(...values, 1);

  // Bucket into weeks (groups of 7)
  const weeks: TraceTokenDaily[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const level = (v: number) => {
    if (v === 0) return 0;
    const ratio = v / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  const cellColors =
    presentation === 'windowed'
      ? ['wos-heatmap-cell-0', 'wos-heatmap-cell-1', 'wos-heatmap-cell-2', 'wos-heatmap-cell-3', 'wos-heatmap-cell-4']
      : ['ui-heatmap-cell-0', 'ui-heatmap-cell-1', 'ui-heatmap-cell-2', 'ui-heatmap-cell-3', 'ui-heatmap-cell-4'];

  const total = data.reduce((a, d) => a + d.tokensInput + d.tokensOutput + d.tokensCached + d.tokensCachedWrite, 0);
  const avg = total / Math.max(data.length, 1);
  const firstDate = data[0]?.date;
  const lastDate = data[data.length - 1]?.date;
  const dateRange = firstDate && lastDate ? `${firstDate} → ${lastDate}` : 'All retained history';

  const heatmapGrid = (
    <div className={presentation === 'windowed' ? 'wos-heatmap-grid' : 'flex gap-0.5 min-w-[500px]'}>
      {weeks.map((week, wi) => (
        <div key={wi} className={presentation === 'windowed' ? 'wos-heatmap-week' : 'flex flex-col gap-0.5'}>
          {week.map((day, di) => {
            const v = tokenTotal(day);
            const lvl = level(v);
            return (
              <div
                key={di}
                className={presentation === 'windowed' ? `wos-heatmap-cell ${cellColors[lvl]}` : `w-3 h-3 rounded-sm ${cellColors[lvl]}`}
                title={`${day.date}: ${formatNumber(v)} tokens (in: ${formatNumber(day.tokensInput)}, cache read: ${formatNumber(day.tokensCached)}, cache write: ${formatNumber(day.tokensCachedWrite)}, out: ${formatNumber(day.tokensOutput)})`}
              />
            );
          })}
          {week.length < 7 &&
            Array.from({ length: 7 - week.length }).map((_, i) => (
              <div key={`pad-${i}`} className={presentation === 'windowed' ? 'wos-heatmap-cell wos-heatmap-cell-pad' : 'w-3 h-3'} />
            ))}
        </div>
      ))}
    </div>
  );

  const legend = (
    <>
      <span>Less</span>
      {cellColors.map((cellClassName, i) => (
        <div
          key={i}
          className={presentation === 'windowed' ? `wos-heatmap-legend-cell ${cellClassName}` : `w-2.5 h-2.5 rounded-sm ${cellClassName}`}
        />
      ))}
      <span>More</span>
      <span className={presentation === 'windowed' ? 'wos-heatmap-peak' : 'ml-4 text-warning'}>Peak: {formatNumber(max)} tokens</span>
      <span className={presentation === 'windowed' ? 'wos-heatmap-share' : 'ml-auto'}>
        In:{' '}
        <span className={presentation === 'windowed' ? 'wos-heatmap-share-value' : 'text-accent'}>
          {pct(
            data.reduce((a, d) => a + d.tokensInput, 0),
            total,
          )}
        </span>
      </span>
      <span>
        Cache Read:{' '}
        <span className={presentation === 'windowed' ? 'wos-heatmap-share-value' : 'text-warning'}>
          {pct(
            data.reduce((a, d) => a + d.tokensCached, 0),
            total,
          )}
        </span>
      </span>
      <span>
        Cache Write:{' '}
        <span className={presentation === 'windowed' ? 'wos-heatmap-share-value' : 'text-warning'}>
          {pct(
            data.reduce((a, d) => a + d.tokensCachedWrite, 0),
            total,
          )}
        </span>
      </span>
      <span>
        Out:{' '}
        <span className={presentation === 'windowed' ? 'wos-heatmap-share-value' : 'text-success'}>
          {pct(
            data.reduce((a, d) => a + d.tokensOutput, 0),
            total,
          )}
        </span>
      </span>
    </>
  );

  if (presentation === 'windowed') {
    return (
      <WindowedChartPanel
        className="wos-heatmap"
        title="Token Activity"
        meta={`${dateRange} · ${formatNumber(total)} total · ${formatNumber(avg)} avg/active day`}
        ariaLabel="Token Activity — All Retained History"
      >
        {heatmapGrid}
        <div className="wos-heatmap-legend">{legend}</div>
      </WindowedChartPanel>
    );
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader
        title="Token Activity — All Retained History"
        meta={`${dateRange} · ${formatNumber(total)} total · ${formatNumber(avg)} avg/active day`}
      />
      <div className="p-4 overflow-x-auto">
        {heatmapGrid}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-dim">{legend}</div>
      </div>
    </SurfacePanel>
  );
}

// Heatmap intensity is based on actual work done (fresh input + output),
// not cache tokens which inflate heavily in long-running sessions.
function tokenTotal(day: TraceTokenDaily): number {
  return day.tokensInput + day.tokensOutput;
}

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '0%';
}

function formatNumber(n: number): string {
  const value = Math.trunc(Number.isFinite(n) ? n : 0);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}
