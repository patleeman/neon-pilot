// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { CollectionListResult, GlobalActivityItem, GlobalActivityResult, InboxListResult } from '../shared/types';
import { HomePage } from './HomePage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: vi.fn(() => ({ widgets: [] })),
}));

vi.mock('../extensions/WidgetHost', () => ({
  WidgetHost: ({ registration }: { registration: { id: string; extensionId: string; title: string } }) => (
    <div data-testid={`widget-${registration.extensionId}-${registration.id}`}>{registration.title}</div>
  ),
}));

interface UseApiResult {
  data: unknown;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: ReturnType<typeof vi.fn>;
  replaceData: ReturnType<typeof vi.fn>;
}

function buildUseApiResult(overrides: Partial<UseApiResult> = {}): UseApiResult {
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

function renderHomePage() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/documents" element={<div>Documents route</div>} />
        <Route path="/inbox" element={<div>Inbox route</div>} />
        <Route path="/activity" element={<div>Activity route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeActivityItem(overrides: Partial<GlobalActivityItem> & { id: string; title: string }): GlobalActivityItem {
  return {
    kind: 'execution',
    status: 'completed',
    createdAt: undefined,
    updatedAt: undefined,
    ...overrides,
  };
}

describe('HomePage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the Home heading', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: true }))
      .mockReturnValueOnce(buildUseApiResult({ loading: true }))
      .mockReturnValueOnce(buildUseApiResult({ loading: true }));

    renderHomePage();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
  });

  it('shows a loading state while every source is fetching for the first time', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: true, data: null }))
      .mockReturnValueOnce(buildUseApiResult({ loading: true, data: null }))
      .mockReturnValueOnce(buildUseApiResult({ loading: true, data: null }));

    renderHomePage();
    expect(screen.getByLabelText('Loading Home')).toBeTruthy();
  });

  it('renders metric tiles and section summaries once data resolves', () => {
    const collections: CollectionListResult = {
      collections: [
        {
          owner: 'system-inbox',
          collection: 'messages',
          description: '',
          defaultGrantRead: 'owner',
          defaultGrantWrite: 'owner',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-07-04T12:00:00.000Z',
        },
        {
          owner: 'demo',
          collection: 'tasks',
          description: '',
          defaultGrantRead: 'all',
          defaultGrantWrite: 'owner',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-07-03T12:00:00.000Z',
        },
      ],
    };
    const inbox: InboxListResult = {
      records: [
        {
          owner: 'system-inbox',
          collection: 'messages',
          id: 'msg-1',
          body: { from: 'Worker', fromKind: 'worker', subject: 'Build done', body: 'ok', kind: 'result', read: false },
          createdAt: '2026-07-04T10:00:00.000Z',
          updatedAt: '2026-07-04T11:00:00.000Z',
        },
      ],
      total: 1,
    };
    const activity: GlobalActivityResult = {
      items: [
        makeActivityItem({
          id: 'exec-1',
          title: 'Deploy',
          status: 'running',
          source: 'Background command',
          updatedAt: new Date().toISOString(),
        }),
      ],
      total: 1,
    };

    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: collections }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: inbox }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: activity }));

    renderHomePage();

    // Metric labels
    expect(screen.getByText('Document collections')).toBeTruthy();
    expect(screen.getByText('Unread inbox')).toBeTruthy();
    expect(screen.getByText('Active work')).toBeTruthy();

    // Sections
    expect(screen.getByRole('heading', { name: 'Documents collections' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();

    // Section content
    expect(screen.getByText('messages')).toBeTruthy();
    expect(screen.getByText('Build done')).toBeTruthy();
    expect(screen.getByText('Deploy')).toBeTruthy();

    // Unread meta appears
    expect(screen.getByText('1 unread')).toBeTruthy();
  });

  it('renders empty states for each section when sources resolve with no data', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 } }));

    renderHomePage();

    expect(screen.getByText('No collections yet')).toBeTruthy();
    expect(screen.getByText('No messages')).toBeTruthy();
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('renders per-section error states when a source fails after data was available elsewhere', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] }, error: 'Documents unavailable' }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 }, error: 'Inbox unavailable' }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 }, error: 'Activity unavailable' }));

    renderHomePage();

    expect(screen.getAllByText('Documents unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inbox unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Activity unavailable').length).toBeGreaterThan(0);
  });

  it('renders the global error state when every source fails on first load', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: null, error: 'Documents down' }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: null, error: 'Inbox down' }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: null, error: 'Activity down' }));

    renderHomePage();

    expect(screen.getAllByText('Documents down').length).toBeGreaterThan(0);
    expect(screen.queryByText('No collections yet')).toBeNull();
  });

  it('subscribes to documents, inbox, executions, and sessions invalidation topics', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 } }));

    renderHomePage();

    expect(vi.mocked(useInvalidateOnTopics)).toHaveBeenCalled();
    const topics = vi.mocked(useInvalidateOnTopics).mock.calls[0]?.[0] as readonly string[] | undefined;
    expect(topics).toEqual(['documents', 'inbox', 'executions', 'sessions']);
  });

  it('triggers every source refetch when the Refresh button is pressed', () => {
    const refetchCollections = vi.fn().mockResolvedValue(undefined);
    const refetchInbox = vi.fn().mockResolvedValue(undefined);
    const refetchActivity = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] }, refetch: refetchCollections }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 }, refetch: refetchInbox }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 }, refetch: refetchActivity }));

    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refetchCollections).toHaveBeenCalled();
    expect(refetchInbox).toHaveBeenCalled();
    expect(refetchActivity).toHaveBeenCalled();
  });

  it('renders Widgets section when widgets exist', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      widgets: [
        {
          extensionId: 'ext-a',
          id: 'widget-1',
          title: 'Widget One',
          component: 'WidgetOne',
          frontendEntry: '/ext/ext-a/index.js',
          order: 1,
        },
        {
          extensionId: 'ext-b',
          id: 'widget-2',
          title: 'Widget Two',
          component: 'WidgetTwo',
          frontendEntry: '/ext/ext-b/index.js',
          order: 0,
        },
      ],
    } as ReturnType<typeof useExtensionRegistry>);

    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 } }));

    renderHomePage();

    expect(screen.getByRole('heading', { name: 'Widgets' })).toBeTruthy();
    expect(screen.getByText('Widget One')).toBeTruthy();
    expect(screen.getByText('Widget Two')).toBeTruthy();
  });

  it('does not render Widgets section when no widgets exist', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      widgets: [],
    } as ReturnType<typeof useExtensionRegistry>);

    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 } }));

    renderHomePage();

    expect(screen.queryByRole('heading', { name: 'Widgets' })).toBeNull();
  });

  it('renders navigation links to Documents, Inbox, and Activity apps', () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { collections: [] } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { records: [], total: 0 } }))
      .mockReturnValueOnce(buildUseApiResult({ loading: false, data: { items: [], total: 0 } }));

    renderHomePage();

    expect(screen.getByRole('link', { name: 'Open Documents' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Inbox' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Activity' })).toBeTruthy();
  });
});
