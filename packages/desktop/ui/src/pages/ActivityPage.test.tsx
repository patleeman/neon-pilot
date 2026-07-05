// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useApi } from '../hooks/useApi';
import type { GlobalActivityItem, GlobalActivityResult } from '../shared/types';
import { ActivityPage } from './ActivityPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

function buildUseApiResult<T>(
  overrides: Partial<{
    data: T | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
  }> = {},
) {
  return {
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
    replaceData: vi.fn(),
    ...overrides,
  };
}

function renderActivityPage() {
  return render(
    <MemoryRouter initialEntries={['/activity']}>
      <Routes>
        <Route path="/activity" element={<ActivityPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeItem(overrides: Partial<GlobalActivityItem> & { id: string; title: string }): GlobalActivityItem {
  return {
    kind: 'conversation',
    status: 'completed',
    createdAt: undefined,
    updatedAt: undefined,
    ...overrides,
  };
}

describe('ActivityPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows loading state while data is being fetched', () => {
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: true }));
    renderActivityPage();
    expect(screen.getByLabelText('Loading activity')).toBeTruthy();
  });

  it('shows error state when fetch fails', () => {
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: 'Network error', data: null }));
    renderActivityPage();
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows empty state when there are no items', () => {
    const result: GlobalActivityResult = { items: [], total: 0 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('renders activity items in the table', () => {
    const items: GlobalActivityItem[] = [
      makeItem({
        id: 'conversation:a',
        title: 'Chat session',
        kind: 'conversation',
        status: 'running',
        updatedAt: new Date().toISOString(),
      }),
      makeItem({
        id: 'execution:b',
        title: 'Build deploy',
        kind: 'execution',
        status: 'completed',
        subtitle: 'npm run build',
        updatedAt: new Date().toISOString(),
      }),
    ];
    const result: GlobalActivityResult = { items, total: 2 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    expect(screen.getByText('Chat session')).toBeTruthy();
    expect(screen.getByText('Build deploy')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('npm run build'))).toBeTruthy();
  });

  it('renders the Activity heading', () => {
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: true }));
    renderActivityPage();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
  });

  it('shows kind counts in filter tabs', () => {
    const items: GlobalActivityItem[] = [
      makeItem({ id: 'conversation:a', title: 'Chat A', kind: 'conversation', status: 'completed' }),
      makeItem({ id: 'conversation:b', title: 'Chat B', kind: 'conversation', status: 'completed' }),
      makeItem({ id: 'execution:c', title: 'Run C', kind: 'execution', status: 'running', active: true }),
    ];
    const result: GlobalActivityResult = { items, total: 3 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    // All tab should show total
    expect(screen.getByText('All 3')).toBeTruthy();
    // Active tab should show the running worker count
    expect(screen.getByText('Active 1')).toBeTruthy();
    // Conversations tab should show count
    expect(screen.getByText('Conversations 2')).toBeTruthy();
    // Workers tab (formerly Executions) should show count
    expect(screen.getByText('Workers 1')).toBeTruthy();
  });

  it('filters items when a kind tab is selected', () => {
    const items: GlobalActivityItem[] = [
      makeItem({ id: 'conversation:a', title: 'Chat only', kind: 'conversation', status: 'completed' }),
      makeItem({ id: 'execution:b', title: 'Run only', kind: 'execution', status: 'completed' }),
    ];
    const result: GlobalActivityResult = { items, total: 2 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    expect(screen.getByText('Chat only')).toBeTruthy();
    expect(screen.getByText('Run only')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Workers 1' }));

    expect(screen.queryByText('Chat only')).toBeNull();
    expect(screen.getByText('Run only')).toBeTruthy();
  });

  it('handles items with all status variants', () => {
    const statuses: GlobalActivityItem['status'][] = ['queued', 'running', 'completed', 'failed', 'cancelled', 'unknown'];
    const items: GlobalActivityItem[] = statuses.map((status, i) =>
      makeItem({ id: `item-${i}`, title: `Status ${status}`, kind: 'execution', status }),
    );
    const result: GlobalActivityResult = { items, total: items.length };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    for (const status of statuses) {
      expect(screen.getByText(`Status ${status}`)).toBeTruthy();
    }
  });

  it('filters to active workers when the Active tab is selected', () => {
    const items: GlobalActivityItem[] = [
      makeItem({ id: 'conversation:a', title: 'Live chat', kind: 'conversation', status: 'running', active: true }),
      makeItem({ id: 'execution:b', title: 'Done worker', kind: 'execution', status: 'completed' }),
      makeItem({ id: 'execution:c', title: 'Running worker', kind: 'execution', status: 'running', active: true }),
    ];
    const result: GlobalActivityResult = { items, total: 3 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Active 2' }));

    expect(screen.getByText('Live chat')).toBeTruthy();
    expect(screen.getByText('Running worker')).toBeTruthy();
    expect(screen.queryByText('Done worker')).toBeNull();
  });

  it('renders the backend source label for worker rows', () => {
    const items: GlobalActivityItem[] = [
      makeItem({ id: 'execution:a', title: 'Shell job', kind: 'execution', status: 'completed', source: 'Background command' }),
      makeItem({ id: 'execution:b', title: 'Helper agent', kind: 'execution', status: 'running', source: 'Subagent' }),
      makeItem({ id: 'conversation:c', title: 'My chat', kind: 'conversation', status: 'completed', source: 'Conversation' }),
    ];
    const result: GlobalActivityResult = { items, total: 3 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    expect(screen.getByText('Background command')).toBeTruthy();
    expect(screen.getByText('Subagent')).toBeTruthy();
    expect(screen.getByText('Conversation')).toBeTruthy();
  });

  it('shows conversation context for execution items', () => {
    const items: GlobalActivityItem[] = [
      makeItem({
        id: 'execution:a',
        title: 'Subagent task',
        kind: 'execution',
        status: 'completed',
        conversationId: 'conv-1',
        conversationTitle: 'Main session',
      }),
    ];
    const result: GlobalActivityResult = { items, total: 1 };
    vi.mocked(useApi).mockReturnValue(buildUseApiResult({ loading: false, error: null, data: result }));
    renderActivityPage();

    expect(screen.getByText((content) => content.includes('Main session'))).toBeTruthy();
  });
});
