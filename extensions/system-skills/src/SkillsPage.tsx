import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTablePagination,
  DataTableRow,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  IconButton,
  KeyValueItem,
  KeyValueList,
  Notice,
  QuietLoadingState,
  ResourceList,
  ResourceListRow,
  SearchInput,
  Select,
  Switch,
  TabButton,
  TabList,
  TabPanel,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type SkillSource = 'extension' | 'knowledge' | 'project' | string;
type SkillView = 'marketplace' | 'installed';
type TrustLevel = 'builtin' | 'trusted' | 'community';
type SourceKind = 'github' | 'hermes-index';
type MarketplaceFilter = 'all' | string;
type MarketplaceStateFilter = 'all' | 'available' | 'approval-required' | 'installed';
type MarketplaceSortKey = 'title' | 'capability' | 'source' | 'state';
type SortDirection = 'ascending' | 'descending';
const MARKETPLACE_PAGE_SIZE = 12;

function SkillsToolbarIcon({ name }: { name: 'clear' | 'refresh' | 'search' }) {
  const paths = {
    clear: ['M18 6 6 18', 'M6 6l12 12'],
    refresh: ['M21 12a9 9 0 1 1-3-6.7', 'M21 3v6h-6'],
    search: ['m21 21-4.3-4.3', 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z'],
  } satisfies Record<string, string[]>;
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function SkillDetailIcon({ name }: { name: 'open' }) {
  const paths = {
    open: ['M14 5h5v5', 'M10 14 19 5', 'M19 14v5H5V5h5'],
  } satisfies Record<string, string[]>;
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

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
  cache?: {
    status?: 'hit' | 'miss' | 'refresh';
    cachedAt?: string;
    stale?: boolean;
    refreshStarted?: boolean;
    maxAgeMs?: number;
  };
}

interface MarketplaceSnapshot {
  query: string;
  sources: MarketplaceSource[];
  candidates: MarketplaceCandidate[];
  installed: InstalledSkillRecord[];
}

const MARKETPLACE_SNAPSHOT_SESSION_KEY = 'system-skills.marketplaceSnapshot.v1';

function readMarketplaceSnapshot(): MarketplaceSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(MARKETPLACE_SNAPSHOT_SESSION_KEY) || 'null',
    ) as Partial<MarketplaceSnapshot> | null;
    if (!parsed || typeof parsed.query !== 'string') return null;
    if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.candidates) || !Array.isArray(parsed.installed)) return null;
    return {
      query: parsed.query,
      sources: parsed.sources as MarketplaceSource[],
      candidates: parsed.candidates as MarketplaceCandidate[],
      installed: parsed.installed as InstalledSkillRecord[],
    };
  } catch {
    return null;
  }
}

function writeMarketplaceSnapshot(snapshot: MarketplaceSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(MARKETPLACE_SNAPSHOT_SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // Snapshot caching is a UI fast path; backend storage remains authoritative.
  }
}

type SkillSelectionData =
  | {
      kind: 'marketplace';
      candidate: MarketplaceCandidate;
      installed: boolean;
      capability: string;
      state: { label: string; className: string };
    }
  | { kind: 'installed'; skill: SkillItem };

function skillResourceId(kind: SkillSelectionData['kind'], id: string): string {
  return `${kind}:${id}`;
}

function isSkillSelection(value: unknown): value is { resource: { type: 'skill'; id: string; data?: SkillSelectionData } } {
  if (!value || typeof value !== 'object') return false;
  const resource = (value as { resource?: unknown }).resource;
  return Boolean(resource && typeof resource === 'object' && (resource as { type?: unknown }).type === 'skill');
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
  const initialMarketplaceSnapshot = readMarketplaceSnapshot()?.query === '' ? readMarketplaceSnapshot() : null;
  const hydrateMarketplaceInBackgroundRef = useRef(Boolean(initialMarketplaceSnapshot));
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [sources, setSources] = useState<MarketplaceSource[]>(() => initialMarketplaceSnapshot?.sources ?? DEFAULT_SOURCES);
  const [candidates, setCandidates] = useState<MarketplaceCandidate[]>(() => initialMarketplaceSnapshot?.candidates ?? []);
  const [installedUpstream, setInstalledUpstream] = useState<InstalledSkillRecord[]>(() => initialMarketplaceSnapshot?.installed ?? []);
  const [view, setView] = useState<SkillView>('marketplace');
  const [marketplaceQueryDraft, setMarketplaceQueryDraft] = useState('');
  const [installedQueryDraft, setInstalledQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<MarketplaceFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<MarketplaceFilter>('all');
  const [stateFilter, setStateFilter] = useState<MarketplaceStateFilter>('all');
  const [sortKey, setSortKey] = useState<MarketplaceSortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [marketplacePage, setMarketplacePage] = useState(1);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(() => !initialMarketplaceSnapshot);
  const [refreshingMarketplace, setRefreshingMarketplace] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger' | 'info'; message: string } | null>(null);
  const [selectedSkillResourceId, setSelectedSkillResourceId] = useState<string | null>(null);

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
    async (nextQuery = query, options: { forceRefresh?: boolean; background?: boolean } = {}) => {
      setMarketplaceError(null);
      if (options.background) {
        setRefreshingMarketplace(true);
      } else {
        setLoadingMarketplace(true);
      }
      try {
        const request: Record<string, unknown> = {
          sourceId: 'all',
          query: nextQuery,
          limit: 60,
        };
        if (options.forceRefresh) request.refresh = 'force';
        const result = (await pa.extensions.callAction('system-skill-search', 'browseSkills', request)) as BrowseSkillsResult;
        const nextSources = normalizeSources(result.sources);
        const nextCandidates = result.candidates ?? [];
        const nextInstalled = result.installed ?? [];
        writeMarketplaceSnapshot({ query: nextQuery, sources: nextSources, candidates: nextCandidates, installed: nextInstalled });
        setSources(nextSources);
        setCandidates(nextCandidates);
        setInstalledUpstream(nextInstalled);
      } catch (error) {
        if (!options.background) setCandidates([]);
        setMarketplaceError(readError(error));
      } finally {
        if (options.background) {
          setRefreshingMarketplace(false);
        } else {
          setLoadingMarketplace(false);
        }
      }
    },
    [pa, query],
  );

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    const background = hydrateMarketplaceInBackgroundRef.current && query === '';
    hydrateMarketplaceInBackgroundRef.current = false;
    void browseMarketplace(query, { background });
  }, [browseMarketplace, query]);

  useEffect(() => {
    if (!pa.selection) return;
    const subscription = pa.selection.subscribe((selection) => {
      setSelectedSkillResourceId(isSkillSelection(selection) ? selection.resource.id : null);
    });
    return () => subscription.unsubscribe();
  }, [pa]);

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

  const marketplacePageCount = Math.max(1, Math.ceil(marketplaceRows.length / MARKETPLACE_PAGE_SIZE));
  const pagedMarketplaceRows = useMemo(() => {
    const start = (marketplacePage - 1) * MARKETPLACE_PAGE_SIZE;
    return marketplaceRows.slice(start, start + MARKETPLACE_PAGE_SIZE);
  }, [marketplacePage, marketplaceRows]);

  useEffect(() => {
    setMarketplacePage(1);
  }, [capabilityFilter, query, sourceFilter, stateFilter]);

  useEffect(() => {
    setMarketplacePage((current) => Math.min(current, marketplacePageCount));
  }, [marketplacePageCount]);

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
    setMarketplacePage(1);
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
    void browseMarketplace(query, { forceRefresh: true, background: true });
  }, [browseMarketplace, loadSkills, query]);

  const selectSkill = useCallback(
    (data: SkillSelectionData) => {
      const id =
        data.kind === 'marketplace'
          ? skillResourceId('marketplace', data.candidate.candidateId)
          : skillResourceId('installed', `${data.skill.source}:${data.skill.id}:${data.skill.path}`);
      pa.selection?.set({
        kind: 'resource',
        resource: {
          type: 'skill',
          id,
          label: data.kind === 'marketplace' ? data.candidate.title : data.skill.name,
          source: data.kind,
          data,
        },
      });
    },
    [pa],
  );

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

  if (skillsError && marketplaceError) return <ErrorState title="Skills unavailable" message={`${skillsError} ${marketplaceError}`} />;

  return (
    <AppPageLayout contentClassName="space-y-5">
      <AppPageIntro title="Skills" />

      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
      {skillsError ? <Notice tone="warning">Installed skill management is unavailable: {skillsError}</Notice> : null}

      <DataTableToolbar
        tabs={
          <TabList ariaLabel="Skill views" variant="underline">
            <TabButton active={view === 'marketplace'} onClick={() => setView('marketplace')}>
              Browse
            </TabButton>
            <TabButton active={view === 'installed'} onClick={() => setView('installed')}>
              Installed <span className="text-dim">{skillCounts.installed}</span>
            </TabButton>
          </TabList>
        }
        summary={
          view === 'marketplace'
            ? `Searching ${sources.length} marketplace sources · ${marketplaceFilterSummary}${refreshingMarketplace ? ' · Refreshing' : ''}`
            : `${skillCounts.enabled} enabled · ${skillCounts.disabled} disabled`
        }
        filters={
          view === 'marketplace' ? (
            <>
              <label className="flex items-center gap-2 text-[12px] text-secondary">
                Capability
                <Select
                  aria-label="Filter by capability"
                  value={capabilityFilter}
                  onChange={(event) => setCapabilityFilter(event.target.value)}
                  className="min-w-32"
                >
                  <option value="all">All</option>
                  {capabilityOptions.map((capability) => (
                    <option key={capability} value={capability}>
                      {capability}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-secondary">
                Source
                <Select
                  aria-label="Filter by source"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="min-w-36"
                >
                  <option value="all">All</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-secondary">
                State
                <Select
                  aria-label="Filter by state"
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value as MarketplaceStateFilter)}
                  className="min-w-36"
                >
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="approval-required">Approval required</option>
                  <option value="installed">Installed</option>
                </Select>
              </label>
            </>
          ) : null
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
              className="w-80 max-w-full"
            />
            {(view === 'marketplace' ? marketplaceQueryDraft || query : installedQueryDraft) ? (
              <IconButton compact type="button" onClick={clearSearch} aria-label="Clear search" title="Clear search">
                <SkillsToolbarIcon name="clear" />
              </IconButton>
            ) : null}
            <IconButton compact type="submit" aria-label="Search skills" title="Search skills">
              <SkillsToolbarIcon name="search" />
            </IconButton>
          </form>
        }
        actions={
          <IconButton
            compact
            aria-label="Refresh skills"
            title="Refresh skills"
            onClick={refresh}
            disabled={loadingSkills || refreshingMarketplace}
          >
            <SkillsToolbarIcon name="refresh" />
          </IconButton>
        }
      />

      {view === 'marketplace' ? (
        <TabPanel>
          <div className="space-y-3">
            {hasMarketplaceFilters ? (
              <div>
                <ToolbarButton type="button" onClick={clearMarketplaceFilters} title="Clear filters">
                  <SkillsToolbarIcon name="clear" />
                  Clear filters
                </ToolbarButton>
              </div>
            ) : null}
            {marketplaceError ? (
              <Notice tone="danger" title="Marketplace unavailable">
                {marketplaceError}
              </Notice>
            ) : null}
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
                {loadingMarketplace ? (
                  <DataTableEmptyRow colSpan={5} cellClassName="py-8 text-left">
                    Loading marketplace skills...
                  </DataTableEmptyRow>
                ) : null}
                {pagedMarketplaceRows.map(({ candidate, installed, capability, state }) => {
                  const busy = installingId === candidate.candidateId;
                  const selected = selectedSkillResourceId === skillResourceId('marketplace', candidate.candidateId);
                  const selectionData: SkillSelectionData = { kind: 'marketplace', candidate, installed, capability, state };
                  return (
                    <DataTableRow
                      key={candidate.candidateId}
                      className={selected ? 'ui-selected-row-accent' : undefined}
                      onClick={() => selectSkill(selectionData)}
                    >
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
                            onClick={(event) => {
                              event.stopPropagation();
                              void installCandidate(candidate);
                            }}
                          >
                            {busy ? 'Installing...' : installed ? 'Installed' : 'Install'}
                          </Button>
                          <IconButton
                            compact
                            title={`Details for ${candidate.title}`}
                            aria-label={`Details for ${candidate.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectSkill(selectionData);
                            }}
                          >
                            <span aria-hidden="true">ⓘ</span>
                          </IconButton>
                        </DataTableActionGroup>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            {marketplaceRows.length > MARKETPLACE_PAGE_SIZE ? (
              <DataTablePagination
                page={marketplacePage}
                pageCount={marketplacePageCount}
                totalLabel={`${marketplaceRows.length} results`}
                onPrevious={() => setMarketplacePage((current) => Math.max(1, current - 1))}
                onNext={() => setMarketplacePage((current) => Math.min(marketplacePageCount, current + 1))}
              />
            ) : null}
          </div>
        </TabPanel>
      ) : (
        <TabPanel>
          <div className="space-y-3">
            {loadingSkills ? <QuietLoadingState label="Loading installed skills" className="min-h-12" /> : null}
            {!loadingSkills && filteredSkills.length === 0 ? (
              <EmptyState title="No installed skills" body="No installed skills match the current search." />
            ) : null}
            {filteredSkills.length > 0 ? (
              <ResourceList>
                {filteredSkills.map((skill) => {
                  const selectionData: SkillSelectionData = { kind: 'installed', skill };
                  const selected = selectedSkillResourceId === skillResourceId('installed', `${skill.source}:${skill.id}:${skill.path}`);
                  return (
                    <ResourceListRow
                      key={`${skill.source}:${skill.id}:${skill.path}`}
                      className={selected ? 'ui-selected-row-accent' : undefined}
                      title={skill.name}
                      detail={skill.description || sourceLabel(skill)}
                      meta={<span className="text-[12px] text-secondary">{sourceLabel(skill)}</span>}
                      titleClassName="text-[13px]"
                      detailClassName="text-[12px] text-secondary"
                      onClick={() => selectSkill(selectionData)}
                      actions={
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={skill.enabled}
                            disabled={busySkillId === skill.id}
                            aria-label={skill.enabled ? `Disable ${skill.name}` : `Enable ${skill.name}`}
                            label={skill.enabled ? 'On' : 'Off'}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleSkill(skill);
                            }}
                          />
                          <IconButton
                            compact
                            title={`Details for ${skill.name}`}
                            aria-label={`Details for ${skill.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectSkill(selectionData);
                            }}
                          >
                            <span aria-hidden="true">ⓘ</span>
                          </IconButton>
                        </div>
                      }
                    >
                      <div className="mt-1 truncate text-[11px] text-dim">{skill.enabled ? 'Enabled for agents' : 'Disabled'}</div>
                    </ResourceListRow>
                  );
                })}
              </ResourceList>
            ) : null}
          </div>
        </TabPanel>
      )}
    </AppPageLayout>
  );
}

export function SkillsContextRail({ pa }: ExtensionSurfaceProps) {
  const [selection, setSelection] = useState<SkillSelectionData | null>(null);

  useEffect(() => {
    if (!pa.selection) return;
    const subscription = pa.selection.subscribe((nextSelection) => {
      if (!isSkillSelection(nextSelection)) {
        setSelection(null);
        return;
      }
      const data = nextSelection.resource.data;
      setSelection(isSkillSelectionData(data) ? data : null);
    });
    return () => subscription.unsubscribe();
  }, [pa]);

  return (
    <ContextRail>
      <ContextRailHeader
        eyebrow="Skill details"
        title={selection ? (selection.kind === 'marketplace' ? selection.candidate.title : selection.skill.name) : 'No skill selected'}
      />
      <ContextRailBody>
        {!selection ? (
          <EmptyState
            eyebrow="Context rail"
            title="No skill selected"
            body="Select a skill to inspect its source, trust level, install state, and local path."
            steps={['Pick a skill from the table.', 'Review its details here.', 'Install or manage it from the row actions.']}
            align="start"
          />
        ) : selection.kind === 'marketplace' ? (
          <MarketplaceSkillDetails selection={selection} />
        ) : (
          <InstalledSkillDetails skill={selection.skill} />
        )}
      </ContextRailBody>
    </ContextRail>
  );
}

function isSkillSelectionData(value: unknown): value is SkillSelectionData {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'marketplace') {
    const candidate = (value as { candidate?: unknown }).candidate;
    return Boolean(candidate && typeof candidate === 'object' && typeof (candidate as { candidateId?: unknown }).candidateId === 'string');
  }
  if (kind === 'installed') {
    const skill = (value as { skill?: unknown }).skill;
    return Boolean(skill && typeof skill === 'object' && typeof (skill as { id?: unknown }).id === 'string');
  }
  return false;
}

function MarketplaceSkillDetails({ selection }: { selection: Extract<SkillSelectionData, { kind: 'marketplace' }> }) {
  const { candidate, installed, capability, state } = selection;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-primary">{candidate.title}</h3>
            <div className={`mt-1 text-[12px] ${state.className}`}>{state.label}</div>
          </div>
          {candidate.url ? (
            <IconButton
              compact
              type="button"
              aria-label="Open skill source"
              title="Open skill source"
              onClick={() => window.open(candidate.url, '_blank', 'noopener,noreferrer')}
            >
              <SkillDetailIcon name="open" />
            </IconButton>
          ) : null}
        </div>
        {candidate.description ? <p className="text-[12px] leading-5 text-secondary">{candidate.description}</p> : null}
      </header>

      <KeyValueList>
        <KeyValueItem label="Capability" value={capability} />
        <KeyValueItem label="Source" value={candidate.sourceLabel} />
        <KeyValueItem label="Trust" value={candidate.trustLevel === 'community' ? 'Community' : 'Trusted'} />
        <KeyValueItem label="State" value={installed ? 'Installed' : candidate.requiresApproval ? 'Approval required' : 'Available'} />
        <KeyValueItem label="Identifier" value={candidate.identifier} />
      </KeyValueList>
    </div>
  );
}

function InstalledSkillDetails({ skill }: { skill: SkillItem }) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h3 className="truncate text-[16px] font-semibold text-primary">{skill.name}</h3>
        {skill.description ? <p className="text-[12px] leading-5 text-secondary">{skill.description}</p> : null}
      </header>

      <KeyValueList>
        <KeyValueItem label="Source" value={sourceLabel(skill)} />
        <KeyValueItem label="State" value={skill.enabled ? 'Enabled' : 'Disabled'} />
        <KeyValueItem label="Path" value={skill.path} />
        {skill.extensionId ? <KeyValueItem label="Extension" value={skill.extensionId} /> : null}
      </KeyValueList>
    </div>
  );
}
