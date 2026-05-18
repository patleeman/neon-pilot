import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import { AppPageIntro, AppPageLayout, cx } from '@personal-agent/extensions/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  source: 'extension' | 'vault';
  extensionId?: string;
  extensionName?: string;
  enabled: boolean;
}

interface SkillFoldersState {
  configFile: string;
  skillDirs: string[];
}

type FilterTab = 'all' | 'extension' | 'vault' | 'enabled' | 'disabled';

// ── Icons ─────────────────────────────────────────────────────────────────────

function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5v9A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-9Z" />
      <path d="M6 5h4M6 7.5h4M6 10h2.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3h8l2 2v8H3V3ZM6 3v3h4V3M5 13v-4h6v4" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2H13a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 13 14H3.5A1.5 1.5 0 0 1 2 12.5v-8Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cx('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

// ── Status toggle ─────────────────────────────────────────────────────────────

function StatusToggle({ enabled, busy, onToggle }: { enabled: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-[12px] text-secondary transition-colors hover:text-primary disabled:opacity-50"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={enabled ? 'Disable skill' : 'Enable skill'}
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full border transition-colors',
          enabled ? 'border-success/40 bg-success/20' : 'border-border-subtle bg-surface/60',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left,background-color]',
            enabled ? 'left-[18px] bg-success' : 'left-1 bg-dim',
          )}
        />
      </span>
      <span>{enabled ? 'Enabled' : 'Disabled'}</span>
    </button>
  );
}

// ── Skill folders panel ───────────────────────────────────────────────────────

function SkillFoldersPanel({ pa }: { pa: ExtensionSurfaceProps['pa'] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SkillFoldersState | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await pa.extension.invoke('readSkillFolders', {})) as SkillFoldersState & { ok: boolean };
      setState(result);
      setDraft(result.skillDirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill folders');
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    if (open && !state) void load();
  }, [open, state, load]);

  const save = useCallback(
    async (dirs: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const result = (await pa.extension.invoke('writeSkillFolders', { skillDirs: dirs })) as SkillFoldersState & {
          ok: boolean;
        };
        setState(result);
        setDraft(result.skillDirs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save skill folders');
      } finally {
        setSaving(false);
      }
    },
    [pa],
  );

  const handleAdd = useCallback(() => {
    setDraft((prev) => [...prev, '']);
  }, []);

  const handleChange = useCallback((index: number, value: string) => {
    setDraft((prev) => prev.map((d, i) => (i === index ? value : d)));
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      const next = draft.filter((_, i) => i !== index);
      setDraft(next);
      void save(next);
    },
    [draft, save],
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = [...draft];
      const swap = index + direction;
      if (swap < 0 || swap >= next.length) return;
      [next[index], next[swap]] = [next[swap], next[index]];
      setDraft(next);
      void save(next);
    },
    [draft, save],
  );

  const handleBlur = useCallback(
    (index: number) => {
      const trimmed = draft[index]?.trim();
      if (!trimmed) {
        // Remove empty entry on blur
        const next = draft.filter((_, i) => i !== index);
        setDraft(next);
        void save(next);
      } else {
        void save(draft);
      }
    },
    [draft, save],
  );

  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-6 py-3 text-left transition-colors hover:bg-base/40"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronIcon open={open} />
        <FolderIcon />
        <span className="text-[13px] font-medium text-primary">Skill source folders</span>
        <span className="ml-1 text-[12px] text-dim">
          {state ? `${state.skillDirs.length} extra ${state.skillDirs.length === 1 ? 'folder' : 'folders'}` : ''}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border-subtle bg-base/30 px-6 py-4">
          {loading ? (
            <p className="text-[12px] text-dim">Loading…</p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-secondary">
                Extra folders scanned for skills alongside the root vault directory. Configured in{' '}
                <span className="font-mono text-[11px] text-dim">{state?.configFile ?? '…'}</span>.
              </p>

              {draft.length === 0 ? (
                <p className="mb-3 text-[12px] text-dim">No extra skill folders configured.</p>
              ) : (
                <div className="mb-3 space-y-2">
                  {draft.map((path, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={path}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onBlur={() => handleBlur(index)}
                        placeholder="/path/to/skills"
                        className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-border focus:ring-1 focus:ring-border"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() => handleMove(index, -1)}
                        disabled={saving || index === 0}
                        className="text-[12px] text-dim disabled:opacity-30 hover:text-primary"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 1)}
                        disabled={saving || index === draft.length - 1}
                        className="text-[12px] text-dim disabled:opacity-30 hover:text-primary"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        disabled={saving}
                        className="text-[12px] text-dim disabled:opacity-30 hover:text-danger"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-[12px] text-secondary transition-colors hover:bg-base hover:text-primary disabled:opacity-50"
                >
                  Add folder
                </button>
                {saving ? <span className="text-[12px] text-dim">Saving…</span> : null}
                {error ? <span className="text-[12px] text-danger">{error}</span> : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Skill editor panel ────────────────────────────────────────────────────────

function SkillEditor({ skill, pa, onClose }: { skill: SkillEntry; pa: ExtensionSurfaceProps['pa']; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isVault = skill.source === 'vault';

  useEffect(() => {
    setLoading(true);
    setError(null);
    pa.extension
      .invoke('readSkillFile', { path: skill.path })
      .then((result) => {
        const r = result as { ok: boolean; content: string };
        setContent(r.content);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to read skill file');
      })
      .finally(() => setLoading(false));
  }, [skill.path, pa]);

  const handleSave = useCallback(async () => {
    if (content === null) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await pa.extension.invoke('writeSkillFile', { path: skill.path, content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skill file');
    } finally {
      setSaving(false);
    }
  }, [content, skill.path, pa]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2">
          <BookIcon />
          <span className="text-[13px] font-semibold text-primary">{skill.title}</span>
          <span
            className={cx(
              'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              skill.source === 'vault' ? 'bg-accent/10 text-accent' : 'bg-base text-dim',
            )}
          >
            {skill.source === 'vault' ? 'Vault' : 'Extension'}
          </span>
        </div>
        <button type="button" className="ui-icon-button ui-icon-button-compact" onClick={onClose} aria-label="Close editor">
          <CloseIcon />
        </button>
      </div>

      {/* Meta */}
      <div className="border-b border-border-subtle px-5 py-3">
        {skill.description ? <p className="mb-2 text-[12px] leading-5 text-secondary">{skill.description}</p> : null}
        <p className="break-all font-mono text-[11px] text-dim">{skill.path}</p>
        {skill.extensionName ? (
          <p className="mt-1 text-[11px] text-dim">
            From extension: <span className="text-secondary">{skill.extensionName}</span>
          </p>
        ) : null}
      </div>

      {/* Editor body */}
      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-dim">Loading…</div>
        ) : error ? (
          <div className="rounded-lg bg-danger/10 px-4 py-3 text-[12px] text-danger">{error}</div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-dim">SKILL.md</span>
              {!isVault ? <span className="text-[11px] text-dim italic">Read-only — edit source extension to modify</span> : null}
            </div>
            <textarea
              className={cx(
                'min-h-0 flex-1 resize-none rounded-lg border border-border-subtle bg-base px-3 py-2.5 font-mono text-[12px] leading-5 text-primary outline-none',
                'focus:border-border focus:ring-1 focus:ring-border',
                !isVault && 'cursor-default opacity-60',
              )}
              value={content ?? ''}
              readOnly={!isVault}
              onChange={(e) => {
                if (isVault) setContent(e.target.value);
              }}
              spellCheck={false}
            />
            {isVault ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                  disabled={saving}
                  onClick={handleSave}
                >
                  <SaveIcon />
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saved ? <span className="text-[12px] text-success">Saved!</span> : null}
                {error ? <span className="text-[12px] text-danger">{error}</span> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ── Skills list row ───────────────────────────────────────────────────────────

function SkillRow({
  skill,
  selected,
  busy,
  onSelect,
  onToggle,
  onEdit,
}: {
  skill: SkillEntry;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={cx(
        'grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border-subtle px-6 py-4 transition-colors hover:bg-base/60',
        selected && 'bg-base/60',
      )}
      onClick={onSelect}
    >
      {/* Name + source + description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-primary">{skill.title}</span>
          <span
            className={cx(
              'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              skill.source === 'vault' ? 'bg-accent/10 text-accent' : 'bg-base text-dim',
            )}
          >
            {skill.source === 'vault' ? 'Vault' : 'Extension'}
          </span>
        </div>
        {skill.description ? <p className="mt-0.5 truncate text-[12px] text-secondary">{skill.description}</p> : null}
        {skill.extensionName ? <p className="mt-0.5 text-[11px] text-dim">{skill.extensionName}</p> : null}
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <StatusToggle enabled={skill.enabled} busy={busy} onToggle={onToggle} />
        <button
          type="button"
          className="ui-icon-button ui-icon-button-compact"
          title="Edit skill"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <EditIcon />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SkillsManagerPage({ pa }: ExtensionSurfaceProps) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadSkills = useCallback(async () => {
    try {
      const result = (await pa.extension.invoke('listSkills', {})) as { ok: boolean; skills: SkillEntry[] };
      setSkills(result.skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const handleToggle = useCallback(
    async (skill: SkillEntry) => {
      setBusyId(skill.id);
      const nextEnabled = !skill.enabled;
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: nextEnabled } : s)));
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill((s) => (s ? { ...s, enabled: nextEnabled } : s));
      }
      try {
        await pa.extension.invoke('toggleSkill', { skillId: skill.id, enabled: nextEnabled });
      } catch {
        setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: skill.enabled } : s)));
        if (selectedSkill?.id === skill.id) {
          setSelectedSkill((s) => (s ? { ...s, enabled: skill.enabled } : s));
        }
      } finally {
        setBusyId(null);
      }
    },
    [pa, selectedSkill],
  );

  const filteredSkills = skills.filter((skill) => {
    if (filter === 'extension' && skill.source !== 'extension') return false;
    if (filter === 'vault' && skill.source !== 'vault') return false;
    if (filter === 'enabled' && !skill.enabled) return false;
    if (filter === 'disabled' && skill.enabled) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        skill.title.toLowerCase().includes(q) ||
        skill.id.toLowerCase().includes(q) ||
        (skill.description?.toLowerCase().includes(q) ?? false) ||
        (skill.extensionName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const counts = {
    all: skills.length,
    extension: skills.filter((s) => s.source === 'extension').length,
    vault: skills.filter((s) => s.source === 'vault').length,
    enabled: skills.filter((s) => s.enabled).length,
    disabled: skills.filter((s) => !s.enabled).length,
  };

  const tabs: Array<{ id: FilterTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'extension', label: 'Extension' },
    { id: 'vault', label: 'Vault' },
    { id: 'enabled', label: 'Enabled' },
    { id: 'disabled', label: 'Disabled' },
  ];

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: list */}
      <div
        className={cx(
          'flex min-h-0 flex-col overflow-hidden transition-all',
          selectedSkill ? 'w-[480px] min-w-[320px] border-r border-border-subtle' : 'flex-1',
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppPageLayout contentClassName="flex min-h-full flex-col gap-6">
              <div className="flex items-start justify-between">
                <AppPageIntro
                  title="Skills"
                  summary="Enable or disable agent skills. Disabled skills are hidden from the agent's context."
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 border-b border-border-subtle pb-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={cx(
                      'rounded-t px-3 py-1.5 text-[12px] font-medium transition-colors',
                      filter === tab.id ? 'border-b-2 border-primary text-primary' : 'text-secondary hover:text-primary',
                    )}
                  >
                    {tab.label}
                    {counts[tab.id] > 0 ? <span className="ml-1.5 text-[11px] text-dim">{counts[tab.id]}</span> : null}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search skills…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-base px-3 py-2 text-[12px] text-primary placeholder-dim outline-none focus:border-border focus:ring-1 focus:ring-border"
                />
              </div>

              {/* List */}
              {loading ? (
                <div className="flex flex-1 items-center justify-center py-12 text-[12px] text-dim">Loading skills…</div>
              ) : error ? (
                <div className="rounded-lg bg-danger/10 px-4 py-3 text-[12px] text-danger">{error}</div>
              ) : filteredSkills.length === 0 ? (
                <div className="py-12 text-center text-[12px] text-dim">
                  {search ? `No skills match "${search}"` : 'No skills in this category.'}
                </div>
              ) : (
                <div className="-mx-6 -mb-6">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto] border-b border-border-subtle px-6 py-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-dim">Name</span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-dim">Status</span>
                  </div>
                  {filteredSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      selected={selectedSkill?.id === skill.id}
                      busy={busyId === skill.id}
                      onSelect={() => setSelectedSkill((prev) => (prev?.id === skill.id ? null : skill))}
                      onToggle={() => void handleToggle(skill)}
                      onEdit={() => setSelectedSkill(skill)}
                    />
                  ))}
                </div>
              )}
            </AppPageLayout>
          </div>

          {/* Skill source folders — pinned to bottom of list column */}
          <SkillFoldersPanel pa={pa} />
        </div>
      </div>

      {/* Right: detail/editor */}
      {selectedSkill ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <SkillEditor skill={selectedSkill} pa={pa} onClose={() => setSelectedSkill(null)} />
        </div>
      ) : null}
    </div>
  );
}
