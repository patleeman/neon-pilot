import { type ExtensionSurfaceProps, WorkspaceExplorer, WorkspaceFileDocument } from '@personal-agent/extensions/workbench-files';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const WORKSPACE_DRAFT_PROMPT_EVENT = 'pa:workspace-draft-prompt';
const WORKSPACE_REPLY_SELECTION_EVENT = 'pa:workspace-reply-selection';
const WORKSPACE_OPEN_FILES_CHANGED_EVENT = 'pa:workspace-open-files-changed';
const WORKSPACE_OPEN_FILES_KEY_PREFIX = 'pa:workspace-open-files:';
const MAX_WORKSPACE_OPEN_FILES = 24;
const WORKSPACE_FILE_PARAM = 'workspaceFile';

function getWorkspaceFilePath(search: string): string | null {
  return new URLSearchParams(search).get(WORKSPACE_FILE_PARAM);
}

function workspaceOpenFilesKey(cwd: string): string {
  return `${WORKSPACE_OPEN_FILES_KEY_PREFIX}${cwd}`;
}

function readWorkspaceOpenFiles(cwd: string | null): string[] {
  if (!cwd) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceOpenFilesKey(cwd)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_WORKSPACE_OPEN_FILES)
      : [];
  } catch {
    return [];
  }
}

function writeWorkspaceOpenFiles(cwd: string | null, paths: readonly string[]): string[] {
  if (!cwd) return [];
  const nextPaths = [...new Set(paths)].slice(0, MAX_WORKSPACE_OPEN_FILES);
  try {
    localStorage.setItem(workspaceOpenFilesKey(cwd), JSON.stringify(nextPaths));
  } catch {
    // Ignore local storage failures; the active file route param still drives the document.
  }
  window.dispatchEvent(new CustomEvent(WORKSPACE_OPEN_FILES_CHANGED_EVENT, { detail: { cwd, paths: nextPaths } }));
  return nextPaths;
}

function addWorkspaceOpenFile(paths: readonly string[], path: string): string[] {
  return paths.includes(path) ? [...paths] : [path, ...paths].slice(0, MAX_WORKSPACE_OPEN_FILES);
}

function removeWorkspaceOpenFile(paths: readonly string[], path: string): string[] {
  return paths.filter((value) => value !== path);
}

function fileNameForPath(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

export function WorkspaceFilesPanel({ context }: ExtensionSurfaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilePath = getWorkspaceFilePath(searchParams.toString());
  const handleOpenFile = useCallback(
    (file: { cwd: string; path: string }) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        next.delete('artifact');
        next.delete('checkpoint');
        next.delete('run');
        next.set(WORKSPACE_FILE_PARAM, file.path);
        return next;
      });
    },
    [setSearchParams],
  );
  if (!context.cwd) {
    return <div className="px-4 py-5 text-[12px] text-dim">Open a local conversation to browse its workspace.</div>;
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading workspace…</div>}>
      <WorkspaceExplorer
        cwd={context.cwd}
        railOnly
        activeFilePath={activeFilePath}
        onOpenFile={handleOpenFile}
        onDraftPrompt={(prompt) => {
          window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_PROMPT_EVENT, { detail: { prompt } }));
        }}
      />
    </Suspense>
  );
}

export function WorkspaceFileDetailPanel({ context }: ExtensionSurfaceProps) {
  const [, setSearchParams] = useSearchParams();
  const filePath = getWorkspaceFilePath(context.search);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>(() => readWorkspaceOpenFiles(context.cwd));

  useEffect(() => {
    setOpenFilePaths(readWorkspaceOpenFiles(context.cwd));
  }, [context.cwd]);

  useEffect(() => {
    if (!context.cwd || !filePath) return;
    setOpenFilePaths((current) => writeWorkspaceOpenFiles(context.cwd, addWorkspaceOpenFile(current, filePath)));
  }, [context.cwd, filePath]);

  useEffect(() => {
    function handleOpenFilesChanged(event: Event) {
      if (event instanceof StorageEvent) {
        if (!context.cwd || event.key !== workspaceOpenFilesKey(context.cwd)) return;
        setOpenFilePaths(readWorkspaceOpenFiles(context.cwd));
        return;
      }
      const detail = (event as CustomEvent<{ cwd?: string; paths?: string[] }>).detail;
      if (detail?.cwd !== context.cwd) return;
      setOpenFilePaths(Array.isArray(detail.paths) ? detail.paths : readWorkspaceOpenFiles(context.cwd));
    }

    window.addEventListener(WORKSPACE_OPEN_FILES_CHANGED_EVENT, handleOpenFilesChanged);
    window.addEventListener('storage', handleOpenFilesChanged);
    return () => {
      window.removeEventListener(WORKSPACE_OPEN_FILES_CHANGED_EVENT, handleOpenFilesChanged);
      window.removeEventListener('storage', handleOpenFilesChanged);
    };
  }, [context.cwd]);

  const visibleOpenFilePaths = useMemo(
    () => (filePath ? addWorkspaceOpenFile(openFilePaths, filePath) : openFilePaths),
    [filePath, openFilePaths],
  );

  const selectFile = useCallback(
    (path: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        next.delete('artifact');
        next.delete('checkpoint');
        next.delete('run');
        next.set(WORKSPACE_FILE_PARAM, path);
        return next;
      });
    },
    [setSearchParams],
  );

  const closeFile = useCallback(
    (path: string) => {
      const nextOpenFilePaths = writeWorkspaceOpenFiles(context.cwd, removeWorkspaceOpenFile(visibleOpenFilePaths, path));
      setOpenFilePaths(nextOpenFilePaths);
      if (path !== filePath) return;
      const nextActiveFile = nextOpenFilePaths[0] ?? null;
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (nextActiveFile) {
          next.set(WORKSPACE_FILE_PARAM, nextActiveFile);
        } else {
          next.delete(WORKSPACE_FILE_PARAM);
        }
        return next;
      });
    },
    [context.cwd, filePath, setSearchParams, visibleOpenFilePaths],
  );

  if (!context.cwd) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center select-text">
        <div className="max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel/80">Workbench</p>
          <h2 className="mt-2 text-lg font-semibold text-primary text-balance">Open a local conversation</h2>
          <p className="mt-2 text-[13px] leading-6 text-secondary">Open a local conversation to browse its workspace.</p>
        </div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center select-text">
        <div className="max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel/80">Workbench</p>
          <h2 className="mt-2 text-lg font-semibold text-primary text-balance">Open a file</h2>
          <p className="mt-2 text-[13px] leading-6 text-secondary">Pick a file from the Files tab to keep it beside the transcript.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <WorkspaceFileTabs paths={visibleOpenFilePaths} activePath={filePath} onSelect={selectFile} onClose={closeFile} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Opening file…</div>}>
          <WorkspaceFileDocument
            cwd={context.cwd}
            path={filePath}
            onReplyWithSelection={(selection) => {
              window.dispatchEvent(new CustomEvent(WORKSPACE_REPLY_SELECTION_EVENT, { detail: selection }));
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

function WorkspaceFileTabs({
  paths,
  activePath,
  onSelect,
  onClose,
}: {
  paths: readonly string[];
  activePath: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  if (paths.length === 0) return null;

  return (
    <div className="flex h-[35px] shrink-0 overflow-x-auto overflow-y-hidden border-b border-border-subtle bg-base">
      {paths.map((path) => {
        const isActive = path === activePath;
        return (
          <div key={path} className="group relative shrink-0">
            <button
              type="button"
              title={path}
              className={`flex h-[35px] max-w-[220px] min-w-[96px] items-center gap-2 border-r border-border-subtle px-3 pr-8 text-left font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/35 ${
                isActive
                  ? 'bg-base text-primary shadow-[inset_0_-2px_0_rgb(var(--color-accent))]'
                  : 'text-secondary hover:bg-panel/70 hover:text-primary'
              }`}
              onClick={() => onSelect(path)}
            >
              <span className="block min-w-0 flex-1 truncate">{fileNameForPath(path)}</span>
            </button>
            <button
              type="button"
              aria-label={`Close file ${path}`}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-dim opacity-0 transition-opacity hover:bg-elevated hover:text-primary group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose(path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
