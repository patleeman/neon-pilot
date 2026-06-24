import {
  type ContextMenuItem as FileTreeContextMenuItem,
  type ContextMenuOpenContext as FileTreeContextMenuOpenContext,
  type FileTreeRenameEvent,
} from '@pierre/trees';
import { FileTree as TreesFileTree } from '@pierre/trees/react';
import {
  type CSSProperties,
  lazy,
  type MouseEvent as ReactMouseEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api } from '../../client/api';
import { writeClipboardText } from '../../desktop/clipboard';
import { getDesktopBridge, shouldUseNativeAppContextMenus } from '../../desktop/desktopBridge';
import { createDesktopAwareEventSource } from '../../desktop/desktopEventSource';
import { setExtensionCommandContext } from '../../extensions/commands';
import type {
  WorkspaceDiffOverlay,
  WorkspaceDirectoryListing,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceGitStatusChange,
} from '../../shared/types';
import { useTheme } from '../../ui-state/theme';
import { ContextMenu, ContextMenuSection, ContextMenuSections } from '../shared/ContextMenu';
import { ContextMenuWrapper } from '../shared/ContextMenuWrapper';
import { TextPromptDialog } from '../shared/TextPromptDialog';
import { useFileTreeModel } from '../shared/useFileTreeModel';
import { Button, cx, EmptyState, IconButton, LoadingState, MenuItem, PanelMessage, Pill, TextButton, ToolbarButton } from '../ui';
import { addWorkspaceOpenFile, readWorkspaceOpenFiles, removeWorkspaceOpenFile, writeWorkspaceOpenFiles } from './openWorkspaceFiles';
import {
  beginWorkspaceDirectoryRequest,
  createWorkspaceDirectoryRequestLifecycle,
  invalidateWorkspaceDirectoryRequest,
  isWorkspaceDirectoryRequestCurrent,
  resetWorkspaceDirectoryRequestLifecycle,
} from './workspaceRequestLifecycle';

interface WorkspaceExplorerProps {
  cwd: string | null;
  onDraftPrompt: (prompt: string) => void;
  onOpenFile?: (file: { cwd: string; path: string }) => void;
  activeFilePath?: string | null;
  openFilesScope?: string | null;
  railOnly?: boolean;
}

type LoadState<T> = { status: 'idle' | 'loading'; data: T | null; error: string | null };

const WORKSPACE_SELECTION_CONTEXT_MENU_WIDTH = 224;

type TreeNodeState = {
  expanded: boolean;
  loading: boolean;
  entries: WorkspaceEntry[] | null;
  error: string | null;
};

const WORKSPACE_EXPLORER_OPEN_KEY = 'pa:workspace-explorer-open';
const WORKSPACE_EXPLORER_DIFF_KEY = 'pa:workspace-explorer-diff-overlay';
export const WORKBENCH_REFRESH_ACTIVE_FILE_EVENT = 'pa:workbench-refresh-active-file';
export const WORKBENCH_TOGGLE_DIFF_EVENT = 'pa:workbench-toggle-diff';
export const WORKBENCH_DIFF_STATE_EVENT = 'pa:workbench-diff-state';
const WORKSPACE_TREE_ERROR_ROW_NAME = 'Could not load this folder';
const WATCH_DEBOUNCE_MS = 180;
const GIT_REFRESH_DEBOUNCE_MS = 450;
const STATUS_LABELS: Record<WorkspaceGitStatusChange, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typechange: 'T',
  untracked: 'U',
  conflicted: '!',
};

const STATUS_TITLES: Record<WorkspaceGitStatusChange, string> = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  copied: 'Copied',
  typechange: 'Type changed',
  untracked: 'Untracked',
  conflicted: 'Conflicted',
};

const WorkspaceCodeEditor = lazy(() => import('./WorkspaceCodeEditor').then((module) => ({ default: module.WorkspaceCodeEditor })));

function DiffOverlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="4" cy="3.5" r="1.6" />
      <circle cx="4" cy="12.5" r="1.6" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M4 5.2v5.6M4 5.2c0 2.2 1.8 2.8 4 2.8h2.2" />
    </svg>
  );
}

function Ico({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICON = {
  file: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  folderPlus:
    'M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  folderOpen:
    'M3.75 6.75h5.379a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H20.25m-16.5-3A2.25 2.25 0 0 0 1.5 9v8.25A2.25 2.25 0 0 0 3.75 19.5h16.5a2.25 2.25 0 0 0 2.25-2.25v-5.25a2.25 2.25 0 0 0-2.25-2.25H3.75',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',
  move: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  save: 'M4.5 3.75h12.19c.398 0 .779.158 1.06.44l2.06 2.06c.282.281.44.663.44 1.06v12.19a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75v-15a.75.75 0 0 1 .75-.75Zm3 0v5.25h8.25V3.75M7.5 20.25v-6h9v6',
  check: 'M4.5 12.75 9.75 18 19.5 6.75',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  x: 'M6 18 18 6M6 6l12 12',
};

const TREE_HOST_STYLE = {
  display: 'block',
  height: '100%',
  '--trees-accent-override': 'rgb(var(--color-accent))',
  '--trees-bg-override': 'transparent',
  '--trees-bg-muted-override': 'rgb(var(--color-hover))',
  '--trees-border-color-override': 'rgb(var(--color-border-subtle))',
  '--trees-fg-override': 'rgb(var(--color-primary))',
  '--trees-fg-muted-override': 'rgb(var(--color-secondary))',
  '--trees-focus-ring-color-override': 'rgb(var(--color-accent) / 0.55)',
  '--trees-font-size-override': '12px',
  '--trees-font-family-override': '"Geist", "DM Sans Variable", "DM Sans", system-ui, sans-serif',
  '--trees-item-margin-x-override': '4px',
  '--trees-item-padding-x-override': '8px',
  '--trees-padding-inline-override': '0px',
  '--trees-selected-bg-override': 'rgb(var(--color-accent) / 0.24)',
  '--trees-selected-fg-override': 'rgb(var(--color-primary))',
  '--trees-selected-focused-border-color-override': 'rgb(var(--color-accent) / 0.7)',
  '--trees-scrollbar-thumb-override': 'rgb(var(--color-border-default))',
  '--trees-git-added-color-override': 'rgb(var(--color-success))',
  '--trees-git-modified-color-override': 'rgb(var(--color-warning))',
  '--trees-git-renamed-color-override': 'rgb(var(--color-steel))',
  '--trees-git-untracked-color-override': 'rgb(var(--color-success))',
  '--trees-git-deleted-color-override': 'rgb(var(--color-danger))',
  '--trees-file-icon-color-default': 'rgb(var(--color-steel))',
} satisfies CSSProperties & Record<string, string | number>;

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function formatWorkspaceEntrySize(size: number | null): string {
  if (size === null) return '';
  if (!Number.isSafeInteger(size) || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatWorkspaceLoadError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  if (
    !firstLine ||
    raw.includes('\n') ||
    /Local API route did not complete/i.test(raw) ||
    /\/api\/workspace\//i.test(raw) ||
    /file:\/\//i.test(raw) ||
    /\s+at\s+\S+/i.test(raw)
  ) {
    return fallback;
  }
  return firstLine;
}

function validateWorkspaceCreateName(kind: 'file' | 'folder', name: string): string | null {
  if (name === '.' || name === '..') {
    return `${kind === 'file' ? 'File' : 'Folder'} name must be more specific.`;
  }
  if (name.includes('/') || name.includes('\\')) {
    return `${kind === 'file' ? 'File' : 'Folder'} names cannot include slashes.`;
  }
  return null;
}

function fileIcon(entry: WorkspaceEntry): string {
  if (entry.kind === 'directory') return '▸';
  if (entry.kind === 'symlink') return '↗';
  return '·';
}

function statusTone(status: WorkspaceGitStatusChange | null): 'muted' | 'success' | 'warning' | 'danger' | 'steel' {
  switch (status) {
    case 'added':
    case 'untracked':
      return 'success';
    case 'deleted':
    case 'conflicted':
      return 'danger';
    case 'renamed':
    case 'copied':
      return 'steel';
    case 'modified':
    case 'typechange':
      return 'warning';
    default:
      return 'muted';
  }
}

function useWorkspaceWatcher(cwd: string | null, enabled: boolean, onEvent: () => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!cwd || !enabled || typeof window === 'undefined') return;
    let closed = false;
    let timer: number | null = null;
    const source = createDesktopAwareEventSource(`/api/workspace/events?cwd=${encodeURIComponent(cwd)}`);
    const schedule = () => {
      if (closed) {
        return;
      }
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => onEventRef.current(), WATCH_DEBOUNCE_MS);
    };
    source.onmessage = (event) => {
      if (closed) {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type !== 'workspace') return;
      } catch {
        return;
      }
      schedule();
    };
    source.onerror = () => {
      if (closed) {
        return;
      }
      source.close();
      schedule();
    };
    return () => {
      closed = true;
      if (timer !== null) window.clearTimeout(timer);
      source.close();
    };
  }, [cwd, enabled]);
}

function buildPrompt(root: string | null, action: string, path: string): string {
  const rootText = root ? `In repo ${root}, ` : '';
  return `${rootText}${action} \`${path}\`.`;
}

function workspaceEntryToTreePath(entry: WorkspaceEntry): string {
  return entry.kind === 'directory' ? `${entry.path}/` : entry.path;
}

function workspaceDirectoryErrorToTreePath(path: string): string {
  return `${treePathToWorkspacePath(path)}/${WORKSPACE_TREE_ERROR_ROW_NAME}`;
}

function isWorkspaceTreeErrorPath(path: string): boolean {
  return treePathToWorkspacePath(path).endsWith(`/${WORKSPACE_TREE_ERROR_ROW_NAME}`);
}

export function buildWorkspaceTreePaths(
  entries: Iterable<WorkspaceEntry>,
  directoryStates: Record<string, { expanded: boolean; error: string | null }>,
): string[] {
  const paths = [...entries].map(workspaceEntryToTreePath);
  for (const [path, state] of Object.entries(directoryStates)) {
    if (state.expanded && state.error) {
      paths.push(workspaceDirectoryErrorToTreePath(path));
    }
  }
  return paths;
}

function treePathToWorkspacePath(path: string): string {
  return path.replace(/\/+$/g, '');
}

function collectExpandedWorkspaceFolderPaths(model: TreesModel, entries: Iterable<WorkspaceEntry>): string[] {
  const expanded: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'directory') {
      continue;
    }
    const item = model.getItem(workspaceEntryToTreePath(entry));
    if (item?.isDirectory() && item.isExpanded()) {
      expanded.push(workspaceEntryToTreePath(entry));
    }
  }
  return expanded;
}

function parentDirectory(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function WorkspaceTreeContextMenu({
  onCreateFile,
  onCreateFolder,
  onDelete,
  onOpenInFinder,
  onMove,
  onRename,
}: {
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDelete: () => void;
  onOpenInFinder?: () => void;
  onMove: () => void;
  onRename: () => void;
}) {
  return (
    <ContextMenuWrapper className="ui-menu-shell ui-context-menu-shell absolute bottom-auto left-0 right-auto top-0 mb-0 min-w-[224px]">
      <div role="menu" aria-label="Workspace entry actions">
        <ContextMenuSections>
          <ContextMenuSection>
            <MenuItem className="gap-2" onClick={onCreateFile}>
              <Ico d={ICON.file} size={12} />
              New File
            </MenuItem>
            <MenuItem className="gap-2" onClick={onCreateFolder}>
              <Ico d={ICON.folderPlus} size={12} />
              New Folder
            </MenuItem>
          </ContextMenuSection>
          {onOpenInFinder ? (
            <ContextMenuSection>
              <MenuItem className="gap-2" onClick={onOpenInFinder}>
                <Ico d={ICON.folderOpen} size={12} />
                Open in Finder
              </MenuItem>
            </ContextMenuSection>
          ) : null}
          <ContextMenuSection>
            <MenuItem className="gap-2" onClick={onRename}>
              <Ico d={ICON.pencil} size={12} />
              Rename
            </MenuItem>
            <MenuItem className="gap-2" onClick={onMove}>
              <Ico d={ICON.move} size={12} />
              Move to…
            </MenuItem>
          </ContextMenuSection>
          <ContextMenuSection>
            <MenuItem className="gap-2" tone="danger" onClick={onDelete}>
              <Ico d={ICON.trash} size={12} />
              Delete
            </MenuItem>
          </ContextMenuSection>
        </ContextMenuSections>
      </div>
    </ContextMenuWrapper>
  );
}

function getSelectedTextWithin(container: HTMLElement | null): string {
  if (!container || typeof window === 'undefined') {
    return '';
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return '';
  }

  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const target = commonAncestor instanceof HTMLElement ? commonAncestor : commonAncestor.parentElement;
  if (!target || !container.contains(target)) {
    return '';
  }

  return selection.toString().trim();
}

function WorkspaceStatusBadge({ status, count }: { status: WorkspaceGitStatusChange | null; count?: number }) {
  if (!status && !count) return null;
  if (status) {
    return (
      <Pill tone={statusTone(status)} mono className="px-1.5 py-0 text-[10px]" title={STATUS_TITLES[status]}>
        {STATUS_LABELS[status]}
      </Pill>
    );
  }
  return (
    <span
      className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
      title={`${count} changed descendant${count === 1 ? '' : 's'}`}
    >
      {count}
    </span>
  );
}

function WorkspaceTreeRow({
  entry,
  depth,
  selectedPath,
  node,
  nodes,
  onToggle,
  onSelect,
  onDraftPrompt,
  root,
}: {
  entry: WorkspaceEntry;
  depth: number;
  selectedPath: string | null;
  node: TreeNodeState | undefined;
  nodes: Record<string, TreeNodeState>;
  onToggle: (entry: WorkspaceEntry) => void;
  onSelect: (entry: WorkspaceEntry) => void;
  onDraftPrompt: (prompt: string) => void;
  root: string | null;
}) {
  const selected = selectedPath === entry.path;
  const isDirectory = entry.kind === 'directory';
  return (
    <div>
      <div
        className={cx(
          'group flex min-h-7 min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-secondary hover:bg-surface/70 hover:text-primary',
          selected && 'bg-accent/10 text-primary',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => (isDirectory ? onToggle(entry) : onSelect(entry))}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            isDirectory ? onToggle(entry) : onSelect(entry);
          }
        }}
      >
        <span className={cx('w-3 shrink-0 text-dim transition-transform', isDirectory && node?.expanded && 'rotate-90')}>
          {fileIcon(entry)}
        </span>
        <span className={cx('min-w-0 flex-1 truncate', isDirectory ? 'font-medium' : 'font-mono')}>{entry.name}</span>
        {entry.size !== null && (
          <span className="hidden shrink-0 text-[10px] text-dim group-hover:inline">{formatWorkspaceEntrySize(entry.size)}</span>
        )}
        <WorkspaceStatusBadge status={entry.gitStatus} count={entry.descendantGitStatusCount} />
        <TextButton
          className="hidden shrink-0 rounded px-1 py-0.5 text-[10px] text-dim hover:bg-elevated hover:text-primary group-hover:inline"
          title="Draft an agent prompt for this path"
          onClick={(event) => {
            event.stopPropagation();
            onDraftPrompt(buildPrompt(root, 'inspect this path', entry.path));
          }}
        >
          ask
        </TextButton>
      </div>
      {isDirectory && node?.expanded && (
        <div>
          {node.loading && (
            <div className="px-3 py-1 text-[11px] text-dim" style={{ paddingLeft: `${24 + depth * 14}px` }}>
              Loading…
            </div>
          )}
          {node.error && (
            <div className="px-3 py-1 text-[11px] text-danger" style={{ paddingLeft: `${24 + depth * 14}px` }}>
              {node.error}
            </div>
          )}
          {node.entries?.map((child) => (
            <WorkspaceTreeBranch
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              node={nodes[child.path]}
              nodes={nodes}
              onToggle={onToggle}
              onSelect={onSelect}
              onDraftPrompt={onDraftPrompt}
              root={root}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceTreeBranch(props: Parameters<typeof WorkspaceTreeRow>[0]) {
  return <WorkspaceTreeRow {...props} />;
}

export function WorkspaceExplorer({
  cwd,
  onDraftPrompt,
  onOpenFile,
  activeFilePath = null,
  openFilesScope = null,
  railOnly = false,
}: WorkspaceExplorerProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(() => readStoredBoolean(WORKSPACE_EXPLORER_OPEN_KEY, true));
  const [showDiff, setShowDiff] = useState(() => readStoredBoolean(WORKSPACE_EXPLORER_DIFF_KEY, true));
  const [rootListing, setRootListing] = useState<LoadState<WorkspaceDirectoryListing>>({ status: 'idle', data: null, error: null });
  const [nodes, setNodes] = useState<Record<string, TreeNodeState>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileState, setFileState] = useState<LoadState<WorkspaceFileContent>>({ status: 'idle', data: null, error: null });
  const [diffState, setDiffState] = useState<LoadState<WorkspaceDiffOverlay>>({ status: 'idle', data: null, error: null });
  const refreshSerial = useRef(0);
  const refreshTimer = useRef<number | null>(null);
  const selectFileRequestIdRef = useRef(0);
  const directoryLoadLifecycleRef = useRef(createWorkspaceDirectoryRequestLifecycle());
  const useNativeWorkspaceContextMenu = shouldUseNativeAppContextMenus();
  const { model, resetTree, nativeContextMenuOpenRef } = useFileTreeModel({
    useNativeContextMenu: useNativeWorkspaceContextMenu,
    dragAndDrop: {
      canDrag: (paths) => paths.every((path) => !isWorkspaceTreeErrorPath(path)),
    },
    onSelectionChange: (paths) => {
      const selected = paths[0];
      if (!selected) return;
      if (isWorkspaceTreeErrorPath(selected)) return;
      const workspacePath = treePathToWorkspacePath(selected);
      const entry = workspaceEntryMap.get(workspacePath);
      if (!entry || entry.kind === 'directory') return;
      if (cwd && onOpenFile) {
        openWorkspaceFile(entry.path);
        return;
      }
      onDraftPrompt(buildPrompt(root, 'inspect this file', entry.path));
    },
    onRename: ({ sourcePath, destinationPath }: FileTreeRenameEvent) => {
      if (!cwd) return;
      const entry = workspaceEntryMap.get(treePathToWorkspacePath(sourcePath));
      const nextName = destinationPath.split('/').filter(Boolean).pop()?.trim() ?? '';
      if (!entry || !nextName || nextName === entry.name) return;
      void api
        .renameWorkspacePath(cwd, entry.path, nextName)
        .then((renamed) => {
          const current = readWorkspaceOpenFiles(cwd, openFilesScope);
          const next = current.map((path) =>
            path === entry.path
              ? renamed.path
              : path.startsWith(`${entry.path}/`)
                ? `${renamed.path}/${path.slice(entry.path.length + 1)}`
                : path,
          );
          writeWorkspaceOpenFiles(cwd, next, openFilesScope);
          void loadRoot();
          const parent = parentDirectory(entry.path);
          if (parent) void loadDirectory(parent);
        })
        .catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
    },
  });

  const loadRoot = useCallback(async () => {
    if (!cwd) return;
    const serial = ++refreshSerial.current;
    setRootListing((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await api.workspaceTree(cwd, '');
      if (refreshSerial.current !== serial) return;
      setRootListing({ status: 'idle', data, error: null });
    } catch (error) {
      if (refreshSerial.current !== serial) return;
      setRootListing({
        status: 'idle',
        data: null,
        error: formatWorkspaceLoadError(error, 'Could not load the workspace file tree. Refresh the workspace or reopen the conversation.'),
      });
    }
  }, [cwd]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      void loadRoot();
    }, GIT_REFRESH_DEBOUNCE_MS);
  }, [loadRoot]);

  useWorkspaceWatcher(cwd, open || railOnly, scheduleRefresh);

  useEffect(() => {
    selectFileRequestIdRef.current += 1;
    resetWorkspaceDirectoryRequestLifecycle(directoryLoadLifecycleRef.current);
    setNodes({});
    setSelectedPath(null);
    setFileState({ status: 'idle', data: null, error: null });
    setDiffState({ status: 'idle', data: null, error: null });
    void loadRoot();
  }, [cwd, loadRoot]);

  useEffect(() => {
    if (!railOnly) return;
    function refreshTree() {
      void loadRoot();
    }

    window.addEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshTree);
    return () => window.removeEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshTree);
  }, [loadRoot, railOnly]);

  useEffect(() => {
    if (railOnly) return;
    function toggleDiff() {
      setShowDiff((value) => !value);
    }

    window.addEventListener(WORKBENCH_TOGGLE_DIFF_EVENT, toggleDiff);
    return () => window.removeEventListener(WORKBENCH_TOGGLE_DIFF_EVENT, toggleDiff);
  }, [railOnly]);

  useEffect(() => {
    if (!cwd || !activeFilePath) return;
    writeWorkspaceOpenFiles(cwd, addWorkspaceOpenFile(readWorkspaceOpenFiles(cwd, openFilesScope), activeFilePath), openFilesScope);
  }, [activeFilePath, cwd, openFilesScope]);

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    },
    [],
  );

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!cwd) return;
      const request = beginWorkspaceDirectoryRequest(directoryLoadLifecycleRef.current, path);
      const isCurrentRequest = () => isWorkspaceDirectoryRequestCurrent(directoryLoadLifecycleRef.current, request);

      setNodes((current) => ({
        ...current,
        [path]: { ...(current[path] ?? { expanded: true, entries: null, error: null }), expanded: true, loading: true, error: null },
      }));
      try {
        const listing = await api.workspaceTree(cwd, path);
        if (!isCurrentRequest()) {
          return;
        }
        setNodes((current) => ({ ...current, [path]: { expanded: true, loading: false, entries: listing.entries, error: null } }));
      } catch (error) {
        if (!isCurrentRequest()) {
          return;
        }
        setNodes((current) => ({
          ...current,
          [path]: {
            ...(current[path] ?? { expanded: true, entries: null }),
            expanded: true,
            loading: false,
            error: formatWorkspaceLoadError(error, 'Could not load this folder. Refresh the workspace or try again.'),
          },
        }));
      }
    },
    [cwd],
  );

  const toggleDirectory = useCallback(
    (entry: WorkspaceEntry) => {
      setNodes((current) => {
        const existing = current[entry.path];
        if (existing?.expanded) {
          invalidateWorkspaceDirectoryRequest(directoryLoadLifecycleRef.current, entry.path);
          return { ...current, [entry.path]: { ...existing, expanded: false } };
        }
        return {
          ...current,
          [entry.path]: { expanded: true, loading: !existing?.entries, entries: existing?.entries ?? null, error: null },
        };
      });
      if (!nodes[entry.path]?.entries) void loadDirectory(entry.path);
    },
    [loadDirectory, nodes],
  );

  const selectFile = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!cwd) return;
      const requestId = selectFileRequestIdRef.current + 1;
      selectFileRequestIdRef.current = requestId;
      const isCurrentRequest = () => selectFileRequestIdRef.current === requestId;
      setSelectedPath(entry.path);
      setFileState({ status: 'loading', data: null, error: null });
      setDiffState({ status: 'idle', data: null, error: null });
      try {
        const file = await api.workspaceFile(cwd, entry.path);
        if (!isCurrentRequest()) {
          return;
        }
        setFileState({ status: 'idle', data: file, error: null });
        if (file.gitStatus) {
          setDiffState({ status: 'loading', data: null, error: null });
          try {
            const diff = await api.workspaceDiff(cwd, entry.path);
            if (!isCurrentRequest()) {
              return;
            }
            setDiffState({ status: 'idle', data: diff, error: null });
          } catch {
            if (!isCurrentRequest()) {
              return;
            }
            setDiffState({ status: 'idle', data: null, error: null });
          }
        }
      } catch (error) {
        if (!isCurrentRequest()) {
          return;
        }
        setFileState({
          status: 'idle',
          data: null,
          error: formatWorkspaceLoadError(error, 'Could not open this file. Refresh the workspace or try again.'),
        });
      }
    },
    [cwd],
  );

  const openWorkspaceFile = useCallback(
    (path: string) => {
      if (!cwd) return;
      writeWorkspaceOpenFiles(cwd, addWorkspaceOpenFile(readWorkspaceOpenFiles(cwd, openFilesScope), path), openFilesScope);
      if (onOpenFile) {
        onOpenFile({ cwd, path });
        return;
      }
      onDraftPrompt(buildPrompt(rootListing.data?.root ?? cwd, 'inspect this file', path));
    },
    [cwd, onDraftPrompt, onOpenFile, openFilesScope, rootListing.data?.root],
  );

  const [createPathPrompt, setCreatePathPrompt] = useState<{ kind: 'file' | 'folder'; directory: string } | null>(null);
  const [movePathPrompt, setMovePathPrompt] = useState<WorkspaceEntry | null>(null);
  const [pathPromptError, setPathPromptError] = useState<string | null>(null);
  const [pathPromptSubmitting, setPathPromptSubmitting] = useState(false);

  const createPath = useCallback((kind: 'file' | 'folder', directory: string) => {
    setPathPromptError(null);
    setPathPromptSubmitting(false);
    setCreatePathPrompt({ kind, directory });
  }, []);

  const submitCreatePath = useCallback(
    async (kind: 'file' | 'folder', directory: string, name: string) => {
      if (!cwd) return;
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const validationError = validateWorkspaceCreateName(kind, trimmedName);
      if (validationError) {
        setPathPromptError(validationError);
        return;
      }
      const path = [directory, trimmedName].filter(Boolean).join('/');
      setPathPromptError(null);
      setPathPromptSubmitting(true);
      try {
        if (kind === 'file') {
          await api.createWorkspaceFile(cwd, path, '');
          openWorkspaceFile(path);
        } else {
          await api.createWorkspaceFolder(cwd, path);
        }
        await loadRoot();
        if (directory) await loadDirectory(directory);
        setCreatePathPrompt(null);
      } catch (error) {
        setPathPromptError(formatWorkspaceLoadError(error, 'Could not create this item. Try a different name.'));
      } finally {
        setPathPromptSubmitting(false);
      }
    },
    [cwd, loadDirectory, loadRoot, openWorkspaceFile],
  );

  const deletePath = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!cwd) return;
      if (!window.confirm(`Delete ${entry.path}? This cannot be undone.`)) return;
      await api.deleteWorkspacePath(cwd, entry.path);
      const current = readWorkspaceOpenFiles(cwd, openFilesScope);
      const next =
        entry.kind === 'directory'
          ? current.filter((path) => !path.startsWith(`${entry.path}/`))
          : removeWorkspaceOpenFile(current, entry.path);
      writeWorkspaceOpenFiles(cwd, next, openFilesScope);
      await loadRoot();
      const parent = parentDirectory(entry.path);
      if (parent) await loadDirectory(parent);
    },
    [cwd, loadDirectory, loadRoot, openFilesScope],
  );

  const movePath = useCallback((entry: WorkspaceEntry) => {
    setPathPromptError(null);
    setPathPromptSubmitting(false);
    setMovePathPrompt(entry);
  }, []);

  const submitMovePath = useCallback(
    async (entry: WorkspaceEntry, targetDir: string) => {
      if (!cwd) return;
      const normalizedTargetDir = targetDir.trim();
      setPathPromptError(null);
      setPathPromptSubmitting(true);
      try {
        const moved = await api.moveWorkspacePath(cwd, entry.path, normalizedTargetDir);
        const current = readWorkspaceOpenFiles(cwd, openFilesScope);
        const next = current.map((path) =>
          path === entry.path
            ? moved.path
            : path.startsWith(`${entry.path}/`)
              ? `${moved.path}/${path.slice(entry.path.length + 1)}`
              : path,
        );
        writeWorkspaceOpenFiles(cwd, next, openFilesScope);
        await loadRoot();
        await loadDirectory(parentDirectory(entry.path));
        if (normalizedTargetDir) await loadDirectory(normalizedTargetDir);
        setMovePathPrompt(null);
      } catch (error) {
        setPathPromptError(formatWorkspaceLoadError(error, 'Could not move this item. Check the destination and try again.'));
      } finally {
        setPathPromptSubmitting(false);
      }
    },
    [cwd, loadDirectory, loadRoot, openFilesScope],
  );

  const root = rootListing.data?.root ?? null;
  const changes = rootListing.data?.changes ?? [];
  const workspaceEntryMap = useMemo(() => {
    const map = new Map<string, WorkspaceEntry>();
    for (const entry of rootListing.data?.entries ?? []) {
      map.set(entry.path, entry);
    }
    for (const node of Object.values(nodes)) {
      for (const entry of node.entries ?? []) {
        map.set(entry.path, entry);
      }
    }
    return map;
  }, [nodes, rootListing.data?.entries]);
  const workspaceTreePaths = useMemo(() => buildWorkspaceTreePaths(workspaceEntryMap.values(), nodes), [nodes, workspaceEntryMap]);
  const workspaceTreePathSignature = useMemo(() => workspaceTreePaths.join('\n'), [workspaceTreePaths]);
  const workspaceTreeResetRef = useRef({ entryMap: workspaceEntryMap, paths: workspaceTreePaths });
  workspaceTreeResetRef.current = { entryMap: workspaceEntryMap, paths: workspaceTreePaths };
  const selectedFile = fileState.data;
  const canToggleDiff = Boolean(selectedFile?.gitStatus && !selectedFile.binary && !selectedFile.tooLarge);
  const diffSpec = showDiff && diffState.data ? diffState.data : { addedLines: [], deletedBlocks: [] };
  const pathPromptDialogs = (
    <>
      {createPathPrompt ? (
        <TextPromptDialog
          title={createPathPrompt.kind === 'file' ? 'New file' : 'New folder'}
          label={createPathPrompt.kind === 'file' ? 'New file name' : 'New folder name'}
          initialValue={createPathPrompt.kind === 'file' ? 'untitled.txt' : 'New Folder'}
          error={pathPromptError}
          submitting={pathPromptSubmitting}
          onCancel={() => {
            setCreatePathPrompt(null);
            setPathPromptError(null);
            setPathPromptSubmitting(false);
          }}
          onSubmit={(name) => void submitCreatePath(createPathPrompt.kind, createPathPrompt.directory, name)}
        />
      ) : null}
      {movePathPrompt ? (
        <TextPromptDialog
          title={`Move ${movePathPrompt.path}`}
          label="Move to folder (blank for workspace root)"
          initialValue={parentDirectory(movePathPrompt.path)}
          allowEmpty
          confirmLabel="Move"
          error={pathPromptError}
          submitting={pathPromptSubmitting}
          onCancel={() => {
            setMovePathPrompt(null);
            setPathPromptError(null);
            setPathPromptSubmitting(false);
          }}
          onSubmit={(targetDir) => void submitMovePath(movePathPrompt, targetDir)}
        />
      ) : null}
    </>
  );

  useEffect(() => {
    writeStoredBoolean(WORKSPACE_EXPLORER_OPEN_KEY, open);
  }, [open]);

  useEffect(() => {
    writeStoredBoolean(WORKSPACE_EXPLORER_DIFF_KEY, showDiff);
  }, [showDiff]);

  useEffect(() => {
    const snapshot = workspaceTreeResetRef.current;
    resetTree(snapshot.paths, {
      initialExpandedPaths: collectExpandedWorkspaceFolderPaths(model, snapshot.entryMap.values()),
    });
  }, [model, resetTree, workspaceTreePathSignature]);

  useEffect(() => {
    nativeContextMenuOpenRef.current = (item, context) => {
      const entry = workspaceEntryMap.get(treePathToWorkspacePath(item.path));
      if (!entry || !cwd) return;
      const desktopBridge = getDesktopBridge();
      if (!desktopBridge?.showKnowledgeEntryContextMenu) return;
      context.close({ restoreFocus: false });
      void desktopBridge
        .showKnowledgeEntryContextMenu({
          x: context.anchorRect.left,
          y: context.anchorRect.bottom,
          canCreateFile: true,
          canCreateFolder: true,
          canOpenInFinder: Boolean(desktopBridge.openPath),
          canRename: true,
          canMove: true,
          canDelete: true,
        })
        .then(({ action }) => {
          if (action === 'new-file') void createPath('file', entry.kind === 'directory' ? entry.path : parentDirectory(entry.path));
          if (action === 'new-folder') void createPath('folder', entry.kind === 'directory' ? entry.path : parentDirectory(entry.path));
          if (action === 'open-in-finder') {
            void desktopBridge.openPath(
              entry.kind === 'directory' ? `${root ?? cwd}/${entry.path}` : `${root ?? cwd}/${parentDirectory(entry.path)}`,
            );
          }
          if (action === 'rename') model.startRenaming(workspaceEntryToTreePath(entry));
          if (action === 'move') void movePath(entry);
          if (action === 'delete') void deletePath(entry);
        });
    };
  }, [createPath, cwd, deletePath, model, movePath, root, workspaceEntryMap]);

  useEffect(() => {
    if (!railOnly) return;
    const unsubscribe = model.subscribe(() => {
      for (const entry of workspaceEntryMap.values()) {
        if (entry.kind !== 'directory') continue;
        const item = model.getItem(workspaceEntryToTreePath(entry));
        if (item?.isDirectory() && item.isExpanded() && !nodes[entry.path]?.entries && !nodes[entry.path]?.loading) {
          void loadDirectory(entry.path);
        }
      }
    });
    return unsubscribe;
  }, [loadDirectory, model, nodes, railOnly, workspaceEntryMap]);

  // model cleanup handled by useFileTreeModel

  if (!cwd) return null;

  if (!open && !railOnly) {
    return (
      <ToolbarButton
        className="absolute right-3 top-3 z-40 rounded-md border border-border-subtle bg-base/90 px-2 py-1 text-[11px] text-secondary shadow-sm hover:text-primary"
        onClick={() => setOpen(true)}
      >
        Files
      </ToolbarButton>
    );
  }

  if (railOnly) {
    return (
      <>
        <div className="flex h-full flex-col bg-panel text-sm">
          <div className="min-h-0 flex-1 overflow-hidden px-1.5 py-2">
            {rootListing.status === 'loading' && !rootListing.data ? (
              <PanelMessage className="animate-pulse px-3 py-2">Loading workspace…</PanelMessage>
            ) : rootListing.error ? (
              <EmptyState title="Workspace unavailable" body={rootListing.error} className="px-3 py-8" />
            ) : (
              <TreesFileTree
                className="h-full rounded-none"
                model={model}
                {...(!useNativeWorkspaceContextMenu
                  ? {
                      renderContextMenu: (item: FileTreeContextMenuItem, context: FileTreeContextMenuOpenContext) => {
                        const entry = workspaceEntryMap.get(treePathToWorkspacePath(item.path));
                        if (!entry) return null;
                        const directory = entry.kind === 'directory' ? entry.path : parentDirectory(entry.path);
                        const desktopBridge = getDesktopBridge();
                        return (
                          <WorkspaceTreeContextMenu
                            onCreateFile={() => {
                              context.close();
                              void createPath('file', directory);
                            }}
                            onCreateFolder={() => {
                              context.close();
                              void createPath('folder', directory);
                            }}
                            onOpenInFinder={
                              desktopBridge?.openPath
                                ? () => {
                                    context.close();
                                    void desktopBridge.openPath(
                                      entry.kind === 'directory' ? `${root ?? cwd}/${entry.path}` : `${root ?? cwd}/${directory}`,
                                    );
                                  }
                                : undefined
                            }
                            onRename={() => {
                              context.close({ restoreFocus: false });
                              window.setTimeout(() => model.startRenaming(workspaceEntryToTreePath(entry)), 0);
                            }}
                            onMove={() => {
                              context.close();
                              void movePath(entry);
                            }}
                            onDelete={() => {
                              context.close();
                              void deletePath(entry);
                            }}
                          />
                        );
                      },
                    }
                  : {})}
                style={TREE_HOST_STYLE}
              />
            )}
          </div>
        </div>
        {pathPromptDialogs}
      </>
    );
  }

  return (
    <div
      className={cx(
        'flex h-full bg-base/96 text-sm',
        railOnly
          ? 'w-full flex-col'
          : 'w-[min(42vw,560px)] min-w-[360px] shrink-0 border-l border-border-subtle shadow-[-12px_0_28px_rgba(0,0,0,0.08)]',
      )}
    >
      <div className={cx('flex h-full flex-col bg-panel', railOnly ? 'w-full' : 'w-[45%] min-w-[180px] border-r border-border-subtle')}>
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-primary">{rootListing.data?.rootName ?? 'Workspace'}</div>
            <div className="truncate font-mono text-[10px] text-dim" title={rootListing.data?.root ?? cwd}>
              {rootListing.data?.rootKind === 'git' ? 'Project root' : 'Working directory'} · {rootListing.data?.branch ?? 'No branch'}
            </div>
          </div>
          {changes.length > 0 && (
            <Pill tone="warning" mono className="px-1.5 py-0 text-[10px]">
              {changes.length}
            </Pill>
          )}
          {canToggleDiff ? (
            <IconButton
              compact
              className={cx('shrink-0', showDiff && 'text-accent')}
              title={showDiff ? 'Hide diff overlay' : 'Show diff overlay'}
              aria-label={showDiff ? 'Hide diff overlay' : 'Show diff overlay'}
              aria-pressed={showDiff}
              onClick={() => setShowDiff((value) => !value)}
            >
              <DiffOverlayIcon size={12} />
            </IconButton>
          ) : null}
          <IconButton
            compact
            title="Refresh workspace"
            aria-label="Refresh workspace"
            onClick={() => {
              void loadRoot();
            }}
          >
            ↻
          </IconButton>
          {!railOnly && (
            <IconButton compact title="Hide file explorer" aria-label="Hide file explorer" onClick={() => setOpen(false)}>
              ×
            </IconButton>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-1.5">
          {rootListing.status === 'loading' && !rootListing.data ? <LoadingState label="Loading files…" className="px-3 py-6" /> : null}
          {rootListing.error ? <EmptyState title="Workspace unavailable" body={rootListing.error} className="px-3 py-8" /> : null}
          {rootListing.data?.entries.map((entry) => (
            <WorkspaceTreeRow
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              node={nodes[entry.path]}
              nodes={nodes}
              onToggle={toggleDirectory}
              onSelect={selectFile}
              onDraftPrompt={onDraftPrompt}
              root={root}
            />
          ))}
        </div>
      </div>

      {!railOnly && (
        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedPath ? (
            <EmptyState
              className="flex h-full flex-col justify-center px-5"
              title="Select a file"
              body="Files open read-only. Dirty files can show inline git decorations over the current source."
            />
          ) : fileState.status === 'loading' ? (
            <LoadingState label="Opening file…" className="h-full justify-center" />
          ) : fileState.error ? (
            <EmptyState className="flex h-full flex-col justify-center px-5" title="File unavailable" body={fileState.error} />
          ) : selectedFile ? (
            <>
              <div className="flex items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2 text-secondary">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px] font-medium text-secondary" title={selectedFile.path}>
                    {selectedFile.path}
                  </div>
                  <div className="text-[10px] text-dim">
                    {formatWorkspaceEntrySize(selectedFile.size)} {selectedFile.binary ? '· binary' : ''}{' '}
                    {selectedFile.tooLarge ? '· large' : ''}
                  </div>
                </div>
                <WorkspaceStatusBadge status={selectedFile.gitStatus} />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {selectedFile.binary || (selectedFile.tooLarge && !selectedFile.content) ? (
                  <EmptyState
                    className="flex h-full flex-col justify-center px-5"
                    title={selectedFile.binary ? 'Binary file' : 'Large file'}
                    body="Metadata and git status are shown by default. Open anyway when you explicitly want to load the text."
                    action={
                      !selectedFile.binary ? (
                        <Button
                          variant="action"
                          onClick={async () => {
                            if (!cwd) return;
                            const requestId = selectFileRequestIdRef.current + 1;
                            selectFileRequestIdRef.current = requestId;
                            const isCurrentRequest = () => selectFileRequestIdRef.current === requestId;
                            setFileState({ status: 'loading', data: selectedFile, error: null });
                            const file = await api.workspaceFile(cwd, selectedFile.path, { force: true });
                            if (isCurrentRequest()) {
                              setFileState({ status: 'idle', data: file, error: null });
                            }
                          }}
                        >
                          Open anyway
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <Suspense fallback={<LoadingState label="Loading editor..." className="h-full justify-center" />}>
                    <WorkspaceCodeEditor
                      path={selectedFile.path}
                      value={selectedFile.content ?? ''}
                      theme={theme}
                      diffSpec={diffSpec}
                      editable={false}
                    />
                  </Suspense>
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-2">
                <ToolbarButton
                  className="text-[11px]"
                  onClick={() => onDraftPrompt(buildPrompt(root, 'explain this file', selectedFile.path))}
                >
                  Ask about file
                </ToolbarButton>
                <ToolbarButton
                  className="text-[11px]"
                  onClick={() => onDraftPrompt(buildPrompt(root, 'rename this file', selectedFile.path))}
                >
                  Rename
                </ToolbarButton>
                <ToolbarButton
                  className="text-[11px] text-danger"
                  onClick={() => onDraftPrompt(buildPrompt(root, 'delete this file after confirming it is safe', selectedFile.path))}
                >
                  Delete
                </ToolbarButton>
              </div>
            </>
          ) : null}
        </div>
      )}
      {pathPromptDialogs}
    </div>
  );
}

export function WorkspaceFileDocument({
  cwd,
  path,
  onReplyWithSelection,
  hideHeader = false,
}: {
  cwd: string;
  path: string;
  onReplyWithSelection?: (selection: { filePath: string; text: string }) => void;
  hideHeader?: boolean;
}) {
  const { theme } = useTheme();
  const [showDiff, setShowDiff] = useState(() => readStoredBoolean(WORKSPACE_EXPLORER_DIFF_KEY, true));
  const [fileState, setFileState] = useState<LoadState<WorkspaceFileContent>>({ status: 'loading', data: null, error: null });
  const [diffState, setDiffState] = useState<LoadState<WorkspaceDiffOverlay>>({ status: 'idle', data: null, error: null });
  const [draftContent, setDraftContent] = useState('');
  const [saveState, setSaveState] = useState<{ error: string | null }>({ error: null });

  const [selectionContextMenu, setSelectionContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const loadRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);

  const loadFile = useCallback(
    async (options?: { force?: boolean }) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      const isCurrentRequest = () => loadRequestIdRef.current === requestId;

      setFileState((current) => ({ status: 'loading', data: current.data, error: null }));
      setDiffState({ status: 'idle', data: null, error: null });
      try {
        const file = await api.workspaceFile(cwd, path, { force: options?.force });
        if (!isCurrentRequest()) {
          return;
        }
        setFileState({ status: 'idle', data: file, error: null });
        setDraftContent(file.content ?? '');
        setSaveState({ status: 'idle', error: null });
        if (file.gitStatus && !file.binary && !file.tooLarge) {
          setDiffState({ status: 'loading', data: null, error: null });
          try {
            const diff = await api.workspaceDiff(cwd, path);
            if (!isCurrentRequest()) {
              return;
            }
            setDiffState({ status: 'idle', data: diff, error: null });
          } catch {
            if (!isCurrentRequest()) {
              return;
            }
            // Diff is best-effort; don't let a diff failure cascade.
            setDiffState({ status: 'idle', data: null, error: null });
          }
        }
      } catch (error) {
        if (!isCurrentRequest()) {
          return;
        }
        setFileState({
          status: 'idle',
          data: null,
          error: formatWorkspaceLoadError(error, 'Could not open this file. Refresh the workspace or try again.'),
        });
      }
    },
    [cwd, path],
  );

  const selectedFile = fileState.data;
  const canToggleDiff = Boolean(selectedFile?.gitStatus && !selectedFile.binary && !selectedFile.tooLarge);

  useEffect(() => {
    void loadFile();
  }, [loadFile]);

  useEffect(() => {
    saveRequestIdRef.current += 1;
  }, [cwd, path]);

  useEffect(() => {
    function refreshFile() {
      void loadFile({ force: true });
    }

    window.addEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshFile);
    return () => window.removeEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshFile);
  }, [loadFile]);

  useEffect(() => {
    function toggleDiff() {
      if (!canToggleDiff) return;
      setShowDiff((value) => !value);
    }

    window.addEventListener(WORKBENCH_TOGGLE_DIFF_EVENT, toggleDiff);
    return () => window.removeEventListener(WORKBENCH_TOGGLE_DIFF_EVENT, toggleDiff);
  }, [canToggleDiff]);

  useEffect(() => {
    setExtensionCommandContext('workbench.canToggleDiff', canToggleDiff);
    return () => setExtensionCommandContext('workbench.canToggleDiff', null);
  }, [canToggleDiff]);

  useEffect(() => {
    const detail = { cwd, path, canToggleDiff, diffEnabled: showDiff };
    const publish = () => {
      window.dispatchEvent(new CustomEvent(WORKBENCH_DIFF_STATE_EVENT, { detail }));
    };

    publish();
    const publishAfterHostEffects = window.setTimeout(publish, 0);
    return () => {
      window.clearTimeout(publishAfterHostEffects);
      window.dispatchEvent(
        new CustomEvent(WORKBENCH_DIFF_STATE_EVENT, {
          detail: { cwd, path, canToggleDiff: false, diffEnabled: false },
        }),
      );
    };
  }, [canToggleDiff, cwd, path, showDiff]);

  // Debounced auto-save
  useEffect(() => {
    if (!selectedFile || selectedFile.binary || (selectedFile.tooLarge && !selectedFile.content)) {
      return;
    }

    const isDirty = draftContent !== (selectedFile.content ?? '');
    if (!isDirty) {
      return;
    }

    const saveRequestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = saveRequestId;
    const isCurrentSaveRequest = () => saveRequestIdRef.current === saveRequestId;

    const timer = window.setTimeout(() => {
      void api
        .writeWorkspaceFile(cwd, selectedFile.path, draftContent)
        .then((saved) => {
          if (!isCurrentSaveRequest()) {
            return;
          }
          setFileState({ status: 'idle', data: saved, error: null });
          setDraftContent(saved.content ?? draftContent);
          setSaveState({ error: null });
          if (saved.gitStatus && !saved.binary && !saved.tooLarge) {
            void api
              .workspaceDiff(cwd, saved.path)
              .then((diff) => {
                if (!isCurrentSaveRequest()) {
                  return;
                }
                setDiffState({ status: 'idle', data: diff, error: null });
              })
              .catch(() => {
                if (!isCurrentSaveRequest()) {
                  return;
                }
                setDiffState({ status: 'idle', data: null, error: null });
              });
          }
        })
        .catch((error) => {
          if (!isCurrentSaveRequest()) {
            return;
          }
          setSaveState({ error: error instanceof Error ? error.message : String(error) });
        });
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftContent, selectedFile, cwd]);

  useEffect(() => {
    writeStoredBoolean(WORKSPACE_EXPLORER_DIFF_KEY, showDiff);
  }, [showDiff]);

  const closeSelectionContextMenu = useCallback(() => {
    setSelectionContextMenu(null);
  }, []);

  useEffect(() => {
    if (!selectionContextMenu || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const handleSelectionChange = () => {
      if (!getSelectedTextWithin(editorContainerRef.current)) {
        closeSelectionContextMenu();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('blur', closeSelectionContextMenu);
    window.addEventListener('resize', closeSelectionContextMenu);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('blur', closeSelectionContextMenu);
      window.removeEventListener('resize', closeSelectionContextMenu);
    };
  }, [closeSelectionContextMenu, selectionContextMenu]);

  const diffSpec = showDiff && diffState.data ? diffState.data : { addedLines: [], deletedBlocks: [] };

  const copySelectedText = useCallback(
    async (text: string) => {
      closeSelectionContextMenu();
      if (!text) {
        return;
      }

      try {
        await writeClipboardText(text);
      } catch {
        // Selection-copy failures should not leave a rejected React event promise.
      }
    },
    [closeSelectionContextMenu],
  );

  const replyWithSelectedText = useCallback(
    (text: string) => {
      closeSelectionContextMenu();
      if (!selectedFile || !text || !onReplyWithSelection) {
        return;
      }

      onReplyWithSelection({ filePath: selectedFile.path, text });
    },
    [closeSelectionContextMenu, onReplyWithSelection, selectedFile],
  );

  const handleEditorContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const text = getSelectedTextWithin(editorContainerRef.current);
      if (!text) {
        closeSelectionContextMenu();
        return;
      }

      event.preventDefault();
      closeSelectionContextMenu();
      setSelectionContextMenu({ x: event.clientX, y: event.clientY, text });
    },
    [closeSelectionContextMenu, copySelectedText, onReplyWithSelection, replyWithSelectedText],
  );

  if (fileState.status === 'loading' && !selectedFile) {
    return <LoadingState label="Opening file…" className="h-full justify-center" />;
  }

  if (fileState.error) {
    return <EmptyState className="flex h-full flex-col justify-center px-5" title="File unavailable" body={fileState.error} />;
  }

  if (!selectedFile) {
    return <EmptyState className="flex h-full flex-col justify-center px-5" title="File unavailable" body="No file is selected." />;
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-base select-text">
      {hideHeader ? null : (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2 text-secondary">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[12px] text-secondary" title={path}>
              {path}
            </div>
          </div>
        </div>
      )}
      <div
        ref={editorContainerRef}
        className="min-h-0 flex-1 overflow-hidden border-r border-border-subtle"
        onContextMenu={handleEditorContextMenu}
      >
        {selectedFile.binary || (selectedFile.tooLarge && !selectedFile.content) ? (
          <EmptyState
            className="flex h-full flex-col justify-center px-5"
            title={selectedFile.binary ? 'Binary file' : 'Large file'}
            body="Metadata and git status are shown by default. Open anyway when you explicitly want to load the text."
            action={
              !selectedFile.binary ? (
                <Button
                  variant="action"
                  onClick={() => {
                    void loadFile({ force: true });
                  }}
                >
                  Open anyway
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Suspense fallback={<LoadingState label="Loading editor..." className="h-full justify-center" />}>
            <WorkspaceCodeEditor
              path={selectedFile.path}
              value={draftContent}
              theme={theme}
              diffSpec={diffSpec}
              editable
              onChange={setDraftContent}
            />
          </Suspense>
        )}
      </div>
      {saveState.error ? <div className="bg-danger/5 px-3 py-1 text-[11px] text-danger">{saveState.error}</div> : null}
      {selectionContextMenu ? (
        <ContextMenu
          ref={selectionContextMenuRef}
          aria-label="Selected file text actions"
          estimatedHeight={onReplyWithSelection ? 61 : 34}
          minWidth={WORKSPACE_SELECTION_CONTEXT_MENU_WIDTH}
          onClose={closeSelectionContextMenu}
          position={selectionContextMenu}
        >
          <ContextMenuSections>
            {onReplyWithSelection ? (
              <ContextMenuSection>
                <MenuItem onClick={() => replyWithSelectedText(selectionContextMenu.text)} role="menuitem">
                  Reply with Selection
                </MenuItem>
              </ContextMenuSection>
            ) : null}
            <ContextMenuSection>
              <MenuItem
                onClick={() => {
                  void copySelectedText(selectionContextMenu.text);
                }}
                role="menuitem"
              >
                Copy
              </MenuItem>
            </ContextMenuSection>
          </ContextMenuSections>
        </ContextMenu>
      ) : null}
    </div>
  );
}
