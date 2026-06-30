import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  Notice,
  Pill,
  ResourceList,
  ResourceListRow,
  RowButton,
  SearchInput,
  SectionLabel,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TabPanel,
} from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SkillSource = 'extension' | 'knowledge' | 'project' | string;
type SkillView = 'marketplace' | 'manage';
type TrustLevel = 'builtin' | 'trusted' | 'community';
type SourceKind = 'github' | 'hermes-index';

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

interface MarketplaceSource {
  id: string;
  label: string;
  kind: SourceKind;
  trustLevel: TrustLevel;
  enabled: boolean;
  sourceIds: string[];
  installPolicy: 'direct-after-vetting' | 'approval-after-vetting';
}

interface MarketplaceCandidate {
  candidateId: string;
  title: string;
  description: string;
  sourceId: string;
  sourceLabel: string;
  sourceKind: SourceKind;
  trustLevel: TrustLevel;
  identifier: string;
  url: string;
  tags?: string[];
  requiresApproval?: boolean;
}

interface InstalledSkillRecord {
  id: string;
  candidateId?: string;
  name: string;
  title: string;
  description: string;
  trustLevel: TrustLevel;
  sourceId: string;
  sourceLabel: string;
  identifier: string;
  installedAt: string;
  vetting?: { verdict?: string; summary?: string };
}

interface BrowseSkillsResult {
  ok?: boolean;
  query?: string;
  sourceId?: string;
  sources?: MarketplaceSource[];
  candidates?: MarketplaceCandidate[];
  installed?: InstalledSkillRecord[];
}

const DEFAULT_SOURCES: MarketplaceSource[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'github',
    trustLevel: 'trusted',
    enabled: true,
    sourceIds: ['openai-skills-curated', 'openai-skills-system'],
    installPolicy: 'direct-after-vetting',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'github',
    trustLevel: 'trusted',
    enabled: true,
    sourceIds: ['anthropics-skills'],
    installPolicy: 'direct-after-vetting',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    kind: 'github',
    trustLevel: 'trusted',
    enabled: true,
    sourceIds: ['huggingface-skills'],
    installPolicy: 'direct-after-vetting',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA',
    kind: 'github',
    trustLevel: 'trusted',
    enabled: true,
    sourceIds: ['nvidia-skills'],
    installPolicy: 'direct-after-vetting',
  },
  {
    id: 'hermes',
    label: 'Hermes',
    kind: 'hermes-index',
    trustLevel: 'community',
    enabled: true,
    sourceIds: ['hermes-index'],
    installPolicy: 'approval-after-vetting',
  },
];

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceLabel(skill: SkillItem): string {
  if (skill.source === 'extension') return skill.sourceLabel || 'Extension';
  if (skill.source === 'knowledge') return 'Knowledge';
  if (skill.source === 'project') return 'Project';
  return skill.sourceLabel || skill.source;
}

function trustTone(trustLevel: TrustLevel): 'success' | 'warning' | 'muted' {
  if (trustLevel === 'community') return 'warning';
  if (trustLevel === 'trusted' || trustLevel === 'builtin') return 'success';
  return 'muted';
}

function trustLabel(source: Pick<MarketplaceSource, 'trustLevel' | 'installPolicy'>): string {
  if (source.installPolicy === 'approval-after-vetting') return 'Approval required';
  if (source.trustLevel === 'trusted') return 'Trusted';
  return source.trustLevel === 'builtin' ? 'Built in' : 'Community';
}

function candidateCategory(candidate: MarketplaceCandidate): string {
  const haystack = `${candidate.title} ${candidate.description} ${(candidate.tags ?? []).join(' ')}`.toLowerCase();
  if (/pdf|document|spreadsheet|presentation|slide|template|office|sheet|csv|xlsx|docx/.test(haystack)) return 'Productivity';
  if (/code|review|github|git|xcode|ios|security|test|qa|debug|build/.test(haystack)) return 'Coding';
  if (/image|video|audio|browser|computer|chrome|vision/.test(haystack)) return 'Tools';
  return 'Featured';
}

function skillIconLabel(value: string): string {
  const letters = value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || 'SK';
}

function isCandidateInstalled(candidate: MarketplaceCandidate, installed: InstalledSkillRecord[]): boolean {
  return installed.some(
    (skill) =>
      skill.candidateId === candidate.candidateId ||
      skill.identifier === candidate.identifier ||
      skill.title.toLowerCase() === candidate.title.toLowerCase(),
  );
}

function installedUpstreamIds(installed: InstalledSkillRecord[]): Set<string> {
  return new Set(installed.flatMap((skill) => [skill.id, skill.candidateId, skill.identifier].filter(Boolean) as string[]));
}

function groupCandidates(candidates: MarketplaceCandidate[], query: string): Array<{ name: string; candidates: MarketplaceCandidate[] }> {
  if (candidates.length === 0) return [];
  if (query.trim()) return [{ name: 'Results', candidates }];
  const order = ['Featured', 'Productivity', 'Coding', 'Tools'];
  const groups = new Map<string, MarketplaceCandidate[]>();
  for (const candidate of candidates) {
    const category = candidateCategory(candidate);
    groups.set(category, [...(groups.get(category) ?? []), candidate]);
  }
  return order.flatMap((name) => {
    const items = groups.get(name) ?? [];
    return items.length ? [{ name, candidates: items }] : [];
  });
}

function normalizeSources(value: MarketplaceSource[] | undefined): MarketplaceSource[] {
  return value?.length ? value : DEFAULT_SOURCES;
}

export function SkillsPage({ pa }: ExtensionSurfaceProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [sources, setSources] = useState<MarketplaceSource[]>(DEFAULT_SOURCES);
  const [candidates, setCandidates] = useState<MarketplaceCandidate[]>([]);
  const [installedUpstream, setInstalledUpstream] = useState<InstalledSkillRecord[]>([]);
  const [view, setView] = useState<SkillView>('marketplace');
  const [activeSourceId, setActiveSourceId] = useState('openai');
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger' | 'info'; message: string } | null>(null);

  const loadSkills = useCallback(async () => {
    setSkillsError(null);
    setLoadingSkills(true);
    try {
      const result = (await pa.extension.invoke('listSkills', {})) as ListSkillsResult;
      setSkills(result.skills ?? []);
    } catch (error) {
      setSkillsError(readError(error));
    } finally {
      setLoadingSkills(false);
    }
  }, [pa]);

  const browseMarketplace = useCallback(
    async (sourceId = activeSourceId, nextQuery = query) => {
      setMarketplaceError(null);
      setLoadingMarketplace(true);
      try {
        const result = (await pa.extensions.callAction('system-skill-search', 'browseSkills', {
          sourceId,
          query: nextQuery,
          limit: 60,
        })) as BrowseSkillsResult;
        setSources(normalizeSources(result.sources));
        setCandidates(result.candidates ?? []);
        setInstalledUpstream(result.installed ?? []);
      } catch (error) {
        setCandidates([]);
        setMarketplaceError(readError(error));
      } finally {
        setLoadingMarketplace(false);
      }
    },
    [activeSourceId, pa, query],
  );

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    void browseMarketplace(activeSourceId, query);
  }, [activeSourceId, browseMarketplace, query]);

  const activeSource = useMemo(
    () => sources.find((source) => source.id === activeSourceId) ?? sources[0] ?? DEFAULT_SOURCES[0],
    [activeSourceId, sources],
  );

  const installedIds = useMemo(() => installedUpstreamIds(installedUpstream), [installedUpstream]);
  const candidateGroups = useMemo(() => groupCandidates(candidates, query), [candidates, query]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = queryDraft.trim().toLowerCase();
    if (!normalizedQuery) return skills;
    return skills.filter((skill) =>
      `${skill.name} ${skill.id} ${skill.description ?? ''} ${skill.path} ${skill.sourceLabel ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [queryDraft, skills]);

  const skillCounts = useMemo(
    () => ({
      installed: skills.length,
      enabled: skills.filter((skill) => skill.enabled).length,
      disabled: skills.filter((skill) => !skill.enabled).length,
    }),
    [skills],
  );

  const submitSearch = useCallback(
    (event?: { preventDefault(): void }) => {
      event?.preventDefault();
      setQuery(queryDraft.trim());
    },
    [queryDraft],
  );

  const selectSource = useCallback((sourceId: string) => {
    setActiveSourceId(sourceId);
    setView('marketplace');
  }, []);

  const refresh = useCallback(() => {
    setNotice(null);
    void loadSkills();
    void browseMarketplace(activeSourceId, query);
  }, [activeSourceId, browseMarketplace, loadSkills, query]);

  const installCandidate = useCallback(
    async (candidate: MarketplaceCandidate) => {
      setNotice(null);
      setInstallingId(candidate.candidateId);
      try {
        const result = (await pa.extensions.callAction('system-skill-search', 'installSkill', {
          candidateId: candidate.candidateId,
        })) as { ok?: boolean; message?: string; status?: string; requiresApproval?: boolean };
        if (result.ok === false) {
          setNotice({
            tone: result.status === 'timeout' ? 'warning' : 'info',
            message: result.message || `${candidate.title} was not installed.`,
          });
        } else {
          setNotice({ tone: 'success', message: result.message || `Installed ${candidate.title}.` });
        }
        await Promise.all([loadSkills(), browseMarketplace(activeSourceId, query)]);
      } catch (error) {
        setNotice({ tone: 'danger', message: readError(error) });
      } finally {
        setInstallingId(null);
      }
    },
    [activeSourceId, browseMarketplace, loadSkills, pa, query],
  );

  const toggleSkill = useCallback(
    async (skill: SkillItem) => {
      const enabled = !skill.enabled;
      setBusySkillId(skill.id);
      setNotice(null);
      setSkills((current) => current.map((item) => (item.id === skill.id ? { ...item, enabled } : item)));
      try {
        await pa.extension.invoke('updateSkillEnabled', { id: skill.id, enabled });
      } catch (error) {
        setSkills((current) => current.map((item) => (item.id === skill.id ? { ...item, enabled: !enabled } : item)));
        setNotice({ tone: 'danger', message: readError(error) });
      } finally {
        setBusySkillId(null);
      }
    },
    [pa],
  );

  const renderCandidate = (candidate: MarketplaceCandidate) => {
    const installed = isCandidateInstalled(candidate, installedUpstream);
    const busy = installingId === candidate.candidateId;
    return (
      <ResourceListRow
        key={candidate.candidateId}
        title={candidate.title}
        detail={candidate.description || candidate.identifier}
        meta={
          <Pill tone={trustTone(candidate.trustLevel)}>{candidate.requiresApproval ? 'Approval required' : candidate.sourceLabel}</Pill>
        }
        titleClassName="text-[13px]"
        detailClassName="text-[12px] text-secondary"
        actions={
          <div className="flex items-center gap-2">
            <Button variant={installed ? 'ghost' : 'action'} disabled={busy || installed} onClick={() => void installCandidate(candidate)}>
              {busy ? 'Installing...' : installed ? 'Installed' : 'Install'}
            </Button>
            <Button variant="ghost" onClick={() => window.open(candidate.url, '_blank', 'noopener,noreferrer')}>
              Source
            </Button>
          </div>
        }
      >
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-dim">
          <span>{candidate.identifier}</span>
          {candidate.tags?.slice(0, 3).map((tag) => (
            <span key={`${candidate.candidateId}:${tag}`}>{tag}</span>
          ))}
        </div>
      </ResourceListRow>
    );
  };

  if (loadingSkills && loadingMarketplace) return <LoadingState label="Loading skills..." />;
  if (skillsError && marketplaceError) return <ErrorState title="Skills unavailable" message={`${skillsError} ${marketplaceError}`} />;

  return (
    <AppPageLayout contentClassName="space-y-5">
      <AppPageIntro
        title="Skills"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={refresh} disabled={loadingSkills || loadingMarketplace}>
              Refresh
            </Button>
          </div>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
      {skillsError ? <Notice tone="warning">Installed skill management is unavailable: {skillsError}</Notice> : null}

      <FilterToolbar
        filters={
          <TabList ariaLabel="Skill views">
            <TabButton active={view === 'marketplace'} onClick={() => setView('marketplace')}>
              Marketplace
            </TabButton>
            <TabButton active={view === 'manage'} onClick={() => setView('manage')}>
              Manage <span className="text-dim">{skillCounts.installed}</span>
            </TabButton>
          </TabList>
        }
        search={
          <form className="flex min-w-0 items-center gap-2" onSubmit={submitSearch}>
            <SearchInput
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder={view === 'marketplace' ? 'Search marketplace skills' : 'Search installed skills'}
              className="w-full md:w-80"
            />
            <Button variant="secondary" type="submit">
              Search
            </Button>
          </form>
        }
      />

      {view === 'marketplace' ? (
        <TabPanel>
          <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <section className="space-y-2">
              <SectionLabel>Sources</SectionLabel>
              <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface">
                {sources.map((source) => (
                  <RowButton
                    key={source.id}
                    type="button"
                    selected={activeSourceId === source.id}
                    aria-pressed={activeSourceId === source.id}
                    className="block px-3 py-2 text-left"
                    onClick={() => selectSource(source.id)}
                  >
                    <span className="block text-[13px] font-medium text-primary">{source.label}</span>
                    <span className="mt-0.5 block text-[11px] text-secondary">{trustLabel(source)}</span>
                  </RowButton>
                ))}
              </div>
            </section>

            <section className="min-w-0 space-y-4">
              {activeSource ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border-subtle bg-surface px-3 py-3">
                  <div className="space-y-1">
                    <h2 className="text-[15px] font-medium text-primary">{activeSource.label}</h2>
                    <SupportingText>
                      {activeSource.installPolicy === 'approval-after-vetting'
                        ? 'Community skills are previewed, vetted, and approved before install.'
                        : 'Trusted skills install after preview and vetting.'}
                    </SupportingText>
                  </div>
                  <Pill tone={trustTone(activeSource.trustLevel)}>{trustLabel(activeSource)}</Pill>
                </div>
              ) : null}

              {marketplaceError ? (
                <Notice tone="danger" title="Marketplace source unavailable">
                  {marketplaceError}
                </Notice>
              ) : null}
              {loadingMarketplace ? <LoadingState label="Loading marketplace skills..." /> : null}

              {!loadingMarketplace && !marketplaceError && candidateGroups.length === 0 ? (
                <EmptyState
                  title={query ? 'No matching skills' : 'No skills found'}
                  body={
                    query
                      ? 'No skills in this source match the current search.'
                      : 'This source did not return installable skills. Try another source or refresh.'
                  }
                />
              ) : null}

              {candidateGroups.map((group) => (
                <section key={group.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <SectionLabel>{group.name}</SectionLabel>
                    <SupportingText>{group.candidates.length} skills</SupportingText>
                  </div>
                  <ResourceList>{group.candidates.map(renderCandidate)}</ResourceList>
                </section>
              ))}
            </section>
          </div>
        </TabPanel>
      ) : (
        <TabPanel>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="success">{skillCounts.enabled} enabled</Pill>
              <Pill tone="muted">{skillCounts.disabled} disabled</Pill>
              <Pill tone="teal">{installedUpstream.length} upstream records</Pill>
            </div>
            {loadingSkills ? <LoadingState label="Loading installed skills..." /> : null}
            {!loadingSkills && filteredSkills.length === 0 ? (
              <EmptyState title="No installed skills" body="No installed skills match the current search." />
            ) : null}
            {filteredSkills.length > 0 ? (
              <ResourceList>
                {filteredSkills.map((skill) => (
                  <ResourceListRow
                    key={`${skill.source}:${skill.id}:${skill.path}`}
                    title={skill.name}
                    detail={skill.description || skill.path}
                    meta={<Pill tone={skill.enabled ? 'success' : 'muted'}>{sourceLabel(skill)}</Pill>}
                    titleClassName="text-[13px]"
                    detailClassName="text-[12px] text-secondary"
                    actions={
                      <Switch
                        checked={skill.enabled}
                        disabled={busySkillId === skill.id}
                        aria-label={skill.enabled ? `Disable ${skill.name}` : `Enable ${skill.name}`}
                        label={skill.enabled ? 'On' : 'Off'}
                        onClick={() => void toggleSkill(skill)}
                      />
                    }
                  >
                    <div className="mt-1 truncate text-[11px] text-dim">{skill.sourceLabel ?? skill.path}</div>
                  </ResourceListRow>
                ))}
              </ResourceList>
            ) : null}
          </div>
        </TabPanel>
      )}
    </AppPageLayout>
  );
}
