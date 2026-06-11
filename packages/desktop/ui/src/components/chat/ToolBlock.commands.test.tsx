// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { ToolBlock } from './ToolBlock';
import {
  TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT,
  TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT,
  type ToolBlockCommandDetail,
} from './toolBlockCommands';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../store', () => ({
  useAllRuns: () => [],
  useAllSessions: () => [],
  useAllTasks: () => [],
}));

function toolBlock(overrides: Partial<Extract<MessageBlock, { type: 'tool_use' }>> = {}): Extract<MessageBlock, { type: 'tool_use' }> {
  return {
    type: 'tool_use',
    id: 'tool-1',
    ts: '2026-06-11T12:00:00.000Z',
    tool: 'bash',
    input: { command: 'echo hello' },
    output: 'result-output',
    status: 'ok',
    ...overrides,
  };
}

function listedRuns(count: number): Array<{ runId: string; status: string; kind: string }> {
  const names = ['alpha-check', 'beta-check', 'gamma-check', 'delta-check', 'epsilon-check', 'zeta-check'];
  return Array.from({ length: count }, (_, index) => ({
    runId: `run-${names[index] ?? `extra-${index + 1}`}`,
    status: 'completed',
    kind: 'background-run',
  }));
}

describe('ToolBlock commands', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles the first visible tool block from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ToolBlock block={toolBlock()} autoOpen={false} />);
    });

    expect(container.textContent).toContain('show');
    expect(container.textContent).not.toContain('result-output');

    act(() => {
      window.dispatchEvent(new CustomEvent<ToolBlockCommandDetail>(TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('hide');
    expect(container.textContent).toContain('result-output');
  });

  it('lets only the first mounted tool block handle one shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          <ToolBlock block={toolBlock({ id: 'tool-1', input: { command: 'echo first' }, output: 'first-output' })} autoOpen={false} />
          <ToolBlock block={toolBlock({ id: 'tool-2', input: { command: 'echo second' }, output: 'second-output' })} autoOpen={false} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<ToolBlockCommandDetail>(TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('first-output');
    expect(container.textContent).not.toContain('second-output');
  });

  it('toggles the first tool block linked-run overflow from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ToolBlock block={toolBlock({ tool: 'run', details: { action: 'list', runs: listedRuns(6) } })} autoOpen={false} />);
    });

    expect(container.textContent).toContain('Showing 5 of 6 executions returned by the tool.');
    expect(container.textContent).toContain('Epsilon check');
    expect(container.textContent).not.toContain('Zeta check');

    act(() => {
      window.dispatchEvent(new CustomEvent<ToolBlockCommandDetail>(TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('Showing all 6 executions returned by the tool.');
    expect(container.textContent).toContain('Zeta check');
  });
});
