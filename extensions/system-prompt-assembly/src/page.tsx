import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { api, useApi } from '@neon-pilot/extensions/settings';
import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  AppPageToc,
  CardBody,
  cx,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  EmptyState,
  ErrorState,
  MetaLabel,
  Notice,
  Pill,
  QuietLoadingState,
  SearchInput,
  Switch,
  Textarea,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';
type RuntimeSectionId = 'system-prompt' | 'instructions' | 'tools' | 'mcp' | 'issues';

const INTERNAL_ERROR_PATTERNS = [
  /Local API route did not complete/i,
  /\/api\//i,
  /file:\/\//i,
  /\bModule\./,
  /localApi\.js/i,
  /readonly-local-api-worker\.js/i,
  /\bENOENT\b/,
  /Cannot find module/i,
  /Cannot read/i,
];

const RUNTIME_SECTIONS = [
  { id: 'system-prompt', label: 'System Prompt', summary: 'Generated template' },
  { id: 'instructions', label: 'Instructions', summary: 'Instruction files and layers' },
  { id: 'tools', label: 'Tools', summary: 'Injected callable tools' },
  { id: 'mcp', label: 'MCP', summary: 'Server connections' },
  { id: 'issues', label: 'Issues', summary: 'Diagnostics and invalid entries' },
] as const;

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
  required?: boolean;
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

async function invokePromptAssemblyAction(pa: ExtensionSurfaceProps['pa'], actionId: string, input?: unknown) {
  if (typeof pa.extensions?.callAction === 'function') {
    return pa.extensions.callAction('system-prompt-assembly', actionId, input);
  }
  return pa.extension.invoke(actionId, input);
}

export function PromptAssemblyPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<AgentRuntimeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const runtimeScrollRef = useRef<HTMLDivElement | null>(null);
  const loadRequestIdRef = useRef(0);
  const [activeSectionId, setActiveSectionId] = useState<RuntimeSectionId>('system-prompt');
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
  const [systemPromptTemplateSaved, setSystemPromptTemplateSaved] = useState<SystemPromptTemplateState | null>(null);
  const [savingSystemPromptTemplate, setSavingSystemPromptTemplate] = useState(false);
  const [systemPromptTemplateSaveError, setSystemPromptTemplateSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestId = (loadRequestIdRef.current += 1);
    setError(null);
    try {
      const result = await invokePromptAssemblyAction(pa, 'inspectAgentRuntime', { cwd: context.cwd ?? undefined });
      if (loadRequestIdRef.current !== requestId) return;
      setData(result as AgentRuntimeResult);
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setError(formatPromptAssemblyError(err, 'Could not load Prompt Assembly. Refresh this page or reopen Settings.'));
    }
  }, [context.cwd, pa]);

  useEffect(() => {
    void load();
  }, [load]);

  const systemPromptTemplateSavedTemplate = systemPromptTemplateSaved?.template ?? systemPromptTemplateState?.template ?? '';
  const systemPromptTemplateDirty = systemPromptTemplateState ? systemPromptTemplateDraft !== systemPromptTemplateSavedTemplate : false;

  useEffect(() => {
    if (systemPromptTemplateState) {
      setSystemPromptTemplateSaved(systemPromptTemplateState);
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
      setSystemPromptTemplateSaved(saved);
      setSystemPromptTemplateDraft(saved.template);
    } catch (err) {
      setSystemPromptTemplateSaveError(
        formatPromptAssemblyError(err, 'Could not save the instruction template. Revert edits or try again.'),
      );
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
      await invokePromptAssemblyAction(pa, 'updateRuntimeCapability', { id: row.id, kind: row.kind, enabled });
      await load();
    } catch (err) {
      setError(formatPromptAssemblyError(err, 'Could not update this capability. Refresh Prompt Assembly and try again.'));
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    const capabilities = data?.capabilities ?? [];
    const needle = query.trim().toLowerCase();
    return capabilities.filter((capability) => {
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
  }, [data?.capabilities, query]);

  const visibleAgentCapabilities = useMemo(
    () => visible.filter((capability) => capability.kind !== 'extension' && capability.kind !== 'skill'),
    [visible],
  );
  const instructionCapabilities = useMemo(
    () =>
      visibleAgentCapabilities.filter(
        (capability) => capability.kind === 'instruction' || capability.kind === 'prompt-template' || capability.kind === 'context',
      ),
    [visibleAgentCapabilities],
  );
  const toolCapabilities = useMemo(
    () => visibleAgentCapabilities.filter((capability) => capability.kind === 'tool'),
    [visibleAgentCapabilities],
  );
  const mcpCapabilities = useMemo(
    () => visibleAgentCapabilities.filter((capability) => capability.kind === 'mcp-server'),
    [visibleAgentCapabilities],
  );
  const issueCapabilities = useMemo(
    () =>
      visibleAgentCapabilities.filter(
        (capability) => capability.diagnostics?.length || capability.status === 'invalid' || capability.status === 'error',
      ),
    [visibleAgentCapabilities],
  );

  useEffect(() => {
    const container = runtimeScrollRef.current;
    if (!container || typeof window === 'undefined') {
      return undefined;
    }

    const sections = RUNTIME_SECTIONS.map((item) => {
      const section = container.querySelector<HTMLElement>(`#${item.id}`);
      return section ? { id: item.id, section } : null;
    }).filter((item): item is { id: RuntimeSectionId; section: HTMLElement } => item !== null);

    if (sections.length === 0) {
      return undefined;
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const visibleIds = new Set<RuntimeSectionId>();
      const updateActiveSection = () => {
        let nextId = sections[0].id;
        for (const item of sections) {
          if (visibleIds.has(item.id)) {
            nextId = item.id;
          }
        }
        setActiveSectionId((current) => (current === nextId ? current : nextId));
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const sectionId = entry.target.id as RuntimeSectionId;
            if (entry.isIntersecting) visibleIds.add(sectionId);
            else visibleIds.delete(sectionId);
          }
          updateActiveSection();
        },
        { root: container, rootMargin: '-96px 0px -60% 0px', threshold: 0 },
      );

      for (const item of sections) observer.observe(item.section);
      return () => observer.disconnect();
    }

    let frame: number | null = null;
    const updateActiveSection = () => {
      frame = null;
      const containerTop = container.getBoundingClientRect().top;
      let nextId = sections[0].id;
      for (const item of sections) {
        if (item.section.getBoundingClientRect().top - containerTop <= 96) nextId = item.id;
      }
      setActiveSectionId((current) => (current === nextId ? current : nextId));
    };
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    scheduleUpdate();
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [data]);

  function navigateToSection(sectionId: RuntimeSectionId) {
    setActiveSectionId(sectionId);
    runtimeScrollRef.current?.querySelector<HTMLElement>(`#${sectionId}`)?.scrollIntoView({ block: 'start' });
  }

  if (error) return <ErrorState title="Failed to load prompt assembly" message={error} />;
  if (!data) return <QuietLoadingState label="Loading prompt assembly" className="h-full" />;

  return (
    <div ref={runtimeScrollRef} className="h-full overflow-y-auto">
      <AppPageLayout
        asideLayout="centered"
        contentClassName="flex flex-col gap-10"
        aside={
          <AppPageToc
            items={RUNTIME_SECTIONS}
            activeId={activeSectionId}
            onNavigate={navigateToSection}
            ariaLabel="Prompt assembly sections"
          />
        }
      >
        <AppPageIntro
          title="Prompt Assembly"
          summary="Review the instructions, tools, MCP servers, templates, and context available to the agent."
          actions={
            <ToolbarButton aria-label="Refresh prompt assembly" title="Refresh prompt assembly" onClick={() => void load()}>
              <span aria-hidden="true">↻</span>
            </ToolbarButton>
          }
        />

        <AppPageSection
          id="system-prompt"
          title="Agent instructions template"
          description="Customize the generated instruction template. Advanced variables such as knowledge_root and skills_dir are available."
          className="border-t border-border-subtle pt-10 first:border-t-0 first:pt-0"
          bodyClassName="space-y-3"
        >
          {systemPromptTemplateLoading && !systemPromptTemplateState ? (
            <Notice>Loading system prompt template...</Notice>
          ) : systemPromptTemplateError && !systemPromptTemplateState ? (
            <Notice tone="danger" title="Failed to load system prompt template">
              {formatPromptAssemblyError(
                systemPromptTemplateError,
                'Could not load the instruction template. Refresh Prompt Assembly or reopen Settings.',
              )}
            </Notice>
          ) : systemPromptTemplateState ? (
            <div className="space-y-3">
              <p className="text-[12px] text-dim">
                Configured in{' '}
                <span className="font-mono text-[11px]">{formatPromptAssemblyDisplayPath(systemPromptTemplateState.configFile, data)}</span>
                .
              </p>
              <Textarea
                id="agent-runtime-system-prompt-template"
                value={systemPromptTemplateDraft}
                onChange={(event) => {
                  setSystemPromptTemplateDraft(event.target.value);
                  if (systemPromptTemplateSaveError) {
                    setSystemPromptTemplateSaveError(null);
                  }
                }}
                className="min-h-[340px] font-mono text-[12px] leading-5"
                spellCheck={false}
                disabled={savingSystemPromptTemplate}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-dim">
                  {savingSystemPromptTemplate ? 'Saving...' : systemPromptTemplateDirty ? 'Auto-save pending...' : 'Auto-saved'}
                </span>
                <ToolbarButton
                  onClick={() => {
                    setSystemPromptTemplateDraft(systemPromptTemplateSavedTemplate);
                    setSystemPromptTemplateSaveError(null);
                  }}
                  disabled={savingSystemPromptTemplate || !systemPromptTemplateDirty}
                  className="rounded-md px-3 py-1.5 text-[12px] shadow-none"
                >
                  Revert edits
                </ToolbarButton>
              </div>
            </div>
          ) : null}
          {systemPromptTemplateSaveError ? <Notice tone="danger">{systemPromptTemplateSaveError}</Notice> : null}
        </AppPageSection>

        <AppPageSection
          title="Agent Context"
          description={
            <>
              {formatCount(visibleAgentCapabilities.length, 'capability')} shown: instructions, tools, MCP, templates, and context.
              <span className="block text-[12px] text-dim">
                Working directory: {formatPromptAssemblyDisplayPath(data.cwd ?? data.repoRoot, data)}
              </span>
            </>
          }
          className="border-t border-border-subtle pt-10"
          titleClassName="text-[22px]"
        >
          <SearchInput
            className="w-full max-w-md"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agent context…"
          />
        </AppPageSection>

        <CapabilitySection
          id="instructions"
          title="Instructions"
          description="Instruction files, prompt templates, and context blocks assembled before the agent starts."
          rows={instructionCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No instructions found"
        />
        <CapabilitySection
          id="tools"
          title="Tools"
          description="Tools the agent can call in the current workspace."
          rows={toolCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No tools found"
        />
        <CapabilitySection
          id="mcp"
          title="MCP"
          description="Model Context Protocol servers available to the agent."
          rows={mcpCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No MCP servers found"
        />
        <CapabilitySection
          id="issues"
          title="Issues"
          description="Problems, invalid registrations, and unavailable entries that need attention."
          rows={issueCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No issues found"
        />
      </AppPageLayout>
    </div>
  );
}

function CapabilitySection({
  id,
  title,
  description,
  rows,
  runtime,
  busyId,
  onToggle,
  emptyTitle,
}: {
  id: RuntimeSectionId;
  title: string;
  description: string;
  rows: RuntimeCapability[];
  runtime: AgentRuntimeResult;
  busyId: string | null;
  onToggle: (row: RuntimeCapability, enabled: boolean) => Promise<void>;
  emptyTitle: string;
}) {
  return (
    <AppPageSection
      id={id}
      title={title}
      description={description}
      meta={formatCount(rows.length, 'entry')}
      className="border-t border-border-subtle pt-10"
    >
      {rows.length ? (
        <CapabilityTable rows={rows} runtime={runtime} busyId={busyId} onToggle={onToggle} />
      ) : (
        <EmptyState title={emptyTitle} body="Try a broader search query." />
      )}
    </AppPageSection>
  );
}

function CapabilityTable({
  rows,
  runtime,
  busyId,
  onToggle,
}: {
  rows: RuntimeCapability[];
  runtime: AgentRuntimeResult;
  busyId: string | null;
  onToggle: (row: RuntimeCapability, enabled: boolean) => Promise<void>;
}) {
  return (
    <DataTable
      tableClassName="table-fixed"
      columns={
        <colgroup>
          <col className="w-[48%]" />
          <col className="w-[24%]" />
          <col className="w-[28%]" />
        </colgroup>
      }
    >
      <DataTableHead>
        <DataTableRow>
          <DataTableHeaderCell className="pr-4">Name</DataTableHeaderCell>
          <DataTableHeaderCell>Contributes</DataTableHeaderCell>
          <DataTableHeaderCell>Source</DataTableHeaderCell>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {rows.map((row) => (
          <DataTableRow key={`${row.kind}:${row.id}`} className="group">
            <DataTableCell className="min-w-0 pr-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[14px] font-semibold text-primary">{row.title}</div>
                    <MetaLabel tone="muted">{labelForKind(row.kind)}</MetaLabel>
                  </div>
                  <CardBody as="div" className="mt-0.5 max-w-[44rem] whitespace-normal break-words">
                    {row.description || fallbackDescription(row)}
                  </CardBody>
                  {row.diagnostics?.length ? <DiagnosticsSummary diagnostics={row.diagnostics} /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  {busyId === row.id ? <span className="text-[11px] text-dim">Working…</span> : null}
                  {canToggle(row) ? (
                    <StatusToggle row={row} busy={busyId === row.id} onToggle={() => void onToggle(row, !row.enabled)} />
                  ) : (
                    <span className={statusClass(row)}>{row.status}</span>
                  )}
                </div>
              </div>
            </DataTableCell>
            <DataTableCell>
              <ContributionSummary row={row} />
            </DataTableCell>
            <DataTableCell className="min-w-0 text-[12px] leading-5 text-secondary">
              <div className="truncate">{formatParts(row.ownerExtensionId, row.scope, row.source?.kind)}</div>
              <div className="truncate text-dim">{formatPromptAssemblyDisplayPath(row.source?.label ?? row.id, runtime)}</div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
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
  if (typeof diagnostic === 'string') return sanitizePromptAssemblyDisplayText(diagnostic);
  const record = asRecord(diagnostic);
  if (typeof record.message === 'string') return sanitizePromptAssemblyDisplayText(record.message);
  if (typeof record.code === 'string') return record.code;
  return '';
}

function StatusToggle({ row, busy, onToggle }: { row: RuntimeCapability; busy: boolean; onToggle: () => void }) {
  const locked = row.kind === 'extension' && row.required === true;
  return (
    <Switch
      checked={row.enabled}
      disabled={busy || locked || row.status === 'invalid'}
      onClick={onToggle}
      aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.title}`}
      title={locked ? 'This extension is required by the application.' : undefined}
      label={locked ? 'Always on' : undefined}
    />
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
          <Pill
            key={entry.label}
            tone="muted"
            title={`${entry.label}: ${String(entry.value)}`}
            aria-label={`${entry.label}: ${String(entry.value)}`}
            className="min-w-8 justify-center rounded-md"
          >
            <span aria-hidden="true" className="text-dim">
              {entry.icon}
            </span>
            <span>{String(entry.value)}</span>
          </Pill>
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
  return row.kind === 'extension';
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
  if (row.kind === 'mcp-server')
    return (
      sanitizePromptAssemblyDisplayText(formatParts(row.metadata?.transport, row.metadata?.url ?? row.metadata?.command)) || 'MCP server'
    );
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

function formatPromptAssemblyDisplayPath(value: unknown, runtime?: Pick<AgentRuntimeResult, 'cwd' | 'repoRoot'>): string {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const roots = [runtime?.cwd, runtime?.repoRoot]
    .map((root) => (typeof root === 'string' ? root.trim().replace(/\/+$/, '') : ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const root of roots) {
    if (text === root) return '.';
    if (text.startsWith(`${root}/`)) return `./${text.slice(root.length + 1)}`;
  }

  return sanitizePromptAssemblyDisplayText(text);
}

function sanitizePromptAssemblyDisplayText(value: string): string {
  return value
    .replace(/\/Users\/[^/\s]+\/\.config\/mcp\/mcp_servers\.json/g, 'MCP config')
    .replace(/\/Users\/[^/\s]+\/\.codex\/skills\/([^/\s]+)/g, 'skills/$1')
    .replace(/\/tmp\/[^\s]*\/config\/config\.json/g, 'config.json')
    .replace(/\/Users\/[^/\s]+\/workingdir\/([^/\s]+)\/([^\s,.)]+)/g, './$2');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatPromptAssemblyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return fallback;
  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}
