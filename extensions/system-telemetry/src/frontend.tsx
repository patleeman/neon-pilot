/**
 * Traces Page — Full telemetry and monitoring dashboard.
 *
 * Sections:
 * 1. Live token stream (animated bar)
 * 2. Pulse row (5 summary cards)
 * 3. Token activity heatmap
 * 4. Model usage & cost breakdown
 * 5. Braid chart (time series overlay)
 * 6. Tool telemetry
 * 7. Context pressure & session activity
 * 8. Agent loop health & run waterfall
 * 9. Subagent flame graph
 */

import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  MetricTile,
  QuietLoadingState,
  SegmentedControl,
  StatGrid,
  WindowedBadge,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedList,
  WindowedListItem,
  WindowedPageButton,
  WindowedPageInspector,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageSection,
  WindowedPageShell,
} from '@neon-pilot/extensions/ui';
import React, { useState } from 'react';

import { TracesAgentLoop } from './traces/TracesAgentLoop';
import { TracesAutoMode } from './traces/TracesAutoMode';
import { TracesBraidChart } from './traces/TracesBraidChart';
import { TracesCacheAndSystemPrompt } from './traces/TracesCacheAndSystemPrompt';
import { TracesContextPointers } from './traces/TracesContextPointers';
import { TracesContextPressure } from './traces/TracesContextPressure';
import { TracesDailyUsage } from './traces/TracesDailyUsage';
import { TracesHeatmap } from './traces/TracesHeatmap';
import { TracesModelUsage } from './traces/TracesModelUsage';
import { TracesSessionIntegrity } from './traces/TracesSessionIntegrity';
import { TracesToolFlow } from './traces/TracesToolFlow';
import { TracesToolHealth } from './traces/TracesToolHealth';
import type { TraceRange } from './traces/useTracesData';
import { useTracesData } from './traces/useTracesData';

export function TelemetryPage({ pa, context }: ExtensionSurfaceProps) {
  const [range, setRange] = useState<TraceRange>('24h');
  const {
    summary,
    modelUsage,
    throughput,
    toolHealth,
    contextSessions,
    compactions,
    compactionAggs,
    agentLoop,
    tokensDaily,
    toolFlow,
    autoMode,
    cacheEfficiency,
    systemPrompt,
    contextPointers,
    sessionIntegrity,
    loading,
    error,
    refetch,
  } = useTracesData(range, pa);
  const hasDiagnosticActivity = Boolean(
    summary &&
    (summary.activeSessions > 0 ||
      summary.runsToday > 0 ||
      summary.toolCalls > 0 ||
      summary.tokensTotal > 0 ||
      summary.toolErrors > 0 ||
      (tokensDaily?.length ?? 0) > 0 ||
      (toolHealth?.length ?? 0) > 0),
  );

  if (error) {
    if (context?.shellPresentation === 'windowed') {
      return (
        <WindowedPageShell>
          <WindowedPageRail title="Diagnostics" accent="telemetry">
            <WindowedRangeSelector value={range} onChange={setRange} />
          </WindowedPageRail>
          <WindowedPageMain
            eyebrow="Diagnostics"
            title="Diagnostics unavailable"
            actions={<WindowedPageButton onClick={refetch}>Try again</WindowedPageButton>}
          >
            <WindowedPageSection>
              <ErrorState message={error} />
            </WindowedPageSection>
          </WindowedPageMain>
          <WindowedPageInspector eyebrow="Data context" title="Load failed">
            <WindowedPageSection title="Status">
              <WindowedKeyValueList
                items={[
                  { label: 'Range', value: range.toUpperCase() },
                  { label: 'State', value: 'Error' },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageInspector>
        </WindowedPageShell>
      );
    }

    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout contentClassName="space-y-6">
          <AppPageIntro title="Diagnostics" />
          <ErrorState message={error} />
          <Button variant="action" onClick={refetch}>
            <span aria-hidden="true">↻</span>
            Try again
          </Button>
        </AppPageLayout>
      </div>
    );
  }

  if (context?.shellPresentation === 'windowed') {
    const usageSection =
      loading && !summary ? (
        <QuietLoadingState label="Loading diagnostics" className="min-h-24" />
      ) : !summary ? (
        <EmptyState
          align="start"
          title="No diagnostics yet"
          body={
            loading
              ? 'Diagnostics will fill in after retained usage, tool, and context data loads.'
              : 'Diagnostics fill in after conversations produce retained usage, tool, and context data.'
          }
        />
      ) : !hasDiagnosticActivity ? (
        <EmptyState
          align="start"
          title="No diagnostic activity in this range"
          body="Diagnostics populate after conversations, tools, and model runs produce retained usage data."
        />
      ) : null;

    return (
      <WindowedPageShell>
        <WindowedPageRail title="Diagnostics" accent="telemetry">
          <WindowedRangeSelector value={range} onChange={setRange} />
          <WindowedPageSection title="Data" meta={loading ? 'Loading' : summary ? 'Loaded' : 'Empty'}>
            <WindowedKeyValueList
              items={[
                { label: 'Sessions', value: summary ? `${summary.activeSessions}` : '0' },
                { label: 'Runs', value: summary ? `${summary.runsToday}` : '0' },
                { label: 'Tools', value: summary ? `${summary.toolCalls}` : '0' },
              ]}
            />
          </WindowedPageSection>
        </WindowedPageRail>

        <WindowedPageMain
          eyebrow="Local observability"
          title="Diagnostics"
          actions={<WindowedPageButton onClick={refetch}>{loading ? 'Refreshing' : 'Refresh'}</WindowedPageButton>}
        >
          {summary ? (
            <WindowedPageSection title="Overview" meta={range.toUpperCase()}>
              <WindowedPulseGrid summary={summary} />
            </WindowedPageSection>
          ) : null}

          {usageSection ? <WindowedPageSection title="Usage">{usageSection}</WindowedPageSection> : null}

          {summary && hasDiagnosticActivity ? (
            <>
              <WindowedPageSection title="Usage" meta="Tokens and models">
                <div className="space-y-4">
                  {tokensDaily && <TracesHeatmap data={tokensDaily} />}
                  {tokensDaily && <TracesDailyUsage data={tokensDaily} />}
                  {modelUsage && (
                    <TracesModelUsage
                      models={modelUsage}
                      throughput={throughput ?? []}
                      totalTokens={modelUsage.reduce((total, model) => total + model.tokens, 0)}
                      tokensInput={summary.tokensInput}
                      tokensOutput={summary.tokensOutput}
                      tokensCached={summary.tokensCached}
                      tokensCachedWrite={summary.tokensCachedWrite}
                      cacheHitRate={summary.cacheHitRate}
                      cacheEfficiency={cacheEfficiency}
                    />
                  )}
                  {tokensDaily && <TracesBraidChart data={tokensDaily} />}
                </div>
              </WindowedPageSection>

              <WindowedPageSection title="Tools" meta={`${summary.toolCalls} calls`}>
                <div className="space-y-4">
                  {toolHealth && <TracesToolHealth tools={toolHealth} />}
                  <TracesToolFlow data={toolFlow} />
                </div>
              </WindowedPageSection>

              <WindowedPageSection title="App activity" meta="Context and runtime">
                <div className="space-y-4">
                  <TracesContextPointers data={contextPointers} />
                  <TracesAutoMode data={autoMode} />
                  <TracesSessionIntegrity events={sessionIntegrity ?? []} />
                  <TracesCacheAndSystemPrompt cacheEfficiency={cacheEfficiency} systemPrompt={systemPrompt} />
                  <TracesContextPressure sessions={contextSessions ?? []} compactions={compactions ?? []} compactionAggs={compactionAggs} />
                  <TracesAgentLoop loop={agentLoop} />
                </div>
              </WindowedPageSection>
            </>
          ) : null}
        </WindowedPageMain>

        <WindowedPageInspector eyebrow="Diagnostics context" title={summary ? 'Current range' : 'Waiting for data'}>
          <WindowedPageSection title="Status">
            <WindowedKeyValueList
              items={[
                { label: 'Range', value: range.toUpperCase() },
                { label: 'Activity', value: hasDiagnosticActivity ? 'Present' : 'None' },
                { label: 'Loading', value: loading ? 'Yes' : 'No' },
                { label: 'Errors', value: summary ? `${summary.toolErrors}` : '0' },
              ]}
            />
          </WindowedPageSection>
          <WindowedPageSection title="Health">
            <WindowedBadge tone={summary?.toolErrors ? 'danger' : hasDiagnosticActivity ? 'positive' : 'neutral'}>
              {summary?.toolErrors ? 'Needs attention' : hasDiagnosticActivity ? 'Active' : 'Quiet'}
            </WindowedBadge>
          </WindowedPageSection>
        </WindowedPageInspector>
      </WindowedPageShell>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="space-y-6">
        <AppPageIntro
          title="Diagnostics"
          actions={
            <div className="flex items-center gap-2">
              <TimeRangeSelector value={range} onChange={setRange} />
              <IconButton compact aria-label="Refresh diagnostics" title="Refresh diagnostics" onClick={refetch}>
                <RefreshIcon />
              </IconButton>
            </div>
          }
        />

        {loading && !summary ? (
          <AppPageSection title="Usage" layout="stacked" bodyClassName="space-y-4">
            <QuietLoadingState label="Loading diagnostics" />
          </AppPageSection>
        ) : !summary ? (
          <AppPageSection title="Usage" layout="stacked" bodyClassName="space-y-4">
            <EmptyState
              align="start"
              eyebrow="Dashboard page"
              title="No diagnostics yet"
              body={
                loading
                  ? 'Diagnostics will fill in after retained usage, tool, and context data loads.'
                  : 'Diagnostics fill in after conversations produce retained usage, tool, and context data.'
              }
              steps={[
                'Run or resume a conversation.',
                'Open Diagnostics after usage is recorded.',
                'Refresh when you expect new activity.',
              ]}
              action={
                <Button variant="action" tone="accent" onClick={refetch}>
                  <RefreshIcon />
                  Refresh diagnostics
                </Button>
              }
            />
          </AppPageSection>
        ) : null}

        {/* ── Pulse Row ── */}
        {summary && <PulseRow summary={summary} />}

        {summary && !hasDiagnosticActivity ? (
          <AppPageSection title="Usage" layout="stacked" bodyClassName="space-y-4">
            <EmptyState
              align="start"
              eyebrow="Dashboard page"
              title="No diagnostic activity in this range"
              body="Diagnostics populate after conversations, tools, and model runs produce retained usage data."
              steps={['Run or resume a conversation.', 'Use a tool or model response path.', 'Refresh this page after the run finishes.']}
              action={
                <Button variant="action" tone="accent" onClick={refetch}>
                  <RefreshIcon />
                  Refresh diagnostics
                </Button>
              }
            />
          </AppPageSection>
        ) : null}

        {summary && hasDiagnosticActivity ? (
          <AppPageSection title="Usage" layout="stacked" bodyClassName="space-y-4">
            {tokensDaily && <TracesHeatmap data={tokensDaily} />}
            {tokensDaily && <TracesDailyUsage data={tokensDaily} />}
            {modelUsage && summary && (
              <TracesModelUsage
                models={modelUsage}
                throughput={throughput ?? []}
                totalTokens={modelUsage.reduce((total, model) => total + model.tokens, 0)}
                tokensInput={summary.tokensInput}
                tokensOutput={summary.tokensOutput}
                tokensCached={summary.tokensCached}
                tokensCachedWrite={summary.tokensCachedWrite}
                cacheHitRate={summary.cacheHitRate}
                cacheEfficiency={cacheEfficiency}
              />
            )}
            {tokensDaily && summary && <TracesBraidChart data={tokensDaily} />}
          </AppPageSection>
        ) : null}

        {summary && hasDiagnosticActivity ? (
          <AppPageSection title="Tools" layout="stacked" bodyClassName="space-y-4">
            {toolHealth && <TracesToolHealth tools={toolHealth} />}
            <TracesToolFlow data={toolFlow} />
          </AppPageSection>
        ) : null}

        {summary && hasDiagnosticActivity ? (
          <AppPageSection title="App activity" layout="stacked" bodyClassName="space-y-4">
            <TracesContextPointers data={contextPointers} />
            <TracesAutoMode data={autoMode} />
            <TracesSessionIntegrity events={sessionIntegrity ?? []} />
            <TracesCacheAndSystemPrompt cacheEfficiency={cacheEfficiency} systemPrompt={systemPrompt} />
            <TracesContextPressure sessions={contextSessions ?? []} compactions={compactions ?? []} compactionAggs={compactionAggs} />
            <TracesAgentLoop loop={agentLoop} />
          </AppPageSection>
        ) : null}
      </AppPageLayout>
    </div>
  );
}

// ── Time Range Selector ──────────────────────────────────────────────────────

const TRACE_RANGE_OPTIONS: { label: string; value: TraceRange }[] = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
];

function WindowedRangeSelector({ value, onChange }: { value: TraceRange; onChange: (v: TraceRange) => void }) {
  return (
    <WindowedPageSection title="Range" meta={value.toUpperCase()}>
      <WindowedList>
        {TRACE_RANGE_OPTIONS.map((option) => (
          <WindowedListItem
            key={option.value}
            title={option.label}
            meta={option.value === value ? 'Selected' : 'Telemetry range'}
            active={option.value === value}
            accent="telemetry"
            onSelect={() => onChange(option.value)}
          />
        ))}
      </WindowedList>
    </WindowedPageSection>
  );
}

function TimeRangeSelector({ value, onChange }: { value: TraceRange; onChange: (v: TraceRange) => void }) {
  return <SegmentedControl ariaLabel="Telemetry time range" value={value} options={TRACE_RANGE_OPTIONS} onChange={onChange} />;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 7a5 5 0 0 0-8.5-3.2L3 5.3" />
      <path d="M3 2.8v2.5h2.5" />
      <path d="M3 9a5 5 0 0 0 8.5 3.2L13 10.7" />
      <path d="M13 13.2v-2.5h-2.5" />
    </svg>
  );
}

// ── Pulse Row ────────────────────────────────────────────────────────────────

function PulseRow({ summary }: { summary: NonNullable<ReturnType<typeof useTracesData>['summary']> }) {
  const cards = [
    {
      label: 'Traced Sessions',
      value: String(summary.activeSessions),
      tone: 'accent' as const,
      trend: `${summary.activeSessions > 0 ? '✦' : '—'} observed in range`,
      dot: summary.activeSessions > 0,
    },
    {
      label: 'Runs Today',
      value: String(summary.runsToday),
      tone: 'default' as const,
      trend: `${summary.toolCalls} tool calls`,
    },
    {
      label: 'Total Cost',
      value: `$${summary.totalCost.toFixed(2)}`,
      tone: 'warning' as const,
      trend: `${(summary.tokensTotal / 1000).toFixed(0)}K tokens`,
    },
    {
      label: 'Tokens Today',
      value: formatTokens(summary.tokensTotal),
      tone: 'success' as const,
      trend: `in ${formatTokens(summary.tokensInput)} · cached ${formatTokens(summary.tokensCached)} · out ${formatTokens(summary.tokensOutput)}`,
    },
    {
      label: 'Tool Errors',
      value: String(summary.toolErrors),
      tone: summary.toolErrors > 0 ? ('danger' as const) : ('default' as const),
      trend: `${((summary.toolErrors / Math.max(summary.toolCalls, 1)) * 100).toFixed(1)}% error rate`,
    },
  ];

  return (
    <StatGrid compact className="!grid-cols-1 sm:!grid-cols-2 lg:!grid-cols-5">
      {cards.map((card) => (
        <MetricTile
          key={card.label}
          label={card.label}
          value={card.value}
          detail={card.trend}
          tone={card.tone}
          align="left"
          appearance="plain"
          valueClassName="font-mono tabular-nums"
          className="min-w-0"
        />
      ))}
    </StatGrid>
  );
}

function WindowedPulseGrid({ summary }: { summary: NonNullable<ReturnType<typeof useTracesData>['summary']> }) {
  return (
    <WindowedKeyValueGrid
      columns={4}
      items={[
        { label: 'Sessions', value: summary.activeSessions },
        { label: 'Runs', value: summary.runsToday },
        { label: 'Cost', value: `$${summary.totalCost.toFixed(2)}` },
        { label: 'Tokens', value: formatTokens(summary.tokensTotal) },
        { label: 'Input', value: formatTokens(summary.tokensInput) },
        { label: 'Cached', value: formatTokens(summary.tokensCached) },
        { label: 'Output', value: formatTokens(summary.tokensOutput) },
        { label: 'Tool errors', value: summary.toolErrors },
      ]}
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
