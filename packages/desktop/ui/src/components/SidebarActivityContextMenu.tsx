import type { ActivityTreeItem } from '../activity/activityTree';
import { DRAFT_CONVERSATION_ID } from '../conversation/draftConversation';
import type { SessionMeta } from '../shared/types';
import type { SidebarConversationGroup, SidebarConversationItem } from './sidebarThreadModel';

type ActivityContextMenuContribution = {
  extensionId: string;
  id: string;
  title: string;
};

export type SidebarActivityContextMenuProps = {
  item: ActivityTreeItem;
  conversationGroupByKey: ReadonlyMap<string, SidebarConversationGroup>;
  conversationItemBySessionId: ReadonlyMap<string, SidebarConversationItem>;
  extensionContextMenus: readonly ActivityContextMenuContribution[];
  onArchiveConversation: (conversationId: string) => void;
  onArchiveConversationGroup: (label: string, sessionIds: string[]) => void | Promise<void>;
  onClose: () => void;
  onCloseConversation: (conversationId: string) => void;
  onClosePinnedConversation: (conversationId: string) => void;
  onCopyConversationDeeplink: (conversationId: string) => void | Promise<void>;
  onCopyConversationId: (conversationId: string) => void | Promise<void>;
  onCopyConversationWorkingDirectory: (cwd: string | null | undefined) => void | Promise<void>;
  onDuplicateConversation: (session: SessionMeta) => void | Promise<void>;
  onExtensionContextMenu: (
    menu: ActivityContextMenuContribution,
    input: { conversationId: string; sessionTitle: string; cwd?: string },
  ) => void | Promise<void>;
  onOpenConversationGroupInFinder: (cwd: string, label: string) => void | Promise<void>;
  onPinConversation: (conversationId: string) => void;
  onRemoveConversationGroup: (groupKey: string, label: string, cwd: string | null, sessionIds: string[], includesDraft: boolean) => void;
  onRenameConversationGroup: (groupKey: string, defaultLabel: string, currentLabel: string) => void;
  onRoute: (route: string) => void;
  onUnpinConversation: (conversationId: string) => void;
};

export function SidebarActivityContextMenu({
  item,
  conversationGroupByKey,
  conversationItemBySessionId,
  extensionContextMenus,
  onArchiveConversation,
  onArchiveConversationGroup,
  onClose,
  onCloseConversation,
  onClosePinnedConversation,
  onCopyConversationDeeplink,
  onCopyConversationId,
  onCopyConversationWorkingDirectory,
  onDuplicateConversation,
  onExtensionContextMenu,
  onOpenConversationGroupInFinder,
  onPinConversation,
  onRemoveConversationGroup,
  onRenameConversationGroup,
  onRoute,
  onUnpinConversation,
}: SidebarActivityContextMenuProps) {
  const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
  const conversationItem = conversationId ? conversationItemBySessionId.get(conversationId) : null;
  const parentConversationId = conversationItem?.session.parentSessionId;
  const parentConversation = parentConversationId ? conversationItemBySessionId.get(parentConversationId) : null;
  const groupKey = typeof item.metadata?.groupKey === 'string' ? item.metadata.groupKey : null;
  const conversationGroup = groupKey ? conversationGroupByKey.get(groupKey) : null;
  const isConversation = item.kind === 'conversation' && conversationId && conversationItem;
  const isGroup = item.kind === 'group' && conversationGroup;
  const groupSessionIds = conversationGroup?.items
    .map(({ session }) => session.id)
    .filter((sessionId) => sessionId !== DRAFT_CONVERSATION_ID);
  const groupIncludesDraft = Boolean(conversationGroup?.items.some(({ session }) => session.id === DRAFT_CONVERSATION_ID));

  return (
    <div className="ui-menu-shell ui-context-menu-shell static bottom-auto left-auto right-auto top-auto mb-0 min-w-[224px]" role="menu">
      {item.route ? (
        <ContextMenuItem
          onSelect={() => {
            onRoute(item.route!);
          }}
          onClose={onClose}
        >
          Open
        </ContextMenuItem>
      ) : null}
      {isGroup ? (
        <>
          {conversationGroup.cwd ? (
            <ContextMenuItem
              onSelect={() => {
                void onOpenConversationGroupInFinder(conversationGroup.cwd!, conversationGroup.label);
              }}
              onClose={onClose}
            >
              Open in Finder
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            onSelect={() => {
              onRenameConversationGroup(conversationGroup.key, conversationGroup.defaultLabel, conversationGroup.label);
            }}
            onClose={onClose}
          >
            Edit Name
          </ContextMenuItem>
          {groupSessionIds && groupSessionIds.length > 0 ? (
            <ContextMenuItem
              onSelect={() => {
                void onArchiveConversationGroup(conversationGroup.label, groupSessionIds);
              }}
              onClose={onClose}
            >
              Archive Threads
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            danger
            onSelect={() => {
              onRemoveConversationGroup(
                conversationGroup.key,
                conversationGroup.label,
                conversationGroup.cwd,
                groupSessionIds ?? [],
                groupIncludesDraft,
              );
            }}
            onClose={onClose}
          >
            Remove
          </ContextMenuItem>
        </>
      ) : isConversation ? (
        <>
          {parentConversation ? (
            <ContextMenuItem
              onSelect={() => {
                onRoute(`/conversations/${encodeURIComponent(parentConversation.session.id)}`);
              }}
              onClose={onClose}
            >
              Go to Parent Thread
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            onSelect={() => {
              if (conversationItem.pinned) {
                onUnpinConversation(conversationId);
              } else {
                onPinConversation(conversationId);
              }
            }}
            onClose={onClose}
          >
            {conversationItem.pinned ? 'Unpin Thread' : 'Pin Thread'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              if (conversationItem.pinned) {
                onClosePinnedConversation(conversationId);
              } else {
                onCloseConversation(conversationId);
              }
            }}
            onClose={onClose}
          >
            Close Thread
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              void onDuplicateConversation(conversationItem.session);
            }}
            onClose={onClose}
          >
            Duplicate Thread
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              onArchiveConversation(conversationId);
            }}
            onClose={onClose}
          >
            Archive Thread
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              void onCopyConversationId(conversationId);
            }}
            onClose={onClose}
          >
            Copy Session ID
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              void onCopyConversationDeeplink(conversationId);
            }}
            onClose={onClose}
          >
            Copy Deeplink
          </ContextMenuItem>
          {conversationItem.session.cwd?.trim() ? (
            <ContextMenuItem
              onSelect={() => {
                void onCopyConversationWorkingDirectory(conversationItem.session.cwd);
              }}
              onClose={onClose}
            >
              Copy Working Directory
            </ContextMenuItem>
          ) : null}
          {extensionContextMenus.map((menu) => (
            <ContextMenuItem
              key={`${menu.extensionId}:${menu.id}`}
              onSelect={() => {
                void onExtensionContextMenu(menu, {
                  conversationId,
                  sessionTitle: conversationItem.session.title,
                  cwd: conversationItem.session.cwd,
                });
              }}
              onClose={onClose}
            >
              {menu.title}
            </ContextMenuItem>
          ))}
        </>
      ) : null}
    </div>
  );
}

function ContextMenuItem({
  children,
  danger = false,
  onClose,
  onSelect,
}: {
  children: string;
  danger?: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={danger ? 'ui-context-menu-item text-danger hover:bg-danger/10 focus-visible:bg-danger/10' : 'ui-context-menu-item'}
      role="menuitem"
      onClick={() => {
        onClose();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}
