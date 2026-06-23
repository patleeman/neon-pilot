/**
 * Custom DOM events for cross-component communication between the main
 * conversation page and workbench chat tabs.
 *
 * Because ConversationPage renders inside <Outlet /> (a child of Layout)
 * and the workbench tab strip lives in Layout, React prop-drilling is
 * impractical.  We use window custom events, following the existing
 * pattern in the codebase (WORKBENCH_OPEN_TOOL_TAB_EVENT etc.).
 */

/**
 * Open (or focus) a companion conversation in a workbench chat tab.
 * Dispatched by ConversationPage after a fork, or by TopologyBlock
 * when a user clicks a "Forked to" tombstone.
 */
export const COMPANION_CHAT_OPEN_EVENT = 'pa:companion-chat-open';

export interface CompanionChatOpenDetail {
  /** Conversation ID of the companion / forked conversation. */
  conversationId: string;
  /** Optional human-readable title. */
  title?: string | null;
  /** Create a new workbench tab even if this conversation is already open. */
  forceNewTab?: boolean;
}

/**
 * Dispatch a request to open/focus a companion chat tab.
 */
export function dispatchOpenCompanionChat(detail: CompanionChatOpenDetail): void {
  window.dispatchEvent(new CustomEvent(COMPANION_CHAT_OPEN_EVENT, { detail }));
}

/**
 * Remove a companion tab.  Dispatched when the user closes the tab
 * or when the companion conversation itself is deleted.
 */
export const COMPANION_CHAT_CLOSE_EVENT = 'pa:companion-chat-close';

/**
 * Promote a workbench chat tab to a full sidebar thread.
 * Dispatched when a user drags a workbench chat tab onto the left sidebar
 * (or invokes the Move to sidebar action). Layout owns the workbench tab
 * state and performs the promotion: open the conversation in the sidebar,
 * close the workbench tab, and navigate to it.
 */
export const WORKBENCH_PROMOTE_CHAT_EVENT = 'pa:workbench-promote-chat';

export interface WorkbenchPromoteChatDetail {
  conversationId: string;
}

export function dispatchPromoteWorkbenchChat(detail: WorkbenchPromoteChatDetail): void {
  window.dispatchEvent(new CustomEvent(WORKBENCH_PROMOTE_CHAT_EVENT, { detail }));
}

/**
 * Drag MIME type marking a payload as a workbench chat tab being dragged
 * onto the left sidebar. Distinct from application/x-neon-pilot-conversation
 * (used internally by the sidebar for reordering) so the sidebar can accept
 * the drop only from the workbench, not the reverse direction.
 */
export const WORKBENCH_CHAT_TAB_DRAG_MIME = 'application/x-neon-pilot-workbench-chat-tab';
