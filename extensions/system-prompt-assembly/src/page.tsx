import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { api, useApi } from '@neon-pilot/extensions/settings';
import {
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedEmptyState,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedStateBlock,
  WindowedTextarea,
  WindowedTextInput,
  WindowedToolbar,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';

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
  const loadRequestIdRef = useRef(0);
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

  if (error) {
    return (
      <WindowedPageShell layout="standard" className="prompt-assembly-page-windowed">
        <WindowedPageMain title="Prompt Assembly" actions={<WindowedPageButton onClick={() => void load()}>Try again</WindowedPageButton>}>
          <WindowedPageSection title="Status" meta="Unavailable">
            <WindowedStateBlock tone="danger" title="Prompt Assembly unavailable">
              {error}
            </WindowedStateBlock>
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowedPageShell>
    );
  }
  if (!data) {
    return (
      <WindowedPageShell layout="standard" className="prompt-assembly-page-windowed">
        <WindowedPageMain title="Prompt Assembly">
          <WindowedPageSection title="Status" meta="Loading">
            <WindowedStateBlock title="Loading Prompt Assembly">Reading agent runtime capabilities.</WindowedStateBlock>
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowedPageShell>
    );
  }

  return (
    <WindowedPageShell layout="standard" className="prompt-assembly-page-windowed">
      <WindowedPageMain title="Prompt Assembly" actions={<WindowedPageButton onClick={() => void load()}>Refresh</WindowedPageButton>}>
        <WindowedPageSection
          title="Template"
          meta={savingSystemPromptTemplate ? 'Saving' : systemPromptTemplateDirty ? 'Pending' : 'Saved'}
        >
          {systemPromptTemplateLoading && !systemPromptTemplateState ? (
            <WindowedStateBlock title="Loading template">Reading the configured instruction template.</WindowedStateBlock>
          ) : systemPromptTemplateError && !systemPromptTemplateState ? (
            <WindowedStateBlock tone="danger" title="Template unavailable">
              {formatPromptAssemblyError(
                systemPromptTemplateError,
                'Could not load the instruction template. Refresh Prompt Assembly or reopen Settings.',
              )}
            </WindowedStateBlock>
          ) : systemPromptTemplateState ? (
            <div className="wos-prompt-template">
              <div className="wos-prompt-template__path">
                Configured in {formatPromptAssemblyDisplayPath(systemPromptTemplateState.configFile, data)}
              </div>
              <WindowedTextarea
                id="agent-runtime-system-prompt-template"
                value={systemPromptTemplateDraft}
                onChange={(event) => {
                  setSystemPromptTemplateDraft(event.target.value);
                  if (systemPromptTemplateSaveError) {
                    setSystemPromptTemplateSaveError(null);
                  }
                }}
                className="wos-prompt-template__editor"
                spellCheck={false}
                disabled={savingSystemPromptTemplate}
              />
              <div className="wos-prompt-template__status">
                <span>{savingSystemPromptTemplate ? 'Saving...' : systemPromptTemplateDirty ? 'Auto-save pending...' : 'Auto-saved'}</span>
                <WindowedPageButton
                  onClick={() => {
                    setSystemPromptTemplateDraft(systemPromptTemplateSavedTemplate);
                    setSystemPromptTemplateSaveError(null);
                  }}
                  disabled={savingSystemPromptTemplate || !systemPromptTemplateDirty}
                >
                  Revert edits
                </WindowedPageButton>
              </div>
            </div>
          ) : null}
          {systemPromptTemplateSaveError ? (
            <WindowedStateBlock tone="danger" title="Template save failed">
              {systemPromptTemplateSaveError}
            </WindowedStateBlock>
          ) : null}
        </WindowedPageSection>

        <WindowedPageSection title="Agent context" meta={formatCount(visibleAgentCapabilities.length, 'capability')}>
          <WindowedToolbar
            end={
              <span className="wos-toolbar__meta">
                Working directory: {formatPromptAssemblyDisplayPath(data.cwd ?? data.repoRoot, data)}
              </span>
            }
          >
            <WindowedTextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agent context..." />
          </WindowedToolbar>
        </WindowedPageSection>

        <WindowedCapabilitySection
          title="Instructions"
          rows={instructionCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No instructions found"
        />
        <WindowedCapabilitySection
          title="Tools"
          rows={toolCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No tools found"
        />
        <WindowedCapabilitySection
          title="MCP"
          rows={mcpCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No MCP servers found"
        />
        <WindowedCapabilitySection
          title="Issues"
          rows={issueCapabilities}
          runtime={data}
          busyId={busyId}
          onToggle={toggleCapability}
          emptyTitle="No issues found"
        />
      </WindowedPageMain>
    </WindowedPageShell>
  );
}

function WindowedCapabilitySection({
  title,
  rows,
  runtime,
  busyId,
  onToggle,
  emptyTitle,
}: {
  title: string;
  rows: RuntimeCapability[];
  runtime: AgentRuntimeResult;
  busyId: string | null;
  onToggle: (row: RuntimeCapability, enabled: boolean) => Promise<void>;
  emptyTitle: string;
}) {
  return (
    <WindowedPageSection title={title} meta={formatCount(rows.length, 'entry')}>
      {rows.length ? (
        <WindowedDataTable
          columns={[{ label: 'Name' }, { label: 'Contributes' }, { label: 'Source', align: 'right' }]}
          columnTemplate="minmax(15rem, 1fr) minmax(8rem, 0.42fr) minmax(14rem, 0.74fr)"
        >
          {rows.map((row) => (
            <WindowedDataRow
              key={`${row.kind}:${row.id}`}
              name={row.title}
              meta={formatParts(labelForKind(row.kind), row.description || fallbackDescription(row))}
              status={<WindowedBadge tone={windowedStatusTone(row)}>{row.status}</WindowedBadge>}
              action={
                canToggle(row) ? (
                  <WindowedPageButton
                    disabled={busyId === row.id || row.status === 'invalid'}
                    onClick={() => void onToggle(row, !row.enabled)}
                  >
                    {row.enabled ? 'Disable' : 'Enable'}
                  </WindowedPageButton>
                ) : (
                  <span className="wos-prompt-source">{formatPromptAssemblyDisplayPath(row.source?.label ?? row.id, runtime)}</span>
                )
              }
            />
          ))}
        </WindowedDataTable>
      ) : (
        <WindowedEmptyState>{emptyTitle}.</WindowedEmptyState>
      )}
    </WindowedPageSection>
  );
}

function windowedStatusTone(row: RuntimeCapability): 'neutral' | 'positive' | 'warning' | 'danger' {
  if (row.status === 'active' || row.status === 'enabled') return 'positive';
  if (row.status === 'invalid' || row.status === 'error') return 'danger';
  if (!row.enabled) return 'warning';
  return 'neutral';
}

function canToggle(row: RuntimeCapability): boolean {
  return row.kind === 'extension';
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

function formatPromptAssemblyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return fallback;
  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}
