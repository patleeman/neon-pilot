// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { UserMessage } from './MessageBlocks';
import { MESSAGE_EDIT_COMMAND_EVENT } from './messageEditCommands';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const userBlock: Extract<MessageBlock, { type: 'user' }> = {
  type: 'user',
  id: 'msg-1',
  text: 'Draft this response',
  ts: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

function renderUserMessage(onEditMessage = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<UserMessage block={userBlock} messageIndex={2} onEditMessage={onEditMessage} />);
  });

  return { container, root, onEditMessage };
}

describe('UserMessage edit commands', () => {
  const roots: Root[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      act(() => roots.pop()?.unmount());
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('saves the active message edit from the shared command event', async () => {
    const onEditMessage = vi.fn();
    const rendered = renderUserMessage(onEditMessage);
    roots.push(rendered.root);

    const editButton = rendered.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit this prompt and rerun the conversation from here"]',
    );
    expect(editButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      editButton?.click();
    });

    expect(rendered.container.querySelector('textarea')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(MESSAGE_EDIT_COMMAND_EVENT, { detail: 'save' }));
    });

    expect(onEditMessage).toHaveBeenCalledWith(2, 'Draft this response');
  });

  it('cancels the active message edit from the shared command event', async () => {
    const rendered = renderUserMessage();
    roots.push(rendered.root);

    const editButton = rendered.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit this prompt and rerun the conversation from here"]',
    );
    expect(editButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      editButton?.click();
    });

    expect(rendered.container.querySelector('textarea')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(MESSAGE_EDIT_COMMAND_EVENT, { detail: 'cancel' }));
    });

    expect(rendered.container.querySelector('textarea')).toBeNull();
  });
});
