import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  cx,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  MetaLabel,
  ResourceList,
  ResourceListRow,
  SearchInput,
  TabButton,
  TabList,
  TabPanel,
} from '@neon-pilot/extensions/ui';
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
    <AppPageLayout contentClassName="space-y-6">
      <AppPageIntro title="Skills" />

      <FilterToolbar
        className="pb-5"
        filters={
          <TabList ariaLabel="Skill filters">
            {TABS.map((tab) => (
              <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label} <span className="text-dim">{counts[tab.id]}</span>
              </TabButton>
            ))}
          </TabList>
        }
        search={
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills…"
            className="w-full md:w-72"
          />
        }
      />

      <TabPanel>
        {filtered.length === 0 ? (
          <EmptyState title="No skills" body="No skills match the current filters." />
        ) : (
          <ResourceList className="border-subtle">
            {filtered.map((skill) => (
              <ResourceListRow
                key={`${skill.source}:${skill.id}:${skill.path}`}
                title={skill.name}
                meta={<MetaLabel tone="muted">{sourceLabel(skill)}</MetaLabel>}
                detail={skill.sourceLabel ?? skill.path}
                titleClassName="text-[13px]"
                detailClassName="text-[11px]"
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => void toggleSkill(skill)}
                    className={cx(
                      'rounded-full px-3 py-1 text-[12px]',
                      skill.enabled ? 'border-success/40 bg-success/10 text-success' : 'border-subtle bg-muted text-secondary',
                    )}
                  >
                    {skill.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                }
              >
                {skill.description ? <p className="text-[12px] text-secondary">{skill.description}</p> : null}
              </ResourceListRow>
            ))}
          </ResourceList>
        )}
      </TabPanel>
    </AppPageLayout>
  );
}
