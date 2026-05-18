import type { FileDiffOptions } from '@pierre/diffs';
import { PatchDiff } from '@pierre/diffs/react';
import { type CSSProperties, useMemo, useState } from 'react';

import { type ColorTheme, useTheme } from '../../ui-state/theme';
import { cx } from '../ui';

interface FileChange {
  path: string;
  previousPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unmerged' | 'changed';
  additions: number;
  deletions: number;
  patch?: string;
  truncated?: boolean;
}

const fileChangeDiffStyle = {
  '--diffs-font-family': 'var(--font-mono, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace)',
  '--diffs-header-font-family': 'var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif)',
  '--diffs-font-size': '11px',
  '--diffs-line-height': '1.45',
  '--diffs-tab-size': '2',
  '--diffs-bg-context-override': 'rgb(var(--color-terminal-surface))',
  '--diffs-bg-separator-override': 'rgb(var(--color-surface))',
  '--diffs-bg-buffer-override': 'rgb(var(--color-elevated) / 0.45)',
  '--diffs-bg-hover-override': 'rgb(var(--color-hover))',
  '--diffs-fg-number-override': 'rgb(var(--color-dim))',
  '--diffs-addition-color-override': 'rgb(var(--color-success))',
  '--diffs-deletion-color-override': 'rgb(var(--color-danger))',
  '--diffs-modified-color-override': 'rgb(var(--color-steel))',
  '--diffs-bg-addition-override': 'rgb(var(--color-success) / 0.16)',
  '--diffs-bg-addition-number-override': 'rgb(var(--color-success) / 0.10)',
  '--diffs-bg-deletion-override': 'rgb(var(--color-danger) / 0.16)',
  '--diffs-bg-deletion-number-override': 'rgb(var(--color-danger) / 0.10)',
  '--diffs-bg-addition-emphasis-override': 'rgb(var(--color-success) / 0.24)',
  '--diffs-bg-deletion-emphasis-override': 'rgb(var(--color-danger) / 0.24)',
} as CSSProperties;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStatus(value: unknown): FileChange['status'] | undefined {
  return value === 'added' ||
    value === 'modified' ||
    value === 'deleted' ||
    value === 'renamed' ||
    value === 'copied' ||
    value === 'typechange' ||
    value === 'unmerged' ||
    value === 'changed'
    ? value
    : undefined;
}

export function readFileChanges(details: unknown): FileChange[] {
  if (!isRecord(details) || !Array.isArray(details.fileChanges)) return [];
  return details.fileChanges.flatMap((candidate): FileChange[] => {
    if (!isRecord(candidate)) return [];
    const path = readString(candidate, 'path');
    const status = readStatus(candidate.status);
    if (!path || !status) return [];
    return [
      {
        path,
        previousPath: readString(candidate, 'previousPath'),
        status,
        additions: readNumber(candidate, 'additions') ?? 0,
        deletions: readNumber(candidate, 'deletions') ?? 0,
        patch: readString(candidate, 'patch'),
        truncated: candidate.truncated === true,
      },
    ];
  });
}

function resolveDiffThemeType(theme: string, availableThemes: ColorTheme[]): 'light' | 'dark' {
  const appearance = availableThemes.find((candidate) => candidate.id === theme)?.appearance;
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return theme.toLowerCase().includes('dark') ? 'dark' : 'light';
}

function statusLabel(status: FileChange['status']): string {
  switch (status) {
    case 'added':
      return 'Added';
    case 'deleted':
      return 'Deleted';
    case 'renamed':
      return 'Renamed';
    case 'copied':
      return 'Copied';
    case 'typechange':
      return 'Type change';
    case 'unmerged':
      return 'Unmerged';
    case 'modified':
      return 'Modified';
    default:
      return 'Changed';
  }
}

function displayPath(change: FileChange): string {
  return change.previousPath && change.previousPath !== change.path ? `${change.previousPath} → ${change.path}` : change.path;
}

export function FileChangesToolDiff({ fileChanges }: { fileChanges: FileChange[] }) {
  const { theme, availableThemes } = useTheme();
  const [expanded, setExpanded] = useState(() => new Set(fileChanges.slice(0, 3).map((change) => displayPath(change))));
  const themeType = resolveDiffThemeType(theme, availableThemes);
  const diffOptions = useMemo<FileDiffOptions<undefined>>(
    () => ({
      theme: { dark: 'tokyo-night', light: 'github-light' },
      themeType,
      diffStyle: 'split',
      diffIndicators: 'classic',
      disableFileHeader: true,
      hunkSeparators: 'metadata',
      lineDiffType: 'word-alt',
      overflow: 'wrap',
    }),
    [themeType],
  );

  if (fileChanges.length === 0) return null;

  return (
    <div className="border-t border-border-subtle/70 bg-black/5 px-2.5 py-2 font-sans text-[11px]">
      <p className="mb-2 uppercase tracking-[0.14em] text-dim">File changes</p>
      <div className="space-y-2">
        {fileChanges.map((change) => {
          const key = displayPath(change);
          const open = expanded.has(key);
          return (
            <section key={key} className="overflow-hidden rounded-md border border-border-subtle/70 bg-base/75">
              <button
                type="button"
                onClick={() => {
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                className="flex w-full min-w-0 items-center gap-2 bg-elevated/30 px-2.5 py-2 text-left transition-colors hover:bg-elevated/60"
              >
                <span className={cx('shrink-0 text-dim transition-transform', open && 'rotate-90')} aria-hidden="true">
                  ›
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-primary" title={key}>
                  {key}
                </span>
                <span className="shrink-0 uppercase tracking-[0.12em] text-dim">{statusLabel(change.status)}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  <span className="text-success">+{change.additions}</span> <span className="text-danger">-{change.deletions}</span>
                </span>
              </button>
              {open ? (
                change.patch ? (
                  <div className="overflow-hidden bg-[rgb(var(--color-terminal-surface))]">
                    <PatchDiff patch={change.patch} options={diffOptions} style={fileChangeDiffStyle} />
                  </div>
                ) : (
                  <div className="px-3 py-2 text-dim">
                    {change.truncated ? 'Diff too large to show inline.' : 'Diff unavailable for this file change.'}
                  </div>
                )
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
