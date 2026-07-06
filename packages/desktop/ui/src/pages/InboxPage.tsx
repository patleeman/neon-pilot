import { useCallback, useEffect, useMemo, useState } from 'react';

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
  Textarea,
  ToolbarButton,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { DocumentRecord, InboxListResult, InboxMessageBody, InboxMessageKind, InboxSenderKind } from '../shared/types';

const PAGE_SIZE = 50;

type InboxView = 'inbox' | 'archived';

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

function messageBody(doc: DocumentRecord): InboxMessageBody {
  return (doc.body ?? {}) as InboxMessageBody;
}

function senderKindLabel(kind: InboxSenderKind): string {
  return kind;
}

function messageKindLabel(kind: InboxMessageKind): string {
  return kind;
}

export function InboxPage() {
  const [view, setView] = useState<InboxView>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const archived = view === 'archived';

  const listFetcher = useCallback(async (): Promise<InboxListResult> => {
    return api.inbox.list({ archived, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  }, [archived, page]);

  const { data: listData, loading, refreshing, error, refetch, replaceData } = useApi(listFetcher, `inbox-${view}-${page}`);

  const records: DocumentRecord[] = listData?.records ?? [];
  const total = listData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCount = useMemo(() => records.filter((r) => messageBody(r).read !== true).length, [records]);

  const selectedDoc = useMemo(() => records.find((r) => r.id === selectedId) ?? null, [records, selectedId]);

  useInvalidateOnTopics(['inbox', 'documents'], refetch);

  // Clear a stale selection when switching views or paging away from it.
  useEffect(() => {
    if (selectedId && !selectedDoc) {
      if (listData && !records.some((r) => r.id === selectedId)) {
        setSelectedId(null);
      }
    }
  }, [listData, records, selectedDoc, selectedId]);

  const handleSwitchView = (nextView: InboxView) => {
    if (nextView === view) return;
    setView(nextView);
    setSelectedId(null);
    setPage(1);
    setActionError(null);
  };

  const handleSelectMessage = (doc: DocumentRecord) => {
    setSelectedId(doc.id === selectedId ? null : doc.id);
    setActionError(null);
    // Mark as read on first open if unread.
    const body = messageBody(doc);
    if (body.read !== true) {
      void mutateMessage(doc.id, { read: true });
    }
  };

  const refresh = useCallback(async () => {
    await refetch({ resetLoading: false });
  }, [refetch]);

  async function mutateMessage(id: string, patch: { read?: boolean; archived?: boolean; answer?: string }): Promise<void> {
    setMutatingId(id);
    setActionError(null);
    try {
      const { document } = await api.inbox.patch(id, patch);
      // Optimistically update the in-page list so the UI reacts immediately;
      // the invalidation topic refetch reconciles in the background.
      replaceData({
        records: records
          .map((r) => (r.id === document.id ? document : r))
          .filter((r) => {
            const body = messageBody(r);
            // If archived state changed, drop it from the current view.
            if (view === 'inbox' && body.archived === true) return false;
            if (view === 'archived' && body.archived !== true) return false;
            return true;
          }),
        total: Math.max(
          0,
          total - (records.some((r) => r.id === document.id) && messageBody(document).archived === (view === 'inbox') ? 1 : 0),
        ),
      });
      if (patch.archived !== undefined && id === selectedId) {
        setSelectedId(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setMutatingId(null);
    }
  }

  async function deleteMessage(id: string): Promise<void> {
    setMutatingId(id);
    setActionError(null);
    try {
      await api.inbox.delete(id);
      replaceData({
        records: records.filter((r) => r.id !== id),
        total: Math.max(0, total - 1),
      });
      if (id === selectedId) setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setMutatingId(null);
    }
  }

  const isRefreshing = refreshing;

  return (
    <AppPageLayout
      aside={
        selectedDoc ? (
          <MessageDetail
            doc={selectedDoc}
            view={view}
            mutating={mutatingId === selectedDoc.id}
            onToggleRead={() => {
              const next = messageBody(selectedDoc).read !== true;
              void mutateMessage(selectedDoc.id, { read: next });
            }}
            onToggleArchive={() => {
              const next = messageBody(selectedDoc).archived !== true;
              void mutateMessage(selectedDoc.id, { archived: next });
            }}
            onDelete={() => void deleteMessage(selectedDoc.id)}
            onAnswer={(text) => {
              void mutateMessage(selectedDoc.id, { answer: text });
            }}
          />
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-col gap-4">
        <AppPageIntro
          title="Inbox"
          actions={
            <ToolbarButton type="button" disabled={loading && !listData} onClick={() => void refresh()}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </ToolbarButton>
          }
        />

        <DataTableToolbar
          tabs={
            <TabList ariaLabel="Filter Inbox view">
              <TabButton active={view === 'inbox'} onClick={() => handleSwitchView('inbox')}>
                Inbox{view === 'inbox' && unreadCount > 0 ? ` ${unreadCount} unread` : ''}
              </TabButton>
              <TabButton active={view === 'archived'} onClick={() => handleSwitchView('archived')}>
                Archived
              </TabButton>
            </TabList>
          }
          actions={
            total > PAGE_SIZE ? (
              <DataTablePagination
                page={page}
                pageCount={pageCount}
                totalLabel={`${total} messages`}
                onPrevious={page > 1 ? () => setPage((p) => Math.max(1, p - 1)) : undefined}
                onNext={page < pageCount ? () => setPage((p) => p + 1) : undefined}
              />
            ) : undefined
          }
          summary={
            error && !listData ? (
              <span className="text-[11px] text-danger">Failed to load messages</span>
            ) : actionError ? (
              <span className="text-[11px] text-danger">{actionError}</span>
            ) : total > 0 ? (
              <span className="text-[11px] text-tertiary">{total === 1 ? '1 message' : `${total} messages`}</span>
            ) : undefined
          }
        />

        <InboxTable
          records={records}
          loading={loading && !listData}
          error={error}
          view={view}
          selectedId={selectedId}
          onSelect={handleSelectMessage}
        />
      </div>
    </AppPageLayout>
  );
}

function InboxTable({
  records,
  loading,
  error,
  view,
  selectedId,
  onSelect,
}: {
  records: DocumentRecord[];
  loading: boolean;
  error: string | null;
  view: InboxView;
  selectedId: string | null;
  onSelect: (doc: DocumentRecord) => void;
}) {
  return (
    <DataTable>
      <DataTableHead>
        <DataTableRow>
          <DataTableHeaderCell style={{ width: '2rem' }} aria-label="Read state" />
          <DataTableHeaderCell>Subject</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '9rem' }}>From</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '7rem' }}>Kind</DataTableHeaderCell>
          <DataTableHeaderCell style={{ width: '9rem' }}>Updated</DataTableHeaderCell>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {loading ? (
          <DataTableEmptyRow colSpan={5}>
            <QuietLoadingState label="Loading messages" />
          </DataTableEmptyRow>
        ) : error && !records.length ? (
          <DataTableEmptyRow colSpan={5}>
            <ErrorState message={error} />
          </DataTableEmptyRow>
        ) : records.length === 0 ? (
          <DataTableEmptyRow colSpan={5}>
            <AppPageEmptyState
              title={view === 'archived' ? 'No archived messages' : 'No messages yet'}
              body={
                view === 'archived'
                  ? 'Archived messages are kept for review. Restoring a message moves it back to the Inbox.'
                  : 'Worker results, persona messages, and questions needing input arrive here.'
              }
              steps={
                view === 'archived'
                  ? ['Open a message and use Restore to move it back to the Inbox']
                  : ['Run an automation to receive a worker result', 'Ask the persona a question that lands here']
              }
              align="start"
            />
          </DataTableEmptyRow>
        ) : (
          records.map((doc) => {
            const body = messageBody(doc);
            const unread = body.read !== true;
            const isSelected = doc.id === selectedId;
            return (
              <DataTableRow key={doc.id} className={isSelected ? 'bg-bg-active' : 'cursor-pointer'} onClick={() => onSelect(doc)}>
                <DataTableCell className="align-middle">
                  <div
                    className={`h-2 w-2 rounded-full ${unread ? 'bg-accent' : 'bg-border-subtle'}`}
                    aria-label={unread ? 'Unread' : 'Read'}
                    title={unread ? 'Unread' : 'Read'}
                  />
                </DataTableCell>
                <DataTableCell className="max-w-0 align-middle">
                  <div className="min-w-0">
                    <div className={`truncate text-[13px] ${unread ? 'font-medium' : 'font-normal'}`}>{body.subject || doc.id}</div>
                    {body.body ? <div className="truncate text-[11px] text-tertiary">{body.body}</div> : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="align-middle">
                  <div className="min-w-0">
                    <div className="truncate text-[12px]">{body.from || '—'}</div>
                    {body.fromKind ? (
                      <div className="text-[10px] uppercase tracking-wide text-tertiary">{senderKindLabel(body.fromKind)}</div>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="align-middle">
                  <span className="inline-block rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-secondary">
                    {body.kind ? messageKindLabel(body.kind) : '—'}
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

function QuestionAnswerSection({
  body,
  mutating,
  onAnswer,
}: {
  body: InboxMessageBody;
  mutating: boolean;
  onAnswer: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const isAnswered = body.answer !== undefined;

  if (isAnswered) {
    return (
      <div>
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Answer</h3>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-accent/30 bg-accent/10 p-2 text-[12px] leading-relaxed">
          {body.answer.text}
        </pre>
        <p className="mt-1 text-[10px] text-tertiary">Answered {formatTimestamp(body.answer.answeredAt)}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Your Answer</h3>
      <Textarea
        className="min-h-[4rem] w-full resize-y text-[12px] leading-relaxed"
        placeholder="Type your answer..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={mutating}
        rows={3}
      />
      <div className="mt-2">
        <ToolbarButton
          type="button"
          disabled={mutating || text.trim().length === 0}
          onClick={() => {
            if (text.trim().length > 0) {
              onAnswer(text.trim());
              setText('');
            }
          }}
        >
          {mutating ? 'Submitting...' : 'Submit Answer'}
        </ToolbarButton>
      </div>
    </div>
  );
}

function MessageDetail({
  doc,
  view,
  mutating,
  onToggleRead,
  onToggleArchive,
  onDelete,
  onAnswer,
}: {
  doc: DocumentRecord;
  view: InboxView;
  mutating: boolean;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onAnswer: (text: string) => void;
}) {
  const body = messageBody(doc);
  const isRead = body.read === true;
  const isArchived = body.archived === true;
  const isQuestion = body.kind === 'question';

  return (
    <div className="space-y-3">
      <div className="ui-app-page-intro">
        <h2 className="ui-app-page-title text-sm">Message Detail</h2>
      </div>

      <KeyValueTable
        columns={1}
        items={[
          { label: 'From', value: body.from || '—' },
          { label: 'From kind', value: body.fromKind ? senderKindLabel(body.fromKind) : '—' },
          { label: 'To', value: body.to || '—' },
          { label: 'Kind', value: body.kind ? messageKindLabel(body.kind) : '—' },
          { label: 'Subject', value: body.subject || '—' },
          ...(body.refId ? [{ label: 'Ref', value: body.refId, valueClassName: 'font-mono text-[11px]' }] : []),
          { label: 'ID', value: doc.id, valueClassName: 'font-mono text-[11px]' },
          { label: 'Created', value: formatTimestamp(doc.createdAt) },
          { label: 'Updated', value: formatTimestamp(doc.updatedAt) },
        ]}
      />

      <div>
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Body</h3>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-sm border border-border-subtle bg-bg-subtle p-2 text-[12px] leading-relaxed">
          {body.body || ''}
        </pre>
      </div>

      {isQuestion && <QuestionAnswerSection body={body} onAnswer={onAnswer} mutating={mutating} />}

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton type="button" disabled={mutating} onClick={onToggleRead}>
          {isRead ? 'Mark unread' : 'Mark read'}
        </ToolbarButton>
        <ToolbarButton type="button" disabled={mutating} onClick={onToggleArchive}>
          {isArchived ? 'Restore' : 'Archive'}
        </ToolbarButton>
        <ToolbarButton type="button" disabled={mutating} onClick={onDelete} className="text-danger">
          Delete
        </ToolbarButton>
        {view === 'archived' ? <span className="text-[11px] text-tertiary">Archived</span> : null}
      </div>
    </div>
  );
}
