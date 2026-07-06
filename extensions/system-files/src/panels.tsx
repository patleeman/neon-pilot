import { CenteredMessage, QuietLoadingState } from '@neon-pilot/extensions/ui';
import { type ExtensionSurfaceProps, WorkspaceExplorer, WorkspaceFileDocument } from '@neon-pilot/extensions/workbench-files';
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
  const handleActiveFilePathChange = useCallback(
    (path: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (path) {
          next.set(WORKSPACE_FILE_PARAM, path);
        } else {
          next.delete(WORKSPACE_FILE_PARAM);
        }
        return next;
      });
    },
    [setSearchParams],
  );
  if (!context.cwd) {
    return (
      <CenteredMessage
        eyebrow="File Explorer"
        title="Set a working directory"
        body="File Explorer needs a working directory. Open a folder or project to browse and edit files."
      />
    );
  }

  return (
    <Suspense fallback={<QuietLoadingState label="Loading workspace" className="h-full" />}>
      <WorkspaceExplorer
        cwd={context.cwd}
        railOnly
        activeFilePath={activeFilePath}
        openFilesScope={context.conversationId}
        onOpenFile={handleOpenFile}
        onActiveFilePathChange={handleActiveFilePathChange}
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
      <CenteredMessage
        eyebrow="File Explorer"
        title="Set a working directory"
        body="File previews need a working directory. Open a folder or project, then pick a file from the tree."
      />
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
        <Suspense fallback={<QuietLoadingState label="Opening file" className="h-full" />}>
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
