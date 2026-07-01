import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  EmptyState,
  ErrorState,
  FilterToolbar,
  IconButton,
  LoadingState,
  Notice,
  ResourceList,
  ResourceListRow,
  SearchInput,
  Select,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TabPanel,
} from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SkillSource = 'extension' | 'knowledge' | 'project' | string;
type SkillView = 'marketplace' | 'installed';
type TrustLevel = 'builtin' | 'trusted' | 'community';
type SourceKind = 'github' | 'hermes-index';
type MarketplaceFilter = 'all' | string;
type MarketplaceStateFilter = 'all' | 'available' | 'approval-required' | 'installed';
type MarketplaceSortKey = 'title' | 'capability' | 'source' | 'state';
type SortDirection = 'ascending' | 'descending';

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

function candidateCategory(candidate: MarketplaceCandidate): string {
  const haystack = `${candidate.title} ${candidate.description} ${(candidate.tags ?? []).join(' ')}`.toLowerCase();
  if (/pdf|document|spreadsheet|presentation|slide|template|office|sheet|csv|xlsx|docx/.test(haystack)) return 'Productivity';
  if (/code|review|github|git|xcode|ios|security|test|qa|debug|build/.test(haystack)) return 'Coding';
  if (/image|video|audio|browser|computer|chrome|vision/.test(haystack)) return 'Tools';
  return 'Featured';
}

function isCandidateInstalled(candidate: MarketplaceCandidate, installed: InstalledSkillRecord[]): boolean {
  return installed.some(
    (skill) =>
      skill.candidateId === candidate.candidateId ||
      skill.identifier === candidate.identifier ||
      skill.title.toLowerCase() === candidate.title.toLowerCase(),
  );
}

function normalizeSources(value: MarketplaceSource[] | undefined): MarketplaceSource[] {
  return value?.length ? value : DEFAULT_SOURCES;
}

function candidateState(candidate: MarketplaceCandidate, installed: boolean): { label: string; className: string } {
  if (installed) return { label: 'Installed', className: 'text-success' };
  if (candidate.requiresApproval) return { label: 'Approval required', className: 'text-warning' };
  return { label: 'Available', className: 'text-secondary' };
}

function candidateStateValue(candidate: MarketplaceCandidate, installed: boolean): Exclude<MarketplaceStateFilter, 'all'> {
  if (installed) return 'installed';
  if (candidate.requiresApproval) return 'approval-required';
  return 'available';
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export function SkillsPage({ pa }: ExtensionSurfaceProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [sources, setSources] = useState<MarketplaceSource[]>(DEFAULT_SOURCES);
  const [candidates, setCandidates] = useState<MarketplaceCandidate[]>([]);
  const [installedUpstream, setInstalledUpstream] = useState<InstalledSkillRecord[]>([]);
  const [view, setView] = useState<SkillView>('marketplace');
  const [marketplaceQueryDraft, setMarketplaceQueryDraft] = useState('');
  const [installedQueryDraft, setInstalledQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<MarketplaceFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<MarketplaceFilter>('all');
  const [stateFilter, setStateFilter] = useState<MarketplaceStateFilter>('all');
  const [sortKey, setSortKey] = useState<MarketplaceSortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
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
    async (nextQuery = query) => {
      setMarketplaceError(null);
      setLoadingMarketplace(true);
      try {
        const result = (await pa.extensions.callAction('system-skill-search', 'browseSkills', {
          sourceId: 'all',
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
    [pa, query],
  );

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    void browseMarketplace(query);
  }, [browseMarketplace, query]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = installedQueryDraft.trim().toLowerCase();
    if (!normalizedQuery) return skills;
    return skills.filter((skill) =>
      `${skill.name} ${skill.id} ${skill.description ?? ''} ${skill.path} ${skill.sourceLabel ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [installedQueryDraft, skills]);

  const skillCounts = useMemo(
    () => ({
      installed: skills.length,
      enabled: skills.filter((skill) => skill.enabled).length,
      disabled: skills.filter((skill) => !skill.enabled).length,
    }),
    [skills],
  );

  const capabilityOptions = useMemo(() => {
    return Array.from(new Set(candidates.map((candidate) => candidateCategory(candidate)))).sort(compareText);
  }, [candidates]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(candidates.map((candidate) => candidate.sourceLabel).filter(Boolean))).sort(compareText);
  }, [candidates]);

  const marketplaceRows = useMemo(() => {
    return candidates
      .map((candidate) => {
        const installed = isCandidateInstalled(candidate, installedUpstream);
        const capability = candidateCategory(candidate);
        const state = candidateState(candidate, installed);
        const stateValue = candidateStateValue(candidate, installed);
        return { candidate, installed, capability, state, stateValue };
      })
      .filter((row) => capabilityFilter === 'all' || row.capability === capabilityFilter)
      .filter((row) => sourceFilter === 'all' || row.candidate.sourceLabel === sourceFilter)
      .filter((row) => stateFilter === 'all' || row.stateValue === stateFilter)
      .sort((left, right) => {
        const direction = sortDirection === 'ascending' ? 1 : -1;
        const leftValue =
          sortKey === 'title'
            ? left.candidate.title
            : sortKey === 'capability'
              ? left.capability
              : sortKey === 'source'
                ? left.candidate.sourceLabel
                : left.state.label;
        const rightValue =
          sortKey === 'title'
            ? right.candidate.title
            : sortKey === 'capability'
              ? right.capability
              : sortKey === 'source'
                ? right.candidate.sourceLabel
                : right.state.label;
        return compareText(leftValue, rightValue) * direction;
      });
  }, [candidates, capabilityFilter, installedUpstream, sortDirection, sortKey, sourceFilter, stateFilter]);

  const hasMarketplaceFilters = capabilityFilter !== 'all' || sourceFilter !== 'all' || stateFilter !== 'all';
  const marketplaceFilterSummary =
    candidates.length === marketplaceRows.length
      ? `${candidates.length} results`
      : `${marketplaceRows.length} of ${candidates.length} results`;

  const submitSearch = useCallback(
    (event?: { preventDefault(): void }) => {
      event?.preventDefault();
      if (view === 'marketplace') {
        setQuery(marketplaceQueryDraft.trim());
      }
    },
    [marketplaceQueryDraft, view],
  );

  const clearSearch = useCallback(() => {
    if (view === 'marketplace') {
      setMarketplaceQueryDraft('');
      setQuery('');
    } else {
      setInstalledQueryDraft('');
    }
  }, [view]);

  const clearMarketplaceFilters = useCallback(() => {
    setCapabilityFilter('all');
    setSourceFilter('all');
    setStateFilter('all');
  }, []);

  const toggleSort = useCallback((nextSortKey: MarketplaceSortKey) => {
    setSortKey((currentSortKey) => {
      if (currentSortKey === nextSortKey) {
        setSortDirection((currentDirection) => (currentDirection === 'ascending' ? 'descending' : 'ascending'));
        return currentSortKey;
      }
      setSortDirection('ascending');
      return nextSortKey;
    });
  }, []);

  const sortIndicator = useCallback(
    (key: MarketplaceSortKey) => {
      if (sortKey !== key) return '';
      return sortDirection === 'ascending' ? ' ↑' : ' ↓';
    },
    [sortDirection, sortKey],
  );

  const refresh = useCallback(() => {
    setNotice(null);
    void loadSkills();
    void browseMarketplace(query);
  }, [browseMarketplace, loadSkills, query]);

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
        await Promise.all([loadSkills(), browseMarketplace(query)]);
      } catch (error) {
        setNotice({ tone: 'danger', message: readError(error) });
      } finally {
        setInstallingId(null);
      }
    },
    [browseMarketplace, loadSkills, pa, query],
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

  if (loadingSkills && loadingMarketplace) return <LoadingState label="Loading skills..." />;
  if (skillsError && marketplaceError) return <ErrorState title="Skills unavailable" message={`${skillsError} ${marketplaceError}`} />;

  return (
    <AppPageLayout contentClassName="space-y-5">
      <AppPageIntro
        title="Skills"
        actions={
          <div className="flex items-center gap-2">
            <IconButton aria-label="Refresh skills" title="Refresh skills" onClick={refresh} disabled={loadingSkills || loadingMarketplace}>
              <span aria-hidden="true">↻</span>
            </IconButton>
          </div>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
      {skillsError ? <Notice tone="warning">Installed skill management is unavailable: {skillsError}</Notice> : null}

      <FilterToolbar
        filters={
          <TabList ariaLabel="Skill views">
            <TabButton active={view === 'marketplace'} onClick={() => setView('marketplace')}>
              Browse
            </TabButton>
            <TabButton active={view === 'installed'} onClick={() => setView('installed')}>
              Installed <span className="text-dim">{skillCounts.installed}</span>
            </TabButton>
          </TabList>
        }
        search={
          <form className="flex min-w-0 items-center gap-2" onSubmit={submitSearch}>
            <SearchInput
              value={view === 'marketplace' ? marketplaceQueryDraft : installedQueryDraft}
              onChange={(event) => {
                if (view === 'marketplace') {
                  setMarketplaceQueryDraft(event.target.value);
                } else {
                  setInstalledQueryDraft(event.target.value);
                }
              }}
              placeholder={view === 'marketplace' ? 'Search marketplace skills' : 'Search installed skills'}
              className="w-full md:w-80"
            />
            {(view === 'marketplace' ? marketplaceQueryDraft || query : installedQueryDraft) ? (
              <Button variant="ghost" type="button" onClick={clearSearch}>
                Clear
              </Button>
            ) : null}
            <Button variant="toolbar" type="submit" title="Search skills">
              <span aria-hidden="true">⌕</span>
              Search
            </Button>
          </form>
        }
      />

      {view === 'marketplace' ? (
        <TabPanel>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SupportingText>
                Searching {sources.length} marketplace sources · {marketplaceFilterSummary}
              </SupportingText>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Filter by capability"
                  value={capabilityFilter}
                  onChange={(event) => setCapabilityFilter(event.target.value)}
                  className="h-8 w-36 text-[12px]"
                >
                  <option value="all">All capabilities</option>
                  {capabilityOptions.map((capability) => (
                    <option key={capability} value={capability}>
                      {capability}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Filter by source"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="h-8 w-40 text-[12px]"
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Filter by state"
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value as MarketplaceStateFilter)}
                  className="h-8 w-36 text-[12px]"
                >
                  <option value="all">All states</option>
                  <option value="available">Available</option>
                  <option value="approval-required">Approval required</option>
                  <option value="installed">Installed</option>
                </Select>
                {hasMarketplaceFilters ? (
                  <Button variant="ghost" type="button" onClick={clearMarketplaceFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
            {marketplaceError ? (
              <Notice tone="danger" title="Marketplace unavailable">
                {marketplaceError}
              </Notice>
            ) : null}
            {loadingMarketplace ? <LoadingState label="Loading marketplace skills..." /> : null}
            <DataTable
              tableClassName="table-fixed"
              columns={
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                </colgroup>
              }
            >
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell aria-sort={sortKey === 'title' ? sortDirection : 'none'}>
                    <Button variant="ghost" type="button" onClick={() => toggleSort('title')}>
                      Skill{sortIndicator('title')}
                    </Button>
                  </DataTableHeaderCell>
                  <DataTableHeaderCell aria-sort={sortKey === 'capability' ? sortDirection : 'none'}>
                    <Button variant="ghost" type="button" onClick={() => toggleSort('capability')}>
                      Capability{sortIndicator('capability')}
                    </Button>
                  </DataTableHeaderCell>
                  <DataTableHeaderCell aria-sort={sortKey === 'source' ? sortDirection : 'none'}>
                    <Button variant="ghost" type="button" onClick={() => toggleSort('source')}>
                      Source{sortIndicator('source')}
                    </Button>
                  </DataTableHeaderCell>
                  <DataTableHeaderCell aria-sort={sortKey === 'state' ? sortDirection : 'none'}>
                    <Button variant="ghost" type="button" onClick={() => toggleSort('state')}>
                      State{sortIndicator('state')}
                    </Button>
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">Action</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {!loadingMarketplace && !marketplaceError && marketplaceRows.length === 0 ? (
                  <DataTableEmptyRow colSpan={5} cellClassName="py-8">
                    {query && !hasMarketplaceFilters
                      ? 'No marketplace skills match the current search.'
                      : query || hasMarketplaceFilters
                        ? 'No marketplace skills match the current filters.'
                        : 'No installable skills returned.'}
                  </DataTableEmptyRow>
                ) : null}
                {marketplaceRows.map(({ candidate, installed, capability, state }) => {
                  const busy = installingId === candidate.candidateId;
                  return (
                    <DataTableRow key={candidate.candidateId}>
                      <DataTableCell className="min-w-0 py-2 pr-4">
                        <div className="truncate text-[13px] font-medium text-primary">{candidate.title}</div>
                        {candidate.description ? <div className="truncate text-[12px] text-secondary">{candidate.description}</div> : null}
                      </DataTableCell>
                      <DataTableCell className="py-2 text-[12px] text-secondary">{capability}</DataTableCell>
                      <DataTableCell className="min-w-0 py-2 text-[12px] text-secondary">
                        <div className="truncate">{candidate.sourceLabel}</div>
                        <div className="truncate text-dim">{candidate.trustLevel === 'community' ? 'Community' : 'Trusted'}</div>
                      </DataTableCell>
                      <DataTableCell className={`py-2 text-[12px] ${state.className}`}>{state.label}</DataTableCell>
                      <DataTableCell className="py-2">
                        <DataTableActionGroup>
                          <Button
                            variant={installed ? 'ghost' : 'action'}
                            disabled={busy || installed}
                            onClick={() => void installCandidate(candidate)}
                          >
                            {busy ? 'Installing...' : installed ? 'Installed' : 'Install'}
                          </Button>
                          <Button variant="ghost" onClick={() => window.open(candidate.url, '_blank', 'noopener,noreferrer')}>
                            Details
                          </Button>
                        </DataTableActionGroup>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </div>
        </TabPanel>
      ) : (
        <TabPanel>
          <div className="space-y-3">
            <div className="text-[12px] text-secondary">
              {skillCounts.enabled} enabled · {skillCounts.disabled} disabled · {installedUpstream.length} upstream records
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
                    detail={skill.description || sourceLabel(skill)}
                    meta={<span className="text-[12px] text-secondary">{sourceLabel(skill)}</span>}
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
                    <div className="mt-1 truncate text-[11px] text-dim">{skill.enabled ? 'Enabled for agents' : 'Disabled'}</div>
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
