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
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSegmentedControl,
  WindowedStateBlock,
  WindowedTimeline,
  WindowedTimelineItem,
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
        <WindowedPageShell layout="standard" className="telemetry-page-windowed">
          <WindowedPageMain
            title="Diagnostics unavailable"
            actions={
              <>
                <WindowedRangeSelector value={range} onChange={setRange} />
                <WindowedPageButton onClick={refetch}>Try again</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection>
              <WindowedStateBlock tone="danger">{error}</WindowedStateBlock>
            </WindowedPageSection>
            <WindowedPageSection title="Status">
              <WindowedKeyValueList
                items={[
                  { label: 'Range', value: range.toUpperCase() },
                  { label: 'State', value: 'Error' },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
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
        <WindowedStateBlock>Loading diagnostics.</WindowedStateBlock>
      ) : !summary ? (
        <WindowedEmptyState>
          <strong>No diagnostics yet.</strong>{' '}
          {loading
            ? 'Diagnostics will fill in after retained usage, tool, and context data loads.'
            : 'Diagnostics fill in after conversations produce retained usage, tool, and context data.'}
        </WindowedEmptyState>
      ) : !hasDiagnosticActivity ? (
        <WindowedEmptyState>
          <strong>No diagnostic activity in this range.</strong> Diagnostics populate after conversations, tools, and model runs produce
          retained usage data.
        </WindowedEmptyState>
      ) : null;

    return (
      <WindowedPageShell layout="standard" className="telemetry-page-windowed">
        <WindowedPageMain
          title="Diagnostics"
          actions={
            <>
              <WindowedRangeSelector value={range} onChange={setRange} />
              <WindowedPageButton onClick={refetch}>{loading ? 'Refreshing' : 'Refresh'}</WindowedPageButton>
            </>
          }
        >
          <WindowedPageSection title="Data" meta={loading ? 'Loading' : summary ? 'Loaded' : 'Empty'}>
            <WindowedKeyValueList
              items={[
                { label: 'Sessions', value: summary ? `${summary.activeSessions}` : '0' },
                { label: 'Runs', value: summary ? `${summary.runsToday}` : '0' },
                { label: 'Tools', value: summary ? `${summary.toolCalls}` : '0' },
              ]}
            />
          </WindowedPageSection>

          {summary ? (
            <WindowedPageSection title="Overview" meta={range.toUpperCase()}>
              <WindowedPulseGrid summary={summary} />
            </WindowedPageSection>
          ) : null}

          {usageSection ? <WindowedPageSection title="Usage">{usageSection}</WindowedPageSection> : null}

          <WindowedPageSection title="Status" meta={summary ? 'Current range' : 'Waiting for data'}>
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

          {summary && hasDiagnosticActivity ? (
            <>
              <WindowedPageSection title="Models" meta={modelUsage?.length ? `${modelUsage.length} observed` : 'No model data'}>
                <WindowedModelUsageTable models={modelUsage ?? []} cacheEfficiency={cacheEfficiency} />
              </WindowedPageSection>

              <WindowedPageSection title="Tool calls" meta={toolHealth?.length ? `${summary.toolCalls} calls` : 'No tool data'}>
                <WindowedToolHealthTable tools={toolHealth ?? []} />
              </WindowedPageSection>

              <WindowedPageSection title="Recent activity" meta="Runtime signals">
                <WindowedDiagnosticsTimeline
                  summary={summary}
                  agentLoop={agentLoop}
                  contextSessions={contextSessions ?? []}
                  sessionIntegrity={sessionIntegrity ?? []}
                />
              </WindowedPageSection>

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

function WindowedModelUsageTable({
  models,
  cacheEfficiency,
}: {
  models: NonNullable<ReturnType<typeof useTracesData>['modelUsage']>;
  cacheEfficiency: ReturnType<typeof useTracesData>['cacheEfficiency'];
}) {
  if (models.length === 0) {
    return <WindowedEmptyState>Model usage appears after traced model calls are retained.</WindowedEmptyState>;
  }

  const cacheByModel = Object.fromEntries((cacheEfficiency?.byModel ?? []).map((model) => [model.modelId, model.hitRate]));

  return (
    <WindowedDataTable columns={[{ label: 'Model' }, { label: 'Tokens' }, { label: 'Cache', align: 'right' }]}>
      {models.slice(0, 6).map((model) => {
        const cacheHitRate = cacheByModel[model.modelId];
        return (
          <WindowedDataRow
            key={model.modelId}
            name={model.modelId}
            meta={`${model.calls} calls · $${model.cost.toFixed(2)}`}
            status={<WindowedBadge tone={model.tokens > 0 ? 'positive' : 'neutral'}>{formatTokens(model.tokens)}</WindowedBadge>}
            action={typeof cacheHitRate === 'number' ? `${Math.round(cacheHitRate)}%` : 'n/a'}
          />
        );
      })}
    </WindowedDataTable>
  );
}

function WindowedToolHealthTable({ tools }: { tools: NonNullable<ReturnType<typeof useTracesData>['toolHealth']> }) {
  if (tools.length === 0) {
    return <WindowedEmptyState>Tool calls appear after agents execute tools in retained traces.</WindowedEmptyState>;
  }

  return (
    <WindowedDataTable columns={[{ label: 'Tool' }, { label: 'Calls' }, { label: 'Errors', align: 'right' }]}>
      {tools.slice(0, 8).map((tool) => {
        const hasErrors = tool.errors > 0;
        return (
          <WindowedDataRow
            key={tool.toolName}
            name={tool.toolName}
            meta={`${Math.round(tool.successRate)}% success · p95 ${formatDuration(tool.p95LatencyMs)}`}
            status={<WindowedBadge tone={hasErrors ? 'warning' : 'positive'}>{tool.calls}</WindowedBadge>}
            action={String(tool.errors)}
          />
        );
      })}
    </WindowedDataTable>
  );
}

function WindowedDiagnosticsTimeline({
  summary,
  agentLoop,
  contextSessions,
  sessionIntegrity,
}: {
  summary: NonNullable<ReturnType<typeof useTracesData>['summary']>;
  agentLoop: ReturnType<typeof useTracesData>['agentLoop'];
  contextSessions: NonNullable<ReturnType<typeof useTracesData>['contextSessions']>;
  sessionIntegrity: NonNullable<ReturnType<typeof useTracesData>['sessionIntegrity']>;
}) {
  const pressureSession = contextSessions.filter((session) => typeof session.pct === 'number').sort((a, b) => b.pct - a.pct)[0];
  const durationP95Ms = agentLoop?.durationP95Ms ?? 0;

  return (
    <WindowedTimeline>
      <WindowedTimelineItem
        title={summary.toolErrors > 0 ? 'Tool errors detected' : 'Tool calls healthy'}
        meta={`${summary.toolCalls} calls · ${summary.toolErrors} errors`}
        tone={summary.toolErrors > 0 ? 'warning' : 'positive'}
      >
        {summary.toolErrors > 0
          ? 'Inspect the tool table before trusting automation runs in this range.'
          : 'No retained tool errors in the selected range.'}
      </WindowedTimelineItem>
      <WindowedTimelineItem
        title={pressureSession ? 'Highest context pressure' : 'Context pressure quiet'}
        meta={pressureSession ? `${Math.round(pressureSession.pct)}% · ${shortSessionId(pressureSession.sessionId)}` : 'No active pressure'}
        tone={pressureSession && pressureSession.pct > 80 ? 'warning' : 'neutral'}
      >
        {pressureSession
          ? 'The most pressured session is surfaced here so it is visible without opening the stable dashboard rail.'
          : 'Context rows appear after conversations retain usage snapshots.'}
      </WindowedTimelineItem>
      <WindowedTimelineItem
        title={sessionIntegrity.length > 0 ? 'Session integrity event' : 'Session integrity clean'}
        meta={sessionIntegrity.length > 0 ? `${sessionIntegrity.length} events` : 'No retained misses'}
        tone={sessionIntegrity.length > 0 ? 'warning' : 'positive'}
      >
        {sessionIntegrity.length > 0
          ? 'Prompt cache miss rows are available in the detailed diagnostics section below.'
          : 'No prompt cache integrity events in this range.'}
      </WindowedTimelineItem>
      <WindowedTimelineItem
        title="Run duration p95"
        meta={formatDuration(durationP95Ms)}
        tone={durationP95Ms > 10 * 60_000 ? 'warning' : 'neutral'}
      >
        Long-running traces stay visible here before opening deeper charts.
      </WindowedTimelineItem>
    </WindowedTimeline>
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
    <WindowedSegmentedControl
      ariaLabel="Diagnostics range"
      accent="diagnostics"
      value={value}
      options={TRACE_RANGE_OPTIONS.map((option) => ({ id: option.value, label: option.label }))}
      onChange={(nextValue) => onChange(nextValue as TraceRange)}
    />
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

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms >= 1000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms)}ms`;
}

function shortSessionId(sessionId: string): string {
  return sessionId.length > 8 ? sessionId.slice(0, 8) : sessionId;
}
