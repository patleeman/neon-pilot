import { type ComponentProps, useRef, useState } from 'react';

import type { ConversationContextUsageTokensPresentation } from '../../conversation/conversationComposerPresentation';
import { createNativeExtensionClient } from '../../extensions/nativePaClient';
import { StatusBarItemHost } from '../../extensions/StatusBarItemHost';
import { type ExtensionStatusBarItemRegistration, useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import { IconButton, RowButton, Select, TextButton } from '../ui';
import { BrowsePathButton, ChatBubbleIcon, FolderIcon } from './ConversationComposerChrome';

export type ConversationGitSummaryPresentation =
  | { kind: 'none' }
  | { kind: 'summary'; text: string }
  | { kind: 'diff'; added: string; deleted: string };

export function ConversationComposerMeta({
  draft,
  hasDraftCwd,
  draftCwdValue,
  draftCwdError,
  draftCwdPickBusy,
  availableDraftWorkspacePaths,
  onClearDraftCwdSelection,
  onSelectDraftWorkspace,
  onPickDraftCwd,
  conversationCwdEditorOpen,
  currentCwd,
  currentCwdLabel,
  conversationCwdDraft,
  conversationCwdError,
  conversationCwdBusy,
  conversationCwdPickBusy,
  availableConversationWorkspacePaths,
  onSubmitConversationCwdChange,
  onCancelConversationCwdEdit,
  onPickConversationCwd,
  onBeginConversationCwdEdit,
  branchLabel,
  gitSummaryPresentation,
  sessionTokens,
}: {
  draft: boolean;
  hasDraftCwd: boolean;
  draftCwdValue: string;
  draftCwdError: string | null;
  draftCwdPickBusy: boolean;
  availableDraftWorkspacePaths: string[];
  onClearDraftCwdSelection: () => void;
  onSelectDraftWorkspace: (workspacePath: string) => void;
  onPickDraftCwd: () => void;
  conversationCwdEditorOpen: boolean;
  currentCwd: string | null;
  currentCwdLabel: string;
  conversationCwdDraft: string;
  conversationCwdError: string | null;
  conversationCwdBusy: boolean;
  conversationCwdPickBusy: boolean;
  availableConversationWorkspacePaths: string[];
  onSubmitConversationCwdChange: (cwd?: string | null) => void;
  onCancelConversationCwdEdit: () => void;
  onPickConversationCwd: () => void;
  onBeginConversationCwdEdit: () => void;
  branchLabel: string | null;
  gitSummaryPresentation: ConversationGitSummaryPresentation;
  sessionTokens: ConversationContextUsageTokensPresentation | null;
}) {
  const { statusBarItems } = useExtensionRegistry();
  const leftStatusItems = statusBarItems.filter((item) => item.alignment === 'left');
  const rightStatusItems = statusBarItems.filter((item) => item.alignment === 'right');
  const statusBarContext = {
    cwd: currentCwd,
    branchLabel,
    gitSummary: gitSummaryPresentation,
    contextUsage: sessionTokens,
  };
  const neutralChatCwd = currentCwdLabel === 'Chat';
  return (
    <div className="conversation-composer-meta mt-1.5 flex min-h-4 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 overflow-visible px-3 text-[10.5px] font-mono text-dim/80 tracking-[0.02em]">
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
        {draft ? (
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-1.5 xl:max-w-[26rem] xl:flex-none">
            {hasDraftCwd ? <FolderIcon className="shrink-0 text-dim/70" /> : <ChatBubbleIcon className="shrink-0 text-dim/70" />}
            <label className="sr-only" htmlFor="draft-composer-cwd">
              Workspace folder
            </label>
            <div className="relative min-w-0 flex-1 xl:max-w-[22rem]">
              <Select
                id="draft-composer-cwd"
                value={draftCwdValue}
                onChange={(event) => {
                  const nextWorkspacePath = event.target.value.trim();
                  if (!nextWorkspacePath) {
                    onClearDraftCwdSelection();
                    return;
                  }
                  onSelectDraftWorkspace(nextWorkspacePath);
                }}
                className="h-7 w-full min-w-0 truncate appearance-none border-transparent bg-transparent py-0 pl-1 pr-6 text-xs font-mono text-secondary"
              >
                <option value="">Chat</option>
                {availableDraftWorkspacePaths.map((workspacePath) => (
                  <option key={workspacePath} value={workspacePath}>
                    {workspacePath}
                  </option>
                ))}
              </Select>
              <svg
                aria-hidden="true"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-dim/70"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            <BrowsePathButton
              busy={draftCwdPickBusy}
              onClick={onPickDraftCwd}
              title={draftCwdPickBusy ? 'Choosing folder…' : 'Choose folder'}
              ariaLabel="Choose folder"
            />
          </div>
        ) : conversationCwdEditorOpen ? (
          <div
            className="flex min-w-0 max-w-full flex-1 items-center gap-1.5 xl:max-w-[26rem] xl:flex-none"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelConversationCwdEdit();
              }
            }}
          >
            <label className="sr-only" htmlFor="conversation-composer-cwd">
              Conversation working directory
            </label>
            <div className="relative min-w-0 flex-1 xl:max-w-[22rem]">
              <Select
                id="conversation-composer-cwd"
                autoFocus
                value={conversationCwdDraft}
                onChange={(event) => {
                  const nextWorkspacePath = event.target.value.trim();
                  if (nextWorkspacePath) {
                    onSubmitConversationCwdChange(nextWorkspacePath);
                  }
                }}
                aria-label="Conversation working directory"
                className="h-7 w-full min-w-0 truncate py-0 pl-2 pr-6 text-[11px] font-mono text-primary"
                disabled={conversationCwdBusy || conversationCwdPickBusy || availableConversationWorkspacePaths.length === 0}
              >
                {availableConversationWorkspacePaths.length === 0 ? <option value="">Choose a working directory</option> : null}
                {availableConversationWorkspacePaths.map((workspacePath) => (
                  <option key={workspacePath} value={workspacePath}>
                    {workspacePath}
                  </option>
                ))}
              </Select>
              <svg
                aria-hidden="true"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-dim/70"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            <BrowsePathButton
              busy={conversationCwdBusy || conversationCwdPickBusy}
              onClick={onPickConversationCwd}
              title={conversationCwdPickBusy ? 'Choosing folder…' : 'Choose folder'}
              ariaLabel="Choose folder"
            />
            <IconButton
              size="sm"
              onClick={onCancelConversationCwdEdit}
              title="Cancel working directory edit"
              aria-label="Cancel working directory edit"
              className="border border-transparent hover:bg-surface/45 hover:text-primary focus-visible:ring-1 focus-visible:ring-accent/25 focus-visible:ring-offset-1 focus-visible:ring-offset-base disabled:opacity-50"
              disabled={conversationCwdBusy || conversationCwdPickBusy}
            >
              <CloseIcon />
            </IconButton>
          </div>
        ) : (
          <RowButton
            type="button"
            onClick={onBeginConversationCwdEdit}
            compact
            className="max-w-full flex-1 gap-1.5 px-1.5 py-1 text-secondary xl:w-[26rem] xl:flex-none"
            title={neutralChatCwd ? 'Chat - no workspace' : currentCwd ? `Working directory: ${currentCwd}` : 'Set working directory'}
          >
            {neutralChatCwd ? <ChatBubbleIcon className="shrink-0 text-dim/70" /> : <FolderIcon className="shrink-0 text-dim/70" />}
            <span className="ui-truncate-start min-w-0 flex-1 font-mono text-xs">{currentCwdLabel || 'Set working directory'}</span>
          </RowButton>
        )}

        {(draft ? draftCwdError : conversationCwdError) ? (
          <span className="text-danger/85">{draft ? draftCwdError : conversationCwdError}</span>
        ) : null}
      </div>

      {leftStatusItems.length > 0 && (
        <div className="flex min-w-0 shrink items-center gap-2 overflow-hidden">
          {leftStatusItems.map((item) => (
            <StatusBarItem key={item.id} item={item} statusBarContext={statusBarContext} />
          ))}
        </div>
      )}
      {rightStatusItems.length > 0 &&
        rightStatusItems.map((item) => <StatusBarItem key={item.id} item={item} statusBarContext={statusBarContext} />)}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function StatusBarItem({
  item,
  statusBarContext,
}: {
  item: ExtensionStatusBarItemRegistration;
  statusBarContext: ComponentProps<typeof StatusBarItemHost>['statusBarContext'];
}) {
  const [busy, setBusy] = useState(false);
  const paClient = useRef<ReturnType<typeof createNativeExtensionClient> | null>(null);
  if (!paClient.current) paClient.current = createNativeExtensionClient(item.extensionId);

  if (item.component) {
    return <StatusBarItemHost registration={item} statusBarContext={statusBarContext} />;
  }

  if (!item.action) {
    return <span className="shrink-0 truncate font-mono max-w-[6rem]">{item.label}</span>;
  }

  return (
    <TextButton
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void paClient
          .current!.extension.invoke(item.action, {})
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
      className="max-w-[6rem] shrink-0 truncate font-mono"
      title={item.label}
    >
      {busy ? `${item.label}…` : item.label}
    </TextButton>
  );
}
