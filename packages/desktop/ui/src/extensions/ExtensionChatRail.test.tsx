// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionChatRail } from './ExtensionChatRail';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const sendMock = vi.hoisted(() => vi.fn());
const abortMock = vi.hoisted(() => vi.fn());
const reconnectMock = vi.hoisted(() => vi.fn());
const desktopConversationStateMock = vi.hoisted(() => vi.fn());
const updateConversationModelPreferencesMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useDesktopConversationState', () => ({
  useDesktopConversationState: vi.fn(() => ({
    state: {
      stream: {
        blocks: [],
        isStreaming: false,
        isCompacting: false,
        contextUsage: null,
        tokens: null,
      },
      sessionDetail: { meta: { cwd: null } },
    },
    send: sendMock,
    abort: abortMock,
    reconnect: reconnectMock,
  })),
}));

vi.mock('../client/api', () => ({
  api: {
    conversationModelPreferences: vi.fn(async () => ({ currentModel: 'model-a', currentThinkingLevel: 'medium' })),
    models: vi.fn(async () => ({ models: [{ provider: 'test', model: 'model-a', label: 'Model A' }] })),
    desktopConversationState: desktopConversationStateMock,
    updateConversationModelPreferences: updateConversationModelPreferencesMock,
  },
}));

vi.mock('../components/chat/ChatView', () => ({
  ChatView: ({ messages }: { messages: Array<{ id: string; text?: string }> }) => (
    <div data-testid="chat-view">{messages.map((message) => message.text).join('\n')}</div>
  ),
}));

vi.mock('../components/chat/ChatRailComposer', () => ({
  ChatRailComposer: ({
    onSubmit,
    onSelectModel,
  }: {
    onSubmit: (text: string, behavior?: 'steer' | 'followUp') => Promise<void>;
    onSelectModel: (modelId: string) => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => onSubmit('Review this draft', 'steer')}>
        send
      </button>
      <button type="button" onClick={() => onSelectModel('model-b')}>
        model
      </button>
    </div>
  ),
}));

describe('ExtensionChatRail', () => {
  beforeEach(() => {
    vi.useRealTimers();
    sendMock.mockReset();
    abortMock.mockReset();
    reconnectMock.mockReset();
    desktopConversationStateMock.mockReset();
    desktopConversationStateMock.mockResolvedValue({
      conversationId: 'conversation-1',
      sessionDetail: { meta: { cwd: null } },
      liveSession: { live: true, id: 'conversation-1', cwd: null, sessionFile: null, isStreaming: false },
      stream: {
        blocks: [],
        isStreaming: false,
        isCompacting: false,
        contextUsage: null,
        tokens: null,
      },
    });
    updateConversationModelPreferencesMock.mockReset();
  });

  it('submits through the shared desktop conversation state with extension context messages', async () => {
    const onTurnComplete = vi.fn();
    render(
      <ExtensionChatRail
        conversationId="conversation-1"
        getContextMessages={(text) => [{ customType: 'writing_studio_context', content: `Context for ${text}` }]}
        onTurnComplete={onTurnComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('Review this draft', 'steer', undefined, undefined, [
        { customType: 'writing_studio_context', content: 'Context for Review this draft' },
      ]);
    });
    expect(reconnectMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(onTurnComplete).toHaveBeenCalled();
    });
  });

  it('routes model changes through the host conversation model API', async () => {
    render(<ExtensionChatRail conversationId="conversation-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'model' }));

    await waitFor(() => {
      expect(updateConversationModelPreferencesMock).toHaveBeenCalledWith('conversation-1', { model: 'model-b' });
    });
  });

  it('hydrates and renders authoritative host conversation blocks when the hook has no blocks yet', async () => {
    desktopConversationStateMock.mockResolvedValueOnce({
      conversationId: 'conversation-1',
      sessionDetail: { meta: { cwd: null } },
      liveSession: { live: true, id: 'conversation-1', cwd: null, sessionFile: null, isStreaming: false },
      stream: {
        blocks: [{ type: 'text', id: 'assistant-1', text: 'Visible assistant response', ts: '2026-06-03T00:00:00.000Z' }],
        isStreaming: false,
        isCompacting: false,
        contextUsage: null,
        tokens: null,
      },
    });

    render(<ExtensionChatRail conversationId="conversation-1" emptyState={<p>No messages</p>} />);

    await waitFor(() => {
      expect(screen.getByTestId('chat-view').textContent).toContain('Visible assistant response');
    });
  });
});
