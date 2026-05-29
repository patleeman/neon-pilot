/**
 * Custom DOM events for cross-component communication between the main
 * conversation page and the right-panel companion tab system.
 *
 * Because ConversationPage renders inside <Outlet /> (a child of Layout)
 * and the companion tab strip lives in Layout, React prop-drilling is
 * impractical.  We use window custom events, following the existing
 * pattern in the codebase (WORKBENCH_OPEN_TOOL_TAB_EVENT etc.).
 */

/**
 * Open (or focus) a companion conversation in a right-panel tab.
 * Dispatched by ConversationPage after a fork, or by TopologyBlock
 * when a user clicks a "Forked to" tombstone.
 */
export const COMPANION_CHAT_OPEN_EVENT = 'pa:companion-chat-open';

export interface CompanionChatOpenDetail {
  /** Conversation ID of the companion / forked conversation. */
  conversationId: string;
  /** Optional human-readable title. */
  title?: string | null;
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

export interface CompanionChatCloseDetail {
  conversationId: string;
}

export function dispatchCloseCompanionChat(detail: CompanionChatCloseDetail): void {
  window.dispatchEvent(new CustomEvent(COMPANION_CHAT_CLOSE_EVENT, { detail }));
}
