// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeClipboardText } from '../../desktop/clipboard';
import type { ExtensionMessageActionRegistration } from '../../extensions/useExtensionRegistry';
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

    expect(document.querySelector('button[title="Copy this prompt to the clipboard"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="Copy this prompt to the clipboard"]')?.textContent).toBe('⎘');
    expect(document.body.textContent).not.toContain('copy');

    rerender(<MessageActions blockText="Reply" copyText="Reply to copy" />);

    expect(document.querySelector('button[title="Copy this assistant message to the clipboard"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="Copy this assistant message to the clipboard"]')?.textContent).toBe('⎘');
  });

  it('renders extension message actions as icon-only controls with tooltip labels', () => {
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
    expect(compareButton?.getAttribute('title')).toBe('Compare models');
    expect(compareButton?.textContent).toBe('⇄');
    expect(document.body.textContent).not.toContain('Compare models');
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
