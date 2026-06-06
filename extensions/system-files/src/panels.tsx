import { type ExtensionSurfaceProps, WorkspaceExplorer, WorkspaceFileDocument } from '@neon-pilot/extensions/workbench-files';
import { CenteredLoadingState, CenteredMessage } from '@neon-pilot/extensions/ui';
import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const WORKSPACE_DRAFT_PROMPT_EVENT = 'pa:workspace-draft-prompt';
const WORKSPACE_REPLY_SELECTION_EVENT = 'pa:workspace-reply-selection';
const WORKSPACE_FILE_PARAM = 'workspaceFile';

function getWorkspaceFilePath(search: string): string | null {
  return new URLSearchParams(search).get(WORKSPACE_FILE_PARAM);
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
    return (
      <CenteredMessage eyebrow="Workbench" title="Open a local conversation" body="Open a local conversation to browse its workspace." />
    );
  }

  return (
    <Suspense fallback={<CenteredLoadingState label="Loading workspace..." />}>
      <WorkspaceExplorer
        cwd={context.cwd}
        railOnly
        activeFilePath={activeFilePath}
        openFilesScope={context.conversationId}
        onOpenFile={handleOpenFile}
        onDraftPrompt={(prompt) => {
          window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_PROMPT_EVENT, { detail: { prompt } }));
        }}
      />
    </Suspense>
  );
}

export function WorkspaceFileDetailPanel({ context }: ExtensionSurfaceProps) {
  const filePath = getWorkspaceFilePath(context.search);

  if (!context.cwd) {
    return (
      <CenteredMessage eyebrow="Workbench" title="Open a local conversation" body="Open a local conversation to browse its workspace." />
    );
  }

  if (!filePath) {
    return (
      <CenteredMessage eyebrow="Workbench" title="Open a file" body="Pick a file from the file tree to keep it beside the transcript." />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<CenteredLoadingState label="Opening file..." />}>
          <WorkspaceFileDocument
            cwd={context.cwd}
            path={filePath}
            hideHeader
            onReplyWithSelection={(selection) => {
              window.dispatchEvent(new CustomEvent(WORKSPACE_REPLY_SELECTION_EVENT, { detail: selection }));
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
