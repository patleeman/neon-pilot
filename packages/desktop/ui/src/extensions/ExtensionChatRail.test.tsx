// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { ExtensionChatRail } from './ExtensionChatRail';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const sendMock = vi.hoisted(() => vi.fn());
const abortMock = vi.hoisted(() => vi.fn());
const reconnectMock = vi.hoisted(() => vi.fn());
const desktopConversationStateMock = vi.hoisted(() => vi.fn());
const updateConversationModelPreferencesMock = vi.hoisted(() => vi.fn());
const desktopHookState = vi.hoisted(() => ({
  loading: false,
  state: {
    stream: {
      blocks: [],
      isStreaming: false,
      isCompacting: false,
      contextUsage: null,
      tokens: null,
    },
    sessionDetail: { meta: { cwd: null } },
  } as {
    stream: {
      blocks: never[];
      isStreaming: boolean;
      isCompacting: boolean;
      contextUsage: null;
      tokens: null;
    };
    sessionDetail: { meta: { cwd: null } };
  } | null,
}));

vi.mock('../hooks/useDesktopConversationState', () => ({
  useDesktopConversationState: vi.fn(() => ({
    state: desktopHookState.state,
    loading: desktopHookState.loading,
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
  ChatView: ({ messages, layout }: { messages: Array<{ id: string; text?: string }>; layout?: string }) => (
    <div data-testid="chat-view" data-layout={layout}>
      {messages.map((message) => message.text).join('\n')}
    </div>
  ),
}));

vi.mock('../components/chat/ChatRailComposer', () => ({
  ChatRailComposer: ({
    onSubmit,
    onSelectModel,
    layout,
  }: {
    onSubmit: (text: string, behavior?: 'steer' | 'followUp') => Promise<void>;
    onSelectModel: (modelId: string) => Promise<void>;
    layout?: string;
  }) => (
    <div data-testid="chat-rail-composer" data-layout={layout}>
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
    desktopHookState.loading = false;
    desktopHookState.state = {
      stream: {
        blocks: [],
        isStreaming: false,
        isCompacting: false,
        contextUsage: null,
        tokens: null,
      },
      sessionDetail: { meta: { cwd: null } },
    };
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
    desktopConversationStateMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        sessionDetail: { meta: { cwd: null } },
        liveSession: { live: true, id: 'conversation-1', cwd: null, sessionFile: null, isStreaming: true },
        stream: {
          blocks: [{ type: 'text', id: 'user-1', text: 'Review this draft', ts: '2026-06-03T00:00:00.000Z' }],
          isStreaming: true,
          isCompacting: false,
          contextUsage: null,
          tokens: null,
        },
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        sessionDetail: { meta: { cwd: null } },
        liveSession: { live: true, id: 'conversation-1', cwd: null, sessionFile: null, isStreaming: false },
        stream: {
          blocks: [
            { type: 'text', id: 'user-1', text: 'Review this draft', ts: '2026-06-03T00:00:00.000Z' },
            { type: 'text', id: 'assistant-1', text: 'Done.', ts: '2026-06-03T00:00:01.000Z' },
          ],
          isStreaming: false,
          isCompacting: false,
          contextUsage: null,
          tokens: null,
        },
      });
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
      expect(desktopConversationStateMock).toHaveBeenCalledTimes(2);
    });
    expect(onTurnComplete).not.toHaveBeenCalled();
    await waitFor(
      () => {
        expect(desktopConversationStateMock).toHaveBeenCalledTimes(3);
      },
      { timeout: 2500 },
    );
    await waitFor(() => {
      expect(onTurnComplete).toHaveBeenCalled();
    });
    expect(onTurnComplete).toHaveBeenCalledTimes(1);
  });

  it('does not complete a submitted turn until a result block appears', async () => {
    const onTurnComplete = vi.fn();
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

    render(<ExtensionChatRail conversationId="conversation-1" onTurnComplete={onTurnComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('Review this draft', 'steer', undefined, undefined, undefined);
    });
    await waitFor(() => {
      expect(desktopConversationStateMock).toHaveBeenCalledTimes(2);
    });
    expect(onTurnComplete).not.toHaveBeenCalled();
  });

  it('routes model changes through the host conversation model API', async () => {
    const onModelChange = vi.fn();
    render(<ExtensionChatRail conversationId="conversation-1" onModelChange={onModelChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'model' }));

    await waitFor(() => {
      expect(updateConversationModelPreferencesMock).toHaveBeenCalledWith('conversation-1', { model: 'model-b' });
    });
    expect(onModelChange).toHaveBeenCalledWith('model-b');
  });

  it('centers loading while the host conversation is hydrating', () => {
    desktopHookState.loading = true;
    desktopHookState.state = null;
    desktopConversationStateMock.mockReturnValue(new Promise(() => undefined));
    vi.mocked(api.conversationModelPreferences).mockReturnValue(new Promise(() => undefined));
    vi.mocked(api.models).mockReturnValue(new Promise(() => undefined));

    render(<ExtensionChatRail conversationId="conversation-1" emptyState={<p>No messages</p>} />);

    const loading = screen.getByText('Loading messages…').closest('[role="status"]');
    expect(loading).not.toBeNull();
    expect(loading.closest('.ui-centered-state')).not.toBeNull();
    expect(screen.queryByText('No messages')).toBeNull();
    expect(screen.queryByTestId('chat-view')).toBeNull();
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
    expect(screen.getByTestId('chat-view').getAttribute('data-layout')).toBe('compact');
    expect(screen.getByTestId('chat-rail-composer').getAttribute('data-layout')).toBe('compact');
  });

  it('clears delayed refresh timers after unmount', async () => {
    vi.useFakeTimers();
    const view = render(<ExtensionChatRail conversationId="conversation-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendMock).toHaveBeenCalledWith('Review this draft', 'steer', undefined, undefined, undefined);
    expect(desktopConversationStateMock).toHaveBeenCalledTimes(2);

    view.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(desktopConversationStateMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('ignores stale refresh errors after switching conversations', async () => {
    let rejectConversationOneRefresh: ((reason?: unknown) => void) | null = null;

    desktopConversationStateMock
      .mockResolvedValueOnce({
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
      })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectConversationOneRefresh = reject;
          }),
      )
      .mockResolvedValueOnce({
        conversationId: 'conversation-2',
        sessionDetail: { meta: { cwd: '/tmp/next-project' } },
        liveSession: { live: true, id: 'conversation-2', cwd: '/tmp/next-project', sessionFile: null, isStreaming: false },
        stream: {
          blocks: [],
          isStreaming: false,
          isCompacting: false,
          contextUsage: null,
          tokens: null,
        },
      });

    const onError = vi.fn();
    const view = render(<ExtensionChatRail conversationId="conversation-1" onError={onError} />);

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('Review this draft', 'steer', undefined, undefined, undefined);
    });
    await waitFor(() => {
      expect(desktopConversationStateMock).toHaveBeenCalledTimes(2);
    });

    view.rerender(<ExtensionChatRail conversationId="conversation-2" onError={onError} />);

    await waitFor(() => {
      expect(desktopConversationStateMock).toHaveBeenCalledTimes(3);
    });

    rejectConversationOneRefresh?.(new Error('stale conversation-1 refresh failed'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onError).not.toHaveBeenCalledWith('stale conversation-1 refresh failed');
  });
});
