import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { api, useApi } from '@neon-pilot/extensions/settings';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';
type Filter = 'all' | CapabilityKind | 'active' | 'disabled' | 'issues';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
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
  cwd?: string;
  runtimeScope?: string;
  capabilities: RuntimeCapability[];
  counts: Record<string, number>;
  diagnostics?: unknown[];
}

interface SystemPromptTemplateState {
  configFile: string;
  template: string;
}

export function PromptAssemblyPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<AgentRuntimeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    data: systemPromptTemplateState,
    loading: systemPromptTemplateLoading,
    error: systemPromptTemplateError,
  } = useApi(api.systemPromptTemplate) as {
    data: SystemPromptTemplateState | null;
    loading: boolean;
    error: string | null;
  };
  const [systemPromptTemplateDraft, setSystemPromptTemplateDraft] = useState('');
  const [savingSystemPromptTemplate, setSavingSystemPromptTemplate] = useState(false);
  const [systemPromptTemplateSaveError, setSystemPromptTemplateSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await pa.extension.invoke('inspectAgentRuntime', { cwd: context.cwd ?? undefined });
      setData(result as AgentRuntimeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [context.cwd, pa]);

  useEffect(() => {
    void load();
  }, [load]);

  const systemPromptTemplateDirty = systemPromptTemplateState ? systemPromptTemplateDraft !== systemPromptTemplateState.template : false;

  useEffect(() => {
    if (systemPromptTemplateState) {
      setSystemPromptTemplateDraft(systemPromptTemplateState.template);
    }
  }, [systemPromptTemplateState?.configFile, systemPromptTemplateState?.template]);

  const handleSaveSystemPromptTemplate = useCallback(async () => {
    if (!systemPromptTemplateState || savingSystemPromptTemplate || !systemPromptTemplateDirty) {
      return;
    }

    setSystemPromptTemplateSaveError(null);
    setSavingSystemPromptTemplate(true);

    try {
      const saved = (await api.updateSystemPromptTemplate(systemPromptTemplateDraft)) as SystemPromptTemplateState;
      setSystemPromptTemplateDraft(saved.template);
    } catch (err) {
      setSystemPromptTemplateSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSystemPromptTemplate(false);
    }
  }, [savingSystemPromptTemplate, systemPromptTemplateDirty, systemPromptTemplateDraft, systemPromptTemplateState]);

  useEffect(() => {
    if (!systemPromptTemplateState || !systemPromptTemplateDirty || savingSystemPromptTemplate) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void handleSaveSystemPromptTemplate();
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [handleSaveSystemPromptTemplate, savingSystemPromptTemplate, systemPromptTemplateDirty, systemPromptTemplateState]);

  async function toggleCapability(row: RuntimeCapability, enabled: boolean) {
    setBusyId(row.id);
    setError(null);
    try {
      await pa.extension.invoke('updateRuntimeCapability', { id: row.id, kind: row.kind, enabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
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

  const visibleAgentCapabilities = useMemo(() => visible.filter((capability) => capability.kind !== 'extension'), [visible]);

  if (error) return <ErrorState title="Failed to load Agent Runtime" message={error} />;
  if (!data) return <LoadingState label="Loading Agent Runtime…" className="h-full justify-center" />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro
        title="Agent Runtime"
        summary="Inspect every capability the agent can see: extensions, instruction files, skills, injected tools, MCP servers, templates, and context."
        actions={<ToolbarButton onClick={() => void load()}>Refresh</ToolbarButton>}
      />

      <section className="space-y-3 border-t border-border-subtle/70 pt-6">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-primary">System prompt template</h2>
          <p className="text-[13px] leading-6 text-secondary">
            Customize the generated runtime instruction template. Nunjucks variables such as vault_root and skills_dir are available.
          </p>
        </div>
        {systemPromptTemplateLoading && !systemPromptTemplateState ? (
          <p className="text-[13px] text-secondary">Loading system prompt template...</p>
        ) : systemPromptTemplateError && !systemPromptTemplateState ? (
          <p className="text-[13px] text-danger">Failed to load system prompt template: {systemPromptTemplateError}</p>
        ) : systemPromptTemplateState ? (
          <div className="space-y-3">
            <p className="break-all text-[12px] text-dim">
              Configured in <span className="font-mono text-[11px]">{systemPromptTemplateState.configFile}</span>.
            </p>
            <textarea
              id="agent-runtime-system-prompt-template"
              value={systemPromptTemplateDraft}
              onChange={(event) => {
                setSystemPromptTemplateDraft(event.target.value);
                if (systemPromptTemplateSaveError) {
                  setSystemPromptTemplateSaveError(null);
                }
              }}
              className="min-h-[340px] w-full resize-y rounded-md border border-border-subtle bg-elevated px-3 py-2 font-mono text-[12px] leading-5 text-primary shadow-none transition-colors focus:border-accent/50 focus:bg-surface focus:outline-none disabled:opacity-50"
              spellCheck={false}
              disabled={savingSystemPromptTemplate}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-dim">
                {savingSystemPromptTemplate ? 'Saving...' : systemPromptTemplateDirty ? 'Auto-save pending...' : 'Auto-saved'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSystemPromptTemplateDraft(systemPromptTemplateState.template);
                  setSystemPromptTemplateSaveError(null);
                }}
                disabled={savingSystemPromptTemplate || !systemPromptTemplateDirty}
                className="ui-toolbar-button rounded-md px-3 py-1.5 text-[12px] shadow-none"
              >
                Revert edits
              </button>
            </div>
          </div>
        ) : null}
        {systemPromptTemplateSaveError ? <p className="text-[12px] text-danger">{systemPromptTemplateSaveError}</p> : null}
      </section>

      <section className="space-y-4 border-t border-border-subtle/70 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-primary">Agent context</h2>
            <p className="text-[13px] leading-6 text-secondary">
              {formatCount(visibleAgentCapabilities.length, 'capability')} shown: instructions, skills, tools, MCP, templates, and context.
              <span className="block text-[12px] text-dim">CWD {data.cwd ?? data.repoRoot}</span>
            </p>
          </div>
          <input
            className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agent context…"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface/40 p-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                'rounded-lg px-3 py-1.5 text-[12px] transition-colors',
                filter === item.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {visibleAgentCapabilities.length ? (
          <CapabilityTable rows={visibleAgentCapabilities} busyId={busyId} onToggle={toggleCapability} />
        ) : (
          <EmptyState title="No agent context found" body="Adjust the filter or search query." />
        )}
      </section>
    </AppPageLayout>
  );
}

function CapabilityTable({
  rows,
  busyId,
  onToggle,
}: {
  rows: RuntimeCapability[];
  busyId: string | null;
  onToggle: (row: RuntimeCapability, enabled: boolean) => Promise<void>;
}) {
  return (
    <section className="min-w-0 overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="py-2 px-3 font-semibold">Contributes</th>
            <th className="py-2 px-3 font-semibold">Source</th>
            <th className="py-2 pl-3 text-right font-semibold">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}:${row.id}`} className="group border-t border-border-subtle/70 transition-colors hover:bg-surface/30">
              <td className="min-w-0 py-3 pr-4 align-middle">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[14px] font-semibold text-primary">{row.title}</div>
                    <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dim">
                      {labelForKind(row.kind)}
                    </span>
                  </div>
                  <div className="mt-0.5 max-w-[44rem] whitespace-normal break-words text-[12px] leading-5 text-secondary">
                    {row.description || fallbackDescription(row)}
                  </div>
                  {row.diagnostics?.length ? <DiagnosticsSummary diagnostics={row.diagnostics} /> : null}
                </div>
              </td>
              <td className="px-3 py-3 align-middle">
                <ContributionSummary row={row} />
              </td>
              <td className="max-w-[18rem] px-3 py-3 align-middle text-[12px] leading-5 text-secondary">
                <div className="truncate">{formatParts(row.ownerExtensionId, row.scope, row.source?.kind)}</div>
                <div className="truncate text-dim" title={row.source?.label}>
                  {row.source?.label ?? row.id}
                </div>
              </td>
              <td className="py-3 pl-3 text-right align-middle">
                <div className="flex items-center justify-end gap-3">
                  {busyId === row.id ? <span className="text-[11px] text-dim">Working…</span> : null}
                  {canToggle(row) ? (
                    <StatusToggle row={row} busy={busyId === row.id} onToggle={() => void onToggle(row, !row.enabled)} />
                  ) : (
                    <span className={statusClass(row)}>{row.status}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DiagnosticsSummary({ diagnostics }: { diagnostics: unknown[] }) {
  const messages = diagnostics.map(formatDiagnostic).filter(Boolean);
  return (
    <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-danger">
      <div>{formatCount(diagnostics.length, 'issue')}</div>
      {messages.slice(0, 3).map((message, index) => (
        <div key={`${index}:${message}`} className="max-w-[44rem] whitespace-normal break-words text-danger/90">
          {message}
        </div>
      ))}
      {messages.length > 3 ? <div className="text-danger/70">+{messages.length - 3} more</div> : null}
    </div>
  );
}

function formatDiagnostic(diagnostic: unknown): string {
  if (typeof diagnostic === 'string') return diagnostic;
  const record = asRecord(diagnostic);
  if (typeof record.message === 'string') return record.message;
  if (typeof record.code === 'string') return record.code;
  return '';
}

function StatusToggle({ row, busy, onToggle }: { row: RuntimeCapability; busy: boolean; onToggle: () => void }) {
  const locked = row.kind === 'extension' && row.id === 'system-extension-manager';
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-[12px] text-secondary transition-colors hover:text-primary disabled:opacity-50"
      disabled={busy || locked || row.status === 'invalid'}
      onClick={onToggle}
      aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.title}`}
      title={locked ? 'This extension is required by the application.' : undefined}
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full border transition-colors',
          locked
            ? 'border-border-subtle bg-surface/40'
            : row.enabled
              ? 'border-success/40 bg-success/20'
              : 'border-border-subtle bg-surface/60',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left,background-color]',
            locked ? 'left-[18px] bg-dim' : row.enabled ? 'left-[18px] bg-success' : 'left-1 bg-dim',
          )}
        />
      </span>
      {locked ? <span>Always on</span> : null}
    </button>
  );
}

function ContributionSummary({ row }: { row: RuntimeCapability }) {
  const counts = asRecord(row.metadata?.counts);
  const entries = [
    { label: 'Pages', icon: '▣', value: counts.pages },
    { label: 'Rails', icon: '▥', value: counts.rails },
    { label: 'Workbench', icon: '◫', value: counts.workbench },
    { label: 'Tools', icon: '⚒', value: counts.tools },
    { label: 'Profiles', icon: '◎', value: counts.modelProfiles },
    { label: 'Keys', icon: '⌘', value: counts.keybindings },
    { label: 'Hooks', icon: '↪', value: counts.agentHooks },
    { label: 'Backend', icon: '◈', value: counts.backend },
    { label: 'Skills', icon: '✦', value: counts.skills },
  ].filter((entry) => typeof entry.value === 'number' && entry.value > 0);
  if (entries.length) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {entries.map((entry) => (
          <span
            key={entry.label}
            title={`${entry.label}: ${String(entry.value)}`}
            aria-label={`${entry.label}: ${String(entry.value)}`}
            className="inline-flex min-w-8 items-center justify-center gap-1 rounded-md bg-surface/70 px-1.5 py-1 text-[11px] text-secondary"
          >
            <span aria-hidden="true" className="text-dim">
              {entry.icon}
            </span>
            <span>{String(entry.value)}</span>
          </span>
        ))}
      </div>
    );
  }
  const parts = compactMetadata(row.metadata);
  return parts.length ? (
    <div className="max-w-[20rem] truncate text-[12px] text-secondary">{parts.join(' · ')}</div>
  ) : (
    <span className="text-dim">—</span>
  );
}

function compactMetadata(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) return [];
  return ['name', 'transport', 'providerId', 'risk', 'reason']
    .map((key) => {
      const value = metadata[key];
      return value === undefined || value === null || value === '' ? null : `${key}: ${String(value)}`;
    })
    .filter((value): value is string => Boolean(value));
}

function canToggle(row: RuntimeCapability): boolean {
  return row.kind === 'extension' || row.kind === 'skill';
}

function statusClass(row: RuntimeCapability): string {
  return cx(
    'text-[12px]',
    row.status === 'active' || row.status === 'enabled'
      ? 'text-success'
      : row.status === 'invalid' || row.status === 'error'
        ? 'text-danger'
        : 'text-dim',
  );
}

function fallbackDescription(row: RuntimeCapability): string {
  if (row.kind === 'instruction') return formatParts(row.scope, row.metadata?.risk) || 'Instruction layer';
  if (row.kind === 'mcp-server') return formatParts(row.metadata?.transport, row.metadata?.url ?? row.metadata?.command) || 'MCP server';
  if (row.kind === 'tool') return String(row.metadata?.name ?? 'Agent tool');
  return row.id;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
