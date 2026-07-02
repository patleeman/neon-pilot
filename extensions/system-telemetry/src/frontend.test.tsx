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
        refetch,
      }),
    );

    const { container } = render(<TelemetryPage pa={{} as never} context={{ shellPresentation: 'windowed' } as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(screen.getByRole('button', { name: /7D/ }));

    expect(container.querySelector('.wos-page-shell')).toBeTruthy();
    expect(container.querySelector('.ui-app-page-shell')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeTruthy();
    expect(screen.getByText('Diagnostics context')).toBeTruthy();
    expect(screen.getByText('Tool errors')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
    expect(useTracesData).toHaveBeenLastCalledWith('7d', expect.anything());
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
