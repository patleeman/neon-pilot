import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  CodeBlock,
  Disclosure,
  Field,
  Notice,
  Pill,
  SectionLabel,
  SurfacePanel,
  Textarea,
  TextInput,
  ToolbarButton,
  cx,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

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
  allowedToolsText: string;
};

const EMPTY_DRAFT: SavedWorkflowDraft = {
  name: '',
  description: '',
  script: 'await workflow.phase("start");\nreturn workflow.finish({ summary: "done" });',
  argsText: '{}',
  cwd: '',
  model: '',
  agentModel: '',
  allowedToolsText: '',
};

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

function templateToDraft(template: WorkflowTemplate): SavedWorkflowDraft {
  const agentDefaults =
    template.agentDefaults && typeof template.agentDefaults === 'object'
      ? (template.agentDefaults as { model?: unknown; allowedTools?: unknown })
      : {};
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    script: template.script,
    argsText: formatJson(template.args),
    cwd: template.cwd ?? '',
    model: template.model ?? '',
    agentModel: typeof agentDefaults.model === 'string' ? agentDefaults.model : '',
    allowedToolsText: Array.isArray(agentDefaults.allowedTools)
      ? agentDefaults.allowedTools.filter((item): item is string => typeof item === 'string').join(',')
      : '',
  };
}

function parseDraft(draft: SavedWorkflowDraft) {
  let args: unknown;
  try {
    args = draft.argsText.trim() ? JSON.parse(draft.argsText) : {};
  } catch {
    throw new Error('Args must be valid JSON.');
  }
  const allowedTools = draft.allowedToolsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const agentDefaults: { model?: string; allowedTools?: string[] } = {};
  if (draft.agentModel.trim()) agentDefaults.model = draft.agentModel.trim();
  if (draft.allowedToolsText.trim()) agentDefaults.allowedTools = allowedTools;
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

function WorkflowCard({ workflow, selected, onSelect }: { workflow: WorkflowSummary; selected: boolean; onSelect: () => void }) {
  const agents = workflow.agents;
  return (
    <button
      type="button"
      className={cx(
        'w-full rounded-md border px-3 py-2 text-left transition-colors',
        selected ? 'border-accent/60 bg-accent/10' : 'border-border-subtle bg-surface/40 hover:bg-surface/70',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-primary">{workflow.name}</div>
          <div className="truncate text-[12px] text-secondary">{workflow.activePhase || workflow.cwd}</div>
        </div>
        <Pill tone={statusTone(workflow.status)}>{workflow.status}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-dim">
        <span>{formatDate(workflow.createdAt)}</span>
        {agents ? (
          <span>
            {agents.completed}/{agents.total} agents
          </span>
        ) : null}
        {workflow.model ? <span>{workflow.model}</span> : null}
      </div>
    </button>
  );
}

export function DynamicWorkflowTranscriptBlock({ block }: { block: { details?: unknown; text?: string } }) {
  const details = block.details && typeof block.details === 'object' ? (block.details as WorkflowSummary) : null;
  const agents = details?.agents;
  const modelText = details?.models?.length ? details.models.join(', ') : details?.model;
  return (
    <div className="rounded-md border border-border-subtle bg-surface/50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-primary">{details?.name ?? block.text ?? 'Dynamic workflow'}</div>
          <div className="truncate text-[12px] text-secondary">
            {details?.activePhase ? `Phase: ${details.activePhase}` : (details?.cwd ?? '')}
          </div>
        </div>
        {details?.status ? <Pill tone={statusTone(details.status)}>{details.status}</Pill> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-dim">
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
  );
}

export function WorkflowsPage({ pa }: ExtensionSurfaceProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [draft, setDraft] = useState<SavedWorkflowDraft>(EMPTY_DRAFT);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selected = detail?.workflow ?? workflows.find((workflow) => workflow.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await pa.extension.invoke('listWorkflows', { limit: 100 })) as { workflows?: WorkflowSummary[] };
      const templateResult = (await pa.extension.invoke('listWorkflowTemplates', {})) as { templates?: WorkflowTemplate[] };
      const savedResult = (await pa.extension.invoke('listSavedWorkflows', {})) as { workflows?: WorkflowTemplate[] };
      const next = result.workflows ?? [];
      setWorkflows(next);
      setTemplates(templateResult.templates ?? []);
      setSavedWorkflows(savedResult.workflows ?? []);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
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

  async function saveDraft() {
    setDraftError(null);
    try {
      const payload = parseDraft(draft);
      if (!payload.name) throw new Error('Name is required.');
      if (!payload.script.trim()) throw new Error('Script is required.');
      await pa.extension.invoke('saveWorkflow', payload);
      setDraftOpen(false);
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (saveError) {
      setDraftError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  async function deleteSaved(template: WorkflowTemplate) {
    await pa.extension.invoke('deleteSavedWorkflow', { id: template.id });
    await refresh();
  }

  async function runSaved(template: WorkflowTemplate) {
    const result = (await pa.extension.invoke('runSavedWorkflow', { id: template.id })) as { details?: { workflowId?: string } };
    await refresh();
    if (result.details?.workflowId) setSelectedId(result.details.workflowId);
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="flex min-h-full flex-col gap-8">
        <AppPageIntro
          title="Workflows"
          summary="Dynamic workflow runs, spawned agents, phases, and results."
          actions={<ToolbarButton onClick={() => void refresh()}>Refresh</ToolbarButton>}
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="grid min-h-[34rem] gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <section className="min-w-0 space-y-5 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Runs</SectionLabel>
              {loading ? <span className="text-[11px] text-dim">Refreshing...</span> : null}
            </div>
            {loading && workflows.length === 0 ? <div className="text-[12px] text-dim">Loading workflows...</div> : null}
            {!loading && workflows.length === 0 ? (
              <AppPageEmptyState align="start" title="No workflows" body="Dynamic workflow runs will appear here." />
            ) : null}
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  selected={workflow.id === selectedId}
                  onSelect={() => setSelectedId(workflow.id)}
                />
              ))}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Saved</SectionLabel>
                <ToolbarButton
                  onClick={() => {
                    setDraft(EMPTY_DRAFT);
                    setDraftError(null);
                    setDraftOpen(true);
                  }}
                >
                  New
                </ToolbarButton>
              </div>
              {savedWorkflows.length === 0 ? <div className="text-[12px] text-dim">No saved workflows yet.</div> : null}
              {savedWorkflows.map((item) => (
                <SurfacePanel key={item.id} muted className="px-3 py-2 shadow-none">
                  <div className="truncate text-[13px] font-medium text-primary">{item.name}</div>
                  {item.description ? <div className="mt-1 line-clamp-2 text-[12px] text-secondary">{item.description}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToolbarButton onClick={() => void runSaved(item)}>Run</ToolbarButton>
                    <ToolbarButton
                      onClick={() => {
                        setDraft(templateToDraft(item));
                        setDraftError(null);
                        setDraftOpen(true);
                      }}
                    >
                      Edit
                    </ToolbarButton>
                    <ToolbarButton onClick={() => void deleteSaved(item)}>Delete</ToolbarButton>
                  </div>
                </SurfacePanel>
              ))}
              {draftOpen ? (
                <SurfacePanel muted className="space-y-2 px-3 py-3 shadow-none">
                  <div className="text-[13px] font-medium text-primary">{draft.id ? 'Edit saved workflow' : 'New saved workflow'}</div>
                  {draftError ? <Notice tone="danger">{draftError}</Notice> : null}
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
                    <TextInput
                      placeholder="read,bash"
                      value={draft.allowedToolsText}
                      onChange={(event) => setDraft((current) => ({ ...current, allowedToolsText: event.target.value }))}
                    />
                  </Field>
                  <Field label="Args JSON">
                    <Textarea
                      className="h-24 font-mono text-[12px]"
                      value={draft.argsText}
                      onChange={(event) => setDraft((current) => ({ ...current, argsText: event.target.value }))}
                    />
                  </Field>
                  <Field label="Script">
                    <Textarea
                      className="h-40 font-mono text-[12px]"
                      value={draft.script}
                      onChange={(event) => setDraft((current) => ({ ...current, script: event.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <ToolbarButton onClick={() => void saveDraft()}>Save</ToolbarButton>
                    <ToolbarButton
                      onClick={() => {
                        setDraftOpen(false);
                        setDraftError(null);
                      }}
                    >
                      Close
                    </ToolbarButton>
                  </div>
                </SurfacePanel>
              ) : null}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <SectionLabel>Examples</SectionLabel>
              {templates.map((item) => (
                <SurfacePanel key={item.id} muted className="px-3 py-2 shadow-none">
                  <div className="truncate text-[13px] font-medium text-primary">{item.name}</div>
                  {item.description ? <div className="mt-1 line-clamp-2 text-[12px] text-secondary">{item.description}</div> : null}
                  <div className="mt-2 flex gap-2">
                    <ToolbarButton onClick={() => void saveTemplate(item)}>Save</ToolbarButton>
                  </div>
                </SurfacePanel>
              ))}
            </div>
          </section>

          <section className="min-w-0 space-y-4 border-t border-border-subtle pt-4">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-[16px] font-semibold text-primary">{selected?.name ?? 'Details'}</h2>
            </div>
            {!selected ? (
              <AppPageEmptyState align="start" title="Select a workflow" body="Run details, agents, and logs are shown here." />
            ) : null}
            {selected ? (
              <div className="space-y-4">
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
                  <div>
                    <h3 className="mb-2 text-[13px] font-medium text-primary">Events</h3>
                    <div className="max-h-72 overflow-auto rounded-md border border-border-subtle bg-surface/30">
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
                  </div>
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
