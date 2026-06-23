// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatRail } from './ChatRail';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const desktopStateMock = vi.hoisted(() => ({
  send: vi.fn(),
  abort: vi.fn(),
  reconnect: vi.fn(),
  state: {
    stream: {
      blocks: [],
      isStreaming: false,
      isCompacting: false,
      contextUsage: null,
      tokens: null,
      goalState: null,
    },
    sessionDetail: { meta: { cwd: null } },
  },
  surfaceId: 'surface-1',
}));

const registryMock = vi.hoisted(() => ({
  composerShelves: [] as Array<{ extensionId: string; id: string; placement: 'top' | 'bottom'; title: string }>,
}));

vi.mock('../../hooks/useDesktopConversationState', () => ({
  useDesktopConversationState: vi.fn(() => desktopStateMock),
}));

vi.mock('../../app/contexts.js', () => ({
  useAppEvents: () => ({ conversationVersions: {} }),
}));

vi.mock('../../client/api.js', () => ({
  api: {
    conversationModelPreferences: vi.fn(async () => ({ currentModel: 'model-a', currentThinkingLevel: 'medium' })),
    models: vi.fn(async () => ({ models: [{ provider: 'test', model: 'model-a', label: 'Model A' }] })),
    updateConversationModelPreferences: vi.fn(async () => undefined),
  },
}));

vi.mock('../../extensions/useExtensionRegistry.js', () => ({
  useExtensionRegistry: () => registryMock,
}));

vi.mock('../../extensions/ComposerShelfHost.js', () => ({
  ComposerShelfHost: ({ registration }: { registration: { title: string } }) => <div>{registration.title}</div>,
}));

vi.mock('../conversation/ConversationGoalPanel.js', () => ({
  ConversationGoalPanel: ({ goal }: { goal: { objective?: string } | null }) =>
    goal?.objective ? <div>Goal: {goal.objective}</div> : null,
}));

vi.mock('./ChatView.js', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));

vi.mock('./ChatRailComposer.js', () => ({
  ChatRailComposer: ({ conversationShelves }: { conversationShelves?: React.ReactNode }) => (
    <div data-testid="composer">{conversationShelves}</div>
  ),
}));

describe('ChatRail', () => {
  beforeEach(() => {
    registryMock.composerShelves = [];
    desktopStateMock.state.stream.goalState = null;
  });

  it('renders the same conversation composer shelves as the main thread composer', async () => {
    registryMock.composerShelves = [
      { extensionId: 'system-todo', id: 'todos', placement: 'top', title: 'Todos' },
      { extensionId: 'system-runs', id: 'runs', placement: 'bottom', title: 'Runs' },
    ];
    desktopStateMock.state.stream.goalState = { objective: 'Keep shelf visible' } as never;

    render(<ChatRail conversationId="conversation-1" workspaceCwd={null} />);

    expect(screen.getByText('Goal: Keep shelf visible')).toBeTruthy();
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Runs')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('composer')).toBeTruthy());
  });
});
