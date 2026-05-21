import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { api } from '@neon-pilot/extensions/data';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';
type Filter = 'all' | CapabilityKind | 'active' | 'disabled' | 'issues';

interface CommandInspectorEntry {
  id?: string;
  surfaceId?: string;
  extensionId?: string;
  title?: string;
  category?: string;
  action?: string;
  args?: unknown;
  argsSchema?: unknown;
  enablement?: string;
}

interface KeybindingInspectorEntry {
  extensionId: string;
  surfaceId: string;
  title: string;
  keys: string[];
  command: string;
  args?: unknown;
  when?: string;
  scope: 'global' | 'surface';
  enabled: boolean;
  defaultKeys: string[];
  packageType?: 'user' | 'system';
}

interface CommandWithKeybindings extends CommandInspectorEntry {
  keybindings: KeybindingInspectorEntry[];
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'extension', label: 'Extensions' },
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

export function PromptAssemblyPage({ pa, context }: ExtensionSurfaceProps) {
  const [data, setData] = useState<AgentRuntimeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [section, setSection] = useState<'app-control' | 'agent-context'>('app-control');
  const [query, setQuery] = useState('');
  const [commandQuery, setCommandQuery] = useState('');
  const [commands, setCommands] = useState<CommandInspectorEntry[]>([]);
  const [keybindings, setKeybindings] = useState<KeybindingInspectorEntry[]>([]);
  const [keybindingDraft, setKeybindingDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    void Promise.all([pa.commands.list(), api.extensionKeybindings()])
      .then(([commandItems, keybindingItems]) => {
        if (!cancelled) {
          setCommands(commandItems as CommandInspectorEntry[]);
          setKeybindings(keybindingItems as KeybindingInspectorEntry[]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommands([]);
          setKeybindings([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pa]);

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

  const commandRows = useMemo<CommandWithKeybindings[]>(() => {
    const rows = commands.map((command) => {
      const matches = keybindings.filter((keybinding) => keybindingMatchesCommand(keybinding, command));
      return {
        ...command,
        keybindings: matches.length ? matches : [customKeybindingForCommand(command)],
      };
    });
    const commandKeys = new Set(commands.map(commandKey));
    const keybindingOnlyRows = keybindings
      .filter((keybinding) => !commandKeys.has(keybindingCommandKey(keybinding)))
      .map((keybinding) => ({
        id: keybinding.command,
        surfaceId: keybinding.command,
        extensionId: keybinding.extensionId,
        title: keybinding.title,
        category: keybinding.scope === 'surface' ? 'surface shortcut' : 'shortcut',
        action: keybinding.command,
        keybindings: [keybinding],
      }));
    return [...rows, ...keybindingOnlyRows];
  }, [commands, keybindings]);

  const visibleCommands = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase();
    if (!needle) return commandRows;
    return commandRows.filter((command) =>
      [
        command.title,
        command.id,
        command.surfaceId,
        command.extensionId,
        command.category,
        command.action,
        command.enablement,
        ...command.keybindings.flatMap((keybinding) => [keybinding.title, keybinding.command, keybinding.keys.join(' '), keybinding.when]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [commandQuery, commandRows]);

  const visibleExtensions = useMemo(() => visible.filter((capability) => capability.kind === 'extension'), [visible]);
  const visibleAgentCapabilities = useMemo(() => visible.filter((capability) => capability.kind !== 'extension'), [visible]);

  async function saveKeybinding(keybinding: KeybindingInspectorEntry, keysText: string) {
    setError(null);
    const keys = keysText
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) {
      setError('Keybinding must include at least one shortcut. Use Disable to turn it off.');
      return;
    }
    const id = keybindingId(keybinding);
    setBusyId(id);
    try {
      await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, {
        title: keybinding.title,
        command: keybinding.command,
        args: keybinding.args,
        scope: keybinding.scope,
        packageType: keybinding.packageType,
        keys,
        enabled: true,
      });
      setKeybindings((items) => items.map((item) => (keybindingId(item) === id ? { ...item, keys, enabled: true } : item)));
      setKeybindingDraft((current) => ({ ...current, [id]: keys.join(', ') }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleKeybinding(keybinding: KeybindingInspectorEntry) {
    setError(null);
    const id = keybindingId(keybinding);
    const enabled = !keybinding.enabled;
    setBusyId(id);
    try {
      await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, {
        title: keybinding.title,
        command: keybinding.command,
        args: keybinding.args,
        scope: keybinding.scope,
        packageType: keybinding.packageType,
        enabled,
      });
      setKeybindings((items) => items.map((item) => (keybindingId(item) === id ? { ...item, enabled } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState title="Failed to inspect agent runtime" message={error} />;
  if (!data) return <LoadingState label="Inspecting agent runtime…" />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro
        title="Agent Runtime"
        summary="Inspect every capability the agent can see: extensions, instruction files, skills, injected tools, MCP servers, templates, and context."
        actions={<ToolbarButton onClick={() => void load()}>Refresh</ToolbarButton>}
      />

      <Overview
        capabilities={data.capabilities}
        counts={data.counts}
        diagnostics={data.diagnostics ?? []}
        repoRoot={data.repoRoot}
        cwd={data.cwd}
      />

      <div className="flex flex-wrap gap-1 border-b border-border-subtle/70 pb-5">
        {[
          { id: 'app-control' as const, label: 'App control' },
          { id: 'agent-context' as const, label: 'Agent context' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(
              'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              section === item.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
            )}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'app-control' ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-primary">Commands</h2>
                <p className="text-[13px] leading-6 text-secondary">
                  {formatCount(visibleCommands.length, 'command')} shown · {formatCount(commands.length, 'command')} registered ·{' '}
                  {formatCount(keybindings.length, 'keybinding')}
                </p>
              </div>
              <input
                className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search commands…"
              />
            </div>
            {visibleCommands.length ? (
              <CommandTable
                rows={visibleCommands}
                busyId={busyId}
                drafts={keybindingDraft}
                onDraftChange={(id, value) => setKeybindingDraft((current) => ({ ...current, [id]: value }))}
                onSaveKeybinding={saveKeybinding}
                onToggleKeybinding={toggleKeybinding}
              />
            ) : (
              <EmptyState title="No commands found" body="Adjust the search query." />
            )}
          </section>

          <section className="space-y-4 border-t border-border-subtle/70 pt-6">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-primary">Extensions</h2>
              <p className="text-[13px] leading-6 text-secondary">Product modules that control Neon Pilot surfaces and behavior.</p>
            </div>
            {visibleExtensions.length ? (
              <CapabilityTable rows={visibleExtensions} busyId={busyId} onToggle={toggleCapability} />
            ) : (
              <EmptyState title="No extensions found" body="Adjust the runtime search query." />
            )}
          </section>
        </div>
      ) : null}

      {section === 'agent-context' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-primary">Agent context</h2>
              <p className="text-[13px] leading-6 text-secondary">
                {formatCount(visibleAgentCapabilities.length, 'capability')} shown: instructions, skills, tools, MCP, templates, and
                context.
              </p>
            </div>
            <input
              className="w-72 rounded-xl border border-border-subtle bg-surface/40 px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-dim focus:border-accent/50"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search runtime…"
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
      ) : null}
    </AppPageLayout>
  );
}

function Overview({
  capabilities,
  counts,
  diagnostics,
  repoRoot,
  cwd,
}: {
  capabilities: RuntimeCapability[];
  counts: Record<string, number>;
  diagnostics: unknown[];
  repoRoot: string;
  cwd?: string;
}) {
  const extensions = capabilities.filter((capability) => capability.kind === 'extension');
  const activeExtensions = extensions.filter(
    (extension) => extension.enabled && extension.status !== 'disabled' && extension.status !== 'invalid',
  );
  const stats = [
    ['Extensions', extensions.length || (counts.extension ?? 0)],
    ['Active Extensions', activeExtensions.length],
    ['Instructions', counts.instruction ?? 0],
    ['Skills', counts.skill ?? 0],
    ['Tools', counts.tool ?? 0],
    ['Issues', diagnostics.length],
  ];
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="border-t border-border-subtle pt-3">
            <div className="text-[22px] font-semibold tracking-tight text-primary">{value}</div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-dim">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-dim">
        CWD <span className="text-secondary">{cwd ?? repoRoot}</span>
      </p>
    </section>
  );
}

function CommandTable({
  rows,
  busyId,
  drafts,
  onDraftChange,
  onSaveKeybinding,
  onToggleKeybinding,
}: {
  rows: CommandWithKeybindings[];
  busyId: string | null;
  drafts: Record<string, string>;
  onDraftChange: (id: string, value: string) => void;
  onSaveKeybinding: (keybinding: KeybindingInspectorEntry, keysText: string) => Promise<void>;
  onToggleKeybinding: (keybinding: KeybindingInspectorEntry) => Promise<void>;
}) {
  return (
    <section className="min-w-0 overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-base/95 backdrop-blur">
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
            <th className="py-2 pr-4 font-semibold">Command</th>
            <th className="py-2 px-3 font-semibold">Source</th>
            <th className="py-2 px-3 font-semibold">Keybindings</th>
            <th className="py-2 px-3 font-semibold">Category</th>
            <th className="py-2 pl-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((command) => {
            const id = command.id ?? command.surfaceId ?? 'unknown';
            const commandId = command.extensionId ? `${command.extensionId}.${id}` : id;
            return (
              <tr
                key={`${command.extensionId ?? 'host'}:${id}`}
                className="border-t border-border-subtle/70 align-top transition-colors hover:bg-surface/30"
              >
                <td className="min-w-0 py-3 pr-4">
                  <div className="truncate text-[14px] font-semibold text-primary">{command.title ?? id}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-dim">{commandId}</div>
                  {command.enablement ? <div className="mt-1 font-mono text-[11px] text-dim">when {command.enablement}</div> : null}
                  {command.argsSchema ? <div className="mt-1 text-[11px] text-secondary">Args schema available</div> : null}
                </td>
                <td className="px-3 py-3 text-[12px] text-secondary">{command.extensionId ?? 'host'}</td>
                <td className="px-3 py-3 text-[12px] text-secondary">
                  {command.keybindings.length ? (
                    <div className="space-y-2">
                      {command.keybindings.map((keybinding) => {
                        const id = keybindingId(keybinding);
                        const draft = drafts[id] ?? keybinding.keys.join(', ');
                        const busy = busyId === id;
                        return (
                          <div key={id} className="flex min-w-72 flex-wrap items-center gap-1.5">
                            <input
                              value={keybinding.enabled ? draft : 'Disabled'}
                              disabled={!keybinding.enabled || busy}
                              onChange={(event) => onDraftChange(id, event.target.value)}
                              className="min-w-48 flex-1 rounded-lg border border-border-subtle bg-base px-2 py-1 font-mono text-[11px] text-primary outline-none focus:border-accent/50 disabled:text-dim"
                              title={formatParts(keybinding.title, keybinding.when ? `when ${keybinding.when}` : undefined)}
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-surface px-2 py-1 text-[11px] text-secondary hover:text-primary disabled:opacity-50"
                              disabled={busy || !keybinding.enabled}
                              onClick={() => void onSaveKeybinding(keybinding, draft)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-surface px-2 py-1 text-[11px] text-secondary hover:text-primary disabled:opacity-50"
                              disabled={busy}
                              onClick={() => void onToggleKeybinding(keybinding)}
                            >
                              {keybinding.enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-[12px] text-secondary">{command.category ?? '—'}</td>
                <td className="py-3 pl-3 font-mono text-[11px] text-secondary">{command.action ?? 'host'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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

function commandKey(command: CommandInspectorEntry): string {
  return command.extensionId
    ? `${command.extensionId}:${command.id ?? command.surfaceId ?? ''}`
    : `host:${command.id ?? command.surfaceId ?? ''}`;
}

function keybindingCommandKey(keybinding: KeybindingInspectorEntry): string {
  return `${keybinding.extensionId}:${keybinding.command.replace(`${keybinding.extensionId}.`, '')}`;
}

function keybindingId(keybinding: KeybindingInspectorEntry): string {
  return `${keybinding.extensionId}:${keybinding.surfaceId}`;
}

function customKeybindingForCommand(command: CommandInspectorEntry): KeybindingInspectorEntry {
  const commandId = command.extensionId
    ? `${command.extensionId}.${command.id ?? command.surfaceId ?? ''}`
    : (command.id ?? command.surfaceId ?? '');
  return {
    extensionId: command.extensionId ?? 'host',
    surfaceId: `command:${commandId}`,
    title: command.title ?? commandId,
    keys: [],
    command: commandId,
    args: command.args,
    scope: 'global',
    enabled: true,
    defaultKeys: [],
    packageType: command.extensionId ? 'user' : 'system',
  };
}

function keybindingMatchesCommand(keybinding: KeybindingInspectorEntry, command: CommandInspectorEntry): boolean {
  if (!command.extensionId || command.extensionId !== keybinding.extensionId) return false;
  const id = command.id ?? command.surfaceId ?? '';
  const action = command.action ?? '';
  const keybindingCommand = keybinding.command.replace(`${keybinding.extensionId}.`, '');
  return keybindingCommand === id || keybindingCommand === action || keybinding.command === `${command.extensionId}.${id}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
