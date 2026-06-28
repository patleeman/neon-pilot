import { useEffect, useMemo, useState } from 'react';

import { api } from '../client/api';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CardMeta,
  CenteredLoadingState,
  EmptyState,
  Notice,
  SectionLabel,
  SurfacePanel,
  Textarea,
  TextInput,
} from '../components/ui';
import type { ManagedMemoryState, MemoryGitChange, MemoryScope } from '../shared/types';

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

function NavRow({ active, title, meta, onClick }: { active: boolean; title: string; meta?: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      className={`w-full min-w-0 px-3 py-2 text-left hover:bg-surface-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
        active ? 'bg-surface-selected text-primary' : 'text-secondary'
      }`}
    >
      <span className="block truncate text-[13px] font-medium">{title}</span>
      {meta ? <span className="mt-0.5 block truncate text-[11px] text-dim">{meta}</span> : null}
    </Button>
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
    return <Button onClick={() => setOpen(true)}>New scope</Button>;
  }

  return (
    <div className="border-t border-border-subtle p-3">
      <div className="space-y-2">
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Name</span>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-base px-2 py-1.5 text-[13px] text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Roots</span>
          <Textarea
            value={roots}
            onChange={(event) => setRoots(event.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-md border border-border bg-base px-2 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase text-dim">Aliases</span>
          <Textarea
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-md border border-border bg-base px-2 py-1.5 text-[12px] text-primary outline-none focus:border-accent"
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
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-primary">{title}</h2>
            <p className="mt-1 truncate text-[12px] text-secondary">{description}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {editing ? (
              <>
                <Button
                  variant="action"
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
                </Button>
                <Button
                  onClick={() => {
                    setDraft(content);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        </div>
        <div className="mt-2 truncate font-mono text-[11px] text-dim">{relativePath}</div>
      </div>
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-0 flex-1 resize-none rounded-md border border-border bg-base p-3 font-mono text-[12px] leading-5 text-primary outline-none focus:border-accent"
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
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-5 text-primary">
          {content || 'No content.'}
        </pre>
      )}
    </div>
  );
}

export function MemoryPage() {
  const [state, setState] = useState<ManagedMemoryState | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: 'system' });
  const [history, setHistory] = useState<MemoryGitChange[]>([]);
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    setState(await api.managedMemory());
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
      <AppPageLayout>
        <AppPageIntro title="Memory" />
        <SurfacePanel className="max-w-2xl p-5">
          <EmptyState
            title="Create local memory"
            body={`Neon Pilot will create a Git-backed memory folder at ${state?.root ?? 'the configured memory root'}. Agents can update it directly; every change is committed for inspection and recovery.`}
            action={
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
        </SurfacePanel>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout contentClassName="h-full min-h-0">
      <AppPageIntro
        title="Memory"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-secondary">
              {state.git.branch ?? 'Git'} {state.git.remoteUrl ? ' · remote configured' : ' · local only'}
            </span>
            <Button onClick={reload}>Refresh</Button>
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_20rem] overflow-hidden rounded-lg border border-border bg-panel">
        <aside className="min-h-0 overflow-auto border-r border-border-subtle">
          <div className="border-b border-border-subtle px-3 py-2">
            <SectionLabel tone="muted">System</SectionLabel>
          </div>
          <NavRow
            active={selection.kind === 'system'}
            title="system.md"
            meta="Always loaded"
            onClick={() => setSelection({ kind: 'system' })}
          />
          <div className="mt-2 border-y border-border-subtle px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel tone="muted">Scopes</SectionLabel>
              <span className="text-[11px] text-dim">{activeScopes.length} active</span>
            </div>
          </div>
          {state.scopes.length > 0 ? (
            state.scopes.map((scope: MemoryScope) => (
              <NavRow
                key={scope.slug}
                active={selection.kind === 'scope' && selection.slug === scope.slug}
                title={scope.name}
                meta={scope.active ? 'Active for current workspace' : scope.roots[0] || scope.type}
                onClick={() => setSelection({ kind: 'scope', slug: scope.slug })}
              />
            ))
          ) : (
            <p className="px-3 py-2 text-[12px] text-dim">No scopes.</p>
          )}
          <ScopeForm
            onCreate={async (input) => {
              setState(
                await api.createMemoryScope({ ...input, type: 'workspace', inject: true, reason: `Add ${input.name} memory scope` }),
              );
            }}
          />
          <div className="mt-2 border-y border-border-subtle px-3 py-2">
            <SectionLabel tone="muted">Skills</SectionLabel>
          </div>
          {state.skills.length > 0 ? (
            state.skills.map((skill) => (
              <NavRow
                key={skill.relativePath}
                active={selection.kind === 'skill' && selection.relativePath === skill.relativePath}
                title={skill.name}
                meta={skill.description || fileLabel(skill.relativePath)}
                onClick={() => setSelection({ kind: 'skill', relativePath: skill.relativePath })}
              />
            ))
          ) : (
            <p className="px-3 py-2 text-[12px] text-dim">No memory skills.</p>
          )}
          <div className="mt-2 border-y border-border-subtle px-3 py-2">
            <SectionLabel tone="muted">Activity</SectionLabel>
          </div>
          <NavRow active={selection.kind === 'activity'} title="Recent changes" onClick={() => setSelection({ kind: 'activity' })} />
        </aside>
        <main className="min-h-0 overflow-hidden bg-base">
          {selection.kind === 'system' ? (
            <MemoryEditor
              relativePath="system.md"
              title="System memory"
              description="Always injected into agent context."
              content={state.system.content}
              onSave={async (content, reason) => setState(await api.writeMemoryFile({ relativePath: 'system.md', content, reason }))}
            />
          ) : selectedScope ? (
            <MemoryEditor
              relativePath={selectedScope.relativePath}
              title={selectedScope.name}
              description={selectedScope.active ? 'Active for the current workspace.' : 'Loaded when its activation rules match.'}
              content={selectedScope.content}
              onSave={async (content, reason) =>
                setState(await api.writeMemoryFile({ relativePath: selectedScope.relativePath, content, reason }))
              }
            />
          ) : selectedSkill ? (
            <MemoryEditor
              relativePath={selectedSkill.relativePath}
              title={selectedSkill.name}
              description="Description is discoverable; full skill loads on demand."
              content={selectedSkill.content}
              onSave={async (content, reason) =>
                setState(await api.writeMemoryFile({ relativePath: selectedSkill.relativePath, content, reason }))
              }
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
        </main>
        <aside className="min-h-0 overflow-auto border-l border-border-subtle bg-panel">
          <div className="border-b border-border-subtle px-3 py-2">
            <SectionLabel tone="muted">{historyPath ? 'File History' : 'Recent Changes'}</SectionLabel>
          </div>
          <ChangeList changes={historyPath ? history : state.recentChanges} />
          <div className="border-t border-border-subtle px-3 py-2">
            <CardMeta as="div">{state.root}</CardMeta>
          </div>
        </aside>
      </div>
    </AppPageLayout>
  );
}
