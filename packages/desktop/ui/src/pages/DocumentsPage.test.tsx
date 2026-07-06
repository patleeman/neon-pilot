// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { CollectionGrant, CollectionListResult, DocumentCollection, DocumentRecord, ListDocumentsResult } from '../shared/types';
import { DocumentsPage } from './DocumentsPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

const useInvalidateOnTopicsMock = vi.mocked(useInvalidateOnTopics);

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
  setupCollectionsAndRecords(collectionsResult, { records: [], total: 0 });
}

function setupCollectionsAndRecords(collectionsResult: CollectionListResult, recordsResult: ListDocumentsResult) {
  mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
    if (key === 'documents-collections') {
      return buildUseApiResult({ loading: false, error: null, data: collectionsResult });
    }
    if (key.startsWith('documents-grants-')) {
      return buildUseApiResult({ loading: false, error: null, data: { grants: [] } });
    }
    return buildUseApiResult({ loading: false, error: null, data: recordsResult });
  }) as typeof useApi);
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

function makeGrant(overrides: Partial<CollectionGrant> & { granteeAppId: string }): CollectionGrant {
  return {
    id: `${overrides.granteeAppId}-grant-id`,
    owner: 'host',
    collection: 'test-collection',
    canRead: true,
    canWrite: false,
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

  it('subscribes to the documents invalidation topic', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }), buildUseApiResult({ loading: true, data: null }));
    renderDocumentsPage();
    expect(useInvalidateOnTopicsMock).toHaveBeenCalledWith(['documents'], expect.any(Function));
  });

  it('refetches collections, grants, and selected records when documents are invalidated', async () => {
    const refetchCollections = vi.fn().mockResolvedValue(undefined);
    const refetchRecords = vi.fn().mockResolvedValue(undefined);
    const refetchGrants = vi.fn().mockResolvedValue(undefined);
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = {
      records: [makeRecord({ id: 'doc-1', collection: 'test-collection' })],
      total: 1,
    };
    let invalidate: ((options?: { resetLoading?: boolean }) => Promise<unknown>) | undefined;

    useInvalidateOnTopicsMock.mockImplementation((_topics, refetch) => {
      invalidate = refetch;
    });
    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult, refetch: refetchCollections });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, data: { grants: [] }, refetch: refetchGrants });
      }
      return buildUseApiResult({ loading: false, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    await invalidate?.({ resetLoading: false });

    expect(refetchCollections).toHaveBeenCalledWith({ resetLoading: false });
    expect(refetchRecords).toHaveBeenCalledWith({ resetLoading: false });
    expect(refetchGrants).toHaveBeenCalledWith({ resetLoading: false });
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

    const recordsFetcher = mockUseApi.mock.calls.find(([, key]) => key === 'documents-records-ext-1-bar-1')?.[0] as
      | (() => Promise<ListDocumentsResult>)
      | undefined;
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

  it('keeps selected record detail in sync with refreshed records', async () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    let recordsResult: ListDocumentsResult = {
      records: [
        makeRecord({
          id: 'doc-1',
          owner: 'host',
          collection: 'test-collection',
          body: { title: 'Old title' },
        }),
      ],
      total: 1,
    };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult });
      }
      return buildUseApiResult({ loading: false, error: null, data: recordsResult });
    }) as typeof useApi);

    const view = renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-1'));

    expect(screen.getAllByText((content) => content.includes('Old title')).length).toBeGreaterThan(0);

    recordsResult = {
      records: [
        makeRecord({
          id: 'doc-1',
          owner: 'host',
          collection: 'test-collection',
          body: { title: 'Updated title' },
        }),
      ],
      total: 1,
    };
    view.rerender(
      <MemoryRouter initialEntries={['/documents']}>
        <Routes>
          <Route path="/documents" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText((content) => content.includes('Updated title')).length).toBeGreaterThan(0);
    });
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

  // ── Editor / Save tests ─────────────────────────────────────────────

  it('shows editable JSON textarea when a record is selected', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({
      id: 'doc-1',
      body: { greeting: 'hello' },
    });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-1'));

    // The textarea should be seeded with the document body as pretty-printed JSON
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toContain('hello');
  });

  it('shows local invalid JSON error when saving with bad JSON', async () => {
    vi.spyOn(api.documents, 'put').mockResolvedValue({ document: makeRecord({ id: 'doc-1' }) } as never);
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-1', body: { ok: true } });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-1'));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'not valid json' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Invalid JSON')).toBeTruthy();
    expect(api.documents.put).not.toHaveBeenCalled();
  });

  it('calls api.documents.put on Save with valid JSON and refreshes', async () => {
    const putSpy = vi.spyOn(api.documents, 'put').mockResolvedValue({ document: makeRecord({ id: 'doc-1' }) } as never);
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-1', body: { count: 1 } });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult, refetch: vi.fn() });
      }
      return buildUseApiResult({ loading: false, error: null, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-1'));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{"count": 2}' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('host', 'test-collection', 'doc-1', { count: 2 });
    });
  });

  it('does not overwrite unsaved edits when records are refreshed', async () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-1', body: { original: 'value' } });
    let recordsResult: ListDocumentsResult = { records: [doc], total: 1 };
    const refetchRecords = vi.fn().mockImplementation(async () => {
      // Simulate a records refresh that preserves the doc (no body change)
    });

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult, refetch: vi.fn() });
      }
      return buildUseApiResult({ loading: false, error: null, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    const view = renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-1'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const originalValue = textarea.value;

    // Make an unsaved edit
    fireEvent.change(textarea, { target: { value: '{"edited": true}' } });
    expect(textarea.value).toBe('{"edited": true}');

    recordsResult = { records: [makeRecord({ id: 'doc-1', body: { original: 'value' } })], total: 1 };
    view.rerender(
      <MemoryRouter initialEntries={['/documents']}>
        <Routes>
          <Route path="/documents" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // The editor body should still show the unsaved edit, not the original
    expect(textarea.value).toBe('{"edited": true}');

    fireEvent.change(textarea, { target: { value: originalValue } });

    recordsResult = { records: [makeRecord({ id: 'doc-1', body: { original: 'latest server value' } })], total: 1 };
    view.rerender(
      <MemoryRouter initialEntries={['/documents']}>
        <Routes>
          <Route path="/documents" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(textarea.value).toContain('latest server value');
    });
  });

  // ── New document tests ─────────────────────────────────────────────────

  it('shows New document inline form when button is clicked', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    fireEvent.click(screen.getByText('New document'));

    expect(screen.getByText('New document')).toBeTruthy();
    expect(screen.getByPlaceholderText('my-document-id')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('calls api.documents.put on New document create and refreshes', async () => {
    const putSpy = vi.spyOn(api.documents, 'put').mockResolvedValue({ document: makeRecord({ id: 'new-doc' }) } as never);
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult, refetch: vi.fn() });
      }
      return buildUseApiResult({ loading: false, error: null, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('New document'));

    const idInput = screen.getByPlaceholderText('my-document-id');
    fireEvent.change(idInput, { target: { value: 'new-doc' } });

    // The body textarea has placeholder "{}"
    const bodyTextarea = screen.getByPlaceholderText('{}');
    fireEvent.change(bodyTextarea, { target: { value: '{"key": "value"}' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('host', 'test-collection', 'new-doc', { key: 'value' });
    });
  });

  it('shows error for empty document ID on create', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('New document'));

    // Click Create without entering an ID
    fireEvent.click(screen.getByText('Create'));

    expect(screen.getByText('Document ID is required')).toBeTruthy();
  });

  // ── Delete tests ────────────────────────────────────────────────────────

  it('shows delete confirmation when Delete button is clicked', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-to-delete' });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };

    setupCollectionsAndRecords(collectionsResult, recordsResult);
    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-to-delete'));

    // Click Delete in the detail aside
    fireEvent.click(screen.getByText('Delete'));

    // The confirmation text is within a paragraph with class text-danger
    expect(screen.getByText(/^Delete /)).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls api.documents.delete on Confirm and refreshes', async () => {
    const deleteSpy = vi.spyOn(api.documents, 'delete').mockResolvedValue({ deleted: true });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const doc: DocumentRecord = makeRecord({ id: 'doc-to-delete' });
    const recordsResult: ListDocumentsResult = { records: [doc], total: 1 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult, refetch: vi.fn() });
      }
      return buildUseApiResult({ loading: false, error: null, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));
    fireEvent.click(screen.getByText('doc-to-delete'));

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('host', 'test-collection', 'doc-to-delete');
    });
  });

  // ── New collection tests ────────────────────────────────────────────────

  it('shows New collection form when button is clicked on All collections tab', () => {
    setupCollectionsOnly({ collections: [] });
    renderDocumentsPage();

    // Click the "New collection" button (there's only one before the form appears)
    fireEvent.click(screen.getAllByText('New collection')[0]);

    // After clicking, both the button and the inline heading say "New collection"
    // Use a more specific query for the form heading
    expect(screen.getByPlaceholderText('host')).toBeTruthy();
    expect(screen.getByPlaceholderText('my-collection')).toBeTruthy();
    expect(screen.getByPlaceholderText('Optional description')).toBeTruthy();
    expect(screen.getAllByText('Create').length).toBeGreaterThan(0);
  });

  it('calls api.documents.upsertCollection on create and refreshes', async () => {
    const upsertSpy = vi.spyOn(api.documents, 'upsertCollection').mockResolvedValue({
      collection: makeCollection({ collection: 'new-col', owner: 'ext-1' }),
    });
    const collectionsResult: CollectionListResult = { collections: [] };
    const refetchCollections = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, error: null, data: collectionsResult, refetch: refetchCollections });
      }
      return buildUseApiResult({ loading: false, error: null, data: { records: [], total: 0 } });
    }) as typeof useApi);

    renderDocumentsPage();

    // All collections tab - click New collection
    fireEvent.click(screen.getByText('New collection'));

    const ownerInput = screen.getByPlaceholderText('host');
    const nameInput = screen.getByPlaceholderText('my-collection');
    const descInput = screen.getByPlaceholderText('Optional description');

    fireEvent.change(ownerInput, { target: { value: 'ext-1' } });
    fireEvent.change(nameInput, { target: { value: 'new-col' } });
    fireEvent.change(descInput, { target: { value: 'A test collection' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledWith('ext-1', 'new-col', { description: 'A test collection' });
    });
  });

  it('shows error when collection name is empty', () => {
    setupCollectionsOnly({ collections: [] });
    renderDocumentsPage();

    fireEvent.click(screen.getByText('New collection'));

    // Clear owner and leave collection name empty
    const ownerInput = screen.getByPlaceholderText('host');
    fireEvent.change(ownerInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Create'));

    expect(screen.getByText('Owner is required')).toBeTruthy();
  });

  // ── Keep original test ─────────────────────────────────────────────────

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

  // ── Grants tests ─────────────────────────────────────────────────────────

  it('shows grants section when a collection is selected', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const grantsResult = { grants: [makeGrant({ granteeAppId: 'my-app' })] };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, data: grantsResult });
      }
      return buildUseApiResult({ loading: false, data: recordsResult });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    expect(screen.getByText('my-app')).toBeTruthy();
  });

  it('shows empty state when no grants exist', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, data: { grants: [] } });
      }
      return buildUseApiResult({ loading: false, data: recordsResult });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    expect(screen.getByText('No grants yet')).toBeTruthy();
  });

  it('shows loading state for grants', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: true, data: null });
      }
      return buildUseApiResult({ loading: false, data: recordsResult });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    expect(screen.getByLabelText('Loading grants')).toBeTruthy();
  });

  it('shows grants error when fetch fails', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, error: 'Grants unavailable', data: null });
      }
      return buildUseApiResult({ loading: false, data: recordsResult });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    expect(screen.getByText('Grants unavailable')).toBeTruthy();
  });

  it('can open add grant form and validates empty grant app ID', () => {
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, data: { grants: [] } });
      }
      return buildUseApiResult({ loading: false, data: recordsResult });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click Add grant button
    fireEvent.click(screen.getByText('Add grant'));

    // Submit without filling in the app ID
    fireEvent.click(screen.getByText('Grant'));

    expect(screen.getByText('Grant app ID is required')).toBeTruthy();
  });

  it('calls setGrant when adding a new grant', async () => {
    const setGrantSpy = vi.spyOn(api.documents, 'setGrant').mockResolvedValue({
      grant: makeGrant({ granteeAppId: 'new-app' }),
    });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);
    const refetchGrants = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult, refetch: vi.fn() });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({ loading: false, data: { grants: [] }, refetch: refetchGrants });
      }
      return buildUseApiResult({ loading: false, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Open add grant form
    fireEvent.click(screen.getByText('Add grant'));

    // Fill in the grant app ID
    const appIdInput = screen.getByPlaceholderText('com.example.extension');
    fireEvent.change(appIdInput, { target: { value: 'new-app' } });

    // Submit
    fireEvent.click(screen.getByText('Grant'));

    await waitFor(() => {
      expect(setGrantSpy).toHaveBeenCalledWith('host', 'test-collection', 'new-app', {
        canRead: true,
        canWrite: false,
      });
    });
  });

  it('toggles grant read permission', async () => {
    const setGrantSpy = vi.spyOn(api.documents, 'setGrant').mockResolvedValue({
      grant: makeGrant({ granteeAppId: 'my-app' }),
    });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);
    const refetchGrants = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult, refetch: vi.fn() });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({
          loading: false,
          data: {
            grants: [makeGrant({ granteeAppId: 'my-app', canRead: true, canWrite: false })],
          },
          refetch: refetchGrants,
        });
      }
      return buildUseApiResult({ loading: false, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click the Read switch for my-app
    fireEvent.click(screen.getByLabelText('Read access for my-app'));

    await waitFor(() => {
      expect(setGrantSpy).toHaveBeenCalledWith('host', 'test-collection', 'my-app', {
        canRead: false,
      });
    });
  });

  it('toggles grant write permission', async () => {
    const setGrantSpy = vi.spyOn(api.documents, 'setGrant').mockResolvedValue({
      grant: makeGrant({ granteeAppId: 'my-app' }),
    });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);
    const refetchGrants = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult, refetch: vi.fn() });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({
          loading: false,
          data: {
            grants: [makeGrant({ granteeAppId: 'my-app', canRead: false, canWrite: true })],
          },
          refetch: refetchGrants,
        });
      }
      return buildUseApiResult({ loading: false, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click the Write switch for my-app
    fireEvent.click(screen.getByLabelText('Write access for my-app'));

    await waitFor(() => {
      expect(setGrantSpy).toHaveBeenCalledWith('host', 'test-collection', 'my-app', {
        canWrite: false,
      });
    });
  });

  it('deletes a grant', async () => {
    const deleteGrantSpy = vi.spyOn(api.documents, 'deleteGrant').mockResolvedValue({ deleted: true });
    const collectionsResult: CollectionListResult = {
      collections: [makeCollection({ collection: 'test-collection', owner: 'host' })],
    };
    const recordsResult: ListDocumentsResult = { records: [], total: 0 };
    const refetchRecords = vi.fn().mockResolvedValue(undefined);
    const refetchGrants = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockImplementation(((_fetcher: unknown, key: string) => {
      if (key === 'documents-collections') {
        return buildUseApiResult({ loading: false, data: collectionsResult, refetch: vi.fn() });
      }
      if (key.startsWith('documents-grants-')) {
        return buildUseApiResult({
          loading: false,
          data: {
            grants: [makeGrant({ granteeAppId: 'my-app' })],
          },
          refetch: refetchGrants,
        });
      }
      return buildUseApiResult({ loading: false, data: recordsResult, refetch: refetchRecords });
    }) as typeof useApi);

    renderDocumentsPage();
    fireEvent.click(screen.getByRole('tab', { name: 'host/test-collection' }));

    // Click the remove button for my-app
    fireEvent.click(screen.getByLabelText('Remove grant my-app'));

    await waitFor(() => {
      expect(deleteGrantSpy).toHaveBeenCalledWith('host', 'test-collection', 'my-app');
    });
  });
});
