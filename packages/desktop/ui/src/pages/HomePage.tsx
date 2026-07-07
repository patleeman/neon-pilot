import { Fragment, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../client/api';
import {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  DashboardGrid,
  DashboardGridCell,
  ErrorState,
  MetricTile,
  type MetricTone,
  QuietLoadingState,
  ResourceList,
  ResourceListLink,
  StatusDot,
  type StatusDotTone,
  ToolbarButton,
} from '../components/ui';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { WidgetHost } from '../extensions/WidgetHost';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { DocumentCollection, DocumentRecord, GlobalActivityItem, GlobalActivityStatus, InboxMessageBody } from '../shared/types';

const RECENT_INBOX_LIMIT = 6;
const ACTIVITY_LIMIT = 200;
const RECENT_COLLECTION_LIMIT = 6;
const RECENT_ACTIVITY_ROWS = 6;

function inboxBody(record: DocumentRecord): InboxMessageBody {
  return (record.body ?? {}) as InboxMessageBody;
}

function isUnread(record: DocumentRecord): boolean {
  return inboxBody(record).read !== true;
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(Date.parse(iso));
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgoShort(iso: string | undefined): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function activityStatusTone(status: GlobalActivityStatus): StatusDotTone {
  switch (status) {
    case 'running':
      return 'accent';
    case 'queued':
      return 'muted';
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'muted';
    case 'unknown':
      return 'muted';
  }
}

function activityStatusLabel(status: GlobalActivityStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'unknown':
      return 'Unknown';
  }
}

function itemIsActive(item: GlobalActivityItem): boolean {
  return Boolean(item.active) || item.status === 'running' || item.status === 'queued';
}

function collectionLabel(collection: DocumentCollection): string {
  return `${collection.owner}/${collection.collection}`;
}

function metricTone(count: number): MetricTone {
  if (count > 0) return 'accent';
  return 'muted';
}

export function HomePage() {
  const collectionsFetcher = useCallback(async () => api.documents.collections(), []);
  const {
    data: collectionsData,
    loading: collectionsLoading,
    refreshing: collectionsRefreshing,
    error: collectionsError,
    refetch: refetchCollections,
  } = useApi(collectionsFetcher, 'home-documents-collections');

  const inboxFetcher = useCallback(async () => api.inbox.list({ limit: RECENT_INBOX_LIMIT }), []);
  const {
    data: inboxData,
    loading: inboxLoading,
    refreshing: inboxRefreshing,
    error: inboxError,
    refetch: refetchInbox,
  } = useApi(inboxFetcher, 'home-inbox');

  const activityFetcher = useCallback(async () => api.activity({ limit: ACTIVITY_LIMIT }), []);
  const {
    data: activityData,
    loading: activityLoading,
    refreshing: activityRefreshing,
    error: activityError,
    refetch: refetchActivity,
  } = useApi(activityFetcher, 'home-activity');

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refetchCollections({ resetLoading: false }),
      refetchInbox({ resetLoading: false }),
      refetchActivity({ resetLoading: false }),
    ]);
  }, [refetchCollections, refetchInbox, refetchActivity]);

  const { widgets } = useExtensionRegistry();

  useInvalidateOnTopics(['documents', 'inbox', 'executions', 'sessions'], refreshAll);

  const collections: DocumentCollection[] = collectionsData?.collections ?? [];
  const recentCollections = collections.slice(0, RECENT_COLLECTION_LIMIT);

  const inboxRecords: DocumentRecord[] = inboxData?.records ?? [];
  const unreadRecords = inboxRecords.filter(isUnread);
  const unreadCount = unreadRecords.length;
  const inboxTotal = inboxData?.total ?? 0;

  const activityItems: GlobalActivityItem[] = activityData ? activityData.items : [];
  const activeWork = activityItems.filter(itemIsActive);
  const recentActivity = activityItems.slice(0, RECENT_ACTIVITY_ROWS);

  const collectionCount = collections.length;
  const activeWorkCount = activeWork.length;

  const refreshingAny = collectionsRefreshing || inboxRefreshing || activityRefreshing;
  const loadingAll = collectionsLoading && !collectionsData && inboxLoading && !inboxData && activityLoading && !activityData;

  const metricTiles = useMemo(
    () => (
      <DashboardGrid columns={3} divide="both">
        <DashboardGridCell>
          <MetricTile label="Document collections" value={collectionCount} tone={metricTone(collectionCount)} detail="Shared data stores" />
        </DashboardGridCell>
        <DashboardGridCell>
          <MetricTile
            label="Unread inbox"
            value={unreadCount}
            tone={unreadCount > 0 ? 'accent' : 'muted'}
            detail={inboxTotal > 0 ? `${inboxTotal} total messages` : '0 messages'}
          />
        </DashboardGridCell>
        <DashboardGridCell>
          <MetricTile
            label="Active work"
            value={activeWorkCount}
            tone={activeWorkCount > 0 ? 'accent' : 'muted'}
            detail={activityData ? `${activityData.total} activity rows` : undefined}
          />
        </DashboardGridCell>
      </DashboardGrid>
    ),
    [collectionCount, unreadCount, inboxTotal, activeWorkCount, activityData],
  );

  return (
    <AppPageLayout>
      <div className="flex min-h-0 flex-col gap-4">
        <AppPageIntro
          title="Home"
          summary="A composition dashboard over shared data — documents, inbox, and background work."
          actions={
            <ToolbarButton
              type="button"
              disabled={refreshingAny || loadingAll}
              onClick={() => {
                void refreshAll();
              }}
            >
              {refreshingAny ? 'Refreshing...' : 'Refresh'}
            </ToolbarButton>
          }
        />

        {loadingAll ? (
          <QuietLoadingState label="Loading Home" />
        ) : collectionsError && !collectionsData && inboxError && !inboxData && activityError && !activityData ? (
          <ErrorState message={collectionsError ?? inboxError ?? activityError} />
        ) : (
          <>
            {metricTiles}

            {widgets.length > 0 && (
              <AppPageSection title="Widgets" layout="stacked">
                <div className="grid min-h-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {widgets.map((widget) => (
                    <Fragment key={`${widget.extensionId}:${widget.id}`}>
                      <WidgetHost registration={widget} />
                    </Fragment>
                  ))}
                </div>
              </AppPageSection>
            )}

            <div className="grid min-h-0 gap-4 xl:grid-cols-3">
              <AppPageSection
                title="Documents collections"
                meta={collectionCount > 0 ? `${collectionCount}` : undefined}
                layout="stacked"
                actions={
                  <Link to="/documents" className="ui-toolbar-button">
                    Open Documents
                  </Link>
                }
              >
                {collectionsError ? (
                  <ErrorState message={collectionsError} />
                ) : recentCollections.length === 0 ? (
                  <AppPageEmptyState
                    title="No collections yet"
                    body="Document collections group shared records by owner and collection name."
                    steps={['Create a collection from an extension or the API', 'Open Documents to browse records']}
                    align="start"
                  />
                ) : (
                  <ResourceList>
                    {recentCollections.map((collection) => (
                      <ResourceListLink
                        key={collectionLabel(collection)}
                        as={Link}
                        to="/documents"
                        label={collection.collection}
                        meta={collection.owner}
                        detail={formatTimestamp(collection.updatedAt)}
                      />
                    ))}
                  </ResourceList>
                )}
              </AppPageSection>

              <AppPageSection
                title="Inbox"
                meta={unreadCount > 0 ? `${unreadCount} unread` : undefined}
                layout="stacked"
                actions={
                  <Link to="/inbox" className="ui-toolbar-button">
                    Open Inbox
                  </Link>
                }
              >
                {inboxError ? (
                  <ErrorState message={inboxError} />
                ) : inboxRecords.length === 0 ? (
                  <AppPageEmptyState
                    title="No messages"
                    body="Worker results, persona notes, and automation alerts arrive here."
                    steps={['Run an automation to receive a result', 'Open Inbox to review archived messages']}
                    align="start"
                  />
                ) : (
                  <ResourceList>
                    {inboxRecords.map((record) => {
                      const body = inboxBody(record);
                      const unread = body.read !== true;
                      return (
                        <ResourceListLink
                          key={record.id}
                          as={Link}
                          to="/inbox"
                          label={body.subject || record.id}
                          meta={body.from || '-'}
                          detail={
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot tone={unread ? 'accent' : 'muted'} size="sm" title={unread ? 'Unread' : 'Read'} />
                              <span>{formatTimestamp(record.updatedAt)}</span>
                            </span>
                          }
                        />
                      );
                    })}
                  </ResourceList>
                )}
              </AppPageSection>

              <AppPageSection
                title="Activity"
                meta={activityData ? `${activityData.total}` : undefined}
                layout="stacked"
                actions={
                  <Link to="/activity" className="ui-toolbar-button">
                    Open Activity
                  </Link>
                }
              >
                {activityError ? (
                  <ErrorState message={activityError} />
                ) : recentActivity.length === 0 ? (
                  <AppPageEmptyState
                    title="No activity yet"
                    body="Conversations and background workers appear here as they run."
                    steps={['Start or resume a conversation', 'Run a terminal command or schedule a task']}
                    align="start"
                  />
                ) : (
                  <ResourceList>
                    {recentActivity.map((item) => (
                      <ResourceListLink
                        key={item.id}
                        as={Link}
                        to="/activity"
                        label={item.title}
                        meta={
                          item.source ?? (item.kind === 'conversation' ? 'Conversation' : item.kind === 'entry' ? 'Activity' : 'Worker')
                        }
                        detail={
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot tone={activityStatusTone(item.status)} size="sm" title={activityStatusLabel(item.status)} />
                            <span>{timeAgoShort(item.updatedAt)}</span>
                          </span>
                        }
                      />
                    ))}
                  </ResourceList>
                )}
              </AppPageSection>
            </div>
          </>
        )}
      </div>
    </AppPageLayout>
  );
}
