/**
 * Braid Chart — Multi-metric time series overlay (SVG)
 */

import type { TraceTokenDaily } from '@neon-pilot/extensions/data';
import { PanelHeader, SurfacePanel, WindowedStateBlock } from '@neon-pilot/extensions/ui';
import React from 'react';

export function TracesBraidChart({ data, presentation = 'stable' }: { data: TraceTokenDaily[]; presentation?: 'stable' | 'windowed' }) {
  if (!data || data.length < 2) {
    if (presentation === 'windowed') {
      return (
        <WindowedStateBlock className="wos-braid-chart-empty">
          Need at least two retained daily samples before the time series can render.
        </WindowedStateBlock>
      );
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader
          title={`Time Series — Last ${data?.length ?? 0} Days`}
          meta="Need 2+ data points"
          metaClassName="bg-transparent px-0"
        />
      </SurfacePanel>
    );
  }

  const W = 700;
  const H = 110;
  const pad = { top: 8, bottom: 20, left: 0, right: 0 };
  const chartH = H - pad.top - pad.bottom;

  // Build series
  const inputSeries = data.map((d) => d.tokensInput);
  const outputSeries = data.map((d) => d.tokensOutput);
  const costSeries = data.map((d) => d.cost);
  const errorSeries = data.map((d) => d.toolErrors);
  const hasErrors = errorSeries.some((v) => v > 0);

  const maxVal = Math.max(...inputSeries, ...outputSeries, 1);
  const maxCost = Math.max(...costSeries, 0.01);
  const maxErr = Math.max(...errorSeries, 1);

  const xStep = W / Math.max(data.length - 1, 1);

  const line = (series: number[], scale: (v: number) => number) =>
    series.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${pad.top + chartH - scale(v)}`).join(' ');

  const scaleTokens = (v: number) => (v / maxVal) * chartH * 0.5;
  const scaleCost = (v: number) => (v / maxCost) * chartH * 0.35;
  const scaleErr = (v: number) => (v / maxErr) * chartH * 0.15;

  const inputPath = line(inputSeries, scaleTokens);
  const outputPath = line(outputSeries, scaleTokens);
  const costPath = line(costSeries, scaleCost);
  const errPath = line(errorSeries, scaleErr);

  const chart = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={presentation === 'windowed' ? 'wos-braid-chart-svg' : 'w-full h-[100px]'}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Time series over ${data.length} days`}
    >
      {[0.25, 0.5, 0.75].map((r) => (
        <line
          key={r}
          x1="0"
          y1={pad.top + chartH * (1 - r)}
          x2={W}
          y2={pad.top + chartH * (1 - r)}
          className={presentation === 'windowed' ? 'wos-braid-grid-line' : undefined}
          stroke={presentation === 'windowed' ? undefined : 'rgba(255,255,255,0.04)'}
          strokeWidth="0.5"
        />
      ))}
      <path
        d={inputPath}
        fill="none"
        className={presentation === 'windowed' ? 'wos-braid-line wos-braid-line--input' : undefined}
        stroke={presentation === 'windowed' ? undefined : '#6c8aff'}
        strokeWidth="1.5"
        opacity="0.7"
      />
      <path
        d={outputPath}
        fill="none"
        className={presentation === 'windowed' ? 'wos-braid-line wos-braid-line--output' : undefined}
        stroke={presentation === 'windowed' ? undefined : '#4cd964'}
        strokeWidth="1.5"
        opacity="0.7"
      />
      <path
        d={costPath}
        fill="none"
        className={presentation === 'windowed' ? 'wos-braid-line wos-braid-line--cost' : undefined}
        stroke={presentation === 'windowed' ? undefined : '#ff9f0a'}
        strokeWidth="1.5"
        opacity="0.7"
      />
      {hasErrors && (
        <path
          d={errPath}
          fill="none"
          className={presentation === 'windowed' ? 'wos-braid-line wos-braid-line--errors' : undefined}
          stroke={presentation === 'windowed' ? undefined : '#ff4757'}
          strokeWidth="1.5"
          opacity="0.7"
        />
      )}
      <text
        x="0"
        y={H - 4}
        className={presentation === 'windowed' ? 'wos-braid-label' : undefined}
        fill={presentation === 'windowed' ? undefined : 'var(--dim)'}
        fontSize="7"
      >
        {data[0]?.date?.slice(5) ?? ''}
      </text>
      <text
        x={W / 2}
        y={H - 4}
        className={presentation === 'windowed' ? 'wos-braid-label' : undefined}
        fill={presentation === 'windowed' ? undefined : 'var(--dim)'}
        fontSize="7"
        textAnchor="middle"
      >
        {data[Math.floor(data.length / 2)]?.date?.slice(5) ?? ''}
      </text>
      <text
        x={W}
        y={H - 4}
        className={presentation === 'windowed' ? 'wos-braid-label' : undefined}
        fill={presentation === 'windowed' ? undefined : 'var(--dim)'}
        fontSize="7"
        textAnchor="end"
      >
        {data[data.length - 1]?.date?.slice(5) ?? ''}
      </text>
    </svg>
  );

  const legend = (
    <>
      <span className={presentation === 'windowed' ? 'wos-braid-legend-item' : 'flex items-center gap-1'}>
        <span className={presentation === 'windowed' ? 'wos-braid-legend-line wos-braid-line--input' : 'w-3 h-0.5 rounded bg-[#6c8aff]'} />{' '}
        Input
      </span>
      <span className={presentation === 'windowed' ? 'wos-braid-legend-item' : 'flex items-center gap-1'}>
        <span className={presentation === 'windowed' ? 'wos-braid-legend-line wos-braid-line--output' : 'w-3 h-0.5 rounded bg-[#4cd964]'} />{' '}
        Output
      </span>
      <span className={presentation === 'windowed' ? 'wos-braid-legend-item' : 'flex items-center gap-1'}>
        <span className={presentation === 'windowed' ? 'wos-braid-legend-line wos-braid-line--cost' : 'w-3 h-0.5 rounded bg-[#ff9f0a]'} />{' '}
        Cost
      </span>
      {hasErrors && (
        <span className={presentation === 'windowed' ? 'wos-braid-legend-item' : 'flex items-center gap-1'}>
          <span
            className={presentation === 'windowed' ? 'wos-braid-legend-line wos-braid-line--errors' : 'w-3 h-0.5 rounded bg-[#ff4757]'}
          />{' '}
          Errors
        </span>
      )}
      <span className={presentation === 'windowed' ? 'wos-braid-peak' : 'ml-auto'}>Peak: {formatNumber(maxVal)} tokens</span>
    </>
  );

  if (presentation === 'windowed') {
    return (
      <section className="wos-braid-chart" aria-label={`Time Series — Last ${data.length} Days`}>
        <header className="wos-braid-chart-header">
          <h4>Time Series</h4>
          <span>{`${hasErrors ? '4' : '3'} metrics overlaid · ${data.length} days`}</span>
        </header>
        <div className="wos-braid-chart-body">
          {chart}
          <div className="wos-braid-legend">{legend}</div>
        </div>
      </section>
    );
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader
        title={`Time Series — Last ${data.length} Days`}
        meta={`${hasErrors ? '4' : '3'} metrics overlaid`}
        metaClassName="bg-transparent px-0"
      />
      <div className="p-3">
        {chart}
        <div className="flex gap-3 text-[10px] text-dim mt-1">{legend}</div>
      </div>
    </SurfacePanel>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
