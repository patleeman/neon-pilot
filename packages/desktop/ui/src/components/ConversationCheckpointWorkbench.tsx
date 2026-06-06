import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { ConversationCommitCheckpointRecord, ConversationCommitCheckpointSummary, UncommittedDiffResult } from '../shared/types';
import { formatDate } from '../shared/utils';
import { CheckpointDiffSection, fileDisplayPath } from './checkpoints/CheckpointDiffView';
import { UNCOMMITTED_SENTINEL, useConversationCheckpointSummaries, useUncommittedDiff } from './conversationCheckpointHooks';
import { addNotification } from './notifications/notificationStore';
import {
  CenteredLoadingState,
  CenteredMessage,
  cx,
  ErrorState,
  PanelMessage,
  RailSection,
  RowButton,
  SectionLabel,
  SegmentedControl,
  WorkbenchHeader,
  WorkbenchShell,
} from './ui';

type DiffViewMode = 'unified' | 'split';

type DiffRailFile = Pick<
  ConversationCommitCheckpointRecord['files'][number],
  'path' | 'previousPath' | 'status' | 'additions' | 'deletions'
>;

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

const INITIAL_EXPANDED_DIFF_FILES = 1;

function expandedFilePathSet(files: Array<{ path: string }>): Set<string> {
  return new Set(files.slice(0, INITIAL_EXPANDED_DIFF_FILES).map((file) => file.path));
}

function DiffViewToggle({ currentView, onChange }: { currentView: DiffViewMode; onChange: (nextView: DiffViewMode) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Diff view"
      value={currentView}
      options={[
        { value: 'split', label: 'Split' },
        { value: 'unified', label: 'Unified' },
      ]}
      onChange={onChange}
    />
  );
}

export { UNCOMMITTED_SENTINEL, useConversationCheckpointSummaries, useUncommittedDiff };

function DiffRailShell({ children }: { children: ReactNode }) {
  return (
    <RailSection title="Diffs" bodyClassName="px-1.5">
      {children}
    </RailSection>
  );
}

export function ConversationDiffRailContent({
  checkpoints,
  activeCheckpointId,
  loading,
  error,
  onOpenCheckpoint,
  onScrollToFile,
  workspaceCwd,
}: {
  checkpoints: ConversationCommitCheckpointSummary[];
  activeCheckpointId: string | null;
  loading: boolean;
  error: string | null;
  onOpenCheckpoint: (checkpointId: string) => void;
  onScrollToFile?: (filePath: string) => void;
  workspaceCwd?: string | null;
}) {
  const [filesByCheckpoint, setFilesByCheckpoint] = useState<Record<string, DiffRailFile[]>>({});
  const { result: uncommitted, loading: uncommittedLoading } = useUncommittedDiff(workspaceCwd);
  const uncommittedSelected = activeCheckpointId === UNCOMMITTED_SENTINEL;
  const latestCheckpointId = checkpoints[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const missing = checkpoints.filter((checkpoint) => !filesByCheckpoint[checkpoint.id]);
    if (missing.length === 0) {
      return;
    }

    Promise.all(
      missing.map(async (checkpoint) => {
        try {
          const result = await api.conversationCheckpoint(checkpoint.conversationId, checkpoint.id);
          return [checkpoint.id, result.checkpoint.files.map(({ patch: _patch, ...file }) => file)] as const;
        } catch {
          return [checkpoint.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setFilesByCheckpoint((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
  }, [checkpoints, filesByCheckpoint]);

  if (loading && checkpoints.length === 0 && !uncommittedLoading) {
    return (
      <DiffRailShell>
        <CenteredLoadingState label="Loading diffs..." />
      </DiffRailShell>
    );
  }

  if (error && checkpoints.length === 0 && !uncommitted) {
    return (
      <DiffRailShell>
        <ErrorState message={error} className="px-4 py-4" />
      </DiffRailShell>
    );
  }

  if (checkpoints.length === 0 && !uncommitted) {
    if (activeCheckpointId && activeCheckpointId !== UNCOMMITTED_SENTINEL) {
      const shortId = activeCheckpointId.slice(0, 12);
      return (
        <DiffRailShell>
          <RowButton
            type="button"
            onClick={() => onOpenCheckpoint(activeCheckpointId)}
            selected
            className="rounded-xl bg-elevated px-3 py-2.5 text-primary"
            title={activeCheckpointId}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">Opened commit</p>
                <p className="mt-0.5 truncate text-[11px] leading-4 text-dim">Loaded from local git history</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-dim">{shortId}</span>
            </div>
          </RowButton>
        </DiffRailShell>
      );
    }

    if (!workspaceCwd) {
      return (
        <DiffRailShell>
          <PanelMessage className="px-2.5 py-2">No diffs in this conversation.</PanelMessage>
        </DiffRailShell>
      );
    }
  }

  return (
    <DiffRailShell>
      <div className="flex flex-col gap-1">
        {/* Uncommitted entry */}
        {uncommitted ? (
          <UncommittedRailEntry
            result={uncommitted}
            loading={uncommittedLoading}
            selected={uncommittedSelected}
            onSelect={() => onOpenCheckpoint(UNCOMMITTED_SENTINEL)}
            showFiles={uncommittedSelected}
            onFileClick={(filePath) => {
              if (uncommittedSelected && onScrollToFile) {
                onScrollToFile(filePath);
              }
            }}
          />
        ) : workspaceCwd && uncommittedLoading ? (
          <div className="rounded-lg px-2.5 py-2">
            <PanelMessage className="px-0 py-0">Checking uncommitted changes...</PanelMessage>
          </div>
        ) : null}

        {/* Checkpoint entries */}
        {checkpoints.map((checkpoint) => {
          const selected = checkpoint.id === activeCheckpointId;
          const files = filesByCheckpoint[checkpoint.id];
          const showFiles = selected || (!activeCheckpointId && checkpoint.id === latestCheckpointId);
          return (
            <div key={checkpoint.id} className={cx('rounded-lg', selected && 'bg-elevated/70')}>
              <RowButton
                type="button"
                onClick={() => onOpenCheckpoint(checkpoint.id)}
                selected={selected}
                className={cx('items-start gap-2 px-2.5 py-2', selected ? 'text-primary' : 'text-secondary')}
                title={checkpoint.shortSha}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cx('mt-0.5 shrink-0 text-dim transition-transform', showFiles && 'rotate-90')}
                  aria-hidden="true"
                >
                  <path d="m8.5 5.5 5 6.5-5 6.5" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] text-steel">{checkpoint.shortSha}</span>
                    <span className="shrink-0 text-[10px] text-dim">
                      {checkpoint.fileCount} file{checkpoint.fileCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-dim">
                    <span className="font-mono tabular-nums">
                      <span className="text-success">+{checkpoint.linesAdded}</span>{' '}
                      <span className="text-danger">-{checkpoint.linesDeleted}</span>
                    </span>
                  </div>
                </div>
              </RowButton>
              {showFiles ? (
                <div className="pb-1 pl-7 pr-1">
                  {files ? (
                    files.slice(0, 12).map((file) => (
                      <RowButton
                        key={`${checkpoint.id}:${file.path}:${file.previousPath ?? ''}`}
                        compact
                        onClick={() => {
                          if (checkpoint.id === activeCheckpointId && onScrollToFile) {
                            onScrollToFile(file.path);
                          } else {
                            onOpenCheckpoint(checkpoint.id);
                          }
                        }}
                        className="group"
                        title={fileDisplayPath(file as ConversationCommitCheckpointRecord['files'][number])}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-dim group-hover:text-secondary"
                          aria-hidden="true"
                        >
                          <path d="M14.25 3.75H6.75v16.5h10.5V6.75l-3-3Z" />
                          <path d="M14.25 3.75V6.75h3" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">{fileName(file.path)}</span>
                        <span className="hidden min-w-0 flex-1 truncate text-[10px] text-dim xl:block">{parentPath(file.path)}</span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums">
                          <span className="text-success">+{file.additions}</span> <span className="text-danger">-{file.deletions}</span>
                        </span>
                      </RowButton>
                    ))
                  ) : (
                    <PanelMessage className="px-2 py-1.5">Loading files...</PanelMessage>
                  )}
                  {files && files.length > 12 ? (
                    <div className="px-2 py-1 text-[10px] text-dim">+{files.length - 12} more files</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </DiffRailShell>
  );
}

function UncommittedRailEntry({
  result,
  loading,
  selected,
  onSelect,
  showFiles,
  onFileClick,
}: {
  result: UncommittedDiffResult;
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
  showFiles: boolean;
  onFileClick?: (filePath: string) => void;
}) {
  const files = result.files;
  return (
    <div className={cx('rounded-lg', selected && 'bg-elevated/70')}>
      <RowButton
        type="button"
        onClick={onSelect}
        selected={selected}
        className={cx('items-start gap-2 px-2.5 py-2', selected ? 'text-primary' : 'text-secondary')}
        title={result.branch ?? 'Uncommitted changes'}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx('mt-0.5 shrink-0 text-dim transition-transform', showFiles && 'rotate-90')}
          aria-hidden="true"
        >
          <path d="m8.5 5.5 5 6.5-5 6.5" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cx('shrink-0 text-[11px] font-medium', selected ? 'text-accent' : 'text-secondary')}>Uncommitted</span>
            <span className="shrink-0 text-[10px] text-dim">
              {result.changeCount} file{result.changeCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-dim">
            {result.branch ? <span className="truncate">{result.branch}</span> : null}
            <span className="font-mono tabular-nums">
              <span className="text-success">+{result.linesAdded}</span> <span className="text-danger">-{result.linesDeleted}</span>
            </span>
          </div>
        </div>
      </RowButton>
      {showFiles && files.length > 0 ? (
        <div className="pb-1 pl-7 pr-1">
          {files.slice(0, 12).map((file) => (
            <RowButton
              key={file.path}
              compact
              onClick={() => onFileClick?.(file.path)}
              className="group"
              title={fileDisplayPath(file as ConversationCommitCheckpointRecord['files'][number])}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-dim group-hover:text-secondary"
                aria-hidden="true"
              >
                <path d="M14.25 3.75H6.75v16.5h10.5V6.75l-3-3Z" />
                <path d="M14.25 3.75V6.75h3" />
              </svg>
              <span className="min-w-0 flex-1 truncate">{fileName(file.path)}</span>
              <span className="hidden min-w-0 flex-1 truncate text-[10px] text-dim xl:block">{parentPath(file.path)}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums">
                <span className="text-success">+{file.additions}</span> <span className="text-danger">-{file.deletions}</span>
              </span>
            </RowButton>
          ))}
          {files.length > 12 ? <div className="px-2 py-1 text-[10px] text-dim">+{files.length - 12} more files</div> : null}
        </div>
      ) : null}
      {showFiles && loading && files.length === 0 ? (
        <div className="pb-1 pl-7 pr-1">
          <PanelMessage className="px-2 py-1.5">Loading files...</PanelMessage>
        </div>
      ) : null}
    </div>
  );
}

export function ConversationCheckpointWorkbenchPane({
  conversationId,
  checkpointId,
  onMissingCheckpoint,
  scrollToFile,
  workspaceCwd,
}: {
  conversationId: string;
  checkpointId: string | null;
  onMissingCheckpoint?: () => void;
  scrollToFile?: string | null;
  workspaceCwd?: string | null;
}) {
  const { versions } = useAppEvents();
  const [checkpoint, setCheckpoint] = useState<ConversationCommitCheckpointRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<DiffViewMode>('split');
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  const fileSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setDiffView('split');
    setActiveFilePath(null);
    setExpandedFiles(new Set());
    fileSectionRefs.current = {};
  }, [checkpointId]);

  useEffect(() => {
    if (!checkpointId || checkpointId === UNCOMMITTED_SENTINEL) {
      setCheckpoint(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .conversationCheckpoint(conversationId, checkpointId)
      .then((result) => {
        if (!cancelled) {
          setCheckpoint(result.checkpoint);
          setExpandedFiles(expandedFilePathSet(result.checkpoint.files));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCheckpoint(null);
          const msg = err instanceof Error ? err.message : 'Diff not found.';
          setError(msg);
          addNotification({ type: 'warning', message: msg, details: err instanceof Error ? err.stack : undefined, source: 'core' });
          onMissingCheckpoint?.();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkpointId, conversationId, onMissingCheckpoint, versions.checkpoints]);

  const selectedFilePath = activeFilePath ?? checkpoint?.files[0]?.path ?? null;

  const checkpointSubtitle = useMemo(() => {
    if (!checkpoint) {
      return null;
    }
    return `${checkpoint.fileCount} file${checkpoint.fileCount === 1 ? '' : 's'} changed · ${formatDate(checkpoint.committedAt)}`;
  }, [checkpoint]);

  useEffect(() => {
    setActiveFilePath((current) => current ?? checkpoint?.files[0]?.path ?? null);
  }, [checkpoint?.files]);

  useEffect(() => {
    if (!checkpoint?.files.length) {
      return;
    }

    const container = viewerScrollRef.current;
    if (!container) {
      return;
    }

    let frameId = 0;

    const updateActiveSection = () => {
      frameId = 0;
      const containerTop = container.getBoundingClientRect().top + 24;
      let nextPath = checkpoint.files[0]?.path ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const file of checkpoint.files) {
        const section = fileSectionRefs.current[file.path];
        if (!section) {
          continue;
        }

        const rect = section.getBoundingClientRect();
        if (rect.bottom < containerTop) {
          continue;
        }

        const distance = Math.abs(rect.top - containerTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextPath = file.path;
        }
      }

      if (nextPath) {
        setActiveFilePath((current) => (current === nextPath ? current : nextPath));
      }
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [checkpoint?.files, diffView]);

  useEffect(() => {
    if (!scrollToFile || !checkpoint) {
      return;
    }

    const section = fileSectionRefs.current[scrollToFile];
    if (!section || !viewerScrollRef.current) {
      return;
    }

    const container = viewerScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const offset = sectionRect.top - containerRect.top + container.scrollTop - 20;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    setActiveFilePath(scrollToFile);
  }, [scrollToFile, checkpoint]);

  if (!checkpointId) {
    return <CenteredMessage eyebrow="Diffs" title="Select a diff" body="Pick a saved conversation diff from the right rail." />;
  }

  // Uncommitted mode — show working tree diffs
  if (checkpointId === UNCOMMITTED_SENTINEL) {
    return (
      <UncommittedDiffPaneView workspaceCwd={workspaceCwd} diffView={diffView} onDiffViewChange={setDiffView} scrollToFile={scrollToFile} />
    );
  }

  return (
    <WorkbenchShell
      header={
        <WorkbenchHeader
          title={checkpoint?.subject ?? checkpointId}
          titleClassName="text-[17px] font-semibold"
          meta={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {checkpoint ? <span className="font-mono text-steel">{checkpoint.shortSha}</span> : <SectionLabel>Diff</SectionLabel>}
              {checkpointSubtitle ? <span className="truncate">{checkpointSubtitle}</span> : null}
              {checkpoint ? (
                <span className="font-mono tabular-nums">
                  <span className="text-success">+{checkpoint.linesAdded}</span>{' '}
                  <span className="text-danger">-{checkpoint.linesDeleted}</span>
                </span>
              ) : null}
            </div>
          }
          actions={<DiffViewToggle currentView={diffView} onChange={setDiffView} />}
          className="px-5 py-3"
        />
      }
    >
      <div className="min-h-0 flex flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {loading && !checkpoint ? (
            <CenteredLoadingState label="Loading diff..." />
          ) : error || !checkpoint ? (
            <ErrorState message={error || 'Diff not found.'} className="px-4 py-4" />
          ) : (
            <div ref={viewerScrollRef} className="h-full overflow-auto overscroll-contain bg-panel">
              {checkpoint.files.length === 0 ? (
                <CenteredMessage title="No changed files" body="No changed files were captured for this diff." />
              ) : (
                <div className="mx-auto max-w-[1500px] px-5 py-4">
                  {checkpoint.files.map((file) => (
                    <CheckpointDiffSection
                      key={`${file.path}:${file.previousPath ?? ''}`}
                      file={file}
                      active={selectedFilePath === file.path}
                      collapsed={!expandedFiles.has(file.path)}
                      view={diffView}
                      stickyHeader
                      showActiveBadge
                      registerSection={(node) => {
                        fileSectionRefs.current[file.path] = node;
                      }}
                      onToggleCollapse={() => {
                        setExpandedFiles((current) => {
                          const next = new Set(current);
                          if (next.has(file.path)) {
                            next.delete(file.path);
                          } else {
                            next.add(file.path);
                          }
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </WorkbenchShell>
  );
}

function UncommittedDiffPaneView({
  workspaceCwd,
  diffView,
  onDiffViewChange,
  scrollToFile,
}: {
  workspaceCwd?: string | null;
  diffView: DiffViewMode;
  onDiffViewChange: (view: DiffViewMode) => void;
  scrollToFile?: string | null;
}) {
  const { result, loading, error } = useUncommittedDiff(workspaceCwd);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  const fileSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const files = result?.files ?? [];
  const selectedFilePath = activeFilePath ?? files[0]?.path ?? null;

  useEffect(() => {
    setExpandedFiles(expandedFilePathSet(files));
  }, [files]);

  useEffect(() => {
    setActiveFilePath((current) => current ?? files[0]?.path ?? null);
  }, [files]);

  useEffect(() => {
    if (!files.length) {
      return;
    }

    const container = viewerScrollRef.current;
    if (!container) {
      return;
    }

    let frameId = 0;

    const updateActiveSection = () => {
      frameId = 0;
      const containerTop = container.getBoundingClientRect().top + 24;
      let nextPath = files[0]?.path ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const file of files) {
        const section = fileSectionRefs.current[file.path];
        if (!section) {
          continue;
        }

        const rect = section.getBoundingClientRect();
        if (rect.bottom < containerTop) {
          continue;
        }

        const distance = Math.abs(rect.top - containerTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextPath = file.path;
        }
      }

      if (nextPath) {
        setActiveFilePath((current) => (current === nextPath ? current : nextPath));
      }
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [files, diffView]);

  useEffect(() => {
    if (!scrollToFile || !result) {
      return;
    }

    const section = fileSectionRefs.current[scrollToFile];
    if (!section || !viewerScrollRef.current) {
      return;
    }

    const container = viewerScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const offset = sectionRect.top - containerRect.top + container.scrollTop - 20;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    setActiveFilePath(scrollToFile);
  }, [scrollToFile, result]);

  if (!workspaceCwd) {
    return (
      <CenteredMessage
        eyebrow="Uncommitted changes"
        title="Open a local conversation"
        body="Uncommitted changes are shown for local conversations with a git workspace."
      />
    );
  }

  // Avoid flashing empty state — treat initial mount as still loading
  if ((loading || !result) && !error) {
    return <CenteredLoadingState label="Checking uncommitted changes..." />;
  }

  if (error && !result) {
    return <ErrorState message={error} className="px-4 py-4" />;
  }

  return (
    <WorkbenchShell
      header={
        <WorkbenchHeader
          title="Uncommitted changes"
          titleClassName="text-[17px] font-semibold"
          meta={
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SectionLabel>Uncommitted</SectionLabel>
                {result?.branch ? <span className="truncate font-mono text-steel">{result.branch}</span> : null}
                {result ? (
                  <span className="font-mono tabular-nums">
                    <span className="text-success">+{result.linesAdded}</span> <span className="text-danger">-{result.linesDeleted}</span>
                  </span>
                ) : null}
              </div>
            </div>
          }
          actions={<DiffViewToggle currentView={diffView} onChange={onDiffViewChange} />}
          className="px-5 py-3"
        />
      }
    >
      <div className="min-h-0 flex flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {files.length === 0 ? (
            <CenteredMessage title="No uncommitted changes" />
          ) : (
            <div ref={viewerScrollRef} className="h-full overflow-auto overscroll-contain bg-panel">
              <div className="mx-auto max-w-[1500px] px-5 py-4">
                {files.map((file) => (
                  <CheckpointDiffSection
                    key={`${file.path}:${file.previousPath ?? ''}`}
                    file={file}
                    active={selectedFilePath === file.path}
                    collapsed={!expandedFiles.has(file.path)}
                    view={diffView}
                    stickyHeader
                    showActiveBadge
                    registerSection={(node) => {
                      fileSectionRefs.current[file.path] = node;
                    }}
                    onToggleCollapse={() => {
                      setExpandedFiles((current) => {
                        const next = new Set(current);
                        if (next.has(file.path)) {
                          next.delete(file.path);
                        } else {
                          next.add(file.path);
                        }
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkbenchShell>
  );
}
