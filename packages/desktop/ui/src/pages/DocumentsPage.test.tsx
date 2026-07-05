// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { useApi } from '../hooks/useApi';
import type { CollectionListResult, DocumentCollection, DocumentRecord, ListDocumentsResult } from '../shared/types';
import { DocumentsPage } from './DocumentsPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

const mockUseApi = vi.mocked(useApi);

function buildUseApiResult<T>(overrides: Partial<ReturnType<typeof useApi<T>>> = {}) {
  return {
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
    replaceData: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useApi>;
}

/**
 * Configure the mock useApi so that multiple calls always return the
 * supplied results in order, then repeat the last one indefinitely.
 */
function mockApiCalls(...results: Array<ReturnType<typeof useApi>>) {
  const lastResult = results[results.length - 1];
  const queue = [...results];
  mockUseApi.mockImplementation(() => queue.shift() ?? lastResult);
}

function renderDocumentsPage() {
  return render(
    <MemoryRouter initialEntries={['/documents']}>
      <Routes>
        <Route path="/documents" element={<DocumentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setupCollectionsOnly(collectionsResult: CollectionListResult) {
  // Two useApi calls: first for collections, second for records (empty initially)
  mockApiCalls(
    buildUseApiResult({ loading: false, error: null, data: collectionsResult }),
    buildUseApiResult({ loading: false, error: null, data: { records: [], total: 0 } }),
  );
}

function setupCollectionsAndRecords(collectionsResult: CollectionListResult, recordsResult: ListDocumentsResult) {
  // Two useApi calls on initial render
  mockApiCalls(
    buildUseApiResult({ loading: false, error: null, data: collectionsResult }),
    buildUseApiResult({ loading: false, error: null, data: recordsResult }),
  );
}

function makeCollection(overrides: Partial<DocumentCollection> & { collection: string }): DocumentCollection {
  return {
    owner: 'host',
    description: '',
    defaultGrantRead: 'owner',
    defaultGrantWrite: 'owner',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<DocumentRecord> & { id: string }): DocumentRecord {
  return {
    owner: 'host',
    collection: 'test-collection',
    body: { title: 'Test' },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DocumentsPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockUseApi.mockReset();
  });

  it('shows loading state for collections', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }), buildUseApiResult({ loading: true, data: null }));
    renderDocumentsPage();
    expect(screen.getByLabelText('Loading collections')).toBeTruthy();
  });

  it('shows error state when collections fetch fails', () => {
    mockApiCalls(
      buildUseApiResult({ loading: false, error: 'API unavailable', data: null }),
      buildUseApiResult({ loading: false, error: null, data: { records: [], total: 0 } }),
    );
    renderDocumentsPage();
    expect(screen.getByText('API unavailable')).toBeTruthy();
  });

  it('shows empty state when no collections exist', () => {
    setupCollectionsOnly({ collections: [] });
    renderDocumentsPage();
    expect(screen.getByText('No collections yet')).toBeTruthy();
  });

  it('renders the Documents heading', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }), buildUseApiResult({ loading: true, data: null }));
    renderDocumentsPage();
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeTruthy();
  });

  it('renders collection list and tab count', () => {
    const collections: DocumentCollection[] = [
      makeCollection({ collection: 'foo', owner: 'host' }),
      makeCollection({ collection: 'bar', owner: 'ext-1' }),
    ];
    setupCollectionsOnly({ collections });
    renderDocumentsPage();

    expect(screen.getByText('All collections 2')).toBeTruthy();
    expect(screen.getByText('host/foo')).toBeTruthy();
    expect(screen.getByText('ext-1/bar')).toBeTruthy();
  });

  it('shows records view when a collection tab is selected', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = {
      records: [
        makeRecord({ id: 'record-a', collection: 'test-collection' }),
        makeRecord({ id: 'record-b', collection: 'test-collection' }),
      ],
      total: 2,
    };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();

    // Click the collection tab
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    expect(screen.getByText('record-a')).toBeTruthy();
    expect(screen.getByText('record-b')).toBeTruthy();
  });

  it('fetches records using the selected collection owner and name', async () => {
    const listSpy = vi.spyOn(api.documents, 'list').mockResolvedValue({ records: [], total: 0 });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'bar', owner: 'ext-1' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'ext-1/bar' }));

    const recordsFetcher = mockUseApi.mock.calls.at(-1)?.[0] as (() => Promise<ListDocumentsResult>) | undefined;
    expect(recordsFetcher).toBeTruthy();
    await recordsFetcher?.();

    expect(listSpy).toHaveBeenCalledWith('ext-1', 'bar', { limit: 50, offset: 0 });
  });

  it('shows records empty state when selected collection has no records', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'empty-col', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/empty-col' }));

    expect(screen.getByText('No records yet')).toBeTruthy();
  });

  it('shows record detail in the right aside when a record is selected', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({
      id: 'doc-1',
      owner: 'host',
      collection: 'test-collection',
      body: { title: 'Hello', value: 42 },
    });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click the record row
    fireEvent.click(screen.getByText('doc-1'));

    expect(screen.getByText('Record Detail')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('"value"') && content.includes('42'))).toBeTruthy();
  });

  it('calls refetch when Refresh button is clicked', () => {
    const refetch = vi.fn();
    // Two useApi calls both return the same refetch
    mockApiCalls(
      buildUseApiResult({ loading: false, error: null, data: { collections: [] }, refetch }),
      buildUseApiResult({ loading: false, error: null, data: { records: [], total: 0 }, refetch }),
    );

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(refetch).toHaveBeenCalledWith({ resetLoading: false });
  });

  it('deselects record when clicked again', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-1' });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click the row in the table (first occurrence of doc-1)
    fireEvent.click(screen.getAllByText('doc-1')[0]);

    expect(screen.getByText('Record Detail')).toBeTruthy();

    // Click again to deselect
    fireEvent.click(screen.getAllByText('doc-1')[0]);

    expect(screen.queryByText('Record Detail')).toBeNull();
  });
});
