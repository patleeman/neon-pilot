import { useEffect, useMemo, useState } from 'react';

import { buildConversationGroupLabels, getConversationGroupLabel } from '../conversation/conversationCwdGroups';
import { Dialog, IconButton } from './ui';

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

  return (
    <Dialog
      aria-label="Choose workspace"
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
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-primary">Open workspace</h2>
            <p className="mt-1 text-[12px] leading-5 text-secondary">Choose one of the saved workspaces or pick a new folder.</p>
          </div>
          <IconButton compact onClick={onClose} className="-mr-1 shrink-0" aria-label="Close workspace picker">
            <Icon d={CLOSE_PATH} size={12} />
          </IconButton>
        </div>
      </div>

      <div className="overflow-y-auto px-2 py-2" style={{ overscrollBehavior: 'contain' }}>
        {workspacePaths.length > 0 ? (
          workspacePaths.map((workspacePath, index) => {
            const selected = cursor === index;
            return (
              <button
                key={workspacePath}
                type="button"
                onClick={() => onSelectWorkspace(workspacePath)}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  selected ? 'bg-elevated text-primary' : 'text-secondary hover:bg-elevated/70 hover:text-primary',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {getConversationGroupLabel(workspacePath, { labelsByCwd: workspaceLabels })}
                  </p>
                  <p className="truncate text-[11px] text-dim">{workspacePath}</p>
                </div>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-[12px] text-dim">No saved workspaces yet.</p>
        )}

        <button
          type="button"
          onClick={onChooseNewFolder}
          className={[
            'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
            cursor === workspacePaths.length ? 'bg-elevated text-primary' : 'text-secondary hover:bg-elevated/70 hover:text-primary',
          ].join(' ')}
          disabled={choosingNewFolder}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-elevated text-primary">
            <Icon d={WORKSPACE_ADD_PATH} size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{choosingNewFolder ? 'Choosing folder...' : 'Choose a new folder'}</p>
            <p className="text-[11px] text-dim">Use the system picker to add another workspace.</p>
          </div>
        </button>
      </div>

      <div className="border-t border-border-subtle px-4 py-2 text-[10px] text-dim/80">↑↓ move · ↵ select · esc close</div>
    </Dialog>
  );
}
