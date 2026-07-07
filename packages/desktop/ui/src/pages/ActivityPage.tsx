import {
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedLoadingState,
  WindowedPageButton,
  WindowedPageSection,
  WindowedTimeline,
  WindowedTimelineItem,
  WindowedToolbar,
} from '@neon-pilot/windowed-os-ui';
import { useCallback, useMemo, useState } from 'react';

import { api } from '../client/api';
import { AppPageIntro, AppPageLayout } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { GlobalActivityItem, GlobalActivityResult } from '../shared/types';

type ActivityFilter = 'all' | 'active' | 'conversation' | 'execution';
type ColorTone = 'neutral' | 'positive' | 'warning' | 'danger';

function statusTone(status: GlobalActivityItem['status']): ColorTone {
  switch (status) {
    case 'running':
      return 'warning';
    case 'queued':
      return 'neutral';
    case 'completed':
      return 'positive';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    case 'unknown':
      return 'neutral';
  }
}

function timelineTone(status: GlobalActivityItem['status']): ColorTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function statusLabel(status: GlobalActivityItem['status']): string {
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

/** User-facing source label for a row. */
function itemSourceLabel(item: GlobalActivityItem): string {
  if (item.source) return item.source;
  if (item.kind === 'conversation') return 'Conversation';
  if (item.kind === 'entry') return 'Activity';
  return 'Worker';
}

/** Compact worker display: workerName > title > id fallback. */
function workerDisplayName(item: GlobalActivityItem): string {
  if (item.workerName) return item.workerName;
  if (item.title) return item.title;
  return item.id;
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

function filterItems(items: GlobalActivityItem[], filter: ActivityFilter): GlobalActivityItem[] {
  if (filter === 'all') return items;
  if (filter === 'active') return items.filter(itemIsActive);
  return items.filter((item) => item.kind === filter);
}

export function ActivityPage() {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const fetcher = useCallback(async (): Promise<GlobalActivityResult> => {
    return api.activity({ limit: 200 });
  }, []);

  const { data, loading, error, refetch } = useApi(fetcher, 'global-activity');
  useInvalidateOnTopics(['sessions', 'executions', 'activity'], refetch);

  const allItems = data ? data.items : [];
  const filtered = useMemo(() => filterItems(allItems, filter), [allItems, filter]);
  const activeItems = useMemo(() => filtered.filter(itemIsActive), [filtered]);
  const timelineItems = useMemo(() => filtered.filter((i) => !itemIsActive(i)), [filtered]);

  const conversationCount = allItems.filter((i) => i.kind === 'conversation').length;
  const executionCount = allItems.filter((i) => i.kind === 'execution').length;
  const activeCount = allItems.filter(itemIsActive).length;

  const hasData = Boolean(data && allItems.length > 0);
  const isLoading = loading && !data;
  const isError = Boolean(error && !data);

  return (
    <AppPageLayout>
      <div className="flex min-h-0 flex-col gap-4">
        <AppPageIntro title="Activity" />

        <WindowedToolbar>
          <WindowedPageButton tone={filter === 'all' ? 'accent' : 'neutral'} onClick={() => setFilter('all')}>
            All{data ? ` ${data.total}` : ''}
          </WindowedPageButton>
          <WindowedPageButton tone={filter === 'active' ? 'accent' : 'neutral'} onClick={() => setFilter('active')}>
            Active{activeCount > 0 ? ` ${activeCount}` : ''}
          </WindowedPageButton>
          <WindowedPageButton tone={filter === 'conversation' ? 'accent' : 'neutral'} onClick={() => setFilter('conversation')}>
            Conversations{conversationCount > 0 ? ` ${conversationCount}` : ''}
          </WindowedPageButton>
          <WindowedPageButton tone={filter === 'execution' ? 'accent' : 'neutral'} onClick={() => setFilter('execution')}>
            Workers{executionCount > 0 ? ` ${executionCount}` : ''}
          </WindowedPageButton>
        </WindowedToolbar>

        {isLoading ? (
          <WindowedPageSection title="Active Work">
            <WindowedLoadingState label="Loading activity" />
          </WindowedPageSection>
        ) : isError ? (
          <WindowedPageSection title="Active Work">
            <WindowedEmptyState title="Failed to load activity">
              <p>{error}</p>
            </WindowedEmptyState>
          </WindowedPageSection>
        ) : !hasData ? (
          <WindowedPageSection>
            <WindowedEmptyState title="No activity yet">
              <p>Conversations, background commands, subagents, and scheduled tasks appear here as they run.</p>
            </WindowedEmptyState>
          </WindowedPageSection>
        ) : (
          <>
            <WindowedPageSection title="Active" meta={activeCount > 0 ? `${activeCount} running` : undefined}>
              {activeItems.length === 0 ? (
                <WindowedEmptyState title="No active work">
                  <p>All workers and conversations are idle.</p>
                </WindowedEmptyState>
              ) : (
                <WindowedDataTable
                  columns={[{ label: 'Worker' }, { label: 'Source' }, { label: 'Status' }, { label: 'When', align: 'right' }]}
                >
                  {activeItems.map((item) => (
                    <WindowedDataRow
                      key={item.id}
                      name={workerDisplayName(item)}
                      meta={item.subtitle}
                      cells={[
                        itemSourceLabel(item),
                        <WindowedBadge tone={statusTone(item.status as GlobalActivityItem['status'])} key="status">
                          {statusLabel(item.status as GlobalActivityItem['status'])}
                        </WindowedBadge>,
                        timeAgoShort(item.updatedAt),
                      ]}
                    />
                  ))}
                </WindowedDataTable>
              )}
            </WindowedPageSection>

            <WindowedPageSection title="Recent" meta={timelineItems.length > 0 ? `${timelineItems.length} entries` : undefined}>
              {timelineItems.length === 0 ? (
                <WindowedEmptyState title="No recent activity">
                  <p>Completed work appears here as a timeline.</p>
                </WindowedEmptyState>
              ) : (
                <WindowedTimeline>
                  {timelineItems.map((item) => (
                    <WindowedTimelineItem
                      key={item.id}
                      title={item.title}
                      meta={timeAgoShort(item.updatedAt)}
                      tone={timelineTone(item.status as GlobalActivityItem['status'])}
                    >
                      <p>
                        {itemSourceLabel(item)}
                        {item.subtitle ? ` / ${item.subtitle}` : ''}
                      </p>
                      {item.conversationTitle && item.kind === 'execution' ? (
                        <p className="text-tertiary">in {item.conversationTitle}</p>
                      ) : null}
                    </WindowedTimelineItem>
                  ))}
                </WindowedTimeline>
              )}
            </WindowedPageSection>
          </>
        )}
      </div>
    </AppPageLayout>
  );
}
