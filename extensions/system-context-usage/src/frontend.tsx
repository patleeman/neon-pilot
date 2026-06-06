import type { ExtensionStatusBarItemProps } from '@neon-pilot/extensions';
import { RingStatusDot, Tooltip } from '@neon-pilot/extensions/ui';
import React from 'react';

function formatContextWindowLabel(contextWindow: number): string {
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) {
    return 'unknown';
  }

  if (contextWindow >= 1_000_000) {
    const millions = contextWindow / 1_000_000;
    return Number.isInteger(millions) ? `${millions}M` : `${millions.toFixed(1)}M`;
  }

  if (contextWindow >= 1_000) {
    const thousands = contextWindow / 1_000;
    return Number.isInteger(thousands) ? `${thousands}k` : `${thousands.toFixed(1)}k`;
  }

  return String(contextWindow);
}

function getContextUsagePercent(tokens: number | null, contextWindow: number): number | null {
  if (tokens === null || !Number.isSafeInteger(tokens) || tokens < 0 || !Number.isSafeInteger(contextWindow) || contextWindow <= 0) {
    return null;
  }

  return (tokens / contextWindow) * 100;
}

function formatContextUsageLabel(tokens: number | null, contextWindow: number): string {
  const pct = getContextUsagePercent(tokens, contextWindow);
  if (pct === null) {
    return `? of ${formatContextWindowLabel(contextWindow)} ctx`;
  }
  return `${pct.toFixed(1)}% of ${formatContextWindowLabel(contextWindow)} ctx`;
}

export function ContextUsageIndicator({ statusBarContext }: ExtensionStatusBarItemProps) {
  const tokens = statusBarContext.contextUsage;
  if (!tokens) {
    return null;
  }

  const label = formatContextUsageLabel(tokens.total, tokens.contextWindow);
  const percent = getContextUsagePercent(tokens.total, tokens.contextWindow);
  const boundedPercent = Math.max(0, Math.min(100, percent ?? 0));
  const tone = percent === null ? 'muted' : percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : 'accent';

  return (
    <span className="group relative inline-flex shrink-0 items-center" role="img" title={label} aria-label={`Context usage: ${label}`}>
      <RingStatusDot value={boundedPercent} tone={tone} />
      <Tooltip mono className="text-[10px]">
        {label}
      </Tooltip>
    </span>
  );
}
