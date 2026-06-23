import type { ReactNode } from 'react';

import { ConversationPage } from '../pages/ConversationPage';

export interface ExtensionChatContextMessage {
  customType: string;
  content: string;
}

export interface ExtensionChatRailProps {
  conversationId: string | null;
  workspaceCwd?: string | null;
  tailBlocks?: number;
  className?: string;
  emptyState?: ReactNode;
  externalDraft?: { id: string; text: string } | null;
  getContextMessages?: (text: string) => ExtensionChatContextMessage[] | Promise<ExtensionChatContextMessage[]>;
  onError?: (message: string) => void;
  onModelChange?: (modelId: string) => void;
  onTurnComplete?: () => void | Promise<void>;
}

/**
 * Extension-facing visible conversations render the same host conversation
 * component as the main area and workbench rail. Private extension chats should
 * use extension-owned streaming routes instead.
 */
export function ExtensionChatRail({ conversationId, className }: ExtensionChatRailProps) {
  return (
    <div className={className ?? 'flex h-full min-h-0 flex-col'} data-extension-chat-rail="1">
      <ConversationPage conversationId={conversationId} />
    </div>
  );
}
