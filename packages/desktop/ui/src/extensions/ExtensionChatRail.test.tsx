// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ExtensionChatRail } from './ExtensionChatRail';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: ({ conversationId }: { conversationId?: string | null }) => (
    <section data-testid="conversation-page">ConversationPage:{conversationId}</section>
  ),
}));

describe('ExtensionChatRail', () => {
  it('renders the shared host conversation page for visible extension conversations', () => {
    render(<ExtensionChatRail conversationId="conversation-1" className="custom-rail" />);

    expect(screen.getByTestId('conversation-page').textContent).toBe('ConversationPage:conversation-1');
    expect(screen.getByTestId('conversation-page').closest('[data-extension-chat-rail]')?.className).toBe('custom-rail');
  });
});
