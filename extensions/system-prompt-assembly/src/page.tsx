import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, cx, ErrorState, LoadingState, ToolbarButton } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type Tab = 'summary' | 'instructions' | 'skills' | 'tools' | 'templates' | 'context' | 'diagnostics';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'skills', label: 'Skills' },
  { id: 'tools', label: 'Tools' },
  { id: 'templates', label: 'Templates' },
  { id: 'context', label: 'Context' },
  { id: 'diagnostics', label: 'Diagnostics' },
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

export function PromptAssemblyPage({ pa }: ExtensionSurfaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [data, setData] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    let cancelled = false;
    pa.extension
      .invoke('inspectPromptAssembly', {})
      .then((result) => {
        if (!cancelled) setData(result as InspectResult);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => load(), [pa]);

  async function toggleSkill(id: string, enabled: boolean) {
    await pa.extension.invoke('updatePromptAssemblySkillEnabled', { id, enabled });
    const result = (await pa.extension.invoke('inspectPromptAssembly', {})) as InspectResult;
    setData(result);
  }

  const counts = useMemo(
    () => ({
      summary: 0,
      instructions: data?.instructions.length ?? 0,
      skills: data?.skills.length ?? 0,
      tools: data?.tools.length ?? 0,
      templates: data?.promptTemplates.length ?? 0,
      context: data?.plan.context?.blocks?.length ?? 0,
      diagnostics: data?.plan.diagnostics?.length ?? 0,
    }),
    [data],
  );

  if (error) return <ErrorState title="Failed to inspect prompt assembly" message={error} />;
  if (!data) return <LoadingState label="Inspecting prompt assembly…" />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro
        title="Prompt Assembly"
        summary="Inspect the instruction layers, skills, tools, templates, context, and diagnostics that shape each agent run."
        actions={<ToolbarButton onClick={load}>Refresh</ToolbarButton>}
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
            {tab.label} {tab.id === 'summary' ? null : <span className="ml-1 text-dim">{counts[tab.id]}</span>}
          </button>
        ))}
      </div>
      {activeTab === 'summary' ? <Summary data={data} /> : null}
      {activeTab === 'instructions' ? (
        <Rows
          rows={data.instructions}
          titleKey="title"
          meta={(row) => `${row.scope ?? ''} · ${row.risk ?? ''} · ${row.source?.kind ?? ''} · ${row.source?.label ?? ''}`}
        />
      ) : null}
      {activeTab === 'skills' ? (
        <Rows
          rows={data.skills}
          titleKey="title"
          meta={(row) => `${row.enabled ? 'Enabled' : 'Disabled'} · ${row.source?.kind ?? ''} · ${row.source?.label ?? ''}`}
          action={(row) => (
            <button
              className="rounded-full border border-subtle px-3 py-1 text-[12px]"
              onClick={() => void toggleSkill(String(row.id), !row.enabled)}
            >
              {row.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
        />
      ) : null}
      {activeTab === 'tools' ? (
        <Rows rows={data.tools} titleKey="name" meta={(row) => `${row.active ? 'Active' : 'Inactive'} · ${row.reason ?? ''}`} />
      ) : null}
      {activeTab === 'templates' ? (
        <Rows
          rows={data.promptTemplates}
          titleKey="title"
          meta={(row) => `${row.enabled ? 'Enabled' : 'Disabled'} · ${row.location?.path ?? ''}`}
        />
      ) : null}
      {activeTab === 'context' ? <JsonPanel value={data.plan.context?.blocks ?? []} /> : null}
      {activeTab === 'diagnostics' ? <JsonPanel value={data.plan.diagnostics ?? []} /> : null}
    </AppPageLayout>
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

function Rows<T extends Record<string, unknown>>({
  rows,
  titleKey,
  meta,
  action,
}: {
  rows: T[];
  titleKey: keyof T;
  meta: (row: T) => string;
  action?: (row: T) => React.ReactNode;
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
