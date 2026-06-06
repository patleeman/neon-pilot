import type { KnowledgeEntry } from '@neon-pilot/extensions/data';
import {
  Button,
  canDropAllPaths,
  collapseExpandedFolderIds,
  ContextMenuWrapper,
  cx,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  type DesktopKnowledgeEntryContextMenuAction,
  Field,
  getDesktopBridge,
  getTopLevelDraggedPaths,
  IconButton,
  MenuItem,
  MenuSeparator,
  normalizeOpenFileIds,
  PanelMessage,
  readStoredExpandedFolderIds,
  readStoredOpenFileIds,
  readStoredRecentlyClosedFileIds,
  recordRecentlyClosedFileId,
  removeOpenFileId,
  renameExpandedFolderIds,
  renameOpenFileIds,
  Select,
  SectionLabel,
  shouldUseNativeAppContextMenus,
  TextInput,
  useApi,
  useFileTreeModel,
  useInvalidateOnTopics,
  writeStoredExpandedFolderIds,
  writeStoredOpenFileIds,
  writeStoredRecentlyClosedFileIds,
} from '@neon-pilot/extensions/ui';
import {
  type ContextMenuItem as FileTreeContextMenuItem,
  type ContextMenuOpenContext as FileTreeContextMenuOpenContext,
  FileTree as TreesModel,
  type FileTreeRenameEvent,
} from '@pierre/trees';
import { FileTree as TreesFileTree } from '@pierre/trees/react';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { knowledgeApi } from '../lib/knowledgeApi';
import { getKnowledgeBaseSyncPresentation } from '../lib/knowledgeBaseSyncStatus';
import { canDropKnowledgeEntry, normalizeKnowledgeDir } from './knowledgeDragAndDrop';
import { emitKBEvent, onKBEvent, useKnowledgeWatcher } from './knowledgeEvents';

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
  plus: 'M12 5v14M5 12h14',
  folderPlus:
    'M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',
  move: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  import: 'M12 3v12m0 0 4-4m-4 4-4-4m-5 8.25h18',
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  file: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  folderOpen:
    'M3.75 6.75h5.379a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H20.25m-16.5-3A2.25 2.25 0 0 0 1.5 9v8.25A2.25 2.25 0 0 0 3.75 19.5h16.5a2.25 2.25 0 0 0 2.25-2.25v-5.25a2.25 2.25 0 0 0-2.25-2.25H3.75',
};
const WORKBENCH_REFRESH_ACTIVE_FILE_EVENT = 'pa:workbench-refresh-active-file';

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
  '--trees-file-icon-color-default': 'rgb(var(--color-steel))',
} satisfies CSSProperties & Record<string, string | number>;

export interface FileTreeProps {
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  confirm?: (options: { title?: string; message: string }) => Promise<boolean>;
  onSyncKnowledgeBase?: () => Promise<unknown>;
}

interface ContextMenuProps {
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDelete: () => void;
  onOpenInFinder?: () => void;
  onMove: () => void;
  onRename: () => void;
}

interface FolderOption {
  id: string;
  label: string;
}

interface CreateEntryState {
  kind: 'file' | 'folder';
  directoryId: string;
  value: string;
}

function normalizeDirectoryId(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function idToDir(id: string): string {
  if (id.endsWith('/')) {
    return id;
  }

  const parts = id.split('/');
  parts.pop();
  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

function resolveRenamedFileId(fileId: string | null, oldId: string, newId: string): string | null {
  if (!fileId) {
    return null;
  }

  if (oldId.endsWith('/') && newId.endsWith('/') && fileId.startsWith(oldId)) {
    return `${newId}${fileId.slice(oldId.length)}`;
  }

  if (fileId === oldId) {
    return newId;
  }

  return null;
}

function isPathAffectedByRemoval(path: string | null, removedId: string): boolean {
  if (!path) {
    return false;
  }

  if (removedId.endsWith('/')) {
    return path.startsWith(removedId);
  }

  return path === removedId;
}

function removeOpenFileIdsWithin(openFileIds: readonly string[], removedId: string): string[] {
  if (removedId.endsWith('/')) {
    return openFileIds.filter((fileId) => !fileId.startsWith(removedId));
  }

  return removeOpenFileId(openFileIds, removedId);
}

function getExpandableFolderIds(path: string): string[] {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [];
  }

  const limit = path.endsWith('/') ? parts.length : parts.length - 1;
  const folderIds: string[] = [];
  for (let index = 1; index <= limit; index += 1) {
    folderIds.push(`${parts.slice(0, index).join('/')}/`);
  }
  return folderIds;
}

function collectExpandedFolderIds(model: TreesModel, folderIds: readonly string[]): Set<string> {
  const expanded = new Set<string>();
  for (const folderId of folderIds) {
    const item = model.getItem(folderId);
    if (item?.isDirectory()) {
      const directory = item;
      const ancestors = getExpandableFolderIds(folderId).slice(0, -1);
      const ancestorsExpanded = ancestors.every((ancestorId) => {
        const ancestorItem = model.getItem(ancestorId);
        return ancestorItem?.isDirectory() ? ancestorItem.isExpanded() : false;
      });

      if (directory.isExpanded() && ancestorsExpanded) {
        expanded.add(folderId);
      }
    }
  }
  return expanded;
}

function collectRawExpandedFolderIds(model: TreesModel, folderIds: readonly string[]): Set<string> {
  const expanded = new Set<string>();
  for (const folderId of folderIds) {
    const item = model.getItem(folderId);
    if (item?.isDirectory() && item.isExpanded()) {
      expanded.add(folderId);
    }
  }
  return expanded;
}

function hasSameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function createFallbackEntry(path: string, kind: KnowledgeEntry['kind'], name?: string): KnowledgeEntry {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return {
    id: path,
    kind,
    name: name ?? trimmed.split('/').filter(Boolean).pop() ?? trimmed,
    path: trimmed,
    sizeBytes: 0,
    updatedAt: '',
  };
}

function resolveFinderTargetPath(root: string | null | undefined, entry: KnowledgeEntry): string | null {
  const normalizedRoot = root?.trim().replace(/\/+$/u, '') ?? '';
  if (!normalizedRoot) {
    return null;
  }

  const relativePath = entry.id.trim().replace(/^\/+|\/+$/gu, '');
  if (!relativePath) {
    return normalizedRoot;
  }

  if (entry.kind === 'folder') {
    return `${normalizedRoot}/${relativePath}`;
  }

  const parentPath = relativePath.split('/').slice(0, -1).join('/');
  return parentPath ? `${normalizedRoot}/${parentPath}` : normalizedRoot;
}

function getCreateTargetDirectoryId(entry: KnowledgeEntry): string {
  return entry.kind === 'folder' ? entry.id : idToDir(entry.id);
}

function TreeContextMenu({ onCreateFile, onCreateFolder, onDelete, onOpenInFinder, onMove, onRename }: ContextMenuProps) {
  return (
    <ContextMenuWrapper className="ui-menu-shell ui-context-menu-shell absolute bottom-auto left-0 right-auto top-0 mb-0 min-w-[224px]">
      <div className="space-y-px" role="menu" aria-label="Knowledge entry actions">
        <MenuItem className="gap-2" onClick={onCreateFile}>
          <Ico d={ICON.file} size={12} />
          New File
        </MenuItem>
        <MenuItem className="gap-2" onClick={onCreateFolder}>
          <Ico d={ICON.folderPlus} size={12} />
          New Folder
        </MenuItem>
        <MenuSeparator />
        {onOpenInFinder ? (
          <>
            <MenuItem className="gap-2" onClick={onOpenInFinder}>
              <Ico d={ICON.folderOpen} size={12} />
              Open in Finder
            </MenuItem>
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem className="gap-2" onClick={onRename}>
          <Ico d={ICON.pencil} size={12} />
          Rename
        </MenuItem>
        <MenuItem className="gap-2" onClick={onMove}>
          <Ico d={ICON.move} size={12} />
          Move to...
        </MenuItem>
        <MenuSeparator />
        <MenuItem className="gap-2" tone="danger" onClick={onDelete}>
          <Ico d={ICON.trash} size={12} />
          Delete
        </MenuItem>
      </div>
    </ContextMenuWrapper>
  );
}

function MoveModal({
  paths,
  folderOptions,
  entryMap,
  onConfirm,
  onClose,
}: {
  paths: readonly string[];
  folderOptions: readonly FolderOption[];
  entryMap: Map<string, KnowledgeEntry>;
  onConfirm: (targetDir: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState('');
  const title = paths.length === 1 ? `Move "${entryMap.get(paths[0] ?? '')?.name ?? ''}"` : `Move ${paths.length} items`;

  return (
    <Dialog onClose={onClose} labelledBy="knowledge-move-title" className="max-w-[20rem]">
      <DialogHeader title={title} titleId="knowledge-move-title" description="Select destination folder." />
      <DialogBody>
        <Field label="Destination">
          <Select aria-label="Move destination" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {folderOptions.map((folder) => (
              <option
                key={folder.id}
                value={folder.id}
                disabled={
                  !canDropAllPaths(paths, folder.id, (path, dir) => {
                    const entry = entryMap.get(path);
                    return entry ? canDropKnowledgeEntry(entry, dir) : false;
                  })
                }
              >
                {folder.label}
              </option>
            ))}
          </Select>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="action" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="action"
          tone="accent"
          onClick={() => {
            onConfirm(selected);
            onClose();
          }}
        >
          Move
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ImportUrlModal({
  initialDirectoryId,
  onImport,
  onClose,
}: {
  initialDirectoryId: string;
  onImport: (input: { url: string; title: string; directoryId: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [directoryId, setDirectoryId] = useState(initialDirectoryId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError('URL is required.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        await onImport({
          url: trimmedUrl,
          title: title.trim(),
          directoryId: normalizeDirectoryId(directoryId),
        });
        onClose();
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : String(importError));
        setSubmitting(false);
      }
    },
    [directoryId, onClose, onImport, title, url],
  );

  return (
    <Dialog onClose={submitting ? undefined : onClose} closeOnBackdrop={!submitting} labelledBy="knowledge-import-url-title">
      <DialogHeader
        title="Import URL"
        titleId="knowledge-import-url-title"
        description="Paste a web URL and Neon Pilot will fetch readable content into a new knowledge note."
      />
      <DialogBody>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <Field label="URL">
            <TextInput
              ref={urlRef}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article…"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <Field label="Title override" hint="Optional. Leave blank to use the page title.">
            <TextInput
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave blank to use the page title…"
              autoComplete="off"
            />
          </Field>
          <Field label="Target folder" hint="Optional.">
            <TextInput
              type="text"
              value={directoryId}
              onChange={(event) => setDirectoryId(event.target.value)}
              placeholder="Inbox…"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          <DialogFooter className="border-t-0 px-0 pb-0">
            <Button variant="action" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="action" tone="accent" disabled={submitting}>
              {submitting ? 'Importing…' : 'Import URL'}
            </Button>
          </DialogFooter>
        </form>
      </DialogBody>
    </Dialog>
  );
}

function CreateEntryModal({
  onClose,
  onConfirm,
  state,
}: {
  onClose: () => void;
  onConfirm: (value: string) => Promise<void>;
  state: CreateEntryState;
}) {
  const [value, setValue] = useState(state.value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) {
        setError(state.kind === 'file' ? 'File name is required.' : 'Folder name is required.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        await onConfirm(trimmed);
        onClose();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : String(submitError));
        setSubmitting(false);
      }
    },
    [onClose, onConfirm, state.kind, value],
  );

  const title = state.kind === 'file' ? 'New file' : 'New folder';
  const label = state.kind === 'file' ? 'File name' : 'Folder name';
  const targetLabel = state.directoryId || 'knowledge root';

  return (
    <Dialog
      onClose={submitting ? undefined : onClose}
      closeOnBackdrop={!submitting}
      labelledBy="knowledge-create-entry-title"
      className="max-w-[28rem]"
    >
      <DialogHeader
        title={title}
        titleId="knowledge-create-entry-title"
        description={`Create a new ${state.kind === 'file' ? 'markdown file' : 'folder'} in ${targetLabel}.`}
      />
      <DialogBody>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <Field label={label}>
            <TextInput
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={state.kind === 'file' ? 'untitled.md…' : 'New Folder…'}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          <DialogFooter className="border-t-0 px-0 pb-0">
            <Button variant="action" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="action" tone="accent" disabled={submitting}>
              {submitting ? 'Creating…' : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogBody>
    </Dialog>
  );
}

export function KnowledgeFileTree({ activeFileId, onFileSelect, confirm, onSyncKnowledgeBase }: FileTreeProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [movePaths, setMovePaths] = useState<string[] | null>(null);
  const [importDirectoryId, setImportDirectoryId] = useState<string | null>(null);
  const [createEntryState, setCreateEntryState] = useState<CreateEntryState | null>(null);
  const [syncingKnowledgeBase, setSyncingKnowledgeBase] = useState(false);
  const initialOpenFileIds = useRef(activeFileId ? [activeFileId] : readStoredOpenFileIds().slice(0, 1));
  const openFileIdsRef = useRef<string[]>(initialOpenFileIds.current);
  const recentlyClosedFileIdsRef = useRef<string[]>(readStoredRecentlyClosedFileIds());
  const expandedFolderIdsRef = useRef<Set<string>>(readStoredExpandedFolderIds());
  const visibleExpandedFolderIdsRef = useRef<Set<string>>(new Set(expandedFolderIdsRef.current));
  const activeFileIdRef = useRef(activeFileId);
  const entryMapRef = useRef<Map<string, KnowledgeEntry>>(new Map());
  const folderIdsRef = useRef<string[]>([]);
  const reconcilingExpansionRef = useRef(false);
  const treeHostWrapperRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const useNativeKnowledgeContextMenu = shouldUseNativeAppContextMenus();
  const {
    data: knowledgeBaseState,
    loading: knowledgeBaseLoading,
    error: knowledgeBaseError,
    refetch: refetchKnowledgeBase,
  } = useApi(knowledgeApi.state, 'knowledge-base-tree-status');
  const { model, resetTree, nativeContextMenuOpenRef, canDropRef, dropCompleteRef } = useFileTreeModel({
    useNativeContextMenu: useNativeKnowledgeContextMenu,
    onSelectionChange: (paths) => {
      const selectedPath = paths.find((path) => !path.endsWith('/')) ?? null;
      if (selectedPath && selectedPath !== activeFileIdRef.current) {
        onFileSelect(selectedPath);
      }
    },
    onRename: (event) => {
      void handleRename(event);
    },
  });

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const folderIds = useMemo(() => entries.filter((entry) => entry.kind === 'folder').map((entry) => entry.id), [entries]);
  const folderOptions = useMemo<FolderOption[]>(
    () => [{ id: '', label: '/ (knowledge root)' }, ...folderIds.map((folderId) => ({ id: folderId, label: folderId }))],
    [folderIds],
  );
  const knowledgeBaseDisabled = knowledgeBaseState?.configured === false;
  const knowledgeBaseSnapshotKey = knowledgeBaseState?.configured ? (knowledgeBaseState.effectiveRoot ?? 'configured') : null;
  const knowledgeBaseSyncPresentation = useMemo(() => {
    if (knowledgeBaseError && !knowledgeBaseState && !knowledgeBaseLoading) {
      return {
        text: `Sync status unavailable · ${knowledgeBaseError}`,
        toneClass: 'text-danger',
        dotClass: 'bg-danger',
        pulse: false,
      };
    }

    return getKnowledgeBaseSyncPresentation(knowledgeBaseState);
  }, [knowledgeBaseError, knowledgeBaseLoading, knowledgeBaseState]);

  const persistOpenFileIds = useCallback((nextOpenFileIds: readonly string[]) => {
    const normalized = normalizeOpenFileIds(nextOpenFileIds).slice(0, 1);
    openFileIdsRef.current = normalized;
    writeStoredOpenFileIds(normalized);
  }, []);

  const persistRecentlyClosedFileIds = useCallback((nextRecentlyClosedFileIds: readonly string[]) => {
    const normalized = normalizeOpenFileIds(nextRecentlyClosedFileIds);
    recentlyClosedFileIdsRef.current = normalized;
    writeStoredRecentlyClosedFileIds(normalized);
  }, []);

  const persistExpandedFolderIds = useCallback((nextExpandedFolderIds: ReadonlySet<string>) => {
    const normalized = new Set(nextExpandedFolderIds);
    if (hasSameStringSet(expandedFolderIdsRef.current, normalized) && hasSameStringSet(visibleExpandedFolderIdsRef.current, normalized)) {
      return;
    }

    expandedFolderIdsRef.current = normalized;
    visibleExpandedFolderIdsRef.current = normalized;
    writeStoredExpandedFolderIds(normalized);
  }, []);

  const applyRenameEffects = useCallback(
    (oldId: string, newId: string) => {
      persistOpenFileIds(renameOpenFileIds(openFileIdsRef.current, oldId, newId));

      if (oldId.endsWith('/') && newId.endsWith('/')) {
        persistExpandedFolderIds(renameExpandedFolderIds(expandedFolderIdsRef.current, oldId, newId));
      }

      const nextActiveFileId = resolveRenamedFileId(activeFileIdRef.current, oldId, newId);
      if (nextActiveFileId && nextActiveFileId !== activeFileIdRef.current) {
        onFileSelect(nextActiveFileId);
      }
    },
    [onFileSelect, persistExpandedFolderIds, persistOpenFileIds],
  );

  const applyDeleteEffects = useCallback(
    (id: string) => {
      persistOpenFileIds(removeOpenFileIdsWithin(openFileIdsRef.current, id));

      if (id.endsWith('/')) {
        persistExpandedFolderIds(collapseExpandedFolderIds(expandedFolderIdsRef.current, id));
      }

      if (isPathAffectedByRemoval(activeFileIdRef.current, id)) {
        onFileSelect('');
      }
    },
    [onFileSelect, persistExpandedFolderIds, persistOpenFileIds],
  );

  const loadSnapshot = useCallback(
    async (options?: { keepLoadingState?: boolean }) => {
      if (options?.keepLoadingState !== false) {
        setLoading(true);
      }

      try {
        const result = await knowledgeApi.listFiles();
        setEntries(result.files);
        resetTree(
          result.files.map((entry) => entry.id),
          {
            initialExpandedPaths: [...expandedFolderIdsRef.current],
          },
        );
      } catch (error) {
        console.error('failed to load knowledge base snapshot', error);
        window.dispatchEvent(
          new CustomEvent('neon-pilot-notification', {
            detail: {
              type: 'error',
              message: 'Failed to load knowledge base',
              details: error instanceof Error ? error.message : String(error),
              source: 'system-knowledge',
            },
          }),
        );
        setEntries([]);
        resetTree([]);
      } finally {
        setLoading(false);
      }
    },
    [resetTree],
  );

  const handleRename = useCallback(
    async ({ sourcePath, destinationPath }: FileTreeRenameEvent) => {
      try {
        const newName = destinationPath.split('/').filter(Boolean).pop() ?? '';
        const updated = await knowledgeApi.rename(sourcePath, newName);
        emitKBEvent('kb:file-renamed', { oldId: sourcePath, newId: updated.id });
      } catch (error) {
        console.error('rename failed', error);
        window.dispatchEvent(
          new CustomEvent('neon-pilot-notification', {
            detail: {
              type: 'error',
              message: 'Failed to rename file',
              details: error instanceof Error ? error.message : String(error),
              source: 'system-knowledge',
            },
          }),
        );
        await loadSnapshot({ keepLoadingState: false });
      }
    },
    [loadSnapshot],
  );

  const handleMovePaths = useCallback(
    async (paths: readonly string[], targetDirInput: string, options?: { emitEntriesChangedOnly?: boolean }) => {
      const targetDir = normalizeKnowledgeDir(targetDirInput);
      const movedPairs: Array<{ oldId: string; newId: string }> = [];

      try {
        for (const path of getTopLevelDraggedPaths(paths)) {
          const updated = await knowledgeApi.move(path, targetDir);
          movedPairs.push({ oldId: path, newId: updated.id });
        }
      } catch (error) {
        console.error('move failed', error);
        window.dispatchEvent(
          new CustomEvent('neon-pilot-notification', {
            detail: {
              type: 'error',
              message: 'Failed to move file',
              details: error instanceof Error ? error.message : String(error),
              source: 'system-knowledge',
            },
          }),
        );
        await loadSnapshot({ keepLoadingState: false });
        return;
      }

      if (movedPairs.length === 0) {
        return;
      }

      if (options?.emitEntriesChangedOnly || movedPairs.length > 1) {
        for (const pair of movedPairs) {
          applyRenameEffects(pair.oldId, pair.newId);
        }
        emitKBEvent('kb:entries-changed');
        return;
      }

      const pair = movedPairs[0];
      if (pair) {
        emitKBEvent('kb:file-renamed', { oldId: pair.oldId, newId: pair.newId });
      }
    },
    [applyRenameEffects, loadSnapshot],
  );

  const handleImportUrl = useCallback(
    async (input: { url: string; title: string; directoryId: string }) => {
      const imported = await knowledgeApi.importUrl({
        url: input.url,
        ...(input.title ? { title: input.title } : {}),
        ...(input.directoryId ? { directoryId: input.directoryId } : {}),
        sourceApp: 'Neon Pilot Knowledge UI',
      });
      emitKBEvent('kb:entries-changed');
      onFileSelect(imported.note.id);
    },
    [onFileSelect],
  );

  const handleKnowledgeBaseSync = useCallback(async () => {
    if (!knowledgeBaseState?.configured || syncingKnowledgeBase) {
      return;
    }

    setSyncingKnowledgeBase(true);
    try {
      await (onSyncKnowledgeBase ? onSyncKnowledgeBase() : knowledgeApi.sync());
      await Promise.all([refetchKnowledgeBase({ resetLoading: false }), loadSnapshot({ keepLoadingState: false })]);
    } catch (error) {
      console.error('knowledge base sync failed', error);
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', {
          detail: {
            type: 'error',
            message: 'Knowledge base sync failed',
            details: error instanceof Error ? error.message : String(error),
            source: 'system-knowledge',
          },
        }),
      );
      await refetchKnowledgeBase({ resetLoading: false });
    } finally {
      setSyncingKnowledgeBase(false);
    }
  }, [knowledgeBaseState?.configured, loadSnapshot, onSyncKnowledgeBase, refetchKnowledgeBase, syncingKnowledgeBase]);

  const openCreateEntryModal = useCallback((kind: CreateEntryState['kind'], directoryIdInput: string) => {
    const directoryId = normalizeKnowledgeDir(directoryIdInput);
    setCreateEntryState({
      kind,
      directoryId,
      value: kind === 'file' ? 'untitled.md' : 'New Folder',
    });
  }, []);

  const handleCreateEntry = useCallback(
    async (value: string) => {
      if (!createEntryState) {
        return;
      }

      const parentDir = normalizeKnowledgeDir(createEntryState.directoryId);
      const childName = value.replace(/^\/+|\/+$/gu, '');
      const childPath = parentDir ? `${parentDir}${childName}` : childName;

      if (createEntryState.kind === 'file') {
        const fileId = childPath.endsWith('.md') ? childPath : `${childPath}.md`;
        await knowledgeApi.writeFile(fileId, '');
        emitKBEvent('kb:file-created', { id: fileId });
        onFileSelect(fileId);
        return;
      }

      const folderId = childPath.endsWith('/') ? childPath : `${childPath}/`;
      const created = await knowledgeApi.createFolder(folderId);
      emitKBEvent('kb:file-created', { id: created.id });
    },
    [createEntryState, onFileSelect],
  );

  const handleDeletePaths = useCallback(
    async (paths: readonly string[]) => {
      if (paths.length === 0) return;

      // Deduplicate: if a folder is selected, skip its children
      const deduped = getTopLevelDraggedPaths(paths).map((id) => {
        // Normalize: ensure directories always have a trailing slash
        const entry = entryMapRef.current.get(id.endsWith('/') ? id : `${id}/`);
        if (entry?.kind === 'folder') return `${id.replace(/\/+$/, '')}/`;
        return id;
      });

      const message =
        deduped.length === 1 ? `Delete "${deduped[0]?.split('/').filter(Boolean).pop() ?? ''}"?` : `Delete ${deduped.length} items?`;

      const confirmed = confirm
        ? await confirm({ title: deduped.length === 1 ? 'Delete knowledge file' : 'Delete knowledge items', message })
        : window.confirm(message);
      if (!confirmed) {
        return;
      }

      for (const id of deduped) {
        try {
          await knowledgeApi.deleteFile(id);
          applyDeleteEffects(id);
          setEntries((currentEntries) => currentEntries.filter((currentEntry) => !isPathAffectedByRemoval(currentEntry.id, id)));
          try {
            model.remove(id, id.endsWith('/') ? { recursive: true } : undefined);
          } catch {
            // The follow-up snapshot is authoritative; this is only an immediate UI update.
          }
        } catch (error) {
          console.error('delete failed', error);
          window.dispatchEvent(
            new CustomEvent('neon-pilot-notification', {
              detail: {
                type: 'error',
                message: 'Failed to delete file',
                details: error instanceof Error ? error.message : String(error),
                source: 'system-knowledge',
              },
            }),
          );
        }
      }

      emitKBEvent('kb:entries-changed');
    },
    [applyDeleteEffects, confirm, model],
  );

  const handleOpenInFinder = useCallback(
    async (entry: KnowledgeEntry) => {
      const desktopBridge = getDesktopBridge();
      const targetPath = resolveFinderTargetPath(knowledgeBaseState?.effectiveRoot, entry);
      if (!desktopBridge?.openPath || !targetPath) {
        return;
      }

      try {
        const result = await desktopBridge.openPath(targetPath);
        if (!result.opened) {
          console.error('open in Finder failed', result.error ?? 'Unknown error');
          window.dispatchEvent(
            new CustomEvent('neon-pilot-notification', {
              detail: {
                type: 'warning',
                message: 'Failed to open in Finder',
                details: result.error ?? 'Unknown error',
                source: 'system-knowledge',
              },
            }),
          );
        }
      } catch (error) {
        console.error('open in Finder failed', error);
        window.dispatchEvent(
          new CustomEvent('neon-pilot-notification', {
            detail: {
              type: 'warning',
              message: 'Failed to open in Finder',
              details: error instanceof Error ? error.message : String(error),
              source: 'system-knowledge',
            },
          }),
        );
      }
    },
    [knowledgeBaseState?.effectiveRoot],
  );

  const runKnowledgeContextMenuAction = useCallback(
    (action: DesktopKnowledgeEntryContextMenuAction | null, entry: KnowledgeEntry) => {
      if (!action) {
        return;
      }

      switch (action) {
        case 'new-file':
          openCreateEntryModal('file', getCreateTargetDirectoryId(entry));
          break;
        case 'new-folder':
          openCreateEntryModal('folder', getCreateTargetDirectoryId(entry));
          break;
        case 'open-in-finder':
          void handleOpenInFinder(entry);
          break;
        case 'rename':
          window.setTimeout(() => {
            model.startRenaming(entry.id);
          }, 0);
          break;
        case 'move':
          {
            const selectedPaths = [...model.getSelectedPaths()];
            if (selectedPaths.length > 1 && selectedPaths.includes(entry.id)) {
              const entries = getTopLevelDraggedPaths(selectedPaths).filter((p) => entryMapRef.current.has(p));
              setMovePaths(entries);
            } else {
              setMovePaths([entry.id]);
            }
          }
          break;
        case 'delete':
          {
            const selectedPaths = [...model.getSelectedPaths()];
            if (selectedPaths.length > 1 && selectedPaths.includes(entry.id)) {
              void handleDeletePaths(selectedPaths);
            } else {
              void handleDeletePaths([entry.id]);
            }
          }
          break;
        default:
          break;
      }
    },
    [handleDeletePaths, handleOpenInFinder, model, openCreateEntryModal],
  );

  const handleOpenFileClose = useCallback(
    (id: string) => {
      const normalizedId = id.trim();
      if (!normalizedId) {
        return;
      }

      if (openFileIdsRef.current.includes(normalizedId)) {
        const nextRecentlyClosed = recordRecentlyClosedFileId(recentlyClosedFileIdsRef.current, normalizedId);
        persistRecentlyClosedFileIds(nextRecentlyClosed);
      }

      const nextOpenFileIds = removeOpenFileId(openFileIdsRef.current, normalizedId);
      const closedIndex = openFileIdsRef.current.indexOf(normalizedId);
      persistOpenFileIds(nextOpenFileIds);

      if (activeFileIdRef.current !== normalizedId) {
        return;
      }

      const fallbackIndex = Math.min(Math.max(closedIndex, 0), Math.max(nextOpenFileIds.length - 1, 0));
      onFileSelect(nextOpenFileIds[fallbackIndex] ?? '');
    },
    [onFileSelect, persistOpenFileIds, persistRecentlyClosedFileIds],
  );

  const handleReopenLastClosedFile = useCallback(() => {
    const remaining = [...recentlyClosedFileIdsRef.current];
    while (remaining.length > 0) {
      const candidate = remaining.shift()?.trim() ?? '';
      if (!candidate || candidate.endsWith('/')) {
        continue;
      }

      if (openFileIdsRef.current.includes(candidate)) {
        continue;
      }

      const entry = entryMapRef.current.get(candidate);
      if (entry && entry.kind !== 'file') {
        continue;
      }

      persistRecentlyClosedFileIds(remaining);
      persistOpenFileIds([candidate]);
      onFileSelect(candidate);
      return;
    }

    persistRecentlyClosedFileIds(remaining);
  }, [onFileSelect, persistOpenFileIds, persistRecentlyClosedFileIds]);

  useEffect(() => {
    const off = [
      onKBEvent('kb:close-active-file', () => {
        const id = activeFileIdRef.current;
        if (id) {
          handleOpenFileClose(id);
        }
      }),
      onKBEvent('kb:reopen-closed-file', () => {
        handleReopenLastClosedFile();
      }),
    ];

    return () => {
      off.forEach((unsubscribe) => unsubscribe());
    };
  }, [handleOpenFileClose, handleReopenLastClosedFile]);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  useEffect(() => {
    entryMapRef.current = entryMap;
    folderIdsRef.current = folderIds;
  }, [entryMap, folderIds]);

  useEffect(() => {
    if (!activeFileId) {
      return;
    }

    persistOpenFileIds([activeFileId]);
  }, [activeFileId, persistOpenFileIds]);

  // selectionChangeRef and renameRef are wired through useFileTreeModel

  useEffect(() => {
    canDropRef.current = (event) => {
      const targetDir = normalizeKnowledgeDir(event.target.directoryPath ?? '');
      return getTopLevelDraggedPaths(event.draggedPaths).every((path) => {
        const entry = entryMapRef.current.get(path);
        return entry ? canDropKnowledgeEntry(entry, targetDir) : false;
      });
    };
  }, []);

  useEffect(() => {
    dropCompleteRef.current = (event) => {
      void handleMovePaths(event.draggedPaths, event.target.directoryPath ?? '', {
        emitEntriesChangedOnly: event.draggedPaths.length > 1,
      });
    };
  }, [handleMovePaths]);

  useEffect(() => {
    nativeContextMenuOpenRef.current = (item, context) => {
      const lookupPath = item.kind === 'directory' && !item.path.endsWith('/') ? `${item.path}/` : item.path;
      const entry =
        entryMapRef.current.get(lookupPath) ?? createFallbackEntry(item.path, item.kind === 'directory' ? 'folder' : 'file', item.name);
      const desktopBridge = getDesktopBridge();
      const canOpenInFinder = Boolean(desktopBridge?.openPath && resolveFinderTargetPath(knowledgeBaseState?.effectiveRoot, entry));

      context.close({ restoreFocus: false });
      if (!desktopBridge?.showKnowledgeEntryContextMenu) {
        return;
      }

      void desktopBridge
        .showKnowledgeEntryContextMenu({
          x: context.anchorRect.left,
          y: context.anchorRect.bottom,
          canCreateFile: true,
          canCreateFolder: true,
          canOpenInFinder,
          canRename: true,
          canMove: true,
          canDelete: true,
        })
        .then(({ action }) => runKnowledgeContextMenuAction(action, entry));
    };
  }, [knowledgeBaseState?.effectiveRoot, runKnowledgeContextMenuAction]);

  useEffect(() => {
    const unsubscribe = model.subscribe(() => {
      if (reconcilingExpansionRef.current) {
        return;
      }

      const rawExpandedFolderIds = collectRawExpandedFolderIds(model, folderIdsRef.current);
      const collapsedFolderIds = [...visibleExpandedFolderIdsRef.current].filter((folderId) => !rawExpandedFolderIds.has(folderId));
      const descendantFolderIdsToCollapse = [...rawExpandedFolderIds].filter((folderId) =>
        collapsedFolderIds.some((collapsedFolderId) => folderId !== collapsedFolderId && folderId.startsWith(collapsedFolderId)),
      );

      if (descendantFolderIdsToCollapse.length > 0) {
        reconcilingExpansionRef.current = true;
        try {
          for (const folderId of descendantFolderIdsToCollapse) {
            const item = model.getItem(folderId);
            if (item?.isDirectory()) {
              item.collapse();
            }
          }
        } finally {
          reconcilingExpansionRef.current = false;
        }
      }

      persistExpandedFolderIds(collectExpandedFolderIds(model, folderIdsRef.current));
    });
    return unsubscribe;
  }, [model, persistExpandedFolderIds]);

  useEffect(() => {
    if (!knowledgeBaseState) {
      if (!knowledgeBaseLoading && knowledgeBaseError) {
        setEntries([]);
        resetTree([]);
        setLoading(false);
      }
      return;
    }

    if (!knowledgeBaseSnapshotKey) {
      setEntries([]);
      resetTree([]);
      setLoading(false);
      return;
    }

    void loadSnapshot();
  }, [knowledgeBaseError, knowledgeBaseLoading, knowledgeBaseSnapshotKey, loadSnapshot, resetTree]);

  useEffect(() => {
    function refreshTree() {
      void loadSnapshot({ keepLoadingState: false });
    }

    window.addEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshTree);
    return () => window.removeEventListener(WORKBENCH_REFRESH_ACTIVE_FILE_EVENT, refreshTree);
  }, [loadSnapshot]);

  // Delete/Backspace keyboard shortcut — scoped to the tree wrapper so it
  // doesn't process keystrokes from other parts of the app.
  useEffect(() => {
    const wrapper = treeHostWrapperRef.current;
    if (!wrapper) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)
      ) {
        return;
      }

      const selectedPaths = model.getSelectedPaths();
      if (selectedPaths.length === 0) return;

      event.preventDefault();
      void handleDeletePaths(selectedPaths);
    };

    wrapper.addEventListener('keydown', handleKeyDown);
    return () => wrapper.removeEventListener('keydown', handleKeyDown);
  }, [model, handleDeletePaths]);

  useEffect(() => {
    if (!activeFileId) {
      for (const selectedPath of model.getSelectedPaths()) {
        model.getItem(selectedPath)?.deselect();
      }
      return;
    }

    for (const folderId of getExpandableFolderIds(activeFileId)) {
      const item = model.getItem(folderId);
      if (item?.isDirectory()) {
        const directory = item;
        directory.expand();
      }
    }

    for (const selectedPath of model.getSelectedPaths()) {
      if (selectedPath !== activeFileId) {
        model.getItem(selectedPath)?.deselect();
      }
    }

    const activeItem = model.getItem(activeFileId);
    if (activeItem && !activeItem.isSelected()) {
      activeItem.select();
    }

    persistExpandedFolderIds(collectExpandedFolderIds(model, folderIdsRef.current));
  }, [activeFileId, entries, model, persistExpandedFolderIds]);

  useInvalidateOnTopics(['knowledgeBase'], refetchKnowledgeBase);

  // model cleanup handled by useFileTreeModel

  useEffect(() => {
    if (!knowledgeBaseDisabled) {
      return;
    }

    setMovePaths(null);
    setImportDirectoryId(null);
    setCreateEntryState(null);
  }, [knowledgeBaseDisabled]);

  useEffect(() => {
    const refreshKnowledgeBaseStatus = () => {
      void refetchKnowledgeBase({ resetLoading: false });
    };

    const off = [
      onKBEvent('kb:entries-changed', () => {
        void loadSnapshot({ keepLoadingState: false });
        refreshKnowledgeBaseStatus();
      }),
      onKBEvent('kb:content-saved', () => {
        refreshKnowledgeBaseStatus();
      }),
      onKBEvent<{ oldId: string; newId: string }>('kb:file-renamed', ({ oldId, newId }) => {
        applyRenameEffects(oldId, newId);
        void loadSnapshot({ keepLoadingState: false });
        refreshKnowledgeBaseStatus();
      }),
      onKBEvent<{ id: string }>('kb:file-created', () => {
        void loadSnapshot({ keepLoadingState: false });
        refreshKnowledgeBaseStatus();
      }),
      onKBEvent<{ id: string }>('kb:file-deleted', ({ id }) => {
        applyDeleteEffects(id);
        void loadSnapshot({ keepLoadingState: false });
        refreshKnowledgeBaseStatus();
      }),
    ];

    return () => {
      off.forEach((unsubscribe) => unsubscribe());
    };
  }, [applyDeleteEffects, applyRenameEffects, loadSnapshot, refetchKnowledgeBase]);

  // Watch for external file system changes to the knowledge root.
  useKnowledgeWatcher({
    apiPathPrefix: '/api/extensions/system-knowledge/knowledge',
    onEvent: useCallback(
      (event) => {
        const changedPaths = event.paths;
        const currentContent = activeFileIdRef.current;
        if (currentContent) {
          // Only emit the event if the current file was actually among the changed paths
          const isAffected =
            changedPaths.length === 0 || changedPaths.some((p) => currentContent.endsWith(p) || p.endsWith(currentContent));
          if (isAffected) {
            emitKBEvent('kb:file-changed-externally', { path: currentContent });
          }
        }
        void loadSnapshot({ keepLoadingState: false });
        void refetchKnowledgeBase({ resetLoading: false });
      },
      [loadSnapshot, refetchKnowledgeBase],
    ),
  });

  useEffect(() => {
    const wrapper = treeHostWrapperRef.current;
    const host = wrapper?.querySelector('file-tree-container');
    const shadowRoot = host instanceof HTMLElement ? host.shadowRoot : null;
    if (!shadowRoot || typeof window === 'undefined') {
      return;
    }

    let frameId: number | null = null;

    const syncVisibleLabels = () => {
      frameId = null;
      const rows = shadowRoot.querySelectorAll<HTMLElement>('[role="treeitem"]');
      for (const row of rows) {
        const content = row.querySelector<HTMLElement>('[data-item-section="content"]');
        if (!content) {
          continue;
        }

        const resetContentPresentation = () => {
          content.removeAttribute('data-pa-full-label');
          content.style.display = '';
          content.style.minWidth = '';
          content.style.overflow = '';
          content.style.whiteSpace = '';
          content.style.textOverflow = '';
          content.querySelector('[data-pa-full-label-text="true"]')?.remove();
        };

        if (content.querySelector('[data-item-rename-input]')) {
          resetContentPresentation();
          continue;
        }

        const middleGroup = content.querySelector<HTMLElement>('[data-truncate-group-container="middle"]');
        if (!middleGroup) {
          resetContentPresentation();
          continue;
        }
        middleGroup.style.display = '';

        const label = row.getAttribute('aria-label')?.trim();
        if (label) {
          content.setAttribute('data-pa-full-label', 'true');
          content.style.display = 'block';
          content.style.minWidth = '0';
          content.style.overflow = 'hidden';
          content.style.whiteSpace = 'nowrap';
          content.style.textOverflow = 'ellipsis';
          middleGroup.style.display = 'none';
          let labelText = content.querySelector<HTMLElement>('[data-pa-full-label-text="true"]');
          if (!labelText) {
            labelText = document.createElement('span');
            labelText.setAttribute('data-pa-full-label-text', 'true');
            labelText.style.display = 'block';
            labelText.style.overflow = 'hidden';
            labelText.style.whiteSpace = 'nowrap';
            labelText.style.textOverflow = 'ellipsis';
            content.append(labelText);
          }
          if (labelText.textContent !== label) {
            labelText.textContent = label;
          }
        } else {
          resetContentPresentation();
        }
      }
    };

    const scheduleVisibleLabelSync = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        syncVisibleLabels();
      });
    };

    scheduleVisibleLabelSync();
    const observer = new MutationObserver(() => {
      scheduleVisibleLabelSync();
    });
    observer.observe(shadowRoot, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [entries, loading]);

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      {knowledgeBaseDisabled ? (
        <>
          <div ref={headerRef} className="shrink-0 px-3 pb-1 pt-3">
            <div className="flex items-center gap-1">
              <SectionLabel className="flex-1">Knowledge</SectionLabel>
              <span
                role="status"
                aria-label={knowledgeBaseSyncPresentation.text}
                title={knowledgeBaseSyncPresentation.text}
                className={cx(
                  'h-2 w-2 shrink-0 rounded-full',
                  knowledgeBaseSyncPresentation.dotClass,
                  knowledgeBaseSyncPresentation.pulse && 'animate-pulse',
                )}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 px-3 py-2">
            <div className="space-y-1.5 text-[12px] leading-5 text-dim">
              <p className="truncate font-medium text-secondary">Connect a git repo to use Knowledge.</p>
              <p className="max-w-[13rem]">
                Neon Pilot needs a git repo to store and sync durable docs. Add a repo URL in{' '}
                <Link to="/settings#settings-knowledge-base" className="text-accent hover:underline">
                  Settings
                </Link>{' '}
                — any git remote works, empty or existing.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div ref={headerRef} className="shrink-0 px-3 pb-1 pt-3">
            <div className="flex items-center gap-1">
              <SectionLabel className="flex-1">Knowledge</SectionLabel>
              <span
                role="status"
                aria-label={knowledgeBaseSyncPresentation.text}
                title={knowledgeBaseSyncPresentation.text}
                className={cx(
                  'h-2 w-2 shrink-0 rounded-full',
                  knowledgeBaseSyncPresentation.dotClass,
                  knowledgeBaseSyncPresentation.pulse && 'animate-pulse',
                )}
              />
              <IconButton
                compact
                title={syncingKnowledgeBase ? 'Syncing knowledge base...' : 'Sync knowledge base'}
                aria-label="Sync knowledge base"
                disabled={syncingKnowledgeBase}
                onClick={() => {
                  void handleKnowledgeBaseSync();
                }}
              >
                <Ico d={ICON.refresh} size={12} />
              </IconButton>
              <IconButton
                compact
                title="Import URL"
                aria-label="Import URL"
                onClick={() => setImportDirectoryId(normalizeDirectoryId(activeFileId ? idToDir(activeFileId) : ''))}
              >
                <Ico d={ICON.import} size={12} />
              </IconButton>
              <IconButton compact title="New file" aria-label="New file" onClick={() => openCreateEntryModal('file', '')}>
                <Ico d={ICON.plus} size={12} />
              </IconButton>
              <IconButton compact title="New folder" aria-label="New folder" onClick={() => openCreateEntryModal('folder', '')}>
                <Ico d={ICON.folderPlus} size={12} />
              </IconButton>
            </div>
          </div>

          <div ref={treeHostWrapperRef} className="min-h-0 flex-1 overflow-hidden px-1 pb-3">
            {knowledgeBaseError && !knowledgeBaseState && !loading ? (
              <p className="px-3 py-2 text-[12px] leading-5 text-danger">Knowledge unavailable · {knowledgeBaseError}</p>
            ) : loading ? (
              <PanelMessage className="animate-pulse px-3 py-2">Loading...</PanelMessage>
            ) : (
              <TreesFileTree
                className="h-full"
                model={model}
                {...(!useNativeKnowledgeContextMenu
                  ? {
                      renderContextMenu: (item: FileTreeContextMenuItem, context: FileTreeContextMenuOpenContext) => {
                        const entry = (() => {
                          const lookupPath = item.kind === 'directory' && !item.path.endsWith('/') ? `${item.path}/` : item.path;
                          return (
                            entryMap.get(lookupPath) ??
                            createFallbackEntry(item.path, item.kind === 'directory' ? 'folder' : 'file', item.name)
                          );
                        })();
                        const canOpenInFinder = Boolean(
                          getDesktopBridge()?.openPath && resolveFinderTargetPath(knowledgeBaseState?.effectiveRoot, entry),
                        );

                        return (
                          <TreeContextMenu
                            onCreateFile={() => {
                              context.close();
                              openCreateEntryModal('file', getCreateTargetDirectoryId(entry));
                            }}
                            onCreateFolder={() => {
                              context.close();
                              openCreateEntryModal('folder', getCreateTargetDirectoryId(entry));
                            }}
                            onOpenInFinder={
                              canOpenInFinder
                                ? () => {
                                    context.close();
                                    void handleOpenInFinder(entry);
                                  }
                                : undefined
                            }
                            onRename={() => {
                              context.close({ restoreFocus: false });
                              window.setTimeout(() => {
                                model.startRenaming(entry.id);
                              }, 0);
                            }}
                            onMove={() => {
                              context.close();
                              const selectedPaths = [...model.getSelectedPaths()];
                              if (selectedPaths.length > 1 && selectedPaths.includes(entry.id)) {
                                const entries = getTopLevelDraggedPaths(selectedPaths).filter((p) => entryMapRef.current.has(p));
                                setMovePaths(entries);
                              } else {
                                setMovePaths([entry.id]);
                              }
                            }}
                            onDelete={() => {
                              context.close();
                              const selectedPaths = [...model.getSelectedPaths()];
                              if (selectedPaths.length > 1 && selectedPaths.includes(entry.id)) {
                                void handleDeletePaths(selectedPaths);
                              } else {
                                void handleDeletePaths([entry.id]);
                              }
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
        </>
      )}

      {movePaths ? (
        <MoveModal
          paths={movePaths}
          entryMap={entryMap}
          folderOptions={folderOptions}
          onConfirm={(targetDir) => {
            void handleMovePaths(movePaths, targetDir);
          }}
          onClose={() => setMovePaths(null)}
        />
      ) : null}

      {importDirectoryId !== null ? (
        <ImportUrlModal initialDirectoryId={importDirectoryId} onImport={handleImportUrl} onClose={() => setImportDirectoryId(null)} />
      ) : null}

      {createEntryState ? (
        <CreateEntryModal state={createEntryState} onConfirm={handleCreateEntry} onClose={() => setCreateEntryState(null)} />
      ) : null}
    </div>
  );
}
