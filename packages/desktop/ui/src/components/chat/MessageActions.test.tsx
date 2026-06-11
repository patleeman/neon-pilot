// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeClipboardText } from '../../desktop/clipboard';
import { MessageActions } from './MessageActions';
import { MESSAGE_ACTION_COMMAND_EVENT, type MessageActionCommandDetail } from './messageActionCommands';

vi.mock('../../desktop/clipboard', () => ({
  writeClipboardText: vi.fn(),
}));

vi.mock('../../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({ messageActions: [] }),
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
    document.body.innerHTML = '';
  });

  it('handles shared first message action commands', async () => {
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onRewind = vi.fn();
    const onFork = vi.fn();

    render(
      <MessageActions
        isUser
        blockText="Prompt"
        copyText="Prompt to copy"
        onEdit={onEdit}
        onRewind={onRewind}
        onFork={onFork}
      />,
    );

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
