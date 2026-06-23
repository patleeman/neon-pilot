import { ConversationPage } from '../../pages/ConversationPage.js';

/**
 * Right-panel chat renders the same conversation surface as the main thread.
 * Keep this wrapper thin so transcript, shelves, composer, shortcuts, and run state
 * stay identical across main and side chat.
 */
export function ChatRail({ conversationId }: { conversationId: string; workspaceCwd: string | null }) {
  return <ConversationPage conversationId={conversationId} />;
}
