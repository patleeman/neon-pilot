// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChatRail } from './ChatRail';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../pages/ConversationPage.js', () => ({
  ConversationPage: ({ conversationId }: { conversationId?: string | null }) => (
    <div data-testid="conversation-page">ConversationPage:{conversationId}</div>
  ),
}));

describe('ChatRail', () => {
  it('uses the same ConversationPage component as the main thread', () => {
    render(<ChatRail conversationId="conversation-1" workspaceCwd={null} />);

    expect(screen.getByTestId('conversation-page').textContent).toBe('ConversationPage:conversation-1');
  });
});
