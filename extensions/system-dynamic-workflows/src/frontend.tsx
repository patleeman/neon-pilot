import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Checkbox,
  CodeBlock,
  Disclosure,
  Field,
  IconButton,
  Notice,
  PanelHeader,
  Pill,
  SidebarList,
  SidebarMessage,
  SidebarSection,
  SurfacePanel,
  Textarea,
  TextInput,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type WorkflowSummary = {
  id: string;
  name: string;
  description?: string;
  status: string;
  cwd: string;
  activePhase?: string;
  model?: string;
  resultText?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  agents?: { total: number; running: number; completed: number; failed: number; cancelled: number };
  models?: string[];
};

type WorkflowDetail = {
  workflow: WorkflowSummary;
  script: string;
  args: unknown;
  nodes: Array<{
    id: string;
    role?: string;
    phase?: string;
    prompt?: string;
    status: string;
    runId?: string;
    model?: string;
    allowedTools?: string[];
    resultText?: string;
    error?: string;
    createdAt?: string;
    completedAt?: string;
  }>;
  events: Array<{ type: string; message: string; createdAt: string; data?: unknown }>;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description?: string;
  script: string;
  args?: unknown;
  cwd?: string;
  model?: string;
  agentDefaults?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

type SavedWorkflowDraft = {
  id?: string;
  name: string;
  description: string;
  script: string;
  argsText: string;
  cwd: string;
  model: string;
  agentModel: string;
  selectedAllowedTools: string[];
  additionalAllowedToolsText: string;
};

export const KNOWN_WORKFLOW_TOOLS = ['read', 'bash', 'edit', 'write'] as const;
const KNOWN_WORKFLOW_TOOL_SET = new Set<string>(KNOWN_WORKFLOW_TOOLS);

const EMPTY_DRAFT: SavedWorkflowDraft = {
  name: '',
  description: '',
  script: 'await workflow.phase("start");\nreturn workflow.finish({ summary: "done" });',
  argsText: '{}',
  cwd: '',
  model: '',
  agentModel: '',
  selectedAllowedTools: [],
  additionalAllowedToolsText: '',
};

type WorkflowSelection = { kind: 'run'; id: string } | { kind: 'template'; id: string } | { kind: 'none' };

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'warning';
  return 'neutral';
}

function formatDate(value?: string): string {
  if (!value) return '';
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : value;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseToolText(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWorkflowSelection(hash?: string): WorkflowSelection {
  const raw = (hash ?? '').replace(/^#/, '');
  if (!raw) return { kind: 'none' };
  const [kind, encoded = ''] = raw.split(':', 2);
  if ((kind !== 'run' && kind !== 'template') || !encoded) return { kind: 'none' };
  try {
    return { kind, id: decodeURIComponent(encoded) };
  } catch {
    return { kind, id: encoded };
  }
}

function workflowSelectionHash(selection: Exclude<WorkflowSelection, { kind: 'none' }>): string {
  return `${selection.kind}:${encodeURIComponent(selection.id)}`;
}

async function navigateWorkflows(pa: ExtensionSurfaceProps['pa'], selection?: Exclude<WorkflowSelection, { kind: 'none' }>, search = '') {
  const to = `/workflows${search}${selection ? `#${workflowSelectionHash(selection)}` : ''}`;
  const handled = await pa.commands?.execute?.('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: to } }));
  }
}

export function splitWorkflowTools(tools: unknown): Pick<SavedWorkflowDraft, 'selectedAllowedTools' | 'additionalAllowedToolsText'> {
  const values = Array.isArray(tools) ? tools.filter((item): item is string => typeof item === 'string') : [];
  const selectedAllowedTools = values.filter((tool) => KNOWN_WORKFLOW_TOOL_SET.has(tool));
  const additionalAllowedToolsText = values.filter((tool) => !KNOWN_WORKFLOW_TOOL_SET.has(tool)).join(', ');
  return { selectedAllowedTools, additionalAllowedToolsText };
}

export function resolveWorkflowTools(draft: Pick<SavedWorkflowDraft, 'selectedAllowedTools' | 'additionalAllowedToolsText'>): string[] {
  const tools = [...draft.selectedAllowedTools, ...parseToolText(draft.additionalAllowedToolsText)];
  return Array.from(new Set(tools));
}

function templateToDraft(template: WorkflowTemplate): SavedWorkflowDraft {
  const agentDefaults =
    template.agentDefaults && typeof template.agentDefaults === 'object'
      ? (template.agentDefaults as { model?: unknown; allowedTools?: unknown })
      : {};
  const allowedToolsDraft = splitWorkflowTools(agentDefaults.allowedTools);
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    script: template.script,
    argsText: formatJson(template.args),
    cwd: template.cwd ?? '',
    model: template.model ?? '',
    agentModel: typeof agentDefaults.model === 'string' ? agentDefaults.model : '',
    ...allowedToolsDraft,
  };
}

function parseDraft(draft: SavedWorkflowDraft) {
  let args: unknown;
  try {
    args = draft.argsText.trim() ? JSON.parse(draft.argsText) : {};
  } catch {
    throw new Error('Args must be valid JSON.');
  }
  const allowedTools = resolveWorkflowTools(draft);
  const agentDefaults: { model?: string; allowedTools?: string[] } = {};
  if (draft.agentModel.trim()) agentDefaults.model = draft.agentModel.trim();
  if (allowedTools.length > 0) agentDefaults.allowedTools = allowedTools;
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    description: draft.description.trim(),
    script: draft.script,
    args,
    cwd: draft.cwd.trim(),
    model: draft.model.trim(),
    agentDefaults,
  };
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M13 3.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.3 6.3A4.7 4.7 0 1 0 13 8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 2.75h6.8L13.25 5.2V13A1.25 1.25 0 0 1 12 14.25H4A1.25 1.25 0 0 1 2.75 13V4A1.25 1.25 0 0 1 4 2.75Z" />
      <path d="M5.25 2.75v4h5.5v-4M5.25 14.25v-4.5h5.5v4.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.25 11.75v1.5h1.5L12 6l-1.5-1.5-7.25 7.25Z" strokeLinejoin="round" />
      <path d="m9.5 5.5 1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5h10M6.5 2.75h3L10.25 4.5h-4.5l.75-1.75Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 4.5 5.6 13a1.25 1.25 0 0 0 1.25 1.1h2.3A1.25 1.25 0 0 0 10.4 13L11 4.5" />
      <path d="M7 7v4M9 7v4" strokeLinecap="round" />
    </svg>
  );
}

export function DynamicWorkflowTranscriptBlock({ block }: { block: { details?: unknown; text?: string } }) {
  const details = block.details && typeof block.details === 'object' ? (block.details as WorkflowSummary) : null;
  const agents = details?.agents;
  const modelText = details?.models?.length ? details.models.join(', ') : details?.model;
  return (
    <SurfacePanel muted className="overflow-hidden shadow-none">
      <PanelHeader
        title={details?.name ?? block.text ?? 'Dynamic workflow'}
        meta={details?.status ? <Pill tone={statusTone(details.status)}>{details.status}</Pill> : undefined}
        className="px-3 py-2"
      />
      <div className="px-3 py-2">
        {details?.activePhase || details?.cwd ? (
          <div className="mb-2 truncate text-[12px] text-secondary">
            {details?.activePhase ? `Phase: ${details.activePhase}` : details.cwd}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 text-[11px] text-dim">
          {agents ? (
            <span>
              {agents.completed}/{agents.total} agents
            </span>
          ) : null}
          {agents?.running ? <span>{agents.running} running</span> : null}
          {agents?.failed ? <span>{agents.failed} failed</span> : null}
          {agents?.cancelled ? <span>{agents.cancelled} cancelled</span> : null}
          {modelText ? <span>{modelText}</span> : null}
          {details?.completedAt ? (
            <span>Completed {formatDate(details.completedAt)}</span>
          ) : details?.updatedAt ? (
            <span>Updated {formatDate(details.updatedAt)}</span>
          ) : null}
        </div>
        {details?.resultText ? <p className="mt-2 line-clamp-3 text-[12px] text-secondary">{details.resultText}</p> : null}
        {details?.error ? <p className="mt-2 line-clamp-3 text-[12px] text-danger">{details.error}</p> : null}
      </div>
    </SurfacePanel>
  );
}

function toggleDraftAllowedTool(draft: SavedWorkflowDraft, tool: string): SavedWorkflowDraft {
  const selectedAllowedTools = draft.selectedAllowedTools.includes(tool)
    ? draft.selectedAllowedTools.filter((item) => item !== tool)
    : [...draft.selectedAllowedTools, tool];
  return { ...draft, selectedAllowedTools };
}

export function WorkflowsSidebar({ pa, context }: ExtensionSurfaceProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selection = parseWorkflowSelection(context.hash);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = (await pa.extension.invoke('listWorkflows', { limit: 100 })) as { workflows?: WorkflowSummary[] };
      const templateResult = (await pa.extension.invoke('listWorkflowTemplates', {})) as { templates?: WorkflowTemplate[] };
      const savedResult = (await pa.extension.invoke('listSavedWorkflows', {})) as { workflows?: WorkflowTemplate[] };
      setWorkflows(result.workflows ?? []);
      setTemplates(templateResult.templates ?? []);
      setSavedWorkflows(savedResult.workflows ?? []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const isEmpty = !loading && workflows.length === 0 && savedWorkflows.length === 0 && templates.length === 0;

  return (
    <SidebarSection
      title="Workflows"
      actionItems={[
        {
          id: 'new',
          label: 'New saved workflow',
          icon: <PlusIcon />,
          onClick: () => void navigateWorkflows(pa, undefined, '?action=new'),
        },
        {
          id: 'refresh',
          label: 'Refresh workflows',
          icon: <RefreshIcon />,
          onClick: () => void refresh(),
        },
      ]}
    >
      {error ? <SidebarMessage className="text-danger">{error}</SidebarMessage> : null}
      {loading && workflows.length === 0 && savedWorkflows.length === 0 && templates.length === 0 ? (
        <div role="status" aria-label="Loading workflows" />
      ) : null}
      {isEmpty ? <SidebarMessage>No workflows yet.</SidebarMessage> : null}
      {workflows.length ? (
        <SidebarSection title="Runs" className="mt-3">
          <SidebarList
            items={workflows.map((workflow) => ({
              id: workflow.id,
              title: workflow.name,
              meta: workflow.status,
            }))}
            selectedId={selection.kind === 'run' ? selection.id : null}
            onSelect={(item) => void navigateWorkflows(pa, { kind: 'run', id: item.id })}
          />
        </SidebarSection>
      ) : null}
      {savedWorkflows.length ? (
        <SidebarSection title="Saved" className="mt-3">
          <SidebarList
            items={savedWorkflows.map((item) => ({ id: item.id, title: item.name, meta: 'ready' }))}
            selectedId={selection.kind === 'template' ? selection.id : null}
            onSelect={(item) => void navigateWorkflows(pa, { kind: 'template', id: item.id })}
          />
        </SidebarSection>
      ) : null}
      {templates.length ? (
        <SidebarSection title="Templates" className="mt-3">
          <SidebarList
            items={templates.map((item) => ({ id: item.id, title: item.name, meta: 'stock' }))}
            selectedId={selection.kind === 'template' ? selection.id : null}
            onSelect={(item) => void navigateWorkflows(pa, { kind: 'template', id: item.id })}
          />
        </SidebarSection>
      ) : null}
    </SidebarSection>
  );
}

export function WorkflowsPage({ pa, context }: ExtensionSurfaceProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowTemplate[]>([]);
  const initialSelection = parseWorkflowSelection(context.hash);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection.kind === 'run' ? initialSelection.id : null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialSelection.kind === 'template' ? initialSelection.id : null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [draft, setDraft] = useState<SavedWorkflowDraft>(EMPTY_DRAFT);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = detail?.workflow ?? workflows.find((workflow) => workflow.id === selectedId) ?? null;
  const selectedTemplate =
    selectedId === null
      ? (savedWorkflows.find((workflow) => workflow.id === selectedTemplateId) ??
        templates.find((template) => template.id === selectedTemplateId) ??
        savedWorkflows[0] ??
        templates[0] ??
        null)
      : null;
  const selectedSavedWorkflow = selectedTemplate ? (savedWorkflows.find((workflow) => workflow.id === selectedTemplate.id) ?? null) : null;
  const savedDraftRef = useRef<string | null>(null);
  const draftSaveRequestIdRef = useRef(0);

  useEffect(() => {
    const selection = parseWorkflowSelection(context.hash);
    if (selection.kind === 'run') {
      setSelectedId(selection.id);
      setSelectedTemplateId(null);
    } else if (selection.kind === 'template') {
      setSelectedId(null);
      setSelectedTemplateId(selection.id);
    }
  }, [context.hash]);

  useEffect(() => {
    if (!context.search?.includes('action=new')) return;
    setDraft(EMPTY_DRAFT);
    setDraftError(null);
    setDraftStatus(null);
    setDraftOpen(true);
  }, [context.search]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = (await pa.extension.invoke('listWorkflows', { limit: 100 })) as { workflows?: WorkflowSummary[] };
      const templateResult = (await pa.extension.invoke('listWorkflowTemplates', {})) as { templates?: WorkflowTemplate[] };
      const savedResult = (await pa.extension.invoke('listSavedWorkflows', {})) as { workflows?: WorkflowTemplate[] };
      const next = result.workflows ?? [];
      const nextTemplates = templateResult.templates ?? [];
      const nextSaved = savedResult.workflows ?? [];
      setWorkflows(next);
      setTemplates(nextTemplates);
      setSavedWorkflows(nextSaved);
      const routeSelection = parseWorkflowSelection(context.hash);
      setSelectedId((current) => current ?? (routeSelection.kind === 'run' ? routeSelection.id : (next[0]?.id ?? null)));
      setSelectedTemplateId(
        (current) =>
          current ??
          (routeSelection.kind === 'template' ? routeSelection.id : next[0] ? null : (nextSaved[0]?.id ?? nextTemplates[0]?.id ?? null)),
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, [context.hash, pa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void pa.extension
      .invoke('getWorkflow', { workflowId: selectedId })
      .then((value) => {
        if (!cancelled) setDetail(value as WorkflowDetail);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pa, selectedId]);

  async function cancelSelected() {
    if (!selectedId) return;
    await pa.extension.invoke('cancelWorkflow', { workflowId: selectedId });
    await refresh();
  }

  async function saveTemplate(template: WorkflowTemplate) {
    await pa.extension.invoke('saveWorkflow', {
      id: template.id,
      name: template.name,
      description: template.description,
      script: template.script,
      args: template.args,
      cwd: template.cwd,
      model: template.model,
      agentDefaults: template.agentDefaults,
    });
    await refresh();
  }

  useEffect(() => {
    if (!draftOpen || !draft.id) return undefined;
    let payload: ReturnType<typeof parseDraft>;
    try {
      payload = parseDraft(draft);
      if (!payload.name || !payload.script.trim()) return undefined;
    } catch (saveError) {
      setDraftError(saveError instanceof Error ? saveError.message : String(saveError));
      return undefined;
    }

    const serialized = JSON.stringify(payload);
    if (serialized === savedDraftRef.current) return undefined;
    setDraftError(null);
    setDraftStatus('Unsaved changes');
    const timeout = window.setTimeout(() => {
      const requestId = (draftSaveRequestIdRef.current += 1);
      setDraftStatus('Saving...');
      void pa.extension
        .invoke('saveWorkflow', payload)
        .then(async () => {
          if (draftSaveRequestIdRef.current !== requestId) return;
          savedDraftRef.current = serialized;
          setDraftStatus('Saved');
          await refresh();
        })
        .catch((saveError: unknown) => {
          if (draftSaveRequestIdRef.current !== requestId) return;
          setDraftError(saveError instanceof Error ? saveError.message : String(saveError));
          setDraftStatus('Save failed');
        });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [draft, draftOpen, pa.extension, refresh]);

  async function deleteSaved(template: WorkflowTemplate) {
    await pa.extension.invoke('deleteSavedWorkflow', { id: template.id });
    if (selectedTemplateId === template.id) setSelectedTemplateId(null);
    await refresh();
  }

  function editSaved(template: WorkflowTemplate) {
    const nextDraft = templateToDraft(template);
    setDraft(nextDraft);
    savedDraftRef.current = JSON.stringify(parseDraft(nextDraft));
    setDraftError(null);
    setDraftStatus(null);
    setDraftOpen(true);
  }

  async function runSaved(template: WorkflowTemplate) {
    const result = (await pa.extension.invoke('runSavedWorkflow', { id: template.id })) as { details?: { workflowId?: string } };
    await refresh();
    if (result.details?.workflowId) await navigateWorkflows(pa, { kind: 'run', id: result.details.workflowId });
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout contentClassName="flex min-h-full flex-col gap-5">
        <AppPageIntro
          title="Workflows"
          actions={
            <ToolbarButton aria-label="Refresh workflows" title="Refresh workflows" onClick={() => void refresh()}>
              <RefreshIcon />
            </ToolbarButton>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="min-h-[calc(100vh-11rem)]">
          <section className="flex min-w-0 flex-col border-t border-border-subtle pt-3">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-[16px] font-semibold text-primary">
                {selected?.name ?? selectedTemplate?.name ?? 'Details'}
              </h2>
              {selectedTemplate ? (
                <div className="flex items-center gap-2">
                  <ToolbarButton onClick={() => void runSaved(selectedTemplate)}>Run</ToolbarButton>
                  {selectedSavedWorkflow ? (
                    <>
                      <IconButton
                        compact
                        aria-label={`Edit ${selectedSavedWorkflow.name}`}
                        title={`Edit ${selectedSavedWorkflow.name}`}
                        onClick={() => editSaved(selectedSavedWorkflow)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        compact
                        aria-label={`Delete ${selectedSavedWorkflow.name}`}
                        title={`Delete ${selectedSavedWorkflow.name}`}
                        onClick={() => void deleteSaved(selectedSavedWorkflow)}
                      >
                        <TrashIcon />
                      </IconButton>
                    </>
                  ) : null}
                  <IconButton
                    compact
                    aria-label={`Add ${selectedTemplate.name} to saved workflows`}
                    title={`Add ${selectedTemplate.name} to saved workflows`}
                    onClick={() => void saveTemplate(selectedTemplate)}
                  >
                    <SaveIcon />
                  </IconButton>
                </div>
              ) : null}
            </div>
            {draftOpen ? (
              <SurfacePanel muted className="mt-3 space-y-2 px-3 py-3 shadow-none">
                <div className="text-[13px] font-medium text-primary">{draft.id ? 'Edit saved workflow' : 'New saved workflow'}</div>
                {draftError ? <Notice tone="danger">{draftError}</Notice> : null}
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Name">
                    <TextInput value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Field>
                  <Field label="Agent model">
                    <TextInput
                      placeholder="opencode-go/deepseek-v4-flash"
                      value={draft.agentModel}
                      onChange={(event) => setDraft((current) => ({ ...current, agentModel: event.target.value }))}
                    />
                  </Field>
                  <Field label="Allowed tools">
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2 text-[12px] text-secondary">
                        {KNOWN_WORKFLOW_TOOLS.map((tool) => (
                          <label key={tool} className="flex items-center gap-2 rounded border border-border-subtle px-2 py-1.5">
                            <Checkbox
                              checked={draft.selectedAllowedTools.includes(tool)}
                              onChange={() => setDraft((current) => toggleDraftAllowedTool(current, tool))}
                            />
                            <span>{tool}</span>
                          </label>
                        ))}
                      </div>
                      <TextInput
                        aria-label="Additional allowed tools"
                        placeholder="Additional tools"
                        value={draft.additionalAllowedToolsText}
                        onChange={(event) => setDraft((current) => ({ ...current, additionalAllowedToolsText: event.target.value }))}
                      />
                    </div>
                  </Field>
                </div>
                <Field label="Workflow input JSON">
                  <Textarea
                    className="h-24 font-mono text-[12px]"
                    value={draft.argsText}
                    onChange={(event) => setDraft((current) => ({ ...current, argsText: event.target.value }))}
                  />
                </Field>
                <Field label="Script">
                  <Textarea
                    className="h-56 font-mono text-[12px]"
                    value={draft.script}
                    onChange={(event) => setDraft((current) => ({ ...current, script: event.target.value }))}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  {draftStatus ? <p className="m-0 text-[12px] text-dim">{draftStatus}</p> : null}
                  <IconButton
                    aria-label="Close workflow editor"
                    title="Close workflow editor"
                    onClick={() => {
                      setDraftOpen(false);
                      setDraftError(null);
                      setDraftStatus(null);
                      savedDraftRef.current = null;
                    }}
                  >
                    <span aria-hidden="true">x</span>
                  </IconButton>
                </div>
              </SurfacePanel>
            ) : null}
            {!selected && !selectedTemplate ? (
              <div className="mt-3 grid max-w-xl gap-0 text-[12px]">
                {[
                  ['Status', 'No run selected'],
                  ['Agents', '0 total'],
                  ['Events', '0 recorded'],
                  ['Result', 'Waiting for a workflow run'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-border-subtle py-2">
                    <span className="text-dim">{label}</span>
                    <span className="truncate text-secondary">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {selectedTemplate ? (
              <div className="mt-3 grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
                <div className="grid gap-0 text-[12px] md:grid-cols-2">
                  {[
                    ['Type', savedWorkflows.some((item) => item.id === selectedTemplate.id) ? 'Saved workflow' : 'Template'],
                    ['Model', selectedTemplate.model || 'default'],
                    ['Working directory', selectedTemplate.cwd || 'current conversation'],
                    ['Args', selectedTemplate.args ? 'configured' : 'empty'],
                    ['Updated', formatDate(selectedTemplate.updatedAt) || 'bundled'],
                    ['Script', `${selectedTemplate.script.split('\n').length} lines`],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-border-subtle py-2">
                      <span className="text-dim">{label}</span>
                      <span className="truncate text-secondary">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                  <SurfacePanel muted className="min-h-0 overflow-hidden shadow-none">
                    <PanelHeader
                      title="Script Preview"
                      meta={`${selectedTemplate.script.split('\n').length} lines`}
                      className="px-3 py-2"
                    />
                    <CodeBlock compact className="max-h-[26rem] overflow-auto border-0 bg-transparent p-3 text-secondary">
                      {selectedTemplate.script}
                    </CodeBlock>
                  </SurfacePanel>
                  <SurfacePanel muted className="shadow-none">
                    <PanelHeader title="Run Setup" meta="ready" className="px-3 py-2" />
                    <div className="space-y-2 px-3 py-2 text-[12px]">
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)] border-b border-border-subtle py-1.5">
                        <span className="text-dim">Agents</span>
                        <span className="text-secondary">
                          {selectedTemplate.agentDefaults && typeof selectedTemplate.agentDefaults === 'object' ? 'configured' : 'default'}
                        </span>
                      </div>
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)] border-b border-border-subtle py-1.5">
                        <span className="text-dim">Source</span>
                        <span className="truncate text-secondary">{selectedTemplate.id}</span>
                      </div>
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)] border-b border-border-subtle py-1.5">
                        <span className="text-dim">Status</span>
                        <span className="text-secondary">Selectable from library</span>
                      </div>
                      {selectedTemplate.description ? <p className="pt-1 text-secondary">{selectedTemplate.description}</p> : null}
                    </div>
                  </SurfacePanel>
                </div>
              </div>
            ) : null}
            {selected ? (
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(selected.status)}>{selected.status}</Pill>
                  <span className="text-[12px] text-secondary">{selected.cwd}</span>
                  {selected.status === 'running' ? <ToolbarButton onClick={() => void cancelSelected()}>Cancel</ToolbarButton> : null}
                </div>
                {selected.description ? <p className="text-[13px] text-secondary">{selected.description}</p> : null}
                <div className="grid gap-2 text-[12px] text-secondary sm:grid-cols-2">
                  <div>Created: {formatDate(selected.createdAt)}</div>
                  <div>Updated: {formatDate(selected.updatedAt)}</div>
                  <div>Active phase: {selected.activePhase ?? 'none'}</div>
                  <div>Models: {selected.models?.join(', ') || selected.model || 'default'}</div>
                  <div>
                    Agents:{' '}
                    {selected.agents
                      ? `${selected.agents.completed}/${selected.agents.total} complete, ${selected.agents.running} running, ${selected.agents.failed} failed`
                      : 'none'}
                  </div>
                  <div>Completed: {formatDate(selected.completedAt) || 'not completed'}</div>
                </div>
                {selected.resultText ? (
                  <SurfacePanel muted className="p-3 shadow-none">
                    <h3 className="mb-2 text-[13px] font-medium text-primary">Result</h3>
                    <CodeBlock compact className="max-h-80 border-0 bg-transparent p-0 text-secondary">
                      {selected.resultText}
                    </CodeBlock>
                  </SurfacePanel>
                ) : null}
                {selected.error ? (
                  <Notice tone="danger" title="Failure">
                    <CodeBlock compact className="mt-2 border-0 bg-transparent p-0 text-danger">
                      {selected.error}
                    </CodeBlock>
                  </Notice>
                ) : null}
                {detail?.nodes.length ? (
                  <div>
                    <h3 className="mb-2 text-[13px] font-medium text-primary">Agents</h3>
                    <div className="space-y-2">
                      {detail.nodes.map((node) => (
                        <SurfacePanel key={node.id} muted className="px-3 py-2 text-[12px] shadow-none">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-primary">{node.role ?? 'agent'}</span>
                            <Pill tone={statusTone(node.status)}>{node.status}</Pill>
                          </div>
                          <div className="mt-1 text-dim">{[node.phase, node.model, node.runId].filter(Boolean).join(' · ')}</div>
                          {node.allowedTools?.length ? <div className="mt-1 text-dim">Tools: {node.allowedTools.join(', ')}</div> : null}
                          {node.prompt ? (
                            <Disclosure
                              summary="Prompt"
                              className="mt-2 border-0 bg-transparent"
                              summaryClassName="px-0 py-0 text-dim hover:text-secondary"
                              bodyClassName="border-0 p-0 pt-2"
                            >
                              <CodeBlock compact className="max-h-48 border-0 bg-transparent p-0 text-secondary">
                                {node.prompt}
                              </CodeBlock>
                            </Disclosure>
                          ) : null}
                          {node.resultText ? <p className="mt-2 text-secondary">{node.resultText}</p> : null}
                          {node.error ? <p className="mt-2 text-danger">{node.error}</p> : null}
                        </SurfacePanel>
                      ))}
                    </div>
                  </div>
                ) : null}
                {detail?.events.length ? (
                  <SurfacePanel muted className="overflow-hidden shadow-none">
                    <PanelHeader title="Events" meta={`${detail.events.length} events`} className="px-3 py-2" />
                    <div className="max-h-72 overflow-auto">
                      {detail.events.slice(-80).map((event, index) => (
                        <div
                          key={`${event.createdAt}-${index}`}
                          className="border-b border-border-subtle px-3 py-2 text-[12px] last:border-b-0"
                        >
                          <div className="text-dim">
                            {formatDate(event.createdAt)} · {event.type}
                          </div>
                          <div className="text-secondary">{event.message}</div>
                          {event.data !== undefined && event.data !== null ? (
                            <CodeBlock compact className="mt-1 border-0 bg-transparent p-0 text-dim">
                              {JSON.stringify(event.data, null, 2)}
                            </CodeBlock>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </SurfacePanel>
                ) : null}
                {detail ? (
                  <Disclosure summary="Args" className="bg-surface/30">
                    <CodeBlock compact className="max-h-72 border-0 bg-transparent p-0 text-secondary">
                      {JSON.stringify(detail.args, null, 2)}
                    </CodeBlock>
                  </Disclosure>
                ) : null}
                {detail?.script ? (
                  <Disclosure summary="Script" className="bg-surface/30">
                    <CodeBlock compact className="max-h-96 border-0 bg-transparent p-0 text-secondary">
                      {detail.script}
                    </CodeBlock>
                  </Disclosure>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </AppPageLayout>
    </div>
  );
}
