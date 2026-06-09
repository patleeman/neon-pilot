import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { cx, RowButton, SectionLabel } from '../ui';
import { BrowsePathButton, ChatBubbleIcon, FolderIcon } from './ConversationComposerChrome';

const DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS = 'mx-auto w-full max-w-[38rem] items-stretch';

export { DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS };

type WorkspacePickerOption = {
  value: string;
  label: string;
  detail: string;
  title: string;
};

function formatWorkspaceOption(workspacePath: string): WorkspacePickerOption {
  if (!workspacePath) {
    return {
      value: '',
      label: 'Chat — no workspace',
      detail: 'No attached workspace',
      title: 'Start as a chat with no attached workspace.',
    };
  }

  const normalizedPath = workspacePath.replace(/\/+$/, '') || workspacePath;
  const segments = normalizedPath.split('/').filter(Boolean);
  const label = segments.at(-1) ?? normalizedPath;
  const detail = segments.length > 1 ? normalizedPath.slice(0, Math.max(1, normalizedPath.length - label.length - 1)) : normalizedPath;
  return { value: workspacePath, label, detail, title: workspacePath };
}

export function ConversationDraftEmptyAction({
  hasDraftCwd,
  draftCwdValue,
  draftCwdError,
  draftCwdPickBusy,
  savedWorkspacePathsLoading,
  availableDraftWorkspacePaths,
  onClearDraftCwdSelection,
  onSelectDraftWorkspace,
  onPickDraftCwd,
  extensionPanels,
}: {
  hasDraftCwd: boolean;
  draftCwdValue: string;
  draftCwdError: string | null;
  draftCwdPickBusy: boolean;
  savedWorkspacePathsLoading: boolean;
  availableDraftWorkspacePaths: string[];
  onClearDraftCwdSelection: () => void;
  onSelectDraftWorkspace: (workspacePath: string) => void;
  onPickDraftCwd: () => void;
  extensionPanels?: ReactNode;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const workspacePickerDisabled = draftCwdPickBusy || (savedWorkspacePathsLoading && availableDraftWorkspacePaths.length === 0);
  const workspaceOptions = useMemo(
    () => [
      {
        value: '',
        label: savedWorkspacePathsLoading && availableDraftWorkspacePaths.length === 0 ? 'Loading workspaces…' : 'Chat — no workspace',
        detail:
          savedWorkspacePathsLoading && availableDraftWorkspacePaths.length === 0
            ? 'Fetching saved workspace paths'
            : 'No attached workspace',
        title:
          savedWorkspacePathsLoading && availableDraftWorkspacePaths.length === 0
            ? 'Fetching saved workspace paths'
            : 'Start as a chat with no attached workspace.',
      },
      ...availableDraftWorkspacePaths.map(formatWorkspaceOption),
    ],
    [availableDraftWorkspacePaths, savedWorkspacePathsLoading],
  );
  const selectedWorkspace = useMemo(
    () => (hasDraftCwd ? formatWorkspaceOption(draftCwdValue) : workspaceOptions[0]),
    [draftCwdValue, hasDraftCwd, workspaceOptions],
  );

  useEffect(() => {
    if (!workspacePickerOpen) return;

    function handleDocumentMouseDown(event: MouseEvent) {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setWorkspacePickerOpen(false);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setWorkspacePickerOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [workspacePickerOpen]);

  function selectWorkspace(nextWorkspacePath: string) {
    setWorkspacePickerOpen(false);
    if (!nextWorkspacePath) {
      onClearDraftCwdSelection();
      return;
    }

    onSelectDraftWorkspace(nextWorkspacePath);
  }

  return (
    <div className="mt-4 w-full space-y-3">
      <div className="flex items-center justify-start gap-2">
        {hasDraftCwd ? <FolderIcon className="text-accent" /> : <ChatBubbleIcon className="text-accent" />}
        <SectionLabel tone="muted">{hasDraftCwd ? 'Workspace' : 'Chat'}</SectionLabel>
      </div>
      <div className="flex w-full flex-nowrap items-start justify-start gap-2">
        <div ref={pickerRef} className="relative min-w-0 max-w-[32rem] flex-1 basis-72">
          <span className="sr-only">Saved workspace</span>
          <RowButton
            compact
            className={cx(
              'min-h-11 w-full justify-start rounded-md border border-border-subtle bg-surface/45 px-2.5 py-2 text-left shadow-sm',
              workspacePickerDisabled && 'cursor-default opacity-60',
            )}
            aria-haspopup="listbox"
            aria-expanded={workspacePickerOpen}
            aria-label="Saved workspace"
            title={selectedWorkspace.title}
            disabled={workspacePickerDisabled}
            onClick={() => setWorkspacePickerOpen((open) => !open)}
          >
            <span className="min-w-0 flex-1">
              <span className={cx('block truncate text-[12px]', hasDraftCwd ? 'font-mono text-primary' : 'text-secondary')}>
                {selectedWorkspace.label}
              </span>
              <span className="block truncate text-[11px] text-dim">{selectedWorkspace.detail}</span>
            </span>
            <svg
              aria-hidden="true"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-2 shrink-0 text-dim/70"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </RowButton>

          {workspacePickerOpen && !workspacePickerDisabled ? (
            <div
              role="listbox"
              aria-label="Saved workspaces"
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-y-auto rounded-lg border border-border-subtle bg-base p-1 shadow-xl"
              style={{ maxHeight: 'min(18rem, 42vh)' }}
            >
              <div className="space-y-0.5">
                {workspaceOptions.map((option) => (
                  <RowButton
                    key={option.value}
                    compact
                    role="option"
                    selected={option.value === draftCwdValue}
                    aria-selected={option.value === draftCwdValue}
                    className="w-full justify-start px-2 py-2 text-left"
                    title={option.title}
                    onClick={() => selectWorkspace(option.value)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-[12px]', option.value ? 'font-mono text-primary' : 'text-secondary')}>
                        {option.label}
                      </span>
                      <span className="ui-truncate-start block text-[11px] text-dim">{option.detail}</span>
                    </span>
                  </RowButton>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <BrowsePathButton
          busy={draftCwdPickBusy}
          onClick={onPickDraftCwd}
          title={draftCwdPickBusy ? 'Choosing workspace…' : 'Choose workspace folder'}
          ariaLabel="Choose workspace folder"
        />
      </div>

      {draftCwdError && <p className="text-[11px] text-danger/80">{draftCwdError}</p>}
      {extensionPanels}
    </div>
  );
}
