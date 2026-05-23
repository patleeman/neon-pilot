import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAppEvents } from '../app/contexts';
import { formatTaskSchedule } from '../automation/taskSchedule';
import { api } from '../client/api';
import { completeConversationOpenPhase } from '../client/perfDiagnostics';
import { buildDraftConversationCwdStorageKey, DRAFT_CONVERSATION_ID } from '../conversation/draftConversation';
import { useApi } from '../hooks/useApi';
import { useConversations } from '../hooks/useConversations';
import { fetchSessionDetailCached } from '../hooks/useSessions';
import { useReloadState } from '../local/reloadState';
import {
  buildCapabilitiesSearch,
  getCapabilitiesPresetId,
  getCapabilitiesSection,
  getCapabilitiesTaskId,
  getCapabilitiesToolName,
} from '../navigation/capabilitiesSelection';
import { sessionNeedsAttention } from '../session/sessionIndicators';
import { ensureConversationTabOpen } from '../session/sessionTabs';
import type { AgentToolInfo, ScheduledTaskSummary } from '../shared/types';
import { timeAgo } from '../shared/utils';
import { RichMarkdownRenderer } from './editor/RichMarkdownRenderer';
import { addNotification } from './notifications/notificationStore';
import { cx, ErrorState, IconButton, LoadingState } from './ui';

const ScheduledTaskPanel = lazy(() => import('./ScheduledTaskPanel').then((module) => ({ default: module.ScheduledTaskPanel })));

function suspendRailPanel(element: React.ReactNode, label = 'Loading…') {
  return <Suspense fallback={<LoadingState label={label} className="justify-center h-full" />}>{element}</Suspense>;
}

export function prefetchConversationRailData(input: {
  conversationId: string;
  workspaceVersion: number;
  runsVersion: number;
}): Promise<void> {
  void input.conversationId;
  void input.workspaceVersion;
  void input.runsVersion;
  return Promise.resolve();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('space-y-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0', className)}>
      <h3 className="text-[13px] font-semibold text-primary">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ConversationInspectorShell({ children }: { children: React.ReactNode }) {
  return <div className="ui-node-workspace-chrome h-full min-h-0 overflow-y-auto px-5 py-5">{children}</div>;
}

function EmptyPrompt({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <p className="text-[12px] text-dim text-center">{text}</p>
    </div>
  );
}

function RailHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-border-subtle shrink-0">
      <div className="min-w-0">
        <p className="ui-section-label">{label}</p>
        {sub && <p className="text-[12px] text-secondary mt-0.5 font-mono truncate">{sub}</p>}
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z" />
      <path d="M3.75 9.75h16.5" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.25h9" />
      <path d="m16.875 3.375 3.75 3.75" />
      <path d="M18.75 1.5a2.652 2.652 0 1 1 3.75 3.75L7.5 20.25l-4.5 1.5 1.5-4.5L18.75 1.5Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function DraftConversationContextPanel() {
  const [draftCwd, setDraftCwd, clearDraftCwd] = useReloadState<string>({
    storageKey: buildDraftConversationCwdStorageKey(),
    initialValue: '',
    shouldPersist: (value) => value.trim().length > 0,
  });
  const [changingCwd, setChangingCwd] = useState(false);
  const [requestedCwd, setRequestedCwd] = useState(draftCwd);
  const [pickCwdBusy, setPickCwdBusy] = useState(false);
  const [changeCwdError, setChangeCwdError] = useState<string | null>(null);

  useEffect(() => {
    if (!changingCwd) {
      setRequestedCwd(draftCwd);
    }
  }, [draftCwd, changingCwd]);

  const hasExplicitCwd = draftCwd.trim().length > 0;

  async function pickDraftCwd() {
    if (pickCwdBusy) {
      return;
    }

    setPickCwdBusy(true);
    setChangeCwdError(null);
    try {
      const result = await api.pickFolder(draftCwd || undefined);
      if (result.cancelled || !result.path) {
        return;
      }

      setDraftCwd(result.path);
      setRequestedCwd(result.path);
      setChangingCwd(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not choose a folder.';
      setChangeCwdError(msg);
      addNotification({ type: 'warning', message: msg, source: 'core' });
    } finally {
      setPickCwdBusy(false);
    }
  }

  function startChangingCwd() {
    setRequestedCwd(draftCwd);
    setChangeCwdError(null);
    setChangingCwd(true);
  }

  function cancelChangingCwd() {
    setRequestedCwd(draftCwd);
    setChangeCwdError(null);
    setChangingCwd(false);
  }

  function saveDraftCwd() {
    const nextCwd = requestedCwd.trim();
    setDraftCwd(nextCwd);
    setRequestedCwd(nextCwd);
    setChangeCwdError(null);
    setChangingCwd(false);
  }

  function clearExplicitCwd() {
    clearDraftCwd();
    setRequestedCwd('');
    setChangeCwdError(null);
    setChangingCwd(false);
  }

  return (
    <div className="px-4 py-4">
      <Section title="Working Directory">
        <div className="flex items-start gap-2">
          {hasExplicitCwd ? (
            <p className="ui-card-body min-w-0 flex-1 break-all pr-1 font-mono text-primary" title={draftCwd}>
              {draftCwd}
            </p>
          ) : (
            <p className="ui-card-body min-w-0 flex-1 text-dim">No working directory set.</p>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            {hasExplicitCwd && !changingCwd && (
              <IconButton
                compact
                onClick={clearExplicitCwd}
                className="text-danger"
                title="Clear the draft working directory"
                aria-label="Clear the draft working directory"
              >
                <XIcon />
              </IconButton>
            )}
            <IconButton
              compact
              onClick={() => {
                void pickDraftCwd();
              }}
              disabled={pickCwdBusy}
              className="text-accent"
              title={pickCwdBusy ? 'Choosing working directory…' : 'Choose the initial working directory for this draft conversation'}
              aria-label="Choose the initial working directory for this draft conversation"
            >
              <FolderIcon className={pickCwdBusy ? 'animate-pulse' : undefined} />
            </IconButton>
            <IconButton
              compact
              onClick={startChangingCwd}
              disabled={pickCwdBusy}
              title="Enter the working directory manually"
              aria-label="Enter the working directory manually"
            >
              <PencilIcon />
            </IconButton>
          </div>
        </div>
        {changingCwd && (
          <form
            className="space-y-2 border-t border-border-subtle/70 pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveDraftCwd();
            }}
          >
            <input
              autoFocus
              value={requestedCwd}
              onChange={(event) => {
                setRequestedCwd(event.target.value);
                if (changeCwdError) {
                  setChangeCwdError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelChangingCwd();
                }
              }}
              placeholder="~/workingdir/repo"
              spellCheck={false}
              disabled={pickCwdBusy}
              aria-label="Draft conversation working directory"
              className="w-full rounded-lg border border-border-default bg-base px-3 py-2 text-[12px] font-mono text-primary focus:outline-none focus:border-accent/60 disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-dim">
                Use the folder picker above for the default flow, or enter an absolute, ~, or relative path here.
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={cancelChangingCwd} disabled={pickCwdBusy} className="ui-toolbar-button">
                  Cancel
                </button>
                <button type="submit" disabled={pickCwdBusy} className="ui-toolbar-button text-accent">
                  Save
                </button>
              </div>
            </div>
          </form>
        )}
        {changeCwdError && <p className="text-[11px] text-danger/80">{changeCwdError}</p>}
      </Section>
    </div>
  );
}

function LiveSessionContextPanel({ id }: { id: string }) {
  const { versions } = useAppEvents();
  const [sessionDebug, setSessionDebug] = useState<{ modelProfile?: unknown } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      completeConversationOpenPhase(id, 'rail', {
        state: 'loaded',
        hasContext: false,
        hasExecution: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchSessionDetailCached(id, { tailBlocks: 1 }, versions.sessionFiles)
      .then((detail) => {
        if (!cancelled) setSessionDebug({ modelProfile: (detail as { modelProfile?: unknown }).modelProfile });
      })
      .catch(() => {
        if (!cancelled) setSessionDebug(null);
      });

    return () => {
      cancelled = true;
    };
  }, [id, versions.sessionFiles]);

  const modelProfile = sessionDebug?.modelProfile as
    | {
        kind?: string;
        modelRef?: string | null;
        profile?: { id?: string; title?: string; extensionId?: string };
        profiles?: Array<{ id?: string; extensionId?: string }>;
      }
    | undefined;
  const modelProfileValue = modelProfile
    ? modelProfile.kind === 'resolved'
      ? `${modelProfile.profile?.title ?? modelProfile.profile?.id ?? 'Profile'}${modelProfile.profile?.extensionId ? ` · ${modelProfile.profile.extensionId}` : ''}`
      : modelProfile.kind === 'ambiguous'
        ? `Ambiguous: ${(modelProfile.profiles ?? []).map((profile) => `${profile.extensionId}/${profile.id}`).join(', ')}`
        : 'None'
    : 'Loading…';

  return (
    <div className="space-y-4">
      <Section title="Runtime">
        <div className="space-y-2 text-[12px]">
          <RailMetadataRow label="Model" value={modelProfile?.modelRef ?? 'Unknown'} />
          <RailMetadataRow label="Profile" value={modelProfileValue} />
        </div>
      </Section>
    </div>
  );
}

// ── Task detail ───────────────────────────────────────────────────────────────

function RailMetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ui-detail-row">
      <span className="ui-detail-label">{label}</span>
      <span className="ui-detail-value break-words">{value}</span>
    </div>
  );
}

function RailMarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <RichMarkdownRenderer
      content={content}
      className={className ?? 'ui-markdown max-w-none text-[13px] leading-relaxed'}
      stripFrontmatter
    />
  );
}

function sortCapabilityTasks(items: ScheduledTaskSummary[]): ScheduledTaskSummary[] {
  return [...items].sort((left, right) => {
    const leftWeight = Number(left.running) * 10 + Number(left.lastStatus === 'failure') * 5 + Number(left.enabled);
    const rightWeight = Number(right.running) * 10 + Number(right.lastStatus === 'failure') * 5 + Number(right.enabled);
    return rightWeight - leftWeight || (right.lastRunAt ?? '').localeCompare(left.lastRunAt ?? '') || left.id.localeCompare(right.id);
  });
}

function sortCapabilityTools(items: AgentToolInfo[]): AgentToolInfo[] {
  return [...items].sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name));
}

function toolParameterDetails(
  tool: Pick<AgentToolInfo, 'parameters'>,
): Array<{ name: string; required: boolean; description?: string; type?: string }> {
  const properties = tool.parameters.properties ?? {};
  const required = new Set(tool.parameters.required ?? []);

  return Object.entries(properties).map(([name, schema]) => ({
    name,
    required: required.has(name),
    description: schema.description,
    type: typeof schema.type === 'string' ? schema.type : undefined,
  }));
}

function ConversationsWorkspaceContext() {
  const { pinnedSessions, tabs, archivedSessions, archivedConversationIds = [], loading, refetch } = useConversations();
  const archivedConversationIdSet = useMemo(() => new Set(archivedConversationIds), [archivedConversationIds]);
  const attentionSessions = useMemo(
    () =>
      [...pinnedSessions, ...tabs, ...archivedSessions.filter((session) => !archivedConversationIdSet.has(session.id))].filter((session) =>
        sessionNeedsAttention(session),
      ),
    [archivedConversationIdSet, archivedSessions, pinnedSessions, tabs],
  );

  if (loading) {
    return <LoadingState label="Loading conversations…" className="px-4 py-4" />;
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-card-title">Overview</p>
          <p className="ui-card-meta">
            Browse pinned, open, and archived conversations in the main pane. Open one to switch this rail back into live session context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="ui-toolbar-button shrink-0"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="space-y-2">
        <RailMetadataRow label="Pinned" value={pinnedSessions.length} />
        <RailMetadataRow label="Open" value={tabs.length} />
        <RailMetadataRow label="Archived" value={archivedSessions.length} />
        <RailMetadataRow label="Needs review" value={attentionSessions.length} />
      </div>

      <div className="space-y-2 border-t border-border-subtle pt-4">
        <p className="ui-section-label">Needs review</p>
        {attentionSessions.length === 0 ? (
          <p className="ui-card-meta">No conversations currently need review.</p>
        ) : (
          <div className="space-y-2">
            {attentionSessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                to={`/conversations/${encodeURIComponent(session.id)}`}
                className="block rounded-lg border border-border-subtle bg-base px-3 py-2 hover:bg-elevated/60"
              >
                <p className="text-[12px] font-medium text-primary break-words">{session.title}</p>
                <p className="ui-card-meta mt-1">
                  {timeAgo(session.lastActivityAt ?? session.timestamp)} · {session.model?.split('/').pop() ?? 'model unknown'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border-subtle pt-4">
        <p className="ui-section-label">Open now</p>
        {[...pinnedSessions.map((session) => ({ session, label: 'pinned' })), ...tabs.map((session) => ({ session, label: 'open' }))].slice(
          0,
          5,
        ).length === 0 ? (
          <p className="ui-card-meta">No open conversations yet.</p>
        ) : (
          <div className="space-y-2">
            {[...pinnedSessions.map((session) => ({ session, label: 'pinned' })), ...tabs.map((session) => ({ session, label: 'open' }))]
              .slice(0, 5)
              .map(({ session, label }) => (
                <Link
                  key={session.id}
                  to={`/conversations/${encodeURIComponent(session.id)}`}
                  className="block rounded-lg border border-border-subtle bg-base px-3 py-2 hover:bg-elevated/60"
                >
                  <p className="text-[12px] font-medium text-primary break-words">{session.title}</p>
                  <p className="ui-card-meta mt-1">
                    {label} · {timeAgo(session.lastActivityAt ?? session.timestamp)}
                  </p>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CapabilitiesOverviewContext({
  section,
  presets,
  defaultPresetIds,
  tasks,
  tools,
  unavailableCliCount,
}: {
  section: ReturnType<typeof getCapabilitiesSection>;
  presets: ConversationAutomationWorkflowPreset[];
  defaultPresetIds: string[];
  tasks: ScheduledTaskSummary[];
  tools: AgentToolInfo[];
  unavailableCliCount: number;
}) {
  const location = useLocation();
  const activeTools = tools.filter((tool) => tool.active);
  const failingTasks = tasks.filter((task) => task.lastStatus === 'failure');

  if (section === 'presets') {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="ui-card-title">Workflow presets</p>
          <p className="ui-card-meta">Select a preset on the left to inspect its ordered workflow items and defaults.</p>
        </div>
        <div className="space-y-2">
          <RailMetadataRow label="Presets" value={presets.length} />
          <RailMetadataRow label="Defaults" value={defaultPresetIds.length} />
        </div>
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <p className="ui-section-label">Defaults</p>
          {defaultPresetIds.length === 0 ? (
            <p className="ui-card-meta">No default presets configured.</p>
          ) : (
            defaultPresetIds.map((presetId) => {
              const preset = presets.find((item) => item.id === presetId);
              if (!preset) {
                return null;
              }
              return (
                <Link
                  key={preset.id}
                  to={`/capabilities${buildCapabilitiesSearch(location.search, { section: 'presets', presetId: preset.id })}`}
                  className="block rounded-lg border border-border-subtle bg-base px-3 py-2 hover:bg-elevated/60"
                >
                  <p className="text-[12px] font-medium text-primary">{preset.name}</p>
                  <p className="ui-card-meta mt-1">{preset.items.length} items</p>
                </Link>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (section === 'scheduled') {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="ui-card-title">Scheduled Tasks</p>
          <p className="ui-card-meta">Select a task on the left to inspect its prompt, schedule, and recent runtime state.</p>
        </div>
        <div className="space-y-2">
          <RailMetadataRow label="Enabled" value={tasks.filter((task) => task.enabled).length} />
          <RailMetadataRow label="Running" value={tasks.filter((task) => task.running).length} />
          <RailMetadataRow label="Failing" value={failingTasks.length} />
        </div>
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <p className="ui-section-label">Needs attention</p>
          {failingTasks.length === 0 ? (
            <p className="ui-card-meta">No scheduled tasks currently need attention.</p>
          ) : (
            failingTasks.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                to={`/capabilities${buildCapabilitiesSearch(location.search, { section: 'scheduled', taskId: task.id })}`}
                className="block rounded-lg border border-border-subtle bg-base px-3 py-2 hover:bg-elevated/60"
              >
                <p className="text-[12px] font-medium text-primary">{task.id}</p>
                <p className="ui-card-meta mt-1">failed {task.lastRunAt ? timeAgo(task.lastRunAt) : 'recently'}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  if (section === 'tools') {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="ui-card-title">Tools</p>
          <p className="ui-card-meta">Select a tool on the left to inspect its parameter schema and runtime role.</p>
        </div>
        <div className="space-y-2">
          <RailMetadataRow label="Active tools" value={activeTools.length} />
          <RailMetadataRow label="CLI issues" value={unavailableCliCount} />
        </div>
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <p className="ui-section-label">Active by default</p>
          {activeTools.length === 0 ? (
            <p className="ui-card-meta">No active tools reported.</p>
          ) : (
            activeTools.slice(0, 6).map((tool) => (
              <Link
                key={tool.name}
                to={`/capabilities${buildCapabilitiesSearch(location.search, { section: 'tools', toolName: tool.name })}`}
                className="block rounded-lg border border-border-subtle bg-base px-3 py-2 hover:bg-elevated/60"
              >
                <p className="text-[12px] font-medium text-primary">{tool.name}</p>
                <p className="ui-card-meta mt-1">
                  {toolParameterDetails(tool).length} parameter{toolParameterDetails(tool).length === 1 ? '' : 's'}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-1">
        <p className="ui-card-title">Capabilities</p>
        <p className="ui-card-meta">Presets, scheduled tasks, and tools define what the agent can execute and automate.</p>
      </div>
      <div className="space-y-2">
        <RailMetadataRow label="Presets" value={presets.length} />
        <RailMetadataRow label="Scheduled" value={tasks.filter((task) => task.enabled).length} />
        <RailMetadataRow label="Tools" value={activeTools.length} />
      </div>
      <div className="space-y-2 border-t border-border-subtle pt-4">
        <p className="ui-section-label">Current health</p>
        <p className="ui-card-meta">
          {tasks.filter((task) => task.running).length} running scheduled task{tasks.filter((task) => task.running).length === 1 ? '' : 's'}{' '}
          · {failingTasks.length} failing · {unavailableCliCount} CLI issue{unavailableCliCount === 1 ? '' : 's'}.
        </p>
      </div>
    </div>
  );
}

function CapabilitiesTaskContext({ taskId }: { taskId: string }) {
  const navigate = useNavigate();
  const { data, loading, error, refreshing, refetch } = useApi(() => api.taskDetail(taskId), `capabilities-task-rail:${taskId}`);
  const [runningNow, setRunningNow] = useState(false);

  const handleRunNow = useCallback(async () => {
    if (!data || runningNow || data.running) {
      return;
    }

    setRunningNow(true);
    try {
      await api.runTaskNow(data.id);
      const refreshed = await refetch({ resetLoading: false });
      const threadConversationId = refreshed?.threadConversationId ?? data.threadConversationId;
      if (threadConversationId) {
        ensureConversationTabOpen(threadConversationId);
        navigate(`/conversations/${encodeURIComponent(threadConversationId)}`);
      }
    } finally {
      setRunningNow(false);
    }
  }, [data, navigate, refetch, runningNow]);

  if (loading && !data) return <LoadingState label="Loading task…" className="px-4 py-4" />;
  if (error && !data) return <ErrorState message={`Failed to load task: ${error}`} className="px-4 py-4" />;
  if (!data) return <div className="px-4 py-4 text-[12px] text-dim">Task not found.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-4 border-b border-border-subtle px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-card-title break-words">{data.id}</p>
            <p className="ui-card-meta mt-1">{data.running ? 'running' : (data.lastStatus ?? (data.enabled ? 'enabled' : 'disabled'))}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void refetch({ resetLoading: false });
            }}
            disabled={refreshing}
            className="ui-toolbar-button shrink-0"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
        <div className="space-y-2">
          <RailMetadataRow label="Schedule" value={data.cron || data.at ? formatTaskSchedule(data) : 'manual only'} />
          <RailMetadataRow label="Model" value={data.model ?? 'Default model'} />
          <RailMetadataRow label="Cwd" value={<span className="font-mono break-all">{data.cwd ?? 'No cwd set'}</span>} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleRunNow();
            }}
            disabled={runningNow || data.running}
            className="ui-toolbar-button text-accent"
          >
            {runningNow ? 'Running…' : 'Run now'}
          </button>
          <Link to={`/automations/${encodeURIComponent(data.id)}`} className="ui-toolbar-button">
            Open automation
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-2">
          <p className="ui-section-label">Prompt</p>
          <RailMarkdownPreview content={data.prompt} />
        </div>
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <p className="ui-section-label">Task file</p>
          <RailMarkdownPreview content={data.fileContent} />
        </div>
      </div>
    </div>
  );
}

function CapabilitiesToolContext({ tool }: { tool: AgentToolInfo }) {
  const parameters = toolParameterDetails(tool);

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-1">
        <p className="ui-card-title break-words">{tool.name}</p>
        <p className="ui-card-meta">{tool.active ? 'Active by default' : 'Available on demand'}</p>
      </div>
      <p className="ui-card-body">{tool.description}</p>
      <div className="space-y-2">
        <RailMetadataRow label="Default" value={tool.active ? 'Yes' : 'No'} />
        <RailMetadataRow label="Parameters" value={parameters.length} />
      </div>
      <div className="space-y-2 border-t border-border-subtle pt-4">
        <p className="ui-section-label">Parameters</p>
        {parameters.length === 0 ? (
          <p className="ui-card-meta">No parameters.</p>
        ) : (
          parameters.map((parameter) => (
            <div key={parameter.name} className="rounded-lg border border-border-subtle bg-base px-3 py-2">
              <p className="text-[12px] font-medium text-primary">{parameter.name}</p>
              <p className="ui-card-meta mt-1">
                {parameter.required ? 'required' : 'optional'}
                {parameter.type ? ` · ${parameter.type}` : ''}
              </p>
              {parameter.description && <p className="text-[12px] leading-relaxed text-secondary mt-1">{parameter.description}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CapabilitiesContextPanel() {
  const location = useLocation();
  const section = getCapabilitiesSection(location.search);
  const selectedPresetId = getCapabilitiesPresetId(location.search);
  const selectedTaskId = getCapabilitiesTaskId(location.search);
  const selectedToolName = getCapabilitiesToolName(location.search);
  const presetsResult = useApi(api.conversationPlansWorkspace, 'capabilities-rail-presets');
  const tasksResult = useApi(api.tasks, 'capabilities-rail-tasks');
  const toolsResult = useApi(api.tools, 'capabilities-rail-tools');

  const presets = [...(presetsResult.data?.presetLibrary.presets ?? [])].sort(
    (left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.name.localeCompare(right.name),
  );
  const tasks = sortCapabilityTasks(tasksResult.data ?? []);
  const tools = sortCapabilityTools(toolsResult.data?.tools ?? []);
  const defaultPresetIds = presetsResult.data?.presetLibrary.defaultPresetIds ?? [];
  const selectedPreset = presets.find((item) => item.id === selectedPresetId) ?? null;
  const selectedTool = tools.find((item) => item.name === selectedToolName) ?? null;

  if (selectedPreset) {
    return <CapabilitiesPresetContext preset={selectedPreset} isDefault={defaultPresetIds.includes(selectedPreset.id)} />;
  }
  if (selectedTaskId) return <CapabilitiesTaskContext taskId={selectedTaskId} />;
  if (selectedTool) return <CapabilitiesToolContext tool={selectedTool} />;
  if (
    presetsResult.loading &&
    !presetsResult.data &&
    tasksResult.loading &&
    !tasksResult.data &&
    toolsResult.loading &&
    !toolsResult.data
  ) {
    return <LoadingState label="Loading capabilities…" className="px-4 py-4" />;
  }
  if (!presetsResult.data && !tasksResult.data && !toolsResult.data && (presetsResult.error || tasksResult.error || toolsResult.error)) {
    return (
      <ErrorState
        message={`Failed to load capabilities: ${[presetsResult.error, tasksResult.error, toolsResult.error].filter(Boolean).join(' · ')}`}
        className="px-4 py-4"
      />
    );
  }

  return (
    <CapabilitiesOverviewContext
      section={section}
      presets={presets}
      defaultPresetIds={defaultPresetIds}
      tasks={tasks}
      tools={tools}
      unavailableCliCount={(toolsResult.data?.dependentCliTools ?? []).filter((tool) => !tool.binary.available).length}
    />
  );
}

function SettingsOverviewContext() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-1">
        <p className="ui-card-title">Settings</p>
        <p className="ui-card-meta">
          This page controls runtime defaults, layout preferences, desktop connections, and integration settings.
        </p>
      </div>

      <div className="space-y-2">
        <RailMetadataRow label="Runtime" value="Shared runtime resources and local overrides" />
        <RailMetadataRow label="Defaults" value="Model, cwd, and new-session behavior" />
        <RailMetadataRow label="Layout" value="Sidebar width, rail width, and reset actions" />
      </div>

      <div className="space-y-2 border-t border-border-subtle pt-4">
        <p className="ui-section-label">What lives here</p>
        <p className="ui-card-meta">
          Use Settings for stable preferences, interface controls, desktop connections, and inline runtime service panels. Use Background
          Work for shell commands, agent tasks, and recovery review.
        </p>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function ContextRail() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const section = parts[0];
  const id = parts[1];
  const scheduledSection = section === 'scheduled' || section === 'automations' || section === 'tasks';
  const selectedPlanId = new URLSearchParams(location.search).get('plan')?.trim() || null;
  const creatingPlan = new URLSearchParams(location.search).get('new') === '1';

  // Presets
  if (section === 'plans') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <RailHeader label="Workflow presets" sub={selectedPlanId ?? (creatingPlan ? 'new preset' : undefined)} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {suspendRailPanel(
            selectedPlanId || creatingPlan ? (
              <AutomationPresetPanel presetId={selectedPlanId} creatingNew={creatingPlan} />
            ) : (
              <EmptyPrompt text="Select a workflow preset or create a new one to edit reusable workflow presets." />
            ),
            'Loading workflow presets…',
          )}
        </div>
      </div>
    );
  }

  // Conversations
  if (section === 'conversations' && id === DRAFT_CONVERSATION_ID) {
    return (
      <ConversationInspectorShell>
        <DraftConversationContextPanel />
      </ConversationInspectorShell>
    );
  }
  if (section === 'conversations' && id) {
    return (
      <ConversationInspectorShell>
        <LiveSessionContextPanel id={id} />
      </ConversationInspectorShell>
    );
  }
  if (section === 'conversations') {
    return (
      <ConversationInspectorShell>
        <ConversationsWorkspaceContext />
      </ConversationInspectorShell>
    );
  }

  // Automations
  if (scheduledSection && id) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <RailHeader label="Automation" sub={id} />
        {suspendRailPanel(<ScheduledTaskPanel id={id} />, 'Loading automation…')}
      </div>
    );
  }
  if (scheduledSection) {
    return (
      <div className="flex-1 flex flex-col">
        <RailHeader label="Scheduled" />
        <EmptyPrompt text="Select an automation or start a new one." />
      </div>
    );
  }

  // Capabilities
  if (section === 'capabilities') {
    const capabilitiesSection = getCapabilitiesSection(location.search);
    const presetId = getCapabilitiesPresetId(location.search);
    const taskId = getCapabilitiesTaskId(location.search);
    const toolName = getCapabilitiesToolName(location.search);
    const capabilitiesSub = presetId ?? taskId ?? toolName ?? capabilitiesSection;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <RailHeader label="Capabilities" sub={capabilitiesSub} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CapabilitiesContextPanel />
        </div>
      </div>
    );
  }

  if (section === 'settings') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <RailHeader label="Settings" sub="preferences" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SettingsOverviewContext />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
      <p className="text-[12px] text-dim">Select a conversation, page, or run to see context.</p>
    </div>
  );
}
