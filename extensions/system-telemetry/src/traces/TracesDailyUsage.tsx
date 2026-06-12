import type { TraceTokenDaily } from '@neon-pilot/extensions/data';

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function cacheMultiplier(row: TraceTokenDaily): number {
  const fresh = row.tokensInput + row.tokensOutput + row.tokensCachedWrite;
  return fresh > 0 ? row.tokensCached / fresh : 0;
}

export function TracesDailyUsage({ data }: { data: TraceTokenDaily[] }) {
  const rows = [...data]
    .sort((a, b) => b.cost - a.cost || b.date.localeCompare(a.date))
    .slice(0, 12);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-dim">
        No daily usage data yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface font-mono">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="font-sans text-sm font-semibold text-primary">Daily Usage</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px] tabular-nums">
          <thead className="border-b border-border-subtle text-accent">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Turn</th>
              <th className="px-3 py-2 font-semibold">Msgs</th>
              <th className="px-3 py-2 font-semibold">Input</th>
              <th className="px-3 py-2 font-semibold">Output</th>
              <th className="px-3 py-2 font-semibold">Cache R</th>
              <th className="px-3 py-2 font-semibold">Cache W</th>
              <th className="px-3 py-2 font-semibold">Cache×</th>
              <th className="px-3 py-2 font-semibold">Total</th>
              <th className="px-3 py-2 font-semibold">Cost ▼</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60 text-primary">
            {rows.map((row, index) => {
              const total = row.tokensInput + row.tokensOutput + row.tokensCached + row.tokensCachedWrite;
              return (
                <tr key={row.date} className={index === 0 ? 'bg-muted/60' : index % 2 === 0 ? 'bg-surface' : 'bg-muted/25'}>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.date}</td>
                  <td className="px-3 py-2">{row.turns ?? 0}</td>
                  <td className="px-3 py-2">{row.messages ?? 0}</td>
                  <td className="px-3 py-2 text-success">{formatCompact(row.tokensInput)}</td>
                  <td className="px-3 py-2 text-danger">{formatCompact(row.tokensOutput)}</td>
                  <td className="px-3 py-2 text-accent">{formatCompact(row.tokensCached)}</td>
                  <td className="px-3 py-2 text-warning">{formatCompact(row.tokensCachedWrite)}</td>
                  <td className="px-3 py-2 text-accent">{cacheMultiplier(row).toFixed(1)}x</td>
                  <td className="px-3 py-2">{formatCompact(total)}</td>
                  <td className="px-3 py-2 text-success">{formatCost(row.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
