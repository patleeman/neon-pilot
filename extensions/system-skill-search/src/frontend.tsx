import './frontend.css';

import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  LoadingState,
  Notice,
  Pill,
  SupportingText,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type TrustLevel = 'builtin' | 'trusted' | 'community';
type VetVerdict = 'safe' | 'caution' | 'dangerous';

interface SkillCandidate {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  trustLevel: TrustLevel;
  identifier: string;
}

interface VetResult {
  verdict: VetVerdict;
  allowed: boolean;
  summary: string;
  reviewedAt: string;
}

interface PreviewSummary {
  candidate: SkillCandidate;
  vetting: VetResult;
  files: string[];
  totalBytes: number;
  contentHash: string;
  previewedAt: string;
}

interface InstalledSkillRecord {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  trustLevel: TrustLevel;
  identifier: string;
  installedAt: string;
  vetting: VetResult;
}

interface SourceSummary {
  id: string;
  label: string;
  kind: string;
  trustLevel: TrustLevel;
  enabled: boolean;
}

export interface SkillSearchState {
  sources?: SourceSummary[];
  candidates?: SkillCandidate[];
  previews?: PreviewSummary[];
  installed?: InstalledSkillRecord[];
}

const EMPTY_STATE: Required<SkillSearchState> = {
  sources: [],
  candidates: [],
  previews: [],
  installed: [],
};

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function trustTone(trustLevel: TrustLevel): 'success' | 'warning' | 'muted' {
  if (trustLevel === 'builtin') return 'success';
  if (trustLevel === 'trusted') return 'success';
  return 'warning';
}

function trustLabel(trustLevel: TrustLevel): string {
  if (trustLevel === 'builtin') return 'Built-in';
  if (trustLevel === 'trusted') return 'Trusted';
  return 'Community';
}

function verdictTone(verdict: VetVerdict): 'success' | 'warning' | 'danger' {
  if (verdict === 'safe') return 'success';
  if (verdict === 'caution') return 'warning';
  return 'danger';
}

function normalizeState(state: SkillSearchState | null | undefined): Required<SkillSearchState> {
  return {
    sources: state?.sources ?? [],
    candidates: state?.candidates ?? [],
    previews: state?.previews ?? [],
    installed: state?.installed ?? [],
  };
}

export function SkillSearchSettingsView({
  state,
  loading,
  error,
  onRefresh,
}: {
  state: SkillSearchState;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const normalized = useMemo(() => normalizeState(state), [state]);
  const recentPreviews = useMemo(
    () => [...normalized.previews].sort((left, right) => Date.parse(right.previewedAt) - Date.parse(left.previewedAt)).slice(0, 8),
    [normalized.previews],
  );
  const installed = useMemo(
    () => [...normalized.installed].sort((left, right) => left.title.localeCompare(right.title)),
    [normalized.installed],
  );

  return (
    <div className="skill-search-panel space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-primary">Skill Search</h3>
          <SupportingText>
            Searches use an isolated no-tools reviewer. Trusted skills install after vetting; community skills require approval.
          </SupportingText>
        </div>
        <ToolbarButton onClick={onRefresh} disabled={loading} aria-label="Refresh Skill Search state">
          Refresh
        </ToolbarButton>
      </div>

      {loading ? <LoadingState label="Loading Skill Search..." /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-primary">Sources</h4>
          <SupportingText>{normalized.sources.length} enabled</SupportingText>
        </div>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Source</DataTableHeaderCell>
              <DataTableHeaderCell>Type</DataTableHeaderCell>
              <DataTableHeaderCell>Trust</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {normalized.sources.length === 0 ? (
              <DataTableEmptyRow colSpan={3}>No sources loaded.</DataTableEmptyRow>
            ) : (
              normalized.sources.map((source) => (
                <DataTableRow key={source.id}>
                  <DataTableCell>
                    <span className="font-medium text-primary">{source.label}</span>
                  </DataTableCell>
                  <DataTableCell>{source.kind === 'hermes-index' ? 'Index' : 'Repository'}</DataTableCell>
                  <DataTableCell>
                    <Pill tone={trustTone(source.trustLevel)}>{trustLabel(source.trustLevel)}</Pill>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-primary">Recent Previews</h4>
          <SupportingText>{recentPreviews.length} vetted</SupportingText>
        </div>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Skill</DataTableHeaderCell>
              <DataTableHeaderCell>Vetting</DataTableHeaderCell>
              <DataTableHeaderCell>Files</DataTableHeaderCell>
              <DataTableHeaderCell>Previewed</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {recentPreviews.length === 0 ? (
              <DataTableEmptyRow colSpan={4}>No previews yet.</DataTableEmptyRow>
            ) : (
              recentPreviews.map((preview) => (
                <DataTableRow key={`${preview.candidate.id}:${preview.contentHash}`}>
                  <DataTableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-primary">{preview.candidate.title}</div>
                      <div className="truncate text-[12px] text-secondary">{preview.candidate.sourceLabel}</div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <Pill tone={verdictTone(preview.vetting.verdict)}>{preview.vetting.verdict}</Pill>
                  </DataTableCell>
                  <DataTableCell>{preview.files.length}</DataTableCell>
                  <DataTableCell>{formatDateTime(preview.previewedAt)}</DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-primary">Installed Upstream Skills</h4>
          <SupportingText>{installed.length} available to Prompt Assembly</SupportingText>
        </div>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Skill</DataTableHeaderCell>
              <DataTableHeaderCell>Source</DataTableHeaderCell>
              <DataTableHeaderCell>Vetting</DataTableHeaderCell>
              <DataTableHeaderCell>Installed</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {installed.length === 0 ? (
              <DataTableEmptyRow colSpan={4}>No upstream skills installed.</DataTableEmptyRow>
            ) : (
              installed.map((skill) => (
                <DataTableRow key={skill.id}>
                  <DataTableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-primary">{skill.title}</div>
                      <div className="truncate text-[12px] text-secondary">{skill.description}</div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{skill.sourceLabel}</DataTableCell>
                  <DataTableCell>
                    <Pill tone={verdictTone(skill.vetting.verdict)}>{skill.vetting.verdict}</Pill>
                  </DataTableCell>
                  <DataTableCell>{formatDateTime(skill.installedAt)}</DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </section>
    </div>
  );
}

export function SkillSearchSettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  const [state, setState] = useState<SkillSearchState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const next = (await pa.extension.invoke('listState', {})) as SkillSearchState;
    setState(normalizeState(next));
  }, [pa]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((loadError) => {
        if (!cancelled) setError(readError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(() => {
    setLoading(true);
    void load()
      .catch((refreshError) => setError(readError(refreshError)))
      .finally(() => setLoading(false));
  }, [load]);

  return <SkillSearchSettingsView state={state} loading={loading} error={error} onRefresh={refresh} />;
}
