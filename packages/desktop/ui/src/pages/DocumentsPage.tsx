import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../client/api';
import {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  Button,
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
  FieldError,
  InlineTextInput,
  KeyValueTable,
  QuietLoadingState,
  TabButton,
  TabList,
  Textarea,
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

function bodyToJson(body: unknown): string {
  return JSON.stringify(body, null, 2) || '{}';
}

export function DocumentsPage() {
  const [selectedCollection, setSelectedCollection] = useState<DocumentCollection | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [page, setPage] = useState(1);
  const owner = selectedCollection?.owner ?? '';
  const collection = selectedCollection?.collection ?? '';

  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocId, setNewDocId] = useState('');
  const [newDocBody, setNewDocBody] = useState('{}');
  const [newDocError, setNewDocError] = useState<string | null>(null);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColOwner, setNewColOwner] = useState('host');
  const [newColName, setNewColName] = useState('');
  const [newColDescription, setNewColDescription] = useState('');
  const [newColError, setNewColError] = useState<string | null>(null);
  const [isCreatingCol, setIsCreatingCol] = useState(false);
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

  const selectedCollectionKey = selectedCollection ? `${selectedCollection.owner}/${selectedCollection.collection}` : null;

  const handleSelectCollection = (nextCollection: DocumentCollection | null) => {
    setSelectedCollection(nextCollection);
    setSelectedDoc(null);
    setPage(1);
    setShowNewCollection(false);
    setEditBody('');
    setEditError(null);
    setIsCreating(false);
    setNewDocError(null);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setNewColError(null);
  };

  const handleSelectDocument = (doc: DocumentRecord) => {
    if (doc.id === selectedDoc?.id) {
      setSelectedDoc(null);
      setShowDeleteConfirm(false);
      return;
    }
    setSelectedDoc(doc);
    setEditBody(bodyToJson(doc.body));
    setEditError(null);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setIsCreating(false);
    setNewDocError(null);
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
    if (nextSelectedDoc) {
      setEditBody(bodyToJson(nextSelectedDoc.body));
      setEditError(null);
    }
  }, [recordsData, selectedDoc]);

  const isRefreshing = collectionsLoading || recordsRefreshing;
  const selectedDocJson = useMemo(() => (selectedDoc ? bodyToJson(selectedDoc.body) : ''), [selectedDoc]);
  const hasUnsavedEdit = selectedDoc !== null && editBody !== selectedDocJson;

  const handleSave = useCallback(async () => {
    if (!selectedDoc) return;
    setEditError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(editBody);
    } catch {
      setEditError('Invalid JSON');
      return;
    }
    setIsSaving(true);
    try {
      const result = await api.documents.put(selectedDoc.owner, selectedDoc.collection, selectedDoc.id, parsed);
      setSelectedDoc(result.document);
      setEditBody(bodyToJson(result.document.body));
      setEditError(null);
      await refetchData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [selectedDoc, editBody, refetchData]);

  const handleCreateDocument = useCallback(async () => {
    if (!selectedCollection) return;
    setNewDocError(null);
    if (!newDocId.trim()) {
      setNewDocError('Document ID is required');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(newDocBody);
    } catch {
      setNewDocError('Invalid JSON body');
      return;
    }
    setIsCreatingDoc(true);
    try {
      const result = await api.documents.put(selectedCollection.owner, selectedCollection.collection, newDocId.trim(), parsed);
      setNewDocError(null);
      setNewDocId('');
      setNewDocBody('{}');
      setIsCreating(false);
      setSelectedDoc(result.document);
      setEditBody(bodyToJson(result.document.body));
      await refetchData();
    } catch (err: unknown) {
      setNewDocError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setIsCreatingDoc(false);
    }
  }, [selectedCollection, newDocId, newDocBody, refetchData]);

  const handleDelete = useCallback(async () => {
    if (!selectedDoc) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await api.documents.delete(selectedDoc.owner, selectedDoc.collection, selectedDoc.id);
      setShowDeleteConfirm(false);
      setSelectedDoc(null);
      await refetchData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDoc, refetchData]);

  const handleCreateCollection = useCallback(async () => {
    setNewColError(null);
    if (!newColOwner.trim()) {
      setNewColError('Owner is required');
      return;
    }
    if (!newColName.trim()) {
      setNewColError('Collection name is required');
      return;
    }
    setIsCreatingCol(true);
    try {
      const result = await api.documents.upsertCollection(newColOwner.trim(), newColName.trim(), {
        description: newColDescription.trim() || undefined,
      });
      setNewColError(null);
      setShowNewCollection(false);
      setNewColOwner('host');
      setNewColName('');
      setNewColDescription('');
      setSelectedCollection(result.collection);
      setPage(1);
      await refetchData();
    } catch (err: unknown) {
      setNewColError(err instanceof Error ? err.message : 'Create collection failed');
    } finally {
      setIsCreatingCol(false);
    }
  }, [newColOwner, newColName, newColDescription, refetchData]);

  return (
    <AppPageLayout
      aside={
        selectedDoc ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="ui-app-page-intro">
                <h2 className="ui-app-page-title text-sm">Record Detail</h2>
              </div>
              {!showDeleteConfirm ? (
                <ToolbarButton
                  type="button"
                  className="text-danger hover:bg-danger/10"
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete record"
                  title="Delete"
                >
                  Delete
                </ToolbarButton>
              ) : null}
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
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-secondary">Body</h3>
                <ToolbarButton type="button" disabled={isSaving || !hasUnsavedEdit} onClick={handleSave}>
                  {isSaving ? 'Saving...' : 'Save'}
                </ToolbarButton>
              </div>
              <Textarea
                className="min-h-[120px] w-full resize-y rounded-sm border border-border-subtle bg-bg-subtle p-2 font-mono text-[11px] leading-relaxed"
                value={editBody}
                onChange={(e) => {
                  setEditBody(e.target.value);
                  setEditError(null);
                }}
                placeholder="{}"
              />
              {editError ? <FieldError className="mt-1">{editError}</FieldError> : null}
            </div>
            {showDeleteConfirm ? (
              <div className="rounded-sm border border-danger/30 bg-bg-subtle p-2">
                <p className="mb-2 text-[11px] text-danger">
                  Delete <span className="font-mono">{selectedDoc.id}</span>?
                </p>
                <div className="flex gap-2">
                  <Button tone="danger" disabled={isDeleting} onClick={handleDelete}>
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={isDeleting}
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {deleteError ? <FieldError className="mt-1">{deleteError}</FieldError> : null}
              </div>
            ) : null}
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
                <TabButton key={tab.key} active={selectedCollectionKey === tab.key} onClick={() => handleSelectCollection(tab.collection)}>
                  {tab.label}
                </TabButton>
              ))}
            </TabList>
          }
          actions={
            selectedCollection ? (
              <div className="flex items-center gap-2">
                {total > PAGE_SIZE ? (
                  <DataTablePagination
                    page={page}
                    pageCount={pageCount}
                    totalLabel={`${total} records`}
                    onPrevious={page > 1 ? () => setPage((p) => Math.max(1, p - 1)) : undefined}
                    onNext={page < pageCount ? () => setPage((p) => p + 1) : undefined}
                  />
                ) : null}
                {!isCreating ? (
                  <ToolbarButton
                    type="button"
                    onClick={() => {
                      setIsCreating(true);
                      setNewDocError(null);
                    }}
                  >
                    New document
                  </ToolbarButton>
                ) : null}
              </div>
            ) : (
              <ToolbarButton type="button" onClick={() => setShowNewCollection(true)}>
                New collection
              </ToolbarButton>
            )
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
            showNewCollection={showNewCollection}
            newColOwner={newColOwner}
            newColName={newColName}
            newColDescription={newColDescription}
            newColError={newColError}
            isCreatingCol={isCreatingCol}
            onNewColOwnerChange={setNewColOwner}
            onNewColNameChange={setNewColName}
            onNewColDescriptionChange={setNewColDescription}
            onNewColSubmit={handleCreateCollection}
            onNewColCancel={() => {
              setShowNewCollection(false);
              setNewColError(null);
            }}
          />
        ) : (
          <>
            {isCreating ? (
              <div className="mb-2 rounded-sm border border-border-subtle bg-bg-subtle p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-secondary">New document</h3>
                  <div className="flex gap-2">
                    <ToolbarButton type="button" disabled={isCreatingDoc} onClick={handleCreateDocument}>
                      {isCreatingDoc ? 'Creating...' : 'Create'}
                    </ToolbarButton>
                    <ToolbarButton
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewDocError(null);
                      }}
                    >
                      Cancel
                    </ToolbarButton>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="mb-1 block text-[11px] font-medium text-secondary">Document ID</label>
                  <InlineTextInput
                    className="w-full"
                    value={newDocId}
                    onChange={(e) => setNewDocId(e.target.value)}
                    placeholder="my-document-id"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-secondary">JSON Body</label>
                  <Textarea
                    className="min-h-[80px] w-full resize-y rounded-sm border border-border-subtle bg-bg p-2 font-mono text-[11px] leading-relaxed"
                    value={newDocBody}
                    onChange={(e) => setNewDocBody(e.target.value)}
                    placeholder="{}"
                  />
                </div>
                {newDocError ? <FieldError className="mt-1">{newDocError}</FieldError> : null}
              </div>
            ) : null}
            <RecordsTable
              records={records}
              loading={recordsLoading && !recordsData}
              error={recordsError}
              selectedDoc={selectedDoc}
              onSelect={handleSelectDocument}
            />
          </>
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
  showNewCollection,
  newColOwner,
  newColName,
  newColDescription,
  newColError,
  isCreatingCol,
  onNewColOwnerChange,
  onNewColNameChange,
  onNewColDescriptionChange,
  onNewColSubmit,
  onNewColCancel,
}: {
  collections: DocumentCollection[];
  loading: boolean;
  error: string | null;
  onSelect: (collection: DocumentCollection) => void;
  showNewCollection: boolean;
  newColOwner: string;
  newColName: string;
  newColDescription: string;
  newColError: string | null;
  isCreatingCol: boolean;
  onNewColOwnerChange: (value: string) => void;
  onNewColNameChange: (value: string) => void;
  onNewColDescriptionChange: (value: string) => void;
  onNewColSubmit: () => void;
  onNewColCancel: () => void;
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
        ) : showNewCollection || collections.length > 0 ? (
          <>
            {showNewCollection ? (
              <DataTableRow>
                <DataTableCell colSpan={5} className="p-3">
                  <div className="rounded-sm border border-border-subtle bg-bg-subtle p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[11px] font-medium uppercase tracking-wide text-secondary">New collection</h3>
                      <div className="flex gap-2">
                        <ToolbarButton type="button" disabled={isCreatingCol} onClick={onNewColSubmit}>
                          {isCreatingCol ? 'Creating...' : 'Create'}
                        </ToolbarButton>
                        <ToolbarButton type="button" onClick={onNewColCancel}>
                          Cancel
                        </ToolbarButton>
                      </div>
                    </div>
                    <div className="mb-2 flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-medium text-secondary">Owner</label>
                        <InlineTextInput
                          className="w-full"
                          value={newColOwner}
                          onChange={(e) => onNewColOwnerChange(e.target.value)}
                          placeholder="host"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-medium text-secondary">Collection</label>
                        <InlineTextInput
                          className="w-full"
                          value={newColName}
                          onChange={(e) => onNewColNameChange(e.target.value)}
                          placeholder="my-collection"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-secondary">Description (optional)</label>
                      <InlineTextInput
                        className="w-full"
                        value={newColDescription}
                        onChange={(e) => onNewColDescriptionChange(e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>
                    {newColError ? <FieldError className="mt-1">{newColError}</FieldError> : null}
                    {error ? <FieldError className="mt-1">{error}</FieldError> : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : null}
            {collections.map((col) => (
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
            ))}
          </>
        ) : error && !collections.length ? (
          <DataTableEmptyRow colSpan={5}>
            <ErrorState message={error} />
          </DataTableEmptyRow>
        ) : collections.length === 0 && !showNewCollection ? (
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
        ) : null}
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
