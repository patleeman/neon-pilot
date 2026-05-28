import { useCallback, useMemo, useRef } from 'react';

import type { ActivityTreeItem } from '../activity/activityTree';
import { api } from '../client/api';
import { createNativeExtensionClient } from '../extensions/nativePaClient';
import type { ExtensionActivityTreeItemActionRegistration } from '../extensions/useExtensionRegistry';

export type SidebarActivityContextMenuRegistration = {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  surface: string;
};

type SidebarNoticeFn = (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;

export function useSidebarActivityExtensions({
  activityTreeActions,
  contextMenus,
  onRoute,
  showNotice,
}: {
  activityTreeActions: readonly ExtensionActivityTreeItemActionRegistration[];
  contextMenus: readonly SidebarActivityContextMenuRegistration[];
  onRoute: (route: string) => void;
  showNotice: SidebarNoticeFn;
}) {
  const paClientByExtension = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  const getPaClient = useCallback((extensionId: string) => {
    let client = paClientByExtension.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      paClientByExtension.current.set(extensionId, client);
    }
    return client;
  }, []);

  const contextMenuItems = useMemo(
    () =>
      contextMenus.filter(
        (menu) =>
          menu.surface === 'conversationList' &&
          !['duplicateConversation', 'copyWorkingDirectory', 'copyConversationId', 'copyDeeplink'].includes(menu.action),
      ),
    [contextMenus],
  );

  const handleContextMenu = useCallback(
    async (menu: (typeof contextMenuItems)[number], input: { conversationId: string; sessionTitle: string; cwd: string | undefined }) => {
      try {
        if (menu.action === 'attachConversation') {
          onRoute(`/conversations/${encodeURIComponent(input.conversationId)}?gateway=1`);
          return;
        }

        if (menu.action === 'exportSession') {
          await api.invokeExtensionAction(menu.extensionId, menu.action, input);
          return;
        }

        await getPaClient(menu.extensionId).extension.invoke(menu.action, input);
      } catch (error) {
        showNotice('danger', `${menu.title} failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
      }
    },
    [contextMenuItems, getPaClient, onRoute, showNotice],
  );

  const handleInlineAction = useCallback(
    async (actionId: string, item: ActivityTreeItem) => {
      const action = activityTreeActions.find((candidate) => candidate.id === actionId);
      if (!action) return;

      const conversationId = typeof item.metadata?.conversationId === 'string' ? item.metadata.conversationId : null;
      const input = {
        itemId: item.id,
        kind: item.kind,
        title: item.title,
        conversationId,
        cwd: typeof item.metadata?.cwd === 'string' ? item.metadata.cwd : undefined,
      };

      try {
        await getPaClient(action.extensionId).extension.invoke(action.action, input);
      } catch (error) {
        showNotice('danger', `${action.title} failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
      }
    },
    [activityTreeActions, getPaClient, showNotice],
  );

  return {
    contextMenuItems,
    handleContextMenu,
    handleInlineAction,
    inlineActions: activityTreeActions,
  };
}
