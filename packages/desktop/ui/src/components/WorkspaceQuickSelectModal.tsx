import { useEffect, useMemo, useState } from 'react';

import { buildConversationGroupLabels, getConversationGroupLabel } from '../conversation/conversationCwdGroups';
import { setExtensionCommandContext } from '../extensions/commands';
import { IconButton, PanelMessage, ResourceListItem, ResourcePickerDialog, ResourcePickerList } from './ui';
import { WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT } from './workspaceQuickSelectCommands';

const CLOSE_PATH = 'M6 6l12 12M18 6 6 18';
const WORKSPACE_ADD_PATH =
  'M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z M3.75 9.75h16.5 M15.75 11.25v4.5 M13.5 13.5h4.5';

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function WorkspaceQuickSelectModal({
  workspacePaths,
  choosingNewFolder,
  onClose,
  onSelectWorkspace,
  onChooseNewFolder,
}: {
  workspacePaths: string[];
  choosingNewFolder: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspacePath: string) => void;
  onChooseNewFolder: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const optionCount = workspacePaths.length + 1;
  const workspaceLabels = useMemo(() => buildConversationGroupLabels(workspacePaths), [workspacePaths]);

  useEffect(() => {
    setCursor(0);
  }, [workspacePaths]);

  useEffect(() => {
    setExtensionCommandContext('workspaceQuickSelect.open', true);
    return () => setExtensionCommandContext('workspaceQuickSelect.open', null);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((current) => Math.min(current + 1, optionCount - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const workspacePath = workspacePaths[cursor];
        if (workspacePath) {
          onSelectWorkspace(workspacePath);
          return;
        }

        onChooseNewFolder();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursor, onChooseNewFolder, onClose, onSelectWorkspace, optionCount, workspacePaths]);

  useEffect(() => {
    function handleCloseCommand() {
      onClose();
    }

    window.addEventListener(WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT, handleCloseCommand);
    return () => window.removeEventListener(WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT, handleCloseCommand);
  }, [onClose]);

  return (
    <ResourcePickerDialog
      title="Open workspace"
      description="Choose one of the saved workspaces or pick a new folder."
      onClose={onClose}
      backdropStyle={{
        background: 'rgb(0 0 0 / 0.52)',
        backdropFilter: 'blur(8px)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.75rem',
      }}
      style={{
        width: 'min(560px, calc(100vw - 2rem))',
        maxHeight: 'min(560px, calc(100vh - 3.5rem))',
        background: 'rgb(var(--color-surface) / 0.985)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 28px 80px rgb(0 0 0 / 0.35)',
        overscrollBehavior: 'contain',
      }}
      actions={
        <IconButton compact onClick={onClose} className="-mr-1 shrink-0" aria-label="Close workspace picker">
          <Icon d={CLOSE_PATH} size={12} />
        </IconButton>
      }
      footer="↑↓ move · ↵ select · esc close"
    >
      <ResourcePickerList className="px-2 py-2">
        {workspacePaths.length > 0 ? (
          workspacePaths.map((workspacePath, index) => {
            const selected = cursor === index;
            return (
              <ResourceListItem
                key={workspacePath}
                onClick={() => onSelectWorkspace(workspacePath)}
                selected={selected}
                label={getConversationGroupLabel(workspacePath, { labelsByCwd: workspaceLabels })}
                detail={workspacePath}
                className="rounded-lg px-3 py-2.5"
              />
            );
          })
        ) : (
          <PanelMessage className="px-3 py-4">No saved workspaces yet.</PanelMessage>
        )}

        <ResourceListItem
          onClick={onChooseNewFolder}
          selected={cursor === workspacePaths.length}
          disabled={choosingNewFolder}
          label={choosingNewFolder ? 'Choosing folder...' : 'Choose a new folder'}
          detail="Use the system picker to add another workspace."
          leading={<Icon d={WORKSPACE_ADD_PATH} size={13} />}
          className="mt-1 rounded-lg px-3 py-2.5"
        />
      </ResourcePickerList>
    </ResourcePickerDialog>
  );
}
