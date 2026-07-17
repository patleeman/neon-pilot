// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, type SubagentBlockCommandDetail } from './subagentBlockCommands';
import { SubagentBlock } from './TraceBlocks';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function subagentBlock(overrides: Partial<Extract<MessageBlock, { type: 'subagent' }>> = {}): Extract<MessageBlock, { type: 'subagent' }> {
  return {
    type: 'subagent',
    id: 'subagent-1',
    ts: '2026-06-11T12:00:00.000Z',
    name: 'Audit worker',
    prompt: 'Inspect command coverage',
    status: 'complete',
    summary: 'Found one actionable gap',
    ...overrides,
  };
}

describe('SubagentBlock commands', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles the first visible subagent block from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SubagentBlock block={subagentBlock()} />);
    });

    expect(container.textContent).toContain('show');
    expect(container.textContent).not.toContain('Inspect command coverage');

    act(() => {
      window.dispatchEvent(new CustomEvent<SubagentBlockCommandDetail>(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('hide');
    expect(container.textContent).toContain('Inspect command coverage');
  });

  it('lets only the first mounted subagent block handle one shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          <SubagentBlock block={subagentBlock({ id: 'subagent-1', name: 'First', prompt: 'first prompt detail' })} />
          <SubagentBlock block={subagentBlock({ id: 'subagent-2', name: 'Second', prompt: 'second prompt detail' })} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<SubagentBlockCommandDetail>(SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('first prompt detail');
    expect(container.textContent).not.toContain('second prompt detail');
  });
});
