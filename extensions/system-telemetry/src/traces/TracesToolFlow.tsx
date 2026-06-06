/**
 * Tool Flow — Trajectories, transitions, co-occurrence, and failure patterns
 */

import type { ToolFlowResult } from '@neon-pilot/extensions/data';
import { DashboardGrid, DashboardGridCell, PanelHeader, ProgressBar, SectionLabel, SurfacePanel } from '@neon-pilot/extensions/ui';

export function TracesToolFlow({ data }: { data: ToolFlowResult | null }) {
  if (!data || (data.transitions.length === 0 && data.coOccurrences.length === 0)) {
    return (
      <SurfacePanel className="overflow-hidden">
        <PanelHeader title="🔀 Tool Flow & Trajectories" meta="No tool sequences yet" metaClassName="bg-transparent px-0" />
        <div className="p-6 text-center text-[12px] text-dim">Appears after multiple tool calls are recorded.</div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel className="overflow-hidden">
      <PanelHeader
        title="🔀 Tool Flow & Trajectories"
        meta={`${data.transitions.length} transitions · ${data.coOccurrences.length} co-occurrences`}
      />
      <DashboardGrid columns={2}>
        {/* Cell 1: Top transitions — Sankey-like flow */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Top Tool Transitions
          </SectionLabel>
          <div className="space-y-1">
            {data.transitions.slice(0, 10).map((t, i) => {
              const maxCount = data.transitions[0]?.count ?? 1;
              const pct = (t.count / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="text-[11px] text-secondary w-[90px] text-right font-mono truncate" title={t.fromTool}>
                    {t.fromTool}
                  </span>
                  <span className="text-dim text-[10px]">→</span>
                  <span className="text-[11px] text-primary w-[90px] font-mono truncate" title={t.toTool}>
                    {t.toTool}
                  </span>
                  <ProgressBar value={pct} className="h-2 flex-1" label={`${t.fromTool} to ${t.toTool}`} />
                  <span className="text-[10px] font-mono text-dim w-[30px] text-right">{t.count}</span>
                </div>
              );
            })}
          </div>
        </DashboardGridCell>

        {/* Cell 2: Co-occurrence grid */}
        <DashboardGridCell>
          <SectionLabel tone="muted" className="mb-3 block">
            Top Tool Pairs
          </SectionLabel>
          <div className="space-y-1">
            {data.coOccurrences.slice(0, 10).map((c, i) => {
              const maxCount = data.coOccurrences[0]?.sessions ?? 1;
              const pct = (c.sessions / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="text-[11px] text-secondary w-[55px] text-right font-mono truncate">{c.toolA}</span>
                  <span className="text-dim text-[9px]">+</span>
                  <span className="text-[11px] text-primary w-[55px] font-mono truncate">{c.toolB}</span>
                  <ProgressBar value={pct} tone="success" className="h-2 flex-1" label={`${c.toolA} and ${c.toolB}`} />
                  <span className="text-[10px] font-mono text-dim w-[24px] text-right">{c.sessions}</span>
                </div>
              );
            })}
          </div>
        </DashboardGridCell>

        {/* Cell 3: Failure trajectories */}
        <DashboardGridCell span={2}>
          <SectionLabel tone="muted" className="mb-3 block">
            Failure Trajectories (last 3 calls before error)
          </SectionLabel>
          {data.failureTrajectories.length > 0 ? (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {data.failureTrajectories.slice(0, 15).map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[11px] border-b border-border-subtle/20 last:border-0">
                  <span className="text-dim font-mono w-[40px] shrink-0 text-[10px]">{f.ts.slice(11, 16)}</span>
                  <span className="flex items-center gap-1 text-secondary min-w-0">
                    {f.previousCalls.length > 0 ? (
                      f.previousCalls.map((pc, j) => (
                        <span key={j}>
                          <span className="font-mono text-dim">{pc}</span>
                          {j < f.previousCalls.length - 1 && <span className="text-dim mx-0.5">→</span>}
                        </span>
                      ))
                    ) : (
                      <span className="text-dim italic">(first call)</span>
                    )}
                    <span className="text-danger mx-1.5 font-bold">✕</span>
                    <span className="font-mono text-danger">{f.toolName}</span>
                  </span>
                  <span className="flex-1 min-w-0 truncate text-dim ml-1" title={f.errorMessage}>
                    {f.errorMessage}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim py-3 text-center">No tool errors recorded yet.</div>
          )}
        </DashboardGridCell>
      </DashboardGrid>
    </SurfacePanel>
  );
}
