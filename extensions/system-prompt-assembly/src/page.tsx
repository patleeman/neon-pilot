import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, cx, ErrorState, LoadingState } from '@personal-agent/extensions/ui';
import { useEffect, useMemo, useState } from 'react';

type Tab = 'summary' | 'skills' | 'tools' | 'templates' | 'context' | 'diagnostics';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
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
}

export function PromptAssemblyPage({ pa }: ExtensionSurfaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [data, setData] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [pa]);

  const counts = useMemo(
    () => ({
      summary: 0,
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
    <AppPageLayout>
      <AppPageIntro
        title="Prompt Assembly"
        description="Single inspection surface for skills, tools, prompt templates, context, and diagnostics."
      />
      <div className="flex gap-5 border-b border-subtle text-[12px]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cx(
              'border-b-2 px-1 pb-2 pt-1',
              activeTab === tab.id ? 'border-accent text-primary' : 'border-transparent text-secondary',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} {tab.id === 'summary' ? null : <span className="text-dim">{counts[tab.id]}</span>}
          </button>
        ))}
      </div>
      {activeTab === 'summary' ? <Summary data={data} /> : null}
      {activeTab === 'skills' ? (
        <Rows
          rows={data.skills}
          titleKey="title"
          meta={(row) => `${row.enabled ? 'Enabled' : 'Disabled'} · ${row.source?.kind ?? ''} · ${row.source?.label ?? ''}`}
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
      {activeTab === 'context' ? (
        <pre className="overflow-auto rounded-md bg-muted p-3 text-[12px]">{JSON.stringify(data.plan.context?.blocks ?? [], null, 2)}</pre>
      ) : null}
      {activeTab === 'diagnostics' ? (
        <pre className="overflow-auto rounded-md bg-muted p-3 text-[12px]">{JSON.stringify(data.plan.diagnostics ?? [], null, 2)}</pre>
      ) : null}
    </AppPageLayout>
  );
}

function Summary({ data }: { data: InspectResult }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Stat label="Skill paths" value={data.plan.skills?.skillPaths?.length ?? 0} />
      <Stat label="Active tools" value={data.plan.tools?.activeToolNames?.length ?? 0} />
      <Stat label="Templates" value={data.plan.promptTemplates?.templatePaths?.length ?? 0} />
      <Stat label="Diagnostics" value={data.plan.diagnostics?.length ?? 0} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-y border-subtle py-3">
      <div className="text-[20px] font-semibold">{value}</div>
      <div className="text-[12px] text-secondary">{label}</div>
    </div>
  );
}

function Rows<T extends Record<string, unknown>>({ rows, titleKey, meta }: { rows: T[]; titleKey: keyof T; meta: (row: T) => string }) {
  return (
    <div className="divide-y divide-subtle border-y border-subtle">
      {rows.map((row, index) => (
        <div key={String(row.id ?? index)} className="py-3">
          <div className="text-[13px] font-semibold">{String(row[titleKey] ?? row.id)}</div>
          <div className="text-[12px] text-secondary">{meta(row)}</div>
          {typeof row.description === 'string' ? <div className="mt-1 text-[12px] text-dim">{row.description}</div> : null}
        </div>
      ))}
    </div>
  );
}
