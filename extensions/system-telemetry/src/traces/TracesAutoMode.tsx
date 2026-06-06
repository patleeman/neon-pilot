/**
 * Auto Mode tracking display
 */

import { DashboardGrid, DashboardGridCell, PanelHeader, SectionLabel, SurfacePanel } from '@neon-pilot/extensions/ui';

export function TracesAutoMode({ data }: { data: AutoModeSummary | null }) {
  if (!data || data.recentEvents.length === 0) {
    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="Auto Mode" meta="No auto mode activity" metaClassName="bg-transparent px-0" />
        <div className="p-6 text-center text-[12px] text-dim">Auto mode state changes will appear here.</div>
      </SurfacePanel>
    );
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
            <QuickStat value={String(data.currentActive)} label="Currently Active" cls="text-accent" />
            <QuickStat value={String(data.enabledCount)} label="Times Enabled" cls="text-success" />
            <QuickStat value={String(data.disabledCount)} label="Times Stopped" cls="text-warning" />
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
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="text-[11px] text-secondary flex-1 truncate">{r.reason}</span>
                      <div className="w-16 h-1.5 bg-elevated rounded overflow-hidden">
                        <div className="h-full rounded bg-warning" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-dim w-4 text-right">{r.count}</span>
                    </div>
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
                <span className={`w-1.5 h-1.5 rounded-md shrink-0 ${e.enabled ? 'bg-success' : 'bg-dim'}`} />
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

function QuickStat({ value, label, cls }: { value: string; label: string; cls: string }) {
  return (
    <div className="flex-1 bg-elevated rounded-lg p-2.5 text-center">
      <div className={`text-[17px] font-semibold font-mono ${cls}`}>{value}</div>
      <SectionLabel tone="muted">{label}</SectionLabel>
    </div>
  );
}
