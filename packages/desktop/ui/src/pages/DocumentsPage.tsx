import { useCallback, useEffect, useState } from 'react';

import { api } from '../client/api';
import {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTablePagination,
  DataTableRow,
  DataTableToolbar,
  ErrorState,
  KeyValueTable,
  QuietLoadingState,
  TabButton,
  TabList,
  ToolbarButton,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { DocumentCollection, DocumentRecord, ListDocumentsResult } from '../shared/types';

const PAGE_SIZE = 50;

function formatTimestamp(iso: string): string {
  const d = new Date(Date.parse(iso));
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CollectionTabLabel(collection: DocumentCollection): string {
  return `${collection.owner}/${collection.collection}`;
}

function DocumentsEmptyState() {
  return (
    <DataTableEmptyRow colSpan={4}>
      <AppPageEmptyState
        title="No records yet"
        body="Document collections hold structured records by owner and collection name."
        steps={['Select a collection to browse its records', 'Use an extension or the API to insert documents']}
        align="start"
      />
    </DataTableEmptyRow>
  );
}

export function DocumentsPage() {
  const [selectedCollection, setSelectedCollection] = useState<DocumentCollection | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [page, setPage] = useState(1);
  const owner = selectedCollection?.owner ?? '';
  const collection = selectedCollection?.collection ?? '';

  const collectionsFetcher = useCallback(async () => {
    return api.documents.collections();
  }, []);

  const {
    data: collectionsData,
    loading: collectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
  } = useApi(collectionsFetcher, 'documents-collections');

  const recordsFetcher = useCallback(async (): Promise<ListDocumentsResult> => {
    if (!collection) return { records: [], total: 0 };
    return api.documents.list(owner, collection, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  }, [collection, owner, page]);

  const {
    data: recordsData,
    loading: recordsLoading,
    refreshing: recordsRefreshing,
    error: recordsError,
    refetch: refetchRecords,
  } = useApi(recordsFetcher, `documents-records-${owner}-${collection}-${page}`);

  const collections: DocumentCollection[] = collectionsData?.collections ?? [];
  const records: DocumentRecord[] = recordsData?.records ?? [];
  const total = recordsData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const availableTabs = collections.map((c: DocumentCollection) => ({
    key: `${c.owner}/${c.collection}`,
    label: CollectionTabLabel(c),
    collection: c,
  }));

  const handleSelectCollection = (nextCollection: DocumentCollection | null) => {
    setSelectedCollection(nextCollection);
    setSelectedDoc(null);
    setPage(1);
  };

  const handleSelectDocument = (doc: DocumentRecord) => {
    setSelectedDoc(doc.id === selectedDoc?.id ? null : doc);
  };

  const handleRefresh = () => {
    void refetchData();
  };

  const refetchData = useCallback(async () => {
    await refetchCollections({ resetLoading: false });
    if (collection) {
      await refetchRecords({ resetLoading: false });
    }
  }, [refetchCollections, refetchRecords, collection]);

  useInvalidateOnTopics(['documents'], refetchData);

  useEffect(() => {
    if (!selectedDoc || !recordsData) return;

    const nextSelectedDoc = recordsData.records.find(
      (record) => record.owner === selectedDoc.owner && record.collection === selectedDoc.collection && record.id === selectedDoc.id,
    );
    setSelectedDoc(nextSelectedDoc ?? null);
  }, [recordsData, selectedDoc]);

  const isRefreshing = collectionsLoading || recordsRefreshing;

  return (
    <AppPageLayout
      aside={
        selectedDoc ? (
          <div className="space-y-3">
            <div className="ui-app-page-intro">
              <h2 className="ui-app-page-title text-sm">Record Detail</h2>
            </div>
            <KeyValueTable
              columns={1}
              items={[
                { label: 'Owner', value: selectedDoc.owner },
                { label: 'Collection', value: selectedDoc.collection },
                { label: 'ID', value: selectedDoc.id, valueClassName: 'font-mono text-[11px]' },
                { label: 'Created', value: formatTimestamp(selectedDoc.createdAt) },
                { label: 'Updated', value: formatTimestamp(selectedDoc.updatedAt) },
              ]}
            />
            <div>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Body</h3>
              <pre className="max-h-80 overflow-auto rounded-sm border border-border-subtle bg-bg-subtle p-2 text-[11px] leading-relaxed">
                {JSON.stringify(selectedDoc.body, null, 2) || '{}'}
              </pre>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-col gap-4">
        <AppPageIntro
          title="Documents"
          actions={
            <ToolbarButton type="button" disabled={(collectionsLoading || recordsLoading) && !collectionsData} onClick={handleRefresh}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </ToolbarButton>
          }
        />

        <DataTableToolbar
          tabs={
            <TabList ariaLabel="Filter by collection">
              <TabButton active={selectedCollection === null} onClick={() => handleSelectCollection(null)}>
                All collections{collections.length > 0 ? ` ${collections.length}` : ''}
              </TabButton>
              {availableTabs.map((tab) => (
                <TabButton
                  key={tab.key}
                  active={selectedCollection?.owner === tab.collection.owner && selectedCollection.collection === tab.collection.collection}
                  onClick={() => handleSelectCollection(tab.collection)}
                >
                  {tab.label}
                </TabButton>
              ))}
            </TabList>
          }
          actions={
            selectedCollection && total > PAGE_SIZE ? (
              <DataTablePagination
                page={page}
                pageCount={pageCount}
                totalLabel={`${total} records`}
                onPrevious={page > 1 ? () => setPage((p) => Math.max(1, p - 1)) : undefined}
                onNext={page < pageCount ? () => setPage((p) => p + 1) : undefined}
              />
            ) : undefined
          }
          summary={
            recordsError && !recordsData ? (
              <span className="text-[11px] text-danger">Failed to load records</span>
            ) : collectionsError && !collectionsData ? (
              <span className="text-[11px] text-danger">Failed to load collections</span>
            ) : selectedCollection !== null && total > 0 ? (
              <span className="text-[11px] text-tertiary">{total === 1 ? '1 record' : `${total} records`}</span>
            ) : undefined
          }
        />

        {!selectedCollection ? (
          <CollectionsTable
            collections={collections}
            loading={collectionsLoading && !collectionsData}
            error={collectionsError}
            onSelect={handleSelectCollection}
          />
        ) : (
          <RecordsTable
            records={records}
            loading={recordsLoading && !recordsData}
            error={recordsError}
            selectedDoc={selectedDoc}
            onSelect={handleSelectDocument}
          />
        )}
      </div>
    </AppPageLayout>
  );
}

function CollectionsTable({
  collections,
  loading,
  error,
  onSelect,
}: {
  collections: DocumentCollection[];
  loading: boolean;
  error: string | null;
  onSelect: (collection: DocumentCollection) => void;
}) {
  return (
    <DataTable>
      <DataTableHead>
        <DataTableRow>
          <DataTableHeaderCell>Collection</DataTableHeaderCell>
          <DataTableHeaderCell>Owner</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '8rem' }}>Default Read</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '8rem' }}>Default Write</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '9rem' }}>Updated</DataTableHeaderCell>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {loading ? (
          <DataTableEmptyRow colSpan={5}>
            <QuietLoadingState label="Loading collections" />
          </DataTableEmptyRow>
        ) : error && !collections.length ? (
          <DataTableEmptyRow colSpan={5}>
            <ErrorState message={error} />
          </DataTableEmptyRow>
        ) : collections.length === 0 ? (
          <DataTableEmptyRow colSpan={5}>
            <AppPageEmptyState
              title="No collections yet"
              body="Document collections group related records. Create a collection via the API."
              steps={[
                'Extensions can create collections when they need persistent storage',
                'Grant access to other apps through the grants API',
              ]}
              align="start"
            />
          </DataTableEmptyRow>
        ) : (
          collections.map((col) => (
            <DataTableRow key={`${col.owner}/${col.collection}`} className="cursor-pointer" onClick={() => onSelect(col)}>
              <DataTableCell className="align-middle">
                <span className="text-[13px] font-medium">{col.collection}</span>
                {col.description ? (
                  <span className="ml-2 border-l border-border-subtle pl-2 text-[11px] text-tertiary">{col.description}</span>
                ) : null}
              </DataTableCell>
              <DataTableCell className="align-middle">
                <span className="inline-block rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-secondary">
                  {col.owner}
                </span>
              </DataTableCell>
              <DataTableCell className="align-middle text-[11px] text-tertiary">{col.defaultGrantRead}</DataTableCell>
              <DataTableCell className="align-middle text-[11px] text-tertiary">{col.defaultGrantWrite}</DataTableCell>
              <DataTableCell className="whitespace-nowrap align-middle text-[11px] text-tertiary">
                {formatTimestamp(col.updatedAt)}
              </DataTableCell>
            </DataTableRow>
          ))
        )}
      </DataTableBody>
    </DataTable>
  );
}

function RecordsTable({
  records,
  loading,
  error,
  selectedDoc,
  onSelect,
}: {
  records: DocumentRecord[];
  loading: boolean;
  error: string | null;
  selectedDoc: DocumentRecord | null;
  onSelect: (doc: DocumentRecord) => void;
}) {
  return (
    <DataTable>
      <DataTableHead>
        <DataTableRow>
          <DataTableHeaderCell style={{ width: '2rem' }} />
          <DataTableHeaderCell>ID</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '7rem' }}>Owner</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '9rem' }}>Updated</DataTableHeaderCell>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {loading ? (
          <DataTableEmptyRow colSpan={4}>
            <QuietLoadingState label="Loading records" />
          </DataTableEmptyRow>
        ) : error ? (
          <DataTableEmptyRow colSpan={4}>
            <ErrorState message={error} />
          </DataTableEmptyRow>
        ) : records.length === 0 ? (
          <DocumentsEmptyState />
        ) : (
          records.map((doc) => {
            const isSelected = selectedDoc?.id === doc.id && selectedDoc?.collection === doc.collection;
            return (
              <DataTableRow key={doc.id} className={isSelected ? 'bg-bg-active' : 'cursor-pointer'} onClick={() => onSelect(doc)}>
                <DataTableCell className="align-middle">
                  <div className={`h-2 w-2 rounded-full ${isSelected ? 'bg-accent' : 'bg-border-subtle'}`} aria-hidden="true" />
                </DataTableCell>
                <DataTableCell className="max-w-0 align-middle">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{doc.id}</div>
                    {doc.body && typeof doc.body === 'object' && 'title' in (doc.body as Record<string, unknown>) ? (
                      <div className="truncate text-[11px] text-tertiary">{String((doc.body as Record<string, unknown>).title)}</div>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="align-middle">
                  <span className="inline-block rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-secondary">
                    {doc.owner}
                  </span>
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap align-middle text-[11px] text-tertiary">
                  {formatTimestamp(doc.updatedAt)}
                </DataTableCell>
              </DataTableRow>
            );
          })
        )}
      </DataTableBody>
    </DataTable>
  );
}
