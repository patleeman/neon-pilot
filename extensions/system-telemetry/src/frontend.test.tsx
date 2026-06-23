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
  it('renders the loading state while diagnostics data is loading', () => {
    vi.mocked(useTracesData).mockReturnValue(telemetryState({ loading: true }));

    render(<TelemetryPage pa={{} as never} />);

    expect(screen.getByText('Loading trace data…')).toBeTruthy();
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
    expect(refetch).toHaveBeenCalled();
  });
});
