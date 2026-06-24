import type { FileDiffOptions } from '@pierre/diffs';
import { type CSSProperties, lazy, Suspense, useCallback, useMemo } from 'react';

import type { ConversationCommitCheckpointFile } from '../../shared/types';
import { type ColorTheme, useTheme } from '../../ui-state/theme';
import { cx, MetaLabel, RowButton } from '../ui';

const checkpointDiffStyle = {
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

const PatchDiff = lazy(() => import('@pierre/diffs/react').then((module) => ({ default: module.PatchDiff })));

export function resolveDiffThemeType(theme: string, availableThemes: ColorTheme[]): 'light' | 'dark' {
  const appearance = availableThemes.find((candidate) => candidate.id === theme)?.appearance;
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return theme.toLowerCase().includes('dark') ? 'dark' : 'light';
}

function statusLabel(file: ConversationCommitCheckpointFile): string {
  switch (file.status) {
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

export function fileDisplayPath(file: ConversationCommitCheckpointFile): string {
  return file.previousPath && file.previousPath !== file.path ? `${file.previousPath} → ${file.path}` : file.path;
}

export function CheckpointDiffSection({
  file,
  active = false,
  collapsed = false,
  view,
  registerSection,
  stickyHeader = false,
  showActiveBadge = false,
  sectionClassName,
  onToggleCollapse,
}: {
  file: ConversationCommitCheckpointFile;
  active?: boolean;
  collapsed?: boolean;
  view: 'unified' | 'split';
  registerSection?: (node: HTMLDivElement | null) => void;
  stickyHeader?: boolean;
  showActiveBadge?: boolean;
  sectionClassName?: string;
  onToggleCollapse?: () => void;
}) {
  const { theme, availableThemes } = useTheme();
  const themeType = resolveDiffThemeType(theme, availableThemes);
  const diffOptions = useMemo<FileDiffOptions<undefined>>(
    () => ({
      theme: { dark: 'tokyo-night', light: 'github-light' },
      themeType,
      diffStyle: view,
      diffIndicators: 'classic',
      disableFileHeader: true,
      hunkSeparators: 'metadata',
      lineDiffType: 'word-alt',
      overflow: 'wrap',
    }),
    [themeType, view],
  );

  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  return (
    <section
      ref={registerSection}
      data-checkpoint-file-path={file.path}
      className={cx(
        'mb-2 scroll-mt-3 overflow-hidden border-b border-border-subtle/70 bg-base/80 last:mb-0 last:border-b-0',
        active && 'border-accent',
        sectionClassName,
      )}
    >
      <RowButton
        onClick={handleToggleCollapse}
        className={cx(
          'justify-between gap-3 rounded-none border-b border-border-subtle/50 bg-elevated/25 px-3 py-2',
          stickyHeader && 'sticky top-0 z-10 bg-elevated/95',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cx('shrink-0 text-dim transition-transform', collapsed && '-rotate-90')}
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            <p className="truncate font-mono text-xs text-primary" title={fileDisplayPath(file)}>
              {fileDisplayPath(file)}
            </p>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 pl-[18px] text-xs text-secondary">
            <MetaLabel>{statusLabel(file)}</MetaLabel>
            <span className="font-mono tabular-nums">
              <span className="text-success">+{file.additions}</span> <span className="text-danger">-{file.deletions}</span>
            </span>
          </p>
        </div>
        {showActiveBadge && active ? <MetaLabel tone="accent">Current</MetaLabel> : null}
      </RowButton>
      {!collapsed ? (
        <div className="overflow-hidden bg-[rgb(var(--color-terminal-surface))]">
          <Suspense fallback={<div className="px-3 py-2 text-xs text-dim">Loading diff…</div>}>
            <PatchDiff key={`${file.path}:${view}`} patch={file.patch} options={diffOptions} style={checkpointDiffStyle} />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}
