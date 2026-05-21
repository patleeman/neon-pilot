import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';
type Filter = 'all' | CapabilityKind | 'active' | 'disabled' | 'issues';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'extension', label: 'Extensions' },
  { id: 'instruction', label: 'Instructions' },
  { id: 'skill', label: 'Skills' },
  { id: 'tool', label: 'Tools' },
  { id: 'mcp-server', label: 'MCP' },
  { id: 'active', label: 'Active' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'issues', label: 'Issues' },
];

interface RuntimeCapability {
  id: string;
  kind: CapabilityKind;
  title: string;
  description?: string;
  ownerExtensionId?: string;
  source?: { kind?: string; label?: string; extensionId?: string; root?: string };
  scope?: string;
  enabled: boolean;
  status: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  diagnostics?: unknown[];
}

interface AgentRuntimeResult {
  repoRoot: string;
  profile: string;
  capabilities: RuntimeCapability[];
  counts: Record<string, number>;
  diagnostics?: unknown[];
}

export function PromptAssemblyPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<AgentRuntimeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await pa.extension.invoke('inspectAgentRuntime', { repoRoot: context.cwd ?? undefined });
      setData(result as AgentRuntimeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [context.cwd, pa]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSkill(id: string, enabled: boolean) {
    await pa.extension.invoke('updatePromptAssemblySkillEnabled', { id, enabled });
    await load();
  }

  const visible = useMemo(() => {
    const capabilities = data?.capabilities ?? [];
    const needle = query.trim().toLowerCase();
    return capabilities.filter((capability) => {
      if (filter !== 'all') {
        if (filter === 'active' && capability.status !== 'active' && capability.status !== 'enabled') return false;
        else if (filter === 'disabled' && capability.enabled) return false;
        else if (
          filter === 'issues' &&
          !(capability.diagnostics?.length || capability.status === 'invalid' || capability.status === 'error')
        )
          return false;
        else if (!['active', 'disabled', 'issues'].includes(filter) && capability.kind !== filter) return false;
      }
      if (!needle) return true;
      return [
        capability.title,
        capability.id,
        capability.description,
        capability.ownerExtensionId,
        capability.source?.label,
        capability.scope,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data?.capabilities, filter, query]);

  if (error) return <ErrorState title="Failed to inspect agent runtime" message={error} />;
  if (!data) return <LoadingState label="Inspecting agent runtime…" />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro
        title="Agent Runtime"
        summary="Inspect every capability the agent can see: extensions, instruction files, skills, injected tools, MCP servers, templates, and context."
        actions={<ToolbarButton onClick={() => void load()}>Refresh</ToolbarButton>}
      />

      <Overview counts={data.counts} diagnostics={data.diagnostics ?? []} repoRoot={data.repoRoot} profile={data.profile} />

      <section className="space-y-4 border-t border-border-subtle/70 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-primary">Capabilities</h2>
            <p className="text-[13px] leading-6 text-secondary">{formatCount(visible.length, 'capability')} shown</p>
          </div>
          <input
            className="min-w-[240px] rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search runtime…"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                filter === item.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {visible.length ? (
          <CapabilityRows rows={visible} toggleSkill={toggleSkill} />
        ) : (
          <EmptyState title="No capabilities found" body="Adjust the filter or search query." />
        )}
      </section>
    </AppPageLayout>
  );
}

function Overview({
  counts,
  diagnostics,
  repoRoot,
  profile,
}: {
  counts: Record<string, number>;
  diagnostics: unknown[];
  repoRoot: string;
  profile: string;
}) {
  const stats = [
    ['Extensions', counts.extension ?? 0],
    ['Instructions', counts.instruction ?? 0],
    ['Skills', counts.skill ?? 0],
    ['Tools', counts.tool ?? 0],
    ['MCP', counts['mcp-server'] ?? 0],
    ['Issues', diagnostics.length],
  ];
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="border-t border-border-subtle pt-3">
            <div className="text-[22px] font-semibold tracking-tight text-primary">{value}</div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-dim">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-dim">
        Profile <span className="text-secondary">{profile}</span> · CWD <span className="text-secondary">{repoRoot}</span>
      </p>
    </section>
  );
}

function CapabilityRows({
  rows,
  toggleSkill,
}: {
  rows: RuntimeCapability[];
  toggleSkill: (id: string, enabled: boolean) => Promise<void>;
}) {
  return (
    <div className="divide-y divide-border-subtle/70">
      {rows.map((row) => (
        <div key={`${row.kind}:${row.id}`} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_170px_120px] lg:items-start">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-[14px] font-medium text-primary">{row.title}</h3>
              <span className="text-[12px] text-dim">{labelForKind(row.kind)}</span>
            </div>
            {row.description ? <p className="text-[13px] leading-6 text-secondary">{row.description}</p> : null}
            <p className="break-all text-[12px] leading-5 text-dim">
              {formatParts(row.id, row.ownerExtensionId, row.scope, row.source?.label)}
            </p>
            {row.diagnostics?.length ? (
              <pre className="mt-2 overflow-auto rounded-lg bg-surface p-3 text-[11px] leading-5 text-secondary">
                {JSON.stringify(row.diagnostics, null, 2)}
              </pre>
            ) : null}
          </div>
          <div className="text-[12px] leading-5 text-secondary">{formatMetadata(row.metadata)}</div>
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <span
              className={cx(
                'text-[12px]',
                row.status === 'active' || row.status === 'enabled'
                  ? 'text-success'
                  : row.status === 'invalid' || row.status === 'error'
                    ? 'text-danger'
                    : 'text-dim',
              )}
            >
              {row.status}
            </span>
            {row.kind === 'skill' ? (
              <button
                className="rounded-lg border border-border-subtle px-2 py-1 text-[12px] text-secondary hover:text-primary"
                type="button"
                onClick={() => void toggleSkill(row.id, !row.enabled)}
              >
                {row.enabled ? 'Disable' : 'Enable'}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelForKind(kind: CapabilityKind): string {
  return kind.replace('-', ' ');
}

function formatCount(count: number, singular: string): string {
  const plural = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`;
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatParts(...parts: Array<unknown>): string {
  return parts.filter(Boolean).join(' · ');
}

function formatMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return '';
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length),
  );
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join('\n');
}
