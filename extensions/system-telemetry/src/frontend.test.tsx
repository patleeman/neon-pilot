// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./traces/useTracesData', () => ({
  useTracesData: vi.fn(),
}));

import { TelemetryPage } from './frontend';
import { useTracesData } from './traces/useTracesData';

function telemetryState(overrides: Partial<ReturnType<typeof useTracesData>> = {}) {
  return {
    summary: null,
    modelUsage: null,
    throughput: null,
    toolHealth: null,
    contextSessions: null,
    compactions: null,
    compactionAggs: null,
    agentLoop: null,
    tokensDaily: null,
    toolFlow: null,
    autoMode: null,
    cacheEfficiency: null,
    systemPrompt: null,
    contextPointers: null,
    sessionIntegrity: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useTracesData>;
}

describe('TelemetryPage', () => {
  it('renders the native windowed diagnostics layout', () => {
    const refetch = vi.fn();
    vi.mocked(useTracesData).mockReturnValue(
      telemetryState({
        summary: {
          activeSessions: 2,
          runsToday: 3,
          toolCalls: 4,
          totalCost: 1.23,
          tokensTotal: 4567,
          tokensInput: 2000,
          tokensOutput: 1500,
          tokensCached: 900,
          tokensCachedWrite: 167,
          cacheHitRate: 0.2,
          toolErrors: 1,
        },
        agentLoop: {
          turnsPerRun: 2,
          stepsPerTurn: 3,
          toolCallsPerRun: 4,
          toolCallsP95: 8,
          toolErrorRatePct: 0,
          avgTokensPerRun: 1200,
          subagentsPerRun: 1,
          avgDurationMs: 65_000,
          runsOver20Turns: 1,
          stuckRuns: 0,
          stuckRunPct: 0,
          durationP50Ms: 30_000,
          durationP95Ms: 60_000,
          durationP99Ms: 90_000,
        },
        modelUsage: [
          { modelId: 'gpt-5.4', tokens: 3200, cost: 0.72, calls: 3 },
          { modelId: 'deepseek-v4-flash', tokens: 1367, cost: 0.12, calls: 1 },
        ],
        toolHealth: [
          { toolName: 'exec_command', calls: 3, errors: 0, successRate: 100, avgLatencyMs: 120, p95LatencyMs: 250, maxLatencyMs: 300 },
          { toolName: 'browser_snapshot', calls: 1, errors: 1, successRate: 0, avgLatencyMs: 900, p95LatencyMs: 900, maxLatencyMs: 900 },
          {
            toolName: 'bash',
            calls: 2,
            errors: 0,
            successRate: 100,
            avgLatencyMs: 220,
            p95LatencyMs: 480,
            maxLatencyMs: 520,
            bashBreakdown: [{ command: 'rg', calls: 2, errors: 0, errorRate: 0, p95LatencyMs: 480 }],
            bashComplexity: {
              avgScore: 1.5,
              maxScore: 3,
              maxCommandCount: 2,
              pipelineCalls: 1,
              chainCalls: 0,
              redirectCalls: 0,
              multilineCalls: 0,
              shellCalls: 1,
              substitutionCalls: 0,
              shapeBreakdown: [{ shape: 'single', calls: 2 }],
            },
          },
        ],
        toolFlow: {
          transitions: [{ fromTool: 'exec_command', toTool: 'browser_snapshot', count: 2 }],
          coOccurrences: [{ toolA: 'exec_command', toolB: 'apply_patch', sessions: 1 }],
          failureTrajectories: [
            {
              toolName: 'browser_snapshot',
              errorMessage: 'native view unavailable',
              previousCalls: ['exec_command', 'browser_snapshot'],
              ts: '2026-07-03T11:22:33.000Z',
              sessionId: 'session-a',
            },
          ],
        },
        autoMode: {
          currentActive: 1,
          enabledCount: 2,
          disabledCount: 1,
          topStopReasons: [{ reason: 'budget', count: 1 }],
          recentEvents: [
            { ts: '2026-07-03T12:00:00.000Z', sessionId: 'session-a', enabled: true, stopReason: null },
            { ts: '2026-07-03T12:10:00.000Z', sessionId: 'session-a', enabled: false, stopReason: 'budget' },
          ],
        },
        contextSessions: [
          {
            sessionId: 'session-a',
            totalTokens: 81000,
            contextWindow: 100000,
            pct: 81,
            segSystem: 10,
            segUser: 20,
            segAssistant: 30,
            segTool: 15,
            segSummary: 6,
            systemPromptTokens: 1000,
          },
        ],
        tokensDaily: [
          {
            date: '2026-07-03',
            turns: 8,
            messages: 14,
            tokensInput: 12_000,
            tokensOutput: 4_000,
            tokensCached: 18_000,
            tokensCachedWrite: 1_000,
            toolErrors: 0,
            cost: 3.45,
          },
          {
            date: '2026-07-04',
            turns: 5,
            messages: 9,
            tokensInput: 8_000,
            tokensOutput: 3_000,
            tokensCached: 10_000,
            tokensCachedWrite: 600,
            toolErrors: 1,
            cost: 2.1,
          },
        ],
        sessionIntegrity: [
          {
            id: 'integrity-1',
            ts: '2026-07-03T11:22:33.000Z',
            source: 'desktop',
            category: 'conversation',
            name: 'session_integrity_miss',
            sessionId: 'session-a',
            runId: null,
            route: null,
            status: null,
            durationMs: null,
            count: null,
            value: null,
            metadataJson: JSON.stringify({ oldSize: 10, newSize: 16, cacheLoader: 'append-only' }),
          },
        ],
        refetch,
      }),
    );

    const { container } = render(<TelemetryPage pa={{} as never} context={{ shellPresentation: 'windowed' } as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(screen.getByRole('radio', { name: '7D' }));

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(container.querySelector('.wos-page-rail')).toBeNull();
    expect(container.querySelector('.wos-page-inspector')).toBeNull();
    expect(container.querySelector('.ui-app-page-shell')).toBeNull();
    expect(container.querySelector('.wos-page-eyebrow')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeTruthy();
    expect(screen.queryByText('Diagnostics context')).toBeNull();
    expect(screen.queryByText('Telemetry range')).toBeNull();
    expect(container.querySelector('.wos-segmented-control[data-accent="diagnostics"]')).toBeTruthy();
    expect(screen.queryByText('Selected')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Data' })).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Models' })).toBeTruthy();
    expect(screen.getAllByText('gpt-5.4').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Tool calls' })).toBeTruthy();
    expect(screen.getAllByText('exec_command').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-07-03').closest('.wos-data-row')).toBeTruthy();
    expect(screen.getByText('$3.45').closest('.wos-data-row')).toBeTruthy();
    expect(screen.getByText('append-only').closest('.wos-data-row')).toBeTruthy();
    expect(container.querySelector('.wos-heatmap')).toBeTruthy();
    expect(container.querySelector('.wos-heatmap-cell-4')).toBeTruthy();
    expect(container.querySelector('.ui-heatmap-cell-4')).toBeNull();
    expect(container.querySelector('.wos-braid-chart')).toBeTruthy();
    expect(container.querySelector('.wos-braid-line--errors')).toBeTruthy();
    expect(container.querySelector('.wos-tool-health')).toBeTruthy();
    expect(container.querySelector('.wos-tool-health__bash')).toBeTruthy();
    expect(screen.getByText('rg').closest('.wos-data-row')).toBeTruthy();
    expect(container.querySelector('.wos-tool-flow')).toBeTruthy();
    expect(container.querySelector('.wos-tool-flow__failures')).toBeTruthy();
    expect(screen.getByText('native view unavailable').closest('.wos-data-row')).toBeTruthy();
    expect(container.querySelector('.wos-auto-mode')).toBeTruthy();
    expect(container.querySelector('.wos-auto-mode__events')).toBeTruthy();
    expect(screen.getAllByText('budget').some((element) => element.closest('.wos-data-row'))).toBe(true);
    const tableTemplates = Array.from(container.querySelectorAll<HTMLElement>('.wos-data-table')).map((table) =>
      table.style.getPropertyValue('--wos-data-column-template'),
    );
    expect(tableTemplates).toContain('minmax(14rem, 1fr) minmax(7rem, 0.42fr) minmax(5rem, 0.32fr)');
    expect(tableTemplates).toContain('minmax(14rem, 1fr) minmax(6rem, 0.36fr) minmax(5rem, 0.32fr)');
    expect(tableTemplates).toContain('minmax(7rem, 0.9fr) repeat(8, minmax(4.6rem, 0.46fr)) minmax(5rem, 0.5fr)');
    expect(tableTemplates).toContain(
      'minmax(5.8rem, 0.46fr) minmax(10rem, 1fr) minmax(4.5rem, 0.36fr) minmax(4.5rem, 0.36fr) minmax(6rem, 0.5fr)',
    );
    expect(tableTemplates).toContain('minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(4rem, 0.32fr)');
    expect(tableTemplates).toContain('minmax(5rem, 0.4fr) minmax(7rem, 0.5fr) minmax(9rem, 1fr)');
    expect(container.querySelector('.ui-data-table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeTruthy();
    expect(screen.getByText('Highest context pressure')).toBeTruthy();
    expect(screen.getAllByText('Tool errors').length).toBeGreaterThan(0);
    expect(container.querySelector('.wos-agent-loop')).toBeTruthy();
    expect(container.querySelector('.wos-agent-loop__durations')).toBeTruthy();
    expect(screen.getByText('Long runs').closest('.wos-data-row')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
    expect(useTracesData).toHaveBeenLastCalledWith('7d', expect.anything());
  });

  it('uses the shared windowed empty state when diagnostics are quiet', () => {
    vi.mocked(useTracesData).mockReturnValue(telemetryState());

    const { container } = render(<TelemetryPage pa={{} as never} context={{ shellPresentation: 'windowed' } as never} />);

    expect(screen.getByText('No diagnostics yet.').closest('.wos-empty-state')).toBeTruthy();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
  });

  it('uses the shared windowed state block for diagnostics load failures', () => {
    const refetch = vi.fn();
    vi.mocked(useTracesData).mockReturnValue(telemetryState({ error: 'trace load failed', refetch }));

    const { container } = render(<TelemetryPage pa={{} as never} context={{ shellPresentation: 'windowed' } as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('trace load failed').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
    expect(container.querySelector('.ui-error-state')).toBeNull();
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.wos-page-eyebrow')).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it('uses the shared windowed state block while diagnostics data is loading', () => {
    vi.mocked(useTracesData).mockReturnValue(telemetryState({ loading: true }));

    const { container } = render(<TelemetryPage pa={{} as never} context={{ shellPresentation: 'windowed' } as never} />);

    expect(screen.getByText('Loading diagnostics.').closest('.wos-state-block')).toBeTruthy();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
    expect(container.querySelector('.wos-empty-state')).toBeNull();
  });

  it('renders the loading state while diagnostics data is loading', () => {
    vi.mocked(useTracesData).mockReturnValue(telemetryState({ loading: true }));

    render(<TelemetryPage pa={{} as never} />);

    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading diagnostics' })).toBeTruthy();
    expect(screen.queryByText('Loading diagnostics...')).toBeNull();
  });

  it('renders errors with a retry action', () => {
    const refetch = vi.fn();
    vi.mocked(useTracesData).mockReturnValue(telemetryState({ error: 'trace load failed', refetch }));

    render(<TelemetryPage pa={{} as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('trace load failed')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the diagnostics dashboard shell and refresh control', () => {
    const refetch = vi.fn();
    vi.mocked(useTracesData).mockReturnValue(
      telemetryState({
        summary: {
          activeSessions: 2,
          runsToday: 3,
          toolCalls: 4,
          totalCost: 1.23,
          tokensTotal: 4567,
          tokensInput: 2000,
          tokensOutput: 1500,
          tokensCached: 900,
          tokensCachedWrite: 167,
          cacheHitRate: 0.2,
          toolErrors: 1,
        },
        agentLoop: {
          turnsPerRun: 2,
          stepsPerTurn: 3,
          toolCallsPerRun: 4,
          toolCallsP95: 8,
          toolErrorRatePct: 0,
          avgTokensPerRun: 1200,
          subagentsPerRun: 1,
          avgDurationMs: 65_000,
          runsOver20Turns: 1,
          stuckRuns: 0,
          stuckRunPct: 0,
          durationP50Ms: 30_000,
          durationP95Ms: 60_000,
          durationP99Ms: 90_000,
        },
        refetch,
      }),
    );

    render(<TelemetryPage pa={{} as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));

    expect(screen.getByText('Diagnostics')).toBeTruthy();
    expect(screen.getByText('Usage')).toBeTruthy();
    expect(screen.getByText('Tools')).toBeTruthy();
    expect(screen.getByText('App activity')).toBeTruthy();
    expect(screen.getByText('Runs Today')).toBeTruthy();
    expect(screen.getByText('Runs > 20 Turns')).toBeTruthy();
    expect(screen.getByText('Stuck >10 Min')).toBeTruthy();
    expect(screen.queryByText(/&gt;/)).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });
});
