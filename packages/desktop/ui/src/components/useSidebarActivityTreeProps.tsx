import { type ComponentProps, useCallback, useMemo } from 'react';
import { type NavigateFunction } from 'react-router-dom';

import type { ActivityTreeItem } from '../activity/activityTree';
import { ActivityTreeView } from '../activity/ActivityTreeView';
import type { ExtensionActivityTreeItemActionRegistration } from '../extensions/useExtensionRegistry';
import { SidebarActivityContextMenu, type SidebarActivityContextMenuProps } from './SidebarActivityContextMenu';
import type { SidebarConversationGroup, SidebarConversationItem } from './sidebarThreadModel';
import type { SidebarActivityContextMenuRegistration } from './useSidebarActivityExtensions';
import { getActivityTreeGroupKey } from './useSidebarConversationDrag';

type ActivityTreeInlineAction = {
  id: string;
  title: string;
  icon?: string;
};

type ActivityTreeContextMenuContext = Parameters<NonNullable<ComponentProps<typeof ActivityTreeView>['renderContextMenu']>>[1];

type UseSidebarActivityTreePropsInput = {
  activityTreeExtensionActions: readonly ExtensionActivityTreeItemActionRegistration[];
  activityTreeExtensionContextMenus: readonly SidebarActivityContextMenuRegistration[];
  conversationGroupByKey: ReadonlyMap<string, SidebarConversationGroup>;
  conversationItemBySessionId: ReadonlyMap<string, SidebarConversationItem>;
  handleActivityTreeExtensionAction: (actionId: string, item: ActivityTreeItem) => void | Promise<void>;
  handleActivityTreeExtensionContextMenu: (
    menu: Parameters<SidebarActivityContextMenuProps['onExtensionContextMenu']>[0],
    input: Parameters<SidebarActivityContextMenuProps['onExtensionContextMenu']>[1],
  ) => void | Promise<void>;
  handleArchiveConversation: (conversationId: string) => void;
  handleArchiveConversationGroup: SidebarActivityContextMenuProps['onArchiveConversationGroup'];
  handleCloseConversation: (conversationId: string) => void;
  handleClosePinnedConversation: (conversationId: string) => void;
  handleCopyConversationDeeplink: (conversationId: string) => void | Promise<void>;
  handleCopyConversationId: (conversationId: string) => void | Promise<void>;
  handleCopyConversationWorkingDirectory: SidebarActivityContextMenuProps['onCopyConversationWorkingDirectory'];
  handleDuplicateConversation: SidebarActivityContextMenuProps['onDuplicateConversation'];
  handleNewConversation: (cwd?: string | null) => void | Promise<void>;
  handleOpenConversationGroupInFinder: SidebarActivityContextMenuProps['onOpenConversationGroupInFinder'];
  handleRemoveConversationGroup: SidebarActivityContextMenuProps['onRemoveConversationGroup'];
  handleRenameConversationGroup: SidebarActivityContextMenuProps['onRenameConversationGroup'];
  navigate: NavigateFunction;
  pinSession: (id: string) => void;
  toggleConversationGroupCollapsed: (groupKey: string) => void;
  unpinSession: (id: string) => void;
};

export function useSidebarActivityTreeProps(input: UseSidebarActivityTreePropsInput): {
  inlineActions: ActivityTreeInlineAction[];
  onArchiveItem: NonNullable<ComponentProps<typeof ActivityTreeView>['onArchiveItem']>;
  onCreateChildItem: NonNullable<ComponentProps<typeof ActivityTreeView>['onCreateChildItem']>;
  onInlineAction: NonNullable<ComponentProps<typeof ActivityTreeView>['onInlineAction']>;
  onOpenItem: NonNullable<ComponentProps<typeof ActivityTreeView>['onOpenItem']>;
  onToggleGroupItem: NonNullable<ComponentProps<typeof ActivityTreeView>['onToggleGroupItem']>;
  renderContextMenu: NonNullable<ComponentProps<typeof ActivityTreeView>['renderContextMenu']>;
} {
  const {
    activityTreeExtensionActions,
    activityTreeExtensionContextMenus,
    conversationGroupByKey,
    conversationItemBySessionId,
    handleActivityTreeExtensionAction,
    handleActivityTreeExtensionContextMenu,
    handleArchiveConversation,
    handleArchiveConversationGroup,
    handleCloseConversation,
    handleClosePinnedConversation,
    handleCopyConversationDeeplink,
    handleCopyConversationId,
    handleCopyConversationWorkingDirectory,
    handleDuplicateConversation,
    handleNewConversation,
    handleOpenConversationGroupInFinder,
    handleRemoveConversationGroup,
    handleRenameConversationGroup,
    navigate,
    pinSession,
    toggleConversationGroupCollapsed,
    unpinSession,
  } = input;
  const inlineActions = useMemo(
    () => activityTreeExtensionActions.map((action) => ({ id: action.id, title: action.title, icon: action.icon })),
    [activityTreeExtensionActions],
  );
  const onInlineAction = useCallback(
    (actionId: string, item: ActivityTreeItem) => {
      void handleActivityTreeExtensionAction(actionId, item);
    },
    [handleActivityTreeExtensionAction],
  );
  const onToggleGroupItem = useCallback(
    (item: ActivityTreeItem) => {
      const groupKey = getActivityTreeGroupKey(item);
      if (groupKey) {
        toggleConversationGroupCollapsed(groupKey);
      }
    },
    [toggleConversationGroupCollapsed],
  );
  const onArchiveItem = useCallback(
    (item: ActivityTreeItem) => {
      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
      if (conversationId) {
        handleArchiveConversation(conversationId);
      }
    },
    [handleArchiveConversation],
  );
  const onCreateChildItem = useCallback(
    (item: ActivityTreeItem) => {
      const cwd = typeof item.metadata?.cwd === 'string' ? item.metadata.cwd : null;
      void handleNewConversation(cwd);
    },
    [handleNewConversation],
  );
  const onOpenItem = useCallback(
    (item: ActivityTreeItem) => {
      if (item.route) {
        navigate(item.route);
      }
    },
    [navigate],
  );
  const renderContextMenu = useCallback(
    (item: ActivityTreeItem, context: ActivityTreeContextMenuContext) => (
      <SidebarActivityContextMenu
        item={item}
        conversationGroupByKey={conversationGroupByKey}
        conversationItemBySessionId={conversationItemBySessionId}
        extensionContextMenus={activityTreeExtensionContextMenus}
        onArchiveConversation={handleArchiveConversation}
        onArchiveConversationGroup={handleArchiveConversationGroup}
        onClose={context.close}
        onCloseConversation={handleCloseConversation}
        onClosePinnedConversation={handleClosePinnedConversation}
        onCopyConversationDeeplink={handleCopyConversationDeeplink}
        onCopyConversationId={handleCopyConversationId}
        onCopyConversationWorkingDirectory={handleCopyConversationWorkingDirectory}
        onDuplicateConversation={handleDuplicateConversation}
        onExtensionContextMenu={handleActivityTreeExtensionContextMenu}
        onOpenConversationGroupInFinder={handleOpenConversationGroupInFinder}
        onPinConversation={pinSession}
        onRemoveConversationGroup={handleRemoveConversationGroup}
        onRenameConversationGroup={handleRenameConversationGroup}
        onRoute={navigate}
        onUnpinConversation={unpinSession}
      />
    ),
    [
      activityTreeExtensionContextMenus,
      conversationGroupByKey,
      conversationItemBySessionId,
      handleActivityTreeExtensionContextMenu,
      handleArchiveConversation,
      handleArchiveConversationGroup,
      handleCloseConversation,
      handleClosePinnedConversation,
      handleCopyConversationDeeplink,
      handleCopyConversationId,
      handleCopyConversationWorkingDirectory,
      handleDuplicateConversation,
      handleOpenConversationGroupInFinder,
      handleRemoveConversationGroup,
      handleRenameConversationGroup,
      navigate,
      pinSession,
      unpinSession,
    ],
  );

  return {
    inlineActions,
    onArchiveItem,
    onCreateChildItem,
    onInlineAction,
    onOpenItem,
    onToggleGroupItem,
    renderContextMenu,
  };
}
