import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

type Tab = 'assembly' | 'capabilities';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'assembly', label: 'Assembly' },
  { id: 'capabilities', label: 'Capabilities' },
];

type CapabilityFilter = 'all' | 'skills' | 'tools' | 'enabled' | 'disabled';
const CAPABILITY_FILTERS: Array<{ id: CapabilityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'skills', label: 'Skills' },
  { id: 'tools', label: 'Tools' },
  { id: 'enabled', label: 'Enabled / Active' },
  { id: 'disabled', label: 'Disabled / Inactive' },
];

interface InspectResult {
  plan: {
    diagnostics?: unknown[];
    skills?: { skillPaths?: string[] };
    tools?: { activeToolNames?: string[] };
    promptTemplates?: { templatePaths?: string[] };
    context?: { blocks?: unknown[] };
    instructions?: { layers?: unknown[] };
  };
  skills: Array<{
    id: string;
    title: string;
    description?: string;
    enabled: boolean;
    source?: { label?: string; kind?: string };
    diagnostics?: unknown[];
  }>;
  tools: Array<{
    id: string;
    name: string;
    description?: string;
    active: boolean;
    reason?: string;
    source?: { label?: string; kind?: string };
    diagnostics?: unknown[];
  }>;
  promptTemplates: Array<{ id: string; title: string; enabled: boolean; location?: { path?: string }; diagnostics?: unknown[] }>;
  instructions: Array<{
    id: string;
    title: string;
    content?: string;
    scope?: string;
    risk?: string;
    source?: { label?: string; kind?: string };
  }>;
}

interface Counts {
  instructions: number;
  templates: number;
  context: number;
}

export function PromptAssemblyPage({ pa, context }: ExtensionSurfaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('assembly');
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>('all');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await pa.extension.invoke('inspectPromptAssembly', { repoRoot: context.cwd ?? undefined });
      setData(result as InspectResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [context.cwd, pa]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSkill(id: string, enabled: boolean) {
    await pa.extension.invoke('updatePromptAssemblySkillEnabled', { id, enabled });
    const result = (await pa.extension.invoke('inspectPromptAssembly', { repoRoot: context.cwd ?? undefined })) as InspectResult;
    setData(result);
  }

  const counts = useMemo<Counts>(
    () => ({
      instructions: data?.instructions.length ?? 0,
      templates: data?.promptTemplates.length ?? 0,
      context: data?.plan.context?.blocks?.length ?? 0,
    }),
    [data],
  );

  const capabilityRows = useMemo(() => {
    if (!data) return { skills: [], tools: [] };
    const needle = query.trim().toLowerCase();
    const matches = (values: Array<string | undefined>) => !needle || values.some((value) => value?.toLowerCase().includes(needle));
    const includeSkills =
      capabilityFilter === 'all' || capabilityFilter === 'skills' || capabilityFilter === 'enabled' || capabilityFilter === 'disabled';
    const includeTools =
      capabilityFilter === 'all' || capabilityFilter === 'tools' || capabilityFilter === 'enabled' || capabilityFilter === 'disabled';
    return {
      skills: includeSkills
        ? data.skills.filter((skill) => {
            if (capabilityFilter === 'enabled' && !skill.enabled) return false;
            if (capabilityFilter === 'disabled' && skill.enabled) return false;
            return matches([skill.title, skill.id, skill.description, skill.source?.label, skill.source?.kind]);
          })
        : [],
      tools: includeTools
        ? data.tools.filter((tool) => {
            if (capabilityFilter === 'enabled' && !tool.active) return false;
            if (capabilityFilter === 'disabled' && tool.active) return false;
            return matches([tool.name, tool.id, tool.description, tool.reason, tool.source?.label, tool.source?.kind]);
          })
        : [],
    };
  }, [capabilityFilter, data, query]);

  if (error) return <ErrorState title="Failed to inspect prompt assembly" message={error} />;
  if (!data) return <LoadingState label="Inspecting prompt assembly…" />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro
        title="Prompt Assembly"
        summary="Inspect the instruction layers, skills, tools, templates, context, and diagnostics that shape each agent run."
        actions={<ToolbarButton onClick={() => void load()}>Refresh</ToolbarButton>}
      />
      <div className="flex flex-wrap gap-1 border-b border-border-subtle/70 pb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cx(
              'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              activeTab === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'assembly' ? <AssemblyTab data={data} counts={counts} /> : null}
      {activeTab === 'capabilities' ? (
        <CapabilitiesTab
          capabilityFilter={capabilityFilter}
          capabilityRows={capabilityRows}
          query={query}
          setCapabilityFilter={setCapabilityFilter}
          setQuery={setQuery}
          toggleSkill={toggleSkill}
        />
      ) : null}
    </AppPageLayout>
  );
}

function AssemblyTab({ data, counts }: { data: InspectResult; counts: Counts }) {
  const contextBlocks = data.plan.context?.blocks ?? [];
  const diagnostics = data.plan.diagnostics ?? [];
  return (
    <div className="space-y-8">
      <Summary data={data} />

      <section className="space-y-4">
        <SectionHeader
          title="Prompt Layers"
          eyebrow="Assembly"
          summary={`${formatCount(counts.instructions, 'instruction layer')}, ${formatCount(counts.templates, 'template')}, ${formatCount(
            counts.context,
            'context block',
          )}`}
        />
        {data.instructions.length ? (
          <Rows
            rows={data.instructions}
            titleKey="title"
            meta={(row) => formatParts(row.scope, row.risk, row.source?.kind, row.source?.label)}
          />
        ) : (
          <InlineEmpty title="No instruction layers" body="No instruction providers contributed content for this run." />
        )}
      </section>

      {data.promptTemplates.length ? (
        <section className="space-y-4 border-t border-border-subtle/70 pt-6">
          <SectionHeader
            title="Templates"
            eyebrow="Optional Prompt Inputs"
            summary={formatCount(data.promptTemplates.length, 'template')}
          />
          <Rows
            rows={data.promptTemplates}
            titleKey="title"
            meta={(row) => formatParts(row.enabled ? 'Enabled' : 'Disabled', row.location?.path)}
          />
        </section>
      ) : null}

      {contextBlocks.length ? (
        <section className="space-y-4 border-t border-border-subtle/70 pt-6">
          <SectionHeader title="Context" eyebrow="Runtime Blocks" summary={formatCount(contextBlocks.length, 'context block')} />
          <JsonPanel value={contextBlocks} />
        </section>
      ) : null}

      <section className="space-y-4 border-t border-border-subtle/70 pt-6">
        <SectionHeader
          title="Diagnostics"
          eyebrow="Health"
          summary={diagnostics.length ? formatCount(diagnostics.length, 'issue') : 'No issues'}
        />
        {diagnostics.length ? (
          <JsonPanel value={diagnostics} />
        ) : (
          <InlineEmpty title="No diagnostics" body="Prompt assembly completed without provider, hook, or validation issues." />
        )}
      </section>
    </div>
  );
}

function CapabilitiesTab({
  capabilityFilter,
  capabilityRows,
  query,
  setCapabilityFilter,
  setQuery,
  toggleSkill,
}: {
  capabilityFilter: CapabilityFilter;
  capabilityRows: { skills: InspectResult['skills']; tools: InspectResult['tools'] };
  query: string;
  setCapabilityFilter: (filter: CapabilityFilter) => void;
  setQuery: (query: string) => void;
  toggleSkill: (id: string, enabled: boolean) => Promise<void>;
}) {
  const hasMatches = capabilityRows.skills.length > 0 || capabilityRows.tools.length > 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface/40 p-1">
          {CAPABILITY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={cx(
                'rounded-lg px-3 py-1.5 text-[12px] transition-colors',
                capabilityFilter === filter.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
              )}
              onClick={() => setCapabilityFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search capabilities…"
          className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
        />
      </div>

      {!hasMatches ? <EmptyState title="No matching capabilities" body="Adjust the filter or search query." /> : null}

      {capabilityRows.skills.length ? (
        <section className="space-y-4">
          <SectionHeader title="Skills" eyebrow="Capabilities" summary={formatCount(capabilityRows.skills.length, 'skill')} />
          <Rows
            rows={capabilityRows.skills}
            titleKey="title"
            meta={(row) => formatParts(row.enabled ? 'Enabled' : 'Disabled', row.source?.kind, row.source?.label)}
            action={(row) => (
              <button
                type="button"
                className="rounded-full border border-subtle px-3 py-1 text-[12px] text-secondary transition-colors hover:text-primary focus:border-accent/50 focus:outline-none"
                onClick={() => void toggleSkill(String(row.id), !row.enabled)}
              >
                {row.enabled ? 'Disable' : 'Enable'}
              </button>
            )}
          />
        </section>
      ) : null}

      {capabilityRows.tools.length ? (
        <section className="space-y-4 border-t border-border-subtle/70 pt-6">
          <SectionHeader title="Tools" eyebrow="Capabilities" summary={formatCount(capabilityRows.tools.length, 'tool')} />
          <Rows
            rows={capabilityRows.tools}
            titleKey="name"
            meta={(row) => formatParts(row.active ? 'Active' : 'Inactive', row.reason, row.source?.kind, row.source?.label)}
          />
        </section>
      ) : null}
    </div>
  );
}

function Summary({ data }: { data: InspectResult }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="Instruction layers" value={data.instructions?.length ?? data.plan.instructions?.layers?.length ?? 0} />
      <Stat label="Skill paths" value={data.plan.skills?.skillPaths?.length ?? 0} />
      <Stat label="Active tools" value={data.plan.tools?.activeToolNames?.length ?? 0} />
      <Stat label="Templates" value={data.plan.promptTemplates?.templatePaths?.length ?? 0} />
      <Stat label="Diagnostics" value={data.plan.diagnostics?.length ?? 0} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface/30 p-4">
      <div className="text-[24px] font-semibold tracking-[-0.03em] text-primary">{value}</div>
      <div className="mt-1 text-[12px] text-secondary">{label}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, summary }: { eyebrow: string; title: string; summary: string }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">{eyebrow}</div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-primary">{title}</h2>
        <div className="text-[12px] text-secondary">{summary}</div>
      </div>
    </div>
  );
}

function InlineEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-surface/30 p-4">
      <div className="text-[13px] font-semibold text-primary">{title}</div>
      <div className="mt-1 text-[12px] leading-5 text-secondary">{body}</div>
    </div>
  );
}

function Rows<T extends Record<string, unknown>>({
  rows,
  titleKey,
  meta,
  action,
}: {
  rows: T[];
  titleKey: keyof T;
  meta: (row: T) => string;
  action?: (row: T) => ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Details</th>
            {action ? <th className="py-2 pl-3 text-right font-semibold">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-t border-border-subtle/60 align-top">
              <td className="py-3 pr-4">
                <div className="font-semibold text-primary">{String(row[titleKey] ?? row.id)}</div>
                {typeof row.id === 'string' ? <div className="mt-0.5 font-mono text-[11px] text-dim">{row.id}</div> : null}
              </td>
              <td className="px-3 py-3">
                <div className="text-[12px] leading-5 text-secondary">{meta(row)}</div>
                {typeof row.description === 'string' ? (
                  <div className="mt-1 max-w-[44rem] text-[12px] leading-5 text-dim">{row.description}</div>
                ) : null}
              </td>
              {action ? <td className="py-3 pl-3 text-right">{action(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-xl bg-surface/30 p-4 font-mono text-[12px] text-secondary">{JSON.stringify(value, null, 2)}</pre>
  );
}

function formatParts(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

function formatCount(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? '' : 's'}`;
}
