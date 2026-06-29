import { useEffect, useMemo, useState } from 'react';

import { api } from '../client/api';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CenteredLoadingState,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarGroup,
  Notice,
  RowButton,
  SectionLabel,
  Textarea,
  TextInput,
} from '../components/ui';
import type { ManagedMemoryState, MemoryGitChange, MemoryIssue, MemoryScope } from '../shared/types';

type Selection = { kind: 'system' } | { kind: 'scope'; slug: string } | { kind: 'skill'; relativePath: string } | { kind: 'activity' };

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function fileLabel(relativePath: string): string {
  return relativePath.split('/').filter(Boolean).at(-1) ?? relativePath;
}

function ChangeList({ changes, emptyText = 'No memory changes yet.' }: { changes: MemoryGitChange[]; emptyText?: string }) {
  if (changes.length === 0) {
    return <p className="px-3 py-2 text-[12px] text-dim">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-border-subtle">
      {changes.map((change) => (
        <div key={change.hash} className="px-3 py-2">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-primary">{change.subject}</div>
              <div className="mt-0.5 text-[11px] text-dim">
                {change.author}
                {change.date ? ` · ${formatDate(change.date)}` : ''}
              </div>
            </div>
            <code className="shrink-0 text-[10px] text-dim">{change.hash.slice(0, 7)}</code>
          </div>
          {change.files.length > 0 ? <div className="mt-1 truncate text-[11px] text-secondary">{change.files.join(', ')}</div> : null}
        </div>
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: MemoryIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="border-b border-border-subtle">
      {issues.map((issue) => (
        <Notice key={`${issue.code}:${issue.relativePath ?? issue.message}`} tone={issue.severity === 'error' ? 'danger' : 'warning'}>
          <span className="block text-[12px]">{issue.message}</span>
          {issue.relativePath ? <code className="mt-1 block text-[11px] text-dim">{issue.relativePath}</code> : null}
        </Notice>
      ))}
    </div>
  );
}

function FileRow({ active, title, meta, onClick }: { active: boolean; title: string; meta?: string; onClick: () => void }) {
  return (
    <RowButton
      type="button"
      selected={active}
      onClick={onClick}
      className="items-center justify-between gap-3 rounded-none px-3 py-1.5 text-left"
    >
      <span className="min-w-0 truncate font-mono text-[12px]">{title}</span>
      {meta ? <span className="shrink-0 truncate text-[11px] text-dim">{meta}</span> : null}
    </RowButton>
  );
}

function MemoryOperations({
  state,
  busy,
  onSetRemote,
  onSync,
  onImportKnowledge,
}: {
  state: ManagedMemoryState;
  busy: string | null;
  onSetRemote: (url: string) => Promise<void>;
  onSync: () => Promise<void>;
  onImportKnowledge: () => Promise<void>;
}) {
  const [remoteUrl, setRemoteUrl] = useState(state.git.remoteUrl ?? '');

  useEffect(() => {
    setRemoteUrl(state.git.remoteUrl ?? '');
  }, [state.git.remoteUrl]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-[12px]">
        <span className="text-dim">Branch</span>
        <span className="truncate text-secondary">{state.git.branch ?? 'Git'}</span>
        <span className="text-dim">Remote</span>
        <span className="truncate text-secondary">{state.git.remoteUrl ? 'Configured' : 'Local only'}</span>
        <span className="text-dim">Sync</span>
        <span className="truncate text-secondary">
          {state.git.ahead || state.git.behind ? `${state.git.ahead} ahead, ${state.git.behind} behind` : 'Up to date locally'}
        </span>
      </div>
      <TextInput value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="Git remote URL" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!remoteUrl.trim() || busy === 'remote'} onClick={() => onSetRemote(remoteUrl)}>
          Save remote
        </Button>
        <Button disabled={!state.git.remoteUrl || busy === 'sync'} onClick={onSync}>
          Sync
        </Button>
        <Button disabled={busy === 'import'} onClick={onImportKnowledge}>
          Import knowledge
        </Button>
      </div>
    </div>
  );
}

function parseListInput(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ScopeForm({ onCreate }: { onCreate: (input: { name: string; roots: string[]; aliases: string[] }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [roots, setRoots] = useState('');
  const [aliases, setAliases] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <div className="px-3 py-2">
        <Button className="w-full justify-start" onClick={() => setOpen(true)}>
          New scope
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border-subtle p-3">
      <div className="space-y-2">
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Name</span>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} className="mt-1" />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Roots</span>
          <Textarea
            value={roots}
            onChange={(event) => setRoots(event.target.value)}
            rows={2}
            className="mt-1 resize-none font-mono text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Aliases</span>
          <Textarea
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            rows={2}
            className="mt-1 resize-none text-[12px]"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="action"
          disabled={!name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate({ name, roots: parseListInput(roots), aliases: parseListInput(aliases) });
              setName('');
              setRoots('');
              setAliases('');
              setOpen(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          Create
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function MemoryEditor({
  relativePath,
  title,
  description,
  content,
  onSave,
}: {
  relativePath: string;
  title: string;
  description: string;
  content: string;
  onSave: (content: string, reason: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(content);
    setReason('');
    setEditing(false);
  }, [content, relativePath]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-primary">{title}</h2>
            <p className="mt-1 truncate text-[12px] text-secondary">{description}</p>
          </div>
          <EditorToolbar className="shrink-0">
            <EditorToolbarGroup>
              {editing ? (
                <>
                  <EditorToolbarButton
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onSave(draft, reason || `Update ${relativePath}`);
                        setEditing(false);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Save
                  </EditorToolbarButton>
                  <EditorToolbarButton
                    onClick={() => {
                      setDraft(content);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </EditorToolbarButton>
                </>
              ) : (
                <EditorToolbarButton onClick={() => setEditing(true)}>Edit</EditorToolbarButton>
              )}
            </EditorToolbarGroup>
          </EditorToolbar>
        </div>
        <div className="mt-2 truncate font-mono text-[11px] text-dim">{relativePath}</div>
      </div>
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 font-mono text-[12px] leading-5 shadow-none"
            spellCheck={false}
          />
          <TextInput
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Commit reason"
            className="shrink-0 rounded-md border border-border bg-base px-2 py-1.5 text-[13px] text-primary outline-none focus:border-accent"
          />
        </div>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-base p-4 font-mono text-[12px] leading-5 text-primary">
          {content || 'No content.'}
        </pre>
      )}
    </div>
  );
}

function MemoryInspector({
  state,
  history,
  historyPath,
  busy,
  onSetRemote,
  onSync,
  onImportKnowledge,
}: {
  state: ManagedMemoryState;
  history: MemoryGitChange[];
  historyPath: string | null;
  busy: string | null;
  onSetRemote: (url: string) => Promise<void>;
  onSync: () => Promise<void>;
  onImportKnowledge: () => Promise<void>;
}) {
  return (
    <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_22rem] border-t border-border-subtle bg-panel/55">
      <div className="min-h-0 overflow-auto border-r border-border-subtle">
        <IssueList issues={state.issues} />
        <div className="border-b border-border-subtle px-3 py-2">
          <SectionLabel tone="muted">{historyPath ? 'File History' : 'Recent Changes'}</SectionLabel>
        </div>
        <ChangeList changes={historyPath ? history : state.recentChanges} />
      </div>
      <div className="min-h-0 overflow-auto px-3 py-2">
        <SectionLabel tone="muted">Repository</SectionLabel>
        <div className="mt-2">
          <MemoryOperations state={state} busy={busy} onSetRemote={onSetRemote} onSync={onSync} onImportKnowledge={onImportKnowledge} />
        </div>
        <div className="mt-3 truncate border-t border-border-subtle pt-2 font-mono text-[11px] text-dim">{state.root}</div>
      </div>
    </section>
  );
}

function MemoryFileNavigator({
  state,
  selection,
  activeScopes,
  busy,
  onSelect,
  onCreateCurrentScope,
  onCreateScope,
}: {
  state: ManagedMemoryState;
  selection: Selection;
  activeScopes: MemoryScope[];
  busy: string | null;
  onSelect: (selection: Selection) => void;
  onCreateCurrentScope: () => void;
  onCreateScope: (input: { name: string; roots: string[]; aliases: string[] }) => Promise<void>;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-panel/70">
      <div className="shrink-0 border-b border-border-subtle px-3 py-2">
        <SectionLabel tone="muted">Files</SectionLabel>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-border-subtle px-3 py-2">
          <SectionLabel tone="muted">System</SectionLabel>
        </div>
        <FileRow active={selection.kind === 'system'} title="system.md" meta="always loaded" onClick={() => onSelect({ kind: 'system' })} />
        <div className="border-y border-border-subtle px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel tone="muted">Scopes</SectionLabel>
            <span className="text-[11px] text-dim">{activeScopes.length} active</span>
          </div>
        </div>
        {state.scopes.length > 0 ? (
          state.scopes.map((scope: MemoryScope) => (
            <FileRow
              key={scope.slug}
              active={selection.kind === 'scope' && selection.slug === scope.slug}
              title={`${scope.slug}/memory.md`}
              meta={scope.active ? 'active' : scope.type}
              onClick={() => onSelect({ kind: 'scope', slug: scope.slug })}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-[12px] text-dim">No scope files.</p>
        )}
        {activeScopes.length === 0 ? (
          <div className="border-t border-border-subtle px-3 py-2">
            <Button className="w-full justify-start" disabled={busy === 'scope-current'} onClick={onCreateCurrentScope}>
              Scope current workspace
            </Button>
          </div>
        ) : null}
        <ScopeForm onCreate={onCreateScope} />
        <div className="border-y border-border-subtle px-3 py-2">
          <SectionLabel tone="muted">Skills</SectionLabel>
        </div>
        {state.skills.length > 0 ? (
          state.skills.map((skill) => (
            <FileRow
              key={skill.relativePath}
              active={selection.kind === 'skill' && selection.relativePath === skill.relativePath}
              title={skill.relativePath.replace(/^skills\//, '')}
              meta={skill.description || fileLabel(skill.relativePath)}
              onClick={() => onSelect({ kind: 'skill', relativePath: skill.relativePath })}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-[12px] text-dim">No skill files.</p>
        )}
        <div className="border-y border-border-subtle px-3 py-2">
          <SectionLabel tone="muted">Activity</SectionLabel>
        </div>
        <FileRow active={selection.kind === 'activity'} title="Recent changes" onClick={() => onSelect({ kind: 'activity' })} />
      </div>
    </aside>
  );
}

export function MemoryPage() {
  const [state, setState] = useState<ManagedMemoryState | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: 'system' });
  const [history, setHistory] = useState<MemoryGitChange[]>([]);
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    setError(null);
    setActionError(null);
    setState(await api.managedMemory());
  }

  async function runAction(key: string, action: () => Promise<ManagedMemoryState | { state: ManagedMemoryState }>) {
    setActionError(null);
    setBusy(key);
    try {
      const result = await action();
      setState('state' in result ? result.state : result);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .managedMemory()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScope = selection.kind === 'scope' ? (state?.scopes.find((scope) => scope.slug === selection.slug) ?? null) : null;
  const selectedSkill =
    selection.kind === 'skill' ? (state?.skills.find((skill) => skill.relativePath === selection.relativePath) ?? null) : null;
  const selectedPath = selection.kind === 'system' ? 'system.md' : (selectedScope?.relativePath ?? selectedSkill?.relativePath ?? null);
  const latestChangeHash = state?.recentChanges[0]?.hash ?? '';

  useEffect(() => {
    setActionError(null);
  }, [selection]);

  useEffect(() => {
    if (!selectedPath || selection.kind === 'activity') {
      setHistory([]);
      setHistoryPath(null);
      return;
    }
    let cancelled = false;
    api.memoryFileHistory(selectedPath).then((result) => {
      if (!cancelled) {
        setHistory(result.history);
        setHistoryPath(selectedPath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPath, selection.kind, latestChangeHash]);

  const activeScopes = useMemo(() => state?.scopes.filter((scope) => scope.active) ?? [], [state?.scopes]);

  if (loading) return <CenteredLoadingState label="Loading memory..." />;

  if (error) {
    return (
      <AppPageLayout>
        <AppPageIntro title="Memory" actions={<Button onClick={reload}>Retry</Button>} />
        <Notice tone="warning">{error}</Notice>
      </AppPageLayout>
    );
  }

  if (!state?.initialized) {
    return (
      <AppPageLayout shellClassName="flex h-full min-h-0 flex-col p-0" contentClassName="flex h-full min-h-0 flex-col">
        <AppPageIntro
          title="Memory"
          className="shrink-0 border-b border-border-subtle px-5 py-3"
          actions={
            <Button
              variant="action"
              onClick={async () => {
                setLoading(true);
                try {
                  setState(await api.initializeManagedMemory());
                } finally {
                  setLoading(false);
                }
              }}
            >
              Create memory
            </Button>
          }
        />
        <div className="grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)] overflow-hidden bg-base">
          <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-panel/70">
            <div className="shrink-0 border-b border-border-subtle px-3 py-2">
              <SectionLabel tone="muted">Files</SectionLabel>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="border-b border-border-subtle px-3 py-2">
                <SectionLabel tone="muted">System</SectionLabel>
              </div>
              <FileRow active title="system.md" meta="pending" onClick={() => undefined} />
              <div className="border-y border-border-subtle px-3 py-2">
                <SectionLabel tone="muted">Scopes</SectionLabel>
              </div>
              <p className="px-3 py-2 text-[12px] text-dim">No scope files.</p>
              <div className="border-y border-border-subtle px-3 py-2">
                <SectionLabel tone="muted">Skills</SectionLabel>
              </div>
              <p className="px-3 py-2 text-[12px] text-dim">No skill files.</p>
            </div>
          </aside>
          <main className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border-subtle px-4 py-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-primary">system.md</h2>
                  <p className="mt-1 truncate text-[12px] text-secondary">Memory repository is not initialized.</p>
                </div>
              </div>
              <div className="mt-2 truncate font-mono text-[11px] text-dim">{state?.root ?? 'memory/'}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-5 text-secondary">
              <p className="font-sans text-[13px] text-primary">Create memory to initialize the Git-backed file tree.</p>
              <p className="mt-3">memory/</p>
              <p> system.md</p>
              <p> scopes/</p>
              <p> skills/</p>
              <p> reflections/</p>
            </div>
          </main>
        </div>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout shellClassName="flex h-full min-h-0 flex-col p-0" contentClassName="flex h-full min-h-0 flex-col">
      <AppPageIntro
        title="Memory"
        className="shrink-0 border-b border-border-subtle px-5 py-3"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-secondary">
              {state.git.branch ?? 'Git'} {state.git.remoteUrl ? ' · remote configured' : ' · local only'}
            </span>
            <Button onClick={reload}>Refresh</Button>
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)] overflow-hidden bg-base">
        <MemoryFileNavigator
          state={state}
          selection={selection}
          activeScopes={activeScopes}
          busy={busy}
          onSelect={setSelection}
          onCreateCurrentScope={() =>
            runAction('scope-current', () => api.createMemoryScopeFromCwd({ reason: 'Add current workspace memory scope' }))
          }
          onCreateScope={async (input) => {
            setState(await api.createMemoryScope({ ...input, type: 'workspace', inject: true, reason: `Add ${input.name} memory scope` }));
          }}
        />
        <main className="grid min-h-0 grid-rows-[minmax(0,1fr)_12.5rem] overflow-hidden bg-base">
          <section className="min-h-0 overflow-hidden">
            {actionError ? (
              <div className="shrink-0 border-b border-border-subtle">
                <Notice tone="danger">{actionError}</Notice>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
              {selection.kind === 'system' ? (
                <MemoryEditor
                  relativePath="system.md"
                  title="System memory"
                  description="Always injected into agent context."
                  content={state.system.content}
                  onSave={async (content, reason) => {
                    setActionError(null);
                    setState(await api.writeMemoryFile({ relativePath: 'system.md', content, reason }));
                  }}
                />
              ) : selectedScope ? (
                <MemoryEditor
                  relativePath={selectedScope.relativePath}
                  title={selectedScope.name}
                  description={selectedScope.active ? 'Active for the current workspace.' : 'Loaded when its activation rules match.'}
                  content={selectedScope.content}
                  onSave={async (content, reason) => {
                    setActionError(null);
                    setState(await api.writeMemoryFile({ relativePath: selectedScope.relativePath, content, reason }));
                  }}
                />
              ) : selectedSkill ? (
                <MemoryEditor
                  relativePath={selectedSkill.relativePath}
                  title={selectedSkill.name}
                  description="Description is discoverable; full skill loads on demand."
                  content={selectedSkill.content}
                  onSave={async (content, reason) => {
                    setActionError(null);
                    setState(await api.writeMemoryFile({ relativePath: selectedSkill.relativePath, content, reason }));
                  }}
                />
              ) : selection.kind === 'activity' ? (
                <div className="h-full overflow-auto">
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h2 className="text-[16px] font-semibold text-primary">Recent changes</h2>
                    <p className="mt-1 text-[12px] text-secondary">Git commits created by memory initialization and edits.</p>
                  </div>
                  <ChangeList changes={state.recentChanges} />
                </div>
              ) : null}
            </div>
          </section>
          <MemoryInspector
            state={state}
            history={history}
            historyPath={historyPath}
            busy={busy}
            onSetRemote={(url) => runAction('remote', () => api.setMemoryRemote({ url }))}
            onSync={() => runAction('sync', () => api.syncMemoryRemote())}
            onImportKnowledge={() => runAction('import', () => api.importKnowledgeMemory())}
          />
        </main>
      </div>
    </AppPageLayout>
  );
}
