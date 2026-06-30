// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeClipboardText } from '../../desktop/clipboard';
import { createNativeExtensionClient } from '../../extensions/nativePaClient';
import type { ExtensionMessageActionRegistration } from '../../extensions/useExtensionRegistry';
import { notifyDesktopConversationStateRefresh } from '../../hooks/useDesktopConversationState';
import { addNotification } from '../notifications/notificationStore';
import { MESSAGE_ACTION_COMMAND_EVENT, type MessageActionCommandDetail } from './messageActionCommands';
import { MessageActions } from './MessageActions';

const mockRegistry = vi.hoisted(() => ({
  messageActions: [] as ExtensionMessageActionRegistration[],
}));

vi.mock('../../desktop/clipboard', () => ({
  writeClipboardText: vi.fn(),
}));

vi.mock('../../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({ messageActions: mockRegistry.messageActions }),
}));

vi.mock('../../extensions/nativePaClient', () => ({
  createNativeExtensionClient: vi.fn(),
}));

vi.mock('../notifications/notificationStore', () => ({
  addNotification: vi.fn(),
}));

vi.mock('../../hooks/useDesktopConversationState', () => ({
  notifyDesktopConversationStateRefresh: vi.fn(),
}));

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

async function dispatchMessageAction(command: MessageActionCommandDetail['command']) {
  act(() => {
    fireEvent(window, new CustomEvent<MessageActionCommandDetail>(MESSAGE_ACTION_COMMAND_EVENT, { detail: { command } }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('MessageActions commands', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockRegistry.messageActions = [];
    document.body.innerHTML = '';
  });

  it('labels prompt and assistant copy actions from the matching user perspective', () => {
    const { rerender } = render(<MessageActions isUser blockText="Prompt" copyText="Prompt to copy" />);

    const promptCopyButton = document.querySelector('button[aria-label="Copy this prompt to the clipboard"]');
    expect(promptCopyButton?.getAttribute('title')).toBeNull();
    expect(promptCopyButton?.textContent).toBe('⎘');
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Copy this prompt to the clipboard');

    rerender(<MessageActions blockText="Reply" copyText="Reply to copy" />);

    const assistantCopyButton = document.querySelector('button[aria-label="Copy this assistant message to the clipboard"]');
    expect(assistantCopyButton?.getAttribute('title')).toBeNull();
    expect(assistantCopyButton?.textContent).toBe('⎘');
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Copy this assistant message to the clipboard');
  });

  it('renders extension message actions as icon-only controls with shared tooltip labels', () => {
    mockRegistry.messageActions = [
      {
        extensionId: 'system-model-arena',
        id: 'compare-message',
        title: 'Compare models',
        action: 'startManualDuel',
        when: 'role:assistant && hasText',
      },
    ];

    render(<MessageActions blockText="Assistant response" copyText="Assistant response" />);

    const compareButton = document.querySelector<HTMLButtonElement>('button[aria-label="Compare models"]');
    expect(compareButton).not.toBeNull();
    expect(compareButton?.getAttribute('title')).toBeNull();
    expect(compareButton?.textContent).toBe('⇄');
    expect([...document.querySelectorAll('.ui-tooltip')].map((tooltip) => tooltip.textContent)).toContain('Compare models');
  });

  it('surfaces extension action result text in the shared tooltip', async () => {
    const invoke = vi.fn(async () => ({ text: 'Model duel duel-1 already exists for this answer.', duelId: 'duel-1', existing: true }));
    vi.mocked(createNativeExtensionClient).mockReturnValue({ extension: { invoke } } as never);
    mockRegistry.messageActions = [
      {
        extensionId: 'system-model-arena',
        id: 'compare-message',
        title: 'Compare models',
        action: 'startManualDuel',
        when: 'role:assistant && hasText',
      },
    ];

    render(<MessageActions blockText="Assistant response" blockId="assistant-1" conversationId="conv-1" copyText="Assistant response" />);

    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Compare models"]')!);

    await waitFor(() =>
      expect(document.querySelector<HTMLButtonElement>('button[aria-label^="Compare models:"]')?.getAttribute('aria-label')).toContain(
        'already exists',
      ),
    );
    expect([...document.querySelectorAll('.ui-tooltip')].map((tooltip) => tooltip.textContent)).toContain(
      'Compare models: Model duel duel-1 already exists for this answer.',
    );
    expect(invoke).toHaveBeenCalledWith('startManualDuel', {
      messageText: 'Assistant response',
      messageRole: 'assistant',
      blockId: 'assistant-1',
      conversationId: 'conv-1',
    });
  });

  it('refreshes the active conversation when an extension action asks for it', async () => {
    const invoke = vi.fn(async () => ({
      text: 'Started model duel duel-1.',
      duelId: 'duel-1',
      refreshConversationId: 'conv-1',
    }));
    vi.mocked(createNativeExtensionClient).mockReturnValue({ extension: { invoke } } as never);
    mockRegistry.messageActions = [
      {
        extensionId: 'system-model-arena',
        id: 'compare-message',
        title: 'Compare models',
        action: 'startManualDuel',
        when: 'role:assistant && hasText',
      },
    ];

    render(<MessageActions blockText="Assistant response" blockId="assistant-1" conversationId="conv-1" copyText="Assistant response" />);

    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Compare models"]')!);

    await waitFor(() => expect(notifyDesktopConversationStateRefresh).toHaveBeenCalledWith('conv-1'));
  });

  it('shows extension action failures as notifications instead of long gutter tooltips', async () => {
    const invoke = vi.fn(async () => {
      throw new Error(
        'Extension "system-model-arena" action "startManualDuel" failed: Extension backend action failed: Add a challenger model different from the current conversation model before starting a duel.',
      );
    });
    vi.mocked(createNativeExtensionClient).mockReturnValue({ extension: { invoke } } as never);
    mockRegistry.messageActions = [
      {
        extensionId: 'system-model-arena',
        id: 'compare-message',
        title: 'Compare models',
        action: 'startManualDuel',
        when: 'role:assistant && hasText',
      },
    ];

    render(<MessageActions blockText="Assistant response" blockId="assistant-1" conversationId="conv-1" copyText="Assistant response" />);

    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-label="Compare models"]')!);

    await waitFor(() =>
      expect(addNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Compare models failed.',
        details: 'Add a challenger model different from the current conversation model before starting a duel.',
        source: 'Model Arena',
      }),
    );
    expect(document.querySelector<HTMLButtonElement>('button[aria-label="Compare models failed. See notification."]')).not.toBeNull();
    expect([...document.querySelectorAll('.ui-tooltip')].map((tooltip) => tooltip.textContent)).toContain(
      'Compare models failed. See notification.',
    );
  });

  it('handles shared first message action commands', async () => {
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onRewind = vi.fn();
    const onFork = vi.fn();

    render(<MessageActions isUser blockText="Prompt" copyText="Prompt to copy" onEdit={onEdit} onRewind={onRewind} onFork={onFork} />);

    await dispatchMessageAction('copyFirst');
    await waitFor(() => expect(writeClipboardText).toHaveBeenCalledWith('Prompt to copy'));

    await dispatchMessageAction('editFirst');
    await dispatchMessageAction('rewindFirst');
    await dispatchMessageAction('forkFirst');

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRewind).toHaveBeenCalledTimes(1);
    expect(onFork).toHaveBeenCalledTimes(1);
  });

  it('lets only the first eligible mounted action handle a shared command', async () => {
    const firstRewind = vi.fn();
    const secondRewind = vi.fn();

    render(
      <>
        <MessageActions blockText="First" copyText="First" onRewind={firstRewind} />
        <MessageActions blockText="Second" copyText="Second" onRewind={secondRewind} />
      </>,
    );

    await dispatchMessageAction('rewindFirst');

    await waitFor(() => expect(firstRewind).toHaveBeenCalledTimes(1));
    expect(secondRewind).not.toHaveBeenCalled();
  });
});
