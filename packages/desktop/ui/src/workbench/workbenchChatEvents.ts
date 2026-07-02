/**
 * Custom DOM events for cross-component workbench chat coordination.
 *
 * ConversationPage renders inside <Outlet /> (a child of Layout) while the
 * workbench tab strip lives in Layout, so these mirror the existing app-wide
 * window event pattern used for workbench tools.
 */

/**
 * Open (or focus) a conversation in a workbench chat tab.
 */
export const WORKBENCH_CHAT_OPEN_EVENT = 'pa:workbench-chat-open';

export interface WorkbenchChatOpenDetail {
  conversationId: string;
  title?: string | null;
  forceNewTab?: boolean;
}

export function dispatchOpenWorkbenchChat(detail: WorkbenchChatOpenDetail): void {
  window.dispatchEvent(new CustomEvent(WORKBENCH_CHAT_OPEN_EVENT, { detail }));
}

/**
 * Remove a workbench chat tab.
 */
export const WORKBENCH_CHAT_CLOSE_EVENT = 'pa:workbench-chat-close';

/**
 * Promote a workbench chat tab to a full sidebar thread.
 */
export const WORKBENCH_PROMOTE_CHAT_EVENT = 'pa:workbench-promote-chat';

export interface WorkbenchPromoteChatDetail {
  conversationId: string;
}

export function dispatchPromoteWorkbenchChat(detail: WorkbenchPromoteChatDetail): void {
  window.dispatchEvent(new CustomEvent(WORKBENCH_PROMOTE_CHAT_EVENT, { detail }));
}

/**
 * Drag MIME type marking a payload as a workbench chat tab being dragged onto
 * the left sidebar. Distinct from application/x-neon-pilot-conversation so the
 * sidebar can accept drops only from the workbench.
 */
export const WORKBENCH_CHAT_TAB_DRAG_MIME = 'application/x-neon-pilot-workbench-chat-tab';
