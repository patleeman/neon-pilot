import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, cx, EmptyState, ErrorState, LoadingState, SearchInput } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SkillSource = 'extension' | 'knowledge' | 'project' | string;
type SkillTab = 'all' | 'extension' | 'knowledge' | 'enabled' | 'disabled';

interface SkillItem {
  id: string;
  name: string;
  description?: string;
  path: string;
  source: SkillSource;
  sourceLabel?: string;
  extensionId?: string;
  enabled: boolean;
}

interface ListSkillsResult {
  skills?: SkillItem[];
}

const TABS: Array<{ id: SkillTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'extension', label: 'Extensions' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' },
];

function sourceLabel(skill: SkillItem): string {
  if (skill.source === 'extension') return 'Extension';
  if (skill.source === 'knowledge') return 'Knowledge';
  if (skill.source === 'project') return 'Project';
  return skill.sourceLabel || skill.source;
}

export function SkillsPage({ pa }: ExtensionSurfaceProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [activeTab, setActiveTab] = useState<SkillTab>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = (await pa.extension.invoke('listSkills', {})) as ListSkillsResult;
      setSkills(result.skills ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: skills.length,
      extension: skills.filter((skill) => skill.source === 'extension').length,
      knowledge: skills.filter((skill) => skill.source === 'knowledge' || skill.source === 'project').length,
      enabled: skills.filter((skill) => skill.enabled).length,
      disabled: skills.filter((skill) => !skill.enabled).length,
    }),
    [skills],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'extension' && skill.source === 'extension') ||
        (activeTab === 'knowledge' && (skill.source === 'knowledge' || skill.source === 'project')) ||
        (activeTab === 'enabled' && skill.enabled) ||
        (activeTab === 'disabled' && !skill.enabled);
      if (!matchesTab) return false;
      if (!normalizedQuery) return true;
      return `${skill.name} ${skill.id} ${skill.description ?? ''} ${skill.path}`.toLowerCase().includes(normalizedQuery);
    });
  }, [activeTab, query, skills]);

  const toggleSkill = useCallback(
    async (skill: SkillItem) => {
      const enabled = !skill.enabled;
      setSkills((current) => current.map((item) => (item.id === skill.id ? { ...item, enabled } : item)));
      try {
        await pa.extension.invoke('updateSkillEnabled', { id: skill.id, enabled });
      } catch (err) {
        setSkills((current) => current.map((item) => (item.id === skill.id ? { ...item, enabled: !enabled } : item)));
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [pa],
  );

  if (loading) return <LoadingState label="Loading skills…" />;
  if (error) return <ErrorState title="Failed to load skills" message={error} />;

  return (
    <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
      <AppPageIntro title="Skills" summary="Enable or disable agent skills. Disabled skills are hidden from the agent’s context." />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/70 pb-5">
        <div className="flex flex-wrap items-center gap-1 text-[12px]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cx(
                'rounded-xl px-3 py-2 text-secondary transition-colors',
                activeTab === tab.id ? 'bg-surface text-primary shadow-sm' : 'hover:bg-surface/60 hover:text-primary',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} <span className="text-dim">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search skills…"
          className="w-full md:w-72"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No skills" body="No skills match the current filters." />
      ) : (
        <div className="divide-y divide-subtle border-y border-subtle">
          {filtered.map((skill) => (
            <div key={`${skill.source}:${skill.id}:${skill.path}`} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[13px] font-semibold text-primary">{skill.name}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-dim">{sourceLabel(skill)}</span>
                  </div>
                  {skill.description ? <p className="mt-1 text-[12px] text-secondary">{skill.description}</p> : null}
                  <p className="mt-1 truncate text-[11px] text-dim">{skill.sourceLabel ?? skill.path}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleSkill(skill)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-[12px]',
                    skill.enabled ? 'border-success/40 bg-success/10 text-success' : 'border-subtle bg-muted text-secondary',
                  )}
                >
                  {skill.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppPageLayout>
  );
}
