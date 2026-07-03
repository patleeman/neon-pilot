/**
 * Auto Mode tracking display
 */

import type { AutoModeSummary } from '@neon-pilot/extensions/data';
import {
  DashboardGrid,
  DashboardGridCell,
  MetricTile,
  PanelHeader,
  PanelMessage,
  ProgressRow,
  SectionLabel,
  StatusDot,
  SurfacePanel,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedKeyValueGrid,
} from '@neon-pilot/extensions/ui';
import React from 'react';

export function TracesAutoMode({ data, presentation = 'stable' }: { data: AutoModeSummary | null; presentation?: 'stable' | 'windowed' }) {
  if (!data || data.recentEvents.length === 0) {
    if (presentation === 'windowed') {
      return <WindowedEmptyState>Auto mode state changes will appear after runs toggle automation.</WindowedEmptyState>;
    }

    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Auto Mode" meta="No auto mode activity" metaClassName="bg-transparent px-0" />
        <PanelMessage align="center" className="p-6">
          Auto mode state changes will appear here.
        </PanelMessage>
      </SurfacePanel>
    );
  }

  if (presentation === 'windowed') {
    return <WindowedAutoMode data={data} />;
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader title="Auto Mode" meta={`${data.currentActive} active · ${data.enabledCount} enabled · ${data.disabledCount} stopped`} />
      <DashboardGrid columns={2}>
        {/* Cell 1: Summary stats */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Activity
          </SectionLabel>
          <div className="flex gap-2 mb-4">
            <MetricTile className="flex-1" value={String(data.currentActive)} label="Currently Active" tone="accent" />
            <MetricTile className="flex-1" value={String(data.enabledCount)} label="Times Enabled" tone="success" />
            <MetricTile className="flex-1" value={String(data.disabledCount)} label="Times Stopped" tone="warning" />
          </div>
          {data.topStopReasons.length > 0 && (
            <div className="pt-3 border-t border-border-subtle">
              <SectionLabel tone="muted" className="mb-2 block">
                Top Stop Reasons
              </SectionLabel>
              <div className="space-y-1">
                {data.topStopReasons.map((r, i) => {
                  const maxCount = data.topStopReasons[0]?.count ?? 1;
                  return (
                    <ProgressRow
                      key={i}
                      label={r.reason}
                      value={r.count}
                      progressValue={(r.count / maxCount) * 100}
                      tone="warning"
                      labelWidth="minmax(0, 1fr)"
                      progressWidth="4rem"
                      valueWidth="1rem"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </DashboardGridCell>

        {/* Cell 2: Recent events log */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Recent Events
          </SectionLabel>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {data.recentEvents.slice(0, 15).map((e, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-[11px] border-b border-border-subtle/20 last:border-0">
                <StatusDot tone={e.enabled ? 'success' : 'muted'} size="xs" className="shrink-0" />
                <span className="font-mono text-[10px] text-dim w-[40px] shrink-0">{e.ts.slice(11, 16)}</span>
                <span className={e.enabled ? 'text-success font-medium' : 'text-secondary'}>{e.enabled ? 'Enabled' : 'Stopped'}</span>
                {!e.enabled && e.stopReason && <span className="text-dim truncate ml-auto">{e.stopReason}</span>}
              </div>
            ))}
          </div>
        </DashboardGridCell>
      </DashboardGrid>
    </SurfacePanel>
  );
}

function WindowedAutoMode({ data }: { data: AutoModeSummary }) {
  return (
    <div className="wos-auto-mode">
      <WindowedKeyValueGrid
        className="wos-auto-mode__summary"
        columns={3}
        items={[
          {
            label: 'Active',
            value: <WindowedBadge tone={data.currentActive > 0 ? 'warning' : 'neutral'}>{data.currentActive}</WindowedBadge>,
          },
          { label: 'Enabled', value: data.enabledCount },
          {
            label: 'Stopped',
            value: <WindowedBadge tone={data.disabledCount > 0 ? 'warning' : 'positive'}>{data.disabledCount}</WindowedBadge>,
          },
        ]}
      />
      <div className="wos-auto-mode__grid">
        <WindowedDataTable
          className="wos-auto-mode__stops"
          columns={[{ label: 'Stop reason' }, { label: 'Count', align: 'right' }]}
          columnTemplate="minmax(10rem, 1fr) minmax(4rem, 0.32fr)"
        >
          {data.topStopReasons.length > 0 ? (
            data.topStopReasons
              .slice(0, 8)
              .map((reason) => (
                <WindowedDataRow
                  key={reason.reason}
                  name={reason.reason}
                  meta="Stop reason"
                  cells={[{ value: <WindowedBadge tone="warning">{reason.count}</WindowedBadge>, align: 'right' }]}
                />
              ))
          ) : (
            <WindowedDataRow
              name="None recorded"
              meta="Stop reason"
              cells={[{ value: <WindowedBadge tone="neutral">0</WindowedBadge>, align: 'right' }]}
            />
          )}
        </WindowedDataTable>
        <WindowedDataTable
          className="wos-auto-mode__events"
          columns={[{ label: 'Time' }, { label: 'State' }, { label: 'Reason' }]}
          columnTemplate="minmax(5rem, 0.4fr) minmax(7rem, 0.5fr) minmax(9rem, 1fr)"
        >
          {data.recentEvents.slice(0, 15).map((event, index) => (
            <WindowedDataRow
              key={`${event.ts}-${event.sessionId}-${index}`}
              name={event.ts.slice(11, 16)}
              meta={event.sessionId}
              cells={[
                {
                  value: (
                    <WindowedBadge tone={event.enabled ? 'positive' : 'neutral'}>{event.enabled ? 'Enabled' : 'Stopped'}</WindowedBadge>
                  ),
                },
                {
                  value: <span className="wos-auto-mode__reason">{event.stopReason ?? 'Running'}</span>,
                },
              ]}
            />
          ))}
        </WindowedDataTable>
      </div>
    </div>
  );
}
