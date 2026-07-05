import { useCallback, useState } from 'react';

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
  DataTableRow,
  DataTableToolbar,
  ErrorState,
  QuietLoadingState,
  StatusDot,
  TabButton,
  TabList,
  ToolbarButton,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { GlobalActivityItem, GlobalActivityResult } from '../shared/types';

type ActivityFilter = 'all' | 'active' | 'conversation' | 'execution';

function statusTone(status: GlobalActivityItem['status']): 'success' | 'warning' | 'danger' | 'muted' | 'accent' {
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

/** User-facing source label for a row. Falls back to a kind label when the
 * backend did not provide one (e.g. older cached responses). */
function itemSourceLabel(item: GlobalActivityItem): string {
  if (item.source) return item.source;
  return item.kind === 'conversation' ? 'Conversation' : 'Worker';
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

function ActivityEmptyState() {
  return (
    <DataTableEmptyRow colSpan={4}>
      <AppPageEmptyState
        title="No activity yet"
        body="Conversations, background commands, subagents, and scheduled tasks appear here as they run."
        steps={['Start or resume a conversation', 'Run a terminal command in chat', 'Delegate work to a subagent or schedule a task']}
        align="start"
      />
    </DataTableEmptyRow>
  );
}

export function ActivityPage() {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const fetcher = useCallback(async (): Promise<GlobalActivityResult> => {
    return api.activity({ limit: 200 });
  }, []);

  const { data, loading, refreshing, error, refetch } = useApi(fetcher, 'global-activity');
  useInvalidateOnTopics(['sessions', 'executions'], refetch);

  const allItems = data ? data.items : [];
  const items = filterItems(allItems, filter);
  const conversationCount = allItems.filter((i) => i.kind === 'conversation').length;
  const executionCount = allItems.filter((i) => i.kind === 'execution').length;
  const activeCount = allItems.filter(itemIsActive).length;

  return (
    <AppPageLayout>
      <div className="flex min-h-0 flex-col gap-4">
        <AppPageIntro
          title="Activity"
          summary="Conversations and background workers running across the app."
          actions={
            <ToolbarButton type="button" disabled={loading && !data} onClick={() => refetch({ resetLoading: false })}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </ToolbarButton>
          }
        />

        <DataTableToolbar
          tabs={
            <TabList ariaLabel="Filter activity">
              <TabButton active={filter === 'all'} onClick={() => setFilter('all')}>
                All{data ? ` ${data.total}` : ''}
              </TabButton>
              <TabButton active={filter === 'active'} onClick={() => setFilter('active')}>
                Active{activeCount > 0 ? ` ${activeCount}` : ''}
              </TabButton>
              <TabButton active={filter === 'conversation'} onClick={() => setFilter('conversation')}>
                Conversations{conversationCount > 0 ? ` ${conversationCount}` : ''}
              </TabButton>
              <TabButton active={filter === 'execution'} onClick={() => setFilter('execution')}>
                Workers{executionCount > 0 ? ` ${executionCount}` : ''}
              </TabButton>
            </TabList>
          }
          summary={error && !data ? <span className="text-[11px] text-danger">Failed to load</span> : undefined}
        />

        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell style={{ width: '2rem' }} />
              <DataTableHeaderCell>Item</DataTableHeaderCell>
              <DataTableHeaderCell style={{ width: '8rem' }}>Source</DataTableHeaderCell>
              <DataTableHeaderCell style={{ width: '6rem' }}>When</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading && !data ? (
              <DataTableEmptyRow colSpan={4}>
                <QuietLoadingState label="Loading activity" />
              </DataTableEmptyRow>
            ) : error && !data ? (
              <DataTableEmptyRow colSpan={4}>
                <ErrorState message={error} />
              </DataTableEmptyRow>
            ) : items.length === 0 ? (
              <ActivityEmptyState />
            ) : (
              items.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell className="align-middle">
                    <StatusDot tone={statusTone(item.status)} size="sm" title={statusLabel(item.status)} />
                  </DataTableCell>
                  <DataTableCell className="max-w-0 align-middle">
                    <div className="truncate">
                      <span className="text-[13px] font-medium">{item.title}</span>
                      {item.subtitle ? <span className="text-[11px] text-tertiary"> / {item.subtitle}</span> : null}
                    </div>
                    {item.conversationTitle && item.kind === 'execution' ? (
                      <div className="truncate text-[10px] text-tertiary leading-tight">in {item.conversationTitle}</div>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="align-middle">
                    <span className="inline-block rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-secondary">
                      {itemSourceLabel(item)}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap align-middle text-[11px] text-tertiary">
                    {timeAgoShort(item.updatedAt)}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </AppPageLayout>
  );
}
