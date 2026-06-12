// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { ThinkingBlock } from './TraceBlocks';
import { THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, type ThinkingBlockCommandDetail } from './thinkingBlockCommands';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function thinkingBlock(text: string): Extract<MessageBlock, { type: 'thinking' }> {
  return {
    type: 'thinking',
    id: `thinking-${text}`,
    ts: '2026-06-11T12:00:00.000Z',
    text,
  };
}

describe('ThinkingBlock commands', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles the first visible thinking block from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ThinkingBlock block={thinkingBlock('preview thought\nhidden thought detail')} autoOpen={false} />);
    });

    expect(container.textContent).toContain('show');
    expect(container.textContent).not.toContain('hidden thought detail');

    act(() => {
      window.dispatchEvent(new CustomEvent<ThinkingBlockCommandDetail>(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('hide');
    expect(container.textContent).toContain('hidden thought detail');
  });

  it('lets only the first mounted thinking block handle one shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          <ThinkingBlock block={thinkingBlock('first preview\nfirst thought detail')} autoOpen={false} />
          <ThinkingBlock block={thinkingBlock('second preview\nsecond thought detail')} autoOpen={false} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<ThinkingBlockCommandDetail>(THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('first thought detail');
    expect(container.textContent).not.toContain('second thought detail');
  });
});
